import "dotenv/config";
import pg from "pg";
import { buildPostgresConnectionString, shouldUseSsl } from "../src/db/connection.js";

const { Pool } = pg;
const pool = new Pool({
    connectionString: buildPostgresConnectionString(process.env.DATABASE_URL),
    ...(shouldUseSsl() ? { ssl: { rejectUnauthorized: false } } : {}),
});

async function runDebug() {
    try {
        const cartFoodIds = [1];
        console.log("Testing cartFoodIds:", cartFoodIds);

        const { rows: cartItems } = await pool.query(
            `SELECT name, selling_price FROM food_items WHERE id = ANY($1::int[])`,
            [cartFoodIds]
        );

        console.log("cartItems returned:", cartItems);

        const { rows: upsellOptions } = await pool.query(
            `SELECT id, name, selling_price FROM food_items 
       WHERE is_available = true 
         AND id != ALL($1::int[])
       ORDER BY RANDOM() LIMIT 1`,
            [cartFoodIds]
        );

        console.log("upsellOptions returned:", upsellOptions);

    } catch (error) {
        console.error("DB Error:", error);
    } finally {
        pool.end();
    }
}

runDebug();
