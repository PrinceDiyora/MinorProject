// ─────────────────────────────────────────────────────────────────────────────
// DB Save Flow — transactional order persistence on confirmation
// ─────────────────────────────────────────────────────────────────────────────

import { pool } from "../db/index.js";

/**
 * Save a confirmed order as a single DB transaction.
 * Steps:
 *   1. UPSERT customer by (admin_id, phone) → get customer_id
 *   2. INSERT into orders → get order_id
 *   3. INSERT all cart items into order_items
 *   4. INSERT into voice_sessions
 *
 * @param {object} session - The call session
 * @returns {Promise<{ orderId: number, customerId: number }>}
 */
export async function saveOrder(session) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. UPSERT customer
    const customerName = session.customerName || "Voice Customer";
    const customerAddress = session.customerAddress || null;
    const customerResult = await client.query(
      `INSERT INTO customers (admin_id, name, phone, address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT uq_customer_phone_per_restaurant
       DO UPDATE SET
         name    = CASE WHEN EXCLUDED.name <> 'Voice Customer' THEN EXCLUDED.name ELSE customers.name END,
         address = COALESCE(EXCLUDED.address, customers.address),
         updated_at = NOW()
       RETURNING id`,
      [session.adminId, customerName, session.callerPhone, customerAddress]
    );
    const customerId = customerResult.rows[0].id;
    session.customerId = customerId;

    // 2. INSERT order
    const totalAmount = session.cart.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    const orderResult = await client.query(
      `INSERT INTO orders (admin_id, customer_id, total_amount, address, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [session.adminId, customerId, totalAmount, customerAddress]
    );
    const orderId = orderResult.rows[0].id;

    // 3. INSERT order items
    let itemsInserted = 0;
    for (const item of session.cart) {
      const foodId = item.foodId || item.id;
      if (!foodId) {
        console.error("[DB] Cart item missing foodId — skipping:", JSON.stringify(item));
        continue;
      }
      if (!item.qty || item.qty <= 0) {
        console.error("[DB] Cart item has invalid qty — skipping:", JSON.stringify(item));
        continue;
      }

      await client.query(
        `INSERT INTO order_items (order_id, food_id, quantity, price, is_upsell, remark)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          foodId,
          item.qty,
          item.price || 0,
          item.isUpsell || false,
          item.remark || null,
        ]
      );
      itemsInserted++;
    }

    if (itemsInserted === 0) {
      throw new Error(`No valid order items to insert. Cart dump: ${JSON.stringify(session.cart)}`);
    }

    console.log(`[DB] Inserted ${itemsInserted} order items for order #${orderId}`);

    // 4. INSERT voice session
    const durationSecs = Math.round(
      (Date.now() - session.startTime.getTime()) / 1000
    );

    const rawTranscript = session.transcript
      .map((t) => `[${t.role}] ${t.text}`)
      .join("\n");

    await client.query(
      `INSERT INTO voice_sessions (admin_id, order_id, raw_transcript, parsed_intent, language_detected, converted, duration_secs)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [
        session.adminId,
        orderId,
        rawTranscript,
        JSON.stringify(session.parsedIntents),
        session.languageDetected,
        durationSecs,
      ]
    );

    await client.query("COMMIT");

    console.log(
      `[DB] Order #${orderId} saved for customer #${customerId} (${session.callerPhone})`
    );

    return { orderId, customerId };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[DB] Transaction failed:", error.message);

    // Save voice session with converted=false
    await saveFailedSession(session, error.message);

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Save a partial/failed voice session (no order placed).
 *
 * @param {object} session
 * @param {string} [errorMsg]
 */
export async function saveFailedSession(session, errorMsg = null) {
  try {
    const durationSecs = Math.round(
      (Date.now() - session.startTime.getTime()) / 1000
    );

    const rawTranscript = session.transcript
      .map((t) => `[${t.role}] ${t.text}`)
      .join("\n");

    await pool.query(
      `INSERT INTO voice_sessions (admin_id, order_id, raw_transcript, parsed_intent, language_detected, converted, duration_secs)
       VALUES ($1, NULL, $2, $3, $4, false, $5)`,
      [
        session.adminId,
        rawTranscript || "(no transcript)",
        JSON.stringify(session.parsedIntents || []),
        session.languageDetected || "unknown",
        durationSecs,
      ]
    );

    if (errorMsg) {
      console.log(`[DB] Failed session saved: ${errorMsg}`);
    }
  } catch (err) {
    console.error("[DB] Failed to save failed session:", err.message);
  }
}

export default { saveOrder, saveFailedSession };
