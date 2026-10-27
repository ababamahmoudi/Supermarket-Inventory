import { expect, test, type Locator } from "@playwright/test";
import { signIn, setLanguage, chooseOption } from "./helpers";
import { fileURLToPath } from "node:url";
import {
  importReceivingFixture,
  openReceivingLine,
  word,
} from "./r2-receiving-helpers";

/** Measure actual rendered glyphs, rather than matching padded cell boxes. */
export async function numericEdges(table: Locator) {
  return table.evaluate((table) => {
    const visible = (node: Element) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(node).visibility !== "hidden"
      );
    };
    const edge = (element: Element) => {
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const parent = node.parentElement;
        if (
          !parent ||
          !visible(parent) ||
          parent.closest('[aria-hidden="true"],.sr-only,svg')
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(
          ...Array.from(range.getClientRects()).filter(
            (rect) => rect.width && rect.height,
          ),
        );
      }
      if (!rects.length) return null;
      const rtl = getComputedStyle(element).direction === "rtl";
      return rtl
        ? Math.min(...rects.map((rect) => rect.left))
        : Math.max(...rects.map((rect) => rect.right));
    };
    const errors: string[] = [];
    let checked = 0;
    const headers = Array.from(
      table.querySelectorAll<HTMLTableCellElement>("thead tr:first-child > th"),
    );
    for (const [index, header] of headers.entries()) {
      if (
        !visible(header) ||
        !header.matches('.numeric,[style*="text-align: end"]')
      )
        continue;
      if (header.matches(".table-actions")) continue;
      const caption = header.querySelector(".table-header-label") ?? header;
      const expected = edge(caption);
      if (expected === null) continue;
      for (const row of table.querySelectorAll<HTMLTableRowElement>(
        "tbody > tr:not(.table-expanded-row)",
      )) {
        const cell = row.cells[index];
        if (!cell || cell.colSpan > 1 || !visible(cell)) continue;
        const actual = edge(cell);
        if (actual === null) continue;
        checked++;
        const difference = Math.abs(expected - actual);
        if (difference > 1)
          errors.push(
            `${header.textContent?.trim()} / ${cell.textContent?.trim()}: ${difference.toFixed(2)}px`,
          );
      }
    }
    return { checked, errors };
  });
}

for (const lang of ["en", "fa"] as const) {
  test(`R2e B1 numeric table captions share their values' end edge (${lang})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1080 });
    await signIn(page, "Manager");
    await setLanguage(page, lang);
    const checked: Record<string, number> = {};
    for (const route of [
      "products",
      "labels",
      "received",
      "returns",
      "suppliers",
      "payables",
      "dashboard",
      "invoices",
      "approvals",
      "price-updates",
    ]) {
      await page.goto(`/#${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const [index, table] of (
        await page
          .locator(
            "main .ui-data-table:visible table,main .receiving-table:visible,dialog[open] .invoice-approval-table",
          )
          .all()
      ).entries()) {
        const result = await numericEdges(table);
        checked[`${route}-${index}`] = result.checked;
        expect(result.errors, `${route}/${index}`).toEqual([]);
      }
    }
    const source = fileURLToPath(
      new URL(
        "./fixtures/r2c-approval-fictional-readings-export.json",
        import.meta.url,
      ),
    );
    await importReceivingFixture(page, lang, undefined, undefined, source);
    const details = page.getByRole("button", {
      name: word(lang, "Expand invoice details", "باز کردن اطلاعات فاکتور"),
      exact: true,
    });
    if (await details.isVisible()) await details.click();
    await page
      .getByRole("button", {
        name: word(
          lang,
          "Looks right: Invoice details",
          "درست است: اطلاعات فاکتور",
        ),
        exact: true,
      })
      .click();
    for (let index = 0; index < 3; index++) {
      const editor = await openReceivingLine(page, index);
      await chooseOption(
        page,
        editor.locator(`#invoice-line-${index}-category`),
        "grocery",
        word(lang, "Grocery", "خواربار"),
      );
      await editor
        .getByRole("button", {
          name: word(lang, "Confirm line", "تأیید ردیف"),
          exact: true,
        })
        .click();
    }
    await page
      .getByRole("button", {
        name: word(lang, "Looks right: Totals", "درست است: جمع‌ها"),
        exact: true,
      })
      .click();
    await page
      .locator(".receiving-post-control:visible")
      .getByRole("button")
      .click();
    await page
      .getByRole("dialog", {
        name: word(lang, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .getByRole("button", {
        name: word(lang, "Post invoice", "ثبت فاکتور"),
        exact: true,
      })
      .click();
    await expect(page.locator(".posted-receiving")).toBeVisible();
    const posted = await numericEdges(
      page.locator(".posted-receiving .receiving-table"),
    );
    expect(posted.checked).toBeGreaterThanOrEqual(6);
    expect(posted.errors).toEqual([]);
    checked.postedInvoice = posted.checked;
    await page.goto("/#approvals");
    await page.locator(".approval-invoice-group").getByRole("button").click();
    const batch = page.getByRole("dialog", {
      name: word(lang, "Review invoice approvals", "بررسی تأییدهای فاکتور"),
      exact: true,
    });
    await expect(batch).toBeVisible();
    const batchEdges = await numericEdges(
      batch.locator(".invoice-approval-table"),
    );
    expect(batchEdges.checked).toBe(9);
    expect(batchEdges.errors).toEqual([]);
    checked.approvalDialog = batchEdges.checked;
    await batch
      .getByRole("button", {
        name: word(lang, "Approve 3 products", "تأیید 3 کالا"),
        exact: true,
      })
      .click();
    await expect(batch).not.toBeVisible();
    await page.goto("/#price-updates");
    await expect(page.locator(".price-updates-row").first()).toBeVisible();
    const priceEdges = await page
      .locator(".price-updates-list")
      .evaluate((list) => {
        const heading = list.querySelector(".price-updates-price-heading")!;
        const rtl = getComputedStyle(heading).direction === "rtl";
        const end = (el: Element) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = Array.from(range.getClientRects()).filter(
            (rect) => rect.width && rect.height,
          );
          return rtl
            ? Math.min(...rects.map((rect) => rect.left))
            : Math.max(...rects.map((rect) => rect.right));
        };
        const expected = end(heading);
        return Array.from(
          list.querySelectorAll(".price-updates-row > .price-update-change"),
        ).map((row) => Math.abs(end(row) - expected));
      });
    expect(priceEdges.length).toBeGreaterThan(0);
    expect(Math.max(...priceEdges)).toBeLessThanOrEqual(1);
    checked.priceUpdates = priceEdges.length;
    for (const family of [
      "products",
      "labels",
      "received",
      "returns",
      "suppliers",
      "payables",
      "dashboard",
    ])
      expect(
        Object.entries(checked).some(
          ([key, count]) => key.startsWith(`${family}-`) && count > 0,
        ),
        family,
      ).toBe(true);
    expect(
      Object.values(checked).reduce((sum, count) => sum + count, 0),
    ).toBeGreaterThan(50);
  });
}
