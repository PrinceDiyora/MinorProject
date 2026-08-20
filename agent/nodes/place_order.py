"""
place_order.py — THE ONLY NODE THAT WRITES TO THE DATABASE.

Only runs after order_confirmed = True.
POSTs to Node.js POST /api/voice/orders (which handles the full DB transaction).
"""

from __future__ import annotations

from models               import AgentState
from services.nodejs_api  import place_order as api_place_order


async def place_order_node(state: AgentState) -> AgentState:
    """
    Place the confirmed order via Node.js API.
    On success: set order_placed=True, placed_order_id, speak confirmation.
    On error:   speak error message, route back to confirm_order to retry.
    """
    cart          = state["cart"]
    customer_info = state["customer_info"]

    # Calculate total_amount
    total_amount = sum(item["price"] * item["quantity"] for item in cart)

    # Format items for the API
    items_payload = [
        {
            "food_id":               item["food_id"],
            "quantity":              item["quantity"],
            "price":                 item["price"],
            "is_upsell":             False,
            "upsell_discount_pct":   0,
        }
        for item in cart
    ]

    try:
        result   = await api_place_order(
            admin_id=state["admin_id"],
            customer=customer_info,
            items=items_payload,
            total_amount=total_amount,
        )
        order_id = result.get("order_id")

        reply = (
            f"Your order #{order_id} has been placed successfully! "
            f"Total amount: ₹{total_amount:.2f}. "
            f"We will deliver to {customer_info.get('address', 'your address')} shortly. "
            f"Thank you and enjoy your meal!"
        )

        new_history = state["conversation_history"] + [
            {"role": "assistant", "content": reply}
        ]

        return {
            **state,
            "order_placed":         True,
            "placed_order_id":      order_id,
            "last_reply_text":      reply,
            "current_node":         "end_call",
            "needs_user_input":     False,  # auto-chain to end_call
            "conversation_history": new_history,
        }

    except Exception as exc:
        error_reply = (
            f"Sorry, we couldn't place your order due to a technical issue: {exc}. "
            f"Please try again."
        )
        new_history = state["conversation_history"] + [
            {"role": "assistant", "content": error_reply}
        ]
        return {
            **state,
            "last_reply_text":      error_reply,
            "current_node":         "confirm_order",   # retry
            "needs_user_input":     True,
            "conversation_history": new_history,
        }
