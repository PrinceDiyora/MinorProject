import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Stage 4: Vapi Phone Number Link Script
 * This links the Twilio number to Riya so all incoming calls are handled by Vapi + Sarvam.
 */
async function linkPhoneNumber() {
    const {
        VAPI_API_KEY,
        VAPI_ASSISTANT_ID,
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN,
        TWILIO_PHONE_NUMBER
    } = process.env;

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        console.error("❌ Missing required .env keys. Ensure VAPI_API_KEY, VAPI_ASSISTANT_ID, TWILIO_ACCOUNT_SID, and TWILIO_AUTH_TOKEN are set.");
        process.exit(1);
    }

    try {
        if (!TWILIO_PHONE_NUMBER) {
            console.error("❌ TWILIO_PHONE_NUMBER is not set in .env. Cannot link.");
            process.exit(1);
        }

        console.log("📞 Linking Twilio phone number to Vapi Assistant...");

        const response = await axios.post(
            "https://api.vapi.ai/phone-number",
            {
                provider: "twilio",
                number: TWILIO_PHONE_NUMBER,
                twilioAccountSid: TWILIO_ACCOUNT_SID,
                twilioAuthToken: TWILIO_AUTH_TOKEN,
                assistantId: VAPI_ASSISTANT_ID
            },
            {
                headers: {
                    Authorization: `Bearer ${VAPI_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const phoneNumberId = response.data.id;
        console.log(`✅ Phone Number linked successfully! ID: ${phoneNumberId}`);
        console.log("Full Response:", JSON.stringify(response.data, null, 2));

        // Write back to .env
        const envPath = path.resolve(__dirname, "../.env");
        let envContent = fs.readFileSync(envPath, "utf-8");

        if (envContent.includes("VAPI_PHONE_NUMBER_ID=")) {
            envContent = envContent.replace(
                /VAPI_PHONE_NUMBER_ID=.*/,
                `VAPI_PHONE_NUMBER_ID=${phoneNumberId}`
            );
        } else {
            envContent += `\nVAPI_PHONE_NUMBER_ID=${phoneNumberId}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log("✅ Wrote VAPI_PHONE_NUMBER_ID to .env");

    } catch (error) {
        console.error("❌ Error linking phone number:");
        if (error.response) {
            console.error(error.response.status, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

linkPhoneNumber();
