"""
end_call.py — End call node.

Final node in the graph. Sets current_node = "end_call" (terminal).
The WebSocket handler detects this node and sends {type:"call_ended"}.
"""

from __future__ import annotations

from models import AgentState


async def end_call_node(state: AgentState) -> AgentState:
    """
    Nothing to do here — already spoke the farewell in place_order
    or confirm_order (on cancel). Just mark as terminal.
    """
    return {
        **state,
        "current_node":     "end_call",
        "needs_user_input": False,
    }
