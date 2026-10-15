import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import Decimal from "decimal.js";
import { invoiceImage, setBranch, setLanguage, signIn } from "./helpers";
import { button, choose, field } from "../scripts/c5-browser-proof.mjs";
import {
  inspectC8Layout,
  openC8ProductEditor,
  prepareC8ManualInvoice,
  prepareC8NewOrder,
  readC8State,
  visitC8,
} from "../scripts/capture-c8-proof.mjs";

// Cover every working screen registry destination, plus real list/detail/form
// states. Print artwork retains its independent physical-page proof.
const pages = [
  { route: "dashboard", table: true },
  { route: "lookup", table: false },
  { route: "products", table: true },
  { route: "product?code=0002", table: true },
  { route: "received", table: true },
  { route: "orders", table: true },
  { route: "requests", table: true },
  { route: "approvals", table: false },
  { route: "alerts", table: false },
  { route: "offers", table: true },
  { route: "labels", table: true },
  { route: "returns", table: true },
  { route: "return?id=demo-return-1", table: true },
  { route: "expiry", table: true },
  { route: "notes", table: false },
  { route: "payables", table: true },
  { route: "suppliers", table: true },
  { route: "suppliers?name=Fresh%20Valley%20Foods", table: false },
  { route: "history", table: true },
  { route: "settings?group=company", table: false },
  { route: "settings?group=branches", table: true },
  { route: "settings?group=catalog", table: true },
  { route: "settings?group=pricing", table: false },
  { route: "settings?group=offers", table: false },
  { route: "settings?group=returns", table: false },
  { route: "settings?group=notes", table: false },
  { route: "settings?group=modules", table: false },
] as const;

async function prepareSupplierShorts(page: Page) {
  const before = await readC8State(page);
  await prepareC8ManualInvoice(page);
  await field(page, "Supplier invoice number (optional)").fill(
    "C8-QA-SHORT-LAYOUT",
  );
  const manualId = (await readC8State(page)).invoice.id;
  // A real manual fixture carries its own clearly fictional original and passes
  // the normal receiving gates. No saved invoice or stock record is injected.
  await field(page, "Upload a PDF or photo").setInputFiles({
    ...invoiceImage,
    name: "fictional-c8-short-layout.png",
  });
  // setInputFiles returns before native original retention and its protected
  // workspace refresh finish. Observe the accepted invoice before editing it.
  await expect
    .poll(async () => {
      const invoice = (await readC8State(page)).invoice;
      return {
        id: invoice.id,
        status: invoice.status,
        fileName: invoice.file_name,
        originalRetained: invoice.file_data?.startsWith("idb-file:v1:"),
      };
    })
    .toEqual({
      id: manualId,
      status: "review",
      fileName: "fictional-c8-short-layout.png",
      originalRetained: true,
    });
  await expect(button(page, "New invoice")).toBeEnabled();
  const line = page.locator(".invoice-line");
  await expect(line).toHaveCount(1);
  await expect(line).toContainText("0002");
  await choose(page, field(line, "Quantity unit"), "Units");
  const cost = (await readC8State(page)).invoice.lines[0].unit_cost_before_tax;
  await field(line, "Invoiced").fill("6");
  await expect
    .poll(async () => (await readC8State(page)).invoice.lines[0].qty_invoiced)
    .toBe(6);
  await expect(field(line, "Invoiced")).toHaveValue("6");
  await field(line, "Delivered").fill("2");
  await expect
    .poll(
      async () =>
        (await readC8State(page)).invoice.lines[0].qty_received_at_posting,
    )
    .toBe(2);
  await expect(field(line, "Delivered")).toHaveValue("2");
  await expect(
    line.getByRole("checkbox", { name: "Mark as short", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await button(line, "No").click();
  await line
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await expect(line).toHaveAttribute("data-expanded", "false");
  await expect
    .poll(
      async () => (await readC8State(page)).invoice.lines[0].review_confirmed,
    )
    .toBe(true);
  await expect
    .poll(async () => (await readC8State(page)).invoice.file_data)
    .toMatch(/^idb-file:v1:/);
  const draft = (await readC8State(page)).invoice;
  expect(draft).toMatchObject({
    supplier: "Fresh Valley Foods",
    supplier_invoice_number: "C8-QA-SHORT-LAYOUT",
    branch: "Branch 1",
    file_name: "fictional-c8-short-layout.png",
    final_total: new Decimal(cost).times(6).toFixed(2),
  });
  expect(draft.lines[0]).toMatchObject({
    product_code: "0002",
    qty_invoiced: 6,
    qty_received_at_posting: 2,
  });
  expect((await readC8State(page)).ledger).toEqual(before.ledger);
  expect((await readC8State(page)).stock_movements).toEqual(
    before.stock_movements,
  );
  await button(page, "Post invoice").click();
  const confirmation = page.getByRole("dialog", {
    name: "Post invoice",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  await button(confirmation, "Post invoice").click();
  await expect
    .poll(
      async () =>
        (await readC8State(page)).invoices?.find(
          (invoice) => invoice.id === draft.id,
        )?.status,
    )
    .toBe("posted");
  const after = await readC8State(page);
  expect(after.stock["Branch 1:0002"]).toBe(
    (before.stock["Branch 1:0002"] ?? 0) + 2,
  );
  expect(
    after.stock_movements?.filter((entry) => entry.invoice_id === draft.id),
  ).toMatchObject([{ product_code: "0002", qty: 2, type: "received" }]);
  expect(
    after.ledger.filter((entry) => entry.invoice_id === draft.id),
  ).toMatchObject([
    { type: "invoice", amount: new Decimal(cost).times(6).toFixed(2) },
    { type: "short_deduction", amount: new Decimal(cost).times(-4).toFixed(2) },
  ]);
  return draft.supplier_invoice_number;
}

for (const language of ["en", "fa"] as const)
  for (const width of [390, 900, 1440])
    test(
      "C8 every page keeps rows inside their cards and retains glyph/control guards " +
        language +
        " " +
        width +
        "px",
      async ({ page }, info) => {
        test.setTimeout(240000);
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 1080,
        });
        await signIn(page, "Supervisor");
        await setBranch(page, "Branch 1");
        const newOrder = await prepareC8NewOrder(page);
        await newOrder
          .getByRole("button", { name: "Save as draft", exact: true })
          .click();
        await expect(page).toHaveURL(/#orders\?id=/);
        const orderRoute = new URL(page.url()).hash.slice(1);
        // Requests has no seeded list record. Populate its real list without
        // inventing transfer, stock, receipt or financial evidence.
        const beforeRequest = await readC8State(page);
        await visitC8(page, "requests");
        await button(page, "New request", "درخواست جدید").click();
        await choose(
          page,
          field(page, "Sending location", "محل ارسال‌کننده"),
          "Warehouse",
        );
        await field(page, "Search products", "جستجوی کالا").fill("0003");
        await page
          .locator(".request-search-results")
          .getByRole("button", { name: "Add", exact: true })
          .click();
        await page
          .locator(".request-draft-line")
          .first()
          .getByLabel("Quantity", { exact: true })
          .fill("2");
        await button(page, "Save as draft", "ذخیره پیش‌نویس").click();
        await expect(page.locator(".request-detail")).toBeVisible();
        await expect
          .poll(async () => (await readC8State(page)).branch_requests?.length)
          .toBe(1);
        const requested = await readC8State(page);
        expect(requested.branch_requests![0]).toMatchObject({
          from_branch: "Branch 1",
          to_branch: "Warehouse",
          status: "draft",
        });
        expect(requested.ledger).toEqual(beforeRequest.ledger);
        expect(requested.stock_movements).toEqual(
          beforeRequest.stock_movements,
        );
        expect(requested.invoices).toEqual(beforeRequest.invoices);
        const shortReference = await prepareSupplierShorts(page);
        await setLanguage(page, language);
        const reports: Awaited<ReturnType<typeof inspectC8Layout>>[] = [];
        const inspect = async (scene: string, needsRows = false) => {
          const proof = await inspectC8Layout(page, scene, language, width);
          reports.push(proof);
          await info.attach("C8 actual layout: " + scene, {
            body: JSON.stringify(proof, null, 2),
            contentType: "application/json",
          });
          expect(proof.actualWidth).toBe(width);
          expect(proof.words, scene + ": actual text measured").toBeGreaterThan(
            0,
          );
          if (needsRows) {
            expect(
              proof.containment.tableCount,
              scene + ": actual table present",
            ).toBeGreaterThan(0);
            expect(
              proof.containment.rowCount,
              scene + ": actual populated rows measured",
            ).toBeGreaterThan(0);
          }
          expect(proof.failures, scene).toEqual([]);
        };
        for (const entry of pages) {
          await visitC8(page, entry.route);
          if (entry.route === "requests") {
            await page
              .getByRole("tab", {
                name: language === "en" ? "Outgoing" : "خروجی",
                exact: true,
              })
              .click();
            await choose(
              page,
              field(page, "Status", "وضعیت"),
              /^(All statuses|همه وضعیت‌ها)$/,
            );
            await choose(
              page,
              field(page.locator("main"), "Location", "محل"),
              /^(All locations|همه محل‌ها)$/,
            );
            await expect(
              page
                .locator("main .ui-data-table tbody > tr")
                .filter({ hasText: requested.branch_requests![0].reference }),
            ).toHaveCount(1);
          }
          await inspect(entry.route, entry.table);
          if (entry.route === "labels") {
            const rows = page.locator(".labels-product-table tbody tr");
            expect(await rows.count()).toBeGreaterThan(8);
            await rows.first().getByRole("checkbox").click();
            await rows.last().scrollIntoViewIfNeeded();
            await inspect("labels:last-row", true);
            const selection = page.locator(".labels-selection-bar");
            await expect(selection).toBeVisible();
            const frame = await selection.boundingBox();
            expect(frame).not.toBeNull();
            expect(frame!.y + frame!.height).toBeLessThanOrEqual(
              (await page.evaluate(() => window.innerHeight)) + 1,
            );
            if (width >= 760) {
              const sidebar = await page.locator(".sidebar").boundingBox();
              expect(sidebar).not.toBeNull();
              expect(sidebar!.y).toBeGreaterThanOrEqual(-1);
              expect(sidebar!.y).toBeLessThanOrEqual(1);
              expect(sidebar!.height).toBeCloseTo(
                await page.evaluate(() => window.innerHeight),
                0,
              );
            }
            await page.evaluate(() => window.scrollTo(0, 0));
          }
          if (entry.route === "suppliers?name=Fresh%20Valley%20Foods") {
            for (const [en, fa, needsRows] of [
              ["Invoices", "فاکتورها", true],
              ["Supplier items", "کالاهای تأمین‌کننده", true],
              ["Received", "دریافت‌شده‌ها", true],
              ["Returns and credits", "مرجوعی‌ها و اعتبارها", true],
              ["Shorts", "کسری‌ها", true],
              ["Price alerts", "هشدارهای قیمت", false],
              ["Payments", "پرداخت‌ها", false],
              ["Notes", "یادداشت‌ها", false],
            ] as const) {
              await page
                .locator(".supplier-tabs")
                .getByRole("tab", {
                  name: language === "en" ? en : fa,
                  exact: true,
                })
                .click();
              if (en === "Shorts")
                await expect(
                  page
                    .locator(".supplier-tab-card .ui-data-table tbody > tr")
                    .filter({ hasText: shortReference }),
                ).toHaveCount(1);
              await inspect("supplier:" + en, needsRows);
            }
          }
          if (entry.route === "offers") {
            await page
              .getByRole("tab", {
                name:
                  language === "en" ? "Mix-and-match pools" : "گروه‌های ترکیبی",
                exact: true,
              })
              .click();
            await inspect("offers:pools", true);
          }
          if (entry.route === "payables") {
            const row = page
              .locator(".payables-overview-table tbody > tr")
              .filter({ hasText: "Fresh Valley Foods" })
              .first();
            await row.locator(".table-row-link").click();
            await expect(page.locator(".payables-ledger-card")).toBeVisible();
            await inspect("payables:ledger", true);
          }
          if (width < 760 && entry.table) {
            const toggle = page.locator("main .table-details-toggle").first();
            if (await toggle.count()) {
              await toggle.click();
              await expect(
                page.locator("main .table-expanded-row").first(),
              ).toBeVisible();
              await inspect(entry.route + ":expanded", true);
            }
          }
        }
        await visitC8(page, orderRoute);
        await inspect("saved-order-detail", true);
        await visitC8(page, "invoices");
        await page
          .getByRole("tab", {
            name: language === "en" ? "Posted" : "ثبت‌شده",
            exact: true,
          })
          .click();
        await inspect("invoices:posted", true);
        await setLanguage(page, "en");
        await prepareC8ManualInvoice(page);
        await setLanguage(page, language);
        await inspect("invoices:expanded-manual-line", true);
        const editor = await openC8ProductEditor(page, "0006");
        await inspect("product-editor:top");
        await editor.locator(".product-date-editor").scrollIntoViewIfNeeded();
        await inspect("product-editor:dates");
        const path = info.outputPath("c8-all-pages-layout.json");
        await writeFile(path, JSON.stringify(reports, null, 2) + "\n");
        await info.attach(
          "C8 all-page actual containment and unchanged glyph/control guards",
          { path, contentType: "application/json" },
        );
      },
    );
