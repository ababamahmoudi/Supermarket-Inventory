import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";
const STORAGE_KEY = "supermarket-prototype-v1";

async function stopTrackingKeepDates(page: Page, editor: Locator) {
  await editor
    .getByRole("switch", { name: "Date tracking", exact: true })
    .uncheck();
  await chooseOption(
    page,
    editor.getByLabel("Stop tracking", { exact: true }),
    "keep",
    "Stop tracking, keep the date on the product",
  );
}

async function openRegularPrice(page: Page) {
  await page
    .locator(".lookup-detail .product-header-actions")
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Change price",
    exact: true,
  });
  await editor.getByRole("radio", { name: /^New regular price/ }).click();
  return editor;
}

test("Supervisor product page uses own route, Back link and shared editor", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#products");
  await page
    .getByRole("main")
    .getByLabel("Search products", { exact: true })
    .fill("0009");
  await page
    .getByRole("link", { name: "Potato Chips 150 g", exact: true })
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
    .getByLabel("Description (English) (optional)", { exact: true })
    .fill("Crispy potato chips");
  // Name-only editing must explicitly resolve this undated tracking fixture.
  await stopTrackingKeepDates(page, editor);
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

test("Lookup Change price defaults to all stores and records the signed-in Supervisor", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#lookup");
  await page
    .getByRole("main")
    .getByLabel("Search products", { exact: true })
    .fill("0009");
  const editor = await openRegularPrice(page);
  await editor.getByLabel("Price", { exact: true }).fill("3.29");
  await expect(
    editor.getByRole("button", { name: "All stores", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  await expect(page.locator(".lookup-detail .price")).toHaveText("$3.29");
  await setBranch(page, "Branch 2");
  await expect(page.locator(".lookup-detail .price")).toHaveText("$3.29");
  const audit = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).activity.at(-1),
    STORAGE_KEY,
  );
  expect(audit).toMatchObject({
    action: "Set regular price",
    by: "Demo Supervisor",
    actor_username: "supervisor",
    reversible: true,
    branch: "all",
    entity_type: "product",
    entity_id: "0009",
  });
  expect(audit.before.selling_price).toBe("2.99");
  expect(audit.after.selling_price).toBe("3.29");
});

test("Change price changes this store only, and validation stays inside the open dialog", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
  await page
    .getByRole("main")
    .getByLabel("Search products", { exact: true })
    .fill("0009");
  const editor = await openRegularPrice(page);
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).products,
    STORAGE_KEY,
  );
  await editor.getByLabel("Price", { exact: true }).fill("3.291");
  await editor
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(
    editor.getByRole("alert", { name: "What's missing", exact: true }),
  ).toContainText("at most two decimals");
  await expect(editor).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).products,
      STORAGE_KEY,
    ),
  ).toEqual(before);
  await editor.getByLabel("Price", { exact: true }).fill("3.29");
  await editor
    .getByRole("button", { name: "Only North York", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
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
  await page
    .getByRole("main")
    .getByLabel("Search products", { exact: true })
    .fill("0009");
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
    rowRadius: getComputedStyle(element).borderRadius,
    pillRadius: getComputedStyle(element.querySelector(".offer-pill")!)
      .borderRadius,
    pillHeight: element.querySelector(".offer-pill")!.getBoundingClientRect()
      .height,
    bar: getComputedStyle(element, "::before").width,
  }));
  expect(fills.rowRadius).not.toBe(fills.pillRadius);
  expect(parseFloat(fills.pillRadius)).toBeGreaterThanOrEqual(
    fills.pillHeight / 2,
  );
  await expect(row.locator(".offer-pill")).not.toBeEmpty();
  expect(fills.bar).toBe("3px");
});

test("duplicate barcode reports one scoped conflict and allows a corrected save", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "Branch 1");
  await page.goto("/#products");
  await page
    .getByRole("main")
    .getByLabel("Search products", { exact: true })
    .fill("0009");
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
  // Resolve tracking first so this failure proves the barcode business guard.
  await stopTrackingKeepDates(page, editor);
  for (let attempt = 0; attempt < 2; attempt++) {
    await editor
      .getByRole("button", { name: "Save product", exact: true })
      .click();
    await expect(
      editor.getByRole("alert", { name: "What's missing", exact: true }),
    ).toContainText("This barcode belongs to another product");
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
