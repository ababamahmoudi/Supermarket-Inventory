import { demoSeed } from "./config";
import type { Branch, Role } from "./types";

export const AUTH_STORAGE_KEY = "supermarket-prototype-auth-v2";
export const SESSION_KEY = "supermarket-prototype-session-v2";
export type Theme = "light" | "dark";
export interface DemoUser {
  name: string;
  username: string;
  role: Role;
  branch: Branch;
}
export const demoUsers: DemoUser[] = demoSeed.demo_users.map((user) => ({
  name: user.name,
  username: user.username,
  role: user.role as Role,
  branch: user.branch as Branch,
}));
export interface Account {
  password: string;
  mustChangePassword: boolean;
  failedAttempts: number;
  lockedUntil: number;
}
export interface Preferences {
  theme: Theme;
  comfortableText: boolean;
  comfortableTextExplicit?: boolean;
}
export interface AuthState {
  version: 2;
  accounts: Record<string, Account>;
  recentUsers: string[];
  preferences: Record<string, Preferences>;
  devicePreferences: Preferences;
  audit: { action: string; username: string; at: string }[];
}
export interface AuthSession {
  username: string | null;
  branch: Branch;
  lang: "en" | "fa";
  locked: boolean;
  authenticatedAt: number;
}
export interface AuthSettings {
  password_min_length: number;
  block_common_passwords: boolean;
  lockout_after_failed_attempts: number;
  lockout_minutes: number;
}
export type AuthError =
  "invalid" | "locked" | "too_short" | "common" | "same_password";
const commonPasswords = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "qwertyuiop",
  "abcdefgh",
  "11111111",
  "00000000",
  "87654321",
  "iloveyou",
  "letmein123",
  "welcome1",
  "welcome123",
  "admin123",
  "admin1234",
  "demo1234",
  "temp1234",
  "supermarket",
  "changeme",
  "changeme123",
]);
export function initialAuth(): AuthState {
  return {
    version: 2,
    accounts: Object.fromEntries(
      demoSeed.demo_users.map((user) => [
        user.username,
        {
          password: user.password ?? user.temporary_password ?? "",
          mustChangePassword: Boolean(user.must_change_password),
          failedAttempts: 0,
          lockedUntil: 0,
        },
      ]),
    ),
    recentUsers: [],
    preferences: {},
    devicePreferences: { theme: "light", comfortableText: false },
    audit: [],
  };
}
export function readAuth(): AuthState {
  const seed = initialAuth();
  try {
    const saved = JSON.parse(
      localStorage.getItem(AUTH_STORAGE_KEY) ?? "null",
    ) as AuthState | null;
    if (!saved || saved.version !== 2 || !saved.accounts) return seed;
    for (const user of demoUsers) {
      const account = saved.accounts[user.username];
      if (
        account &&
        typeof account.password === "string" &&
        typeof account.mustChangePassword === "boolean" &&
        Number.isFinite(account.failedAttempts) &&
        Number.isFinite(account.lockedUntil)
      )
        seed.accounts[user.username] = account;
    }
    seed.recentUsers = Array.isArray(saved.recentUsers)
      ? saved.recentUsers
          .filter((username) =>
            demoUsers.some((user) => user.username === username),
          )
          .slice(0, 4)
      : [];
    seed.preferences = saved.preferences ?? {};
    seed.devicePreferences = saved.devicePreferences ?? seed.devicePreferences;
    seed.audit = Array.isArray(saved.audit) ? saved.audit : [];
  } catch {
    /* Fictional accounts remain available without browser storage. */
  }
  return seed;
}
export function readAuthSession(
  allowedBranches: readonly string[] = demoSeed.branches,
): AuthSession {
  const fallbackBranch = allowedBranches[0] ?? demoSeed.branches[0];
  const empty: AuthSession = {
    username: null,
    branch: fallbackBranch,
    lang: "en",
    locked: false,
    authenticatedAt: 0,
  };
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) ?? "null",
    ) as AuthSession | null;
    if (!saved) return empty;
    const user = demoUsers.find(
      (candidate) => candidate.username === saved.username,
    );
    return {
      username: user?.username ?? null,
      branch:
        user?.role === "supervisor" &&
        [...allowedBranches, "all"].includes(saved.branch)
          ? saved.branch
          : user?.branch === "all"
            ? fallbackBranch
            : (user?.branch ?? fallbackBranch),
      lang: saved.lang === "fa" ? "fa" : "en",
      locked: Boolean(saved.locked),
      authenticatedAt: Number.isFinite(saved.authenticatedAt)
        ? saved.authenticatedAt
        : 0,
    };
  } catch {
    return empty;
  }
}
export function auditAuth(
  state: AuthState,
  action: string,
  username: string,
  now = Date.now(),
): void {
  state.audit.push({ action, username, at: new Date(now).toISOString() });
}
export function authenticate(
  state: AuthState,
  username: string,
  password: string,
  settings: AuthSettings,
  now = Date.now(),
): { state: AuthState; user?: DemoUser; error?: AuthError } {
  const next = structuredClone(state);
  const normalized = username.trim().toLowerCase();
  const user = demoUsers.find((candidate) => candidate.username === normalized);
  const account = next.accounts[normalized];
  if (account?.lockedUntil > now) return { state: next, error: "locked" };
  if (!user || !account || account.password !== password) {
    auditAuth(next, "Failed sign-in", normalized, now);
    if (account) {
      account.failedAttempts =
        account.lockedUntil && account.lockedUntil <= now
          ? 1
          : account.failedAttempts + 1;
      if (account.failedAttempts >= settings.lockout_after_failed_attempts) {
        account.lockedUntil = now + settings.lockout_minutes * 60_000;
        auditAuth(next, "Account locked", normalized, now);
        return { state: next, error: "locked" };
      }
    }
    return { state: next, error: "invalid" };
  }
  account.failedAttempts = 0;
  account.lockedUntil = 0;
  next.recentUsers = [
    normalized,
    ...next.recentUsers.filter((recent) => recent !== normalized),
  ].slice(0, 4);
  auditAuth(next, "Signed in", normalized, now);
  return { state: next, user };
}
export function passwordError(
  password: string,
  settings: AuthSettings,
): AuthError | undefined {
  if (password.length < settings.password_min_length) return "too_short";
  if (
    settings.block_common_passwords &&
    commonPasswords.has(password.toLowerCase())
  )
    return "common";
}
export function replacePassword(
  state: AuthState,
  username: string,
  password: string,
  settings: AuthSettings,
): { state: AuthState; error?: AuthError } {
  const error = passwordError(password, settings);
  if (error) return { state, error };
  if (password === state.accounts[username]?.password)
    return { state, error: "same_password" };
  const next = structuredClone(state);
  next.accounts[username] = {
    password,
    mustChangePassword: false,
    failedAttempts: 0,
    lockedUntil: 0,
  };
  auditAuth(next, "Changed password", username);
  return { state: next };
}
export function preferencesFor(
  state: AuthState,
  username: string | null,
): Preferences {
  const preference =
    (username && state.preferences[username]) || state.devicePreferences;
  return {
    theme: preference?.theme === "dark" ? "dark" : "light",
    comfortableText: Boolean(preference?.comfortableText),
    comfortableTextExplicit:
      preference?.comfortableTextExplicit ??
      Boolean(preference?.comfortableText),
  };
}
