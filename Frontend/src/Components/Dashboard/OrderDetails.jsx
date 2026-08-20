import { useState, useEffect, useCallback } from "react";
import { ordersAPI } from "../../services/api";

// ── Status meta ────────────────────────────────────────────────────────────
const STATUS_META = {
  pending:   { label: "Pending",   bg: "#FEF3C7", color: "#92400E", dot: "#D97706" },
  preparing: { label: "Preparing", bg: "#DBEAFE", color: "#1E40AF", dot: "#3B82F6" },
  ready:     { label: "Ready",     bg: "#DCFCE7", color: "#166534", dot: "#22C55E" },
  delivered: { label: "Delivered", bg: "#E9D5FF", color: "#6B21A8", dot: "#A855F7" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", color: "#B91C1C", dot: "#EF4444" },
};

const FILTER_OPTIONS = [
  { value: "all",       label: "All" },
  { value: "pending",   label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready",     label: "Ready" },
  { value: "delivered", label: "Delivered" },
];

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "0.25rem 0.625rem", borderRadius: 20,
      background: meta.bg, color: meta.color,
      fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.02em"
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot, flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

function OrderCard({ order, onStatusUpdate, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && items === null) {
      setLoadingItems(true);
      try {
        const res = await ordersAPI.getById(order.id);
        setItems(res.data?.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoadingItems(false);
      }
    }
    setExpanded(v => !v);
  };

  const handleStatus = async (newStatus) => {
    setActionLoading(true);
    try {
      await onStatusUpdate(order.id, newStatus);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    setActionLoading(true);
    try {
      await onCancel(order.id);
    } finally {
      setActionLoading(false);
      setConfirmCancel(false);
    }
  };

  const canCancel = order.status !== "delivered";

  // Next logical status
  const nextStatus =
    order.status === "pending"   ? "preparing" :
    order.status === "preparing" ? "ready"     :
    order.status === "ready"     ? "delivered" : null;

  const nextLabel =
    order.status === "pending"   ? "Start Cooking" :
    order.status === "preparing" ? "Mark Ready"    :
    order.status === "ready"     ? "Mark Delivered": null;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: 8,
      overflow: "hidden",
      transition: "box-shadow 0.15s ease",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      {/* Card header */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        {/* Left info */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Order #{order.id}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.25rem" }}>
            {order.customer_name}
          </p>
          {order.customer_phone && (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{order.customer_phone}</p>
          )}
          {order.address && (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              📍 {order.address}
            </p>
          )}
        </div>

        {/* Right — amount + time */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--navy)" }}>
            ₹{parseFloat(order.total_amount).toFixed(2)}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            {formatTime(order.order_time)}
          </p>
        </div>
      </div>

      {/* Expand items */}
      {expanded && (
        <div style={{ padding: "0 1.25rem 1rem", borderTop: "1px solid var(--border)" }}>
          {loadingItems ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", padding: "0.75rem 0" }}>Loading items…</p>
          ) : items && items.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.75rem" }}>
              <thead>
                <tr>
                  {["Item", "Qty", "Price", "Total"].map(h => (
                    <th key={h} style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--text-muted)", textAlign: h === "Item" ? "left" : "right", padding: "0.375rem 0.5rem", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontSize: "0.875rem", color: "var(--navy)", padding: "0.375rem 0.5rem" }}>
                      {item.food_name}
                      {item.is_upsell && <span style={{ marginLeft: 6, fontSize: "0.6875rem", background: "#FEF3C7", color: "#92400E", borderRadius: 3, padding: "1px 5px", fontWeight: 700 }}>UPSELL</span>}
                      {item.remark && <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.remark}</span>}
                    </td>
                    <td style={{ fontSize: "0.875rem", color: "var(--navy)", textAlign: "right", padding: "0.375rem 0.5rem" }}>×{item.quantity}</td>
                    <td style={{ fontSize: "0.875rem", color: "var(--navy)", textAlign: "right", padding: "0.375rem 0.5rem" }}>₹{parseFloat(item.price).toFixed(2)}</td>
                    <td style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--navy)", textAlign: "right", padding: "0.375rem 0.5rem" }}>₹{(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", padding: "0.75rem 0" }}>No items found.</p>
          )}
        </div>
      )}

      {/* Footer — actions */}
      <div style={{
        padding: "0.75rem 1.25rem",
        borderTop: "1px solid var(--border)",
        background: "#FAFAFA",
        display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap"
      }}>
        {/* Expand toggle */}
        <button
          onClick={toggleExpand}
          style={{ fontSize: "0.8125rem", color: "var(--brand-red)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, fontFamily: "'Roboto', sans-serif" }}
        >
          {expanded ? "▲ Hide Items" : "▼ View Items"}
        </button>

        <div style={{ flex: 1 }} />

        {/* Progress action */}
        {nextStatus && order.status !== "delivered" && order.status !== "cancelled" && (
          <button
            onClick={() => handleStatus(nextStatus)}
            disabled={actionLoading}
            style={{
              padding: "0.4rem 0.875rem",
              background: "#09161F",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: actionLoading ? "not-allowed" : "pointer",
              opacity: actionLoading ? 0.6 : 1,
              fontFamily: "'Roboto', sans-serif"
            }}
          >
            {actionLoading ? "…" : nextLabel}
          </button>
        )}

        {/* Cancel */}
        {canCancel && order.status !== "cancelled" && (
          <button
            onClick={handleCancel}
            onBlur={() => setConfirmCancel(false)}
            disabled={actionLoading}
            style={{
              padding: "0.4rem 0.875rem",
              background: confirmCancel ? "#B91C1C" : "transparent",
              color: confirmCancel ? "#fff" : "#B91C1C",
              border: "1px solid #B91C1C",
              borderRadius: 4,
              fontSize: "0.8125rem",
              fontWeight: 700,
              cursor: actionLoading ? "not-allowed" : "pointer",
              opacity: actionLoading ? 0.6 : 1,
              transition: "all 0.15s ease",
              fontFamily: "'Roboto', sans-serif"
            }}
          >
            {actionLoading ? "…" : confirmCancel ? "Confirm Cancel?" : "Cancel Order"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function OrderDetails() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.getAll();
      const all = (res.data || []).sort((a, b) => new Date(b.order_time) - new Date(a.order_time));
      setOrders(all);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    await ordersAPI.updateStatus(orderId, newStatus);
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    );
  };

  const handleCancel = async (orderId) => {
    await ordersAPI.cancel(orderId);
    setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  // Summary counts
  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
          Kitchen · Live Tracker
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>Order Details</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {lastRefresh && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Updated {formatTime(lastRefresh)}
              </span>
            )}
            <button
              onClick={fetchOrders}
              style={{
                padding: "0.4rem 0.875rem",
                background: "var(--brand-red)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Roboto', sans-serif"
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      <hr className="editorial-divider" style={{ marginBottom: "1.5rem" }} />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {[
          { key: "pending",   label: "Pending",   ...STATUS_META.pending },
          { key: "preparing", label: "Preparing", ...STATUS_META.preparing },
          { key: "ready",     label: "Ready",     ...STATUS_META.ready },
          { key: "delivered", label: "Delivered", ...STATUS_META.delivered },
        ].map(s => (
          <div key={s.key} style={{
            background: s.bg, borderRadius: 6, padding: "0.5rem 1rem",
            display: "flex", alignItems: "center", gap: "0.5rem"
          }}>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: s.color }}>{counts[s.key] || 0}</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: s.color }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              padding: "0.375rem 0.875rem",
              borderRadius: 4,
              border: filter === opt.value ? "1.5px solid var(--brand-red)" : "1px solid var(--border)",
              background: filter === opt.value ? "rgba(197,32,49,0.06)" : "#fff",
              color: filter === opt.value ? "var(--brand-red)" : "var(--text-muted)",
              fontSize: "0.8125rem",
              fontWeight: filter === opt.value ? 700 : 400,
              cursor: "pointer",
              fontFamily: "'Roboto', sans-serif",
              transition: "all 0.15s ease"
            }}
          >
            {opt.label}
            {opt.value !== "all" && counts[opt.value] > 0 && (
              <span style={{ marginLeft: 5, background: filter === opt.value ? "var(--brand-red)" : "#E5E7EB", color: filter === opt.value ? "#fff" : "#6B7280", borderRadius: 10, padding: "0 5px", fontSize: "0.6875rem", fontWeight: 700 }}>
                {counts[opt.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 88, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", background: "#fff", border: "1px solid var(--border)", borderRadius: 8 }}>
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", fontWeight: 600 }}>No orders found</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--text-light)", marginTop: "0.5rem" }}>
            {filter !== "all" ? `No ${filter} orders at this time.` : "No orders have been placed yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusUpdate={handleStatusUpdate}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
