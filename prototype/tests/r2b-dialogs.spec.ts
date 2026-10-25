import { expect, test } from "@playwright/test";
import { openShellAction, setLanguage, signIn } from "./helpers";
import { expectReceivingStable, word } from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`R2b 4.1 empty-store confirmation in ${language} ${theme}`, async ({
      page,
    }, testInfo) => {
      const phone = testInfo.project.name === "phone";
      await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
      await signIn(page, "Owner");
      await setLanguage(page, language);
      if (theme === "dark")
        await (
          await openShellAction(
            page,
            word(language, "Switch to dark theme", "تغییر به تم تیره"),
          )
        ).click();
      await page.goto("/#settings?group=data");
      await page
        .getByRole("navigation", {
          name: word(language, "Settings groups", "گروه‌های تنظیمات"),
          exact: true,
        })
        .getByRole("button", {
          name: word(language, "Data", "داده‌ها"),
          exact: true,
        })
        .click();
      for (const width of phone ? [390] : [1440, 1000]) {
        await page.setViewportSize({ width, height: 900 });
        await page
          .getByRole("button", {
            name: word(
              language,
              "Remove fictional data…",
              "حذف داده‌های خیالی…",
            ),
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog", {
          name: word(
            language,
            "Start with an empty store",
            "شروع با فروشگاه خالی",
          ),
          exact: true,
        });
        const input = dialog.getByRole("textbox", {
          name: word(
            language,
            "Type DELETE to confirm",
            "برای تأیید حذف را بنویسید",
          ),
          exact: true,
        });
        const remove = dialog.getByRole("button", {
          name: word(language, "Remove fictional data", "حذف داده‌های خیالی"),
          exact: true,
        });
        await expect(remove).toBeDisabled();
        await input.focus();
        await input.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        const geometry = await dialog.evaluate((element) => {
          const body = element.querySelector(".ui-dialog-body")!;
          const input = element.querySelector("input")!;
          const label = element.querySelector("label")!;
          const footer = element.querySelector(".ui-dialog-footer")!;
          const bounds = element.getBoundingClientRect();
          const inputBounds = input.getBoundingClientRect();
          return {
            width: bounds.width,
            left: bounds.left,
            right: bounds.right,
            bodyClearance:
              body.getBoundingClientRect().bottom - inputBounds.bottom,
            footerClearance:
              footer.getBoundingClientRect().top - inputBounds.bottom,
            labelSize: getComputedStyle(label).fontSize,
            labelWeight: getComputedStyle(label).fontWeight,
            phraseWeight: getComputedStyle(label.querySelector("strong")!)
              .fontWeight,
            listRows: Array.from(
              element.querySelectorAll(".invoice-empty-lists li > span"),
              (item) => ({
                height: item.getBoundingClientRect().height,
                lineHeight: parseFloat(getComputedStyle(item).lineHeight),
              }),
            ),
          };
        });
        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(width);
        if (!phone) {
          expect(geometry.width).toBeGreaterThanOrEqual(600);
          for (const row of geometry.listRows)
            expect(row.height).toBeLessThanOrEqual(row.lineHeight + 1);
        }
        expect(geometry.bodyClearance).toBeGreaterThanOrEqual(4);
        expect(geometry.footerClearance).toBeGreaterThanOrEqual(4);
        expect(geometry.labelSize).toBe("13px");
        expect(Number(geometry.labelWeight)).toBeGreaterThanOrEqual(600);
        expect(Number(geometry.phraseWeight)).toBeGreaterThanOrEqual(700);
        const disabledStyle = await remove.evaluate((element) => {
          const style = getComputedStyle(element);
          const probe = document.createElement("span");
          probe.style.backgroundColor = "var(--danger)";
          document.body.append(probe);
          const danger = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            fill: style.backgroundColor,
            opacity: Number(style.opacity),
            danger,
          };
        });
        expect(disabledStyle.fill).toBe(disabledStyle.danger);
        expect(disabledStyle.opacity).toBeGreaterThan(0);
        expect(disabledStyle.opacity).toBeLessThan(1);
        await dialog.screenshot({
          path: testInfo.outputPath(`empty-store-${width}.png`),
        });
        await expectReceivingStable(page, remove, () =>
          input.fill(word(language, "DELETE", "حذف")),
        );
        await expect(remove).toBeEnabled();
        expect(
          await remove.evaluate((element) => getComputedStyle(element).opacity),
        ).toBe("1");
        await dialog
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
        await expect(dialog).toHaveCount(0);
      }
    });
  }
}
