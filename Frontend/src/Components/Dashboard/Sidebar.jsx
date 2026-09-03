import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const SIDEBAR_ITEMS = [
  {
    name: "AI Revenue Dashboard",
    path: "/dashboard",
    exact: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    )
  },
  {
    name: "Menu & Pricing Matrix",
    path: "/dashboard/menu",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h18M3 9h18M3 15h10M3 21h10M17 15l3 3-3 3" />
      </svg>
    )
  },
  {
    name: "Combo Engine",
    path: "/dashboard/combos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3l4 4-4 4M7 21l-4-4 4-4M14 7H3M21 17H10" />
      </svg>
    )
  },
  {
    name: "Price Optimizer",
    path: "/dashboard/pricing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    )
  },
  {
    name: "Order Details",
    path: "/dashboard/orders",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    )
  },
  {
    name: "Menu Management",
    path: "/dashboard/manage-menu",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" />
      </svg>
    )
  },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (item) => item.exact
    ? location.pathname === item.path
    : location.pathname === item.path || location.pathname.startsWith(item.path + "/");

  return (
    <div style={{
      width: collapsed ? 64 : 240,
      height: "100vh",
      background: "#09161F",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.25s ease",
      flexShrink: 0,
      overflow: "hidden"
    }}>
      {/* Logo */}
      <div style={{
        height: 60, display: "flex", alignItems: "center",
        padding: collapsed ? "0 1rem" : "0 1.25rem",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", overflow: "hidden", whiteSpace: "nowrap" }}>
          <div style={{ width: 28, height: 28, background: "#C52031", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18M3 9h18M3 15h10M3 21h10M17 15l3 3-3 3" />
            </svg>
          </div>
          {!collapsed && (
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1rem", color: "#fff", letterSpacing: "-0.01em" }}>
              KitchenAI
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "1rem 0", overflowY: "auto", overflowX: "hidden" }}>
        {SIDEBAR_ITEMS.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.name : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.625rem 1.25rem",
                margin: "0.125rem 0",
                textDecoration: "none",
                color: active ? "#C52031" : "rgba(255,255,255,0.45)",
                background: active ? "rgba(197,32,49,0.08)" : "transparent",
                borderLeft: active ? "3px solid #C52031" : "3px solid transparent",
                fontWeight: active ? 700 : 400,
                fontSize: "0.875rem",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                overflow: "hidden"
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.background = "transparent"; } }}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User + collapse */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "0.875rem 1.25rem", flexShrink: 0 }}>
        {!collapsed && user && (
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8125rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name || "Admin"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.restaurant_name || "Restaurant"}
            </p>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.3)", padding: "0.375rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, transition: "color 0.15s, background 0.15s"
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; e.currentTarget.style.background = "transparent"; }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed
                ? <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                : <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />}
            </svg>
          </button>
          {!collapsed && (
            <button
              onClick={logout}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.3)", padding: "0.375rem 0.625rem",
                fontSize: "0.75rem", fontWeight: 500, fontFamily: "'Roboto', sans-serif",
                borderRadius: 4, transition: "color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#C52031"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
