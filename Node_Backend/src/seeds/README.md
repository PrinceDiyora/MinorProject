# Database Seed Scripts

This folder contains seed scripts to populate the database with realistic test data for development and testing.

## 📦 What Gets Seeded

- **10 Categories**: Burgers, Pizza, Drinks, Starters, Pasta, Desserts, Salads, Rice & Biryani, Chinese, Sandwiches
- **43 Food Items**: Diverse menu items across all categories with realistic pricing
- **15 Customers**: Test customers with addresses across Indian cities
- **79 Orders**: Orders spread across the last 7 days with realistic ordering patterns
- **186 Order Items**: Multiple items per order to test sales velocity calculations

## 🚀 Usage

### Seed Everything at Once (Recommended)
```bash
npm run seed
```

### Seed Individual Components
```bash
npm run seed:categories  # Seed only categories
npm run seed:items       # Seed only food items
npm run seed:customers   # Seed only customers
npm run seed:orders      # Seed only orders
```

## 📊 Data Characteristics

### Food Items Pricing
- All items follow schema constraints:
  - `min_price >= cost_price * 1.20` (minimum 20% margin)
  - `min_price <= selling_price <= max_price`
  - Realistic cost-to-selling price ratios

### Order Distribution
Orders are created with varying frequencies to simulate realistic sales patterns:

- **High Velocity Items** (appear in 50%+ of orders):
  - Coca Cola, French Fries, Fresh Lime Soda (sidekicks/add-ons)
  - Classic Beef Burger, Margherita Pizza (popular mains)

- **Medium Velocity Items** (30-49% of orders):
  - Chicken Wings, Pasta dishes, Chinese items
  - Cold Coffee, Mango Shake

- **Low Velocity Items** (15-29% of orders):
  - Specialty pizzas, Sandwiches
  - Some biryani variants

- **Very Low/Slow Movers** (<15% of orders):
  - Salads, Premium desserts
  - Less popular items

### Order Timing
- All orders distributed across **last 7 days**
- Random times throughout each day
- Mix of statuses: delivered (60%), preparing (20%), ready (20%)

## ⚠️ Important Notes

1. **Admin ID**: All data is seeded for `admin_id = 1` (default admin account)

2. **Deletion**: Running any seed script will **DELETE ALL EXISTING DATA** for that entity to ensure clean state

3. **Order of Execution**: Seeds must run in this order due to foreign key constraints:
   - Categories → Food Items → Customers → Orders → Order Items

4. **Schema Compliance**: All seeded data strictly follows the database schema constraints defined in `src/db/schema.js`

## 🧪 Testing Velocity Calculations

The seeded orders are designed to test the MenuMatrix velocity calculation feature:

- **Top Performers**: Items appearing in 50%+ orders (Coca Cola, Fries)
- **High Velocity**: Items in 30-49% orders (Shakes, Popular burgers)
- **Medium Velocity**: Items in 15-29% orders (Chinese, Pasta)
- **Low Velocity**: Items in 5-14% orders (Some pizzas, Sandwiches)
- **Very Low/Slow Movers**: Items in <5% orders (Salads, Premium items)

This distribution allows testing all velocity categories and status badges (Healthy, Hidden Star, At Risk, Slow Mover).

## 📋 Example Commands

```bash
# Full reset and reseed
npm run seed

# Reseed only food items (if you modified items data)
npm run seed:items

# Reseed only orders (to test different order patterns)
npm run seed:orders
```

## 🔧 Customization

To modify seed data:

1. Edit the respective seed file (`categories.seed.js`, `foodItems.seed.js`, etc.)
2. Ensure all constraints are met (pricing formulas, foreign keys)
3. Run the seed command

## 📈 Expected Results in MenuMatrix

After seeding, you should see in the Menu & Pricing Matrix dashboard:

- **43 food items** across 10 categories
- **Varied velocity percentages** (0% to 50%+)
- **Different status badges**: Healthy, Hidden Star, At Risk, Slow Mover
- **Realistic contribution margins** (20-60%+)
- **Non-zero order counts** for most items

## 🐛 Troubleshooting

**Error: Foreign key constraint violation**
- Solution: Run `npm run seed` (not individual scripts) to maintain correct order

**Error: Duplicate key violation**
- Solution: The seed script handles this by deleting existing data first

**Error: Check constraint violation**
- Solution: Review the pricing in `foodItems.seed.js` - ensure `min_price >= cost * 1.20`
