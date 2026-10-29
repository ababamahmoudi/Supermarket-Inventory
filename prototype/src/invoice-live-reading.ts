import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import { createId } from "./ids";
import { createInvoice } from "./invoice";
import {
  consumeInvoiceUploadBatch,
  type InvoiceUploadHandle,
} from "./invoice-file-access";
import {
  importLiveInvoiceReading,
  type InvoiceReadingsExport,
} from "./invoice-readings";
import {
  liveContentSignature,
  liveOriginalPages,
  liveOriginalSignature,
  requireLiveInvoice,
  requireLiveRecoveryTransition,
  requireLiveReadingTarget,
} from "./invoice-live-reading-state";
import type { LiveReadingProvenance } from "./invoice-live-reading-types";
import type { DemoInvoice, DemoState } from "./types";
export { canUseLiveManualInvoice } from "./invoice-live-reading-state";

function publish(state: DemoState, invoice: DemoInvoice) {
  const index =
    state.invoices?.findIndex(
      (item) =>
        item.id === invoice.id && item.company_id === invoice.company_id,
    ) ?? -1;
  if (index >= 0) state.invoices![index] = structuredClone(invoice);
  else (state.invoices ??= []).push(structuredClone(invoice));
  if (
    state.invoice.id === invoice.id &&
    state.invoice.company_id === invoice.company_id
  )
    state.invoice = invoice;
}

function identity(invoice: DemoInvoice) {
  return {
    id: invoice.id,
    company_id: invoice.company_id,
    branch: invoice.branch,
    handling_branch: invoice.handling_branch,
    reviewer_origin_location_id: invoice.reviewer_origin_location_id,
    created_by_user_id: invoice.created_by_user_id,
    handler_user_ids: invoice.handler_user_ids,
    reviewer_user_ids: invoice.reviewer_user_ids,
    version: invoice.version,
    received_at: invoice.received_at,
    receiving_employee: invoice.receiving_employee,
  };
}

function captureAuthority(invoice: DemoInvoice, actor: AuthenticatedActor) {
  return {
    origin: "local-reader-v1" as const,
    user_id: actor.user_id,
    session_id: actor.session_id,
    authority_epoch: actor.authority_epoch,
    person_version: actor.person_version,
    branch: invoice.branch,
    invoice_version: invoice.version ?? 1,
    original_signature: liveOriginalSignature(invoice),
    content_signature: liveContentSignature(invoice),
  };
}

export function attachLiveInvoiceOriginals(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { invoice_id: string; uploads: InvoiceUploadHandle[] },
) {
  const current = requireLiveInvoice(state, actor, input.invoice_id);
  if (
    !input.uploads.length ||
    current.invoice.live_reading?.phase === "processing" ||
    current.invoice.status === "review" ||
    (current.invoice.file_data && !current.invoice.live_reading) ||
    (input.uploads.length > 1 &&
      input.uploads.some((file) => file.type === "application/pdf"))
  )
    throw new Error("Choose originals for a new live reading draft.");
  // Consume all handles before replacing any source snapshot.
  const originals = consumeInvoiceUploadBatch(
    state,
    current.actor,
    input.uploads,
  );
  const invoice = createInvoice(
    state,
    current.actor,
    current.invoice.branch,
    false,
    { empty: true },
  );
  Object.assign(invoice, identity(current.invoice), originals[0], {
    original_pages: originals,
    invoice_date: "",
    due_date: "",
    status: "reading",
    live_reading: { phase: "ready", attempt_id: createId("live-original") },
  });
  invoice.live_reading!.authority = captureAuthority(invoice, current.actor);
  publish(state, invoice);
  return {
    invoice_id: invoice.id,
    original_sha256s: originals.map((page) => page.original_sha256),
  };
}

export function reorderLiveInvoiceOriginals(
  state: DemoState,
  actor: AuthenticatedActor,
  input: { invoice_id: string; order: number[] },
) {
  const { invoice, actor: currentActor } = requireLiveInvoice(
    state,
    actor,
    input.invoice_id,
  );
  requireLiveRecoveryTransition(state, actor, {
    invoice_id: input.invoice_id,
    attempt_id: invoice.live_reading?.attempt_id ?? "",
  });
  const pages = liveOriginalPages(invoice);
  if (
    !["ready", "failed", "cancelled"].includes(
      invoice.live_reading?.phase ?? "",
    ) ||
    input.order.length !== pages.length ||
    new Set(input.order).size !== pages.length ||
    input.order.some((index) => !Number.isSafeInteger(index) || !pages[index])
  )
    throw new Error("Choose each saved page once.");
  if (input.order.every((index, position) => index === position)) return;
  const ordered = input.order.map((index) => structuredClone(pages[index]));
  invoice.original_pages = ordered;
  Object.assign(invoice, ordered[0]);
  invoice.version = (invoice.version ?? 1) + 1;
  invoice.live_reading!.authority = captureAuthority(invoice, currentActor);
  publish(state, invoice);
}

export function beginLiveInvoiceReading(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  now = new Date(),
) {
  const current = requireLiveInvoice(state, actor, id);
  const { invoice } = current;
  if (
    !["ready", "processing", "failed", "cancelled"].includes(
      invoice.live_reading?.phase ?? "",
    ) ||
    invoice.live_reading?.authority?.origin !== "local-reader-v1" ||
    invoice.live_reading.authority.branch !== invoice.branch ||
    invoice.live_reading.authority.original_signature !==
      liveOriginalSignature(invoice)
  )
    throw new Error("This live reading draft is not ready to read.");
  const pages = liveOriginalPages(invoice);
  invoice.status = "reading";
  const attempt = {
    invoice_id: id,
    attempt_id: createId("live-reading"),
    branch: invoice.branch,
    started_at: now.toISOString(),
    original_sha256s: pages.map((page) => page.original_sha256),
  };
  invoice.live_reading = {
    phase: "processing",
    attempt_id: attempt.attempt_id,
    started_at: attempt.started_at,
    authority: captureAuthority(invoice, current.actor),
  };
  publish(state, invoice);
  return attempt;
}

export function settleLiveInvoiceReading(
  state: DemoState,
  actor: AuthenticatedActor,
  input: {
    invoice_id: string;
    attempt_id: string;
    outcome: "failed" | "cancelled" | "manual";
  },
  now = new Date(),
) {
  const { invoice } =
    input.outcome === "manual"
      ? requireLiveRecoveryTransition(state, actor, input)
      : requireLiveReadingTarget(state, actor, input, "settle");
  if (
    input.outcome !== "manual" &&
    !["ready", "processing"].includes(invoice.live_reading!.phase)
  )
    throw new Error("The reading attempt has already finished.");
  invoice.live_reading!.phase = input.outcome;
  invoice.live_reading!.completed_at = now.toISOString();
  if (input.outcome === "manual") {
    invoice.status = "review";
    invoice.entry_mode = "manual";
    invoice.lines = [];
    delete invoice.reading_record;
  } else invoice.status = "reading";
  publish(state, invoice);
}

export function applyLiveInvoiceReading(
  state: DemoState,
  actor: AuthenticatedActor,
  input: {
    invoice_id: string;
    attempt_id: string;
    exported: InvoiceReadingsExport;
    provenance: LiveReadingProvenance;
  },
  now = new Date(),
) {
  requireLiveReadingTarget(state, actor, input);
  const cost = new Decimal(input.provenance.costUSD);
  if (
    !cost.isFinite() ||
    cost.isNegative() ||
    !Number.isFinite(input.provenance.seconds) ||
    input.provenance.seconds < 0 ||
    !Array.isArray(input.provenance.models) ||
    input.provenance.models.some((model) => typeof model !== "string")
  )
    throw new Error("The reading provenance is invalid.");
  return importLiveInvoiceReading(
    state,
    actor,
    {
      ...input,
      provenance: { ...input.provenance, costUSD: cost.toFixed(4) },
    },
    now,
  );
}

export function useSimulatedLiveInvoiceReading(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
) {
  const current = requireLiveInvoice(state, actor, id);
  requireLiveRecoveryTransition(state, actor, {
    invoice_id: id,
    attempt_id: current.invoice.live_reading?.attempt_id ?? "",
  });
  if (!current.invoice.live_reading || current.invoice.status === "review")
    throw new Error("The live reading draft changed.");
  const pages = structuredClone(liveOriginalPages(current.invoice));
  const invoice = createInvoice(state, current.actor, current.invoice.branch);
  Object.assign(invoice, identity(current.invoice), pages[0], {
    original_pages: pages,
    status: "reading",
    simulated_reading: true,
  });
  delete invoice.live_reading;
  delete invoice.reading_record;
  publish(state, invoice);
}
