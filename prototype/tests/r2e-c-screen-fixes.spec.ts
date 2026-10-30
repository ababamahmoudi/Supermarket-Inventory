import { expect, test } from "@playwright/test";
import { setBranch, setLanguage, signIn } from "./helpers";

test("C10 optional barcode and paired description fields stay level", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  await page.goto("/#product?code=0009");
  await page
    .getByRole("button", { name: "Edit Potato Chips 150 g", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Barcode (optional)", { exact: true }),
  ).toBeEditable();
  const english = dialog.getByLabel("Description (English) (optional)", {
    exact: true,
  });
  const persian = dialog.getByLabel("Description (Persian) (optional)", {
    exact: true,
  });
  await expect(english).toBeEditable();
  await expect(persian).toBeEditable();
  if (testInfo.project.name === "desktop") {
    const a = (await english.boundingBox())!;
    const b = (await persian.boundingBox())!;
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(b.x).toBeGreaterThan(a.x + a.width);
  }
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await setLanguage(page, "fa");
  await page.getByRole("button", { name: /^ویرایش/ }).click();
  await expect(
    page.getByRole("dialog").getByLabel("بارکد (اختیاری)", { exact: true }),
  ).toBeEditable();
});
