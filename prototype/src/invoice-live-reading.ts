import Decimal from "decimal.js";
import { LIVE_READER_MAX_PDF_PAGES } from "./live-reader-limits";
import type { AuthenticatedActor } from "./authority-types";
import { createId } from "./ids";
import { actorAudit } from "./domain-authority";
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
  requireLiveSourceTarget,
  type LiveSourceTarget,
} from "./invoice-live-reading-state";
import type {
  LiveReadingModelDetail,
  LiveReadingProvenance,
} from "./invoice-live-reading-types";
import type { DemoInvoice, DemoState } from "./types";
import {
  verifyLivePdfPages,
  type LivePdfPagesAccess,
} from "./invoice-live-pdf-pages";
import { retainedInvoiceOriginalPages } from "./invoice-original-pages";
export { canUseLiveManualInvoice } from "./invoice-live-reading-state";
export type { LiveSourceTarget } from "./invoice-live-reading-state";

function normalizeModelDetails(
  value: LiveReadingProvenance["modelDetails"],
): LiveReadingModelDetail[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value))
    throw new Error("The reading provenance is invalid.");
  return value.map((model) => {
    if (
      !model ||
      typeof model !== "object" ||
      typeof model.id !== "string" ||
      !model.id.trim() ||
      (model.ok !== undefined && typeof model.ok !== "boolean") ||
      (model.seconds !== undefined &&
        (typeof model.seconds !== "number" ||
          !Number.isFinite(model.seconds) ||
          model.seconds < 0))
    )
      throw new Error("The reading provenance is invalid.");
    const detail: LiveReadingModelDetail = { id: model.id.trim() };
    if (model.ok !== undefined) detail.ok = model.ok;
    if (model.seconds !== undefined) detail.seconds = model.seconds;
    if (model.costUSD !== undefined) {
      if (
        typeof model.costUSD !== "string" ||
        !/^\d+(?:\.\d+)?$/.test(model.costUSD)
      )
        throw new Error("The reading provenance is invalid.");
      const cost = new Decimal(model.costUSD);
      if (!cost.isFinite() || cost.isNegative())
        throw new Error("The reading provenance is invalid.");
      detail.costUSD = cost.toFixed();
    }
    return detail;
  });
}

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
    retainedInvoiceOriginalPages(current.invoice).length > 0 ||
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

function unchangedSource(invoice: DemoInvoice) {
  return {
    invoice_id: invoice.id,
    retired_attempt_id: "",
    version: invoice.version ?? 1,
  };
}

function changedSource(
  state: DemoState,
  actor: AuthenticatedActor,
  invoice: DemoInvoice,
  change: "add" | "remove" | "reorder" | "pdf",
  before: { source_pages: number; selected_pdf_pages?: number },
  now: Date,
) {
  const retired = invoice.live_reading!.attempt_id!;
  const originals = retainedInvoiceOriginalPages(invoice);
  if (originals[0]) Object.assign(invoice, originals[0]);
  invoice.version = (invoice.version ?? 1) + 1;
  invoice.live_reading = {
    phase: "ready",
    attempt_id: createId("live-source"),
  };
  invoice.live_reading.authority = captureAuthority(invoice, actor);
  publish(state, invoice);
  state.activity.push({
    id: createId("invoice-pages"),
    company_id: invoice.company_id,
    branch: invoice.branch,
    action: "Invoice pages changed",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    entity_type: "invoice",
    entity_id: invoice.id,
    reversible: false,
    before,
    after: {
      change,
      source_pages: liveOriginalPages(invoice).length,
      ...(invoice.pdf_page_selection !== undefined
        ? { selected_pdf_pages: invoice.pdf_page_selection.length }
        : {}),
    },
  });
  return {
    invoice_id: invoice.id,
    retired_attempt_id: retired,
    version: invoice.version,
  };
}

export function addLiveInvoicePages(
  state: DemoState,
  actor: AuthenticatedActor,
  input: LiveSourceTarget & { uploads: InvoiceUploadHandle[] },
  now = new Date(),
) {
  const current = requireLiveSourceTarget(state, actor, input);
  const invoice = current.invoice;
  const active = liveOriginalPages(invoice);
  if (
    !Array.isArray(input.uploads) ||
    !input.uploads.length ||
    input.uploads.some(
      (upload) =>
        !upload ||
        upload.size <= 0 ||
        !/^image\/(png|jpeg|webp|gif)$/.test(upload.type),
    ) ||
    retainedInvoiceOriginalPages(invoice).some(
      (page) => page.file_type === "application/pdf",
    )
  )
    throw new Error("Add photos to a saved photo invoice.");
  // The batch is fully validated before even its first opaque handle is consumed.
  const added = consumeInvoiceUploadBatch(state, current.actor, input.uploads);
  invoice.original_pages = [
    ...active.map((page) => structuredClone(page)),
    ...added,
  ];
  return changedSource(
    state,
    current.actor,
    invoice,
    "add",
    { source_pages: active.length },
    now,
  );
}

export function removeLiveInvoicePage(
  state: DemoState,
  actor: AuthenticatedActor,
  input: LiveSourceTarget & { index: number },
  now = new Date(),
) {
  const current = requireLiveSourceTarget(state, actor, input);
  const invoice = current.invoice;
  const active = liveOriginalPages(invoice);
  if (
    active.some((page) => page.file_type === "application/pdf") ||
    !Number.isSafeInteger(input.index) ||
    input.index < 0 ||
    !active[input.index]
  )
    throw new Error(
      "Choose a saved photo page. PDF changes need its verified page count.",
    );
  invoice.retained_original_pages = [
    ...(invoice.retained_original_pages ?? []),
    structuredClone(active[input.index]),
  ];
  invoice.original_pages = active
    .filter((_, index) => index !== input.index)
    .map((page) => structuredClone(page));
  return changedSource(
    state,
    current.actor,
    invoice,
    "remove",
    { source_pages: active.length },
    now,
  );
}

export function selectLiveInvoicePdfPages(
  state: DemoState,
  actor: AuthenticatedActor,
  input: LiveSourceTarget & { selection: number[]; access: LivePdfPagesAccess },
  now = new Date(),
) {
  const current = requireLiveSourceTarget(state, actor, input);
  const invoice = current.invoice;
  const active = liveOriginalPages(invoice);
  const count = verifyLivePdfPages(
    state,
    current.actor,
    invoice.id,
    input.access,
  );
  if (
    active.length !== 1 ||
    active[0].file_type !== "application/pdf" ||
    count > LIVE_READER_MAX_PDF_PAGES ||
    !Array.isArray(input.selection) ||
    new Set(input.selection).size !== input.selection.length ||
    input.selection.some(
      (page) => !Number.isSafeInteger(page) || page < 1 || page > count,
    )
  )
    throw new Error("Choose saved PDF pages within the reader limit.");
  const previous =
    invoice.pdf_page_selection ??
    Array.from({ length: count }, (_, index) => index + 1);
  if (
    previous.length === input.selection.length &&
    previous.every((page, index) => page === input.selection[index])
  )
    return unchangedSource(invoice);
  invoice.pdf_page_selection = [...input.selection];
  return changedSource(
    state,
    current.actor,
    invoice,
    "pdf",
    { source_pages: 1, selected_pdf_pages: previous.length },
    now,
  );
}

export function reorderLiveInvoiceOriginals(
  state: DemoState,
  actor: AuthenticatedActor,
  input: LiveSourceTarget & { order: number[] },
  now = new Date(),
) {
  const current = requireLiveSourceTarget(state, actor, input);
  const invoice = current.invoice;
  const pages = liveOriginalPages(invoice);
  if (
    !pages.length ||
    !Array.isArray(input.order) ||
    input.order.length !== pages.length ||
    new Set(input.order).size !== pages.length ||
    input.order.some((index) => !Number.isSafeInteger(index) || !pages[index])
  )
    throw new Error("Choose each saved page once.");
  if (input.order.every((index, position) => index === position))
    return unchangedSource(invoice);
  invoice.original_pages = input.order.map((index) =>
    structuredClone(pages[index]),
  );
  return changedSource(
    state,
    current.actor,
    invoice,
    "reorder",
    { source_pages: pages.length },
    now,
  );
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
  if (!pages.length || invoice.pdf_page_selection?.length === 0)
    throw new Error("Choose at least one saved page before reading.");
  invoice.status = "reading";
  const attempt = {
    invoice_id: id,
    attempt_id: createId("live-reading"),
    branch: invoice.branch,
    started_at: now.toISOString(),
    original_sha256s: pages.map((page) => page.original_sha256),
    ...(invoice.pdf_page_selection !== undefined
      ? { pdf_pages: [...invoice.pdf_page_selection] }
      : {}),
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
  const modelDetails = normalizeModelDetails(input.provenance.modelDetails);
  return importLiveInvoiceReading(
    state,
    actor,
    {
      ...input,
      provenance: {
        ...input.provenance,
        costUSD: cost.toFixed(4),
        ...(modelDetails ? { modelDetails } : {}),
      },
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
  if (!pages.length || current.invoice.pdf_page_selection?.length === 0)
    throw new Error("Choose at least one saved page before reading.");
  const invoice = createInvoice(state, current.actor, current.invoice.branch);
  Object.assign(invoice, identity(current.invoice), pages[0], {
    original_pages: pages,
    status: "reading",
    simulated_reading: true,
    ...(current.invoice.retained_original_pages
      ? {
          retained_original_pages: structuredClone(
            current.invoice.retained_original_pages,
          ),
        }
      : {}),
    ...(current.invoice.pdf_page_selection !== undefined
      ? { pdf_page_selection: [...current.invoice.pdf_page_selection] }
      : {}),
  });
  delete invoice.live_reading;
  delete invoice.reading_record;
  publish(state, invoice);
}
