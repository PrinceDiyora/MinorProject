import jwt from "jsonwebtoken";
import { pool } from "../db/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Verifies the JWT access token from cookie or Authorization header.
// Attaches req.admin = { id, email } on success.
const verifyAdminJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized — no token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const { rows } = await pool.query(
    "SELECT id, name, email FROM admin WHERE id = $1",
    [decoded.id]
  );

  if (!rows[0]) {
    throw new ApiError(401, "Admin not found");
  }

  req.admin = rows[0];
  next();
});

export { verifyAdminJWT };
