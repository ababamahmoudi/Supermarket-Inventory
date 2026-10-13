import { createId } from "./ids";
import { freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import {
  correctPostedInvoice,
  invoiceContentCorrectionPreview,
  type InvoiceCorrectionInput,
  type InvoiceCorrectionPreview,
} from "./invoice-corrections";

export type InvoiceCorrectionReview = Pick<
  InvoiceCorrectionPreview,
  | "previous_correction_id"
  | "branch"
  | "payable_before"
  | "payable_after"
  | "payable_delta"
  | "allocated_amount"
  | "excess_allocated_credit"
  | "receipts"
  | "date_changes"
  | "blockers"
> & {
  snapshot: string;
  approval_changes: Pick<
    InvoiceCorrectionPreview["approval_changes"][number],
    | "line_index"
    | "product_code"
    | "selling_price"
    | "creates_pending_proposal"
    | "superseded_approval_ids"
  >[];
};
interface ReviewEvidence {
  invoiceId: string;
  userId: string;
  sessionId: string;
  snapshot: string;
}
const reviews = new Map<string, ReviewEvidence>();

/** Raw before/after invoice snapshots and original references remain private. */
export function invoiceCorrectionReview(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
  input: InvoiceCorrectionInput,
): InvoiceCorrectionReview {
  const preview = invoiceContentCorrectionPreview(
    state,
    actor,
    invoiceId,
    input,
  );
  actor = freshActor(state, actor);
  const token = createId("invoice-correction-review");
  reviews.set(token, {
    invoiceId,
    userId: actor.user_id,
    sessionId: actor.session_id,
    snapshot: preview.snapshot,
  });
  return {
    previous_correction_id: preview.previous_correction_id,
    branch: preview.branch,
    payable_before: preview.payable_before,
    payable_after: preview.payable_after,
    payable_delta: preview.payable_delta,
    allocated_amount: preview.allocated_amount,
    excess_allocated_credit: preview.excess_allocated_credit,
    receipts: preview.receipts.map((row) => ({
      line_index: row.line_index,
      before_product: row.before_product,
      after_product: row.after_product,
      before_quantity: row.before_quantity,
      after_quantity: row.after_quantity,
    })),
    date_changes: preview.date_changes.map((row) => ({
      line_index: row.line_index,
      product_code: row.product_code,
      before: row.before,
      after: row.after,
      date_type: row.date_type,
    })),
    blockers: [...preview.blockers],
    snapshot: token,
    approval_changes: preview.approval_changes.map((row) => ({
      line_index: row.line_index,
      product_code: row.product_code,
      selling_price: row.selling_price,
      creates_pending_proposal: row.creates_pending_proposal,
      superseded_approval_ids: [...row.superseded_approval_ids],
    })),
  };
}
export function applyReviewedInvoiceCorrection(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
  input: InvoiceCorrectionInput,
  token: string,
  requestId: string,
): void {
  actor = freshActor(state, actor);
  const review = reviews.get(token);
  if (
    !review ||
    review.invoiceId !== invoiceId ||
    review.userId !== actor.user_id ||
    review.sessionId !== actor.session_id
  )
    throw new Error("Invoice correction review changed.");
  correctPostedInvoice(
    state,
    actor,
    invoiceId,
    input,
    review.snapshot,
    requestId,
  );
  reviews.delete(token);
}
export function discardInvoiceCorrectionReview(token: string): void {
  reviews.delete(token);
}
