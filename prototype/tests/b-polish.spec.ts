import { expect, test, type Page } from "@playwright/test";
import { setLanguage, signIn, uploadInvoice } from "./helpers";

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
        })),
        selects,
        searches,
      };
    });
}

for (const language of ["en", "fa"] as const) {
  test(`Part 1 filter controls are 44px, readable, searchable and compact in ${language}`, async ({
    page,
  }) => {
    await signIn(page, "Supervisor");
    if (language === "fa") await setLanguage(page, "fa");
    for (const route of ["products", "offers", "expiry", "returns", "notes"]) {
      const geometry = await visibleGeometry(page, route);
      expect(geometry.controls.length, route).toBeGreaterThan(0);
      for (const control of geometry.controls)
        expect(
          Math.abs(control.height - 44),
          `${route}: ${control.name}`,
        ).toBeLessThanOrEqual(1);
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
    const gap = await page
      .locator(".catalog-filter-toolbar")
      .evaluate(
        (toolbar) =>
          document
            .querySelector(".catalog-products-table")!
            .getBoundingClientRect().top -
          toolbar.getBoundingClientRect().bottom,
      );
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(24);
  });
}

test("Part 1 pills and dashboard branch values stay on one line", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  for (const route of ["expiry", "dashboard"]) {
    await page.goto(`/#${route}`);
    const pills = await page.locator("main .ui-badge").evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent,
        whiteSpace: getComputedStyle(element).whiteSpace,
      })),
    );
    for (const pill of pills)
      expect(pill.whiteSpace, pill.text ?? "pill").toBe("nowrap");
  }
  const branchCells = await page
    .locator(".dashboard-invoices tbody tr")
    .evaluateAll((rows) =>
      rows
        .map((row) =>
          [...row.querySelectorAll("td")].find((cell) =>
            /Branch \d+/.test(cell.textContent ?? ""),
          ),
        )
        .filter(Boolean)
        .map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell!);
          return {
            text: cell!.textContent,
            lineCount: new Set(
              [...range.getClientRects()].map((rect) => Math.round(rect.top)),
            ).size,
          };
        }),
    );
  expect(branchCells.length).toBeGreaterThan(0);
  for (const cell of branchCells)
    expect(cell.lineCount, cell.text ?? "branch").toBeLessThanOrEqual(1);
});

test("Part 1 invoice names and approved-price notes fit on one line", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await uploadInvoice(page);
  await expect(page.locator(".invoice-line")).toHaveCount(6);
  const names = await page
    .locator(".invoice-line-toggle .product-name strong")
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
  await page.locator(".invoice-line-toggle").first().click();
  const note = page
    .locator(".invoice-line-price .muted")
    .filter({ hasText: /^Approved:/ })
    .first();
  await expect(note).toBeVisible();
  await expect(note).toContainText("$");
  const lines = await note.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return new Set(
      [...range.getClientRects()].map((rect) => Math.round(rect.top)),
    ).size;
  });
  expect(lines).toBe(1);
});

test("Part 1 purchase charts show week dates and hover/focus amounts with equal-height desktop cards", async ({
  page,
}, testInfo) => {
  await signIn(page, "Supervisor");
  await page.goto("/#dashboard");
  const chart = page.locator(".dashboard-purchases").filter({
    has: page.getByRole("heading", {
      name: "Purchases, last 8 weeks",
      exact: true,
    }),
  });
  await expect(chart.locator(".purchase-week-totals")).toHaveCount(0);
  await expect(chart.locator(".purchase-week-labels")).toContainText(
    /\d{4}-\d{2}-\d{2}/,
  );
  const point = chart.locator(".purchase-point").last();
  await point.focus();
  await expect(chart.getByRole("tooltip")).toContainText("$");
  await expect(chart.getByRole("tooltip")).toContainText(/\d{4}-\d{2}-\d{2}/);
  await page
    .getByRole("heading", { name: "Supervisor dashboard", exact: true })
    .click();
  await expect(chart.getByRole("tooltip")).toHaveCount(0);
  await point.hover();
  await expect(chart.getByRole("tooltip")).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const heights = await page
      .locator(".dashboard-purchases")
      .evaluateAll((cards) =>
        cards.map((card) => card.getBoundingClientRect().height),
      );
    expect(heights).toHaveLength(2);
    expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(2);
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
  expect(
    await detail
      .locator("h1")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBe(24);
  await detail
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  const form = page.locator(".return-action-card");
  await form
    .getByLabel(/Actual pickup units/)
    .first()
    .fill("1");
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
}, testInfo) => {
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
  const geometry = await dialog
    .locator(".approval-scope-preview")
    .evaluate((wrapper) => {
      const header = wrapper.querySelector("th:last-child")!;
      const range = document.createRange();
      range.selectNodeContents(header);
      const bounds = header.getBoundingClientRect();
      return {
        overflow: getComputedStyle(header).textOverflow,
        text: header.textContent,
        rangeRight: range.getBoundingClientRect().right,
        cellRight: bounds.right,
        cellLeft: bounds.left,
        wrapperRight: wrapper.getBoundingClientRect().right,
      };
    });
  expect(geometry.text).toBe("Override removed");
  expect(geometry.overflow).not.toBe("ellipsis");
  expect(geometry.rangeRight).toBeLessThanOrEqual(geometry.cellRight + 1);
  if (testInfo.project.name === "desktop")
    expect(geometry.cellRight).toBeLessThanOrEqual(geometry.wrapperRight + 1);
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
  expect(style.font).toBe(13);
  expect(style.text).toMatch(/[↑↓]/);
  expect(style.color).toBe("rgb(102, 102, 102)");
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
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await expect(page.getByRole("menu")).toContainText(
    "Demo with fictional data",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("main")).not.toContainText(
    "Demo with fictional data",
  );
  await page.goto("/#invoices");
  await expect(page.locator("main")).toContainText(
    "AI invoice reading is simulated",
  );
});
