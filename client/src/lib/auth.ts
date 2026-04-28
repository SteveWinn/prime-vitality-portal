import { apiRequest } from "./queryClient";

let authToken: string | null = null;
let currentUser: any = null;

export function setToken(token: string, user: any) {
  authToken = token;
  currentUser = user;
}

export function getToken() {
  return authToken;
}

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user: any) {
  currentUser = user;
}

export function clearAuth() {
  authToken = null;
  currentUser = null;
}

export function isAuthenticated() {
  return !!authToken;
}

export function authHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}
