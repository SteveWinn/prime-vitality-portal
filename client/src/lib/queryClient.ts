import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authHeaders } from "./auth";

// In dev: empty string (same-origin via Vite proxy)
// In Perplexity preview: use __PORT_5000__ proxy
// In production (Netlify → Render): use VITE_API_URL env var
const API_BASE = (() => {
  const port5000 = "__PORT_5000__";
  if (!port5000.startsWith("__")) return port5000; // Perplexity proxy
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string; // Netlify → Render
  return ""; // dev (same-origin)
})();

// Friendly error messages — never expose raw status codes or JSON to the user
const FRIENDLY_ERRORS: Record<string, string> = {
  "Invalid email or password": "Incorrect email or password. Please try again.",
  "Email already registered": "An account with that email already exists. Try signing in instead.",
  "Unauthorized": "Your session has expired. Please sign in again.",
  "Invalid token": "Your session has expired. Please sign in again.",
  "Admin only": "You don't have permission to access that page.",
  "Forbidden": "You don't have permission to do that.",
  "User not found": "Account not found. Please check your details.",
  "Not found": "The requested item could not be found.",
  "Stripe not configured": "Billing is temporarily unavailable. Please contact care@myprimevitality.com.",
  "No billing account found": "No billing account found. Please contact care@myprimevitality.com.",
  "Invalid plan": "That plan is not available. Please choose another.",
  "Registration failed": "Registration failed. Please check your information and try again.",
  "Login failed": "Sign in failed. Please try again.",
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText || "Something went wrong. Please try again.";
    try {
      const json = await res.json();
      const raw = json?.error || json?.message || message;
      message = FRIENDLY_ERRORS[raw] ?? raw;
    } catch {
      // body wasn't JSON — use statusText
    }
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
