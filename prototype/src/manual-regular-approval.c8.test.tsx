import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { SESSION_KEY } from "./auth";
import i18n from "./i18n";
import { regularPrice } from "./catalog";
import { manualPrice } from "./manual-prices";
import { demoSaleCostInvoice, postInvoice } from "./invoice";
import { savePriceChange, saleStoreDate } from "./sales";
import { Approvals } from "./screens/Approvals";
import { DemoProvider, initialState, STORAGE_KEY, useDemo } from "./store";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "approvals";
  void i18n.changeLanguage("en");
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      username: "supervisor",
      branch: "Branch 1",
      lang: "en",
      locked: false,
      authenticatedAt: Date.now(),
    }),
  );
});

function Harness() {
  const { state } = useDemo();
  const product = state.products.find((item) => item.code === "0012")!;
  return (
    <>
      <output aria-label="Actual regular price">
        {regularPrice(state, product, "Branch 1")}
      </output>
      <output aria-label="Manual marker">
        {manualPrice(state, product, "Branch 1")?.price ?? "none"}
      </output>
      <output aria-label="Final regular decision">
        {state.approvals.find((item) => item.manual_price_review)
          ?.manual_price_review?.decision ?? "pending"}
      </output>
      <Approvals />
    </>
  );
}

function prepare() {
  const state = initialState();
  savePriceChange(
    state,
    {
      company_id: state.config.company.seed_key,
      role: "supervisor",
      actor: "Demo Supervisor",
      username: "supervisor",
      branch: "Branch 1",
      allowed_branches: ["Branch 1", "Branch 2", "Branch 3"],
    },
    {
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
    },
  );
  state.invoice = demoSaleCostInvoice(state);
  state.invoice.file_name = "retained-unit-original.pdf";
  state.invoice.file_data = "data:application/pdf;base64,QzhIVw==";
  state.invoice.receiving_employee = "Demo Floor Worker";
  state.invoice.supplier_confirmed = true;
  state.invoice.lines[0].review_confirmed = true;
  state.invoice.lines[0].date_confirmed = true;
  state.invoice.lines[0].manual_price_decision = "keep";
  state.invoice.lower_price_answers = { same_expiry: "no_previous_stock" };
  postInvoice(state, "floor_worker", "Branch 1", "Demo Floor Worker");
  const approval = state.approvals.find(
    (item) =>
      item.source_invoice_id === state.invoice.id &&
      item.product_code === "0012",
  )!;
  expect(approval.manual_price_review?.receiver_recommendation).toBe("keep");
  expect(approval.proposed_price).toBe("23.49");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render(
    <DemoProvider>
      <Harness />
    </DemoProvider>,
  );
  const card = screen
    .getByText("Stainless Steel Pot 24 cm", { selector: "h2" })
    .closest(".approval-card")!;
  fireEvent.click(
    within(card as HTMLElement).getByRole("button", { name: "Approve price" }),
  );
  return screen.getByRole("dialog", { name: "Review approval" });
}

it("offers calculated price by default despite receiver Keep, and applies it only after the manager confirms", async () => {
  const dialog = prepare();
  expect(
    within(dialog).getByRole("combobox", { name: "Selling price" }),
  ).toHaveTextContent("Use the new calculated price $23.49");
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
      "23.49",
    ),
  );
  expect(screen.getByLabelText("Manual marker")).toHaveTextContent("none");
  expect(screen.getByLabelText("Final regular decision")).toHaveTextContent(
    "rule",
  );
});

it("explicit Keep locks the decision to its original store and preserves the manual price and marker", async () => {
  const dialog = prepare();
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
