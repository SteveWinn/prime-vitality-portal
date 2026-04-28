import { useEffect, useState } from "react";

export default function SubscriptionCancelled() {
  const [count, setCount] = useState(6);

  useEffect(() => {
    const t = setInterval(() => {
      setCount(c => {
        if (c <= 1) { clearInterval(t); window.location.replace("/"); }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 440, width: "90%", padding: "3rem 2rem", borderRadius: 20, border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>Checkout cancelled</h1>
        <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6, margin: "0 0 2rem" }}>
          No charge was made. You can subscribe anytime from your dashboard.
        </p>
        <button
          onClick={() => window.location.replace("/")}
          style={{ width: "100%", padding: "0.875rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: "1rem" }}
        >
          Back to Dashboard
        </button>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Redirecting in {count} second{count !== 1 ? "s" : ""}…</p>
      </div>
    </div>
  );
}
