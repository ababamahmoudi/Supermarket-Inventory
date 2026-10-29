export type LiveInvoiceReadingPhase =
  "ready" | "processing" | "failed" | "cancelled" | "complete" | "manual";

export interface LiveInvoiceReading {
  phase: LiveInvoiceReadingPhase;
  attempt_id?: string;
  started_at?: string;
  completed_at?: string;
  /** Private command guard, never part of an invoice read DTO or audit export. */
  authority?: {
    origin: "local-reader-v1";
    user_id: string;
    session_id: string;
    authority_epoch: number;
    person_version: number;
    branch: string;
    invoice_version: number;
    original_signature: string;
    content_signature: string;
  };
}
export type LiveInvoiceReadingView = Pick<
  LiveInvoiceReading,
  "phase" | "attempt_id" | "started_at" | "completed_at"
>;

export interface LiveReadingProvenance {
  seconds: number;
  costUSD: string;
  models: string[];
}
