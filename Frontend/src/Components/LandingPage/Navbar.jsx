import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      background: scrolled ? "rgba(244,246,248,0.96)" : "transparent",
      borderBottom: scrolled ? "1px solid #E2E6EA" : "none",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      transition: "all 0.25s ease"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 1.5rem", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, background: "#C52031", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18M3 9h18M3 15h10M3 21h10M17 15l3 3-3 3" />
            </svg>
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.125rem", color: "#09161F", letterSpacing: "-0.01em" }}>
            KitchenAI
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="desktop-nav">
          {["Features", "Module 01", "Module 02"].map(item => (
            <a key={item} href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              style={{ color: "#6B7280", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => e.target.style.color = "#09161F"}
              onMouseLeave={e => e.target.style.color = "#6B7280"}
            >{item}</a>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/login" style={{ color: "#09161F", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none", padding: "0.5rem 1rem" }}>
            Log in
          </Link>
          <Link to="/register" className="btn-primary" style={{ padding: "0.5rem 1.25rem", minHeight: 36, fontSize: "0.8125rem" }}>
            Get Access →
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .desktop-nav { display: none !important; } }
      `}</style>
    </nav>
  );
}
