import { expect, test, type Page } from "@playwright/test";
import { chooseOption, setBranch, setLanguage, signIn } from "./helpers";

async function createNotebook(
  page: Page,
  options: { readOnly?: boolean; location?: string } = {},
) {
  await page.goto("/#notes");
  await page.getByRole("button", { name: "New notebook", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "New notebook",
    exact: true,
  });
  await dialog
    .getByLabel("Name (English)", { exact: true })
    .fill("Cleaning log");
  await dialog
    .getByLabel("Name (Persian, optional)", { exact: true })
    .fill("دفتر نظافت");
  for (const group of ["Who can read", "Who can add"])
    for (const role of ["Supervisor", "Floor Worker"])
      await expect(
        dialog
          .getByRole("group", { name: group, exact: true })
          .getByRole("checkbox", { name: role, exact: true }),
      ).toBeChecked();
  if (options.readOnly)
    await dialog
      .getByRole("group", { name: "Who can add", exact: true })
      .getByRole("checkbox", { name: "Floor Worker", exact: true })
      .uncheck();
  if (options.location)
    await chooseOption(
      page,
      dialog.getByLabel("Branch", { exact: true }),
      options.location,
    );
  await dialog
    .getByRole("button", { name: "Save notebook", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("tab", { name: /^Cleaning log/ }),
  ).toHaveAttribute("aria-selected", "true");
}

test("Supervisor can create and add to a custom notebook in All branches, including Warehouse, and normal-location/default worker addition still works", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await createNotebook(page);
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  const form = page.getByRole("form", { name: "Add note", exact: true });
  await expect(form).toBeVisible();
  const location = form.getByLabel("Location", { exact: true });
  await expect(location).toHaveAttribute("role", "combobox");
  await expect(
    form.getByRole("button", { name: "Save note", exact: true }),
  ).toBeDisabled();
  await expect(form.getByRole("status")).toHaveText(
    "Choose a location for this note.",
  );
  await chooseOption(page, location, "Warehouse");
  await form
    .getByLabel("Note", { exact: true })
    .fill("Warehouse receiving area cleaned");
  await form.getByRole("button", { name: "Save note", exact: true }).click();
  const entry = page
    .locator(".notebook-entry-card")
    .filter({ hasText: "Warehouse receiving area cleaned" });
  await expect(entry).toContainText("Warehouse");
  await expect(entry).toContainText("Demo Supervisor");
  await expect(
    page.locator(".topbar").getByLabel("Branch", { exact: true }),
  ).toContainText("All branches");
  const saved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("supermarket-prototype-v1")!);
    const note = state.notebook_entries.find(
      (item: { text: string }) =>
        item.text === "Warehouse receiving area cleaned",
    );
    const action = state.activity.find(
      (item: { entity_id: string }) => item.entity_id === note.id,
    );
    return { note, action };
  });
  expect(saved.note.branch).not.toBe("all");
  expect(saved.action.branch).toBe(saved.note.branch);
  expect(saved.action.by).toBe("Demo Supervisor");
  await page.reload();
  await page.getByRole("tab", { name: /^Cleaning log/ }).click();
  await expect(entry).toBeVisible();
  await setLanguage(page, "fa");
  await expect(page.getByRole("tab", { name: /^دفتر نظافت/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page
    .getByRole("button", { name: "افزودن یادداشت", exact: true })
    .click();
  await expect(page.getByLabel("مکان", { exact: true })).toHaveAttribute(
    "role",
    "combobox",
  );
  await expect(
    page.locator(
      ".notebooks-page select,.notebooks-page input[type=checkbox],.notebooks-page input[type=number],.notebooks-page input[type=date]",
    ),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await setLanguage(page, "en");
  await setBranch(page, "North York");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(page.getByLabel("Location", { exact: true })).toHaveCount(0);
  await form
    .getByLabel("Note", { exact: true })
    .fill("North York Supervisor check");
  await form.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "North York Supervisor check" }),
  ).toContainText("North York");
  await signIn(page, "Floor Worker");
  await page.goto("/#notes");
  await page.getByRole("tab", { name: /^Cleaning log/ }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await form
    .getByLabel("Note", { exact: true })
    .fill("Floor Worker cleaning check");
  await form.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Floor Worker cleaning check" }),
  ).toContainText("Demo Floor Worker");
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Warehouse receiving area cleaned" }),
  ).toHaveCount(0);
});

test("read-only notebook explains why adding is unavailable in English and Persian", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await createNotebook(page, { readOnly: true });
  await signIn(page, "Floor Worker");
  await page.goto("/#notes");
  await page.getByRole("tab", { name: /^Cleaning log/ }).click();
  await expect(
    page.getByRole("form", { name: "Add note", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".notebooks-page").getByRole("status")).toHaveText(
    "You can read this notebook. Adding notes is not enabled for your role.",
  );
  await setLanguage(page, "fa");
  await expect(page.locator(".notebooks-page").getByRole("status")).toHaveText(
    "می‌توانید این دفترچه را بخوانید. افزودن یادداشت برای نقش شما فعال نیست.",
  );
});

test("All branches notebook add picker is restricted to its configured location", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await createNotebook(page, { location: "North York" });
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  const location = page.getByLabel("Location", { exact: true });
  await location.click();
  await expect(
    page.getByRole("option", { name: "North York", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Warehouse", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("option", { name: "Richmond Hill", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("option", { name: "North York", exact: true }).click();
  await page.getByLabel("Note", { exact: true }).fill("Scoped cleaning check");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page
      .locator(".notebook-entry-card")
      .filter({ hasText: "Scoped cleaning check" }),
  ).toContainText("North York");
});
