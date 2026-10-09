/* global process, console, document, window, getComputedStyle */
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.env.CAPTURE_BASE_URL;
if (!base)
  throw new Error(
    "CAPTURE_BASE_URL must identify a frozen production preview.",
  );
const destination =
  process.env.CAPTURE_DESTINATION ??
  resolve(root, "docs/redesign-screenshots/pr-c3");
const variants = (
  process.env.CAPTURE_VARIANTS ?? "en-light,en-dark,fa-light,phone"
).split(",");
const allScenes = [
  "suppliers-buttons",
  "products-buttons",
  "products-columns",
  "labels-selection",
  "offers-dialog",
  "notes-dialog",
  "dashboard-approvals",
  "approval-dialog",
  "undo",
];
const scenes = process.env.CAPTURE_SCREENS?.split(",") ?? allScenes;
if (
  variants.some(
    (item) => !["en-light", "en-dark", "fa-light", "phone"].includes(item),
  ) ||
  scenes.some((item) => !allScenes.includes(item))
)
  throw new Error("Unknown screenshot variant or scene.");
const seed = JSON.parse(
  await readFile(resolve(root, "seed/demo-data.json"), "utf8"),
);
const account = seed.demo_users.find((user) => user.username === "supervisor");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
});
await mkdir(destination, { recursive: true });
const results = [],
  errors = [],
  builds = [];
const regex = (en, fa = en) =>
  new RegExp(
    `^(?:${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${fa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})$`,
  );
const button = (page, en, fa) =>
  page.getByRole("button", { name: regex(en, fa) });

async function appearance(page, variant) {
  if (variant === "en-dark") await button(page, "Switch to dark theme").click();
  if (variant === "fa-light") await button(page, "فارسی").click();
}
async function setupScene(page, scene, variant) {
  const route = scene.startsWith("suppliers")
    ? "suppliers"
    : scene.startsWith("products")
      ? "products"
      : scene.startsWith("labels")
        ? "labels"
        : scene.startsWith("notes")
          ? "notes"
          : scene.startsWith("dashboard")
            ? "dashboard"
            : scene === "approval-dialog"
              ? "approvals"
              : "offers";
  await page.goto(`${base}/#${route}`);
  if (scene === "labels-selection") {
    const location = page
      .locator(".topbar")
      .getByLabel("Branch", { exact: true });
    await location.click();
    await page.getByRole("option", { name: "North York", exact: true }).click();
  }
  await appearance(page, variant);
  if (scene === "products-columns")
    await button(page, "Columns", "ستون‌ها").click();
  if (scene === "labels-selection") {
    await page
      .getByLabel(regex("Select product 0003", "انتخاب کالای 0003"))
      .click();
    await page
      .getByLabel(regex("Select product 0006", "انتخاب کالای 0006"))
      .click();
    await expect(page.locator(".labels-selection-bar")).toBeVisible();
  }
  if (scene === "offers-dialog")
    await button(page, "Create offer", "ایجاد پیشنهاد").click();
  if (scene === "notes-dialog")
    await button(page, "Add note", "افزودن یادداشت").click();
  if (scene === "approval-dialog")
    await button(page, "Approve price", "تأیید قیمت").first().click();
  if (scene === "undo") {
    await button(page, "Stop offer", "توقف پیشنهاد").first().click();
    const dialog = page.getByRole("dialog", {
      name: regex("Stop offer", "توقف پیشنهاد"),
    });
    await button(dialog, "Stop offer", "توقف پیشنهاد").click();
    await expect(page.getByTestId("undo-toast")).toBeVisible();
    // Pause just this toast through the same keyboard focus available to a user.
    await page
      .getByTestId("undo-toast")
      .getByRole("button", { name: regex("Undo", "واگرد") })
      .focus();
  }
}
async function geometry(page) {
  return page.evaluate(() => {
    const findings = [];
    const modal = document.querySelector("dialog[open]");
    const area = modal ?? document.querySelector("#main-content");
    if (!area || window.innerWidth <= 760) return findings;
    const all = [
      area,
      ...area.querySelectorAll(".card, .ui-data-table, table"),
    ];
    for (const element of all) {
      if (!element.getClientRects().length) continue;
      const bounds = element.getBoundingClientRect();
      if (element.scrollWidth > element.clientWidth + 2)
        findings.push({
          kind: "horizontal",
          tag: element.tagName,
          class: element.className,
          scroll: element.scrollWidth,
          client: element.clientWidth,
        });
      if (bounds.left < -2 || bounds.right > window.innerWidth + 2)
        findings.push({
          kind: "viewport",
          class: element.className,
          left: bounds.left,
          right: bounds.right,
        });
    }
    for (const cell of area.querySelectorAll("td, th")) {
      if (!cell.getClientRects().length) continue;
      const bounds = cell.getBoundingClientRect();
      const walk = document.createTreeWalker(cell, window.NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walk.nextNode())) {
        const parent = node.parentElement;
        if (
          !node.textContent.trim() ||
          !parent?.getClientRects().length ||
          parent.closest(
            ".sr-only, .visually-hidden, [hidden], [aria-hidden=true]",
          )
        )
          continue;
        if (getComputedStyle(parent).clipPath !== "none") continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects())
          if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
            findings.push({
              kind: "cell-text",
              text: node.textContent.trim(),
              left: rect.left,
              right: rect.right,
              cellLeft: bounds.left,
              cellRight: bounds.right,
            });
      }
    }
    return findings;
  });
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
      page.on("pageerror", (error) =>
        errors.push({ variant, scene, message: error.message }),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          errors.push({ variant, scene, message: message.text() });
      });
      const response = await page.goto(base);
      const html = await response.text();
      const entry = await page
        .locator('script[type="module"][src]')
        .getAttribute("src");
      if (!entry?.includes("/assets/"))
        throw new Error("Screenshots require an immutable production build.");
      const entryResponse = await page.request.get(new URL(entry, base).href);
      builds.push({
        variant,
        scene,
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        entry,
        entrySHA256: createHash("sha256")
          .update(await entryResponse.body())
          .digest("hex"),
      });
      await page.getByLabel("Username", { exact: true }).fill(account.username);
      await page.getByLabel("Password", { exact: true }).fill(account.password);
      await button(page, "Sign in").click();
      await expect(button(page, "Demo")).toBeVisible();
      await setupScene(page, scene, variant);
      await page.evaluate(async () => {
        await document.fonts.ready;
        window.scrollTo(0, 0);
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
      await page.mouse.move(0, 0);
      const findings = await geometry(page);
      const filename = `${scene}-${variant}.png`;
      await page.screenshot({
        path: resolve(destination, filename),
        fullPage:
          variant !== "phone" && !(await page.locator("dialog[open]").count()),
        animations: "disabled",
      });
      results.push({ scene, variant, filename, layoutFindings: findings });
      console.log(`${filename}: ${findings.length} layout findings`);
      await context.close();
    }
} finally {
  await browser.close();
  await writeFile(
    resolve(destination, "capture-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCommit: process.env.CAPTURE_SOURCE_COMMIT ?? null,
        method:
          "Fresh browser profiles, real interface actions, immutable production assets; unedited PNG screenshots. Undo is paused by user-accessible keyboard focus. Desktop probes inspect panel/table scroll and individual visible table text bounds, not page overflow alone.",
        baseURL: base,
        productionBuilds: builds,
        screens: results,
        browserErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
}
if (
  new Set(builds.map((build) => build.entrySHA256)).size !== 1 ||
  results.length !== scenes.length * variants.length ||
  errors.length ||
  results.some((item) => item.layoutFindings.length)
)
  process.exitCode = 1;
