import { expect, test } from "@playwright/test";
import { invoiceImage, setBranch, signIn } from "./helpers";

const storage = "supermarket-prototype-v1";
test.setTimeout(60000);

test("a Floor Worker cannot read another branch's manual draft, and starting their own invoice preserves it for the Supervisor", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 2");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "Manual entry", exact: true }).click();
  await page
    .getByLabel("Supplier invoice number (optional)", { exact: true })
    .fill("PRIVATE-BRANCH-2");
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  const original = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).invoice,
    storage,
  );
  expect(original.branch).toBe("Branch 2");

  await signIn(page, "Floor Worker");
  await expect(
    page.getByText("PRIVATE-BRANCH-2", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByLabel("Supplier invoice number (optional)", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Review invoice lines", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  const own = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  expect(own.invoice.branch).toBe("Branch 1");
  expect(
    own.invoices.find((invoice: { id: string }) => invoice.id === original.id),
  ).toEqual(original);

  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 2");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "Resume draft", exact: true }).click();
  await expect(
    page.getByLabel("Supplier invoice number (optional)", { exact: true }),
  ).toHaveValue("PRIVATE-BRANCH-2");
  const resumed = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).invoice,
    storage,
  );
  expect(resumed).toEqual(original);
});

test("another branch's reading draft stays hidden and unchanged by reading timers or Demo answers", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 2");
  await page.goto("/#invoices");
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page
    .getByLabel("Upload a PDF or photo", { exact: true })
    .setInputFiles(invoiceImage);
  await expect(
    page.getByText("Reading invoice…", { exact: true }),
  ).toBeVisible();
  const original = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).invoice,
    storage,
  );
  expect(original.status).toBe("reading");
  await signIn(page, "Floor Worker");
  await expect(
    page.getByLabel("Upload a PDF or photo", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Use fictional demo answer", exact: true })
    .click();
  await page.clock.runFor(2800);
  const untouched = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).invoice,
    storage,
  );
  expect(untouched).toEqual(original);
  await page.reload();
  await page.clock.runFor(2800);
  const reloaded = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).invoice,
    storage,
  );
  expect(reloaded).toEqual(original);
});
