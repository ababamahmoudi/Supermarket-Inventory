import { expect, test, type Page } from "@playwright/test";
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
}
async function freezeClock(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}
test("Undo restores the product and retains append-only recorded history", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await freezeClock(page);
  await saveName(page, "Potato Chips 150 g corrected");
  const toast = page.locator(".undo-toast-stack");
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
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
  await expect(page.locator(".history-table")).toContainText("Undone");
  await expect(page.locator(".history-table")).toContainText("Save product");
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
    saved.some((item: { action: string }) => item.action === "Save product"),
  ).toBe(true);
});

test("Undo stays above a native modal and keyboard focus pauses its own timer", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await freezeClock(page);
  await saveName(page, "Potato Chips 150 g temporary name");
  await page.mouse.move(0, 0);
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: /^Edit Potato Chips/ }).click();
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
  await expect(page.locator(".lookup-detail-header")).not.toContainText(
    "temporary name",
  );
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
  const row = page
    .locator(".history-table tbody tr")
    .filter({ hasText: "Save product" })
    .first();
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
  const rows = page
    .locator(".history-table tbody tr")
    .filter({ hasText: "Save product" });
  const older = rows
    .filter({ hasText: "first change", hasNotText: "latest change" })
    .first();
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

test("stacked toasts cap visible items and expire independently, including hidden extras", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await freezeClock(page);
  for (let i = 0; i < 5; i++) {
    await saveName(page, `Potato Chips 150 g revision ${i}`);
    await page.mouse.move(0, 0);
    await page.clock.runFor(500);
  }
  await expect(page.locator(".undo-toast:not([hidden])")).toHaveCount(3);
  await expect(page.locator(".undo-toast-more")).toHaveText("+2 more");
  await page.clock.runFor(7500);
  await expect(page.locator(".undo-toast")).toHaveCount(4);
  await page.clock.runFor(500);
  await expect(page.locator(".undo-toast")).toHaveCount(3);
  await expect(page.locator(".undo-toast-more")).not.toBeVisible();
  await page.clock.runFor(500);
  await expect(page.locator(".undo-toast")).toHaveCount(2);
  await page.clock.runFor(500);
  await expect(page.locator(".undo-toast")).toHaveCount(1);
  await page.clock.runFor(500);
  await expect(page.locator(".undo-toast-stack")).not.toBeVisible();
});

test("hover pauses only one toast and English/Persian corner placement mirrors", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Mouse hover is a desktop interaction; phone stack sizing is covered separately.",
  );
  await signIn(page, "Supervisor");
  await freezeClock(page);
  await saveName(page, "Potato Chips 150 g first change");
  await page.clock.runFor(1000);
  await saveName(page, "Potato Chips 150 g second change");
  const older = page.locator(".undo-toast").last();
  await older.hover();
  await page.clock.runFor(10000);
  await expect(page.locator(".undo-toast")).toHaveCount(1);
  const english = await page.locator(".undo-toast-stack").boundingBox();
  const width = await page.evaluate(() => innerWidth);
  expect(width - english!.x - english!.width).toBeLessThan(40);
  await setLanguage(page, "fa");
  await expect(page.locator(".undo-toast")).toContainText("ذخیره محصول");
  const persian = await page.locator(".undo-toast-stack").boundingBox();
  expect(persian!.x).toBeLessThan(40);
  await page.mouse.move(0, 0);
  await page.clock.runFor(8999);
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
