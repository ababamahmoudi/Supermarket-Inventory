import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import configuration from "../../seed/arzon-config.json" with { type: "json" };
import { openShellAction, signIn } from "./helpers";

test("E3 built manifest, real service worker public cache and bilingual offline reconnect", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 932 });
  await page.goto("/");
  await signIn(page, "Manager");
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifestUrl).toBeTruthy();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "crossorigin",
    "use-credentials",
  );
  const response = await page.request.get(manifestUrl!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe(configuration.company.name);
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const png = await page.request.get(icon.src);
    expect(png.ok()).toBe(true);
    const bytes = await png.body();
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    const size = Number(icon.sizes.split("x")[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  const cacheKeys = async () =>
    page.evaluate(async () => {
      const urls: string[] = [];
      for (const key of await caches.keys()) {
        if (!key.startsWith("supermarket-public-")) continue;
        for (const request of await (await caches.open(key)).keys())
          urls.push(request.url);
      }
      return urls.sort();
    });
  const before = await cacheKeys();
  expect(before.length).toBeGreaterThan(5);
  expect(
    before.filter((url) => new URL(url).pathname.endsWith(".html")),
  ).toEqual([new URL("offline.html", page.url()).href]);
  expect(before.some((url) => /pdf\.worker.*\.mjs$/.test(url))).toBe(true);
  expect(
    before.filter((url) =>
      /\/api\/|uploads?|original|\.json(?:$|\?)/i.test(url),
    ),
  ).toEqual([]);
  await page.evaluate(async () => {
    await fetch("api/v1/e3-cache-denial-proof");
    await fetch("manifest.webmanifest?private-query=denied");
  });
  expect(await cacheKeys()).toEqual(before);
  await page.goto("/#products");
  await expect(
    page.locator(".catalog-products-table .phone-list-row").first(),
  ).toBeVisible();
  await (await openShellAction(page, "Switch to dark theme")).click();
  await expect(
    page.locator('meta[name="theme-color"]').first(),
  ).toHaveAttribute("content", "#181c25");
  const standaloneDisplayMode = await page.evaluate(
    () => matchMedia("(display-mode: standalone)").matches,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("app-phone-dark.png"),
    fullPage: false,
  });
  const evidence = {
    standaloneDisplayMode,
    screenshotMeaning:
      "Actual dark Chromium browser at phone width. This is not an installed home-screen app or a physical phone screenshot.",
    manifest,
    publicCachedUrls: before,
    privacyRequestsDidNotChangeCache: true,
    physicalInstallation:
      "Not tested. This test uses Chromium, not an actual phone home-screen installation.",
    exactWorker: readFileSync(resolve("dist/service-worker.js"), "utf8"),
  };
  await testInfo.attach("E3 actual PWA evidence", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No connection", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("offline-english.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "اتصال برقرار نیست", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("offline-persian.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await page.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await expect(page.locator(".topbar")).toBeVisible();
  expect(errors).toEqual([]);
});
