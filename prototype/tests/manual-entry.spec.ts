import { expect, test } from "@playwright/test";
import { chooseOption, invoiceImage, setLanguage, signIn } from "./helpers";
const storage = "supermarket-prototype-v1";
test.setTimeout(60000);

test("Supervisor Add supplier saves Confirmed and a dated branch opening balance", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#suppliers");
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add supplier",
    exact: true,
  });
  expect(
    await dialog.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(720);
  await dialog
    .getByLabel("Supplier name", { exact: true })
    .fill("North Orchard Supply");
  await dialog.getByLabel("Phone", { exact: true }).fill("416-555-0173");
  await dialog.getByLabel("Email", { exact: true }).fill("orders@example.test");
  await dialog.getByLabel("Payment terms", { exact: true }).fill("Net 30");
  await dialog
    .getByLabel("Opening balance", { exact: true })
    .first()
    .fill("125.50");
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "North Orchard Supply",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator(".supplier-header-card")
      .getByText("Confirmed", { exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  const supplier = saved.suppliers.find(
    (record: { name: string }) => record.name === "North Orchard Supply",
  );
  expect(supplier.status).toBe("confirmed");
  expect(
    saved.ledger.find(
      (entry: { supplier: string }) => entry.supplier === supplier.name,
    ),
  ).toMatchObject({
    amount: "125.50",
    type: "opening_balance",
    branch: "Branch 1",
    reference: "Opening balance",
  });
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Deactivate supplier", exact: true })
    .getByRole("button", { name: "Deactivate supplier", exact: true })
    .click();
  await expect(
    page
      .locator(".supplier-header-card")
      .getByText("Archived", { exact: true }),
  ).toBeVisible();
});

test("supplier similarity warning links the existing record and requires explicit continuation", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#suppliers");
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add supplier",
    exact: true,
  });
  await dialog
    .getByLabel("Supplier name", { exact: true })
    .fill("Fresh Valley");
  await expect(
    dialog.getByRole("button", { name: "Fresh Valley Foods", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Review the similar supplier before saving.",
  );
  await dialog
    .getByRole("checkbox", {
      name: "Continue with this supplier name",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Fresh Valley", exact: true }),
  ).toBeVisible();
});

test("Supervisor Add product calculates its price and blocks a barcode conflict without inventory fields", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add product", exact: true });
  await dialog
    .getByLabel("English name", { exact: true })
    .fill("Orchard Pears");
  await dialog.getByLabel("Persian name", { exact: true }).fill("گلابی باغ");
  await dialog.getByLabel("Unit size", { exact: true }).fill("500 g");
  await dialog
    .getByLabel("Last unit cost before tax", { exact: true })
    .fill("1.4000");
  await chooseOption(
    page,
    dialog.getByLabel("Pricing category", { exact: true }),
    "grocery",
    "Grocery",
  );
  await expect(
    dialog.getByLabel("Selling price (per unit)", { exact: true }),
  ).not.toHaveValue("");
  const conflictingBarcode = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).products[0].barcode,
    storage,
  );
  await dialog.getByLabel("Barcode", { exact: true }).fill(conflictingBarcode);
  await expect(
    dialog.getByText("Starting stock count (optional)", { exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByLabel("North York", { exact: true })).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This barcode belongs to another product. Use a different barcode.",
  );
  await dialog.getByLabel("Barcode", { exact: true }).fill("DEMO-ORCHARD-NEW");
  await dialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Orchard Pears", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  const product = saved.products.find(
    (record: { name_en: string }) => record.name_en === "Orchard Pears",
  );
  expect(product.status).toBe("active");
  expect(product.code).toBe("0017");
  expect(saved.stock[`Branch 1:${product.code}`]).toBeUndefined();
  expect(
    saved.stock_movements.filter(
      (movement: { product_code: string }) =>
        movement.product_code === product.code,
    ),
  ).toHaveLength(0);
});

test("worker catalog actions stay hidden while invoice quick-add creates a Proposed supplier without balances", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#suppliers");
  await expect(
    page.getByRole("button", { name: "Add supplier", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#products");
  await expect(
    page.getByRole("button", { name: "Add product", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Manual entry", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Invoice details", exact: true })
    .click();
  await chooseOption(
    page,
    page
      .locator("#invoice-details-fields")
      .getByLabel("Supplier", { exact: true }),
    "__add_supplier",
    "+ Add supplier",
  );
  const dialog = page.getByRole("dialog", {
    name: "Add supplier",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Opening balance", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Supplier name", { exact: true })
    .fill("Worker Proposed Supply");
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  expect(
    saved.suppliers.find(
      (supplier: { name: string }) =>
        supplier.name === "Worker Proposed Supply",
    ).status,
  ).toBe("proposed");
  expect(saved.invoice.supplier_confirmed).toBe(false);
  await signIn(page, "Cashier");
  await page.goto("/#suppliers");
  await expect(
    page.getByRole("button", { name: "Add supplier", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#products");
  await expect(
    page.getByRole("button", { name: "Add product", exact: true }),
  ).toHaveCount(0);
});

test("manual invoice uses both shared add forms, keeps its lines on attachment and requires the original before posting", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await chooseOption(
    page,
    page
      .locator("#invoice-details-fields")
      .getByLabel("Supplier", { exact: true }),
    "__add_supplier",
    "+ Add supplier",
  );
  const supplierDialog = page.getByRole("dialog", {
    name: "Add supplier",
    exact: true,
  });
  await supplierDialog
    .getByLabel("Supplier name", { exact: true })
    .fill("Manual Invoice Supply");
  await supplierDialog
    .getByLabel("Payment terms", { exact: true })
    .fill("Net 30");
  await supplierDialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await page
    .getByLabel("Supplier invoice number (optional)", { exact: true })
    .fill("DEMO-MANUAL-1");
  await page
    .getByRole("button", { name: "+ Add new product", exact: true })
    .click();
  const productDialog = page.getByRole("dialog", {
    name: "Add product",
    exact: true,
  });
  await productDialog
    .getByLabel("English name", { exact: true })
    .fill("Manual Orchard Pears");
  await productDialog
    .getByLabel("Persian name", { exact: true })
    .fill("گلابی ورود دستی");
  await productDialog.getByLabel("Unit size", { exact: true }).fill("500 g");
  await productDialog
    .getByLabel("Last unit cost before tax", { exact: true })
    .fill("1.4000");
  await chooseOption(
    page,
    productDialog.getByLabel("Pricing category", { exact: true }),
    "grocery",
    "Grocery",
  );
  await productDialog
    .getByRole("button", { name: "Add product", exact: true })
    .click();
  await expect(productDialog).not.toBeVisible();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  const line = page.locator(".invoice-line");
  await line.getByRole("button", { name: "No", exact: true }).click();
  await line
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(invoiceImage);
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  expect(saved.invoice).toMatchObject({
    status: "posted",
    entry_mode: "manual",
    supplier: "Manual Invoice Supply",
    supplier_invoice_number: "DEMO-MANUAL-1",
  });
  expect(
    saved.ledger.find(
      (entry: { reference: string }) => entry.reference === "DEMO-MANUAL-1",
    ),
  ).toMatchObject({ type: "invoice", supplier: "Manual Invoice Supply" });
  expect(saved.invoice.lines).toHaveLength(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
});

test("Persian Add product dialog remains centered and its pricing category popover accepts a real selection", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await setLanguage(page, "fa");
  await page.getByRole("button", { name: "افزودن محصول", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "افزودن محصول",
    exact: true,
  });
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2),
  ).toBeLessThanOrEqual(2);
  await chooseOption(
    page,
    dialog.getByLabel("دستهٔ قیمت‌گذاری", { exact: true }),
    "rice",
    "برنج",
  );
  await expect(
    dialog.getByLabel("دستهٔ قیمت‌گذاری", { exact: true }),
  ).toHaveText("برنج");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "افزودن محصول", exact: true }),
  ).toBeFocused();
});
