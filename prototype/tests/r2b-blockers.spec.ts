import { expect, test } from "@playwright/test";
import { openInvoiceUpload, invoiceImage, signIn } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import invented from "./fixtures/r2-fictional-readings-export.json" with { type: "json" };
import { importReceivingFixture, word } from "./r2-receiving-helpers";
for (const language of ["en", "fa"] as const) {
  test(`R2b 2.3 missing totals name the field and Show opens and focuses its fix in ${language}`, async ({
    page,
  }) => {
    const readings = structuredClone(invented);
    for (const entry of readings.invoices)
      Object.assign(entry.ai_reading, {
        subtotal: null,
        tax: null,
        final_total: null,
      });
    await importReceivingFixture(page, language, undefined, undefined, {
      name: "invented-missing-totals.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(readings)),
    });
    await expect(page.locator("#invoice-tax")).toBeVisible();
    const before = await readCanonicalBusinessEvidence(page);
    const post = page
      .locator(".receiving-post-control:visible")
      .getByRole("button");
    await expect(post).toBeDisabled();
    await expect(post).toHaveAttribute("aria-disabled", "true");
    await post.click({ force: true });
    expect(await readCanonicalBusinessEvidence(page)).toEqual(before);
    const panel = page.getByRole("alert", {
      name: word(language, "What's missing", "موارد ناقص"),
      exact: true,
    });
    const tax = panel.locator(".receiving-missing-row").filter({
      hasText: word(
        language,
        "Tax is empty. Enter the tax from the invoice (0.00 if there is none).",
        "مالیات خالی است. مالیات فاکتور را وارد کنید (اگر مالیات ندارد، 0.00 وارد کنید).",
      ),
    });
    await expect(tax).toHaveCount(1);
    await tax
      .getByRole("button", {
        name: word(language, "Show", "نمایش"),
        exact: true,
      })
      .click();
    await expect(page.locator("#invoice-tax")).toBeFocused();
    await expect(page.locator("#invoice-tax")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await page.locator("#invoice-tax").fill("0.00");
    await page.locator("#invoice-tax").press("Tab");
    await expect(tax).toHaveCount(0);
    await expect(page.locator("#invoice-tax")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(panel).not.toContainText(
      word(
        language,
        "Totals: check the amounts",
        "جمع‌ها: مبلغ‌ها را بررسی کنید",
      ),
    );
  });
}

test("R2b 2.3 cannot invoke posting while the original is still being read", async ({
  page,
}) => {
  await signIn(page, "Owner");
  await page.goto("/#invoices");
  await (await openInvoiceUpload(page)).setInputFiles(invoiceImage);
  await expect(
    page.getByText("Reading invoice…", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator(".receiving-header .receiving-post-control > button"),
  ).toBeDisabled();
  await expect(
    page.getByRole("dialog", { name: "Post invoice", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#invoice-missing-list")).toHaveCount(0);
});
for (const language of ["en", "fa"] as const) {
  test(`R2b 2.3 every accepted reading check has a rendered review target in ${language}`, async ({
    page,
  }) => {
    const readings = structuredClone(invented);
    for (const entry of readings.invoices) {
      Object.assign(entry, {
        ai_statuses: {
          "header.delivery_reference": "check",
          "lines[0].pack_size": "check",
        },
      });
      Object.assign(entry.ai_reading, {
        delivery_reference: "Invented source-only reference",
      });
    }
    await importReceivingFixture(page, language, undefined, undefined, {
      name: "invented-extra-reading-checks.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(readings)),
    });
    const next = page.locator(".receiving-progress").getByRole("button", {
      name: word(language, "Next to check", "مورد بعدی برای بررسی"),
      exact: true,
    });
    await next.click();
    const notes = page.locator(
      "#invoice-check-header-input-delivery_reference",
    );
    await expect(notes).toBeFocused();
    // An accepted check is visible, while an unprojected raw source value stays private.
    await expect(notes).toHaveValue("");
    await page
      .getByRole("button", {
        name: word(
          language,
          "Looks right: Invoice details",
          "درست است: اطلاعات فاکتور",
        ),
        exact: true,
      })
      .click();
    await next.click();
    const pack = page.locator("#invoice-check-line-0-input-pack_size");
    await expect(pack).toBeFocused();
    await expect(pack).toHaveValue("12 × 454 g");
    await expect(pack.locator("xpath=ancestor::details[1]")).toHaveAttribute(
      "open",
      "",
    );
  });
}
