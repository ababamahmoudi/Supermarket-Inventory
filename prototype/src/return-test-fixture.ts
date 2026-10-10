import { initialState } from "./store";

/** Explicitly fictional retained-ledger case shared by C4 return tests. */
export function returnFixture() {
  const worker = {
    company_id: "super-arzon",
    branch: "Branch 1",
    actor: "Demo Floor Worker",
  };
  const state = initialState();
  state.returns = [
    {
      id: "c4-return",
      company_id: worker.company_id,
      branch: worker.branch,
      supplier: "Fresh Valley Foods",
      lines: [{ product_code: "0003", qty: 3, reason: "Leaking" }],
      status: "open",
      original_units_recovered: 0,
      created_by: worker.actor,
      created_at: "2026-10-01T12:00:00Z",
    },
  ];
  state.invoices = [];
  state.invoice.status = "draft";
  state.supplier_items = [];
  state.products.find(
    (product) => product.code === "0003",
  )!.last_cost_before_tax = "10.0000";
  state.ledger = [
    {
      id: "c4-owed",
      company_id: worker.company_id,
      branch: worker.branch,
      supplier: "Fresh Valley Foods",
      type: "invoice",
      amount: "600.00",
      date: "2026-10-01",
      invoice_id: "c4-base-invoice",
      reference: "C4-FICTIONAL-600",
      currency: state.config.company.currency,
    },
  ];
  state.demo_fixture_schema = 2;
  state.activity = [];
  state.alerts = [];
  state.config.returns = {
    deduct_expected_credit_at_pickup: true,
    waiting_credit_days: 14,
  };
  return state;
}
