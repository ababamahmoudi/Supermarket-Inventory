import { expect, test } from "@playwright/test";
import { addSelectedLabels } from "./label-selection";
import { chooseOption, setLanguage, signIn } from "./helpers";

const STORAGE_KEY = "supermarket-prototype-v1";
const PRODUCT_CODE = "0016";

for (const role of ["Supervisor", "Floor Worker", "Cashier"] as const) {
  test(`${role} sees approved weighed prices in Lookup with isolated bilingual units`, async ({
    page,
  }) => {
    await signIn(page, role);
    await page.goto("/#lookup");
    await page
      .getByLabel("Search products", { exact: true })
      .fill(PRODUCT_CODE);
    const price = page.locator(".lookup-approved-price .weight-price");
    await expect(price.locator(".weight-price-main")).toHaveText("$7.49/lb");
    await expect(price.locator(".weight-price-secondary")).toContainText(
      "$16.51/kg",
    );
    await expect(price.locator(".weight-price-main")).toHaveAttribute(
      "dir",
      "ltr",
    );
    if (role === "Cashier")
      await expect(
        page.locator(".lookup-detail").getByRole("button", { name: /^Edit / }),
      ).toHaveCount(0);
    await setLanguage(page, "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(price.locator(".weight-price-main")).toHaveText("$7.49/lb");
    await expect(price.locator(".weight-price-secondary")).toContainText(
      "$16.51/kg",
    );
  });
}

test("weighed defaults persist, change only display/rules, and a kg editor save preserves the approved lb amount", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  const productsBefore = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).products,
    STORAGE_KEY,
  );
  await page.goto("/#settings?group=pricing");
  await expect(
    page.getByLabel("Main display unit", { exact: true }),
  ).toHaveText("lb");
  await expect(
    page.getByRole("switch", { name: "Show second unit", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Use rounding bands", exact: true }),
  ).toBeChecked();
  await chooseOption(
    page,
    page.getByLabel("Main display unit", { exact: true }),
    "kg",
  );
  await page
    .getByRole("switch", { name: "Show second unit", exact: true })
    .uncheck();
  await page
    .getByRole("switch", { name: "Use rounding bands", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await expect(
    page.getByLabel("Main display unit", { exact: true }),
  ).toHaveText("kg");
  await expect(
    page.getByRole("switch", { name: "Show second unit", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Use rounding bands", exact: true }),
  ).not.toBeChecked();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).products,
      STORAGE_KEY,
    ),
  ).toEqual(productsBefore);

  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill(PRODUCT_CODE);
  await expect(
    page.locator(".lookup-approved-price .weight-price-main"),
  ).toHaveText("$16.51/kg");
  await expect(
    page.locator(".lookup-approved-price .weight-price-secondary"),
  ).toHaveCount(0);
  await page
    .locator(".lookup-detail")
    .getByRole("button", { name: /^Edit / })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await expect(editor.getByLabel("Sold by", { exact: true })).toHaveText(
    "Weight",
  );
  await expect(
    editor.getByLabel("Selling price (per kg)", { exact: true }),
  ).toHaveValue("16.51");
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  const product = await page.evaluate(
    ({ key, code }) =>
      JSON.parse(localStorage.getItem(key)!).products.find(
        (item: { code: string }) => item.code === code,
      ),
    { key: STORAGE_KEY, code: PRODUCT_CODE },
  );
  expect(product.selling_price).toBe("7.49");
  expect(product.last_cost_before_tax).toBe("4.9895");
  await page.goto("/#products");
  await page.getByLabel("Search products", { exact: true }).fill(PRODUCT_CODE);
  await expect(page.locator("tbody .weight-price-main").first()).toHaveText(
    "$16.51/kg",
  );
});

test("weighed Regular labels retain physical geometry, readable units, and approved monetary state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await addSelectedLabels(page, [PRODUCT_CODE]);
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  const label = page.locator(".label-bilingual-preview .shelf-label");
  await expect(label.locator(".weight-price-main")).toHaveText("$7.49/lb");
  await expect(label.locator(".weight-price-secondary")).toContainText(
    "$16.51/kg",
  );
  const textFits = await label.locator(".price").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return [
      ...element.querySelectorAll(".weight-price-main,.weight-price-secondary"),
    ].every((fragment) => {
      const range = document.createRange();
      range.selectNodeContents(fragment);
      return [...range.getClientRects()].every(
        (rect) =>
          rect.left >= box.left - 0.75 &&
          rect.right <= box.right + 0.75 &&
          rect.top >= box.top - 0.75 &&
          rect.bottom <= box.bottom + 0.75,
      );
    });
  });
  expect(textFits).toBe(true);
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  await page.emulateMedia({ media: "print" });
  const geometry = await page
    .locator(".label-print-output .shelf-label")
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
  expect(Math.abs(geometry.width - (60 * 96) / 25.4)).toBeLessThan(0.2);
  expect(Math.abs(geometry.height - (40 * 96) / 25.4)).toBeLessThan(0.2);
  const product = await page.evaluate(
    ({ key, code }) =>
      JSON.parse(localStorage.getItem(key)!).products.find(
        (item: { code: string }) => item.code === code,
      ),
    { key: STORAGE_KEY, code: PRODUCT_CODE },
  );
  expect(product.selling_price).toBe("7.49");
});
