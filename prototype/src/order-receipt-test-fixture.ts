/** Test-only retained receipt seam; application code never imports this module. */
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import {
  applyInvoiceToOrder,
  validateOrderReceipt,
  type OrderReceiptInput,
} from "./orders";
import {
  invoicePurchaseEvidence,
  closePurchaseEvidence,
} from "./purchase-evidence.internal";

/** Mint only the exact real capability/source/purpose needed by this canonical receipt. */
export function applyReviewedOrderReceipt(
  state: DemoState,
  actor: AuthenticatedActor,
  orderId: string,
  input: OrderReceiptInput,
) {
  const proof = invoicePurchaseEvidence(
    state,
    actor,
    input.invoice_id,
    input.kind === "invoice" ? "invoice_post" : "invoice_short_resolve",
  );
  try {
    return applyInvoiceToOrder(state, actor, orderId, input, proof);
  } finally {
    closePurchaseEvidence(proof);
  }
}
export function validateReviewedOrderReceipt(
  state: DemoState,
  actor: AuthenticatedActor,
  orderId: string,
  input: OrderReceiptInput,
) {
  const proof = invoicePurchaseEvidence(
    state,
    actor,
    input.invoice_id,
    input.kind === "invoice" ? "invoice_post" : "invoice_short_resolve",
  );
  try {
    return validateOrderReceipt(state, actor, orderId, input, proof);
  } finally {
    closePurchaseEvidence(proof);
  }
}
