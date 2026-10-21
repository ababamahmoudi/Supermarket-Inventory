import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test } from "@playwright/test";
import {
  chooseOption,
  openShellAction,
  setBranch,
  setLanguage,
  signIn,
} from "./helpers";

async function expandDetails(scope: import("@playwright/test").Locator) {
  const buttons = scope.getByRole("button", {
    name: /^(Show details|نمایش جزئیات)$/,
  });
  while (await buttons.count()) await buttons.first().click();
}
async function columnValue(
  row: import("@playwright/test").Locator,
  label: string,
) {
  const cell = row.locator(`td[data-column-label="${label}"]`);
  if (await cell.count()) return cell;
  return row
    .locator("xpath=following-sibling::tr[1]")
    .locator("dl > div")
    .filter({ has: row.page().getByText(label, { exact: true }) })
    .locator("dd");
}

test.setTimeout(60000);

test("Supervisor adds a quoted supplier item without invented purchases and worker views stay nonfinancial", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  const table = page.locator(".supplier-items-table");
  // The protected read mounts this table asynchronously. Wait for a real row
  // before counting optional disclosures for width-hidden purchase columns.
  await expect(
    table.locator("tbody > tr:not(.table-expanded-row)").first(),
  ).toBeVisible();
  await expandDetails(table);
  if (
    await table
      .getByRole("columnheader", { name: "Last bought / case", exact: true })
      .count()
  )
    await expect(
      table.getByRole("columnheader", {
        name: "Last bought / case",
        exact: true,
      }),
    ).toBeVisible();
  else
    await expect(
      table.getByText("Last bought / case", { exact: true }).first(),
    ).toBeVisible();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add item", exact: true });
  expect(
    await dialog.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(720);
  await chooseOption(
    page,
    dialog.getByLabel("Product", { exact: true }),
    "0004",
    "0004 · Black Tea 450 g",
  );
  await dialog
    .getByLabel("Supplier code (optional)", { exact: true })
    .fill("C2-TEA");
  await dialog.getByLabel("Units per case", { exact: true }).fill("12");
  await dialog
    .getByLabel("Expected unit cost (optional)", { exact: true })
    .fill("3.55");
  expect(
    await dialog
      .getByLabel("Units per case", { exact: true })
      .evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(160);
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const item = table.getByRole("row").filter({ hasText: "C2-TEA" });
  await expect(item).toContainText("Case of 12");
  await expect(item.locator(".money")).toHaveCount(0);
  await expandDetails(item);
  await expect(await columnValue(item, "Date last bought")).toHaveText("—");
  await expect(await columnValue(item, "Last invoice")).toHaveText("—");
  await item.focus();
  await page.keyboard.press("Enter");
  const history = page.getByRole("dialog", {
    name: "Price history",
    exact: true,
  });
  await expect(history).toContainText("No purchase history yet.");
  await expect(history).toContainText("Expected unit cost");
  await expect(history).toContainText("$3.55");
  await page.keyboard.press("Escape");
  await expect(history).not.toBeVisible();
  const saved = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!),
  );
  expect(
    saved.supplier_items.find(
      (record: { supplier_item_code: string }) =>
        record.supplier_item_code === "C2-TEA",
    ),
  ).toMatchObject({
    units_per_case: 12,
    quoted_unit_cost_before_tax: "3.5500",
  });
  await page.reload();
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  await expect(
    page
      .locator(".supplier-items-table")
      .getByRole("row")
      .filter({ hasText: "C2-TEA" }),
  ).toBeVisible();
  await signIn(page, "Floor Worker");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  const content = page.locator(".supplier-tab-card");
  await expect(content.locator(".money")).toHaveCount(0);
  await expect(
    content.getByRole("button", { name: /^(Add item|Edit|History)$/ }),
  ).toHaveCount(0);
  await expect(
    content.getByRole("columnheader", { name: /Last bought \/ (case|unit)/ }),
  ).toHaveCount(0);
  await expect(
    content.getByRole("row").filter({ hasText: "C2-TEA" }),
  ).toContainText("Case of 12");
  await setLanguage(page, "fa");
  await expect(
    page
      .locator(".supplier-tabs")
      .getByRole("tab", { name: "کالاهای تأمین‌کننده", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(content.locator(".money")).toHaveCount(0);
  await expect(
    content.locator(
      "select, input[type='number'], input[type='date'], input[type='checkbox']",
    ),
  ).toHaveCount(0);
});

test("remembered pack and supplier code edits preserve posted history and remain keyboard accessible", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await setBranch(page, "all");
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page.getByRole("tab", { name: "Supplier items", exact: true }).click();
  const original = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoices,
  );
  const table = page.locator(".supplier-items-table");
  const row = table.getByRole("row").filter({ hasText: "0002" }).first();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
  await editor
    .getByLabel("Supplier code (optional)", { exact: true })
    .fill("C2-PACK");
  await editor.getByLabel("Units per case", { exact: true }).fill("12");
  await editor.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(editor).not.toBeVisible();
  const edited = table.getByRole("row").filter({ hasText: "C2-PACK" });
  await expect(edited).toContainText("Case of 12");
  await edited.focus();
  await page.keyboard.press("Enter");
  const history = page.getByRole("dialog", {
    name: "Price history",
    exact: true,
  });
  await expect(
    history.locator(".supplier-item-price-history tbody tr"),
  ).not.toHaveCount(0);
  await expandDetails(history.locator(".supplier-item-price-history"));
  await expect(history.locator(".supplier-item-price-history")).toContainText(
    "Case of 1",
  );
  await page.evaluate(async () => document.fonts.ready);
  const geometry = await history.evaluate((element) => {
    const findings: string[] = [];
    let textFragments = 0;
    const dialogBounds = element.getBoundingClientRect();
    if (dialogBounds.left < -2 || dialogBounds.right > innerWidth + 2)
      findings.push("Price history dialog outside viewport");
    if (element.scrollWidth > element.clientWidth + 2)
      findings.push("Price history dialog overflows horizontally");
    const wrapper = element.querySelector(".supplier-item-price-history")!;
    if (innerWidth > 760 && wrapper.scrollWidth > wrapper.clientWidth + 2)
      findings.push("Price history table overflows its panel");
    for (const cell of wrapper.querySelectorAll("th, td")) {
      if (!cell.getClientRects().length) continue;
      const bounds = cell.getBoundingClientRect();
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (
          !node.textContent?.trim() ||
          !node.parentElement?.getClientRects().length ||
          node.parentElement.closest(".sr-only, [aria-hidden=true], [hidden]")
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          textFragments++;
          if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
            findings.push(`Clipped history cell: ${node.textContent.trim()}`);
        }
      }
    }
    return { findings, textFragments };
  });
  expect(geometry.findings).toEqual([]);
  expect(geometry.textFragments).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(history).not.toBeVisible();
  const after = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).invoices,
  );
  expect(after).toEqual(original);
  await (await openShellAction(page, "Switch to dark theme")).click();
  await setLanguage(page, "fa");
  await expect(edited).toContainText("C2-PACK");
  await edited.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "تاریخچه قیمت", exact: true }),
  ).toBeVisible();
  await expandDetails(page.locator(".supplier-item-price-history"));
  await expect(
    page.locator(".supplier-item-price-history bdi.money").first(),
  ).toHaveAttribute("dir", "ltr");
});
