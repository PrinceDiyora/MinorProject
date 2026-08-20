/**
 * VoiceOrderAgent.jsx
 *
 * Voice ordering agent UI panel for the restaurant dashboard.
 *
 * Flow:
 *  1. Admin clicks "Start Order" → opens WebSocket → greeting audio plays
 *  2. Audio ends → MediaRecorder auto-starts recording mic
 *  3. Admin clicks "Done Speaking" → sends audio → agent replies
 *  4. After reply audio ends → auto-record again (loop until call_ended)
 *  5. On call_ended → show order confirmation with order_id
 *
 * Requires:
 *  - VITE_VOICE_AGENT_WS_URL env var (default: ws://localhost:8001/ws/order-agent)
 *  - admin_id from AuthContext
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

const WS_URL =
  import.meta.env.VITE_VOICE_AGENT_WS_URL ||
  "ws://localhost:8001/ws/order-agent";

const STATUS = {
  IDLE:       "idle",
  CONNECTING: "connecting",
  GREETING:   "greeting",       // agent speaking greeting
  LISTENING:  "listening",      // mic open, recording user
  PROCESSING: "processing",     // STT + LLM + TTS in flight
  SPEAKING:   "speaking",       // playing agent audio
  ENDED:      "ended",          // call_ended received
  ERROR:      "error",
};

const STATUS_LABELS = {
  [STATUS.IDLE]:       "Ready",
  [STATUS.CONNECTING]: "Connecting…",
  [STATUS.GREETING]:   "Agent speaking…",
  [STATUS.LISTENING]:  "🎙 Listening — speak now",
  [STATUS.PROCESSING]: "Processing…",
  [STATUS.SPEAKING]:   "Agent speaking…",
  [STATUS.ENDED]:      "Call ended",
  [STATUS.ERROR]:      "Error",
};

export default function VoiceOrderAgent() {
  const { user }                        = useAuth();
  const [callStatus, setCallStatus]     = useState(STATUS.IDLE);
  const [statusMsg, setStatusMsg]       = useState("");
  const [placedOrderId, setPlacedOrderId] = useState(null);
  const [transcript, setTranscript]     = useState([]);  // conversation log

  const wsRef             = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const audioCtxRef       = useRef(null);
  const streamRef         = useRef(null);

  // ── Clean up on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Play WAV from base64 ─────────────────────────────────────────────────
  const playAudio = useCallback(async (base64Wav, onEnded) => {
    const binaryStr = atob(base64Wav);
    const bytes     = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const ctx = audioCtxRef.current || new AudioContext();
    audioCtxRef.current = ctx;

    const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
    const source      = ctx.createBufferSource();
    source.buffer     = audioBuffer;
    source.connect(ctx.destination);
    source.onended    = onEnded;
    source.start(0);
  }, []);

  // ── Start mic recording ──────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const stream = streamRef.current || await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current   = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);   // send 250 ms chunks
      setCallStatus(STATUS.LISTENING);
    } catch (err) {
      setCallStatus(STATUS.ERROR);
      setStatusMsg(`Mic error: ${err.message}`);
    }
  }, []);

  // ── Stop recording and signal agent ─────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
    setCallStatus(STATUS.PROCESSING);

    setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop_speaking" }));
      }
    }, 300);   // brief delay so final ondataavailable fires first
  }, []);

  // ── Handle incoming WebSocket messages ──────────────────────────────────
  const handleWsMessage = useCallback(async (event) => {
    // Binary → raw audio (shouldn't be sent server→client, but guard anyway)
    if (event.data instanceof Blob || event.data instanceof ArrayBuffer) return;

    let data;
    try { data = JSON.parse(event.data); } catch { return; }

    if (data.type === "audio") {
      setCallStatus(STATUS.SPEAKING);
      try {
        await playAudio(data.data, () => {
          // After agent speaks, auto-start listening
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            startRecording();
          }
        });
      } catch {
        startRecording();   // fallback: start listening even if playback fails
      }
    }

    else if (data.type === "call_ended") {
      setPlacedOrderId(data.order_id);
      setCallStatus(STATUS.ENDED);
      setStatusMsg(
        data.order_id
          ? `Order #${data.order_id} placed successfully!`
          : "Call ended. No order was placed."
      );
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }

    else if (data.type === "error") {
      setStatusMsg(`Agent error: ${data.message}`);
    }
  }, [playAudio, startRecording]);

  // ── Start call ───────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!user?.id) {
      setStatusMsg("Not logged in — cannot start voice order.");
      setCallStatus(STATUS.ERROR);
      return;
    }
    setCallStatus(STATUS.CONNECTING);
    setStatusMsg("");
    setPlacedOrderId(null);
    setTranscript([]);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "session_start", admin_id: user.id }));
      setCallStatus(STATUS.GREETING);
    };

    ws.onmessage  = handleWsMessage;
    ws.onerror    = () => { setCallStatus(STATUS.ERROR); setStatusMsg("WebSocket connection failed."); };
    ws.onclose    = () => {
      if (callStatus !== STATUS.ENDED) setCallStatus(STATUS.IDLE);
    };
  }, [user, handleWsMessage, callStatus]);

  // ── End call manually ───────────────────────────────────────────────────
  const endCall = useCallback(() => {
    mediaRecorderRef.current?.stop();
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCallStatus(STATUS.IDLE);
    setStatusMsg("");
  }, []);

  // ── Derived state ────────────────────────────────────────────────────────
  const isActive   = ![STATUS.IDLE, STATUS.ENDED, STATUS.ERROR].includes(callStatus);
  const canListen  = callStatus === STATUS.LISTENING;
  const canSpeak   = callStatus === STATUS.SPEAKING || callStatus === STATUS.GREETING;

  return (
    <div style={styles.card}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <span style={styles.title}>🎙 Voice Order Agent</span>
        <span style={{
          ...styles.badge,
          background: callStatus === STATUS.LISTENING  ? "#16a34a" :
                      callStatus === STATUS.PROCESSING ? "#d97706" :
                      callStatus === STATUS.ERROR       ? "#dc2626" :
                      callStatus === STATUS.ENDED       ? "#7c3aed" : "#475569",
        }}>
          {STATUS_LABELS[callStatus] ?? callStatus}
        </span>
      </div>

      {/* ── Status message ── */}
      {statusMsg && (
        <p style={styles.statusMsg}>{statusMsg}</p>
      )}

      {/* ── Order placed confirmation ── */}
      {callStatus === STATUS.ENDED && placedOrderId && (
        <div style={styles.successBox}>
          ✅ Order <strong>#{placedOrderId}</strong> placed successfully!
        </div>
      )}

      {/* ── Controls ── */}
      <div style={styles.controls}>
        {!isActive && callStatus !== STATUS.ENDED ? (
          <button
            id="start-call"
            onClick={startCall}
            style={{ ...styles.btn, ...styles.btnGreen }}
          >
            🎙 Start Order
          </button>
        ) : isActive ? (
          <>
            <button
              id="done-speaking"
              onClick={stopSpeaking}
              disabled={!canListen}
              style={{
                ...styles.btn,
                ...styles.btnBlue,
                opacity: canListen ? 1 : 0.45,
                cursor:  canListen ? "pointer" : "not-allowed",
              }}
            >
              ⏹ Done Speaking
            </button>
            <button
              onClick={endCall}
              style={{ ...styles.btn, ...styles.btnRed }}
            >
              ✕ End Call
            </button>
          </>
        ) : (
          <button
            onClick={() => { setCallStatus(STATUS.IDLE); setStatusMsg(""); }}
            style={{ ...styles.btn, ...styles.btnGray }}
          >
            ↺ New Call
          </button>
        )}
      </div>

      {/* ── Pulse animation when listening ── */}
      {callStatus === STATUS.LISTENING && (
        <div style={styles.pulseWrap}>
          <span style={styles.pulse} />
          <span style={styles.pulseLabel}>Recording…</span>
        </div>
      )}

      {/* ── Inline style for pulse animation ── */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .pulse-dot { animation: pulse-ring 1.2s ease-out infinite; }
      `}</style>
    </div>
  );
}

// ── Inline styles (matches existing dashboard palette) ────────────────────────
const styles = {
  card: {
    background:   "var(--card, #fff)",
    border:       "1px solid var(--border, #e2e8f0)",
    borderRadius: 12,
    padding:      "1.25rem 1.5rem",
    display:      "flex",
    flexDirection:"column",
    gap:          "0.75rem",
    maxWidth:     480,
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  title: {
    fontWeight: 700,
    fontSize:   "1rem",
    color:      "var(--navy, #0f172a)",
  },
  badge: {
    color:        "#fff",
    borderRadius: 999,
    padding:      "2px 10px",
    fontSize:     "0.75rem",
    fontWeight:   600,
  },
  statusMsg: {
    margin:   0,
    fontSize: "0.8rem",
    color:    "var(--muted, #64748b)",
  },
  successBox: {
    background:   "#f0fdf4",
    border:       "1px solid #86efac",
    borderRadius: 8,
    padding:      "0.5rem 0.85rem",
    fontSize:     "0.875rem",
    color:        "#15803d",
  },
  controls: {
    display: "flex",
    gap:     "0.5rem",
    flexWrap:"wrap",
  },
  btn: {
    border:       "none",
    borderRadius: 8,
    padding:      "0.5rem 1.1rem",
    fontWeight:   600,
    fontSize:     "0.875rem",
    cursor:       "pointer",
    transition:   "opacity 0.15s",
  },
  btnGreen: { background: "#16a34a", color: "#fff" },
  btnBlue:  { background: "#2563eb", color: "#fff" },
  btnRed:   { background: "#dc2626", color: "#fff" },
  btnGray:  { background: "#475569", color: "#fff" },
  pulseWrap: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.5rem",
  },
  pulse: {
    display:     "inline-block",
    width:       10,
    height:      10,
    borderRadius:"50%",
    background:  "#16a34a",
    className:   "pulse-dot",   // applied via <style> above
  },
  pulseLabel: {
    fontSize: "0.8rem",
    color:    "#16a34a",
    fontWeight: 600,
  },
};
