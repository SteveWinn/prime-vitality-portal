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

const registerSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "At least 8 characters"),
  phone: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage({ onLogin }: { onLogin: (token: string, user: AppUser) => void }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", phone: "" }
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", data);
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
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="hsl(var(--primary))" strokeWidth="2"/>
              <path d="M18 26 L18 12 M18 12 L12 18 M18 12 L24 18" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="18" cy="12" r="2.5" fill="hsl(var(--accent))"/>
            </svg>
            <span className="text-2xl font-bold" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
              Prime <span className="text-accent">Vitality</span>
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Patient Portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>Set up your patient portal to manage your care</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="John" data-testid="input-firstname" {...form.register("firstName")} />
                  {form.formState.errors.firstName && <p className="text-destructive text-xs">{form.formState.errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Smith" data-testid="input-lastname" {...form.register("lastName")} />
                  {form.formState.errors.lastName && <p className="text-destructive text-xs">{form.formState.errors.lastName.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" data-testid="input-email" {...form.register("email")} />
                {form.formState.errors.email && <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" placeholder="(801) 555-0100" data-testid="input-phone" {...form.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Min 8 characters" data-testid="input-password" {...form.register("password")} />
                {form.formState.errors.password && <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading} data-testid="button-register">
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button onClick={() => setLocation("/login")} className="text-accent hover:underline font-medium">Sign in</button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
