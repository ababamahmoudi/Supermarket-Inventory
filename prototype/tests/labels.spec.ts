import { expect, test } from "@playwright/test";
import { signIn, setBranch } from "./helpers";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };

test("creates a template, starts after four used slots, and prints bilingual labels", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await expect(
    page.getByRole("heading", { name: "Labels", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No templates. Create your first template."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByLabel("Saved template")).toHaveValue(/.+/);
  await expect(page.getByLabel("Starting slot")).toHaveValue("5");
  await expect(
    page
      .locator(".print-sheet")
      .first()
      .locator(".label-unused")
      .filter({ hasText: "Used" }),
  ).toHaveCount(4);
  const labels = page.locator(".shelf-label");
  await expect(labels).toHaveCount(3);
  await expect(labels.first()).toContainText("Sour Cherry Juice");
  await expect(labels.first().locator('[lang="fa"]')).toBeVisible();
  await expect(labels.first().locator("img")).toBeVisible();
  for (const product of demoSeed.products) {
    await expect(labels.filter({ hasText: product.barcode })).toHaveCount(0);
  }
  await page.getByLabel("Copies per product", { exact: true }).fill("2.7");
  await expect(
    page.getByLabel("Copies per product", { exact: true }),
  ).toHaveValue("2");
  await expect(labels).toHaveCount(6);
  await expect(labels.filter({ hasText: "Sour Cherry Juice" })).toHaveCount(2);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.reload();
  await expect(page.getByLabel("Saved template").locator("option")).toHaveCount(
    2,
  );
});

test("validates A4 dimensions and Persian labels without external requests", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#labels");
  await expect(
    page.getByRole("heading", { name: "Labels", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Width (mm)", { exact: true }).fill("220");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("fit on an A4 sheet");
  await page.getByLabel("Width (mm)", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("button", { name: "چاپ برچسب‌ها" }),
  ).toBeVisible();
  await page.getByLabel("خانه شروع", { exact: true }).fill("99");
  await expect(
    page.getByRole("button", { name: "چاپ برچسب‌ها" }),
  ).toBeDisabled();
});

test("requires one branch and prints its approved price instead of a pending proposal", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#labels");
  await expect(
    page.getByRole("heading", { name: "Labels", exact: true }),
  ).toBeVisible();
  await setBranch(page, "all");
  await expect(
    page.getByText(
      "Choose one branch above before selecting or printing labels. Labels use that branch’s approved prices and offers.",
    ),
  ).toBeVisible();
  await expect(
    page.locator('.labels-controls input[type="checkbox"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Print labels", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(
    page.getByText(
      "پیش از انتخاب یا چاپ برچسب‌ها، یک شعبه را در بالا انتخاب کنید. برچسب‌ها قیمت‌ها و پیشنهادهای تأییدشدهٔ همان شعبه را نشان می‌دهند.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await setBranch(page, "Branch 2");
  for (const checkbox of await page
    .locator('.labels-controls input[type="checkbox"]')
    .all()) {
    if (await checkbox.isChecked()) await checkbox.uncheck();
  }
  const tea = demoSeed.products.find((product) => product.code === "0004")!;
  const lavash = demoSeed.products.find((product) => product.code === "0006")!;
  await page
    .getByRole("checkbox", {
      name: `${tea.name_en} · ${tea.name_fa}`,
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: `${lavash.name_en} · ${lavash.name_fa}`,
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  const teaLabel = page
    .locator(".shelf-label")
    .filter({ hasText: tea.name_en });
  const lavashLabel = page
    .locator(".shelf-label")
    .filter({ hasText: lavash.name_en });
  await expect(teaLabel.locator(".price")).toHaveText("$6.99");
  await expect(lavashLabel.locator(".price")).toHaveText("$1.99");
  await expect(lavashLabel).toContainText("3 for $5");
  await setBranch(page, "Branch 1");
  await expect(teaLabel.locator(".price")).toHaveText("$6.49");
  await expect(lavashLabel.locator(".price")).toHaveText("$1.99");
  await expect(lavashLabel.filter({ hasText: "$2.99" })).toHaveCount(0);
});
