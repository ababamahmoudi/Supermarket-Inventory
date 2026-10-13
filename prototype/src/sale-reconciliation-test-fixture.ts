/** Test-only compatibility adapters use genuine actors and real private evidence. */
import {
  evaluateSales,
  recordSaleReceiptCost,
  type SalesContext,
  type SaleReceiptCostInput,
} from "./sales";
import {
  invoicePurchaseEvidence,
  closePurchaseEvidence,
} from "./purchase-evidence.internal";
import { reconcileFixture } from "./system-reconciliation-test-fixture";
import type { DemoState } from "./types";
export const evaluateFixtureSales = (state: DemoState, now = new Date()) =>
  reconcileFixture(
    state,
    "sales_clock",
    (canonical, attribution) => evaluateSales(canonical, attribution),
    now,
  );
export function receiptCostFixture(
  state: DemoState,
  actor: SalesContext,
  input: SaleReceiptCostInput,
  now = new Date(),
) {
  const purpose =
    input.source_event_id &&
    state.invoice_content_corrections?.some(
      (item) => item.id === input.source_event_id,
    )
      ? "invoice_correct"
      : input.source_event_id
        ? "invoice_short_resolve"
        : "invoice_post";
  const source =
    purpose === "invoice_correct"
      ? "invoice_content_correction"
      : purpose === "invoice_short_resolve"
        ? "invoice_short_receipt"
        : "invoice_post";
  const evidence = invoicePurchaseEvidence(
    state,
    actor,
    input.invoice_id,
    purpose,
  );
  try {
    return recordSaleReceiptCost(state, actor, input, source, evidence, now);
  } finally {
    closePurchaseEvidence(evidence);
  }
}
