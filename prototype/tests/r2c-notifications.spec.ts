import { expect, test, type Page } from "@playwright/test";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { setBranch, setLanguage, signIn } from "./helpers";
import { route } from "./e2-browser-flow";

async function bell(page: Page) {
  await page.locator(".topbar .notifications-menu").click();
  return page.locator(".notifications-popover");
}
async function clearInbox(page: Page) {
  const panel = await bell(page);
  const clear = panel.getByRole("menuitem", { name: "Clear all", exact: true });
  if (await clear.isEnabled()) await clear.click();
  await expect(panel).toContainText("No new notifications.");
  await page.keyboard.press("Escape");
}
async function createThreeBranchDecision(page: Page) {
  await page.goto("/");
  await signIn(page, "manager");
  await setBranch(page, "Branch 1");
  await clearInbox(page);
  const before = await readCanonicalBusinessEvidence(page);
  await route(page, "product?code=0004");
  await page
    .locator(".product-header-actions")
    .getByRole("button", { name: "Change price", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Change price",
    exact: true,
  });
  await dialog.getByRole("radio", { name: /^New regular price/ }).click();
  await dialog.getByRole("button", { name: "All stores", exact: true }).click();
  await dialog.getByLabel("Price", { exact: true }).fill("7.79");
  await dialog
    .getByRole("button", { name: "Save new price", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator(".notifications-menu .notification-count"),
  ).toHaveText("1");
  const after = await readCanonicalBusinessEvidence(page);
  const tasks = after.price_update_tasks!.filter(
    (row) => row.product_code === "0004" && row.status === "pending",
  );
  expect(tasks.map((row) => row.branch).sort()).toEqual([
    "Branch 1",
    "Branch 2",
    "Branch 3",
  ]);
  expect(new Set(tasks.map((row) => row.source_activity_id)).size).toBe(1);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  expect(after.invoices).toEqual(before.invoices);
  return tasks;
}

test("a real three-branch price decision has one unread group, opens its current authorized task and reads only this inbox", async ({
  page,
}) => {
  const tasks = await createThreeBranchDecision(page);
  await setBranch(page, "Branch 2");
  let panel = await bell(page);
  const item = panel.locator(".personal-notification");
  await expect(item).toHaveCount(1);
  await expect(item).toHaveClass(/is-unread/);
  for (const label of ["Black Tea", "North York", "Richmond Hill", "Newmarket"])
    await expect(item).toContainText(label);
  await item.click();
  await expect(page).toHaveURL(
    new RegExp(
      `price-update\\?id=${tasks.find((task) => task.branch === "Branch 2")!.id}$`,
    ),
  );
  await expect(page.locator(".notification-count")).toHaveCount(0);
  const read = await readCanonicalBusinessEvidence(page);
  expect(
    read
      .notifications!.filter(
        (row) =>
          row.kind === "price_update_created" &&
          row.product_code === "0004" &&
          row.recipient_user_id === "demo-person-manager",
      )
      .every((row) => Boolean(row.read_at)),
  ).toBe(true);
  expect(
    read
      .notifications!.filter(
        (row) =>
          row.kind === "price_update_created" &&
          row.product_code === "0004" &&
          row.recipient_user_id === "demo-person-owner",
      )
      .every((row) => !row.read_at),
  ).toBe(true);
  panel = await bell(page);
  await expect(panel.locator(".personal-notification")).toHaveClass(/is-read/);
  await panel.getByRole("menuitem", { name: "Clear all", exact: true }).click();
  await expect(panel).toContainText("No new notifications.");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".topbar")).toBeVisible();
  panel = await bell(page);
  await expect(panel.locator(".personal-notification")).toHaveCount(0);
  await expect(page.locator(".notification-count")).toHaveCount(0);
  const cleared = await readCanonicalBusinessEvidence(page);
  expect(
    cleared
      .notifications!.filter(
        (row) =>
          row.kind === "price_update_created" &&
          row.product_code === "0004" &&
          row.recipient_user_id === "demo-person-manager",
      )
      .every((row) => Boolean(row.dismissed_at)),
  ).toBe(true);
  expect(cleared.price_update_tasks).toEqual(read.price_update_tasks);
});

test("the short-window inbox keeps its header, boxed items and dates reachable in both languages", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "manager");
  await page.setViewportSize({
    width: page.viewportSize()!.width,
    height: 500,
  });
  for (const lang of ["en", "fa"] as const) {
    await setLanguage(page, lang);
    const trigger = page.locator(".topbar .notifications-menu");
    const triggerBefore = await trigger.boundingBox();
    const panel = await bell(page);
    const bounds = (await panel.boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(380);
    expect(bounds.height).toBeLessThanOrEqual(350);
    expect(bounds.x).toBeGreaterThanOrEqual(12);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      page.viewportSize()!.width - 12,
    );
    expect(bounds.y).toBeGreaterThanOrEqual(16);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(484);
    const header = panel.locator(".personal-notifications-header");
    const before = (await header.boundingBox())!;
    const scroll = panel.locator(".personal-notifications-scroll");
    expect(
      await scroll.locator(".personal-notification").count(),
    ).toBeGreaterThan(3);
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const after = (await header.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
    const last = scroll.locator(".personal-notification").last();
    await expect(last).toBeInViewport();
    expect(
      await panel.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      ),
    ).toBeLessThanOrEqual(2);
    const contentOverflow = await panel
      .locator(".personal-notification")
      .evaluateAll(
        (rows) =>
          rows.filter(
            (row) =>
              row.scrollHeight > row.clientHeight + 2 ||
              row.scrollWidth > row.clientWidth + 2,
          ).length,
      );
    expect(contentOverflow).toBe(0);
    const problems = await panel.evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>("time,button")].flatMap(
        (node) => {
          const style = getComputedStyle(node),
            rect = node.getBoundingClientRect();
          if (
            node.matches("time") &&
            (style.whiteSpace !== "nowrap" ||
              /\b(?:am|pm)\b/i.test(node.textContent ?? ""))
          )
            return ["date wrapped or used am/pm"];
          if (node.matches("button") && rect.height < 44)
            return ["control below 44px"];
          return [];
        },
      ),
    );
    expect(problems).toEqual([]);
    const mark = panel.getByRole("menuitem", {
      name: lang === "en" ? "Mark all as read" : "همه را خوانده‌شده علامت بزن",
      exact: true,
    });
    if (await mark.isEnabled()) {
      await mark.click();
      await expect(mark).toBeDisabled();
    }
    await expect(header).toBeVisible();
    const triggerAfter = (await trigger.boundingBox())!;
    expect(Math.abs(triggerAfter.y - triggerBefore!.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(triggerAfter.x - triggerBefore!.x)).toBeLessThanOrEqual(2);
    await page.keyboard.press("Escape");
    await trigger.click();
    await expect(
      panel.locator(".personal-notifications-scroll"),
    ).toHaveJSProperty("scrollTop", 0);
    await page.keyboard.press("Escape");
  }
});
