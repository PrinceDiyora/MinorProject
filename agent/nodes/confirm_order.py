"""
confirm_order.py — Show order summary and ask for YES / NO / CANCEL.

Routes:
  YES / HAAN → order_confirmed = True, next = "place_order"
  NO  / change→ next = "understand_order"  (let customer modify)
  CANCEL      → next = "end_call"

Uses Gemini to classify the user's response.
"""

from __future__ import annotations

from models          import AgentState
from services.gemini import call_llm_for_confirmation


def _build_summary(cart: list[dict], customer_info: dict) -> str:
    """Build a human-readable order summary."""
    lines = ["Your order:"]
    total = 0.0
    for item in cart:
        subtotal = item["price"] * item["quantity"]
        total   += subtotal
        lines.append(f"  • {item['name']} x{item['quantity']} = ₹{subtotal:.2f}")
    lines.append(f"Total: ₹{total:.2f}")
    lines.append(f"Name: {customer_info.get('name', '-')}")
    lines.append(f"Phone: {customer_info.get('phone', '-')}")
    lines.append(f"Address: {customer_info.get('address', '-')}")
    return "\n".join(lines)


async def confirm_order_node(state: AgentState) -> AgentState:
    """
    On first entry: build and speak the order summary.
    On subsequent entries (user replied): classify YES / NO / CANCEL.

    First-entry detection: we track via a dedicated flag in state.
    We show the summary if the last assistant message does NOT already contain
    the summary marker — i.e., we haven't shown it yet this visit.
    """
    history  = state["conversation_history"]
    language = state.get("detected_language", "hi-IN")

    # ── Detect whether we've already shown the summary this visit ──────────
    # Find the last assistant message
    last_asst = None
    for turn in reversed(history):
        if turn["role"] == "assistant":
            last_asst = turn["content"]
            break

    summary_marker = "Your order:"

    # Show summary if:
    #   1. No assistant message yet, OR
    #   2. The last assistant message doesn't contain the summary
    #      (meaning we just arrived from collect_info and haven't shown it yet)
    # Don't show again if last assistant message IS the summary (waiting for reply)
    last_human = None
    for turn in reversed(history):
        if turn["role"] == "human":
            last_human = turn["content"]
            break

    already_showed_summary = last_asst and summary_marker in last_asst

    if not already_showed_summary:
        # First pass — show summary and wait for YES/NO
        summary   = _build_summary(state["cart"], state["customer_info"])
        question  = f"{summary}\n\nKya aap confirm karna chahte hain? Haan (Yes) ya Nahi (No)?"
        new_history = history + [{"role": "assistant", "content": question}]
        return {
            **state,
            "last_reply_text":      question,
            "current_node":         "confirm_order",
            "needs_user_input":     True,
            "conversation_history": new_history,
        }

    # ── User responded — classify intent ─────────────────────────────────────
    if not last_human:
        # Edge case: no human message yet, show summary again
        summary  = _build_summary(state["cart"], state["customer_info"])
        question = f"{summary}\n\nPlease say Yes to confirm, No to change, or Cancel."
        new_history = history + [{"role": "assistant", "content": question}]
        return {
            **state,
            "last_reply_text":      question,
            "current_node":         "confirm_order",
            "needs_user_input":     True,
            "conversation_history": new_history,
        }

    intent = await call_llm_for_confirmation(last_human, language)

    if intent == "YES":
        reply = ""  # suppress — place_order will speak the confirmation with order ID
        new_history = history + [{"role": "assistant", "content": "Great! Placing your order now..."}]
        return {
            **state,
            "order_confirmed":      True,
            "last_reply_text":      reply,
            "current_node":         "place_order",
            "needs_user_input":     False,  # auto-chain to place_order immediately
            "conversation_history": new_history,
        }

    elif intent == "NO":
        reply = "Sure! What would you like to change?"
        new_history = history + [{"role": "assistant", "content": reply}]
        return {
            **state,
            "last_reply_text":      reply,
            "current_node":         "understand_order",
            "needs_user_input":     True,
            "conversation_history": new_history,
        }

    elif intent == "CANCEL":
        reply = "Order cancelled. Thank you for calling! Have a great day."
        new_history = history + [{"role": "assistant", "content": reply}]
        return {
            **state,
            "last_reply_text":      reply,
            "current_node":         "end_call",
            "needs_user_input":     False,
            "conversation_history": new_history,
        }

    else:
        # UNKNOWN — re-ask
        summary  = _build_summary(state["cart"], state["customer_info"])
        question = f"{summary}\n\nPlease say Yes to confirm or No to change."
        new_history = history + [{"role": "assistant", "content": question}]
        return {
            **state,
            "last_reply_text":      question,
            "current_node":         "confirm_order",
            "needs_user_input":     True,
            "conversation_history": new_history,
        }
