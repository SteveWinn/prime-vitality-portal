import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPasswordPage() {
  const [location] = useLocation();
  // Token is passed as query param: /#/reset-password?token=xxx
  const token = new URLSearchParams(window.location.hash.split("?")[1] || "").get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/reset-password", { token, password }).then(r => r.json()),
    onSuccess: () => setDone(true),
    onError: (err: any) => toast({ title: "Reset failed", description: err.message || "Invalid or expired link.", variant: "destructive" }),
  });

  const valid = password.length >= 8 && password === confirm;

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6fb" }}>
        <div style={{ textAlign: "center", padding: "32px", maxWidth: "360px" }}>
          <p style={{ color: "#ef4444", fontWeight: 600, marginBottom: "12px" }}>Invalid reset link.</p>
          <Link href="/forgot-password"><a style={{ color: "#0d5c44", fontWeight: 600 }}>Request a new one</a></Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a3d2e 0%, #0d5c44 50%, #0f6b50 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "40px 36px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" fill="#0d5c44" />
            <path d="M10 16 L14 20 L22 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: "17px", color: "#0d5c44" }}>Prime Vitality</span>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <CheckCircle size={48} color="#0d5c44" style={{ margin: "0 auto 16px" }} />
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>Password updated!</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
              Your password has been changed. You can now log in with your new password.
            </p>
            <Link href="/login">
              <Button style={{ background: "#0d5c44", color: "#fff", height: "44px", fontSize: "15px", fontWeight: 600, borderRadius: "10px", width: "100%" }}>
                Go to Login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Set new password</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 28px" }}>
              Must be at least 8 characters.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <Label htmlFor="pw" style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>New password</Label>
              <div style={{ position: "relative", marginTop: "6px" }}>
                <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <Input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  data-testid="input-new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: "38px", paddingRight: "42px" }}
                  placeholder="At least 8 characters"
                  autoFocus
                />
                <button
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <Label htmlFor="confirm" style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Confirm password</Label>
              <div style={{ position: "relative", marginTop: "6px" }}>
                <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <Input
                  id="confirm"
                  type={showPw ? "text" : "password"}
                  data-testid="input-confirm-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && valid && mutation.mutate()}
                  style={{ paddingLeft: "38px" }}
                  placeholder="Repeat password"
                />
              </div>
              {confirm && password !== confirm && (
                <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>Passwords don't match</p>
              )}
            </div>

            <Button
              data-testid="button-reset-submit"
              className="w-full"
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
              style={{ background: "#0d5c44", color: "#fff", height: "44px", fontSize: "15px", fontWeight: 600, borderRadius: "10px" }}
            >
              {mutation.isPending ? "Saving…" : "Reset Password"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
