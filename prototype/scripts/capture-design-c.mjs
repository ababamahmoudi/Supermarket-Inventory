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
if (!["c1", "c2"].includes(phase))
  throw new Error(`Unknown capture phase: ${phase}`);
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
const c1Scenes = [
  "received",
  "warehouse-picker",
  "regular-labels-grayscale",
  "promo-labels-grayscale",
  "manual-price",
  "custom-notebook-all-branches",
];
const c2Scenes = [
  "orders-list",
  "new-order",
  "order-print",
  "supplier-items-supervisor",
  "supplier-items-worker",
  "supplier-item-history",
  "invoice-as-ordered",
  "invoice-short",
  "invoice-not-delivered",
  "invoice-extra-kept",
  "invoice-extra-refused",
  "invoice-cost-change",
  "invoice-short-dated",
  "requests-outgoing",
  "requests-incoming",
  "requests-receiving",
];
const scenes = phase === "c1" ? c1Scenes : c2Scenes;
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
let previous = {
  screens: [],
  browserErrors: [],
  printProof: [],
  documentProof: [],
};
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
const documentProof = (previous.documentProof ?? []).filter(
  (item) => !variants.includes(item.variant),
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
async function switchRole(page, roleName) {
  await english(page);
  await button(page, "Demo").click();
  await page
    .getByRole("menuitem", {
      name: `Switch to Demo ${roleName}`,
      exact: true,
    })
    .click();
  await expect(button(page, "Demo")).toBeVisible();
}
async function chooseProductCode(page, control, code) {
  await control.click();
  await page.getByRole("option").filter({ hasText: code }).first().click();
}
async function supplierItems(page) {
  await visit(
    page,
    "suppliers?name=Fresh%20Valley%20Foods",
    "Fresh Valley Foods",
  );
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
}
async function location(page, name) {
  await english(page);
  await choose(page, field(page.locator(".topbar"), "Branch"), name);
}
async function capture(page, screen, variant, keepPopup = false, options = {}) {
  if (selectedScreens && !selectedScreens.includes(screen)) return;
  if (!keepPopup) await appearance(page, variant);
  await page.mouse.move(0, 0);
  await page.clock.runFor(5001);
  await page.clock.runFor(32);
  await page.evaluate(
    async ({ scrollTarget, tablePosition }) => {
      await document.fonts.ready;
      document.activeElement?.blur();
      if (!scrollTarget) window.scrollTo(0, 0);
      document.querySelectorAll(".ui-data-table").forEach((element) => {
        element.scrollLeft =
          tablePosition === "end"
            ? (document.documentElement.dir === "rtl" ? -1 : 1) *
              element.scrollWidth
            : 0;
      });
    },
    {
      scrollTarget: Boolean(options.target),
      tablePosition: options.tablePosition,
    },
  );
  if (options.target) {
    await options.target.scrollIntoViewIfNeeded();
    await page.evaluate((tablePosition) => {
      document.querySelectorAll(".ui-data-table").forEach((element) => {
        element.scrollLeft =
          tablePosition === "end"
            ? (document.documentElement.dir === "rtl" ? -1 : 1) *
              element.scrollWidth
            : 0;
      });
    }, options.tablePosition);
  }
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
    fullPage:
      !keepPopup &&
      !options.target &&
      !(await page.locator("dialog[open]").count()),
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

async function runC1Scenes(page, variant) {
  await location(page, "North York");
  await visit(page, "received", "Received");
  await expect(page.locator(".received-table tbody tr").first()).toBeVisible();
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
}

async function runC2SupplierScenes(page, variant) {
  await location(page, "North York");
  await supplierItems(page);
  await expect(
    page.locator(".supplier-items-table tbody tr").first(),
  ).toBeVisible();
  // This is an explicitly entered quote for a new association, never an
  // invented purchase. Its bought date/cost/invoice must stay blank.
  await button(page, "Add item").click();
  const add = page.getByRole("dialog", { name: "Add item", exact: true });
  await chooseProductCode(page, field(add, "Product"), "0004");
  await field(add, "Supplier code").fill("C2-TEA");
  await field(add, "Units per case").fill("12");
  await field(add, "Expected unit cost").fill("3.55");
  await button(add, "Add item").click();
  await expect(add).not.toBeVisible();
  await expect(page.locator(".supplier-items-table")).toContainText("C2-TEA");
  for (const code of ["0002", "0005", "0003", "0009"]) {
    const row = page
      .locator(".supplier-items-table tbody tr")
      .filter({ hasText: code })
      .first();
    await button(row, "Edit").click();
    const edit = page.getByRole("dialog", { name: "Edit item", exact: true });
    await field(edit, "Units per case").fill("12");
    await button(edit, "Save item").click();
    await expect(edit).not.toBeVisible();
  }
  await capture(page, "supplier-items-supervisor", variant);
  const original = page
    .locator(".supplier-items-table tbody tr")
    .filter({
      hasText: "0002",
    })
    .first();
  await appearance(page, variant);
  await button(original, "History", "تاریخچه").click();
  const history = page.getByRole("dialog", {
    name: exact("Price history", "تاریخچه قیمت"),
  });
  await expect(
    history.locator(".supplier-item-price-history tbody tr").first(),
  ).toBeVisible();
  await capture(page, "supplier-item-history", variant, true);
  await button(history, "Close", "بستن").click();
  await english(page);
  await switchRole(page, "Floor Worker");
  await supplierItems(page);
  const worker = page.locator(".supplier-items-table");
  await expect(worker.locator(".money")).toHaveCount(0);
  await expect(
    worker.getByRole("columnheader", {
      name: /cost|price|bought \/ (?:unit|case)/i,
    }),
  ).toHaveCount(0);
  await expect(button(page, "Add item")).toHaveCount(0);
  await expect(button(worker, "History")).toHaveCount(0);
  await expect(button(worker, "Edit")).toHaveCount(0);
  await capture(page, "supplier-items-worker", variant);
  await switchRole(page, "Supervisor");
  await location(page, "North York");
}

async function printOperationalPDF(page, kind, variant) {
  const portal = page.locator(
    ".operational-print-output .operational-print-document",
  );
  await expect(portal).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  await expect(portal).toBeVisible();
  const document = await portal.evaluate((element) => ({
    language: element.lang,
    direction: element.dir,
    bilingualEnglish: element.querySelectorAll('[lang="en"]').length,
    bilingualPersian: element.querySelectorAll('[lang="fa"]').length,
    text: element.textContent.trim(),
    background: getComputedStyle(element).backgroundColor,
  }));
  const file = `${kind}-${variant}.pdf`;
  const bytes = await page.pdf({
    path: resolve(destination, file),
    preferCSSPageSize: true,
    printBackground: true,
  });
  const mediaBoxes = [
    ...bytes
      .toString("latin1")
      .matchAll(
        /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g,
      ),
  ].map((match) => ({
    widthMM: ((Number(match[3]) - Number(match[1])) * 25.4) / 72,
    heightMM: ((Number(match[4]) - Number(match[2])) * 25.4) / 72,
  }));
  documentProof.push({ kind, variant, file, mediaBoxes, ...document });
  await page.emulateMedia({ media: "screen" });
  // This browser event normally follows the user's print dialog. It clears
  // only the temporary print portal; no fictional business records are changed.
  await page.evaluate(() =>
    window.dispatchEvent(new window.Event("afterprint")),
  );
  await expect(portal).toHaveCount(0);
}

async function runC2OrderScenes(page, variant) {
  await visit(page, "orders", "Orders");
  await button(page, "New order").click();
  const form = page.getByRole("form", { name: "New order", exact: true });
  await choose(page, field(form, "Supplier"), "Fresh Valley Foods");
  const items = [
    { code: "0002", cases: "2", expected: "0.98" },
    { code: "0005", cases: "1", expected: "1.20" },
    { code: "0003", cases: "3", expected: "1.95" },
    { code: "0009", cases: "1", expected: "1.60" },
    { code: "0004", cases: "1", expected: "3.55" },
  ];
  for (const item of items) {
    const name = seed.products.find(
      (product) => product.code === item.code,
    ).name_en;
    await field(form, `Cases — ${name}`).first().fill(item.cases);
    await field(form, `Expected unit cost — ${name}`)
      .first()
      .fill(item.expected);
  }
  await capture(page, "new-order", variant);
  await button(form, "Save as draft").click();
  const reference = await page
    .getByRole("heading", { name: /^ORD-/, level: 1 })
    .textContent();
  await page.reload();
  await expect(button(page, reference)).toBeVisible();
  await button(page, reference).click();
  await button(page, "Place order").click();
  await button(page, "All orders").click();
  await expect(page.locator(".orders-list-table")).toContainText("Ordered");
  await capture(page, "orders-list", variant);
  await button(page, reference).click();
  await appearance(page, variant);
  await button(page, "Print order", "چاپ سفارش").click();
  const print = page.getByRole("dialog", {
    name: exact("Print order", "چاپ سفارش"),
  });
  await expect(
    print.locator(".order-sheet-preview .order-print-output"),
  ).toBeVisible();
  await capture(page, "order-print", variant, true);
  await button(print, "Print", "چاپ").click();
  await printOperationalPDF(page, "order", variant);
  await button(print, "Close", "بستن").click();
  await english(page);
  return reference;
}

async function expandInvoiceLine(page, index) {
  const line = page.locator(".invoice-line").nth(index);
  if (!(await field(line, "Quantity unit").count()))
    await line.locator(".invoice-line-toggle").click();
  return line;
}
async function chooseDate(page, control, value) {
  await control.click();
  const calendar = page.locator(".ui-calendar");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (
      await calendar.getByRole("button", { name: value, exact: true }).count()
    )
      break;
    await button(calendar, "Next month").click();
  }
  await calendar.getByRole("button", { name: value, exact: true }).click();
}
async function captureInvoiceDecision(page, screen, variant, row) {
  await capture(page, screen, variant, false, {
    target: row,
    tablePosition: variant === "phone" ? "end" : "start",
  });
}
async function runC2InvoiceScenes(page, variant, reference) {
  await visit(page, "invoices", "Invoices");
  await field(page, "Upload a PDF or photo").setInputFiles(
    resolve(root, "docs/redesign-screenshots/pr1/fictional-fv-20417.png"),
  );
  await page.clock.runFor(3000);
  await expect(page.locator(".invoice-line")).toHaveCount(6);
  // The original six-line fictional invoice is unchanged. Pack presentation
  // changes to Cases; received/invoiced amounts remain the original units.
  for (const [index, cases] of [
    [0, "2"],
    [1, "1"],
    [3, "3"],
    [5, "1"],
  ]) {
    const line = await expandInvoiceLine(page, index);
    await field(line, "Units per case").fill("12");
    await choose(page, field(line, "Quantity unit"), "Cases");
    await field(line, "Invoiced quantity").fill(cases);
  }
  await field(await expandInvoiceLine(page, 5), "Delivered quantity").fill("8");
  await field(page, "Order (optional)").click();
  await page.getByRole("option").filter({ hasText: reference }).click();
  const row = (index) =>
    page.locator(`.invoice-order-table tr[data-invoice-line="${index}"]`);
  await expect(row(0)).toContainText("OK");
  await captureInvoiceDecision(page, "invoice-as-ordered", variant, row(0));
  await expect(row(5)).toContainText("Short");
  await captureInvoiceDecision(page, "invoice-short", variant, row(5));
  const missingID = await page
    .locator(".invoice-order-table tr[data-order-line]")
    .filter({ hasText: "Black Tea" })
    .getAttribute("data-order-line");
  const missing = page.locator(
    `.invoice-order-table tr[data-order-line="${missingID}"]`,
  );
  await button(missing, "Back-ordered").click();
  await captureInvoiceDecision(page, "invoice-not-delivered", variant, missing);
  await button(row(2), "Keep it (we pay for it)").click();
  await captureInvoiceDecision(page, "invoice-extra-kept", variant, row(2));
  await button(row(4), "Refused / sent back with the driver").click();
  await captureInvoiceDecision(page, "invoice-extra-refused", variant, row(4));
  await button(row(1), "Accept new cost").click();
  await captureInvoiceDecision(page, "invoice-cost-change", variant, row(1));
  await button(row(3), "Short-dated (expiry discount)").click();
  const expiry = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
  await chooseDate(page, field(row(3), "Expiry date"), expiry);
  await captureInvoiceDecision(page, "invoice-short-dated", variant, row(3));
  if (await page.locator(".invoice-lower-price-card").count()) {
    await button(page, "Demo").click();
    await page
      .getByRole("menuitem", { name: "Use fictional demo answer", exact: true })
      .click();
  }
  for (let index = 0; index < 6; index += 1) {
    const line = await expandInvoiceLine(page, index);
    if (index !== 3) await button(line, "No").click();
    await line
      .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
      .click();
  }
  await expect(button(page, "Post invoice")).toBeEnabled();
  await button(page, "Post invoice").click();
  await expect(
    page.getByText(
      "Posted. Received, approvals, alerts, and supplier ledger are updated.",
      { exact: true },
    ),
  ).toBeVisible();
}

async function runC2RequestScenes(page, variant) {
  await location(page, "North York");
  await visit(page, "requests", "Branch requests");
  await button(page, "New request").click();
  await choose(page, field(page, "Sending location"), "Warehouse");
  await field(page, "Search products").fill("0002");
  await button(page.locator(".request-search-results"), "Add").click();
  const first = page.locator(".request-draft-line").first();
  await choose(page, field(first, "Units / Cases"), "Cases");
  await field(first, "Units per case").fill("12");
  await field(first, "Quantity").fill("2");
  await field(first, "Note (optional)").fill("Receiving handover");
  await field(page, "Free-text item").fill("bread");
  await button(page.locator(".request-free-item"), "Add item").click();
  await field(page.locator(".request-draft-line").last(), "Quantity").fill("3");
  await button(page, "Send").click();
  await expect(page.locator(".request-detail")).toContainText("Requested");
  await button(page, "Back to requests").click();
  await page.getByRole("tab", { name: "Outgoing", exact: true }).click();
  await capture(page, "requests-outgoing", variant);
  await location(page, "Warehouse");
  await visit(page, "requests", "Branch requests");
  await page.getByRole("tab", { name: "Incoming", exact: true }).click();
  await button(
    page.locator(".branch-requests-screen tbody tr").first(),
    "Open",
  ).click();
  const items = page.locator(".request-checklist-item");
  await items
    .first()
    .getByRole("checkbox", { name: "Being sent", exact: true })
    .click();
  await button(items.last(), "Short").click();
  await field(items.last(), "Quantity being sent").fill("2");
  await capture(page, "requests-incoming", variant);
  await appearance(page, variant);
  await button(page, "Print picking list", "چاپ فهرست آماده‌سازی").click();
  await printOperationalPDF(page, "picking-list", variant);
  await english(page);
  await button(page, "Mark as sent").click();
  await location(page, "North York");
  await visit(page, "requests", "Branch requests");
  await page.getByRole("tab", { name: "Outgoing", exact: true }).click();
  await button(
    page.locator(".branch-requests-screen tbody tr").first(),
    "Open",
  ).click();
  await button(items.first(), "Missing").click();
  await field(items.first(), "Quantity arrived").fill("1");
  await items
    .last()
    .getByRole("checkbox", { name: "Arrived", exact: true })
    .click();
  await capture(page, "requests-receiving", variant);
  await button(page, "Mark as received").click();
  await expect(page.locator(".request-detail")).toContainText("Missing");
  await button(page, "Close request").click();
  await button(page, "Copy short or missing items").click();
  await expect(page.locator(".request-detail")).toContainText("Draft");
  await button(page, "Edit draft").click();
  await expect(page.locator(".request-draft-line")).toHaveCount(2);
}

async function runC2Scenes(page, variant) {
  await runC2SupplierScenes(page, variant);
  const reference = await runC2OrderScenes(page, variant);
  await runC2InvoiceScenes(page, variant, reference);
  await runC2RequestScenes(page, variant);
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

    await (phase === "c1" ? runC1Scenes : runC2Scenes)(page, variant);
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
          phase === "c1"
            ? "Real UI interactions in fresh profiles, no injected business state or edited images. Original fictional products, offers and historical deliveries are retained. A manual price and warehouse notebook note are created through authorized forms. A controlled browser clock clears expired toasts. Headless window.print is suppressed while page.pdf exports the real UI print portal; this does not validate a physical printer."
            : "Real UI interactions in fresh profiles, no injected business state or edited images. Fictional supplier-item metadata, orders, invoice decisions and branch requests are entered through authorized forms. A controlled browser clock clears expired toasts. Headless window.print is suppressed while page.pdf exports the actual operational print portals; this does not validate a physical printer.",
        requestedScenes: selectedScreens ?? scenes,
        requestedVariants: variants,
        expectedCapturesThisRun: expected,
        productionBuilds: builds,
        browserErrors: errors,
        printProof,
        documentProof,
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
  documentProof.some(
    (proof) =>
      proof.bilingualEnglish < 1 ||
      proof.bilingualPersian < 1 ||
      proof.background !== "rgb(255, 255, 255)" ||
      proof.mediaBoxes.length === 0 ||
      proof.mediaBoxes.some(
        (page) =>
          Math.abs(page.widthMM - 210) > 0.2 ||
          Math.abs(page.heightMM - 297) > 0.2,
      ),
  ) ||
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
