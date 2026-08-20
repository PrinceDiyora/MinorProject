// ─────────────────────────────────────────────────────────────────────────────
// migrate.js — Incremental, idempotent migrations
//
// v1.1: food_items ← discount_percent | order_items ← remark
// v1.2: ALL tables ← updated_at + set_updated_at() trigger
// v2.0: Multi-restaurant + new columns + new tables
// v2.1: admin ← restaurant_name, phone | orders → DROP channel
//
// Usage:  npm run db:migrate
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import pg from "pg";
import { buildPostgresConnectionString, shouldUseSsl } from "./connection.js";
const { Pool } = pg;

const pool = new Pool({
  connectionString: buildPostgresConnectionString(process.env.DATABASE_URL),
  ...(shouldUseSsl() ? { ssl: { rejectUnauthorized: false } } : {}),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Idempotent ADD COLUMN */
const addColumn = (table, column, definition) => ({
  name: `${table} ← ${column}`,
  sql: `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '${table}' AND column_name = '${column}'
      ) THEN
        ALTER TABLE ${table} ADD COLUMN ${column} ${definition};
        RAISE NOTICE 'Added ${column} to ${table}.';
      ELSE
        RAISE NOTICE '${column} already exists on ${table} — skipped.';
      END IF;
    END $$;
  `,
});

/**
 * Idempotent admin_id FK column.
 * Special handling because:
 *   1. Existing rows need to be backfilled to admin_id = 1
 *   2. Column must be NOT NULL, but can't be NOT NULL on ADD if rows exist
 *   3. Drop the DEFAULT after backfill so future inserts must be explicit
 */
const addAdminIdColumn = (table) => ({
  name: `${table} ← admin_id (tenant key)`,
  sql: `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = '${table}' AND column_name = 'admin_id'
      ) THEN
        -- Step 1: add as nullable with DEFAULT 1 (backfills existing rows)
        ALTER TABLE ${table} ADD COLUMN admin_id INT DEFAULT 1;

        -- Step 2: backfill any NULLs just in case
        UPDATE ${table} SET admin_id = 1 WHERE admin_id IS NULL;

        -- Step 3: enforce NOT NULL
        ALTER TABLE ${table} ALTER COLUMN admin_id SET NOT NULL;

        -- Step 4: drop the DEFAULT so new inserts must provide admin_id
        ALTER TABLE ${table} ALTER COLUMN admin_id DROP DEFAULT;

        -- Step 5: add FK constraint
        ALTER TABLE ${table}
          ADD CONSTRAINT fk_${table}_admin
          FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE CASCADE;

        RAISE NOTICE 'admin_id added to ${table}.';
      ELSE
        RAISE NOTICE 'admin_id already exists on ${table} — skipped.';
      END IF;
    END $$;
  `,
});

/** Idempotent ADD CHECK CONSTRAINT */
const addCheck = (table, name, condition) => ({
  name: `${table} ← CHECK ${name}`,
  sql: `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '${name}' AND conrelid = '${table}'::regclass
      ) THEN
        ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${condition});
        RAISE NOTICE 'Constraint ${name} added to ${table}.';
      ELSE
        RAISE NOTICE 'Constraint ${name} already exists — skipped.';
      END IF;
    END $$;
  `,
});

/** Idempotent DROP CONSTRAINT (used before re-adding changed unique constraints) */
const dropConstraint = (table, name) => ({
  name: `${table} ← DROP ${name}`,
  sql: `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '${name}' AND conrelid = '${table}'::regclass
      ) THEN
        ALTER TABLE ${table} DROP CONSTRAINT ${name};
        RAISE NOTICE 'Constraint ${name} dropped from ${table}.';
      ELSE
        RAISE NOTICE 'Constraint ${name} not found — skipped.';
      END IF;
    END $$;
  `,
});

/** Idempotent ADD UNIQUE CONSTRAINT */
const addUnique = (table, name, columns) => ({
  name: `${table} ← UNIQUE ${name}`,
  sql: `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = '${name}' AND conrelid = '${table}'::regclass
      ) THEN
        ALTER TABLE ${table} ADD CONSTRAINT ${name} UNIQUE (${columns});
        RAISE NOTICE 'Unique constraint ${name} added to ${table}.';
      ELSE
        RAISE NOTICE 'Unique constraint ${name} already exists — skipped.';
      END IF;
    END $$;
  `,
});

/** Idempotent CREATE TABLE */
const createTable = (name, sql) => ({
  name: `CREATE TABLE ${name}`,
  sql: `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '${name}'
      ) THEN
        ${sql}
        RAISE NOTICE 'Table ${name} created.';
      ELSE
        RAISE NOTICE 'Table ${name} already exists — skipped.';
      END IF;
    END $$;
  `,
});

/** Idempotent BEFORE UPDATE trigger */
const addTrigger = (table) => ({
  name: `trigger → ${table}`,
  sql: `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_${table}_updated_at'
      ) THEN
        CREATE TRIGGER trg_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        RAISE NOTICE 'Trigger created on ${table}.';
      ELSE
        RAISE NOTICE 'Trigger already exists on ${table} — skipped.';
      END IF;
    END $$;
  `,
});

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATIONS LIST
// ─────────────────────────────────────────────────────────────────────────────
const EXISTING_TABLES = ["admin", "categories", "food_items", "customers", "orders", "order_items"];
const NEW_TABLES      = ["upsell_events", "voice_sessions", "price_history"];

const migrations = [

  // ── v1.1 ───────────────────────────────────────────────────────────────────
  addColumn("food_items", "discount_percent",
    "NUMERIC(5, 2) NOT NULL DEFAULT 0 CONSTRAINT chk_discount_range CHECK (discount_percent >= 0 AND discount_percent <= 100)"
  ),
  addColumn("order_items", "remark", "TEXT"),

  // ── v1.2 ─ trigger function + updated_at + triggers ───────────────────────
  {
    name: "function → set_updated_at()",
    sql: `
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `,
  },
  ...EXISTING_TABLES.map((t) => addColumn(t, "updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()")),
  ...EXISTING_TABLES.map(addTrigger),

  // ────────────────────────────────────────────────────────────────────────────
  // v2.0 — Multi-restaurant (admin_id tenant key)
  // ────────────────────────────────────────────────────────────────────────────

  // admin_id on existing tenant tables (backfills existing rows → admin_id = 1)
  addAdminIdColumn("categories"),
  addAdminIdColumn("food_items"),
  addAdminIdColumn("customers"),
  addAdminIdColumn("orders"),

  // customers.phone was globally unique — relax it, then add per-restaurant unique
  dropConstraint("customers", "customers_phone_key"),
  addUnique("customers", "uq_customer_phone_per_restaurant", "admin_id, phone"),

  // ── v2.0 — New columns on food_items ──────────────────────────────────────
  addColumn("food_items", "competitor_price_idx",
    "NUMERIC(5, 3) NOT NULL DEFAULT 1.000"
  ),
  addColumn("food_items", "quantity", "INT NOT NULL DEFAULT 0"),
  addCheck("food_items", "chk_min_above_cost",   "min_price >= cost_price * 1.20"),
  addCheck("food_items", "chk_competitor_idx",   "competitor_price_idx > 0"),
  addCheck("food_items", "chk_quantity",          "quantity >= 0"),

  // ── v2.0 — New columns on orders ──────────────────────────────────────────
  addColumn("orders", "channel",
    "VARCHAR(20) NOT NULL DEFAULT 'dine-in'"
  ),
  addCheck("orders", "chk_order_channel",  "channel IN ('dine-in','takeaway','delivery')"),
  addCheck("orders", "chk_delivery_addr",  "channel != 'delivery' OR address IS NOT NULL"),

  // ── v2.0 — New columns on order_items ─────────────────────────────────────
  addColumn("order_items", "is_upsell",              "BOOLEAN NOT NULL DEFAULT FALSE"),
  addColumn("order_items", "upsell_discount_pct",    "NUMERIC(5, 2) NOT NULL DEFAULT 0"),
  addColumn("order_items", "optimal_price_snapshot", "NUMERIC(10, 2)"),
  addCheck("order_items",  "chk_upsell_discount",    "upsell_discount_pct >= 0 AND upsell_discount_pct <= 15"),

  // ── v2.0 — Create new tables ───────────────────────────────────────────────
  createTable("upsell_events", `
    CREATE TABLE upsell_events (
      id               SERIAL PRIMARY KEY,
      admin_id         INT           NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
      order_id         INT           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      anchor_food_id   INT           NOT NULL REFERENCES food_items(id),
      upsell_food_id   INT           NOT NULL REFERENCES food_items(id),
      synergy_score    NUMERIC(4, 3),
      discount_offered NUMERIC(5, 2) NOT NULL DEFAULT 0,
      accepted         BOOLEAN       NOT NULL,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_upsell_discount_range CHECK (discount_offered >= 0 AND discount_offered <= 15),
      CONSTRAINT chk_anchor_ne_upsell      CHECK (anchor_food_id != upsell_food_id)
    );
  `),

  createTable("voice_sessions", `
    CREATE TABLE voice_sessions (
      id                SERIAL PRIMARY KEY,
      admin_id          INT           NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
      order_id          INT           REFERENCES orders(id) ON DELETE SET NULL,
      raw_transcript    TEXT          NOT NULL,
      parsed_intent     JSONB,
      language_detected VARCHAR(30),
      ambiguous_terms   JSONB,
      converted         BOOLEAN       NOT NULL DEFAULT FALSE,
      duration_secs     INT,
      created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `),

  createTable("price_history", `
    CREATE TABLE price_history (
      id         SERIAL PRIMARY KEY,
      admin_id   INT            NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
      food_id    INT            NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
      old_price  NUMERIC(10, 2) NOT NULL,
      new_price  NUMERIC(10, 2) NOT NULL,
      reason     TEXT,
      created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    );
  `),

  // updated_at + triggers on new tables
  ...NEW_TABLES.map(addTrigger),

  // ── v2.1 — admin ← restaurant_name, phone ──────────────────────────────────
  addColumn("admin", "restaurant_name", "VARCHAR(150) NOT NULL DEFAULT ''"),
  addColumn("admin", "phone",           "VARCHAR(20)  NOT NULL DEFAULT ''"),

  // ── v2.1 — orders → DROP channel (+ its two dependent constraints) ──────────
  dropConstraint("orders", "chk_order_channel"),
  dropConstraint("orders", "chk_delivery_addr"),
  {
    name: "orders → DROP COLUMN channel",
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'channel'
        ) THEN
          ALTER TABLE orders DROP COLUMN channel;
          RAISE NOTICE 'Column channel dropped from orders.';
        ELSE
          RAISE NOTICE 'Column channel not found — skipped.';
        END IF;
      END $$;
    `,
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log("\n🔌 Connecting to PostgreSQL...\n");
  console.log("🛠️  Running migrations...\n");

  for (const m of migrations) {
    try {
      await pool.query(m.sql);
      console.log(`   ✅ ${m.name}`);
    } catch (err) {
      console.error(`   ❌ Failed: ${m.name}\n`, err.message);
      await pool.end();
      process.exit(1);
    }
  }

  console.log("\n🎉 All migrations complete!\n");
  await pool.end();
}

migrate();
