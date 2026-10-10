import { expect, test } from "@playwright/test";
import { chooseOption, signIn, visitPage } from "./helpers";

test("evidenced pickup retains an RM across reload and exposes only a separate Supervisor pending claim", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#return?id=demo-return-1");
  const ledgerBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).ledger,
  );
  await page
    .locator(".return-header-card")
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await page.getByLabel(/Actual pickup units$/).fill("1");
  await page
    .getByLabel("Supplier representative name", { exact: true })
    .fill("Demo Driver C4");
  await page
    .getByLabel("Signed paper pickup slip reference", { exact: true })
    .fill("SIGNED-C4-BROWSER-001");
  await page
    .locator(".return-action-card")
    .getByRole("button", { name: "Record pickup", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("retained Return memo");
  const memo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("supermarket-prototype-v1")!)
      .returns.find((record: { id: string }) => record.id === "demo-return-1")
      .pickup_memos.at(-1),
  );
  expect(memo.reference).toMatch(/^RM-\d{4,}$/);
  expect(memo.signed_evidence_reference).toBe("SIGNED-C4-BROWSER-001");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("supermarket-prototype-v1")!).ledger,
    ),
  ).toEqual(ledgerBefore);
  await page.reload();
  await page
    .locator(".return-memos-card")
    .getByRole("button", { name: memo.reference, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Return memo", exact: true });
  await expect(dialog).toContainText("Demo Driver C4");
  await expect(dialog).toContainText("نام راننده");
  await expect(dialog).toContainText("Signature");
  await expect(dialog).toContainText("امضا");
  await expect
    .poll(() =>
      dialog.locator(".return-memo-preview").evaluate((preview) => {
        const paper = preview.querySelector<HTMLElement>(
          ".operational-print-document",
        )!;
        const bounds = preview.getBoundingClientRect();
        const sheet = paper.getBoundingClientRect();
        return (
          preview.scrollWidth <= preview.clientWidth + 2 &&
          sheet.left >= bounds.left - 2 &&
          sheet.right <= bounds.right + 2
        );
      }),
    )
    .toBe(true);
  expect(
    await dialog
      .locator(".operational-print-document")
      .evaluate((paper) => paper.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(
    Math.max(220, (await page.evaluate(() => window.innerHeight)) * 0.62) + 2,
  );
  await page.keyboard.press("Escape");
  await visitPage(page, "Payables");
  const row = page
    .locator(".payables-overview-table tbody tr")
    .filter({ hasText: "Fresh Valley Foods" });
  await row
    .getByRole("link", { name: "Fresh Valley Foods", exact: true })
    .click();
  await expect(page.locator(".pending-return-credits")).toContainText(
    "Confirmed balance",
  );
  await expect(
    page
      .locator(".pending-return-credits")
      .getByRole("link", { name: memo.reference, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: memo.reference, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Return memo", exact: true }),
  ).toBeVisible();
});

test("return and supplier tabs share Open/History while worker money stays inaccessible", async ({
  page,
}) => {
  await signIn(page, "Floor Worker");
  await visitPage(page, "Returns");
  await expect(
    page.getByRole("tab", { name: "Open", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".returns-overview-table")).toContainText(
    "Waiting for pickup",
  );
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(page.getByLabel("Status", { exact: true })).toContainText(
    "All statuses",
  );
  await chooseOption(
    page,
    page.getByLabel("Status", { exact: true }),
    "cancelled",
    "Cancelled",
  );
  await page.goto("/#suppliers?name=Fresh%20Valley%20Foods");
  await page
    .getByRole("tab", { name: "Returns and credits", exact: true })
    .click();
  await expect(
    page
      .locator(".supplier-returns-panel")
      .getByRole("tab", { name: "Open", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".supplier-returns-panel")
      .getByRole("tab", { name: "History", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Pending credit", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".supplier-returns-panel")
    .getByRole("button", { name: "Columns", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Pending credit", exact: true }),
  ).toHaveCount(0);
});
