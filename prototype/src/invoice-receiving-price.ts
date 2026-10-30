import { approvedWeightPricePerLb, type WeightUnit } from "./weighed";
import { actorAudit } from "./domain-authority";
import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState, InvoiceLine } from "./types";
import { requireInvoiceAuthority } from "./invoice-authority";
import { businessFingerprint } from "./business-fingerprint";
import { effectiveRoundingBands } from "./pricing-ending-rule";
import { invoiceLineCalculation } from "./invoice-weight";
import { createId } from "./ids";

export interface ReceivingPriceProposal {
  price: string;
  calculated_price: string;
  entered_price?: string;
  price_unit?: "each" | WeightUnit;
  set_by_user_id: string;
  set_by: string;
  set_at: string;
  pricing_quote: string;
}

export type ReceivingPriceView = Omit<ReceivingPriceProposal, "pricing_quote">;

export function validReceivingPrice(value: string): boolean {
  return (
    typeof value === "string" &&
    /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value) &&
    new Decimal(value).gt(0)
  );
}

function productFor(state: DemoState, line: InvoiceLine) {
  return state.products.find(
    (product) =>
      product.company_id === line.company_id &&
      product.code === line.product_code,
  );
}

/** Stable pricing evidence, independent of action versions and prior decisions. */
function receivingPriceBasis(state: DemoState, index: number): string {
  const invoice = state.invoice;
  const line = invoice.lines[index];
  if (!line) throw new Error("The invoice line changed. Open it again.");
  const product = productFor(state, line);
  return businessFingerprint({
    company: invoice.company_id,
    invoice: invoice.id,
    branch: invoice.branch,
    line: [line.id ?? index, line.import_line_index, line.description],
    source: [invoice.file_data, invoice.original_pages],
    product: line.product_code,
    category: line.pricing_category ?? product?.pricing_category,
    unit_cost: line.unit_cost_before_tax,
    case_cost: line.case_cost_before_tax,
    imported_cost_basis: line.imported_unit_cost_basis,
    free_case_group: line.free_case_group,
    weight_case_cost_basis: line.weight_case_cost_basis,
    weight_conversion_factor: line.weight_conversion_factor,
    case_weight: line.case_weight,
    case_weight_unit: line.case_weight_unit,
    source_cost: line.source_cost_before_tax,
    source_cost_unit: line.source_cost_unit,
    pack: line.units_per_case ?? 1,
    sold_by: line.sold_by ?? "each",
    short_dated: Boolean(line.short_dated),
    received: line.qty_received_at_posting,
    refused: line.refused_units ?? 0,
    categories: state.config.pricing_categories,
    bands: effectiveRoundingBands(state.config),
    corrections: state.config.special_corrections,
    weighed: state.config.weighed_items,
  });
}

/** A fresh action token also rejects stale restores and concurrent receiver edits. */
export function receivingPriceQuote(state: DemoState, index: number): string {
  const invoice = state.invoice;
  const lastPriceAction = [...state.activity]
    .reverse()
    .find(
      (entry) =>
        entry.company_id === invoice.company_id &&
        entry.entity_type === "invoice" &&
        entry.entity_id === invoice.id &&
        ["Set receiving price", "Use calculated receiving price"].includes(
          entry.action,
        ),
    );
  return businessFingerprint({
    basis: receivingPriceBasis(state, index),
    version: invoice.version ?? 0,
    branch: invoice.branch,
    status: invoice.status,
    live_attempt: invoice.live_reading?.attempt_id,
    receiving_price: invoice.lines[index].receiving_price ?? null,
    last_price_action: lastPriceAction?.id ?? null,
  });
}

export function receivingPriceEligible(state: DemoState, line: InvoiceLine) {
  try {
    return (
      !line.short_dated &&
      new Decimal(line.qty_received_at_posting)
        .minus(line.refused_units ?? 0)
        .gt(0) &&
      !productFor(state, line)?.package_of_product_id
    );
  } catch {
    return false;
  }
}

export function receivingPriceProblem(
  state: DemoState,
  index: number,
): boolean {
  const line = state.invoice.lines[index];
  const proposal = line?.receiving_price;
  return Boolean(
    proposal &&
    (!validReceivingPrice(proposal.price) ||
      !receivingPriceEligible(state, line) ||
      proposal.pricing_quote !== receivingPriceBasis(state, index)),
  );
}

/** Receiving edits create a proposal; only ordinary approval changes charged prices. */
export function setInvoiceReceivingPrice(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
  value: string | null,
  expectedQuote: string,
  now = new Date(),
  displayedUnit?: WeightUnit,
): string {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  requireInvoiceAuthority(state, actor, "invoices.cost_read", state.invoice.id);
  const invoice = state.invoice;
  const line = invoice.lines[index];
  if (
    !["draft", "review"].includes(invoice.status) ||
    !Number.isSafeInteger(index) ||
    !line ||
    line.company_id !== invoice.company_id ||
    expectedQuote !== receivingPriceQuote(state, index)
  )
    throw new Error("The invoice price changed. Open the line again.");
  if (
    value !== null &&
    (typeof value !== "string" ||
      (displayedUnit !== undefined && line.sold_by !== "weight") ||
      !receivingPriceEligible(state, line) ||
      value.length > 64)
  )
    throw new Error("This receipt keeps its existing selling-price rules.");
  const before = structuredClone(invoice);
  if (value === null) delete line.receiving_price;
  else {
    const category =
      line.pricing_category ?? productFor(state, line)?.pricing_category ?? "";
    const calculation = invoiceLineCalculation(line, category, state.config);
    const raw = value.trim();
    const canonical = validReceivingPrice(raw)
      ? line.sold_by === "weight" && displayedUnit
        ? approvedWeightPricePerLb(raw, displayedUnit, state.config)
        : new Decimal(raw).toFixed(2)
      : raw;
    line.receiving_price = {
      price: canonical,
      entered_price: validReceivingPrice(raw)
        ? new Decimal(raw).toFixed(2)
        : raw,
      price_unit: line.sold_by === "weight" ? (displayedUnit ?? "lb") : "each",
      calculated_price: calculation.selling_price,
      set_by_user_id: actor.user_id,
      set_by: actor.actor,
      set_at: now.toISOString(),
      pricing_quote: receivingPriceBasis(state, index),
    };
  }
  line.review_changed_after_confirmation ||= line.review_confirmed;
  line.review_confirmed = false;
  state.activity.push({
    id: createId("invoice-receiving-price"),
    company_id: invoice.company_id,
    branch: invoice.branch,
    action:
      value === null ? "Use calculated receiving price" : "Set receiving price",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    reversible: true,
    entity_type: "invoice",
    entity_id: invoice.id,
    before,
    after: structuredClone(invoice),
  });
  return receivingPriceQuote(state, index);
}
