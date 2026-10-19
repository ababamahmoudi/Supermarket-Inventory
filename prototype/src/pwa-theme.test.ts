import { afterEach, expect, it } from "vitest";
import { synchronizeThemeColor } from "./pwa-theme";
afterEach(() => {
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.remove());
  document.documentElement.style.removeProperty("--klead-surface");
});
it("updates both OS preference metadata entries from the actual active app token", () => {
  const light = document.createElement("meta"),
    dark = document.createElement("meta");
  light.name = dark.name = "theme-color";
  light.media = "(prefers-color-scheme: light)";
  dark.media = "(prefers-color-scheme: dark)";
  document.head.append(light, dark);
  document.documentElement.style.setProperty("--klead-surface", "#181c25");
  synchronizeThemeColor(document);
  expect(light.content).toBe("#181c25");
  expect(dark.content).toBe("#181c25");
  document.documentElement.style.setProperty("--klead-surface", "#ffffff");
  synchronizeThemeColor(document);
  expect(light.content).toBe("#ffffff");
  expect(dark.content).toBe("#ffffff");
});
