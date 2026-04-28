// Auth token persisted in sessionStorage so page reloads (e.g. Stripe redirects) don't log user out.
// sessionStorage clears automatically when the tab is closed — appropriate for a healthcare portal.

const TOKEN_KEY = "pv_token";
const USER_KEY = "pv_user";

function loadFromSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let _token: string | null = sessionStorage.getItem(TOKEN_KEY);
let _user: any = loadFromSession(USER_KEY);

export function setToken(token: string, user: any) {
  _token = token;
  _user = user;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // sessionStorage unavailable — in-memory only (shouldn't happen on Netlify)
  }
}

export function getToken(): string | null {
  return _token;
}

export function getCurrentUser(): any {
  return _user;
}

export function setCurrentUser(user: any) {
  _user = user;
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearAuth() {
  _token = null;
  _user = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {}
}

export function isAuthenticated(): boolean {
  return !!_token;
}

export function authHeaders(): Record<string, string> {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}
