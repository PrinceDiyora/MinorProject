// ─────────────────────────────────────────────────────────────────────────────
// jobs/nightly_pricing.job.js — Cron job for Engine 3 strategic pricing
//
// Runs daily at 02:00 AM. For each food item, calls Engine 3 to decide
// whether to change the price, then updates food_items.selling_price
// and logs to price_history.
// ─────────────────────────────────────────────────────────────────────────────
import cron from "node-cron";
import { pool } from "../db/index.js";
import { getStrategicDecision } from "../services/ml.service.js";

/**
 * Process one food item through Engine 3.
 * If Engine 3 says change=true, update DB and log to price_history.
 */
async function processItem(item) {
    const cost = parseFloat(item.cost_price);
    const price = parseFloat(item.selling_price);
    const avg_margin = price > 0 ? (price - cost) / price : 0;

    const result = await getStrategicDecision({
        food_id: item.id,
        item_name: item.name,
        category: item.category_name,
        cost_price: cost,
        current_price: price,
        demand_7d: parseInt(item.demand_7d || 0),
        avg_margin: Math.round(avg_margin * 1000) / 1000,
        competitor_price_idx: parseFloat(item.competitor_price_idx),
        trend: "stable",
    });

    if (!result || !result.change) return null;

    const newPrice = result.new_price;

    // Ensure new price stays within [min_price, max_price]
    const clampedPrice = Math.max(
        parseFloat(item.min_price),
        Math.min(parseFloat(item.max_price), newPrice)
    );

    // ── Update selling_price ──────────────────────────────────────────────
    await pool.query(
        `UPDATE food_items SET selling_price = $1 WHERE id = $2`,
        [clampedPrice, item.id]
    );

    // ── Log to price_history ──────────────────────────────────────────────
    await pool.query(
        `INSERT INTO price_history (admin_id, food_id, old_price, new_price, reason)
     VALUES ($1, $2, $3, $4, $5)`,
        [
            item.admin_id,
            item.id,
            price,
            clampedPrice,
            `Engine 3: ${result.direction} by ${Math.abs(result.delta).toFixed(2)} INR`,
        ]
    );

    return { id: item.id, name: item.name, old: price, new: clampedPrice, direction: result.direction };
}

/**
 * Run the nightly pricing job: fetch all items with 7d demand, call Engine 3.
 */
async function runNightlyPricing() {
    console.log("🌙 Nightly pricing job started");
    const startTime = Date.now();

    try {
        // Fetch all active food items with 7-day demand count
        const { rows: items } = await pool.query(`
      SELECT  fi.id, fi.admin_id, fi.name, c.name AS category_name,
              fi.cost_price, fi.selling_price, fi.min_price, fi.max_price,
              fi.competitor_price_idx,
              COUNT(oi.id) AS demand_7d
      FROM    food_items fi
      JOIN    categories c ON c.id = fi.category_id
      LEFT JOIN order_items oi ON oi.food_id = fi.id
      LEFT JOIN orders o       ON o.id = oi.order_id
                                AND o.order_time >= NOW() - INTERVAL '7 days'
      WHERE   fi.is_available = TRUE
      GROUP BY fi.id, fi.admin_id, fi.name, c.name,
               fi.cost_price, fi.selling_price, fi.min_price, fi.max_price,
               fi.competitor_price_idx
      ORDER BY fi.id
    `);

        console.log(`  Found ${items.length} items to evaluate`);

        let changed = 0;
        for (const item of items) {
            const update = await processItem(item);
            if (update) {
                changed++;
                console.log(`  ✓ ${update.name}: ₹${update.old} → ₹${update.new} (${update.direction})`);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`🌙 Nightly pricing done: ${changed}/${items.length} items changed (${elapsed}s)`);
    } catch (err) {
        console.error("🌙 Nightly pricing job failed:", err.message);
    }
}

/**
 * Schedule the nightly pricing cron.
 * Call this once during server startup.
 */
export function scheduleNightlyPricing() {
    // Run at 02:00 AM every day
    cron.schedule("0 2 * * *", () => {
        runNightlyPricing();
    });
    console.log("📅 Nightly pricing job scheduled for 02:00 AM daily");
}

// Export for manual triggering / testing
export { runNightlyPricing };
