import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  { heading: "Product", links: ["Revenue Dashboard", "Menu Matrix", "Combo Engine", "Price Optimizer", "Voice Settings"] },
  { heading: "Platform", links: ["Architecture", "Data Privacy", "Security", "Integrations"] },
  { heading: "Hackathon", links: ["Problem Statement", "Blueprint v3.0", "Build Checklist", "Judging Criteria"] },
];

export default function Footer() {
  return (
    <footer style={{ background: "#060d16", padding: "4rem 1.5rem 2rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "3rem", marginBottom: "3rem" }} className="footer-grid">
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
              <div style={{ width: 28, height: 28, background: "#C52031", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h18M3 9h18M3 15h10M3 21h10M17 15l3 3-3 3" />
                </svg>
              </div>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1rem", color: "#fff" }}>RasoiAI</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.875rem", lineHeight: 1.65, maxWidth: 260 }}>
              AI-powered revenue intelligence and voice ordering for modern restaurants. Built for the Petpooja Hackathon 2026.
            </p>
          </div>

          {FOOTER_LINKS.map(({ heading, links }) => (
            <div key={heading}>
              <h5 style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>
                {heading}
              </h5>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {links.map(link => (
                  <li key={link} style={{ marginBottom: "0.625rem" }}>
                    <a href="#" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.875rem", textDecoration: "none", transition: "color 0.2s" }}
                      onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.7)"}
                      onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.3)"}
                    >{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.8125rem" }}>
            © 2026 RasoiAI. Petpooja Hackathon · Track: AI-Powered Revenue & Voice Copilot
          </p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <Link to="/login" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.8125rem", textDecoration: "none" }}>Dashboard</Link>
            <Link to="/register" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.8125rem", textDecoration: "none" }}>Register</Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .footer-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 600px) { .footer-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  );
}
