import { expect, test, type Page } from "@playwright/test";
import demoSeed from "../../seed/demo-data.json" with { type: "json" };
import { chooseOption, signIn, visitPage } from "./helpers";

test.setTimeout(60000);

async function visit(page: Page, label: string) {
  await visitPage(page, label);
}
async function stored(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
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
  await page
    .getByLabel("Sour Cherry Juice 1 L · Actual pickup units", { exact: true })
    .fill("3");
  await page
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Fictional Representative");
  await page
    .getByLabel("Signed paper pickup slip reference", { exact: true })
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
  await page
    .getByLabel(
      "Sour Cherry Juice 1 L · Original units this settlement covers",
      { exact: true },
    )
    .fill("1");
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
    .getByRole("button", { name: "Receive replacement", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Payables did not change",
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
  await expect(page.getByText(/Supervisor review required/)).toBeVisible();
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

test("expiry clearing, notes store-use, and unread Supervisor actions survive refresh", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await visit(page, "Date tracking");
  await expect(
    page.getByRole("button", { name: "Mark as cleared", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Mark as cleared", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Mark as cleared", exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mark as cleared", exact: true }),
  ).toHaveCount(1);
  await visit(page, "Notes");
  await page.getByRole("tab", { name: "Store use", exact: true }).click();
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
  await page.getByRole("tab", { name: "For Supervisor", exact: true }).click();
  await page
    .getByLabel("Note", { exact: true })
    .fill("Fictional supervisor check requested");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mark seen", exact: true }),
  ).toHaveCount(0);
  await signIn(page, "Supervisor");
  await visit(page, "Notes");
  await page.getByRole("tab", { name: /For Supervisor/ }).click();
  await expect(
    page.getByRole("button", { name: "Mark seen", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Mark seen", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Mark seen", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Mark done", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Fictional supervisor check requested", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "Include done and ordered notes",
      exact: true,
    })
    .check();
  await expect(
    page.getByText("Fictional supervisor check requested", { exact: true }),
  ).toBeVisible();
});

test("Supervisor ledger records a partial cheque, preserves outstanding and exports month-end; workers have no Payables", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await visit(page, "Payables");
  await page
    .getByRole("row")
    .filter({ hasText: "Fresh Valley Foods" })
    .getByRole("button", { name: "View", exact: true })
    .click();
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
  await expect(page.getByRole("status")).toContainText(
    "Recorded external payment",
  );
  await expect(
    page.getByText("$119.79", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /DEMO-1001/ })).toBeVisible();
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
  await expect(page.getByRole("cell", { name: /DEMO-1001/ })).toBeVisible();
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

test("dashboard shows four actionable KPIs and scoped lists, and operations render in Persian without page overflow", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.evaluate(() => {
    const key = "supermarket-prototype-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
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
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await visit(page, "Dashboard");
  await expect(page.getByText("Approve price", { exact: true })).toBeVisible();
  await expect(page.getByText("Create offer", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Stop offer", { exact: true })).toHaveCount(0);
  await expect(page.locator(".dashboard-kpis > .kpi-card")).toHaveCount(4);
  await expect(page.locator(".kpi-label")).toHaveText([
    "Approvals waiting",
    "Open alerts",
    "Open shorts",
    "Expiring soon",
  ]);
  for (const heading of [
    "Approvals queue",
    "Alerts",
    "Recent invoices",
    "Returns",
    "Supplier balances",
    "Notes for Supervisor",
    "Activity",
  ])
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  await page
    .getByRole("button", { name: "Expiring soon: 2", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Date tracking", exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "پیگیری تاریخ", exact: true, level: 1 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
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
  await page
    .getByLabel("Sour Cherry Juice 1 L · Actual pickup units", { exact: true })
    .fill("1");
  const beforePickup = await stored(page);
  await page
    .getByRole("button", { name: "Record pickup", exact: true })
    .last()
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Add the representative name and signed slip reference",
  );
  expect(await stored(page)).toEqual(beforePickup);
  await expect(
    page.getByRole("heading", { name: /^Return #1 · created/, level: 1 }),
  ).toBeVisible();

  await visit(page, "Notes");
  await page.getByRole("tab", { name: "Store use", exact: true }).click();
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
  await expect(page.getByRole("alert")).toContainText(
    "Enter a positive whole quantity",
  );
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
    .getByRole("button", { name: "View", exact: true })
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
  await expect(page.getByRole("alert")).toContainText(
    "Enter a valid amount with no more than two decimal places",
  );
  expect(await stored(page)).toEqual(beforeAmount);
  await expect(
    page.getByRole("heading", { name: "Payables", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Signed amount (credits are negative)", { exact: true }),
  ).toHaveValue("not-an-amount");
  expect(errors).toEqual([]);
});
