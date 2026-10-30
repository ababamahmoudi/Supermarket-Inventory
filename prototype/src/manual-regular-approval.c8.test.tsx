import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { useProtectedQuery } from "./use-protected-query";
import { domainScope } from "./domain-authority";
import i18n from "./i18n";
import { regularPrice } from "./catalog";
import { manualPrice } from "./manual-prices";
import { demoSaleCostInvoice, postInvoice } from "./invoice";
import { savePriceChange, saleStoreDate } from "./sales";
import { Approvals } from "./screens/Approvals";
import { DemoProvider, initialState, useDemo } from "./store";
import {
  clearRenderedUiReadiness,
  renderedUiReady,
} from "./test/rendered-ui-readiness";

const fixtures: Awaited<ReturnType<typeof authenticatedProviderFixture>>[] = [];
afterEach(() => {
  clearRenderedUiReadiness();
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "approvals";
  await i18n.changeLanguage("en");
});

function Harness() {
  const { state } = useDemo();
  const saved = useProtectedQuery(
    "catalog.cost_read",
    domainScope(state),
    (canonical, actor) => {
      const product = canonical.products.find(
        (item) => item.company_id === actor.company_id && item.code === "0012",
      )!;
      return {
        price: regularPrice(canonical, product, "Branch 1"),
        marker: manualPrice(canonical, product, "Branch 1")?.price ?? "none",
        decision:
          canonical.approvals.find((item) => item.manual_price_review)
            ?.manual_price_review?.decision ?? "pending",
      };
    },
    "0012:Branch 1",
  );
  return (
    <>
      <output aria-label="Actual regular price">
        {saved.data?.price ?? "pending"}
      </output>
      <output aria-label="Manual marker">
        {saved.data?.marker ?? "pending"}
      </output>
      <output aria-label="Final regular decision">
        {saved.data?.decision ?? "pending"}
      </output>
      <Approvals />
    </>
  );
}

async function prepare() {
  const state = initialState();
  const manager = authenticatedTestActor(state, "manager", {
    name_en: "Demo Supervisor",
    selection: { kind: "location", location_id: "Branch 1" },
  });
  const worker = authenticatedTestActor(state, "floor_worker", {
    name_en: "Demo Floor Worker",
    locations: ["Branch 1"],
  });
  savePriceChange(state, manager, {
    product_code: "0012",
    mode: "regular",
    scope: "current",
    price: "24.99",
    price_unit: "each",
    branches: ["Branch 1"],
    starts_on: saleStoreDate(state.config, "Branch 1"),
    last_day: null,
    accept_below_margin: false,
    below_cost_reason: "",
    add_labels: false,
  });
  state.invoice = demoSaleCostInvoice(state, worker, "Branch 1");
  state.invoice.file_name = "retained-unit-original.pdf";
  state.invoice.file_data = "data:application/pdf;base64,QzhIVw==";
  state.invoice.receiving_employee = "Demo Floor Worker";
  state.invoice.supplier_confirmed = true;
  state.invoice.lines[0].review_confirmed = true;
  state.invoice.lines[0].date_confirmed = true;
  state.invoice.lines[0].manual_price_decision = "keep";
  state.invoice.lower_price_answers = { same_expiry: "no_previous_stock" };
  postInvoice(state, worker);
  const approval = state.approvals.find(
    (item) =>
      item.source_invoice_id === state.invoice.id &&
      item.product_code === "0012",
  )!;
  expect(approval.manual_price_review?.receiver_recommendation).toBe("keep");
  expect(approval.proposed_price).toBe("23.99");
  const fixture = await authenticatedProviderFixture({
    state,
    role: "manager",
    actorOptions: {
      selection: { kind: "location", location_id: "Branch 1" },
      name_en: "Demo Supervisor",
    },
  });
  fixtures.push(fixture);
  render(
    <DemoProvider options={fixture.options}>
      <Harness />
    </DemoProvider>,
  );
  await renderedUiReady(() =>
    Boolean(
      screen.queryByRole("heading", {
        level: 2,
        name: "Stainless Steel Pot 24 cm",
      }),
    ),
  );
  // ProductName renders names/units inside the linked heading. Follow that
  // actual approval row, then open its protected decision preview.
  const title = screen.getByRole("heading", {
    level: 2,
    name: "Stainless Steel Pot 24 cm",
  });
  const card = title.closest<HTMLElement>(".approval-detail-row")!;
  expect(card).toHaveAttribute("data-approval-id", approval.id);
  fireEvent.click(within(card).getByRole("button", { name: "Approve price" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Review approval",
  });
  await within(dialog).findByRole("combobox", {
    name: "Selling price",
  });
  return dialog;
}

it("offers calculated price by default despite receiver Keep, and applies it only after the manager confirms", async () => {
  const dialog = await prepare();
  expect(
    within(dialog).getByRole("combobox", { name: "Selling price" }),
  ).toHaveTextContent("Use the new calculated price $23.99");
  expect(screen.getByLabelText("Actual regular price")).toHaveTextContent(
    "24.99",
  );
  fireEvent.click(
    within(dialog).getByRole("combobox", { name: "Apply price to" }),
  );
  fireEvent.click(screen.getByRole("option", { name: "This branch only" }));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Approve price" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Actual regular price")).toHaveTextContent(
      "23.99",
    ),
  );
  expect(screen.getByLabelText("Manual marker")).toHaveTextContent("none");
  expect(screen.getByLabelText("Final regular decision")).toHaveTextContent(
    "rule",
  );
});

it("explicit Keep locks the decision to its original store and preserves the manual price and marker", async () => {
  const dialog = await prepare();
  fireEvent.click(
    within(dialog).getByRole("combobox", { name: "Selling price" }),
  );
  fireEvent.click(screen.getByRole("option", { name: "Keep $24.99" }));
  expect(
    within(dialog).queryByRole("combobox", { name: "Apply price to" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Approve price" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Final regular decision")).toHaveTextContent(
      "keep",
    ),
  );
  expect(screen.getByLabelText("Actual regular price")).toHaveTextContent(
    "24.99",
  );
  expect(screen.getByLabelText("Manual marker")).toHaveTextContent("24.99");
});
