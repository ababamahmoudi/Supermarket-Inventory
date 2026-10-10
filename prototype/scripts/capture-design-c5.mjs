/* global process, console */
import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import {
  appearance,
  button,
  choose,
  exact,
  field,
  inspect,
  settled,
  today,
} from "./c5-browser-proof.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.env.CAPTURE_BASE_URL;
if (!base)
  throw new Error(
    "CAPTURE_BASE_URL must identify a frozen production preview.",
  );
const destination =
  process.env.CAPTURE_DESTINATION ??
  resolve(root, "docs/redesign-screenshots/pr-c5");
const variants = (
  process.env.CAPTURE_VARIANTS ?? "en-light,en-dark,fa-light,phone"
).split(",");
const allScenes = [
  "topbar",
  "invoices-list",
  "products-weight",
  "alerts",
  "returns-list",
  "return-detail",
  "return-policy",
  "date-quick-add",
  "lookup-dates",
  "offers-current",
  "offers-past",
  "posted-invoice",
  "original-whole-page",
  "correct-invoice",
  "approvals-tabs",
];
const scenes = process.env.CAPTURE_SCREENS?.split(",") ?? allScenes;
if (
  new Set(variants).size !== variants.length ||
  new Set(scenes).size !== scenes.length ||
  variants.some(
    (value) => !["en-light", "en-dark", "fa-light", "phone"].includes(value),
  ) ||
  scenes.some((value) => !allScenes.includes(value))
)
  throw new Error("Unknown or duplicate capture variants/scenes.");
const seed = JSON.parse(
  await readFile(resolve(root, "seed/demo-data.json"), "utf8"),
);
const account = seed.demo_users.find((user) => user.username === "supervisor");
if (!account?.password)
  throw new Error("Missing approved Supervisor demo account.");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
});
const screens = [],
  errors = [],
  productionBuilds = [],
  audits = [];
await mkdir(destination, { recursive: true });

async function assets(page) {
  const response = await page.request.get(base);
  if (!response.ok())
    throw new Error(`Production HTML returned ${response.status()}.`);
  const html = await response.text();
  if (html.includes("/@vite/client"))
    throw new Error("Review captures require production assets.");
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
  if (!paths.length || paths.some((path) => !path.startsWith("/assets/")))
    throw new Error("The preview does not expose a frozen production bundle.");
  const entries = [];
  for (const path of paths) {
    const asset = await page.request.get(new URL(path, base).href);
    if (!asset.ok())
      throw new Error(`Production asset returned ${asset.status()}: ${path}`);
    entries.push({ path, SHA256: sha(await asset.body()) });
  }
  return {
    htmlSHA256: sha(html),
    assets: entries,
    fingerprint: sha(JSON.stringify(entries)),
  };
}

async function visit(page, route) {
  await page.goto(`${base}/#${route}`);
  await expect(button(page, "Demo", "دمو")).toBeVisible();
}

async function pickup(page) {
  await visit(page, "return?id=demo-return-1");
  await button(page.locator(".return-header-card"), "Record pickup").click();
  const card = page.locator(".return-action-card");
  await card.getByLabel(/Actual pickup units$/).fill("3");
  await field(card, "Supplier representative name").fill("Demo Driver");
  await field(card, "Signed paper pickup slip reference").fill(
    "SIGNED-C5-REVIEW-001",
  );
  await button(card, "Record pickup").click();
  await expect(page.locator(".return-detail-title")).toContainText(
    "Waiting for credit",
  );
}

async function setup(page, scene, variant) {
  let selector = "#main-content",
    capture = "page";
  if (
    ["posted-invoice", "original-whole-page", "correct-invoice"].includes(scene)
  ) {
    await visit(page, "invoices?id=a2-fixture%3AFV-20390");
    await expect(page.locator(".posted-invoice-document")).toContainText(
      "FV-20390",
    );
    const image = page.locator(".invoice-original-media img");
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((element) => element.naturalWidth))
      .toBeGreaterThan(0);
    await appearance(page, variant);
    await expect(page.locator(".invoice-original-media")).toHaveAttribute(
      "data-fit",
      "page",
    );
    if (scene === "correct-invoice") {
      await button(page, "Correct invoice", "اصلاح فاکتور").click();
      selector = ".invoice-correction-dialog";
      capture = "viewport";
    } else if (scene === "original-whole-page") {
      selector = ".invoice-original-card";
      capture = "element";
    }
  } else if (scene === "topbar") {
    await visit(page, "dashboard");
    await appearance(page, variant);
    selector = ".topbar";
    capture = "element";
  } else if (scene === "invoices-list") {
    await visit(page, "invoices");
    await appearance(page, variant);
    await page.getByRole("tab", { name: exact("Posted", "ثبت‌شده") }).click();
    selector = ".invoice-posted-list";
  } else if (scene === "products-weight") {
    await visit(page, "products");
    await field(page, "Search products").fill("0016");
    await expect(page.locator(".catalog-table")).toContainText("$7.49/lb");
    await expect(page.locator(".catalog-table")).toContainText("$16.51/kg");
    await appearance(page, variant);
    selector = ".catalog-table";
  } else if (scene === "alerts") {
    await visit(page, "alerts");
    await appearance(page, variant);
  } else if (scene === "returns-list") {
    await pickup(page);
    await visit(page, "returns");
    await appearance(page, variant);
    selector = ".returns-overview-table";
    await expect(page.locator(selector)).toContainText(
      /Waiting for credit|در انتظار اعتبار/,
    );
  } else if (scene === "return-detail" || scene === "return-policy") {
    await visit(page, "return?id=demo-return-1");
    await appearance(page, variant);
    selector = ".return-detail-header";
    if (scene === "return-policy") {
      await button(page, "Return policy", "سیاست مرجوعی").click();
      selector = ".return-policy-dialog";
      capture = "viewport";
    }
  } else if (scene === "date-quick-add") {
    await visit(page, "expiry");
    const quick = page.locator(".date-quick-card");
    await field(quick, "Product").fill("0001");
    await today(page, quick);
    await button(quick, "More").click();
    await field(quick, "Quantity (optional)").fill("2");
    await field(quick, "Lot (optional)").fill("C5-SHELF-001");
    await field(quick, "Note (optional)").fill(
      "Shelf check recorded in the demo.",
    );
    await appearance(page, variant);
    selector = ".date-quick-card";
  } else if (scene === "lookup-dates") {
    await visit(page, "lookup");
    await field(page, "Search products").fill("0001");
    const dates = page.locator(".product-dates-section");
    await expect(dates).toBeVisible();
    await today(page, dates.locator(".date-quick-add-inline"));
    await appearance(page, variant);
    selector = ".product-dates-section";
  } else if (scene === "offers-current" || scene === "offers-past") {
    await visit(page, "offers");
    const row = page.locator(
      '.current-offers-table tr[data-product-code="0003"]',
    );
    await expect(row).toHaveCount(1);
    if (scene === "offers-past") {
      await button(row, "Stop offer").click();
      await button(
        page.getByRole("dialog", { name: "Stop offer", exact: true }),
        "Stop offer",
      ).click();
      await page.getByRole("tab", { name: "Past offers", exact: true }).click();
      await expect(page.locator(".past-offers-table")).toContainText("Stopped");
    }
    await appearance(page, variant);
    selector =
      scene === "offers-past" ? ".past-offers-table" : ".current-offers-table";
  } else if (scene === "approvals-tabs") {
    await visit(page, "approvals");
    await appearance(page, variant);
    await expect(
      page.getByRole("tab", { name: exact("Pending", "در انتظار") }),
    ).toHaveAttribute("aria-selected", "true");
  }
  await expect(page.locator(selector).first()).toBeVisible();
  await settled(page);
  return {
    selector,
    capture,
    evidence: await page.locator(selector).first().innerText(),
  };
}

try {
  for (const variant of variants)
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport:
          variant === "phone"
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: variant === "phone",
        hasTouch: variant === "phone",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
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
        await choose(
          page,
          field(page.locator(".topbar"), "Branch"),
          "North York",
        );
        const fixture = await setup(page, scene, variant);
        const proof = await inspect(page, scene, variant);
        audits.push(proof);
        const after = await assets(page);
        productionBuilds.push({ scene, variant, phase: "after", ...after });
        if (
          before.fingerprint !== after.fingerprint ||
          before.htmlSHA256 !== after.htmlSHA256
        )
          throw new Error("Production assets changed during capture.");
        const filename = `${scene}-${variant}.png`;
        await page.mouse.move(0, 0);
        if (fixture.capture === "element")
          await page
            .locator(fixture.selector)
            .first()
            .screenshot({
              path: resolve(destination, filename),
              animations: "disabled",
            });
        else
          await page.screenshot({
            path: resolve(destination, filename),
            fullPage: fixture.capture === "page",
            animations: "disabled",
          });
        screens.push({
          scene,
          variant,
          filename,
          role: "supervisor",
          captureMode: fixture.capture,
          viewport: page.viewportSize(),
          route: new URL(page.url()).hash,
          fixtureEvidence: fixture.evidence,
          layoutFindings: proof.failures,
          measuredButtons: proof.buttons.length,
        });
        console.log(
          `${filename}: ${proof.buttons.length} controls; ${proof.failures.length} findings`,
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
    resolve(destination, "button-audit.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCommit: process.env.CAPTURE_SOURCE_COMMIT ?? null,
        measurements: audits,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    resolve(destination, "capture-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCommit: process.env.CAPTURE_SOURCE_COMMIT ?? null,
        method:
          "Fresh browser profiles, approved seed and real interface actions; no fabricated business records or screenshot editing. Production HTML/JavaScript/CSS SHA-256 checks before and after every image. Fonts and theme transitions settle before geometry. All real controls measured; semantic widgets identified separately.",
        baseURL: base,
        expectedCount: scenes.length * variants.length,
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
  new Set(productionBuilds.map((build) => build.fingerprint)).size !== 1 ||
  new Set(productionBuilds.map((build) => build.htmlSHA256)).size !== 1 ||
  screens.length !== scenes.length * variants.length ||
  errors.length ||
  screens.some((screen) => screen.layoutFindings.length)
)
  process.exitCode = 1;
