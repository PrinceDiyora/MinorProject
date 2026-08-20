import { useState, useMemo } from 'react';

export default function OrdersTable({ orders, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('7days');

  // Filter orders based on status and time
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status.toLowerCase() === statusFilter);
    }

    // Time filter
    const now = new Date();
    const cutoffTime = new Date();
    if (timeFilter === '1hour') {
      cutoffTime.setHours(cutoffTime.getHours() - 1);
    } else if (timeFilter === '1day') {
      cutoffTime.setDate(cutoffTime.getDate() - 1);
    } else if (timeFilter === '7days') {
      cutoffTime.setDate(cutoffTime.getDate() - 7);
    }

    filtered = filtered.filter(o => new Date(o.order_time) >= cutoffTime);

    // Sort by time descending (most recent first)
    filtered.sort((a, b) => new Date(b.order_time) - new Date(a.order_time));

    return filtered.slice(0, 10); // Show max 10 orders
  }, [orders, statusFilter, timeFilter]);

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const orderTime = new Date(dateString);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Status badge colors
  const getStatusStyle = (status) => {
    const statusLower = status.toLowerCase();
    const styles = {
      pending: { bg: "#FEF3C7", color: "#92400E" },
      preparing: { bg: "#DBEAFE", color: "#1E40AF" },
      ready: { bg: "#DCFCE7", color: "#166534" },
      delivered: { bg: "#E9D5FF", color: "#6B21A8" },
      cancelled: { bg: "#FEE2E2", color: "#B91C1C" }
    };
    return styles[statusLower] || { bg: "#F3F4F6", color: "#4B5563" };
  };

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>Recent Orders</h3>
          {onRefresh && (
            <button 
              onClick={onRefresh}
              style={{ 
                fontSize: "0.8125rem", 
                fontWeight: 700, 
                color: "var(--brand-red)", 
                background: "transparent", 
                border: "none", 
                cursor: "pointer",
                fontFamily: "'Roboto', sans-serif"
              }}
            >
              Refresh
            </button>
          )}
        </div>
        
        {/* Filters */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-muted)" }}>Status:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "0.375rem 0.625rem",
                fontSize: "0.8125rem",
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "#fff",
                cursor: "pointer",
                fontFamily: "'Roboto', sans-serif"
              }}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-muted)" }}>Time:</label>
            <select 
              value={timeFilter} 
              onChange={(e) => setTimeFilter(e.target.value)}
              style={{
                padding: "0.375rem 0.625rem",
                fontSize: "0.8125rem",
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "#fff",
                cursor: "pointer",
                fontFamily: "'Roboto', sans-serif"
              }}
            >
              <option value="1hour">Last 1 Hour</option>
              <option value="1day">Last 1 Day</option>
              <option value="7days">Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ minWidth: 550 }}>
          <thead>
            <tr>
              {["Order ID", "Customer", "Status", "Amount", "Time"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                  No orders found
                </td>
              </tr>
            ) : (
              filteredOrders.map(o => {
                const statusStyle = getStatusStyle(o.status);
                return (
                  <tr key={o.order_id}>
                    <td style={{ fontWeight: 700, fontFamily: "monospace" }}>#{o.order_id}</td>
                    <td>{o.customer_name || 'Guest'}</td>
                    <td>
                      <span className="badge" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>₹{parseFloat(o.total_amount).toFixed(0)}</td>
                    <td style={{ color: "var(--text-muted)" }}>{formatRelativeTime(o.order_time)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
