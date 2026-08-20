import "dotenv/config";
import { pool } from "../db/index.js";
import { seedCategories } from "./categories.seed.js";
import { seedFoodItems } from "./foodItems.seed.js";
import { seedCustomers } from "./customers.seed.js";
import { seedOrders } from "./orders.seed.js";

async function runAllSeeds() {
  console.log("🚀 Starting comprehensive data seeding...\n");
  
  try {
    // Seed in correct order (respecting foreign key constraints)
    await seedCategories();
    console.log();
    
    await seedFoodItems();
    console.log();
    
    await seedCustomers();
    console.log();
    
    await seedOrders();
    console.log();
    
    console.log("═".repeat(60));
    console.log("✅ ALL SEEDS COMPLETED SUCCESSFULLY!");
    console.log("═".repeat(60));
    
    // Show summary
    const { rows: summary } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM categories WHERE admin_id = 1) as categories,
        (SELECT COUNT(*) FROM food_items WHERE admin_id = 1) as food_items,
        (SELECT COUNT(*) FROM customers WHERE admin_id = 1) as customers,
        (SELECT COUNT(*) FROM orders WHERE admin_id = 1) as orders,
        (SELECT COUNT(*) FROM order_items) as order_items
    `);
    
    console.log("\n📊 Database Summary:");
    console.log(`   Categories:  ${summary[0].categories}`);
    console.log(`   Food Items:  ${summary[0].food_items}`);
    console.log(`   Customers:   ${summary[0].customers}`);
    console.log(`   Orders:      ${summary[0].orders}`);
    console.log(`   Order Items: ${summary[0].order_items}`);
    console.log();
    
  } catch (error) {
    console.error("\n❌ Seeding failed:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runAllSeeds()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
