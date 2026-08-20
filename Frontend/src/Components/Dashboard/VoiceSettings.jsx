import { useState } from "react";

const PIPELINE_STATUS = [
    { name: "Whisper STT", detail: "local — no external API", status: "running" },
    { name: "rapidfuzz Mapper", detail: "hinglish_aliases.json · 27 items · 299 aliases", status: "running" },
    { name: "Engine 2 Classifier", detail: "XGBoost · last retrained: 2026-03-05 22:14", status: "running" },
    { name: "Co-occurrence Index", detail: "from petpooja_upsell_v2.csv", status: "running" },
];

const ALIASES = [
    { item: "Panipuri", aliases: ["golgappa", "puchka", "gupchup", "paani puri", "pani puri"], count: 12 },
    { item: "Chai", aliases: ["cutting", "masala chai", "adrak chai", "tea", "cha"], count: 9 },
    { item: "Lassi", aliases: ["sweet lassi", "namkeen lassi", "yogurt drink"], count: 7 },
    { item: "Burger", aliases: ["veg burger", "aloo tikki burger", "veggie burger"], count: 6 },
    { item: "Samosa", aliases: ["samose", "aloo samosa", "samosa chaat"], count: 5 },
    { item: "Roti", aliases: ["chapati", "phulka", "fulka", "chappati"], count: 5 },
];

const SETTINGS = [
    { label: "Languages active", value: "English + Hindi + Hinglish", type: "multi-toggle" },
    { label: "rapidfuzz confidence threshold", value: 80, type: "slider", min: 60, max: 95 },
    { label: "Upsell engine threshold", value: 0.55, type: "slider", min: 0.45, max: 0.75, step: 0.05 },
    { label: "Co-occurrence weight (freq/synergy)", value: "0.60 / 0.40", type: "info" },
    { label: "Regional languages", value: "Off (Beta)", type: "toggle" },
];

export default function VoiceSettings() {
    const [retraining, setRetraining] = useState(false);

    const handleRetrain = () => {
        setRetraining(true);
        setTimeout(() => setRetraining(false), 2000);
    };

    return (
        <div>
            <div style={{ marginBottom: "2rem" }}>
                <p className="section-label" style={{ color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                    Module 02 · AI Voice Ordering Copilot
                </p>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--navy)" }}>Voice Settings & NLP</h1>
            </div>
            <hr className="editorial-divider" style={{ marginBottom: "1.75rem" }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="voice-layout">
                {/* Pipeline Status */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>Voice Pipeline Status</h3>
                        </div>
                        <div>
                            {PIPELINE_STATUS.map((p, i) => (
                                <div key={p.name} style={{
                                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                                    padding: "0.875rem 1.5rem",
                                    borderBottom: i < PIPELINE_STATUS.length - 1 ? "1px solid var(--border)" : "none"
                                }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--navy)" }}>{p.name}</p>
                                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.125rem", fontFamily: "monospace" }}>{p.detail}</p>
                                    </div>
                                    <span style={{
                                        display: "flex", alignItems: "center", gap: "0.375rem",
                                        fontSize: "0.75rem", fontWeight: 700, color: "var(--success)"
                                    }}>
                                        <span className="live-dot" style={{ width: 7, height: 7, background: "var(--success)" }} />
                                        Running
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.75rem", flexWrap: "wrap", background: "var(--surface)" }}>
                            <button
                                className="btn-primary"
                                onClick={handleRetrain}
                                disabled={retraining}
                                style={{ opacity: retraining ? 0.7 : 1 }}
                            >
                                {retraining ? "Retraining…" : "🔄 Retrain Engine 2 Now"}
                            </button>
                            <button className="btn-outline" style={{ minHeight: 36, padding: "0 1rem", fontSize: "0.8rem" }}>
                                📋 View voice_sessions Log
                            </button>
                        </div>
                    </div>

                    {/* Language & Threshold Settings */}
                    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>Settings</h3>
                        </div>
                        <div>
                            {SETTINGS.map((s, i) => (
                                <div key={s.label} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "0.875rem 1.5rem",
                                    borderBottom: i < SETTINGS.length - 1 ? "1px solid var(--border)" : "none"
                                }}>
                                    <span style={{ fontSize: "0.875rem", color: "var(--navy)", maxWidth: "60%" }}>{s.label}</span>
                                    {s.type === "slider" ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                            <input
                                                type="range" min={s.min} max={s.max} defaultValue={s.value} step={s.step || 1}
                                                style={{ width: 100, accentColor: "var(--brand-red)" }}
                                            />
                                            <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--navy)", minWidth: 36, textAlign: "right" }}>{s.value}</span>
                                        </div>
                                    ) : s.type === "toggle" ? (
                                        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-muted)", background: "var(--surface)", padding: "0.25rem 0.75rem", borderRadius: 3 }}>
                                            {s.value}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--navy)" }}>{s.value}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Alias Manager */}
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                        <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--navy)" }}>Alias Manager</h3>
                        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                            27 items · 299 aliases — inline editable
                        </p>
                    </div>
                    <div>
                        {ALIASES.map((a, i) => (
                            <div key={a.item} style={{
                                padding: "1rem 1.5rem",
                                borderBottom: i < ALIASES.length - 1 ? "1px solid var(--border)" : "none"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                                    <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "var(--navy)" }}>
                                        {a.item}
                                    </span>
                                    <span className="badge badge-muted">{a.count} aliases</span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                                    {a.aliases.map(alias => (
                                        <span key={alias} style={{
                                            fontSize: "0.75rem", padding: "0.2rem 0.5rem",
                                            background: "var(--surface)", border: "1px solid var(--border)",
                                            borderRadius: 3, color: "var(--text-muted)"
                                        }}>{alias}</span>
                                    ))}
                                    <button style={{
                                        fontSize: "0.75rem", padding: "0.2rem 0.5rem",
                                        background: "transparent", border: "1px dashed var(--border)",
                                        borderRadius: 3, cursor: "pointer", color: "var(--brand-red)", fontFamily: "'Roboto', sans-serif"
                                    }}>
                                        + Add Alias
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                        <button className="btn-outline" style={{ minHeight: 36, fontSize: "0.8rem", padding: "0 1rem" }}>
                            View All 27 Items →
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
        @media (max-width: 1000px) { .voice-layout { grid-template-columns: 1fr !important; } }
      `}</style>
        </div>
    );
}
