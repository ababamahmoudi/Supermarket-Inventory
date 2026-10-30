import { runCanonicalBusinessFixture } from "./business-fixture";
import { readCanonicalBusinessEvidence } from "./business-evidence";
import { assertDashboardOperationalAndShiftTiles } from "./dashboard-kpi-evidence";
import { expect, test, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import configuration from "../../seed/arzon-config.json" with { type: "json" };
import {
  configuredRoleLabel,
  readConfiguredRoleDefinitions,
} from "../src/role-config";
import { chooseOption, signIn, visitPage, setLanguage } from "./helpers";

test.setTimeout(60000);

async function visit(page: Page, label: string) {
  await visitPage(page, label);
}
async function stored(page: Page) {
  return readCanonicalBusinessEvidence(page).then((canonicalState) =>
    JSON.parse(JSON.stringify(canonicalState)!),
  );
}
async function openReturn(page: Page, number: number) {
  await visit(page, "Returns");
  await page.getByRole("link", { name: `#${number}`, exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`#return\\?id=demo-return-${number}$`),
  );
}

test("supplier pickup and partial substitute receipt preserve Payables; settled cancellation restores zero supplier-held originals", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Floor Worker");
  await openReturn(page, 1);
  await expect(
    page.getByText("Sour Cherry Juice 1 L", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await page.getByLabel("Actual pickup quantity", { exact: true }).fill("3");
  await page
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Fictional Representative");
  await page
    .getByLabel("Reference (optional)", { exact: true })
    .fill("DEMO-SIGNED-001");
  await page
    .getByRole("button", { name: "Record pickup", exact: true })
    .last()
    .click();
  await expect(page.getByRole("status")).toContainText("Recorded pickup");
  const before = await stored(page);
  await page
    .getByRole("button", { name: "Record resolution", exact: true })
    .click();
  await chooseOption(
    page,
    page.getByRole("combobox", { name: "Outcome", exact: true }),
    "replaced",
    "Replaced",
  );
  await page.getByLabel("Original quantity covered", { exact: true }).fill("1");
  await page.getByLabel("Remaining expected date", { exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page
    .getByLabel("Actual replacement quantity", { exact: true })
    .fill("2");
  await chooseOption(
    page,
    page.getByLabel("Replacement product actually received", { exact: true }),
    "0002",
    demoSeed.products.find((product) => product.code === "0002")!.name_en,
  );
  await page
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Fictional Representative");
  await page
    .getByLabel("Replacement receipt reference", { exact: true })
    .fill("DEMO-REPLACE-001");
  await page
    .locator(".return-action-card")
    .getByRole("button", { name: "Record resolution", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Recorded item resolutions",
  );
  const after = await stored(page);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock["Branch 1:0002"]).toBe(before.stock["Branch 1:0002"] + 2);
  await openReturn(page, 2);
  await expect(
    page.getByRole("table").getByText("Basmati Rice 4.5 kg", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request cancellation", exact: true })
    .click();
  await chooseOption(
    page,
    page.getByLabel("Actual disposition", { exact: true }),
    "supplier_held",
    "Supplier still holds originals — restore zero",
  );
  await page
    .getByLabel("Cancellation reason (required)", { exact: true })
    .fill("Fictional supplier retains originals; keep received replacement");
  await page
    .getByRole("button", {
      name: "Record cancellation disposition",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/Owner \/ Manager review required/),
  ).toBeVisible();
  const cancelled = await stored(page);
  expect(cancelled.stock["Branch 1:0001"]).toBe(before.stock["Branch 1:0001"]);
  expect(cancelled.returns[1].status).toBe("cancellation_review");
  await signIn(page, "Supervisor");
  await openReturn(page, 2);
  await page
    .getByLabel("Settlement review and reason", { exact: true })
    .fill(
      "Checked fictional receipt; original goods remain supplier-held and replacement is retained",
    );
  await page.getByRole("checkbox", { name: /I reviewed the history/ }).check();
  await page
    .getByRole("button", { name: "Approve cancellation", exact: true })
    .click();
  await expect(
    page.locator(".return-header-card").getByText("Cancelled", { exact: true }),
  ).toBeVisible();
  expect((await stored(page)).stock["Branch 1:0001"]).toBe(
    before.stock["Branch 1:0001"],
  );
  expect(errors).toEqual([]);
});

test("date removal, notes store-use, and unread Supervisor actions survive refresh", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await visit(page, "Date tracking");
  const beforeDateRemoval = await stored(page);
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .first()
    .click();
  const removal = page.getByRole("dialog", {
    name: "Remove date",
    exact: true,
  });
  await chooseOption(
    page,
    removal.getByLabel("Reason", { exact: true }),
    "sold_out",
    "Sold out",
  );
  await removal.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(1);
  const removed = await stored(page);
  expect(removed.expiry).toHaveLength(beforeDateRemoval.expiry.length);
  expect(
    removed.expiry.find(
      (entry: { branch: string; product_code: string }) =>
        entry.branch === "Branch 1" && entry.product_code === "0006",
    ),
  ).toMatchObject({ status: "removed", removed_reason: "sold_out" });
  expect(removed.stock).toEqual(beforeDateRemoval.stock);
  expect(removed.ledger).toEqual(beforeDateRemoval.ledger);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(1);
  await visit(page, "Notes");
  await page.getByRole("tab", { name: "Store use", exact: true }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  const beforeStoreUse = await stored(page);
  await page.getByLabel("Note", { exact: true }).fill("Demo staff lunch");
  await chooseOption(
    page,
    page.getByLabel("Product (required)", { exact: true }),
    "0006",
    "Lavash Bread 500 g",
  );
  await page
    .getByLabel("Actual quantity used (required)", { exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  expect((await stored(page)).stock["Branch 1:0006"]).toBe(
    beforeStoreUse.stock["Branch 1:0006"] - 2,
  );
  await page.getByRole("tab", { name: "For managers", exact: true }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page
    .getByLabel("Note", { exact: true })
    .fill("Fictional supervisor check requested");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "More actions", exact: true }),
  ).toHaveCount(0);
  await signIn(page, "Supervisor");
  await visit(page, "Notes");
  await page.getByRole("tab", { name: /For managers/ }).click();
  await expect(
    page.getByRole("button", { name: "Mark as seen", exact: true }),
  ).toHaveCount(2);
  const managerNote = page
    .locator("[data-note]")
    .filter({ hasText: "Fictional supervisor check requested" });
  await managerNote
    .getByRole("button", { name: "Mark as seen", exact: true })
    .click();
  await expect(
    managerNote.getByRole("button", { name: "Seen by you", exact: true }),
  ).toBeDisabled();
  await expect(managerNote.locator(".badge")).toHaveText("Seen");
  await expect(
    page.getByRole("button", { name: "Mark as seen", exact: true }),
  ).toHaveCount(1);
  await managerNote
    .getByRole("button", { name: "Mark done", exact: true })
    .click();
  await expect(
    page.getByText("Fictional supervisor check requested", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("group", { name: "Note status", exact: true })
    .getByRole("button", { name: "All", exact: true })
    .click();
  await expect(managerNote.locator(".badge")).toHaveText("Done");
  await page.reload();
  await page.getByRole("tab", { name: /For managers/ }).click();
  await page
    .getByRole("group", { name: "Note status", exact: true })
    .getByRole("button", { name: "All", exact: true })
    .click();
  await expect(managerNote.locator(".badge")).toHaveText("Done");
  await expect(
    managerNote.getByRole("button", { name: "Seen by you", exact: true }),
  ).toBeDisabled();
});

test("Supervisor ledger records a partial cheque, preserves outstanding and exports month-end; workers have no Payables", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await visit(page, "Payables");
  await page
    .getByRole("row")
    .filter({ hasText: "Fresh Valley Foods" })
    .getByRole("link", { name: "Fresh Valley Foods", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fresh Valley Foods", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText("$169.79", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record external payment", exact: true })
    .click();
  await page
    .getByLabel("Payment receipt reference", { exact: true })
    .fill("DEMO-PAY-001");
  await page
    .getByRole("button", {
      name: "Preview oldest-due allocations",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Record external payment", exact: true })
    .getByRole("button", { name: "Confirm and record payment", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Recorded external payment",
  );
  await expect(
    page.getByText("$119.79", { exact: true }).first(),
  ).toBeVisible();
  while (
    await page
      .locator(".payables-ledger-table")
      .getByRole("button", { name: "Show details", exact: true })
      .count()
  )
    await page
      .locator(".payables-ledger-table")
      .getByRole("button", { name: "Show details", exact: true })
      .first()
      .click();
  await expect(
    page
      .locator(".payables-ledger-table")
      .getByText("DEMO-1001", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Month-end summary", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Month-end ledger summary",
      exact: true,
    }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("payables-");
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  await page
    .getByRole("button", { name: "Print summary", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".payables-report")).toBeVisible();
  await expect(page.locator(".payables-report-heading")).toContainText(
    "Fresh Valley Foods",
  );
  await expect(page.locator(".payables-print-supplier")).toBeVisible();
  await expect(
    page
      .locator(".payables-report")
      .getByText("DEMO-1001", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Month-end ledger summary",
      exact: true,
    }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await signIn(page, "Floor Worker");
  await expect(
    page.getByRole("link", { name: "Payables", exact: true }),
  ).toHaveCount(0);
});

test("dashboard shows five operational KPIs and authorized on-shift staff, and operations render in Persian without page overflow", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  const fixture = await runCanonicalBusinessFixture(
    page,
    (state) => {
      const common = { at: new Date().toISOString(), by: "Demo Supervisor" };
      state.activity = [
        {
          ...common,
          id: "company-wide-price",
          company_id: state.config.company.seed_key,
          branch: "all",
          action: "Approve price",
        },
        {
          ...common,
          id: "other-company-offer",
          company_id: "another-company",
          branch: "all",
          action: "Create offer",
        },
        {
          ...common,
          id: "other-branch-offer",
          company_id: state.config.company.seed_key,
          branch: "Branch 2",
          action: "Stop offer",
        },
      ];
      return { at: common.at };
    },
    undefined,
  );
  await page.reload();
  await visit(page, "Dashboard");
  await expect(page.getByText("Approve price", { exact: true })).toBeVisible();
  await expect(page.getByText("Create offer", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Stop offer", { exact: true })).toHaveCount(0);
  await assertDashboardOperationalAndShiftTiles(page);
  const beforeReads = await readCanonicalBusinessEvidence(page);
  await expect(page.getByText("More operations", { exact: true })).toHaveCount(
    0,
  );
  for (const heading of [
    "Approvals waiting",
    "Alerts",
    "Recent invoices",
    "This week",
    "Supplier balances",
    `Notes for ${configuredRoleLabel(readConfiguredRoleDefinitions(configuration.roles), "manager", "en")}`,
    "Activity",
  ])
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  const activity = page.locator(".dashboard-activity");
  await expect(activity.locator(".dashboard-activity-list")).toHaveCount(1);
  await expect(activity.getByRole("listitem")).toHaveCount(1);
  await expect(activity.locator("time")).toHaveAttribute(
    "datetime",
    fixture.at,
  );
  await expect(activity.locator("time")).toHaveText(/^\d{2}:\d{2}$/);
  const weekly = page.locator(".dashboard-this-week");
  await expect(weekly.locator(".dashboard-week-stat")).toHaveCount(3);
  await expect(weekly.getByRole("link")).toHaveText([
    "Returns",
    "Received",
    "Price updates",
  ]);
  for (const value of await weekly
    .locator(".dashboard-week-stat > strong")
    .allTextContents())
    expect(value.trim()).toMatch(/^\d+$/);
  for (const href of ["#returns", "#received", "#price-updates"]) {
    await weekly.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL((url) => url.hash === href);
    await page.goto("/#dashboard");
    await expect(weekly).toBeVisible();
    await expect(
      activity.getByText("Approve price", { exact: true }),
    ).toBeVisible();
    await expect(
      activity.getByText("Create offer", { exact: true }),
    ).toHaveCount(0);
    await expect(activity.getByText("Stop offer", { exact: true })).toHaveCount(
      0,
    );
  }
  await page
    .getByRole("button", { name: "Expiring soon: 2", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Date tracking", exact: true, level: 1 }),
  ).toBeVisible();
  await setLanguage(page, "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "پیگیری تاریخ", exact: true, level: 1 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const afterReads = await readCanonicalBusinessEvidence(page);
  expect(afterReads.activity).toEqual(beforeReads.activity);
  expect(afterReads.invoices).toEqual(beforeReads.invoices);
  expect(afterReads.stock_movements).toEqual(beforeReads.stock_movements);
  expect(afterReads.ledger).toEqual(beforeReads.ledger);
  expect(afterReads.products).toEqual(beforeReads.products);
});

test("invalid pickup evidence, invalid store-use quantities, and invalid financial amounts show errors without changing records or crashing the app", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Floor Worker");
  await openReturn(page, 1);
  await page
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await page.getByLabel("Actual pickup quantity", { exact: true }).fill("1");
  const beforePickup = await stored(page);
  await page
    .getByRole("button", { name: "Record pickup", exact: true })
    .last()
    .click();
  await expect(
    page
      .locator(".field")
      .filter({
        has: page.getByLabel("Supplier representative name", { exact: true }),
      })
      .getByRole("alert"),
  ).toHaveText("Enter the supplier representative name.");
  const optionalReference = page.getByLabel("Reference (optional)", {
    exact: true,
  });
  await expect(optionalReference).toHaveValue("");
  await expect(optionalReference).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    page
      .locator(".field")
      .filter({ has: optionalReference })
      .getByRole("alert"),
  ).toHaveCount(0);
  expect(await stored(page)).toEqual(beforePickup);
  await expect(
    page.getByRole("heading", { name: /^Return #1$/, level: 1 }),
  ).toBeVisible();

  await visit(page, "Notes");
  await page.getByRole("tab", { name: "Store use", exact: true }).click();
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page
    .getByLabel("Note", { exact: true })
    .fill("Fictional actual quantity validation");
  await chooseOption(
    page,
    page.getByLabel("Product (required)", { exact: true }),
    "0006",
    "Lavash Bread 500 g",
  );
  const beforeStoreUse = await stored(page);
  await page
    .getByLabel("Actual quantity used (required)", { exact: true })
    .fill("0");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page
      .locator(".notebook-entry-dialog .field")
      .filter({
        has: page.getByLabel("Actual quantity used (required)", {
          exact: true,
        }),
      })
      .getByRole("alert"),
  ).toContainText("Enter a positive whole quantity");
  expect(await stored(page)).toEqual(beforeStoreUse);
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue(
    "Fictional actual quantity validation",
  );

  const actualQty = (beforeStoreUse.stock["Branch 1:0006"] ?? 0) + 120;
  await page
    .getByLabel("Actual quantity used (required)", { exact: true })
    .fill(String(actualQty));
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const recordedUse = await stored(page);
  expect(recordedUse.notes[0]).toMatchObject({
    type: "store_use",
    product_code: "0006",
    qty: actualQty,
    text: "Fictional actual quantity validation",
    branch: "Branch 1",
    company_id: "super-arzon",
  });
  expect(recordedUse.stock_movements).toHaveLength(
    beforeStoreUse.stock_movements.length + 1,
  );
  expect(recordedUse.stock_movements.at(-1)).toMatchObject({
    type: "store_use",
    product_code: "0006",
    qty: -actualQty,
    branch: "Branch 1",
    company_id: "super-arzon",
  });
  expect(recordedUse.ledger).toEqual(beforeStoreUse.ledger);

  await signIn(page, "Supervisor");
  await visit(page, "Payables");
  await page
    .getByRole("row")
    .filter({ hasText: "Fresh Valley Foods" })
    .getByRole("link", { name: "Fresh Valley Foods", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Record opening balance, credit, or adjustment",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Signed amount (credits are negative)", { exact: true })
    .fill("not-an-amount");
  await page
    .getByLabel("Evidence reference", { exact: true })
    .fill("DEMO-INVALID-AMOUNT");
  await page
    .getByLabel("Reason / dispute note (required)", { exact: true })
    .fill("Fictional validation check");
  const beforeAmount = await stored(page);
  await page
    .getByRole("button", { name: "Record ledger entry", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Record ledger entry", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("alert", { name: "What's missing", exact: true }),
  ).toContainText("Enter a valid amount");
  await expect(
    page
      .locator(".field")
      .filter({
        has: page.getByLabel("Signed amount (credits are negative)", {
          exact: true,
        }),
      })
      .getByRole("alert"),
  ).toContainText("Enter a valid amount with no more than two decimal places");
  expect(await stored(page)).toEqual(beforeAmount);
  await expect(
    page.getByRole("heading", {
      name: "Fresh Valley Foods",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Signed amount (credits are negative)", { exact: true }),
  ).toHaveValue("not-an-amount");
  expect(errors).toEqual([]);
});
