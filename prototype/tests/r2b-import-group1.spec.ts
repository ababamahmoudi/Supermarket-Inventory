import { expect, test, type Locator, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import type { DemoInvoice, DemoState } from "../src/types";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  chooseOption,
  openInvoiceDetails,
  openInvoiceLine,
  openShellAction,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import {
  expectReceivingStable,
  removeReceivingDemo,
  word,
  type ReceivingLanguage,
} from "./r2-receiving-helpers";
import { expectLabelActionContract } from "./r2b-label-action-proof";

const fixture = fileURLToPath(
  new URL("./fixtures/r2b-fictional-readings-export.json", import.meta.url),
);

function invoiceFrom(state: DemoState, number: string): DemoInvoice {
  const invoice =
    state.invoice.supplier_invoice_number === number
      ? state.invoice
      : state.invoices?.find(
          (entry) => entry.supplier_invoice_number === number,
        );
  if (!invoice) throw new Error(`Missing fictional invoice ${number}`);
  return invoice;
}

async function currentInvoice(page: Page, number: string) {
  return invoiceFrom(await readCanonicalBusinessEvidence(page), number);
}

function receivedLocal(state: DemoState, invoice: DemoInvoice) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: state.config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(invoice.received_at!));
  const part = (name: string) =>
    parts.find((entry) => entry.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

async function importGroupOne(page: Page, language: ReceivingLanguage) {
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await setLanguage(page, language);
  await removeReceivingDemo(page, language);
  await page
    .getByLabel(word(language, "Choose file…", "انتخاب فایل…"), {
      exact: true,
    })
    .setInputFiles(fixture);
  const preview = page.getByRole("dialog", {
    name: word(language, "Import invoice readings", "ورود خوانش فاکتورها"),
    exact: true,
  });
  await expect(preview.locator("[data-import-id]")).toHaveCount(8);
  await preview
    .getByRole("button", {
      name: word(language, "AI reading", "خوانش هوش مصنوعی"),
      exact: true,
    })
    .click();
  await preview
    .getByRole("button", {
      name: word(language, "Import 8 invoices", "ورود 8 فاکتور"),
      exact: true,
    })
    .click();
  const summary = page.getByRole("dialog", {
    name: word(language, "Import complete", "ورود کامل شد"),
    exact: true,
  });
  await expect(summary).toBeVisible();
  await summary
    .getByRole("button", {
      name: word(language, "Open Needs review", "باز کردن نیازمند بررسی"),
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () => (await readCanonicalBusinessEvidence(page)).invoices?.length,
    )
    .toBe(8);
  return readCanonicalBusinessEvidence(page);
}

async function openImported(page: Page, number: string) {
  await page.goto("/#invoices?tab=needs_review");
  await page
    .locator(".invoice-saved-drafts")
    .getByRole("link", { name: number, exact: true })
    .click();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  await expect(page.locator(".receiving-header h1")).toContainText(number);
  await openInvoiceDetails(page);
}

async function closeLine(editor: Locator, language: ReceivingLanguage) {
  await editor
    .getByRole("button", {
      name: word(language, "Close", "بستن"),
      exact: true,
    })
    .click();
  await expect(editor).toBeHidden();
}

/** Measure actual label rows and controls, including the optional-field actions. */
async function expectAlignedFields(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const geometry = await page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const labelRows = Array.from(
      document.querySelectorAll<HTMLElement>(".ui-field-label-row"),
    )
      .filter(visible)
      .map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          width: rect.width,
          scrollWidth: row.scrollWidth,
          height: rect.height,
        };
      });
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".receiving-review .field input:not([type=hidden]),.receiving-review .field [role=combobox]",
      ),
    )
      .filter(visible)
      .map((control) => {
        const rect = control.getBoundingClientRect();
        const field = control.closest(".field")!.getBoundingClientRect();
        return {
          id: control.id,
          height: rect.height,
          outside: rect.left < field.left - 1 || rect.right > field.right + 1,
        };
      });
    const alignedRows: { count: number; delta: number }[] = [];
    for (const grid of document.querySelectorAll(
      ".receiving-details-grid,.detail-grid.ui-fields-align-labels,.receiving-quantity-grid",
    )) {
      const groups: { top: number; inputs: number[] }[] = [];
      for (const field of grid.querySelectorAll(":scope > .field")) {
        const input = field.querySelector("input,[role=combobox]");
        if (!input || !visible(input)) continue;
        const top = field.getBoundingClientRect().top;
        let group = groups.find((row) => Math.abs(row.top - top) <= 1);
        if (!group) groups.push((group = { top, inputs: [] }));
        group.inputs.push(input.getBoundingClientRect().top);
      }
      for (const group of groups)
        if (group.inputs.length > 1)
          alignedRows.push({
            count: group.inputs.length,
            delta: Math.max(...group.inputs) - Math.min(...group.inputs),
          });
    }
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      labelRows,
      controls,
      alignedRows,
    };
  });
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.labelRows.length).toBeGreaterThan(0);
  expect(
    geometry.labelRows.filter((row) => row.scrollWidth > row.width + 1),
    "Every visible label/action row fits its field",
  ).toEqual([]);
  expect(
    geometry.controls.filter(
      (control) => control.outside || Math.abs(control.height - 44) > 1,
    ),
    "Native inputs and comboboxes stay inside their fields at 44px",
  ).toEqual([]);
  expect(
    geometry.alignedRows.filter((row) => row.delta > 1),
    "Controls in the same grid row have level input tops",
  ).toEqual([]);
  await page.screenshot({
    path: test
      .info()
      .outputPath(
        `fields-${await page.locator("html").getAttribute("lang")}-${page.viewportSize()!.width}-${await page.locator("html").getAttribute("data-theme")}-${Date.now()}.png`,
      ),
  });
}

async function acknowledgeAbsence(
  page: Page,
  action: Locator,
  input: Locator,
  commit: () => Promise<boolean>,
) {
  await expectLabelActionContract(page, action);
  await action.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({
    path: test
      .info()
      .outputPath(
        `absence-${await page.locator("html").getAttribute("lang")}-${page.viewportSize()!.width}-${await page.locator("html").getAttribute("data-theme")}-${await input.getAttribute("id")}.png`,
      ),
  });
  const before = await input.boundingBox();
  expect(before).not.toBeNull();
  await expectReceivingStable(
    page,
    action,
    async () => {
      await action.click();
      await expect.poll(commit).toBe(true);
    },
    { scroll: false },
  );
  const after = await input.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
  await expect(action).toBeDisabled();
}

async function checkOptionalQuestions(page: Page, language: ReceivingLanguage) {
  await openImported(page, "BFP-0810");
  const details = page.getByTestId("invoice-details-card");
  const more = details.locator("details.receiving-more");
  await expect(more).not.toHaveAttribute("open");
  await more.locator("summary").click();
  const taxName = word(
    language,
    "Supplier tax number (optional)",
    "شماره مالیاتی تأمین‌کننده (اختیاری)",
  );
  const taxInput = details.getByLabel(taxName, { exact: true });
  await expect(taxInput).toHaveValue("");
  await expect(
    details.getByLabel(word(language, "Currency", "ارز"), { exact: true }),
  ).toHaveValue(
    (await readCanonicalBusinessEvidence(page)).config.company.currency,
  );
  await expectAlignedFields(page);
  const started = Date.now();
  const taxAction = details.getByRole("button", {
    name: word(
      language,
      `Not on the invoice: ${taxName}`,
      `در فاکتور نیست: ${taxName}`,
    ),
    exact: true,
  });
  await acknowledgeAbsence(page, taxAction, taxInput, async () =>
    Boolean(
      (await currentInvoice(page, "BFP-0810")).checked_fields
        ?.supplier_tax_number,
    ),
  );
  const editor = await openInvoiceLine(page, 0);
  const lineMore = editor.locator("details.receiving-more");
  await expect(lineMore).not.toHaveAttribute("open");
  await lineMore.locator("summary").click();
  const barcodeInput = editor.locator("#invoice-line-0-barcode");
  await expect(barcodeInput).toHaveValue("");
  const barcodeName = word(
    language,
    "Barcode on the invoice",
    "بارکد روی فاکتور",
  );
  const barcodeAction = editor.getByRole("button", {
    name: word(
      language,
      `Not on the invoice: ${barcodeName}`,
      `در فاکتور نیست: ${barcodeName}`,
    ),
    exact: true,
  });
  await expectAlignedFields(page);
  await acknowledgeAbsence(page, barcodeAction, barcodeInput, async () =>
    Boolean(
      (await currentInvoice(page, "BFP-0810")).lines[0].checked_fields?.barcode,
    ),
  );
  await closeLine(editor, language);
  await page.reload();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  await openInvoiceDetails(page);
  const canonical = await readCanonicalBusinessEvidence(page);
  const saved = invoiceFrom(canonical, "BFP-0810");
  expect(saved.low_confidence_fields).not.toContain("supplier_tax_number");
  expect(saved.lines[0].low_confidence_fields).not.toContain("barcode");
  const events = canonical.activity.filter(
    (entry) =>
      entry.action === "Invoice field not on the invoice" &&
      entry.entity_id === saved.id,
  );
  expect(events).toHaveLength(2);
  for (const [field, receipt] of [
    ["supplier_tax_number", saved.checked_fields?.supplier_tax_number],
    ["barcode", saved.lines[0].checked_fields?.barcode],
  ] as const) {
    const event = events.find(
      (entry) => (entry.after as { field?: string })?.field === field,
    );
    expect(event).toMatchObject({
      actor_username: "owner",
      at: receipt?.checked_at,
    });
    expect(receipt?.checked_by_user_id).toBe(event?.actor_user_id);
    expect(receipt?.checked_by_user_id).toBeTruthy();
    expect(Date.parse(receipt!.checked_at)).toBeGreaterThanOrEqual(started);
    expect(Date.parse(receipt!.checked_at)).toBeLessThanOrEqual(Date.now());
  }
}

async function checkNamesAndSupplier(page: Page, language: ReceivingLanguage) {
  await openImported(page, "BFP-0818");
  let editor = await openInvoiceLine(page, 0);
  await expect(editor.locator("#invoice-line-0-name-en")).toHaveValue(
    "Plum Preserve",
  );
  await expect(editor.locator("#invoice-line-0-supplier-code")).toHaveValue(
    "Plum Preserve",
  );
  await expect(
    editor.getByText(
      word(language, "Filled from the name", "از نام پر شده است"),
      { exact: true },
    ),
  ).toBeVisible();
  await editor.locator("details.receiving-more > summary").click();
  await expect(editor.locator("#invoice-line-0-description")).toHaveValue(
    "Box of 6 x 330g Plum Preserve",
  );
  await closeLine(editor, language);
  editor = await openInvoiceLine(page, 1);
  await expect(editor.locator("#invoice-line-1-name-en")).toHaveValue(
    "Orchard Fig Preserve",
  );
  const swapped = (await currentInvoice(page, "BFP-0818")).lines[1]
    .new_name_swap;
  expect(swapped).toBeTruthy();
  await editor
    .getByRole("button", {
      name: word(
        language,
        "Undo name and code swap",
        "برگرداندن جابه‌جایی نام و کد",
      ),
      exact: true,
    })
    .click();
  await expect(editor.locator("#invoice-line-1-name-en")).toHaveValue(
    swapped!.name,
  );
  await expect
    .poll(
      async () =>
        (await currentInvoice(page, "BFP-0818")).lines[1].new_name_swap,
    )
    .toBeUndefined();
  await editor
    .getByRole("button", {
      name: word(
        language,
        "Use 'Orchard Fig Preserve' as the name",
        "استفاده از «Orchard Fig Preserve» به‌عنوان نام",
      ),
      exact: true,
    })
    .click();
  await expect(editor.locator("#invoice-line-1-name-en")).toHaveValue(
    "Orchard Fig Preserve",
  );
  await expect
    .poll(
      async () => (await currentInvoice(page, "BFP-0818")).lines[1].new_name_en,
    )
    .toBe("Orchard Fig Preserve");
  await closeLine(editor, language);
  await page
    .locator(".receiving-meta")
    .getByRole("link", { name: "Bluefinch Pantry Inc.", exact: true })
    .click();
  await expect(page.locator(".supplier-contact-grid")).toContainText(
    "+1 (416) 555-0142",
  );
  await expect(page.locator(".supplier-contact-grid")).toContainText(
    "billing@bluefinch.example",
  );
  await expect(page.locator(".supplier-contact-grid")).toContainText(
    "https://bluefinch.example",
  );
  await page
    .locator(".supplier-detail-header")
    .getByRole("button", {
      name: word(language, "Edit", "ویرایش"),
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: word(language, "Edit supplier", "ویرایش تأمین‌کننده"),
    exact: true,
  });
  await expect(dialog.locator("#supplier-name")).toHaveValue(
    "Bluefinch Pantry Inc.",
  );
  // R2e B8 normalizes only new suppliers automatically; existing names stay editable.
  await expect(
    dialog.getByRole("button", {
      name: word(
        language,
        "Use Bluefinch Pantry Inc.",
        "استفاده از Bluefinch Pantry Inc.",
      ),
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog.locator("#supplier-name").fill("BlueFinch Pantry Inc.");
  await dialog
    .getByRole("button", {
      name: word(language, "Save supplier", "ذخیرهٔ تأمین‌کننده"),
      exact: true,
    })
    .click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).suppliers?.find(
          (entry) => entry.name === "BlueFinch Pantry Inc.",
        )?.previous_names,
    )
    .toContain("Bluefinch Pantry Inc.");
}

async function checkTerms(page: Page, language: ReceivingLanguage) {
  await openImported(page, "FVP-1220");
  const terms = page.locator("#invoice-payment-terms");
  const due = page.locator("#invoice-due-date");
  await expect(due).toHaveText("2027-01-01");
  await chooseOption(
    page,
    terms,
    "30",
    word(language, "Net 30 (30 days)", "خالص 30 (30 روز)"),
  );
  await expect(due).toHaveText("2027-01-19");
  await chooseOption(
    page,
    terms,
    "monthly",
    word(
      language,
      "Monthly (due the 1st of next month)",
      "ماهانه (سررسید اول ماه بعد)",
    ),
  );
  await expect(due).toHaveText("2027-01-01");
  await chooseOption(page, terms, "other", word(language, "Other", "سایر"));
  const days = page.locator("#invoice-payment-terms-days");
  await expect(days).toHaveValue("");
  await expectReceivingStable(page, days, async () => {
    await days.pressSequentially("20");
    await expect(days).toHaveValue("20");
  });
  await days.press("Tab");
  await expect
    .poll(async () => {
      const invoice = await currentInvoice(page, "FVP-1220");
      return {
        terms: invoice.payment_terms,
        days: invoice.payment_term_days,
        due: invoice.due_date,
      };
    })
    .toEqual({ terms: "Net 20", days: 20, due: "2027-01-09" });
  const bounds = await Promise.all([
    terms.boundingBox(),
    days.boundingBox(),
    due.boundingBox(),
    page.locator("#invoice-location").boundingBox(),
  ]);
  expect(bounds.every(Boolean)).toBe(true);
  expect(Math.abs(bounds[0]!.y - bounds[1]!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds[2]!.y - bounds[3]!.y)).toBeLessThanOrEqual(1);
  expect(bounds[0]!.height).toBe(44);
  expect(bounds[1]!.height).toBe(44);
  await expectAlignedFields(page);
}

async function checkWeights(page: Page, language: ReceivingLanguage) {
  await openImported(page, "FVP-0819");
  const totals = page.getByTestId("invoice-totals-card");
  await expect(totals.locator("#invoice-subtotal")).toHaveValue("15.13");
  for (const field of ["tax", "final-total"])
    await expect(totals.locator(`#invoice-${field}`)).toHaveValue("");
  let editor = await openInvoiceLine(page, 0);
  await expect(editor.locator("#invoice-line-0-invoiced")).toHaveValue("1.375");
  await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("11.0000");
  await expect(editor.locator("#invoice-line-0-pack")).toHaveCount(0);
  await chooseOption(
    page,
    editor.locator("#invoice-line-0-category"),
    "grocery",
    word(language, "Grocery", "خواربار"),
  );
  await expect(
    editor.locator(".receiving-selling-price .price-display"),
  ).toContainText("7.49");
  await expect
    .poll(
      async () =>
        (await currentInvoice(page, "FVP-0819")).lines[0].pricing_category,
    )
    .toBe("grocery");
  expect((await currentInvoice(page, "FVP-0819")).lines[0]).toMatchObject({
    source_quantity_unit: "kg",
    source_cost_before_tax: "11.0000",
    source_cost_unit: "kg",
    unit_cost_before_tax: "4.9895",
    line_total: "15.13",
  });
  await expectAlignedFields(page);
  await closeLine(editor, language);
  await openImported(page, "OFG-0820");
  editor = await openInvoiceLine(page, 0);
  await expect(editor.locator("#invoice-line-0-invoiced")).toHaveValue("2.25");
  await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("4.3000");
  await expect(editor.locator("#invoice-line-0-pack")).toHaveCount(0);
  await closeLine(editor, language);
  await openImported(page, "BFP-0810");
  editor = await openInvoiceLine(page, 0);
  await expect(editor.locator("#invoice-line-0-pack")).toHaveValue("8");
  await editor.locator("#invoice-line-0-cost").fill("5.0000");
  await editor.locator("#invoice-line-0-cost").press("Tab");
  await expect(editor.locator("#invoice-line-0-case-cost")).toHaveValue(
    "40.0000",
  );
  await chooseOption(
    page,
    editor.locator("#invoice-line-0-unit"),
    "kg",
    word(language, "Weight (kg)", "وزن (کیلوگرم)"),
  );
  await expect(editor.locator("#invoice-line-0-pack")).toHaveCount(0);
  await expect
    .poll(async () => {
      const line = (await currentInvoice(page, "BFP-0810")).lines[0];
      return {
        quantity: line.source_quantity,
        cost: line.source_cost_before_tax,
        total: line.line_total,
      };
    })
    .toEqual({ quantity: "", cost: "", total: "40.00" });
  // R2e A2: a case count and case price cannot become kg without actual case mass.
  await expect(editor.locator("#invoice-line-0-case-weight")).toHaveValue("");
  await expect(
    editor.getByText(
      word(language, "Enter the weight per case", "وزن هر کارتن را وارد کنید"),
      { exact: true },
    ),
  ).toBeVisible();
  await editor.locator("#invoice-line-0-case-weight").fill("10");
  await page.keyboard.press("Tab");
  await expect(editor.locator("#invoice-line-0-invoiced")).toHaveValue("10");
  await expect(editor.locator("#invoice-line-0-cost")).toHaveValue("4.0000");
  await expect
    .poll(
      async () => (await currentInvoice(page, "BFP-0810")).lines[0].line_total,
    )
    .toBe("40.00");
  const quantity = editor.locator("#invoice-line-0-invoiced");
  await quantity.fill("");
  await expectReceivingStable(page, quantity, async () => {
    await quantity.pressSequentially("20");
    await expect(quantity).toHaveValue("20");
  });
  await quantity.press("Tab");
  await editor.locator("#invoice-line-0-cost").fill("11.0000");
  await editor.locator("#invoice-line-0-cost").press("Tab");
  await expect
    .poll(async () => {
      const line = (await currentInvoice(page, "BFP-0810")).lines[0];
      return {
        quantity: line.source_quantity,
        unit: line.source_quantity_unit,
        cost: line.source_cost_before_tax,
        costUnit: line.source_cost_unit,
        total: line.line_total,
      };
    })
    .toEqual({
      quantity: "20",
      unit: "kg",
      cost: "11.0000",
      costUnit: "kg",
      total: "220.00",
    });
  await expectAlignedFields(page);
  await closeLine(editor, language);
}

for (const language of ["en", "fa"] as const) {
  for (const width of [1440, 1000, 390]) {
    for (const theme of ["light", "dark"] as const) {
      test(`R2b Group 1 import, optional evidence and ${width === 1440 ? "names" : width === 1000 ? "terms" : "weight"} in ${language} ${theme} at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const baseline = await importGroupOne(page, language);
        if ((await page.locator("html").getAttribute("data-theme")) !== theme) {
          await (
            await openShellAction(
              page,
              word(
                language,
                theme === "dark"
                  ? "Switch to dark theme"
                  : "Switch to light theme",
                theme === "dark" ? "تغییر به تم تیره" : "تغییر به تم روشن",
              ),
            )
          ).click();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const handwritten = invoiceFrom(baseline, "BFP-0810");
        expect(receivedLocal(baseline, handwritten)).toBe("2026-08-12 09:20");
        expect(handwritten.imported_received_source).toBe("handwriting");
        expect(handwritten.low_confidence_fields).toContain("received_at");
        expect(handwritten.import_currency).toBe(
          baseline.config.company.currency,
        );
        expect(handwritten).toMatchObject({
          subtotal: "32.00",
          tax: "0.00",
          final_total: "32.00",
        });
        expect(handwritten.calculated_fields).toEqual(
          expect.arrayContaining(["subtotal", "tax"]),
        );
        expect(handwritten.low_confidence_fields).not.toEqual(
          expect.arrayContaining(["calculated:subtotal", "calculated:tax"]),
        );
        const fractional = invoiceFrom(baseline, "WJG-0811");
        expect(receivedLocal(baseline, fractional)).toBe("2026-08-11 12:00");
        expect(fractional.import_currency).toBe("USD");
        expect(fractional.lines[0]).toMatchObject({
          new_name_en: "Highground Rice",
          quantity_unit: "units",
          quantity_entered: "2",
          qty_invoiced: 2,
          unit_cost_before_tax: "4.6000",
          line_total: "9.20",
        });
        expect(invoiceFrom(baseline, "FVP-0819").due_date).toBe("2026-08-19");
        expect(invoiceFrom(baseline, "OFG-0820").due_date).toBe("2026-09-19");
        expect(
          baseline.suppliers?.find(
            (entry) => entry.name === "Bluefinch Pantry Inc.",
          ),
        ).toMatchObject({
          address: "12 Fictional Lane, Exampletown",
          phone: "+1 (416) 555-0142",
          email: "billing@bluefinch.example",
          website: "https://bluefinch.example",
        });
        await openImported(page, "BFP-0810");
        await expect(page.locator(".receiving-received-summary")).toContainText(
          "09:20",
        );
        await expect(
          page
            .getByTestId("invoice-totals-card")
            .getByText(
              word(
                language,
                "Calculated · not on the paper",
                "محاسبه‌شده · روی کاغذ نیست",
              ),
              { exact: true },
            ),
        ).toHaveCount(2);
        await checkOptionalQuestions(page, language);
        if (width === 1440) await checkNamesAndSupplier(page, language);
        else if (width === 1000) await checkTerms(page, language);
        else await checkWeights(page, language);
        const after = await readCanonicalBusinessEvidence(page);
        expect(
          after.invoices?.every((invoice) => invoice.status !== "posted"),
        ).toBe(true);
        expect(after.products).toHaveLength(0);
        expect(after.stock_movements ?? []).toHaveLength(0);
        expect(after.ledger).toHaveLength(0);
        expect(errors).toEqual([]);
      });
    }
  }
}
