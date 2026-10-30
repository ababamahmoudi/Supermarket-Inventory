import { expect, test } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { chooseOption, openInvoiceLine, setBranch, signIn } from "./helpers";

test("R3c K4 kg receiving input and its approved comparison state their genuine units without repricing", async ({
  page,
}) => {
  await signIn(page, "Manager");
  await setBranch(page, "Branch 1");
  const before = await readCanonicalBusinessEvidence(page);
  await page.goto("/#settings?group=pricing");
  await chooseOption(
    page,
    page.getByRole("combobox", { name: "Main display unit", exact: true }),
    "kg",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).config.weighed_items
          ?.main_display_unit,
    )
    .toBe("kg");
  await page.goto("/#invoices");
  await page.getByRole("button", { name: "New invoice", exact: true }).click();
  await page
    .getByRole("dialog", { name: "New invoice", exact: true })
    .getByRole("button", { name: "Manual entry", exact: true })
    .click();
  await chooseOption(
    page,
    page.getByLabel("Add a product to the invoice", { exact: true }),
    "0016",
    "Bulk Almonds",
  );
  await page.getByRole("button", { name: "Add line", exact: true }).click();
  const editor = await openInvoiceLine(page, 0);
  const price = editor.getByRole("textbox", {
    name: "Selling price (per kg)",
    exact: true,
  });
  await expect(price).toHaveValue("17.61");
  const approved = editor.locator(".receiving-approved-price");
  await expect(approved.locator(".weight-price-main")).toHaveText("$16.51/kg");
  await expect(approved.locator(".weight-price-secondary")).toHaveText(
    "$7.49/lb",
  );
  await price.fill("17.71");
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
          .receiving_price?.price,
    )
    .toBe("8.03");
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.invoice.lines[0].receiving_price).toMatchObject({
    entered_price: "17.71",
    price_unit: "kg",
    price: "8.03",
    calculated_price: "7.99",
  });
  expect(after.products).toEqual(before.products);
  expect(after.approvals).toEqual(before.approvals);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock).toEqual(before.stock);
  await expect(approved.locator(".weight-price-main")).toHaveText("$16.51/kg");
  await editor
    .getByRole("button", { name: "Use calculated price", exact: true })
    .click();
  await expect(price).toHaveValue("17.61");
  await expect
    .poll(
      async () =>
        (await readCanonicalBusinessEvidence(page)).invoice.lines[0]
          .receiving_price,
    )
    .toBeUndefined();
});
