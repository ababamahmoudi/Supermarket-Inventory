import { expect, test } from "@playwright/test";
import { openShellAction } from "./helpers";
import { importReceivingFixture, word } from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`R2b retained reading counts stay visible and 25 closed lines stay compact in ${language} ${theme}`, async ({
      page,
    }, testInfo) => {
      const phone = testInfo.project.name === "phone";
      await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
      const invoice = await importReceivingFixture(page, language);
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            word(
              language,
              theme === "dark"
                ? "Switch to dark theme"
                : "Switch to light theme",
              theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
            ),
          )
        ).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const rows = page.locator('[data-testid^="invoice-line-row-"]');
      await expect(rows).toHaveCount(25);
      await expect(
        page.locator('[id^="invoice-line-"][id$="-name-en"]'),
      ).toHaveCount(0);
      const counts = invoice.lines.map(
        (line) => line.low_confidence_fields?.length ?? 0,
      );
      expect(counts.every((count) => count >= 3)).toBe(true);
      const statuses = rows.locator(".receiving-status-icon");
      // R2c uses a plain ! marker and keeps the numeric count in the grey text.
      await expect(statuses).toHaveText(counts.map(() => "!"));
      for (const [index, count] of counts.entries())
        await expect(
          rows.nth(index).locator(".receiving-line-check-count"),
        ).toContainText(
          word(language, `${count} to check`, `${count} برای بررسی`),
        );
      for (const [index, count] of counts.entries())
        await expect(statuses.nth(index)).toHaveAttribute(
          "aria-label",
          word(language, `${count} to check`, `${count} برای بررسی`),
        );
      const geometry = await page.evaluate(() => {
        const review = document.querySelector<HTMLElement>(
          '[data-testid="invoice-review"]',
        )!;
        return {
          review: review.getBoundingClientRect().height,
          document: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          rows: Array.from(
            review.querySelectorAll<HTMLElement>(".invoice-line-summary"),
          ).map((row) => row.getBoundingClientRect().height),
          counts: Array.from(
            review.querySelectorAll<HTMLElement>(".receiving-status-icon"),
          ).map((status) => {
            const rect = status.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(status);
            const glyph = range.getBoundingClientRect();
            return {
              text: status.textContent,
              fontSize: Number.parseFloat(getComputedStyle(status).fontSize),
              contained:
                glyph.width > 0 &&
                glyph.height > 0 &&
                glyph.left >= rect.left + 1 &&
                glyph.right <= rect.right - 1 &&
                glyph.top >= rect.top + 1 &&
                glyph.bottom <= rect.bottom - 1,
            };
          }),
        };
      });
      testInfo.annotations.push({
        type: "retained-count-layout",
        description: JSON.stringify(geometry),
      });
      expect(geometry.counts).toHaveLength(25);
      expect(geometry.counts.every((count) => count.contained)).toBe(true);
      expect(geometry.counts.every((count) => count.fontSize >= 12)).toBe(true);
      expect(geometry.rows.every((height) => height >= 44)).toBe(true);
      expect(geometry.overflow).toBe(false);
      if (!phone) {
        expect(geometry.review).toBeLessThanOrEqual(2700);
        expect(geometry.document).toBeLessThanOrEqual(2700);
      }
    });
  }
}
