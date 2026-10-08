import { expect, test, type Page } from "@playwright/test";
import { chooseOption, signIn, setBranch, resetDemo } from "./helpers";

test.setTimeout(60000);

async function lookup(page: Page, code: string, price: string) {
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill(code);
  await expect(page.locator(".price")).toHaveText(price);
}

async function approveLavash(page: Page, scope: "branch" | "all") {
  await page.goto("/#approvals");
  const card = page.locator("section.card").filter({
    has: page.getByRole("heading", {
      name: "Lavash Bread 500 g",
      exact: true,
    }),
  });
  await card
    .getByRole("button", { name: "Approve price", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await chooseOption(
    page,
    dialog.getByLabel("Apply price to", { exact: true }),
    scope,
    scope === "all" ? "All branches" : "This branch only",
  );
  await expect(dialog).toContainText("$1.99");
  await expect(dialog).toContainText("$2.99");
  await dialog
    .getByRole("button", { name: "Approve price", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}

test("live role switches keep cashier approved price until branch approval; new product approves for all", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "cashier");
  await lookup(page, "0006", "$1.99");
  await expect(
    page.getByText("New price pending", { exact: true }),
  ).toBeVisible();
  await signIn(page, "supervisor");
  await approveLavash(page, "branch");
  await signIn(page, "cashier");
  await lookup(page, "0006", "$2.99");
  await expect(
    page.getByText("New price pending", { exact: true }),
  ).toHaveCount(0);
  await signIn(page, "supervisor");
  await setBranch(page, "Branch 2");
  await lookup(page, "0006", "$1.99");
  await setBranch(page, "all");
  await page.goto("/#approvals");
  const barberries = page.locator("section.card").filter({
    has: page.getByRole("heading", {
      name: "Dried Barberries 100 g",
      exact: true,
    }),
  });
  await barberries
    .getByRole("button", { name: "Approve product", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Apply price to", { exact: true })).toHaveText(
    "All branches",
  );
  await dialog
    .getByRole("button", { name: "Approve product", exact: true })
    .click();
  await setBranch(page, "Branch 2");
  await lookup(page, "0015", "$5.49");
  await expect(
    page.getByText("Pending: confirm with a Supervisor before selling", {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("intentional tea conflicts stay quiet, and applying a selected price clears all branch overrides", async ({
  page,
}) => {
  await signIn(page, "supervisor");
  await page.goto("/#alerts");
  await expect(page.getByText("$6.49", { exact: true })).toBeVisible();
  await expect(page.getByText("$6.99", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Mark as intentional", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as intentional", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "Show resolved and intentional alerts",
      exact: true,
    })
    .check();
  await expect(page.getByText("Intentional", { exact: true })).toBeVisible();
  await resetDemo(page);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Branch 2", exact: true }) });
  await row
    .getByRole("button", { name: "Apply this price to all", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Apply price to all branches", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as intentional", exact: true }),
  ).toHaveCount(0);
  for (const branch of ["Branch 1", "Branch 2", "Branch 3"]) {
    await setBranch(page, branch);
    await lookup(page, "0004", "$6.99");
  }
});

test("approved Lavash suggests a worker-confirmed offer and joins juice and chips in the same pool", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "supervisor");
  await approveLavash(page, "branch");
  await signIn(page, "floor_worker");
  await page.goto("/#offers");
  const task = page
    .locator(".offer-task")
    .filter({ hasText: "Lavash Bread 500 g" });
  await expect(
    task.getByRole("button", { name: "Confirm offer: 2 for $5", exact: true }),
  ).toBeVisible();
  const toggle = task.getByRole("checkbox", {
    name: "Join the mix-and-match pool",
    exact: true,
  });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await task
    .getByRole("button", { name: "Confirm offer: 2 for $5", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Mix-and-match pools", exact: true })
    .click();
  const pool = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "2 for $5", exact: true }),
  });
  for (const product of [
    "Sour Cherry Juice 1 L",
    "Potato Chips 150 g",
    "Lavash Bread 500 g",
  ])
    await expect(
      pool
        .getByRole("cell")
        .filter({ has: page.getByText(product, { exact: true }) }),
    ).toBeVisible();
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "گروه‌های ترکیبی", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
