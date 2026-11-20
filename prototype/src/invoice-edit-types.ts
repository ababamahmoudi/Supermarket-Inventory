import type { InvoiceLine } from "./types";

/** Local input/quantity math needs no private demo pricing justification. */
export type InvoiceEditableLine = Omit<
  InvoiceLine,
  "demo_note" | "receiving_price"
>;
