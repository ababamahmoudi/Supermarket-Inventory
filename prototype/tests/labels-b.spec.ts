import { expect, test } from "@playwright/test";
import { setBranch, signIn } from "./helpers";
import { addSelectedLabels } from "./label-selection";

async function saveTemplate(page: Parameters<typeof signIn>[0]) {
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByLabel("Saved template", { exact: true })).toHaveText(
    "Template 1",
  );
}

test("live A4 designer redraws capacity and calibration, stores editable presets and prints an alignment page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printCalls = String(
        Number(document.body.dataset.printCalls ?? 0) + 1,
      );
    };
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await expect(page.locator(".label-preview-caption")).toContainText(
    "18 labels per sheet",
  );
  await expect(page.locator(".label-preview-slot.is-used")).toHaveCount(4);
  await page.getByLabel("Width (mm)", { exact: true }).fill("70");
  await expect(page.locator(".label-preview-caption")).toContainText(
    "12 labels per sheet",
  );
  await page.getByLabel("Horizontal offset (mm)", { exact: true }).fill("1");
  await expect(
    page.locator('.label-preview-slot[data-slot="1"] rect'),
  ).toHaveAttribute("x", "11");
  await page.locator('.label-preview-slot[data-slot="3"]').click();
  await expect(page.getByLabel("Starting slot", { exact: true })).toHaveValue(
    "3",
  );
  await expect(page.locator(".label-preview-slot.is-used")).toHaveCount(2);
  await saveTemplate(page);
  await page
    .getByRole("button", { name: "Print test alignment page", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute("data-print-calls", "1");
  await page.emulateMedia({ media: "print" });
  const sheet = page.locator(".label-print-output .print-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".label-alignment-box")).toHaveCount(12);
  const physical = await sheet.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const first = element
      .querySelector(".label-alignment-box")!
      .getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      firstLeft: first.left - bounds.left,
    };
  });
  expect(Math.abs(physical.width - (210 * 96) / 25.4)).toBeLessThan(0.2);
  expect(Math.abs(physical.height - (297 * 96) / 25.4)).toBeLessThan(0.2);
  expect(Math.abs(physical.firstLeft - (11 * 96) / 25.4)).toBeLessThan(0.2);
  await page.emulateMedia({ media: "screen" });
  await page.getByLabel("Width (mm)", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page.reload();
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByLabel("Saved template", { exact: true }).click();
  await page.getByRole("option", { name: "Template 1", exact: true }).click();
  await expect(page.getByLabel("Width (mm)", { exact: true })).toHaveValue(
    "60",
  );
  await expect(
    page.getByLabel("Horizontal offset (mm)", { exact: true }),
  ).toHaveValue("1");
});

test("shared waitlist prints multiple pages but only explicit Yes clears it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printCalls = String(
        Number(document.body.dataset.printCalls ?? 0) + 1,
      );
    };
  });
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await saveTemplate(page);
  await page.getByRole("tab", { name: "Products", exact: true }).click();
  await page.getByLabel("Search products", { exact: true }).fill("0015");
  await expect(
    page.getByRole("checkbox", { name: "Select product 0015", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Search products", { exact: true }).fill("0003");
  await addSelectedLabels(page, ["0003"], 20);
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  await expect(page.getByLabel("Copies for 0003", { exact: true })).toHaveValue(
    "20",
  );
  await expect(
    page.locator(".label-bilingual-preview .print-sheet"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-calls", "1");
  await expect(
    page.getByRole("dialog", {
      name: "Did the labels print correctly?",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "No", exact: true })
    .click();
  await expect(page.getByLabel("Copies for 0003", { exact: true })).toHaveValue(
    "20",
  );
  await page.reload();
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  await page.getByLabel("Saved template", { exact: true }).click();
  await page.getByRole("option", { name: "Template 1", exact: true }).click();
  await page.getByLabel("Starting slot", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Print labels", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Yes", exact: true })
    .click();
  await expect(
    page.getByText("No labels waiting. Add products from the Products tab.", {
      exact: true,
    }),
  ).toBeVisible();
  const printed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).activity.find(
      (item: { action: string }) => item.action === "Print labels",
    ),
  );
  expect(printed.reversible).toBe(false);
  expect(printed.after.copies).toBe(20);
  expect(printed.after.sheets).toBe(2);
});

test("waitlists persist across coworkers and remain isolated by branch", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await saveTemplate(page);
  await page.getByRole("tab", { name: "Products", exact: true }).click();
  await page.getByLabel("Search products", { exact: true }).fill("0003");
  await page
    .getByRole("checkbox", { name: "Select all filtered", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Add 1 product to waitlist", exact: true })
    .click();
  await setBranch(page, "Branch 2");
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  await expect(
    page.getByText("No labels waiting. Add products from the Products tab.", {
      exact: true,
    }),
  ).toBeVisible();
  await signIn(page, "Floor Worker");
  await page.goto("/#labels");
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "New template", exact: true }).click();
  await page.getByRole("tab", { name: /^Waitlist/ }).click();
  await expect(page.getByLabel("Copies for 0003", { exact: true })).toHaveValue(
    "1",
  );
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByText("No labels waiting. Add products from the Products tab.", {
      exact: true,
    }),
  ).toBeVisible();
});
