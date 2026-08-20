// ─────────────────────────────────────────────────────────────────────────────
// Voice Router — Twilio webhook endpoint for incoming calls
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from "express";

const router = Router();

/**
 * POST /incoming-call
 *
 * Twilio calls this webhook when a phone call arrives.
 * We respond with TwiML that opens a bi-directional media stream
 * back to our WebSocket server.
 */
router.post("/incoming-call", (req, res) => {
  const callerPhone = req.body.From || "unknown";
  const callSid = req.body.CallSid || "unknown";

  console.log(`[Voice] Incoming call — SID: ${callSid}, From: ${callerPhone}`);

  // Determine WebSocket URL from the request host
  const host = req.headers.host;
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
  const wsUrl = `${protocol}://${host}/media-stream`;

  // Respond with TwiML — opens a <Stream> WebSocket
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="callerPhone" value="${callerPhone}" />
    </Stream>
  </Connect>
</Response>`;

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

/**
 * GET /incoming-call
 * Health check / test endpoint for Twilio webhook configuration.
 */
router.get("/incoming-call", (req, res) => {
  res.json({
    status: "ok",
    message: "Twilio voice webhook is active. Configure this URL as your Twilio phone number webhook.",
    endpoint: "POST /incoming-call",
  });
});

export default router;
