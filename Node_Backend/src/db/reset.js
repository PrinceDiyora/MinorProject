import "dotenv/config";
import { pool } from "./index.js";

async function resetDatabase() {
  try {
    console.log("🗑️  Dropping all tables...");
    
    await pool.query(`
      DROP TABLE IF EXISTS order_items CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS food_items CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS admin CASCADE;
    `);
    
    console.log("✅ All tables dropped successfully!");
    console.log("Now run: npm run db:init");
    
  } catch (error) {
    console.error("❌ Error resetting database:", error.message);
  } finally {
    await pool.end();
  }
}

resetDatabase();
