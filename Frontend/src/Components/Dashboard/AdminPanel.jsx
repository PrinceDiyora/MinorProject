import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const SECTION_LABEL = {
    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "1.25rem",
    display: "flex", alignItems: "center", gap: "0.5rem"
};

function SettingsRow({ label, hint, children }) {
    return (
        <div style={{
            display: "grid", gridTemplateColumns: "220px 1fr",
            gap: "2rem", padding: "1.125rem 0",
            borderBottom: "1px solid var(--border)", alignItems: "start"
        }} className="settings-row">
            <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--navy)", marginBottom: "0.25rem" }}>{label}</p>
                {hint && <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", lineHeight: 1.5 }}>{hint}</p>}
            </div>
            <div>{children}</div>
        </div>
    );
}

function Toggle({ checked, onChange }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: checked ? "var(--brand-red)" : "#D1D5DB",
                position: "relative", transition: "background 0.2s", flexShrink: 0
            }}
        >
            <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 3,
                left: checked ? 23 : 3,
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
            }} />
        </button>
    );
}

export default function AdminPanel() {
    const { user } = useAuth();

    // Restaurant settings
    const [restaurantName, setRestaurantName] = useState(user?.restaurant_name || "Spice Route QSR");
    const [currency, setCurrency] = useState("INR (₹)");
    const [timezone, setTimezone] = useState("Asia/Kolkata (IST)");
    const [shiftStart, setShiftStart] = useState("08:00");
    const [shiftEnd, setShiftEnd] = useState("23:00");

    // Profile
    const [name, setName] = useState(user?.name || "Rahul Sharma");
    const [email] = useState(user?.email || "demo@hackmined.ai");

    // Integration
    const [backendUrl, setBackendUrl] = useState("http://localhost:3000");
    const [posWebhook, setPosWebhook] = useState("");
    const [apiKey] = useState("hm_live_********************a3f2");

    // AI Settings
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [upsellEnabled, setUpsellEnabled] = useState(true);
    const [priceOptEnabled, setPriceOptEnabled] = useState(true);
    const [regionalLang, setRegionalLang] = useState(false);

    // Notifications
    const [riskAlerts, setRiskAlerts] = useState(true);
    const [hiddenStarAlerts, setHiddenStarAlerts] = useState(true);
    const [dailySummary, setDailySummary] = useState(false);

    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const inputStyle = {
        width: "100%", border: "1.5px solid var(--border)", borderRadius: 4,
        padding: "0.625rem 0.875rem", fontSize: "0.875rem",
        fontFamily: "'Roboto', sans-serif", color: "var(--navy)",
        background: "#fff", outline: "none", transition: "border-color 0.2s",
        boxSizing: "border-box"
    };

    const cardStyle = {
        background: "#fff", border: "1px solid var(--border)",
        borderRadius: 6, padding: "1.5rem 2rem", marginBottom: "1.5rem"
    };

    return (
        <div>
            <div style={{ marginBottom: "2rem" }}>
                <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    System
                </p>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>Admin Settings</h1>
            </div>
            <hr className="editorial-divider" style={{ marginBottom: "1.75rem" }} />

            {/* ── Restaurant ── */}
            <div style={cardStyle}>
                <div style={SECTION_LABEL}>
                    <div style={{ width: 3, height: 14, background: "var(--brand-red)" }} />
                    Restaurant
                </div>

                <SettingsRow label="Restaurant Name" hint="Displayed across dashboards and reports">
                    <input value={restaurantName} onChange={e => setRestaurantName(e.target.value)}
                        style={inputStyle} onFocus={e => e.target.style.borderColor = "var(--brand-red)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </SettingsRow>

                <SettingsRow label="Currency" hint="Applied to all revenue and cost figures">
                    <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}>
                        <option>INR (₹)</option>
                        <option>USD ($)</option>
                        <option>AED (د.إ)</option>
                    </select>
                </SettingsRow>

                <SettingsRow label="Timezone" hint="Used for daily reporting and shift boundaries">
                    <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle}>
                        <option>Asia/Kolkata (IST)</option>
                        <option>Asia/Dubai (GST)</option>
                        <option>UTC</option>
                    </select>
                </SettingsRow>

                <SettingsRow label="Operating Hours" hint="Defines the reporting window for daily metrics">
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                        <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)}
                            style={{ ...inputStyle, width: 140 }} />
                        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>to</span>
                        <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)}
                            style={{ ...inputStyle, width: 140 }} />
                    </div>
                </SettingsRow>
            </div>

            {/* ── Profile ── */}
            <div style={cardStyle}>
                <div style={SECTION_LABEL}>
                    <div style={{ width: 3, height: 14, background: "var(--navy)" }} />
                    Account
                </div>

                <SettingsRow label="Full Name" hint="Appears in reports and session headers">
                    <input value={name} onChange={e => setName(e.target.value)} style={inputStyle}
                        onFocus={e => e.target.style.borderColor = "var(--brand-red)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </SettingsRow>

                <SettingsRow label="Email" hint="Login credential — contact support to change">
                    <input value={email} disabled style={{ ...inputStyle, background: "var(--surface)", color: "var(--text-muted)", cursor: "not-allowed" }} />
                </SettingsRow>

                <SettingsRow label="Change Password" hint="Leave blank to keep current password">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                        <input type="password" placeholder="New password" style={inputStyle}
                            onFocus={e => e.target.style.borderColor = "var(--brand-red)"}
                            onBlur={e => e.target.style.borderColor = "var(--border)"} />
                        <input type="password" placeholder="Confirm new password" style={inputStyle}
                            onFocus={e => e.target.style.borderColor = "var(--brand-red)"}
                            onBlur={e => e.target.style.borderColor = "var(--border)"} />
                    </div>
                </SettingsRow>
            </div>

            {/* ── Integration ── */}
            <div style={cardStyle}>
                <div style={SECTION_LABEL}>
                    <div style={{ width: 3, height: 14, background: "var(--ai-badge)" }} />
                    Integration
                </div>

                <SettingsRow label="Backend API URL" hint="Node.js backend endpoint for all API calls">
                    <input value={backendUrl} onChange={e => setBackendUrl(e.target.value)} style={inputStyle}
                        onFocus={e => e.target.style.borderColor = "var(--brand-red)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </SettingsRow>

                <SettingsRow label="PoS Webhook URL" hint="Endpoint that receives structured JSON after voice order confirmation">
                    <input value={posWebhook} onChange={e => setPosWebhook(e.target.value)}
                        placeholder="https://your-pos.example.com/webhook"
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = "var(--brand-red)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </SettingsRow>

                <SettingsRow label="API Key" hint="Read-only — regenerate from the CLI or backend admin">
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <input value={apiKey} disabled style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.8125rem", background: "var(--surface)", color: "var(--text-muted)", cursor: "not-allowed" }} />
                        <button className="btn-outline" style={{ minHeight: 36, padding: "0 1rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                            Regenerate
                        </button>
                    </div>
                </SettingsRow>
            </div>

            {/* ── AI Modules ── */}
            <div style={cardStyle}>
                <div style={SECTION_LABEL}>
                    <div style={{ width: 3, height: 14, background: "var(--success)" }} />
                    AI Modules
                </div>

                {[
                    { label: "Voice Ordering Copilot", hint: "Enable Whisper STT + NLP pipeline for phone orders", val: voiceEnabled, set: setVoiceEnabled },
                    { label: "Upsell Engine", hint: "Real-time combo upsell suggestions during voice calls", val: upsellEnabled, set: setUpsellEnabled },
                    { label: "Price Optimizer", hint: "Engine 1 dynamic pricing signal recommendations", val: priceOptEnabled, set: setPriceOptEnabled },
                    { label: "Regional Language Support", hint: "Beta — extends NLP beyond English + Hindi + Hinglish", val: regionalLang, set: setRegionalLang },
                ].map(row => (
                    <SettingsRow key={row.label} label={row.label} hint={row.hint}>
                        <Toggle checked={row.val} onChange={row.set} />
                    </SettingsRow>
                ))}
            </div>

            {/* ── Notifications ── */}
            <div style={cardStyle}>
                <div style={SECTION_LABEL}>
                    <div style={{ width: 3, height: 14, background: "var(--warning-bg)" }} />
                    Notifications
                </div>

                {[
                    { label: "At-Risk Item Alerts", hint: "Notify when margin erosion is detected on high-volume items", val: riskAlerts, set: setRiskAlerts },
                    { label: "Hidden Star Detection", hint: "Alert when a high-margin under-promoted item is identified", val: hiddenStarAlerts, set: setHiddenStarAlerts },
                    { label: "Daily Revenue Summary", hint: "End-of-day summary report delivered to your email", val: dailySummary, set: setDailySummary },
                ].map(row => (
                    <SettingsRow key={row.label} label={row.label} hint={row.hint}>
                        <Toggle checked={row.val} onChange={row.set} />
                    </SettingsRow>
                ))}
            </div>

            {/* ── Save Bar ── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "1.25rem 2rem",
                background: "#fff", border: "1px solid var(--border)", borderRadius: 6,
                position: "sticky", bottom: "1.5rem"
            }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    Changes apply immediately after saving.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {saved && (
                        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--success)" }}>
                            Saved successfully
                        </span>
                    )}
                    <button className="btn-primary" onClick={handleSave}>
                        Save Changes
                    </button>
                </div>
            </div>

            <style>{`
        @media (max-width: 700px) {
          .settings-row { grid-template-columns: 1fr !important; gap: 0.5rem !important; }
        }
      `}</style>
        </div>
    );
}
