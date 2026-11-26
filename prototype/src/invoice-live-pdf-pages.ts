import type { AuthenticatedActor } from "./authority-types";
import { requireInvoiceAuthority } from "./invoice-authority";
import {
  liveOriginalPages,
  liveOriginalSignature,
  liveReadingInvoice,
  canEditLiveInvoiceSources,
} from "./invoice-live-reading-state";
import {
  loadInvoiceOriginal,
  type ProtectedInvoiceQuery,
} from "./invoice-file-access";
import type { DemoState } from "./types";

export interface LivePdfPagesAccess {
  readonly pages: number;
}
interface PdfSourceWitness {
  company: string;
  invoice: string;
  user: string;
  session: string;
  epoch: number;
  person_version: number;
  snapshot: string;
}
const witnesses = new WeakMap<object, PdfSourceWitness>();

function source(state: DemoState, actor: AuthenticatedActor, id: string) {
  const current = requireInvoiceAuthority(state, actor, "invoices.read", id);
  requireInvoiceAuthority(state, current, "invoices.cost_read", id);
  return { actor: current, invoice: liveReadingInvoice(state, id) };
}

/** Safe counts/selection only; original references stay on the canonical side. */
export function readLiveOriginalSelection(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
) {
  const current = source(state, actor, id);
  const pages = liveOriginalPages(current.invoice);
  const selected = current.invoice.pdf_page_selection;
  if (
    selected !== undefined &&
    (!Array.isArray(selected) ||
      new Set(selected).size !== selected.length ||
      selected.some((page) => !Number.isSafeInteger(page) || page < 1) ||
      pages.length !== 1 ||
      pages[0].file_type !== "application/pdf")
  )
    throw new Error("The saved PDF selection is invalid.");
  return {
    count: pages.length,
    editable: canEditLiveInvoiceSources(state, current.actor, id),
    pdf: pages.length === 1 && pages[0].file_type === "application/pdf",
    selected: selected === undefined ? null : [...selected],
  };
}

export function loadLiveOriginalSelection(
  query: ProtectedInvoiceQuery,
  input: { company_id: string; invoice_id: string },
) {
  return query(
    "invoices.read",
    {
      company_id: input.company_id,
      kind: "company_shared",
      entity_id: input.invoice_id,
    },
    (state, actor) => readLiveOriginalSelection(state, actor, input.invoice_id),
  );
}

/** A page-count witness is produced only by decoding this exact protected PDF. */
export async function inspectLivePdfPages(
  query: ProtectedInvoiceQuery,
  input: { company_id: string; invoice_id: string },
  signal?: AbortSignal,
): Promise<LivePdfPagesAccess> {
  const scope = {
    company_id: input.company_id,
    kind: "company_shared" as const,
    entity_id: input.invoice_id,
  };
  const captured: { value?: PdfSourceWitness } = {};
  await query("invoices.read", scope, (state, actor) => {
    const current = source(state, actor, input.invoice_id);
    const pages = liveOriginalPages(current.invoice);
    if (pages.length !== 1 || pages[0].file_type !== "application/pdf")
      throw new Error("Choose the saved PDF.");
    captured.value = {
      company: current.actor.company_id,
      invoice: current.invoice.id,
      user: current.actor.user_id,
      session: current.actor.session_id,
      epoch: current.actor.authority_epoch,
      person_version: current.actor.person_version,
      snapshot: JSON.stringify(current.invoice),
    };
  });
  const before = captured.value;
  if (!before) throw new Error("The saved PDF changed.");
  const original = await loadInvoiceOriginal(query, {
    ...input,
    purpose: "reading",
  });
  // Platform decoding is loaded only for the protected async inspection, never
  // merely by importing the synchronous domain witness verifier.
  const { livePdfPageCount } = await import("./invoice-live-images");
  const count = await livePdfPageCount(
    new File([original.source], original.name, { type: original.type }),
    signal,
  );
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const access = Object.freeze({ pages: count });
  await query("invoices.read", scope, (state, actor) => {
    const current = source(state, actor, input.invoice_id);
    if (
      current.actor.company_id !== before.company ||
      current.actor.user_id !== before.user ||
      current.actor.session_id !== before.session ||
      current.actor.authority_epoch !== before.epoch ||
      current.actor.person_version !== before.person_version ||
      JSON.stringify(current.invoice) !== before.snapshot
    )
      throw new Error("The saved PDF changed.");
    witnesses.set(access, before);
  });
  return access;
}

export function verifyLivePdfPages(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  access: LivePdfPagesAccess,
): number {
  const current = source(state, actor, id);
  const witness = witnesses.get(access);
  if (
    !witness ||
    witness.company !== current.actor.company_id ||
    witness.invoice !== id ||
    witness.user !== current.actor.user_id ||
    witness.session !== current.actor.session_id ||
    witness.epoch !== current.actor.authority_epoch ||
    witness.person_version !== current.actor.person_version ||
    witness.snapshot !== JSON.stringify(current.invoice) ||
    !liveOriginalSignature(current.invoice)
  )
    throw new Error("The saved PDF changed. Open it again.");
  return access.pages;
}
