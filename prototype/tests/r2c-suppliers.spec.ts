import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import Decimal from "decimal.js";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import {
  chooseOption,
  openInvoiceDetails,
  openInvoiceLine,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { removeReceivingDemo } from "./r2-receiving-helpers";

const fictionalReadings = fileURLToPath(
  new URL("./fixtures/r2b-fictional-readings-export.json", import.meta.url),
);
async function expectIncompleteSuppliers(page: Page, names: string[]) {
  await page.goto("/#suppliers");
  await expect(page.locator(".supplier-overview-row")).toHaveCount(
    names.length,
  );
  for (const name of names)
    await expect(
      page
        .locator(".suppliers-overview")
        .getByRole("link", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Profile incomplete", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/No suppliers yet/)).toHaveCount(0);
}

test("remembered incomplete profiles survive a real three-branch import, post, correction, move, reload and role switch", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await removeReceivingDemo(page, "en");
  await page
    .getByLabel("Choose file…", { exact: true })
    .setInputFiles(fictionalReadings);
  const preview = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await chooseOption(
    page,
    preview.getByLabel("Location for WJG-0811", { exact: true }),
    "Branch 2",
    "Richmond Hill",
  );
  await chooseOption(
    page,
    preview.getByLabel("Location for FVP-0819", { exact: true }),
    "Branch 3",
    "Newmarket",
  );
  await preview
    .getByRole("button", { name: "Import 8 invoices", exact: true })
    .click();
  const complete = page.getByRole("dialog", {
    name: "Import complete",
    exact: true,
  });
  await complete.getByText("Open Needs review", { exact: true }).click();
  const imported = await readCanonicalBusinessEvidence(page);
  expect(
    new Set(imported.invoices!.map((invoice) => invoice.branch)).size,
  ).toBe(3);
  const names = imported.suppliers!.map((supplier) => supplier.name);
  expect(names.length).toBeGreaterThanOrEqual(3);
  await signIn(page, "Manager");
  await setBranch(page, "all");
  await page.goto("/#suppliers");
  await expect(page.locator(".supplier-overview-row")).toHaveCount(
    names.length,
  );
  await page
    .getByRole("button", { name: "Profile incomplete", exact: true })
    .click();
  await expectIncompleteSuppliers(page, names);
  await page.reload();
  await expectIncompleteSuppliers(page, names);
  const invoice = imported.invoices!.find(
    (invoice) => invoice.supplier_invoice_number === "BFP-0810",
  )!;
  await page.goto(`/#invoices?id=${encodeURIComponent(invoice.id)}`);
  await openInvoiceDetails(page);
  await page
    .getByRole("button", { name: "Looks right: Invoice details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Looks right: Totals", exact: true })
    .click();
  await openInvoiceLine(page, 0);
  await chooseOption(
    page,
    page.locator("#invoice-line-0-category"),
    "grocery",
    "Grocery",
  );
  await page
    .locator(".receiving-line-editor")
    .getByRole("button", { name: "Confirm line", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
          .review_confirmed,
    )
    .toBe(true);
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Post invoice", exact: true }),
  ).toBeHidden();
  await expect(page.locator(".posted-invoice-document")).toBeVisible();
  await expectIncompleteSuppliers(page, names);
  await page.goto(`/#invoices?id=${encodeURIComponent(invoice.id)}`);
  await page
    .getByRole("button", { name: "Correct invoice", exact: true })
    .click();
  const correction = page.getByRole("dialog", {
    name: "Correct invoice",
    exact: true,
  });
  await correction.locator(".invoice-line-toggle").first().click();
  const editor = correction.locator(".receiving-line-editor");
  await editor
    .getByLabel("Unit cost before tax", { exact: true })
    .fill(
      new Decimal(invoice.lines[0].unit_cost_before_tax)
        .plus("0.5000")
        .toFixed(4),
    );
  await editor
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await correction
    .getByLabel("Reason (required)", { exact: true })
    .fill("Correct fictional supplier cost transcription.");
  await correction
    .getByRole("button", { name: "Preview correction", exact: true })
    .click();
  await correction
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await correction
    .getByRole("button", { name: "Confirm correction", exact: true })
    .click();
  await expect(correction).toBeHidden();
  await page.getByRole("button", { name: "Move invoice", exact: true }).click();
  const move = page.getByRole("dialog", { name: "Move invoice", exact: true });
  await chooseOption(
    page,
    move.locator("#invoice-move-target"),
    "Branch 2",
    "Richmond Hill",
  );
  await move
    .getByLabel("Reason", { exact: true })
    .fill("Correct fictional receiving location.");
  await expect(move.locator(".invoice-move-summary")).toBeVisible();
  await move.getByRole("button", { name: "Move invoice", exact: true }).click();
  await expect(move).toBeHidden();
  await expectIncompleteSuppliers(page, names);
  await page.reload();
  await expectIncompleteSuppliers(page, names);
  await setBranch(page, "Branch 3");
  await setBranch(page, "all");
  await expectIncompleteSuppliers(page, names);
  await signIn(page, "Owner");
  await setBranch(page, "all");
  await page.goto("/#suppliers");
  await expect(page.locator(".supplier-overview-row")).toHaveCount(
    names.length,
  );
  await signIn(page, "Manager");
  await setBranch(page, "all");
  await expectIncompleteSuppliers(page, names);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoice_content_corrections).toHaveLength(1);
  expect(after.invoice_location_corrections).toHaveLength(1);
  expect(after.suppliers!.map((supplier) => supplier.name)).toEqual(names);
  expect(errors).toEqual([]);
});

for (const language of ["en", "fa"] as const)
  test(`supplier details use one padded contact card and dashboard tiles in ${language}`, async ({
    page,
  }) => {
    await signIn(page, "Manager");
    await setLanguage(page, language);
    await page.goto("/#suppliers?name=Corner%20Spice%20Co.");
    const card = page.locator(".supplier-contact-card");
    await expect(card).toBeVisible();
    await expect(card.locator("dt")).toHaveCount(7);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Corner Spice Co.",
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: language === "en" ? "Edit" : "ویرایش",
        exact: true,
      }),
    ).toHaveCount(1);
    await expect(
      card.getByRole("link", {
        name: language === "en" ? "Complete profile" : "تکمیل مشخصات",
        exact: true,
      }),
    ).toHaveCount(1);
    const geometry = await card.evaluate((element) => ({
      padding: parseFloat(getComputedStyle(element).paddingInlineStart),
      columns: getComputedStyle(
        element.querySelector(".supplier-contact-grid")!,
      ).gridTemplateColumns.split(" ").length,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(geometry.padding).toBeGreaterThanOrEqual(20);
    expect(geometry.columns).toBe(
      (page.viewportSize()?.width ?? 1440) > 600 ? 2 : 1,
    );
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await expect(page.locator(".supplier-kpis .ui-summary-tile")).toHaveCount(
      4,
    );
    await expect(page.locator(".supplier-kpis .summary-tile-dot")).toHaveCount(
      4,
    );
    expect(
      await page
        .locator(".supplier-kpis .ui-summary-tile")
        .first()
        .evaluate((element) => element.tagName),
    ).toBe("DIV");
    const before = await card.boundingBox();
    await card
      .getByRole("link", {
        name: language === "en" ? "Complete profile" : "تکمیل مشخصات",
        exact: true,
      })
      .click();
    const editor = page.getByRole("dialog", {
      name: language === "en" ? "Edit supplier" : "ویرایش تأمین‌کننده",
      exact: true,
    });
    await expect(editor).toBeVisible();
    await editor
      .getByRole("button", {
        name: language === "en" ? "Cancel" : "انصراف",
        exact: true,
      })
      .click();
    const after = await card.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
  });
