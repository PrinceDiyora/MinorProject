/**
 * VoiceOrderAgent.jsx
 *
 * Voice ordering agent UI — powered by Sarvam Conversational AI SDK.
 *
 * Flow:
 *  1. Admin clicks "Start Order" → ConversationAgent.start() connects mic + WebSocket
 *  2. Agent speaks greeting, listens, and responds via Sarvam AI
 *  3. State badge updates in real-time (idle | connecting | connected | listening | speaking | error)
 *  4. Admin can mute/unmute mic and view live speech transcripts
 *  5. Admin clicks "End Call" → agent.stop()
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ConversationAgent,
  BrowserAudioInterface,
  AgentState,
  InteractionType,
} from "sarvam-conv-ai-sdk/browser";
import { useAuth } from "../../context/AuthContext";

// ── Sarvam credentials ────────────────────────────────────────────────────────
const SARVAM_CONFIG = {
  apiKey:      "sk_samvaad_3qlvxxci_9pOwbe3XBZ9MxmrLBFdRK8Db",
  orgId:       "01a0b518-16c6-7ae8-b166-25583648e38f",
  workspaceId: "01a0b518-16ca-79c1-830a-6c4c27bb8786",
  appId:       "Conversatio-8ca313fa-964a",
  version:     5,
};

// ── State labels / colours ────────────────────────────────────────────────────
const STATE_META = {
  idle:       { label: "Ready",           color: "#475569" },
  connecting: { label: "Connecting…",     color: "#d97706" },
  connected:  { label: "Connected",       color: "#0284c7" },
  listening:  { label: "🎙 Listening",    color: "#16a34a" },
  speaking:   { label: "Agent speaking…", color: "#2563eb" },
  error:      { label: "Error",           color: "#dc2626" },
};

export default function VoiceOrderAgent() {
  const { user } = useAuth();

  const [callState,    setCallState]    = useState("idle");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [isActive,     setIsActive]     = useState(false);
  const [isMuted,      setIsMuted]      = useState(false);
  const [transcripts,  setTranscripts]  = useState([]);
  const [duration,     setDuration]     = useState(0);

  const agentRef          = useRef(null);
  const audioInterfaceRef = useRef(null);
  const timerRef          = useRef(null);
  const transcriptBoxRef  = useRef(null);

  // ── Call duration timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  // ── Auto-scroll transcript ────────────────────────────────────────────────
  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [transcripts]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      agentRef.current?.stop().catch(() => {});
    };
  }, []);

  // ── Start call ────────────────────────────────────────────────────────────
  const startCall = useCallback(async () => {
    if (!user?.id) {
      setErrorMsg("Not logged in — cannot start voice order.");
      setCallState("error");
      return;
    }

    setErrorMsg("");
    setCallState("connecting");
    setIsActive(true);
    setTranscripts([]);

    try {
      // 1. Initialize browser audio interface (mic capture + playback ring buffer)
      const audioInterface = new BrowserAudioInterface(16000);
      audioInterfaceRef.current = audioInterface;

      // 2. Configure Sarvam ConversationAgent
      const agent = new ConversationAgent({
        apiKey: SARVAM_CONFIG.apiKey,
        config: {
          user_identifier_type: "custom",
          user_identifier:      String(user.id || "admin"),
          org_id:               SARVAM_CONFIG.orgId,
          workspace_id:         SARVAM_CONFIG.workspaceId,
          app_id:               SARVAM_CONFIG.appId,
          version:              SARVAM_CONFIG.version,
          interaction_type:     InteractionType.CALL,
          input_sample_rate:    16000,
          output_sample_rate:   22050,
          agent_variables: {
            admin_id:   String(user.id || "admin"),
            admin_name: user.name || user.email || "Admin",
          },
        },
        audioInterface,
        stateCallback: (newState, prev) => {
          console.log(`[Sarvam Agent] State: ${prev} → ${newState}`);
          setCallState(newState);
        },
        transcriptCallback: async (msg) => {
          const text = msg?.content || msg?.text || msg?.transcript;
          if (text) {
            setTranscripts((prev) => [
              ...prev.slice(-15),
              { role: msg.role || "bot", text: String(text) },
            ]);
          }
        },
        startCallback: async () => {
          console.log("[Sarvam Agent] Session started");
          setCallState("connected");
        },
        endCallback: async () => {
          console.log("[Sarvam Agent] Session ended by server");
          setCallState("idle");
          setIsActive(false);
          setIsMuted(false);
          agentRef.current = null;
        },
      });

      agentRef.current = agent;

      // 3. Connect (fetches signed URL, opens WebSocket, enables mic stream)
      await agent.start();

      const connected = await agent.waitForConnect(8.0);
      if (!connected && !agent.isConnected()) {
        throw new Error("Could not connect to Sarvam voice server in time.");
      }
    } catch (err) {
      console.error("[Sarvam Agent] start failed:", err);
      const message = err?.message || "Failed to start voice order session.";
      setErrorMsg(message);
      setCallState("error");
      setIsActive(false);
      agentRef.current = null;
    }
  }, [user]);

  // ── End call ──────────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    try {
      if (agentRef.current) {
        await agentRef.current.stop();
      }
    } catch (err) {
      console.warn("[Sarvam Agent] Stop error:", err);
    } finally {
      agentRef.current = null;
      audioInterfaceRef.current = null;
      setCallState("idle");
      setIsActive(false);
      setIsMuted(false);
      setErrorMsg("");
    }
  }, []);

  // ── Mute / Unmute ─────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!agentRef.current) return;
    if (isMuted) {
      agentRef.current.unmute();
      setIsMuted(false);
    } else {
      agentRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  // ── Retry after error ─────────────────────────────────────────────────────
  const retry = useCallback(() => {
    setCallState("idle");
    setErrorMsg("");
    setIsActive(false);
    setIsMuted(false);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const meta        = STATE_META[callState] ?? STATE_META.idle;
  const isListening = callState === "listening";
  const isSpeaking  = callState === "speaking";

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={styles.card}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={styles.title}>🎙 Voice Order Agent</span>
          {isActive && (
            <span style={styles.timerBadge}>⏱ {formatTime(duration)}</span>
          )}
        </div>
        <span style={{ ...styles.badge, background: meta.color }}>
          {meta.label}
        </span>
      </div>

      {/* ── Powered-by tag ── */}
      <p style={styles.poweredBy}>
        Powered by <strong>Sarvam AI (v5)</strong> · Multilingual Hindi & English
      </p>

      {/* ── Error message ── */}
      {errorMsg && (
        <div style={styles.errorBox}>⚠️ {errorMsg}</div>
      )}

      {/* ── Visualizer / Status Indicator ── */}
      {isActive && (
        <div style={styles.visualizerRow}>
          {isListening && (
            <div style={styles.pulseWrap}>
              <span className="sarvam-pulse-dot" style={styles.pulse} />
              <span style={styles.pulseLabel}>
                {isMuted ? "Microphone Muted" : "Listening to you… speak now"}
              </span>
            </div>
          )}

          {isSpeaking && (
            <div style={styles.waveWrap}>
              <span style={{ fontSize: "0.8rem", color: "#2563eb", fontWeight: 600, marginRight: 6 }}>
                Agent speaking:
              </span>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <span
                  key={i}
                  className={`sarvam-wave-bar sarvam-wave-bar-${i}`}
                  style={styles.waveBar}
                />
              ))}
            </div>
          )}

          {!isListening && !isSpeaking && callState === "connected" && (
            <span style={{ fontSize: "0.8rem", color: "#0284c7" }}>
              Ready · Agent initialized
            </span>
          )}
        </div>
      )}

      {/* ── Live Transcripts ── */}
      {transcripts.length > 0 && (
        <div ref={transcriptBoxRef} style={styles.transcriptBox}>
          {transcripts.map((t, idx) => {
            const isUser = t.role === "user";
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  fontSize: "0.8rem",
                  color: isUser ? "#0f172a" : "#1d4ed8",
                  background: isUser ? "#f1f5f9" : "#eff6ff",
                  padding: "0.3rem 0.6rem",
                  borderRadius: 6,
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                }}
              >
                <strong>{isUser ? "You:" : "Agent:"}</strong>
                <span>{t.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Controls ── */}
      <div style={styles.controls}>
        {!isActive && callState !== "error" && (
          <button
            id="start-voice-call"
            onClick={startCall}
            style={{ ...styles.btn, ...styles.btnGreen }}
          >
            🎙 Start Order Call
          </button>
        )}

        {isActive && (
          <>
            <button
              id="end-voice-call"
              onClick={endCall}
              style={{ ...styles.btn, ...styles.btnRed }}
            >
              ✕ End Call
            </button>

            <button
              id="mute-voice-call"
              onClick={toggleMute}
              style={{
                ...styles.btn,
                background: isMuted ? "#fef3c7" : "#f1f5f9",
                color: isMuted ? "#92400e" : "#334155",
                border: isMuted ? "1px solid #f59e0b" : "1px solid #cbd5e1",
              }}
            >
              {isMuted ? "🔇 Unmute Mic" : "🎙 Mute Mic"}
            </button>
          </>
        )}

        {callState === "error" && (
          <button
            id="retry-voice-call"
            onClick={retry}
            style={{ ...styles.btn, ...styles.btnGray }}
          >
            ↺ Try Again
          </button>
        )}
      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes sarvam-pulse {
          0%   { transform: scale(1);   opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .sarvam-pulse-dot { animation: sarvam-pulse 1.2s ease-out infinite; }

        @keyframes sarvam-wave {
          0%, 100% { height: 6px; }
          50%      { height: 22px; }
        }
        .sarvam-wave-bar   { animation: sarvam-wave 0.85s ease-in-out infinite; }
        .sarvam-wave-bar-1 { animation-delay: 0.00s; }
        .sarvam-wave-bar-2 { animation-delay: 0.12s; }
        .sarvam-wave-bar-3 { animation-delay: 0.24s; }
        .sarvam-wave-bar-4 { animation-delay: 0.36s; }
        .sarvam-wave-bar-5 { animation-delay: 0.48s; }
        .sarvam-wave-bar-6 { animation-delay: 0.60s; }
      `}</style>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles = {
  card: {
    background:    "var(--card, #fff)",
    border:        "1px solid var(--border, #e2e8f0)",
    borderRadius:  12,
    padding:       "1.25rem 1.5rem",
    display:       "flex",
    flexDirection: "column",
    gap:           "0.75rem",
    maxWidth:      480,
    boxShadow:     "0 1px 3px rgba(0,0,0,0.06)",
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
  timerBadge: {
    fontSize:     "0.75rem",
    background:   "#f1f5f9",
    color:        "#475569",
    padding:      "2px 6px",
    borderRadius: 4,
    fontWeight:   600,
  },
  badge: {
    color:        "#fff",
    borderRadius: 999,
    padding:      "2px 10px",
    fontSize:     "0.75rem",
    fontWeight:   600,
    transition:   "background 0.3s",
  },
  poweredBy: {
    margin:   0,
    fontSize: "0.75rem",
    color:    "var(--muted, #94a3b8)",
  },
  errorBox: {
    background:   "#fef2f2",
    border:       "1px solid #fca5a5",
    borderRadius: 8,
    padding:      "0.5rem 0.85rem",
    fontSize:     "0.8rem",
    color:        "#b91c1c",
  },
  visualizerRow: {
    padding:       "0.5rem 0.75rem",
    background:    "#f8fafc",
    borderRadius:  8,
    border:        "1px solid #e2e8f0",
    display:       "flex",
    alignItems:    "center",
    minHeight:     36,
  },
  pulseWrap: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.6rem",
  },
  pulse: {
    display:      "inline-block",
    width:        10,
    height:       10,
    borderRadius: "50%",
    background:   "#16a34a",
  },
  pulseLabel: {
    fontSize:   "0.8rem",
    color:      "#16a34a",
    fontWeight: 600,
  },
  waveWrap: {
    display:    "flex",
    alignItems: "center",
    gap:        4,
    height:     24,
  },
  waveBar: {
    display:         "inline-block",
    width:           4,
    height:          12,
    borderRadius:    4,
    background:      "#2563eb",
    transformOrigin: "center",
  },
  transcriptBox: {
    maxHeight:     140,
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    gap:           "0.4rem",
    padding:       "0.5rem",
    background:    "#fafafa",
    borderRadius:  8,
    border:        "1px solid #e5e7eb",
  },
  controls: {
    display:  "flex",
    gap:      "0.5rem",
    flexWrap: "wrap",
    marginTop: "0.25rem",
  },
  btn: {
    border:       "none",
    borderRadius: 8,
    padding:      "0.55rem 1.15rem",
    fontWeight:   600,
    fontSize:     "0.875rem",
    cursor:       "pointer",
    transition:   "opacity 0.15s, transform 0.05s",
  },
  btnGreen: { background: "#16a34a", color: "#fff" },
  btnRed:   { background: "#dc2626", color: "#fff" },
  btnGray:  { background: "#475569", color: "#fff" },
};
