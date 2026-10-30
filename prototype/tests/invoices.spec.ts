import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  signIn,
  chooseOption,
  confirmInvoiceLine,
  setLanguage,
  openInvoiceUpload,
  openInvoiceLine,
  openInvoiceDetails,
} from "./helpers";

test.setTimeout(60000);

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUjYAAAAASUVORK5CYII=",
  "base64",
);
async function signInWorker(page: Page) {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await expect(
    page.getByRole("heading", { name: "Invoices", exact: true }),
  ).toBeVisible();
}
async function upload(page: Page) {
  await (
    await openInvoiceUpload(page)
  ).setFiles({
    name: "fictional-supplier-invoice.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await expect(
    page.getByRole("status").filter({ hasText: "Reading invoice…" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Invoice lines" }),
  ).toBeVisible({ timeout: 8000 });
  await expect(page.locator(".invoice-line")).toHaveCount(6, {
    timeout: 10000,
  });
  await expect
    .poll(() =>
      readCanonicalBusinessEvidence(page).then((canonicalState) => {
        const invoice = JSON.parse(JSON.stringify(canonicalState)!).invoice;
        return {
          fileName: invoice.file_name,
          originalHash: invoice.file_data?.split(":").at(-1),
          status: invoice.status,
        };
      }),
    )
    .toEqual({
      fileName: "fictional-supplier-invoice.png",
      originalHash: createHash("sha256").update(pixel).digest("hex"),
      status: "review",
    });
}
async function stored(page: Page) {
  return readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
}

test("simulated upload, review, lower-price answer and two partial chip deliveries conserve stock and cents", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await signInWorker(page);
  // The unread retained original now opens from its real Drafts row.
  await page
    .locator(".invoice-saved-table tbody tr td:first-child a")
    .first()
    .click();
  await expect(
    page.getByRole("complementary", { name: "Original invoice", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    "AI invoice reading is simulated",
  );
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  const before = await stored(page);
  const beforeStock = before.stock["Branch 1:0009"];
  await upload(page);
  expect(await page.evaluate(() => typeof globalThis.crypto.randomUUID)).toBe(
    "undefined",
  );
  const sumac = await openInvoiceLine(page, 1);
  await sumac.getByLabel("Unit cost before tax", { exact: true }).fill("1.60");
  await expect(sumac.locator(".price-display")).toHaveText("$2.99");
  await sumac.getByLabel("Unit cost before tax", { exact: true }).fill("1.30");
  await expect(sumac.locator(".price-display")).toHaveText("$1.99");
  const chips = await openInvoiceLine(page, 5);
  await chips
    .getByRole("button", { name: "Report short or refused", exact: true })
    .click();
  await chips.getByLabel("Short units", { exact: true }).fill("4");
  await expect(chips.getByText(/Deduction:/)).toContainText("$6.40");
  await expect(chips.getByText(/Delivered units:/)).toContainText("8");
  await chips.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    chips.getByLabel("Delivered units", { exact: true }),
  ).toHaveValue("8");
  await chips.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Post invoice", exact: true })
    .click({ force: true });
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toBeVisible();
  await chooseOption(
    page,
    page.getByLabel(
      "Is the expiry date the same as the goods already in the store?",
      {
        exact: true,
      },
    ),
    "unknown",
    "Unknown — add a note",
  );
  await page
    .getByRole("alert", { name: "What's missing", exact: true })
    .locator(".receiving-missing-row")
    .filter({ hasText: "Lower-cost receipt note is empty" })
    .getByRole("button", { name: "Show", exact: true })
    .click();
  await expect(page.locator("#invoice-lower-note")).toBeFocused();
  await page
    .getByLabel("What information is unknown? (required)", { exact: true })
    .fill("Demo only: old stock label cannot be read.");
  for (let index = 0; index < 6; index++) {
    const line = await openInvoiceLine(page, index);
    const track = line.getByRole("group", { name: "Track date", exact: true });
    await track.getByRole("button", { name: "No", exact: true }).click();
    await confirmInvoiceLine(page, line);
  }
  await openInvoiceDetails(page);
  await page
    .getByRole("button", { name: "Looks right: Invoice details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Looks right: Totals", exact: true })
    .click();
  const savedRoute = page.url();
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await page.goto(savedRoute);
  await page.reload();
  await expect(
    page.getByLabel("What information is unknown? (required)", { exact: true }),
  ).toHaveValue("Demo only: old stock label cannot be read.");
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  const beforePost = await stored(page);
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Post invoice",
    exact: true,
  });
  await expect(confirmation).toBeVisible();
  expect((await stored(page)).invoice).toEqual(beforePost.invoice);
  expect((await stored(page)).ledger).toEqual(beforePost.ledger);
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect((await stored(page)).invoice).toEqual(beforePost.invoice);
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Post invoice", exact: true })
    .getByRole("button", { name: "Post invoice", exact: true })
    .click();
  await expect(page.locator(".posted-invoice-title-row")).toContainText(
    "Posted",
  );
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toHaveCount(0);
  let state = await stored(page);
  expect(state.stock["Branch 1:0009"]).toBe(beforeStock + 8);
  expect(state.invoice.payable_after_open_shorts).toBe("169.79");
  expect(
    state.alerts.filter(
      (alert: { type: string }) => alert.type === "lower_price",
    ),
  ).toHaveLength(1);
  const deliveryReference = page.getByLabel("Delivery document reference", {
    exact: true,
  });
  const deliveryQuantity = page.getByLabel("Actual units received now", {
    exact: true,
  });
  await deliveryReference.fill("");
  await deliveryQuantity.fill("0");
  await page
    .getByRole("button", { name: "Receive short delivery", exact: true })
    .click();
  await expect(deliveryReference).toHaveAttribute("aria-invalid", "true");
  await expect(deliveryQuantity).toHaveAttribute("aria-invalid", "true");
  await deliveryReference.fill("FICTITIOUS-CHIPS-1");
  await expect(deliveryReference).toHaveAttribute("aria-invalid", "false");
  await expect(deliveryQuantity).toHaveAttribute("aria-invalid", "true");
  await deliveryQuantity.fill("2");
  await expect(deliveryQuantity).toHaveAttribute("aria-invalid", "false");
  await page
    .getByLabel("Delivery document reference", { exact: true })
    .fill("FICTITIOUS-CHIPS-1");
  await page
    .getByRole("button", { name: "Receive short delivery", exact: true })
    .click();
  await expect(page.locator(".banner[role=status]")).toContainText("$3.62");
  state = await stored(page);
  expect(state.stock["Branch 1:0009"]).toBe(beforeStock + 10);
  await page
    .getByLabel("Delivery document reference", { exact: true })
    .fill("FICTITIOUS-CHIPS-2");
  await page
    .getByRole("button", { name: "Receive short delivery", exact: true })
    .click();
  await expect(page.locator(".banner[role=status]")).toContainText("$3.61");
  state = await stored(page);
  expect(state.stock["Branch 1:0009"]).toBe(beforeStock + 12);
  expect(state.invoice.payable_after_open_shorts).toBe("177.02");
  expect(
    state.ledger
      .filter((entry: { type: string }) => entry.type === "short_restoration")
      .map((entry: { amount: string }) => entry.amount),
  ).toEqual(["3.62", "3.61"]);
  expect(browserErrors).toEqual([]);
});

test("manual draft survives a refresh and cannot post without its original", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await chooseOption(
    page,
    page.getByLabel("Add a product to the invoice", { exact: true }),
    "0002",
    "Canned Fava Beans 400 g",
  );
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const editor = await openInvoiceLine(page, 0);
  await editor
    .getByRole("group", { name: "Track date", exact: true })
    .getByRole("button", { name: "No", exact: true })
    .click();
  await confirmInvoiceLine(page, editor);
  const savedRoute = page.url();
  await page
    .getByRole("button", { name: "Save and close", exact: true })
    .click();
  await page.goto(savedRoute);
  await page.reload();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await expect(
    page
      .locator(".invoice-line")
      .getByRole("img", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".invoice-line")).toHaveAttribute(
    "data-expanded",
    "false",
  );
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Post invoice", exact: true })
    .click({ force: true });
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toContainText("Original invoice is missing. Attach its PDF or photo.");
  const state = await stored(page);
  expect(state.invoice.status).toBe("draft");
  expect(
    state.ledger.filter(
      (entry: { invoice_id?: string }) => entry.invoice_id === state.invoice.id,
    ),
  ).toHaveLength(0);
});

test("Persian invoice review mirrors the shell and keeps Western price digits", async ({
  page,
}) => {
  await signInWorker(page);
  await upload(page);
  await setLanguage(page, "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "ردیف‌های فاکتور", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است", {
      exact: true,
    }),
  ).toHaveCount(0);
  const line = await openInvoiceLine(page, 0);
  await expect(line.locator(".price-display")).toHaveText("$1.99");
  await expect(
    page.getByRole("group", { name: "پیگیری تاریخ", exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
