"""
main.py — FastAPI + WebSocket voice ordering agent (v2).

New flat architecture — no LangGraph, no node dispatch.
All agent logic lives in orchestrator.process_turn().

WebSocket endpoint: ws://localhost:8001/ws/order-agent

Protocol (client → server):
  {type: "session_start", admin_id: int}   → init session, plays greeting
  <binary bytes>                           → mic audio chunk
  {type: "stop_speaking"}                  → end of utterance → STT → LLM → TTS

Protocol (server → client):
  {type: "audio",      data: "<base64 WAV>"}   → agent speech
  {type: "call_ended", order_id: int|null}      → session over
  {type: "error",      message: str}            → error detail
"""

from __future__ import annotations

import base64
import json
import logging
import uuid
from typing import Dict

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from models              import AgentState
from orchestrator        import process_turn
from services.sarvam     import sarvam_stt, sarvam_tts
from services.nodejs_api import fetch_menu

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
log = logging.getLogger("voice-agent")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Voice Ordering Agent", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: Dict[str, AgentState] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_state(session_id: str, admin_id: int, menu: list[dict]) -> AgentState:
    return AgentState(
        session_id=session_id,
        admin_id=admin_id,
        available_items=menu,
        combo_suggestions=[],
        cart=[],
        customer_info={"name": None, "phone": None, "address": None},
        conversation_history=[],
        detected_language="hi-IN",
        stage="ordering",
        collecting_field=None,
        placed_order_id=None,
        last_reply_text="",
    )


def _make_greeting(menu: list[dict]) -> str:
    avail  = [i for i in menu if i.get("is_available", True)]
    count  = len(avail)
    step   = max(1, count // 3)
    picks  = [avail[0], avail[min(step, count - 1)], avail[min(step * 2, count - 1)]] if count >= 3 else avail
    sample = ", ".join(i["name"] for i in picks) if picks else "hamare specials"
    return (
        f"Namaste! Aapka swagat hai. "
        f"Aaj hamare paas {count} items hain jaise {sample} aur bahut kuch aur. "
        f"Main aapko combo suggestions bhi de sakta hoon. "
        f"Kya order karna chahte hain? Hindi ya English mein boliye."
    )


async def _tts_send(ws: WebSocket, text: str, lang: str) -> None:
    """Convert text to speech and send base64 WAV. Skips silently if text is empty."""
    if not text or not text.strip():
        return
    try:
        wav_bytes = await sarvam_tts(text, lang)
        await ws.send_json({
            "type": "audio",
            "data": base64.b64encode(wav_bytes).decode("utf-8"),
        })
    except Exception as exc:
        log.error("TTS error: %s", exc)
        await ws.send_json({"type": "error", "message": str(exc)})


# ── WebSocket handler ─────────────────────────────────────────────────────────

@app.websocket("/ws/order-agent")
async def order_agent_ws(ws: WebSocket):
    await ws.accept()
    session_id   = str(uuid.uuid4())
    audio_buffer = bytearray()
    state: AgentState | None = None

    log.info("WebSocket connected  session=%s", session_id)

    try:
        while True:
            message = await ws.receive()

            # Graceful disconnect
            if message.get("type") == "websocket.disconnect":
                break

            # ── Binary audio chunk ────────────────────────────────────────
            if message["type"] == "websocket.receive" and message.get("bytes"):
                audio_buffer.extend(message["bytes"])
                continue

            # ── Text / JSON messages ──────────────────────────────────────
            raw = message.get("text")
            if not raw:
                continue

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type")

            # ── session_start ─────────────────────────────────────────────
            if msg_type == "session_start":
                admin_id = int(data.get("admin_id", 0))
                if not admin_id:
                    await ws.send_json({"type": "error", "message": "admin_id required"})
                    continue

                log.info("session_start  admin_id=%d  session=%s", admin_id, session_id)

                try:
                    menu = await fetch_menu(admin_id)
                except Exception as exc:
                    log.error("Menu fetch failed: %s", exc)
                    await ws.send_json({"type": "error", "message": f"Menu fetch failed: {exc}"})
                    continue

                greeting = _make_greeting(menu)
                state    = _make_state(session_id, admin_id, menu)
                state["conversation_history"] = [{"role": "assistant", "content": greeting}]
                state["last_reply_text"]       = greeting
                sessions[session_id]           = state

                await _tts_send(ws, greeting, state["detected_language"])

            # ── stop_speaking ─────────────────────────────────────────────
            elif msg_type == "stop_speaking":
                if state is None:
                    await ws.send_json({"type": "error", "message": "Session not started"})
                    continue

                if not audio_buffer:
                    await ws.send_json({"type": "error", "message": "No audio received"})
                    continue

                # ── STT ───────────────────────────────────────────────────
                try:
                    stt_result    = await sarvam_stt(bytes(audio_buffer), state["detected_language"])
                    transcript    = stt_result["transcript"]
                    language_code = stt_result["language_code"]
                    log.info("STT  lang=%s  transcript=%r", language_code, transcript[:80])
                except Exception as exc:
                    log.error("STT error: %s", exc)
                    await ws.send_json({"type": "error", "message": f"STT failed: {exc}"})
                    continue
                finally:
                    audio_buffer.clear()

                # Update language in state
                state = {**state, "detected_language": language_code}

                # ── Agent turn ─────────────────────────────────────────────
                try:
                    state, reply, end_call = await process_turn(state, transcript, language_code)
                    sessions[session_id] = state
                except Exception as exc:
                    log.error("process_turn error: %s", exc, exc_info=True)
                    await ws.send_json({"type": "error", "message": f"Agent error: {exc}"})
                    continue

                # ── TTS reply ──────────────────────────────────────────────
                if reply:
                    await _tts_send(ws, reply, language_code)

                # ── End call if done ───────────────────────────────────────
                if end_call:
                    log.info("Call ended  order_id=%s", state.get("placed_order_id"))
                    await ws.send_json({
                        "type":     "call_ended",
                        "order_id": state.get("placed_order_id"),
                    })
                    return   # exits the handler (triggers finally cleanup)

    except WebSocketDisconnect:
        log.info("WebSocket disconnected  session=%s", session_id)
    finally:
        sessions.pop(session_id, None)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "voice-ordering-agent", "version": "2.0"}


