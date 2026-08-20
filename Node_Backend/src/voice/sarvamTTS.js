// ─────────────────────────────────────────────────────────────────────────────
// Sarvam TTS — Bulbul model text-to-speech + μ-law 8kHz transcoding for Twilio
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import { spawn } from "child_process";

const SARVAM_BASE_URL = process.env.SARVAM_BASE_URL || "https://api.sarvam.ai";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

// Map language labels to Sarvam TTS language codes (all Bulbul v2 supported)
const LANG_MAP = {
  hindi: "hi-IN",
  english: "en-IN",
  hinglish: "hi-IN",
  bengali: "bn-IN",
  kannada: "kn-IN",
  malayalam: "ml-IN",
  marathi: "mr-IN",
  odia: "od-IN",
  punjabi: "pa-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  gujarati: "gu-IN",
  unknown: "hi-IN",
};

/**
 * Convert text to speech using Sarvam Bulbul TTS, then transcode to μ-law 8kHz.
 *
 * @param {string} text     - Text to speak
 * @param {string} language - Detected language (hindi/english/hinglish)
 * @returns {Promise<string>} Base64-encoded μ-law 8kHz audio
 */
export async function textToSpeech(text, language = "hinglish") {
  const targetLang = LANG_MAP[language] || "hi-IN";

  try {
    // Step 1: Call Sarvam Bulbul TTS API
    const response = await axios.post(
      `${SARVAM_BASE_URL}/text-to-speech`,
      {
        inputs: [text],                  // Sarvam expects array of strings
        target_language_code: targetLang,
        speaker: "anushka",              // Valid Bulbul v2 speaker
        model: "bulbul:v2",
        pitch: 0,
        pace: 1.1,               // slightly faster for phone conversation
        loudness: 1.5,
        enable_preprocessing: true,
      },
      {
        headers: {
          "API-Subscription-Key": SARVAM_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    // Sarvam returns base64-encoded WAV audio
    const audioBase64 = response.data.audios?.[0];
    if (!audioBase64) {
      throw new Error("No audio returned from Sarvam TTS");
    }

    // Step 2: Transcode WAV → μ-law 8kHz using ffmpeg
    const wavBuffer = Buffer.from(audioBase64, "base64");
    const mulawBuffer = await transcodeTo8kMulaw(wavBuffer);

    return mulawBuffer.toString("base64");
  } catch (error) {
    console.error("[SarvamTTS] Error:", error.message);
    if (error.response?.data) {
      console.error("[SarvamTTS] Response:", JSON.stringify(error.response.data));
    }
    throw error;
  }
}

/**
 * Transcode audio buffer (WAV) to μ-law 8kHz mono using ffmpeg.
 *
 * @param {Buffer} inputBuffer - WAV audio buffer
 * @returns {Promise<Buffer>}  - μ-law 8kHz raw audio buffer
 */
function transcodeTo8kMulaw(inputBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",            // read from stdin
      "-ar", "8000",             // 8kHz sample rate
      "-ac", "1",                // mono
      "-f", "mulaw",             // μ-law format
      "-acodec", "pcm_mulaw",   // μ-law codec
      "pipe:1",                  // output to stdout
    ], { stdio: ["pipe", "pipe", "pipe"] });

    const chunks = [];

    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));

    ffmpeg.stderr.on("data", (data) => {
      // ffmpeg logs to stderr — ignore unless error
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });

    // Write input and close stdin
    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}

/**
 * Send base64-encoded μ-law audio to Twilio via WebSocket.
 * Twilio expects 20ms chunks (160 bytes of μ-law at 8kHz).
 *
 * @param {object} ws        - Twilio WebSocket connection
 * @param {string} streamSid - Twilio stream SID
 * @param {string} audioBase64 - Full base64 μ-law audio
 */
export function sendAudioToTwilio(ws, streamSid, audioBase64) {
  if (!ws || ws.readyState !== 1) {
    console.warn("[TTS] WebSocket not open, cannot send audio");
    return;
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const CHUNK_SIZE = 160; // 20ms at 8kHz μ-law (8000 * 0.020 = 160 bytes)

  for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
    const chunk = audioBuffer.subarray(i, i + CHUNK_SIZE);
    const message = JSON.stringify({
      event: "media",
      streamSid,
      media: {
        payload: chunk.toString("base64"),
      },
    });
    ws.send(message);
  }

  // Send a mark event to know when audio playback finishes
  const markMessage = JSON.stringify({
    event: "mark",
    streamSid,
    mark: { name: "tts_done" },
  });
  ws.send(markMessage);
}

/**
 * Send a clear message to Twilio to stop current audio playback.
 */
export function clearTwilioAudio(ws, streamSid) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ event: "clear", streamSid }));
}

export default { textToSpeech, sendAudioToTwilio, clearTwilioAudio };
