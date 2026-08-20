import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MetricCard from "./MetricCard";
import VoiceOrderAgent from "./VoiceOrderAgent";
import { ordersAPI, foodItemsAPI } from "../../services/api";

const PROFIT_PERIODS = [
  { value: "today",   label: "Today" },
  { value: "7days",   label: "Last 7 Days" },
  { value: "30days",  label: "Last Month" },
  { value: "alltime", label: "All Time" },
];

// Helper: YYYY-MM-DD string for today
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    statusBreakdown: { healthy: 0, star: 0, risk: 0, slow: 0 }
  });
  const [dailyOrderCounts, setDailyOrderCounts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // KPI filter
  const [kpiMode, setKpiMode] = useState("today");          // "today" | "range"
  const [kpiFrom, setKpiFrom] = useState(todayStr);
  const [kpiTo, setKpiTo] = useState(todayStr);
  const [kpiPendingFrom, setKpiPendingFrom] = useState(todayStr);
  const [kpiPendingTo, setKpiPendingTo] = useState(todayStr);
  const [kpiMetrics, setKpiMetrics] = useState({ revenue: 0, profit: 0, orderCount: 0 });
  const [kpiLoading, setKpiLoading] = useState(false);

  // Profitability table
  const [profitPeriod, setProfitPeriod] = useState("7days");
  const [profitData, setProfitData] = useState({ rows: [], totals: { qty_sold: 0, total_revenue: 0, total_cost: 0, total_profit: 0 } });
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitSortCol, setProfitSortCol] = useState("total_profit");
  const [profitSortDir, setProfitSortDir] = useState("desc");

  useEffect(() => { fetchDashboardData(); }, []);

  // Fetch KPI metrics whenever filter changes
  useEffect(() => {
    fetchKpiMetrics();
  }, [kpiMode, kpiFrom, kpiTo]);

  useEffect(() => {
    fetchProfitability(profitPeriod);
  }, [profitPeriod]);

  const fetchKpiMetrics = async () => {
    setKpiLoading(true);
    try {
      const params = kpiMode === "today"
        ? { period: "today" }
        : { from: kpiFrom, to: kpiTo };
      const res = await ordersAPI.getProfitability(params);
      const t = res.data?.totals || {};
      setKpiMetrics({
        revenue:    Number(t.total_revenue ?? 0),
        profit:     Number(t.total_profit  ?? 0),
        orderCount: Number(t.order_count    ?? 0),
      });
    } catch (err) {
      console.error("Failed to fetch KPI metrics:", err);
    } finally {
      setKpiLoading(false);
    }
  };

  const applyDateRange = () => {
    setKpiFrom(kpiPendingFrom);
    setKpiTo(kpiPendingTo);
  };

  const fetchProfitability = async (period) => {
    setProfitLoading(true);
    try {
      const res = await ordersAPI.getProfitability({ period });
      setProfitData(res.data || { rows: [], totals: { qty_sold: 0, total_revenue: 0, total_cost: 0, total_profit: 0 } });
    } catch (err) {
      console.error("Failed to fetch profitability:", err);
    } finally {
      setProfitLoading(false);
    }
  };

  const handleProfitSort = (col) => {
    if (profitSortCol === col) {
      setProfitSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setProfitSortCol(col);
      setProfitSortDir("desc");
    }
  };

  const sortedProfitRows = [...(profitData.rows || [])].sort((a, b) => {
    const va = Number(a[profitSortCol]) || 0;
    const vb = Number(b[profitSortCol]) || 0;
    return profitSortDir === "asc" ? va - vb : vb - va;
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all orders + food items in parallel
      const [ordersResponse, foodItemsResponse] = await Promise.all([
        ordersAPI.getAll(),
        foodItemsAPI.getAll(),
      ]);
      const allOrders = ordersResponse.data || [];
      const foodItems  = foodItemsResponse.data || [];

      // Daily order counts for chart (last 7 days)
      const dailyCounts = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        dailyCounts.push(
          allOrders.filter(o => {
            const d = new Date(o.order_time);
            return d >= date && d < nextDate;
          }).length
        );
      }

      // Status breakdown — velocity over last 7 days using order count proxy
      // (avoid N+1: proxy velocity as orders with same total_amount pattern)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentOrds = allOrders.filter(o => new Date(o.order_time) >= sevenDaysAgo);
      const totalRecent = recentOrds.length;

      // Fetch details for recent orders to build velocity map
      const recentDetails = await Promise.all(
        recentOrds.map(o => ordersAPI.getById(o.id).catch(() => null))
      );
      const velocityMap = {};
      recentDetails.forEach(detail => {
        if (!detail?.data?.items) return;
        const seen = new Set();
        detail.data.items.forEach(item => seen.add(item.food_id));
        seen.forEach(fid => { velocityMap[fid] = (velocityMap[fid] || 0) + 1; });
      });

      const itemsWithMetrics = foodItems.map(item => {
        const cost    = parseFloat(item.cost_price);
        const selling = parseFloat(item.selling_price);
        const marginPct   = selling > 0 ? ((selling - cost) / selling) * 100 : 0;
        const ordersCount = velocityMap[item.id] || 0;
        const velocityPct = totalRecent > 0 ? (ordersCount / totalRecent) * 100 : 0;
        return { marginPct, velocityPct };
      });

      const avgMargin   = itemsWithMetrics.reduce((s, x) => s + x.marginPct,   0) / (itemsWithMetrics.length || 1);
      const avgVelocity = itemsWithMetrics.reduce((s, x) => s + x.velocityPct, 0) / (itemsWithMetrics.length || 1);

      const statusBreakdown = { healthy: 0, star: 0, risk: 0, slow: 0 };
      itemsWithMetrics.forEach(({ marginPct, velocityPct }) => {
        const hi = marginPct   > avgMargin;
        const hv = velocityPct > avgVelocity;
        if  (hi && hv)  statusBreakdown.healthy++;
        else if (hi)    statusBreakdown.star++;
        else if (hv)    statusBreakdown.risk++;
        else            statusBreakdown.slow++;
      });

      setMetrics({ statusBreakdown });
      setDailyOrderCounts(dailyCounts);
      setRecentOrders(allOrders.slice(0, 10));

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 100, background: "#fff", border: "1px solid var(--border)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    );
  }

  const maxDailyOrders = Math.max(...dailyOrderCounts, 1);
  const dayLabels = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
          Back-of-House · Command Center
        </p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>
          AI Revenue Dashboard
        </h1>
      </div>
      <hr className="editorial-divider" style={{ marginBottom: "1.75rem" }} />

      {/* KPI Filter Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {/* Mode toggles */}
        <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {[["today", "Today"], ["range", "Date Range"]].map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => {
                setKpiMode(mode);
                if (mode === "today") { setKpiFrom(todayStr()); setKpiTo(todayStr()); }
                else { setKpiPendingFrom(todayStr()); setKpiPendingTo(todayStr()); setKpiFrom(todayStr()); setKpiTo(todayStr()); }
              }}
              style={{
                padding: "0.4rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: kpiMode === mode ? "var(--navy)" : "transparent",
                color: kpiMode === mode ? "#fff" : "var(--text-muted)",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date inputs — only when range mode */}
        {kpiMode === "range" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>From</span>
            <input
              type="date"
              value={kpiPendingFrom}
              max={kpiPendingTo}
              onChange={e => setKpiPendingFrom(e.target.value)}
              style={{ padding: "0.35rem 0.6rem", fontSize: "0.8125rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", color: "var(--navy)" }}
            />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>To</span>
            <input
              type="date"
              value={kpiPendingTo}
              min={kpiPendingFrom}
              max={todayStr()}
              onChange={e => setKpiPendingTo(e.target.value)}
              style={{ padding: "0.35rem 0.6rem", fontSize: "0.8125rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", color: "var(--navy)" }}
            />
            <button
              onClick={applyDateRange}
              style={{
                padding: "0.35rem 0.85rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                background: "var(--navy)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
        )}

        {kpiLoading && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>Updating…</span>
        )}
      </div>

      {/* KPI Ribbon */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }} className="metrics-grid">
        <MetricCard
          title={kpiMode === "today" ? "Today's Revenue" : `Revenue (${kpiFrom} – ${kpiTo})`}
          value={`₹${kpiMetrics.revenue.toFixed(0)}`}
          change={0}
          isPositive={true}
        />
        <MetricCard
          title={kpiMode === "today" ? "Total Profit Today" : `Profit (${kpiFrom} – ${kpiTo})`}
          value={`₹${kpiMetrics.profit.toFixed(0)}`}
          change={0}
          isPositive={kpiMetrics.profit >= 0}
        />
        <MetricCard
          title={kpiMode === "today" ? "Total Orders Today" : `Orders (${kpiFrom} – ${kpiTo})`}
          value={kpiMetrics.orderCount.toString()}
          change={0}
          isPositive={true}
        />
      </div>

      {/* Body — 2/3 + 1/3 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem" }} className="dashboard-body">
        {/* Left — Chart + Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Daily Order Trend Chart */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>Daily Order Trend</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Number of orders per day (Last 7 days)</p>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Last 7 Days</span>
            </div>
            {/* Bar chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
              {dailyOrderCounts.map((count, i) => {
                const heightPercent = maxDailyOrders > 0 ? (count / maxDailyOrders) * 100 : 0;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                    <div
                      style={{
                        width: "100%",
                        height: `${heightPercent}%`,
                        background: i === 6 ? "#C52031" : "#E2E6EA",
                        borderRadius: "2px 2px 0 0",
                        marginTop: "auto",
                        position: "relative",
                        minHeight: count > 0 ? "10px" : "0"
                      }}
                      title={`${count} orders`}
                    >
                      <span style={{
                        position: "absolute",
                        top: "-20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--navy)"
                      }}>
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.75rem" }}>
              {dayLabels.map((label, i) => (
                <span key={i} style={{ fontSize: "0.6875rem", color: "var(--text-light)", flex: 1, textAlign: "center" }}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Orders shortcut card */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>Live Orders</h3>
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{recentOrders.length} total</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
              View, manage and update kitchen order statuses in real-time.
            </p>
            <button
              onClick={() => navigate('/dashboard/orders')}
              style={{
                width: "100%",
                padding: "0.625rem",
                background: "var(--brand-red)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Roboto', sans-serif"
              }}
            >
              Go to Order Details →
            </button>
          </div>
        </div>

        {/* Right — Menu Status & AI Insights */}
        <div>
          {/* Menu Item Status Breakdown */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "1.25rem", marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)", marginBottom: "1rem" }}>
              Menu Item Status
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", background: "#DCFCE7", borderRadius: 4 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#166534" }}>Healthy</span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#166534" }}>{metrics.statusBreakdown.healthy}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", background: "#FEF3C7", borderRadius: 4 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#92400E" }}>Hidden Star</span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#92400E" }}>{metrics.statusBreakdown.star}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", background: "#FEE2E2", borderRadius: 4 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#B91C1C" }}>At Risk</span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#B91C1C" }}>{metrics.statusBreakdown.risk}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", background: "#F3F4F6", borderRadius: 4 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#4B5563" }}>Slow Mover</span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#4B5563" }}>{metrics.statusBreakdown.slow}</span>
              </div>
            </div>
            <button 
              onClick={() => navigate('/dashboard/menu-matrix')}
              style={{
                width: "100%",
                marginTop: "1rem",
                padding: "0.625rem",
                background: "var(--brand-red)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: "0.875rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Roboto', sans-serif"
              }}
            >
              View Menu & Pricing Matrix →
            </button>
          </div>

          {/* Voice Order Agent */}
          <div style={{ marginTop: "1.5rem" }}>
            <VoiceOrderAgent />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1200px) { .dashboard-body { grid-template-columns: 1fr !important; } }
        @media (max-width: 900px)  { .metrics-grid  { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 560px)  { .metrics-grid  { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ── Profitability Table ─────────────────────────────────────────────── */}
      <div style={{ marginTop: "2rem" }}>
        <hr className="editorial-divider" style={{ marginBottom: "1.75rem" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div>
            <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.25rem" }}>Revenue Intelligence</p>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--navy)" }}>Item Profitability</h2>
          </div>
          {/* Period filter */}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            {PROFIT_PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setProfitPeriod(p.value)}
                style={{
                  padding: "0.375rem 0.875rem",
                  borderRadius: 4,
                  border: profitPeriod === p.value ? "1.5px solid var(--brand-red)" : "1px solid var(--border)",
                  background: profitPeriod === p.value ? "rgba(197,32,49,0.06)" : "#fff",
                  color: profitPeriod === p.value ? "var(--brand-red)" : "var(--text-muted)",
                  fontSize: "0.8125rem",
                  fontWeight: profitPeriod === p.value ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "'Roboto', sans-serif",
                  transition: "all 0.15s ease"
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {profitLoading ? (
          <div style={{ height: 200, background: "#fff", border: "1px solid var(--border)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Loading…</span>
          </div>
        ) : sortedProfitRows.length === 0 ? (
          <div style={{ padding: "3rem", background: "#fff", border: "1px solid var(--border)", borderRadius: 6, textAlign: "center" }}>
            <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", fontWeight: 600 }}>No sales data for this period</p>
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {[
                      { key: null,            label: "Item",         align: "left"  },
                      { key: null,            label: "Category",     align: "left"  },
                      { key: "qty_sold",      label: "Qty Sold",     align: "right" },
                      { key: "total_revenue", label: "Revenue",      align: "right" },
                      { key: "total_cost",    label: "Cost",         align: "right" },
                      { key: "total_profit",  label: "Profit",       align: "right" },
                      { key: "margin_pct",    label: "Margin %",     align: "right" },
                    ].map(col => (
                      <th
                        key={col.label}
                        onClick={col.key ? () => handleProfitSort(col.key) : undefined}
                        style={{
                          padding: "0.75rem 1rem",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          color: col.key && profitSortCol === col.key ? "var(--brand-red)" : "var(--text-muted)",
                          textAlign: col.align,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          borderBottom: "1px solid var(--border)",
                          cursor: col.key ? "pointer" : "default",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col.label}
                        {col.key && profitSortCol === col.key && (
                          <span style={{ marginLeft: 3 }}>{profitSortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedProfitRows.map((row, i) => {
                    const profit = Number(row.total_profit);
                    const margin = Number(row.margin_pct);
                    const profitColor = profit >= 0 ? "#166534" : "#B91C1C";
                    const marginBg   = margin >= 40 ? "#DCFCE7" : margin >= 20 ? "#FEF3C7" : "#FEE2E2";
                    const marginFg   = margin >= 40 ? "#166534" : margin >= 20 ? "#92400E" : "#B91C1C";
                    return (
                      <tr key={row.food_id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--navy)" }}>{row.food_name}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>{row.category}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "var(--navy)", textAlign: "right", fontWeight: 600 }}>{Number(row.qty_sold).toLocaleString()}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "var(--navy)", textAlign: "right" }}>₹{Number(row.total_revenue).toFixed(2)}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "var(--text-muted)", textAlign: "right" }}>₹{Number(row.total_cost).toFixed(2)}</td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", fontWeight: 700, color: profitColor, textAlign: "right" }}>
                          {profit >= 0 ? "+" : ""}₹{profit.toFixed(2)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <span style={{ display: "inline-block", padding: "0.2rem 0.5rem", borderRadius: 4, background: marginBg, color: marginFg, fontSize: "0.75rem", fontWeight: 700 }}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals footer */}
                <tfoot>
                  <tr style={{ background: "#09161F", borderTop: "2px solid var(--border)" }}>
                    <td colSpan={2} style={{ padding: "0.75rem 1rem", fontSize: "0.8125rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em" }}>TOTAL</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", fontWeight: 700, color: "#fff", textAlign: "right" }}>{Number(profitData.totals?.qty_sold || 0).toLocaleString()}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", fontWeight: 700, color: "#fff", textAlign: "right" }}>₹{Number(profitData.totals?.total_revenue || 0).toFixed(2)}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", textAlign: "right" }}>₹{Number(profitData.totals?.total_cost || 0).toFixed(2)}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.9375rem", fontWeight: 700, color: "#4ADE80", textAlign: "right" }}>
                      +₹{Number(profitData.totals?.total_profit || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      {profitData.totals?.total_revenue > 0 && (
                        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#4ADE80" }}>
                          {((profitData.totals.total_profit / profitData.totals.total_revenue) * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
