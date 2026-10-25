import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { invoiceRecords } from "../src/invoice-records";
import { setBranch, setLanguage, signIn } from "./helpers";

const source = fileURLToPath(
  new URL("./fixtures/r2-fictional-readings-export.json", import.meta.url),
);
for (const language of ["en", "fa"] as const) {
  test(`R2b 3.4 JSON entry is additive and opens its draft in ${language}`, async ({
    page,
  }) => {
    const t = (en: string, fa: string) => (language === "en" ? en : fa);
    await signIn(page, "Owner");
    await setBranch(page, "Branch 1");
    await setLanguage(page, language);
    await page.goto("/#invoices");
    const before = await readCanonicalBusinessEvidence(page);
    const retained = invoiceRecords(
      before,
      before.config.company.seed_key,
    ).filter((invoice) => invoice.status !== "empty" || invoice.file_data);
    const add = page.getByRole("button", {
      name: t("New invoice", "فاکتور جدید"),
      exact: true,
    });
    await expect(add).toHaveClass(/button-primary/);
    await add.click();
    const chooser = page.getByRole("dialog", {
      name: t("New invoice", "فاکتور جدید"),
      exact: true,
    });
    for (const name of [
      t("Photo (AI reading)", "عکس (خوانش هوش مصنوعی)"),
      t("PDF (AI reading)", "PDF (خوانش هوش مصنوعی)"),
      t("Manual entry", "ورود دستی"),
      t("JSON file", "فایل JSON"),
    ])
      await expect(
        chooser.getByRole("button", { name, exact: true }),
      ).toBeEnabled();
    const [fileChoice] = await Promise.all([
      page.waitForEvent("filechooser"),
      chooser
        .getByRole("button", { name: t("JSON file", "فایل JSON"), exact: true })
        .click(),
    ]);
    await fileChoice.setFiles(source);
    const preview = page.getByRole("dialog", {
      name: t("Import invoice readings", "ورود خوانش فاکتورها"),
      exact: true,
    });
    await expect(preview).toBeVisible();
    await expect(
      preview.getByText(
        t(
          "Same invoice twice in this file",
          "همین فاکتور دو بار در این فایل است",
        ),
        { exact: true },
      ),
    ).toHaveCount(2);
    await expect(
      page.getByRole("button", {
        name: /Remove fictional data|حذف داده‌های خیالی/,
      }),
    ).toHaveCount(0);
    await preview
      .getByRole("button", {
        name: t("Import 1 invoice", "ورود 1 فاکتور"),
        exact: true,
      })
      .click();
    await expect(preview).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /R2-FICTIONAL-025/ }),
    ).toBeVisible();
    const after = await readCanonicalBusinessEvidence(page);
    const imported = invoiceRecords(
      after,
      after.config.company.seed_key,
    ).filter(
      (invoice) =>
        !invoiceRecords(before, before.config.company.seed_key).some(
          (previous) => previous.id === invoice.id,
        ),
    );
    expect(imported).toHaveLength(1);
    expect(after.invoice.id).toBe(imported[0].id);
    expect(imported[0]).toMatchObject({
      status: "review",
      supplier_invoice_number: "R2-FICTIONAL-025",
    });
    expect(imported[0].lines).toHaveLength(25);
    for (const invoice of retained)
      expect(
        invoiceRecords(after, after.config.company.seed_key).find(
          (row) => row.id === invoice.id,
        ),
      ).toEqual(invoice);
    for (const product of before.products)
      expect(
        after.products.find(
          (row) =>
            row.code === product.code && row.company_id === product.company_id,
        ),
      ).toEqual(product);
    expect(after.ledger).toEqual(before.ledger);
    expect(after.stock_movements).toEqual(before.stock_movements);
    expect(after.approvals).toEqual(before.approvals);
    await page
      .getByRole("button", {
        name: t("Save and close", "ذخیره و بستن"),
        exact: true,
      })
      .click();
    await add.click();
    const [duplicateChoice] = await Promise.all([
      page.waitForEvent("filechooser"),
      chooser
        .getByRole("button", { name: t("JSON file", "فایل JSON"), exact: true })
        .click(),
    ]);
    await duplicateChoice.setFiles(source);
    const duplicate = page.getByRole("dialog", {
      name: t("Import invoice readings", "ورود خوانش فاکتورها"),
      exact: true,
    });
    await expect(
      duplicate.getByText(t("Already in the app", "از قبل در برنامه است"), {
        exact: true,
      }),
    ).toHaveCount(2);
    for (const checkbox of await duplicate.getByRole("checkbox").all())
      await expect(checkbox).toBeDisabled();
    await duplicate
      .getByRole("button", { name: t("Cancel", "انصراف"), exact: true })
      .click();
    const unchanged = await readCanonicalBusinessEvidence(page);
    expect(
      invoiceRecords(unchanged, unchanged.config.company.seed_key),
    ).toEqual(invoiceRecords(after, after.config.company.seed_key));
    expect(unchanged.ledger).toEqual(before.ledger);
  });
}

test("R2b 3.4 photo and PDF choices share simulated reading with the correct file picker", async ({
  page,
}) => {
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await page.goto("/#invoices");
  for (const [name, accept] of [
    [
      "Photo (AI reading)",
      "image/png,image/jpeg,image/webp,image/gif,image/svg+xml",
    ],
    ["PDF (AI reading)", "application/pdf"],
  ]) {
    await page
      .getByRole("button", { name: "New invoice", exact: true })
      .click();
    const chooser = page.getByRole("dialog", {
      name: "New invoice",
      exact: true,
    });
    await chooser.getByRole("button", { name, exact: true }).click();
    const entry = page.getByTestId("invoice-upload-entry");
    await expect(entry).toBeVisible();
    await expect(page.locator('[aria-busy="true"][inert]')).toHaveCount(0);
    await expect(entry.locator("#invoice-original")).toHaveAttribute(
      "accept",
      accept,
    );
    await expect(
      entry.getByText("AI invoice reading is simulated", { exact: true }),
    ).toBeVisible();
    await entry
      .getByRole("button", { name: "Save and close", exact: true })
      .click();
  }
  await setBranch(page, "all");
  const add = page.getByRole("button", { name: "New invoice", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  const chooser = page.getByRole("dialog", {
    name: "New invoice",
    exact: true,
  });
  await expect(
    chooser.getByRole("button", { name: "JSON file", exact: true }),
  ).toBeEnabled();
  for (const name of ["Photo (AI reading)", "PDF (AI reading)", "Manual entry"])
    await expect(
      chooser.getByRole("button", { name, exact: true }),
    ).toBeDisabled();
});
