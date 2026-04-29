import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/forgot-password", { email }).then(r => r.json()),
    onSuccess: () => setSent(true),
    onError: () => toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }),
  });

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

        {sent ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <CheckCircle size={48} color="#0d5c44" style={{ margin: "0 auto 16px" }} />
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>Check your email</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" }}>
              If an account exists for <strong>{email}</strong>, we've sent a password reset link. It expires in 1 hour.
            </p>
            <p style={{ fontSize: "13px", color: "#9ca3af", margin: "0 0 24px" }}>
              Didn't get it? Check your spam folder or{" "}
              <button
                onClick={() => setSent(false)}
                style={{ color: "#0d5c44", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}
              >
                try again
              </button>.
            </p>
            <Link href="/login">
              <a style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "#0d5c44", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}>
                <ArrowLeft size={14} /> Back to login
              </a>
            </Link>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Forgot password?</h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: "0 0 28px", lineHeight: 1.5 }}>
              Enter your email and we'll send you a link to reset your password.
            </p>

            <div style={{ marginBottom: "20px" }}>
              <Label htmlFor="email" style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>Email address</Label>
              <div style={{ position: "relative", marginTop: "6px" }}>
                <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <Input
                  id="email"
                  type="email"
                  data-testid="input-forgot-email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && email && mutation.mutate()}
                  placeholder="you@example.com"
                  style={{ paddingLeft: "38px" }}
                  autoFocus
                />
              </div>
            </div>

            <Button
              data-testid="button-send-reset"
              className="w-full"
              disabled={!email || mutation.isPending}
              onClick={() => mutation.mutate()}
              style={{ background: "#0d5c44", color: "#fff", height: "44px", fontSize: "15px", fontWeight: 600, borderRadius: "10px" }}
            >
              {mutation.isPending ? "Sending…" : "Send Reset Link"}
            </Button>

            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <Link href="/login">
                <a style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#0d5c44", fontSize: "14px", fontWeight: 600, textDecoration: "none" }}>
                  <ArrowLeft size={13} /> Back to login
                </a>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
