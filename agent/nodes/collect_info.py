"""
collect_info.py — Collect customer name, phone, and address.

Flow:
  1. If the conversation_history has a new human message, parse it to extract
     the answer to the previously asked field.
  2. Ask for the next missing field.
  3. When all three are filled → next_node = "confirm_order".

Uses Gemini to extract structured info from free-form responses.
"""

from __future__ import annotations

from models           import AgentState
from services.gemini  import call_llm_for_info

# Which field to ask for in each step
_FIELD_ORDER = ("name", "phone", "address")

# Multilingual question templates (Gemini will re-ask in detected language,
# but these serve as fallback if Gemini fails)
_QUESTIONS = {
    "name":    "Ek kaam ki baat — aapka naam kya hai? (What's your name?)",
    "phone":   "Aur aapka phone number? Taaki delivery ke waqt hum contact kar sakein.",
    "address": "Bilkul! Delivery address bata dijiye — ghar ya office, jahan bhi chahiye.",
}


def _first_missing(info: dict) -> str | None:
    """Return the first missing field name, or None if all filled."""
    for field in _FIELD_ORDER:
        if not info.get(field):
            return field
    return None


async def collect_info_node(state: AgentState) -> AgentState:
    """
    Collect name, phone, address one field at a time using Gemini extraction.
    Once all are filled, route to confirm_order.
    """
    info     = dict(state["customer_info"])
    history  = state["conversation_history"]
    language = state.get("detected_language", "hi-IN")

    # ── Step 1: Extract an answer from the latest human message (if any) ────
    # Find the most recent human message after the last assistant message
    # that asked for a field.
    last_human_msg = None
    extraction = None  # track the Gemini extraction result
    for turn in reversed(history):
        if turn["role"] == "human":
            last_human_msg = turn["content"]
            break

    if last_human_msg:
        # Determine which field was most recently asked (= first missing before
        # we received this message, inferred from what's still missing now)
        # We parse the message for whatever is still None first.
        target = _first_missing(info)
        if target:
            extraction = await call_llm_for_info(
                field=target,
                user_message=last_human_msg,
                language_code=language,
                current_info=info,
            )
            extracted = extraction.get("extracted_value")
            if extracted and str(extracted).strip():
                info[target] = str(extracted).strip()

    # ── Step 2: Ask for next missing field (or route forward) ────────────────
    next_missing = _first_missing(info)

    if not next_missing:
        # All fields collected → go to confirm_order (auto-chain in).
        # Suppress the TTS here — confirm_order will speak the summary immediately.
        new_history = history + [
            {"role": "assistant", "content": "Shukriya! Ab main aapka order confirm karta hoon."}
        ]
        return {
            **state,
            "customer_info":        info,
            "last_reply_text":      "",          # suppress — confirm_order speaks next
            "current_node":         "confirm_order",
            "needs_user_input":     False,  # auto-chain to confirm_order to show summary
            "conversation_history": new_history,
        }

    # Ask for the next field using Gemini-generated question or fallback template
    question = _QUESTIONS[next_missing]

    # If we just extracted a field, use Gemini's suggested next_question
    if last_human_msg and extraction is not None:
        gq = extraction.get("next_question", "")
        if gq:
            question = gq

    new_history = history + [
        {"role": "assistant", "content": question}
    ]

    return {
        **state,
        "customer_info":        info,
        "last_reply_text":      question,
        "current_node":         "collect_info",   # loop until all fields done
        "needs_user_input":     True,
        "conversation_history": new_history,
    }
