// ─────────────────────────────────────────────────────────────────────────────
// Call Orchestrator — ties all voice services together in the call loop
// ─────────────────────────────────────────────────────────────────────────────

import twilio from "twilio";
import { callLLM } from "./sarvamLLM.js";
import { resolveItems } from "./orderParser.js";
import { addItems, modifyItem, removeItemByName, getCartSummary, computeTotal } from "./cartManager.js";
import { checkUpsellOpportunity, generateUpsellPrompt, logUpsellEvent, getFBTRecommendation } from "./upsellEngine.js";
import { saveOrder, saveFailedSession } from "./dbSaveFlow.js";
import { textToSpeech, sendAudioToTwilio, clearTwilioAudio } from "./sarvamTTS.js";
import { getSession } from "./sessionManager.js";
import { groundWithDB, resolveItemsViaDB } from "./geminiQueryEngine.js";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function hangUpCall(callSid) {
  try {
    await twilioClient.calls(callSid).update({ status: "completed" });
    console.log(`[Orchestrator] Call ${callSid} hung up.`);
  } catch (err) {
    console.error(`[Orchestrator] Failed to hang up call:`, err.message);
  }
}

// ── Localized fallback strings for all Sarvam-supported languages ────────────
const LOCALIZED = {
  error: {
    hindi:     "Maaf kijiye, kuch problem ho gayi. Kya aap dobara bol sakte hain?",
    english:   "Sorry, there was an issue. Could you please repeat?",
    hinglish:  "Sorry, kuch problem ho gayi. Please dobara boliye.",
    bengali:   "Dukkhito, ekta sômosya hoyeche. Apni ki abar bolben?",
    kannada:   "Kshamisі, ondu samasyе aayitu. Dayavittu matte heli?",
    malayalam: "Kshamikkuka, oru prashnam undaayi. Dayavayi veendum parayaamō?",
    marathi:   "Maaf kara, kahitari problem aalay. Krupaya punha sanga.",
    odia:      "Kshama kariba, kichhi samasya hela. Dayakari punah kahiba?",
    punjabi:   "Maafi, koi samasya aai hai. Kripā karke dobārā dasso?",
    tamil:     "Mannikkavum, oru pirachanai erpaṭṭatu. Thayavu cheithu mīṇṭum collungal?",
    telugu:    "Kshamiṁchandi, oka samasyа vachindi. Dayachēsi malli cheṗṗagalarā?",
    gujarati:  "Maaf karsho, koi takleef aaviyu. Meherbani karīne farthi kahēsho?",
  },
  empty_cart: {
    hindi:     "Aapke cart mein koi item nahi hai. Pehle kuch order karna chahenge?",
    english:   "Your cart is empty. Would you like to order something first?",
    hinglish:  "Cart mein kuch nahi hai. Kuch order karna chahenge?",
    bengali:   "Apnar cart khali. Aage kichhu order korte chaan?",
    kannada:   "Nimma cart khali ide. Modalu yenaadrū order maaduvirā?",
    malayalam: "Ningalude cart kalivaaṇu. Aadyam enthenkilum order cheyyāmō?",
    marathi:   "Tumcha cart rikama aahe. Aadhi kahi order karaycha ka?",
    odia:      "Apanka cart khali achhi. Aage kichhi order karibe ki?",
    punjabi:   "Tuhaada cart khali hai. Pehlan kuch order karna chaahoge?",
    tamil:     "Uṅkal cart veṟumer. Mudhalil etāvatu order cheyyungal?",
    telugu:    "Mee cart khāli ga undi. Munduga emainā order chestaaraa?",
    gujarati:  "Tamārō cart khaalee chhe. Pahela kaaik order karasho?",
  },
  save_error: {
    hindi:     "Maaf kijiye, order save karne me problem ho gayi. Kripya dobara try karein.",
    english:   "Sorry, there was an issue saving your order. Please try again.",
    hinglish:  "Sorry, order save mein problem aayi. Please try again.",
    bengali:   "Dukkhito, order save korte sômosya hoyeche. Abar try korun.",
    kannada:   "Kshamisі, order save maaduvalli samasyе aayitu. Dayavittu matte try maadi.",
    malayalam: "Kshamikkuka, order save cheyyunnathil prashnam. Veendum try cheyyuka.",
    marathi:   "Maaf kara, order save karanyas problem aalay. Punha try kara.",
    odia:      "Kshama kariba, order save re samasya hela. Punah try kariba.",
    punjabi:   "Maafi, order save karan ch samasya aa gayi. Fir try karo.",
    tamil:     "Mannikkavum, order save cheithu pirachanai. Mīṇṭum try ceyyungal.",
    telugu:    "Kshamiṁchandi, order save lo samasyа vachindi. Malli try cheyandi.",
    gujarati:  "Maaf karsho, order save maa takleef aaviyu. Farthi try karsho.",
  },
  confirm: {
    hindi:     (id, t) => `Aapka order place ho gaya! Order number ${id}. Total ${t} rupaye. Dhanyavaad!`,
    english:   (id, t) => `Your order has been placed! Order number ${id}. Total amount is rupees ${t}. Thank you!`,
    hinglish:  (id, t) => `Aapka order place ho gaya! Order number ${id}. Total ${t} rupees. Thank you! Dhanyavaad!`,
    bengali:   (id, t) => `Apnar order place hoyeche! Order number ${id}. Total ${t} taka. Dhonnobad!`,
    kannada:   (id, t) => `Nimma order place aagide! Order number ${id}. Total ${t} rupees. Dhanyavaadagalu!`,
    malayalam: (id, t) => `Ningalude order place aayi! Order number ${id}. Total ${t} rupees. Nanni!`,
    marathi:   (id, t) => `Tumcha order place zala! Order number ${id}. Total ${t} rupaye. Dhanyavaad!`,
    odia:      (id, t) => `Apanka order place hoisarila! Order number ${id}. Total ${t} tanka. Dhanyabad!`,
    punjabi:   (id, t) => `Tuhaada order place ho gaya! Order number ${id}. Total ${t} rupaye. Dhanvaad!`,
    tamil:     (id, t) => `Uṅkal order place aanathu! Order number ${id}. Total ${t} rupees. Nandri!`,
    telugu:    (id, t) => `Mee order place ayyindi! Order number ${id}. Total ${t} rupees. Dhanyavaadalu!`,
    gujarati:  (id, t) => `Tamārō order place thayo! Order number ${id}. Total ${t} rupiyā. Dhanyavad!`,
  },
  ask_name: {
    hindi:     "Aapka naam kya hai?",
    english:   "May I have your name please?",
    hinglish:  "Aapka naam bataiye please?",
    bengali:   "Apnar naam ki?",
    kannada:   "Nimma hesaru yenu?",
    malayalam: "Ningalude peru enthaanu?",
    marathi:   "Tumcha naav kay aahe?",
    odia:      "Apanka naam ki?",
    punjabi:   "Tuhaada naam ki hai?",
    tamil:     "Uṅkal peyar eṉṉa?",
    telugu:    "Mee peru emiti?",
    gujarati:  "Tamāru naam shu chhe?",
  },
  ask_address: {
    hindi:     "Aapka delivery address kya hai?",
    english:   "What is your delivery address?",
    hinglish:  "Delivery ke liye aapka address bataiye?",
    bengali:   "Apnar delivery address ki?",
    kannada:   "Nimma delivery address yenu?",
    malayalam: "Ningalude delivery address enthaanu?",
    marathi:   "Tumcha delivery address kaay aahe?",
    odia:      "Apanka delivery address ki?",
    punjabi:   "Tuhaada delivery address ki hai?",
    tamil:     "Uṅkal delivery address eṉṉa?",
    telugu:    "Mee delivery address emiti?",
    gujarati:  "Tamāru delivery address shu chhe?",
  },
};

function getLocalizedText(lang, key) {
  return LOCALIZED[key]?.[lang] || LOCALIZED[key]?.english || LOCALIZED[key]?.hinglish;
}

function getLocalizedConfirmation(lang, orderId, total) {
  const fn = LOCALIZED.confirm[lang] || LOCALIZED.confirm.hinglish;
  return fn(orderId, total.toFixed(0));
}

/**
 * Handle a final transcript from Sarvam STT.
 * This is the main loop entry point called for each complete utterance.
 *
 * @param {string} callSid    - The call SID
 * @param {string} transcript - Final transcript text
 */
export async function handleTranscript(callSid, transcript) {
  const session = getSession(callSid);
  if (!session) {
    console.warn(`[Orchestrator] No session for callSid: ${callSid}`);
    return;
  }

  if (session.state === "done") {
    console.log(`[Orchestrator] Call already done, ignoring transcript: "${transcript}"`);
    return;
  }

  if (session.isProcessing) {
    console.log(`[Orchestrator] Already processing, ignoring duplicate: "${transcript}"`);
    return;
  }
  session.isProcessing = true;

  // ── Collecting_info state: capture name or address directly (skip LLM) ──
  if (session.state === "collecting_info") {
    try {
      if (session._collectingField === "name") {
        session.customerName = transcript.trim();
        console.log(`[Orchestrator] Collected name: "${session.customerName}"`);
        session._collectingField = "address";
        await speakAndSend(session, getLocalizedText(session.languageDetected, "ask_address"));
      } else if (session._collectingField === "address") {
        session.customerAddress = transcript.trim();
        console.log(`[Orchestrator] Collected address: "${session.customerAddress}"`);
        session.state = "ordering";
        session._collectingField = null;
        await handleOrderConfirmation(session, null);
      }
    } finally {
      session.isProcessing = false;
    }
    return;
  }

  // Append customer utterance to transcript
  session.transcript.push({
    role: "customer",
    text: transcript,
    timestamp: new Date(),
  });

  console.log(`[Orchestrator] Customer (${callSid}): "${transcript}"`);

  try {
    // Step 1: Quick pre-classification with Sarvam (no grounding needed for intent detection)
    const preResponse = await callLLM(session);
    const detectedIntent = preResponse.intent || "UNCLEAR";
    console.log(`[Orchestrator] Pre-classified intent: ${detectedIntent}`);

    // Update detected language
    if (preResponse.language) {
      session.languageDetected = preResponse.language;
    }

    // Step 2: Ground with DB via Gemini for data-dependent intents
    let groundedContext = null;
    if (["ORDER", "MODIFY", "ENQUIRY", "CANCEL"].includes(detectedIntent)) {
      groundedContext = await groundWithDB({
        customerText: transcript,
        intent: detectedIntent,
        adminId: session.adminId,
        cart: session.cart,
        menu: session.menu,
      });
      console.log(`[Orchestrator] DB grounding: ${groundedContext.source}, ${groundedContext.queriedItems.length} items found`);

      // Step 3: Re-call Sarvam with grounded context for accurate response
      const groundedResponse = await callLLM(session, groundedContext);
      // Merge: use grounded response but keep original intent if grounded one is UNCLEAR
      const llmResponse = {
        ...groundedResponse,
        intent: groundedResponse.intent === "UNCLEAR" ? detectedIntent : groundedResponse.intent,
      };
      console.log(`[Orchestrator] Grounded LLM intent: ${llmResponse.intent}`);
      await processIntent(session, llmResponse, groundedContext);
    } else {
      // For GREETING, CONFIRM, UNCLEAR — no DB grounding needed
      await processIntent(session, preResponse, null);
    }
  } catch (error) {
    console.error(`[Orchestrator] Error processing transcript:`, error.message);
    await speakAndSend(
      session,
      getLocalizedText(session.languageDetected, "error")
    );
  } finally {
    session.isProcessing = false;
  }
}

/**
 * Process the LLM intent and update session state accordingly.
 * @param {object} session
 * @param {object} llmResponse
 * @param {object|null} groundedContext - DB-grounded data from Gemini
 */
async function processIntent(session, llmResponse, groundedContext) {
  const { intent, items, reply_text, ask_clarification, order_complete } = llmResponse;

  switch (intent) {
    case "GREETING":
      session.state = "ordering";
      await speakAndSend(session, reply_text);
      break;

    case "ORDER":
      session.state = "ordering";
      if (items && items.length > 0) {
        // Use DB-grounded items from Gemini query results for exact matching
        const dbItems = groundedContext?.queriedItems || [];
        let matched, unmatched;

        if (dbItems.length > 0) {
          // Prefer exact DB match over fuzzy
          ({ matched, unmatched } = resolveItems(items, dbItems));
        } else {
          // Fallback to cached menu with fuzzy matching
          ({ matched, unmatched } = resolveItems(items, session.menu));
        }

        if (matched.length > 0) {
          addItems(session, matched);
          console.log(`[Orchestrator] Added ${matched.length} items to cart (source: ${groundedContext?.source || "menu"})`);
        }

        if (unmatched.length > 0) {
          console.log(`[Orchestrator] Unmatched items: ${unmatched.join(", ")}`);
          // Attempt secondary resolution via direct DB query
          const secondaryResults = await resolveItemsViaDB(unmatched, session.adminId);
          if (secondaryResults.length > 0) {
            const { matched: secondMatched } = resolveItems(
              unmatched.map((n) => ({ name: n, qty: 1, remark: null })),
              secondaryResults
            );
            if (secondMatched.length > 0) {
              addItems(session, secondMatched);
              console.log(`[Orchestrator] Secondary DB resolution matched ${secondMatched.length} more items`);
            }
          }
        }
      }
      await speakAndSend(session, reply_text);

      // Clear pending upsell once it's been acted upon
      session._pendingUpsell = null;
      await tryUpsell(session);
      break;

    case "MODIFY":
      if (items && items.length > 0) {
        const dbItems = groundedContext?.queriedItems || session.menu;
        const { matched } = resolveItems(items, dbItems);
        for (const item of matched) {
          modifyItem(session, item);
        }
      }
      await speakAndSend(session, reply_text);
      break;

    case "CANCEL":
      if (items && items.length > 0) {
        for (const item of items) {
          removeItemByName(session, item.name);
        }
      }
      await speakAndSend(session, reply_text);
      break;

    case "CONFIRM":
      if (order_complete && session.cart.length > 0) {
        // Collect name first if unknown
        if (!session.customerName) {
          session.state = "collecting_info";
          session._collectingField = "name";
          await speakAndSend(session, getLocalizedText(session.languageDetected, "ask_name"));
        // Collect address if unknown
        } else if (!session.customerAddress) {
          session.state = "collecting_info";
          session._collectingField = "address";
          await speakAndSend(session, getLocalizedText(session.languageDetected, "ask_address"));
        } else {
          session.state = "confirming";
          await handleOrderConfirmation(session, reply_text);
        }
      } else if (session.cart.length === 0) {
        await speakAndSend(
          session,
          getLocalizedText(session.languageDetected, "empty_cart")
        );
      } else {
        await speakAndSend(session, reply_text);
      }
      break;

    case "ENQUIRY":
      session._pendingUpsell = null;
      await speakAndSend(session, reply_text);
      break;

    case "UNCLEAR":
    default:
      session._pendingUpsell = null;
      if (ask_clarification && llmResponse.clarification_question) {
        await speakAndSend(session, llmResponse.clarification_question);
      } else {
        await speakAndSend(session, reply_text);
      }
      break;
  }

  // Append assistant reply to transcript
  session.transcript.push({
    role: "assistant",
    text: reply_text,
    timestamp: new Date(),
  });
}

/**
 * Handle order confirmation — save to DB and play confirmation message.
 */
async function handleOrderConfirmation(session, replyText) {
  try {
    const { orderId } = await saveOrder(session);

    // Build confirmation message
    const total = computeTotal(session);
    const confirmMsg = getLocalizedConfirmation(session.languageDetected, orderId, total);

    session.state = "done";
    await speakAndSend(session, confirmMsg);
    console.log(`[Orchestrator] Order #${orderId} confirmed for ${session.callerPhone}`);

    // Hang up after a short delay to let TTS finish playing
    setTimeout(() => hangUpCall(session.callSid), 8000);
  } catch (error) {
    console.error(`[Orchestrator] Order save failed:`, error.message);
    await speakAndSend(
      session,
      getLocalizedText(session.languageDetected, "save_error")
    );
  }
}

/**
 * Try to offer suggestions after items are added to cart.
 * Two signals, offered in separate turns:
 *   Turn 1 — FBT (Frequently Bought Together): data-driven, based on order history
 *   Turn 2 — Admin upsell: manually curated / acceptance-rate ranked pairings
 * Each is offered at most once per call.
 */
async function tryUpsell(session) {
  if (session.cart.length === 0) return;

  // ── Turn 1: FBT recommendation (from co-occurrence algorithm) ──────────────
  if (!session.fbtOffered) {
    const fbt = await getFBTRecommendation(session);
    if (fbt) {
      session.fbtOffered = true;
      session._pendingUpsell = fbt;
      const prompt = generateUpsellPrompt(fbt, session.languageDetected);
      console.log(`[Upsell] FBT suggestion: ${fbt.name} (₹${fbt.price})`);
      await speakAndSend(session, prompt);
      return; // wait for customer response before offering admin upsell
    }
    session.fbtOffered = true; // no FBT result, mark as done so we skip next time
  }

  // ── Turn 2: Admin-configured upsell (acceptance-rate ranked) ───────────────
  if (!session.upsellOffered) {
    const adminUpsell = await checkUpsellOpportunity(session);
    if (adminUpsell) {
      session.upsellOffered = true;
      session._pendingUpsell = adminUpsell;
      const prompt = generateUpsellPrompt(adminUpsell, session.languageDetected);
      console.log(`[Upsell] Admin upsell suggestion: ${adminUpsell.name} (₹${adminUpsell.price})`);
      await speakAndSend(session, prompt);
    }
  }
}

/**
 * Convert text to speech and send audio to Twilio.
 */
async function speakAndSend(session, text) {
  try {
    // Clear any playing audio first
    clearTwilioAudio(session.ws, session.streamSid);

    const audioBase64 = await textToSpeech(text, session.languageDetected);
    sendAudioToTwilio(session.ws, session.streamSid, audioBase64);
    console.log(`[TTS] Sent audio for: "${text.substring(0, 60)}..."`);
  } catch (error) {
    console.error(`[TTS] Failed to speak:`, error.message);
  }
}

/**
 * Handle call end — save partial session if no order was placed.
 */
export async function handleCallEnd(callSid) {
  const session = getSession(callSid);
  if (!session) return;

  if (session.state !== "done") {
    await saveFailedSession(session);
    console.log(`[Orchestrator] Call ended without order for ${session.callerPhone}`);
  }
}

export default { handleTranscript, handleCallEnd };
