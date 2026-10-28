import {
  configuredRoleLabel,
  readConfiguredRoleDefinitions,
} from "../src/role-config";
import { expect, test, type Page } from "@playwright/test";
import { openShellAction, setLanguage, signIn, uploadInvoice } from "./helpers";
import { inspect, settled } from "../scripts/c5-browser-proof.mjs";
import configuration from "../../seed/arzon-config.json" with { type: "json" };
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function visibleGeometry(page: Page, route: string) {
  await page.goto(`/#${route}`);
  await expect(page.locator("main h1")).toBeVisible();
  return page
    .locator(".filter-toolbar")
    .first()
    .evaluate((toolbar) => {
      const controlSelectors =
        "input:not([type=hidden]),button,.ui-checked-control";
      const controls = [
        ...toolbar.querySelectorAll<HTMLElement>(controlSelectors),
      ].filter((control) => control.getBoundingClientRect().height > 0);
      const selects = [
        ...toolbar.querySelectorAll<HTMLElement>(".ui-select"),
      ].map((select) => {
        const label = select.querySelector<HTMLElement>(
          "span:not(.select-sizing)",
        )!;
        const range = document.createRange();
        range.selectNodeContents(label);
        return {
          name:
            select.getAttribute("aria-label") ??
            select.getAttribute("aria-labelledby"),
          text: label.textContent,
          textWidth: range.getBoundingClientRect().width,
          width: label.getBoundingClientRect().width,
          textOverflow: getComputedStyle(label).textOverflow,
          whiteSpace: getComputedStyle(label).whiteSpace,
        };
      });
      const searches = [...toolbar.querySelectorAll<HTMLInputElement>("input")]
        .filter(
          (input) =>
            /search|جستجو|جست‌وجو/i.test(
              input.getAttribute("aria-label") ??
                input.getAttribute("aria-labelledby") ??
                "",
            ) || input.type === "search",
        )
        .map((input) => ({
          placeholder: input.placeholder,
          icon:
            Boolean(input.parentElement?.querySelector("svg")) ||
            getComputedStyle(input).backgroundImage !== "none",
        }));
      return {
        controls: controls.map((control) => ({
          name: control.getAttribute("aria-label") ?? control.textContent,
          height: control.getBoundingClientRect().height,
          kind: control.matches("input,.ui-input,.ui-checked-control")
            ? "field"
            : control.closest(".ui-segments")
              ? "choice"
              : control.getAttribute("data-control-kind"),
          small: control.classList.contains("button-sm"),
          iconOnly: control.classList.contains("ui-icon-button"),
        })),
        selects,
        searches,
      };
    });
}

for (const language of ["en", "fa"] as const) {
  test(`list filter controls retain their scoped height, readable choices and compact spacing in ${language}`, async ({
    page,
    isMobile,
  }) => {
    await signIn(page, "Supervisor");
    if (language === "fa") await setLanguage(page, "fa");
    for (const route of ["products", "offers", "expiry", "returns", "notes"]) {
      const geometry = await visibleGeometry(page, route);
      expect(geometry.controls.length, route).toBeGreaterThan(0);
      if (route === "offers")
        await expect(
          page.locator(
            'main > [data-r2c-screen="offers"] .current-offers-table',
          ),
        ).toBeVisible();
      for (const control of geometry.controls) {
        expect(
          ["field", "action", "icon", "choice"],
          `${route}: ${control.name} has a defined control kind`,
        ).toContain(control.kind);
        // R2e B5 shares a 44px filter row; its segmented track contains
        // 36px choices. Every other scoped control keeps the 44px target.
        const expectedHeight = control.kind === "choice" ? 36 : 44;
        expect(
          Math.abs(control.height - expectedHeight),
          `${route}: ${control.name}`,
        ).toBeLessThanOrEqual(1);
      }
      for (const select of geometry.selects) {
        expect(
          select.textWidth,
          `${route}: ${select.text}`,
        ).toBeLessThanOrEqual(select.width + 1);
        expect(select.whiteSpace).toBe("nowrap");
      }
      for (const control of await page
        .locator(".filter-toolbar")
        .first()
        .getByRole("combobox")
        .all()) {
        if (!(await control.isEnabled())) continue;
        await control.click();
        const options = page.getByRole("option");
        const labels = await options.allTextContents();
        const longest = labels.reduce(
          (result, label) => (label.length > result.length ? label : result),
          "",
        );
        await options.filter({ hasText: longest }).first().click();
        const bounds = await control.evaluate((element) => {
          const label = element.querySelector("span:not(.select-sizing)")!;
          const range = document.createRange();
          range.selectNodeContents(label);
          return {
            text: label.textContent,
            textWidth: range.getBoundingClientRect().width,
            width: label.getBoundingClientRect().width,
          };
        });
        expect(
          bounds.textWidth,
          `${route}: longest choice ${bounds.text}`,
        ).toBeLessThanOrEqual(bounds.width + 1);
      }
      expect(geometry.searches.length, `${route} search`).toBeGreaterThan(0);
      for (const search of geometry.searches) {
        expect(search.placeholder.trim(), route).not.toBe("");
        expect(search.icon, `${route} search icon`).toBe(true);
      }
    }
    await page.goto("/#products");
    await expect(page.locator(".catalog-products-table")).toBeVisible();
    await settled(page);
    const spacing = await page
      .locator(".catalog-filter-toolbar")
      .evaluate((toolbar) => {
        const table = document.querySelector(".catalog-products-table")!;
        const card = table.closest(".ui-card")!;
        const cardBounds = card.getBoundingClientRect();
        const toolbarBounds = toolbar.getBoundingClientRect();
        const tableBounds = table.getBoundingClientRect();
        const cardStyle = getComputedStyle(card);
        const visible = (element: Element) =>
          element.getBoundingClientRect().width > 1 &&
          element.getBoundingClientRect().height > 1;
        const headers = [...table.querySelectorAll("thead th")].filter(visible);
        const row = table.querySelector("tbody tr:not(.table-expanded-row)")!;
        const cells = [
          ...row.querySelectorAll(":scope > th,:scope > td"),
        ].filter(visible);
        const firstCell = cells[0];
        const firstCellBounds = firstCell.getBoundingClientRect();
        const text = document.createRange();
        text.selectNodeContents(firstCell);
        const textBounds = text.getBoundingClientRect();
        const firstCellStyle = getComputedStyle(firstCell);
        return {
          // C9 keeps filters inside the list card, with 20px below the
          // toolbar and a separate 12px gap between wrapped controls.
          toolbarInsideCard: card.contains(toolbar),
          gap: tableBounds.top - toolbarBounds.bottom,
          controlWrapGap: parseFloat(getComputedStyle(toolbar).rowGap),
          toolbarTopInset: toolbarBounds.top - cardBounds.top,
          cardPadding: parseFloat(cardStyle.paddingBlockStart),
          horizontalInsets: [
            toolbarBounds.left - cardBounds.left,
            cardBounds.right - toolbarBounds.right,
            tableBounds.left - cardBounds.left,
            cardBounds.right - tableBounds.right,
          ],
          cardHorizontalPadding: [
            parseFloat(cardStyle.paddingLeft),
            parseFloat(cardStyle.paddingRight),
          ],
          tableBottomInset: cardBounds.bottom - tableBounds.bottom,
          firstCellTextInsets: [
            textBounds.left - firstCellBounds.left,
            firstCellBounds.right - textBounds.right,
          ],
          firstCellPadding: [
            parseFloat(firstCellStyle.paddingLeft),
            parseFloat(firstCellStyle.paddingRight),
          ],
          columnCount: cells.length,
          columns: headers.map((header, index) => {
            const bounds = header.getBoundingClientRect();
            const cell = cells[index];
            const cellBounds = cell.getBoundingClientRect();
            const headerStyle = getComputedStyle(header);
            const cellStyle = getComputedStyle(cell);
            return {
              leftDifference: Math.abs(bounds.left - cellBounds.left),
              rightDifference: Math.abs(bounds.right - cellBounds.right),
              paddingDifference: Math.max(
                Math.abs(
                  parseFloat(headerStyle.paddingInlineStart) -
                    parseFloat(cellStyle.paddingInlineStart),
                ),
                Math.abs(
                  parseFloat(headerStyle.paddingInlineEnd) -
                    parseFloat(cellStyle.paddingInlineEnd),
                ),
              ),
            };
          }),
        };
      });
    expect(spacing.toolbarInsideCard).toBe(true);
    expect(spacing.gap).toBeGreaterThanOrEqual(0);
    expect(spacing.gap).toBeCloseTo(20, 0);
    expect(spacing.controlWrapGap).toBeCloseTo(12, 0);
    expect(spacing.toolbarTopInset).toBeGreaterThanOrEqual(
      spacing.cardPadding - 1,
    );
    for (const [index, inset] of spacing.horizontalInsets.entries())
      expect(inset).toBeCloseTo(spacing.cardHorizontalPadding[index % 2], 0);
    expect(spacing.tableBottomInset).toBeGreaterThanOrEqual(0);
    for (const [index, inset] of spacing.firstCellTextInsets.entries())
      expect(inset).toBeGreaterThanOrEqual(spacing.firstCellPadding[index] - 1);
    expect(spacing.columnCount).toBeGreaterThan(0);
    if (!isMobile) {
      expect(spacing.columns).toHaveLength(spacing.columnCount);
      for (const column of spacing.columns) {
        expect(column.leftDifference).toBeLessThanOrEqual(1);
        expect(column.rightDifference).toBeLessThanOrEqual(1);
        expect(column.paddingDifference).toBeLessThanOrEqual(1);
      }
    }
    const { toolbarGroups } = await inspect(page, "Products", language);
    expect(toolbarGroups).toHaveLength(1);
    for (const group of toolbarGroups) {
      expect(
        group.gap,
        `${language}: count beside Columns`,
      ).toBeGreaterThanOrEqual(-0.5);
      expect(
        group.gap,
        `${language}: count beside Columns`,
      ).toBeLessThanOrEqual(16.5);
      expect(group.centerDifference).toBeLessThanOrEqual(1);
    }
  });
}

test("Part 1 pills and dashboard branch values stay on one line", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  for (const route of ["expiry", "dashboard"]) {
    await page.goto(`/#${route}`);
    await expect(page.locator("main h1")).toBeVisible();
    await settled(page);
    const pills = await page.locator("main .ui-badge").evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent,
        whiteSpace: getComputedStyle(element).whiteSpace,
      })),
    );
    for (const pill of pills)
      expect(pill.whiteSpace, pill.text ?? "pill").toBe("nowrap");
  }
  const invoices = page.locator(".dashboard-invoices");
  await expect(invoices.locator("tbody tr").first()).toBeVisible();
  // Recent invoices use one genuine record destination; the full invoice
  // presents Branch when the responsive summary omits its column.
  await expect(invoices.locator(".table-details-toggle")).toHaveCount(0);
  const branchCells = await page.locator(".dashboard-invoices").evaluate(
    (card, branchNames) => {
      const compactRows = [...card.querySelectorAll("tr.phone-list-row")];
      const compactBranches = compactRows.map((row) =>
        [...row.querySelectorAll(".phone-list-secondary > span")].filter(
          (value) => branchNames.includes(value.textContent?.trim() ?? ""),
        ),
      );
      const values = [
        ...card.querySelectorAll('tbody td[data-column-key="branch"]'),
        ...[...card.querySelectorAll(".table-expanded-row dl > div")]
          .filter(
            (group) => group.querySelector("dt")?.textContent === "Branch",
          )
          .map((group) => group.querySelector("dd")!),
        ...compactBranches.flat(),
      ];
      return {
        compactBranchCounts: compactBranches.map((values) => values.length),
        values: values.map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return {
            text: cell.textContent,
            visible:
              cell.getBoundingClientRect().width > 0 &&
              cell.getBoundingClientRect().height > 0,
            lineCount: new Set(
              [...range.getClientRects()].map((rect) => Math.round(rect.top)),
            ).size,
          };
        }),
      };
    },
    configuration.branches.map((branch) => branch.name),
  );
  if (branchCells.values.length === 0) {
    const canonical = await readCanonicalBusinessEvidence(page);
    const routes = await invoices
      .locator("tbody tr[data-row-href]")
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-row-href")!),
      );
    expect(routes.length).toBeGreaterThan(0);
    for (const href of routes) {
      await page.goto("/#dashboard");
      const row = invoices.locator(`tr[data-row-href="${href}"]`);
      await expect(row.locator(".table-row-link")).toHaveCount(1);
      await expect(row.locator(".dashboard-invoice-reference")).toHaveAttribute(
        "href",
        href,
      );
      const id = new URLSearchParams(href.split("?")[1]).get("id");
      const invoice = [canonical.invoice, ...(canonical.invoices ?? [])].find(
        (item) => item.id === id,
      );
      expect(invoice?.status).toBe("posted");
      let location = invoice!.branch;
      for (const correction of canonical.invoice_location_corrections ?? [])
        if (
          correction.company_id === invoice!.company_id &&
          correction.invoice_id === invoice!.id &&
          correction.from_branch === location
        )
          location = correction.to_branch;
      const expectedBranch = canonical.config.branches.find(
        (branch) => branch.id === location,
      )?.name_en;
      expect(expectedBranch).toBeTruthy();
      await row.locator(".table-row-link").click();
      await expect(page).toHaveURL((url) => url.hash === href);
      const branch = page
        .locator(`[data-invoice-id="${id}"] .posted-invoice-header > div`)
        .filter({ has: page.getByText("Location", { exact: true }) })
        .locator("dd");
      await expect(branch).toHaveText(expectedBranch!);
      branchCells.values.push(
        await branch.evaluate((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return {
            text: cell.textContent,
            visible:
              cell.getBoundingClientRect().width > 0 &&
              cell.getBoundingClientRect().height > 0,
            lineCount: new Set(
              [...range.getClientRects()].map((rect) => Math.round(rect.top)),
            ).size,
          };
        }),
      );
    }
  }
  for (const count of branchCells.compactBranchCounts) expect(count).toBe(1);
  expect(branchCells.values.length).toBeGreaterThan(0);
  for (const cell of branchCells.values) {
    expect(configuration.branches.map((branch) => branch.name)).toContain(
      cell.text?.trim(),
    );
    expect(cell.visible, cell.text ?? "branch").toBe(true);
    expect(cell.lineCount, cell.text ?? "branch").toBeLessThanOrEqual(1);
  }
});

test("R2 invoice names and four-decimal cost values fit on one line", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await uploadInvoice(page);
  await expect(page.locator(".invoice-line")).toHaveCount(6);
  await expect(
    page.locator(".invoice-line-toggle .receiving-product-name > bdi"),
  ).toHaveCount(6);
  const names = await page
    .locator(".invoice-line-toggle .receiving-product-name > bdi")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rects = [...range.getClientRects()];
        return {
          text: element.textContent,
          lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
        };
      }),
    );
  expect(names.length).toBeGreaterThan(0);
  for (const name of names)
    expect(name.lines, name.text ?? "product name").toBe(1);
  const costs = page.locator(
    ".receiving-cost-cell > bdi:visible, .receiving-phone-cost > bdi:first-child:visible",
  );
  await expect(costs).toHaveCount(6);
  for (const cost of await costs.all()) {
    await expect(cost).toHaveText(/\$\d+\.\d{4}$/);
    const lines = await cost.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(
        [...range.getClientRects()].map((rect) => Math.round(rect.top)),
      ).size;
    });
    expect(lines).toBe(1);
  }
});

test("Part 1 purchase charts show calendar weeks, hover/focus amounts and content-height desktop cards", async ({
  page,
}, testInfo) => {
  await signIn(page, "Supervisor");
  await page.goto("/#dashboard");
  const chart = page.locator(".dashboard-purchases").filter({
    has: page.getByRole("heading", {
      name: "Purchases by week",
      exact: true,
    }),
  });
  await expect(chart.locator(".purchase-week-totals")).toHaveCount(0);
  await expect(chart.locator(".purchase-week-column time")).toHaveCount(8);
  await expect(
    chart.locator(".purchase-week-column time").last(),
  ).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}/);
  const point = chart.locator(".purchase-point").last();
  await point.focus();
  await expect(chart.getByRole("tooltip")).toContainText("$");
  await expect(chart.getByRole("tooltip")).toContainText(/\d{4}-\d{2}-\d{2}/);
  await page
    .getByRole("heading", {
      name: `${configuredRoleLabel(readConfiguredRoleDefinitions(configuration.roles), "manager", "en")} dashboard`,
      exact: true,
    })
    .click();
  await expect(chart.getByRole("tooltip")).toHaveCount(0);
  await point.hover();
  await expect(chart.getByRole("tooltip")).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const cards = await page
      .locator(".dashboard-purchases")
      .evaluateAll((cards) =>
        cards.map((card) => ({
          height: card.getBoundingClientRect().height,
          alignSelf: getComputedStyle(card).alignSelf,
        })),
      );
    expect(cards).toHaveLength(2);
    expect(
      cards.every((card) => card.height > 0 && card.alignSelf === "start"),
    ).toBe(true);
  }
});

test("Part 1 Open return exposes pickup and cancellation, then resolution after pickup, with the normal title size", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-1");
  const detail = page.locator(".return-detail");
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Record pickup", exact: true }),
  ).toHaveCount(1);
  await expect(
    detail.getByRole("button", { name: "Cancel return", exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Record resolution", exact: true }),
  ).toHaveCount(0);
  const titleStyle = await detail.locator("h1").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      size: parseFloat(style.fontSize),
      lineHeight: parseFloat(style.lineHeight),
      weight: Number(style.fontWeight),
    };
  });
  expect(titleStyle).toEqual({ size: 30, lineHeight: 36, weight: 800 });
  await detail
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  const form = page.locator(".return-action-card");
  await form
    .getByLabel("Actual pickup quantity", { exact: true })
    .first()
    .fill("1");
  await form
    .getByLabel("Shortfall reason", { exact: true })
    .fill("Rep accepted one item today");
  await form.getByLabel("Leftover outcome", { exact: true }).click();
  await page
    .getByRole("option", { name: "Keep for next pickup", exact: true })
    .click();
  await form
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Receiving representative");
  await form
    .getByLabel("Signed paper pickup slip reference", { exact: true })
    .fill("PICKUP-B-POLISH");
  await form
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await expect(
    detail.getByRole("button", { name: "Record resolution", exact: true }),
  ).toBeVisible();
});

test("Part 1 approval headers are complete and sortable Products headers and back links use shared styling", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#approvals");
  await page
    .getByRole("button", { name: "Approve price", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Review approval",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(720.5);
  const effects = dialog.locator(".approval-scope-preview");
  await expect(effects.locator("li")).toHaveCount(1);
  await expect(effects).toContainText("North York");
  await expect(effects).toContainText("Richmond Hill");
  await expect(effects).toContainText("Newmarket");
  await expect(effects).not.toContainText("Warehouse");
  await expect(effects).not.toContainText("Override removed");
  const geometry = await effects.evaluate((wrapper) => {
    const bounds = wrapper.getBoundingClientRect();
    return Array.from(
      wrapper.querySelectorAll("li, strong, .approval-effect-price, .badge"),
    )
      .map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return Array.from(range.getClientRects()).map((rect) => ({
          left: rect.left,
          right: rect.right,
          panelLeft: bounds.left,
          panelRight: bounds.right,
        }));
      })
      .flat();
  });
  for (const rect of geometry) {
    expect(rect.left).toBeGreaterThanOrEqual(rect.panelLeft - 1);
    expect(rect.right).toBeLessThanOrEqual(rect.panelRight + 1);
  }
  await page.keyboard.press("Escape");
  await page.goto("/#products");
  const productHeader = page
    .locator(".catalog-products-table th button")
    .first();
  const style = await productHeader.evaluate((element) => ({
    font: parseFloat(getComputedStyle(element).fontSize),
    color: getComputedStyle(element).color,
    muted: getComputedStyle(document.documentElement)
      .getPropertyValue("--text-muted")
      .trim(),
    text: element.textContent,
  }));
  expect(style.font).toBe(12);
  expect(style.text).toMatch(/[↑↓]/);
  expect(style.color).toBe("rgb(90, 96, 112)");
  await page.goto("/#product?code=0001");
  await expect(
    page
      .getByRole("link", { name: "Back to Products", exact: true })
      .locator("svg"),
  ).toBeVisible();
  await page.goto("/#return?id=demo-return-1");
  await expect(
    page
      .getByRole("link", { name: "Back to Returns", exact: true })
      .locator("svg"),
  ).toBeVisible();
});

test("Part 1 demo disclaimer appears inside Demo and only invoice AI reading remains in page copy", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  for (const route of ["offers", "payables"]) {
    await page.goto(`/#${route}`);
    await expect(page.locator("main")).not.toContainText(
      /Fictional branch supplier balances|Nothing is paid through this demo|Demo suggestions|No real AI is running/,
    );
  }
  await (await openShellAction(page, "Demo")).click();
  await expect(
    page.getByRole("menu", { name: "Demo", exact: true }),
  ).toContainText("Demo with fictional data");
  await page.keyboard.press("Escape");
  await expect(page.locator("main")).not.toContainText(
    "Demo with fictional data",
  );
  await page.goto("/#invoices");
  await page.getByRole("tab", { name: /^Drafts \d+$/, exact: false }).click();
  await expect(page.locator("main")).toContainText(
    "AI invoice reading is simulated",
  );
  await page
    .locator(".invoice-saved-table tbody tr td:first-child a")
    .first()
    .click();
  await expect(page.locator("main")).not.toContainText(
    "AI invoice reading is simulated",
  );
});
