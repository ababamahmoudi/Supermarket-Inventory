import type { AuthenticatedActor } from "./authority-types";
import { requireLiveReadingTarget } from "./invoice-live-reading-state";
import {
  matchReadingSupplier,
  parseInvoiceReadings,
  resolveReadingProductMatch,
  type InvoiceReadingsExport,
} from "./invoice-readings";
import { isUsableLiveReadingItem } from "./live-reading-content";
import type { DemoState } from "./types";

/** Actual, read-only matching work for one currently accepted live attempt.
 * This is deliberately not the Settings-only import preview and returns no costs.
 */
export function inspectLiveInvoiceMatching(
  state: DemoState,
  actor: AuthenticatedActor,
  input: {
    invoice_id: string;
    attempt_id: string;
    exported: InvoiceReadingsExport;
  },
) {
  requireLiveReadingTarget(state, actor, input);
  const exported = parseInvoiceReadings(JSON.stringify(input.exported));
  if (exported.invoices.length !== 1)
    throw new Error("One live reading must describe one invoice.");
  const reading = exported.invoices[0].ai_reading;
  const lines = reading?.lines?.filter(isUsableLiveReadingItem) ?? [];
  if (!reading || !lines.length)
    throw new Error("The live reading contains no usable lines.");
  const supplier = matchReadingSupplier(state, reading);
  const matched = lines.filter((line) =>
    resolveReadingProductMatch(state, supplier, line, actor),
  ).length;
  return { lines: lines.length, matched, new: lines.length - matched };
}
