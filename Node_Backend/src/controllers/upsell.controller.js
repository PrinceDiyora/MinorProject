// ─────────────────────────────────────────────────────────────────────────────
// controllers/upsell.controller.js — ML-driven upsell endpoint
// ─────────────────────────────────────────────────────────────────────────────
import { pool } from "../db/index.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getUpsellRecommendation } from "../services/ml.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upsell
// Body: { cart: [food_id, ...], order_value? }
// Calls Engine 2, logs to upsell_events (optional), returns suggestion.
// ─────────────────────────────────────────────────────────────────────────────
const suggestUpsell = asyncHandler(async (req, res) => {
    const { cart, order_value = 0 } = req.body;

    if (!Array.isArray(cart) || cart.length === 0) {
        throw new ApiError(400, "cart must be a non-empty array of food_ids");
    }

    // Resolve food_ids → item names (Engine 2 works with item names)
    const { rows: items } = await pool.query(
        `SELECT fi.id, fi.name, fi.selling_price
     FROM   food_items fi
     WHERE  fi.id = ANY($1::int[]) AND fi.admin_id = $2`,
        [cart, req.admin.id]
    );

    if (items.length === 0) {
        throw new ApiError(404, "No valid food items found in cart");
    }

    const itemNames = items.map((i) => i.name);
    const hour = new Date().getHours();

    const computedOrderValue =
        order_value > 0
            ? order_value
            : items.reduce((sum, i) => sum + parseFloat(i.selling_price), 0);

    const prediction = await getUpsellRecommendation({
        items: itemNames,
        order_value: computedOrderValue,
        time_of_day: hour,
    });

    if (!prediction || !prediction.upsell_item_name) {
        return res.status(200).json(
            new ApiResponse(200, { suggestion: null }, "No upsell recommendation available")
        );
    }

    // Resolve the upsell item name back to a food_id from our DB
    const { rows: upsellRows } = await pool.query(
        `SELECT id, name, selling_price, cost_price
     FROM   food_items
     WHERE  name = $1 AND admin_id = $2
     LIMIT  1`,
        [prediction.upsell_item_name, req.admin.id]
    );

    const upsellItem = upsellRows[0] || null;

    return res.status(200).json(
        new ApiResponse(200, {
            suggestion: {
                upsell_food_id: upsellItem?.id || null,
                upsell_item_name: prediction.upsell_item_name,
                synergy_score: prediction.synergy_score,
                recommended_discount: prediction.recommended_discount,
                selling_price: upsellItem ? parseFloat(upsellItem.selling_price) : null,
                discounted_price: upsellItem
                    ? Math.round(
                        parseFloat(upsellItem.selling_price) *
                        (1 - prediction.recommended_discount / 100) * 100
                    ) / 100
                    : null,
            },
            cart: items.map((i) => ({ id: i.id, name: i.name })),
        }, "Upsell recommendation fetched")
    );
});

export { suggestUpsell };
