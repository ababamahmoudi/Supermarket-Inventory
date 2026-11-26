import { expect, test } from "@playwright/test";
import { chooseOption } from "./helpers";
import {
  openReceivingLine,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";
import { openPr29Invoice } from "./pr29-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

for (const language of ["en", "fa"] as const) {
  test(`PR 29 line editor price block, math box and wording in ${language}`, async ({
    page,
  }) => {
    await openPr29Invoice(page, language);
    const editor = await openReceivingLine(page, 3);
    await setReceivingCategory(page, editor, language);
    // 13b: one case is singular.
    await expect(editor.locator(".receiving-pack-equation")).toHaveText(
      word(language, "1 case × 6 units = 6 units", "1 کارتن × 6 واحد = 6 واحد"),
    );
    // A 1.49 price is rounded up: Use lower sits inside the Selling price block.
    await editor.locator("#invoice-line-3-cost").fill("0.9800");
    await editor.locator("#invoice-line-3-cost").press("Tab");
    const notice = editor.getByTestId("receiving-rounded-up");
    await expect(notice).toBeVisible();
    expect(
      await notice.evaluate((element) =>
        Boolean(element.closest(".receiving-selling-price")),
      ),
    ).toBe(true);
    await expect(notice.getByRole("button", { name: /\$1\.49/ })).toBeVisible();
    // 11: the changed cost no longer matches the paper; one box, real buttons.
    const math = editor.locator(".receiving-line-math");
    await expect(math).toHaveCount(1);
    await expect(math).toHaveClass(/receiving-paper-mismatch/);
    for (const button of await math
      .locator(".receiving-line-math-actions button")
      .all())
      await expect(button).toHaveClass(/ui-button.*button-secondary/);
    expect(
      await math.locator(".receiving-line-math-actions button").count(),
    ).toBeGreaterThan(0);
  });

  test(`PR 29 pricing category and Taxable stay in sync in ${language}`, async ({
    page,
  }) => {
    await openPr29Invoice(page, language);
    const editor = await openReceivingLine(page, 0);
    const taxable = editor.locator("#invoice-line-0-taxable");
    const yes = taxable.getByRole("button", {
      name: word(language, "Yes", "بله"),
    });
    const no = taxable.getByRole("button", {
      name: word(language, "No", "خیر"),
    });
    await chooseOption(
      page,
      editor.locator("#invoice-line-0-category"),
      "grocery_taxable",
      word(language, "Grocery (Taxable)", "خواربار مشمول مالیات"),
    );
    await expect(yes).toHaveAttribute("aria-pressed", "true");
    await no.click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
            .pricing_category,
      )
      .toBe("grocery");
    await expect(no).toHaveAttribute("aria-pressed", "true");
    await yes.click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
            .pricing_category,
      )
      .toBe("grocery_taxable");
    await chooseOption(
      page,
      editor.locator("#invoice-line-0-category"),
      "rice",
      word(language, "Rice", "برنج"),
    );
    await expect(no).toHaveAttribute("aria-pressed", "true");
    await yes.click();
    // No taxable Rice exists in Settings: a short amber note, not a guess.
    await expect(editor.getByTestId("receiving-taxable-note")).toBeVisible();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
            .pricing_category,
      )
      .toBe("rice");
  });

  test(`PR 29 weighed cost shows in the selling price unit in ${language}`, async ({
    page,
  }) => {
    await openPr29Invoice(page, language);
    const editor = await openReceivingLine(page, 0);
    await setReceivingCategory(page, editor, language);
    await chooseOption(
      page,
      editor.locator("#invoice-line-0-unit"),
      "kg",
      word(language, "Weight (kg)", "وزن (کیلوگرم)"),
    );
    await editor.locator("#invoice-line-0-cost").fill("4.4092");
    await editor.locator("#invoice-line-0-cost").press("Tab");
    // Source kg cost stays in its own field; the price line uses /lb.
    await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("4.4092");
    await expect(editor.getByTestId("receiving-price-margin")).toContainText(
      "/lb",
    );
    await expect(editor.getByTestId("receiving-price-margin")).toContainText(
      "$2.0000",
    );
  });
}
