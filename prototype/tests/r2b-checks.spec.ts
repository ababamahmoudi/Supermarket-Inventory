import { expect, test, type Locator } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import readingsFixture from "./fixtures/r2-fictional-readings-export.json" with { type: "json" };
import {
  importReceivingFixture,
  openReceivingLine,
  receivingRow,
  setReceivingCategory,
} from "./r2-receiving-helpers";

/** Inspect the painted prefix, rather than the retained full tooltip value. */
async function fittedNameEvidence(row: Locator, fullName: string) {
  return row.locator(".receiving-product-name").evaluate((element, full) => {
    const box = element.getBoundingClientRect();
    const visible = element.textContent?.trim() ?? "";
    const range = document.createRange();
    range.selectNodeContents(element);
    const glyphs = Array.from(range.getClientRects());
    return {
      title: element.getAttribute("title"),
      visible,
      exactPrefix:
        visible === full ||
        (visible.length > 1 &&
          visible.endsWith("…") &&
          full.startsWith(visible.slice(0, -1))),
      fragments: glyphs.length,
      fits:
        glyphs.length > 0 &&
        glyphs.every(
          (glyph) =>
            glyph.left >= box.left - 1.5 &&
            glyph.right <= box.right + 1.5 &&
            glyph.height <= box.height + 1.5,
        ),
      box: box.toJSON(),
      glyphs: glyphs.map((glyph) => glyph.toJSON()),
    };
  }, fullName);
}

async function expectFittedName(row: Locator, fullName: string) {
  await expect(row.locator(".receiving-product-name")).toHaveAttribute(
    "title",
    fullName,
  );
  const checkCount = await row
    .locator(".receiving-line-check-count")
    .allTextContents();
  await expect(row.locator(".invoice-line-toggle")).toHaveAccessibleName(
    [fullName, ...checkCount].join(" "),
  );
  await expect
    .poll(async () => {
      const proof = await fittedNameEvidence(row, fullName);
      return { exactPrefix: proof.exactPrefix, fits: proof.fits };
    })
    .toEqual({ exactPrefix: true, fits: true });
}

test("R2b 2.2 checks persist acknowledgments and Next focuses details, line evidence and totals", async ({
  page,
}, testInfo) => {
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
  const currentInvoice = async () => {
    const { invoice } = await readCanonicalBusinessEvidence(page);
    expect(invoice.id).toBe(imported.id);
    return invoice;
  };
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
  const editedName = "Invented Aurora Chickpeas";
  await name.fill(editedName);
  await name.press("Tab");
  await expectFittedName(receivingRow(page, 0), editedName);
  await expect
    .poll(async () => (await currentInvoice()).lines[0].new_name_en)
    .toBe(editedName);
  const renamed = (await currentInvoice()).lines[0];
  for (const field of [
    "description",
    "pack_size",
    "supplier_item_code",
    "quantity_unit",
    "quantity_entered",
    "units_per_case",
    "qty_invoiced",
    "qty_received_at_posting",
    "unit_cost_before_tax",
    "case_cost_before_tax",
    "line_total",
    "source_quantity",
    "source_received_quantity",
    "source_cost_before_tax",
    "source_cost_unit",
  ] as const) {
    expect(renamed[field], `Renaming preserves ${field}`).toEqual(
      imported.lines[0][field],
    );
  }
  await testInfo.attach("renamed-receiving-name", {
    body: JSON.stringify(
      await fittedNameEvidence(receivingRow(page, 0), editedName),
      null,
      2,
    ),
    contentType: "application/json",
  });
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
  expect(invoice.lines[0].new_name_en).toBe(editedName);
  await page.reload();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  await expectFittedName(receivingRow(page, 0), editedName);
  const persisted = await currentInvoice();
  expect(persisted).toEqual(invoice);
  const persistedEditor = await openReceivingLine(page, 0);
  await expect(persistedEditor.locator("#invoice-line-0-name-en")).toHaveValue(
    editedName,
  );
});
