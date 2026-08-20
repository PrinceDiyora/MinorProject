// ─────────────────────────────────────────────────────────────────────────────
// recommendation.service.js  (v2 — optimized)
//
// "Frequently Bought Together" engine.
//
// CP Algorithm techniques applied (ref: https://cp-algorithms.com/):
//
//  1. SINGLE CTE QUERY — eliminates 2 of 3 original DB round-trips.
//     Qualifying orders, sibling items, and cart-category metadata are all
//     resolved in one SQL pass.
//
//  2. ADMIN_ID SCOPING — every query is scoped to the caller's restaurant via
//     the orders.admin_id foreign key, fixing a cross-restaurant data leak.
//
//  3. WEIGHTED GRAPH EDGE MODEL — co-occurrence scoring inspired by weighted
//     adjacency lists (cp-algorithms.com/graph). Instead of raw count (weight=1
//     per order), each co-occurrence contributes weight = 1 / siblingCount.
//     This down-weights large "catch-all" combo orders that dilute signal,
//     producing a Jaccard-similarity–style relevance score.
//
//  4. MIN-HEAP TOP-N SELECTION — instead of sorting all candidates O(k log k)
//     and slicing, we maintain a min-heap of size N (cp-algorithms.com priority
//     queues / nth-element pattern). Result: O(k log N) time, faster when
//     k >> N (many candidates, small N).
//
//  5. FREQUENCY-ARRAY MEMBERSHIP — cart item lookup uses a plain integer key
//     object (Object.create(null)) — the classic CP frequency-array trick for
//     guaranteed O(1) integer key access with no hash-collision risk.
// ─────────────────────────────────────────────────────────────────────────────

import { pool } from "../db/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_THRESHOLD = 5; // minimum weighted score to qualify
const DEFAULT_TOP_N     = 3; // maximum suggestions to return

// ─────────────────────────────────────────────────────────────────────────────
// MIN-HEAP (Fix 4) — O(k log N) top-N extraction
//
// A classic CP priority-queue pattern: maintain a heap of exactly N items
// keyed by score. When a new item arrives and the heap is full, evict the
// item with the lowest score (the "minimum" of the max we want to keep).
//
// Complexity vs full sort:
//   Full sort → O(k log k)     (current)
//   Min-heap  → O(k log N)     (new) — N is typically 3, k can be thousands
// ─────────────────────────────────────────────────────────────────────────────
class MinHeap {
  constructor(compareFn) {
    this._arr = [];
    this._cmp = compareFn; // returns negative if a < b
  }

  get size() { return this._arr.length; }

  push(item) {
    this._arr.push(item);
    this._bubbleUp(this._arr.length - 1);
  }

  pop() {
    const top  = this._arr[0];
    const last = this._arr.pop();
    if (this._arr.length > 0) {
      this._arr[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek() { return this._arr[0]; }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._cmp(this._arr[i], this._arr[parent]) < 0) {
        [this._arr[i], this._arr[parent]] = [this._arr[parent], this._arr[i]];
        i = parent;
      } else break;
    }
  }

  _sinkDown(i) {
    const n = this._arr.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._cmp(this._arr[l], this._arr[smallest]) < 0) smallest = l;
      if (r < n && this._cmp(this._arr[r], this._arr[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this._arr[i], this._arr[smallest]] = [this._arr[smallest], this._arr[i]];
      i = smallest;
    }
  }

  // Extract all items sorted descending by the inverse comparator
  drainDescending() {
    const result = [];
    while (this._arr.length) result.push(this.pop());
    return result.reverse(); // heap pops smallest first → reverse for DESC
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE CTE QUERY (Fix 1 + Fix 2)
//
// Replaces the original 3 sequential queries (fetchQualifyingOrderIds,
// fetchOrderItemsForOrders, fetchCartMeta) with one CTE query.
//
// Parameters:
//   $1 → cartFoodIds (int[])
//   $2 → cartFoodIds.length (int — used in HAVING)
//   $3 → adminId (int — tenant scope via orders table)
//
// Returns rows: { food_id, name, category_id, same_category, order_item_count }
// where order_item_count = number of non-cart items in that order (for weight)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCoOccurrenceData(cartFoodIds, adminId) {
  const { rows } = await pool.query(
    `
    WITH
    -- Step 1: find orders that contain ALL cart items (tenant-scoped)
    qualifying_orders AS (
      SELECT   oi.order_id
      FROM     order_items oi
      JOIN     orders      o  ON o.id = oi.order_id
      WHERE    oi.food_id = ANY($1::int[])
        AND    o.admin_id = $3
      GROUP BY oi.order_id
      HAVING   COUNT(DISTINCT oi.food_id) = $2
    ),

    -- Step 2: for each qualifying order, count how many non-cart items it has
    --         (used as the denominator for edge weight = 1/siblingCount)
    order_sizes AS (
      SELECT  oi.order_id,
              COUNT(*) FILTER (WHERE oi.food_id != ALL($1::int[])) AS sibling_count
      FROM    order_items oi
      WHERE   oi.order_id IN (SELECT order_id FROM qualifying_orders)
      GROUP BY oi.order_id
    ),

    -- Step 3: cart category ids (for same-category flag)
    cart_cats AS (
      SELECT DISTINCT category_id FROM food_items WHERE id = ANY($1::int[])
    )

    -- Step 4: emit one row per (qualifying order, sibling item) pair
    SELECT  oi.food_id,
            fi.name,
            fi.category_id,
            (fi.category_id IN (SELECT category_id FROM cart_cats)) AS same_category,
            os.sibling_count
    FROM    order_items oi
    JOIN    order_sizes os ON os.order_id = oi.order_id
    JOIN    food_items  fi ON fi.id = oi.food_id
    WHERE   oi.order_id IN (SELECT order_id FROM qualifying_orders)
      AND   oi.food_id  != ALL($1::int[])   -- exclude cart items at DB level
      AND   os.sibling_count > 0
    ORDER BY oi.food_id
    `,
    [cartFoodIds, cartFoodIds.length, adminId]
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTED FREQUENCY MAP (Fix 3 + Fix 5)
//
// Graph edge weight model:
//   For each co-occurrence row, add weight = 1 / sibling_count.
//   Items that appear in small focused orders score higher than items that
//   appear in large "add everything" orders — better recommendation signal.
//
// CP frequency-array pattern (Fix 5):
//   Uses Object.create(null) as an integer-keyed lookup table (O(1), no
//   prototype chain, no hash-collision risk for integer keys).
// ─────────────────────────────────────────────────────────────────────────────
function buildWeightedFreqMap(rows) {
  // freq: food_id → { food_id, name, category_id, same_category, score }
  // Using plain object (null prototype) — CP frequency-array pattern
  const freq = Object.create(null);

  for (const row of rows) {
    const key    = row.food_id;
    const weight = 1 / Number(row.sibling_count); // edge weight

    if (freq[key] === undefined) {
      freq[key] = {
        food_id:       row.food_id,
        name:          row.name,
        category_id:   row.category_id,
        same_category: row.same_category,
        score:         0,
      };
    }
    freq[key].score += weight;
  }

  return freq;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP-N RANKING WITH MIN-HEAP (Fix 4)
//
// Two-phase category partitioning (Feature 3) preserved from v1:
//   preferred = different category → shown first
//   fallback  = same category     → fills remaining slots
//
// Each phase uses the min-heap to extract the top-N without full sort.
// ─────────────────────────────────────────────────────────────────────────────
function topNWithHeap(arr, n) {
  if (arr.length === 0) return [];
  if (arr.length <= n)  return arr.sort((a, b) => b.score - a.score);

  // Min-heap keyed by score (smallest score at root = first to evict)
  const heap = new MinHeap((a, b) => a.score - b.score);

  for (const item of arr) {
    heap.push(item);
    if (heap.size > n) heap.pop(); // evict the weakest
  }

  return heap.drainDescending(); // returns top N, score DESC
}

function rankCandidates(freqObj, threshold, topN) {
  const preferred = [];
  const fallback  = [];

  for (const key in freqObj) {
    const item = freqObj[key];
    if (item.score < threshold) continue; // Feature 4 — minimum score gate

    if (item.same_category) {
      fallback.push(item);
    } else {
      preferred.push(item);
    }
  }

  // Apply min-heap top-N to each partition separately
  const topPreferred = topNWithHeap(preferred, topN);
  const topFallback  = topNWithHeap(fallback,  topN);

  // Merge: preferred fills slots first, fallback takes remainder
  return [...topPreferred, ...topFallback]
    .slice(0, topN)
    .map(({ food_id, name, score }) => ({
      food_id,
      name,
      score: Math.round(score * 1000) / 1000, // 3 decimal places
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
//
// getRecommendations({ cartFoodIds, adminId, threshold, topN })
//
//   cartFoodIds  — array of food_ids in the cart
//   adminId      — ID of the logged-in admin (tenant scope)
//   threshold    — minimum weighted score (default 5, tune per dataset size)
//   topN         — max results (default 3)
//
// Returns: Array<{ food_id, name, score }> sorted by score DESC
// ─────────────────────────────────────────────────────────────────────────────
export async function getRecommendations({
  cartFoodIds,
  adminId,
  threshold = DEFAULT_THRESHOLD,
  topN      = DEFAULT_TOP_N,
}) {
  if (!Array.isArray(cartFoodIds) || cartFoodIds.length === 0) return [];
  if (!adminId) return [];

  // Deduplicate + cast to int (Fix 5 — frequency-array pattern for clean keys)
  const cartIds = [...new Set(cartFoodIds.map(Number))].filter(
    (n) => Number.isInteger(n) && n > 0
  );

  if (cartIds.length === 0) return [];

  // ── Single CTE round-trip (Fixes 1 + 2) ──────────────────────────────────
  const rows = await fetchCoOccurrenceData(cartIds, adminId);
  if (rows.length === 0) return [];

  // ── Weighted frequency map (Fix 3 + 5) ───────────────────────────────────
  const freqObj = buildWeightedFreqMap(rows);

  // ── Min-heap top-N + category partitioning (Fix 4) ───────────────────────
  return rankCandidates(freqObj, threshold, topN);
}
