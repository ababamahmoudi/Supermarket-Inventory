import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { DemoProvider, initialState } from "./store";
import { Approvals } from "./screens/Approvals";
import i18n from "./i18n";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "./test/rendered-ui-readiness";
const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage("en");
});
afterEach(() => {
  clearRenderedUiReadiness();
  cleanup();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
it("presents first prices, margin warnings and one ordered action row without duplicate product names", async () => {
  const state = initialState();
  state.sale_requests = [];
  state.approvals = state.products.slice(0, 2).map((product, index) => ({
    id: `r2c-row-${index}`,
    company_id: state.config.company.seed_key,
    branch: "Branch 1",
    product_code: product.code,
    status: "pending",
    type: index === 0 ? "new_product" : "price_change",
    proposed_price: "4.99",
    current_price: index === 0 ? "" : "3.99",
    unit_cost: "4.0000",
    margin: "0.1984",
    threshold: "0.25",
  }));
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  const { container } = render(
    <DemoProvider options={fixture.options}>
      <Approvals />
    </DemoProvider>,
  );
  await renderedUiReady(
    () => container.querySelectorAll(".approval-detail-row").length === 2,
  );
  const rows = container.querySelectorAll<HTMLElement>(".approval-detail-row");
  expect(screen.getByText("first price")).toBeVisible();
  expect(screen.queryByText("Old price")).not.toBeInTheDocument();
  for (const [index, row] of [...rows].entries()) {
    const heading = within(row).getByRole("heading", { level: 2 });
    expect(heading.querySelector("a")).toHaveAttribute(
      "href",
      `#product?code=${state.products[index].code}`,
    );
    expect(row.querySelectorAll(".approval-row-heading h2")).toHaveLength(1);
    expect(within(row).getByText("Below 25% minimum")).toBeVisible();
    expect(row.querySelector(".approval-margin")).toHaveClass(
      "is-below-minimum",
    );
    const actions = Array.from(
      row.querySelectorAll<HTMLButtonElement>(
        ".approval-decision-actions > button",
      ),
    );
    expect(actions.map((button) => button.textContent)).toEqual([
      "Edit and approve",
      "Reject",
      "Approve",
    ]);
    expect(actions[0]).toHaveClass("button-secondary");
    expect(actions[1]).toHaveClass("button-danger");
    expect(actions[2]).toHaveClass("button-primary");
  }
  const first = rows[0];
  const acknowledge = within(first).getByRole("checkbox", {
    name: "Use this price anyway — it's below the minimum margin.",
  });
  expect(acknowledge).not.toBeChecked();
  fireEvent.click(
    within(first).getByRole("button", { name: "Approve product" }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(acknowledge).toHaveFocus();
  fireEvent.click(acknowledge);
  fireEvent.click(
    within(first).getByRole("button", { name: "Approve product" }),
  );
  const preview = await screen.findByRole("dialog", {
    name: "Review approval",
  });
  expect(
    (await fixture.readCanonical()).approvals.every(
      (item) => item.status === "pending",
    ),
  ).toBe(true);
  fireEvent.click(within(preview).getByRole("button", { name: "Cancel" }));
  expect(
    (await fixture.readCanonical()).approvals.every(
      (item) => item.status === "pending",
    ),
  ).toBe(true);
});

async function editableApproval() {
  const state = initialState();
  state.sale_requests = [];
  state.offers = [];
  state.sales = [];
  const product = state.products.find((row) => row.code === "0009")!;
  Object.assign(product, {
    name_en: "Everpine Test Crackers",
    name_fa: "کراکر آزمایشی",
    pricing_category: "grocery",
    date_tracking: false,
    status: "pending_approval",
    sold_by: "each",
    pending_price: "1.99",
  });
  state.approvals = [
    {
      id: "r2c-ui-editor",
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      product_code: product.code,
      status: "pending",
      type: "new_product",
      proposed_price: "1.99",
      unit_cost: "1.2500",
      pricing_category: "grocery",
    },
  ];
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: { selection: { kind: "location", location_id: "Branch 1" } },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Approvals />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(screen.queryByRole("button", { name: "Edit and approve" })),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit and approve" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Edit and approve",
  });
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "Save and approve" }),
    ).toBeEnabled(),
  );
  return { fixture, dialog, product };
}
it("opens the shared full editor with proposed price and cancels every staged change", async () => {
  const { fixture, dialog } = await editableApproval();
  const before = await fixture.readCanonical();
  expect(within(dialog).getByLabelText("English name")).toHaveValue(
    "Everpine Test Crackers",
  );
  expect(within(dialog).getByLabelText("Selling price (per unit)")).toHaveValue(
    "1.99",
  );
  expect(within(dialog).getByLabelText("Taxable")).toBeVisible();
  expect(
    within(dialog).getByLabelText("Supplier code (optional)"),
  ).toBeVisible();
  fireEvent.change(within(dialog).getByLabelText("English name"), {
    target: { value: "Unsaved Test Name" },
  });
  fireEvent.change(within(dialog).getByLabelText("Supplier code (optional)"), {
    target: { value: "UNSAVED-99" },
  });
  fireEvent.change(within(dialog).getByLabelText("Selling price (per unit)"), {
    target: { value: "8.99" },
  });
  expect(await fixture.readCanonical()).toEqual(before);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(await fixture.readCanonical()).toEqual(before);
});
it("saves product edits and the approval together, retaining invoice and physical evidence", async () => {
  const { fixture, dialog, product } = await editableApproval();
  const before = await fixture.readCanonical();
  fireEvent.change(within(dialog).getByLabelText("English name"), {
    target: { value: "Edited Everpine Test Crackers" },
  });
  fireEvent.change(within(dialog).getByLabelText("Persian name (optional)"), {
    target: { value: "کراکر ویرایش‌شده" },
  });
  fireEvent.change(within(dialog).getByLabelText("Supplier code (optional)"), {
    target: { value: "EV-CHANGED" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Save and approve" }),
  );
  await waitFor(async () =>
    expect(
      (await fixture.readCanonical()).approvals.find(
        (row) => row.id === "r2c-ui-editor",
      )?.status,
    ).toBe("approved"),
  );
  const after = await fixture.readCanonical();
  expect(after.products.find((row) => row.code === product.code)).toMatchObject(
    {
      name_en: "Edited Everpine Test Crackers",
      name_fa: "کراکر ویرایش‌شده",
      status: "active",
    },
  );
  expect(
    after.supplier_items?.some(
      (row) =>
        row.product_code === product.code &&
        row.supplier_item_code === "EV-CHANGED",
    ),
  ).toBe(true);
  expect(
    after.activity.filter((row) => row.action === "Edit and approve product"),
  ).toHaveLength(1);
  expect(after.invoice).toEqual(before.invoice);
  expect(after.invoices).toEqual(before.invoices);
  expect(after.ledger).toEqual(before.ledger);
  expect(after.stock_movements).toEqual(before.stock_movements);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
