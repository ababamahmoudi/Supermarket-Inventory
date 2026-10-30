import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { authenticatedProviderFixture } from "../authority-provider-test-fixture";
import { DemoProvider, initialState } from "../store";
import i18n from "../i18n";
import { Dashboard } from "./Dashboard";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
it("labels a USD invoice in a CAD company without relabelling or converting its total", async () => {
  const state = initialState();
  const original = state.invoices!.find(
    (invoice) => invoice.status === "posted",
  )!;
  const usd = {
    ...structuredClone(original),
    id: "r2c-currency-usd",
    supplier_invoice_number: "CURRENCY-USD-01",
    import_currency: "USD",
    final_total: "123.45",
    posted_at: new Date().toISOString(),
  };
  const cad = {
    ...structuredClone(original),
    id: "r2c-currency-cad",
    supplier_invoice_number: "CURRENCY-CAD-01",
    import_currency: "CAD",
    final_total: "67.89",
    posted_at: new Date().toISOString(),
  };
  state.invoices = [usd, cad];
  state.invoice.status = "empty";
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "all_locations" } },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Dashboard />
    </DemoProvider>,
  );
  const reference = await screen.findByRole(
    "link",
    { name: "Invoice CURRENCY-USD-01" },
    { timeout: 10000 },
  );
  expect(reference).toHaveAttribute("title", "CURRENCY-USD-01");
  const usdRow = within(reference.closest("tr")!);
  expect(usdRow.getByText("$123.45", { exact: true })).toBeVisible();
  expect(usdRow.getByText("USD", { exact: true })).toBeVisible();
  const cadRow = within(
    screen
      .getByRole("link", { name: "Invoice CURRENCY-CAD-01" })
      .closest("tr")!,
  );
  expect(cadRow.getByText("$67.89", { exact: true })).toBeVisible();
  expect(cadRow.queryByText("USD", { exact: true })).not.toBeInTheDocument();
  expect(cadRow.queryByText("CAD", { exact: true })).not.toBeInTheDocument();
});
