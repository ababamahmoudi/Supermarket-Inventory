import { inspectTableAlignment } from "./alignment-a2-proof";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import demo from "../../seed/demo-data.json" with { type: "json" };
import type { DemoState } from "../src/types";
import {
  invoiceImage,
  openInvoiceLine,
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
    const storedBlob = (
      record: object,
      field: "source" | "preview" | "raw",
    ): Blob => {
      const fields = record as Record<string, unknown>;
      const value = fields[field];
      if (!("binary_encoding" in fields) && value instanceof Blob) return value;
      const mime = fields[`${field}_mime_type`];
      if (
        fields.binary_encoding === "array-buffer-v1" &&
        value instanceof ArrayBuffer &&
        typeof mime === "string"
      ) {
        const blob = new Blob([value], { type: mime });
        if (blob.type === mime) return blob;
      }
      throw new Error("Unexpected retained binary encoding.");
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("supermarket-prototype-files-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const record = await new Promise<{
        source: Blob | ArrayBuffer;
        source_mime_type?: string;
        binary_encoding?: "array-buffer-v1";
      }>((resolve, reject) => {
        const request = db
          .transaction("files", "readonly")
          .objectStore("files")
          .get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!record) throw new Error("Original evidence is missing");
      return Array.from(
        new Uint8Array(await storedBlob(record, "source").arrayBuffer()),
      );
    } finally {
      db.close();
    }
  }, reference);
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

async function quantityEvidence(page: Page, row: Locator) {
  if (await row.evaluate((element) => element.matches(".phone-list-row"))) {
    const quantity = row.locator(".phone-list-value");
    await expect(quantity).toHaveCount(1);
    await expect(quantity).toBeVisible();
    return quantity;
  }
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

async function showOriginal(page: Page, language: "en" | "fa") {
  const phone = (page.viewportSize()?.width ?? 1440) <= 760;
  if (phone) {
    await page
      .getByRole("button", {
        name: language === "en" ? /^View original \(/ : /^مشاهده اصل/,
      })
      .click();
  }
  const viewer = page.getByRole(phone ? "dialog" : "complementary", {
    name: copy(language, "Original invoice", "فاکتور اصلی"),
    exact: true,
  });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".invoice-original-media img")).toBeVisible();
  return viewer;
}

function originalFilename(viewer: Locator) {
  return viewer
    .locator(":scope > .original-viewer-header, :scope > .dialog-description")
    .locator(".original-viewer-file-name");
}

async function originalFilenameIsIntact(viewer: Locator, expected: string) {
  const filename = originalFilename(viewer);
  if ((await filename.count()) !== 1) return false;
  return filename.evaluate((element, expected) => {
    const full = element.querySelector(":scope > .sr-only");
    const painted = element.querySelector(":scope > [aria-hidden=true]");
    if (!full || !painted || !painted.getClientRects().length) return false;
    const prefix = painted.textContent?.trim() ?? "";
    const bounds = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(painted);
    return (
      element.getAttribute("title") === expected &&
      full.textContent?.trim() === expected &&
      (prefix === expected ||
        (prefix.endsWith("…") && expected.startsWith(prefix.slice(0, -1)))) &&
      Array.from(range.getClientRects()).every(
        (rect) =>
          rect.left >= bounds.left - 1.5 && rect.right <= bounds.right + 1.5,
      )
    );
  }, expected);
}

for (const language of ["en", "fa"] as const) {
  test(`C8 unread original has Continue and exact durable evidence (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    await page.goto("/#invoices");
    await setLanguage(page, language);
    const beforeState = await saved(page);
    const before = beforeState.invoice;
    expect(before.status).toBe("empty");
    expect(before.file_data).toMatch(/^idb-file:v1:/);
    const originalHash = await retainedOriginalHash(page, before.file_data!);
    const drafts = page.locator(".invoice-saved-drafts");
    await expect(drafts).toContainText(before.supplier_invoice_number);
    const continueOriginal =
      (page.viewportSize()?.width ?? 1440) <= 760
        ? drafts.getByRole("link", {
            name: copy(language, "Open", "باز کردن"),
            exact: true,
          })
        : drafts.getByRole("button", {
            name: copy(language, "Continue", "ادامه"),
            exact: true,
          });
    await expect(continueOriginal).toBeVisible();
    await expect(
      page
        .getByText(before.file_name!, { exact: true })
        .filter({ visible: true }),
    ).toHaveCount(0);
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
    // Hold the pending read while inspecting its genuine retained source;
    // resume normal scheduling before the existing review deadline below.
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    try {
      await continueOriginal.click();
      // The shared phone list opens the retained original first; its detail
      // action starts the same read operation as desktop Continue.
      if ((page.viewportSize()?.width ?? 1440) <= 760)
        await page
          .getByRole("button", {
            name: copy(language, "Read invoice", "خواندن فاکتور"),
            exact: true,
          })
          .click();
      await expect(
        page.getByText(
          copy(language, "Reading invoice…", "در حال خواندن فاکتور…"),
          { exact: true },
        ),
      ).toBeVisible();
      const pending = await saved(page);
      expect(pending.invoice).toMatchObject({
        id: before.id,
        status: "reading",
        file_data: before.file_data,
      });
      expect(await retainedOriginalHash(page, pending.invoice.file_data!)).toBe(
        originalHash,
      );
      expect(pending.ledger).toEqual(beforeState.ledger);
      expect(pending.approvals).toEqual(beforeState.approvals);
      expect(pending.stock_movements).toEqual(beforeState.stock_movements);
      expect(pending.stock).toEqual(beforeState.stock);
    } finally {
      await page.clock.resume();
    }
    await expect(
      page.getByRole("heading", {
        name: copy(language, "Invoice lines", "ردیف‌های فاکتور"),
        exact: true,
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => {
        const invoice = (await saved(page)).invoice;
        return { id: invoice.id, status: invoice.status };
      })
      .toEqual({ id: before.id, status: "review" });
    const after = (await saved(page)).invoice;
    expect(after.id).toBe(before.id);
    expect(after.file_data).toBe(before.file_data);
    // Reading adopts the stable R2 line identity and explicit date/review
    // defaults; every original business field remains byte-for-byte equal.
    expect(after.lines).toEqual(
      before.lines.map((line, index) => ({
        ...line,
        id: line.id ?? `${before.id}:line:${line.import_line_index ?? index}`,
        date_tracking: line.date_tracking ?? false,
        date_confirmed: line.date_tracking ? line.date_confirmed : true,
        low_confidence_fields: line.low_confidence_fields ?? [],
      })),
    );
    expect(await retainedOriginalHash(page, after.file_data!)).toBe(
      originalHash,
    );
    const original = await showOriginal(page, language);
    const filename = originalFilename(original);
    await expect(filename).toHaveCount(1);
    await expect(filename).toBeVisible();
    await expect
      .poll(() => originalFilenameIsIntact(original, before.file_name!))
      .toBe(true);
    if ((page.viewportSize()?.width ?? 1440) <= 760)
      await expect(original).toHaveAccessibleDescription(
        `${before.file_name} ${copy(language, "1 page", "۱ صفحه")}`,
      );
    // The same strict identity check must reject a mismatched native title,
    // even while the readable and painted filename copies remain present.
    await filename.evaluate((element) =>
      element.setAttribute("title", "fictional-wrong-original.svg"),
    );
    try {
      expect(await originalFilenameIsIntact(original, before.file_name!)).toBe(
        false,
      );
    } finally {
      await filename.evaluate(
        (element, title) => element.setAttribute("title", title),
        before.file_name!,
      );
    }
    expect(await originalFilenameIsIntact(original, before.file_name!)).toBe(
      true,
    );
    await page.reload();
    const reloadedOriginal = await showOriginal(page, language);
    await expect
      .poll(() => originalFilenameIsIntact(reloadedOriginal, before.file_name!))
      .toBe(true);
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
    const line = await openInvoiceLine(page, 0);
    await line
      .getByLabel("Unit cost before tax", { exact: true })
      .fill("1.5525");
    await line
      .getByRole("group", { name: "Track date", exact: true })
      .getByRole("button", { name: "No", exact: true })
      .click();
    await line
      .getByRole("button", { name: "Confirm line", exact: true })
      .click();
    await expect(page.locator(".invoice-line").first()).toHaveAttribute(
      "data-expanded",
      "false",
    );
    await setLanguage(page, language);
    const displayedCost = page
      .getByTestId("invoice-line-row-0")
      .locator(
        ".receiving-cost-cell > bdi:visible, .receiving-phone-cost > bdi:visible",
      );
    await expect(displayedCost).toHaveCount(1);
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
          `.received-table tbody > tr[data-row-href^="#invoices?id=${encodeURIComponent(invoice.id)}&line="]`,
        )
        .filter({ hasText: name });
      await expect(row).toHaveCount(1);
      const lineIndex = invoice.lines.findIndex(
        (line) => line.product_code === code,
      );
      expect(lineIndex).toBeGreaterThanOrEqual(0);
      const lineId = invoice.lines[lineIndex].id ?? String(lineIndex);
      const href = `#invoices?id=${encodeURIComponent(invoice.id)}&line=${encodeURIComponent(lineId)}`;
      await expect(row).toHaveAttribute("data-row-href", href);
      await expect(row.locator(`a[href="${href}"]`).first()).toHaveAttribute(
        "href",
        href,
      );
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
    const navigationState = await saved(page);
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
      if (route === "received") {
        const href = await row.getAttribute("data-row-href");
        expect(href).not.toBeNull();
        const destination = new URL(href!, page.url());
        const params = new URLSearchParams(destination.hash.split("?")[1]);
        const invoice = [
          navigationState.invoice,
          ...(navigationState.invoices ?? []),
        ].find((entry) => entry.id === params.get("id"));
        expect(invoice).toBeDefined();
        const lineIndex = invoice!.lines.findIndex(
          (line, index) => (line.id ?? String(index)) === params.get("line"),
        );
        expect(lineIndex).toBeGreaterThanOrEqual(0);
        const line = invoice!.lines[lineIndex];
        const exactHref = `#invoices?id=${encodeURIComponent(invoice!.id)}&line=${encodeURIComponent(line.id ?? String(lineIndex))}`;
        expect(href).toBe(exactHref);
        await expect(row).toContainText(line.description);
      }
      const disclosure = row.locator(".table-details-toggle");
      if (route === "dashboard") {
        const href = await row.getAttribute("data-row-href");
        const id = new URLSearchParams(href!.split("?")[1]).get("id");
        const invoice = [
          navigationState.invoice,
          ...(navigationState.invoices ?? []),
        ].find((item) => item.id === id);
        expect(invoice).toBeDefined();
        const reference = invoice!.supplier_invoice_number || invoice!.id;
        const identity = row.locator("a.dashboard-invoice-reference");
        await expect(identity).toHaveAttribute("href", href!);
        await expect(identity).toHaveAttribute("title", reference);
        await expect(identity).toHaveAccessibleName(
          `${copy(language, "Invoice", "فاکتور")} ${reference}`,
        );
        await expect(disclosure).toHaveCount(0);
      }
      if (await row.evaluate((element) => element.matches(".phone-list-row"))) {
        const richReturn = route === "returns";
        if (richReturn) {
          const proof = await inspectTableAlignment(page);
          expect(proof.failures).toEqual([]);
          expect(proof.maxError).toBeLessThanOrEqual(2);
          expect(proof.returnCards).toBe(
            await page.locator(`${selector} tbody > tr[data-row-href]`).count(),
          );
          expect(proof.returnCards).toBeGreaterThan(0);
        }
        const chevronSelector = richReturn
          ? ".return-phone-next .table-row-link"
          : ".phone-list-chevron .table-row-link";
        await expect(row.locator(".table-row-link")).toHaveCount(1);
        await expect(row.locator(".table-row-link")).toHaveAttribute(
          "href",
          (await row.getAttribute("data-row-href"))!,
        );
        await expect(row.locator(chevronSelector)).toHaveCount(1);
        await expect(disclosure).toHaveCount(0);
        expect(
          await row.evaluate((element, richReturn) => {
            const control = element.querySelector<HTMLElement>(
              richReturn
                ? ".return-phone-next .table-row-link"
                : ".phone-list-chevron .table-row-link",
            )!;
            const rect = control.getBoundingClientRect();
            const bounds = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            const rtl = style.direction === "rtl";
            const end = rtl
              ? bounds.left +
                parseFloat(style.borderLeftWidth || "0") +
                parseFloat(style.paddingLeft || "0")
              : bounds.right -
                parseFloat(style.borderRightWidth || "0") -
                parseFloat(style.paddingRight || "0");
            return {
              grid: style.display,
              icons: control.querySelectorAll("svg").length,
              atEnd: Math.abs((rtl ? rect.left : rect.right) - end) <= 2,
              contained:
                rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1,
              afterValues: [...element.querySelectorAll(":scope > td")].every(
                (cell) => {
                  if (
                    cell.matches(
                      richReturn ? ".return-phone-next" : ".phone-list-chevron",
                    )
                  )
                    return true;
                  const other = cell.getBoundingClientRect();
                  if (richReturn) return other.bottom <= rect.top + 1;
                  return rtl
                    ? other.left >= rect.right - 1
                    : other.right <= rect.left + 1;
                },
              ),
            };
          }, richReturn),
        ).toEqual({
          grid: "grid",
          icons: 1,
          atEnd: true,
          contained: true,
          afterValues: true,
        });
      } else {
        if (route === "received") {
          const href = await row.getAttribute("data-row-href");
          await expect(row.locator(".received-invoice-link")).toHaveAttribute(
            "href",
            href!,
          );
          await expect(
            row.locator('td[data-column-key="date"] a'),
          ).toHaveAttribute("href", href!);
          await expect(row.locator(".table-row-link")).toHaveCount(0);
        } else {
          await expect(row.locator(".table-row-link")).toHaveCount(1);
          await expect(
            row.locator('td[data-column-key="actions"] .table-row-link'),
          ).toHaveCount(1);
        }
        if (await disclosure.count()) {
          await expect(disclosure).toHaveCount(1);
          await expect(
            row.locator(
              route === "received"
                ? ":scope > td:last-child .table-details-toggle"
                : 'td[data-column-key="actions"] .table-details-toggle',
            ),
          ).toHaveCount(1);
        }
      }
      if (route === "dashboard") {
        const href = await row.getAttribute("data-row-href");
        await row.locator(".table-row-link").click();
        await expect(page).toHaveURL((url) => url.hash === href);
        const id = new URLSearchParams(href!.split("?")[1]).get("id");
        const workspace = page.locator(`[data-invoice-id="${id}"]`);
        await expect(workspace).toHaveCount(1);
        await expect(workspace).toBeVisible();
        await expect(
          workspace.locator("aside#invoice-original-field.original-viewer"),
        ).toHaveAttribute("data-original-invoice-id", id!);
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
  await (await openInvoiceUpload(page)).setFiles(original);
  await expect(
    page.getByRole("heading", { name: "Invoice lines", exact: true }),
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
  const editor = await openInvoiceLine(page, 0);
  await editor
    .getByLabel("Unit cost before tax", { exact: true })
    .fill("14.3000");
  await editor.getByRole("button", { name: "Close", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).invoice.lines[0].unit_cost_before_tax)
    .toBe("14.3000");
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await (await openInvoiceUpload(page)).setFiles(original);
  await expect(
    page.getByRole("heading", { name: "Invoice lines", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect
    .poll(async () => (await saved(page)).invoice.lines[0].unit_cost_before_tax)
    .toBe("14.3000");
  const reused = await saved(page);
  expect(reused.invoice.id).toBe(loaded.invoice.id);
  expect(reused.invoice.file_data).toBe(loaded.invoice.file_data);
  expect(reused.ledger).toEqual(before.ledger);
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await (
    await openInvoiceUpload(page)
  ).setFiles({ ...invoiceImage, name: "fictional-hw-5012.svg" });
  await expect(
    page.getByRole("heading", { name: "Invoice lines", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  const unknown = await saved(page);
  expect(unknown.invoice.id).not.toBe(loaded.invoice.id);
  expect(unknown.invoice.supplier_invoice_number).toBe(
    demo.demo_invoice.supplier_invoice_number,
  );
  expect(unknown.invoice.lines).toHaveLength(demo.demo_invoice.lines.length);
  expect(unknown.ledger).toEqual(before.ledger);
});
