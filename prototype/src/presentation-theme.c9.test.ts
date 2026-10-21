import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  PRESENTATION_THEME_KEY,
  rememberDisplayedTheme,
} from "./presentation-theme.c9";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

it("remembers only presentation fields in this tab without changing other stored bytes", () => {
  sessionStorage.setItem("unrelated tab data", "original tab bytes");
  localStorage.setItem("unrelated preference", "original preference bytes");
  expect(rememberDisplayedTheme("demo-person-manager", "dark")).toBe(true);
  expect(JSON.parse(sessionStorage.getItem(PRESENTATION_THEME_KEY)!)).toEqual({
    version: 1,
    user_id: "demo-person-manager",
    theme: "dark",
  });
  expect(sessionStorage.length).toBe(2);
  expect(sessionStorage.getItem("unrelated tab data")).toBe(
    "original tab bytes",
  );
  expect(localStorage.getItem("unrelated preference")).toBe(
    "original preference bytes",
  );
});

it("does not rewrite an unchanged hint and does not replace it if optional storage fails", () => {
  expect(rememberDisplayedTheme("demo-person-manager", "dark")).toBe(true);
  const original = sessionStorage.getItem(PRESENTATION_THEME_KEY);
  const write = vi.spyOn(Storage.prototype, "setItem");
  expect(rememberDisplayedTheme("demo-person-manager", "dark")).toBe(true);
  expect(write).not.toHaveBeenCalled();
  write.mockImplementation(() => {
    throw new DOMException("Session storage is unavailable.", "SecurityError");
  });
  expect(rememberDisplayedTheme("demo-person-cashier", "light")).toBe(false);
  expect(sessionStorage.getItem(PRESENTATION_THEME_KEY)).toBe(original);
});
