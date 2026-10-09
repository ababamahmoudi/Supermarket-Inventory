/* global process, console, document, window, innerWidth, innerHeight, getComputedStyle */
import { chromium, expect } from "@playwright/test";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

// Run against an immutable production preview, never a changing development server.
// Business records are created through the interface in fresh browser profiles.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const phase = process.env.CAPTURE_PHASE ?? "c1";
if (phase !== "c1")
  throw new Error("C2 scene actions have not been added yet.");
const destination = resolve(root, `docs/redesign-screenshots/pr-${phase}`);
const base = process.env.CAPTURE_BASE_URL;
if (!base)
  throw new Error(
    "Set CAPTURE_BASE_URL to the approved immutable build preview.",
  );
const variants = process.env.CAPTURE_VARIANTS
  ? process.env.CAPTURE_VARIANTS.split(",").map((value) => value.trim())
  : ["en-light", "en-dark", "fa-light", "phone"];
if (
  variants.some(
    (value) => !["en-light", "en-dark", "fa-light", "phone"].includes(value),
  )
)
  throw new Error(`Unknown screenshot variant: ${variants.join(", ")}`);
const scenes = [
  "received",
  "warehouse-picker",
  "regular-labels-grayscale",
  "promo-labels-grayscale",
  "manual-price",
  "custom-notebook-all-branches",
];
// C2 adds real UI scenes for Orders list/new/print, all invoice discrepancy types,
// Supplier items, and Branch requests outgoing/incoming/receiving.
const selectedScreens = process.env.CAPTURE_SCREENS?.split(",").map((value) =>
  value.trim(),
);
if (selectedScreens?.some((screen) => !scenes.includes(screen)))
  throw new Error(`Unknown ${phase} screenshot scene.`);
const seed = JSON.parse(
  await readFile(resolve(root, "seed/demo-data.json"), "utf8"),
);
await mkdir(destination, { recursive: true });
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if (!executablePath) {
  try {
    await access("/usr/bin/chromium");
    executablePath = "/usr/bin/chromium";
  } catch {
    // Otherwise use Playwright's installed Chromium.
  }
}
const browser = await chromium.launch({ executablePath, headless: true });
let previous = { screens: [], browserErrors: [], printProof: [] };
if (selectedScreens || process.env.CAPTURE_VARIANTS) {
  try {
    previous = JSON.parse(
      await readFile(resolve(destination, "capture-results.json"), "utf8"),
    );
  } catch {
    // There is no report on a first targeted capture.
  }
}
const results = previous.screens.filter(
  (item) =>
    !(
      variants.includes(item.variant) &&
      (!selectedScreens || selectedScreens.includes(item.screen))
    ),
);
const errors = previous.browserErrors.filter(
  (item) => !variants.includes(item.variant),
);
const printProof = (previous.printProof ?? []).filter(
  (item) =>
    !(
      variants.includes(item.variant) &&
      (!selectedScreens ||
        selectedScreens.includes(`${item.style}-labels-grayscale`))
    ),
);
const builds = [];
const exact = (en, fa = en) =>
  new RegExp(
    `^(?:${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${fa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})$`,
  );
const button = (scope, en, fa = en) =>
  scope.getByRole("button", { name: exact(en, fa) });
const field = (scope, en, fa = en) => scope.getByLabel(exact(en, fa));

async function english(page) {
  if ((await page.locator("html").getAttribute("lang")) === "fa")
    await button(page, "English").click();
}
async function appearance(page, variant) {
  await english(page);
  const dark = variant === "en-dark";
  if (
    ((await page.locator("html").getAttribute("data-theme")) === "dark") !==
    dark
  )
    await button(
      page,
      dark ? "Switch to dark theme" : "Switch to light theme",
    ).click();
  if (variant === "fa-light") await button(page, "فارسی").click();
}
async function visit(page, route, title) {
  await english(page);
  await page.goto(`${base}/#${route}`);
  await expect(
    page.getByRole("heading", { name: title, exact: true, level: 1 }),
  ).toBeVisible();
}
async function choose(page, control, en, fa = en) {
  await control.click();
  await page.getByRole("option", { name: exact(en, fa) }).click();
}
async function location(page, name) {
  await english(page);
  await choose(page, field(page.locator(".topbar"), "Branch"), name);
}
async function capture(page, screen, variant, keepPopup = false) {
  if (selectedScreens && !selectedScreens.includes(screen)) return;
  if (!keepPopup) await appearance(page, variant);
  await page.mouse.move(0, 0);
  await page.clock.runFor(5001);
  await page.clock.runFor(32);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.activeElement?.blur();
    window.scrollTo(0, 0);
    document.querySelectorAll(".ui-data-table").forEach((element) => {
      element.scrollLeft = 0;
    });
  });
  await page.waitForTimeout(160);
  const metrics = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        style.clipPath === "none" &&
        bounds.width > 4 &&
        bounds.height > 4
      );
    };
    const millimetres = (element) => ({
      width: (Number.parseFloat(getComputedStyle(element).width) * 25.4) / 96,
      height: (Number.parseFloat(getComputedStyle(element).height) * 25.4) / 96,
    });
    const sidebar = document.querySelector(".sidebar nav");
    const tables = [...document.querySelectorAll(".ui-data-table table")].map(
      (table) => {
        const headers = [...table.querySelectorAll("thead tr:first-child th")];
        const cells = [...table.querySelectorAll("tbody tr:first-child td")];
        return headers.map((header, index) => {
          if (!cells[index]) return null;
          const head = header.getBoundingClientRect();
          const cell = cells[index].getBoundingClientRect();
          return {
            column: header.textContent.trim(),
            leftDifference: Math.abs(head.left - cell.left),
            rightDifference: Math.abs(head.right - cell.right),
          };
        });
      },
    );
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      route: window.location.hash,
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      kpis: document.querySelectorAll(".kpi-card").length,
      visibleNativeControls: [
        ...document.querySelectorAll(
          'select,input[type="file"],input[type="checkbox"],input[type="radio"],input[type="date"],input[type="time"],input[type="number"],input[type="month"],details',
        ),
      ]
        .filter(visible)
        .map((element) => element.tagName.toLowerCase()),
      resizeHandles: [...document.querySelectorAll("textarea")].filter(
        (element) =>
          visible(element) && getComputedStyle(element).resize !== "none",
      ).length,
      sidebarScrolls: sidebar
        ? sidebar.scrollHeight > sidebar.clientHeight
        : false,
      tableColumns: tables,
      labelSheets: [
        ...document.querySelectorAll(".label-bilingual-preview .print-sheet"),
      ].map(millimetres),
      labels: [
        ...document.querySelectorAll(".label-bilingual-preview .shelf-label"),
      ].map((element) => ({
        ...millimetres(element),
        style: element.classList.contains("promo-shelf-label")
          ? "promo"
          : "regular",
        text: element.textContent.trim(),
      })),
      grayscaleFilters: [
        ...document.querySelectorAll(".label-grayscale-preview"),
      ].map((element) => getComputedStyle(element).filter),
    };
  });
  const file = `${screen}-${variant}.png`;
  await page.screenshot({
    path: resolve(destination, file),
    fullPage: !keepPopup && !(await page.locator("dialog[open]").count()),
    animations: "disabled",
  });
  results.push({ screen, variant, file, ...metrics });
  console.log(`Captured ${file}`);
  if (!keepPopup) await english(page);
}
async function printLabelsPDF(page, style, variant) {
  if (selectedScreens && !selectedScreens.includes(`${style}-labels-grayscale`))
    return;
  await appearance(page, variant);
  await button(page, "Print labels", "چاپ برچسب‌ها").click();
  await expect(page.locator(".label-print-output .shelf-label")).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  const geometry = await page
    .locator(".label-print-output .shelf-label")
    .evaluateAll((labels) =>
      labels.map((element) => {
        const box = element.getBoundingClientRect();
        const sheet = element.closest(".print-sheet").getBoundingClientRect();
        const frame = element.querySelector(".promo-label-frame");
        return {
          widthMM: (box.width * 25.4) / 96,
          heightMM: (box.height * 25.4) / 96,
          sheetWidthMM: (sheet.width * 25.4) / 96,
          sheetHeightMM: (sheet.height * 25.4) / 96,
          frameInsetMM: frame
            ? ((frame.getBoundingClientRect().left - box.left) * 25.4) / 96
            : null,
          frameStrokeMM: frame
            ? (Number(
                frame.querySelector("rect").getAttribute("stroke-width"),
              ) *
                frame.getBoundingClientRect().width *
                25.4) /
              (frame.viewBox.baseVal.width * 96)
            : null,
        };
      }),
    );
  const file = `${style}-labels-${variant}.pdf`;
  await page.pdf({
    path: resolve(destination, file),
    preferCSSPageSize: true,
    printBackground: true,
  });
  printProof.push({ style, variant, file, geometry });
  await page.emulateMedia({ media: "screen" });
  await button(page.getByRole("dialog"), "No", "خیر").click();
  await english(page);
}

try {
  for (const variant of variants) {
    const context = await browser.newContext({
      viewport:
        variant === "phone"
          ? { width: 390, height: 844 }
          : { width: 1600, height: 1080 },
      deviceScaleFactor: 1,
    });
    // Headless browsers have no print dialog; the real UI still builds its print
    // portal and records printing. page.pdf exports that exact print document.
    await context.addInitScript(() => {
      window.print = () => {};
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("pageerror", (error) =>
      errors.push({ variant, message: error.message }),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push({ variant, message: message.text() });
    });
    const response = await page.goto(base);
    const html = await response.text();
    const entry = await page
      .locator('script[type="module"][src]')
      .first()
      .getAttribute("src");
    if (!entry?.includes("/assets/"))
      throw new Error("Capture requires an immutable Vite production build.");
    const entryResponse = await page.request.get(new URL(entry, base).href);
    builds.push({
      variant,
      htmlSHA256: createHash("sha256").update(html).digest("hex"),
      entry,
      entrySHA256: createHash("sha256")
        .update(await entryResponse.body())
        .digest("hex"),
    });
    const account = seed.demo_users.find(
      (user) => user.username === "supervisor",
    );
    await field(page, "Username").fill(account.username);
    await field(page, "Password").fill(account.password);
    await button(page, "Sign in").click();
    await expect(button(page, "Demo")).toBeVisible();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));

    await location(page, "North York");
    await visit(page, "received", "Received");
    await expect(
      page.locator(".received-table tbody tr").first(),
    ).toBeVisible();
    await capture(page, "received", variant);
    await appearance(page, variant);
    await field(page.locator(".topbar"), "Branch", "شعبه").click();
    await expect(
      page.getByRole("option", { name: exact("Warehouse", "انبار") }),
    ).toBeVisible();
    await capture(page, "warehouse-picker", variant, true);
    // Capture blurs the focused element for a clean image; close this popover
    // by selecting its existing value through the UI rather than relying on
    // Escape being dispatched to a now-blurred option.
    await page
      .getByRole("option", { name: exact("North York", "نورث یورک") })
      .click();

    await visit(page, "labels", "Labels");
    await page.getByRole("tab", { name: "Products", exact: true }).click();
    await field(page, "Search products").fill("0003");
    await field(page, "Copies for 0003").fill("2");
    await button(page, "Add to waitlist").click();
    await page.getByRole("tab", { name: /^Waitlist/ }).click();
    await choose(page, field(page, "Saved template"), "Regular");
    await expect(
      page.locator(".label-bilingual-preview .shelf-label"),
    ).toHaveCount(2);
    await capture(page, "regular-labels-grayscale", variant);
    await printLabelsPDF(page, "regular", variant);
    await choose(page, field(page, "Saved template"), "Promo");
    await expect(
      page.locator(".label-bilingual-preview .promo-shelf-label"),
    ).toHaveCount(2);
    await capture(page, "promo-labels-grayscale", variant);
    await printLabelsPDF(page, "promo", variant);

    await visit(page, "lookup", "Cashier lookup");
    await field(page, "Search products").fill("0009");
    await page.getByRole("button", { name: /^Edit Potato Chips/ }).click();
    const editor = page.getByRole("dialog", {
      name: "Edit product",
      exact: true,
    });
    await field(editor, "Selling price").fill("3.29");
    await button(editor, "Save product").click();
    await expect(editor).not.toBeVisible();
    await expect(page.locator(".manual-price-pill").last()).toBeVisible();
    await expect(page.locator(".manual-price-details")).toContainText("$3.29");
    await capture(page, "manual-price", variant);

    await location(page, "All branches");
    await visit(page, "notes", "Notes");
    await button(page, "New notebook").click();
    const notebook = page.getByRole("dialog", {
      name: "New notebook",
      exact: true,
    });
    await field(notebook, "Name (English)").fill("Receiving handover");
    await field(notebook, "Name (Persian)").fill("تحویل شیفت دریافت کالا");
    await choose(page, field(notebook, "Branch"), "All branches");
    await button(notebook, "Save notebook").click();
    await page.getByRole("tab", { name: /^Receiving handover/ }).click();
    const addNote = page.getByRole("form", { name: "Add note", exact: true });
    await choose(page, field(addNote, "Location"), "Warehouse");
    await field(addNote, "Note").fill(
      "Delivery paperwork checked at the warehouse.",
    );
    await button(addNote, "Save note").click();
    await expect(page.locator(".notebook-entry-card")).toContainText(
      "Delivery paperwork checked at the warehouse.",
    );
    await page.reload();
    await expect(button(page, "Demo")).toBeVisible();
    await page.getByRole("tab", { name: /^Receiving handover/ }).click();
    await expect(page.locator(".notebook-entry-card")).toContainText(
      "Delivery paperwork checked at the warehouse.",
    );
    await capture(page, "custom-notebook-all-branches", variant);
    await context.close();
  }
} catch (error) {
  errors.push({ stage: "capture", message: error.stack ?? error.message });
} finally {
  const expected = variants.length * (selectedScreens?.length ?? scenes.length);
  await writeFile(
    resolve(destination, "capture-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase,
        baseURL: base,
        method:
          "Real UI interactions in fresh profiles, no injected business state or edited images. Original fictional products, offers and historical deliveries are retained. A manual price and warehouse notebook note are created through authorized forms. A controlled browser clock clears expired toasts. Headless window.print is suppressed while page.pdf exports the real UI print portal; this does not validate a physical printer.",
        requestedScenes: selectedScreens ?? scenes,
        requestedVariants: variants,
        expectedCapturesThisRun: expected,
        productionBuilds: builds,
        browserErrors: errors,
        printProof,
        screens: results,
      },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
}
const failures = results.filter(
  (screen) =>
    screen.scrollWidth > screen.width ||
    screen.visibleNativeControls.length > 0 ||
    screen.resizeHandles > 0 ||
    screen.kpis > 4 ||
    screen.theme !== (screen.variant === "en-dark" ? "dark" : "light") ||
    screen.language !== (screen.variant === "fa-light" ? "fa" : "en") ||
    (screen.variant !== "phone" && screen.sidebarScrolls) ||
    screen.tableColumns
      .flat()
      .some(
        (column) =>
          column && (column.leftDifference > 2 || column.rightDifference > 2),
      ) ||
    screen.labelSheets.some(
      (sheet) =>
        Math.abs(sheet.width - 210) > 0.1 || Math.abs(sheet.height - 297) > 0.1,
    ) ||
    screen.labels.some(
      (label) =>
        Math.abs(label.width - (label.style === "promo" ? 210 : 60)) > 0.1 ||
        Math.abs(label.height - (label.style === "promo" ? 148.5 : 40)) > 0.1,
    ) ||
    screen.grayscaleFilters.some((value) => value !== "grayscale(1)"),
);
if (
  errors.length ||
  failures.length ||
  builds.some((build) => build.entrySHA256 !== builds[0].entrySHA256) ||
  printProof.some((proof) =>
    proof.geometry.some(
      (label) =>
        Math.abs(label.widthMM - (proof.style === "promo" ? 210 : 60)) > 0.1 ||
        Math.abs(label.heightMM - (proof.style === "promo" ? 148.5 : 40)) >
          0.1 ||
        Math.abs(label.sheetWidthMM - 210) > 0.1 ||
        Math.abs(label.sheetHeightMM - 297) > 0.1 ||
        (proof.style === "promo" &&
          (label.frameInsetMM < 4.9 ||
            Math.abs(label.frameStrokeMM - 1.5) > 0.1)),
    ),
  ) ||
  results.filter(
    (item) =>
      variants.includes(item.variant) &&
      (!selectedScreens || selectedScreens.includes(item.screen)),
  ).length !==
    variants.length * (selectedScreens?.length ?? scenes.length)
) {
  console.error(
    JSON.stringify({ browserErrors: errors, failedScreens: failures }, null, 2),
  );
  process.exitCode = 1;
}
