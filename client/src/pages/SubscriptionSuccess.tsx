import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-6 py-12 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex justify-center mb-6">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          You're subscribed!
        </h1>
        {plan && (
          <p className="text-primary font-semibold mb-3">
            {PLAN_NAMES[plan] || plan}
          </p>
        )}
        <p className="text-muted-foreground mb-8">
          Welcome to Prime Vitality. Your care team will be in touch shortly to
          schedule your initial consultation.
        </p>
        <Button
          className="w-full"
          onClick={() => { window.location.href = "/"; }}
          data-testid="button-go-to-dashboard"
        >
          Go to Dashboard
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}…
        </p>
      </div>
    </div>
  );
}
