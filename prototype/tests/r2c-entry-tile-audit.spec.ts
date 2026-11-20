import { expect, test } from "@playwright/test";
import { inspect } from "../scripts/c5-browser-proof.mjs";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import { word } from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2c 0.12 source-tile audit keeps a narrow contract in ${language}`, async ({
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
        const report = () =>
          inspect(
            page,
            "Invoice source choices",
            `${language}-${width}-${theme}`,
            "owner",
          );
        const positive = await report();
        expect(positive.failures).toEqual([]);
        expect(
          positive.buttons.filter((entry) => entry.kind === "source-tile"),
        ).toHaveLength(4);
        if (language === "en" && theme === "light") {
          const tile = dialog.locator(".invoice-entry-choice-tile").first();
          const original = await tile.getAttribute("style");
          for (const [property, value, failure] of [
            ["minHeight", "32px", "height"],
            ["width", "200px", "width or containment"],
            ["borderRadius", "4px", "radius"],
          ] as const) {
            await tile.evaluate(
              (element, { property, value }) => {
                element.style[property] = value;
              },
              { property, value },
            );
            expect(
              (await report()).failures.some((entry: string) =>
                entry.startsWith(`Invoice source tile ${failure}:`),
              ),
            ).toBe(true);
            await tile.evaluate(
              (element, original) =>
                original === null
                  ? element.removeAttribute("style")
                  : element.setAttribute("style", original),
              original,
            );
          }
          const title = tile.locator("strong");
          await title.evaluate((element) => {
            element.style.color = getComputedStyle(
              element.closest("button")!,
            ).backgroundColor;
          });
          expect(
            (await report()).failures.some((entry: string) =>
              entry.startsWith("Invoice source tile text contrast:"),
            ),
          ).toBe(true);
          await title.evaluate((element) => element.removeAttribute("style"));
          const last = dialog.locator(".invoice-entry-choice-tile").last();
          await last.evaluate((element) => {
            element.setAttribute("hidden", "");
          });
          expect((await report()).failures).toContain(
            "Invoice source tiles need the exact four-choice dialog composition",
          );
          await last.evaluate((element) => {
            element.removeAttribute("hidden");
          });
          await tile.evaluate((element) => {
            const fake = element.cloneNode(true) as HTMLElement;
            fake.id = "r2c-counterfeit-source-tile";
            fake.setAttribute("aria-label", "Counterfeit source tile");
            element.closest(".ui-dialog-body")!.append(fake);
          });
          const counterfeit = await report();
          expect(
            counterfeit.buttons.find(
              (entry) => entry.label === "Counterfeit source tile",
            )?.kind,
          ).toBe("action");
          expect(
            counterfeit.failures.some((entry: string) =>
              entry.includes("Counterfeit source tile"),
            ),
          ).toBe(true);
          await dialog
            .locator("#r2c-counterfeit-source-tile")
            .evaluate((element) => element.remove());
          expect((await report()).failures).toEqual([]);
        }
        await dialog
          .getByRole("button", {
            name: word(language, "Cancel", "انصراف"),
            exact: true,
          })
          .click();
      }
    }
  });
}
