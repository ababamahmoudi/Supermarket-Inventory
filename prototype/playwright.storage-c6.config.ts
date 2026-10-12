import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "storage-c6.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    ...base.use,
    baseURL: process.env.C6_STORAGE_BASE_URL ?? "http://127.0.0.1:5174",
  },
  webServer: process.env.C6_STORAGE_BASE_URL ? undefined : base.webServer,
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
