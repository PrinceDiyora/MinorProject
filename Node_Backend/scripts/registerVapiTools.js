import "dotenv/config";
import axios from "axios";
import { vapiToolSchemas } from "../config/vapiToolSchemas.js";

/**
 * Stage 8: Register Tools via Vapi API Script
 * Attaches the validation, upsell, and push-order tools to the VAPI assistant.
 */
async function registerTools() {
    const { VAPI_API_KEY, VAPI_ASSISTANT_ID, BACKEND_PUBLIC_URL } = process.env;

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !BACKEND_PUBLIC_URL) {
        console.error("❌ Missing required keys. Ensure VAPI_API_KEY, VAPI_ASSISTANT_ID, and BACKEND_PUBLIC_URL are set.");
        process.exit(1);
    }

    // Inject the dynamic ngrok URL into the schema 'url' property
    const schemasWithUrls = vapiToolSchemas.map(t => {
        // Determine path based on function name
        let endpointPath = "";
        if (t.function.name === "start_session") endpointPath = "/api/voice/start-session";
        if (t.function.name === "get_categories") endpointPath = "/api/voice/get-categories";
        if (t.function.name === "get_menu") endpointPath = "/api/voice/get-menu";
        if (t.function.name === "validate_items") endpointPath = "/api/voice/validate-items";
        if (t.function.name === "get_item_price") endpointPath = "/api/voice/get-item-price";
        if (t.function.name === "get_upsell") endpointPath = "/api/voice/get-upsell";
        if (t.function.name === "push_order") endpointPath = "/api/voice/push-order";

        return {
            type: "function",
            messages: [
                { type: "request-start", content: "Checking..." }
            ],
            function: {
                ...t.function,
            },
            server: {
                url: `${BACKEND_PUBLIC_URL}${endpointPath}`
            }
        };
    });

    try {
        console.log(`🛠️ Registering 7 tools to Assistant ID: ${VAPI_ASSISTANT_ID}...`);

        const response = await axios.patch(
            `https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`,
            {
                model: {
                    model: "gpt-4o",
                    provider: "openai",
                    tools: schemasWithUrls
                },
                serverUrl: `${BACKEND_PUBLIC_URL}/api/voice/webhook`,
                serverMessages: ["speech-update", "tool-calls", "status-update", "hang", "transcript", "end-of-call-report"]
            },
            {
                headers: {
                    Authorization: `Bearer ${VAPI_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("✅ Tools successfully attached to Vapi Agent!");
    } catch (error) {
        console.error("❌ Error registering tools:");
        if (error.response) {
            console.error(error.response.status, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

registerTools();
