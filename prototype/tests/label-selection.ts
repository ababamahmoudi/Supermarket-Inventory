import { expect, type Page } from "@playwright/test";

export async function addSelectedLabels(
  page: Page,
  codes: string[],
  copies = 1,
) {
  for (const code of codes) {
    await page.getByLabel("Search products", { exact: true }).fill(code);
    await page
      .getByRole("checkbox", { name: `Select product ${code}`, exact: true })
      .check();
  }
  const bar = page.getByRole("region", {
    name: "Add to waitlist",
    exact: true,
  });
  await expect(bar).toBeVisible();
  await bar.getByLabel("Copies", { exact: true }).fill(String(copies));
  await bar
    .getByRole("button", {
      name: `Add ${codes.length} ${codes.length === 1 ? "product" : "products"} to waitlist`,
      exact: true,
    })
    .click();
  await expect(bar).toHaveCount(0);
}
