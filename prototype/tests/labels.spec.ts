import { expect, test, type Page } from "@playwright/test";
import { signIn, setBranch } from "./helpers";
import { addSelectedLabels } from "./label-selection";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };

async function addProducts(page: Page, codes: string[], copies = 1) {
  await page.getByRole("tab", { name: "Products", exact: true }).click();
  await addSelectedLabels(page, codes, copies);
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
}

test("creates a template, starts after four used slots, and prints bilingual labels", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Labels", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Saved template", { exact: true })).toHaveText(
    "Choose a template",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).templates
          .length,
    ),
  ).toBe(2);
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByLabel("Saved template")).toHaveText("Template 1");
  await addProducts(page, ["0003", "0005", "0009"]);
  await expect(page.getByLabel("Starting slot", { exact: true })).toHaveValue(
    "5",
  );
  await expect(page.locator(".label-preview-slot.is-used")).toHaveCount(4);
  const labels = page.locator(".label-bilingual-preview .shelf-label");
  await expect(labels).toHaveCount(3);
  expect(
    await labels.evaluateAll((elements) =>
      elements.map((element) => ({
        left: (element as HTMLElement).style.left,
        top: (element as HTMLElement).style.top,
      })),
    ),
  ).toEqual([
    { left: "74mm", top: "54mm" },
    { left: "138mm", top: "54mm" },
    { left: "10mm", top: "98mm" },
  ]);
  await expect(labels.first()).toContainText("Sour Cherry Juice");
  await expect(labels.first().locator('[lang="fa"]')).toBeVisible();
  await expect(labels.first().locator("img")).toBeVisible();
  for (const product of demoSeed.products)
    await expect(labels.filter({ hasText: product.barcode })).toHaveCount(0);
  await page.getByLabel("Copies for 0003", { exact: true }).fill("2.7");
  await expect(page.getByRole("alert")).toHaveText(
    "Enter a whole copy count from 1 to 1000.",
  );
  await expect(page.getByLabel("Copies for 0003", { exact: true })).toHaveValue(
    "1",
  );
  await expect(labels).toHaveCount(3);
  await page.getByLabel("Copies for 0003", { exact: true }).fill("2");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Copies for 0003", { exact: true })).toHaveValue(
    "2",
  );
  await expect(labels).toHaveCount(4);
  await expect(labels.filter({ hasText: "Sour Cherry Juice" })).toHaveCount(2);
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".label-print-output .shelf-label")).toHaveCount(4);
  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "No", exact: true })
    .click();
  await page.reload();
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByLabel("Saved template").click();
  await expect(page.getByRole("option")).toHaveCount(4);
});

test("validates A4 dimensions and Persian labels without external requests", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page.getByLabel("Width (mm)", { exact: true }).fill("220");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("fit on an A4 sheet");
  await page.getByLabel("Width (mm)", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await addProducts(page, ["0003"]);
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
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await setBranch(page, "all");
  await expect(
    page.getByText(
      "Choose one branch above before selecting or printing labels. Labels use that branch’s approved prices and offers.",
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Products", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Select all filtered", exact: true }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
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
  await addProducts(page, ["0004", "0006"]);
  const teaLabel = page
    .locator(".label-bilingual-preview .shelf-label")
    .filter({ hasText: "Black Tea 450 g" });
  const lavashLabel = page
    .locator(".label-bilingual-preview .shelf-label")
    .filter({ hasText: "Lavash Bread 500 g" });
  await expect(teaLabel.locator(".price")).toHaveText("$6.99");
  await expect(lavashLabel.locator(".price")).toHaveText("$1.99");
  await expect(lavashLabel).toContainText("3 for $5");
  await setBranch(page, "Branch 1");
  await expect(
    page.getByText("No labels waiting. Add products from the Products tab.", {
      exact: true,
    }),
  ).toBeVisible();
  await addProducts(page, ["0004", "0006"]);
  await expect(teaLabel.locator(".price")).toHaveText("$6.49");
  await expect(lavashLabel.locator(".price")).toHaveText("$1.99");
  await expect(lavashLabel.filter({ hasText: "$2.99" })).toHaveCount(0);
});
