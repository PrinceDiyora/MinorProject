import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtDate(d) {
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function fmtTime(d) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

export default function TopNavbar({ setMobileOpen }) {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const firstName = user?.name ? user.name.split(" ")[0] : "Admin";

  return (
    <header style={{
      height: 60,
      background: "#fff",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 1.5rem",
      position: "sticky",
      top: 0,
      zIndex: 20,
      flexShrink: 0
    }}>
      {/* Left — mobile menu + greeting */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            display: "none", alignItems: "center", justifyContent: "center",
            color: "var(--text-muted)", padding: "0.25rem"
          }}
          className="mobile-menu-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Greeting + date */}
        <div style={{ lineHeight: 1.3 }}>
          <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)", margin: 0 }}>
            {greeting()}, {firstName} 👋
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
            {fmtDate(now)}
          </p>
        </div>
      </div>

      {/* Right — live clock + user chip */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        {/* Live clock */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: 6, padding: "0.3rem 0.75rem"
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
          </svg>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--navy)", fontVariantNumeric: "tabular-nums", letterSpacing: "0.01em" }}>
            {fmtTime(now)}
          </span>
        </div>

        {/* User chip */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{
            width: 32, height: 32, background: "#C52031", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "0.75rem", fontWeight: 700
          }}>
            {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : "AD"}
          </div>
          <div style={{ lineHeight: 1 }}>
            <p style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--navy)" }}>
              {user?.name || "Admin"}
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem" }}>
              {user?.restaurant_name || "BOH Manager"}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) { .mobile-menu-btn { display: flex !important; } }
      `}</style>
    </header>
  );
}
