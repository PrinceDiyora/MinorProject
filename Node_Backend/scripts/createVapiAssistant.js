import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SYSTEM_PROMPT } from "../config/agentPrompt.js";

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Stage 3: Vapi Assistant Creation Script
 * Run this once only.
 */
async function createAssistant() {
    const { VAPI_API_KEY } = process.env;

    if (!VAPI_API_KEY) {
        console.error("❌ VAPI_API_KEY is missing in .env");
        process.exit(1);
    }

    try {
        console.log("🤖 Creating Riya Assistant on Vapi (Sarvam + Deepgram + GPT-4o)...");

        const response = await axios.post(
            "https://api.vapi.ai/assistant",
            {
                name: "Riya",
                model: {
                    provider: "openai",
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: SYSTEM_PROMPT
                        }
                    ]
                },
                transcriber: {
                    provider: "deepgram",
                    language: "hi",
                    model: "nova-2",
                },
                voice: {
                    provider: "openai",
                    voiceId: "shimmer", // Shimmer is a great female voice on OpenAI
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${VAPI_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const assistantId = response.data.id;
        console.log(`✅ Assistant created successfully! ID: ${assistantId}`);

        // Write back to .env
        const envPath = path.resolve(__dirname, "../.env");
        let envContent = fs.readFileSync(envPath, "utf-8");

        if (envContent.includes("VAPI_ASSISTANT_ID=")) {
            // replace existing
            envContent = envContent.replace(
                /VAPI_ASSISTANT_ID=.*/,
                `VAPI_ASSISTANT_ID=${assistantId}`
            );
        } else {
            // append
            envContent += `\nVAPI_ASSISTANT_ID=${assistantId}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log("✅ Wrote VAPI_ASSISTANT_ID to .env");

    } catch (error) {
        console.error("❌ Error creating Assistant:");
        if (error.response) {
            console.error(error.response.status, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

createAssistant();
