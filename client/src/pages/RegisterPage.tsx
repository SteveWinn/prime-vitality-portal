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
import { Activity, CheckCircle2 } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">
              Prime <span className="text-primary">Vitality</span>
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Patient Portal</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-primary text-white" :
                i === step ? "bg-primary text-white ring-2 ring-primary/30" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
              {i < steps.length - 1 && <div className={`w-8 h-px ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[step]}</CardTitle>
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
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" placeholder="John" autoFocus data-testid="input-firstname" {...form.register("firstName")} />
                      {form.formState.errors.firstName && (
                        <p className="text-destructive text-xs">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" placeholder="Smith" data-testid="input-lastname" {...form.register("lastName")} />
                      {form.formState.errors.lastName && (
                        <p className="text-destructive text-xs">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" data-testid="input-email" {...form.register("email")} />
                    {form.formState.errors.email && (
                      <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                  <Button type="button" className="w-full" onClick={nextStep}>Continue</Button>
                </>
              )}

              {/* Step 1 — Phone + DOB */}
              {step === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="phone" type="tel" autoComplete="tel" placeholder="(801) 555-0100" data-testid="input-phone" {...form.register("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="dateOfBirth" type="date" data-testid="input-dob" {...form.register("dateOfBirth")} />
                    <p className="text-xs text-muted-foreground">Used by your provider to confirm your identity</p>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                    <Button type="button" className="flex-1" onClick={nextStep}>Continue</Button>
                  </div>
                </>
              )}

              {/* Step 2 — Password */}
              {step === 2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" autoComplete="new-password" placeholder="Min 8 characters" data-testid="input-password" {...form.register("password")} />
                    {form.formState.errors.password && (
                      <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Re-enter password" data-testid="input-confirm-password" {...form.register("confirmPassword")} />
                    {form.formState.errors.confirmPassword && (
                      <p className="text-destructive text-xs">{form.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    Your data is encrypted and HIPAA-compliant. We will never share your information without your consent.
                  </p>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                    <Button type="submit" className="flex-1" disabled={loading} data-testid="button-register">
                      {loading ? "Creating account…" : "Create Account"}
                    </Button>
                  </div>
                </>
              )}
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => setLocation("/login")} className="text-primary hover:underline font-medium">
                Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
