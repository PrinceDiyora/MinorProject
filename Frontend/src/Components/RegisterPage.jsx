import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    restaurant_name: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      await register({
        restaurant_name: formData.restaurant_name,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = "text", placeholder }) => (
    <div>
      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.5rem" }}>
        {label}
      </label>
      <input
        type={type} name={name} placeholder={placeholder}
        value={formData[name]} onChange={handleChange}
        disabled={loading} required className="input-field"
      />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Roboto', sans-serif" }}>
      {/* Left — Brand Panel */}
      <div style={{
        flex: "0 0 42%", background: "var(--navy)",
        padding: "4rem 3.5rem", display: "flex", flexDirection: "column", justifyContent: "space-between"
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
          <h1 className="serif" style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)", color: "#fff", fontWeight: 400, lineHeight: 1.15, marginBottom: "1.5rem" }}>
            Join the AI-powered<br />restaurant revolution.
          </h1>
          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: "2rem" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              { icon: "📊", text: "Revenue intelligence from your PoS data" },
              { icon: "🎙️", text: "Voice ordering copilot with Hinglish NLP" },
              { icon: "🌟", text: "Hidden star detection & combo optimization" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                <span style={{ fontSize: "1.125rem", flexShrink: 0, marginTop: "0.125rem" }}>{icon}</span>
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.8125rem" }}>Petpooja Hackathon 2026</p> */}
      </div>

      {/* Right — Form */}
      <div style={{ flex: 1, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 2rem", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.5rem" }}>
            Create your account
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "2rem" }}>
            Register your restaurant for BOH dashboard access.
          </p>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: "0.875rem", padding: "0.75rem 1rem", borderRadius: 4, marginBottom: "1.25rem" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <Field label="Restaurant Name" name="restaurant_name" placeholder="Spice Route QSR" />
              <Field label="Owner Name" name="name" placeholder="Arjun Mehta" />
            </div>
            <Field label="Email Address" name="email" type="email" placeholder="arjun@spiceroute.com" />
            <Field label="Phone Number" name="phone" type="tel" placeholder="+91 98765 43210" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <Field label="Password" name="password" type="password" placeholder="••••••••" />
              <Field label="Confirm Password" name="confirmPassword" type="password" placeholder="••••••••" />
            </div>

            <button
              type="submit" disabled={loading}
              className="btn-primary"
              style={{ width: "100%", marginTop: "0.5rem", opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Creating account…" : "Create Account →"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "1.75rem" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "var(--brand-red)", fontWeight: 700, textDecoration: "none" }}>Sign In</Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .auth-brand { display: none !important; } }
        @media (max-width: 480px) { form > div[style*="grid"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
