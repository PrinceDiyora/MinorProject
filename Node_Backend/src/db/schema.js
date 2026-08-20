// ─────────────────────────────────────────────────────────────────────────────
// schema.js — DDL for all tables in the Restaurant Ordering System
// Run once via:  npm run db:init  (fresh installs only)
//
// v1.1 — discount_percent (food_items), remark (order_items)
// v1.2 — updated_at on every table + auto-update trigger
// v2.0 — multi-restaurant (admin_id tenant key on all tables)
//         food_items  → quantity, competitor_price_idx, chk_min_above_cost
//         orders      → channel (dine-in / takeaway / delivery)
//         order_items → is_upsell, upsell_discount_pct, optimal_price_snapshot
//         NEW: upsell_events, voice_sessions, price_history
// v2.1 — admin → restaurant_name, phone | orders → removed channel
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared trigger function ───────────────────────────────────────────────────
export const CREATE_UPDATED_AT_FUNCTION = `
  CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

// Helper — BEFORE UPDATE trigger for a table
const updatedAtTrigger = (table) => `
  DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table};
  CREATE TRIGGER trg_${table}_updated_at
    BEFORE UPDATE ON ${table}
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADMIN  (one row = one restaurant)
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_ADMIN_TABLE = `
  CREATE TABLE IF NOT EXISTS admin (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100)        NOT NULL,
    email             VARCHAR(150) UNIQUE NOT NULL,
    password          VARCHAR(255)        NOT NULL,
    restaurant_name   VARCHAR(150)        NOT NULL,
    phone             VARCHAR(20)         NOT NULL,
    created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
  );
  ${updatedAtTrigger("admin")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_CATEGORIES_TABLE = `
  CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    admin_id    INT          NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );
  ${updatedAtTrigger("categories")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3. FOOD ITEMS
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_FOOD_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS food_items (
    id                   SERIAL PRIMARY KEY,
    admin_id             INT             NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    category_id          INT             NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name                 VARCHAR(150)    NOT NULL,
    cost_price           NUMERIC(10, 2)  NOT NULL,
    selling_price        NUMERIC(10, 2)  NOT NULL,
    min_price            NUMERIC(10, 2)  NOT NULL,    -- Engine 1 lower clamp bound
    max_price            NUMERIC(10, 2)  NOT NULL,    -- Engine 1 upper clamp bound
    discount_percent     NUMERIC(5, 2)   NOT NULL DEFAULT 0,
    competitor_price_idx NUMERIC(5, 3)   NOT NULL DEFAULT 1.000, -- 1.0 = same as competitor
    quantity             INT             NOT NULL DEFAULT 0,      -- stock / available units
    image_url            TEXT,
    is_available         BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_price_range       CHECK (min_price <= selling_price AND selling_price <= max_price),
    CONSTRAINT chk_min_above_cost    CHECK (min_price >= cost_price * 1.20),  -- ≥20% margin floor
    CONSTRAINT chk_positive_cost     CHECK (cost_price > 0),
    CONSTRAINT chk_discount_range    CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT chk_competitor_idx    CHECK (competitor_price_idx > 0),
    CONSTRAINT chk_quantity          CHECK (quantity >= 0)
  );
  ${updatedAtTrigger("food_items")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 4. CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_CUSTOMERS_TABLE = `
  CREATE TABLE IF NOT EXISTS customers (
    id         SERIAL PRIMARY KEY,
    admin_id   INT          NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    phone      VARCHAR(20)  NOT NULL,
    address    TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customer_phone_per_restaurant UNIQUE (admin_id, phone)
  );
  ${updatedAtTrigger("customers")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 5. ORDERS
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_ORDERS_TABLE = `
  CREATE TABLE IF NOT EXISTS orders (
    id           SERIAL PRIMARY KEY,
    admin_id     INT            NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    customer_id  INT            NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    address      TEXT,
    status       VARCHAR(30)    NOT NULL DEFAULT 'pending',
    order_time   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_order_status CHECK (status IN ('pending','preparing','ready','delivered','cancelled'))
  );
  ${updatedAtTrigger("orders")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 6. ORDER ITEMS
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_ORDER_ITEMS_TABLE = `
  CREATE TABLE IF NOT EXISTS order_items (
    id                     SERIAL PRIMARY KEY,
    order_id               INT            NOT NULL REFERENCES orders(id)     ON DELETE CASCADE,
    food_id                INT            NOT NULL REFERENCES food_items(id) ON DELETE RESTRICT,
    quantity               INT            NOT NULL CHECK (quantity > 0),
    price                  NUMERIC(10, 2) NOT NULL,   -- final charged price (after any discount)
    is_upsell              BOOLEAN        NOT NULL DEFAULT FALSE,
    upsell_discount_pct    NUMERIC(5, 2)  NOT NULL DEFAULT 0,   -- ML-driven dynamic discount
    optimal_price_snapshot NUMERIC(10, 2),                      -- Engine 1 prediction at order time
    remark                 TEXT,
    created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_upsell_discount CHECK (upsell_discount_pct >= 0 AND upsell_discount_pct <= 15)
  );
  ${updatedAtTrigger("order_items")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 7. UPSELL EVENTS  (retraining feed for Engine 2)
// Logs every upsell offer made — accepted or rejected.
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_UPSELL_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS upsell_events (
    id               SERIAL PRIMARY KEY,
    admin_id         INT           NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    order_id         INT           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    anchor_food_id   INT           NOT NULL REFERENCES food_items(id),
    upsell_food_id   INT           NOT NULL REFERENCES food_items(id),
    synergy_score    NUMERIC(4, 3),               -- Engine 2 predicted score at offer time
    discount_offered NUMERIC(5, 2) NOT NULL DEFAULT 0,
    accepted         BOOLEAN       NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_upsell_discount_range CHECK (discount_offered >= 0 AND discount_offered <= 15),
    CONSTRAINT chk_anchor_ne_upsell      CHECK (anchor_food_id != upsell_food_id)
  );
  ${updatedAtTrigger("upsell_events")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 8. VOICE SESSIONS  (STT + intent log for Module 02 auditing)
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_VOICE_SESSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS voice_sessions (
    id                SERIAL PRIMARY KEY,
    admin_id          INT           NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    order_id          INT           REFERENCES orders(id) ON DELETE SET NULL,  -- NULL if call didn't convert
    raw_transcript    TEXT          NOT NULL,
    parsed_intent     JSONB,                    -- [{item, qty, remark, confidence}]
    language_detected VARCHAR(30),              -- english | hindi | hinglish | regional
    ambiguous_terms   JSONB,                    -- terms needing clarification
    converted         BOOLEAN       NOT NULL DEFAULT FALSE,
    duration_secs     INT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );
  ${updatedAtTrigger("voice_sessions")}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 9. PRICE HISTORY  (audit trail for Engine 1 dynamic pricing changes)
// ─────────────────────────────────────────────────────────────────────────────
export const CREATE_PRICE_HISTORY_TABLE = `
  CREATE TABLE IF NOT EXISTS price_history (
    id         SERIAL PRIMARY KEY,
    admin_id   INT            NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
    food_id    INT            NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    old_price  NUMERIC(10, 2) NOT NULL,
    new_price  NUMERIC(10, 2) NOT NULL,
    reason     TEXT,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
  );
  ${updatedAtTrigger("price_history")}
`;
