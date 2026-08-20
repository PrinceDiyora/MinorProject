import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import { useAuth } from "../../context/AuthContext";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--surface)", fontFamily: "'Roboto', sans-serif", color: "var(--navy)" }}>
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(9,22,31,0.5)",
            zIndex: 40, backdropFilter: "blur(4px)"
          }}
        />
      )}

      {/* Sidebar — desktop fixed, mobile overlay */}
      <div style={{
        position: "fixed", top: 0, left: 0, height: "100vh",
        zIndex: 50,
        transform: mobileOpen ? "translateX(0)" : undefined
      }} className={`sidebar-wrapper ${mobileOpen ? "mobile-open" : ""}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        marginLeft: collapsed ? 64 : 240,
        transition: "margin-left 0.25s ease",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh"
      }} className="main-content">
        <TopNavbar setMobileOpen={setMobileOpen} />
        <main style={{ flex: 1, padding: "2rem", maxWidth: 1440, width: "100%" }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .sidebar-wrapper { transform: translateX(-100%) !important; }
          .sidebar-wrapper.mobile-open { transform: translateX(0) !important; }
          .main-content { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
