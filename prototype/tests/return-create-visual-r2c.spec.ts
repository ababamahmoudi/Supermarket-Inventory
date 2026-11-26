import { expect, test } from "@playwright/test";
import {
  fillReturnCreation,
  installReturnCreationFixture,
} from "./return-create-r2c-helpers";
import { openShellAction, setLanguage } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
for (const width of [1440, 1000, 390])
  for (const lang of ["en", "fa"] as const)
    for (const theme of ["light", "dark"] as const) {
      test(`R2c7.1 new return ${width} ${lang} ${theme} has finished stable fields and bounded layout`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await installReturnCreationFixture(page);
        await setLanguage(page, lang);
        if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
          const name =
            lang === "fa"
              ? theme === "dark"
                ? "تغییر به تم تیره"
                : "تغییر به تم روشن"
              : theme === "dark"
                ? "Switch to dark theme"
                : "Switch to light theme";
          await (await openShellAction(page, name)).click();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const before = await readCanonicalBusinessEvidence(page);
        const dialog = await fillReturnCreation(page, lang === "fa");
        const quantity = dialog.locator("#new-return-quantity");
        const handle = await quantity.elementHandle();
        const geometry = () =>
          quantity.evaluate((node) => {
            const body = node.closest(".ui-dialog-body")!;
            const r = node.getBoundingClientRect(),
              b = body.getBoundingClientRect();
            return {
              x: r.x - b.x,
              y: r.y - b.y + body.scrollTop,
              width: r.width,
              height: r.height,
            };
          });
        const original = await geometry();
        await quantity.fill("");
        await quantity.pressSequentially("12", { delay: 2 });
        await dialog.locator("#new-return-note").fill("");
        await dialog
          .locator("#new-return-note")
          .pressSequentially(
            lang === "fa"
              ? "یادداشت آزمایشی مرجوعی"
              : "Fast typed fictional return note",
            { delay: 2 },
          );
        const after = await geometry();
        for (const key of ["x", "y", "width", "height"] as const)
          expect(Math.abs(after[key] - original[key])).toBeLessThanOrEqual(2);
        expect(
          await quantity.evaluate((node, old) => node === old, handle),
        ).toBe(true);
        await dialog
          .getByLabel(
            lang === "fa" ? "انتخاب عکس‌های مرجوعی" : "Choose return photos",
            { exact: true },
          )
          .setInputFiles("tests/fixtures/r2c-fictional-return-condition.png");
        await expect(dialog.getByRole("status")).toHaveText(
          lang === "fa" ? "1 عکس ذخیره شد" : "1 photo saved",
        );
        const measurements = await dialog.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const fields = [
            ...node.querySelectorAll<HTMLElement>(
              ".new-return-grid input:not([type=file]),.new-return-grid textarea,.new-return-grid [role=combobox]",
            ),
          ].filter((field) => field.getClientRects().length);
          const footer = node
            .querySelector(".ui-dialog-footer")!
            .getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            x: box.x,
            y: box.y,
            pageOverflow:
              document.documentElement.scrollWidth > window.innerWidth + 1,
            fields: fields.map((field) => ({
              height: field.getBoundingClientRect().height,
              width: field.getBoundingClientRect().width,
              fieldWidth: field.closest(".field")!.getBoundingClientRect()
                .width,
              overflow: field.scrollWidth > field.clientWidth + 1,
            })),
            footerBottom: footer.bottom,
            viewportHeight: window.innerHeight,
          };
        });
        expect(measurements.pageOverflow).toBe(false);
        expect(measurements.fields.length).toBeGreaterThanOrEqual(7);
        expect(measurements.fields.every((field) => field.height >= 44)).toBe(
          true,
        );
        for (const field of measurements.fields)
          expect(Math.abs(field.width - field.fieldWidth)).toBeLessThanOrEqual(
            2,
          );
        expect(measurements.footerBottom).toBeLessThanOrEqual(
          measurements.viewportHeight + 1,
        );
        if (width === 390) {
          expect(measurements.width).toBe(390);
          expect(measurements.height).toBe(900);
          expect(measurements.x).toBe(0);
          expect(measurements.y).toBe(0);
        } else expect(measurements.width).toBe(780);
        await dialog.locator(".ui-dialog-body").evaluate((node) => {
          node.scrollTop = 0;
        });
        await dialog.screenshot({
          path: testInfo.outputPath(
            `new-return-${width}-${lang}-${theme}-top.png`,
          ),
        });
        await dialog.locator(".new-return-photos").scrollIntoViewIfNeeded();
        await dialog.screenshot({
          path: testInfo.outputPath(
            `new-return-${width}-${lang}-${theme}-photos.png`,
          ),
        });
        await dialog
          .getByRole("button", {
            name: lang === "fa" ? "انصراف" : "Cancel",
            exact: true,
          })
          .click();
        await expect(dialog).toHaveCount(0);
        const unchanged = await readCanonicalBusinessEvidence(page);
        expect(unchanged.returns).toEqual(before.returns);
        expect(unchanged.ledger).toEqual(before.ledger);
        expect(unchanged.stock).toEqual(before.stock);
        expect(unchanged.products).toEqual(before.products);
        expect(errors).toEqual([]);
      });
    }
