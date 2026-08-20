"""
greet.py — Greet node.

Runs once at the start of every session. Produces a welcome greeting
in English (will be translated by TTS to the detected language later).
Does NOT need the LLM — the greeting is deterministic.
"""

from __future__ import annotations
from models import AgentState


async def greet_node(state: AgentState) -> AgentState:
    """
    Generate a clean English greeting.
    English is the safest language for Sarvam TTS on first contact
    before we know the customer's preferred language.
    """
    items = state["available_items"]
    avail = [i for i in items if i.get("is_available", True)]
    count = len(avail)

    # Pick 3 spread-out highlights
    step  = max(1, count // 3)
    picks = [avail[0], avail[min(step, count-1)], avail[min(step*2, count-1)]] if count >= 3 else avail
    sample_str = ", ".join(i["name"] for i in picks) if picks else "our specials"

    greeting = (
        f"Welcome! Thanks for calling. "
        f"We have {count} items available today, like {sample_str} and much more. "
        f"I can suggest great combos too. "
        f"What would you like to order? You can speak in Hindi or English."
    )

    return {
        **state,
        "last_reply_text": greeting,
        "current_node":    "understand_order",
        "needs_user_input": True,
    }
