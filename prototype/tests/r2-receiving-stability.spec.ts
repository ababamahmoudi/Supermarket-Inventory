import { openInvoiceDetails } from "./helpers";
import { expect, test, type Locator } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  expectReceivingStable,
  importReceivingFixture,
  openReceivingLine,
  receivingRow,
  setReceivingCategory,
  word,
} from "./r2-receiving-helpers";

/** B4 shows complete names: inspect the actual text and every painted glyph. */
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
      exactPrefix: visible === full,
      fragments: glyphs.length,
      fits:
        glyphs.length > 0 &&
        glyphs.every(
          (glyph) =>
            glyph.left >= box.left - 1.5 &&
            glyph.right <= box.right + 1.5 &&
            glyph.top >= box.top - 1.5 &&
            glyph.bottom <= box.bottom + 1.5,
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

for (const language of ["en", "fa"] as const) {
  test(`R2 line editor remains anchored while receiving in ${language}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: testInfo.project.name === "phone" ? 390 : 1440,
      height: 900,
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const imported = await importReceivingFixture(page, language);
    const currentInvoice = async () => {
      const { invoice } = await readCanonicalBusinessEvidence(page);
      expect(invoice.id).toBe(imported.id);
      return invoice;
    };
    await expect(
      page
        .locator('[role="region"]')
        .filter({ has: page.locator('[id^="invoice-line-"][id$="-name-en"]') }),
    ).toHaveCount(0);
    await openInvoiceDetails(page);
    const details = page.getByRole("button", {
      name: word(
        language,
        "Looks right: Invoice details",
        "درست است: اطلاعات فاکتور",
      ),
      exact: true,
    });
    await expectReceivingStable(page, details, async () => {
      await details.click();
      await expect(
        page.getByTestId("invoice-details-card").locator(".please-check-field"),
      ).toHaveCount(0);
    });
    const editor = await openReceivingLine(page, 0);
    const name = editor.locator("#invoice-line-0-name-en");
    const row = receivingRow(page, 0);
    const rowText = (await row.textContent()) ?? "";
    const editedName = `${await name.inputValue()} Test`;
    await name.click();
    await name.press("End");
    for (const character of " Test") {
      await expectReceivingStable(page, name, () =>
        name.pressSequentially(character),
      );
      await expect(row).toHaveText(rowText);
    }
    await name.press("Tab");
    await expectFittedName(row, editedName);
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
    // A correct tooltip alone cannot excuse a wrong prefix or overflowing glyphs.
    const visibleName = row.locator(
      ".receiving-product-name > bdi.ltr-fragment",
    );
    await expect(visibleName).toHaveCount(1);
    const originalContents = await visibleName.innerHTML();
    const originalStyle = await visibleName.getAttribute("style");
    try {
      await visibleName.evaluate((element) => {
        element.textContent = "Z…";
      });
      expect((await fittedNameEvidence(row, editedName)).exactPrefix).toBe(
        false,
      );
      await visibleName.evaluate((element, full) => {
        element.textContent = full.repeat(8);
        (element as HTMLElement).style.whiteSpace = "nowrap";
      }, editedName);
      expect((await fittedNameEvidence(row, editedName)).fits).toBe(false);
    } finally {
      await visibleName.evaluate((element, contents) => {
        element.innerHTML = contents;
      }, originalContents);
      await visibleName.evaluate((element, style) => {
        if (style === null) element.removeAttribute("style");
        else element.setAttribute("style", style);
      }, originalStyle);
    }
    await expectFittedName(row, editedName);
    await testInfo.attach("renamed-receiving-name", {
      body: JSON.stringify(await fittedNameEvidence(row, editedName), null, 2),
      contentType: "application/json",
    });
    const category = editor.locator("#invoice-line-0-category");
    await expectReceivingStable(page, category, async () => {
      await setReceivingCategory(page, editor, language);
      await expect(category).toContainText(
        word(language, "Grocery", "خواربار"),
      );
    });
    const track = editor.getByRole("group", {
      name: word(language, "Track date", "پیگیری تاریخ"),
      exact: true,
    });
    const no = track.getByRole("button", {
      name: word(language, "No", "خیر"),
      exact: true,
    });
    const yes = track.getByRole("button", {
      name: word(language, "Yes", "بله"),
      exact: true,
    });
    await expect(no).toHaveAttribute("aria-pressed", "true");
    await expectReceivingStable(page, yes, async () => {
      await yes.click();
      await expect(yes).toHaveAttribute("aria-pressed", "true");
    });
    await expect(yes).toHaveAttribute("aria-pressed", "true");
    await expectReceivingStable(page, no, async () => {
      await no.click();
      await expect(no).toHaveAttribute("aria-pressed", "true");
    });
    await expect(no).toHaveAttribute("aria-pressed", "true");
    const confirm = editor.getByRole("button", {
      name: word(language, "Confirm line", "تأیید ردیف"),
      exact: true,
    });
    await confirm.scrollIntoViewIfNeeded();
    await expectReceivingStable(
      page,
      row,
      async () => {
        await confirm.click();
        await expect(editor).toHaveCount(0);
      },
      { scroll: false },
    );
    await expect(editor).toHaveCount(0);
    await expect(
      row.getByRole("img", {
        name: word(language, "Confirmed", "تأیید شد"),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.locator('[id^="invoice-line-"][id$="-name-en"]'),
    ).toHaveCount(0);
    // Closing a line keeps edits and anchors the row as well.
    const reopened = await openReceivingLine(page, 0);
    await expect(reopened.locator("#invoice-line-0-name-en")).toHaveValue(
      editedName,
    );
    const close = reopened.getByRole("button", {
      name: word(language, "Close", "بستن"),
      exact: true,
    });
    await close.scrollIntoViewIfNeeded();
    await expectReceivingStable(
      page,
      row,
      async () => {
        await close.click();
        await expect(reopened).toHaveCount(0);
      },
      { scroll: false },
    );
    const totals = page.getByRole("button", {
      name: word(language, "Looks right: Totals", "درست است: جمع‌ها"),
      exact: true,
    });
    await expectReceivingStable(page, totals, async () => {
      await totals.click();
      await expect(
        page.getByTestId("invoice-totals-card").locator(".please-check-field"),
      ).toHaveCount(0);
    });
    const beforeReload = await currentInvoice();
    expect(beforeReload.lines[0].new_name_en).toBe(editedName);
    await page.reload();
    await expect(page.getByTestId("invoice-review")).toBeVisible();
    await expectFittedName(receivingRow(page, 0), editedName);
    const afterReload = await currentInvoice();
    expect(afterReload).toEqual(beforeReload);
    const persistedEditor = await openReceivingLine(page, 0);
    await expect(
      persistedEditor.locator("#invoice-line-0-name-en"),
    ).toHaveValue(editedName);
    expect(errors).toEqual([]);
  });
}
