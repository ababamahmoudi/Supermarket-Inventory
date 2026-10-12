/* global process, console, document, window, localStorage, URL */
import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appearance,
  button,
  choose,
  exact,
  field,
  settled,
  today,
} from "./c5-browser-proof.mjs";
import { inspectResponsiveLayout } from "./c6-layout-proof.mjs";
import { setupCatalogScene } from "./c6-catalog-scenes.mjs";
import { setupInvoiceScene } from "./c6-invoice-scenes.mjs";
import { setupReturnScene } from "./c6-return-scenes.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.env.CAPTURE_BASE_URL;
const sourceCommit = process.env.CAPTURE_SOURCE_COMMIT;
const stage = process.env.CAPTURE_STAGE ?? "c6";
if (!base || !sourceCommit || !["c6", "c7"].includes(stage))
  throw new Error(
    "Set CAPTURE_BASE_URL, CAPTURE_SOURCE_COMMIT and CAPTURE_STAGE for a frozen production build.",
  );
const destination =
  process.env.CAPTURE_DESTINATION ??
  resolve(root, `docs/redesign-screenshots/pr-${stage}`);
const allScenes = [
  "topbar",
  "lookup-clearance-dates",
  "date-tracking",
  "edit-product-dates",
  "invoices-list",
  "manual-invoice-missing",
  "products",
  "received-range",
  "returns-list",
  "pickup-shortfall",
  "partial-resolution",
  "return-memo",
  "payables-ledger",
  "supplier-cards",
  "dashboard",
  "approvals",
  "settings",
];
const allVariants = [
  "en-light",
  "en-dark",
  "fa-light",
  "mid-900",
  "phone-dark",
];
const scenes = process.env.CAPTURE_SCREENS?.split(",") ?? allScenes;
const variants = process.env.CAPTURE_VARIANTS?.split(",") ?? allVariants;
if (
  new Set(scenes).size !== scenes.length ||
  new Set(variants).size !== variants.length ||
  scenes.some((value) => !allScenes.includes(value)) ||
  variants.some((value) => !allVariants.includes(value))
)
  throw new Error("Unknown or duplicate capture scenes/variants.");
const seed = JSON.parse(
  await readFile(resolve(root, "seed/demo-data.json"), "utf8"),
);
const account = seed.demo_users.find((user) => user.username === "supervisor");
if (!account?.password)
  throw new Error("Missing approved demo Supervisor account.");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
});
const helpers = { button, field, choose, exact, today };
const screens = [],
  errors = [],
  productionBuilds = [];
await mkdir(destination, { recursive: true });

async function assets(page) {
  const response = await page.request.get(base);
  if (!response.ok())
    throw new Error(`Production HTML returned ${response.status()}.`);
  const html = await response.text();
  if (html.includes("/@vite/client"))
    throw new Error("Screenshots require a production build without HMR.");
  const paths = await page
    .locator('script[type="module"][src],link[rel="stylesheet"][href]')
    .evaluateAll((elements) =>
      elements
        .map(
          (element) =>
            element.getAttribute("src") ?? element.getAttribute("href"),
        )
        .sort(),
    );
  if (!paths.length) throw new Error("No production assets found.");
  const entries = [];
  for (const path of paths) {
    const url = new URL(path, base);
    if (
      url.origin !== new URL(base).origin ||
      !url.pathname.startsWith("/assets/")
    )
      throw new Error("Unexpected external or mutable production asset.");
    const asset = await page.request.get(url.href);
    if (!asset.ok())
      throw new Error(`Asset ${url.pathname} returned ${asset.status()}.`);
    entries.push({ path: url.pathname, sha256: sha(await asset.body()) });
  }
  return {
    htmlSHA256: sha(html),
    fingerprint: sha(JSON.stringify(entries)),
    assets: entries,
  };
}
async function visit(page, route) {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, route);
  await settled(page);
}
async function fixture(page, scene) {
  const catalog = [
    "lookup-clearance-dates",
    "date-tracking",
    "edit-product-dates",
    "products",
  ];
  const invoices = [
    "invoices-list",
    "manual-invoice-missing",
    "received-range",
    "supplier-cards",
  ];
  const returns = [
    "returns-list",
    "pickup-shortfall",
    "partial-resolution",
    "return-memo",
  ];
  if (catalog.includes(scene)) return setupCatalogScene(page, scene, helpers);
  if (invoices.includes(scene)) return setupInvoiceScene(page, scene, helpers);
  if (returns.includes(scene)) return setupReturnScene(page, scene, helpers);
  if (scene === "payables-ledger") {
    await visit(page, "payables");
    const supplierRow = page
      .locator(".payables-overview-table tbody tr")
      .filter({ hasText: "Fresh Valley Foods" })
      .first();
    const supplierLink = supplierRow.getByRole("link", {
      name: "Fresh Valley Foods",
      exact: true,
    });
    if (await supplierLink.count()) await supplierLink.click();
    else await supplierRow.click();
    await expect(page.locator(".payables-ledger-table")).toBeVisible();
    return { selector: ".payables-ledger-card", capture: "page" };
  }
  await visit(page, scene === "topbar" ? "dashboard" : scene);
  return {
    selector: scene === "topbar" ? ".topbar" : "#main-content",
    capture: scene === "topbar" ? "element" : "page",
  };
}

try {
  for (const variant of variants)
    for (const scene of scenes) {
      const viewport =
        variant === "phone-dark"
          ? { width: 390, height: 844 }
          : variant === "mid-900"
            ? { width: 900, height: 1080 }
            : { width: 1440, height: 1080 };
      const context = await browser.newContext({
        baseURL: base,
        viewport,
        deviceScaleFactor: 1,
        isMobile: variant === "phone-dark",
        hasTouch: variant === "phone-dark",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.on("pageerror", (error) =>
        errors.push({ scene, variant, message: error.message }),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          errors.push({ scene, variant, message: message.text() });
      });
      try {
        await page.goto(base);
        const before = await assets(page);
        productionBuilds.push({ scene, variant, phase: "before", ...before });
        await field(page, "Username").fill(account.username);
        await field(page, "Password").fill(account.password);
        await button(page, "Sign in").click();
        await expect(button(page, "Demo")).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              () => localStorage.getItem("supermarket-prototype-v1") !== null,
            ),
          )
          .toBe(true);
        await choose(
          page,
          field(page.locator(".topbar"), "Branch"),
          "North York",
        );
        const setup = await fixture(page, scene);
        await appearance(
          page,
          variant === "phone-dark"
            ? "en-dark"
            : variant === "mid-900"
              ? "en-light"
              : variant,
        );
        await setup.afterAppearance?.(page);
        await expect(page.locator(setup.selector).first()).toBeVisible();
        await settled(page);
        const proof = await inspectResponsiveLayout(
          page,
          scene,
          variant === "fa-light" ? "fa" : "en",
          viewport.width,
        );
        const after = await assets(page);
        productionBuilds.push({ scene, variant, phase: "after", ...after });
        if (
          before.fingerprint !== after.fingerprint ||
          before.htmlSHA256 !== after.htmlSHA256
        )
          throw new Error("Production assets changed during capture.");
        const filename = `${scene}-${variant}.png`;
        await page.mouse.move(0, 0);
        await page.evaluate(() => {
          window.scrollTo(0, 0);
          for (const element of document.querySelectorAll(".table-wrap")) {
            element.scrollLeft = 0;
            element.scrollTop = 0;
          }
        });
        if (setup.capture === "element")
          await page
            .locator(setup.selector)
            .first()
            .screenshot({
              path: resolve(destination, filename),
              animations: "disabled",
            });
        else
          await page.screenshot({
            path: resolve(destination, filename),
            fullPage: setup.capture !== "viewport",
            animations: "disabled",
          });
        const png = await readFile(resolve(destination, filename));
        screens.push({
          scene,
          variant,
          filename,
          sha256: sha(png),
          viewport,
          role: "supervisor",
          route: new URL(page.url()).hash,
          captureMode: setup.capture,
          fixtureEvidence: await page
            .locator(setup.selector)
            .first()
            .innerText(),
          fixtureInputs: setup.evidence ?? null,
          layout: proof,
        });
        console.log(
          `${filename}: ${proof.words} measured words, ${proof.failures.length} layout findings`,
        );
      } catch (error) {
        errors.push({ scene, variant, message: error.message });
        console.error(`${scene}-${variant}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
} finally {
  await browser.close();
  await writeFile(
    resolve(destination, "capture-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCommit,
        stage,
        expectedCount: scenes.length * variants.length,
        method:
          "Fresh profiles, approved fictional seed and real UI actions. Unedited original PNGs. Production HTML/JavaScript/CSS hashes before and after each image, actual word/control/scroll geometry and pixel hashes retained.",
        productionBuilds,
        screens,
        browserErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
}
if (
  screens.length !== scenes.length * variants.length ||
  errors.length ||
  screens.some((screen) => screen.layout.failures.length) ||
  new Set(productionBuilds.map((build) => build.fingerprint)).size !== 1 ||
  new Set(productionBuilds.map((build) => build.htmlSHA256)).size !== 1
)
  process.exitCode = 1;
