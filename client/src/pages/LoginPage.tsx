import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import type { AppUser } from "../App";
import { Activity, AlertCircle, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage({ onLogin }: { onLogin: (token: string, user: AppUser) => void }) {
  const [loading, setLoading] = useState(false);
  const [slowWarning, setSlowWarning] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setSlowWarning(false);

    // Show cold-start warning if Render takes more than 4 seconds
    const slowTimer = setTimeout(() => setSlowWarning(true), 4000);

    try {
      const res = await apiRequest("POST", "/api/auth/login", data);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed");
      onLogin(json.token, json.user);
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlowWarning(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md space-y-7">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="logo-mark">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Prime <span style={{ color: "hsl(0 55% 22%)" }}>Vitality</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-medium tracking-wide uppercase" style={{ fontSize: "0.7rem", letterSpacing: "0.1em" }}>
            Patient Portal
          </p>
        </div>

        <Card className="shadow-[0_4px_24px_rgba(15,21,35,0.10)] border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800 }}>
              Welcome back
            </CardTitle>
            <CardDescription>Access your treatment plan, labs, and messages</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground/80">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  data-testid="input-email"
                  className="h-11 bg-background/60 border-border/70 focus:border-primary/50 transition-colors"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground/80">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  data-testid="input-password"
                  className="h-11 bg-background/60 border-border/70 focus:border-primary/50 transition-colors"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
                )}
              </div>

              {slowWarning && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    The server is waking up — this can take 30–60 seconds on first use. Please wait…
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-bold text-sm gap-2 mt-1"
                style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                disabled={loading}
                data-testid="button-login"
              >
                {loading ? "Signing in…" : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </form>

            <div className="mt-2 text-right">
              <a
                href="/#/forgot-password"
                className="text-xs hover:underline"
                style={{ color: "hsl(24 58% 51%)" }}
                data-testid="link-forgot-password"
              >
                Forgot password?
              </a>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50 text-center text-sm text-muted-foreground">
              New patient?{" "}
              <button
                onClick={() => setLocation("/register")}
                className="font-semibold hover:underline transition-colors"
                style={{ color: "hsl(24 58% 51%)" }}
                data-testid="link-register"
              >
                Create an account
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Not a patient yet?{" "}
          <a href="https://myprimevitality.com" className="hover:underline font-medium" style={{ color: "hsl(0 55% 22%)" }}>
            Get your free assessment →
          </a>
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap text-xs text-muted-foreground">
          <a href="https://myprimevitality.com/privacy-policy.html" target="_blank" rel="noopener" className="hover:underline">Privacy Policy</a>
          <span>·</span>
          <a href="https://myprimevitality.com/hipaa-notice.html" target="_blank" rel="noopener" className="hover:underline">HIPAA Notice</a>
          <span>·</span>
          <a href="https://myprimevitality.com/terms-of-service.html" target="_blank" rel="noopener" className="hover:underline">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
