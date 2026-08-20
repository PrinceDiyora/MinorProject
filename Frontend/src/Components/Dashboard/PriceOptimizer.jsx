import { useState, useEffect, useCallback } from "react";
import { pricingAPI, foodItemsAPI } from "../../services/api.js";

// ─── Status pill ──────────────────────────────────────────────────────────────
function DirectionPill({ direction }) {
    const increase = direction === "increase";
    return (
        <span style={{
            display: "inline-block",
            padding: "0.2rem 0.6rem",
            borderRadius: 3,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.03em",
            background: increase ? "#DCFCE7" : "#FEF2F2",
            color: increase ? "#166534" : "#991B1B",
        }}>
            {increase ? "INCREASE" : "DECREASE"}
        </span>
    );
}

// ─── Context bar (current hour / weekend) ────────────────────────────────────
function ContextBar({ totalItems, suggestedCount }) {
    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const fmt = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const peak = (hour >= 11 && hour <= 14) || (hour >= 19 && hour <= 22);

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1rem",
            marginBottom: "1.5rem",
        }} className="ctx-grid">
            {[
                { label: "Current Time", value: fmt },
                { label: "Peak Hours", value: peak ? "Active" : "None" },
                { label: "Weekend", value: isWeekend ? "Yes" : "No" },
                { label: "Items Flagged / Total", value: `${suggestedCount} / ${totalItems}` },
            ].map(({ label, value }) => (
                <div key={label} style={{
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "1rem 1.25rem",
                }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>{label}</p>
                    <p style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--navy)" }}>{value}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PriceOptimizer() {
    const [suggestions, setSuggestions] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [applying, setApplying] = useState({});   // { [food_id]: bool }
    const [applied, setApplied] = useState({});   // { [food_id]: bool }
    const [mlOffline, setMlOffline] = useState(false);

    const fetchSuggestions = useCallback(async () => {
        setLoading(true);
        setError(null);
        setMlOffline(false);
        try {
            const res = await pricingAPI.getSuggestions();
            if (res?.data) {
                setSuggestions(res.data.suggestions || []);
                setTotalItems(res.data.total_items || 0);
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || "Failed to load suggestions";
            if (msg.toLowerCase().includes("unavailable") || msg.toLowerCase().includes("503")) {
                setMlOffline(true);
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

    const handleApply = async (item) => {
        setApplying(p => ({ ...p, [item.food_id]: true }));
        try {
            await foodItemsAPI.update(item.food_id, { selling_price: item.suggested_price });
            setApplied(p => ({ ...p, [item.food_id]: true }));
            setSuggestions(prev => prev.filter(s => s.food_id !== item.food_id));
        } catch (err) {
            alert(`Failed to apply price: ${err?.response?.data?.message || err.message}`);
        } finally {
            setApplying(p => ({ ...p, [item.food_id]: false }));
        }
    };

    const handleDismiss = (food_id) => {
        setSuggestions(prev => prev.filter(s => s.food_id !== food_id));
    };

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: "2rem" }}>
                <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    Module 01 · Revenue Intelligence
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>
                        Price Optimizer
                    </h1>
                    <button
                        onClick={fetchSuggestions}
                        disabled={loading}
                        style={{
                            padding: "0.4rem 1rem",
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                            background: "#fff",
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "var(--navy)",
                            cursor: loading ? "not-allowed" : "pointer",
                            opacity: loading ? 0.6 : 1,
                        }}
                    >
                        {loading ? "Running models..." : "Refresh"}
                    </button>
                </div>
            </div>
            <hr className="editorial-divider" style={{ marginBottom: "1.75rem" }} />

            {/* Context bar */}
            <ContextBar totalItems={totalItems} suggestedCount={suggestions.length} />

            {/* ML offline notice */}
            {mlOffline && (
                <div style={{
                    background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6,
                    padding: "1rem 1.25rem", marginBottom: "1.5rem",
                    fontSize: "0.875rem", color: "#92400E"
                }}>
                    The ML service is not reachable. Make sure the Python ML service is running on port 5000, then click Refresh.
                </div>
            )}

            {/* Error */}
            {error && !mlOffline && (
                <div style={{
                    background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6,
                    padding: "1rem 1.25rem", marginBottom: "1.5rem",
                    fontSize: "0.875rem", color: "#991B1B"
                }}>
                    {error}
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ height: 16, width: 200, background: "#f1f5f9", borderRadius: 3 }} />
                    </div>
                    {[1, 2, 3, 4].map(n => (
                        <div key={n} style={{
                            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 3fr 1fr",
                            gap: "1rem", padding: "1rem 1.5rem",
                            borderBottom: "1px solid var(--border)", alignItems: "center"
                        }}>
                            {[180, 60, 60, 60, 260, 80].map((w, i) => (
                                <div key={i} style={{ height: 14, width: w, background: "#f1f5f9", borderRadius: 3 }} />
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* No suggestions */}
            {!loading && !error && !mlOffline && suggestions.length === 0 && (
                <div style={{
                    background: "#fff", border: "1px solid var(--border)", borderRadius: 6,
                    padding: "3rem 2rem", textAlign: "center"
                }}>
                    <p style={{ fontWeight: 700, color: "var(--navy)", marginBottom: "0.5rem" }}>
                        All prices are currently optimal
                    </p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        Engine 3 found no items that would benefit from a price change based on current demand and margin data.
                    </p>
                </div>
            )}

            {/* Suggestions table */}
            {!loading && suggestions.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                        padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "space-between"
                    }}>
                        <div>
                            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>
                                Price Recommendations
                            </h3>
                            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                                Engine 3 — strategic pricing, three-stage cascade model. Prices are clamped to catalogue min/max bounds.
                            </p>
                        </div>
                        <span style={{
                            background: "var(--brand-red)", color: "#fff",
                            borderRadius: 20, padding: "0.2rem 0.7rem",
                            fontSize: "0.75rem", fontWeight: 700,
                        }}>
                            {suggestions.length} item{suggestions.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table className="data-table" style={{ minWidth: 860 }}>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Quadrant</th>
                                    <th>7d Orders</th>
                                    <th>Current</th>
                                    <th>Suggested</th>
                                    <th>Direction</th>
                                    <th style={{ minWidth: 260 }}>Reason</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suggestions.map(s => {
                                    const deltaStr = `${s.delta >= 0 ? "+" : ""}₹${Math.abs(s.delta).toFixed(2)}`;
                                    const isApplying = applying[s.food_id];
                                    return (
                                        <tr key={s.food_id}>
                                            <td style={{ fontWeight: 700 }}>{s.name}</td>
                                            <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>{s.category}</td>
                                            <td style={{ fontSize: "0.8125rem" }}>
                                                <span style={{
                                                    display: "inline-block",
                                                    padding: "0.15rem 0.5rem",
                                                    borderRadius: 3,
                                                    background: "var(--surface)",
                                                    border: "1px solid var(--border)",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    color: "var(--navy)",
                                                }}>
                                                    {s.quadrant_name ?? "—"}
                                                </span>
                                            </td>
                                            <td style={{ fontFamily: "monospace", textAlign: "right" }}>
                                                {s.demand_7d ?? 0}
                                            </td>
                                            <td style={{ fontFamily: "monospace" }}>
                                                ₹{s.current_price.toFixed(2)}
                                            </td>
                                            <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                                                ₹{s.suggested_price.toFixed(2)}
                                                <span style={{
                                                    marginLeft: 6,
                                                    fontWeight: 700,
                                                    fontSize: "0.8rem",
                                                    color: s.direction === "increase" ? "var(--success)" : "var(--brand-red)"
                                                }}>
                                                    ({deltaStr})
                                                </span>
                                            </td>
                                            <td>
                                                <DirectionPill direction={s.direction} />
                                            </td>
                                            <td style={{
                                                color: "var(--text-muted)",
                                                fontSize: "0.8125rem",
                                                lineHeight: 1.5,
                                                maxWidth: 280,
                                            }}>
                                                {s.reason}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                                    <button
                                                        onClick={() => handleApply(s)}
                                                        disabled={isApplying}
                                                        className="btn-primary"
                                                        style={{
                                                            padding: "0.25rem 0.75rem",
                                                            minHeight: 32,
                                                            fontSize: "0.8rem",
                                                            opacity: isApplying ? 0.6 : 1,
                                                            cursor: isApplying ? "not-allowed" : "pointer",
                                                        }}
                                                    >
                                                        {isApplying ? "Applying..." : "Apply"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDismiss(s.food_id)}
                                                        style={{
                                                            padding: "0.25rem 0.5rem",
                                                            border: "1px solid var(--border)",
                                                            borderRadius: 4,
                                                            background: "#fff",
                                                            fontSize: "0.75rem",
                                                            color: "var(--text-muted)",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Dismiss
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer note */}
                    <div style={{
                        padding: "0.875rem 1.5rem",
                        borderTop: "1px solid var(--border)",
                        background: "var(--surface)",
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                    }}>
                        Applying a price updates the selling price immediately in the database. Only items with a delta of at least Rs. 0.50 are shown.
                    </div>
                </div>
            )}

            <style>{`
                @media (max-width: 900px) { .ctx-grid { grid-template-columns: 1fr 1fr !important; } }
                @media (max-width: 500px)  { .ctx-grid { grid-template-columns: 1fr !important; } }
            `}</style>
        </div>
    );
}
