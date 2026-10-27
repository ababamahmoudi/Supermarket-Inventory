import { expect, test } from "@playwright/test";

test("C8 return unit Select is level with Quantity and shows configured location", async ({
  page,
}) => {
  const { installReturnCreationFixture, fillReturnCreation } =
    await import("./return-create-r2c-helpers");
  await installReturnCreationFixture(page);
  const dialog = await fillReturnCreation(page);
  const quantity = dialog.locator("#new-return-quantity");
  const unit = dialog.getByRole("combobox", { name: "Unit", exact: true });
  await expect(unit).toContainText("Units");
  const a = (await quantity.boundingBox())!,
    b = (await unit.boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(2);
  await unit.click();
  await expect(
    page.getByRole("option", { name: "Units", exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: "Units", exact: true }).click();
  await dialog.locator("#new-return-reason").click();
  await page.getByRole("option", { name: "Wrong item", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Create return", exact: true })
    .click();
  await expect(page).toHaveURL(/#return\?id=/);
  const details = page
    .locator(".return-lines-table")
    .getByRole("button", { name: "Show details", exact: true });
  if (await details.isVisible()) await details.click();
  await expect(page.locator(".return-lines-table")).toContainText("North York");
  await expect(page.locator(".return-lines-table")).not.toContainText(
    "Branch 1",
  );
});
