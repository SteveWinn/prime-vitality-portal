import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import { setToken, setCurrentUser, clearAuth, getToken } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import PatientDashboard from "./pages/PatientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/not-found";
import { apiRequest } from "./lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/">
            {user ? (
              user.role === "admin" ? (
                <AdminDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              ) : (
                <PatientDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              )
            ) : (
              <LoginPage onLogin={handleLogin} />
            )}
          </Route>
          <Route path="/login">
            {user ? (
              user.role === "admin" ? (
                <AdminDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              ) : (
                <PatientDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              )
            ) : (
              <LoginPage onLogin={handleLogin} />
            )}
          </Route>
          <Route path="/register">
            {user ? (
              user.role === "admin" ? (
                <AdminDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              ) : (
                <PatientDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              )
            ) : (
              <RegisterPage onLogin={handleLogin} />
            )}
          </Route>
          <Route path="/dashboard">
            {user ? (
              user.role === "admin" ? (
                <AdminDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              ) : (
                <PatientDashboard user={user} onLogout={handleLogout} onUpdateUser={updateUser} />
              )
            ) : (
              <LoginPage onLogin={handleLogin} />
            )}
          </Route>
          <Route path="/subscription/success" component={SubscriptionSuccess} />
          <Route path="/subscription/cancelled" component={SubscriptionCancelled} />
          <Route component={NotFound} />
        </Switch>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
