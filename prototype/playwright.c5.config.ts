import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

if (!process.env.C5_BASE_URL)
  throw new Error("C5_BASE_URL must identify the frozen production preview.");

export default defineConfig({
  ...base,
  testMatch: /c5-(presentation|button-audit)\.spec\.ts/,
  use: { ...base.use, baseURL: process.env.C5_BASE_URL },
  webServer: undefined,
});
