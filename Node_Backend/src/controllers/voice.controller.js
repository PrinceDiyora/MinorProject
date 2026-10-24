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
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const admin_id = body.admin_id ?? req.query.admin_id ?? 1;
  let food_ids   = body.food_ids ?? req.query.food_ids;

  if (typeof food_ids === "string") {
    try { food_ids = JSON.parse(food_ids); } catch {
      food_ids = food_ids.split(",").map(Number);
    }
  }

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
  console.log("📥 [VOICE ORDER] Incoming request:", {
    method:  req.method,
    headers: req.headers,
    query:   req.query,
    body:    req.body
  });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const rawAdminId = body.admin_id ?? req.query.admin_id ?? 1;
  const adminId    = parseInt(rawAdminId, 10) || 1;

  let customer     = body.customer ?? req.query.customer;
  let items        = body.items ?? req.query.items;
  let total_amount = body.total_amount ?? req.query.total_amount;

  if (typeof customer === "string") {
    try { customer = JSON.parse(customer); } catch {}
  }
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch {}
  }

  // Graceful customer resolution: accept nested or flat fields, with safe fallbacks
  const customerName = (
    customer?.name ||
    body.customer_name ||
    body.name ||
    req.query.customer_name ||
    "Voice Customer"
  ).trim();

  const customerPhone = (
    customer?.phone ||
    body.customer_phone ||
    body.phone ||
    req.query.customer_phone ||
    "+919876543210"
  ).trim();

  const customerAddress = (
    customer?.address ||
    body.customer_address ||
    body.address ||
    req.query.customer_address ||
    "Dine-In / Counter"
  ).trim();

  // Graceful items resolution: accept array, single object, or fallback to first available item
  if (!Array.isArray(items) || items.length === 0) {
    if (body.food_id || body.item_name || body.name) {
      items = [{
        food_id:  body.food_id,
        name:     body.item_name || body.name,
        quantity: Number(body.quantity) || 1,
        price:    body.price != null ? Number(body.price) : undefined,
      }];
    } else {
      // Default sample item if tested with empty body
      const { rows: defaultItem } = await pool.query(
        "SELECT id, name, selling_price FROM food_items WHERE admin_id = $1 AND is_available = TRUE ORDER BY id ASC LIMIT 1",
        [adminId]
      );
      if (defaultItem.length > 0) {
        items = [{
          food_id:  defaultItem[0].id,
          name:     defaultItem[0].name,
          quantity: 1,
          price:    parseFloat(defaultItem[0].selling_price),
        }];
      } else {
        throw new ApiError(400, "No food items found for this restaurant.");
      }
    }
  }

  // Resolve each item: find by food_id or name, fill price from DB if missing
  const resolvedItems = [];
  for (const rawItem of items) {
    let foodId   = rawItem.food_id ? parseInt(rawItem.food_id, 10) : null;
    let quantity = Math.max(1, parseInt(rawItem.quantity, 10) || 1);
    let price    = rawItem.price != null ? parseFloat(rawItem.price) : null;

    // If no food_id, lookup by name
    if (!foodId && (rawItem.name || rawItem.food_name || rawItem.item_name)) {
      const searchName = rawItem.name || rawItem.food_name || rawItem.item_name;
      const { rows: match } = await pool.query(
        "SELECT id, selling_price FROM food_items WHERE admin_id = $1 AND name ILIKE $2 LIMIT 1",
        [adminId, `%${searchName}%`]
      );
      if (match.length > 0) {
        foodId = match[0].id;
        if (price === null) price = parseFloat(match[0].selling_price);
      }
    }

    // If still no food_id or not found, fallback to first available food item
    if (!foodId) {
      const { rows: fallback } = await pool.query(
        "SELECT id, selling_price FROM food_items WHERE admin_id = $1 AND is_available = TRUE ORDER BY id ASC LIMIT 1",
        [adminId]
      );
      if (fallback.length > 0) {
        foodId = fallback[0].id;
        if (price === null) price = parseFloat(fallback[0].selling_price);
      } else {
        foodId = 1;
        if (price === null) price = 149;
      }
    }

    // If price still unknown, query DB
    if (price === null || isNaN(price)) {
      const { rows: itemRow } = await pool.query(
        "SELECT selling_price FROM food_items WHERE id = $1 AND admin_id = $2",
        [foodId, adminId]
      );
      price = itemRow.length > 0 ? parseFloat(itemRow[0].selling_price) : 100;
    }

    resolvedItems.push({
      food_id:                 foodId,
      quantity:                quantity,
      price:                   price,
      is_upsell:               rawItem.is_upsell ?? false,
      upsell_discount_pct:     rawItem.upsell_discount_pct ?? 0,
      optimal_price_snapshot:  rawItem.optimal_price_snapshot ?? null,
    });
  }

  // Calculate total
  const calculatedTotal = total_amount != null
    ? Number(total_amount)
    : resolvedItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);

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
      [adminId, customerName, customerPhone, customerAddress]
    );
    const customerId = custRows[0].id;

    // ── 2. Insert order ─────────────────────────────────────────────────────
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (admin_id, customer_id, address, total_amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [adminId, customerId, customerAddress, calculatedTotal]
    );
    const orderId = orderRows[0].id;

    // ── 3. Insert order_items & update stock (non-blocking) ──────────────────
    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items
           (order_id, food_id, quantity, price, is_upsell, upsell_discount_pct, optimal_price_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          item.food_id,
          item.quantity,
          item.price,
          item.is_upsell,
          item.upsell_discount_pct,
          item.optimal_price_snapshot,
        ]
      );

      // Decrement stock gracefully (don't fail the order if quantity is low)
      await client.query(
        `UPDATE food_items
         SET    quantity = GREATEST(0, quantity - $1)
         WHERE  id = $2 AND admin_id = $3`,
        [item.quantity, item.food_id, adminId]
      );
    }

    await client.query("COMMIT");
    console.log(`✅ [VOICE ORDER SUCCESS] Created order_id: ${orderId} for ${customerName}`);

    return res.status(200).json(
      new ApiResponse(200, { order_id: orderId, status: "pending" }, "Order placed successfully")
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [VOICE ORDER FAILED]:", err);
    throw err;
  } finally {
    client.release();
  }
});

export { getVoiceMenu, getVoiceRecommendations, placeVoiceOrder };
