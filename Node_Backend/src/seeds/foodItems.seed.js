import "dotenv/config";
import { pool } from "../db/index.js";

const foodItems = [
  // Burgers (category_id will be fetched)
  { category: "Burgers", name: "Classic Beef Burger", cost: 80, selling: 149, min: 130, max: 180, qty: 50 },
  { category: "Burgers", name: "Crispy Chicken Burger", cost: 70, selling: 139, min: 120, max: 170, qty: 45 },
  { category: "Burgers", name: "Veg Supreme Burger", cost: 60, selling: 119, min: 100, max: 150, qty: 60 },
  { category: "Burgers", name: "Double Cheese Burger", cost: 95, selling: 179, min: 155, max: 220, qty: 30 },
  
  // Pizza
  { category: "Pizza", name: "Margherita Pizza (Reg)", cost: 120, selling: 249, min: 220, max: 299, qty: 40 },
  { category: "Pizza", name: "Pepperoni Pizza (Reg)", cost: 140, selling: 299, min: 260, max: 350, qty: 35 },
  { category: "Pizza", name: "Veggie Delight Pizza", cost: 130, selling: 269, min: 235, max: 320, qty: 38 },
  { category: "Pizza", name: "BBQ Chicken Pizza", cost: 150, selling: 329, min: 285, max: 380, qty: 28 },
  { category: "Pizza", name: "Four Cheese Pizza", cost: 145, selling: 319, min: 280, max: 370, qty: 25 },
  
  // Drinks
  { category: "Drinks", name: "Mango Shake", cost: 30, selling: 79, min: 70, max: 99, qty: 100 },
  { category: "Drinks", name: "Chocolate Shake", cost: 35, selling: 89, min: 75, max: 110, qty: 95 },
  { category: "Drinks", name: "Cold Coffee", cost: 40, selling: 99, min: 85, max: 120, qty: 90 },
  { category: "Drinks", name: "Fresh Lime Soda", cost: 20, selling: 59, min: 50, max: 75, qty: 120 },
  { category: "Drinks", name: "Coca Cola", cost: 25, selling: 49, min: 40, max: 60, qty: 150 },
  
  // Starters
  { category: "Starters", name: "Chicken Wings (6pcs)", cost: 85, selling: 169, min: 145, max: 200, qty: 40 },
  { category: "Starters", name: "French Fries", cost: 35, selling: 89, min: 75, max: 110, qty: 80 },
  { category: "Starters", name: "Mozzarella Sticks", cost: 70, selling: 149, min: 130, max: 180, qty: 45 },
  { category: "Starters", name: "Paneer Tikka", cost: 80, selling: 159, min: 140, max: 190, qty: 35 },
  { category: "Starters", name: "Spring Rolls (4pcs)", cost: 50, selling: 119, min: 100, max: 145, qty: 50 },
  { category: "Starters", name: "Garlic Bread", cost: 40, selling: 99, min: 85, max: 120, qty: 60 },
  
  // Pasta
  { category: "Pasta", name: "Alfredo Pasta", cost: 90, selling: 189, min: 165, max: 230, qty: 40 },
  { category: "Pasta", name: "Arrabiata Pasta", cost: 85, selling: 179, min: 155, max: 220, qty: 42 },
  { category: "Pasta", name: "Pesto Pasta", cost: 95, selling: 199, min: 175, max: 240, qty: 35 },
  { category: "Pasta", name: "Mac & Cheese", cost: 75, selling: 159, min: 140, max: 190, qty: 48 },
  
  // Desserts
  { category: "Desserts", name: "Chocolate Brownie", cost: 45, selling: 99, min: 85, max: 120, qty: 60 },
  { category: "Desserts", name: "Vanilla Ice Cream", cost: 35, selling: 79, min: 70, max: 95, qty: 70 },
  { category: "Desserts", name: "Choco Lava Cake", cost: 55, selling: 129, min: 110, max: 155, qty: 45 },
  { category: "Desserts", name: "Cheesecake Slice", cost: 60, selling: 139, min: 120, max: 170, qty: 40 },
  
  // Salads
  { category: "Salads", name: "Caesar Salad", cost: 70, selling: 149, min: 130, max: 180, qty: 35 },
  { category: "Salads", name: "Greek Salad", cost: 75, selling: 159, min: 140, max: 190, qty: 32 },
  { category: "Salads", name: "Garden Fresh Salad", cost: 55, selling: 119, min: 100, max: 145, qty: 40 },
  
  // Rice & Biryani
  { category: "Rice & Biryani", name: "Chicken Biryani", cost: 110, selling: 229, min: 200, max: 280, qty: 45 },
  { category: "Rice & Biryani", name: "Veg Biryani", cost: 90, selling: 189, min: 165, max: 230, qty: 50 },
  { category: "Rice & Biryani", name: "Egg Fried Rice", cost: 65, selling: 139, min: 120, max: 170, qty: 55 },
  { category: "Rice & Biryani", name: "Paneer Biryani", cost: 95, selling: 199, min: 175, max: 240, qty: 42 },
  
  // Chinese
  { category: "Chinese", name: "Chilli Chicken", cost: 95, selling: 199, min: 175, max: 240, qty: 38 },
  { category: "Chinese", name: "Veg Manchurian", cost: 70, selling: 149, min: 130, max: 180, qty: 45 },
  { category: "Chinese", name: "Hakka Noodles", cost: 75, selling: 159, min: 140, max: 190, qty: 48 },
  { category: "Chinese", name: "Schezwan Fried Rice", cost: 80, selling: 169, min: 145, max: 205, qty: 42 },
  
  // Sandwiches
  { category: "Sandwiches", name: "Grilled Chicken Sandwich", cost: 70, selling: 149, min: 130, max: 180, qty: 40 },
  { category: "Sandwiches", name: "Veg Grilled Sandwich", cost: 50, selling: 109, min: 95, max: 135, qty: 50 },
  { category: "Sandwiches", name: "Paneer Tikka Sandwich", cost: 65, selling: 139, min: 120, max: 170, qty: 45 },
  { category: "Sandwiches", name: "Club Sandwich", cost: 85, selling: 179, min: 155, max: 220, qty: 35 },
];

async function seedFoodItems() {
  try {
    console.log("🌱 Seeding food items...");
    
    // Get category IDs
    const { rows: categories } = await pool.query(
      "SELECT id, name FROM categories WHERE admin_id = 1"
    );
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });
    
    let inserted = 0;
    for (const item of foodItems) {
      const categoryId = categoryMap[item.category];
      if (!categoryId) {
        console.warn(`⚠️  Category '${item.category}' not found, skipping ${item.name}`);
        continue;
      }
      
      await pool.query(
        `INSERT INTO food_items 
         (admin_id, category_id, name, cost_price, selling_price, min_price, max_price, quantity, is_available) 
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, true)`,
        [categoryId, item.name, item.cost, item.selling, item.min, item.max, item.qty]
      );
      inserted++;
    }
    
    console.log(`✅ Inserted ${inserted} food items`);
  } catch (error) {
    console.error("❌ Error seeding food items:", error.message);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedFoodItems()
    .then(() => {
      console.log("✅ Food items seeding completed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Food items seeding failed:", err);
      process.exit(1);
    });
}

export { seedFoodItems };
