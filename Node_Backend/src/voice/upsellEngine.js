// ─────────────────────────────────────────────────────────────────────────────
// Upsell Engine — simple rule-based upsell suggestions (max 1 per call)
// ─────────────────────────────────────────────────────────────────────────────

import { pool } from "../db/index.js";
import { getRecommendations } from "../services/recommendation.service.js";

/**
 * Check if we should offer an upsell based on cart contents.
 * Queries upsell_events for common pairings and suggests the most popular.
 *
 * @param {object} session - The call session
 * @returns {Promise<object|null>} Upsell suggestion or null
 *   { foodId, name, price, prompt_hindi, prompt_english }
 */
export async function checkUpsellOpportunity(session) {
  // Only offer one upsell per call
  if (session.upsellOffered || session.cart.length === 0) {
    return null;
  }

  try {
    const anchorFoodIds = session.cart.map((item) => item.foodId);

    // Find popular upsell items that have been accepted before
    // for any anchor items currently in the cart
    const query = `
      SELECT 
        ue.upsell_food_id,
        fi.name,
        fi.selling_price,
        COUNT(*) FILTER (WHERE ue.accepted = true) AS accept_count,
        COUNT(*) AS total_offers
      FROM upsell_events ue
      JOIN food_items fi ON fi.id = ue.upsell_food_id
      WHERE ue.admin_id = $1
        AND ue.anchor_food_id = ANY($2)
        AND fi.is_available = true
        AND fi.id != ALL($2)
      GROUP BY ue.upsell_food_id, fi.name, fi.selling_price
      HAVING COUNT(*) FILTER (WHERE ue.accepted = true) > 0
      ORDER BY accept_count DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [session.adminId, anchorFoodIds]);

    if (result.rows.length === 0) {
      // Fallback: suggest a random available item not in cart
      return await suggestRandomItem(session);
    }

    const suggestion = result.rows[0];
    const anchorItem = session.cart[0]; // primary anchor

    return {
      foodId: suggestion.upsell_food_id,
      name: suggestion.name,
      price: parseFloat(suggestion.selling_price),
      anchorFoodId: anchorItem.foodId,
    };
  } catch (error) {
    console.error("[Upsell] Error checking opportunity:", error.message);
    return null;
  }
}

/**
 * Fallback: suggest a popular available item not already in cart.
 */
async function suggestRandomItem(session) {
  try {
    const cartFoodIds = session.cart.map((item) => item.foodId);
    const query = `
      SELECT id, name, selling_price
      FROM food_items
      WHERE admin_id = $1
        AND is_available = true
        AND id != ALL($2)
      ORDER BY RANDOM()
      LIMIT 1
    `;
    const result = await pool.query(query, [session.adminId, cartFoodIds]);

    if (result.rows.length === 0) return null;

    return {
      foodId: result.rows[0].id,
      name: result.rows[0].name,
      price: parseFloat(result.rows[0].selling_price),
      anchorFoodId: session.cart[0].foodId,
    };
  } catch {
    return null;
  }
}

/**
 * Generate upsell prompt text in the detected language.
 * Supports all Sarvam AI Bulbul v2 languages.
 *
 * @param {object} suggestion - { name, price }
 * @param {string} language   - detected language
 * @returns {string}
 */
export function generateUpsellPrompt(suggestion, language) {
  const name = suggestion.name;
  const price = `₹${suggestion.price.toFixed(0)}`;

  const UPSELL_TEMPLATES = {
    hindi:     `Kya aap ${name} bhi lena chahenge? Sirf ${price} mein.`,
    english:   `Would you also like to add ${name}? It's just ${price}.`,
    hinglish:  `${name} bhi le lein? Sirf ${price} mein mil jaayega.`,
    bengali:   `Apni ki ${name} o nite chaaben? Shudhu ${price} te.`,
    kannada:   `${name} kuda bēkā? Kevala ${price} ge.`,
    malayalam: `${name} kūdi vēṇāmō? Verum ${price} kku.`,
    marathi:   `${name} pan ghyaycha ka? Faqat ${price} maje.`,
    odia:      `${name} bi nebe ki? Kali ${price} re.`,
    punjabi:   `${name} vi laina chaahoge? Sirf ${price} vich.`,
    tamil:     `${name} um vēṇumā? Verum ${price} thaan.`,
    telugu:    `${name} kuda kavālā? Kevalam ${price} ke.`,
    gujarati:  `${name} pan joīe chhe? Bas ${price} ma.`,
  };

  return UPSELL_TEMPLATES[language] || UPSELL_TEMPLATES.hinglish;
}

/**
 * Get the top FBT (Frequently Bought Together) recommendation for the current cart.
 * Uses the weighted co-occurrence algorithm from recommendation.service.js.
 *
 * @param {object} session - The call session
 * @returns {Promise<object|null>} { foodId, name, price } or null
 */
export async function getFBTRecommendation(session) {
  if (session.cart.length === 0) return null;

  try {
    // Mirror the validation from recommendation.controller.js:
    // only pass valid positive integers as cartFoodIds
    const cartFoodIds = session.cart
      .map((item) => Number(item.foodId))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (cartFoodIds.length === 0) return null;

    const results = await getRecommendations({
      cartFoodIds,
      adminId:   session.adminId,
      threshold: 1,  // lower than REST default (5) — voice calls have fewer historical orders
      topN:      1,  // we only need one FBT pick per turn
    });

    if (!results || results.length === 0) return null;

    const rec = results[0];

    // Fetch price for the recommended item
    const priceResult = await pool.query(
      `SELECT selling_price, is_available FROM food_items WHERE id = $1 AND admin_id = $2 LIMIT 1`,
      [rec.food_id, session.adminId]
    );
    if (!priceResult.rows.length || !priceResult.rows[0].is_available) return null;

    return {
      foodId: rec.food_id,
      name:   rec.name,
      price:  parseFloat(priceResult.rows[0].selling_price),
      source: "fbt",
    };
  } catch (err) {
    console.error("[Upsell] FBT recommendation error:", err.message);
    return null;
  }
}

/**
 * Log an upsell event to the database.
 *
 * @param {object} params
 * @param {number} params.adminId
 * @param {number} params.orderId
 * @param {number} params.anchorFoodId
 * @param {number} params.upsellFoodId
 * @param {boolean} params.accepted
 * @param {number} [params.discountOffered=0]
 */
export async function logUpsellEvent({
  adminId,
  orderId,
  anchorFoodId,
  upsellFoodId,
  accepted,
  discountOffered = 0,
}) {
  try {
    await pool.query(
      `INSERT INTO upsell_events (admin_id, order_id, anchor_food_id, upsell_food_id, accepted, discount_offered)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, orderId, anchorFoodId, upsellFoodId, accepted, discountOffered]
    );
  } catch (error) {
    console.error("[Upsell] Failed to log event:", error.message);
  }
}

export default { checkUpsellOpportunity, generateUpsellPrompt, logUpsellEvent, getFBTRecommendation };
