/* global process, console, document, window, innerWidth, innerHeight, getComputedStyle */
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Run from prototype/: node scripts/capture-design-a2.mjs
// Uses the running prototype and real UI actions, never injected demo state.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const destination = resolve(root, "docs/redesign-screenshots/pr-a2");
const base = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:5174";
const fixture = resolve(
  root,
  "docs/redesign-screenshots/pr1/fictional-fv-20417.png",
);
const seed = JSON.parse(
  await readFile(resolve(root, "seed/demo-data.json"), "utf8"),
);
await access(fixture);
await mkdir(destination, { recursive: true });
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
if (!executablePath) {
  try {
    await access("/usr/bin/chromium");
    executablePath = "/usr/bin/chromium";
  } catch {
    // On other computers use the Chromium installed by Playwright.
  }
}
const browser = await chromium.launch({ executablePath, headless: true });
const allVariants = ["en-light", "en-dark", "fa-light", "phone"];
const variants = process.env.CAPTURE_VARIANTS
  ? process.env.CAPTURE_VARIANTS.split(",").map((variant) => variant.trim())
  : allVariants;
if (variants.some((variant) => !allVariants.includes(variant))) {
  await browser.close();
  throw new Error(`Unknown screenshot variant: ${variants.join(", ")}`);
}
let previous = { screens: [], browserErrors: [] };
if (process.env.CAPTURE_VARIANTS) {
  previous = JSON.parse(
    await readFile(resolve(destination, "capture-results.json"), "utf8"),
  );
}
const results = previous.screens.filter(
  (screen) => !variants.includes(screen.variant),
);
const errors = previous.browserErrors.filter(
  (error) => !variants.includes(error.variant),
);
const routes = [
  ["dashboard", "Supervisor dashboard"],
  ["lookup", "Cashier lookup"],
  ["products", "Products"],
  ["invoices", "Invoices"],
  ["approvals", "Approvals"],
  ["alerts", "Alerts"],
  ["offers", "Offers"],
  ["labels", "Labels"],
  ["returns", "Returns"],
  ["expiry", "Date tracking"],
  ["notes", "Notes"],
  ["payables", "Payables"],
  ["settings", "Settings"],
  ["suppliers", "Suppliers"],
];

async function english(page) {
  if ((await page.locator("html").getAttribute("lang")) === "fa")
    await page
      .getByRole("button", { name: "تغییر به انگلیسی", exact: true })
      .click();
}

async function appearance(page, variant) {
  await english(page);
  const dark = variant === "en-dark";
  const current = await page.locator("html").getAttribute("data-theme");
  if ((current === "dark") !== dark) {
    const button = page.getByRole("button", {
      name: dark ? "Switch to dark theme" : "Switch to light theme",
      exact: true,
    });
    // Auth pages remember the appearance chosen in the signed-in shell.
    if (await button.count()) await button.click();
  }
  if (variant === "fa-light")
    await page
      .getByRole("button", { name: "Switch to Persian", exact: true })
      .click();
}

async function signIn(page, username) {
  await english(page);
  await page.goto(base);
  const user = seed.demo_users.find(
    (candidate) => candidate.username === username,
  );
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill(user.password ?? user.temporary_password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    username === "newemployee"
      ? page.getByRole("heading", {
          name: "Choose a new password",
          exact: true,
        })
      : page.getByRole("button", { name: "Demo", exact: true }),
  ).toBeVisible();
}

async function userAction(page, action) {
  await english(page);
  if (await page.evaluate(() => innerWidth <= 760))
    await page.locator("#menu-toggle").click();
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
  if (await page.locator(".sidebar.is-open").count())
    await page.keyboard.press("Escape");
}

async function choose(page, label, option) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function capture(page, screen, variant) {
  if (!(await page.locator("dialog[open]").count()))
    await appearance(page, variant);
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.activeElement?.blur();
    window.scrollTo(0, 0);
    document.querySelectorAll(".ui-data-table").forEach((table) => {
      table.scrollLeft = 0;
    });
  });
  await page.waitForTimeout(220);
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
          'select, input[type="file"], input[type="checkbox"], input[type="radio"], input[type="date"], input[type="time"], input[type="number"], input[type="month"], details',
        ),
      ]
        .filter(visible)
        .map((element) => element.tagName.toLowerCase()),
      resizeHandles: [...document.querySelectorAll("textarea")].filter(
        (element) =>
          visible(element) && getComputedStyle(element).resize !== "none",
      ).length,
      sharedControls: document.querySelectorAll(
        ".ui-button, .ui-select, .ui-checked-control, .ui-number-field, .ui-date-picker, .ui-tabs, .ui-card",
      ).length,
      sidebarScrolls: (() => {
        const nav = document.querySelector(".sidebar nav");
        return nav ? nav.scrollHeight > nav.clientHeight : false;
      })(),
    };
  });
  const file = `${screen}-${variant}.png`;
  await page.screenshot({
    path: resolve(destination, file),
    fullPage: !screen.includes("dialog"),
    animations: "disabled",
  });
  results.push({ screen, variant, file, ...metrics });
  console.log(`Captured ${file}`);
  if (await page.locator("dialog[open]").count())
    await page.keyboard.press("Escape");
  await english(page);
}

async function visit(page, route, heading) {
  await english(page);
  await page.goto(`${base}/#${route}`);
  await expect(
    page.getByRole("heading", { name: heading, exact: true, level: 1 }),
  ).toBeVisible();
}

async function prepareInvoice(page) {
  await visit(page, "invoices", "Invoices");
  const newInvoice = page.getByRole("button", {
    name: "New invoice",
    exact: true,
  });
  if (await newInvoice.isEnabled()) await newInvoice.click();
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(fixture);
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Use fictional demo answer", exact: true })
    .click();
  await page
    .locator(".invoice-line")
    .nth(5)
    .getByRole("checkbox", { name: "Mark as short", exact: true })
    .check();
  for (
    let index = 0;
    index < (await page.locator(".invoice-line").count());
    index++
  ) {
    const line = page.locator(".invoice-line").nth(index);
    await line.getByRole("button", { name: "No", exact: true }).click();
    await line
      .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
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
    await signIn(page, "cashier");
    await userAction(page, "Sign out");
    await signIn(page, "supervisor");
    await appearance(page, variant === "fa-light" ? "en-light" : variant);
    await userAction(page, "Sign out");
    await capture(page, "signin", variant);
    await signIn(page, "supervisor");
    await choose(page, "Branch", "Branch 1");
    for (const [route, heading] of routes) {
      await visit(page, route, heading);
      if (route === "lookup")
        await page.getByLabel("Search products", { exact: true }).fill("0009");
      await capture(page, route, variant);
      if (route === "products") {
        await page.getByLabel("Search products", { exact: true }).fill("0009");
        const product = seed.products.find((item) => item.code === "0009");
        await page
          .getByRole("button", { name: `View ${product.name_en}`, exact: true })
          .click();
        await capture(page, "product-detail", variant);
        await appearance(page, variant);
        await page.getByRole("button", { name: /^(Edit|ویرایش) / }).click();
        await capture(page, "product-editor-dialog", variant);
        await page.keyboard.press("Escape");
      }
      if (route === "offers") {
        await page
          .getByRole("tab", { name: "Mix-and-match pools", exact: true })
          .click();
        await capture(page, "offer-pools", variant);
      }
      if (route === "labels") {
        await page
          .getByRole("button", { name: "Save template", exact: true })
          .click();
        await expect(page.locator(".print-sheet").first()).toBeVisible();
        await capture(page, "label-preview", variant);
      }
      if (route === "returns") {
        await page.getByRole("link", { name: "#1", exact: true }).click();
        await capture(page, "return-detail", variant);
        await appearance(page, variant);
        await page
          .getByRole("button", { name: /^(Return policy|سیاست مرجوعی)$/ })
          .click();
        await capture(page, "return-policy-dialog", variant);
        await page.keyboard.press("Escape");
      }
      if (route === "suppliers") {
        await page
          .locator(".supplier-overview-row")
          .filter({ hasText: "Fresh Valley Foods" })
          .getByRole("button", { name: "View", exact: true })
          .click();
        await expect(
          page.getByRole("heading", {
            name: "Fresh Valley Foods",
            exact: true,
            level: 1,
          }),
        ).toBeVisible();
        await capture(page, "supplier-supervisor-detail", variant);
        for (const [tab, screen] of [
          ["Invoices", "supplier-supervisor-invoices"],
          ["Products supplied", "supplier-supervisor-products"],
          ["Returns and credits", "supplier-supervisor-returns"],
          ["Payments", "supplier-supervisor-payments"],
        ]) {
          await page.getByRole("tab", { name: tab, exact: true }).click();
          await capture(page, screen, variant);
        }
      }
      if (route === "payables") {
        await page
          .locator("tr")
          .filter({ hasText: "Fresh Valley Foods" })
          .getByRole("button", { name: "View", exact: true })
          .click();
        await capture(page, "payables-detail", variant);
        await page
          .getByRole("tab", { name: "Month-end summary", exact: true })
          .click();
        await capture(page, "payables-month", variant);
      }
    }
    await visit(page, "invoices?id=a2-fixture%3AFV-20390", "Invoices");
    await expect(page.locator(".invoice-preview-text")).toContainText(
      "FV-20390",
    );
    await capture(page, "historical-invoice", variant);
    await visit(page, "approvals", "Approvals");
    const approve = page
      .getByRole("button", { name: /^Approve (price|product)$/, exact: false })
      .first();
    if (await approve.count()) {
      await appearance(page, variant);
      await page
        .getByRole("button", {
          name: /^(Approve (price|product)|تأیید (قیمت|کالا))$/,
        })
        .first()
        .click();
      await capture(page, "approval-dialog", variant);
      await page.keyboard.press("Escape");
    }
    await page.getByRole("button", { name: "Demo", exact: true }).click();
    const worker = seed.demo_users.find((user) => user.role === "floor_worker");
    await page
      .getByRole("menuitem", { name: `Switch to ${worker.name}`, exact: true })
      .click();
    await visit(page, "suppliers", "Suppliers");
    await capture(page, "supplier-worker-overview", variant);
    await page
      .locator(".supplier-overview-row")
      .filter({ hasText: "Fresh Valley Foods" })
      .getByRole("button", { name: "View", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Fresh Valley Foods",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await capture(page, "supplier-worker-detail", variant);
    await page
      .getByRole("tab", { name: "Products supplied", exact: true })
      .click();
    await capture(page, "supplier-worker-products", variant);
    await page.getByRole("button", { name: "Demo", exact: true }).click();
    const supervisor = seed.demo_users.find(
      (user) => user.role === "supervisor",
    );
    await page
      .getByRole("menuitem", {
        name: `Switch to ${supervisor.name}`,
        exact: true,
      })
      .click();
    await prepareInvoice(page);
    await capture(page, "invoice-review", variant);
    await page
      .locator(".invoice-line")
      .first()
      .locator(".invoice-line-summary")
      .click();
    await capture(page, "invoice-expanded-line", variant);
    await page
      .getByRole("button", { name: "Post invoice", exact: true })
      .click();
    await capture(page, "invoice-posted", variant);
    await visit(page, "dashboard", "Supervisor dashboard");
    await capture(page, "dashboard-after-post", variant);
    await userAction(page, "Lock");
    await capture(page, "lock", variant);
    await page
      .getByRole("button", { name: "Sign in as someone else", exact: true })
      .click();
    await signIn(page, "newemployee");
    await capture(page, "new-password", variant);
    await context.close();
  }
} finally {
  await writeFile(
    resolve(destination, "capture-results.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        method:
          "Real UI interactions and the existing seed-derived fictional invoice attachment. No edited screenshots or injected business state.",
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
