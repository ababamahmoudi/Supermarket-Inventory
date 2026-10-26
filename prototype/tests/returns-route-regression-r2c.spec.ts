import { expect, test } from "@playwright/test";
import { chooseOption, signIn } from "./helpers";
import { readCanonicalBusinessEvidence } from "./business-evidence";

test("a supplier-filtered Returns route stays rendered and accepts subsequent filter changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page, "Supervisor");
  const before = await readCanonicalBusinessEvidence(page);
  await page.goto("/#returns?supplier=Fresh%20Valley%20Foods&tab=open");
  await expect(
    page.getByRole("heading", { name: "Returns", level: 1, exact: true }),
  ).toBeVisible();
  const supplier = page.getByRole("combobox", {
    name: "Supplier",
    exact: true,
  });
  await expect(supplier).toHaveText("Fresh Valley Foods");
  await chooseOption(page, supplier, "all", "All suppliers");
  await expect(supplier).toHaveText("All suppliers");
  const search = page.getByRole("textbox", {
    name: "Search returns",
    exact: true,
  });
  await search.fill("fictional route filter");
  await expect(search).toHaveValue("fictional route filter");
  await expect(
    page.getByText("No returns match these filters.", { exact: true }),
  ).toBeVisible();
  const after = await readCanonicalBusinessEvidence(page);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.invoice).toEqual(before.invoice);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.returns).toEqual(before.returns);
  expect(after.approvals).toEqual(before.approvals);
  expect(errors).toEqual([]);
});
