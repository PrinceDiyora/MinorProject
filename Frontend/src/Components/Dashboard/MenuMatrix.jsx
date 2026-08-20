import { useState, useEffect } from "react";
import { foodItemsAPI, ordersAPI } from "../../services/api";

const STATUS_CONFIGS = {
    healthy: { label: "Healthy", bg: "#DCFCE7", color: "#166534" },
    star: { label: "Hidden Star", bg: "#FEF3C7", color: "#92400E" },
    risk: { label: "At Risk", bg: "#FEE2E2", color: "#B91C1C" },
    slow: { label: "Slow Mover", bg: "#F3F4F6", color: "#4B5563" },
};

const VELOCITY = {
    veryLow: { label: "Very Low", bg: "#FEE2E2", color: "#B91C1C" },
    low: { label: "Low", bg: "#FEF3C7", color: "#92400E" },
    medium: { label: "Med", bg: "#F3F4F6", color: "#4B5563" },
    high: { label: "High", bg: "#DCFCE7", color: "#166534" },
    top: { label: "Top", bg: "#D1FAE5", color: "#065F46" },
};

const ACTION_LABELS = {
    healthy: "Edit",
    star: "Promote",
    risk: "Fix Pricing",
    slow: "Review",
};

// Helper function to calculate velocity category relative to average
const getVelocityCategory = (velocityPercent, avgVelocity) => {
    const ratio = avgVelocity > 0 ? velocityPercent / avgVelocity : 0;
    
    if (ratio >= 2.5) return "top";        // 2.5x average or more
    if (ratio >= 1.5) return "high";       // 1.5x - 2.5x average
    if (ratio >= 0.75) return "medium";    // 0.75x - 1.5x average
    if (ratio >= 0.25) return "low";       // 0.25x - 0.75x average
    return "veryLow";                      // < 0.25x average
};

// BCG Matrix logic: Compare against averages
// - Healthy (Stars): High popularity + High margin → Push hard
// - Hidden Star (Puzzles): Low popularity + High margin → Promote more
// - At Risk (Plowhorses): High popularity + Low margin → Increase price
// - Slow Mover (Dogs): Low popularity + Low margin → Remove
const getItemStatus = (marginPercent, velocityPercent, avgMargin, avgVelocity) => {
    const isHighMargin = marginPercent > avgMargin;
    const isHighVelocity = velocityPercent > avgVelocity;

    if (isHighMargin && isHighVelocity) return "healthy";    // Stars: Push hard
    if (isHighMargin && !isHighVelocity) return "star";      // Puzzles: Promote more (Hidden Star)
    if (!isHighMargin && isHighVelocity) return "risk";      // Plowhorses: Increase price (At Risk)
    return "slow";                                           // Dogs: Remove (Slow Mover)
};

export default function MenuMatrix() {
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterCategory, setFilterCategory] = useState("all");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchMenuData();
    }, []);

    const fetchMenuData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all food items
            const foodItemsResponse = await foodItemsAPI.getAll();
            const foodItems = foodItemsResponse.data;

            // Fetch orders from last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const ordersResponse = await ordersAPI.getAll();
            const allOrders = ordersResponse.data;

            // Filter orders from last 7 days
            const recentOrders = allOrders.filter(order => {
                const orderDate = new Date(order.order_time);
                return orderDate >= sevenDaysAgo;
            });

            const totalRecentOrders = recentOrders.length;

            // Fetch order details to get items
            const orderDetailsPromises = recentOrders.map(order => 
                ordersAPI.getById(order.id).catch(() => null)
            );
            const orderDetails = await Promise.all(orderDetailsPromises);

            // Calculate velocity for each food item
            const velocityMap = {};
            orderDetails.forEach(orderDetail => {
                if (!orderDetail || !orderDetail.data || !orderDetail.data.items) return;
                
                const itemIds = new Set();
                orderDetail.data.items.forEach(item => {
                    itemIds.add(item.food_id);
                });

                itemIds.forEach(foodId => {
                    velocityMap[foodId] = (velocityMap[foodId] || 0) + 1;
                });
            });

            // Transform food items data (first pass - calculate all metrics)
            const transformedItems = foodItems.map(item => {
                // Convert string values to numbers (PostgreSQL returns numeric as strings)
                const costPrice = parseFloat(item.cost_price);
                const sellingPrice = parseFloat(item.selling_price);
                
                // Contribution Margin = Selling Price - Cost Price
                const contributionMargin = sellingPrice - costPrice;
                
                // Margin Percentage = (Contribution Margin / Selling Price) * 100
                const marginPercent = (contributionMargin / sellingPrice) * 100;

                // Sales Velocity = (Orders with this item / Total orders) * 100
                const ordersWithItem = velocityMap[item.id] || 0;
                const velocityPercent = totalRecentOrders > 0 
                    ? (ordersWithItem / totalRecentOrders) * 100 
                    : 0;

                return {
                    id: item.id,
                    name: item.name,
                    category: item.category_name,
                    cost: costPrice,
                    price: sellingPrice,
                    contributionMargin: contributionMargin,
                    marginPercent: marginPercent,
                    velocityPercent: velocityPercent,
                    ordersCount: ordersWithItem,
                    is_available: item.is_available,
                };
            });

            // Calculate averages for BCG matrix categorization
            const avgMargin = transformedItems.reduce((sum, item) => sum + item.marginPercent, 0) / transformedItems.length;
            const avgVelocity = transformedItems.reduce((sum, item) => sum + item.velocityPercent, 0) / transformedItems.length;

            // Second pass - assign status and velocity category based on averages
            const finalItems = transformedItems.map(item => ({
                ...item,
                velocityCategory: getVelocityCategory(item.velocityPercent, avgVelocity),
                status: getItemStatus(item.marginPercent, item.velocityPercent, avgMargin, avgVelocity),
            }));

            setItems(finalItems);
        } catch (err) {
            console.error("Error fetching menu data:", err);
            setError("Failed to load menu data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const categories = ["all", ...new Set(items.map(i => i.category).filter(Boolean))];

    const filtered = items.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === "all" || item.status === filterStatus;
        const matchCat = filterCategory === "all" || item.category === filterCategory;
        return matchSearch && matchStatus && matchCat;
    });

    const inputStyle = {
        border: "1px solid var(--border)", borderRadius: 4,
        padding: "0.5rem 0.875rem", fontSize: "0.8125rem",
        fontFamily: "'Roboto', sans-serif", color: "var(--navy)",
        background: "#fff", outline: "none"
    };

    if (loading) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)" }}>Loading menu data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "var(--brand-red)", marginBottom: "1rem" }}>{error}</p>
                <button onClick={fetchMenuData} style={{
                    padding: "0.5rem 1rem", background: "var(--brand-red)", color: "#fff",
                    border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700
                }}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: "2rem" }}>
                <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    Module 01 · Revenue Intelligence
                </p>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>Menu & Pricing Matrix</h1>
            </div>
            <hr className="editorial-divider" style={{ marginBottom: "1.75rem" }} />

            {/* Summary badges */}
            <div style={{ display: "flex", gap: "0.875rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                {Object.entries(STATUS_CONFIGS).map(([key, cfg]) => {
                    const count = items.filter(i => i.status === key).length;
                    return (
                        <div key={key} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.bg}`, borderRadius: 4, padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 700 }}>
                            {cfg.label}: {count}
                        </div>
                    );
                })}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
                <input
                    placeholder="Search items…" value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ ...inputStyle, minWidth: 220 }}
                />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
                    <option value="all">All Status</option>
                    <option value="healthy">Healthy</option>
                    <option value="star">Hidden Star</option>
                    <option value="risk">At Risk</option>
                    <option value="slow">Slow Mover</option>
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={inputStyle}>
                    {categories.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
                </select>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                    {filtered.length} items
                </span>
            </div>

            {/* Table */}
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ minWidth: 780 }}>
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Category</th>
                                <th>Cost (₹)</th>
                                <th>Selling Price (₹)</th>
                                <th>Contribution Margin (₹)</th>
                                <th>Margin %</th>
                                <th>Velocity (%)</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                                        No items found
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(item => {
                                    const cfg = STATUS_CONFIGS[item.status];
                                    const velocityCfg = VELOCITY[item.velocityCategory];
                                    return (
                                        <tr key={item.id}>
                                            <td style={{ fontWeight: 700 }}>{item.name}</td>
                                            <td style={{ color: "var(--text-muted)" }}>{item.category || "N/A"}</td>
                                            <td style={{ fontFamily: "monospace" }}>₹{item.cost.toFixed(2)}</td>
                                            <td style={{ fontFamily: "monospace", fontWeight: 700 }}>₹{item.price.toFixed(2)}</td>
                                            <td style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--success)" }}>
                                                ₹{item.contributionMargin.toFixed(2)}
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 700, color: item.marginPercent > 60 ? "var(--success)" : item.marginPercent > 40 ? "var(--navy)" : "var(--brand-red)" }}>
                                                    {item.marginPercent.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge" style={{ background: velocityCfg.bg, color: velocityCfg.color, fontWeight: 700 }}>
                                                    {velocityCfg.label} ({item.velocityPercent.toFixed(1)}%)
                                                </span>
                                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                                                    {item.ordersCount} orders
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td>
                                                <button style={{
                                                    fontSize: "0.8rem", fontWeight: 700, padding: "0.25rem 0.625rem",
                                                    background: "transparent", border: "1.5px solid var(--border)",
                                                    borderRadius: 4, cursor: "pointer", color: "var(--navy)",
                                                    fontFamily: "'Roboto', sans-serif", transition: "border-color 0.15s"
                                                }}
                                                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--brand-red)"}
                                                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                                                >
                                                    {ACTION_LABELS[item.status]}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
