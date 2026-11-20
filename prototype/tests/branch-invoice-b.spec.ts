import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  invoiceImage,
  openInvoiceDetails,
  openInvoiceSourcePicker,
  openShellAction,
  setBranch,
  signIn,
} from "./helpers";

test.setTimeout(60000);

async function chooseManualInvoice(page: Page) {
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  const chooser = page.getByRole("dialog", {
    name: "New invoice",
    exact: true,
  });
  await expect(chooser).toBeVisible();
  await chooser
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
}
async function choosePhotoInvoice(page: Page) {
  const beforeSelection = await readCanonicalBusinessEvidence(page);
  const picker = await openInvoiceSourcePicker(page);
  expect(await readCanonicalBusinessEvidence(page)).toEqual(beforeSelection);
  await picker.setFiles(invoiceImage);
  await expect
    .poll(async () => {
      const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
      return {
        newId: invoice.id !== beforeSelection.invoice.id,
        fileName: invoice.file_name,
        sourceHash: invoice.file_data?.split(":").at(-1),
        status: invoice.status,
      };
    })
    .toEqual({
      newId: true,
      fileName: invoiceImage.name,
      sourceHash: createHash("sha256")
        .update(invoiceImage.buffer)
        .digest("hex"),
      status: "review",
    });
  const acceptedId = (await readCanonicalBusinessEvidence(page)).invoice.id;
  await expect(page).toHaveURL((url) => {
    const [route, parameters] = url.hash.slice(1).split("?");
    return (
      route === "invoices" &&
      new URLSearchParams(parameters).get("id") === acceptedId
    );
  });
  return acceptedId;
}
function originalInput(page: Page) {
  return page.locator('input[type="file"][aria-label="Attach original"]');
}

test("a Floor Worker cannot read another branch's manual draft, and starting their own invoice preserves it for the Supervisor", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Richmond Hill");
  await page.goto("/#invoices");
  // A photo draft is created only after the real native picker accepts a file.
  const uploadInvoiceId = await choosePhotoInvoice(page);
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await expect(
    page.getByRole("tablist", { name: "Invoice views", exact: true }),
  ).toBeVisible();
  await chooseManualInvoice(page);
  await expect(page).toHaveURL((url) => {
    const [route, parameters] = url.hash.slice(1).split("?");
    const id = new URLSearchParams(parameters).get("id");
    return route === "invoices" && Boolean(id && id !== uploadInvoiceId);
  });
  const manualInvoiceId = new URLSearchParams(
    new URL(page.url()).hash.split("?")[1],
  ).get("id");
  if (!manualInvoiceId)
    throw new Error("The accepted Manual draft ID is missing.");
  await expect
    .poll(async () => {
      const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
      return {
        id: invoice.id,
        branch: invoice.branch,
        status: invoice.status,
        entry_mode: invoice.entry_mode,
        lines: invoice.lines.length,
      };
    })
    .toEqual({
      id: manualInvoiceId,
      branch: "Branch 2",
      status: "draft",
      entry_mode: "manual",
      lines: 0,
    });
  // Existing visible copy, not an invented Manual entry heading. The actual
  // accepted Manual workspace is empty and renders its real review section.
  await expect(
    page.getByRole("heading", { name: "Invoice lines", exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-testid^="invoice-line-row-"]')).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Add a product to the invoice", { exact: true }),
  ).toBeVisible();
  await openInvoiceDetails(page);
  await page
    .getByLabel("Invoice number", { exact: true })
    .fill("PRIVATE-BRANCH-2");
  await expect
    .poll(async () => {
      const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
      return {
        id: invoice.id,
        branch: invoice.branch,
        supplier_invoice_number: invoice.supplier_invoice_number,
      };
    })
    .toEqual({
      id: manualInvoiceId,
      branch: "Branch 2",
      supplier_invoice_number: "PRIVATE-BRANCH-2",
    });
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  const original = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(original.branch).toBe("Branch 2");
  expect(original.id).toBe(manualInvoiceId);
  expect(original.supplier_invoice_number).toBe("PRIVATE-BRANCH-2");

  await signIn(page, "Floor Worker");
  await expect(
    page.getByText("PRIVATE-BRANCH-2", { exact: true }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Invoice number", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Invoice lines", exact: true }),
  ).toHaveCount(0);
  const ownInvoiceId = await choosePhotoInvoice(page);
  expect(ownInvoiceId).not.toBe(original.id);
  const own = await readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
  expect(own.invoice.branch).toBe("Branch 1");
  expect(
    own.invoices.find((invoice: { id: string }) => invoice.id === original.id),
  ).toEqual(original);

  await signIn(page, "Supervisor");
  await setBranch(page, "Richmond Hill");
  await page.goto("/#invoices");
  // The accepted photo now truthfully belongs to Needs review, so the queue
  // may choose that tab first. Resume this actual manual record from Drafts.
  await page.getByRole("tab", { name: /^Drafts / }).click();
  await page
    .locator(".invoice-saved-drafts tbody tr")
    .filter({ has: page.getByText("PRIVATE-BRANCH-2", { exact: true }) })
    .getByRole("link", { name: "PRIVATE-BRANCH-2", exact: true })
    .click();
  await openInvoiceDetails(page);
  await expect(page.getByLabel("Invoice number", { exact: true })).toHaveValue(
    "PRIVATE-BRANCH-2",
  );
  const resumed = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(resumed).toEqual(original);
});

test("another branch's reading draft stays hidden and unchanged by reading timers or Demo answers", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Richmond Hill");
  await page.goto("/#invoices");
  // Select the actual foreign-store source through its native picker. Merely
  // opening it must not create a record or replace the existing workspace.
  const beforeSelection = await readCanonicalBusinessEvidence(page);
  const picker = await openInvoiceSourcePicker(page);
  expect(await readCanonicalBusinessEvidence(page)).toEqual(beforeSelection);
  expect(await picker.element().isEnabled()).toBe(true);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await picker.setFiles(invoiceImage);
  await expect
    .poll(async () => {
      const invoice = (await readCanonicalBusinessEvidence(page)).invoice;
      return {
        newId: invoice.id !== beforeSelection.invoice.id,
        branch: invoice.branch,
        fileName: invoice.file_name,
        sourceHash: invoice.file_data?.split(":").at(-1),
        status: invoice.status,
      };
    })
    .toEqual({
      newId: true,
      branch: "Branch 2",
      fileName: invoiceImage.name,
      sourceHash: createHash("sha256")
        .update(invoiceImage.buffer)
        .digest("hex"),
      status: "reading",
    });
  const acceptedInvoiceId = (await readCanonicalBusinessEvidence(page)).invoice
    .id;
  await expect(page).toHaveURL((url) => {
    const [route, parameters] = url.hash.slice(1).split("?");
    return (
      route === "invoices" &&
      new URLSearchParams(parameters).get("id") === acceptedInvoiceId
    );
  });
  await expect(
    page.getByText("Reading invoice…", { exact: true }),
  ).toBeVisible();
  const original = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(original.status).toBe("reading");
  expect(original.branch).toBe("Branch 2");
  await signIn(page, "Floor Worker");
  await page.goto(`/#invoices?id=${encodeURIComponent(original.id)}`);
  await expect(
    page.getByRole("complementary", { name: "Original invoice", exact: true }),
  ).toHaveCount(0);
  await expect(originalInput(page)).toHaveCount(0);
  await (await openShellAction(page, "Demo")).click();
  await expect(
    page.getByRole("menuitem", {
      name: "Use fictional demo answer",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Attempt the exact public UI event used by the production Demo menu even
  // though the foreign-record action is hidden. No actor or command is forged.
  await page.evaluate(() =>
    window.dispatchEvent(new Event("arzon:demo-invoice-answer")),
  );
  await page.clock.runFor(2800);
  const untouched = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(untouched).toEqual(original);
  await page.reload();
  await page.clock.runFor(2800);
  const reloaded = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoice,
  );
  expect(reloaded).toEqual(original);
});
