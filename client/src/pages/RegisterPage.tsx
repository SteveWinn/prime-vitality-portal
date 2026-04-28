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
import { Activity, CheckCircle2, ArrowRight } from "lucide-react";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  password: z.string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const steps = ["Account Info", "Contact Details", "Set Password"];

export default function RegisterPage({ onLogin }: { onLogin: (token: string, user: AppUser) => void }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "",
      phone: "", dateOfBirth: "", password: "", confirmPassword: "",
    },
    mode: "onChange",
  });

  const nextStep = async () => {
    let fields: (keyof RegisterForm)[] = [];
    if (step === 0) fields = ["firstName", "lastName", "email"];
    if (step === 1) fields = ["phone", "dateOfBirth"];
    const valid = await form.trigger(fields);
    if (valid) setStep(s => s + 1);
  };

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const { confirmPassword, ...payload } = data;
      const res = await apiRequest("POST", "/api/auth/register", payload);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Registration failed");
      onLogin(json.token, json.user);
      toast({ title: "Welcome to Prime Vitality!", description: "Your account has been created." });
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="w-full max-w-md space-y-7">

        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="logo-mark">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Prime <span style={{ color: "hsl(0 55% 22%)" }}>Vitality</span>
            </span>
          </div>
          <p className="text-muted-foreground font-medium uppercase tracking-widest" style={{ fontSize: "0.68rem" }}>
            Patient Portal
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step
                    ? "text-white"
                    : i === step
                    ? "text-white ring-4"
                    : "text-muted-foreground"
                }`}
                style={{
                  background: i <= step ? "hsl(0 55% 22%)" : "hsl(var(--muted))",
                  ringColor: i === step ? "hsl(0 55% 22% / 0.2)" : undefined,
                  boxShadow: i === step ? "0 0 0 3px hsl(0 55% 22% / 0.18)" : undefined,
                }}
              >
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block font-medium ${
                  i === step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {i < steps.length - 1 && (
                <div
                  className="w-8 h-px transition-colors"
                  style={{ background: i < step ? "hsl(0 55% 22%)" : "hsl(var(--border))" }}
                />
              )}
            </div>
          ))}
        </div>

        <Card className="shadow-[0_4px_24px_rgba(15,21,35,0.10)] border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800 }}>
              {steps[step]}
            </CardTitle>
            <CardDescription>
              {step === 0 && "Tell us about yourself"}
              {step === 1 && "How can we reach you?"}
              {step === 2 && "Secure your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Step 0 — Name + Email */}
              {step === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-sm font-semibold text-foreground/80">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        autoFocus
                        data-testid="input-firstname"
                        className="h-11 bg-background/60"
                        {...form.register("firstName")}
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-destructive text-xs">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-sm font-semibold text-foreground/80">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Smith"
                        data-testid="input-lastname"
                        className="h-11 bg-background/60"
                        {...form.register("lastName")}
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-destructive text-xs">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-semibold text-foreground/80">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      data-testid="input-email"
                      className="h-11 bg-background/60"
                      {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                      <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    className="w-full h-11 font-bold gap-2"
                    style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                    onClick={nextStep}
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                </>
              )}

              {/* Step 1 — Phone + DOB */}
              {step === 1 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm font-semibold text-foreground/80">
                      Phone Number <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="(801) 555-0100"
                      data-testid="input-phone"
                      className="h-11 bg-background/60"
                      {...form.register("phone")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dateOfBirth" className="text-sm font-semibold text-foreground/80">
                      Date of Birth <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      data-testid="input-dob"
                      className="h-11 bg-background/60"
                      {...form.register("dateOfBirth")}
                    />
                    <p className="text-xs text-muted-foreground">Used by your provider to confirm your identity</p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={() => setStep(0)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 h-11 font-bold gap-2"
                      style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                      onClick={nextStep}
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* Step 2 — Password */}
              {step === 2 && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-semibold text-foreground/80">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Min 8 characters"
                      data-testid="input-password"
                      className="h-11 bg-background/60"
                      {...form.register("password")}
                    />
                    {form.formState.errors.password && (
                      <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold text-foreground/80">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      data-testid="input-confirm-password"
                      className="h-11 bg-background/60"
                      {...form.register("confirmPassword")}
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="text-destructive text-xs">{form.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <div className="bg-muted/60 border border-border/50 rounded-xl p-3.5 text-xs text-muted-foreground leading-relaxed">
                    🔒 Your data is encrypted and HIPAA-compliant. We will never share your information without your consent.
                  </div>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={() => setStep(1)}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-11 font-bold"
                      style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                      disabled={loading}
                      data-testid="button-register"
                    >
                      {loading ? "Creating account…" : "Create Account"}
                    </Button>
                  </div>
                </>
              )}
            </form>

            <div className="mt-5 pt-4 border-t border-border/50 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => setLocation("/login")}
                className="font-semibold hover:underline"
                style={{ color: "hsl(24 58% 51%)" }}
              >
                Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
