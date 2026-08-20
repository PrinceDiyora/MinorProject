// ─────────────────────────────────────────────────────────────────────────────
// seed-admin-password.js
// Run this ONCE to set a real bcrypt password for the admin.
//
// Usage:  node src/db/seed-admin-password.js <your-password>
// Example: node src/db/seed-admin-password.js MySecret123
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import pg from "pg";
import bcrypt from "bcrypt";
import { buildPostgresConnectionString, shouldUseSsl } from "./connection.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: buildPostgresConnectionString(process.env.DATABASE_URL),
  ...(shouldUseSsl() ? { ssl: { rejectUnauthorized: false } } : {}),
});

const plainPassword = process.argv[2];

if (!plainPassword) {
  console.error("\n❌  Usage: node src/db/seed-admin-password.js <password>\n");
  process.exit(1);
}

if (plainPassword.length < 6) {
  console.error("\n❌  Password must be at least 6 characters.\n");
  process.exit(1);
}

const hashed = await bcrypt.hash(plainPassword, 10);

const { rowCount } = await pool.query(
  "UPDATE admin SET password = $1 WHERE email = 'admin@restaurant.com'",
  [hashed]
);

if (rowCount === 0) {
  console.error("\n❌  Admin row not found. Run npm run db:init first.\n");
} else {
  console.log("\n✅  Admin password updated successfully.\n");
}

await pool.end();
