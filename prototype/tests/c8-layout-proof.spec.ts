import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import Decimal from "decimal.js";
import {
  invoiceImage,
  openInvoiceLine,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
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
  { route: "notes?entry=demo-deli-temperature-1", table: false },
  { route: "settings?group=modules", table: false },
] as const;

async function setReviewLanguage(page: Page, language: "en" | "fa") {
  if ((await page.locator("html").getAttribute("lang")) === language) return;
  const fullScreen = (page.viewportSize()?.width ?? 1440) <= 760;
  const editor = page.locator("#invoice-line-0-detail");
  const reopen = fullScreen && (await editor.isVisible());
  if (reopen) await button(editor, "Close", "بستن").click();
  await setLanguage(page, language);
  if (reopen) await openInvoiceLine(page, 0);
}

async function prepareSupplierShorts(page: Page) {
  const before = await readC8State(page);
  await prepareC8ManualInvoice(page);
  await field(page, "Invoice number").fill("C8-QA-SHORT-LAYOUT");
  const manualId = (await readC8State(page)).invoice.id;
  // A real manual fixture carries its own clearly fictional original and passes
  // the normal receiving gates. No saved invoice or stock record is injected.
  await field(page, "Attach original").setInputFiles({
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
  await expect(button(page, "Save and close")).toBeEnabled();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  const line = await openInvoiceLine(page, 0);
  await expect(line).toContainText("0002");
  await choose(page, field(line, "Unit"), "Units");
  const cost = (await readC8State(page)).invoice.lines[0].unit_cost_before_tax;
  await field(line, "Invoiced units").fill("6");
  await expect
    .poll(async () => (await readC8State(page)).invoice.lines[0].qty_invoiced)
    .toBe(6);
  await expect(field(line, "Invoiced units")).toHaveValue("6");
  await field(line, "Delivered units").fill("2");
  await expect
    .poll(
      async () =>
        (await readC8State(page)).invoice.lines[0].qty_received_at_posting,
    )
    .toBe(2);
  await expect(field(line, "Delivered units")).toHaveValue("2");
  await button(line, "Report short or refused").click();
  await field(line, "Short units").fill("4");
  await expect(line).toContainText(`4 units × $${cost}`);
  await expect(line).toContainText(new Decimal(cost).times(4).toFixed(2));
  await button(line, "Apply").click();
  await expect(field(line, "Delivered units")).toHaveValue("2");
  await line
    .getByRole("group", { name: "Track date", exact: true })
    .getByRole("button", { name: "No", exact: true })
    .click();
  await button(line, "Confirm line").click();
  await expect(page.locator(".invoice-line")).toHaveAttribute(
    "data-expanded",
    "false",
  );
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

for (const language of ["en", "fa"] as const) {
  test(`C8 receiving retains short money, controls and RTL layout (${language})`, async ({
    page,
  }, info) => {
    const width = info.project.name === "phone" ? 390 : 1440;
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await signIn(page, "Supervisor");
    await setBranch(page, "Branch 1");
    const reference = await prepareSupplierShorts(page);
    await setLanguage(page, language);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      reference,
    );
    const posted = await inspectC8Layout(
      page,
      "receiving:posted-short",
      language,
      width,
    );
    expect(posted.actualWidth).toBe(width);
    expect(posted.words).toBeGreaterThan(0);
    expect(posted.failures).toEqual([]);
    await setLanguage(page, "en");
    await prepareC8ManualInvoice(page);
    await setReviewLanguage(page, language);
    if (width <= 760)
      await button(
        page.locator("#invoice-line-0-detail"),
        "Close",
        "بستن",
      ).click();
    const titleReference = page.locator("h1 .invoice-title-reference");
    await expect(titleReference).toHaveText("C8-QA-CONTAINMENT");
    expect(
      await titleReference.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const rects: DOMRect[] = [];
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          rects.push(
            ...[...range.getClientRects()].filter(
              (rect) => rect.width > 0.1 && rect.height > 0.1,
            ),
          );
        }
        const width = document.documentElement.clientWidth;
        return {
          lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
          contained: rects.every(
            (rect) => rect.left >= -1 && rect.right <= width + 1,
          ),
          pageContained: document.documentElement.scrollWidth <= width + 1,
        };
      }),
    ).toEqual({ lines: 1, contained: true, pageContained: true });
    const openedEditor = await openInvoiceLine(page, 0);
    const nameInput = openedEditor.locator("#invoice-line-0-name-en");
    if (width <= 760) await nameInput.scrollIntoViewIfNeeded();
    else
      await nameInput.evaluate((element) =>
        element.scrollIntoView({ block: "start" }),
      );
    await expect(nameInput).toBeInViewport();
    const expanded = await inspectC8Layout(
      page,
      "receiving:manual-editor",
      language,
      width,
    );
    expect(expanded.actualWidth).toBe(width);
    expect(expanded.words).toBeGreaterThan(0);
    expect(expanded.containment.tableCount).toBe(1);
    expect(expanded.containment.rowCount).toBeGreaterThan(0);
    expect(expanded.containment.editorCount).toBe(1);
    const editorProof = expanded.forms.find((form: { className: string }) =>
      form.className.includes("receiving-line-editor"),
    );
    expect(editorProof).toBeDefined();
    expect(editorProof!.words).toBeGreaterThan(0);
    expect(editorProof!.controls).toBeGreaterThan(0);
    expect(expanded.failures).toEqual([]);
    if (width === 1440 && language === "en") {
      await button(page.locator("#invoice-line-0-detail"), "Close").click();
      const name = page
        .getByTestId("invoice-line-row-0")
        .locator(".receiving-product-name");
      const original = await name.evaluate((element) => {
        const original = {
          title: element.getAttribute("title"),
          style: element.getAttribute("style"),
        };
        (element as HTMLElement).style.inlineSize = "16px";
        return original;
      });
      try {
        const ellipsis = await inspectC8Layout(
          page,
          "receiving:full-title-ellipsis",
          language,
          width,
        );
        expect(ellipsis.failures).toEqual([]);
        await name.evaluate((element) => element.removeAttribute("title"));
        const missingTitle = await inspectC8Layout(
          page,
          "receiving:missing-full-title",
          language,
          width,
        );
        expect(
          missingTitle.failures.some((failure: string) =>
            failure.startsWith("Receiving text leaves cell:"),
          ),
        ).toBe(true);
      } finally {
        await name.evaluate((element, original) => {
          for (const [key, value] of Object.entries(original)) {
            if (value === null) element.removeAttribute(key);
            else element.setAttribute(key, value);
          }
        }, original);
      }
      expect(
        (
          await inspectC8Layout(
            page,
            "receiving:restored-title",
            language,
            width,
          )
        ).failures,
      ).toEqual([]);
    }
  });
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
          field(page, "Ask this location", "درخواست از این مکان"),
          "Warehouse",
        );
        await field(
          page,
          "Add a product, or type an item that isn't in the catalog",
          "کالایی اضافه کنید یا نام موردی خارج از فهرست را بنویسید",
        ).fill("0003");
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
          if (scene === "invoices:expanded-manual-line") {
            expect(proof.containment.editorCount).toBe(1);
            const editorProof = proof.forms.find(
              (form: { className: string }) =>
                form.className.includes("receiving-line-editor"),
            );
            expect(editorProof).toBeDefined();
            expect(editorProof!.words).toBeGreaterThan(0);
            expect(editorProof!.controls).toBeGreaterThan(0);
          }
          expect(proof.failures, scene).toEqual([]);
        };
        for (const entry of pages) {
          await visitC8(page, entry.route);
          if (entry.route === "requests") {
            await page
              .getByRole("tab", {
                name:
                  language === "en"
                    ? /^Outgoing(?:\s+\d+)?$/
                    : /^خروجی(?:\s+[\d۰-۹]+)?$/,
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
          if (entry.route === "notes?entry=demo-deli-temperature-1") {
            await expect(
              page.locator('[data-notebook-entry="demo-deli-temperature-1"]'),
            ).toBeVisible();
            await expect(
              page.getByRole("button", {
                name: language === "en" ? "Edit notebook" : "ویرایش دفترچه",
                exact: true,
              }),
            ).toBeVisible();
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
            name: language === "en" ? /^Posted\s+\d+$/ : /^ثبت‌شده\s+[\d۰-۹]+$/,
          })
          .click();
        await inspect("invoices:posted", true);
        await setLanguage(page, "en");
        await prepareC8ManualInvoice(page);
        await setReviewLanguage(page, language);
        const invoiceEditor = await openInvoiceLine(page, 0);
        const invoiceName = invoiceEditor.locator("#invoice-line-0-name-en");
        if (width === 900)
          await invoiceName.evaluate((element) =>
            element.scrollIntoView({ block: "start" }),
          );
        else await invoiceName.scrollIntoViewIfNeeded();
        await expect(invoiceName).toBeInViewport();
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
