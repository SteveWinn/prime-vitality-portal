import { useEffect, useState } from "react";

export default function SubscriptionCancelled() {
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
            <circle cx="12" cy="12" r="12" fill="#94a3b8" opacity="0.15" />
            <path d="M15 9l-6 6M9 9l6 6" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
          Checkout cancelled
        </h1>
        <p style={{ color: "#64748b", marginBottom: 32, lineHeight: 1.6 }}>
          No charge was made. You can subscribe anytime from your dashboard.
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
          Back to Dashboard
        </button>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
          Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}…
        </p>
      </div>
    </div>
  );
}
