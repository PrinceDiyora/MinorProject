// ─────────────────────────────────────────────────────────────────────────────
// services/ml.service.js — HTTP client to the Python ML inference service
//
// All functions gracefully degrade: if the ML service is down or slow,
// they return null instead of crashing the order flow.
// ─────────────────────────────────────────────────────────────────────────────

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5000";
const ML_TIMEOUT_MS = 5000; // 5 second timeout

/**
 * Internal fetch helper with timeout and error handling.
 * Returns parsed JSON on success, null on any failure.
 */
async function mlFetch(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    try {
        const res = await fetch(`${ML_SERVICE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
            console.error(`ML Service ${path} returned ${res.status}`);
            return null;
        }

        const data = await res.json();
        return data.success ? data : null;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") {
            console.error(`ML Service ${path} timed out after ${ML_TIMEOUT_MS}ms`);
        } else {
            console.error(`ML Service ${path} error:`, err.message);
        }
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine 1 — Dynamic Pricing
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Get optimal price for a food item.
 * @param {{food_id, item_name, category, cost_price, current_price,
 *          min_price, max_price, demand_1h, demand_24h,
 *          competitor_price_idx, time_of_day}} data
 * @returns {Promise<{optimal_price, decision, delta}|null>}
 */
export async function getDynamicPrice(data) {
    return mlFetch("/engine1/price", data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine 2 — Upsell Recommendation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Get upsell recommendation for cart items.
 * @param {{items: string[], order_value: number, time_of_day: number}} data
 * @returns {Promise<{upsell_food_id, upsell_item_name, synergy_score,
 *           recommended_discount}|null>}
 */
export async function getUpsellRecommendation(data) {
    return mlFetch("/engine2/upsell", data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine 3 — Strategic Pricing
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Get strategic pricing decision for a food item.
 * @param {{food_id, item_name, category, cost_price, current_price,
 *          demand_7d, avg_margin, competitor_price_idx, trend,
 *          max_demand_7d}} data
 * @returns {Promise<{change, direction, delta, new_price, quadrant, quadrant_name}|null>}
 */
export async function getStrategicDecision(data) {
    return mlFetch("/engine3/optimize", data);
}
