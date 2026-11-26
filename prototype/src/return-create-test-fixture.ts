/** Test-only independent fictional received-product example. Never imported by app code. */
import { initialState } from "./e1-bootstrap";
import type { DemoState } from "./types";
export function returnCreateFixture(): DemoState {
  const state = initialState(),
    company_id = state.config.company.seed_key;
  state.demo_fixture_schema = 2;
  state.returns = [];
  state.activity = [];
  state.alerts = [];
  const supplier = {
    id: "return-cloudbay",
    company_id,
    name: "Cloudbay Wholesale",
    phone: "",
    email: "",
    sales_rep_name: "",
    sales_rep_phone: "",
    payment_terms: "Net 30",
    address: "",
    status: "confirmed" as const,
    active: true,
    created_at: "2026-10-01T12:00:00Z",
    created_by: "Fictional setup",
  };
  state.suppliers = [supplier];
  const product = state.products.find((product) => product.code === "0003")!;
  Object.assign(product, {
    name_en: "Meadow Jar",
    name_fa: "شیشه مِدو",
    main_supplier: supplier.name,
    unit_size: "300 g",
    barcode: "FICT-RETURN-JAR",
    status: "active",
    sold_by: "each",
  });
  const line = {
    ...structuredClone(state.invoice.lines[0]),
    company_id,
    product_code: product.code,
    description: product.name_en,
    description_fa: product.name_fa,
    sold_by: "each" as const,
    quantity_unit: "units" as const,
    qty_invoiced: 20,
    qty_received_at_posting: 20,
    unit_cost_before_tax: "7.1250",
    line_total: "142.50",
    taxable: false,
    refused_units: 0,
    qty_later_received: 0,
  };
  state.invoices = [
    {
      ...structuredClone(state.invoice),
      id: "fictional-return-source",
      company_id,
      branch: "Branch 1",
      supplier: supplier.name,
      supplier_invoice_number: "CLOUD-RET-01",
      status: "posted",
      invoice_date: "2026-10-21",
      received_at: "2026-10-21T14:00:00Z",
      posted_at: "2026-10-21T14:01:00Z",
      import_currency: state.config.company.currency,
      subtotal: "142.50",
      tax: "0.00",
      final_total: "142.50",
      payable_after_open_shorts: "142.50",
      lines: [line],
      short_lines: [],
    },
  ];
  state.invoice = {
    ...structuredClone(state.invoice),
    status: "empty",
    lines: [],
  };
  state.ledger = [
    {
      id: "fictional-return-purchase",
      company_id,
      branch: "Branch 1",
      supplier: supplier.name,
      type: "invoice",
      amount: "142.50",
      date: "2026-10-21",
      reference: "CLOUD-RET-01",
      invoice_id: "fictional-return-source",
      currency: state.config.company.currency,
    },
  ];
  return state;
}
