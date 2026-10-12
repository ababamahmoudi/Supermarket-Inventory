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
  resolve(root, "docs/redesign-screenshots/pr-c4");
const variants = (
  process.env.CAPTURE_VARIANTS ?? "en-light,en-dark,fa-light,phone"
).split(",");
const allScenes = [
  "posted-invoice-original",
  "correct-invoice-preview",
  "invoice-order-comparison",
  "new-order-new-item",
  "weighed-lookup",
  "weighed-label",
  "add-date",
  "remove-date-dialog",
  "returns-open",
  "returns-history",
  "return-memo",
  "payables-pending-credit",
  "undo",
];
const scenes = process.env.CAPTURE_SCREENS?.split(",") ?? allScenes;
if (
  !variants.length ||
  !scenes.length ||
  new Set(variants).size !== variants.length ||
  new Set(scenes).size !== scenes.length ||
  variants.some(
    (item) => !["en-light", "en-dark", "fa-light", "phone"].includes(item),
  ) ||
  scenes.some((item) => !allScenes.includes(item))
)
  throw new Error("Unknown or duplicate screenshot variant or scene.");
const seed = JSON.parse(
  await readFile(resolve(root, "seed/demo-data.json"), "utf8"),
);
const account = seed.demo_users.find((user) => user.username === "supervisor");
if (!account?.password)
  throw new Error("The Supervisor demo fixture is missing.");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium",
});
await mkdir(destination, { recursive: true });
const results = [],
  errors = [],
  builds = [];
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (en, fa = en) => new RegExp(`^(?:${escape(en)}|${escape(fa)})$`);
const button = (scope, en, fa) =>
  scope.getByRole("button", { name: exact(en, fa) });
const field = (scope, en, fa) => scope.getByLabel(exact(en, fa));
const dialog = (page, en, fa) =>
  page.getByRole("dialog", { name: exact(en, fa) });
const sha = (value) => createHash("sha256").update(value).digest("hex");
const dateLot = "LOT-C4-001";
const dateNote = "Shelf check recorded in the demo.";

async function choose(page, control, name) {
  await expect(control).toHaveAttribute("role", "combobox");
  await control.click();
  await page
    .getByRole("option", { name, exact: typeof name === "string" })
    .click();
}
async function visit(page, route) {
  await page.goto(`${base}/#${route}`);
  await expect(button(page, "Demo", "دمو")).toBeVisible();
}
async function stableAppearance(page, variant) {
  if (variant === "en-dark") await button(page, "Switch to dark theme").click();
  if (variant === "fa-light") await button(page, "Switch to Persian").click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme",
    variant === "en-dark" ? "dark" : "light",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "lang",
    variant === "fa-light" ? "fa" : "en",
  );
  // Wait for the real theme transition and fonts, including changes inherited
  // by descendants, before opening a modal or measuring any geometry.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
    await new Promise((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
    );
  });
}
async function productionAssets(page) {
  const response = await page.request.get(base);
  if (!response.ok())
    throw new Error(`Production HTML returned ${response.status()}.`);
  const html = await response.text();
  if (html.includes("/@vite/client"))
    throw new Error("A development server cannot supply review screenshots.");
  const entry = await page
    .locator('script[type="module"][src]')
    .getAttribute("src");
  if (!entry?.includes("/assets/") || !html.includes(entry))
    throw new Error("Screenshots require an immutable production build.");
  const styles = await page
    .locator('link[rel="stylesheet"][href]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")).sort(),
    );
  const assets = [];
  for (const path of [entry, ...styles]) {
    if (!path?.includes("/assets/"))
      throw new Error(`Unexpected production asset: ${path}`);
    const assetResponse = await page.request.get(new URL(path, base).href);
    if (!assetResponse.ok())
      throw new Error(`Asset ${path} returned ${assetResponse.status()}.`);
    assets.push({ path, SHA256: sha(await assetResponse.body()) });
  }
  return {
    htmlSHA256: sha(html),
    entry,
    assets,
    fingerprint: sha(JSON.stringify(assets)),
  };
}
async function filledDate(page) {
  const modal = dialog(page, "Add date", "افزودن تاریخ");
  await expect(modal).toBeVisible();
  await choose(page, field(modal, "Product", "محصول"), /0001$/);
  await field(modal, "Date", "تاریخ").click();
  await button(page.locator(".ui-calendar"), "Today", "امروز").click();
  await field(modal, "Quantity (optional)", "مقدار (اختیاری)").fill("2");
  await field(modal, "Lot (optional)", "سری ساخت (اختیاری)").fill(dateLot);
  await field(modal, "Note (optional)", "یادداشت (اختیاری)").fill(dateNote);
  return modal;
}
async function createDate(page) {
  await visit(page, "expiry");
  await button(page, "Add date").click();
  const modal = await filledDate(page);
  await button(modal, "Add date").click();
  await expect(modal).not.toBeVisible();
  const row = page
    .locator(".expiry-table tbody tr")
    .filter({ hasText: dateLot });
  await expect(row).toHaveCount(1);
  return row;
}
async function removeDateDialog(page, row) {
  await button(row, "Remove", "حذف").click();
  const modal = dialog(page, "Remove date", "حذف تاریخ");
  await expect(modal).toBeVisible();
  await choose(
    page,
    field(modal, "Reason", "دلیل"),
    exact("Sold out", "تمام‌شده"),
  );
  return modal;
}
async function recordPickup(page) {
  await visit(page, "return?id=demo-return-1");
  await button(page.locator(".return-header-card"), "Record pickup").click();
  const card = page.locator(".return-action-card");
  await card.getByLabel(/Actual pickup units$/).fill("3");
  await field(card, "Supplier representative name").fill("Demo Driver");
  await field(card, "Signed paper pickup slip reference").fill("SIGNED-C4-001");
  await button(card, "Record pickup").click();
  const memo = page
    .locator(".return-memos-card")
    .getByRole("button", { name: /^RM-/ })
    .last();
  await expect(memo).toBeVisible();
  const reference = (await memo.innerText()).trim();
  await button(card, "Close").click();
  await expect(card).not.toBeVisible();
  return reference;
}
async function createKnownOrder(page) {
  await visit(page, "orders");
  await button(page, "New order").click();
  const form = page.getByRole("form", { name: "New order", exact: true });
  await choose(page, field(form, "Supplier"), "Fresh Valley Foods");
  await form.getByLabel(/^Cases — Canned Fava Beans/).fill("1");
  await form.getByLabel(/^Expected unit cost — Canned Fava Beans/).fill("0.98");
  await button(form, "Place order").click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(/^ORD-/);
  return (await heading.innerText()).trim();
}
async function setupScene(page, scene, variant) {
  let target, evidence;
  if (
    scene === "posted-invoice-original" ||
    scene === "correct-invoice-preview"
  ) {
    await visit(page, "invoices?id=a2-fixture%3AFV-20390");
    await expect(page.locator(".posted-invoice-document")).toContainText(
      "FV-20390",
    );
    const original = page.locator(".invoice-original-media img");
    await expect(original).toBeVisible();
    await expect(original).toHaveJSProperty("complete", true);
    await expect
      .poll(() => original.evaluate((image) => image.naturalWidth))
      .toBeGreaterThan(0);
    await stableAppearance(page, variant);
    if (scene === "correct-invoice-preview") {
      await button(page, "Correct invoice", "اصلاح فاکتور").click();
      const modal = dialog(page, "Correct invoice", "اصلاح فاکتور");
      await field(
        modal.locator(".invoice-correction-line").first(),
        "Unit cost before tax",
        "هزینه هر واحد پیش از مالیات",
      ).fill("1.01");
      await field(modal, "Reason (required)", "دلیل (الزامی)").fill(
        "Correct the bean unit cost.",
      );
      await button(modal, "Preview correction", "پیش‌نمایش اصلاح").click();
      await expect(modal.locator(".posted-invoice-totals")).toContainText(
        "$0.72",
      );
      await expect(modal.locator(".invoice-correction-pending")).toContainText(
        /No pending approval changes|تأییدهای در انتظار تغییر نمی‌کنند/,
      );
      await expect(
        modal.locator(".invoice-correction-pending"),
      ).not.toContainText("$1.49");
      await expect(button(modal, "Continue", "ادامه")).toBeEnabled();
      target = ".invoice-correction-dialog";
      evidence = await modal.innerText();
    } else {
      target = ".posted-invoice-document";
      evidence = {
        document: await page.locator(target).innerText(),
        originalName: await page.locator(".invoice-original-name").innerText(),
        originalWidth: await original.evaluate((image) => image.naturalWidth),
      };
    }
  } else if (scene === "invoice-order-comparison") {
    const reference = await createKnownOrder(page);
    await visit(page, "invoices");
    const newInvoice = button(page, "New invoice");
    if (await newInvoice.isVisible()) await newInvoice.click();
    await button(page, "Manual entry").click();
    await choose(
      page,
      field(page.locator("#invoice-details-fields"), "Supplier"),
      /Fresh Valley Foods/,
    );
    await button(page, "Add line").click();
    const line = page.locator(".invoice-line").first();
    const quantity = field(line, "Invoiced quantity");
    if (!(await quantity.isVisible()))
      await line.locator(".invoice-line-toggle").click();
    await field(line, "Units per case").fill("12");
    await quantity.fill("12");
    await field(line, "Unit cost before tax").fill("0.98");
    const comparison = page.locator(".invoice-order-card");
    await choose(
      page,
      field(comparison, "Order (optional)"),
      new RegExp(`^${escape(reference)} · `),
    );
    await expect(
      comparison.locator(".invoice-order-table tbody tr").first(),
    ).toContainText("Canned Fava Beans");
    await expect(comparison).toContainText(reference);
    await stableAppearance(page, variant);
    target = ".invoice-order-card";
    evidence = { reference, comparison: await comparison.innerText() };
  } else if (scene === "new-order-new-item") {
    await visit(page, "orders");
    await button(page, "New order").click();
    const form = page.getByRole("form", { name: "New order", exact: true });
    await choose(page, field(form, "Supplier"), "Fresh Valley Foods");
    await button(form, "New item").click();
    const modal = dialog(page, "New item");
    await field(modal, "Name").fill("Sample barley biscuits");
    await field(modal, "Units per case (optional)").fill("12");
    await field(modal, "Cases").fill("2");
    await field(modal, "Expected unit cost (optional)").fill("1.25");
    await button(modal, "Add item").click();
    await expect(modal).not.toBeVisible();
    await expect(page.locator(".order-new-item-row")).toContainText(
      "Sample barley biscuits",
    );
    await expect(page.locator(".order-new-item-row")).toContainText("$30.00");
    await stableAppearance(page, variant);
    target = ".order-new-item-row";
    evidence = await page.locator(target).innerText();
  } else if (scene === "weighed-lookup" || scene === "weighed-label") {
    await visit(page, scene === "weighed-lookup" ? "lookup" : "labels");
    await field(page, "Search products").fill("0016");
    if (scene === "weighed-label") {
      await page
        .getByRole("checkbox", { name: "Select product 0016", exact: true })
        .check();
      const bar = page.getByRole("region", {
        name: "Add to waitlist",
        exact: true,
      });
      await field(bar, "Copies").fill("1");
      await button(bar, "Add 1 product to waitlist").click();
      await expect(bar).toHaveCount(0);
      await page.getByRole("tab", { name: /^Waitlist/ }).click();
      target = ".label-bilingual-preview .shelf-label";
      await expect(page.locator(target)).toHaveCount(1);
    } else target = ".lookup-approved-price";
    await expect(page.locator(target)).toContainText("$7.49/lb");
    await expect(page.locator(target)).toContainText("$16.51/kg");
    await stableAppearance(page, variant);
    evidence = await page.locator(target).innerText();
  } else if (scene === "add-date") {
    await visit(page, "expiry");
    await stableAppearance(page, variant);
    await button(page, "Add date", "افزودن تاریخ").click();
    const modal = await filledDate(page);
    await expect(
      field(modal, "Lot (optional)", "سری ساخت (اختیاری)"),
    ).toHaveValue(dateLot);
    await expect(button(modal, "Add date", "افزودن تاریخ")).toBeEnabled();
    target = ".date-operation-dialog";
    evidence = {
      form: await modal.innerText(),
      lot: await field(
        modal,
        "Lot (optional)",
        "سری ساخت (اختیاری)",
      ).inputValue(),
    };
  } else if (scene === "remove-date-dialog" || scene === "undo") {
    const row = await createDate(page);
    await stableAppearance(page, variant);
    const modal = await removeDateDialog(page, row);
    if (scene === "remove-date-dialog") {
      await expect(modal).toContainText(/Removing a date|حذف تاریخ موجودی/);
      target = ".date-operation-dialog";
      evidence = await modal.innerText();
    } else {
      await button(modal, "Remove", "حذف").click();
      await expect(modal).not.toBeVisible();
      const toast = page
        .getByTestId("undo-toast")
        .filter({ hasText: /Remove date|حذف تاریخ/ });
      // Removal uses the real 10-second Undo; user-accessible focus pauses it.
      await expect(toast).toBeVisible();
      await button(toast, "Undo", "واگرد").focus();
      await choose(
        page,
        field(page, "Time window", "بازه زمانی"),
        exact("Removed", "حذف‌شده"),
      );
      await button(toast, "Undo", "واگرد").focus();
      await expect(row).toContainText(dateLot);
      await expect(row).toContainText(/Sold out|تمام‌شده/);
      if (variant === "phone") {
        // The Remove action scrolls the genuine table to its final columns.
        // Pan back to the product/lot evidence while keeping Undo focused.
        await page.locator(".expiry-table").evaluate((element) => {
          element.scrollLeft = 0;
        });
        await expect(row.getByText(dateLot, { exact: true })).toBeInViewport();
      }
      target = ".expiry-table tbody tr";
      evidence = {
        removedRow: await row.innerText(),
        undo: await toast.innerText(),
      };
    }
  } else {
    const reference = await recordPickup(page);
    if (scene === "returns-history") {
      await button(
        page.locator(".return-header-card"),
        "Record resolution",
      ).click();
      const card = page.locator(".return-action-card");
      await card.getByLabel(/Original units this settlement covers$/).fill("3");
      await choose(
        page,
        field(card, "Replacement product actually received"),
        "Sour Cherry Juice 1 L",
      );
      await field(card, "Actual replacement quantity").fill("3");
      await field(card, "Supplier representative name").fill("Demo Driver");
      await field(card, "Replacement receipt reference").fill(
        "C4-REPLACEMENT-001",
      );
      await button(card, "Receive replacement").click();
      await visit(page, "returns");
      await page.getByRole("tab", { name: "History", exact: true }).click();
      target = ".returns-overview-table";
      await expect(page.locator(target)).toContainText("Closed");
      await expect(page.locator(target)).toContainText("Replaced");
      await stableAppearance(page, variant);
      evidence = { reference, table: await page.locator(target).innerText() };
    } else if (scene === "returns-open") {
      await visit(page, "returns");
      await expect(
        page.getByRole("tab", { name: "Open", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      target = ".returns-overview-table";
      await expect(page.locator(target)).toContainText("Waiting for credit");
      await stableAppearance(page, variant);
      evidence = { reference, table: await page.locator(target).innerText() };
    } else if (scene === "return-memo") {
      await stableAppearance(page, variant);
      await page
        .locator(".return-memos-card")
        .getByRole("button", { name: reference, exact: true })
        .click();
      const modal = dialog(page, "Return memo", "یادداشت مرجوعی");
      await expect(modal).toContainText("Demo Driver");
      await expect(modal).toContainText("SIGNED-C4-001");
      await expect(modal).toContainText("امضا");
      target = ".return-memo-preview";
      evidence = { reference, memo: await modal.innerText() };
    } else if (scene === "payables-pending-credit") {
      await visit(page, "payables");
      const row = page
        .locator(".payables-overview-table tbody tr")
        .filter({ hasText: "Fresh Valley Foods" });
      await button(row, "View").click();
      target = ".pending-return-credits";
      await expect(page.locator(target)).toContainText("Confirmed balance");
      await expect(
        page
          .locator(target)
          .getByRole("link", { name: reference, exact: true }),
      ).toBeVisible();
      await stableAppearance(page, variant);
      evidence = {
        reference,
        pendingCredits: await page.locator(target).innerText(),
      };
    }
  }
  if (!target || !evidence)
    throw new Error(`No fixture evidence for ${scene}.`);
  await expect(page.locator(target).first()).toBeVisible();
  await expect(page.locator(".user-chip-copy strong")).toHaveText(
    variant === "fa-light" ? "سرپرست نمایشی" : account.name,
  );
  return { target, evidence };
}

async function frame(page, variant, target, fullPage, scene) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
    );
  });
  if (!(await page.locator("dialog[open]").count())) {
    if (variant === "phone" && fullPage) {
      // A real heading click clears any restored Skip-link focus. Start at
      // the page top so the sticky topbar stays there in a full-page image.
      await page.locator(target).getByRole("heading").first().click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    } else if (variant === "phone") {
      // Keep the actual feature, table data or label in the 390px capture.
      // Scrolling changes presentation only; fixtures are created through UI.
      await page
        .locator(target)
        .first()
        .evaluate((element) => {
          const topbar = document.querySelector(".topbar");
          const offset = (topbar?.getBoundingClientRect().bottom ?? 0) + 20;
          window.scrollTo(
            0,
            Math.max(
              0,
              window.scrollY + element.getBoundingClientRect().top - offset,
            ),
          );
        });
    } else await page.evaluate(() => window.scrollTo(0, 0));
  }
  let framingEvidence;
  if (variant === "phone" && scene === "undo") {
    const addDate = button(page, "Add date", "افزودن تاریخ");
    framingEvidence = await addDate.evaluate((element) => {
      const topbarBottom =
        document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
      const bounds = element.getBoundingClientRect();
      const beforeY = window.scrollY;
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      // A short page can clamp the row-focused scroll at its end, leaving
      // half of Add date behind the sticky bar. Scroll the real page upward
      // just enough to expose the whole control; do not alter its styling.
      if (bounds.top < topbarBottom && bounds.bottom > topbarBottom)
        window.scrollBy(0, bounds.top - topbarBottom - 20);
      const after = element.getBoundingClientRect();
      return {
        beforeY,
        afterY: window.scrollY,
        maxScroll,
        topbarBottom,
        addDateBefore: { top: bounds.top, bottom: bounds.bottom },
        addDateAfter: { top: after.top, bottom: after.bottom },
      };
    });
    await expect
      .poll(() =>
        addDate.evaluate((element) => {
          const boundary =
            document.querySelector(".topbar")?.getBoundingClientRect().bottom ??
            0;
          const bounds = element.getBoundingClientRect();
          return bounds.bottom <= boundary || bounds.top >= boundary;
        }),
      )
      .toBe(true);
  }
  await page.mouse.move(0, 0);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve),
        ),
      ),
  );
  return framingEvidence;
}
async function geometry(page) {
  return page.evaluate(() => {
    const findings = [];
    const modal = document.querySelector("dialog[open]");
    const area = modal ?? document.querySelector("#main-content");
    if (!area) return [{ kind: "missing-capture-area" }];
    // Hidden input helpers are permitted; browser-default controls must never
    // be visible. Geometry alone would miss a native Choose File button.
    for (const control of document.querySelectorAll(
      'select,input[type="file"],input[type="checkbox"],input[type="radio"],input[type="date"]',
    )) {
      const bounds = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      if (
        control.getClientRects().length &&
        bounds.width > 2 &&
        bounds.height > 2 &&
        style.visibility !== "hidden" &&
        style.clipPath === "none" &&
        style.clip === "auto"
      )
        findings.push({
          kind: "visible-native-control",
          tag: control.tagName,
          type: control.getAttribute("type"),
          class: control.className,
        });
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 2)
      findings.push({
        kind: "document-horizontal",
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      });
    if (window.innerWidth <= 760) {
      if (modal) {
        const bounds = modal.getBoundingClientRect();
        if (bounds.left < -2 || bounds.right > window.innerWidth + 2)
          findings.push({
            kind: "phone-dialog-width",
            left: bounds.left,
            right: bounds.right,
          });
      }
      return findings;
    }
    for (const element of [
      area,
      ...area.querySelectorAll(
        ".card, .ui-data-table, table, .invoice-original-media",
      ),
    ]) {
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
      page.setDefaultTimeout(12000);
      page.on("pageerror", (error) =>
        errors.push({ variant, scene, message: error.message }),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          errors.push({ variant, scene, message: message.text() });
      });
      try {
        await page.goto(base);
        const before = await productionAssets(page);
        builds.push({ variant, scene, phase: "before", ...before });
        await field(page, "Username").fill(account.username);
        await field(page, "Password").fill(account.password);
        await button(page, "Sign in").click();
        await expect(button(page, "Demo")).toBeVisible();
        await choose(
          page,
          field(page.locator(".topbar"), "Branch"),
          "North York",
        );
        const fixture = await setupScene(page, scene, variant);
        // The original lives after the retained read-only invoice. This one
        // phone-width full-page capture proves both in the same unedited PNG.
        const fullPage =
          (variant !== "phone" || scene === "posted-invoice-original") &&
          !(await page.locator("dialog[open]").count());
        const framingEvidence = await frame(
          page,
          variant,
          fixture.target,
          fullPage,
          scene,
        );
        const findings = await geometry(page);
        const after = await productionAssets(page);
        builds.push({ variant, scene, phase: "after", ...after });
        if (
          before.fingerprint !== after.fingerprint ||
          before.htmlSHA256 !== after.htmlSHA256
        )
          throw new Error("The production build changed during capture.");
        const filename = `${scene}-${variant}.png`;
        await page.screenshot({
          path: resolve(destination, filename),
          fullPage,
          animations: "disabled",
        });
        results.push({
          scene,
          variant,
          filename,
          captureMode: fullPage ? "full-page" : "viewport",
          capturePurpose:
            variant === "phone" && scene === "posted-invoice-original"
              ? "The 390px-wide full page shows the read-only posted invoice and its retained original image together."
              : variant === "phone" && scene === "weighed-label"
                ? "The existing A4 preview preserves the real physical shelf-label size; no capture-only zoom or DOM rescaling is applied. Verified price text is retained in fixtureEvidence."
                : "Actual feature content, focused at the requested viewport width.",
          viewport: page.viewportSize(),
          role: "supervisor",
          route: new URL(page.url()).hash,
          fixtureEvidence: fixture.evidence,
          framingEvidence,
          layoutFindings: findings,
        });
        console.log(`${filename}: ${findings.length} layout findings`);
      } catch (error) {
        errors.push({ variant, scene, message: error.message });
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
        sourceCommit: process.env.CAPTURE_SOURCE_COMMIT ?? null,
        method:
          "Fresh browser profiles and real interface actions, retained original documents, frozen production HTML/JavaScript/CSS SHA-256 checks; unedited PNG screenshots. All scenes assert their real fixture and Supervisor role. Theme transitions and fonts finish before captures. Phone scenes scroll to relevant content; Undo is paused with user-accessible keyboard focus. Desktop probes inspect panel/table scroll and individual visible cell text bounds.",
        baseURL: base,
        expectedCount: scenes.length * variants.length,
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
  new Set(builds.map((build) => build.fingerprint)).size !== 1 ||
  new Set(builds.map((build) => build.htmlSHA256)).size !== 1 ||
  results.length !== scenes.length * variants.length ||
  errors.length ||
  results.some((item) => item.layoutFindings.length)
)
  process.exitCode = 1;
