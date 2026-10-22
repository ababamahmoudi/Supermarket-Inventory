import type { AuthenticatedActor } from "./authority-types";
import { cloneWithAuthority, freshActor } from "./authority";
import {
  requireInvoiceAuthority,
  canInvoiceAuthority,
} from "./invoice-authority";
import { purchaseInvoiceView } from "./invoice-projections";
import {
  invoiceBlockers,
  lowerPriceLineIndexes,
  manualDecisionForLine,
  previousReceiptCost,
  initializeInvoiceManualPriceDecisions,
  validCost,
} from "./invoice";
import { invoiceLineCalculation } from "./invoice-weight";
import { invoiceVersion, invoiceContentVersions } from "./invoice-version";
import { manualPrice } from "./manual-prices";
import { reusableOtherLocationDates } from "./receipt-lots";
import { supplierItemFactsForInvoice } from "./supplier-items";
import {
  suggestedInvoiceLocation,
  invoiceLocationMovePreview,
  movePostedInvoice,
  type InvoiceMovePreview,
} from "./received";
import { createId } from "./ids";
import type { DemoState, DemoInvoice } from "./types";

function canonicalInvoice(state: DemoState, id: string): DemoInvoice {
  const invoice =
    id === state.invoice.id
      ? state.invoice
      : state.invoices?.find((row) => row.id === id);
  if (!invoice) throw new Error("The invoice changed.");
  return invoice;
}
/** Workspace navigation retains canonical records without trusting public invoice data. */
export function selectInvoiceWorkspace(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
): void {
  actor = requireInvoiceAuthority(state, actor, "invoices.read", id);
  const next = canonicalInvoice(state, id);
  if (next.id !== state.invoice.id) {
    if (state.invoice.status !== "empty" || state.invoice.file_data) {
      state.invoices ??= [];
      const index = state.invoices.findIndex(
        (row) =>
          row.id === state.invoice.id &&
          row.company_id === state.invoice.company_id,
      );
      const retained = structuredClone(state.invoice);
      if (index < 0) state.invoices.push(retained);
      else state.invoices[index] = retained;
    }
    state.invoice = structuredClone(next);
  }
  if (
    state.invoice.status === "empty" &&
    state.invoice.file_data &&
    canInvoiceAuthority(state, actor, "invoices.edit", id, true)
  )
    state.invoice.status = "reading";
  if (
    state.invoice.status !== "posted" &&
    canInvoiceAuthority(state, actor, "invoices.edit", id, true)
  )
    initializeInvoiceManualPriceDecisions(state, actor);
}
/** Only financial values belonging to this authorized invoice enter the workspace DTO. */
export function invoiceWorkspaceRead(
  state: DemoState,
  actor: AuthenticatedActor,
  id = state.invoice.id,
  version?: string | null,
) {
  actor = requireInvoiceAuthority(state, actor, "invoices.cost_read", id);
  const canonical = canonicalInvoice(state, id);
  const working = cloneWithAuthority(state);
  working.invoice = structuredClone(canonical);
  const invoice = purchaseInvoiceView(state, actor, id);
  const versions = invoiceContentVersions(state, canonical);
  const selected = invoiceVersion(state, canonical, version);
  const corrections = canInvoiceAuthority(
    state,
    actor,
    "invoices.correct",
    id,
    true,
  );
  const displayedVersion = {
    version_id: corrections ? selected.version_id : versions.at(-1)!.version_id,
    invoice: purchaseInvoiceView(
      state,
      actor,
      id,
      corrections ? selected.version_id : undefined,
    ),
  };
  const lineDetails = working.invoice.lines.map((line, index) => {
    const product = working.products.find(
      (row) =>
        row.code === line.product_code && row.company_id === line.company_id,
    );
    let price: string | null = null,
      costValid = true;
    try {
      // A new imported product awaits a person's category choice. Its valid
      // printed cost is independent of that missing pricing input.
      if (line.pricing_category === "") {
        costValid = validCost(line.unit_cost_before_tax);
        if (line.sold_by === "weight")
          costValid &&= validCost(line.source_cost_before_tax ?? "");
        if (line.quantity_unit === "cases" && line.sold_by !== "weight")
          costValid &&= validCost(line.case_cost_before_tax ?? "");
      } else {
        price =
          working.invoice.status === "posted"
            ? line.calculated_selling_price
            : invoiceLineCalculation(
                line,
                line.pricing_category ?? product?.pricing_category ?? "grocery",
                working.config,
              ).selling_price;
      }
    } catch {
      costValid = false;
    }
    const replacement = manualDecisionForLine(
      working,
      actor,
      line,
      working.invoice.branch,
    );
    const marker = product
      ? manualPrice(working, product, working.invoice.branch)
      : null;
    let dateSuggestions: ReturnType<typeof reusableOtherLocationDates> = [];
    if (line.date_tracking && working.invoice.status !== "posted" && product)
      try {
        dateSuggestions = reusableOtherLocationDates(working, actor, {
          product_code: product.code,
          supplier: working.invoice.supplier,
          branch: working.invoice.branch,
        }).filter((row) => !line.short_dated || row.date_type === "expiry");
      } catch {
        dateSuggestions = [];
      }
    return {
      index,
      price,
      costValid,
      manual: marker ? { price: marker.price } : null,
      manualReplacement: replacement ? { price: replacement.price } : null,
      previous: previousReceiptCost(working, actor, line.product_code, line),
      dateSuggestions,
    };
  });
  const blockers = invoiceBlockers(working, actor);
  const blockersById: Record<string, ReturnType<typeof invoiceBlockers>> = {};
  for (const row of [state.invoice, ...(state.invoices ?? [])]) {
    if (!canInvoiceAuthority(state, actor, "invoices.cost_read", row.id))
      continue;
    const draft = cloneWithAuthority(state);
    draft.invoice = structuredClone(row);
    blockersById[row.id] = invoiceBlockers(draft, actor);
  }
  const supplierItems = supplierItemFactsForInvoice(
    working,
    actor,
    working.invoice.supplier,
  ).map((row) => ({
    id: row.id,
    product_code: row.product_code,
    supplier_item_code: row.supplier_item_code,
    name_en: row.name_en,
    name_fa: row.name_fa,
    units_per_case: row.units_per_case,
  }));
  return {
    invoice,
    displayedVersion,
    latestVersionId: versions.at(-1)!.version_id,
    blockers,
    blockersById,
    lowerLineIndexes: lowerPriceLineIndexes(working, actor),
    lineDetails,
    supplierItems,
    locationSuggestion: suggestedInvoiceLocation(state, canonical),
  };
}
export type InvoiceWorkspaceRead = ReturnType<typeof invoiceWorkspaceRead>;

export type InvoiceMoveRead = Pick<
  InvoiceMovePreview,
  | "from_branch"
  | "to_branch"
  | "outstanding_amount"
  | "currency"
  | "allocations"
  | "approval_ids"
> & {
  receipts: Pick<InvoiceMovePreview["receipts"][number], "units">[];
  snapshot: string;
};
const moves = new Map<
  string,
  {
    invoice_id: string;
    user_id: string;
    session_id: string;
    target: string;
    snapshot: string;
  }
>();
export function invoiceMoveRead(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  target: string,
): InvoiceMoveRead {
  const current = freshActor(state, actor);
  const preview = invoiceLocationMovePreview(state, current, id, target);
  const token = createId("invoice-move-review");
  moves.set(token, {
    invoice_id: id,
    user_id: current.user_id,
    session_id: current.session_id,
    target,
    snapshot: preview.snapshot,
  });
  return {
    from_branch: preview.from_branch,
    to_branch: preview.to_branch,
    outstanding_amount: preview.outstanding_amount,
    currency: preview.currency,
    allocations: preview.allocations.map((row) => ({
      ledger_id: row.ledger_id,
      branch: row.branch,
      amount: row.amount,
    })),
    receipts: preview.receipts.map((row) => ({ units: row.units })),
    approval_ids: [...preview.approval_ids],
    snapshot: token,
  };
}
export function applyReviewedInvoiceMove(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  target: string,
  reason: string,
  token: string,
): void {
  const current = freshActor(state, actor),
    review = moves.get(token);
  if (
    !review ||
    review.invoice_id !== id ||
    review.target !== target ||
    review.user_id !== current.user_id ||
    review.session_id !== current.session_id
  )
    throw new Error(
      "The invoice or allocations changed. Review the move again.",
    );
  movePostedInvoice(state, current, id, target, reason, review.snapshot);
  moves.delete(token);
}
