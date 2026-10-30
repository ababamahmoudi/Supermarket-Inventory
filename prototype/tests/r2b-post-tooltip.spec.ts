import { expect, test, type Locator, type Page } from "@playwright/test";
import { openShellAction, signIn } from "./helpers";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { importReceivingFixture, word } from "./r2-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

async function position(control: Locator) {
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}
async function stays(
  control: Locator,
  before: Awaited<ReturnType<typeof position>>,
) {
  const after = await position(control);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
}
async function bounded(page: Page, tooltip: Locator) {
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveCSS("pointer-events", "none");
  const box = await position(tooltip);
  const topbar = await page.locator(".topbar").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.y).toBeGreaterThanOrEqual(topbar!.y + topbar!.height);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(box.height).toBeLessThanOrEqual(160);
}

for (const language of ["en", "fa"] as const)
  for (const theme of ["light", "dark"] as const)
    test(`R2b concise Post help preserves all25-line requirements in ${language} ${theme}`, async ({
      page,
    }, info) => {
      const phone = info.project.name === "phone";
      await page.setViewportSize({ width: phone ? 390 : 1440, height: 900 });
      await signIn(page, "Owner");
      // This 25-line boundary deliberately includes missing required terms.
      await runCanonicalBusinessFixture(
        page,
        (state) => {
          state.config.receiving.default_payment_terms = null;
        },
        null,
      );
      const invoice = await importReceivingFixture(page, language);
      if (theme === "dark")
        await (
          await openShellAction(
            page,
            word(language, "Switch to dark theme", "تغییر به تم تیره"),
          )
        ).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const before = await readCanonicalBusinessEvidence(page);
      const control = page.locator(".receiving-post-control:visible");
      const post = control.getByRole("button", {
        name: word(language, "Post invoice", "ثبت فاکتور"),
        exact: true,
      });
      await expect(post).toBeDisabled();
      await expect(post).toHaveAttribute("aria-disabled", "true");
      await expect(post).toHaveClass(/button-neutral/);
      // A control revealed under the old import pointer has no synthetic hover help.
      await expect(control.getByRole("tooltip")).toHaveCount(0);
      await post.scrollIntoViewIfNeeded();
      const beforeHover = await position(post);
      await page.mouse.move(1, 450);
      await post.hover();
      const tooltip = control.getByRole("tooltip");
      await bounded(page, tooltip);
      await expect(tooltip).toContainText(
        word(language, "52 items need attention", "52 مورد نیاز به بررسی دارد"),
      );
      await expect(tooltip).toContainText(
        word(language, "25 lines", "25 ردیف"),
      );
      await expect(tooltip).toContainText(
        word(
          language,
          "Click Post invoice for the full What's missing list.",
          "برای دیدن فهرست کامل «موارد ناقص»، روی «ثبت فاکتور» بزنید.",
        ),
      );
      expect((await tooltip.textContent())!.length).toBeLessThan(180);
      await expect(tooltip).not.toContainText(
        word(language, "Line 1:", "ردیف 1:"),
      );
      await stays(post, beforeHover);
      await page.mouse.move(1, 450);
      await expect(tooltip).toHaveCount(0);

      // Navigate from a stable review link using actual Tab, not pointer focus.
      await page.locator("#invoice-back-link").focus();
      for (
        let step = 0;
        step < 12 &&
        !(await post.evaluate((element) => element === document.activeElement));
        step++
      )
        await page.keyboard.press("Tab");
      await expect(post).toBeFocused();
      const beforeFocusHelp = await position(post);
      await bounded(page, tooltip);
      await stays(post, beforeFocusHelp);
      await page.keyboard.press("Escape");
      await expect(post).toBeFocused();
      await expect(tooltip).toHaveCount(0);

      const beforeClick = await position(post);
      // aria-disabled prevents posting, while this intentional real click still
      // opens exact guidance. Force skips Playwright's disabled actionability.
      if (phone) await post.tap({ force: true });
      else await post.click({ force: true });
      await expect(tooltip).toHaveCount(0);
      await stays(post, beforeClick);
      const panel = page.getByRole("alert", {
        name: word(language, "What's missing", "موارد ناقص"),
        exact: true,
      });
      await expect(panel).toBeVisible();
      const rows = panel.locator(".receiving-missing-row");
      await expect(rows).toHaveCount(52);
      await expect(
        rows.filter({
          hasText: word(
            language,
            "Invoice details: 2 highlighted fields",
            "اطلاعات فاکتور: 2 فیلد مشخص‌شده",
          ),
        }),
      ).toHaveCount(1);
      // R2c derives the absent subtotal and final total from complete lines
      // plus the printed zero tax; these are quiet provenance, not questions.
      await expect(
        rows.filter({ hasText: word(language, "Totals:", "جمع‌ها:") }),
      ).toHaveCount(0);
      for (let index = 0; index < 25; index++) {
        const count = (invoice.lines[index].low_confidence_fields ?? []).length;
        await expect(
          rows.filter({
            hasText: word(
              language,
              `Line ${index + 1}: choose a pricing category for the new product.`,
              `ردیف ${index + 1}: دسته قیمت‌گذاری کالای جدید را انتخاب کنید.`,
            ),
          }),
        ).toHaveCount(1);
        await expect(
          rows.filter({
            hasText: word(
              language,
              `Line ${index + 1}: ${count} highlighted ${count === 1 ? "field" : "fields"}. Compare with the original and confirm the line.`,
              `ردیف ${index + 1}: ${count} فیلد مشخص‌شده. با اصل فاکتور مقایسه و ردیف را تأیید کنید.`,
            ),
          }),
        ).toHaveCount(1);
      }
      expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
      const category = rows.filter({
        hasText: word(
          language,
          "Line 1: choose a pricing category for the new product.",
          "ردیف 1: دسته قیمت‌گذاری کالای جدید را انتخاب کنید.",
        ),
      });
      await category
        .getByRole("button", {
          name: word(language, "Show", "نمایش"),
          exact: true,
        })
        .click();
      await expect(page.locator("#invoice-line-0-category")).toBeFocused();
      await page
        .locator("#invoice-line-0-detail")
        .getByRole("button", {
          name: word(language, "Close", "بستن"),
          exact: true,
        })
        .last()
        .click();
      const last = rows.filter({
        hasText: word(
          language,
          `Line 25: ${(invoice.lines[24].low_confidence_fields ?? []).length} highlighted fields. Compare with the original and confirm the line.`,
          `ردیف 25: ${(invoice.lines[24].low_confidence_fields ?? []).length} فیلد مشخص‌شده. با اصل فاکتور مقایسه و ردیف را تأیید کنید.`,
        ),
      });
      await last
        .getByRole("button", {
          name: word(language, "Show", "نمایش"),
          exact: true,
        })
        .click();
      await expect(page.locator("#invoice-line-24-lot_number")).toBeFocused();
      expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    });
