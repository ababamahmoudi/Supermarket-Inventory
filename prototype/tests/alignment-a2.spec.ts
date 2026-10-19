import { expect, test } from "@playwright/test";
import { setLanguage, signIn, uploadInvoice } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`table columns align and phone cards retain labelled contained values (${language})`, async ({
    page,
  }, testInfo) => {
    await signIn(page, "Supervisor");
    await setLanguage(page, language);
    const report: {
      route: string;
      tables: number;
      cells: number;
      maxError: number;
      cards: number;
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
        let cards = 0;
        const failures: string[] = [];
        const tables = [...main.querySelectorAll(".ui-data-table table")];
        for (const [tableIndex, table] of tables.entries()) {
          const headers = [
            ...table.querySelectorAll("thead tr:first-child th"),
          ];
          const stacked =
            getComputedStyle(table).display !== "table" &&
            headers.every(
              (header) => header.getBoundingClientRect().height === 0,
            );
          const labelledCard = table.closest(
            ".ui-data-table.is-mobile.is-responsive",
          );
          for (const [rowIndex, row] of [
            ...table.querySelectorAll("tbody tr"),
          ].entries()) {
            const compact = row.matches(".phone-list-row");
            if (
              !compact &&
              (row.children.length !== headers.length ||
                [...row.children].some(
                  (cell) => (cell as HTMLTableCellElement).colSpan > 1,
                ))
            )
              continue;
            if (stacked) {
              cards++;
              const bounds = row.getBoundingClientRect();
              if (compact) {
                // E3 replaces repeated label/value cards with explicit list
                // regions. Keep the same containment check on every cell.
                for (const region of [
                  "name",
                  "value",
                  "secondary",
                  "chevron",
                ]) {
                  const matches = row.querySelectorAll(
                    `:scope > .phone-list-${region}`,
                  );
                  const element = matches[0] as HTMLElement | undefined;
                  if (
                    matches.length !== 1 ||
                    !element ||
                    element.getBoundingClientRect().height <= 0 ||
                    (region !== "chevron" && !element.textContent?.trim())
                  )
                    failures.push(
                      `table ${tableIndex}, phone list ${rowIndex}: missing visible ${region}`,
                    );
                }
                if (
                  row.querySelectorAll(".phone-list-chevron .table-row-link")
                    .length !== 1
                )
                  failures.push(
                    `table ${tableIndex}, phone list ${rowIndex}: expected one record chevron`,
                  );
                if (row.querySelector(".table-details-toggle"))
                  failures.push(
                    `table ${tableIndex}, phone list ${rowIndex}: obsolete detail disclosure`,
                  );
                const selected = table.closest(".has-phone-selection");
                if (
                  selected &&
                  row.querySelectorAll(
                    ".phone-list-selection [role='checkbox']",
                  ).length !== 1
                )
                  failures.push(
                    `table ${tableIndex}, phone list ${rowIndex}: missing selection checkbox`,
                  );
              }
              for (const [columnIndex, cell] of [...row.children].entries()) {
                const rect = cell.getBoundingClientRect();
                const error = Math.max(
                  0,
                  bounds.left - rect.left,
                  rect.right - bounds.right,
                  cell.scrollWidth - cell.clientWidth,
                );
                maxError = Math.max(maxError, error);
                cells++;
                if (error > 2)
                  failures.push(
                    `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: containment ${error}px`,
                  );
                if (compact) {
                  if (
                    cell.getAttribute("data-column-label") ||
                    !["none", "normal"].includes(
                      getComputedStyle(cell, "::before").content,
                    )
                  )
                    failures.push(
                      `table ${tableIndex}, phone list ${rowIndex}: obsolete field caption`,
                    );
                  continue;
                }
                const label = cell.getAttribute("data-column-label");
                const headerLabel = headers[columnIndex].cloneNode(
                  true,
                ) as HTMLElement;
                for (const decoration of headerLabel.querySelectorAll(
                  '[aria-hidden="true"]',
                ))
                  decoration.remove();
                const expectedLabel = headerLabel.textContent
                  ?.replace(/\s+/g, " ")
                  .replace(/\s*[↑↓]$/, "")
                  .trim();
                if (expectedLabel && label !== expectedLabel)
                  failures.push(
                    `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: label ${label}/${expectedLabel}`,
                  );
                if (
                  columnIndex > 0 &&
                  label &&
                  labelledCard &&
                  getComputedStyle(cell, "::before").content !==
                    JSON.stringify(label)
                )
                  failures.push(
                    `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: missing visible ${label} label`,
                  );
                if (columnIndex > 0 && !labelledCard) {
                  const captionSelector =
                    "label,.invoice-line-price,.invoice-line-mobile-caption,.ui-checked-control";
                  const captions = [
                    ...(cell.matches(captionSelector) ? [cell] : []),
                    ...cell.querySelectorAll(captionSelector),
                  ];
                  if (
                    !captions.some(
                      (caption) => caption.getBoundingClientRect().height > 0,
                    )
                  )
                    failures.push(
                      `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: missing visible field or price caption`,
                    );
                  const totalCaption = cell.querySelector(
                    ".invoice-line-mobile-caption",
                  );
                  if (
                    totalCaption &&
                    totalCaption.textContent?.trim() !== expectedLabel
                  )
                    failures.push(
                      `table ${tableIndex}, phone card ${rowIndex}, column ${columnIndex}: caption ${totalCaption.textContent}/${expectedLabel}`,
                    );
                }
              }
              continue;
            }
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
        return { tables: tables.length, cells, cards, maxError, failures };
      });
      expect(metrics.failures, `${route} (${language})`).toEqual([]);
      expect(metrics.maxError).toBeLessThanOrEqual(2);
      if (path === "invoices") expect(metrics.cells).toBeGreaterThanOrEqual(30);
      report.push({
        route,
        tables: metrics.tables,
        cells: metrics.cells,
        maxError: metrics.maxError,
        cards: metrics.cards,
      });
    }
    expect(report.reduce((sum, item) => sum + item.cells, 0)).toBeGreaterThan(
      100,
    );
    if (page.viewportSize()!.width < 760)
      expect(report.reduce((sum, item) => sum + item.cards, 0)).toBeGreaterThan(
        0,
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
