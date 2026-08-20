// ─────────────────────────────────────────────────────────────────────────────
// Deepgram STT — streaming real-time transcription using Nova-2 multilingual
// Uses @deepgram/sdk v5.x API (listen.v1.connect → socket.connect → waitForOpen)
// ─────────────────────────────────────────────────────────────────────────────

import { DeepgramClient } from "@deepgram/sdk";

const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY);

/**
 * Create a live Deepgram transcription connection for a single call.
 *
 * @param {Object} opts
 * @param {function(string, string): void} opts.onTranscript - (text, detectedLanguage) called on final transcripts
 * @param {function(Error): void}          opts.onError      - called on errors
 * @param {function(): void}               opts.onClose      - called when connection closes
 * @returns {Promise<object>} Deepgram live socket (send PCM chunks via .sendMedia(buffer))
 */
export async function createDeepgramConnection({ onTranscript, onError, onClose }) {
  // In SDK v5, listen.v1.connect() returns a WrappedListenV1Socket with startClosed: true
  const socket = await deepgram.listen.v1.connect({
    model: "nova-2",
    language: "multi",        // auto-detect Hindi / English / Hinglish
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1500,   // emit utterance_end after 1.5s silence
    vad_events: true,
    encoding: "linear16",
    sample_rate: 8000,
    channels: 1,
  });

  // Register event handlers BEFORE calling connect()
  socket.on("open", () => {
    console.log("[Deepgram] Connection opened");
  });

  socket.on("message", (data) => {
    // SDK v5 delivers parsed JSON objects via the "message" event
    // Debug: log every message type to understand the data flow
    console.log(`[Deepgram] Message type: ${data.type}, is_final: ${data.is_final}, speech_final: ${data.speech_final}`);

    // Check for transcript results (handle both "Results" and other possible type values)
    const msgType = (data.type || "").toLowerCase();
    if (msgType === "results" || data.channel?.alternatives) {
      const alt = data.channel?.alternatives?.[0];
      if (!alt) return;

      const transcript = alt.transcript?.trim();
      if (!transcript) return;

      if (data.is_final) {
        const detectedLang = data.channel?.detected_language || "unknown";
        console.log(`[Deepgram] ✅ Final: "${transcript}" (lang: ${detectedLang})`);
        onTranscript(transcript, detectedLang);
      } else {
        console.log(`[Deepgram] 🔄 Interim: "${transcript}"`);
      }
    } else if (msgType === "utteranceend" || data.type === "UtteranceEnd") {
      console.log("[Deepgram] Utterance end detected");
    } else {
      console.log(`[Deepgram] Other message:`, JSON.stringify(data).substring(0, 200));
    }
  });

  socket.on("error", (err) => {
    console.error("[Deepgram] Error:", err);
    onError(err);
  });

  socket.on("close", () => {
    console.log("[Deepgram] Connection closed");
    onClose();
  });

  // Actually initiate the WebSocket connection (was startClosed: true)
  socket.connect();

  // Wait until the connection is actually open before returning
  await socket.waitForOpen();
  console.log("[Deepgram] Socket is ready to receive audio");

  return socket;
}

export default { createDeepgramConnection };
