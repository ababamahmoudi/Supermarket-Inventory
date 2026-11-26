import Decimal from "decimal.js";
import { expect, test, type Page } from "@playwright/test";
import { setBranch, signIn } from "./helpers";
import { createTotalsAlert } from "./pr29-dashboard-helpers";

test.setTimeout(120_000);

/** The light-theme --shadow-card Ali approved on 2026-11-20. */
const lightShadow =
  "0 1px 2px rgba(20,26,43,0.05), 0 6px 20px rgba(20,26,43,0.07)";

async function expectedShadow(page: Page) {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.boxShadow = value;
    document.body.append(probe);
    const computed = getComputedStyle(probe).boxShadow;
    probe.remove();
    return computed;
  }, lightShadow);
}

async function cardShadows(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((cards) =>
    cards.map((card) => {
      const style = getComputedStyle(card);
      return {
        shadow: style.boxShadow,
        border: style.borderTopWidth,
        radius: style.borderTopLeftRadius,
      };
    }),
  );
}

test.describe("PR 29 Dashboard, Suppliers, alert and sidebar", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Widths are set per test.");
    await page.goto("/");
    await signIn(page, "Manager");
  });

  test("Dashboard lists show 3 items, a Show all (N) bar and 24 px gaps", async ({
    page,
  }) => {
    await setBranch(page, "all");
    for (const width of [1440, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#dashboard");
      await expect(page.locator(".dashboard-approvals")).toBeVisible();
      // No View all links in the card headers.
      await expect(
        page.locator(".dashboard-card-header a, .dashboard-card-header button"),
      ).toHaveCount(0);
      const lists: [string, string, string][] = [
        [".dashboard-approvals", ".dashboard-queue-row", "#approvals"],
        [".dashboard-invoices", "tbody tr", "#invoices"],
        [
          ".price-update-dashboard-card",
          ".dashboard-task-row",
          "#price-updates",
        ],
        [".dashboard-alerts", ".dashboard-alert-row", "#alerts"],
        [".dashboard-notes", ".dashboard-list-row", "#notes"],
        [".dashboard-balances", ".dashboard-balance-row", "#payables"],
        [".dashboard-activity", ".dashboard-activity-item", "#history"],
      ];
      for (const [card, row, href] of lists) {
        const box = page.locator(card);
        const rows = await box.locator(row).count();
        expect(rows, card).toBeLessThanOrEqual(3);
        const bar = box.locator(".dashboard-show-all");
        await expect(bar, card).toHaveCount(1);
        await expect(bar).toHaveAttribute("href", href);
        const count = Number(await bar.getAttribute("data-count"));
        if (count > 0) await expect(bar).toHaveText(`Show all (${count})`);
        expect(rows).toBe(Math.min(3, count));
        // The bar is the last thing in its card and spans its full width.
        const geometry = await bar.evaluate((element) => {
          const card = element.parentElement!.getBoundingClientRect();
          const self = element.getBoundingClientRect();
          return [
            Math.round(Math.abs(self.left - card.left)),
            Math.round(Math.abs(card.right - self.right)),
            Math.round(Math.abs(card.bottom - self.bottom)),
          ];
        });
        expect(geometry, card).toEqual([0, 0, 0]);
      }
      // N equals the real totals shown elsewhere on the page.
      for (const card of [
        ".dashboard-approvals",
        ".price-update-dashboard-card",
        ".dashboard-alerts",
      ])
        expect(
          await page
            .locator(`${card} .dashboard-show-all`)
            .getAttribute("data-count"),
        ).toBe(await page.locator(`${card} .dashboard-count`).innerText());
      // Every gap between adjacent cards is 24 px ± 1.
      const gaps = await page.evaluate(() => {
        const rect = (element: Element) => element.getBoundingClientRect();
        const out: { where: string; gap: number }[] = [];
        for (const stack of document.querySelectorAll(
          ".dashboard-main, .dashboard-aside",
        )) {
          const items = Array.from(stack.children).filter(
            (child) => rect(child).height > 0,
          );
          for (let index = 1; index < items.length; index++)
            out.push({
              where: `${stack.className} ${index}`,
              gap: rect(items[index]).top - rect(items[index - 1]).bottom,
            });
        }
        const main = document.querySelector(".dashboard-main")!;
        const aside = document.querySelector(".dashboard-aside")!;
        const rtl = getComputedStyle(main).direction === "rtl";
        out.push({
          where: "columns",
          gap: rtl
            ? rect(main).left - rect(aside).right
            : rect(aside).left - rect(main).right,
        });
        const tiles = Array.from(
          document.querySelectorAll(".dashboard-kpis > *"),
        ).filter((tile) => rect(tile).height > 0);
        for (let index = 1; index < tiles.length; index++)
          if (Math.abs(rect(tiles[index]).top - rect(tiles[index - 1]).top) < 1)
            out.push({
              where: `tile ${index}`,
              gap: rect(tiles[index]).left - rect(tiles[index - 1]).right,
            });
        const pair = document.querySelector(".dashboard-purchase-pair");
        if (pair && pair.children.length === 2) {
          const [a, b] = Array.from(pair.children).map(rect);
          out.push({
            where: "purchase pair",
            gap:
              Math.abs(a.top - b.top) < 1 ? b.left - a.right : b.top - a.bottom,
          });
        }
        const kpis = document.querySelector(".dashboard-kpis")!;
        const layout = document.querySelector(".dashboard-layout")!;
        out.push({
          where: "tiles to cards",
          gap: rect(layout).top - rect(kpis).bottom,
        });
        return out;
      });
      for (const { where, gap } of gaps)
        expect(
          Math.abs(gap - 24),
          `${width} ${where} = ${gap}`,
        ).toBeLessThanOrEqual(1);
      // Supplier names in Recent invoices are blue links.
      if (width === 1440) {
        const supplierLink = page
          .locator(
            ".dashboard-invoices tbody td a.entity-link[href^='#suppliers']",
          )
          .first();
        await expect(supplierLink).toBeVisible();
        const [link, accent] = await supplierLink.evaluate((node) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--link-text)";
          document.body.append(probe);
          const value = getComputedStyle(probe).color;
          probe.remove();
          return [getComputedStyle(node).color, value];
        });
        expect(link).toBe(accent);
      }
      // Activity dates are YYYY-MM-DD, or a 24-hour time for today.
      for (const time of await page
        .locator(".dashboard-activity-time")
        .allInnerTexts())
        expect(time.trim()).toMatch(/^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2})$/);
      // Review is a filled tint button, Approve the filled primary; no outline.
      const buttons = await page
        .locator(".dashboard-inline-actions > .ui-button:not(.ui-menu-trigger)")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            text: node.textContent?.trim(),
            kind: node.className,
            outline: getComputedStyle(node).outlineStyle,
            border: getComputedStyle(node).borderTopWidth,
          })),
        );
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.outline).toBe("none");
        expect(button.border).toBe("0px");
        expect(button.kind).toContain(
          button.text === "Review" ? "button-tinted" : "button-primary",
        );
      }
    }
  });

  test("Suppliers headings stay on one line over their values", async ({
    page,
  }) => {
    for (const width of [1440, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#suppliers");
      await expect(
        page.locator(".suppliers-overview tbody tr").first(),
      ).toBeVisible();
      const result = await page.evaluate(() => {
        const table = document.querySelector(".suppliers-overview table")!;
        const headers = Array.from(table.querySelectorAll("thead th"));
        const labels = headers.map((th) =>
          th.querySelector(".table-header-label")!.getBoundingClientRect(),
        );
        const row = table.querySelector("tbody tr")!;
        const edges = headers.map((th, index) => {
          const cell = row.children[index] as HTMLElement;
          const align = getComputedStyle(th).textAlign;
          const end = align === "end" || align === "right";
          const range = document.createRange();
          range.selectNodeContents(cell);
          const value = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0,
          );
          const label = labels[index];
          if (!value.length || th.classList.contains("table-actions")) return 0;
          return end
            ? Math.abs(
                Math.max(...value.map((rect) => rect.right)) - label.right,
              )
            : Math.abs(
                Math.min(...value.map((rect) => rect.left)) - label.left,
              );
        });
        return {
          tops: labels.map((rect) => Math.round(rect.top)),
          heights: labels.map((rect) => Math.round(rect.height)),
          edges,
        };
      });
      expect(new Set(result.tops).size, `${width} tops`).toBe(1);
      expect(
        Math.max(...result.heights),
        `${width} one line`,
      ).toBeLessThanOrEqual(20);
      expect(Math.max(...result.edges), `${width} edges`).toBeLessThanOrEqual(
        2,
      );
    }
  });

  test("Supplier detail has one header action, level KPI values and no dash", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#suppliers?name=Corner%20Spice%20Co.");
    await expect(page.locator(".supplier-kpis")).toBeVisible();
    const header = page.locator(".supplier-detail-header .actions");
    await expect(header.locator(".supplier-profile-action")).toHaveText(
      "Complete profile",
    );
    await expect(
      header.getByRole("button", { name: "Edit", exact: true }),
    ).toHaveCount(0);
    // No empty button anywhere in the header.
    for (const label of await header
      .locator("button")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          (node.getAttribute("aria-label") ?? node.textContent ?? "").trim(),
        ),
      ))
      expect(label).not.toBe("");
    await expect(page.locator(".supplier-contact-heading")).not.toContainText(
      "Complete profile",
    );
    const baselines = await page
      .locator(".supplier-kpis .kpi-value")
      .evaluateAll((values) =>
        values.map((value) => {
          const probe = document.createElement("span");
          probe.style.cssText = "display:inline-block;width:0;height:0";
          value.append(probe);
          const bottom = probe.getBoundingClientRect().bottom;
          probe.remove();
          return bottom;
        }),
      );
    expect(Math.max(...baselines) - Math.min(...baselines)).toBeLessThanOrEqual(
      2,
    );
    // Contact details: a dense 4-column grid.
    const columns = await page
      .locator(".supplier-contact-grid")
      .evaluate(
        (grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      );
    expect(columns).toBe(4);
    for (const tab of ["Overview", "Invoices", "Supplier items", "Payments"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.locator("main")).not.toContainText("—");
    }
    // Once every contact detail is added, the same button says Edit.
    await page.locator(".supplier-profile-action").click();
    const editor = page.getByRole("dialog");
    for (const input of await editor.locator("input, textarea").all()) {
      const type = await input.getAttribute("type");
      if (type === "checkbox" || type === "file" || !(await input.isVisible()))
        continue;
      if (!(await input.inputValue()))
        await input.fill(
          type === "email" ? "orders@example.com" : "Fictional value",
        );
    }
    await editor.getByRole("combobox").first().click();
    await page.getByRole("option").nth(1).click();
    await editor.getByRole("button", { name: /^Save/ }).click();
    await expect(editor).toHaveCount(0);
    await expect(
      page.locator(".supplier-contact-grid .value-empty"),
    ).toHaveCount(0);
    await expect(page.locator(".supplier-profile-action")).toHaveText("Edit");
  });

  test("main cards share the soft shadow with no border at radius 20", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const want = await expectedShadow(page);
    for (const [route, selector] of [
      ["dashboard", ".r2c-dashboard .card, .dashboard-summary-tile"],
      ["invoices", "main .card"],
      [
        "suppliers?name=Corner%20Spice%20Co.",
        "main .card, .supplier-kpis .kpi-card",
      ],
      ["price-updates", "main .card"],
    ] as const) {
      await page.goto(`/#${route}`);
      await expect(page.locator(selector).first()).toBeVisible();
      const cards = await cardShadows(page, selector);
      expect(cards.length, route).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.shadow, route).toBe(want);
        expect(card.border, route).toBe("0px");
        expect(card.radius, route).toBe("20px");
      }
    }
  });

  test("the totals alert shows the four numbers and opens its invoice", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const created = await createTotalsAlert(page);
    await page.goto("/#alerts");
    const alert = page.locator(".totals-alert");
    await expect(alert).toBeVisible();
    await expect(alert.locator("h3")).toHaveText(
      `Invoice ${created.number} totals don't match`,
    );
    await expect(alert.locator("h3 a.entity-link")).toHaveAttribute(
      "href",
      `#invoices?id=${encodeURIComponent(created.id)}`,
    );
    await expect(
      alert.locator(".totals-alert-meta a.entity-link"),
    ).toBeVisible();
    await expect(alert.locator(".totals-alert-tags")).toHaveText(
      "Totals don't match",
    );
    const money = (value: Decimal) => `$${value.toFixed(2)}`;
    const difference = new Decimal(created.subtotal).minus(created.calculated);
    await expect(alert.locator('[data-stat="paper"]')).toContainText(
      money(new Decimal(created.subtotal)),
    );
    await expect(alert.locator('[data-stat="calculated"]')).toContainText(
      money(new Decimal(created.calculated)),
    );
    await expect(alert.locator('[data-stat="difference"]')).toContainText(
      money(difference),
    );
    await expect(alert.locator('[data-stat="tax-total"]')).toContainText(
      "$26.00",
    );
    await expect(alert.locator(".totals-alert-hint")).toHaveText(
      "Often a page that wasn't uploaded, or a line that was missed. Compare the lines with the paper, then use Correct invoice if something is missing.",
    );
    const actions = await alert
      .locator(".totals-alert-actions button")
      .allInnerTexts();
    expect(actions.map((text) => text.trim())).toEqual([
      "Open invoice",
      "Keep as pending",
      "Mark as taken care of",
    ]);
    await alert.getByRole("button", { name: "Open invoice" }).click();
    await expect(page).toHaveURL(
      new RegExp(`#invoices\\?id=${encodeURIComponent(created.id)}$`),
    );
    await expect(page.locator(".invoice-posted-workspace")).toBeVisible();
  });

  test("the alert says Tax doesn't match only when the tax is the difference", async ({
    page,
  }) => {
    await createTotalsAlert(page, { taxOnly: true });
    await page.goto("/#alerts");
    const alert = page.locator(".totals-alert");
    await expect(alert.locator(".totals-alert-tags")).toHaveText(
      "Tax doesn't match",
    );
    await expect(alert.locator('[data-stat="difference"]')).toContainText(
      "$0.00",
    );
  });

  test("sidebar hover and current-page highlights never touch", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#approvals");
    await page.locator('.sidebar nav a[href="#alerts"]').hover();
    const result = await page.evaluate(() => {
      const current = document.querySelector(
        '.sidebar nav a[aria-current="page"]',
      )!;
      const hovered = document.querySelector('.sidebar nav a[href="#alerts"]')!;
      const a = current.getBoundingClientRect();
      const b = hovered.getBoundingClientRect();
      return {
        gap: b.top > a.top ? b.top - a.bottom : a.top - b.bottom,
        current: getComputedStyle(current).backgroundColor,
        hovered: getComputedStyle(hovered).backgroundColor,
      };
    });
    expect(result.gap).toBeGreaterThanOrEqual(2);
    expect(result.hovered).not.toBe(result.current);
    await page.locator('.sidebar nav a[aria-current="page"]').hover();
    expect(
      await page
        .locator('.sidebar nav a[aria-current="page"]')
        .evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe(result.current);
  });
});
