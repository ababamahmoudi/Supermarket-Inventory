import { expect, type Page } from "@playwright/test";

export async function waitlistCopies(page: Page, code: string) {
  const copies = page.getByLabel(`Copies for ${code}`, { exact: true });
  if (!(await copies.count()))
    await page
      .locator(".labels-waitlist-table tbody > tr:not(.table-expanded-row)")
      .filter({ hasText: code })
      .getByRole("button", { name: "Show details", exact: true })
      .click();
  await expect(copies).toBeVisible();
  return copies;
}

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

/** Select the actual C8 queue intent before choosing a per-group template. */
export async function selectLabelGroup(
  page: Page,
  style: "regular" | "promo",
  templateName?: string,
) {
  const groups = page.getByRole("tablist", {
    name: /^(?:Label styles|نوع برچسب)$/,
  });
  if (await groups.count()) {
    const tab = groups.getByRole("tab", {
      name: style === "regular" ? /^(?:Regular|عادی)/ : /^(?:Promo|ویژه)/,
    });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
  if (templateName) {
    const template = page.getByLabel(/^(?:Saved template|قالب ذخیره‌شده)$/);
    await template.click();
    await page.getByRole("option", { name: templateName, exact: true }).click();
    await expect(template).toHaveText(templateName);
  }
}
