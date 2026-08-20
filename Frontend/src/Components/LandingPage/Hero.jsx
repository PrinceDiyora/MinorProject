import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section style={{ background: "var(--surface)", paddingTop: 64, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "6rem 1.5rem 4rem", width: "100%" }}>

        {/* Section label */}
        <p className="section-label" style={{ marginBottom: "1.25rem", color: "var(--text-muted)" }}>
          The Solution
        </p>
        <hr className="editorial-divider" style={{ marginBottom: "2.5rem" }} />

        {/* Main headline */}
        <h1 className="serif fade-up delay-1" style={{
          fontSize: "clamp(2.75rem, 6vw, 5rem)",
          lineHeight: 1.05,
          color: "var(--navy)",
          fontWeight: 400,
          maxWidth: 720,
          marginBottom: "1rem",
          letterSpacing: "-0.02em"
        }}>
          Two modules.<br />
          One intelligent system.
        </h1>

        {/* Red accent bar */}
        <div style={{ width: 40, height: 3, background: "var(--brand-red)", marginBottom: "3rem" }} />

        {/* Two-column module cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }} className="hero-modules">
          {/* Module 01 */}
          <div style={{ borderRight: "1px solid var(--border)", paddingRight: "3rem", paddingBottom: "3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div style={{ width: 24, height: 2, background: "var(--brand-red)" }} />
              <span className="section-label">Module 01</span>
            </div>
            <h2 style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: "1.5rem", color: "var(--navy)", marginBottom: "1rem", lineHeight: 1.2 }}>
              Revenue Intelligence<br />& Menu Optimization
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", lineHeight: 1.65 }}>
              Contribution margin · Sales velocity · Hidden stars<br />
              Combo engine · Price optimization
            </p>
          </div>

          {/* Module 02 */}
          <div style={{ paddingLeft: "3rem", paddingBottom: "3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div style={{ width: 24, height: 2, background: "var(--navy)" }} />
              <span className="section-label" style={{ color: "var(--text-muted)" }}>Module 02</span>
            </div>
            <h2 style={{ fontFamily: "'Roboto', sans-serif", fontWeight: 700, fontSize: "1.5rem", color: "var(--navy)", marginBottom: "1rem", lineHeight: 1.2 }}>
              AI Voice Ordering<br />Copilot
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9375rem", lineHeight: 1.65 }}>
              Speech-to-text · Intent mapping · Multi-language<br />
              Real-time upsell · JSON → PoS push
            </p>
          </div>
        </div>

        {/* Bottom CTA strip */}
        <hr className="editorial-divider" style={{ marginTop: "0.5rem", marginBottom: "2.5rem" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <Link to="/register" className="btn-primary">
            Request Access
          </Link>
          <Link to="/login" className="btn-outline">
            Sign In to Dashboard
          </Link>
          <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: "0.8125rem" }}>
            Petpooja Hackathon 2026 · Track: AI-Powered Revenue & Voice Copilot
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hero-modules { grid-template-columns: 1fr !important; }
          .hero-modules > div:first-child { border-right: none !important; padding-right: 0 !important; border-bottom: 1px solid var(--border); padding-bottom: 2rem !important; margin-bottom: 2rem; }
          .hero-modules > div:last-child { padding-left: 0 !important; }
        }
      `}</style>
    </section>
  );
}
