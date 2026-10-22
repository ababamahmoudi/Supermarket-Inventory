import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 60000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "webkit-no-reload",
      testMatch: "c9-no-reload.spec.ts",
      use: {
        ...devices["Desktop Safari"],
        browserName: "webkit",
        // The existing optional system Chromium executable is not WebKit.
        launchOptions: {},
      },
    },
    {
      name: "firefox-receiving",
      testMatch: "r2-receiving-stability.spec.ts",
      use: {
        ...devices["Desktop Firefox"],
        browserName: "firefox",
        // A configured system Chromium executable cannot run Firefox.
        launchOptions: {},
      },
    },
  ],
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
