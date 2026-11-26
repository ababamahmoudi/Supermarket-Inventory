import { expect, test, type Page } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";
import { removeReceivingDemo, word } from "./r2-receiving-helpers";

/** Eight fictional review invoices give the list real neighbouring rows. */
async function importReviewInvoices(page: Page, language: "en" | "fa") {
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await setLanguage(page, language);
  await removeReceivingDemo(page, language);
  await page
    .getByLabel(word(language, "Choose file…", "انتخاب فایل…"), { exact: true })
    .setInputFiles("tests/fixtures/r2b-fictional-readings-export.json");
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: language === "fa" ? /^ورود \d+ فاکتور$/ : /^Import \d+ invoices?$/,
    })
    .click();
  await page
    .getByRole("dialog", {
      name: word(language, "Import complete", "ورود کامل شد"),
    })
    .getByText(word(language, "Open Needs review", "باز کردن نیازمند بررسی"), {
      exact: true,
    })
    .click();
  await expect(
    page.locator(".invoice-saved-table tbody tr").nth(2),
  ).toBeVisible();
}

for (const language of ["en", "fa"] as const) {
  test(`PR 29 invoice list headings, hover inset and row menu in ${language}`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "Desktop table geometry.");
    await importReviewInvoices(page, language);
    for (const width of [1440, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const report = await page.evaluate((rtl) => {
        const table = document.querySelector<HTMLTableElement>(
          ".invoice-saved-table table",
        )!;
        const contentEdges = (cell: HTMLElement) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const box = range.getBoundingClientRect();
          return { left: box.left, right: box.right };
        };
        const headings = Array.from(
          table.querySelectorAll<HTMLElement>("thead th"),
        );
        const rows = Array.from(
          table.querySelectorAll<HTMLElement>("tbody tr"),
        );
        const misaligned: string[] = [];
        headings.forEach((heading, index) => {
          const end = getComputedStyle(heading).textAlign === "end";
          const edge = (box: { left: number; right: number }) =>
            end !== rtl ? box.right : box.left;
          const headingEdge = edge(contentEdges(heading));
          for (const row of rows.slice(0, 3)) {
            const cell = row.children[index] as HTMLElement;
            const controls = cell.querySelector<HTMLElement>(
              ".invoice-queue-actions",
            );
            const valueEdge = edge(
              controls ? controls.getBoundingClientRect() : contentEdges(cell),
            );
            if (Math.abs(valueEdge - headingEdge) > 2)
              misaligned.push(
                `${heading.innerText}: ${headingEdge} vs ${valueEdge}`,
              );
          }
        });
        // Every neighbouring pair of visible values keeps a 24 px gap.
        const gaps = headings.slice(1).map((heading, index) => {
          const previous = headings[index].getBoundingClientRect();
          const current = heading.getBoundingClientRect();
          return Math.abs(
            rtl ? previous.left - current.right : current.left - previous.right,
          );
        });
        const padding = getComputedStyle(headings[1]);
        return {
          misaligned,
          cellGap:
            parseFloat(padding.paddingInlineStart) +
            parseFloat(padding.paddingInlineEnd),
          gaps,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      }, language === "fa");
      expect(report.misaligned, `${width}px`).toEqual([]);
      expect(report.cellGap).toBe(24);
      expect(report.overflow).toBe(false);

      const first = page.locator(".invoice-saved-table tbody tr").first();
      await first.hover();
      const inset = await first.evaluate((row) => {
        const box = row.getBoundingClientRect();
        const firstCell = row.firstElementChild as HTMLElement;
        const lastCell = row.lastElementChild as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(firstCell);
        const text = range.getBoundingClientRect();
        const controls = lastCell
          .querySelector(".invoice-queue-actions")!
          .getBoundingClientRect();
        const rtl = document.documentElement.dir === "rtl";
        return {
          start: rtl ? box.right - text.right : text.left - box.left,
          end: rtl ? controls.left - box.left : box.right - controls.right,
          fill: getComputedStyle(firstCell).backgroundColor,
        };
      });
      expect(inset.start).toBeGreaterThanOrEqual(16);
      expect(inset.end).toBeGreaterThanOrEqual(16);

      await first
        .getByRole("button", { name: word(language, "More", "بیشتر") })
        .click();
      const menu = page.getByRole("menu");
      await expect(
        menu.getByRole("menuitem", {
          name: word(language, "Open invoice", "باز کردن فاکتور"),
        }),
      ).toBeVisible();
      await expect(
        menu.getByRole("menuitem", {
          name: word(language, "Discard invoice", "کنار گذاشتن فاکتور"),
        }),
      ).toBeVisible();
      const menuBox = (await menu.boundingBox())!;
      const nextReview = (await page
        .locator(".invoice-saved-table tbody tr")
        .nth(1)
        .locator(".invoice-queue-primary-action")
        .boundingBox())!;
      const overlaps =
        menuBox.x < nextReview.x + nextReview.width &&
        nextReview.x < menuBox.x + menuBox.width &&
        menuBox.y < nextReview.y + nextReview.height &&
        nextReview.y < menuBox.y + menuBox.height;
      expect(overlaps).toBe(false);
      await page.keyboard.press("Escape");
    }
  });
}
