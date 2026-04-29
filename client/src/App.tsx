import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState } from "react";
import { setToken, setCurrentUser, clearAuth, getCurrentUser } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RegisterPage from "./pages/RegisterPage";
import PatientDashboard from "./pages/PatientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/not-found";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import SubscriptionCancelled from "./pages/SubscriptionCancelled";

export type AppUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  subscriptionCurrentPeriodEnd?: string;
  stripeCustomerId?: string;
  doxyRoomUrl?: string;
};

// Handle Stripe redirect paths BEFORE rendering the React app.
// Stripe strips hash fragments, so these arrive as real paths.
// Netlify's _redirects rule serves index.html for all paths,
// then we intercept here before any router or provider loads.
const _pathname = window.location.pathname;
if (_pathname === "/subscription/success") {
  document.getElementById("root")!.innerHTML = "";
}

function renderStripeRedirect() {
  const p = window.location.pathname;
  if (p === "/subscription/success") return <SubscriptionSuccess />;
  if (p === "/subscription/cancelled") return <SubscriptionCancelled />;
  return null;
}

function App() {
  const [user, setUser] = useState<AppUser | null>(getCurrentUser());

  const stripeRedirect = renderStripeRedirect();
  if (stripeRedirect) return stripeRedirect;

  const handleLogin = (token: string, userData: AppUser) => {
    setToken(token, userData);
    setCurrentUser(userData);
    setUser(userData);
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    queryClient.clear();
  };

  const updateUser = (updated: AppUser) => {
    setCurrentUser(updated);
    setUser(updated);
  };

  const renderDashboard = () => {
    if (!user) return <LoginPage onLogin={handleLogin} />;
    return user.role === "admin"
      ? <AdminDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
      : <PatientDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/">{renderDashboard()}</Route>
          <Route path="/login">
            {user ? renderDashboard() : <LoginPage onLogin={handleLogin} />}
          </Route>
          <Route path="/register">
            {user ? renderDashboard() : <RegisterPage onLogin={handleLogin} />}
          </Route>
          <Route path="/dashboard">{renderDashboard()}</Route>
          <Route component={NotFound} />
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
