import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import readingsFixture from "./fixtures/r2-fictional-readings-export.json" with { type: "json" };
import {
  importReceivingFixture,
  openReceivingLine,
  receivingRow,
  setReceivingCategory,
} from "./r2-receiving-helpers";

test("R2b 2.2 checks persist acknowledgments and Next focuses details, line evidence and totals", async ({
  page,
}) => {
  const readings = structuredClone(readingsFixture);
  for (const entry of readings.invoices) {
    Object.assign(entry.ai_reading, { tax: "0.00" });
    Object.assign(entry.ai_statuses, { "header.tax": "check" });
  }
  const imported = await importReceivingFixture(
    page,
    "en",
    undefined,
    undefined,
    {
      name: "fictional-tax-check.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(readings)),
    },
  );
  const next = page
    .locator(".receiving-progress")
    .getByRole("button", { name: "Next to check", exact: true });
  await next.click();
  await expect(page.locator("#invoice-number")).toBeFocused();
  await page.locator("#invoice-number").fill("R2B-CHECKED-025");
  await page.locator("#invoice-number").press("Tab");
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.checked_fields
          ?.supplier_invoice_number?.checked_by_user_id,
    )
    .toBeTruthy();
  // Other imported header questions (such as the received-date provenance)
  // are acknowledged before advancing into the line evidence.
  await page
    .getByRole("button", { name: "Looks right: Invoice details", exact: true })
    .click();
  // Explicitly flagged blank optional evidence remains a human question.
  // Next reveals More details and focuses each unanswered field in order.
  for (const field of ["lot_number", "expiry_as_printed", "barcode"]) {
    await next.click();
    const input = page.locator(`#invoice-line-0-${field}`);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    await expect(input.locator("xpath=ancestor::details[1]")).toHaveAttribute(
      "open",
      "",
    );
    await page
      .locator(`#invoice-check-line-0-${field}`)
      .getByRole("button", { name: /^Not on the invoice:/ })
      .click();
    await expect
      .poll(
        async () =>
          (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
            .checked_fields?.[field]?.checked_by_user_id,
      )
      .toBeTruthy();
    // The phone editor is a full-screen sheet; close it before using global Next.
    const editor = input.locator("xpath=ancestor::section[@role='region'][1]");
    await editor.getByRole("button", { name: "Close", exact: true }).click();
    await expect(editor).toHaveCount(0);
  }
  await next.click();
  const name = page.locator("#invoice-line-0-name-en");
  await expect(name).toBeFocused();
  await name.fill("Invented Aurora Chickpeas");
  await name.press("Tab");
  await expect(receivingRow(page, 0)).toContainText(
    "Invented Aurora Chickpeas",
  );
  for (let index = 0; index < 25; index++) {
    const editor =
      index === 0
        ? name.locator("xpath=ancestor::section[@role='region'][1]")
        : await openReceivingLine(page, index);
    await setReceivingCategory(page, editor, "en");
    await editor
      .getByRole("button", { name: "Confirm line", exact: true })
      .click();
    await expect(
      receivingRow(page, index).getByRole("img", {
        name: "Confirmed",
        exact: true,
      }),
    ).toBeVisible();
    await expect(editor).toHaveCount(0);
  }
  // A real flagged paper tax remains actionable; derived subtotal stays quiet.
  await expect(page.locator(".receiving-progress-checks")).toHaveText(
    "1 highlighted field",
  );
  await expect(page.getByTestId("invoice-totals-card")).toContainText(
    "Calculated",
  );
  await next.click();
  await expect(page.locator("#invoice-tax")).toBeFocused();
  await page
    .getByRole("button", { name: "Looks right: Totals", exact: true })
    .click();
  await expect(page.locator(".receiving-progress-checks")).toHaveText(
    "0 highlighted fields",
  );
  const state = await readCanonicalBusinessEvidence(page);
  const invoice =
    state.invoice.id === imported.id
      ? state.invoice
      : state.invoices!.find((row) => row.id === imported.id)!;
  expect(
    invoice.lines.every(
      (line) =>
        line.review_confirmed && line.low_confidence_fields?.length === 0,
    ),
  ).toBe(true);
  expect(invoice.lines[0].checked_fields).toMatchObject({
    description: {
      checked_by_user_id: expect.any(String),
      checked_at: expect.any(String),
    },
    unit_cost_before_tax: {
      checked_by_user_id: expect.any(String),
      checked_at: expect.any(String),
    },
  });
  expect(invoice.checked_fields?.tax?.checked_by_user_id).toBeTruthy();
  expect(invoice.checked_fields?.subtotal).toBeUndefined();
});
