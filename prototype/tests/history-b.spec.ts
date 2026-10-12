import { expect, test, type Page, type Locator } from "@playwright/test";
import { setLanguage, signIn } from "./helpers";

async function saveName(page: Page, name: string) {
  await page.goto("/#lookup");
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await page.getByRole("button", { name: /^Edit Potato Chips/ }).click();
  const editor = page.getByRole("dialog", {
    name: "Edit product",
    exact: true,
  });
  await editor.getByLabel("English name", { exact: true }).fill(name);
  await editor
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await expect(editor).not.toBeVisible();
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
  await saveName(page, "Potato Chips 150 g corrected");
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
  await page.getByLabel("Search products", { exact: true }).fill("0009");
  await expect(page.locator(".lookup-detail-header")).toContainText(
    "Potato Chips 150 g",
  );
  await expect(page.locator(".lookup-detail-header")).not.toContainText(
    "corrected",
  );
  await page.goto("/#history");
  await expect(
    page.getByRole("heading", { name: "History", exact: true }),
  ).toBeVisible();
  for (const label of ["From date", "To date"]) {
    const geometry = await page
      .getByRole("button", { name: label, exact: true })
      .boundingBox();
    expect(geometry?.width).toBeCloseTo(180, 0);
    expect(geometry?.height).toBeCloseTo(44, 0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await historyRow(page, "Reverted Save product");
  await historyRow(page, "Save product", "corrected");
  await expect(page.locator(".history-table")).toContainText("Reverted");
  await expect(page.locator(".history-table")).toContainText("Save product");
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).activity,
  );
  expect(saved.at(-1)).toMatchObject({
    action: "Reverted Save product",
    by: "Demo Supervisor",
    actor_username: "supervisor",
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
  await undo.click();
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.locator(".lookup-approved-price .offer-pill"),
  ).toContainText("2 for $5");
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).activity,
  );
  expect(saved.at(-1)).toMatchObject({
    action: "Undone",
    by: "Demo Supervisor",
    actor_username: "supervisor",
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
  await saveName(page, "Potato Chips 150 g approved edit");
  await page.clock.runFor(10001);
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
  await page.goto("/#history");
  const row = await historyRow(page, "Save product");
  await row.getByRole("button", { name: "Revert", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Revert change",
    exact: true,
  });
  await expect(dialog).toContainText("Demo Supervisor");
  await expect(dialog).toContainText("All branches");
  await expect(dialog).toContainText("Potato Chips 150 g approved edit");
  await expect(dialog).toContainText("Potato Chips 150 g");
  let stored = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("supermarket-prototype-v1")!,
      ).products.find((item: { code: string }) => item.code === "0009").name_en,
  );
  expect(stored).toContain("approved edit");
  await dialog
    .getByRole("button", { name: "Revert change", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Change reverted");
  stored = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("supermarket-prototype-v1")!,
      ).products.find((item: { code: string }) => item.code === "0009").name_en,
  );
  expect(stored).toBe("Potato Chips 150 g");
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
  await saveName(page, "Potato Chips 150 g first change");
  await saveName(page, "Potato Chips 150 g latest change");
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
  await page.getByLabel("Search products", { exact: true }).fill("0009");
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
  expect(codes).toHaveLength(5);
  await freezeClock(page);
  for (const code of codes) {
    await stopOffer(page, code);
    await expect(page.locator(".undo-toast")).toHaveCount(1);
    await expect(page.locator(".undo-toast")).toContainText("Stop offer");
    await page.mouse.move(0, 0);
    await page.clock.runFor(500);
  }
  await expect(page.locator(".undo-toast-more")).toHaveCount(0);
  await expect(
    page.locator(".current-offers-table tr[data-product-code]"),
  ).toHaveCount(0);
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
  await saveName(page, "Potato Chips 150 g Supervisor edit");
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
