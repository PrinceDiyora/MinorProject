const BADGE_CONFIGS = {
  "Hidden Star": { code: "HS", bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  "Risk Flag": { code: "RF", bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  "Combo": { code: "CB", bg: "#EDE9FE", color: "#5B21B6", border: "#DDD6FE" },
  "Price Lift": { code: "PL", bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
  "Slow Mover": { code: "SM", bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" },
};

export default function AISuggestionCard({ type, title, suggestion, impact }) {
  const cfg = BADGE_CONFIGS[type] || BADGE_CONFIGS["Combo"];

  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: 6,
      padding: "1.25rem 1.5rem",
      borderLeft: `4px solid ${cfg.border}`,
      transition: "box-shadow 0.15s"
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      {/* Badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.375rem",
          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          borderRadius: 3, padding: "0.2rem 0.625rem",
          fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase"
        }}>
          {cfg.code} · {type}
        </span>
        {impact && (
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--success)" }}>
            {impact}
          </span>
        )}
      </div>

      <h4 style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--navy)", marginBottom: "0.5rem" }}>
        {title}
      </h4>
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1rem" }}>
        {suggestion}
      </p>

      <button
        className="btn-primary"
        style={{ padding: "0.375rem 0.875rem", minHeight: 36, fontSize: "0.8rem", background: "var(--navy)" }}
        onMouseEnter={e => e.currentTarget.style.background = "#0d1f2e"}
        onMouseLeave={e => e.currentTarget.style.background = "var(--navy)"}
      >
        Review & Deploy →
      </button>
    </div>
  );
}
