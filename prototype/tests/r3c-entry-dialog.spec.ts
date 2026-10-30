import { expect, test, type Locator } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { openShellAction, setBranch, setLanguage, signIn } from "./helpers";
import { t } from "./r3-live-reading-helpers";

async function fit(dialog: Locator) {
  return dialog.evaluate((element) => {
    const failures: string[] = [];
    const bounds = element.getBoundingClientRect();
    const body = element.querySelector<HTMLElement>(".ui-dialog-body")!;
    if (body.scrollHeight > body.clientHeight + 1) failures.push("body scroll");
    if (document.documentElement.scrollWidth > innerWidth + 1)
      failures.push("page overflow");
    if (bounds.top < -1 || bounds.bottom > innerHeight + 1)
      failures.push("dialog outside viewport");
    const tiles = Array.from(
      element.querySelectorAll<HTMLElement>(".invoice-entry-choice-tile"),
    );
    if (tiles.length !== 4) failures.push("four methods");
    for (const node of element.querySelectorAll<HTMLElement>(
      ".invoice-entry-choice-tile, .invoice-entry-choice-tile > *, .invoice-simulation-notice, .invoice-simulation-notice strong, .invoice-simulation-notice p, .ui-dialog-body > .helper, .ui-dialog-footer button",
    )) {
      const rect = node.getBoundingClientRect();
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.left < bounds.left - 1 ||
        rect.right > bounds.right + 1 ||
        rect.top < bounds.top - 1 ||
        rect.bottom > bounds.bottom + 1
      )
        failures.push(`clipped ${node.tagName}`);
      if (
        node.scrollWidth > node.clientWidth + 1 ||
        node.scrollHeight > node.clientHeight + 1
      )
        failures.push(`overflow ${node.tagName}`);
      if (node.matches("button") && rect.height < 44)
        failures.push("touch target");
      if (node.matches("strong, span, p")) {
        const textContainer = (
          node.closest(
            ".invoice-entry-choice-tile, .invoice-simulation-notice",
          ) ?? body
        ).getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const glyph of range.getClientRects()) {
          if (
            glyph.left < textContainer.left - 1 ||
            glyph.right > textContainer.right + 1 ||
            glyph.top < textContainer.top - 1 ||
            glyph.bottom > textContainer.bottom + 1
          )
            failures.push(`text clipped ${node.tagName}`);
        }
      }
    }
    const boxes = tiles.map((tile) => {
      const rect = tile.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    if (
      boxes.length === 4 &&
      (Math.abs(boxes[0].y - boxes[1].y) > 2 ||
        Math.abs(boxes[2].y - boxes[3].y) > 2 ||
        boxes[2].y <= boxes[0].y + boxes[0].height)
    )
      failures.push("two by two grid");
    return { failures, boxes };
  });
}

for (const language of ["en", "fa"] as const) {
  for (const role of ["Manager", "Floor Worker"] as const) {
    test(`R3c F9 New invoice fits without scrolling ${language} ${role}`, async ({
      page,
    }, info) => {
      await signIn(page, role);
      await setBranch(page, "Branch 1");
      await setLanguage(page, language);
      await page.goto("/#invoices");
      const before = await readCanonicalBusinessEvidence(page);
      const widths =
        info.project.name === "phone" ? [360, 390, 509, 760] : [1440];
      for (const width of widths) {
        await page.setViewportSize({ width, height: width <= 760 ? 640 : 900 });
        for (const theme of ["light", "dark"] as const) {
          if ((await page.locator("html").getAttribute("data-theme")) !== theme)
            await (
              await openShellAction(
                page,
                t(
                  language,
                  `Switch to ${theme} theme`,
                  theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
                ),
              )
            ).click();
          await page
            .getByRole("button", {
              name: t(language, "New invoice", "فاکتور جدید"),
              exact: true,
            })
            .click();
          const dialog = page.getByRole("dialog", {
            name: t(language, "New invoice", "فاکتور جدید"),
            exact: true,
          });
          await page.evaluate(() => document.fonts.ready);
          await expect(
            dialog.getByTestId("invoice-simulation-warning"),
          ).toBeVisible();
          await expect(
            dialog.getByRole("button", {
              name: t(language, "Photo (AI reading)", "عکس (خوانش هوش مصنوعی)"),
              exact: true,
            }),
          ).toBeEnabled();
          const manual = dialog.getByRole("button", {
            name: t(language, "Manual entry", "ورود دستی"),
            exact: true,
          });
          if (role === "Floor Worker") {
            await expect(manual).toBeDisabled();
            await expect(
              dialog.getByRole("button", {
                name: t(language, "JSON file", "فایل JSON"),
                exact: true,
              }),
            ).toBeDisabled();
            await expect(
              dialog.getByText(
                t(
                  language,
                  "Manual entry and JSON imports are available to Owners and Managers.",
                  "ورود دستی و فایل JSON برای مالک و مدیر در دسترس است.",
                ),
                { exact: true },
              ),
            ).toBeVisible();
          } else await expect(manual).toBeEnabled();
          const original = await fit(dialog);
          expect(
            original.failures,
            `${language} ${role} ${width} ${theme}`,
          ).toEqual([]);
          const first = dialog.locator(".invoice-entry-choice-tile").first();
          await first.hover();
          await first.focus();
          const focused = await fit(dialog);
          expect(focused.failures).toEqual([]);
          focused.boxes.forEach((box, index) => {
            for (const key of ["x", "y", "width", "height"] as const)
              expect(
                Math.abs(box[key] - original.boxes[index][key]),
              ).toBeLessThanOrEqual(2);
          });
          if (width === 360 && theme === "light") {
            const warning = dialog.getByTestId("invoice-simulation-warning");
            await warning.evaluate((node) => {
              node.style.minHeight = "900px";
            });
            expect((await fit(dialog)).failures.length).toBeGreaterThan(0);
            await warning.evaluate((node) => node.removeAttribute("style"));
            await first.evaluate((node) => {
              node.style.minHeight = "900px";
            });
            expect((await fit(dialog)).failures.length).toBeGreaterThan(0);
            await first.evaluate((node) => node.removeAttribute("style"));
            expect((await fit(dialog)).failures).toEqual([]);
          }
          await dialog
            .getByRole("button", {
              name: t(language, "Cancel", "انصراف"),
              exact: true,
            })
            .click();
          const after = await readCanonicalBusinessEvidence(page);
          expect(after.invoice).toEqual(before.invoice);
          expect(after.invoices).toEqual(before.invoices);
          expect(after.activity).toEqual(before.activity);
        }
      }
    });
  }
}
