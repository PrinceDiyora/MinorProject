// ─────────────────────────────────────────────────────────────────────────────
// Session Manager — one session per active Twilio call, keyed by callSid
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * @typedef {Object} CartItem
 * @property {number} foodId
 * @property {string} name
 * @property {number} qty
 * @property {number} price
 * @property {string|null} remark
 * @property {boolean} isUpsell
 */

/**
 * @typedef {Object} Session
 * @property {string} callSid
 * @property {string} callerPhone
 * @property {number|null} customerId
 * @property {number} adminId
 * @property {CartItem[]} cart
 * @property {{role: string, text: string, timestamp: Date}[]} transcript
 * @property {string} languageDetected
 * @property {'greeting'|'ordering'|'confirming'|'done'} state
 * @property {Date} startTime
 * @property {string} streamSid
 * @property {object[]} menu          - food_items rows for this admin
 * @property {string} restaurantName
 * @property {object[]} parsedIntents - all LLM intent JSONs collected
 * @property {boolean} upsellOffered  - only 1 upsell per call
 * @property {object|null} ws         - Twilio WebSocket reference
 * @property {string|null} customerName      - collected during call
 * @property {string|null} customerAddress   - collected during call
 * @property {boolean} isReturningCustomer   - true if phone found in DB
 * @property {'greeting'|'ordering'|'confirming'|'collecting_info'|'done'} state
 */

/**
 * Create a new session for a call.
 */
export function createSession({ callSid, callerPhone, adminId, streamSid, ws }) {
  const session = {
    callSid,
    callerPhone,
    customerId: null,
    adminId,
    cart: [],
    transcript: [],
    languageDetected: "english",
    state: "greeting",
    startTime: new Date(),
    streamSid,
    menu: [],
    restaurantName: "",
    parsedIntents: [],
    upsellOffered: false,
    fbtOffered: false,
    ws,
    customerName: null,
    customerAddress: null,
    isReturningCustomer: false,
    _collectingField: null,
  };
  sessions.set(callSid, session);
  return session;
}

/**
 * Get session by callSid.
 * @param {string} callSid
 * @returns {Session|undefined}
 */
export function getSession(callSid) {
  return sessions.get(callSid);
}

/**
 * Destroy session after call ends.
 */
export function destroySession(callSid) {
  sessions.delete(callSid);
}

/**
 * List all active sessions (for debugging).
 */
export function listSessions() {
  return [...sessions.keys()];
}

export default { createSession, getSession, destroySession, listSessions };
