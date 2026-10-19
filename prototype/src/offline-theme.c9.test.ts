import { afterEach, expect, it, vi } from "vitest";
import { createOfflinePage } from "../pwa-build";
import { AUTH_PREFERENCES_KEY } from "./auth-preferences.e1";

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("color-scheme");
  vi.unstubAllGlobals();
});

function applyOfflineBootstrap() {
  const html = createOfflinePage();
  const page = new DOMParser().parseFromString(html, "text/html");
  const script = page.head.querySelector("script");
  expect(script).not.toBeNull();
  expect(page.body.querySelector("script")?.textContent).toContain(
    "let fa=false",
  );
  new Function(script!.textContent!)();
}

it.each(["light", "dark"] as const)(
  "offline first paint follows saved %s even when the OS differs",
  (theme) => {
    vi.stubGlobal("matchMedia", () => ({ matches: theme === "light" }));
    const raw = JSON.stringify({ version: 3, device_preferences: { theme } });
    localStorage.setItem(AUTH_PREFERENCES_KEY, raw);
    applyOfflineBootstrap();
    expect(document.documentElement.dataset.theme).toBe(theme);
    expect(document.documentElement.style.colorScheme).toBe(theme);
    expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(raw);
  },
);

it("retains unreadable preferences and the existing OS fallback", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  localStorage.setItem(AUTH_PREFERENCES_KEY, "unreadable retained preferences");
  applyOfflineBootstrap();
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem(AUTH_PREFERENCES_KEY)).toBe(
    "unreadable retained preferences",
  );
});
