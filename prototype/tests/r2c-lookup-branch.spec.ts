import { expect, test, type Page } from "@playwright/test";
import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setBranch, setLanguage, signIn } from "./helpers";
import { inspectResponsiveLayout } from "../scripts/c6-layout-proof.mjs";
import { inspect } from "../scripts/c5-browser-proof.mjs";

async function installProducts(page: Page) {
  await runCanonicalBusinessFixture(
    page,
    (state) => {
      const source = state.products.find((row) => row.code === "0009")!;
      for (const [code, name, prices, delivered] of [
        [
          "F9101",
          "Fictional R2c local pantry",
          { "Branch 1": "4.99", "Branch 2": "6.49" },
          true,
        ],
        [
          "F9102",
          "Fictional R2c remote pantry",
          { "Branch 2": "5.49", "Branch 3": "987.65" },
          false,
        ],
        [
          "F9103",
          "Fictional R2c delivered pantry",
          { "Branch 2": "6.49" },
          true,
        ],
      ] as const) {
        state.products.push({
          ...structuredClone(source),
          code,
          name_en: name,
          name_fa: "کالای نمونهٔ خیالی",
          barcode: `DEMO-${code}`,
          selling_price: "9.99",
          branch_prices: { ...prices },
          price_provenance: {},
          manual_prices: {},
          ai_category: "",
          last_cost_before_tax: "1.6000",
          last_received_relative_days: delivered ? { "Branch 1": 0 } : {},
        });
      }
    },
    undefined,
  );
  await page.reload();
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup");
  await expect(page.locator(".lookup-results-card")).toBeVisible();
}

test("a genuine sale returns to its reviewed local regular basis after End", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await installProducts(page);
  await page.goto("/#lookup?search=F9103");
  const detail = page.locator(".lookup-detail");
  await expect(detail).toContainText("Not approved here yet");
  await detail
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Change price",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Only North York", exact: true })
    .click();
  await dialog.getByLabel("Sale price", { exact: true }).fill("7.99");
  await dialog.getByRole("button", { name: "Start sale", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(detail.locator(".sale-price")).toContainText("$7.99");
  await detail
    .getByRole("button", { name: "Product actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "End sale now", exact: true })
    .click();
  const end = page.getByRole("dialog", { name: "End sale now", exact: true });
  await end.getByRole("button", { name: "End sale now", exact: true }).click();
  await expect(end).not.toBeVisible();
  await expect(detail.locator(".sale-price")).toHaveCount(0);
  await expect(detail.locator(".price")).toHaveText("$9.99");
  await expect(detail.locator(".lookup-other-prices")).toHaveCount(0);
  const state = await readCanonicalBusinessEvidence(page);
  expect(
    state.products.find((product) => product.code === "F9103"),
  ).toMatchObject({
    selling_price: "9.99",
    branch_prices: { "Branch 2": "6.49" },
  });
  expect(
    state.activity.filter(
      (row) =>
        row.product_code === "F9103" && row.action === "Set regular price",
    ),
  ).toEqual([]);
});

test("branch list shows its products, typed search groups other stores, and an actual own-store approval removes comparison prices", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await installProducts(page);
  await expect(
    page
      .locator(".lookup-result-row")
      .filter({ hasText: "Fictional R2c remote pantry" }),
  ).toHaveCount(0);
  const search = page.getByRole("combobox", {
    name: "Search products",
    exact: true,
  });
  await search.fill("Fictional R2c");
  const other = page.getByRole("group", {
    name: "At other locations",
    exact: true,
  });
  await expect(other.locator(".lookup-result-row")).toHaveCount(1);
  await expect(
    other.getByRole("option", { name: /^Fictional R2c remote pantry/ }),
  ).toHaveCount(1);
  await search.fill("F9103");
  const detail = page.locator(".lookup-detail");
  await expect(detail).toContainText("Not approved here yet");
  await expect(detail).toContainText("Richmond Hill");
  await expect(detail).toContainText("$6.49");
  await expect(detail.locator(".price")).toHaveCount(0);
  await detail
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Change price",
    exact: true,
  });
  await dialog.getByRole("radio", { name: /^New regular price/ }).click();
  await dialog.getByLabel("Price", { exact: true }).fill("4.99");
  await dialog
    .getByRole("button", { name: "Only North York", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(detail.locator(".price")).toHaveText("$4.99");
  await expect(detail.locator(".lookup-other-prices")).toHaveCount(0);
  await expect(detail).not.toContainText("Richmond Hill");
  const evidence = await readCanonicalBusinessEvidence(page);
  const product = evidence.products.find((row) => row.code === "F9103")!;
  expect(product.branch_prices).toMatchObject({
    "Branch 1": "4.99",
    "Branch 2": "6.49",
  });
  expect(product.selling_price).toBe("9.99");
  expect(
    evidence.activity.filter(
      (row) =>
        row.product_code === product.code && row.action === "Set regular price",
    ),
  ).toHaveLength(1);
});

test("Cashier other-store prices remain within assigned locations and expose no financial evidence", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await installProducts(page);
  await signIn(page, "Cashier");
  await setBranch(page, "Branch 1");
  await page.goto("/#lookup?search=F9102");
  const detail = page.locator(".lookup-detail");
  await expect(detail).toContainText("Not approved here yet");
  await expect(detail).toContainText("Richmond Hill");
  await expect(detail).toContainText("$5.49");
  await expect(page.getByRole("main")).not.toContainText("987.65");
  await expect(detail).not.toContainText("Newmarket");
  await expect(detail.getByText("Store cost", { exact: true })).toHaveCount(0);
  await expect(detail.getByText("Margin", { exact: true })).toHaveCount(0);
});

for (const width of [1440, 1000, 390])
  for (const language of ["en", "fa"] as const)
    for (const theme of ["light", "dark"] as const) {
      test(`R2c branch Lookup ${width} ${language} ${theme}`, async ({
        page,
      }, info) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: 1000 });
        await signIn(page, "Manager");
        await installProducts(page);
        await setLanguage(page, language);
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
          localStorage.setItem("arzon-theme", value);
        }, theme);
        await page.goto("/#lookup?search=Fictional%20R2c");
        await expect(page.locator(".lookup-result-row")).toHaveCount(3);
        await page
          .locator(".lookup-result-row")
          .filter({ hasText: "F9103" })
          .click();
        await expect(
          page.locator(".lookup-detail .lookup-other-prices"),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const controls = await inspect(
          page,
          "lookup",
          `${language}-${theme}`,
          "manager",
        );
        const layout = await inspectResponsiveLayout(
          page,
          "lookup",
          language,
          width,
        );
        expect(controls.failures).toEqual([]);
        expect(layout.failures).toEqual([]);
        await info.attach("lookup proof", {
          body: JSON.stringify({ controls, layout }),
          contentType: "application/json",
        });
        await page.screenshot({
          path: info.outputPath(`lookup-${width}-${language}-${theme}.png`),
          fullPage: true,
        });
        expect(errors).toEqual([]);
      });
    }
