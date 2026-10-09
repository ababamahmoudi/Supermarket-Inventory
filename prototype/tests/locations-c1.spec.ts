import { expect, test } from "@playwright/test";
import { chooseOption, setBranch, signIn, visitPage } from "./helpers";

test("Warehouse is a configured location and retains its type through a Supervisor Settings edit", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  const location = page
    .locator(".topbar")
    .getByLabel("Branch", { exact: true });
  await location.click();
  await expect(page.getByRole("option")).toHaveText([
    "North York",
    "Richmond Hill",
    "Newmarket",
    "Warehouse",
    "All branches",
  ]);
  await page.getByRole("option", { name: "Warehouse", exact: true }).click();
  await expect(location).toHaveText("Warehouse");
  await visitPage(page, "Settings");
  await page
    .getByRole("navigation", { name: "Settings groups" })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: "Warehouse", exact: true }),
  });
  await expect(row).toContainText("Warehouse");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Location type", { exact: true })).toHaveText(
    "Warehouse",
  );
  await dialog
    .getByLabel("Name (English)", { exact: true })
    .fill("Receiving Warehouse");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(location).toHaveText("Receiving Warehouse");
  await page.reload();
  await expect(location).toHaveText("Receiving Warehouse");
  const saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("supermarket-prototype-v1")!,
    ).config.branches.find((branch: { code: string }) => branch.code === "W1"),
  );
  expect(saved).toMatchObject({
    id: "Warehouse",
    type: "warehouse",
    name_en: "Receiving Warehouse",
  });
});

test("location type can be chosen when adding a location and Cashiers cannot access Received", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await visitPage(page, "Settings");
  await page
    .getByRole("navigation", { name: "Settings groups" })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  await page.getByRole("button", { name: "Add branch", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add branch", exact: true });
  await dialog
    .getByLabel("Name (English)", { exact: true })
    .fill("East Warehouse");
  await dialog.getByLabel("Name (Persian)", { exact: true }).fill("انبار شرق");
  await chooseOption(
    page,
    dialog.getByLabel("Location type", { exact: true }),
    "warehouse",
    "Warehouse",
  );
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await setBranch(page, "East Warehouse");
  await expect(
    page.locator(".topbar").getByLabel("Branch", { exact: true }),
  ).toHaveText("East Warehouse");
  await signIn(page, "Cashier");
  await expect(page.locator(".topbar .branch-pill.static")).toHaveText(
    "North York",
  );
  await expect(
    page.getByRole("link", { name: "Received", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#received");
  await expect(
    page.getByRole("heading", { name: "Received", exact: true, level: 1 }),
  ).toHaveCount(0);
  await expect(page.locator(".received-table")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Cashier lookup", exact: true }),
  ).toBeVisible();
});

test("the dashboard replaces stock projections with actual arrivals for the selected location", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await expect(
    page.getByRole("heading", { name: "Arrived this week", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Low stock", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".dashboard-kpis > .kpi-card")).toHaveCount(4);
  await setBranch(page, "Warehouse");
  await expect(
    page.getByText("No deliveries this week.", { exact: true }),
  ).toBeVisible();
  await setBranch(page, "North York");
  await expect(
    page.getByText("No deliveries this week.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("select, input[type=number], input[type=date]"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("short desktop keeps all four groups, Settings, History and the user menu accessible without sidebar scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page, "Supervisor");
  for (const label of [
    "Settings",
    "History",
    "Products",
    "Received",
    "Dashboard",
  ]) {
    await visitPage(page, label);
    await expect(
      page
        .getByRole("navigation", { name: "Pages", exact: true })
        .getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("button", { name: "User menu", exact: true }),
    ).toBeInViewport();
    const geometry = await page.locator(".sidebar").evaluate((sidebar) => ({
      height: sidebar.clientHeight,
      scrollHeight: sidebar.scrollHeight,
      navHeight: sidebar.querySelector("nav")!.clientHeight,
      navScrollHeight: sidebar.querySelector("nav")!.scrollHeight,
      groupCount: sidebar.querySelectorAll(".nav-section").length,
    }));
    expect(geometry.scrollHeight).toBe(geometry.height);
    expect(geometry.navScrollHeight).toBe(geometry.navHeight);
    expect(geometry.groupCount).toBe(4);
  }
});
