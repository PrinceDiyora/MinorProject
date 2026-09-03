import { useState, useEffect, useCallback } from "react";
import { ordersAPI, customersAPI, foodItemsAPI } from "../../services/api";

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

const EMPTY_ORDER_ITEM = { food_id: "", quantity: 1, price: "", remark: "" };

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orderForm, setOrderForm] = useState({
    customerMode: "existing",
    customer_id: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    address: "",
    items: [{ ...EMPTY_ORDER_ITEM }],
  });

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

  const openCreateModal = async () => {
    setCreateError("");
    setCreateLoading(true);
    try {
      const [customersRes, menuRes] = await Promise.all([
        customersAPI.getAll(),
        foodItemsAPI.getAll(),
      ]);
      const customerList = customersRes.data || [];
      const allMenuItems = menuRes.data || [];
      const availableItems = allMenuItems.filter((item) => item.is_available !== false);

      setCustomers(customerList);
      setMenuItems(availableItems);

      const firstCustomer = customerList[0];
      setOrderForm({
        customerMode: "existing",
        customer_id: firstCustomer?.id ? String(firstCustomer.id) : "",
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        address: firstCustomer?.address || "",
        items: [{ ...EMPTY_ORDER_ITEM }],
      });
      setShowCreateModal(true);
    } catch (err) {
      setCreateError(err?.response?.data?.message || "Failed to load customers/menu items");
    } finally {
      setCreateLoading(false);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateError("");
  };

  const updateItemRow = (index, key, value) => {
    setOrderForm((prev) => {
      const nextItems = [...prev.items];
      const nextRow = { ...nextItems[index], [key]: value };

      if (key === "food_id") {
        const selected = menuItems.find((m) => String(m.id) === String(value));
        nextRow.price = selected ? String(selected.selling_price) : "";
      }

      nextItems[index] = nextRow;
      return { ...prev, items: nextItems };
    });
  };

  const addItemRow = () => {
    setOrderForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ORDER_ITEM }] }));
  };

  const removeItemRow = (index) => {
    setOrderForm((prev) => {
      if (prev.items.length === 1) return prev;
      return { ...prev, items: prev.items.filter((_, i) => i !== index) };
    });
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setCreateSaving(true);
    setCreateError("");

    try {
      let customerId = orderForm.customerMode === "existing" ? Number(orderForm.customer_id) : null;

      if (orderForm.customerMode === "new") {
        if (!orderForm.customer_name.trim() || !orderForm.customer_phone.trim()) {
          throw new Error("Customer name and phone are required");
        }
        const customerRes = await customersAPI.create({
          name: orderForm.customer_name.trim(),
          phone: orderForm.customer_phone.trim(),
          address: orderForm.customer_address.trim(),
        });
        customerId = customerRes.data?.id;
      }

      if (!customerId) {
        throw new Error("Please select a customer or create a new one");
      }

      const itemsPayload = orderForm.items
        .map((item) => ({
          food_id: Number(item.food_id),
          quantity: Number(item.quantity),
          price: Number(item.price),
          remark: item.remark?.trim() || undefined,
        }))
        .filter((item) => item.food_id > 0 && item.quantity > 0 && Number.isFinite(item.price));

      if (itemsPayload.length === 0) {
        throw new Error("Add at least one valid item with quantity and price");
      }

      await ordersAPI.create({
        customer_id: customerId,
        address: orderForm.address?.trim() || undefined,
        items: itemsPayload,
      });

      closeCreateModal();
      await fetchOrders();
    } catch (err) {
      setCreateError(err?.response?.data?.message || err.message || "Failed to create order");
    } finally {
      setCreateSaving(false);
    }
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
              onClick={openCreateModal}
              disabled={createLoading}
              style={{
                padding: "0.4rem 0.875rem",
                background: "#09161F",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: createLoading ? "not-allowed" : "pointer",
                opacity: createLoading ? 0.7 : 1,
                fontFamily: "'Roboto', sans-serif"
              }}
            >
              {createLoading ? "Loading..." : "+ Add New Order"}
            </button>
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

      {showCreateModal && (
        <div
          onClick={closeCreateModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 760,
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border)",
              position: "sticky",
              top: 0,
              background: "#fff",
              zIndex: 1,
            }}>
              <h3 style={{ fontWeight: 700, color: "var(--navy)", fontSize: "1rem", margin: 0 }}>
                Add New Order
              </h3>
              <button onClick={closeCreateModal} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--text-muted)" }}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setOrderForm((prev) => ({ ...prev, customerMode: "existing" }))}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: 4,
                    border: orderForm.customerMode === "existing" ? "1.5px solid var(--brand-red)" : "1px solid var(--border)",
                    background: orderForm.customerMode === "existing" ? "rgba(197,32,49,0.06)" : "#fff",
                    color: orderForm.customerMode === "existing" ? "var(--brand-red)" : "var(--text-muted)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Existing Customer
                </button>
                <button
                  type="button"
                  onClick={() => setOrderForm((prev) => ({ ...prev, customerMode: "new", customer_id: "" }))}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: 4,
                    border: orderForm.customerMode === "new" ? "1.5px solid var(--brand-red)" : "1px solid var(--border)",
                    background: orderForm.customerMode === "new" ? "rgba(197,32,49,0.06)" : "#fff",
                    color: orderForm.customerMode === "new" ? "var(--brand-red)" : "var(--text-muted)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  New Customer
                </button>
              </div>

              {orderForm.customerMode === "existing" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Customer
                  </label>
                  <select
                    value={orderForm.customer_id}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const selected = customers.find((c) => String(c.id) === String(nextId));
                      setOrderForm((prev) => ({ ...prev, customer_id: nextId, address: selected?.address || "" }));
                    }}
                    required
                    style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.45rem 0.65rem", fontSize: "0.875rem", color: "var(--navy)" }}
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Name
                    </label>
                    <input
                      value={orderForm.customer_name}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                      required
                      placeholder="Customer name"
                      style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.45rem 0.65rem", fontSize: "0.875rem", color: "var(--navy)" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Phone
                    </label>
                    <input
                      value={orderForm.customer_phone}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                      required
                      placeholder="Phone number"
                      style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.45rem 0.65rem", fontSize: "0.875rem", color: "var(--navy)" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Customer Address
                    </label>
                    <input
                      value={orderForm.customer_address}
                      onChange={(e) => setOrderForm((prev) => ({ ...prev, customer_address: e.target.value, address: e.target.value }))}
                      placeholder="Address"
                      style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.45rem 0.65rem", fontSize: "0.875rem", color: "var(--navy)" }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Delivery Address
                </label>
                <input
                  value={orderForm.address}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Order delivery address"
                  style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.45rem 0.65rem", fontSize: "0.875rem", color: "var(--navy)" }}
                />
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ padding: "0.75rem 0.875rem", borderBottom: "1px solid var(--border)", background: "#FAFAFA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "var(--navy)" }}>Order Items</p>
                  <button
                    type="button"
                    onClick={addItemRow}
                    style={{ padding: "0.3rem 0.6rem", borderRadius: 4, border: "1px solid var(--border)", background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}
                  >
                    + Add Item
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem" }}>
                  {orderForm.items.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2.2fr 0.8fr 0.9fr 1.5fr auto", gap: "0.5rem", alignItems: "center" }}>
                      <select
                        value={item.food_id}
                        onChange={(e) => updateItemRow(idx, "food_id", e.target.value)}
                        required
                        style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.4rem 0.55rem", fontSize: "0.8125rem", color: "var(--navy)" }}
                      >
                        <option value="">Select item</option>
                        {menuItems.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemRow(idx, "quantity", e.target.value)}
                        required
                        placeholder="Qty"
                        style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.4rem 0.55rem", fontSize: "0.8125rem", color: "var(--navy)" }}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItemRow(idx, "price", e.target.value)}
                        required
                        placeholder="Price"
                        style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.4rem 0.55rem", fontSize: "0.8125rem", color: "var(--navy)" }}
                      />
                      <input
                        value={item.remark}
                        onChange={(e) => updateItemRow(idx, "remark", e.target.value)}
                        placeholder="Remark"
                        style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "0.4rem 0.55rem", fontSize: "0.8125rem", color: "var(--navy)" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={orderForm.items.length === 1}
                        style={{
                          border: "1px solid #FECACA",
                          background: "#FFF5F5",
                          color: "#B91C1C",
                          borderRadius: 4,
                          cursor: orderForm.items.length === 1 ? "not-allowed" : "pointer",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          opacity: orderForm.items.length === 1 ? 0.5 : 1,
                          padding: "0.35rem 0.5rem",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {createError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "0.75rem 0.875rem", color: "#991B1B", fontSize: "0.8125rem" }}>
                  {createError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", borderTop: "1px solid var(--border)", paddingTop: "0.85rem" }}>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  style={{ padding: "0.45rem 1rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: "0.875rem", color: "var(--navy)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  style={{ padding: "0.45rem 1.1rem", border: "none", borderRadius: 4, background: "#C52031", color: "#fff", cursor: createSaving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 700, opacity: createSaving ? 0.7 : 1 }}
                >
                  {createSaving ? "Creating..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
