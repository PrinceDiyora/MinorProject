// ─────────────────────────────────────────────────────────────────────────────
// Order Parser — resolve LLM item names to DB food_items
// v2: Prefers exact/near-exact DB matches, falls back to Fuse.js fuzzy.
//     Tighter threshold to prevent false matches.
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from "fuse.js";

const FUZZY_THRESHOLD = 0.35; // tighter than before (was 0.4)

/**
 * Build a Fuse.js index from food_items rows.
 */
function buildFuseIndex(menuItems) {
  return new Fuse(menuItems, {
    keys: ["name"],
    threshold: FUZZY_THRESHOLD,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}

/**
 * Try an exact case-insensitive match first.
 *
 * @param {string} name
 * @param {object[]} menuItems
 * @returns {object|null}
 */
function exactMatch(name, menuItems) {
  const lower = name.toLowerCase().trim();
  return menuItems.find((m) => m.name.toLowerCase().trim() === lower) || null;
}

/**
 * Resolve LLM-returned item names to actual food_items from the DB.
 * Strategy: exact match first → Fuse.js fuzzy fallback.
 *
 * @param {object[]} llmItems  - items from LLM response: [{ name, qty, remark }]
 * @param {object[]} menuItems - food_items rows (from DB query or cached menu)
 * @returns {{ matched: object[], unmatched: string[] }}
 */
export function resolveItems(llmItems, menuItems) {
  if (!llmItems || llmItems.length === 0) {
    return { matched: [], unmatched: [] };
  }

  const fuse = buildFuseIndex(menuItems);
  const matched = [];
  const unmatched = [];
  const usedIds = new Set(); // prevent duplicate matches

  for (const item of llmItems) {
    if (!item.name) {
      unmatched.push("(unnamed item)");
      continue;
    }

    // 1. Try exact match
    let dbItem = exactMatch(item.name, menuItems);

    // 2. Fallback to fuzzy match
    if (!dbItem) {
      const results = fuse.search(item.name);
      if (results.length > 0 && results[0].score <= FUZZY_THRESHOLD) {
        dbItem = results[0].item;
      }
    }

    if (!dbItem) {
      unmatched.push(item.name);
      continue;
    }

    // Check availability
    if (!dbItem.is_available) {
      unmatched.push(`${item.name} (unavailable)`);
      continue;
    }

    // Prevent duplicate foodIds in the same resolution batch
    const resolvedIdCheck = dbItem.id || dbItem.food_id || dbItem.food_item_id;
    if (usedIds.has(resolvedIdCheck)) {
      // Merge qty into existing match
      const existing = matched.find((m) => m.foodId === resolvedIdCheck);
      if (existing) existing.qty += (item.qty || 1);
      continue;
    }

    // Support multiple possible id column names from DB queries
    const resolvedId = dbItem.id || dbItem.food_id || dbItem.food_item_id;
    if (!resolvedId) {
      console.warn(`[OrderParser] DB item has no id field — skipping:`, Object.keys(dbItem));
      unmatched.push(item.name);
      continue;
    }

    usedIds.add(resolvedId);

    // Validate quantity
    const qty = Math.max(1, Math.min(item.qty || 1, 50)); // clamp 1-50

    matched.push({
      foodId: resolvedId,
      name: dbItem.name,
      qty,
      price: parseFloat(dbItem.selling_price || dbItem.price || 0),
      remark: item.remark || null,
      isUpsell: false,
    });
  }

  return { matched, unmatched };
}

export default { resolveItems };
