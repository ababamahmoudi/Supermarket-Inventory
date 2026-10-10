import { expect, test } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

test("English-only notebooks keep their name in Persian and clear only the related name error", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#notes");
  await page.getByRole("button", { name: "New notebook", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "New notebook",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Save notebook", exact: true })
    .click();
  const english = dialog.getByLabel("Name (English)", { exact: true });
  await expect(english).toHaveAttribute("aria-invalid", "true");
  await dialog
    .getByLabel("Name (Persian, optional)", { exact: true })
    .fill(" ");
  await expect(english).toHaveAttribute("aria-invalid", "true");
  await english.fill("Evening checks");
  await expect(english).not.toHaveAttribute("aria-invalid", "true");
  await dialog
    .getByRole("button", { name: "Save notebook", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await setLanguage(page, "fa");
  const tab = page.getByRole("tab", { name: "Evening checks", exact: true });
  await expect(tab).toBeVisible();
  await tab.click();
  await page.reload();
  await expect(tab).toBeVisible();
  await expect(
    page.getByRole("button", { name: "افزودن یادداشت", exact: true }),
  ).toBeVisible();
});

test("Settings names new branches as locations", async ({ page }) => {
  await signIn(page, "Supervisor");
  await page.goto("/#settings?group=branches");
  await expect(
    page.getByRole("button", { name: "Add location", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add location", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add location", exact: true }),
  ).toBeVisible();
});
