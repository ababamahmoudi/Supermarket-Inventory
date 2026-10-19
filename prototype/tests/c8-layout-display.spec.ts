import { readCanonicalBusinessEvidence } from "./business-evidence";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import demo from "../../seed/demo-data.json" with { type: "json" };
import type { DemoState } from "../src/types";
import {
  invoiceImage,
  openInvoiceUpload,
  setLanguage,
  signIn,
  uploadInvoice,
} from "./helpers";

const copy = (lang: "en" | "fa", en: string, fa: string) =>
  lang === "fa" ? fa : en;
const saved = (page: Page): Promise<DemoState> =>
  readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );

async function retainedOriginalHash(page: Page, reference: string) {
  const bytes = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("supermarket-prototype-files-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<{ source: Blob }>((resolve, reject) => {
        const request = db
          .transaction("files", "readonly")
          .objectStore("files")
          .get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!(record?.source instanceof Blob))
        throw new Error("Original evidence is missing");
      return Array.from(new Uint8Array(await record.source.arrayBuffer()));
    } finally {
      db.close();
    }
  }, reference);
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

async function quantityEvidence(page: Page, row: Locator) {
  const direct = row.locator('td[data-column-key="quantity"]');
  if (await direct.isVisible()) return direct;
  const disclosure = row.locator(".table-details-toggle");
  await expect(disclosure).toBeVisible();
  const id = await disclosure.getAttribute("aria-controls");
  await disclosure.click();
  const details = page.locator(`[id=${JSON.stringify(id)}]`);
  await expect(details).toBeVisible();
  return details;
}

for (const language of ["en", "fa"] as const) {
  test(`C8 unread original has Continue and exact durable evidence (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await page.goto("/#invoices");
    await setLanguage(page, language);
    const before = (await saved(page)).invoice;
    expect(before.status).toBe("empty");
    expect(before.file_data).toMatch(/^idb-file:v1:/);
    const originalHash = await retainedOriginalHash(page, before.file_data!);
    const drafts = page.locator(".invoice-saved-drafts");
    await expect(drafts).toContainText(
      copy(language, "Not read yet", "هنوز خوانده نشده"),
    );
    await expect(
      page
        .getByText(before.file_name!, { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText(
        copy(
          language,
          "No drafts. Start a new invoice.",
          "پیش‌نویسی نیست. فاکتور جدید شروع کنید.",
        ),
        { exact: true },
      ),
    ).toHaveCount(0);
    await drafts
      .getByRole("button", {
        name: copy(language, "Continue", "ادامه"),
        exact: true,
      })
      .click();
    await expect(page.locator(".invoice-reading-state")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: copy(language, "Review invoice lines", "بررسی ردیف‌های فاکتور"),
        exact: true,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => (await saved(page)).invoice.status)
      .toBe("review");
    const after = (await saved(page)).invoice;
    expect(after.id).toBe(before.id);
    expect(after.file_data).toBe(before.file_data);
    expect(after.lines).toEqual(before.lines);
    expect(await retainedOriginalHash(page, after.file_data!)).toBe(
      originalHash,
    );
    await expect(
      page
        .getByText(before.file_name!, { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".invoice-original-media img")).toBeVisible();
    expect(await retainedOriginalHash(page, after.file_data!)).toBe(
      originalHash,
    );
  });

  test(`C8 invoice read-only costs preserve four decimals without posting money (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await page.goto("/#invoices");
    await uploadInvoice(page);
    await expect
      .poll(async () => (await saved(page)).invoice.file_data)
      .toMatch(/^idb-file:v1:/);
    const before = await saved(page);
    const originalHash = await retainedOriginalHash(
      page,
      before.invoice.file_data!,
    );
    expect(originalHash).toBe(
      createHash("sha256").update(invoiceImage.buffer).digest("hex"),
    );
    const line = page.locator(".invoice-line").first();
    await line
      .getByLabel("Unit cost before tax", { exact: true })
      .fill("1.5525");
    await line.getByRole("button", { name: "No", exact: true }).click();
    await line
      .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
      .click();
    await expect(line).toHaveAttribute("data-expanded", "false");
    await setLanguage(page, language);
    const displayedCost = line
      .locator(".invoice-line-summary > td:nth-child(3)")
      .getByText("$1.5525", { exact: true });
    await expect(displayedCost).toBeVisible();
    await expect(displayedCost).toHaveText("$1.5525");
    await expect
      .poll(
        async () => (await saved(page)).invoice.lines[0].unit_cost_before_tax,
      )
      .toBe("1.5525");
    const after = await saved(page);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.invoices).toEqual(before.invoices);
    expect(after.invoice.file_data).toBe(before.invoice.file_data);
    expect(await retainedOriginalHash(page, after.invoice.file_data!)).toBe(
      originalHash,
    );
    await page.reload();
    await expect(displayedCost).toBeVisible();
    await expect(displayedCost).toHaveText("$1.5525");
    expect((await saved(page)).invoice.file_data).toBe(
      before.invoice.file_data,
    );
    expect(await retainedOriginalHash(page, before.invoice.file_data!)).toBe(
      originalHash,
    );
  });

  test(`C8 Received uses whole cases and retained loose units (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    const before = await saved(page);
    await page.goto("/#received");
    await setLanguage(page, language);
    for (const [number, code, expected] of [
      [
        "GG-11879",
        "0007",
        copy(language, "3 cases + 4 units", "3 کارتن + 4 واحد"),
      ],
      [
        "SB-7862",
        "0004",
        copy(language, "2 cases + 4 units", "2 کارتن + 4 واحد"),
      ],
    ]) {
      const invoice = before.invoices!.find(
        (item) => item.supplier_invoice_number === number,
      )!;
      expect(invoice).toBeDefined();
      const name = demo.products.find((item) => item.code === code)!.name_en;
      const row = page
        .locator(
          `.received-table tbody > tr[data-row-href="#invoices?id=${encodeURIComponent(invoice.id)}"]`,
        )
        .filter({ hasText: name });
      await expect(row).toHaveCount(1);
      const evidence = await quantityEvidence(page, row);
      await expect(evidence).toContainText(expected);
      await expect(evidence).not.toContainText(/\d+\.\d+\s+(?:cases|کارتن)/);
    }
    const after = await saved(page);
    expect(after.invoices).toEqual(before.invoices);
    expect(after.stock_movements).toEqual(before.stock_movements);
    expect(after.ledger).toEqual(before.ledger);
  });

  test(`C8 list navigation and disclosure stay at the row end (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    const tables = [
      ["received", ".received-table"],
      ["suppliers", ".suppliers-table"],
      ["payables", ".payables-overview-table"],
      ["returns", ".returns-overview-table"],
      ["dashboard", ".dashboard-invoices .ui-data-table"],
    ];
    for (const [route, selector] of tables) {
      await page.goto(`/#${route}`);
      const row = page.locator(`${selector} tbody > tr[data-row-href]`).first();
      await expect(row).toBeVisible();
      await expect(row.locator(".table-row-link")).toHaveCount(1);
      await expect(
        row.locator('td[data-column-key="actions"] .table-row-link'),
      ).toHaveCount(1);
      const disclosure = row.locator(".table-details-toggle");
      if (await disclosure.count()) {
        await expect(
          row.locator('td[data-column-key="actions"] .table-details-toggle'),
        ).toHaveCount(1);
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/#suppliers");
    const suppliersTable = page.locator(".suppliers-table");
    const supplierRow = suppliersTable
      .locator("tbody > tr[data-row-href]")
      .filter({ hasText: "Fresh Valley Foods" });
    await expect(supplierRow).toHaveCount(1);
    const visibleValues = await supplierRow
      .locator("td[data-column-key]")
      .evaluateAll((cells) =>
        Object.fromEntries(
          cells.map((cell) => [
            cell.getAttribute("data-column-key")!,
            cell.textContent?.trim() ?? "",
          ]),
        ),
      );
    const before = await saved(page);
    const supplier = before.suppliers!.find(
      (item) => item.name === "Fresh Valley Foods",
    )!;
    expect(supplier).toBeDefined();
    await page
      .getByRole("button", {
        name: copy(language, "Columns", "ستون‌ها"),
        exact: true,
      })
      .click();
    const columns = page.getByRole("dialog", {
      name: copy(language, "Columns", "ستون‌ها"),
      exact: true,
    });
    for (const [en, fa] of [
      ["Payment terms", "شرایط پرداخت"],
      ["Sales rep and phone", "نماینده فروش و تلفن"],
      ["Next due date", "سررسید بعدی"],
    ]) {
      const option = columns.getByRole("checkbox", {
        name: copy(language, en, fa),
        exact: true,
      });
      await expect(option).not.toBeChecked();
      await option.click();
      await expect(option).toBeChecked();
    }
    await columns
      .getByRole("button", {
        name: copy(language, "Close", "بستن"),
        exact: true,
      })
      .click();
    for (const [key, en, fa] of [
      ["name", "Supplier", "تأمین‌کننده"],
      ["status", "Status", "وضعیت"],
      ["last_delivery", "Last delivery", "آخرین تحویل"],
      ["deliveries", "Deliveries", "تحویل‌ها"],
      ["returns", "Open returns", "مرجوعی‌های باز"],
      ["shorts", "Open shorts", "کسری‌های باز"],
      ["terms", "Payment terms", "شرایط پرداخت"],
      ["contact", "Sales rep and phone", "نماینده فروش و تلفن"],
      ["balance", "Balance", "مانده"],
      ["overdue", "Overdue", "سررسید گذشته"],
      ["due", "Next due date", "سررسید بعدی"],
      ["actions", "Action", "عملیات"],
    ]) {
      const header = suppliersTable.locator(
        `thead th[data-column-key="${key}"]`,
      );
      await expect(header).toBeVisible();
      await expect(header).toContainText(copy(language, en, fa));
      await expect(
        supplierRow.locator(`td[data-column-key="${key}"]`),
      ).toBeVisible();
    }
    for (const [key, value] of Object.entries(visibleValues))
      await expect(
        supplierRow.locator(`td[data-column-key="${key}"]`),
      ).toHaveText(value);
    await expect(supplierRow.locator('td[data-column-key="terms"]')).toHaveText(
      supplier.payment_terms ?? "—",
    );
    await expect(
      supplierRow.locator('td[data-column-key="contact"]'),
    ).toContainText(supplier.sales_rep_name ?? "—");
    await expect(
      supplierRow.locator('td[data-column-key="contact"]'),
    ).toContainText(supplier.sales_rep_phone ?? "—");
    await expect(supplierRow.locator('td[data-column-key="due"]')).toHaveText(
      /^(?:\d{4}-\d{2}-\d{2}|—)$/,
    );
    await expect(suppliersTable).toHaveAttribute(
      "data-width-hidden-column-count",
      "0",
    );
    await expect(suppliersTable.locator(".table-details-toggle")).toHaveCount(
      0,
    );
    const after = await saved(page);
    expect(after.suppliers).toEqual(before.suppliers);
    expect(after.invoices).toEqual(before.invoices);
    expect(after.ledger).toEqual(before.ledger);
  });

  test(`C8 Payables filters share their list card and preserve scoped rows (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await page.goto("/#payables");
    await setLanguage(page, language);
    const card = page.locator(".payables-overview");
    await expect(card.locator(".payables-filters")).toBeVisible();
    await card
      .getByRole("textbox", {
        name: copy(language, "Search suppliers", "جستجوی تأمین‌کنندگان"),
        exact: true,
      })
      .fill("Fresh Valley");
    const rows = card.locator("tbody > tr[data-row-href]");
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("Fresh Valley Foods");
    await rows.locator(".table-row-link").click();
    await expect(page.locator(".payables-ledger-card")).toBeVisible();
  });
}

test("C8 exact included sale-cost original preserves drafts and cannot be impersonated by its filename", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  const before = await saved(page);
  const original = fileURLToPath(
    new URL("../public/demo-originals/fictional-hw-5012.svg", import.meta.url),
  );
  await (await openInvoiceUpload(page)).setInputFiles(original);
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await expect
    .poll(async () => (await saved(page)).invoice.supplier_invoice_number)
    .toBe("HW-5012");
  const loaded = await saved(page);
  expect(loaded.invoice.id).toBe("demo-c8-hw-5012");
  expect(loaded.invoice.lines[0].unit_cost_before_tax).toBe("14.2000");
  expect(loaded.invoice.final_total).toBe("48.14");
  expect(loaded.invoice.receiving_employee).toBe(
    await page.locator(".user-chip-copy strong").textContent(),
  );
  expect(loaded.ledger).toEqual(before.ledger);
  expect(
    loaded.alerts.filter((item) => item.type === "sale_cost_increase"),
  ).toHaveLength(0);
  expect(await retainedOriginalHash(page, loaded.invoice.file_data!)).toBe(
    "b0f9b1cb07929298d0666800cb1ca3493bbaebd65e52a2f28b1bde9633f84444",
  );
  // Starting another workspace retains the old unread original, too.
  expect(
    loaded.invoices!.find((item) => item.id === before.invoice.id)!.file_data,
  ).toBe(before.invoice.file_data);
  await page
    .locator(".invoice-line")
    .first()
    .getByLabel("Unit cost before tax", { exact: true })
    .fill("14.3000");
  await expect
    .poll(async () => (await saved(page)).invoice.lines[0].unit_cost_before_tax)
    .toBe("14.3000");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await (await openInvoiceUpload(page)).setInputFiles(original);
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect
    .poll(async () => (await saved(page)).invoice.lines[0].unit_cost_before_tax)
    .toBe("14.3000");
  const reused = await saved(page);
  expect(reused.invoice.id).toBe(loaded.invoice.id);
  expect(reused.invoice.file_data).toBe(loaded.invoice.file_data);
  expect(reused.ledger).toEqual(before.ledger);
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await (
    await openInvoiceUpload(page)
  ).setInputFiles({ ...invoiceImage, name: "fictional-hw-5012.svg" });
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  const unknown = await saved(page);
  expect(unknown.invoice.id).not.toBe(loaded.invoice.id);
  expect(unknown.invoice.supplier_invoice_number).toBe(
    demo.demo_invoice.supplier_invoice_number,
  );
  expect(unknown.invoice.lines).toHaveLength(demo.demo_invoice.lines.length);
  expect(unknown.ledger).toEqual(before.ledger);
});
