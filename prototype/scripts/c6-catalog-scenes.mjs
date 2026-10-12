/* global window, localStorage */
import { expect } from "@playwright/test";
import { setupDatedReceipt } from "./c6-invoice-scenes.mjs";

async function savedState(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")),
  );
}
async function visit(page, route) {
  await page.evaluate((value) => {
    window.location.hash = value;
  }, route);
}
async function addShelfDate(page, { field, button, today }) {
  await visit(page, "expiry");
  const form = page.locator(".date-quick-add");
  await form.waitFor();
  await field(form, "Product").fill("0006");
  await form.getByRole("option", { name: /0006$/ }).click();
  await today(page, form);
  await button(form, "More").click();
  await field(form, "Quantity (optional)").fill("20");
  await field(form, "Lot (optional)").fill("C6-SHELF-06");
  await field(form, "Note (optional)").fill("Shelf check");
  await button(form, "Add").click();
  await expect
    .poll(async () => {
      const state = await savedState(page);
      return state.expiry.some(
        (entry) =>
          entry.source === "manual" &&
          entry.product_code === "0006" &&
          entry.lot_number === "C6-SHELF-06" &&
          entry.status !== "removed",
      );
    })
    .toBe(true);
  const state = await savedState(page);
  return state.expiry.find(
    (entry) =>
      entry.source === "manual" &&
      entry.product_code === "0006" &&
      entry.lot_number === "C6-SHELF-06" &&
      entry.status !== "removed",
  );
}

/** Every captured business record is created through the real, guarded UI. */
export async function setupCatalogScene(page, scene, helpers) {
  const { button, field, exact } = helpers;
  if (scene === "products") {
    await visit(page, "products");
    await page.locator(".catalog-products-table").waitFor();
    return {
      selector: ".catalog-products-table",
      capture: "page",
      evidence: { source: "approved company-wide seed catalog" },
    };
  }
  if (scene === "date-tracking" || scene === "edit-product-dates") {
    const entry = await addShelfDate(page, helpers);
    const evidence = {
      source: "real Date tracking quick-add form",
      expiry_id: entry.id,
      product_code: entry.product_code,
      date: entry.date,
      quantity: entry.quantity,
      lot_number: entry.lot_number,
      branch: entry.branch,
    };
    if (scene === "date-tracking")
      return { selector: ".date-tracking-page", capture: "page", evidence };
    await visit(page, "product?code=0006");
    const state = await savedState(page);
    const product = state.products.find((item) => item.code === "0006");
    await page.locator(".product-page").waitFor();
    return {
      selector: ".product-editor-dialog",
      capture: "viewport",
      evidence,
      afterAppearance: async (currentPage) => {
        await button(
          currentPage,
          `Edit ${product.name_en}`,
          `ویرایش ${product.name_fa || product.name_en}`,
        ).click();
        const dialog = currentPage.getByRole("dialog", {
          name: exact("Edit product", "ویرایش محصول"),
        });
        await dialog.waitFor();
        await dialog.locator(".product-date-editor").scrollIntoViewIfNeeded();
        await expect(dialog.locator(".product-date-editor")).toContainText(
          "C6-SHELF-06",
        );
      },
    };
  }
  if (scene === "lookup-clearance-dates") {
    const receipt = await setupDatedReceipt(page, helpers);
    await visit(page, `product?code=${receipt.product_code}`);
    const lots = page.locator(".product-lots-section");
    await lots.waitFor();
    await button(lots, "Create clearance").first().click();
    const dialog = page.getByRole("dialog", {
      name: "Create clearance offer",
      exact: true,
    });
    await field(dialog, "Clearance price").fill("2.49");
    await button(dialog, "Create clearance offer").click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => {
        const current = await savedState(page);
        return current.offers.some(
          (offer) =>
            offer.clearance &&
            offer.product_code === receipt.product_code &&
            offer.branch === receipt.branch &&
            offer.status === "active",
        );
      })
      .toBe(true);
    const state = await savedState(page);
    const clearance = state.offers.find(
      (offer) =>
        offer.clearance &&
        offer.product_code === receipt.product_code &&
        offer.branch === receipt.branch &&
        offer.status === "active",
    );
    expect(clearance).toBeTruthy();
    await visit(page, "lookup");
    const lookup = page.locator(".lookup-page");
    await field(lookup, "Search products").fill(receipt.product_code);
    await field(lookup, "Search products").press("Enter");
    await expect(page.locator(".lookup-clearance-row")).toBeVisible();
    await expect(page.locator(".lookup-clearance-row")).toContainText("2.49");
    const dates = page.locator(".product-dates-readonly");
    await expect(dates).toBeVisible();
    await expect(dates.getByRole("switch")).toHaveCount(0);
    await expect(
      dates.getByRole("button", { name: exact("Add date", "افزودن تاریخ") }),
    ).toHaveCount(0);
    return {
      selector: ".lookup-page",
      capture: "page",
      evidence: {
        ...receipt,
        clearance_offer_id: clearance.id,
        lot_id: clearance.lot_id,
        clearance_price: "2.49",
        dates: "read-only",
      },
    };
  }
  throw new Error(`Unknown C6 catalog capture scene: ${scene}`);
}
