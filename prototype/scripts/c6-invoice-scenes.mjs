/* global URL */
import { fileURLToPath } from "node:url";
import { readC8State, waitForC8BusinessEvidence } from "./capture-c8-proof.mjs";

const click = (page, name) =>
  page.getByRole("button", { name, exact: true }).click();
const go = (page, route) => page.goto(new URL(`/#${route}`, page.url()).href);
async function choose(page, control, label) {
  await control.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
async function date(page, control, wanted) {
  await control.click();
  const calendar = page.getByRole("dialog", {
    name: "Choose date",
    exact: true,
  });
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const day = calendar.getByRole("button", { name: wanted, exact: true });
    if (await day.count()) {
      await day.click();
      return;
    }
    const cells = await calendar
      .locator(".ui-calendar-day")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("aria-label")).filter(Boolean),
      );
    await calendar
      .getByRole("button", {
        name: wanted < cells[0] ? "Previous month" : "Next month",
        exact: true,
      })
      .click();
  }
  throw new Error(`The requested invoice date ${wanted} was unavailable.`);
}
async function state(page) {
  await waitForC8BusinessEvidence(page);
  return readC8State(page);
}

/** Real UI fixtures shared by C6 and C7; the caller changes language/theme afterward. */
export async function setupInvoiceScene(page, scene, helpers = {}) {
  void helpers;
  if (scene === "invoices-list") {
    await go(page, "invoices");
    await page.getByRole("tab", { name: "Posted", exact: true }).click();
    await page.locator(".invoice-posted-list").waitFor();
    return {
      selector: ".invoice-posted-list",
      capture: "page",
      evidence: { source: "approved posted seed invoices" },
    };
  }
  if (scene === "manual-invoice-missing") {
    await go(page, "invoices");
    await click(page, "New invoice");
    await click(page, "Manual entry");
    await choose(
      page,
      page.locator("#invoice-supplier"),
      "\u2066Fresh Valley Foods\u2069",
    );
    await page
      .getByLabel("Supplier invoice number (optional)", { exact: true })
      .fill("DEMO-C6-MISSING");
    await click(page, "Add line");
    await click(page, "Post invoice");
    await page
      .getByRole("alert", { name: "What's missing", exact: true })
      .waitFor();
    return {
      selector: ".invoice-workspace",
      capture: "page",
      evidence: {
        draft: "DEMO-C6-MISSING",
        posting:
          "blocked with real missing-original/date/line-confirmation requirements",
      },
    };
  }
  if (scene === "received-range") {
    await go(page, "received");
    await click(page, "Date range");
    await page
      .getByRole("dialog", { name: "Date range", exact: true })
      .getByRole("button", { name: "This month", exact: true })
      .click();
    await page.locator(".received-range-trigger").waitFor();
    return {
      selector: ".received-filters",
      capture: "page",
      evidence: {
        range: "This month, selected through the date-range control",
      },
    };
  }
  if (scene === "supplier-cards") {
    await go(
      page,
      `suppliers?name=${encodeURIComponent("Fresh Valley Foods")}`,
    );
    await page.locator(".supplier-kpis").waitFor();
    return {
      selector: ".supplier-kpis",
      capture: "page",
      evidence: {
        supplier: "Fresh Valley Foods",
        source: "approved scoped seed contacts/deliveries/returns/balance",
      },
    };
  }
  throw new Error(`Unknown C6 invoice capture scene: ${scene}`);
}

/** Post the supplied fictional source, with its exact header/packs/totals and a real short-dated juice lot. */
export async function setupDatedReceipt(page, helpers = {}) {
  void helpers;
  await go(page, "invoices");
  await click(page, "New invoice");
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(
      fileURLToPath(
        new URL(
          "../public/demo-originals/fictional-fv-20417.png",
          import.meta.url,
        ),
      ),
    );
  await page.locator(".invoice-lines-card").waitFor();
  if (!(await page.locator("#invoice-details-fields").isVisible()))
    await click(page, "Invoice details");
  await date(
    page,
    page.getByLabel("Invoice date", { exact: true }),
    "2026-10-09",
  );
  const persisted = await state(page);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: persisted.config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  const expiry = new Date(
    `${part("year")}-${part("month")}-${part("day")}T12:00:00Z`,
  );
  expiry.setUTCDate(expiry.getUTCDate() + 5);
  const expiryDate = expiry.toISOString().slice(0, 10);
  const lines = page.locator(".invoice-line");
  for (let index = 0; index < 6; index += 1) {
    const line = lines.nth(index);
    if ((await line.innerText()).includes("Sour Cherry Juice")) {
      await line
        .getByRole("button", {
          name: "Short-dated (expiry discount)",
          exact: true,
        })
        .click();
      await date(page, line.getByLabel("Date", { exact: true }), expiryDate);
    } else await line.getByRole("button", { name: "No", exact: true }).click();
    await line
      .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
      .click();
  }
  await click(page, "Post invoice");
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await page.locator(".posted-invoice-document").waitFor();
  await waitForC8BusinessEvidence(page, "posted");
  const saved = await state(page);
  if (saved.invoice.status !== "posted")
    throw new Error("The dated receipt did not post.");
  return {
    invoice_id: saved.invoice.id,
    product_code: "0003",
    expiry_date: expiryDate,
    branch: saved.invoice.branch,
    original_file: saved.invoice.file_name,
  };
}
