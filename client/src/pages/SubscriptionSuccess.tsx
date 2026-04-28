import { useEffect, useState } from "react";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter — $149/mo",
  optimized: "Optimized — $249/mo",
  elite: "Elite — $399/mo",
};

export default function SubscriptionSuccess() {
  const plan = new URLSearchParams(window.location.search).get("plan") || "";
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
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem" }}>You're subscribed!</h1>
        {plan && (
          <p style={{ fontSize: 16, fontWeight: 600, color: "#2563eb", margin: "0 0 0.75rem" }}>
            {PLAN_NAMES[plan] || plan}
          </p>
        )}
        <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6, margin: "0 0 2rem" }}>
          Welcome to Prime Vitality. Your care team will be in touch within one business day to schedule your initial consultation.
        </p>
        <button
          onClick={() => window.location.replace("/")}
          style={{ width: "100%", padding: "0.875rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", marginBottom: "1rem" }}
        >
          Go to Dashboard
        </button>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>Redirecting in {count} second{count !== 1 ? "s" : ""}…</p>
      </div>
    </div>
  );
}
