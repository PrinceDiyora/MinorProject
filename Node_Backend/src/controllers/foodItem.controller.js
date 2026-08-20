import { pool }        from "../db/index.js";
import { ApiError }    from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const FOOD_COLS = `
  fi.id, fi.admin_id, fi.category_id, c.name AS category_name,
  fi.name, fi.cost_price, fi.selling_price, fi.min_price, fi.max_price,
  fi.discount_percent, fi.competitor_price_idx, fi.quantity,
  fi.image_url, fi.is_available, fi.created_at, fi.updated_at
`;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/food-items
// Query params: ?category_id=&available=true
// ─────────────────────────────────────────────────────────────────────────────
const getAllFoodItems = asyncHandler(async (req, res) => {
  const { category_id, available } = req.query;

  const conditions = ["fi.admin_id = $1"];
  const values     = [req.admin.id];
  let   idx        = 2;

  if (category_id) { conditions.push(`fi.category_id = $${idx++}`); values.push(category_id); }
  if (available !== undefined) {
    conditions.push(`fi.is_available = $${idx++}`);
    values.push(available === "true");
  }

  const { rows } = await pool.query(
    `SELECT ${FOOD_COLS}
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     WHERE  ${conditions.join(" AND ")}
     ORDER  BY c.name, fi.name`,
    values
  );

  return res
    .status(200)
    .json(new ApiResponse(200, rows, "Food items fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/food-items/:id
// ─────────────────────────────────────────────────────────────────────────────
const getFoodItemById = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${FOOD_COLS}
     FROM   food_items fi
     JOIN   categories c ON c.id = fi.category_id
     WHERE  fi.id = $1 AND fi.admin_id = $2`,
    [req.params.id, req.admin.id]
  );

  if (!rows[0]) throw new ApiError(404, "Food item not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], "Food item fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/food-items
// Body: { category_id, name, cost_price, selling_price, min_price, max_price,
//         discount_percent?, competitor_price_idx?, quantity?, image_url?,
//         is_available? }
// ─────────────────────────────────────────────────────────────────────────────
const createFoodItem = asyncHandler(async (req, res) => {
  const {
    category_id, name, cost_price, selling_price,
    min_price, max_price,
    discount_percent    = 0,
    competitor_price_idx = 1.000,
    quantity             = 0,
    image_url            = null,
    is_available         = true,
  } = req.body;

  if (!category_id || !name?.trim() || !cost_price || !selling_price || !min_price || !max_price) {
    throw new ApiError(400, "category_id, name, cost_price, selling_price, min_price, max_price are required");
  }

  // Ensure category belongs to this admin
  const { rows: catRows } = await pool.query(
    "SELECT id FROM categories WHERE id = $1 AND admin_id = $2",
    [category_id, req.admin.id]
  );
  if (!catRows[0]) throw new ApiError(404, "Category not found");

  const { rows } = await pool.query(
    `INSERT INTO food_items
       (admin_id, category_id, name, cost_price, selling_price,
        min_price, max_price, discount_percent, competitor_price_idx,
        quantity, image_url, is_available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      req.admin.id, category_id, name.trim(),
      cost_price, selling_price, min_price, max_price,
      discount_percent, competitor_price_idx,
      quantity, image_url, is_available,
    ]
  );

  return res
    .status(201)
    .json(new ApiResponse(201, rows[0], "Food item created successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/food-items/:id
// Body: any subset of food_item fields
// ─────────────────────────────────────────────────────────────────────────────
const updateFoodItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const allowed = [
    "category_id", "name", "cost_price", "selling_price",
    "min_price", "max_price", "discount_percent",
    "competitor_price_idx", "quantity", "image_url", "is_available",
  ];

  const fields = [];
  const values = [];
  let   idx    = 1;

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(key === "name" ? req.body[key].trim() : req.body[key]);
    }
  }

  if (fields.length === 0) {
    throw new ApiError(400, "Provide at least one field to update");
  }

  // If category_id is changing, make sure it belongs to this admin
  if (req.body.category_id) {
    const { rows: catRows } = await pool.query(
      "SELECT id FROM categories WHERE id = $1 AND admin_id = $2",
      [req.body.category_id, req.admin.id]
    );
    if (!catRows[0]) throw new ApiError(404, "Category not found");
  }

  values.push(id, req.admin.id);

  const { rows } = await pool.query(
    `UPDATE food_items
     SET    ${fields.join(", ")}
     WHERE  id = $${idx++} AND admin_id = $${idx}
     RETURNING *`,
    values
  );

  if (!rows[0]) throw new ApiError(404, "Food item not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], "Food item updated successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/food-items/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteFoodItem = asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM food_items WHERE id = $1 AND admin_id = $2",
    [req.params.id, req.admin.id]
  );

  if (rowCount === 0) throw new ApiError(404, "Food item not found");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Food item deleted successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/food-items/:id/toggle-availability
// Flips is_available without touching anything else
// ─────────────────────────────────────────────────────────────────────────────
const toggleAvailability = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE food_items
     SET    is_available = NOT is_available
     WHERE  id = $1 AND admin_id = $2
     RETURNING id, name, is_available`,
    [req.params.id, req.admin.id]
  );

  if (!rows[0]) throw new ApiError(404, "Food item not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], `Item is now ${rows[0].is_available ? "available" : "unavailable"}`));
});

export {
  getAllFoodItems,
  getFoodItemById,
  createFoodItem,
  updateFoodItem,
  deleteFoodItem,
  toggleAvailability,
};
