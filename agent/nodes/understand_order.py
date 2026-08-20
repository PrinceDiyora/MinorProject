"""
understand_order.py — The central ordering node.

Responsibilities (single LLM call handles ALL of these):
  - Ordering: fuzzy-match items, add to cart
  - Questions: is X veg? what's the price? what's available?
  - Changes:   remove item, change quantity
  - Combos:    suggest from combo_suggestions
  - Done:      set current_node = "collect_info" when done_ordering = true

This node loops back to itself for every user turn until the customer is done.
"""

from __future__ import annotations

import json
import re

from models          import AgentState
from services.gemini import call_llm

# Server-side done-detection — catches both romanized AND Devanagari phrases.
_DONE_RE = re.compile(
    # Romanized Hindi/English
    r'(?:\b(?:bas|done|finish|finalize|place.?order|confirm|ho.?gaya|thats?.?all|'
    r'order.?karo|order.?kar|proceed|complete|sab.?ho.?gaya|'
    r'bas.?yahi|yahi.?chahiye|nothing.?else|i.?m.?done|that.?will.?be.?all|'
    r'order.?place|place.?kar|khatam|ho.?gya|order.?do|pakka|chalega|'
    r'no.?more|enough|ready|final|over)\b'
    # Devanagari (Hindi) phrases — STT output
    r'|बस|हो\s*गया|ऑर्डर\s*(कर|करो|कर\s*दो|करना|कन्फ़र्म)|पूरा|खतम|'
    r'और\s*कुछ\s*नहीं|और\s*नहीं|बस\s*इतना|बस\s*यही|'
    r'कन्फ़र्म|कम्प्लीट|प्लेस\s*ऑर्डर|ऑर्डर\s*प्लेस|'
    r'हो\s*गई|ये\s*ही|यही\s*चाहिए|इतना\s*ही)',
    re.IGNORECASE | re.UNICODE,
)

# ── System prompt template ────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a fast, friendly restaurant ordering assistant.
Always reply in the SAME language the customer used.

AVAILABLE MENU (id|name|price|category|veg):
{available_items_json}

CURRENT CART:
{cart_json}

RULES:
1. ORDERING: Add item to cart_updates immediately. Default qty=1. Keep reply to 1 sentence: "X added! Anything else?"
2. QUESTIONS about menu: answer briefly from the data above.
3. CHANGES: quantity=0 to remove, new number to update.
4. UNAVAILABLE: say not available, suggest alternative.
5. DONE: If customer indicates they are finished ordering (e.g. "bas", "done", "that's all", "ho gaya", "place order", "confirm", "khatam", "बस", "हो गया", "ऑर्डर करो", "कन्फर्म", "और कुछ नहीं") → set done_ordering=true and reply "Perfect! Checking best deals for you..."

OUTPUT: Return ONLY raw JSON (no markdown, no explanation):
{{"reply_text":"<1-2 sentences max>","cart_updates":[{{"food_id":<int>,"name":"<str>","quantity":<int>,"price":<float>}}],"done_ordering":<true|false>,"is_question":<true|false>}}"""


async def understand_order_node(state: AgentState) -> AgentState:
    """
    Main ordering loop node.
    Calls Gemini with full context, merges cart_updates, routes to recommend
    when done_ordering=true.
    """
    # ── 1. Build system prompt ──────────────────────────────────────────────
    # Compact menu representation to save tokens: only needed fields
    compact_menu = [
        {
            "id":       item.get("id") or item.get("food_id"),
            "name":     item.get("name", ""),
            "price":    item.get("selling_price", item.get("price", 0)),
            "category": item.get("category_name", ""),
            "avail":    item.get("is_available", True),
        }
        for item in state["available_items"]
        if item.get("is_available", True)
    ]
    system_prompt = SYSTEM_PROMPT.format(
        available_items_json=json.dumps(compact_menu, ensure_ascii=False),
        cart_json=json.dumps(state["cart"],           ensure_ascii=False),
    )

    # ── 2. Call Gemini ───────────────────────────────────────────────
    result = call_llm(system_prompt, state["conversation_history"])

    # ── 3. Server-side done override ────────────────────────────────────────
    # If LLM missed the "done" signal (token truncation / parse failure),
    # we catch it ourselves so the flow is never stuck.
    last_human = next(
        (t["content"] for t in reversed(state["conversation_history"]) if t["role"] == "human"),
        "",
    )
    if not result.get("done_ordering") and state["cart"] and _DONE_RE.search(last_human):
        result["done_ordering"] = True
        result["reply_text"] = "Perfect! Let me check some great combo deals for you."
        result["cart_updates"] = []  # don't accidentally modify cart on done

    # ── 4. Merge cart_updates into cart ───────────────────────────────────────
    cart = list(state["cart"])  # shallow copy

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

    # ── 5. Determine next node ───────────────────────────────────────────────
    # Route to recommend for combo pitching before collecting customer info
    done = result.get("done_ordering", False)
    next_node = "recommend" if done else "understand_order"
    # If done, auto-chain into recommend (no user input needed between these).
    # Also suppress the intermediate reply_text so we don't send two TTS back-to-back.
    # The recommend node will produce the actual spoken response.
    needs_input = not done
    reply_text  = "" if done else result["reply_text"]

    # ── 6. Append assistant reply to history ──────────────────────────────────
    # Only add to history if there's something worth logging
    history_entry = result["reply_text"] if result["reply_text"] else "Order noted."
    new_history = state["conversation_history"] + [
        {"role": "assistant", "content": history_entry}
    ]

    return {
        **state,
        "cart":                 cart,
        "last_reply_text":      reply_text,
        "current_node":         next_node,
        "needs_user_input":     needs_input,
        "conversation_history": new_history,
    }
