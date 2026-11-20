import { expect, test } from "@playwright/test";
import source from "../../seed/demo-data.json" with { type: "json" };
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setBranch, signIn } from "./helpers";

async function openCreateOffer(page: import("@playwright/test").Page) {
  await page.goto("/");
  await signIn(page, "manager");
  await setBranch(page, "Branch 1");
  await page.goto("/#offers");
  await page.getByRole("button", { name: "Create offer", exact: true }).click();
  return page.getByRole("dialog", { name: "Create offer", exact: true });
}

test("product choices search both names, code and barcode, highlight matches and leave business unchanged on Cancel", async ({
  page,
}) => {
  const dialog = await openCreateOffer(page);
  const before = await readCanonicalBusinessEvidence(page);
  const product = source.products.find((row) => row.code === "0003")!;
  const trigger = dialog.getByRole("combobox", {
    name: "Product",
    exact: true,
  });
  for (const query of [
    product.name_en,
    product.name_fa,
    product.code,
    product.barcode,
  ]) {
    await trigger.click();
    await expect(
      page.getByRole("option", { name: "Choose a product", exact: true }),
    ).toHaveCount(0);
    const search = page.getByRole("textbox", {
      name: "Search options",
      exact: true,
    });
    const beforeTyping = await trigger.boundingBox();
    await search.fill(query);
    const choice = page
      .getByRole("option")
      .filter({ hasText: product.name_en });
    await expect(choice).toHaveCount(1);
    await expect(choice.locator("mark").first()).toBeVisible();
    expect((await choice.boundingBox())!.height).toBeLessThanOrEqual(88);
    const afterTyping = await trigger.boundingBox();
    expect(Math.abs(afterTyping!.y - beforeTyping!.y)).toBeLessThanOrEqual(2);
    if (query === product.barcode) await search.press("Enter");
    else await choice.click();
    await expect(trigger).toContainText(product.code);
  }
  await trigger.click();
  await page
    .getByRole("textbox", { name: "Search options", exact: true })
    .fill("fictional-unmatched-name");
  await expect(
    page.getByRole("status").filter({ hasText: "No matches" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search options", exact: true })
    .press("Escape");
  await expect(trigger).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.products).toEqual(before.products);
  expect(after.offers).toEqual(before.offers);
  expect(after.sales).toEqual(before.sales);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
});

test("a short-window picker stays inside the viewport with a fixed search header and a reachable last choice", async ({
  page,
}) => {
  await page.setViewportSize({
    width: page.viewportSize()!.width,
    height: 500,
  });
  const dialog = await openCreateOffer(page);
  const trigger = dialog.getByRole("combobox", {
    name: "Product",
    exact: true,
  });
  await trigger.click();
  const popup = page.locator(".ui-select-popover");
  const choices = popup.getByRole("option");
  expect(await choices.count()).toBeGreaterThan(8);
  const bounds = await popup.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(12);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width - 12,
  );
  expect(bounds!.y).toBeGreaterThanOrEqual(16);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(484);
  const search = page.getByRole("textbox", {
    name: "Search options",
    exact: true,
  });
  const headerBefore = await search.boundingBox();
  await search.press("End");
  const last = choices.last();
  await expect(last).toHaveClass(/is-active/);
  await expect
    .poll(() =>
      popup.locator(".ui-option-list").evaluate((element) => element.scrollTop),
    )
    .toBeGreaterThan(0);
  const headerAfter = await search.boundingBox();
  expect(Math.abs(headerAfter!.y - headerBefore!.y)).toBeLessThanOrEqual(2);
  const hit = await last.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return (
      document
        .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        ?.closest("[role=option]") === element
    );
  });
  expect(hit).toBe(true);
  const label = await last.getAttribute("aria-label");
  await last.click();
  await expect(trigger).toContainText(label!);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("supplier, payable, offer and return rows have one details control with separate product navigation", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "manager");
  await setBranch(page, "Branch 1");
  const before = await readCanonicalBusinessEvidence(page);
  for (const [route, table] of [
    ["suppliers", ".suppliers-table"],
    ["payables", ".payables-overview-table"],
    ["offers", ".current-offers-table"],
    ["returns", ".returns-overview-table"],
  ] as const) {
    await page.goto(`/#${route}`);
    const list = page.locator(table);
    await expect(list).toBeVisible();
    const rows = list.locator("tbody > tr[data-row-href]");
    await expect(rows.first()).toBeVisible();
    await expect(list.locator(".table-details-toggle")).toHaveCount(0);
    const names = await list.evaluate((node) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--text)";
      node.append(probe);
      const ink = getComputedStyle(probe).color;
      probe.remove();
      return {
        ink,
        colors: [
          ...node.querySelectorAll(
            ".phone-list-name a, tbody tr[data-row-href] > td:first-child a:not(.table-row-link), a.entity-link",
          ),
        ].map((link) => getComputedStyle(link).color),
      };
    });
    expect(names.colors.length).toBeGreaterThan(0);
    expect(names.colors.every((color) => color !== names.ink)).toBe(true);
    for (const row of await rows.all())
      await expect(row.locator(".table-row-link")).toHaveCount(1);
  }
  await page.goto("/#offers");
  const regular = page.locator(
    '.current-offers-table tr[data-product-code="0003"]',
  );
  await expect(
    regular.getByRole("button", { name: "More", exact: true }),
  ).toHaveCount(0);
  await expect(
    regular.getByRole("button", { name: "Stop offer", exact: true }),
  ).toBeVisible();
  await regular
    .getByRole("button", { name: "Open offer", exact: true })
    .click();
  const record = page.getByRole("dialog", { name: "Offer", exact: true });
  await expect(record).toContainText("0003");
  await record.getByRole("button", { name: "Close", exact: true }).click();
  await regular.getByRole("link", { name: /Sour Cherry Juice/ }).click();
  await expect(page).toHaveURL(/#product\?code=0003$/);
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.products).toEqual(before.products);
  expect(after.offers).toEqual(before.offers);
  expect(after.returns).toEqual(before.returns);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
});
