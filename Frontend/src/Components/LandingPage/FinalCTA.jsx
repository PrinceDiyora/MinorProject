import { Link } from "react-router-dom";

export default function FinalCTA() {
  return (
    <section style={{ background: "var(--navy)", padding: "6rem 1.5rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: "3.5rem" }} />

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "2rem" }}>
          <div>
            <h2 className="serif" style={{
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              color: "#fff",
              fontWeight: 400,
              lineHeight: 1.1,
              marginBottom: "1rem",
              maxWidth: 560
            }}>
              Revenue intelligence,<br />automated.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9375rem", maxWidth: 460 }}>
              Two AI modules, one unified platform — from voice ordering to margin analysis.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap" }}>
            <Link to="/register" className="btn-primary" style={{ background: "var(--brand-red)" }}>
              Request Access
            </Link>
            <Link to="/login" style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "0.75rem 1.5rem", minHeight: 48,
              color: "rgba(255,255,255,0.6)",
              border: "1.5px solid rgba(255,255,255,0.15)",
              borderRadius: 4,
              fontWeight: 500, fontSize: "0.875rem",
              textDecoration: "none",
              transition: "border-color 0.2s, color 0.2s"
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
