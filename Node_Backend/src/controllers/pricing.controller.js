// ─────────────────────────────────────────────────────────────────────────────
// controllers/pricing.controller.js — ML-driven pricing endpoints
// ─────────────────────────────────────────────────────────────────────────────
import { pool } from "../db/index.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDynamicPrice, getStrategicDecision } from "../services/ml.service.js";

// Quadrant indexing matches Engine 3 training
const QUADRANT_NAMES = { 0: "Stars", 1: "Puzzles", 2: "Dogs", 3: "Plowhorses" };

// ─────────────────────────────────────────────────────────────────────────────
// Helper — shortened human-readable reason using quadrant context and data
// ─────────────────────────────────────────────────────────────────────────────
function buildReason(direction, quadrant, item, demand7d, avg_margin) {
    const marginPct = Math.round(avg_margin * 100);
    const compIdx = parseFloat(item.competitor_price_idx);

    if (direction === "increase") {
        if (quadrant === 3) return `High volume (${demand7d} orders), low margin (${marginPct}%). Increase price to improve margins.`;
        if (quadrant === 1) return `High volume & high margin. Strong candidate for a premium price.`;
        if (compIdx > 1.05) return `Competitors charge ${Math.round((compIdx - 1) * 100)}% more. Safe to raise price.`;
        return `Stable demand (${demand7d} orders) supports a modest price increase.`;
    } else {
        if (quadrant === 0) return `High margin (${marginPct}%), low volume (${demand7d} orders). Reduce price to boost sales.`;
        if (quadrant === 2) return `Low sales & margin. Try a discount, or consider removing from menu.`;
        if (compIdx < 0.95) return `Competitors are ${Math.round((1 - compIdx) * 100)}% cheaper. Reduce price to compete.`;
        return `Soft demand (${demand7d} orders). A price reduction could recover sales.`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pricing/suggestions
// Fetches all food items, runs Engine 3 on each with correct relative
// popularity normalisation, and returns only actionable suggestions.
// ─────────────────────────────────────────────────────────────────────────────
const getSuggestions = asyncHandler(async (req, res) => {
    // Fetch all available items with 7-day demand
    const { rows: items } = await pool.query(
        `SELECT fi.id, fi.name, c.name AS category,
            fi.cost_price, fi.selling_price,
            fi.min_price, fi.max_price,
            fi.competitor_price_idx,
            COUNT(oi.id) AS demand_7d
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     LEFT JOIN order_items oi ON oi.food_id = fi.id
     LEFT JOIN orders o       ON o.id = oi.order_id
                              AND o.order_time >= NOW() - INTERVAL '7 days'
                              AND o.admin_id = fi.admin_id
     WHERE  fi.admin_id = $1 AND fi.is_available = TRUE
     GROUP BY fi.id, fi.name, c.name,
              fi.cost_price, fi.selling_price, fi.min_price, fi.max_price,
              fi.competitor_price_idx
     ORDER BY fi.name`,
        [req.admin.id]
    );

    if (items.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, { suggestions: [], total_items: 0, total_suggestions: 0 }, "No items found")
        );
    }

    // ── Batch normalisation values ─────────────────────────────────────────────
    // max_demand_7d:      relative popularity (demand / max = fraction like training)
    // batch_margin_median: median margin of THIS restaurant's items — ensures the top
    //   50% of items by margin are classified as 'high margin' relative to this menu,
    //   not the 0.6667 training-time absolute threshold (which is above every item here).
    const maxDemand7d = Math.max(...items.map(i => parseInt(i.demand_7d || 0)), 1);

    const allMargins = items.map(i => {
        const cost = parseFloat(i.cost_price);
        const price = parseFloat(i.selling_price);
        return price > 0 ? (price - cost) / price : 0;
    }).sort((a, b) => a - b);
    const mid = Math.floor(allMargins.length / 2);
    const batchMarginMedian = allMargins.length % 2 === 0
        ? (allMargins[mid - 1] + allMargins[mid]) / 2
        : allMargins[mid];

    // ── Run Engine 3 on all items in parallel ─────────────────────────────────
    const mlPromises = items.map(async (item) => {
        const cost = parseFloat(item.cost_price);
        const price = parseFloat(item.selling_price);
        const demand7d = parseInt(item.demand_7d || 0);
        const avg_margin = price > 0 ? (price - cost) / price : 0;

        // Items with zero orders are skipped at the Python level too, but be explicit
        if (demand7d === 0) return null;

        try {
            const result = await getStrategicDecision({
                food_id: item.id,
                item_name: item.name,
                category: item.category,
                cost_price: cost,
                current_price: price,
                demand_7d: demand7d,
                avg_margin: Math.round(avg_margin * 1000) / 1000,
                competitor_price_idx: parseFloat(item.competitor_price_idx),
                trend: "stable",
                max_demand_7d: maxDemand7d,
                batch_margin_median: Math.round(batchMarginMedian * 1000) / 1000,
            });

            if (!result || !result.change) return null;

            // ── Business-logic filters ────────────────────────────────────────────
            // Dogs (low margin + low pop): model says "increase or remove" but with
            // demand < 15 the signal is too ambiguous — skip to avoid bad advice.
            if (result.quadrant === 2 && demand7d < 15) return null;

            // Stars: Python side already overrides increase → decrease.
            // Double-check here in case quadrant changed after override.
            if (result.quadrant === 0 && result.direction === "increase") return null;

            // Clamp to [min_price, max_price]
            const suggested = Math.max(
                parseFloat(item.min_price),
                Math.min(parseFloat(item.max_price), result.new_price)
            );
            const delta = Math.round((suggested - price) * 100) / 100;

            // Skip negligible deltas (< ₹0.50)
            if (Math.abs(delta) < 0.5) return null;

            return {
                food_id: item.id,
                name: item.name,
                category: item.category,
                current_price: price,
                suggested_price: Math.round(suggested * 100) / 100,
                delta,
                direction: result.direction,
                quadrant: result.quadrant,
                quadrant_name: result.quadrant_name ?? QUADRANT_NAMES[result.quadrant] ?? "Unknown",
                prob_a: result.prob_a,
                prob_b: result.prob_b,
                demand_7d: demand7d,
                reason: buildReason(result.direction, result.quadrant, item, demand7d, avg_margin),
                min_price: parseFloat(item.min_price),
                max_price: parseFloat(item.max_price),
            };
        } catch {
            return null;
        }
    });

    const results = await Promise.all(mlPromises);
    const suggestions = results.filter(Boolean);

    return res.status(200).json(
        new ApiResponse(200, {
            suggestions,
            total_items: items.length,
            total_suggestions: suggestions.length,
            items_with_orders: items.filter(i => parseInt(i.demand_7d || 0) > 0).length,
            max_demand_7d: maxDemand7d,
        }, "Pricing suggestions fetched")
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pricing/dynamic  — single item, Engine 1
// ─────────────────────────────────────────────────────────────────────────────
const dynamicPrice = asyncHandler(async (req, res) => {
    const { food_id } = req.body;
    if (!food_id) throw new ApiError(400, "food_id is required");

    const { rows } = await pool.query(
        `SELECT fi.id, fi.name, c.name AS category,
            fi.cost_price, fi.selling_price,
            fi.min_price, fi.max_price,
            fi.competitor_price_idx
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     WHERE  fi.id = $1 AND fi.admin_id = $2`,
        [food_id, req.admin.id]
    );
    if (!rows[0]) throw new ApiError(404, "Food item not found");

    const item = rows[0];
    const hour = new Date().getHours();

    const { rows: demandRows } = await pool.query(
        `SELECT
       COUNT(*) FILTER (WHERE o.order_time >= NOW() - INTERVAL '1 hour')  AS demand_1h,
       COUNT(*) FILTER (WHERE o.order_time >= NOW() - INTERVAL '24 hours') AS demand_24h
     FROM   order_items oi
     JOIN   orders o ON o.id = oi.order_id
     WHERE  oi.food_id = $1 AND o.admin_id = $2`,
        [food_id, req.admin.id]
    );

    const demand = demandRows[0] || { demand_1h: 0, demand_24h: 0 };

    const prediction = await getDynamicPrice({
        food_id: item.id,
        item_name: item.name,
        category: item.category,
        cost_price: parseFloat(item.cost_price),
        current_price: parseFloat(item.selling_price),
        min_price: parseFloat(item.min_price),
        max_price: parseFloat(item.max_price),
        demand_1h: parseInt(demand.demand_1h),
        demand_24h: parseInt(demand.demand_24h),
        competitor_price_idx: parseFloat(item.competitor_price_idx),
        time_of_day: hour,
    });

    if (!prediction) throw new ApiError(503, "ML Service unavailable — try again later");

    return res.status(200).json(
        new ApiResponse(200, {
            food_id: item.id,
            item_name: item.name,
            current_price: parseFloat(item.selling_price),
            ...prediction,
        }, "Dynamic pricing prediction fetched")
    );
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pricing/optimize  — single item, Engine 3
// ─────────────────────────────────────────────────────────────────────────────
const strategicPrice = asyncHandler(async (req, res) => {
    const { food_id } = req.body;
    if (!food_id) throw new ApiError(400, "food_id is required");

    const { rows } = await pool.query(
        `SELECT fi.id, fi.name, c.name AS category,
            fi.cost_price, fi.selling_price, fi.min_price, fi.max_price,
            fi.competitor_price_idx
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     WHERE  fi.id = $1 AND fi.admin_id = $2`,
        [food_id, req.admin.id]
    );
    if (!rows[0]) throw new ApiError(404, "Food item not found");

    const item = rows[0];
    const { rows: demandRows } = await pool.query(
        `SELECT COUNT(*) AS demand_7d
     FROM   order_items oi
     JOIN   orders o ON o.id = oi.order_id
     WHERE  oi.food_id = $1 AND o.admin_id = $2
       AND  o.order_time >= NOW() - INTERVAL '7 days'`,
        [food_id, req.admin.id]
    );

    const demand_7d = parseInt(demandRows[0]?.demand_7d || 0);
    const cost = parseFloat(item.cost_price);
    const price = parseFloat(item.selling_price);
    const avg_margin = price > 0 ? (price - cost) / price : 0;

    const prediction = await getStrategicDecision({
        food_id: item.id,
        item_name: item.name,
        category: item.category,
        cost_price: cost,
        current_price: price,
        demand_7d,
        avg_margin: Math.round(avg_margin * 1000) / 1000,
        competitor_price_idx: parseFloat(item.competitor_price_idx),
        trend: "stable",
        max_demand_7d: demand_7d,   // single-item call — no batch context
    });

    if (!prediction) throw new ApiError(503, "ML Service unavailable — try again later");

    return res.status(200).json(
        new ApiResponse(200, {
            food_id: item.id,
            item_name: item.name,
            current_price: price,
            ...prediction,
        }, "Strategic pricing recommendation fetched")
    );
});

export { getSuggestions, dynamicPrice, strategicPrice };
