import { expect, test } from "@playwright/test";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";
const STORAGE_KEY = "supermarket-prototype-v1";

test("Supervisor product page uses own route, Back link and shared editor", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await page
    .getByRole("button", { name: "View Potato Chips 150 g", exact: true })
    .click();
  await expect(page).toHaveURL(/#product\?code=0009$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Potato Chips 150 g",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Potato Chips 150 g", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor
    .getByLabel("English name", { exact: true })
    .fill("Potato Chips 150 g edited");
  await editor
    .getByLabel("Description (English)", { exact: true })
    .fill("Crispy potato chips");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Potato Chips 150 g edited",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Potato Chips 150 g edited",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Back to Products", exact: true })
    .click();
  await expect(page).toHaveURL(/#products$/);
});

test("Lookup price editor defaults to all branches and records the signed-in Supervisor", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await page
    .getByRole("button", { name: "Edit Potato Chips 150 g", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor
    .getByLabel("Selling price (per unit)", { exact: true })
    .fill("3.29");
  await expect(editor.getByLabel("Approval scope", { exact: true })).toHaveText(
    /All branches/,
  );
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(page.locator(".lookup-detail .price")).toHaveText("$3.29");
  await setBranch(page, "Branch 2");
  await expect(page.locator(".lookup-detail .price")).toHaveText("$3.29");
  const audit = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).activity.at(-1),
    STORAGE_KEY,
  );
  expect(audit).toMatchObject({
    action: "Save product",
    by: "Demo Supervisor",
    reversible: true,
    scope: "all",
  });
  expect(audit.before.product.selling_price).toBe("2.99");
  expect(audit.after.product.selling_price).toBe("3.29");
});

test("same editor changes this branch only, and validation stays inside the open dialog", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await page
    .getByRole("button", { name: "Edit Potato Chips 150 g", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor
    .getByLabel("Selling price (per unit)", { exact: true })
    .fill("3.291");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText("at most two decimals");
  await expect(editor).toBeVisible();
  await editor
    .getByLabel("Selling price (per unit)", { exact: true })
    .fill("3.29");
  await chooseOption(
    page,
    editor.getByLabel("Approval scope", { exact: true }),
    "branch",
    "This branch only",
  );
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(page.locator(".lookup-detail .price")).toHaveText("$3.29");
  await setBranch(page, "Branch 2");
  await expect(page.locator(".lookup-detail .price")).toHaveText("$2.99");
});

test("Floor Worker and Cashier never see product Edit, including direct product links", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#products");
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  await page.goto("/#product?code=0009");
  await expect(
    page.getByRole("heading", { level: 1, name: "Potato Chips 150 g" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
  await signIn(page, "Cashier");
  await page.goto("/#product?code=0009");
  await expect(
    page.getByRole("heading", { level: 1, name: "Cashier lookup" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
});

test("Lookup columns mirror in Persian, with selected row distinct from offer pill", async ({
  page,
}) => {
  await signIn(page, "Cashier");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  const row = page.locator(".lookup-result-row.is-selected");
  let geometry = await row.evaluate((element) => {
    const name = element
      .querySelector(".lookup-result-name")!
      .getBoundingClientRect();
    const price = element
      .querySelector(".lookup-result-price")!
      .getBoundingClientRect();
    return { nameX: name.x, priceX: price.x, width: price.width };
  });
  expect(geometry.priceX).toBeGreaterThan(geometry.nameX);
  await setLanguage(page, "fa");
  geometry = await row.evaluate((element) => {
    const name = element
      .querySelector(".lookup-result-name")!
      .getBoundingClientRect();
    const price = element
      .querySelector(".lookup-result-price")!
      .getBoundingClientRect();
    return { nameX: name.x, priceX: price.x, width: price.width };
  });
  expect(geometry.nameX).toBeGreaterThan(geometry.priceX);
  const fills = await row.evaluate((element) => ({
    row: getComputedStyle(element).backgroundColor,
    pill: getComputedStyle(element.querySelector(".offer-pill")!)
      .backgroundColor,
    bar: getComputedStyle(element, "::before").width,
  }));
  expect(fills.row).not.toBe(fills.pill);
  expect(fills.bar).toBe("3px");
});

test("duplicate barcode reports one scoped conflict and allows a corrected save", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#products");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).products,
    STORAGE_KEY,
  );
  const owner = before.find(
    (product: { code: string }) => product.code === "0001",
  );
  await page
    .getByRole("button", { name: "Edit Potato Chips 150 g", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor.getByLabel("English name", { exact: true }).fill("Edited chips");
  await editor.getByLabel("Barcode", { exact: true }).fill(owner.barcode);
  for (let attempt = 0; attempt < 2; attempt++) {
    await editor
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(editor.getByRole("alert")).toContainText(
      "This barcode belongs to another product",
    );
  }
  const blocked = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORAGE_KEY,
  );
  expect(blocked.products).toEqual(before);
  expect(
    blocked.approvals.filter(
      (item: { type: string; product_code: string }) =>
        item.type === "barcode_conflict" && item.product_code === "0009",
    ),
  ).toHaveLength(1);
  expect(blocked.approvals.at(-1)).toMatchObject({
    branch: "Branch 1",
    barcode: owner.barcode,
    conflicting_product_code: owner.code,
    triggered_by: "Demo Supervisor",
  });
  await editor.getByLabel("Barcode", { exact: true }).fill("new-chips-barcode");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).products,
    STORAGE_KEY,
  );
  expect(
    saved.find((product: { code: string }) => product.code === "0009"),
  ).toMatchObject({
    name_en: "Edited chips",
    barcode: "new-chips-barcode",
  });
  expect(
    saved.find((product: { code: string }) => product.code === owner.code),
  ).toEqual(owner);
});
