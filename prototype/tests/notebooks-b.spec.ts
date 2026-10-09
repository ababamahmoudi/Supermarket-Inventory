import { expect, test } from "@playwright/test";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";

async function notebookTab(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page
    .getByRole("tab", { name: new RegExp(`^${name}( \\d+)?$`) })
    .click();
}
async function createCleaningNotebook(page: import("@playwright/test").Page) {
  await page.goto("/#notes");
  await page.getByRole("button", { name: "New notebook", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "New notebook",
    exact: true,
  });
  await dialog
    .getByLabel("Name (English)", { exact: true })
    .fill("Cleaning log");
  await dialog.getByLabel("Name (Persian)", { exact: true }).fill("دفتر نظافت");
  await chooseOption(
    page,
    dialog.getByLabel("Branch", { exact: true }),
    "North York",
  );
  await dialog
    .getByRole("group", { name: "Who can read", exact: true })
    .getByRole("checkbox", { name: "Cashier", exact: true })
    .check();
  await dialog
    .getByRole("checkbox", { name: "Measurement", exact: true })
    .check();
  await dialog.getByLabel("Measurement unit", { exact: true }).fill("°C");
  await dialog
    .getByRole("button", { name: "Save notebook", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await notebookTab(page, "Cleaning log");
}

test("Notes search has a search icon, a placeholder, 44px controls and the singular note count", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#notes");
  const search = page.getByLabel("Search notes", { exact: true });
  await expect(search).toHaveAttribute("placeholder", "Search all notebooks");
  await expect(page.locator(".notebook-search-pill svg")).toBeVisible();
  await search.fill("Sunflower oil");
  await expect(page.locator(".filter-count")).toHaveText("1 note");
  await expect(page.locator(".filter-count")).not.toHaveText("1 notes");
  const heights = await page.locator(".filter-toolbar").evaluate((el) =>
    Array.from(el.querySelectorAll("input,button,.ui-checked-control"))
      .filter((control) => control.getBoundingClientRect().height > 0)
      .map((control) => control.getBoundingClientRect().height),
  );
  expect(heights.every((height) => Math.abs(height - 44) <= 1)).toBe(true);
});

test("Supervisor configures a custom notebook and entries persist with author, branch and enabled fields", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await createCleaningNotebook(page);
  await expect(
    page.getByLabel("Measurement (°C)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Product (optional)", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Note", { exact: true }).fill("Deli counter cleaned");
  await page.getByLabel("Measurement (°C)", { exact: true }).fill("3.5");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const entry = page
    .locator(".notebook-entry-card")
    .filter({ hasText: "Deli counter cleaned" });
  await expect(entry).toContainText("Demo Supervisor");
  await expect(entry).toContainText("North York");
  await expect(entry).toContainText("3.5 °C");
  await page.reload();
  await notebookTab(page, "Cleaning log");
  await expect(entry).toBeVisible();
  await page
    .getByRole("button", { name: "Edit notebook", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Edit notebook",
    exact: true,
  });
  await dialog.getByLabel("Measurement unit", { exact: true }).fill("°F");
  await dialog
    .getByRole("button", { name: "Save notebook", exact: true })
    .click();
  await expect(entry).toContainText("3.5 °C");
  await expect(
    page.getByLabel("Measurement (°F)", { exact: true }),
  ).toBeVisible();
});

test("archive retains authorized search results, restore keeps entries, and workers cannot edit notebook definitions", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await createCleaningNotebook(page);
  await page
    .getByLabel("Note", { exact: true })
    .fill("Retained cleaning entry");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page
    .getByRole("button", { name: "Archive notebook", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Archive notebook", exact: true })
    .getByRole("button", { name: "Archive notebook", exact: true })
    .click();
  await expect(page.getByRole("tab", { name: /^Cleaning log/ })).toHaveCount(0);
  await page
    .getByLabel("Search notes", { exact: true })
    .fill("Retained cleaning entry");
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Retained cleaning entry" }),
  ).toContainText("Archived");
  await page.goto("/#settings?group=notes");
  const definition = page
    .locator(".notebook-definition-row")
    .filter({ hasText: "Cleaning log" });
  await definition
    .getByRole("button", { name: "Restore notebook", exact: true })
    .click();
  await page.goto("/#notes");
  await notebookTab(page, "Cleaning log");
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Retained cleaning entry" }),
  ).toBeVisible();
  await signIn(page, "Floor Worker");
  await page.goto("/#notes");
  await notebookTab(page, "Cleaning log");
  await expect(
    page.getByRole("button", { name: /^(New|Edit|Archive) notebook$/ }),
  ).toHaveCount(0);
  await page
    .getByLabel("Note", { exact: true })
    .fill("Floor Worker cleaning check");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Floor Worker cleaning check" }),
  ).toContainText("Demo Floor Worker");
  await signIn(page, "Supervisor");
  await setBranch(page, "Richmond Hill");
  await expect(page.getByRole("tab", { name: /^Cleaning log/ })).toHaveCount(0);
});

test("Cashier gets only granted custom notebook reads and cannot add or read built-in notebooks", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await createCleaningNotebook(page);
  await page.getByLabel("Note", { exact: true }).fill("Cashier-readable check");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await signIn(page, "Cashier");
  await page.goto("/#notes");
  await notebookTab(page, "Cleaning log");
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Cashier-readable check" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", {
      name: /^(To order|Store use|For Supervisor|Deli temperatures)/,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /^(Save note|New notebook|Edit notebook|Archive notebook|Mark done)$/,
    }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Note", { exact: true })).toHaveCount(0);
});

test("Persian Deli notebook uses custom controls and keeps the measurement and dates readable", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#notes");
  await setLanguage(page, "fa");
  await notebookTab(page, "دمای اغذیه");
  await expect(page.locator(".notebook-entry-card")).toContainText("3.2 °C");
  await expect(
    page.getByLabel("جستجوی یادداشت‌ها", { exact: true }),
  ).toHaveAttribute("placeholder", "جستجو در همه دفترچه‌ها");
  await expect(
    page.locator(
      ".notebooks-page select,.notebooks-page input[type=checkbox],.notebooks-page input[type=number],.notebooks-page input[type=date]",
    ),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "ویرایش دفترچه", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "ویرایش دفترچه",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
