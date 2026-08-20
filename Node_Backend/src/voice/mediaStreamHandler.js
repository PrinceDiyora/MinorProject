// ─────────────────────────────────────────────────────────────────────────────
// Media Stream Handler — handles Twilio WebSocket audio streaming
// Decodes μ-law → PCM, forwards to Sarvam STT, handles silence detection
// ─────────────────────────────────────────────────────────────────────────────

import alawmulaw from "alawmulaw";
import { pool } from "../db/index.js";
import { createSession, getSession, destroySession } from "./sessionManager.js";
import { createSarvamSTTSession } from "./sarvamSTT.js";
import { handleTranscript, handleCallEnd } from "./callOrchestrator.js";
import { textToSpeech, sendAudioToTwilio } from "./sarvamTTS.js";

const DEFAULT_ADMIN_ID = parseInt(process.env.DEFAULT_ADMIN_ID || "1", 10);

// Silence timeout: prompt if no speech for 8 seconds
const SILENCE_TIMEOUT_MS = 8000;

/**
 * Handle a new Twilio Media Stream WebSocket connection.
 *
 * @param {import('ws').WebSocket} ws  - The WebSocket connection
 * @param {import('http').IncomingMessage} req - The upgrade request
 */
export function handleMediaStream(ws, req) {
  console.log("[MediaStream] New WebSocket connection");

  let callSid = null;
  let streamSid = null;
  let sttSession = null;
  let silenceTimer = null;
  let isProcessing = false;
  let mediaCount = 0;
  let loggedNoConn = false;

  // ── Handle incoming messages from Twilio ────────────────────────────────
  ws.on("message", async (rawMessage) => {
    try {
      const msg = JSON.parse(rawMessage.toString());

      switch (msg.event) {
        // ── CONNECTED ────────────────────────────────────────────────────
        case "connected":
          console.log("[MediaStream] Connected event received");
          break;

        // ── START — initialize session, fetch menu, play greeting ───────
        case "start":
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          const callerPhone = msg.start.customParameters?.callerPhone || "unknown";

          console.log(`[MediaStream] Call started — SID: ${callSid}, Phone: ${callerPhone}`);

          // Create session
          const session = createSession({
            callSid,
            callerPhone,
            adminId: DEFAULT_ADMIN_ID,
            streamSid,
            ws,
          });

          // Fetch menu from DB
          await loadMenu(session);

          // Check if customer already exists in DB (returning customer)
          await loadCustomerInfo(session);

          // Start Sarvam STT session
          sttSession = createSarvamSTTSession({
            onTranscript: (text, detectedLang) => {
              if (isProcessing) {
                console.log(`[MediaStream] Busy processing, skipping transcript: "${text}"`);
                return;
              }
              isProcessing = true;
              resetSilenceTimer();
              session.languageDetected = detectedLang;
              handleTranscript(callSid, text).finally(() => {
                isProcessing = false;
              });
            },
            onError: (err) => {
              console.error(`[MediaStream] Sarvam STT error for ${callSid}:`, err.message);
            },
            onClose: () => {
              console.log(`[MediaStream] Sarvam STT closed for ${callSid}`);
            },
          });

          // Play greeting
          await playGreeting(session);

          // Start silence detection
          startSilenceTimer();
          break;

        // ── MEDIA — audio data from caller ──────────────────────────────
        case "media":
          if (!sttSession) {
            if (!loggedNoConn) {
              console.warn("[MediaStream] No STT session, dropping audio");
              loggedNoConn = true;
            }
            break;
          }

          resetSilenceTimer();
          mediaCount++;
          if (mediaCount % 100 === 1) {
            console.log(`[MediaStream] Media chunks received: ${mediaCount}`);
          }

          // Decode base64 μ-law audio
          const mulawBuffer = Buffer.from(msg.media.payload, "base64");

          // Convert μ-law → linear PCM 16-bit (Int16Array)
          const pcmSamples = alawmulaw.mulaw.decode(mulawBuffer);

          // Send PCM samples to Sarvam STT (VAD + buffering handled internally)
          sttSession.sendAudio(pcmSamples);
          break;

        // ── MARK — TTS playback finished ────────────────────────────────
        case "mark":
          console.log(`[MediaStream] Mark: ${msg.mark?.name}`);
          break;

        // ── STOP — call ended ───────────────────────────────────────────
        case "stop":
          console.log(`[MediaStream] Call stopped — SID: ${callSid}`);
          await cleanup();
          break;

        default:
          console.log(`[MediaStream] Unknown event: ${msg.event}`);
      }
    } catch (error) {
      console.error("[MediaStream] Error processing message:", error.message);
    }
  });

  // ── Handle WebSocket close ──────────────────────────────────────────────
  ws.on("close", async () => {
    console.log(`[MediaStream] WebSocket closed for ${callSid}`);
    await cleanup();
  });

  ws.on("error", (error) => {
    console.error(`[MediaStream] WebSocket error for ${callSid}:`, error.message);
  });

  // ── Helper functions ────────────────────────────────────────────────────

  function startSilenceTimer() {
    silenceTimer = setTimeout(async () => {
      const session = getSession(callSid);
      if (!session || session.state === "done") return;

      console.log(`[MediaStream] Silence timeout for ${callSid}`);
      const SILENCE_PROMPTS = {
        hindi:     "Kya aap abhi bhi line par hain?",
        english:   "Are you still there?",
        hinglish:  "Hello, aap sun rahe hain?",
        bengali:   "Apni ki ekhono achhen?",
        kannada:   "Neenu innū iddeeyaa?",
        malayalam: "Ningal ippozhum undō?",
        marathi:   "Tumhi ajun aahat ka?",
        odia:      "Apane ethebi achanti ki?",
        punjabi:   "Tussi ajje ho?",
        tamil:     "Neenga innum irukkeengalaa?",
        telugu:    "Meeru inka unnaaraa?",
        gujarati:  "Tamē have pan chhō?",
      };
      const prompt = SILENCE_PROMPTS[session.languageDetected] || SILENCE_PROMPTS.hinglish;

      try {
        const audioBase64 = await textToSpeech(prompt, session.languageDetected);
        sendAudioToTwilio(ws, streamSid, audioBase64);
      } catch (err) {
        console.error("[MediaStream] Silence prompt TTS error:", err.message);
      }

      // Restart timer
      startSilenceTimer();
    }, SILENCE_TIMEOUT_MS);
  }

  function resetSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      startSilenceTimer();
    }
  }

  async function cleanup() {
    if (silenceTimer) clearTimeout(silenceTimer);

    // Close Sarvam STT session
    if (sttSession) {
      try {
        sttSession.close();
      } catch (e) {
        // ignore
      }
      sttSession = null;
    }

    // Handle call end (save session, etc.)
    if (callSid) {
      await handleCallEnd(callSid);
      destroySession(callSid);
    }
  }
}

/**
 * Look up existing customer by phone — pre-populate name/address for returning customers.
 */
async function loadCustomerInfo(session) {
  try {
    const result = await pool.query(
      `SELECT id, name, address FROM customers WHERE admin_id = $1 AND phone = $2 LIMIT 1`,
      [session.adminId, session.callerPhone]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      session.customerId = row.id;
      session.isReturningCustomer = true;
      // Only use stored name if it's not the placeholder
      if (row.name && row.name !== "Voice Customer") {
        session.customerName = row.name;
      }
      if (row.address) {
        session.customerAddress = row.address;
      }
      console.log(`[MediaStream] Returning customer: ${session.customerName || "(unnamed)"} (id: ${row.id})`);
    }
  } catch (err) {
    console.error("[MediaStream] loadCustomerInfo error:", err.message);
  }
}

/**
 * Load the restaurant menu from DB for this session's admin.
 */
async function loadMenu(session) {
  try {
    const menuResult = await pool.query(
      `SELECT fi.id, fi.name, fi.selling_price, fi.is_available, fi.image_url,
              c.name AS category_name
       FROM food_items fi
       LEFT JOIN categories c ON c.id = fi.category_id
       WHERE fi.admin_id = $1
       ORDER BY c.name, fi.name`,
      [session.adminId]
    );
    session.menu = menuResult.rows;

    // Fetch restaurant name
    const adminResult = await pool.query(
      `SELECT restaurant_name FROM admin WHERE id = $1`,
      [session.adminId]
    );
    session.restaurantName =
      adminResult.rows[0]?.restaurant_name || "Our Restaurant";

    console.log(
      `[MediaStream] Loaded ${session.menu.length} menu items for "${session.restaurantName}"`
    );
  } catch (error) {
    console.error("[MediaStream] Failed to load menu:", error.message);
    session.menu = [];
    session.restaurantName = "Our Restaurant";
  }
}

/**
 * Play the initial greeting via TTS.
 */
async function playGreeting(session) {
  const greeting = session.isReturningCustomer && session.customerName
    ? `Namaste ${session.customerName}! ${session.restaurantName} mein phir se aapka swagat hai. Aap kya order karna chahenge?`
    : `Namaste! ${session.restaurantName} mein aapka swagat hai. Aap kya order karna chahenge?`;

  try {
    session.transcript.push({
      role: "assistant",
      text: greeting,
      timestamp: new Date(),
    });

    const audioBase64 = await textToSpeech(greeting, "hinglish");
    sendAudioToTwilio(session.ws, session.streamSid, audioBase64);
    console.log(`[MediaStream] Greeting sent for ${session.callSid}`);
  } catch (error) {
    console.error("[MediaStream] Greeting TTS error:", error.message);
  }
}

export default { handleMediaStream };
