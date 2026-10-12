import { expect, test, type Locator, type Page } from "@playwright/test";
import { chooseOption, setLanguage, signIn, visitPage } from "./helpers";

test.setTimeout(60000);

async function snapshot(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!),
  );
}

async function checkAlignment(table: Locator) {
  const columns = await table.evaluate((node) => {
    const headers = [...node.querySelectorAll("thead th")];
    const rows = [...node.querySelectorAll("tbody tr")];
    return headers
      .map((header, index) => {
        const head = header.getBoundingClientRect();
        const style = getComputedStyle(header);
        return rows.map((row) => {
          const cell = row.children[index] as HTMLElement;
          const body = cell.getBoundingClientRect();
          const bodyStyle = getComputedStyle(cell);
          return {
            left: Math.abs(head.left - body.left),
            right: Math.abs(head.right - body.right),
            headerPadding: [style.paddingInlineStart, style.paddingInlineEnd],
            bodyPadding: [
              bodyStyle.paddingInlineStart,
              bodyStyle.paddingInlineEnd,
            ],
            headerAlign: style.textAlign,
            bodyAlign: bodyStyle.textAlign,
          };
        });
      })
      .flat();
  });
  expect(columns.length).toBeGreaterThan(0);
  for (const column of columns) {
    expect(column.left).toBeLessThanOrEqual(2);
    expect(column.right).toBeLessThanOrEqual(2);
    expect(column.headerPadding).toEqual(column.bodyPadding);
    expect(column.headerAlign).toBe(column.bodyAlign);
  }
}

test("Returns starts with all suppliers and Open records, and opens each return as its own page", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await visitPage(page, "Returns");
  await expect(page.getByLabel("Supplier", { exact: true })).toHaveText(
    "All suppliers",
  );
  await expect(page.getByLabel("Status", { exact: true })).toHaveText(
    "All statuses",
  );
  await expect(page.getByLabel("Return branch", { exact: true })).toHaveText(
    "All branches",
  );
  const count = await page.locator(".returns-overview-table tbody tr").count();
  expect(count).toBeGreaterThanOrEqual(2);
  await page.getByLabel("Search returns", { exact: true }).fill("Fresh Valley");
  await expect(page.locator(".returns-overview-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".returns-overview-table tbody")).toContainText(
    "Fresh Valley Foods",
  );
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".returns-overview-table tbody tr")).toHaveCount(
    count,
  );
  await page.getByRole("link", { name: "#1", exact: true }).click();
  await expect(page).toHaveURL(/#return\?id=demo-return-1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Return #1");
  await expect(page.locator(".return-detail-subtitle")).toContainText(
    "created",
  );
  await expect(page.locator(".return-detail-subtitle")).toContainText(
    "Demo Floor Worker",
  );
  await expect(page.locator(".return-detail-subtitle")).not.toContainText("—");
  await expect(
    page
      .locator(".return-header-card")
      .getByRole("button", { name: "Record pickup", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".return-lines-card")).toContainText(
    "Sour Cherry Juice 1 L",
  );
  await expect(
    page
      .locator(".return-evidence-card")
      .getByRole("heading", { name: "Evidence and history", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".returns-overview-table")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Back to Returns", exact: true })
    .click();
  await expect(page.locator(".returns-overview-table tbody tr")).toHaveCount(
    count,
  );
});

test("Return policy dialog centers, closes with Escape and backdrop, and restores trigger focus", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-1");
  const trigger = page.getByRole("button", {
    name: "Return policy",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Return policy",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const centered = await dialog.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      x: Math.abs(box.x + box.width / 2 - innerWidth / 2),
      y: Math.abs(box.y + box.height / 2 - innerHeight / 2),
      focusInside: node.contains(document.activeElement),
    };
  });
  expect(centered.x).toBeLessThanOrEqual(2);
  expect(centered.y).toBeLessThanOrEqual(2);
  expect(centered.focusInside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(2, 2);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("Returns columns align within two pixels in English and Persian on overview and detail", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  for (const lang of ["en", "fa"] as const) {
    await setLanguage(page, lang);
    await page.goto("/#returns");
    await expect(
      page.locator(".returns-overview-table tbody tr").first(),
    ).toBeVisible();
    await checkAlignment(page.locator(".returns-overview-table table"));
    await page.goto("/#return?id=demo-return-1");
    await expect(
      page.locator(".return-lines-table tbody tr").first(),
    ).toBeVisible();
    await checkAlignment(page.locator(".return-lines-table table"));
  }
});

test("Overview and direct return links enforce company and worker branch scope", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.evaluate(() => {
    const key = "supermarket-prototype-v1";
    const state = JSON.parse(localStorage.getItem(key)!);
    const original = state.returns.find(
      (record: { id: string }) => record.id === "demo-return-1",
    );
    state.returns.push({
      ...original,
      id: "scope-other-company",
      company_id: "another-company",
      supplier: "Another Company Private Supplier",
    });
    state.returns.push({
      ...original,
      id: "scope-other-branch",
      branch: "Branch 2",
      supplier: "Branch Two Private Return",
    });
    state.returns.push({
      ...original,
      id: "scope-cancelled",
      status: "cancelled",
      supplier: "Cancelled Return Supplier",
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.goto("/#returns");
  await expect(page.locator(".returns-overview-table")).toContainText(
    "Branch Two Private Return",
  );
  await expect(page.locator(".returns-overview-table")).not.toContainText(
    "Another Company Private Supplier",
  );
  await expect(page.locator(".returns-overview-table")).not.toContainText(
    "Cancelled Return Supplier",
  );
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.locator(".returns-overview-table")).toContainText(
    "Cancelled Return Supplier",
  );
  await signIn(page, "Floor Worker");
  await visitPage(page, "Returns");
  await expect(page.locator(".returns-overview-table")).not.toContainText(
    "Branch Two Private Return",
  );
  await page.goto("/#return?id=scope-other-branch");
  await expect(
    page.getByText("This return is not available in your branch.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".return-detail")).toHaveCount(0);
  await page.goto("/#return?id=scope-other-company");
  await expect(
    page.getByText("This return is not available in your branch.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".return-detail")).toHaveCount(0);
});

test("Return detail pickup does not deduct stock twice and replacement increases actual stock without posting to the supplier ledger", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-1");
  const before = await snapshot(page);
  await page
    .locator(".return-header-card")
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
    .fill("A2-SIGNED-001");
  await page
    .locator(".return-action-card")
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Recorded pickup");
  const pickup = await snapshot(page);
  expect(pickup.stock).toEqual(before.stock);
  expect(pickup.ledger).toEqual(before.ledger);
  await page
    .locator(".return-header-card")
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
  const replacement = pickup.products.find(
    (product: { code: string }) => product.code === "0002",
  );
  await chooseOption(
    page,
    page.getByLabel("Replacement product actually received", { exact: true }),
    "0002",
    replacement.name_en,
  );
  await page
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Fictional Representative");
  await page
    .getByLabel("Replacement receipt reference", { exact: true })
    .fill("A2-REPLACEMENT-001");
  await page
    .getByRole("button", { name: "Receive replacement", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Replacement received. Pending credit was released for the covered quantities.",
  );
  const received = await snapshot(page);
  expect(received.ledger).toEqual(before.ledger);
  expect(received.stock["Branch 1:0002"]).toBe(
    before.stock["Branch 1:0002"] + 2,
  );
  await expect(page.locator(".return-evidence-card")).toContainText(
    "A2-SIGNED-001",
  );
  await expect(page.locator(".return-evidence-card")).toContainText(
    "A2-REPLACEMENT-001",
  );
});

test("Supplier-held cancellation keeps stock and compensation unchanged and requires Supervisor review", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#return?id=demo-return-2");
  const before = await snapshot(page);
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
    .fill("Supplier holds originals; keep the recorded replacement.");
  await page
    .getByRole("button", {
      name: "Record cancellation disposition",
      exact: true,
    })
    .click();
  await expect(page.locator(".return-review-card")).toContainText(
    "Supervisor review required.",
  );
  await expect(
    page.getByRole("button", { name: "Approve cancellation", exact: true }),
  ).toHaveCount(0);
  const waiting = await snapshot(page);
  expect(waiting.stock).toEqual(before.stock);
  expect(waiting.ledger).toEqual(before.ledger);
  expect(
    waiting.returns.find(
      (record: { id: string }) => record.id === "demo-return-2",
    ).status,
  ).toBe("cancellation_review");
  await signIn(page, "Supervisor");
  await page.goto("/#return?id=demo-return-2");
  await page
    .getByLabel("Settlement review and reason", { exact: true })
    .fill(
      "Reviewed the replacement receipt; retain compensation and restore no supplier-held originals.",
    );
  await page
    .getByRole("checkbox", {
      name: "I reviewed the history. Existing replacement or compensation is retained; no reversal is needed.",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Approve cancellation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Approved cancellation");
  const cancelled = await snapshot(page);
  expect(cancelled.stock).toEqual(before.stock);
  expect(cancelled.ledger).toEqual(before.ledger);
  expect(
    cancelled.returns.find(
      (record: { id: string }) => record.id === "demo-return-2",
    ).replacement_received,
  ).toEqual(
    before.returns.find(
      (record: { id: string }) => record.id === "demo-return-2",
    ).replacement_received,
  );
});
