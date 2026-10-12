import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "c6-responsive.spec.ts",
  use: { ...base.use, baseURL: process.env.C6_BASE_URL ?? base.use?.baseURL },
  webServer: process.env.C6_BASE_URL ? undefined : base.webServer,
});
