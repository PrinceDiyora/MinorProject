import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db/index.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ─── Safe columns to select (never return password) ──────────────────────────
const SAFE_COLS = "id, name, email, restaurant_name, phone, created_at, updated_at";

// ─── Token helpers ────────────────────────────────────────────────────────────
const generateAccessToken = (admin) =>
  jwt.sign(
    { id: admin.id, email: admin.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "1d" }
  );

const generateRefreshToken = (admin) =>
  jwt.sign(
    { id: admin.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
};

const sanitizeAdmin = (admin) => {
  const { password: _, ...safeAdmin } = admin;
  return safeAdmin;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/login
// Body: { email, password }
// ─────────────────────────────────────────────────────────────────────────────
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Fetch admin by email (include password for bcrypt check)
  const { rows } = await pool.query(
    "SELECT * FROM admin WHERE email = $1 LIMIT 1",
    [email.toLowerCase().trim()]
  );

  const admin = rows[0];
  if (!admin) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Compare password
  const isPasswordValid = await bcrypt.compare(password, admin.password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Generate tokens
  const accessToken  = generateAccessToken(admin);
  const refreshToken = generateRefreshToken(admin);

  // Strip password before sending
  const safeAdmin = sanitizeAdmin(admin);

  return res
    .status(200)
    .cookie("accessToken",  accessToken,  { ...COOKIE_OPTIONS, maxAge: 1 * 24 * 60 * 60 * 1000 })
    .cookie("refreshToken", refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json(new ApiResponse(200, { admin: safeAdmin, accessToken }, "Login successful"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/register
// Body: { name, email, restaurant_name, phone, password }
// Creates the restaurant admin account for first-time setup.
// ─────────────────────────────────────────────────────────────────────────────
const registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, restaurant_name, phone, password } = req.body;

  if (!name || !email || !restaurant_name || !phone || !password) {
    throw new ApiError(400, "name, email, restaurant_name, phone, and password are required");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  const normalizedEmail = email.toLowerCase().trim();

  const { rows: existing } = await pool.query(
    "SELECT id FROM admin WHERE email = $1 LIMIT 1",
    [normalizedEmail]
  );

  if (existing.length > 0) {
    throw new ApiError(409, "Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO admin (name, email, password, restaurant_name, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SAFE_COLS}`,
    [name.trim(), normalizedEmail, hashedPassword, restaurant_name.trim(), phone.trim()]
  );

  return res
    .status(201)
    .json(new ApiResponse(201, sanitizeAdmin({ ...rows[0], password: null }), "Registration successful"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/logout
// Requires: auth middleware (sets req.admin)
// ─────────────────────────────────────────────────────────────────────────────
const logoutAdmin = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .clearCookie("accessToken",  COOKIE_OPTIONS)
    .clearCookie("refreshToken", COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/profile
// Requires: auth middleware (sets req.admin)
// Returns:  id, name, email, restaurant_name, phone, created_at, updated_at
// ─────────────────────────────────────────────────────────────────────────────
const getAdminProfile = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLS} FROM admin WHERE id = $1`,
    [req.admin.id]
  );

  const admin = rows[0];
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, admin, "Profile fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/profile
// Requires: auth middleware
// Body: { name?, email?, restaurant_name?, phone? }
//   — send only the fields you want to change
// ─────────────────────────────────────────────────────────────────────────────
const updateAdminProfile = asyncHandler(async (req, res) => {
  const { name, email, restaurant_name, phone } = req.body;

  if (!name && !email && !restaurant_name && !phone) {
    throw new ApiError(
      400,
      "Provide at least one field to update: name, email, restaurant_name, or phone"
    );
  }

  // Build dynamic SET clause
  const fields = [];
  const values = [];
  let idx = 1;

  if (name) {
    fields.push(`name = $${idx++}`);
    values.push(name.trim());
  }

  if (email) {
    // Guard against duplicate email
    const { rows: existing } = await pool.query(
      "SELECT id FROM admin WHERE email = $1 AND id != $2",
      [email.toLowerCase().trim(), req.admin.id]
    );
    if (existing.length > 0) {
      throw new ApiError(409, "Email is already in use");
    }
    fields.push(`email = $${idx++}`);
    values.push(email.toLowerCase().trim());
  }

  if (restaurant_name) {
    fields.push(`restaurant_name = $${idx++}`);
    values.push(restaurant_name.trim());
  }

  if (phone) {
    fields.push(`phone = $${idx++}`);
    values.push(phone.trim());
  }

  values.push(req.admin.id); // last param — for WHERE

  const { rows } = await pool.query(
    `UPDATE admin
     SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING ${SAFE_COLS}`,
    values
  );

  return res
    .status(200)
    .json(new ApiResponse(200, rows[0], "Profile updated successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/change-password
// Requires: auth middleware
// Body: { currentPassword, newPassword }
// ─────────────────────────────────────────────────────────────────────────────
const changeAdminPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "currentPassword and newPassword are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters");
  }

  // Fetch hashed password only
  const { rows } = await pool.query(
    "SELECT password FROM admin WHERE id = $1",
    [req.admin.id]
  );

  const isCurrentValid = await bcrypt.compare(currentPassword, rows[0].password);
  if (!isCurrentValid) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const hashedNew = await bcrypt.hash(newPassword, 10);

  await pool.query(
    "UPDATE admin SET password = $1 WHERE id = $2",
    [hashedNew, req.admin.id]
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/refresh-token
// Cookie or Body: { refreshToken }
// ─────────────────────────────────────────────────────────────────────────────
const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    throw new ApiError(401, "Refresh token missing");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const { rows } = await pool.query(
    `SELECT ${SAFE_COLS} FROM admin WHERE id = $1`,
    [decoded.id]
  );

  const admin = rows[0];
  if (!admin) {
    throw new ApiError(401, "Admin not found");
  }

  const newAccessToken = generateAccessToken(admin);

  return res
    .status(200)
    .cookie("accessToken", newAccessToken, { ...COOKIE_OPTIONS, maxAge: 1 * 24 * 60 * 60 * 1000 })
    .json(new ApiResponse(200, { accessToken: newAccessToken }, "Access token refreshed"));
});

export {
  loginAdmin,
  registerAdmin,
  logoutAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  refreshAccessToken,
};
