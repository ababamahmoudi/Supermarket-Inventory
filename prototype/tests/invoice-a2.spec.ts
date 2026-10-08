import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import receiptFixtures from "../src/fixtures/a2-demo-data.json" with { type: "json" };

test.setTimeout(60000);
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jUjYAAAAASUVORK5CYII=",
  "base64",
);
async function review(page: import("@playwright/test").Page) {
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles({
      name: "fictional-a2-invoice.png",
      mimeType: "image/png",
      buffer: pixel,
    });
  await expect(page.locator(".invoice-line")).toHaveCount(6, {
    timeout: 10000,
  });
}
test("each invoice line requires one date answer, collapses when confirmed and opens from the row", async ({
  page,
}) => {
  await review(page);
  const lines = page.locator(".invoice-line");
  await expect(
    page.getByRole("checkbox", {
      name: "Confirm date tracking decision",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", {
      name: "Track a date for this line",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Post invoice", exact: true }),
  ).toBeDisabled();
  const first = lines.first();
  await first
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await expect(first).toHaveAttribute("data-expanded", "true");
  await first.getByRole("button", { name: "No", exact: true }).click();
  await first
    .getByRole("checkbox", { name: "Confirm this invoice line", exact: true })
    .click();
  await expect(first).toHaveAttribute("data-expanded", "false");
  await expect(first.locator(".invoice-line-detail")).toHaveCount(0);
  await first.locator(".invoice-line-toggle").click();
  await expect(first).toHaveAttribute("data-expanded", "true");
  await first.locator(".invoice-line-summary td").nth(3).click();
  await expect(first).toHaveAttribute("data-expanded", "false");
  await expect(
    lines.nth(4).getByText("No Product Code yet", { exact: true }),
  ).toBeVisible();
  await expect(
    lines.nth(2).getByText("Pending", { exact: true }),
  ).toBeVisible();
  await expect(
    lines.nth(2).getByText("Goes to approval when posted", { exact: true }),
  ).toBeVisible();
  const section = page.locator(".invoice-summary-section");
  expect(
    await section
      .locator(".invoice-summary-note")
      .evaluate((note) =>
        Math.round(
          note.getBoundingClientRect().top -
            note.previousElementSibling!.getBoundingClientRect().bottom,
        ),
      ),
  ).toBe(24);
});
test("Persian signed money, line numbers and deduction parentheses stay isolated", async ({
  page,
}) => {
  await review(page);
  await page
    .locator(".invoice-line")
    .nth(5)
    .getByRole("checkbox", { name: "Mark as short", exact: true })
    .check();
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  const deduction = page
    .locator(".invoice-summary-grid .ui-summary-tile")
    .nth(2);
  await expect(deduction).toContainText("-$7.23");
  await expect(deduction.locator('bdi[dir="ltr"]')).toContainText("-$7.23");
  await expect(page.locator(".invoice-line-toggle > bdi").first()).toHaveText(
    "1.",
  );
  const parentheses = page
    .locator(".invoice-line")
    .nth(5)
    .locator(".banner > bdi")
    .last();
  await expect(parentheses).toHaveAttribute("dir", "ltr");
  await expect(parentheses).toContainText("($6.40 + $0.83 )");
});
test("the document sticks beside the review and the action bar has a full surface", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "phone",
    "Phone review uses one stacked column.",
  );
  await page.setViewportSize({ width: 1600, height: 1080 });
  await review(page);
  await page.evaluate(() => window.scrollTo(0, 450));
  const pane = await page.locator(".invoice-document-pane").boundingBox();
  expect(pane!.y).toBeGreaterThanOrEqual(86);
  expect(pane!.y).toBeLessThanOrEqual(90);
  const workspace = await page.locator(".invoice-workspace").boundingBox();
  const footer = await page.locator(".invoice-action-footer").boundingBox();
  expect(Math.abs(workspace!.width - footer!.width)).toBeLessThanOrEqual(2);
  expect(
    await page
      .locator(".invoice-action-footer")
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("manual invoice drafts work when randomUUID is unavailable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#invoices");
  await page
    .getByRole("button", { name: "Enter manually without a file", exact: true })
    .click();
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => window.innerWidth === document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".invoice-line")).toHaveCount(1);
  const invoice = await page.evaluate(
    () => JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).invoice,
  );
  expect(invoice.status).toBe("draft");
  expect(typeof invoice.id).toBe("string");
  expect(invoice.id.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => typeof globalThis.crypto.randomUUID)).toBe(
    "undefined",
  );
  expect(errors).toEqual([]);
});

test("fictional invoice answers are available only inside Demo and retain Persian copy", async ({
  page,
}) => {
  await review(page);
  await expect(
    page.getByText("Use fictional demo answer", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Use fictional demo answer", exact: true })
    .click();
  await expect(
    page.getByLabel("Is the expiry date the same as the stock on hand?", {
      exact: true,
    }),
  ).toHaveText("No, different dates");
  await expect(
    page.getByText("Use fictional demo answer", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(
    page.getByLabel("آیا تاریخ انقضا با موجودی قبلی یکسان است؟", {
      exact: true,
    }),
  ).toHaveText("خیر، تاریخ‌های متفاوت");
  const answer = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).invoice
        .lower_price_answers,
  );
  expect(answer.same_expiry).toBe("no");
  expect(answer.old_expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(answer.new_expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(answer.units_left).toBeGreaterThan(0);
});

test("Supplier invoice links open the actual posted receipt and its original text in either language", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Supervisor");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Invoices", exact: true }).click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "FV-20390", exact: true }) });
  await row.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(/#invoices\?id=/);
  const original = page.locator(".invoice-preview-text");
  await expect(original).toBeVisible();
  await expect(original).toContainText("Fictional prototype invoice FV-20390");
  await expect(original).toContainText("Fresh Valley Foods");
  const receipt = receiptFixtures.invoices.find(
    (invoice) => invoice.number === "FV-20390",
  )!;
  for (const line of receipt.lines) {
    const product = demoSeed.products.find(
      (item) => item.code === line.product_code,
    );
    const name =
      line.product_code === "0015"
        ? demoSeed.demo_invoice.lines.find(
            (item) => item.product_code === "NEW",
          )!.description
        : product?.name_en;
    expect(name).toBeDefined();
    await expect(original).toContainText(
      `${name}: ${line.qty} × ${line.unit_cost}`,
    );
  }
  const invoice = await page.evaluate(
    () => JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).invoice,
  );
  expect(invoice.supplier_invoice_number).toBe("FV-20390");
  expect(invoice.status).toBe("posted");
  await expect(original).toContainText(`Total ${invoice.final_total}`);
  await expect(page.locator(".invoice-preview-image")).toHaveCount(0);
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(original).toHaveAttribute("dir", "ltr");
  await expect(original).toContainText("FV-20390");
  expect(errors).toEqual([]);
});
