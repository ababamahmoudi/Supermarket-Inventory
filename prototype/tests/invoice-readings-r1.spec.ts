import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  chooseOption,
  openShellAction,
  resetDemo,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

const sampleFile = fileURLToPath(
  new URL("./fixtures/fictional-readings-export.json", import.meta.url),
);
const twoPageFile = fileURLToPath(
  new URL("./fixtures/r1-fictional-readings-export.json", import.meta.url),
);
const fictionalNumber = "R1-2026-002";
const fictionalSupplier = "Maple Test Produce Ltd.";

async function openData(page: Page) {
  await page.goto("/#settings");
  await page
    .getByRole("navigation", { name: "Settings groups", exact: true })
    .getByRole("button", { name: "Data", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import invoice readings", exact: true }),
  ).toBeVisible();
}

async function removeFictionalData(page: Page) {
  await openData(page);
  await page
    .getByRole("button", { name: "Remove fictional data…", exact: true })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Start with an empty store",
    exact: true,
  });
  await expect(confirmation).toContainText("pricing rules");
  await confirmation
    .getByRole("button", { name: "Remove fictional data", exact: true })
    .click();
  await expect
    .poll(async () => {
      const state = await readCanonicalBusinessEvidence(page);
      return {
        products: state.products.length,
        suppliers: state.suppliers?.length,
        invoices: state.invoices?.length,
        ledger: state.ledger.length,
      };
    })
    .toEqual({ products: 0, suppliers: 0, invoices: 0, ledger: 0 });
}

async function chooseImport(page: Page, file: string) {
  await openData(page);
  await page.getByLabel("Choose file…", { exact: true }).setInputFiles(file);
  const preview = page.getByRole("dialog", {
    name: "Import invoice readings",
    exact: true,
  });
  await expect(preview).toBeVisible();
  const viewport = page.viewportSize()!;
  const bounds = await preview.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  if (viewport.width <= 759)
    expect(Math.round(bounds!.width)).toBe(viewport.width);
  return preview;
}

async function importSelected(page: Page, count: number) {
  await page
    .getByRole("dialog", { name: "Import invoice readings", exact: true })
    .getByRole("button", { name: `Import ${count} invoices`, exact: true })
    .click();
  const summary = page.getByRole("dialog", {
    name: "Import complete",
    exact: true,
  });
  await expect(summary).toBeVisible();
  return summary;
}

test("Owner imports fictional readings, reviews checks and posts only item lines through normal approvals", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "phone" ? 390 : 1440,
    height: testInfo.project.name === "phone" ? 664 : 900,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await removeFictionalData(page);

  // Establish the supplied fictional sample in the app so the second fixture's
  // duplicate has a genuine persisted original and supplier invoice number.
  let preview = await chooseImport(page, sampleFile);
  await expect(
    preview.getByText("Checked by you", { exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("radio", { name: "My checked values", exact: true })
    .click();
  let summary = await importSelected(page, 1);
  await summary.getByText("Open Needs review", { exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Needs review", exact: true }),
  ).toBeVisible();

  preview = await chooseImport(page, twoPageFile);
  await expect(
    preview.getByLabel("Import FV-20417", { exact: true }),
  ).toBeDisabled();
  await expect(
    preview.getByLabel("Import FV-20417", { exact: true }),
  ).not.toBeChecked();
  await expect(
    preview.getByText("Already in the app", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByLabel(`Import ${fictionalNumber}`, { exact: true }),
  ).toBeChecked();
  await expect(
    preview.getByText(fictionalSupplier, { exact: true }),
  ).toBeVisible();
  summary = await importSelected(page, 1);
  await expect(summary).toContainText("fictional-fv-20417-duplicate");
  await summary.getByText("Open Needs review", { exact: true }).click();
  await page
    .locator(".invoice-saved-drafts tbody tr")
    .filter({ hasText: fictionalNumber })
    .getByRole("button", { name: "Resume draft", exact: true })
    .click();

  await expect(page.locator(".invoice-line")).toHaveCount(2);
  const importedCost = page
    .locator(".invoice-line")
    .first()
    .getByLabel("Unit cost before tax", { exact: true });
  await expect(importedCost).toHaveValue("2.0000");
  await expect(importedCost).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator(".invoice-line").first()).not.toContainText(
    "Enter a cost of zero or more up to four decimal places.",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await expect(
    page.getByText("Please check", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Reading imported from the invoice-reader kit \(not live\)/)
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  const originalImage = page.locator(".invoice-original-media img");
  await expect(originalImage).toHaveJSProperty("naturalWidth", 760);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(originalImage).toHaveJSProperty("naturalWidth", 760);
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Other charges and credits",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Returnable container deposit", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional promotional discount", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toContainText("fields still need checking");
  const beforeReview = await readCanonicalBusinessEvidence(page);
  expect(beforeReview.ledger).toHaveLength(0);
  expect(beforeReview.products).toHaveLength(0);

  const details = page.getByRole("button", {
    name: "Invoice details",
    exact: true,
  });
  if ((await details.getAttribute("aria-expanded")) === "false")
    await details.click();
  // Imported suppliers retain the existing C6 completion/confirmation flow.
  await page
    .getByRole("button", { name: "Confirm supplier", exact: true })
    .click();
  const supplierDialog = page.getByRole("dialog", {
    name: "Edit supplier",
    exact: true,
  });
  await expect(supplierDialog).toBeVisible();
  await supplierDialog.locator("#supplier-phone").fill("416-555-0101");
  await supplierDialog
    .locator("#supplier-email")
    .fill("fictional-orders@example.test");
  await supplierDialog
    .locator("#supplier-sales_rep_name")
    .fill("Fictional Representative");
  await supplierDialog
    .locator("#supplier-sales_rep_phone")
    .fill("416-555-0102");
  await supplierDialog
    .getByRole("button", { name: "Save supplier", exact: true })
    .click();
  await expect(supplierDialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Confirm supplier", exact: true })
    .click();

  // Each acknowledgement is a real protected UI action; no state is injected.
  await page
    .getByRole("button", {
      name: /^Looks right: Supplier invoice number/,
    })
    .click();
  await page
    .locator(".invoice-line")
    .first()
    .getByRole("button", {
      name: "Looks right: Unit cost before tax",
      exact: true,
    })
    .click();
  for (const [index, line] of (
    await page.locator(".invoice-line").all()
  ).entries()) {
    if ((await line.getAttribute("data-expanded")) !== "true")
      await line.locator(".invoice-line-toggle").click();
    await chooseOption(
      page,
      line.getByLabel("Pricing category", { exact: true }),
      "grocery",
      "Grocery",
    );
    if (index === 0) {
      await line.getByRole("button", { name: "Yes", exact: true }).click();
      const date = line.getByLabel("Date", { exact: true });
      await expect(date).toContainText("2026-11-27");
      await date.click();
      await page
        .getByRole("button", { name: "2026-11-27", exact: true })
        .click();
    } else {
      await line.getByRole("button", { name: "No", exact: true }).click();
    }
    await line
      .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
      .click();
    const checkAll = page.getByRole("dialog", {
      name: "This line has fields to check. Confirm all of them?",
      exact: true,
    });
    if (index === 1) {
      await expect(checkAll).toBeVisible();
      await checkAll
        .getByRole("button", { name: "Confirm all fields", exact: true })
        .click();
    }
    await expect(line).toHaveAttribute("data-expanded", "false");
  }
  await expect(page.getByText("Please check", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoices?.find(
          (invoice) => invoice.supplier_invoice_number === fictionalNumber,
        )?.status,
    )
    .toBe("posted");
  const posted = await readCanonicalBusinessEvidence(page);
  expect(posted.products).toHaveLength(2);
  expect(posted.products.map((product) => product.name_en)).toEqual(
    expect.arrayContaining([
      "R1 Fictional Dry Beans 500 g",
      "R1 Fictional Bulk Lentils",
    ]),
  );
  expect(
    posted.products.every((product) => product.status === "pending_approval"),
  ).toBe(true);
  expect(
    posted.ledger
      .filter((entry) => entry.supplier === fictionalSupplier)
      .map((entry) => entry.amount),
  ).toEqual(["10.00"]);
  expect(
    posted.stock_movements?.filter(
      (entry) => entry.invoice_id === posted.invoice.id,
    ),
  ).toHaveLength(2);
  await expect(
    page.getByRole("heading", {
      name: "Other charges and credits",
      exact: true,
    }),
  ).toBeVisible();

  await page.goto("/#approvals");
  for (const productName of [
    "R1 Fictional Dry Beans 500 g",
    "R1 Fictional Bulk Lentils",
  ]) {
    const card = page.locator("section.card").filter({
      has: page.getByRole("heading", { name: productName, exact: true }),
    });
    await card
      .getByRole("button", { name: "Approve product", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Review approval", exact: true })
      .getByRole("button", { name: "Approve product", exact: true })
      .click();
  }
  await expect
    .poll(async () =>
      (await readCanonicalBusinessEvidence(page)).products.every(
        (product) => product.status === "active",
      ),
    )
    .toBe(true);
  await (await openShellAction(page, "Demo")).click();
  await page.getByRole("menuitem", { name: "Reset demo", exact: true }).click();
  const reset = page.getByRole("dialog", { name: "Reset demo", exact: true });
  await expect(reset).toContainText("This also removes invoices you imported.");
  await reset.getByRole("button", { name: "Cancel", exact: true }).click();
  await resetDemo(page);
  await expect
    .poll(
      async () => (await readCanonicalBusinessEvidence(page)).products.length,
    )
    .toBeGreaterThan(2);
  expect(
    (await readCanonicalBusinessEvidence(page)).invoices?.some(
      (invoice) => invoice.supplier_invoice_number === fictionalNumber,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("an empty store renders intentional lists at desktop and phone widths in English and Persian", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({
    width: testInfo.project.name === "phone" ? 390 : 1440,
    height: 900,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Owner");
  await setBranch(page, "Branch 1");
  await removeFictionalData(page);
  for (const language of ["en", "fa"] as const) {
    await setLanguage(page, language);
    await page.goto("/#dashboard");
    await expect(page.locator(".kpi-value")).toHaveCount(4);
    await expect(page.locator(".kpi-value")).toHaveText(["0", "0", "0", "0"]);
    for (const route of [
      "lookup",
      "products",
      "suppliers",
      "invoices",
      "received",
      "returns",
      "labels",
      "offers",
      "price-updates",
      "expiry",
      "orders",
      "payables",
    ]) {
      await page.goto(`/#${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("main .empty-state").first()).toBeVisible();
      await expect(page.locator("main")).not.toContainText(/NaN|undefined/);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }
  }
  expect(errors).toEqual([]);
});

test("invalid JSON exports stay outside the store and explain the format problem", async ({
  page,
}) => {
  await signIn(page, "Owner");
  await openData(page);
  const before = await readCanonicalBusinessEvidence(page);
  const fictional = JSON.parse(readFileSync(sampleFile, "utf8"));
  fictional.version = 99;
  await page.getByLabel("Choose file…", { exact: true }).setInputFiles({
    name: "fictional-wrong-version.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fictional)),
  });
  await expect(page.getByRole("alert")).toContainText(/version/i);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.suppliers).toEqual(before.suppliers);
  expect(after.activity).toEqual(before.activity);
});
