import "dotenv/config";
import { pool } from "../db/index.js";

// Helper to get a random date within last 7 days
function getRandomDateLast7Days() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 7); // 0-6 days ago
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);
  
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);
  
  return date.toISOString();
}

// Helper to pick random items from array
function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper to get random element
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Order templates with item names (will be converted to IDs)
const orderTemplates = [
  // Popular combos - will appear frequently
  { items: ["Classic Beef Burger", "French Fries", "Coca Cola"], frequency: 8 },
  { items: ["Margherita Pizza (Reg)", "Fresh Lime Soda"], frequency: 7 },
  { items: ["Chicken Biryani", "Cold Coffee"], frequency: 6 },
  { items: ["Crispy Chicken Burger", "Mango Shake", "French Fries"], frequency: 7 },
  { items: ["Pepperoni Pizza (Reg)", "Coca Cola"], frequency: 5 },
  
  // Medium frequency combos
  { items: ["Veg Supreme Burger", "Fresh Lime Soda"], frequency: 4 },
  { items: ["Chicken Wings (6pcs)", "Coca Cola", "French Fries"], frequency: 4 },
  { items: ["Alfredo Pasta", "Garlic Bread", "Chocolate Shake"], frequency: 3 },
  { items: ["Chilli Chicken", "Hakka Noodles", "Cold Coffee"], frequency: 4 },
  { items: ["Grilled Chicken Sandwich", "French Fries", "Mango Shake"], frequency: 3 },
  { items: ["BBQ Chicken Pizza", "Coca Cola"], frequency: 3 },
  { items: ["Veg Biryani", "Fresh Lime Soda"], frequency: 3 },
  
  // Lower frequency - testing slow movers
  { items: ["Caesar Salad", "Fresh Lime Soda"], frequency: 2 },
  { items: ["Greek Salad"], frequency: 1 },
  { items: ["Pesto Pasta", "Garlic Bread"], frequency: 2 },
  { items: ["Paneer Tikka", "Veg Manchurian", "Coca Cola"], frequency: 2 },
  { items: ["Club Sandwich", "Cold Coffee"], frequency: 2 },
  { items: ["Chocolate Brownie", "Vanilla Ice Cream"], frequency: 3 },
  { items: ["Four Cheese Pizza", "Fresh Lime Soda"], frequency: 2 },
  { items: ["Mac & Cheese", "Coca Cola"], frequency: 2 },
  
  // Very rare orders - slow movers
  { items: ["Garden Fresh Salad"], frequency: 1 },
  { items: ["Cheesecake Slice", "Cold Coffee"], frequency: 1 },
  { items: ["Spring Rolls (4pcs)", "Schezwan Fried Rice"], frequency: 1 },
  { items: ["Paneer Biryani", "Mango Shake"], frequency: 1 },
  { items: ["Veg Grilled Sandwich", "Fresh Lime Soda"], frequency: 1 },
  { items: ["Choco Lava Cake"], frequency: 1 },
];

const orderStatuses = ["delivered", "delivered", "delivered", "preparing", "ready"];

async function seedOrders() {
  try {
    console.log("🌱 Seeding orders...");
    
    // Get all customers
    const { rows: customers } = await pool.query(
      "SELECT id, name, address FROM customers WHERE admin_id = 1"
    );
    
    if (customers.length === 0) {
      console.error("❌ No customers found. Please seed customers first.");
      return;
    }
    
    // Get all food items with their selling prices
    const { rows: foodItems } = await pool.query(
      "SELECT id, name, selling_price FROM food_items WHERE admin_id = 1"
    );
    
    if (foodItems.length === 0) {
      console.error("❌ No food items found. Please seed food items first.");
      return;
    }
    
    // Create a map for quick lookup
    const foodItemMap = {};
    foodItems.forEach(item => {
      foodItemMap[item.name] = { id: item.id, price: parseFloat(item.selling_price) };
    });
    
    let ordersCreated = 0;
    let orderItemsCreated = 0;
    
    // Create orders based on templates and frequency
    for (const template of orderTemplates) {
      for (let i = 0; i < template.frequency; i++) {
        const customer = randomElement(customers);
        const orderTime = getRandomDateLast7Days();
        const status = randomElement(orderStatuses);
        
        // Validate all items exist
        const validItems = template.items.filter(itemName => {
          if (!foodItemMap[itemName]) {
            console.warn(`⚠️  Item '${itemName}' not found in database`);
            return false;
          }
          return true;
        });
        
        if (validItems.length === 0) continue;
        
        // Calculate total amount
        let totalAmount = 0;
        const orderItems = validItems.map(itemName => {
          const foodItem = foodItemMap[itemName];
          const quantity = Math.random() > 0.7 ? 2 : 1; // 30% chance of quantity 2
          const itemTotal = foodItem.price * quantity;
          totalAmount += itemTotal;
          
          return {
            food_id: foodItem.id,
            quantity: quantity,
            price: foodItem.price,
          };
        });
        
        // Insert order
        const { rows: orderRows } = await pool.query(
          `INSERT INTO orders (admin_id, customer_id, address, status, order_time, total_amount)
           VALUES (1, $1, $2, $3, $4, $5)
           RETURNING id`,
          [customer.id, customer.address, status, orderTime, totalAmount.toFixed(2)]
        );
        
        const orderId = orderRows[0].id;
        ordersCreated++;
        
        // Insert order items
        for (const item of orderItems) {
          await pool.query(
            `INSERT INTO order_items (order_id, food_id, quantity, price)
             VALUES ($1, $2, $3, $4)`,
            [orderId, item.food_id, item.quantity, item.price]
          );
          orderItemsCreated++;
        }
      }
    }
    
    console.log(`✅ Inserted ${ordersCreated} orders with ${orderItemsCreated} order items`);
    
    // Show velocity stats
    const { rows: stats } = await pool.query(`
      SELECT 
        fi.name,
        COUNT(DISTINCT oi.order_id) as order_count,
        SUM(oi.quantity) as total_quantity
      FROM food_items fi
      LEFT JOIN order_items oi ON fi.id = oi.food_id
      WHERE fi.admin_id = 1
      GROUP BY fi.id, fi.name
      ORDER BY order_count DESC
      LIMIT 10
    `);
    
    console.log("\n📊 Top 10 items by order frequency:");
    stats.forEach((stat, idx) => {
      console.log(`   ${idx + 1}. ${stat.name}: ${stat.order_count} orders (${stat.total_quantity} units)`);
    });
    
  } catch (error) {
    console.error("❌ Error seeding orders:", error.message);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOrders()
    .then(() => {
      console.log("\n✅ Orders seeding completed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Orders seeding failed:", err);
      process.exit(1);
    });
}

export { seedOrders };
