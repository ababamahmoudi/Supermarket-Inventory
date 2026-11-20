import { expect, test } from "@playwright/test";
import { signIn, setLanguage } from "./helpers";

for (const language of ["en", "fa"] as const) {
  test(`R2e B6 descriptions grow from two to six lines and then scroll (${language})`, async ({
    page,
  }) => {
    await signIn(page, "Manager");
    await setLanguage(page, language);
    await page.goto("/#products");
    await page
      .getByRole("button", {
        name: language === "en" ? "Add product" : "افزودن محصول",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    const textarea = dialog.locator('textarea[dir="ltr"]').first();
    await expect(textarea).toBeVisible();
    const metrics = async () =>
      textarea.evaluate((node) => {
        const css = getComputedStyle(node);
        return {
          height: node.getBoundingClientRect().height,
          line: parseFloat(css.lineHeight),
          padding:
            parseFloat(css.paddingTop) +
            parseFloat(css.paddingBottom) +
            parseFloat(css.borderTopWidth) +
            parseFloat(css.borderBottomWidth),
          resize: css.resize,
          overflow: css.overflowY,
          scroll: node.scrollHeight,
          client: node.clientHeight,
        };
      });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await textarea.fill("");
      const empty = await metrics();
      expect(empty.resize).toBe("none");
      expect(
        Math.abs(empty.height - (empty.line * 2 + empty.padding)),
      ).toBeLessThanOrEqual(1);
      await textarea.fill(
        "Invented note one\nInvented note two\nInvented note three\nInvented note four",
      );
      const middle = await metrics();
      expect(middle.height).toBeGreaterThan(empty.height + empty.line);
      expect(middle.height).toBeLessThanOrEqual(
        middle.line * 6 + middle.padding + 1,
      );
      const long = Array.from(
        { length: 20 },
        (_, i) => `Fictional description line ${i + 1}`,
      ).join("\n");
      await textarea.fill(long);
      await expect(textarea).toHaveValue(long);
      const full = await metrics();
      expect(
        Math.abs(full.height - (full.line * 6 + full.padding)),
      ).toBeLessThanOrEqual(1);
      expect(full.scroll).toBeGreaterThan(full.client);
      expect(full.overflow).toBe("auto");
      await textarea.fill("Short fictional description");
      const short = await metrics();
      expect(Math.abs(short.height - empty.height)).toBeLessThanOrEqual(1);
    }
  });
}
