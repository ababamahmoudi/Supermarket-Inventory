/* global process, console, document, window, innerWidth, innerHeight, getComputedStyle */
import { chromium, expect } from "@playwright/test";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Run from prototype/: node scripts/capture-design-b.mjs
// Every business change below uses the real interface in a fresh browser profile.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const destination = resolve(root, "docs/redesign-screenshots/pr-b");
const base = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:5174";
const fixture = resolve(
  root,
  "docs/redesign-screenshots/pr-b/fictional-orchard-1001.png",
);
const seed = JSON.parse(
  await readFile(resolve(root, "seed/demo-data.json"), "utf8"),
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
await access(fixture);
await mkdir(destination, { recursive: true });
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if (!executablePath) {
  try {
    await access("/usr/bin/chromium");
    executablePath = "/usr/bin/chromium";
  } catch {
    // Otherwise use the Chromium installed by Playwright.
  }
}
const browser = await chromium.launch({ executablePath, headless: true });
const selectedScreens = process.env.CAPTURE_SCREENS?.split(",").map((value) =>
  value.trim(),
);
let previous = { screens: [], browserErrors: [] };
if (process.env.CAPTURE_VARIANTS || selectedScreens) {
  try {
    previous = JSON.parse(
      await readFile(resolve(destination, "capture-results.json"), "utf8"),
    );
  } catch {
    // A first, targeted capture has no previous report.
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
const exact = (en, fa) =>
  new RegExp(
    `^(?:${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${fa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})$`,
  );
const button = (scope, en, fa) =>
  scope.getByRole("button", { name: exact(en, fa) });
const field = (scope, en, fa) => scope.getByLabel(exact(en, fa));

async function english(page) {
  if ((await page.locator("html").getAttribute("lang")) === "fa")
    await page.getByRole("button", { name: "English", exact: true }).click();
}
async function appearance(page, variant) {
  await english(page);
  const dark = variant === "en-dark";
  if (
    ((await page.locator("html").getAttribute("data-theme")) === "dark") !==
    dark
  )
    await page
      .getByRole("button", {
        name: dark ? "Switch to dark theme" : "Switch to light theme",
        exact: true,
      })
      .click();
  if (variant === "fa-light")
    await page.getByRole("button", { name: "فارسی", exact: true }).click();
}
async function visit(page, route, heading) {
  await english(page);
  await page.goto(`${base}/#${route}`);
  await expect(
    page.getByRole("heading", { name: heading, exact: true, level: 1 }),
  ).toBeVisible();
}
async function choose(page, control, en, fa = en) {
  await control.click();
  await page.getByRole("option", { name: exact(en, fa) }).click();
}

async function capture(page, screen, variant) {
  if (selectedScreens && !selectedScreens.includes(screen)) return;
  if (screen !== "stacked-undo") {
    await page.mouse.move(0, 0);
    await page.clock.runFor(5001);
  }
  if (!(await page.locator("dialog[open]").count()))
    await appearance(page, variant);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.activeElement?.blur();
    window.scrollTo(0, 0);
    document.querySelectorAll(".ui-data-table").forEach((table) => {
      table.scrollLeft = 0;
    });
    document.querySelectorAll("dialog[open]").forEach((dialog) => {
      dialog.scrollTop = 0;
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
    const sidebar = document.querySelector(".sidebar nav");
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
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
    };
  });
  const file = `${screen}-${variant}.png`;
  await page.screenshot({
    path: resolve(destination, file),
    fullPage:
      screen !== "stacked-undo" &&
      !(await page.locator("dialog[open]").count()),
    animations: "disabled",
  });
  results.push({ screen, variant, file, ...metrics });
  console.log(`Captured ${file}`);
  if (!(await page.locator("dialog[open]").count())) await english(page);
}
async function saveName(page, name) {
  await visit(page, "lookup", "Cashier lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await page.getByRole("button", { name: /^Edit Potato Chips/ }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor.getByLabel("English name", { exact: true }).fill(name);
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
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
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("pageerror", (error) =>
      errors.push({ variant, message: error.message }),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push({ variant, message: message.text() });
    });
    await page.goto(base);
    const account = seed.demo_users.find(
      (user) => user.username === "supervisor",
    );
    await page.getByLabel("Username", { exact: true }).fill(account.username);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Demo", exact: true }),
    ).toBeVisible();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await choose(
      page,
      page.locator(".topbar").getByLabel("Branch", { exact: true }),
      "Branch 1",
    );
    await visit(page, "dashboard", "Supervisor dashboard");
    await capture(page, "dashboard", variant);

    await visit(page, "labels", "Labels");
    await page
      .getByLabel("Template name", { exact: true })
      .fill("A4 shelf labels");
    await page
      .getByRole("button", { name: "Save template", exact: true })
      .click();
    await expect(page.getByLabel("Saved template", { exact: true })).toHaveText(
      "A4 shelf labels",
    );
    await capture(page, "label-template-preview", variant);
    await page.getByRole("tab", { name: "Products", exact: true }).click();
    await page.getByLabel("Search products", { exact: true }).fill("0003");
    await page.getByLabel("Copies for 0003", { exact: true }).fill("20");
    await page
      .getByRole("button", { name: "Add to waitlist", exact: true })
      .click();
    await page.getByRole("tab", { name: /^Waitlist/ }).click();
    await page.getByLabel("Starting slot", { exact: true }).fill("5");
    await expect(
      page.locator(".label-bilingual-preview .print-sheet"),
    ).toHaveCount(2);
    await capture(page, "label-waitlist", variant);

    await visit(page, "notes", "Notes");
    await page
      .getByRole("button", { name: "New notebook", exact: true })
      .click();
    const notebook = page.getByRole("dialog", {
      name: "New notebook",
      exact: true,
    });
    await notebook
      .getByLabel("Name (English)", { exact: true })
      .fill("Cold room checks");
    await notebook
      .getByLabel("Name (Persian)", { exact: true })
      .fill("بازرسی سردخانه");
    await choose(
      page,
      notebook.getByLabel("Branch", { exact: true }),
      "Branch 1",
    );
    await notebook
      .getByRole("group", { name: "Who can read", exact: true })
      .getByRole("checkbox", { name: "Cashier", exact: true })
      .check();
    await notebook
      .getByRole("checkbox", { name: "Measurement", exact: true })
      .check();
    await notebook.getByLabel("Measurement unit", { exact: true }).fill("°C");
    await notebook
      .getByRole("button", { name: "Save notebook", exact: true })
      .click();
    await page.getByRole("tab", { name: /^Cold room checks/ }).click();
    await page
      .getByLabel("Note", { exact: true })
      .fill("Morning cold room check");
    await page.getByLabel("Measurement (°C)", { exact: true }).fill("3.5");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await expect(
      page
        .locator(".notebook-entry-card")
        .filter({ hasText: "Morning cold room check" }),
    ).toBeVisible();
    await page.mouse.move(0, 0);
    await page.clock.runFor(5001);
    const recordedNote = page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Morning cold room check" });
    await recordedNote
      .getByRole("button", { name: "Edit note", exact: true })
      .click();
    await page
      .getByLabel("Note", { exact: true })
      .fill("Morning cold room check verified");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page
        .locator(".notebook-entry-card")
        .filter({ hasText: "Morning cold room check verified" }),
    ).toBeVisible();
    // Reopen the saved notebook so its screenshot proves persisted data.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Demo", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /^Cold room checks/ }).click();
    await expect(
      page
        .locator(".notebook-entry-card")
        .filter({ hasText: "Morning cold room check verified" }),
    ).toBeVisible();
    await capture(page, "custom-notebook", variant);

    for (const [group, screen] of [
      ["company", "settings-company"],
      ["branches", "settings-branches"],
      ["catalog", "settings-catalog-pricing"],
      ["offers", "settings-offers"],
      ["returns", "settings-labels"],
      ["notes", "settings-notebooks"],
      ["modules", "settings-modules"],
    ]) {
      await visit(page, `settings?group=${group}`, "Settings");
      if (group === "catalog")
        await page
          .getByLabel("Unit cost before tax", { exact: true })
          .fill("2.3000");
      await capture(page, screen, variant);
    }

    await visit(page, "invoices", "Invoices");
    await page
      .getByRole("button", { name: "Manual entry", exact: true })
      .click();
    await appearance(page, variant);
    await choose(
      page,
      field(page.locator("#invoice-details-fields"), "Supplier", "تأمین‌کننده"),
      "+ Add supplier",
      "+ افزودن تأمین‌کننده",
    );
    const supplier = page.getByRole("dialog", {
      name: exact("Add supplier", "افزودن تأمین‌کننده"),
    });
    await field(supplier, "Supplier name", "نام تأمین‌کننده").fill(
      "North Orchard Supply",
    );
    await field(supplier, "Phone", "تلفن").fill("416-555-0173");
    await field(supplier, "Email", "ایمیل").fill("orders@example.test");
    await field(supplier, "Sales representative", "نماینده فروش").fill(
      "Sam Orchard",
    );
    await field(supplier, "Sales rep phone", "تلفن نماینده فروش").fill(
      "416-555-0182",
    );
    await field(supplier, "Payment terms", "شرایط پرداخت").fill("Net 30");
    await field(supplier, "Opening balance", "ماندهٔ اولیه")
      .first()
      .fill("125.50");
    await capture(page, "add-supplier-dialog", variant);
    await button(supplier, "Add supplier", "افزودن تأمین‌کننده").click();
    await expect(supplier).not.toBeVisible();
    await english(page);
    await page
      .getByLabel("Supplier invoice number (optional)", { exact: true })
      .fill("ORCHARD-1001");
    const dateControl = page.getByLabel("Invoice date", { exact: true });
    const currentMonth = (await dateControl.innerText()).match(
      /(\d{4})-(\d{2})/,
    );
    if (!currentMonth) throw new Error("Manual invoice date is missing.");
    const monthDifference =
      Number(currentMonth[1]) * 12 + Number(currentMonth[2]) - (2026 * 12 + 10);
    await dateControl.click();
    for (let step = 0; step < Math.abs(monthDifference); step++)
      await page
        .getByRole("button", {
          name: monthDifference > 0 ? "Previous month" : "Next month",
          exact: true,
        })
        .click();
    await page.getByRole("button", { name: "2026-10-08", exact: true }).click();
    await appearance(page, variant);
    await button(page, "+ Add new product", "+ افزودن کالای جدید").click();
    const product = page.getByRole("dialog", {
      name: exact("Add product", "افزودن محصول"),
    });
    await field(product, "English name", "نام انگلیسی").fill(
      "Orchard Oat Crackers",
    );
    await field(product, "Persian name", "نام فارسی").fill("کراکر جو باغ");
    await field(product, "Unit size", "اندازهٔ واحد").fill("500 g");
    await choose(page, field(product, "Category", "دسته"), "Snacks", "تنقلات");
    await field(
      product,
      "Last unit cost before tax",
      "آخرین هزینهٔ واحد پیش از مالیات",
    ).fill("1.4000");
    await choose(
      page,
      field(product, "Pricing category", "دستهٔ قیمت‌گذاری"),
      "Grocery",
      "مواد غذایی",
    );
    await choose(
      page,
      field(product, "Supplier", "تأمین‌کننده"),
      "North Orchard Supply",
    );
    await field(product, "Barcode", "بارکد").fill("ORCHARD-OAT-500");
    await field(product, "Branch 1", "شعبه 1").fill("12");
    await capture(page, "add-product-dialog", variant);
    await button(product, "Add product", "افزودن محصول").click();
    await expect(product).not.toBeVisible();
    await english(page);
    await expect(page.locator(".invoice-line")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Save as draft", exact: true })
      .click();
    const line = page.locator(".invoice-line");
    await line.getByRole("button", { name: "No", exact: true }).click();
    await line
      .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
      .click();
    await page
      .getByLabel("Upload a PDF or photo", { exact: true })
      .setInputFiles(fixture);
    await expect(
      page.getByRole("button", { name: "Post invoice", exact: true }),
    ).toBeEnabled();
    await capture(page, "manual-invoice", variant);
    await visit(page, "history", "History");
    await capture(page, "history", variant);

    await page.clock.runFor(5001);
    for (const suffix of ["shelf review", "label review", "display review"]) {
      await saveName(page, `Potato Chips 150 g ${suffix}`);
      await page.clock.runFor(250);
    }
    await expect(page.locator(".undo-toast:not([hidden])")).toHaveCount(3);
    await capture(page, "stacked-undo", variant);
    await context.close();
  }
} finally {
  await writeFile(
    resolve(destination, "capture-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "Real UI interactions in fresh browser profiles. All new suppliers, products, templates, notebook entries, drafts and edits were made through the interface. The matching fictional Orchard invoice image, rendered from the accompanying PDF, supplies attachment evidence. Playwright's clock clears expired ordinary toasts before each capture and retains the five-second stack only for the Undo scene. No injected business state or edited screenshots.",
        baseURL: base,
        browserErrors: errors,
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
    (screen.variant !== "phone" && screen.sidebarScrolls),
);
if (errors.length || failures.length) {
  console.error(
    JSON.stringify({ browserErrors: errors, failedScreens: failures }, null, 2),
  );
  process.exitCode = 1;
}
