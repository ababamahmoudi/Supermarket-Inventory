import { expect, test, type Page } from "@playwright/test";
import { word } from "./r2-receiving-helpers";
import { openPr29Invoice } from "./pr29-receiving-helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

const marker = (page: Page, containerId: string, language: "en" | "fa") =>
  page.locator(`#${containerId}`).getByRole("button", {
    name: word(
      language,
      "Check this against the original",
      "با اصل فاکتور بررسی کنید",
    ),
    exact: true,
  });

async function controlTops(page: Page) {
  return page.getByTestId("invoice-details-card").evaluate((card) =>
    Array.from(
      card.querySelectorAll<HTMLElement>(
        "input, button:not(.reading-check-marker), [role=combobox]",
      ),
    )
      .filter((element) => element.getBoundingClientRect().height > 0)
      .map((element) => Math.round(element.getBoundingClientRect().top)),
  );
}

for (const language of ["en", "fa"] as const) {
  test(`PR 29 payment terms check the due date in ${language}`, async ({
    page,
  }) => {
    await openPr29Invoice(page, language);
    const due = page.locator("#invoice-check-header-due_date");
    await expect(due).toHaveClass(/please-check-field/);
    const terms = page.locator("#invoice-payment-terms");
    await terms.click();
    await page
      .getByRole("option", {
        name: word(language, "Net 30 (30 days)", "خالص 30 (30 روز)"),
        exact: true,
      })
      .click();
    // No other click: picking the terms counts as checking the due date.
    await expect(page.locator("#invoice-due-date")).toContainText("2026-12-18");
    await expect(
      page.locator(".please-check-field:has(#invoice-due-date)"),
    ).toHaveCount(0);
    await expect(page.getByTestId("invoice-details-card")).toContainText(
      word(
        language,
        "From payment terms · checked by you",
        "از شرایط پرداخت · بررسی‌شده توسط شما",
      ),
    );
  });

  test(`PR 29 per-field Looks right clears one field in ${language}`, async ({
    page,
  }) => {
    await openPr29Invoice(page, language);
    const card = page.getByTestId("invoice-details-card");
    const cardButton = card.getByRole("button", {
      name: word(
        language,
        "Looks right: Invoice details",
        "درست است: اطلاعات فاکتور",
      ),
    });
    await expect(cardButton).toHaveText(
      word(language, "Looks right · 2", "درست است · 2"),
    );
    const before = await controlTops(page);
    await marker(
      page,
      "invoice-check-header-supplier_invoice_number",
      language,
    ).click();
    const popover = page.getByRole("dialog", {
      name: word(language, "Check Invoice number", "بررسی شماره فاکتور"),
    });
    await expect(popover).toBeVisible();
    await popover
      .getByRole("button", {
        name: word(
          language,
          "Looks right: Invoice number",
          "درست است: شماره فاکتور",
        ),
      })
      .click();
    await expect(popover).toHaveCount(0);
    await expect(
      page.locator(".please-check-field:has(#invoice-number)"),
    ).toHaveCount(0);
    // Only that field: the due date is still highlighted.
    await expect(page.locator("#invoice-check-header-due_date")).toHaveClass(
      /please-check-field/,
    );
    await expect(cardButton).toHaveText(
      word(language, "Looks right · 1", "درست است · 1"),
    );
    const after = await controlTops(page);
    expect(after.length).toBe(before.length);
    after.forEach((top, index) =>
      expect(Math.abs(top - before[index])).toBeLessThanOrEqual(2),
    );
    const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
    const receipt = invoice.checked_fields?.supplier_invoice_number;
    expect(receipt?.checked_by_user_id).toBeTruthy();
    expect(Date.parse(receipt!.checked_at)).not.toBeNaN();
    expect(invoice.checked_fields?.due_date).toBeUndefined();
    // The card button clears the rest.
    await cardButton.click();
    await expect(cardButton).toHaveText(
      word(language, "Looks right", "درست است"),
    );
    await expect(card.locator(".please-check-field")).toHaveCount(0);
  });
}
