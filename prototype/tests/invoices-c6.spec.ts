import { openInvoiceDetails } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, signIn, invoiceImage } from "./helpers";
import type { DemoState } from "../src/types";

const stored = async (page: Page): Promise<DemoState> => {
  await expect
    .poll(() => readCanonicalBusinessEvidence(page).then(() => true))
    .toBe(true);
  return readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
};
async function expectOriginal(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    await page.getByRole("button", { name: /^View original \(/ }).click();
    const viewer = page.getByRole("dialog", {
      name: "Original invoice",
      exact: true,
    });
    await expect(viewer.locator("img").last()).toBeVisible();
    await viewer
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  } else await expect(page.locator(".original-viewer-panel img")).toBeVisible();
}

async function manual(page: Page) {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
  await openInvoiceDetails(page);
  await expect(page.locator("#invoice-details-fields")).toBeVisible();
}

test("manual invoice uses local time, term dates and editable computed totals without autosave Undo", async ({
  page,
}) => {
  await manual(page);
  const before = await stored(page);
  const local = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone: before.config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(before.invoice.received_at!));
  const part = (type: string) =>
    local.find((item) => item.type === type)?.value;
  await page
    .locator(".receiving-received-summary")
    .getByRole("button", { name: "Change", exact: true })
    .click();
  await expect(page.locator("#invoice-received-date")).toContainText(
    `${part("year")}-${part("month")}-${part("day")}`,
  );
  await expect(page.getByLabel("Received time", { exact: true })).toHaveValue(
    `${part("hour")}:${part("minute")}`,
  );
  await page.getByLabel("Received time", { exact: true }).fill("20:10");
  const received = (await stored(page)).invoice.received_at!;
  expect(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: before.config.company.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(received)),
  ).toBe("20:10");
  await chooseOption(
    page,
    page.getByLabel("Payment terms (optional)", { exact: true }),
    "30",
    "Net 30 (30 days)",
  );
  const invoice = (await stored(page)).invoice;
  const expectedDue = new Date(`${invoice.invoice_date}T12:00:00Z`);
  expectedDue.setUTCDate(expectedDue.getUTCDate() + 30);
  expect(invoice.due_date).toBe(expectedDue.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Edit totals", exact: true }).click();
  const subtotal = page.getByLabel("Subtotal", { exact: true });
  await subtotal.fill("");
  await expect(page.getByTestId("invoice-totals-card")).toBeVisible();
  await expect
    .poll(async () => (await stored(page)).invoice.subtotal)
    .toBe("0.00");
  // While the person is still in the box it keeps what they typed (blank);
  // the saved 0.00 shows once they leave it.
  await expect(subtotal).toHaveValue("");
  await subtotal.blur();
  await expect(subtotal).toHaveValue("0.00");
  await expect(page.getByTestId("invoice-totals-card")).toContainText(
    "Calculated · not on the paper",
  );
  await page.getByLabel("Subtotal", { exact: true }).fill("400.00");
  await page.getByLabel("Tax", { exact: true }).fill("52.00");
  await expect(page.getByLabel("Invoice total", { exact: true })).toHaveValue(
    "452.00",
  );
  await page.getByLabel("Invoice total", { exact: true }).fill("450.00");
  await expect(
    page
      .locator(".receiving-total-edit")
      .filter({ has: page.getByLabel("Invoice total", { exact: true }) }),
  ).toContainText(/Difference.*2\.00/);
  await expect(page.locator(".undo-toast")).toHaveCount(0);
  const post = page.getByRole("button", { name: "Post invoice", exact: true });
  await expect(post).toBeDisabled();
  await expect(post).toHaveAttribute("aria-disabled", "true");
  await post.press("Enter");
  const missing = page.locator("#invoice-missing-list");
  await expect(missing).toBeVisible();
  await missing
    .locator(".receiving-missing-row")
    .filter({
      hasText: "Original invoice is missing. Attach its PDF or photo.",
    })
    .getByRole("button", { name: "Show", exact: true })
    .click();
  await expect(
    page.locator(
      "#invoice-original-field [data-invoice-attach]:visible, #invoice-original-field .original-viewer-phone-trigger:visible",
    ),
  ).toBeFocused();
  expect((await stored(page)).invoice.status).not.toBe("posted");
});

test("new invoice supplier requires only its name and never creates an approval or financial entry", async ({
  page,
}) => {
  await manual(page);
  const before = await stored(page);
  await chooseOption(
    page,
    page.locator("#invoice-supplier"),
    "__add_supplier",
    "+ Add supplier",
  );
  const add = page.getByRole("dialog", { name: "Add supplier", exact: true });
  await add
    .getByLabel("Supplier name", { exact: true })
    .fill("Fictional C6 Receiving Supplier");
  await add.getByRole("button", { name: "Add supplier", exact: true }).click();
  await expect(add).not.toBeVisible();
  const saved = await stored(page);
  const supplier = saved.suppliers!.find(
    (item) => item.name === "Fictional C6 Receiving Supplier",
  )!;
  expect(supplier).toMatchObject({
    status: "confirmed",
    active: true,
    phone: "",
    email: "",
    payment_terms: "",
  });
  expect(saved.invoice.supplier_confirmed).toBe(true);
  expect(
    saved.approvals.filter((item) => item.supplier_id === supplier.id),
  ).toEqual([]);
  expect(saved.ledger).toEqual(before.ledger);
  expect(saved.invoice.status).not.toBe("posted");
  await expect(
    page.getByRole("button", { name: "Confirm supplier", exact: true }),
  ).toHaveCount(0);
  // A confirmed supplier does not make an empty, unattached draft postable.
  const post = page.getByRole("button", { name: "Post invoice", exact: true });
  await expect(post).toBeDisabled();
  await expect(post).toHaveAttribute("aria-disabled", "true");
});

test("Remove line is confirmed and reversible while ordinary field edits stay silent", async ({
  page,
}) => {
  await manual(page);
  const product = (await stored(page)).products.find(
    (item) => item.code === "0009",
  )!;
  await chooseOption(
    page,
    page.locator("#invoice-add-product"),
    product.code,
    product.name_en,
  );
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const original = (await stored(page)).invoice.lines;
  await expect(page.locator(".invoice-line-summary")).toContainText("1 unit");
  await page.locator(".invoice-line-summary").click();
  await expect(page.locator("#invoice-line-0-invoiced")).toBeVisible();
  await expect(
    page.getByLabel("Delivered units", { exact: true }),
  ).toBeVisible();
  expect(original[0].qty_invoiced).toBe(1);
  await expect(page.locator(".undo-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove line", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Remove line?",
    exact: true,
  });
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await confirmation
    .getByRole("button", { name: "Remove line", exact: true })
    .click();
  await expect(page.locator(".invoice-line")).toHaveCount(0);
  await expect(page.locator(".undo-toast")).toHaveCount(1);
  await page
    .locator(".undo-toast")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  expect((await stored(page)).invoice.lines).toEqual(original);
});

test("Received has one range control and supplier cards open scoped records", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#received");
  await expect(
    page.getByRole("button", { name: "Date range", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Date range", exact: true }).click();
  const range = page.getByRole("dialog", { name: "Date range", exact: true });
  await expect(range.getByLabel("From", { exact: true })).toBeVisible();
  await expect(range.getByLabel("To", { exact: true })).toBeVisible();
  await range.getByRole("button", { name: "This month", exact: true }).click();
  await expect(range).not.toBeVisible();
  const supplierRoute = `/#suppliers?name=${encodeURIComponent("Fresh Valley Foods")}`;
  await page.goto(supplierRoute);
  await expect(
    page.locator(".supplier-kpis").getByRole("button", { name: /^Balance/ }),
  ).toHaveCount(0);
  await page
    .locator(".supplier-kpis")
    .getByRole("button", { name: /^Last delivery/ })
    .click();
  await expect(page).toHaveURL(/#invoices\?id=/);
  await page.goto(supplierRoute);
  await page
    .locator(".supplier-kpis")
    .getByRole("button", { name: /^Deliveries this month/ })
    .click();
  await expect(page).toHaveURL(/supplier=Fresh%20Valley%20Foods.*tab=posted/);
  await expect(
    page.getByRole("tab", { name: /^Posted\s+\d+$/ }),
  ).toHaveAttribute("aria-selected", "true");
  const selected = await stored(page);
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: selected.config.company.timezone,
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
  const query = new URLSearchParams(new URL(page.url()).hash.split("?")[1]);
  expect(query.get("from")!.slice(0, 7)).toBe(month);
  await page.goto(supplierRoute);
  await page
    .locator(".supplier-kpis")
    .getByRole("button", { name: /^Open returns/ })
    .click();
  await expect(page).toHaveURL(
    /#returns\?supplier=Fresh%20Valley%20Foods&tab=open/,
  );
});

test("New invoice preserves an unsaved draft and its durable original instead of replacing them", async ({
  page,
}) => {
  await manual(page);
  await page
    .getByLabel("Invoice number", { exact: true })
    .fill("C6-RETAINED-DRAFT");
  const product = (await stored(page)).products.find(
    (item) => item.code === "0009",
  )!;
  await chooseOption(
    page,
    page.locator("#invoice-add-product"),
    product.code,
    product.name_en,
  );
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page.locator(".invoice-line-summary").click();
  await page.locator("#invoice-line-0-invoiced").fill("2");
  await page
    .locator("#invoice-line-0-detail")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByLabel(/^(Attach original|Replace file)$/)
    .setInputFiles(invoiceImage);
  await expectOriginal(page);
  const prior = (await stored(page)).invoice;
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
  await openInvoiceDetails(page);
  await expect
    .poll(async () => (await stored(page)).invoice.id)
    .not.toBe(prior.id);
  const saved = await stored(page);
  expect(saved.invoices!.find((invoice) => invoice.id === prior.id)).toEqual(
    prior,
  );
  expect(prior.file_data).toMatch(/^idb-file:v1:/);
  await page.goto(`/#invoices?id=${encodeURIComponent(prior.id)}`);
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await expectOriginal(page);
  expect((await stored(page)).invoice.lines).toEqual(prior.lines);
});
