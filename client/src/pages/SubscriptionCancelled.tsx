import { useEffect } from "react";
import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SubscriptionCancelled() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/"), 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-6 py-12 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex justify-center mb-6">
          <XCircle className="h-16 w-16 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Checkout cancelled
        </h1>
        <p className="text-muted-foreground mb-8">
          No charge was made. You can subscribe anytime from your dashboard.
        </p>
        <Button
          className="w-full"
          onClick={() => navigate("/")}
          data-testid="button-go-to-dashboard"
        >
          Back to Dashboard
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Redirecting automatically in 5 seconds…
        </p>
      </div>
    </div>
  );
}
