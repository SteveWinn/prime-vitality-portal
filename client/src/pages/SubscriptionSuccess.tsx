import { useEffect, useState } from "react";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter — $149/mo",
  optimized: "Optimized — $249/mo",
  elite: "Elite — $399/mo",
};

export default function SubscriptionSuccess() {
  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan") || "";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          window.location.href = "/";
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f8fafc",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: 440,
        margin: "0 auto",
        padding: "3rem 2rem",
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}>
        <div style={{ marginBottom: 24 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto", display: "block" }}>
            <circle cx="12" cy="12" r="12" fill="#22c55e" opacity="0.15" />
            <path d="M7 13l3 3 7-7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          You're subscribed!
        </h1>
        {plan && (
          <p style={{ color: "#2563eb", fontWeight: 600, marginBottom: 12 }}>
            {PLAN_NAMES[plan] || plan}
          </p>
        )}
        <p style={{ color: "#64748b", marginBottom: 32, lineHeight: 1.6 }}>
          Welcome to Prime Vitality. Your care team will be in touch shortly to
          schedule your initial consultation.
        </p>
        <button
          onClick={() => { window.location.href = "/"; }}
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
          Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}…
        </p>
      </div>
    </div>
  );
}
