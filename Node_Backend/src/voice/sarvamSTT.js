// ─────────────────────────────────────────────────────────────────────────────
// Sarvam STT — Speech-to-Text using Sarvam AI's saarika:v2.5 model
// Buffers incoming PCM audio, detects silence (VAD), then sends to Sarvam REST API
// ─────────────────────────────────────────────────────────────────────────────

import { SarvamAIClient } from "sarvamai";

const sarvamClient = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY,
});

// ── VAD (Voice Activity Detection) config ──────────────────────────────────
const SILENCE_THRESHOLD = 200;     // RMS energy below this = silence
const SILENCE_DURATION_MS = 1200;  // 1.2s of silence to finalize utterance
const MIN_SPEECH_DURATION_MS = 300; // ignore utterances shorter than 300ms
const SAMPLE_RATE = 8000;          // Twilio sends 8kHz audio
const BYTES_PER_SAMPLE = 2;       // 16-bit PCM

// Sarvam language code → our internal label
const SARVAM_LANG_MAP = {
  "hi-IN": "hindi",
  "en-IN": "english",
  "bn-IN": "bengali",
  "kn-IN": "kannada",
  "ml-IN": "malayalam",
  "mr-IN": "marathi",
  "od-IN": "odia",
  "pa-IN": "punjabi",
  "ta-IN": "tamil",
  "te-IN": "telugu",
  "gu-IN": "gujarati",
};

/**
 * Create a WAV header for raw PCM data.
 * @param {number} dataLength - Length of PCM data in bytes
 * @param {number} sampleRate
 * @param {number} numChannels
 * @param {number} bitsPerSample
 * @returns {Buffer}
 */
function createWavHeader(dataLength, sampleRate = 8000, numChannels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);           // PCM chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

/**
 * Calculate RMS energy of PCM samples to detect speech vs silence.
 * @param {Int16Array} samples
 * @returns {number} RMS energy value
 */
function calculateRMS(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Create a Sarvam STT session for a single call.
 * Buffers audio, detects utterance boundaries via VAD, sends to Sarvam API.
 *
 * @param {Object} opts
 * @param {function(string, string): void} opts.onTranscript - (text, detectedLanguage) for final transcripts
 * @param {function(Error): void}          opts.onError      - called on errors
 * @param {function(): void}               opts.onClose      - called when session is destroyed
 * @returns {Object} STT session with .sendAudio(pcmSamples) and .close()
 */
export function createSarvamSTTSession({ onTranscript, onError, onClose }) {
  let audioBuffer = [];        // Array of Int16Array chunks
  let totalSamples = 0;
  let isSpeaking = false;
  let silenceStart = null;
  let speechStart = null;
  let closed = false;
  let processing = false;

  console.log("[SarvamSTT] Session created");

  /**
   * Send decoded PCM samples (Int16Array) from Twilio.
   * Internally buffers and runs VAD.
   * @param {Int16Array} pcmSamples
   */
  function sendAudio(pcmSamples) {
    if (closed || processing) return;

    const rms = calculateRMS(pcmSamples);
    const now = Date.now();

    if (rms > SILENCE_THRESHOLD) {
      // Speech detected
      if (!isSpeaking) {
        isSpeaking = true;
        speechStart = now;
        console.log("[SarvamSTT] Speech started");
      }
      silenceStart = null;
      audioBuffer.push(pcmSamples);
      totalSamples += pcmSamples.length;
    } else if (isSpeaking) {
      // Silence during speech — buffer it too (natural pauses)
      audioBuffer.push(pcmSamples);
      totalSamples += pcmSamples.length;

      if (!silenceStart) {
        silenceStart = now;
      } else if (now - silenceStart >= SILENCE_DURATION_MS) {
        // Sustained silence → utterance ended
        const speechDuration = now - speechStart;
        if (speechDuration >= MIN_SPEECH_DURATION_MS && totalSamples > 0) {
          console.log(`[SarvamSTT] Utterance ended (${speechDuration}ms, ${totalSamples} samples)`);
          finalizeUtterance();
        } else {
          console.log(`[SarvamSTT] Utterance too short (${speechDuration}ms), discarding`);
          resetBuffer();
        }
      }
    }
    // If not speaking and silence, just ignore (no buffer)
  }

  /**
   * Combine buffered audio, build WAV, send to Sarvam STT API.
   */
  async function finalizeUtterance() {
    if (audioBuffer.length === 0) return;

    processing = true;
    const chunks = audioBuffer;
    const samplesCount = totalSamples;
    resetBuffer();

    try {
      // Merge all Int16Array chunks into one
      const merged = new Int16Array(samplesCount);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert Int16Array to raw PCM Buffer
      const pcmBuffer = Buffer.from(merged.buffer);

      // Build WAV file in memory
      const wavHeader = createWavHeader(pcmBuffer.length, SAMPLE_RATE);
      const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

      console.log(`[SarvamSTT] Sending ${wavBuffer.length} bytes to Sarvam API`);

      // Call Sarvam STT
      const response = await sarvamClient.speechToText.transcribe({
        file: {
          data: wavBuffer,
          filename: "audio.wav",
          contentType: "audio/wav",
        },
        model: "saarika:v2.5",
        language_code: "unknown", // auto-detect
      });

      const result = response.body ?? response;
      const transcript = result.transcript?.trim();
      const langCode = result.language_code || "unknown";
      const detectedLang = SARVAM_LANG_MAP[langCode] || "hinglish";

      if (transcript) {
        console.log(`[SarvamSTT] ✅ Transcript: "${transcript}" (lang: ${detectedLang})`);
        onTranscript(transcript, detectedLang);
      } else {
        console.log("[SarvamSTT] Empty transcript returned");
      }
    } catch (err) {
      console.error("[SarvamSTT] Transcription error:", err.message);
      if (err.body) {
        console.error("[SarvamSTT] Error details:", JSON.stringify(err.body));
      }
      onError(err);
    } finally {
      processing = false;
    }
  }

  function resetBuffer() {
    audioBuffer = [];
    totalSamples = 0;
    isSpeaking = false;
    silenceStart = null;
    speechStart = null;
  }

  function close() {
    if (closed) return;
    closed = true;
    resetBuffer();
    console.log("[SarvamSTT] Session closed");
    onClose();
  }

  return { sendAudio, close };
}

export default { createSarvamSTTSession };
