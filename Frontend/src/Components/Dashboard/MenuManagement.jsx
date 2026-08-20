import { useState, useEffect, useRef } from "react";
import { foodItemsAPI, categoriesAPI } from "../../services/api";

// ─── small helpers ────────────────────────────────────────────────────────────
const fmt = (v) => parseFloat(v || 0).toFixed(2);

const EMPTY_ITEM = {
  category_id: "",
  name: "",
  cost_price: "",
  selling_price: "",
  min_price: "",
  max_price: "",
  quantity: "",
  discount_percent: "0",
  competitor_price_idx: "1",
  is_available: true,
};

const EMPTY_CAT = { name: "", description: "" };

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 8, width: "100%", maxWidth: 540,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1.125rem 1.5rem", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <h3 style={{ fontWeight: 700, color: "var(--navy)", fontSize: "1rem", margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.25rem", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "1.5rem" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────
function Field({ label, required, children, half }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: half ? "1 1 45%" : "1 1 100%" }}>
      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}{required && <span style={{ color: "#C52031" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  border: "1px solid var(--border)", borderRadius: 4, padding: "0.45rem 0.65rem",
  fontSize: "0.875rem", color: "var(--navy)", outline: "none", width: "100%",
  boxSizing: "border-box", fontFamily: "inherit",
};

// ─── Item form (Add / Edit) ───────────────────────────────────────────────────
function ItemForm({ initial, categories, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* name + category */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Field label="Item Name" required>
          <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="e.g. Paneer Tikka" />
        </Field>
        <Field label="Category" required half>
          <select style={inputStyle} value={form.category_id} onChange={(e) => set("category_id", e.target.value)} required>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      {/* prices */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Field label="Cost Price (₹)" required half>
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} required placeholder="0.00" />
        </Field>
        <Field label="Selling Price (₹)" required half>
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} required placeholder="0.00" />
        </Field>
        <Field label="Min Price (₹)" required half>
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.min_price} onChange={(e) => set("min_price", e.target.value)} required placeholder="0.00" />
        </Field>
        <Field label="Max Price (₹)" required half>
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.max_price} onChange={(e) => set("max_price", e.target.value)} required placeholder="0.00" />
        </Field>
      </div>

      {/* quantity + discount */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Field label="Quantity / Stock" half>
          <input style={inputStyle} type="number" min="0" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Discount %" half>
          <input style={inputStyle} type="number" min="0" max="100" step="0.1" value={form.discount_percent} onChange={(e) => set("discount_percent", e.target.value)} placeholder="0" />
        </Field>
      </div>


      {/* available toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--navy)" }}>Available on menu</label>
        <button
          type="button"
          onClick={() => set("is_available", !form.is_available)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: form.is_available ? "#16a34a" : "#d1d5db",
            position: "relative", transition: "background 0.2s",
          }}
        >
          <span style={{
            position: "absolute", top: 3, left: form.is_available ? 22 : 2,
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </button>
        <span style={{ fontSize: "0.8125rem", color: form.is_available ? "#16a34a" : "var(--text-muted)" }}>
          {form.is_available ? "Yes" : "No"}
        </span>
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onClose} style={{ padding: "0.45rem 1.1rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: "0.875rem", color: "var(--navy)" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving} style={{ padding: "0.45rem 1.25rem", border: "none", borderRadius: 4, background: "#C52031", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save Item"}
        </button>
      </div>
    </form>
  );
}

// ─── Category form ────────────────────────────────────────────────────────────
function CategoryForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <Field label="Category Name" required>
        <input style={inputStyle} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required placeholder="e.g. Starters" />
      </Field>
      <Field label="Description (optional)">
        <textarea
          style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
          value={form.description || ""}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Short description…"
        />
      </Field>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onClose} style={{ padding: "0.45rem 1.1rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: "0.875rem", color: "var(--navy)" }}>Cancel</button>
        <button type="submit" disabled={saving} style={{ padding: "0.45rem 1.25rem", border: "none", borderRadius: 4, background: "#C52031", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "Save Category"}
        </button>
      </div>
    </form>
  );
}

// ─── Confirm delete ───────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Delete" onClose={onClose}>
      <p style={{ color: "var(--navy)", fontSize: "0.9375rem", marginBottom: "1.5rem" }}>{message}</p>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "0.45rem 1.1rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: "0.45rem 1.25rem", border: "none", borderRadius: 4, background: "#C52031", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>Delete</button>
      </div>
    </Modal>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }) {
  return (
    <div style={{
      position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 2000,
      background: ok ? "#16a34a" : "#C52031", color: "#fff",
      padding: "0.65rem 1.25rem", borderRadius: 6, fontSize: "0.875rem",
      fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      animation: "slideUp 0.25s ease",
    }}>
      {msg}
      <style>{`@keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }`}</style>
    </div>
  );
}

// ─── Availability pill toggle ─────────────────────────────────────────────────
function AvailPill({ item, onToggle }) {
  const [busy, setBusy] = useState(false);
  const handle = async (e) => {
    e.stopPropagation();
    setBusy(true);
    await onToggle(item);
    setBusy(false);
  };
  return (
    <button
      onClick={handle}
      disabled={busy}
      title={item.is_available ? "Click to mark unavailable" : "Click to mark available"}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", cursor: busy ? "not-allowed" : "pointer",
        background: item.is_available ? "#16a34a" : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: item.is_available ? 20 : 2,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function MenuManagement() {
  const [tab, setTab] = useState("items"); // "items" | "categories"

  // data
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // search / filter
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  // modals
  const [itemModal, setItemModal] = useState(null);     // null | { mode:"add"|"edit", data }
  const [catModal, setCatModal] = useState(null);       // null | { mode:"add"|"edit", data }
  const [confirmDel, setConfirmDel] = useState(null);   // null | { type:"item"|"cat", id, label }

  // saving state
  const [saving, setSaving] = useState(false);

  // toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (msg, ok = true) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── load ──────────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    try {
      const [ir, cr] = await Promise.all([foodItemsAPI.getAll(), categoriesAPI.getAll()]);
      setItems(ir.data || []);
      setCategories(cr.data || []);
    } catch {
      showToast("Failed to load menu data", false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── filtered items ────────────────────────────────────────────────────────
  const visibleItems = items.filter((it) => {
    const matchSearch = it.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || String(it.category_id) === String(filterCat);
    return matchSearch && matchCat;
  });

  // ── item CRUD ─────────────────────────────────────────────────────────────
  const handleSaveItem = async (form) => {
    setSaving(true);
    try {
      const payload = {
        category_id:          Number(form.category_id),
        name:                 form.name,
        cost_price:           parseFloat(form.cost_price),
        selling_price:        parseFloat(form.selling_price),
        min_price:            parseFloat(form.min_price),
        max_price:            parseFloat(form.max_price),
        quantity:             parseInt(form.quantity || 0),
        discount_percent:     parseFloat(form.discount_percent || 0),
        competitor_price_idx: parseFloat(form.competitor_price_idx || 1),
        is_available:         form.is_available,
      };
      if (itemModal.mode === "add") {
        await foodItemsAPI.create(payload);
        showToast("Item added successfully");
      } else {
        await foodItemsAPI.update(itemModal.data.id, payload);
        showToast("Item updated");
      }
      setItemModal(null);
      await loadAll();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save item", false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    try {
      await foodItemsAPI.delete(confirmDel.id);
      showToast("Item removed from menu");
      setConfirmDel(null);
      await loadAll();
    } catch {
      showToast("Failed to delete item", false);
    }
  };

  const handleToggle = async (item) => {
    try {
      const res = await foodItemsAPI.toggleAvailability(item.id);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: res.data?.is_available ?? !item.is_available } : i))
      );
      showToast(res.data?.is_available ? "Marked available" : "Marked unavailable");
    } catch {
      showToast("Toggle failed", false);
    }
  };

  // ── category CRUD ─────────────────────────────────────────────────────────
  const handleSaveCat = async (form) => {
    setSaving(true);
    try {
      if (catModal.mode === "add") {
        await categoriesAPI.create({ name: form.name, description: form.description });
        showToast("Category created");
      } else {
        await categoriesAPI.update(catModal.data.id, { name: form.name, description: form.description });
        showToast("Category updated");
      }
      setCatModal(null);
      await loadAll();
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to save category", false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCat = async () => {
    try {
      await categoriesAPI.delete(confirmDel.id);
      showToast("Category deleted");
      setConfirmDel(null);
      await loadAll();
    } catch (err) {
      showToast(err?.response?.data?.message || "Cannot delete (items may exist)", false);
    }
  };

  // ── open edit item pre-filled ─────────────────────────────────────────────
  const openEditItem = (item) => {
    setItemModal({
      mode: "edit",
      data: item,
    });
  };

  // ─── render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 48, background: "#fff", border: "1px solid var(--border)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.25rem" }}>
          Back-of-House · Menu Control
        </p>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>Menu Management</h1>
      </div>
      <hr className="editorial-divider" style={{ marginBottom: "1.5rem" }} />

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "2px solid var(--border)", marginBottom: "1.5rem", gap: "0" }}>
        {[["items", "Menu Items", items.length], ["categories", "Categories", categories.length]].map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "0.6rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: tab === key ? "#C52031" : "var(--text-muted)",
              borderBottom: tab === key ? "2px solid #C52031" : "2px solid transparent",
              marginBottom: -2,
              transition: "color 0.15s",
            }}
          >
            {label}
            <span style={{
              marginLeft: "0.4rem", fontSize: "0.75rem", fontWeight: 700,
              background: tab === key ? "#C52031" : "#e5e7eb",
              color: tab === key ? "#fff" : "var(--text-muted)",
              borderRadius: 99, padding: "0.1rem 0.45rem",
            }}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── ITEMS TAB ──────────────────────────────────────────────────────── */}
      {tab === "items" && (
        <div>
          {/* toolbar */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items…"
              style={{ ...inputStyle, maxWidth: 240, flex: "1 1 180px" }}
            />
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              style={{ ...inputStyle, maxWidth: 200, flex: "1 1 160px" }}
            >
              <option value="all">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setItemModal({ mode: "add", data: { ...EMPTY_ITEM, category_id: categories[0]?.id || "" } })}
              style={{
                padding: "0.45rem 1rem", background: "#C52031", color: "#fff",
                border: "none", borderRadius: 4, cursor: "pointer",
                fontSize: "0.875rem", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "0.375rem",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Item
            </button>
          </div>

          {/* table */}
          {visibleItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)", fontSize: "0.9375rem" }}>
              {search || filterCat !== "all" ? "No items match your filter." : "No items yet. Click Add Item to get started."}
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["Item Name", "Category", "Cost ₹", "Selling ₹", "Min ₹", "Max ₹", "Qty", "Available", "Actions"].map((h) => (
                        <th key={h} style={{ padding: "0.65rem 0.875rem", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: idx < visibleItems.length - 1 ? "1px solid var(--border)" : "none", transition: "background 0.1s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "0.65rem 0.875rem", fontWeight: 600, color: "var(--navy)" }}>
                          {item.name}
                        </td>
                        <td style={{ padding: "0.65rem 0.875rem", color: "var(--text-muted)" }}>{item.category_name}</td>
                        <td style={{ padding: "0.65rem 0.875rem" }}>₹{fmt(item.cost_price)}</td>
                        <td style={{ padding: "0.65rem 0.875rem", fontWeight: 600, color: "#16a34a" }}>₹{fmt(item.selling_price)}</td>
                        <td style={{ padding: "0.65rem 0.875rem", color: "var(--text-muted)" }}>₹{fmt(item.min_price)}</td>
                        <td style={{ padding: "0.65rem 0.875rem", color: "var(--text-muted)" }}>₹{fmt(item.max_price)}</td>
                        <td style={{ padding: "0.65rem 0.875rem" }}>{item.quantity ?? 0}</td>
                        <td style={{ padding: "0.65rem 0.875rem" }}>
                          <AvailPill item={item} onToggle={handleToggle} />
                        </td>
                        <td style={{ padding: "0.65rem 0.875rem" }}>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            {/* Edit */}
                            <button
                              onClick={() => openEditItem(item)}
                              title="Edit item"
                              style={{ padding: "0.3rem 0.6rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: "pointer", color: "var(--navy)", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z" /></svg>
                              Edit
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setConfirmDel({ type: "item", id: item.id, label: item.name })}
                              title="Remove item"
                              style={{ padding: "0.3rem 0.6rem", border: "1px solid #fecaca", borderRadius: 4, background: "#fff5f5", cursor: "pointer", color: "#C52031", fontSize: "0.75rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "0.65rem 0.875rem", borderTop: "1px solid var(--border)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Showing {visibleItems.length} of {items.length} items
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORIES TAB ────────────────────────────────────────────────── */}
      {tab === "categories" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button
              onClick={() => setCatModal({ mode: "add", data: { ...EMPTY_CAT } })}
              style={{ padding: "0.45rem 1rem", background: "#C52031", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.375rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add Category
            </button>
          </div>

          {categories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No categories yet.</div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
              {categories.map((cat, idx) => {
                const itemCount = items.filter((i) => String(i.category_id) === String(cat.id)).length;
                return (
                  <div
                    key={cat.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "1rem",
                      padding: "0.875rem 1.25rem",
                      borderBottom: idx < categories.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {/* icon */}
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18M3 9h18M3 15h10M3 21h10" /></svg>
                    </div>
                    {/* name + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: "var(--navy)", fontSize: "0.9375rem", margin: 0 }}>{cat.name}</p>
                      {cat.description && <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: "0.125rem 0 0" }}>{cat.description}</p>}
                    </div>
                    {/* item count badge */}
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, background: "#f3f4f6", color: "var(--text-muted)", borderRadius: 99, padding: "0.15rem 0.6rem", whiteSpace: "nowrap" }}>
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </span>
                    {/* actions */}
                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                      <button
                        onClick={() => setCatModal({ mode: "edit", data: cat })}
                        style={{ padding: "0.3rem 0.65rem", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "var(--navy)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDel({ type: "cat", id: cat.id, label: cat.name })}
                        disabled={itemCount > 0}
                        title={itemCount > 0 ? "Remove all items first" : "Delete category"}
                        style={{ padding: "0.3rem 0.65rem", border: "1px solid #fecaca", borderRadius: 4, background: "#fff5f5", cursor: itemCount > 0 ? "not-allowed" : "pointer", fontSize: "0.75rem", fontWeight: 600, color: "#C52031", opacity: itemCount > 0 ? 0.4 : 1 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}
      {itemModal && (
        <Modal title={itemModal.mode === "add" ? "Add Menu Item" : `Edit — ${itemModal.data.name}`} onClose={() => setItemModal(null)}>
          <ItemForm
            initial={itemModal.mode === "add" ? itemModal.data : {
              category_id:          itemModal.data.category_id,
              name:                 itemModal.data.name,
              cost_price:           itemModal.data.cost_price,
              selling_price:        itemModal.data.selling_price,
              min_price:            itemModal.data.min_price,
              max_price:            itemModal.data.max_price,
              quantity:             itemModal.data.quantity,
              discount_percent:     itemModal.data.discount_percent ?? 0,
              competitor_price_idx: itemModal.data.competitor_price_idx ?? 1,
              is_available:         itemModal.data.is_available,
            }}
            categories={categories}
            onSave={handleSaveItem}
            onClose={() => setItemModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {catModal && (
        <Modal title={catModal.mode === "add" ? "Add Category" : `Edit — ${catModal.data.name}`} onClose={() => setCatModal(null)}>
          <CategoryForm
            initial={catModal.data}
            onSave={handleSaveCat}
            onClose={() => setCatModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {confirmDel && (
        <ConfirmModal
          message={`Delete "${confirmDel.label}"? This cannot be undone.`}
          onConfirm={confirmDel.type === "item" ? handleDeleteItem : handleDeleteCat}
          onClose={() => setConfirmDel(null)}
        />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
