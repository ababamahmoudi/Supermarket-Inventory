import { expect, test } from "@playwright/test";
import { setLanguage, signIn, uploadInvoice } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`every table header and body cell aligns within two pixels (${language})`, async ({
    page,
  }, testInfo) => {
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    const report: {
      route: string;
      tables: number;
      cells: number;
      maxError: number;
    }[] = [];
    for (const route of [
      "products",
      "alerts",
      "product?code=0009",
      "returns",
      "return?id=demo-return-1",
      "suppliers",
      "suppliers?name=Fresh%20Valley%20Foods",
      "suppliers?name=Fresh%20Valley%20Foods|Invoices|فاکتورها",
      "suppliers?name=Fresh%20Valley%20Foods|Supplier items|کالاهای تأمین‌کننده",
      "suppliers?name=Fresh%20Valley%20Foods|Returns and credits|مرجوعی‌ها و اعتبارها",
      "suppliers?name=Fresh%20Valley%20Foods|Payments|پرداخت‌ها",
      "expiry",
      "offers",
      "payables",
      "settings",
      "dashboard",
      "labels",
      "invoices",
    ]) {
      const [path, englishTab, persianTab] = route.split("|");
      await page.goto(`/#${path}`);
      await expect(page.locator("main h1")).toBeVisible();
      if (path === "invoices") {
        await setLanguage(page, "en");
        await uploadInvoice(page);
        await setLanguage(page, language);
        await expect(page.locator(".invoice-line")).toHaveCount(6);
      }
      if (englishTab) {
        await page
          .getByRole("tab", {
            name: language === "en" ? englishTab : persianTab,
            exact: true,
          })
          .click();
        await expect(
          page.locator(".supplier-tab-card .ui-data-table tbody tr").first(),
        ).toBeVisible();
      }
      const metrics = await page.locator("main").evaluate((main) => {
        let cells = 0;
        let maxError = 0;
        const failures: string[] = [];
        const tables = [...main.querySelectorAll(".ui-data-table table")];
        for (const [tableIndex, table] of tables.entries()) {
          const headers = [
            ...table.querySelectorAll("thead tr:first-child th"),
          ];
          for (const [rowIndex, row] of [
            ...table.querySelectorAll("tbody tr"),
          ].entries()) {
            if (
              row.children.length !== headers.length ||
              [...row.children].some(
                (cell) => (cell as HTMLTableCellElement).colSpan > 1,
              )
            )
              continue;
            for (const [columnIndex, header] of headers.entries()) {
              const cell = row.children[columnIndex];
              const h = header.getBoundingClientRect();
              const b = cell.getBoundingClientRect();
              const hs = getComputedStyle(header);
              const bs = getComputedStyle(cell);
              const error = Math.max(
                Math.abs(h.left - b.left),
                Math.abs(h.right - b.right),
              );
              maxError = Math.max(maxError, error);
              cells++;
              if (
                error > 2 ||
                hs.paddingInlineStart !== bs.paddingInlineStart ||
                hs.paddingInlineEnd !== bs.paddingInlineEnd ||
                hs.textAlign !== bs.textAlign
              )
                failures.push(
                  `table ${tableIndex}, row ${rowIndex}, column ${columnIndex}: edges ${error}px; alignment ${hs.textAlign}/${bs.textAlign}; padding ${hs.paddingInlineStart}/${bs.paddingInlineStart}`,
                );
            }
          }
        }
        return { tables: tables.length, cells, maxError, failures };
      });
      expect(metrics.failures, `${route} (${language})`).toEqual([]);
      expect(metrics.maxError).toBeLessThanOrEqual(2);
      if (path === "invoices") expect(metrics.cells).toBeGreaterThanOrEqual(30);
      report.push({
        route,
        tables: metrics.tables,
        cells: metrics.cells,
        maxError: metrics.maxError,
      });
    }
    expect(report.reduce((sum, item) => sum + item.cells, 0)).toBeGreaterThan(
      100,
    );
    await testInfo.attach(`alignment-${language}.json`, {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
  });
}

test("product editor is centered with focus trapped, Escape and backdrop restore focus", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#product?code=0009");
  const trigger = page.getByRole("button", {
    name: "Edit Potato Chips 150 g",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const metrics = await dialog.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return {
      x: Math.abs(r.x + r.width / 2 - innerWidth / 2),
      y: Math.abs(r.y + r.height / 2 - innerHeight / 2),
      focused: node.contains(document.activeElement),
    };
  });
  expect(metrics.x).toBeLessThanOrEqual(2);
  expect(metrics.y).toBeLessThanOrEqual(2);
  expect(metrics.focused).toBe(true);
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
