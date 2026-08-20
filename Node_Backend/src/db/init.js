// ─────────────────────────────────────────────────────────────────────────────
// init.js — Creates all tables and (optionally) seeds example rows
// Usage:  npm run db:init
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import pg from "pg";
import { buildMaintenanceConnectionString, buildPostgresConnectionString, getPostgresDatabaseName, shouldUseSsl } from "./connection.js";
import {
  CREATE_UPDATED_AT_FUNCTION,
  CREATE_ADMIN_TABLE,
  CREATE_CATEGORIES_TABLE,
  CREATE_FOOD_ITEMS_TABLE,
  CREATE_CUSTOMERS_TABLE,
  CREATE_ORDERS_TABLE,
  CREATE_ORDER_ITEMS_TABLE,
  CREATE_UPSELL_EVENTS_TABLE,
  CREATE_VOICE_SESSIONS_TABLE,
  CREATE_PRICE_HISTORY_TABLE,
} from "./schema.js";

const { Pool } = pg;

async function ensureTargetDatabaseExists() {
  const targetDatabaseName = getPostgresDatabaseName(process.env.DATABASE_URL);
  const maintenanceConnectionString = buildMaintenanceConnectionString(process.env.DATABASE_URL, "postgres");
  const maintenancePool = new Pool({
    connectionString: maintenanceConnectionString,
    ...(shouldUseSsl() ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    const { rows } = await maintenancePool.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetDatabaseName]);
    if (rows.length === 0) {
      const safeDatabaseName = targetDatabaseName.replace(/"/g, '""');
      await maintenancePool.query(`CREATE DATABASE "${safeDatabaseName}"`);
      console.log(`🧱 Created missing database \"${targetDatabaseName}\"`);
    }
  } finally {
    await maintenancePool.end();
  }
}

const pool = new Pool({
  connectionString: buildPostgresConnectionString(process.env.DATABASE_URL),
  ...(shouldUseSsl() ? { ssl: { rejectUnauthorized: false } } : {}),
});

// ── Table creation steps (ORDER MATTERS — FKs must come after parents) ──────
const steps = [
  { name: "set_updated_at() function", sql: CREATE_UPDATED_AT_FUNCTION },
  { name: "admin",        sql: CREATE_ADMIN_TABLE        },
  { name: "categories",   sql: CREATE_CATEGORIES_TABLE   },
  { name: "food_items",   sql: CREATE_FOOD_ITEMS_TABLE   },
  { name: "customers",    sql: CREATE_CUSTOMERS_TABLE     },
  { name: "orders",       sql: CREATE_ORDERS_TABLE        },
  { name: "order_items",  sql: CREATE_ORDER_ITEMS_TABLE   },
  { name: "upsell_events", sql: CREATE_UPSELL_EVENTS_TABLE },
  { name: "voice_sessions", sql: CREATE_VOICE_SESSIONS_TABLE },
  { name: "price_history", sql: CREATE_PRICE_HISTORY_TABLE },
];

// ── Seed data (skipped if rows already exist) ────────────────────────────────
const SEED_ADMIN = `
  INSERT INTO admin (name, email, password, restaurant_name, phone)
  VALUES ('Super Admin', 'admin@restaurant.com', '$2b$10$placeholderHashReplaceMe', 'Demo Restaurant', '9999999999')
  ON CONFLICT (email) DO NOTHING;
`;

const SEED_CATEGORIES = `
  INSERT INTO categories (admin_id, name, description) 
  SELECT 1, 'Burgers', 'Juicy hand-crafted beef & chicken burgers'
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE admin_id = 1 AND name = 'Burgers')
  UNION ALL
  SELECT 1, 'Drinks', 'Cold beverages and shakes'
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE admin_id = 1 AND name = 'Drinks')
  UNION ALL
  SELECT 1, 'Pizza', 'Stone-baked thin and thick crust pizzas'
  WHERE NOT EXISTS (SELECT 1 FROM categories WHERE admin_id = 1 AND name = 'Pizza');
`;

const SEED_FOOD_ITEMS = `
  INSERT INTO food_items (admin_id, category_id, name, cost_price, selling_price, min_price, max_price, image_url) 
  SELECT 1, c.id, 'Classic Beef Burger', 80.00, 149.00, 129.00, 179.00, NULL
  FROM categories c WHERE c.admin_id = 1 AND c.name = 'Burgers' AND NOT EXISTS (
    SELECT 1 FROM food_items WHERE admin_id = 1 AND name = 'Classic Beef Burger'
  )
  UNION ALL
  SELECT 1, c.id, 'Crispy Chicken Burger', 70.00, 139.00, 119.00, 159.00, NULL
  FROM categories c WHERE c.admin_id = 1 AND c.name = 'Burgers' AND NOT EXISTS (
    SELECT 1 FROM food_items WHERE admin_id = 1 AND name = 'Crispy Chicken Burger'
  )
  UNION ALL
  SELECT 1, c.id, 'Mango Shake', 30.00, 79.00, 69.00, 99.00, NULL
  FROM categories c WHERE c.admin_id = 1 AND c.name = 'Drinks' AND NOT EXISTS (
    SELECT 1 FROM food_items WHERE admin_id = 1 AND name = 'Mango Shake'
  )
  UNION ALL
  SELECT 1, c.id, 'Margherita Pizza (Reg)', 120.00, 249.00, 219.00, 299.00, NULL
  FROM categories c WHERE c.admin_id = 1 AND c.name = 'Pizza' AND NOT EXISTS (
    SELECT 1 FROM food_items WHERE admin_id = 1 AND name = 'Margherita Pizza (Reg)'
  );
`;

const SEED_CUSTOMERS = `
  INSERT INTO customers (admin_id, name, phone, address) 
  SELECT 1, 'Rohan Mehta', '9876543210', '12, Rose Lane, Mumbai'
  WHERE NOT EXISTS (SELECT 1 FROM customers WHERE admin_id = 1 AND phone = '9876543210')
  UNION ALL
  SELECT 1, 'Priya Shah', '9123456789', '45, MG Road, Pune'
  WHERE NOT EXISTS (SELECT 1 FROM customers WHERE admin_id = 1 AND phone = '9123456789');
`;

const seeds = [
  { name: "admin seed",       sql: SEED_ADMIN       },
  { name: "categories seed",  sql: SEED_CATEGORIES  },
  { name: "food_items seed",  sql: SEED_FOOD_ITEMS  },
  { name: "customers seed",   sql: SEED_CUSTOMERS   },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function init() {
  await ensureTargetDatabaseExists();

  const client = await pool.connect();
  console.log("\n🔌 Connected to PostgreSQL\n");

  try {
    await client.query("BEGIN");

    // 1. Create tables
    console.log("📦 Creating tables...");
    for (const step of steps) {
      await client.query(step.sql);
      console.log(`   ✅ ${step.name}`);
    }

    // 2. Seed example rows
    console.log("\n🌱 Seeding example rows...");
    for (const seed of seeds) {
      await client.query(seed.sql);
      console.log(`   ✅ ${seed.name}`);
    }

    await client.query("COMMIT");
    console.log("\n🎉 Database initialised successfully!\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Init failed — rolled back.\n", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
