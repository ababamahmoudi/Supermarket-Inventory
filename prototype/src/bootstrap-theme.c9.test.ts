import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AUTH_IDENTITY_KEY,
  AUTH_PREFERENCES_KEY,
  emptyPreferences,
  writeIdentity,
} from "./auth-preferences.e1";
import html from "../index.html?raw";
import { authenticationFixture } from "./shell-provider-test-fixture";
import {
  PRESENTATION_THEME_KEY,
  rememberDisplayedTheme,
} from "./presentation-theme.c9";

const bootstrap = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
if (!bootstrap) throw new Error("The pre-module theme bootstrap is missing.");
const applyBootstrap = new Function(bootstrap);
const disposers: (() => void)[] = [];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});
afterEach(() => {
  disposers.splice(0).forEach((close) => close());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--klead-surface");
  document
    .querySelectorAll("[data-c9-theme-test]")
    .forEach((meta) => meta.remove());
});

it("applies the saved device theme before app modules without modifying stored preferences", () => {
  const preferences = emptyPreferences();
  preferences.device_preferences.theme = "dark";
  preferences.by_user_id["another-person"] = {
    theme: "light",
    comfortableText: true,
  };
  const original = JSON.stringify(preferences);
  localStorage.setItem(AUTH_PREFERENCES_KEY, original);
  applyBootstrap();
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(original);
  expect(html.indexOf('href="/src/klead-tokens.css"')).toBeLessThan(
    html.indexOf("<script>"),
  );
  expect(html.indexOf("<script>")).toBeLessThan(
    html.indexOf('<script type="module"'),
  );
  expect(html).toContain("background: var(--klead-page)");
});

it("uses light for a first visit and preserves malformed original preferences for the provider", () => {
  applyBootstrap();
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  localStorage.setItem(AUTH_PREFERENCES_KEY, "unreadable original");
  expect(() => applyBootstrap()).not.toThrow();
  expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(
    "unreadable original",
  );
  expect(document.documentElement.style.colorScheme).toBe("light");
});

it("does not stop app startup or write replacement preferences when browser storage is denied", () => {
  const write = vi.spyOn(Storage.prototype, "setItem");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Browser storage is denied.", "SecurityError");
  });
  expect(() => applyBootstrap()).not.toThrow();
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(write).not.toHaveBeenCalled();
});

it("uses the retained E3 current-session display hint before app startup without writing identity or preferences", async () => {
  const fixture = await authenticationFixture();
  disposers.push(fixture.dispose);
  const manager = await fixture.service.switchDemoUser(
    fixture.companyId,
    "manager",
  );
  writeIdentity(manager.identity);
  const identity = sessionStorage.getItem(AUTH_IDENTITY_KEY);
  expect(JSON.parse(identity!)).toEqual({
    company_id: fixture.companyId,
    session_id: manager.identity.session_id,
  });
  const preferences = emptyPreferences();
  preferences.device_preferences.theme = "light";
  preferences.recent_user_ids = [manager.person.id];
  preferences.by_user_id[manager.person.id] = {
    theme: "dark",
    comfortableText: false,
  };
  const original = JSON.stringify(preferences);
  localStorage.setItem(AUTH_PREFERENCES_KEY, original);
  const write = vi.spyOn(Storage.prototype, "setItem");
  applyBootstrap();
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(original);
  expect(sessionStorage.getItem(AUTH_IDENTITY_KEY)).toBe(identity);
  expect(write).not.toHaveBeenCalled();
});

it("keeps the chosen device sign-in theme when there is no current session", () => {
  const preferences = emptyPreferences();
  preferences.device_preferences.theme = "dark";
  preferences.recent_user_ids = ["recent-person"];
  preferences.by_user_id["recent-person"] = {
    theme: "light",
    comfortableText: false,
  };
  localStorage.setItem(AUTH_PREFERENCES_KEY, JSON.stringify(preferences));
  rememberDisplayedTheme("recent-person", "light");
  applyBootstrap();
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(sessionStorage.getItem(AUTH_IDENTITY_KEY)).toBeNull();
});

it.each(["unreadable identity", JSON.stringify({ user_id: "recent-person" })])(
  "retains a valid dark device preference for malformed session data: %s",
  (identity) => {
    const preferences = emptyPreferences();
    preferences.device_preferences.theme = "dark";
    preferences.recent_user_ids = ["recent-person"];
    preferences.by_user_id["recent-person"] = {
      theme: "light",
      comfortableText: false,
    };
    const original = JSON.stringify(preferences);
    localStorage.setItem(AUTH_PREFERENCES_KEY, original);
    sessionStorage.setItem(AUTH_IDENTITY_KEY, identity);
    applyBootstrap();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(original);
    expect(sessionStorage.getItem(AUTH_IDENTITY_KEY)).toBe(identity);
  },
);

it("retains the valid device theme when only session storage is denied", () => {
  const preferences = emptyPreferences();
  preferences.device_preferences.theme = "dark";
  const original = JSON.stringify(preferences);
  localStorage.setItem(AUTH_PREFERENCES_KEY, original);
  const get = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
    this: Storage,
    key: string,
  ) {
    if (key === AUTH_IDENTITY_KEY)
      throw new DOMException("Session storage is denied.", "SecurityError");
    return get.call(this, key);
  });
  const write = vi.spyOn(Storage.prototype, "setItem");
  expect(() => applyBootstrap()).not.toThrow();
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(original);
  expect(write).not.toHaveBeenCalled();
});

it.each(["dark", "light"] as const)(
  "prefers the current tab's saved user theme %s over another tab's recent user",
  async (theme) => {
    const fixture = await authenticationFixture();
    disposers.push(fixture.dispose);
    const manager = await fixture.service.switchDemoUser(
      fixture.companyId,
      "manager",
    );
    writeIdentity(manager.identity);
    const preferences = emptyPreferences();
    preferences.device_preferences.theme = "light";
    preferences.recent_user_ids = ["demo-person-cashier"];
    preferences.by_user_id["demo-person-cashier"] = {
      theme: "light",
      comfortableText: false,
    };
    preferences.by_user_id[manager.person.id] = {
      theme,
      comfortableText: false,
    };
    const original = JSON.stringify(preferences);
    localStorage.setItem(AUTH_PREFERENCES_KEY, original);
    rememberDisplayedTheme(manager.person.id, "dark");
    const hint = sessionStorage.getItem(PRESENTATION_THEME_KEY);
    const identity = sessionStorage.getItem(AUTH_IDENTITY_KEY);
    applyBootstrap();
    expect(document.documentElement).toHaveAttribute("data-theme", theme);
    expect(document.documentElement.style.colorScheme).toBe(theme);
    expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(original);
    expect(sessionStorage.getItem(PRESENTATION_THEME_KEY)).toBe(hint);
    expect(sessionStorage.getItem(AUTH_IDENTITY_KEY)).toBe(identity);
  },
);

it("sets both browser-chrome theme colors from the current surface before body rendering", () => {
  const preferences = emptyPreferences();
  preferences.device_preferences.theme = "dark";
  localStorage.setItem(AUTH_PREFERENCES_KEY, JSON.stringify(preferences));
  const surface = "rgb(24, 28, 37)";
  document.documentElement.style.setProperty("--klead-surface", surface);
  const metas = ["light", "dark"].map((mode) => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "original surface";
    meta.media = `(prefers-color-scheme: ${mode})`;
    meta.dataset.c9ThemeTest = "";
    document.head.append(meta);
    return meta;
  });
  applyBootstrap();
  expect(metas.map((meta) => meta.content)).toEqual([surface, surface]);
  const metaTags = [...html.matchAll(/<meta\s[^>]*name="theme-color"[^>]*>/g)];
  expect(metaTags).toHaveLength(2);
  for (const meta of metaTags)
    expect(meta.index).toBeLessThan(html.indexOf("<script>"));
  expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("<body>"));
});
