/* global document, window, getComputedStyle, indexedDB, Blob, crypto */
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { expect } from "@playwright/test";
import sourceConfig from "../../seed/arzon-config.json" with { type: "json" };
import retainedConfig from "../src/compat/configuration.json" with { type: "json" };

import { button, choose, field, settled } from "./c5-browser-proof.mjs";
import { inspectResponsiveLayout } from "./c6-layout-proof.mjs";

// Standalone Node capture cannot import the app's TypeScript modules. Read the
// actual repository constant, rather than trusting a second database-name copy.
const authoritySource = readFileSync(
  new URL("../src/authority-repository.ts", import.meta.url),
  "utf8",
);
const authorityDatabaseDeclaration = authoritySource.match(
  /^export const AUTHORITY_DATABASE_NAME = ("[^"\n]+");$/m,
);
if (!authorityDatabaseDeclaration)
  throw new Error("The actual authority database declaration is missing.");
const authorityDatabaseName = JSON.parse(authorityDatabaseDeclaration[1]);
const configuredCompanyId = {
  ...retainedConfig.company,
  ...sourceConfig.company,
}.seed_key;

export const C8_SCENES = [
  "edit-product-dates",
  "edit-product-missing-date",
  "labels-products",
  "new-order",
  "product-detail",
  "change-price-sale",
  "change-price-regular",
  "request-sale-dialog",
  "requested-sale-products",
  "requested-sale-lookup",
  "sale-request-approval",
  "sale-lookup",
  "sales-offers",
  "sale-cost-increase",
  "sale-promo-label",
];
export const C8_VARIANTS = [
  "en-light",
  "en-dark",
  "fa-light",
  "mid-900",
  "phone-dark",
];

/** Read the genuine company snapshot without initializing or mutating it. */
export async function readC8State(page) {
  return page.evaluate(
    ({ databaseName, companyId }) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(databaseName);
        const fail = (message, database) => {
          database?.close();
          reject(new Error(message));
        };
        open.onupgradeneeded = () => {
          // Evidence must never create or upgrade the business database.
          open.transaction?.abort();
          fail("The canonical business database has not been initialized.");
        };
        open.onerror = () =>
          fail("Cannot open the canonical business database.");
        open.onblocked = () =>
          fail("The canonical business database is blocked.");
        open.onsuccess = () => {
          const database = open.result;
          database.onversionchange = () => database.close();
          if (!database.objectStoreNames.contains("business")) {
            fail("The canonical business store is missing.", database);
            return;
          }
          const transaction = database.transaction("business", "readonly");
          const request = transaction.objectStore("business").get(companyId);
          let state;
          request.onsuccess = () => {
            const record = request.result;
            if (
              record?.company_id !== companyId ||
              record.state?.config?.company?.seed_key !== companyId ||
              !Number.isSafeInteger(record.revision)
            ) {
              transaction.abort();
              return;
            }
            state = record.state;
          };
          transaction.oncomplete = () => {
            database.close();
            if (!state) {
              reject(
                new Error(
                  "The configured company's business record is missing.",
                ),
              );
              return;
            }
            resolve(state);
          };
          transaction.onabort = transaction.onerror = () =>
            fail(
              "Cannot read the configured company's canonical business record.",
              database,
            );
        };
      }),
    { databaseName: authorityDatabaseName, companyId: configuredCompanyId },
  );
}

/** Preserve the caller's actual waitForFunction timeout and polling policy. */
export async function waitForC8BusinessEvidence(page, invoiceStatus) {
  const ready = await page.waitForFunction(
    ({ databaseName, companyId, expectedInvoiceStatus }) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(databaseName);
        open.onupgradeneeded = () => {
          open.transaction?.abort();
          reject(
            new Error("The canonical business database is not initialized."),
          );
        };
        open.onerror = () => reject(open.error);
        open.onblocked = () =>
          reject(new Error("The canonical business database is blocked."));
        open.onsuccess = () => {
          const database = open.result;
          database.onversionchange = () => database.close();
          if (!database.objectStoreNames.contains("business")) {
            database.close();
            reject(new Error("The canonical business store is missing."));
            return;
          }
          const transaction = database.transaction("business", "readonly");
          const request = transaction.objectStore("business").get(companyId);
          let matches = false;
          request.onsuccess = () => {
            const record = request.result;
            matches =
              record?.company_id === companyId &&
              record.state?.config?.company?.seed_key === companyId &&
              Number.isSafeInteger(record.revision) &&
              (expectedInvoiceStatus === undefined ||
                record.state?.invoice?.status === expectedInvoiceStatus);
          };
          transaction.oncomplete = () => {
            database.close();
            resolve(matches);
          };
          transaction.onabort = transaction.onerror = () => {
            database.close();
            reject(new Error("Cannot read canonical business readiness."));
          };
        };
      }),
    {
      databaseName: authorityDatabaseName,
      companyId: configuredCompanyId,
      expectedInvoiceStatus: invoiceStatus,
    },
  );
  await ready.dispose();
}

export async function visitC8(page, route) {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, route);
  await expect(page.locator("main")).toBeVisible();
  await settled(page);
}

/** Add vertical/card containment to the unchanged C6 text/control guards. */
export async function inspectC8Containment(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !element.closest("[hidden],dialog:not([open])")
      );
    };
    const excluded =
      ".operational-print-document,.print-sheet,.shelf-label,.return-memo-document,.order-print-document";
    const failures = [];
    const tables = [];
    let rowCount = 0;
    let editorCount = 0;
    for (const wrapper of document.querySelectorAll("main .ui-data-table")) {
      if (!visible(wrapper) || wrapper.closest(excluded)) continue;
      const card = wrapper.closest(".ui-card,.card,.list-box");
      const rows = [];
      if (!card) {
        failures.push("Table has no enclosing list card: " + wrapper.className);
        continue;
      }
      const bounds = card.getBoundingClientRect();
      const frame = wrapper.getBoundingClientRect();
      const boundedScroll =
        wrapper.matches(".ui-data-table.is-scrollable:not(.is-phone-list)") &&
        /^(auto|scroll)$/.test(getComputedStyle(wrapper).overflowX) &&
        wrapper.tabIndex >= 0 &&
        frame.left >= bounds.left - 1 &&
        frame.right <= bounds.right + 1;
      for (const editor of wrapper.querySelectorAll(".receiving-line-editor")) {
        if (!visible(editor)) continue;
        editorCount++;
        const editorBounds = editor.getBoundingClientRect();
        const fixed = getComputedStyle(editor).position === "fixed";
        const left = fixed ? 0 : frame.left;
        const right = fixed
          ? document.documentElement.clientWidth
          : frame.right;
        if (editorBounds.left < left - 1 || editorBounds.right > right + 1)
          failures.push(
            "Expanded invoice editor extends beyond its visible frame",
          );
      }
      for (const row of wrapper.querySelectorAll("table > tbody > tr")) {
        if (!visible(row)) continue;
        const rect = row.getBoundingClientRect();
        rowCount++;
        const label = (row.textContent ?? "").replace(/\s+/g, " ").trim();
        const outside =
          (boundedScroll ? Math.max(rect.left, frame.left) : rect.left) <
            bounds.left - 1 ||
          (boundedScroll ? Math.min(rect.right, frame.right) : rect.right) >
            bounds.right + 1 ||
          rect.top < bounds.top - 1 ||
          rect.bottom > bounds.bottom + 1;
        if (outside)
          failures.push("Row extends beyond card: " + label.slice(0, 160));
        rows.push({
          text: label,
          expanded: row.classList.contains("table-expanded-row"),
          row: {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          },
          contained: !outside,
        });
      }
      tables.push({
        className: wrapper.className,
        cardClassName: card.className,
        card: {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
        },
        rows,
      });
    }
    return {
      tableCount: tables.length,
      rowCount,
      editorCount,
      tables,
      failures,
    };
  });
}

export async function inspectC8Layout(page, scene, language, width) {
  const layout = await inspectResponsiveLayout(page, scene, language, width);
  const containment = await inspectC8Containment(page);
  return {
    ...layout,
    containment,
    failures: [...new Set([...layout.failures, ...containment.failures])],
  };
}

/** Select a date through the real calendar; never write a hidden value/state. */
export async function chooseC8Date(page, control, date = "today") {
  await control.click();
  const calendar = page.locator(".ui-calendar").last();
  await expect(calendar).toBeVisible();
  if (date === "today") {
    await calendar.getByRole("button", { name: /^(Today|امروز)$/ }).click();
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new Error("Calendar fixture needs an ISO date.");
    for (let turns = 0; turns < 36; turns++) {
      const target = calendar.getByRole("button", { name: date, exact: true });
      if (await target.count()) {
        await target.click();
        break;
      }
      const first = await calendar
        .locator(".ui-calendar-day:not(.outside-month)")
        .first()
        .getAttribute("aria-label");
      if (!first) throw new Error("Calendar has no actual dated cells.");
      await calendar
        .getByRole("button", {
          name:
            date.slice(0, 7) > first.slice(0, 7)
              ? /^(Next month|ماه بعد)$/
              : /^(Previous month|ماه قبل)$/,
        })
        .click();
    }
  }
  await expect(calendar).toBeHidden();
  await expect(control).toHaveAttribute("aria-expanded", "false");
}

export async function openC8ProductEditor(page, code) {
  await visitC8(page, "product?code=" + code);
  await expect(page.locator(".product-page")).toBeVisible();
  await page
    .locator(".product-page .page-header")
    .getByRole("button", { name: /^(Edit|ویرایش)(\s|$)/ })
    .click();
  const dialog = page.locator(".product-editor-dialog[open]");
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function prepareC8NewOrder(page) {
  await visitC8(page, "orders");
  await button(page, "New order", "سفارش جدید").click();
  const form = page.getByRole("form", { name: /^(New order|سفارش جدید)$/ });
  await expect(form).toBeVisible();
  await choose(
    page,
    field(form, "Supplier", "تأمین‌کننده"),
    "Golden Grain Distributors",
  );
  const cases = form.getByRole("textbox", { name: /^(Cases|کارتن) —/ });
  await expect(cases.first()).toBeVisible();
  await cases.first().fill("12");
  if ((await cases.count()) > 1) await cases.nth(1).fill("2");
  await expect(
    form.locator(".order-items-table tbody tr").first(),
  ).toContainText(/48/);
  return form;
}

export async function prepareC8ManualInvoice(page) {
  await visitC8(page, "invoices");
  const previous = (await readC8State(page)).invoice.id;
  await button(page, "New invoice", "فاکتور جدید").click();
  const chooser = page.getByRole("dialog", {
    name: /^(New invoice|فاکتور جدید)$/,
  });
  await button(chooser, "Manual entry", "ورود دستی").click();
  await expect
    .poll(async () => {
      const invoice = (await readC8State(page)).invoice;
      return (
        invoice.id !== previous &&
        invoice.entry_mode === "manual" &&
        new URL(page.url()).hash ===
          "#invoices?id=" + encodeURIComponent(invoice.id) &&
        invoice.lines.length === 0
      );
    })
    .toBe(true);
  const details = page.locator("#invoice-details-fields");
  await choose(
    page,
    field(details, "Supplier", "تأمین‌کننده"),
    /Fresh Valley Foods/,
  );
  const number = field(details, "Invoice number", "شماره فاکتور");
  await expect(number).toBeEnabled();
  await number.fill("C8-QA-CONTAINMENT");
  await expect
    .poll(async () => (await readC8State(page)).invoice.supplier_invoice_number)
    .toBe("C8-QA-CONTAINMENT");
  const product = (await readC8State(page)).products.find(
    (item) => item.code === "0002",
  );
  if (!product) throw new Error("The fictional receiving product is missing.");
  await choose(
    page,
    field(page, "Add a product to the invoice", "افزودن کالا به فاکتور"),
    product.name_en,
  );
  await button(page, "Add line", "افزودن ردیف").click();
  await expect(
    page.locator(".receiving-lines-table .invoice-line"),
  ).toHaveCount(1);
  await page.getByTestId("invoice-line-row-0").click();
  await expect(page.locator("#invoice-line-0-detail")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function openC8PriceDialog(page, code) {
  await visitC8(page, "product?code=" + code);
  await page
    .locator(".product-header-actions")
    .getByRole("button", {
      name: /^(Change price|Change sale|Request a sale|تغییر قیمت|تغییر حراج|درخواست حراج)$/,
    })
    .click();
  const dialog = page.locator(".change-price-dialog[open]");
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function readC8OriginalSHA(page, reference) {
  return page.evaluate(async (id) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("supermarket-prototype-files-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise((resolve, reject) => {
        const request = db
          .transaction("files", "readonly")
          .objectStore("files")
          .get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!record || typeof record !== "object" || Array.isArray(record))
        throw new Error("The original evidence is missing.");
      let source = record.source;
      if (!("binary_encoding" in record) && source instanceof Blob) {
        // Retained originals from the existing Blob representation stay valid.
      } else {
        if (
          record.binary_encoding !== "array-buffer-v1" ||
          typeof record.source_mime_type !== "string"
        )
          throw new Error("The original evidence is missing.");
        try {
          const byteLength = Object.getOwnPropertyDescriptor(
            ArrayBuffer.prototype,
            "byteLength",
          ).get;
          Reflect.apply(byteLength, source, []);
          source = new Blob([source], { type: record.source_mime_type });
          if (source.type !== record.source_mime_type)
            throw new Error("The original evidence is missing.");
        } catch {
          throw new Error("The original evidence is missing.");
        }
      }
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await source.arrayBuffer(),
      );
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
    } finally {
      db.close();
    }
  }, reference);
}

/** Post the exact included source; all posting/line gates remain actual UI gates. */
export async function postC8SaleCostInvoice(page, originalPath) {
  const before = await readC8State(page);
  const sale = before.sales?.find((entry) => entry.id === "demo-c8-pot-sale");
  expect(sale).toMatchObject({
    product_code: "0012",
    branch: "Branch 1",
    sale_price: "16.99",
  });
  await visitC8(page, "invoices");
  const previousInvoice = (await readC8State(page)).invoice.id;
  await button(page, "New invoice", "فاکتور جدید").click();
  const chooser = page.getByRole("dialog", {
    name: /^(New invoice|فاکتور جدید)$/,
  });
  await expect(chooser).toBeVisible();
  await button(chooser, "Upload", "بارگذاری").click();
  await expect
    .poll(async () => {
      const current = (await readC8State(page)).invoice;
      return (
        current.id !== previousInvoice &&
        current.entry_mode === "upload" &&
        new URL(page.url()).hash ===
          "#invoices?id=" + encodeURIComponent(current.id)
      );
    })
    .toBe(true);
  await field(
    page,
    "Upload a PDF or photo",
    "بارگذاری PDF یا عکس",
  ).setInputFiles(originalPath);
  const reviewDeadline = Date.now() + 15000;
  await expect
    .poll(
      async () => {
        const current = (await readC8State(page)).invoice;
        return (
          current.id === "demo-c8-hw-5012" &&
          current.status === "review" &&
          current.lines.length === 1 &&
          new URL(page.url()).hash === "#invoices?id=demo-c8-hw-5012"
        );
      },
      { timeout: Math.max(1, reviewDeadline - Date.now()) },
    )
    .toBe(true);
  await expect(
    page.getByRole("heading", {
      name: /^(Invoice lines|ردیف‌های فاکتور)$/,
    }),
  ).toBeVisible({ timeout: Math.max(1, reviewDeadline - Date.now()) });
  await expect
    .poll(async () => (await readC8State(page)).invoice.supplier_invoice_number)
    .toBe("HW-5012");
  const loaded = await readC8State(page);
  expect(loaded.invoice).toMatchObject({
    id: "demo-c8-hw-5012",
    supplier: "HomeWare Imports",
    subtotal: "42.60",
    tax: "5.54",
    final_total: "48.14",
  });
  expect(loaded.invoice.lines).toHaveLength(1);
  expect(loaded.invoice.lines[0]).toMatchObject({
    product_code: "0012",
    qty_invoiced: 3,
    units_per_case: 3,
    unit_cost_before_tax: "14.2000",
  });
  expect(loaded.ledger).toEqual(before.ledger);
  expect(
    loaded.alerts.filter((entry) => entry.type === "sale_cost_increase"),
  ).toEqual(
    before.alerts.filter((entry) => entry.type === "sale_cost_increase"),
  );
  const originalSHA = await readC8OriginalSHA(page, loaded.invoice.file_data);
  expect(originalSHA).toBe(
    "b0f9b1cb07929298d0666800cb1ca3493bbaebd65e52a2f28b1bde9633f84444",
  );
  await page.getByTestId("invoice-line-row-0").click();
  const line = page.locator("#invoice-line-0-detail");
  await expect(line).toBeVisible();
  await line
    .getByRole("group", { name: /^(Track date|پیگیری تاریخ)$/ })
    .getByRole("button", { name: /^(No|خیر)$/, exact: true })
    .click();
  await button(line, "Confirm line", "تأیید ردیف").click();
  // Confirming the real editor collapses the line and retains the durable fact.
  await expect(page.locator(".invoice-line")).toHaveAttribute(
    "data-expanded",
    "false",
  );
  await expect
    .poll(
      async () => (await readC8State(page)).invoice.lines[0].review_confirmed,
    )
    .toBe(true);
  await button(page, "Post invoice", "ثبت فاکتور").click();
  const confirmation = page.getByRole("dialog", {
    name: /^(Post invoice|ثبت فاکتور)$/,
  });
  await expect(confirmation).toBeVisible();
  await button(confirmation, "Post invoice", "ثبت فاکتور").click();
  await expect
    .poll(
      async () =>
        (await readC8State(page)).invoices?.find(
          (entry) => entry.id === loaded.invoice.id,
        )?.status,
    )
    .toBe("posted");
  await expect
    .poll(
      async () =>
        (await readC8State(page)).alerts.filter(
          (entry) =>
            entry.type === "sale_cost_increase" &&
            entry.invoice_id === loaded.invoice.id,
        ).length,
    )
    .toBe(1);
  const after = await readC8State(page);
  const alert = after.alerts.find(
    (entry) =>
      entry.type === "sale_cost_increase" &&
      entry.invoice_id === loaded.invoice.id,
  );
  expect(alert).toMatchObject({
    product_code: "0012",
    branch: "Branch 1",
    new_cost: "14.2000",
    sale_price: "16.99",
    status: "pending",
  });
  expect(after.sales.find((entry) => entry.id === sale.id)).toEqual(sale);
  expect(await readC8OriginalSHA(page, loaded.invoice.file_data)).toBe(
    originalSHA,
  );
  await visitC8(page, "alerts");
  await expect(
    page.locator(`[data-sale-alert-id="${alert.id}"]`),
  ).toBeVisible();
  return {
    invoice_id: loaded.invoice.id,
    sale_id: sale.id,
    alert_id: alert.id,
    originalSHA256: originalSHA,
    line: loaded.invoice.lines[0],
    subtotal: "42.60",
    tax: "5.54",
    final_total: "48.14",
  };
}
