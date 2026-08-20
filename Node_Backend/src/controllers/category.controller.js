import { pool }        from "../db/index.js";
import { ApiError }    from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/categories
// Returns all categories belonging to the logged-in admin's restaurant
// ─────────────────────────────────────────────────────────────────────────────
const getAllCategories = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, created_at, updated_at
     FROM   categories
     WHERE  admin_id = $1
     ORDER  BY name ASC`,
    [req.admin.id]
  );

  return res
    .status(200)
    .json(new ApiResponse(200, rows, "Categories fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/categories/:id
// ─────────────────────────────────────────────────────────────────────────────
const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT id, name, description, created_at, updated_at
     FROM   categories
     WHERE  id = $1 AND admin_id = $2`,
    [id, req.admin.id]
  );

  if (!rows[0]) throw new ApiError(404, "Category not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], "Category fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/categories
// Body: { name, description? }
// ─────────────────────────────────────────────────────────────────────────────
const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name?.trim()) throw new ApiError(400, "Category name is required");

  const { rows } = await pool.query(
    `INSERT INTO categories (admin_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, created_at, updated_at`,
    [req.admin.id, name.trim(), description?.trim() || null]
  );

  return res
    .status(201)
    .json(new ApiResponse(201, rows[0], "Category created successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/categories/:id
// Body: { name?, description? }
// ─────────────────────────────────────────────────────────────────────────────
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name && description === undefined) {
    throw new ApiError(400, "Provide at least one field to update: name or description");
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (name)                  { fields.push(`name = $${idx++}`);        values.push(name.trim()); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description?.trim() || null); }

  values.push(id, req.admin.id);

  const { rows } = await pool.query(
    `UPDATE categories
     SET    ${fields.join(", ")}
     WHERE  id = $${idx++} AND admin_id = $${idx}
     RETURNING id, name, description, created_at, updated_at`,
    values
  );

  if (!rows[0]) throw new ApiError(404, "Category not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], "Category updated successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/categories/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rowCount } = await pool.query(
    "DELETE FROM categories WHERE id = $1 AND admin_id = $2",
    [id, req.admin.id]
  );

  if (rowCount === 0) throw new ApiError(404, "Category not found");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Category deleted successfully"));
});

export {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
