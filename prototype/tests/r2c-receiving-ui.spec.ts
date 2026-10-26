import { expect, test } from "@playwright/test";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import { importReceivingFixture, word } from "./r2-receiving-helpers";
for (const language of ["en", "fa"] as const) {
  test(`R2c 0.12 invoice choices are four equal reachable tiles in ${language}`, async ({
    page,
  }, info) => {
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#invoices");
    for (const width of info.project.name === "phone" ? [390] : [1440, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"] as const) {
        if ((await page.locator("html").getAttribute("data-theme")) !== theme)
          await (
            await openShellAction(
              page,
              word(
                language,
                `Switch to ${theme} theme`,
                theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
              ),
            )
          ).click();
        await page
          .getByRole("button", {
            name: word(language, "New invoice", "فاکتور جدید"),
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog", {
          name: word(language, "New invoice", "فاکتور جدید"),
          exact: true,
        });
        await expect(dialog.locator(".invoice-entry-choice-tile")).toHaveCount(
          4,
        );
        await page.evaluate(() => document.fonts.ready);
        const geometry = await dialog.evaluate((element) => ({
          tiles: Array.from(
            element.querySelectorAll<HTMLElement>(".invoice-entry-choice-tile"),
            (tile) => {
              const rect = tile.getBoundingClientRect();
              return {
                x: rect.x,
                y: rect.y,
                right: rect.right,
                bottom: rect.bottom,
                w: rect.width,
                h: rect.height,
                overflow: tile.scrollWidth - tile.clientWidth,
                icon: !!tile.querySelector("svg"),
                title: !!tile.querySelector("strong"),
                description: !!tile.querySelector("span"),
              };
            },
          ),
          footer: !!element.querySelector(".ui-dialog-footer button"),
          pageOverflow: document.documentElement.scrollWidth - innerWidth,
        }));
        expect(geometry.footer).toBe(true);
        expect(geometry.pageOverflow).toBeLessThanOrEqual(1);
        for (const tile of geometry.tiles) {
          expect(Math.abs(tile.w - geometry.tiles[0].w)).toBeLessThanOrEqual(2);
          expect(Math.abs(tile.h - geometry.tiles[0].h)).toBeLessThanOrEqual(2);
          expect(tile.x).toBeGreaterThanOrEqual(0);
          expect(tile.right).toBeLessThanOrEqual(width);
          expect(tile.overflow).toBeLessThanOrEqual(1);
          expect(tile.icon && tile.title && tile.description).toBe(true);
        }
        if (width < 760)
          for (let i = 1; i < 4; i++)
            expect(
              geometry.tiles[i].y - geometry.tiles[i - 1].bottom,
            ).toBeGreaterThanOrEqual(10);
        else {
          expect(
            Math.abs(geometry.tiles[0].y - geometry.tiles[1].y),
          ).toBeLessThanOrEqual(2);
          expect(
            geometry.tiles[2].y - geometry.tiles[0].bottom,
          ).toBeGreaterThanOrEqual(10);
        }
        await expect(
          dialog.getByText(
            word(
              language,
              "AI reading is simulated in this demo",
              "خوانش هوش مصنوعی در این دمو شبیه‌سازی شده است",
            ),
          ),
        ).toBeVisible();
        await dialog.screenshot({
          path: info.outputPath(
            `invoice-choices-${language}-${width}-${theme}.png`,
          ),
        });
        await dialog
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
      }
    }
  });
  test(`R2c 0.1 0.4 0.6 0.14 receiving states stay clear in ${language}`, async ({
    page,
  }, info) => {
    await importReceivingFixture(page, language);
    await page.setViewportSize({
      width: info.project.name === "phone" ? 390 : 1440,
      height: 1000,
    });
    const post = page.locator(
      info.project.name === "phone"
        ? ".receiving-mobile-post button"
        : ".receiving-desktop-post button",
    );
    await expect(post).toHaveAttribute("aria-disabled", "true");
    await expect(post).toHaveClass(/button-neutral/);
    await expect(post).toHaveCSS("cursor", "not-allowed");
    for (const theme of ["light", "dark"] as const) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await (
          await openShellAction(
            page,
            word(
              language,
              `Switch to ${theme} theme`,
              theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
            ),
          )
        ).click();
      const row = page.getByTestId("invoice-line-row-0");
      const geometry = await row.evaluate((element) => {
        const rowRect = element.getBoundingClientRect();
        const centers = Array.from(
          element.querySelectorAll<HTMLElement>(
            ".receiving-status-number,.receiving-quantity-cell,.receiving-cost-cell,.receiving-total-cell",
          ),
          (cell) => ({
            align: getComputedStyle(cell).verticalAlign,
            center:
              cell.getBoundingClientRect().y +
              cell.getBoundingClientRect().height / 2,
          }),
        );
        const first = element.querySelector("td")!,
          last = element.querySelector("td:last-child")!;
        const probe = document.createElement("span");
        probe.style.backgroundColor =
          "color-mix(in srgb, var(--pending-dot) 8%, var(--surface))";
        element.append(probe);
        const expected = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          center: rowRect.y + rowRect.height / 2,
          centers,
          rowFill: getComputedStyle(element).backgroundColor,
          cellFill: getComputedStyle(first).backgroundColor,
          expected,
          firstRadius: getComputedStyle(first).borderStartStartRadius,
          lastRadius: getComputedStyle(last).borderEndEndRadius,
        };
      });
      if (info.project.name !== "phone") {
        expect(geometry.rowFill).toBe("rgba(0, 0, 0, 0)");
        expect(geometry.firstRadius).toBe("12px");
        expect(geometry.lastRadius).toBe("12px");
        for (const cell of geometry.centers)
          expect(Math.abs(cell.center - geometry.center)).toBeLessThanOrEqual(
            2,
          );
      }
      if (theme === "dark" && info.project.name !== "phone")
        expect(geometry.cellFill).toBe(geometry.expected);
      const text = await page.getByTestId("invoice-review").innerText();
      expect(text).not.toMatch(
        /\b(?:branch_hint|private_reader_key|delivery_reference)\b/,
      );
    }
  });
}
