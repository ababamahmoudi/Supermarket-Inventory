import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  importReceivingFixture,
  openReceivingLine,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";

for (const language of ["en", "fa"] as const) {
  test(`R3c K3 configured rounding explains the real lower price and saves a receiving proposal ${language}`, async ({
    page,
  }) => {
    const imported = await importReceivingFixture(page, language);
    const editor = await openReceivingLine(page, 2);
    await setReceivingCategory(page, editor, language);
    const explanation = editor.getByTestId("receiving-rounded-up");
    await expect(explanation).toContainText("$2.49");
    await expect(explanation).toContainText(
      word(language, "store rule", "قاعدهٔ فروشگاه"),
    );
    const before = await readCanonicalBusinessEvidence(page);
    const source = before.invoice;
    await explanation
      .getByRole("button", {
        name: word(language, "Use $2.49", "استفاده از $2.49"),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
            .receiving_price?.price,
      )
      .toBe("2.49");
    const after = await readCanonicalBusinessEvidence(page);
    const proposal = after.invoice.lines[2].receiving_price!;
    expect(proposal.calculated_price).toBe("2.99");
    expect(proposal.set_by_user_id).toBeTruthy();
    expect(Number.isNaN(Date.parse(proposal.set_at))).toBe(false);
    expect(after.invoice.id).toBe(imported.id);
    expect(after.invoice.lines[2].review_confirmed).toBe(false);
    expect(after.invoice.file_data).toBe(source.file_data);
    expect(after.invoice.original_pages).toEqual(source.original_pages);
    expect(after.invoice.reading_record).toEqual(source.reading_record);
    expect([
      after.invoice.subtotal,
      after.invoice.tax,
      after.invoice.final_total,
    ]).toEqual([source.subtotal, source.tax, source.final_total]);
    expect(after.invoice.lines[2].unit_cost_before_tax).toBe(
      source.lines[2].unit_cost_before_tax,
    );
    expect(after.invoice.lines[2].line_total).toBe(source.lines[2].line_total);
    expect(after.products).toEqual(before.products);
    expect(after.approvals).toEqual(before.approvals);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock).toEqual(before.stock);
    await expect(
      editor.getByTestId("receiving-price-attribution"),
    ).toContainText(proposal.set_by);
    await expect(
      editor.getByTestId("receiving-price-attribution"),
    ).toContainText("$2.99");
    expect(
      after.activity
        .filter((entry) => entry.action === "Set receiving price")
        .at(-1),
    ).toMatchObject({
      action: "Set receiving price",
      actor_user_id: proposal.set_by_user_id,
      by: proposal.set_by,
    });
    await editor
      .getByRole("button", {
        name: word(
          language,
          "Use calculated price",
          "استفاده از قیمت محاسبه‌شده",
        ),
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[2]
            .receiving_price,
      )
      .toBeUndefined();
    expect((await readCanonicalBusinessEvidence(page)).ledger).toEqual(
      before.ledger,
    );
  });
}
