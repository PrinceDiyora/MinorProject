export default function MetricCard({ title, value, change, isPositive, icon }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--border)",
      borderTop: "3px solid var(--brand-red)",
      borderRadius: 6,
      padding: "1.25rem 1.5rem"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.875rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {title}
        </span>
        {icon && (
          <span style={{ color: "var(--brand-red)", opacity: 0.7 }}>{icon}</span>
        )}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--navy)", lineHeight: 1.1, marginBottom: "0.5rem" }}>
        {value}
      </div>
      {change !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <span style={{
            fontSize: "0.8125rem", fontWeight: 700,
            color: isPositive ? "var(--success)" : "#EF4444"
          }}>
            {isPositive ? "▲" : "▼"} {Math.abs(change)}%
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>vs yesterday</span>
        </div>
      )}
    </div>
  );
}
