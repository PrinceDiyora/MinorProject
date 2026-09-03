import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Roboto', sans-serif" }}>
      {/* Left — Brand Panel */}
      <div style={{
        flex: "0 0 45%",
        background: "var(--navy)",
        padding: "4rem 3.5rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }} className="auth-brand">
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.625rem", textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, background: "#C52031", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h18M3 9h18M3 15h10M3 21h10M17 15l3 3-3 3" />
            </svg>
          </div>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.125rem", color: "#fff" }}>KitchenAI</span>
        </Link>

        <div>
          <h1 className="serif" style={{
            fontSize: "clamp(2rem, 3.5vw, 3rem)", color: "#fff",
            fontWeight: 400, lineHeight: 1.1, marginBottom: "1.5rem"
          }}>
            Revenue intelligence<br />for restaurants.
          </h1>
          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: "2rem" }} />

          {/* Module highlights */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {[
              { label: "Module 01", title: "Revenue Intelligence & Menu Optimization", items: ["Contribution margin", "Hidden star detection", "Price optimization"] },
              { label: "Module 02", title: "AI Voice Ordering Copilot", items: ["Speech-to-text", "Intent mapping", "Auto KOT"] },
            ].map(m => (
              <div key={m.label}>
                <span className="section-label" style={{ color: "#C52031", fontSize: "0.625rem" }}>{m.label}</span>
                <p style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: "0.9375rem", margin: "0.375rem 0 0.375rem" }}>
                  {m.title}
                </p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.8125rem" }}>
                  {m.items.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.8125rem" }}>
          Petpooja Hackathon 2026
        </p> */}
      </div>

      {/* Right — Form */}
      <div style={{
        flex: 1,
        background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "3rem 2rem"
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.5rem" }}>
            Welcome back
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>
            Sign in to your BOH dashboard.
          </p>

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA",
              color: "#B91C1C", fontSize: "0.875rem", padding: "0.75rem 1rem",
              borderRadius: 4, marginBottom: "1.25rem"
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.5rem" }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="owner@restaurant.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                required
                className="input-field"
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--navy)" }}>Password</label>
                <a href="#" style={{ fontSize: "0.8125rem", color: "var(--brand-red)", textDecoration: "none" }}>Forgot?</a>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                required
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", marginTop: "0.5rem", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Signing in…" : "Sign In to Dashboard →"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "2rem" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "var(--brand-red)", fontWeight: 700, textDecoration: "none" }}>
              Register
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .auth-brand { display: none !important; }
        }
      `}</style>
    </div>
  );
}
