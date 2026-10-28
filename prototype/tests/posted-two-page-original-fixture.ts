import { expect, type Page } from "@playwright/test";
import readings from "./fixtures/r1-fictional-readings-export.json" with { type: "json" };
import {
  chooseOption,
  confirmInvoiceLine,
  openInvoiceDetails,
  openInvoiceLine,
  setBranch,
  signIn,
} from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

/** The same genuine two-page import/review/post flow used by the C1 proof. */
export async function preparePostedTwoPageOriginal(page: Page) {
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  const chooser = page.getByRole("dialog", {
    name: "New invoice",
    exact: true,
  });
  const [fileChoice] = await Promise.all([
    page.waitForEvent("filechooser"),
    chooser.getByRole("button", { name: "JSON file", exact: true }).click(),
  ]);
  const entry = readings.invoices[0];
  await fileChoice.setFiles({
    name: "fictional-two-page-viewer-import.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...readings, invoices: [entry] })),
  });
  const preview = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await preview
    .getByRole("button", { name: "My checked values", exact: true })
    .click();
  await preview
    .getByRole("button", { name: "Import 1 invoice", exact: true })
    .click();
  await expect(page.getByTestId("invoice-review")).toBeVisible();
  const imported = (await readCanonicalBusinessEvidence(page)).invoice;
  expect(imported.original_pages).toHaveLength(2);
  await openInvoiceDetails(page);
  await page
    .getByRole("button", { name: "Looks right: Invoice details", exact: true })
    .click();
  for (let index = 0; index < imported.lines.length; index++) {
    const editor = await openInvoiceLine(page, index);
    await chooseOption(
      page,
      editor.getByLabel("Pricing category", { exact: true }),
      "grocery",
      "Grocery",
    );
    await editor
      .getByRole("group", { name: "Track date", exact: true })
      .getByRole("button", { name: "No", exact: true })
      .click();
    await confirmInvoiceLine(page, editor);
  }
  await page
    .getByRole("button", { name: "Looks right: Totals", exact: true })
    .click();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect(page.locator(".posted-invoice-document")).toBeVisible();
  const before = await readCanonicalBusinessEvidence(page);
  const invoice = before.invoices!.find(
    (invoice) => invoice.id === imported.id,
  )!;
  expect(invoice.status).toBe("posted");
  return { entry, invoice, before };
}
