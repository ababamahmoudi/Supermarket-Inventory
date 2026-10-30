import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { assertDashboardOperationalAndShiftTiles } from "./dashboard-kpi-evidence";
import { expect, test } from "@playwright/test";
import { chooseOption, setBranch, signIn, visitPage } from "./helpers";

test("Warehouse is a configured location and retains its type through a Supervisor Settings edit", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  const location = page
    .locator(".topbar")
    .getByLabel("Location", { exact: true });
  await location.click();
  await expect(page.getByRole("option")).toHaveText([
    "North York",
    "Richmond Hill",
    "Newmarket",
    "Warehouse",
    "All locations",
  ]);
  await page.getByRole("option", { name: "Warehouse", exact: true }).click();
  await expect(location).toHaveText("Warehouse");
  await visitPage(page, "Settings");
  await page
    .getByRole("navigation", { name: "Settings groups" })
    .getByRole("button", { name: "Branches", exact: true })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("rowheader", {
      name: /^Warehouse(?: (?:Show|Hide) details)?$/,
    }),
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
  const saved = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) =>
      JSON.parse(JSON.stringify(canonicalState)!).config.branches.find(
        (branch: { code: string }) => branch.code === "W1",
      ),
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
  await page.getByRole("button", { name: "Add location", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add location",
    exact: true,
  });
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
    page.locator(".topbar").getByLabel("Location", { exact: true }),
  ).toHaveText("East Warehouse");
  await signIn(page, "Cashier");
  const cashierLocation = page
    .locator(".topbar")
    .getByRole("combobox", { name: "Location", exact: true });
  // The registered North York computer selects an allowed default. This person
  // has two assigned stores, so the picker must retain both without warehouses.
  await expect(cashierLocation).toHaveText("North York");
  await cashierLocation.click();
  await expect(page.getByRole("option")).toHaveText([
    "North York",
    "Richmond Hill",
    "All my locations",
  ]);
  for (const forbiddenLocation of ["Warehouse", "East Warehouse"])
    await expect(
      page.getByRole("option", { name: forbiddenLocation, exact: true }),
    ).toHaveCount(0);
  await page
    .getByRole("option", { name: "Richmond Hill", exact: true })
    .click();
  await expect(cashierLocation).toHaveText("Richmond Hill");
  await chooseOption(
    page,
    cashierLocation,
    "all_my_locations",
    "All my locations",
  );
  await expect(cashierLocation).toHaveText("All my locations");
  await chooseOption(page, cashierLocation, "location:Branch 1", "North York");
  await expect(cashierLocation).toHaveText("North York");
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
  // An explicit current-week posted receipt keeps this behavior meaningful on Mondays.
  const receiptFixture = await runCanonicalBusinessFixture(
    page,
    (saved) => {
      if (!saved.invoices)
        throw new Error("The receipt fixture requires invoices.");
      const receipt = saved.invoices.find(
        (invoice: { company_id: string; status: string; branch: string }) =>
          invoice.company_id === saved.config.company.seed_key &&
          invoice.status === "posted" &&
          invoice.branch === "Branch 1",
      );
      if (!receipt)
        throw new Error("The seed must retain a posted North York receipt");
      receipt.received_at = new Date().toISOString();
      return { id: receipt.id, number: receipt.supplier_invoice_number };
    },
    undefined,
  );
  await page.reload();
  expect(receiptFixture.id).toBeTruthy();
  const beforeReads = await readCanonicalBusinessEvidence(page);
  const weekly = page.locator(".dashboard-this-week");
  await expect(
    weekly.getByRole("heading", { name: "This week", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("More operations", { exact: true })).toHaveCount(
    0,
  );
  const received = weekly.locator(".dashboard-week-stat").filter({
    has: page.getByRole("link", { name: "Received", exact: true }),
  });
  const deliveryCount = received.locator(":scope > strong");
  await expect(
    received.getByText("Deliveries received", { exact: true }),
  ).toBeVisible();
  await expect(deliveryCount).toHaveText(/^[1-9]\d*$/);
  const northYorkCount = await deliveryCount.textContent();
  await expect(
    page.getByRole("heading", { name: "Low stock", exact: true }),
  ).toHaveCount(0);
  await assertDashboardOperationalAndShiftTiles(page);
  await setBranch(page, "Warehouse");
  await expect(deliveryCount).toHaveText("0");
  // D7 replaces the old arrival preview with this real scoped destination.
  await received.getByRole("link", { name: "Received", exact: true }).click();
  await expect(page).toHaveURL((url) => url.hash === "#received");
  await page.getByRole("button", { name: "Date range", exact: true }).click();
  const dateRange = page.getByRole("dialog", {
    name: "Date range",
    exact: true,
  });
  await dateRange
    .getByRole("button", { name: "This week", exact: true })
    .click();
  await expect(dateRange).toBeHidden();
  await expect(
    page.getByText("No deliveries match these filters.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".received-table")).toHaveCount(0);
  await setBranch(page, "North York");
  // The phone's compact receipt row omits the invoice column; search by the
  // genuine retained reference and verify its exact source-invoice link.
  await page
    .getByRole("textbox", { name: "Search Received", exact: true })
    .fill(receiptFixture.number);
  const sourceHref = `#invoices?id=${encodeURIComponent(receiptFixture.id)}&line=`;
  const receiptRows = page.locator(
    `.received-table tbody tr[data-row-href^="${sourceHref}"]`,
  );
  await expect(receiptRows.first()).toBeVisible();
  expect(await receiptRows.count()).toBeGreaterThan(0);
  const sourceLink = receiptRows
    .first()
    .locator(`a[href^="${sourceHref}"]`)
    .filter({ visible: true })
    .first();
  if (!(await sourceLink.isVisible()))
    await receiptRows.first().locator(".table-details-toggle").click();
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute(
    "href",
    (await receiptRows.first().getAttribute("data-row-href"))!,
  );
  await page.goto("/#dashboard");
  await expect(deliveryCount).toHaveText(northYorkCount!);
  const afterReads = await readCanonicalBusinessEvidence(page);
  expect(afterReads.invoices).toEqual(beforeReads.invoices);
  expect(afterReads.invoice).toEqual(beforeReads.invoice);
  expect(afterReads.stock_movements).toEqual(beforeReads.stock_movements);
  expect(afterReads.ledger).toEqual(beforeReads.ledger);
  expect(afterReads.products).toEqual(beforeReads.products);
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
