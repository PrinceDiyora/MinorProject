import "dotenv/config";
import { pool } from "../db/index.js";

const customers = [
  { name: "Rohan Mehta", phone: "9876543210", address: "12, Rose Lane, Mumbai" },
  { name: "Priya Shah", phone: "9123456789", address: "45, MG Road, Pune" },
  { name: "Amit Kumar", phone: "9988776655", address: "23, Park Street, Delhi" },
  { name: "Sneha Patel", phone: "9876512340", address: "67, Lake View, Bangalore" },
  { name: "Rajesh Verma", phone: "9123478901", address: "89, Church Road, Chennai" },
  { name: "Pooja Desai", phone: "9988123456", address: "34, Hill Top, Hyderabad" },
  { name: "Vikram Singh", phone: "9876098765", address: "56, Green Valley, Jaipur" },
  { name: "Anjali Reddy", phone: "9123098765", address: "78, Beach Road, Goa" },
  { name: "Karan Malhotra", phone: "9988654321", address: "12, Metro Lane, Noida" },
  { name: "Divya Iyer", phone: "9876234567", address: "45, Temple Street, Kochi" },
  { name: "Arjun Nair", phone: "9123567890", address: "23, Garden Colony, Ahmedabad" },
  { name: "Meera Joshi", phone: "9988234567", address: "67, River Side, Kolkata" },
  { name: "Rahul Gupta", phone: "9876345678", address: "89, Market Road, Lucknow" },
  { name: "Kavya Sharma", phone: "9123234567", address: "34, Airport Road, Chandigarh" },
  { name: "Nikhil Pandey", phone: "9988567890", address: "56, Station Road, Indore" },
];

async function seedCustomers() {
  try {
    console.log("🌱 Seeding customers...");
    
    // Delete existing customers (orders will be deleted in categories seed)
    await pool.query("DELETE FROM customers WHERE admin_id = 1");
    
    for (const customer of customers) {
      await pool.query(
        `INSERT INTO customers (admin_id, name, phone, address) 
         VALUES (1, $1, $2, $3)`,
        [customer.name, customer.phone, customer.address]
      );
    }
    
    console.log(`✅ Inserted ${customers.length} customers`);
  } catch (error) {
    console.error("❌ Error seeding customers:", error.message);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCustomers()
    .then(() => {
      console.log("✅ Customers seeding completed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Customers seeding failed:", err);
      process.exit(1);
    });
}

export { seedCustomers };
