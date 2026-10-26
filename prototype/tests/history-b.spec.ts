import { configuredPersonExpectation } from "./configured-person-expectations";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";
import { approvedLookupPrices } from "./lookup-approved-price-fixture";

async function saveName(page: Page, name: string) {
  // Lavash has existing active date evidence, so this remains a name-only
  // Save rather than changing tracking to bypass C8's required-date rule.
  const before = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => {
      const state = JSON.parse(JSON.stringify(canonicalState)!);
      const product = state.products.find(
        (item: { code: string }) => item.code === "0006",
      );
      return {
        ledger: state.ledger,
        invoices: state.invoices,
        expiry: state.expiry,
        prices: {
          selling_price: product.selling_price,
          branch_prices: product.branch_prices,
          last_cost_before_tax: product.last_cost_before_tax,
          pending_price: product.pending_price,
        },
      };
    },
  );
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0006");
  await page.getByRole("button", { name: /^Edit Lavash Bread/ }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await expect(
    editor.getByRole("switch", { name: "Date tracking", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    editor.locator(".product-editor-date-row:not([data-removed])").first(),
  ).toBeVisible();
  await editor.getByLabel("English name", { exact: true }).fill(name);
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
  const after = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => {
      const state = JSON.parse(JSON.stringify(canonicalState)!);
      const product = state.products.find(
        (item: { code: string }) => item.code === "0006",
      );
      return {
        ledger: state.ledger,
        invoices: state.invoices,
        expiry: state.expiry,
        prices: {
          selling_price: product.selling_price,
          branch_prices: product.branch_prices,
          last_cost_before_tax: product.last_cost_before_tax,
          pending_price: product.pending_price,
        },
      };
    },
  );
  expect(after).toEqual(before);
  await page.mouse.move(0, 0);
}
async function freezeClock(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}
async function stopOffer(page: Page, code: string) {
  await page.goto("/#offers");
  const row = page.locator(
    `.current-offers-table tr[data-product-code="${code}"]`,
  );
  await expect(row).toHaveCount(1);
  await expect(
    row.getByRole("button", { name: "More", exact: true }),
  ).toHaveCount(0);
  await row.getByRole("button", { name: "Stop offer", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Stop offer", exact: true })
    .getByRole("button", { name: "Stop offer", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page.mouse.move(0, 0);
}
async function historyRow(
  page: Page,
  action: string,
  include = "",
  exclude = "",
): Promise<Locator> {
  // Protected reads are asynchronous; enumerate only the rendered History.
  await expect(page.locator(".history-table")).toBeVisible();
  const rows = await page
    .locator(".history-table tbody > tr:not(.table-expanded-row)")
    .all();
  for (const row of rows) {
    const disclosure = row.getByRole("button", {
      name: "Show details",
      exact: true,
    });
    if (await disclosure.count()) await disclosure.click();
    const detail = row.locator(
      "xpath=following-sibling::tr[1][contains(@class, 'table-expanded-row')]",
    );
    const text = `${await row.innerText()} ${(await detail.count()) ? await detail.innerText() : ""}`;
    const actionCell = row.locator('[data-column-label="Action"]');
    const actionDetail = detail.locator(
      "xpath=.//dt[normalize-space()='Action']/following-sibling::dd[1]",
    );
    const actualAction = (await actionCell.count())
      ? await actionCell.innerText()
      : await actionDetail.innerText();
    if (
      actualAction.trim() === action &&
      text.includes(include) &&
      (!exclude || !text.includes(exclude))
    )
      return row;
  }
  throw new Error(
    `History must retain ${action} ${include} ${exclude ? `without ${exclude}` : ""}`,
  );
}
test("quiet product Save retains append-only History and can be explicitly reverted", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await freezeClock(page);
  await saveName(page, "Lavash Bread 500 g corrected");
  const toast = page.locator(".undo-toast-stack");
  await expect(toast).not.toBeVisible();
  await page.goto("/#history");
  await (
    await historyRow(page, "Save product")
  )
    .getByRole("button", { name: "Revert", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Revert change", exact: true })
    .getByRole("button", { name: "Revert change", exact: true })
    .click();
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0006");
  await expect(page.locator(".lookup-detail-header")).toContainText(
    "Lavash Bread 500 g",
  );
  await expect(page.locator(".lookup-detail-header")).not.toContainText(
    "corrected",
  );
  await page.goto("/#history");
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();
  const range = page.getByRole("button", { name: "Date range", exact: true });
  await expect(range).toHaveCount(1);
  await range.click();
  const rangeDialog = page.getByRole("dialog", {
    name: "Date range",
    exact: true,
  });
  for (const label of ["Today", "This week", "This month"])
    await expect(
      rangeDialog.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  for (const label of ["From", "To"])
    await expect(
      rangeDialog.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  await rangeDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await historyRow(page, "Reverted Save product");
  await historyRow(page, "Save product", "corrected");
  await expect(page.locator(".history-table")).toContainText("Reverted");
  await expect(page.locator(".history-table")).toContainText("Save product");
  const saved = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).activity,
  );
  expect(saved.at(-1)).toMatchObject({
    action: "Reverted Save product",
    by: configuredPersonExpectation("manager").name_en,
    actor_username: configuredPersonExpectation("manager").username,
    reversal_kind: "revert",
  });
  expect(
    saved.some((item: { action: string }) => item.action === "Save product"),
  ).toBe(true);
});

test("Undo stays above a native modal and keyboard focus pauses its own timer", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await approvedLookupPrices(page, ["0003"]);
  await freezeClock(page);
  await stopOffer(page, "0003");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0003");
  await page.mouse.move(0, 0);
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: /^Edit Sour Cherry Juice/ }).click();
  const dialog = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  const undo = dialog.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeVisible();
  await undo.focus();
  await expect(undo).toBeFocused();
  await page.clock.runFor(15000);
  await expect(undo).toBeVisible();
  expect(
    await undo.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return (
        document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        ) === node
      );
    }),
  ).toBe(true);
  const beforeUndo = await readCanonicalBusinessEvidence(page);
  const beforeIds = new Set(beforeUndo.activity.map((entry) => entry.id));
  const stopped = beforeUndo.activity.filter(
    (entry) => entry.action === "Stop offer" && entry.product_code === "0003",
  );
  expect(stopped).toHaveLength(1);
  await undo.click();
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.locator(".lookup-approved-price .offer-pill"),
  ).toContainText("2 for $5");
  const saved = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => JSON.parse(JSON.stringify(canonicalState)!).activity,
  );
  // Price-update cancellation is a later derived audit event. Select the
  // newly appended reversal of this exact Stop offer command instead.
  const reversals = saved.filter(
    (entry: { id: string; reversed_activity_id?: string }) =>
      !beforeIds.has(entry.id) && entry.reversed_activity_id === stopped[0].id,
  );
  expect(reversals).toHaveLength(1);
  expect(reversals[0]).toMatchObject({
    action: "Undone",
    by: configuredPersonExpectation("manager").name_en,
    actor_username: configuredPersonExpectation("manager").username,
    reversal_kind: "undo",
  });
  expect(
    saved.some((item: { action: string }) => item.action === "Stop offer"),
  ).toBe(true);
});

test("History Revert previews the actor, branch, values and requires confirmation", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await freezeClock(page);
  await saveName(page, "Lavash Bread 500 g approved edit");
  await page.clock.runFor(10001);
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
  await page.goto("/#history");
  const row = await historyRow(page, "Save product");
  await row.getByRole("button", { name: "Revert", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Revert change",
    exact: true,
  });
  await expect(dialog).toContainText(
    configuredPersonExpectation("manager").name_en,
  );
  await expect(dialog).toContainText("All branches");
  await expect(dialog).toContainText("Lavash Bread 500 g approved edit");
  await expect(dialog).toContainText("Lavash Bread 500 g");
  let stored = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) =>
      JSON.parse(JSON.stringify(canonicalState)!).products.find(
        (item: { code: string }) => item.code === "0006",
      ).name_en,
  );
  expect(stored).toContain("approved edit");
  await dialog
    .getByRole("button", { name: "Revert change", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Change reverted");
  stored = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) =>
      JSON.parse(JSON.stringify(canonicalState)!).products.find(
        (item: { code: string }) => item.code === "0006",
      ).name_en,
  );
  expect(stored).toBe("Lavash Bread 500 g");
  await historyRow(page, "Reverted Save product");
  await expect(page.locator(".history-table")).toContainText(
    "Reverted Save product",
  );
});

test("an intervening edit displays a conflict and cannot be silently overwritten", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await freezeClock(page);
  await saveName(page, "Lavash Bread 500 g first change");
  await saveName(page, "Lavash Bread 500 g latest change");
  await page.goto("/#history");
  const older = await historyRow(
    page,
    "Save product",
    "first change",
    "latest change",
  );
  await older.getByRole("button", { name: "Revert", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Revert change",
    exact: true,
  });
  await expect(
    dialog.getByRole("alert").filter({ hasText: "changed again" }),
  ).toContainText("changed again");
  await expect(
    dialog.getByRole("button", { name: "Revert change", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0006");
  await expect(page.locator(".lookup-detail-header")).toContainText(
    "latest change",
  );
});

test("each eligible action replaces the single toast and its last message expires after eight seconds", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#offers");
  const codes = await page
    .locator(".current-offers-table tr[data-product-code]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-product-code")!),
    );
  // C8 adds two sale records beside the original five multi-buy offers.
  const multiBuyCodes = ["0003", "0005", "0006", "0007", "0009"];
  expect([...codes].sort()).toEqual([...multiBuyCodes, "0012", "0008"].sort());
  const sale = page.locator(
    '.current-offers-table tr[data-product-code="0012"]',
  );
  await expect(sale).toContainText("Stainless Steel Pot 24 cm");
  await expect(sale).toContainText("Sale price");
  await expect(sale).toContainText("$16.99");
  const request = page.locator(
    '.current-offers-table tr[data-product-code="0008"]',
  );
  await expect(request).toContainText("Sunflower Oil 1.8 L");
  await expect(request).toContainText("Sale requested");
  await expect(request).toContainText("$9.49");
  await expect(request).toContainText("$7.99");
  await freezeClock(page);
  for (const code of multiBuyCodes) {
    await stopOffer(page, code);
    await expect(page.locator(".undo-toast")).toHaveCount(1);
    await expect(page.locator(".undo-toast")).toContainText("Stop offer");
    await page.mouse.move(0, 0);
    await page.clock.runFor(500);
  }
  await expect(page.locator(".undo-toast-more")).toHaveCount(0);
  await expect(
    page.locator(".current-offers-table tr[data-product-code]"),
  ).toHaveCount(2);
  await expect(sale).toContainText("$16.99");
  await expect(request).toContainText("$9.49");
  await expect(request).toContainText("$7.99");
  await page.clock.runFor(7499);
  await expect(page.locator(".undo-toast")).toHaveCount(1);
  await page.clock.runFor(1);
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
});

test("hover or phone keyboard focus pauses the single toast and English/Persian placement mirrors", async ({
  page,
  isMobile,
}) => {
  await signIn(page, "Supervisor");
  await freezeClock(page);
  await stopOffer(page, "0003");
  await page.clock.runFor(1000);
  const secondCode = await page
    .locator(".current-offers-table tr[data-product-code]")
    .filter({ hasText: "Mix-and-match" })
    .first()
    .getAttribute("data-product-code");
  expect(secondCode).not.toBeNull();
  await stopOffer(page, secondCode!);
  const older = page.locator(".undo-toast").last();
  if (isMobile)
    await older.getByRole("button", { name: "Undo", exact: true }).focus();
  else await older.hover();
  await page.clock.runFor(10000);
  await expect(page.locator(".undo-toast")).toHaveCount(1);
  const english = await page.locator(".undo-toast-stack").boundingBox();
  const width = await page.evaluate(() => innerWidth);
  expect(width - english!.x - english!.width).toBeLessThan(40);
  await setLanguage(page, "fa");
  await expect(page.locator(".undo-toast")).toContainText("توقف پیشنهاد");
  if (isMobile)
    await older.getByRole("button", { name: "واگرد", exact: true }).focus();
  else await older.hover();
  const persian = await page.locator(".undo-toast-stack").boundingBox();
  expect(persian!.x).toBeLessThan(40);
  await page.mouse.move(0, 0);
  if (isMobile) await page.locator("#main-content").focus();
  await page.clock.runFor(7999);
  await expect(page.locator(".undo-toast")).toHaveCount(1);
  await page.clock.runFor(1);
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
});

test("workers see only their own History and cashiers cannot open it", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await saveName(page, "Lavash Bread 500 g Supervisor edit");
  await signIn(page, "Floor Worker");
  await page.goto("/#history");
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-table")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revert", exact: true }),
  ).toHaveCount(0);
  await signIn(page, "Cashier");
  await page.goto("/#history");
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
});
