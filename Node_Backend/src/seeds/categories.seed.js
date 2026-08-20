import "dotenv/config";
import { pool } from "../db/index.js";

const categories = [
  { name: "Burgers", description: "Juicy hand-crafted beef, chicken & veg burgers" },
  { name: "Pizza", description: "Stone-baked thin and thick crust pizzas" },
  { name: "Drinks", description: "Cold beverages, shakes, and fresh juices" },
  { name: "Starters", description: "Appetizers and finger foods" },
  { name: "Pasta", description: "Italian pasta dishes with various sauces" },
  { name: "Desserts", description: "Sweet treats and ice creams" },
  { name: "Salads", description: "Fresh and healthy salad bowls" },
  { name: "Rice & Biryani", description: "Aromatic rice dishes and biryanis" },
  { name: "Chinese", description: "Indo-Chinese favorites" },
  { name: "Sandwiches", description: "Grilled and fresh sandwiches" },
];

async function seedCategories() {
  try {
    console.log("🌱 Seeding categories...");
    
    // Delete in correct order to avoid FK constraints
    await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE admin_id = 1)");
    await pool.query("DELETE FROM orders WHERE admin_id = 1");
    await pool.query("DELETE FROM food_items WHERE admin_id = 1");
    await pool.query("DELETE FROM categories WHERE admin_id = 1");
    
    for (const cat of categories) {
      await pool.query(
        `INSERT INTO categories (admin_id, name, description) 
         VALUES (1, $1, $2)`,
        [cat.name, cat.description]
      );
    }
    
    console.log(`✅ Inserted ${categories.length} categories`);
  } catch (error) {
    console.error("❌ Error seeding categories:", error.message);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCategories()
    .then(() => {
      console.log("✅ Categories seeding completed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Categories seeding failed:", err);
      process.exit(1);
    });
}

export { seedCategories };
