// ─────────────────────────────────────────────────────────────────────────────
// Cart Manager — add / remove / modify items in the session cart
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add items to the cart. If the same foodId exists, increment quantity.
 *
 * @param {object} session   - The call session
 * @param {object[]} items   - Resolved items: [{ foodId, name, qty, price, remark, isUpsell }]
 */
export function addItems(session, items) {
  for (const item of items) {
    const existing = session.cart.find((c) => c.foodId === item.foodId);
    if (existing) {
      existing.qty += item.qty;
      if (item.remark) existing.remark = item.remark;
    } else {
      session.cart.push({ ...item });
    }
  }
}

/**
 * Modify an item in the cart (update qty or remark).
 *
 * @param {object} session
 * @param {object} item - { foodId, name, qty?, remark? }
 */
export function modifyItem(session, item) {
  const existing = session.cart.find((c) => c.foodId === item.foodId);
  if (existing) {
    if (item.qty !== undefined && item.qty !== null) {
      existing.qty = item.qty;
    }
    if (item.remark !== undefined) {
      existing.remark = item.remark;
    }
    // Remove if qty is 0
    if (existing.qty <= 0) {
      session.cart = session.cart.filter((c) => c.foodId !== item.foodId);
    }
  }
}

/**
 * Remove an item from the cart by foodId.
 *
 * @param {object} session
 * @param {number} foodId
 */
export function removeItem(session, foodId) {
  session.cart = session.cart.filter((c) => c.foodId !== foodId);
}

/**
 * Remove an item from the cart by name (fuzzy match).
 *
 * @param {object} session
 * @param {string} itemName
 */
export function removeItemByName(session, itemName) {
  const lower = itemName.toLowerCase();
  session.cart = session.cart.filter(
    (c) => !c.name.toLowerCase().includes(lower)
  );
}

/**
 * Compute total amount for the cart.
 *
 * @param {object} session
 * @returns {number}
 */
export function computeTotal(session) {
  return session.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/**
 * Get a human-readable cart summary.
 *
 * @param {object} session
 * @returns {string}
 */
export function getCartSummary(session) {
  if (session.cart.length === 0) return "Your cart is empty.";

  const lines = session.cart.map((item) => {
    let line = `${item.qty}x ${item.name} — ₹${(item.price * item.qty).toFixed(2)}`;
    if (item.remark) line += ` (${item.remark})`;
    return line;
  });

  const total = computeTotal(session);
  lines.push(`Total: ₹${total.toFixed(2)}`);

  return lines.join(", ");
}

export default { addItems, modifyItem, removeItem, removeItemByName, computeTotal, getCartSummary };
