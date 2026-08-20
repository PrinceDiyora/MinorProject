// ─────────────────────────────────────────────────────────────────────────────
// Test Call Script — makes Twilio call YOUR phone number
// Usage: node src/voice/testCall.js
// ─────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// ─── CONFIGURE THESE ─────────────────────────────────────────────────────────
const YOUR_PHONE = "+919428574024";           // Your Indian Jio number
const TWILIO_NUMBER = "+13029242536";         // Your Twilio number
const NGROK_URL = process.env.NGROK_URL;      // Set in .env or pass as arg
// ─────────────────────────────────────────────────────────────────────────────

const webhookUrl = NGROK_URL || process.argv[2];

if (!webhookUrl) {
  console.error("❌ Please provide your ngrok URL!");
  console.error("Usage:");
  console.error("  node src/voice/testCall.js https://abc123.ngrok-free.app");
  console.error("  OR set NGROK_URL in .env");
  process.exit(1);
}

async function makeTestCall() {
  try {
    console.log(`📞 Calling ${YOUR_PHONE} via Twilio...`);
    console.log(`🔗 Webhook: ${webhookUrl}/incoming-call`);

    const call = await client.calls.create({
      to: YOUR_PHONE,
      from: TWILIO_NUMBER,
      url: `${webhookUrl}/incoming-call`,
    });

    console.log(`✅ Call initiated! SID: ${call.sid}`);
    console.log(`📱 Your phone should ring in a few seconds...`);
  } catch (error) {
    console.error("❌ Failed to make call:", error.message);
  }
}

makeTestCall();
