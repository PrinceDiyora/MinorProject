"""
orchestrator.py — process_turn(): the single function that handles all agent logic.

Stage machine:
  ordering   user adds/removes items; LLM extracts cart + detects "done"
               ↓ (done + combos available)
  recommend  agent pitches combos; waits one turn for customer reply
               ↓ (always, regardless of their answer)
  collect    collects name → phone → address one field at a time
               ↓ (all fields filled; auto-shows order summary)
  confirm    customer says YES / NO / CANCEL
               ↓ YES
             [API call: place order]
               ↓
  ended      call is over

All internal stage transitions happen inside a SINGLE process_turn() call.
The function returns (new_state, reply_text, end_call).
  reply_text  — the single string to send to TTS (never double-audio)
  end_call    — True means WebSocket should close after TTS
"""

from __future__ import annotations

import logging
from typing import Tuple

from models              import AgentState
from services.gemini     import (
    extract_order,
    pitch_combos,
    handle_combo_reply,
    extract_field,
    classify_yes_no,
)
from services.nodejs_api import fetch_recommendations, place_order as api_place_order

log = logging.getLogger("voice-agent")

# ── Field collection config ───────────────────────────────────────────────────

_FIELD_ORDER = ("name", "phone", "address")

_FIELD_QUESTIONS: dict[str, dict[str, str]] = {
    "name": {
        "hi-IN": "Ek kaam ki baat — aapka naam kya hai?",
        "en-IN": "May I have your name please?",
        "gu-IN": "Aapnu naam shu che?",
        "ta-IN": "Ungal peyar enna?",
        "te-IN": "Meeru peru enti?",
        "mr-IN": "Tumcha nav kay aahe?",
    },
    "phone": {
        "hi-IN": "Aur aapka 10-digit phone number?",
        "en-IN": "Your 10-digit phone number please?",
        "gu-IN": "Aapno 10-digit phone number?",
    },
    "address": {
        "hi-IN": "Delivery address bataiye — ghar ho ya office, jahan bhi chahiye.",
        "en-IN": "What's your delivery address?",
        "gu-IN": "Delivery address kyathi moklavanu che?",
    },
}


def _field_q(field: str, language: str) -> str:
    qs = _FIELD_QUESTIONS.get(field, {})
    return qs.get(language, qs.get("hi-IN", f"Aapka {field} bataiye?"))


def _first_missing(info: dict) -> str | None:
    for f in _FIELD_ORDER:
        if not info.get(f):
            return f
    return None


def _build_summary(cart: list[dict], info: dict) -> str:
    lines = ["Aapka order:"]
    total = 0.0
    for item in cart:
        sub = float(item.get("price", 0)) * int(item.get("quantity", 1))
        total += sub
        lines.append(f"  • {item['name']} x{item['quantity']} = Rs.{sub:.0f}")
    lines.append(f"Kul total: Rs.{total:.0f}")
    lines.append(f"Naam: {info.get('name', '-')}")
    lines.append(f"Phone: {info.get('phone', '-')}")
    lines.append(f"Delivery: {info.get('address', '-')}")
    return "\n".join(lines)


def _merge_cart(cart: list[dict], updates: list[dict]) -> list[dict]:
    cart = list(cart)
    for u in updates:
        fid = u.get("food_id")
        qty = int(u.get("quantity", 0))
        existing = next((x for x in cart if x["food_id"] == fid), None)
        if qty == 0 and existing:
            cart.remove(existing)
        elif existing:
            existing["quantity"] = qty
        elif qty > 0:
            cart.append({
                "food_id":  fid,
                "name":     u.get("name", ""),
                "quantity": qty,
                "price":    float(u.get("price", 0.0)),
            })
    return cart


def _next_state(base: AgentState, transcript: str, reply: str, **overrides) -> AgentState:
    """
    Build the next state by spreading base, appending conversation history,
    and applying any overrides.
    """
    new_hist = base["conversation_history"] + [
        {"role": "human",     "content": transcript},
        {"role": "assistant", "content": reply},
    ]
    return {           # type: ignore[return-value]
        **base,
        "conversation_history": new_hist,
        "last_reply_text":      reply,
        **overrides,
    }


# ── Main orchestrator ─────────────────────────────────────────────────────────

async def process_turn(
    state:      AgentState,
    transcript: str,
    language:   str,
) -> Tuple[AgentState, str, bool]:
    """
    Process one user utterance.

    Args:
        state:      current AgentState
        transcript: STT output from the user
        language:   BCP-47 language code detected by STT

    Returns:
        (new_state, reply_text, end_call)
        reply_text  — single string to send to TTS
        end_call    — True means close the WebSocket after TTS
    """
    stage = state["stage"]
    cart  = list(state["cart"])
    info  = dict(state["customer_info"])
    hist  = state["conversation_history"]

    log.info("process_turn  stage=%-12s  transcript=%r", stage, transcript[:60])

    # ─────────────────────────────────────────────────────────────────────────
    # ORDERING — customer is adding / removing / asking about items
    # ─────────────────────────────────────────────────────────────────────────
    if stage == "ordering":
        result   = await extract_order(transcript, state["available_items"], cart, hist, language)
        new_cart = _merge_cart(cart, result.get("cart_updates", []))

        if result.get("done_ordering"):
            if not new_cart:
                reply = "Aapka cart abhi khali hai. Pehle kuch order kijiye?"
                return _next_state(state, transcript, reply, cart=new_cart), reply, False

            # Fetch combo suggestions
            try:
                cart_ids = [i["food_id"] for i in new_cart]
                combos   = await fetch_recommendations(state["admin_id"], cart_ids)
            except Exception as exc:
                log.warning("fetch_recommendations failed (non-critical): %s", exc)
                combos = []

            if combos:
                # Pitch combos → stage: recommend (wait for one reply)
                reply = await pitch_combos(new_cart, combos, language)
                return _next_state(
                    state, transcript, reply,
                    cart=new_cart, combo_suggestions=combos, stage="recommend",
                ), reply, False
            else:
                # No combos → skip straight to collect name
                field = "name"
                reply = _field_q(field, language)
                return _next_state(
                    state, transcript, reply,
                    cart=new_cart, combo_suggestions=[], stage="collect",
                    collecting_field=field,
                ), reply, False

        # Still ordering — reply with confirmation / question
        reply = result.get("reply") or "Kya aur order karna hai?"
        return _next_state(state, transcript, reply, cart=new_cart), reply, False

    # ─────────────────────────────────────────────────────────────────────────
    # RECOMMEND — customer just replied to the combo pitch
    # Parse their response (may add items), then always move to collect
    # ─────────────────────────────────────────────────────────────────────────
    elif stage == "recommend":
        result   = await handle_combo_reply(transcript, state["combo_suggestions"], language)
        new_cart = _merge_cart(cart, result.get("cart_updates", []))

        field = "name"
        reply = _field_q(field, language)
        return _next_state(
            state, transcript, reply,
            cart=new_cart, stage="collect", collecting_field=field,
        ), reply, False

    # ─────────────────────────────────────────────────────────────────────────
    # COLLECT — gathering name → phone → address one at a time
    # When all three are collected, auto-show order summary → stage: confirm
    # ─────────────────────────────────────────────────────────────────────────
    elif stage == "collect":
        field     = state.get("collecting_field") or _first_missing(info) or "name"
        extracted = await extract_field(field, transcript, language)
        if extracted:
            info[field] = extracted

        next_field = _first_missing(info)

        if not next_field:
            # All fields collected — show summary and ask for confirmation
            summary = _build_summary(cart, info)
            reply   = f"{summary}\n\nKya confirm karna chahte hain? Haan boliye ya Nahi."
            return _next_state(
                state, transcript, reply,
                customer_info=info, stage="confirm", collecting_field=None,
            ), reply, False
        else:
            reply = _field_q(next_field, language)
            return _next_state(
                state, transcript, reply,
                customer_info=info, collecting_field=next_field,
            ), reply, False

    # ─────────────────────────────────────────────────────────────────────────
    # CONFIRM — classify YES / NO / CANCEL
    # YES   → place order via API → ended (end_call=True)
    # NO    → back to ordering
    # CANCEL→ ended (end_call=True)
    # ─────────────────────────────────────────────────────────────────────────
    elif stage == "confirm":
        intent = await classify_yes_no(transcript, language)
        log.info("confirm  intent=%s", intent)

        if intent == "YES":
            total         = sum(float(i["price"]) * int(i["quantity"]) for i in cart)
            items_payload = [
                {
                    "food_id":             i["food_id"],
                    "quantity":            i["quantity"],
                    "price":               i["price"],
                    "is_upsell":           False,
                    "upsell_discount_pct": 0,
                }
                for i in cart
            ]
            try:
                result   = await api_place_order(
                    admin_id=state["admin_id"],
                    customer=info,
                    items=items_payload,
                    total_amount=total,
                )
                order_id = result.get("order_id")
                reply = (
                    f"Bahut badhiya! Aapka order #{order_id} successfully place ho gaya! "
                    f"Total: Rs.{total:.0f}. "
                    f"Delivery aa rahi hai {info.get('address', 'aapke address par')}. "
                    f"Khana enjoy kijiye! Shukriya!"
                )
                return _next_state(
                    state, transcript, reply,
                    stage="ended", placed_order_id=order_id,
                ), reply, True   # end_call = True

            except Exception as exc:
                log.error("place_order failed: %s", exc)
                reply = (
                    "Order place karne mein dikkat aayi. "
                    "Please dobara try karein — Haan boliye ek baar aur."
                )
                return _next_state(state, transcript, reply), reply, False

        elif intent == "NO":
            reply = "Bilkul! Cart mein kya badlaav karna chahte hain?"
            return _next_state(state, transcript, reply, stage="ordering"), reply, False

        elif intent == "CANCEL":
            reply = "Theek hai, order cancel kar diya. Shukriya! Phir zaroor aaiye."
            return _next_state(state, transcript, reply, stage="ended"), reply, True

        else:  # UNKNOWN
            reply = (
                "Maafi chahta hoon. "
                "Haan boliye order confirm karne ke liye, ya Nahi change karne ke liye."
            )
            return _next_state(state, transcript, reply), reply, False

    # ─────────────────────────────────────────────────────────────────────────
    # FALLBACK (ended or unrecognised stage)
    # ─────────────────────────────────────────────────────────────────────────
    else:
        return state, "Shukriya! Call already ended.", True
