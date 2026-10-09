import { expect, test } from "@playwright/test";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";

test.setTimeout(60000);
const storage = "supermarket-prototype-v1";

test("Supervisor adds a quoted supplier item without invented purchases and worker views stay nonfinancial", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  const table = page.locator(".supplier-items-table");
  await expect(
    table.getByRole("columnheader", {
      name: "Last bought / case",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  expect(
    await dialog.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(720);
  await chooseOption(
    page,
    dialog.getByLabel("Product", { exact: true }),
    "0004",
    "0004 · Black Tea 450 g",
  );
  await dialog.getByLabel("Supplier code", { exact: true }).fill("C2-TEA");
  await dialog.getByLabel("Units per case", { exact: true }).fill("12");
  await dialog.getByLabel("Expected unit cost", { exact: true }).fill("3.55");
  expect(
    await dialog
      .getByLabel("Units per case", { exact: true })
      .evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(160);
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const item = table.getByRole("row").filter({ hasText: "C2-TEA" });
  await expect(item).toContainText("Case of 12");
  await expect(item.locator(".money")).toHaveCount(0);
  await expect(item.locator("td").nth(5)).toHaveText("—");
  await expect(item.locator("td").nth(6)).toHaveText("—");
  await item.getByRole("button", { name: "History", exact: true }).click();
  const history = page.getByRole("dialog", {
    name: "Price history",
    exact: true,
  });
  await expect(history).toContainText("No purchase history yet.");
  await expect(history).toContainText("Expected unit cost");
  await expect(history).toContainText("$3.5500");
  await page.keyboard.press("Escape");
  await expect(history).not.toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storage,
  );
  expect(
    saved.supplier_items.find(
      (record: { supplier_item_code: string }) =>
        record.supplier_item_code === "C2-TEA",
    ),
  ).toMatchObject({
    units_per_case: 12,
    quoted_unit_cost_before_tax: "3.5500",
  });
  await page.reload();
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  await expect(
    page
      .locator(".supplier-items-table")
      .getByRole("row")
      .filter({ hasText: "C2-TEA" }),
  ).toBeVisible();
  await signIn(page, "Floor Worker");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  const content = page.locator(".supplier-tab-card");
  await expect(content.locator(".money")).toHaveCount(0);
  await expect(
    content.getByRole("button", { name: /^(Add item|Edit|History)$/ }),
  ).toHaveCount(0);
  await expect(
    content.getByRole("columnheader", { name: /Last bought \/ (case|unit)/ }),
  ).toHaveCount(0);
  await expect(
    content.getByRole("row").filter({ hasText: "C2-TEA" }),
  ).toContainText("Case of 12");
  await setLanguage(page, "fa");
  await expect(
    page
      .locator(".supplier-tabs")
      .getByRole("tab", { name: "کالاهای تأمین‌کننده", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(content.locator(".money")).toHaveCount(0);
  await expect(
    content.locator(
      "select, input[type='number'], input[type='date'], input[type='checkbox']",
    ),
  ).toHaveCount(0);
});

test("remembered pack and supplier code edits preserve posted history and remain keyboard accessible", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  const original = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).invoices,
    storage,
  );
  const table = page.locator(".supplier-items-table");
  const row = table.getByRole("row").filter({ hasText: "0002" }).first();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
  await editor.getByLabel("Supplier code", { exact: true }).fill("C2-PACK");
  await editor.getByLabel("Units per case", { exact: true }).fill("12");
  await editor.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(editor).not.toBeVisible();
  const edited = table.getByRole("row").filter({ hasText: "C2-PACK" });
  await expect(edited).toContainText("Case of 12");
  await edited.focus();
  await page.keyboard.press("Enter");
  const history = page.getByRole("dialog", {
    name: "Price history",
    exact: true,
  });
  await expect(
    history.locator(".supplier-item-price-history tbody tr"),
  ).not.toHaveCount(0);
  await expect(history.locator(".supplier-item-price-history")).toContainText(
    "Case of 1",
  );
  expect(
    await history.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(720);
  await page.keyboard.press("Escape");
  await expect(history).not.toBeVisible();
  const after = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).invoices,
    storage,
  );
  expect(after).toEqual(original);
  await page
    .locator(".topbar")
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await setLanguage(page, "fa");
  await expect(edited).toContainText("C2-PACK");
  await edited.getByRole("button", { name: "تاریخچه", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "تاریخچه قیمت", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".supplier-item-price-history bdi.money").first(),
  ).toHaveAttribute("dir", "ltr");
});
