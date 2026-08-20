import { pool }        from "../db/index.js";
import { ApiError }    from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers
// Query params: ?search=<name or phone>
// ─────────────────────────────────────────────────────────────────────────────
const getAllCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;

  let query  = `SELECT id, name, phone, address, created_at, updated_at
                FROM   customers
                WHERE  admin_id = $1`;
  const values = [req.admin.id];

  if (search?.trim()) {
    values.push(`%${search.trim()}%`);
    query += ` AND (name ILIKE $2 OR phone ILIKE $2)`;
  }

  query += " ORDER BY name ASC";

  const { rows } = await pool.query(query, values);

  return res
    .status(200)
    .json(new ApiResponse(200, rows, "Customers fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
const getCustomerById = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, phone, address, created_at, updated_at
     FROM   customers
     WHERE  id = $1 AND admin_id = $2`,
    [req.params.id, req.admin.id]
  );

  if (!rows[0]) throw new ApiError(404, "Customer not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], "Customer fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/customers
// Body: { name, phone, address? }
// ─────────────────────────────────────────────────────────────────────────────
const createCustomer = asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;

  if (!name?.trim() || !phone?.trim()) {
    throw new ApiError(400, "name and phone are required");
  }

  // phone unique per restaurant (DB enforces uq_customer_phone_per_restaurant)
  const { rows } = await pool.query(
    `INSERT INTO customers (admin_id, name, phone, address)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, phone, address, created_at, updated_at`,
    [req.admin.id, name.trim(), phone.trim(), address?.trim() || null]
  ).catch((err) => {
    if (err.code === "23505") throw new ApiError(409, "A customer with this phone number already exists");
    throw err;
  });

  return res
    .status(201)
    .json(new ApiResponse(201, rows[0], "Customer created successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/customers/:id
// Body: { name?, phone?, address? }
// ─────────────────────────────────────────────────────────────────────────────
const updateCustomer = asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;

  if (!name && !phone && address === undefined) {
    throw new ApiError(400, "Provide at least one field to update");
  }

  const fields = [];
  const values = [];
  let   idx    = 1;

  if (name)              { fields.push(`name = $${idx++}`);    values.push(name.trim()); }
  if (phone)             { fields.push(`phone = $${idx++}`);   values.push(phone.trim()); }
  if (address !== undefined) { fields.push(`address = $${idx++}`); values.push(address?.trim() || null); }

  values.push(req.params.id, req.admin.id);

  const { rows } = await pool.query(
    `UPDATE customers
     SET    ${fields.join(", ")}
     WHERE  id = $${idx++} AND admin_id = $${idx}
     RETURNING id, name, phone, address, created_at, updated_at`,
    values
  ).catch((err) => {
    if (err.code === "23505") throw new ApiError(409, "A customer with this phone number already exists");
    throw err;
  });

  if (!rows[0]) throw new ApiError(404, "Customer not found");

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], "Customer updated successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/customers/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteCustomer = asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM customers WHERE id = $1 AND admin_id = $2",
    [req.params.id, req.admin.id]
  );

  if (rowCount === 0) throw new ApiError(404, "Customer not found");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Customer deleted successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/customers/:id/orders
// Order history for a customer
// ─────────────────────────────────────────────────────────────────────────────
const getCustomerOrders = asyncHandler(async (req, res) => {
  // Verify customer belongs to this admin
  const { rows: custRows } = await pool.query(
    "SELECT id FROM customers WHERE id = $1 AND admin_id = $2",
    [req.params.id, req.admin.id]
  );
  if (!custRows[0]) throw new ApiError(404, "Customer not found");

  const { rows } = await pool.query(
    `SELECT id, status, address, order_time, total_amount, created_at, updated_at
     FROM   orders
     WHERE  customer_id = $1 AND admin_id = $2
     ORDER  BY order_time DESC`,
    [req.params.id, req.admin.id]
  );

  return res
    .status(200)
    .json(new ApiResponse(200, rows, "Customer orders fetched successfully"));
});

export {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerOrders,
};
