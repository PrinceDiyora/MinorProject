const REQUIREMENTS = {
  core: [
    "Contribution margin & item profitability analysis",
    "Sales velocity & popularity classification",
    "High-margin under-promoted item detection",
    "Combo recommendation via association analysis",
    "Voice order capture with speech-to-text",
    "Intent recognition & PoS item mapping",
    "Multi-language support (English, Hindi, Hinglish)",
    "Structured JSON order → PoS push",
  ],
  bonus: [
    "Regional language support beyond Hinglish",
    "Inventory-linked performance signals",
    "Smart upsell prioritization during voice call",
    "Price optimization recommendations",
    "Ambiguity clarification during ordering",
    "Modifier handling (size, spice, add-ons)",
    "Automatic KOT creation post-order",
  ],
};

export default function Testimonials() {
  return (
    <section id="features" style={{ background: "var(--surface)", padding: "5rem 1.5rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          What You'll Build
        </p>
        <hr className="editorial-divider" style={{ marginBottom: "3.5rem" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }} className="req-grid">
          {/* Core */}
          <div style={{ borderRight: "1px solid var(--border)", paddingRight: "3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem" }}>
              <div style={{ width: 24, height: 2, background: "var(--brand-red)" }} />
              <span className="section-label">Core Requirements</span>
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {REQUIREMENTS.core.map((item, i) => (
                <li key={i} style={{ display: "flex", gap: "1.25rem", marginBottom: "1.125rem", alignItems: "flex-start" }}>
                  <span style={{ color: "var(--brand-red)", fontWeight: 700, fontSize: "0.875rem", minWidth: "1.5rem", paddingTop: "0.05rem" }}>
                    {i + 1}.
                  </span>
                  <span style={{ color: "var(--text-primary)", fontSize: "0.9375rem", lineHeight: 1.55 }}>
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Bonus */}
          <div style={{ paddingLeft: "3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem" }}>
              <div style={{ width: 24, height: 2, background: "var(--border)" }} />
              <span className="section-label" style={{ color: "var(--text-muted)" }}>Bonus Features</span>
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {REQUIREMENTS.bonus.map((item, i) => (
                <li key={i} style={{ display: "flex", gap: "1.25rem", marginBottom: "1.125rem", alignItems: "flex-start" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: "0.875rem", minWidth: "1.5rem", paddingTop: "0.05rem" }}>
                    {i + 1}.
                  </span>
                  <span style={{ color: "var(--text-primary)", fontSize: "0.9375rem", lineHeight: 1.55 }}>
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .req-grid { grid-template-columns: 1fr !important; }
          .req-grid > div:first-child { border-right: none !important; padding-right: 0 !important; border-bottom: 1px solid var(--border); padding-bottom: 2.5rem !important; margin-bottom: 2.5rem; }
          .req-grid > div:last-child { padding-left: 0 !important; }
        }
      `}</style>
    </section>
  );
}
