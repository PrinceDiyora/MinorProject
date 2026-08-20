const PILLARS = [
  {
    label: "Contribution Margin",
    desc: "Selling Price minus Food Cost at item level — the true profitability signal"
  },
  {
    label: "Popularity Scoring",
    desc: "Real-time velocity tracking based on order frequency (last 7 days)"
  },
  {
    label: "Hidden Stars",
    desc: "Detect high-margin but under-promoted items silently missing revenue"
  },
  {
    label: "Risk Detection",
    desc: "Flag low-margin high-volume items eroding overall profitability"
  },
  {
    label: "Combo Engine",
    desc: "Association analysis to recommend smart bundles that lift AOV"
  },
  {
    label: "Price Optimization",
    desc: "Data-driven pricing recommendations aligned to demand and margin"
  },
];

const PIPELINE = [
  { num: "01", title: "Voice Capture", desc: "Natural language call recording with speech-to-text transcription" },
  { num: "02", title: "Intent Mapping", desc: "Item recognition + modifier & customization parsing against PoS database" },
  { num: "03", title: "Clarify & Upsell", desc: "Ambiguity resolution + real-time upsell suggestions from revenue engine" },
  { num: "04", title: "Confirm & Push", desc: "Order summary confirmation → structured JSON → PoS + auto KOT" },
];

export default function Features() {
  return (
    <>
      {/* ─── Module 01 Features ─── */}
      <section id="module-01" style={{ background: "#fff", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.75rem" }}>
            Module 01 · Revenue Intelligence & Menu Optimization
          </p>
          <hr className="editorial-divider" style={{ marginBottom: "3rem" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }} className="features-grid">
            {PILLARS.map((p, i) => (
              <div key={p.label} style={{
                padding: "2rem 1.5rem",
                borderTop: "1px solid var(--border)",
                borderRight: (i % 3 !== 2) ? "1px solid var(--border)" : "none",
              }}>
                <h3 style={{ fontWeight: 700, fontSize: "1.0625rem", color: "var(--navy)", marginBottom: "0.875rem" }}>
                  {p.label}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.65 }}>
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Module 02 Features ─── */}
      <section id="module-02" style={{ background: "var(--navy)", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p className="section-label" style={{ color: "#6B7280", marginBottom: "0.75rem" }}>
            Module 02 · AI Voice Ordering Copilot
          </p>
          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: "0.75rem" }} />
          <p style={{ color: "#6B7280", fontSize: "0.875rem", fontStyle: "italic", marginBottom: "3.5rem" }}>
            (Custom NLP / voice pipeline — no external AI API)
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }} className="pipeline-grid">
            {PIPELINE.map((step, i) => (
              <div key={step.num} style={{
                padding: "0 2rem 2rem 0",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: "1.75rem",
                position: "relative"
              }}>
                {/* Number */}
                <div style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "3.5rem",
                  color: i === 0 ? "var(--brand-red)" : "rgba(255,255,255,0.15)",
                  lineHeight: 1,
                  marginBottom: "1rem"
                }}>
                  {step.num}
                </div>
                {/* Arrow */}
                {i < 3 && (
                  <span style={{
                    position: "absolute", top: "calc(1.75rem + 1.75rem)", right: "0.5rem",
                    color: "rgba(255,255,255,0.3)", fontSize: "1.25rem"
                  }}>→</span>
                )}
                <h3 style={{ fontWeight: 700, fontSize: "1.0625rem", color: "#fff", marginBottom: "0.875rem" }}>
                  {step.title}
                </h3>
                <p style={{ color: "#6B7280", fontSize: "0.875rem", lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Language strip */}
          <div style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", gap: "0.5rem",
            flexWrap: "wrap"
          }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              Language Support
            </span>
            {["English", "Hindi", "Hinglish", "+ Regional Languages (bonus)"].map((lang, i) => (
              <span key={lang} style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.875rem" }}>
                {i > 0 && <span style={{ marginRight: "0.5rem", opacity: 0.3 }}>·</span>}
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .features-grid > div { border-right: 1px solid var(--border) !important; }
          .features-grid > div:nth-child(2n) { border-right: none !important; }
          .pipeline-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .features-grid > div { border-right: none !important; }
          .pipeline-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
