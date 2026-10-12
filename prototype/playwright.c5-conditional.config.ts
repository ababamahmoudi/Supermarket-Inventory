import { defineConfig } from "@playwright/test";
import base from "./playwright.c5.config";

export default defineConfig({
  ...base,
  testMatch: /c5-conditional-audit\.spec\.ts/,
  workers: 1,
});
