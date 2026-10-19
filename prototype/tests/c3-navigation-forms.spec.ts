import { readCanonicalBusinessEvidence } from "./business-evidence";
import { expect, test } from "@playwright/test";
import { chooseOption, signIn } from "./helpers";

test("company and supplier validation clears only when its related field changes", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#settings?group=company");
  const name = page.getByLabel("Name (English)", { exact: true });
  await name.fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Currency", { exact: true }).fill("USD");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await name.fill("Demo market");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await page.goto("/#suppliers");
  await page.getByRole("button", { name: "Add supplier", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add supplier",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  const supplierName = dialog.getByLabel("Supplier name", { exact: true });
  await expect(supplierName).toHaveAttribute("aria-invalid", "true");
  await dialog.getByLabel("Phone (optional)", { exact: true }).fill("555-0100");
  await expect(supplierName).toHaveAttribute("aria-invalid", "true");
  await supplierName.fill("Fictional supplier validation");
  await expect(supplierName).toHaveAttribute("aria-invalid", "false");
  const email = dialog.getByLabel("Email (optional)", { exact: true });
  await email.fill("invalid");
  await dialog
    .getByRole("button", { name: "Add supplier", exact: true })
    .click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await supplierName.fill("Fictional supplier validation edited");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await email.fill("demo@example.invalid");
  await expect(email).toHaveAttribute("aria-invalid", "false");
});

test("Warehouse selling opt-in persists and is reversible without changing receiving evidence", async ({
  page,
}) => {
  await signIn(page, "Supervisor");
  await page.goto("/#settings?group=branches");
  const row = page.getByRole("row").filter({ hasText: "Warehouse" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit branch", exact: true });
  const selling = dialog.getByRole("switch", {
    name: "Sells to customers",
    exact: true,
  });
  await expect(selling).toHaveAttribute("aria-checked", "false");
  const evidence = await readCanonicalBusinessEvidence(page).then(
    (canonicalState) => {
      const state = JSON.parse(JSON.stringify(canonicalState)!);
      return {
        ledger: state.ledger,
        invoices: state.invoices,
        movements: state.stock_movements,
      };
    },
  );
  await selling.click();
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect
    .poll(() =>
      readCanonicalBusinessEvidence(page).then(
        (canonicalState) =>
          JSON.parse(JSON.stringify(canonicalState)!).config.branches.find(
            (entry: { type: string }) => entry.type === "warehouse",
          ).sells_to_customers,
      ),
    )
    .toBe(true);
  await expect(page.getByTestId("undo-toast")).toHaveCount(0);
  await page.goto("/#history");
  await page
    .getByLabel("Search History", { exact: true })
    .fill("Branches changed");
  await expect(
    page.locator(".history-table tbody > tr:not(.table-expanded-row)"),
  ).toHaveCount(1);
  await page
    .locator(".history-table tbody > tr:not(.table-expanded-row)")
    .first()
    .getByRole("button", { name: "Revert", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Revert change", exact: true })
    .getByRole("button", { name: "Revert change", exact: true })
    .click();
  await expect
    .poll(() =>
      readCanonicalBusinessEvidence(page).then(
        (canonicalState) =>
          JSON.parse(JSON.stringify(canonicalState)!).config.branches.find(
            (entry: { type: string }) => entry.type === "warehouse",
          ).sells_to_customers ?? false,
      ),
    )
    .toBe(false);
  expect(
    await readCanonicalBusinessEvidence(page).then((canonicalState) => {
      const state = JSON.parse(JSON.stringify(canonicalState)!);
      return {
        ledger: state.ledger,
        invoices: state.invoices,
        movements: state.stock_movements,
      };
    }),
  ).toEqual(evidence);
});

test("request detail Back and browser Back retain tab and search, with actionable breadcrumbs", async ({
  page,
  isMobile,
}) => {
  await signIn(page, "Floor Worker");
  await page.goto("/#requests");
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await page
    .getByLabel("Free-text item", { exact: true })
    .fill("Fictional paper bags");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  await expect(
    page.getByLabel("Sending location", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await chooseOption(
    page,
    page.getByLabel("Sending location", { exact: true }),
    "Warehouse",
  );
  await expect(
    page.getByLabel("Sending location", { exact: true }),
  ).toHaveAttribute("aria-invalid", "false");
  await page
    .getByRole("button", { name: "Save as draft", exact: true })
    .click();
  const reference = await page.locator(".request-detail h2").innerText();
  await expect(page).toHaveURL(/#requests\?id=/);
  await page
    .getByRole("button", { name: "Back to requests", exact: true })
    .click();
  await page.getByLabel("Search requests", { exact: true }).fill(reference);
  await page
    .getByRole("row")
    .filter({ hasText: reference })
    .getByRole("button", { name: reference, exact: true })
    .click();
  const crumbs = page.getByRole("navigation", {
    name: "Breadcrumbs",
    exact: true,
    includeHidden: true,
  });
  await expect(crumbs.getByRole("link", { includeHidden: true })).toHaveCount(
    3,
  );
  if (isMobile) await expect(crumbs).not.toBeVisible();
  else await expect(crumbs).toBeVisible();
  await expect(
    crumbs.getByRole("link", {
      name: "Branch requests",
      exact: true,
      includeHidden: true,
    }),
  ).toHaveAttribute("href", "#requests");
  await page.goBack();
  await expect(page.getByLabel("Search requests", { exact: true })).toHaveValue(
    reference,
  );
  await expect(
    page.getByRole("tab", { name: "Outgoing", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".request-detail")).toHaveCount(0);
});
