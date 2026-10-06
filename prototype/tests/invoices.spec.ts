import { expect, test, type Page } from "@playwright/test";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUjYAAAAASUVORK5CYII=",
  "base64",
);
async function signInWorker(page: Page) {
  await page.goto("/");
  await page.getByRole("radio", { name: "Floor Worker", exact: true }).click();
  await page.getByLabel("Demo PIN", { exact: true }).fill("2222");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Invoices", exact: true }),
  ).toBeVisible();
}
async function upload(page: Page) {
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles({
      name: "fictional-supplier-invoice.png",
      mimeType: "image/png",
      buffer: pixel,
    });
  await expect(
    page.getByRole("status").filter({ hasText: "Reading invoice…" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review invoice lines" }),
  ).toBeVisible({ timeout: 8000 });
  await expect(page.locator(".invoice-line")).toHaveCount(6);
}
async function stored(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );
}

test("simulated upload, review, lower-price answer and two partial chip deliveries conserve stock and cents", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await signInWorker(page);
  await expect(
    page.getByText("Demo: AI invoice reading is simulated", { exact: true }),
  ).toBeVisible();
  await upload(page);
  const sumac = page.locator(".invoice-line").nth(1);
  await sumac.getByLabel("Unit cost before tax", { exact: true }).fill("1.60");
  await expect(sumac.locator(".price-display")).toHaveText("$2.99");
  await sumac.getByLabel("Unit cost before tax", { exact: true }).fill("1.30");
  await expect(sumac.locator(".price-display")).toHaveText("$1.99");
  const chips = page.locator(".invoice-line").nth(5);
  await chips.getByLabel("Mark as short", { exact: true }).check();
  await expect(chips.getByText(/Deduction:/)).toContainText("$7.23");
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Is the expiry date the same as the stock on hand?", {
      exact: true,
    })
    .selectOption("unknown");
  await page
    .getByLabel("What information is unknown? (required)", { exact: true })
    .fill("Demo only: old stock label cannot be read.");
  for (const checkbox of await page
    .getByLabel("Confirm date tracking decision", { exact: true })
    .all())
    await checkbox.check();
  for (const checkbox of await page
    .getByLabel("Confirm this invoice line", { exact: true })
    .all())
    await checkbox.check();
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByLabel("What information is unknown? (required)", { exact: true }),
  ).toHaveValue("Demo only: old stock label cannot be read.");
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Post invoice", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Posted.");
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toHaveCount(0);
  let state = await stored(page);
  expect(state.stock["Branch 1:0009"]).toBe(8);
  expect(state.invoice.payable_after_open_shorts).toBe("169.79");
  expect(
    state.alerts.filter(
      (alert: { type: string }) => alert.type === "lower_price",
    ),
  ).toHaveLength(1);
  await page
    .getByLabel("Delivery document reference", { exact: true })
    .fill("FICTITIOUS-CHIPS-1");
  await page
    .getByRole("button", { name: "Receive short delivery", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("$3.62");
  state = await stored(page);
  expect(state.stock["Branch 1:0009"]).toBe(10);
  await page
    .getByLabel("Delivery document reference", { exact: true })
    .fill("FICTITIOUS-CHIPS-2");
  await page
    .getByRole("button", { name: "Receive short delivery", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("$3.61");
  state = await stored(page);
  expect(state.stock["Branch 1:0009"]).toBe(12);
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
  await signInWorker(page);
  await page
    .getByRole("button", { name: "Enter manually without a file", exact: true })
    .click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  await page
    .getByLabel("Confirm date tracking decision", { exact: true })
    .check();
  await page.getByLabel("Confirm this invoice line", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  await expect(
    page.getByLabel("Confirm this invoice line", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText("Add the original invoice (PDF or photo) before posting.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  const state = await stored(page);
  expect(state.invoice.status).toBe("draft");
  expect(state.ledger).toHaveLength(0);
});

test("Persian invoice review mirrors the shell and keeps Western price digits", async ({
  page,
}) => {
  await signInWorker(page);
  await upload(page);
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "بررسی ردیف‌های فاکتور", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("دمو: خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".invoice-line").nth(0).locator(".price-display"),
  ).toHaveText("$1.49");
  await expect(
    page.getByLabel("تأیید تصمیم پیگیری تاریخ", { exact: true }),
  ).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
