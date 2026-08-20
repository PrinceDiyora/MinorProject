import { pool }                from "../db/index.js";
import { ApiError }            from "../utils/ApiError.js";
import { ApiResponse }         from "../utils/ApiResponse.js";
import { asyncHandler }        from "../utils/asyncHandler.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/voice/menu?admin_id=X
// Returns all available food items with stock for the voice agent menu display.
// ─────────────────────────────────────────────────────────────────────────────
const getVoiceMenu = asyncHandler(async (req, res) => {
  const adminId = parseInt(req.query.admin_id, 10);
  if (!adminId || isNaN(adminId)) {
    throw new ApiError(400, "admin_id query param is required and must be a number");
  }

  const { rows } = await pool.query(
    `SELECT fi.id, fi.name, fi.selling_price, fi.category_id,
            c.name AS category_name, fi.is_available, fi.quantity
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     WHERE  fi.admin_id = $1 AND fi.is_available = TRUE AND fi.quantity > 0
     ORDER  BY c.name, fi.name`,
    [adminId]
  );

  return res.status(200).json(new ApiResponse(200, rows, "Menu fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/recommendations
// Body: { admin_id: int, food_ids: [1, 2, 3] }
//
// Returns items from the same categories as cart items (not already in cart)
// formatted as combo suggestions for the voice agent.
// ─────────────────────────────────────────────────────────────────────────────
const getVoiceRecommendations = asyncHandler(async (req, res) => {
  const { admin_id, food_ids } = req.body;

  if (!admin_id || !Array.isArray(food_ids) || food_ids.length === 0) {
    throw new ApiError(400, "admin_id and food_ids[] are required");
  }

  const adminId   = parseInt(admin_id, 10);
  const cartIds   = food_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!adminId || cartIds.length === 0) {
    throw new ApiError(400, "Invalid admin_id or food_ids");
  }

  // Find items from same categories, not in cart, available and in stock
  const { rows } = await pool.query(
    `SELECT fi.id   AS food_id,
            fi.name,
            fi.selling_price AS price,
            c.name  AS category_name
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     WHERE  fi.admin_id     = $1
       AND  fi.is_available = TRUE
       AND  fi.quantity     > 0
       AND  fi.id           != ALL($2::int[])
       AND  fi.category_id IN (
              SELECT DISTINCT category_id
              FROM   food_items
              WHERE  id = ANY($2::int[]) AND admin_id = $1
            )
     ORDER  BY fi.selling_price
     LIMIT  6`,
    [adminId, cartIds]
  );

  // Group into combos: pair the cheapest suggestion with cart item names
  const combos = rows.map((item) => ({
    combo_name:  `${item.name} Add-on`,
    items:       [{ food_id: item.food_id, name: item.name, price: parseFloat(item.price) }],
    combo_price: parseFloat(item.price),
    savings:     0,
    category:    item.category_name,
  }));

  return res.status(200).json(new ApiResponse(200, combos, "Recommendations fetched"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/orders
// Body: {
//   admin_id: int,
//   customer: { name: str, phone: str, address: str },
//   items: [{ food_id, quantity, price, is_upsell?, upsell_discount_pct? }],
//   total_amount: float
// }
//
// Single DB transaction:
//   1. Upsert customer  (ON CONFLICT admin_id+phone → update name/address)
//   2. Insert order
//   3. Insert order_items
//   4. Decrement food_items.quantity (rolls back on insufficient stock)
// ─────────────────────────────────────────────────────────────────────────────
const placeVoiceOrder = asyncHandler(async (req, res) => {
  const { admin_id, customer, items, total_amount } = req.body;

  if (!admin_id)                                          throw new ApiError(400, "admin_id is required");
  if (!customer?.name || !customer?.phone)                throw new ApiError(400, "customer.name and customer.phone are required");
  if (!Array.isArray(items) || items.length === 0)        throw new ApiError(400, "items must be a non-empty array");

  const adminId = parseInt(admin_id, 10);
  if (isNaN(adminId)) throw new ApiError(400, "admin_id must be a number");

  for (const item of items) {
    if (!item.food_id || !item.quantity || item.price === undefined) {
      throw new ApiError(400, "Each item requires food_id, quantity, and price");
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. Upsert customer ──────────────────────────────────────────────────
    const { rows: custRows } = await client.query(
      `INSERT INTO customers (admin_id, name, phone, address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (admin_id, phone)
         DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, updated_at = NOW()
       RETURNING id`,
      [adminId, customer.name.trim(), customer.phone.trim(), customer.address?.trim() || null]
    );
    const customerId = custRows[0].id;

    // ── 2. Insert order ─────────────────────────────────────────────────────
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (admin_id, customer_id, address, total_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [adminId, customerId, customer.address?.trim() || null, total_amount ?? 0]
    );
    const orderId = orderRows[0].id;

    // ── 3 & 4. Insert order_items + decrement stock ─────────────────────────
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items
           (order_id, food_id, quantity, price, is_upsell, upsell_discount_pct, optimal_price_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          item.food_id,
          item.quantity,
          item.price,
          item.is_upsell          ?? false,
          item.upsell_discount_pct ?? 0,
          item.optimal_price_snapshot ?? null,
        ]
      );

      const { rowCount } = await client.query(
        `UPDATE food_items
         SET    quantity = quantity - $1
         WHERE  id = $2 AND admin_id = $3 AND quantity >= $1`,
        [item.quantity, item.food_id, adminId]
      );

      if (rowCount === 0) {
        throw new ApiError(
          409,
          `Insufficient stock for item id=${item.food_id}. Please update the cart.`
        );
      }
    }

    await client.query("COMMIT");

    return res.status(201).json(
      new ApiResponse(201, { order_id: orderId, status: "pending" }, "Order placed successfully")
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export { getVoiceMenu, getVoiceRecommendations, placeVoiceOrder };
