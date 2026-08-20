import { pool } from "../db/index.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDynamicPrice } from "../services/ml.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders
// Query: ?status=pending&customer_id=3
// ─────────────────────────────────────────────────────────────────────────────
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, customer_id } = req.query;

  const conditions = ["o.admin_id = $1"];
  const values = [req.admin.id];
  let idx = 2;

  if (status) { conditions.push(`o.status = $${idx++}`); values.push(status); }
  if (customer_id) { conditions.push(`o.customer_id = $${idx++}`); values.push(customer_id); }

  const { rows } = await pool.query(
    `SELECT o.id, o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
            o.address, o.status, o.order_time, o.total_amount, o.created_at, o.updated_at
     FROM   orders o
     JOIN   customers c ON c.id = o.customer_id
     WHERE  ${conditions.join(" AND ")}
     ORDER  BY o.order_time DESC`,
    values
  );

  return res
    .status(200)
    .json(new ApiResponse(200, rows, "Orders fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/:id  (with full item breakdown)
// ─────────────────────────────────────────────────────────────────────────────
const getOrderById = asyncHandler(async (req, res) => {
  // Fetch order header
  const { rows: orderRows } = await pool.query(
    `SELECT o.id, o.customer_id, c.name AS customer_name, c.phone AS customer_phone,
            o.address, o.status, o.order_time, o.total_amount, o.created_at, o.updated_at
     FROM   orders o
     JOIN   customers c ON c.id = o.customer_id
     WHERE  o.id = $1 AND o.admin_id = $2`,
    [req.params.id, req.admin.id]
  );

  if (!orderRows[0]) throw new ApiError(404, "Order not found");

  // Fetch order items
  const { rows: items } = await pool.query(
    `SELECT oi.id, oi.food_id, fi.name AS food_name,
            oi.quantity, oi.price,
            oi.is_upsell, oi.upsell_discount_pct,
            oi.optimal_price_snapshot, oi.remark
     FROM   order_items oi
     JOIN   food_items  fi ON fi.id = oi.food_id
     WHERE  oi.order_id = $1
     ORDER  BY oi.id`,
    [req.params.id]
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { ...orderRows[0], items }, "Order fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders
// Body: {
//   customer_id,
//   address?,
//   items: [{ food_id, quantity, price, remark?, is_upsell?, upsell_discount_pct? }]
// }
// ─────────────────────────────────────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const { customer_id, address, items } = req.body;

  if (!customer_id) throw new ApiError(400, "customer_id is required");
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "items must be a non-empty array");
  }

  // Validate each item has required fields
  for (const item of items) {
    if (!item.food_id || !item.quantity || item.price === undefined) {
      throw new ApiError(400, "Each item needs food_id, quantity, and price");
    }
  }

  // Verify customer belongs to this restaurant
  const { rows: custRows } = await pool.query(
    "SELECT id FROM customers WHERE id = $1 AND admin_id = $2",
    [customer_id, req.admin.id]
  );
  if (!custRows[0]) throw new ApiError(404, "Customer not found");

  // Verify all food items belong to this restaurant & fetch details for ML
  const foodIds = items.map((i) => i.food_id);
  const { rows: foodRows } = await pool.query(
    `SELECT fi.id, fi.name, c.name AS category,
            fi.cost_price, fi.selling_price,
            fi.min_price, fi.max_price,
            fi.competitor_price_idx
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     WHERE  fi.id = ANY($1::int[]) AND fi.admin_id = $2`,
    [foodIds, req.admin.id]
  );
  if (foodRows.length !== new Set(foodIds).size) {
    throw new ApiError(404, "One or more food items not found");
  }

  // ── Call Engine 1 for dynamic pricing (non-blocking — graceful on failure) ─
  const foodMap = Object.fromEntries(foodRows.map((f) => [f.id, f]));
  const hour = new Date().getHours();

  const mlPromises = items.map(async (item) => {
    const food = foodMap[item.food_id];
    if (!food) return null;
    try {
      return await getDynamicPrice({
        food_id: food.id,
        item_name: food.name,
        category: food.category,
        cost_price: parseFloat(food.cost_price),
        current_price: parseFloat(food.selling_price),
        min_price: parseFloat(food.min_price),
        max_price: parseFloat(food.max_price),
        demand_1h: 0,   // simplified — full demand query adds latency
        demand_24h: 0,
        competitor_price_idx: parseFloat(food.competitor_price_idx),
        time_of_day: hour,
      });
    } catch {
      return null;
    }
  });

  const mlResults = await Promise.all(mlPromises);

  // Calculate total_amount
  const total_amount = items.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  // ── Insert order header ──────────────────────────────────────────────────
  const { rows: orderRows } = await pool.query(
    `INSERT INTO orders (admin_id, customer_id, address, total_amount)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [req.admin.id, customer_id, address?.trim() || null, total_amount]
  );

  const orderId = orderRows[0].id;

  // ── Insert order items (with ML optimal_price_snapshot) ──────────────────
  const itemInsertPromises = items.map((item, idx) => {
    const mlResult = mlResults[idx];
    const optimalPrice = mlResult?.optimal_price ?? item.optimal_price_snapshot ?? null;

    return pool.query(
      `INSERT INTO order_items
         (order_id, food_id, quantity, price, remark, is_upsell, upsell_discount_pct, optimal_price_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        orderId,
        item.food_id,
        item.quantity,
        item.price,
        item.remark?.trim() || null,
        item.is_upsell ?? false,
        item.upsell_discount_pct ?? 0,
        optimalPrice,
      ]
    );
  });
  await Promise.all(itemInsertPromises);

  // ── Return full order ─────────────────────────────────────────────────────
  const { rows: full } = await pool.query(
    `SELECT o.id, o.customer_id, c.name AS customer_name,
            o.address, o.status, o.order_time, o.total_amount
     FROM   orders o
     JOIN   customers c ON c.id = o.customer_id
     WHERE  o.id = $1`,
    [orderId]
  );

  return res
    .status(201)
    .json(new ApiResponse(201, { ...full[0], items }, "Order placed successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status
// Body: { status: "preparing" | "ready" | "delivered" | "cancelled" }
// ─────────────────────────────────────────────────────────────────────────────
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const VALID = ["pending", "preparing", "ready", "delivered", "cancelled"];

  if (!status || !VALID.includes(status)) {
    throw new ApiError(400, `status must be one of: ${VALID.join(", ")}`);
  }

  const { rows } = await pool.query(
    `UPDATE orders
     SET    status = $1
     WHERE  id = $2 AND admin_id = $3
     RETURNING id, status, updated_at`,
    [status, req.params.id, req.admin.id]
  );

  if (!rows[0]) throw new ApiError(404, "Order not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], `Order status updated to "${status}"`));
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/orders/:id
// Hard-deletes the order. ON DELETE CASCADE removes order_items + upsell_events.
// voice_sessions.order_id is set to NULL automatically (ON DELETE SET NULL).
// Not allowed once status = 'delivered'.
// ─────────────────────────────────────────────────────────────────────────────
const cancelOrder = asyncHandler(async (req, res) => {
  // Verify the order belongs to this admin and is not already delivered
  const { rows: check } = await pool.query(
    `SELECT id, status FROM orders WHERE id = $1 AND admin_id = $2`,
    [req.params.id, req.admin.id]
  );

  if (!check[0]) throw new ApiError(404, "Order not found");
  if (check[0].status === "delivered") {
    throw new ApiError(400, "Cannot cancel a delivered order");
  }

  // Hard delete — cascades to order_items and upsell_events
  await pool.query(
    `DELETE FROM orders WHERE id = $1 AND admin_id = $2`,
    [req.params.id, req.admin.id]
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { id: req.params.id }, "Order cancelled and deleted successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/analytics/profitability
// Query: ?period=today | 7days | 30days | alltime  (default: 7days)
//
// Revenue = oi.price × qty — the ACTUAL price charged at order time, so it
// correctly accounts for dynamic pricing / price changes over time.
// Cost    = fi.cost_price × qty  (current cost — not snapshotted).
// Excludes cancelled orders.
// ─────────────────────────────────────────────────────────────────────────────
const getProfitabilityAnalytics = asyncHandler(async (req, res) => {
  const { period, from, to } = req.query;

  // Build time filter — supports either from+to (custom range) OR period preset
  const values = [req.admin.id];
  let timeClause = "";

  if (from && to) {
    // Custom range: from (inclusive) to to (end of day, inclusive)
    values.push(from, to);
    timeClause = `AND o.order_time >= $${values.length - 1}::timestamptz
                  AND o.order_time <  ($${values.length}::date + INTERVAL '1 day')`;
  } else {
    const usePeriod = period || "7days";
    const VALID = ["today", "7days", "30days", "alltime"];
    if (!VALID.includes(usePeriod)) {
      throw new ApiError(400, `period must be one of: ${VALID.join(", ")}`);
    }
    const now = new Date();
    let cutoff = null;
    if (usePeriod === "today") {
      const s = new Date(now); s.setHours(0, 0, 0, 0); cutoff = s.toISOString();
    } else if (usePeriod === "7days") {
      const s = new Date(now); s.setDate(s.getDate() - 7); cutoff = s.toISOString();
    } else if (usePeriod === "30days") {
      const s = new Date(now); s.setDate(s.getDate() - 30); cutoff = s.toISOString();
    }
    if (cutoff) { values.push(cutoff); timeClause = `AND o.order_time >= $${values.length}`; }
  }

  const { rows } = await pool.query(
    `SELECT
       fi.id                                                              AS food_id,
       fi.name                                                            AS food_name,
       cat.name                                                           AS category,
       SUM(oi.quantity)::INT                                              AS qty_sold,
       ROUND(SUM(oi.price * oi.quantity)::NUMERIC, 2)                    AS total_revenue,
       ROUND(SUM(fi.cost_price * oi.quantity)::NUMERIC, 2)               AS total_cost,
       ROUND(SUM((oi.price - fi.cost_price) * oi.quantity)::NUMERIC, 2)  AS total_profit,
       ROUND(
         CASE WHEN SUM(oi.price * oi.quantity) = 0 THEN 0
              ELSE SUM((oi.price - fi.cost_price) * oi.quantity)
                   / SUM(oi.price * oi.quantity) * 100
         END::NUMERIC, 1
       )                                                                  AS margin_pct
     FROM   order_items  oi
     JOIN   orders       o   ON o.id   = oi.order_id
     JOIN   food_items   fi  ON fi.id  = oi.food_id
     JOIN   categories   cat ON cat.id = fi.category_id
     WHERE  o.admin_id  = $1
       AND  o.status   != 'cancelled'
       ${timeClause}
     GROUP  BY fi.id, fi.name, cat.name
     ORDER  BY total_profit DESC`,
    values
  );

  // Separate order count query (can't derive from grouped rows without double-counting)
  const countValues = [req.admin.id];
  let countTimeClause = "";
  if (from && to) {
    countValues.push(from, to);
    countTimeClause = `AND order_time >= $${countValues.length - 1}::timestamptz
                       AND order_time <  ($${countValues.length}::date + INTERVAL '1 day')`;
  } else if (timeClause) {
    // reuse the same cutoff value that was pushed to values
    countValues.push(values[values.length - 1]);
    countTimeClause = `AND order_time >= $${countValues.length}`;
  }
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::INT AS order_count
     FROM   orders
     WHERE  admin_id = $1
       AND  status  != 'cancelled'
       ${countTimeClause}`,
    countValues
  );
  const order_count = countRows[0]?.order_count ?? 0;

  const totals = rows.reduce(
    (acc, r) => ({
      qty_sold:      acc.qty_sold      + Number(r.qty_sold),
      total_revenue: acc.total_revenue + Number(r.total_revenue),
      total_cost:    acc.total_cost    + Number(r.total_cost),
      total_profit:  acc.total_profit  + Number(r.total_profit),
    }),
    { qty_sold: 0, total_revenue: 0, total_cost: 0, total_profit: 0 }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { rows, totals: { ...totals, order_count }, period: period || (from ? "custom" : "7days") }, "Profitability analytics fetched"));
});

export {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getProfitabilityAnalytics,
};
