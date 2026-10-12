import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { setBranch, setLanguage, signIn } from "./helpers";
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
        await setLanguage(page, language);
        const reports: Awaited<ReturnType<typeof inspectC8Layout>>[] = [];
        const inspect = async (scene: string, needsRows = false) => {
          const proof = await inspectC8Layout(page, scene, language, width);
          reports.push(proof);
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
              field(page, "Location", "محل"),
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
