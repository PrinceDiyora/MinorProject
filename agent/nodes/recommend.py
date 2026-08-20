"""
recommend.py — Proactively suggest combos / upsells after the main order is taken.

Flow:
  First entry  (recommendations_shown=False):
    - Fetch combos from Node.js for the current cart.
    - If combos exist  → pitch them warmly, stay in recommend node waiting for reply.
    - If no combos     → skip straight to collect_info.
  Second entry (recommendations_shown=True, customer replied):
    - Parse reply: add items to cart if customer wants them.
    - Then always move on to collect_info.
"""

from __future__ import annotations

import json

from models              import AgentState
from services.gemini     import call_llm
from services.nodejs_api import fetch_recommendations

# ── Prompts ───────────────────────────────────────────────────────────────────

_PITCH_PROMPT = """You are a friendly restaurant ordering assistant.
The customer just finished placing their main order. Now suggest the best combo deals.

CURRENT CART:
{cart_json}

AVAILABLE COMBO SUGGESTIONS:
{combo_json}

YOUR TASK:
1. Briefly acknowledge what they ordered (1 line).
2. Suggest 1-2 most relevant combos/add-ons from COMBO SUGGESTIONS.
3. Ask if they want to add anything — keep it to 2-3 short sentences total.
4. Be warm, enthusiastic, and natural — like a helpful waiter.
5. Respond in the SAME language the customer has been using.

CRITICAL: Return ONLY valid JSON, no markdown fences:
{{"reply_text": "<your recommendation pitch>", "cart_updates": [], "done_ordering": false, "is_question": true}}
"""

_PARSE_PROMPT = """You are a restaurant ordering assistant.
The customer replied to your combo/upsell suggestion. Extract their intent.

CURRENT CART:
{cart_json}

COMBO SUGGESTIONS THAT WERE OFFERED:
{combo_json}

AVAILABLE MENU (for item lookup):
{menu_json}

CUSTOMER REPLIED: "{customer_reply}"

YOUR TASK:
- If customer wants to add a suggested item → include it in cart_updates with correct food_id, name, price, quantity.
- If customer declines / says no / says they're done → cart_updates = [], done_ordering = true.
- Reply warmly in 1 short sentence confirming their choice.
- Respond in the same language as the customer.

CRITICAL: Return ONLY valid JSON, no markdown fences:
{{"reply_text": "<response>", "cart_updates": [{{"food_id": <int>, "name": "<str>", "quantity": <int>, "price": <float>}}], "done_ordering": <true|false>, "is_question": false}}
"""


# ── Node ──────────────────────────────────────────────────────────────────────

async def recommend_node(state: AgentState) -> AgentState:
    """
    Two-turn recommendation node:
      Turn 1 — agent proactively pitches combos.
      Turn 2 — agent parses customer reply and moves to collect_info.
    """
    cart     = list(state["cart"])
    history  = state["conversation_history"]

    # Fetch fresh recommendations for current cart
    cart_ids = [i["food_id"] for i in cart]
    combos   = await fetch_recommendations(state["admin_id"], cart_ids) if cart_ids else []

    # ── Turn 1: show the pitch ────────────────────────────────────────────────
    if not state.get("recommendations_shown", False):
        if not combos:
            # No combos available — skip straight to collect_info.
            # Suppress TTS here; collect_info will speak the first question.
            return {
                **state,
                "combo_suggestions":     combos,
                "recommendations_shown": True,
                "last_reply_text":       "",   # suppressed — collect_info speaks
                "current_node":          "collect_info",
                "needs_user_input":      False,  # auto-chain into collect_info
                "conversation_history":  history,
            }

        system_prompt = _PITCH_PROMPT.format(
            cart_json=json.dumps(cart,   ensure_ascii=False),
            combo_json=json.dumps(combos, ensure_ascii=False),
        )
        result = call_llm(system_prompt, history)
        new_history = history + [{"role": "assistant", "content": result["reply_text"]}]
        return {
            **state,
            "combo_suggestions":     combos,
            "recommendations_shown": True,
            "last_reply_text":       result["reply_text"],
            "current_node":          "recommend",   # wait for customer reply
            "needs_user_input":      True,           # pitched — now wait
            "conversation_history":  new_history,
        }

    # ── Turn 2: customer replied — parse and move on ──────────────────────────
    last_human = next(
        (t["content"] for t in reversed(history) if t["role"] == "human"), ""
    )
    combos_shown = state.get("combo_suggestions") or combos

    system_prompt = _PARSE_PROMPT.format(
        cart_json=json.dumps(cart,         ensure_ascii=False),
        combo_json=json.dumps(combos_shown, ensure_ascii=False),
        menu_json=json.dumps(state["available_items"][:25], ensure_ascii=False),
        customer_reply=last_human,
    )
    result = call_llm(system_prompt, history)

    # Merge cart_updates
    for update in result.get("cart_updates", []):
        food_id  = update.get("food_id")
        quantity = update.get("quantity", 0)
        existing = next((x for x in cart if x["food_id"] == food_id), None)
        if quantity == 0 and existing:
            cart.remove(existing)
        elif existing:
            existing["quantity"] = quantity
        elif quantity > 0:
            cart.append({
                "food_id":  food_id,
                "name":     update.get("name", ""),
                "quantity": quantity,
                "price":    update.get("price", 0.0),
            })

    new_history = history + [{"role": "assistant", "content": result["reply_text"]}]
    return {
        **state,
        "cart":                  cart,
        "last_reply_text":       "",            # suppress — collect_info speaks next
        "current_node":          "collect_info",
        "needs_user_input":      False,  # auto-chain into collect_info to ask for name
        "conversation_history":  new_history,
    }
