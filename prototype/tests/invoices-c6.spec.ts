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
async function manual(page: Page) {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
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
  await expect(page.getByLabel("Received date", { exact: true })).toContainText(
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
    "Monthly (30 days)",
  );
  const invoice = (await stored(page)).invoice;
  const expectedDue = new Date(`${invoice.invoice_date}T12:00:00Z`);
  expectedDue.setUTCDate(expectedDue.getUTCDate() + 30);
  expect(invoice.due_date).toBe(expectedDue.toISOString().slice(0, 10));
  await page.getByLabel("Subtotal", { exact: true }).fill("");
  await expect(
    page.locator(".invoice-summary-grid").getByText("—", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Subtotal", { exact: true })).toHaveValue("");
  await page.getByLabel("Subtotal", { exact: true }).fill("400.00");
  await page.getByLabel("Tax", { exact: true }).fill("52.00");
  await expect(page.getByLabel("Final total", { exact: true })).toHaveValue(
    "452.00",
  );
  await page.getByLabel("Final total", { exact: true }).fill("450.00");
  await expect(
    page.getByText(/Final total differs from Subtotal/),
  ).toBeVisible();
  await expect(page.locator(".undo-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toBeVisible();
  const originalLink = page.getByRole("link", {
    name: "Add the original invoice (PDF or photo) before posting.",
    exact: true,
  });
  await originalLink.click();
  await expect(page.locator("#invoice-original-field")).toHaveClass(
    /validation-field-highlight/,
  );
  expect((await stored(page)).invoice.status).not.toBe("posted");
});

test("new invoice supplier allows omissions and requires completion plus explicit Supervisor confirmation", async ({
  page,
}) => {
  await manual(page);
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
  const proposed = await stored(page);
  const supplier = proposed.suppliers!.find(
    (item) => item.name === "Fictional C6 Receiving Supplier",
  )!;
  expect(supplier.status).toBe("proposed");
  expect(proposed.invoice.status).toBe("review");
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toContainText("Complete the supplier");
  await page
    .locator(".invoice-supplier-review")
    .getByRole("button", { name: "Edit supplier", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: "Edit supplier", exact: true });
  await edit
    .getByRole("button", { name: "Save supplier", exact: true })
    .click();
  await expect(
    edit.getByRole("alert", { name: "What's missing", exact: true }),
  ).toBeVisible();
  await edit.getByLabel("Phone", { exact: true }).fill("416-555-0190");
  await edit.getByLabel("Email", { exact: true }).fill("orders@example.test");
  await edit
    .getByLabel("Sales representative", { exact: true })
    .fill("Fictional Representative");
  await edit
    .getByLabel("Sales rep phone", { exact: true })
    .fill("416-555-0191");
  await chooseOption(
    page,
    edit.getByLabel("Payment terms", { exact: true }),
    "14",
    "Every 2 weeks (14 days)",
  );
  await edit
    .getByRole("button", { name: "Save supplier", exact: true })
    .click();
  await expect(edit).not.toBeVisible();
  expect(
    (await stored(page)).suppliers!.find((item) => item.id === supplier.id)!
      .status,
  ).toBe("proposed");
  await page
    .locator(".invoice-supplier-review")
    .getByRole("button", { name: "Confirm supplier", exact: true })
    .click();
  const confirmed = await stored(page);
  expect(confirmed.invoice.supplier_review_confirmed).toBe(true);
  expect(
    confirmed.suppliers!.find((item) => item.id === supplier.id)!.status,
  ).toBe("confirmed");
  expect(confirmed.ledger).toEqual(proposed.ledger);
  expect(confirmed.invoice.status).not.toBe("posted");
});

test("Remove line is reversible while ordinary field edits stay silent", async ({
  page,
}) => {
  await manual(page);
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const original = (await stored(page)).invoice.lines;
  await expect(page.getByLabel("Invoiced", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Delivered", { exact: true })).toBeVisible();
  await expect(page.locator(".invoice-pack-equation")).toHaveText("1 unit");
  await expect(page.locator(".undo-toast")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove line", exact: true }).click();
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
    page.getByRole("tab", { name: "Posted", exact: true }),
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
    .getByLabel("Supplier invoice number (optional)", { exact: true })
    .fill("C6-RETAINED-DRAFT");
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page.getByLabel("Invoiced", { exact: true }).fill("2");
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(invoiceImage);
  await expect(page.locator(".ui-dropzone .ui-file-chip")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New invoice", exact: true }),
  ).toBeEnabled();
  const prior = (await stored(page)).invoice;
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
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
  await expect(page.locator(".invoice-original-media img")).toBeVisible();
  expect((await stored(page)).invoice.lines).toEqual(prior.lines);
});
