// ─────────────────────────────────────────────────────────────────────────────
// Gemini Query Engine — generates safe SQL from customer utterances,
// executes against DB, and returns grounded results for Sarvam LLM.
//
// This eliminates LLM hallucination by ensuring all menu data, prices,
// availability, and order context come directly from the database.
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from "../db/index.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// ── DB Schema context for Gemini ─────────────────────────────────────────────
const DB_SCHEMA = `
PostgreSQL Database Schema for Restaurant Ordering System:

-- 1. ADMIN (one row = one restaurant)
CREATE TABLE admin (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100)        NOT NULL,
    email             VARCHAR(150) UNIQUE NOT NULL,
    password          VARCHAR(255)        NOT NULL,
    restaurant_name   VARCHAR(150)        NOT NULL,
    phone             VARCHAR(20)         NOT NULL,
    created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- 2. CATEGORIES
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    admin_id    INT          NOT NULL REFERENCES admin(id),
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. FOOD ITEMS
CREATE TABLE food_items (
    id                   SERIAL PRIMARY KEY,
    admin_id             INT             NOT NULL REFERENCES admin(id),
    category_id          INT             NOT NULL REFERENCES categories(id),
    name                 VARCHAR(150)    NOT NULL,
    cost_price           NUMERIC(10, 2)  NOT NULL,
    selling_price        NUMERIC(10, 2)  NOT NULL,
    min_price            NUMERIC(10, 2)  NOT NULL,
    max_price            NUMERIC(10, 2)  NOT NULL,
    discount_percent     NUMERIC(5, 2)   NOT NULL DEFAULT 0,
    competitor_price_idx NUMERIC(5, 3)   NOT NULL DEFAULT 1.000,
    quantity             INT             NOT NULL DEFAULT 0,
    image_url            TEXT,
    is_available         BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- 4. CUSTOMERS
CREATE TABLE customers (
    id         SERIAL PRIMARY KEY,
    admin_id   INT          NOT NULL REFERENCES admin(id),
    name       VARCHAR(100) NOT NULL,
    phone      VARCHAR(20)  NOT NULL,
    address    TEXT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_phone_per_restaurant UNIQUE (admin_id, phone)
);

-- 5. ORDERS
CREATE TABLE orders (
    id           SERIAL PRIMARY KEY,
    admin_id     INT            NOT NULL REFERENCES admin(id),
    customer_id  INT            NOT NULL REFERENCES customers(id),
    address      TEXT,
    status       VARCHAR(30)    NOT NULL DEFAULT 'pending',
    order_time   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 6. ORDER ITEMS
CREATE TABLE order_items (
    id                     SERIAL PRIMARY KEY,
    order_id               INT            NOT NULL REFERENCES orders(id),
    food_id                INT            NOT NULL REFERENCES food_items(id),
    quantity               INT            NOT NULL CHECK (quantity > 0),
    price                  NUMERIC(10, 2) NOT NULL,
    is_upsell              BOOLEAN        NOT NULL DEFAULT FALSE,
    upsell_discount_pct    NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    optimal_price_snapshot NUMERIC(10, 2),
    remark                 TEXT,
    created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 7. UPSELL EVENTS
CREATE TABLE upsell_events (
    id               SERIAL PRIMARY KEY,
    admin_id         INT           NOT NULL REFERENCES admin(id),
    order_id         INT           NOT NULL REFERENCES orders(id),
    anchor_food_id   INT           NOT NULL REFERENCES food_items(id),
    upsell_food_id   INT           NOT NULL REFERENCES food_items(id),
    synergy_score    NUMERIC(4, 3),
    discount_offered NUMERIC(5, 2) NOT NULL DEFAULT 0,
    accepted         BOOLEAN       NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 8. VOICE SESSIONS
CREATE TABLE voice_sessions (
    id                SERIAL PRIMARY KEY,
    admin_id          INT           NOT NULL REFERENCES admin(id),
    order_id          INT           REFERENCES orders(id),
    raw_transcript    TEXT          NOT NULL,
    parsed_intent     JSONB,
    language_detected VARCHAR(30),
    ambiguous_terms   JSONB,
    converted         BOOLEAN       NOT NULL DEFAULT FALSE,
    duration_secs     INT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 9. PRICE HISTORY
CREATE TABLE price_history (
    id         SERIAL PRIMARY KEY,
    admin_id   INT            NOT NULL REFERENCES admin(id),
    food_id    INT            NOT NULL REFERENCES food_items(id),
    old_price  NUMERIC(10, 2) NOT NULL,
    new_price  NUMERIC(10, 2) NOT NULL,
    reason     TEXT,
    created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
`;

// ── Allowed tables & columns for safety ──────────────────────────────────────
const ALLOWED_TABLES = new Set([
  "food_items", "categories", "orders", "order_items", "customers",
]);

const BLOCKED_PATTERNS = [
  /\b(DROP|ALTER|TRUNCATE|DELETE|INSERT|UPDATE|CREATE|GRANT|REVOKE)\b/i,
  /\b(pg_|information_schema|pg_catalog)\b/i,
  /;\s*\w/,                     // multiple statements
  /--/,                         // SQL comments
  /\/\*/,                       // block comments
  /\bEXEC(UTE)?\b/i,
  /\bINTO\s+OUTFILE\b/i,
  /\bLOAD_FILE\b/i,
  /\bUNION\s+ALL\s+SELECT\b/i, // union injection attempt
];

/**
 * Validate a generated SQL query is safe (read-only SELECT).
 * @param {string} sql
 * @returns {{ safe: boolean, reason?: string }}
 */
function validateSQL(sql) {
  const trimmed = sql.trim();

  // Must start with SELECT or WITH (CTE)
  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    return { safe: false, reason: "Query must be a SELECT statement" };
  }

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Blocked pattern detected: ${pattern}` };
    }
  }

  // Check referenced tables are allowed
  const fromMatches = trimmed.match(/\bFROM\s+(\w+)/gi) || [];
  const joinMatches = trimmed.match(/\bJOIN\s+(\w+)/gi) || [];
  const allTableRefs = [...fromMatches, ...joinMatches]
    .map((m) => m.split(/\s+/).pop().toLowerCase());

  for (const table of allTableRefs) {
    if (!ALLOWED_TABLES.has(table)) {
      return { safe: false, reason: `Table not allowed: ${table}` };
    }
  }

  return { safe: true };
}

/**
 * Ask Gemini to generate a SQL query based on customer intent.
 *
 * @param {string} customerText  - What the customer said
 * @param {string} intent        - Detected intent (ORDER, ENQUIRY, MODIFY, etc.)
 * @param {number} adminId       - The restaurant's admin_id
 * @param {object[]} cart        - Current cart items
 * @returns {Promise<{ sql: string, params: any[], description: string } | null>}
 */
async function generateSQL(customerText, intent, adminId, cart = []) {
  const cartSummary = cart.length > 0
    ? `Current cart: ${cart.map((c) => `${c.name} x${c.qty} (id:${c.foodId})`).join(", ")}`
    : "Cart is empty.";

  const prompt = `You are a SQL query generator for a restaurant ordering system.
Given a customer's spoken request, generate a SINGLE PostgreSQL SELECT query to fetch the relevant data.

${DB_SCHEMA}

CRITICAL RULES:
1. ONLY write SELECT queries — no INSERT, UPDATE, DELETE, DROP, or DDL.
2. ALWAYS filter by admin_id = ${adminId}.
3. Use ILIKE with '%keyword%' for fuzzy name matching.
4. ALWAYS SELECT these exact columns: fi.id AS id, fi.name, fi.selling_price, fi.is_available, fi.discount_percent, c.name AS category_name.
5. ALWAYS alias the food_items table as 'fi' and categories as 'c'. JOIN categories ON c.id = fi.category_id.
6. NEVER select c.id — only c.name AS category_name.
7. If the customer asks about the menu, list available items.
8. If searching for specific items, use ILIKE with individual keywords.
9. Return the query as ONLY raw SQL, no markdown, no backticks, no explanation.
10. LIMIT results to 20 max.

${cartSummary}

Customer said: "${customerText}"
Intent: ${intent}

Generate the SQL query:`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
      },
    });

    let sql = result.response.text().trim();

    // Strip markdown code fences if present
    sql = sql.replace(/```sql\n?/gi, "").replace(/```\n?/g, "").trim();

    // Remove any trailing semicolons (pg driver doesn't need them)
    sql = sql.replace(/;\s*$/, "");

    return { sql, params: [], description: `Query for: ${customerText}` };
  } catch (error) {
    console.error("[GeminiQuery] SQL generation error:", error.message);
    return null;
  }
}

/**
 * Execute a validated SQL query and return results.
 *
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<object[]>}
 */
async function executeQuery(sql, params = []) {
  const validation = validateSQL(sql);
  if (!validation.safe) {
    console.error("[GeminiQuery] Query rejected:", validation.reason, "| SQL:", sql);
    return [];
  }

  try {
    // Set a statement timeout to prevent long-running queries
    const client = await pool.connect();
    try {
      await client.query("SET statement_timeout = '3000'"); // 3 second max
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      await client.query("RESET statement_timeout");
      client.release();
    }
  } catch (error) {
    console.error("[GeminiQuery] Query execution error:", error.message);
    console.error("[GeminiQuery] Failed SQL:", sql);
    return [];
  }
}

/**
 * Main entry: ground customer utterance with real DB data.
 * Returns structured data that Sarvam LLM can use for accurate responses.
 *
 * @param {object} params
 * @param {string} params.customerText  - The spoken utterance
 * @param {string} params.intent        - Detected intent
 * @param {number} params.adminId       - Restaurant admin ID
 * @param {object[]} params.cart        - Current cart
 * @param {object[]} params.menu        - Cached full menu (fallback)
 * @returns {Promise<object>} Grounded context
 */
export async function groundWithDB({ customerText, intent, adminId, cart, menu }) {
  // For simple intents that don't need DB queries
  if (["GREETING", "CONFIRM", "UNCLEAR"].includes(intent)) {
    return {
      queriedItems: [],
      cartSummary: formatCart(cart),
      source: "no-query-needed",
    };
  }

  // Generate SQL from Gemini
  const queryPlan = await generateSQL(customerText, intent, adminId, cart);

  if (!queryPlan) {
    // Fallback: use the cached menu
    console.warn("[GeminiQuery] Falling back to cached menu");
    return {
      queriedItems: menu.filter((m) => m.is_available),
      cartSummary: formatCart(cart),
      source: "cached-menu-fallback",
    };
  }

  console.log("[GeminiQuery] Generated SQL:", queryPlan.sql);

  // Execute the query
  const results = await executeQuery(queryPlan.sql, queryPlan.params);

  console.log(`[GeminiQuery] Got ${results.length} results from DB`);

  return {
    queriedItems: results,
    cartSummary: formatCart(cart),
    generatedSQL: queryPlan.sql,
    source: "gemini-db-query",
  };
}

/**
 * Resolve item names from customer speech to exact DB food_items.
 * Uses Gemini to generate a targeted search query.
 *
 * @param {string[]} itemNames - Item names mentioned by customer
 * @param {number} adminId    - Restaurant admin ID
 * @returns {Promise<object[]>} Matched food_items rows
 */
export async function resolveItemsViaDB(itemNames, adminId) {
  if (!itemNames || itemNames.length === 0) return [];

  // Build search conditions for each item name
  const conditions = itemNames.map((name) => {
    // Split name into keywords for better matching
    const keywords = name.trim().split(/\s+/).filter((w) => w.length > 2);
    if (keywords.length === 0) return null;
    return keywords.map((kw) => `fi.name ILIKE '%${kw.replace(/'/g, "''")}%'`).join(" AND ");
  }).filter(Boolean);

  if (conditions.length === 0) return [];

  const sql = `
    SELECT fi.id, fi.name, fi.selling_price, fi.is_available,
           fi.discount_percent, fi.quantity AS stock,
           c.name AS category_name
    FROM food_items fi
    LEFT JOIN categories c ON c.id = fi.category_id
    WHERE fi.admin_id = ${parseInt(adminId, 10)}
      AND (${conditions.join(" OR ")})
    ORDER BY fi.is_available DESC, fi.name
    LIMIT 20
  `.trim();

  const validation = validateSQL(sql);
  if (!validation.safe) {
    console.error("[GeminiQuery] resolveItemsViaDB query rejected:", validation.reason);
    return [];
  }

  try {
    const result = await pool.query(sql);
    return result.rows;
  } catch (error) {
    console.error("[GeminiQuery] resolveItemsViaDB error:", error.message);
    return [];
  }
}

/**
 * Format cart for context injection.
 */
function formatCart(cart) {
  if (!cart || cart.length === 0) return "Cart is empty.";
  const lines = cart.map(
    (c) => `- ${c.name} x${c.qty} @ ₹${c.price} = ₹${(c.price * c.qty).toFixed(0)}${c.remark ? ` (${c.remark})` : ""}`
  );
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  lines.push(`Total: ₹${total.toFixed(0)}`);
  return lines.join("\n");
}

export default { groundWithDB, resolveItemsViaDB };
