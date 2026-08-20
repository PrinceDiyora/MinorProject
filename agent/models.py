"""
models.py — AgentState TypedDict for the Voice Ordering Agent.

New flat stage-machine architecture (v2).
Replaces current_node / needs_user_input with a single 'stage' field.
"""

from __future__ import annotations
from typing import TypedDict


class AgentState(TypedDict):
    # ── Session identifiers ──────────────────────────────────────────────────
    session_id:   str
    admin_id:     int

    # ── Menu / suggestions ───────────────────────────────────────────────────
    available_items:    list[dict]   # fetched once on session start
    combo_suggestions:  list[dict]   # fetched when ordering is done

    # ── Cart ─────────────────────────────────────────────────────────────────
    # [{food_id: int, name: str, quantity: int, price: float}]
    cart: list[dict]

    # ── Customer info ────────────────────────────────────────────────────────
    customer_info: dict   # {name: str|None, phone: str|None, address: str|None}

    # ── Conversation ─────────────────────────────────────────────────────────
    conversation_history: list[dict]   # [{role: "human"|"assistant", content: str}]
    detected_language:    str          # hi-IN, en-IN, gu-IN, …

    # ── Stage machine ────────────────────────────────────────────────────────
    # ordering  → customer is adding items
    # recommend → agent pitched combos, waiting for customer reply
    # collect   → collecting name / phone / address one field at a time
    # confirm   → showed order summary, waiting for YES / NO / CANCEL
    # ended     → call is over (order placed or cancelled)
    stage:            str        # ordering | recommend | collect | confirm | ended
    collecting_field: str | None  # "name" | "phone" | "address" | None

    # ── Output ───────────────────────────────────────────────────────────────
    placed_order_id: int | None
    last_reply_text: str   # last spoken text (for reference / logging)
