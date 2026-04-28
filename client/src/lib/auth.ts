import { apiRequest } from "./queryClient";

const TOKEN_KEY = "pv_auth_token";
const USER_KEY = "pv_auth_user";

let authToken: string | null = sessionStorage.getItem(TOKEN_KEY);
let currentUser: any = (() => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); } catch { return null; }
})();

export function setToken(token: string, user: any) {
  authToken = token;
  currentUser = user;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return authToken;
}

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user: any) {
  currentUser = user;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!authToken;
}

export function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
