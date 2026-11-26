import fixture from "../../tests/fixtures/r2b-fictional-readings-export.json";
import { initialState } from "../e1-bootstrap";
import { authenticatedTestActor } from "../authority-test-fixture";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
  setInvoiceLineCategory,
} from "../invoice-checks";
import { postInvoice, recalculateInvoice } from "../invoice";
import { selectInvoiceWorkspace } from "../invoice-workspace-read";
import {
  importInvoiceReadings,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
} from "../invoice-readings";
import { productEditSnapshot, saveProductEdits } from "../product-editor";
import type { DemoState } from "../types";
import type { AuthenticatedActor } from "../authority-types";

export function matchingBusiness() {
  const state = initialState();
  state.invoice.status = "empty";
  state.invoice.lines = [];
  state.invoices = [];
  state.products = [];
  state.suppliers = [];
  state.supplier_items = [];
  state.activity = [];
  state.approvals = [];
  state.ledger = [];
  return state;
}

export function matchingReading(
  index: number,
  supplier = "Northstar Test Foods",
  code = "",
) {
  const exported = parseInvoiceReadings(JSON.stringify(fixture));
  const entry = exported.invoices[index];
  entry.id = `fictional-matching-${index}`;
  entry.checked_answer = null;
  entry.ai_statuses = {};
  entry.ai_reading = {
    supplier_name: supplier,
    supplier_invoice_number: `MATCH-${index + 1}`,
    supplier_tax_number:
      supplier === "Northstar Test Foods" ? "TEST-NORTHSTAR" : "TEST-ELMWOOD",
    invoice_date: `2026-08-${12 + index}`,
    due_date: `2026-08-${12 + index}`,
    payment_terms: "COD",
    bill_to: "North York",
    currency: "CAD",
    subtotal: "30.00",
    tax: "0.00",
    final_total: "30.00",
    lines: [
      {
        line_type: "item",
        description: "CARROT 24",
        supplier_sku: code,
        quantity: "1",
        unit: "case",
        units_per_case: "24",
        pack_size: "24 × 300 g",
        unit_cost_before_tax: "1.2500",
        cost_basis: "each",
        cost_per_unit_before_tax: "1.2500",
        cost_per_case_before_tax: "30.0000",
        line_total: "30.00",
        taxable: false,
      },
    ],
  };
  exported.invoices = [entry];
  return exported;
}

export async function importMatchingReading(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
  supplier?: string,
  code?: string,
) {
  const exported = matchingReading(index, supplier, code);
  const selectedIds = exported.invoices.map((entry) => entry.id);
  const pages = await prepareInvoiceReadingPages(
    exported,
    selectedIds,
    state.config.company.seed_key,
  );
  const summary = importInvoiceReadings(state, actor, {
    exported,
    pages,
    selectedIds,
    locations: { [selectedIds[0]]: "Branch 1" },
    mode: "ai",
    fileName: "fictional-matching.json",
  });
  if (summary.imported.length !== 1)
    throw new Error("Fictional matching import was unexpectedly skipped.");
  selectInvoiceWorkspace(state, actor, summary.imported[0]);
  return state.invoice;
}

export async function postedMatchingProduct(code = "") {
  const state = matchingBusiness();
  const actor = authenticatedTestActor(state, "owner");
  const invoice = await importMatchingReading(state, actor, 0, undefined, code);
  setInvoiceLineCategory(invoice.lines[0], "grocery", state.config);
  recalculateInvoice(invoice, state.config);
  for (const field of [...(invoice.low_confidence_fields ?? [])])
    acknowledgeInvoiceCheck(state, actor, field);
  confirmInvoiceLineChecks(state, actor, 0);
  postInvoice(state, actor);
  const product = state.products[0];
  saveProductEdits(
    state,
    actor,
    product.code,
    {
      name_en: "Crafted Carrot Jam",
      name_fa: "مربای هویج آزمایشی",
      description_en: product.description_en ?? "",
      description_fa: product.description_fa ?? "",
      unit_size: product.unit_size,
      ai_category: product.ai_category,
      pricing_category: product.pricing_category,
      barcode: product.barcode,
      main_supplier: product.main_supplier,
      date_tracking: false,
      date_tracking_stop: "keep",
      scope: "all",
    },
    productEditSnapshot(state, actor, product.code),
  );
  return { state, actor, invoice, product };
}
