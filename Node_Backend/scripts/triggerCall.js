import "dotenv/config";
import axios from "axios";

// Node_Backend/scripts/triggerCall.js

/**
 * Stage 9: Terminal Outbound Call Trigger
 * Initiates an outbound call using VAPI.
 * 
 * IMPORTANT: Phone number must be E.164 format e.g. +919876543210
 */
async function triggerCall() {
    const { VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID, MY_PHONE_NUMBER } = process.env;

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID || !MY_PHONE_NUMBER) {
        console.error("❌ Missing required environment variables in .env:");
        console.error("   Ensure VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID, and MY_PHONE_NUMBER are set.");
        process.exit(1);
    }

    console.log(`📞 Initiating call to: ${MY_PHONE_NUMBER}...`);

    try {
        const response = await axios.post(
            "https://api.vapi.ai/call/phone",
            {
                assistantId: VAPI_ASSISTANT_ID,
                customer: {
                    number: MY_PHONE_NUMBER
                },
                phoneNumberId: VAPI_PHONE_NUMBER_ID
            },
            {
                headers: {
                    Authorization: `Bearer ${VAPI_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("✅ Outbound call successfully triggered directly via VAPI!");
        console.log("Response data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("❌ Failed to initiate outbound call.");
        if (error.response) {
            console.error("Status Code:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error Message:", error.message);
        }
    }
}

triggerCall();
