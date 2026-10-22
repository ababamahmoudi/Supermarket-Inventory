/** Protected original-byte service. Source refs never enter public invoice DTOs. */
import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import { freshActor } from "./authority";
import { readStoredFile, type StoredFileRecord } from "./file-database";
import { requireInvoiceAuthority } from "./invoice-authority";
import type { DemoState } from "./types";
export type ProtectedInvoiceQuery = <T>(
  capability: Capability,
  scope: ResourceScope,
  query: (state: DemoState, actor: AuthenticatedActor) => T,
) => Promise<T>;
interface Access {
  invoice_id: string;
  company_id: string;
  reference: string;
  page: number;
  user_id: string;
  session_id: string;
}
const accesses = new WeakMap<object, Access>();
interface OriginalAccess {
  readonly available: true;
  readonly name: string;
  readonly type: string;
  readonly size?: number;
}
function resolveAccess(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
  page = 0,
): OriginalAccess {
  const current = requireInvoiceAuthority(
    state,
    actor,
    "invoices.read",
    invoiceId,
  );
  requireInvoiceAuthority(state, current, "invoices.cost_read", invoiceId);
  const invoice =
    invoiceId === state.invoice.id
      ? state.invoice
      : state.invoices!.find((record) => record.id === invoiceId)!;
  if (!Number.isSafeInteger(page) || page < 0)
    throw new Error("Original page is invalid.");
  const source = invoice.original_pages?.length
    ? invoice.original_pages[page]
    : page === 0
      ? invoice
      : undefined;
  if (!source?.file_data || !source.file_name)
    throw new Error("Original evidence is missing.");
  const handle = Object.freeze({
    available: true as const,
    name: source.file_name,
    type: source.file_type ?? "",
    size: source.file_size,
  });
  accesses.set(handle, {
    invoice_id: invoice.id,
    company_id: invoice.company_id,
    reference: source.file_data,
    page,
    user_id: current.user_id,
    session_id: current.session_id,
  });
  return handle;
}
export async function loadInvoiceOriginal(
  query: ProtectedInvoiceQuery,
  input: { company_id: string; invoice_id: string; page?: number },
): Promise<StoredFileRecord> {
  const scope: ResourceScope = {
    company_id: input.company_id,
    kind: "company_shared",
    entity_id: input.invoice_id,
  };
  const handle = await query("invoices.read", scope, (state, actor) =>
    resolveAccess(state, actor, input.invoice_id, input.page),
  );
  const access = accesses.get(handle);
  if (!access) throw new Error("Original access changed.");
  const file = await readStoredFile(access.reference, access.company_id);
  // Crypto/IDB source reads await outside the authority lock. Recheck canonical
  // permission/relation in a fresh protected query after that await, not against
  // a cached UI actor or the earlier authority snapshot.
  await query("invoices.read", scope, (state, actor) => {
    const current = freshActor(state, actor);
    if (
      current.user_id !== access.user_id ||
      current.session_id !== access.session_id
    )
      throw new Error("Original access changed.");
    const latest = resolveAccess(
        state,
        current,
        access.invoice_id,
        access.page,
      ),
      resolved = accesses.get(latest)!;
    if (
      resolved.company_id !== access.company_id ||
      resolved.reference !== access.reference
    )
      throw new Error("Original evidence changed.");
  });
  accesses.delete(handle);
  return { ...file, name: handle.name };
}

import { storeUploadedFile } from "./file-database";
interface UploadAccess {
  invoice_id: string;
  company_id: string;
  user_id: string;
  session_id: string;
  snapshot: string;
  stored: { reference: string; size: number } | null;
  name: string;
  type: string;
}
const uploads = new WeakMap<object, UploadAccess>();
export interface InvoiceUploadHandle {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}
function uploadSource(state: DemoState, actor: AuthenticatedActor, id: string) {
  const current = requireInvoiceAuthority(state, actor, "invoices.read", id);
  const invoice =
    id === state.invoice.id
      ? state.invoice
      : state.invoices!.find((row) => row.id === id)!;
  requireInvoiceAuthority(
    state,
    current,
    invoice.status === "posted"
      ? "invoices.attach_posted_original"
      : "invoices.edit",
    id,
    true,
  );
  requireInvoiceAuthority(state, current, "invoices.cost_read", id);
  return { current, invoice, snapshot: JSON.stringify(invoice) };
}
/** The storage reference stays private; asynchronous upload rechecks the genuine source and session. */
export async function storeInvoiceUpload(
  query: ProtectedInvoiceQuery,
  file: File,
  input: { company_id: string; invoice_id: string },
): Promise<InvoiceUploadHandle> {
  const scope: ResourceScope = {
    company_id: input.company_id,
    kind: "company_shared",
    entity_id: input.invoice_id,
  };
  const handle = Object.freeze({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  await query("invoices.read", scope, (state, actor) => {
    const source = uploadSource(state, actor, input.invoice_id);
    uploads.set(handle, {
      invoice_id: source.invoice.id,
      company_id: source.invoice.company_id,
      user_id: source.current.user_id,
      session_id: source.current.session_id,
      snapshot: source.snapshot,
      stored: null,
      name: file.name,
      type: file.type,
    });
  });
  const access = uploads.get(handle)!;
  const retained = await storeUploadedFile(file, access.company_id, {
    purpose: "invoice",
  });
  await query("invoices.read", scope, (state, actor) => {
    const source = uploadSource(state, actor, access.invoice_id);
    if (
      source.current.user_id !== access.user_id ||
      source.current.session_id !== access.session_id ||
      source.snapshot !== access.snapshot
    )
      throw new Error("The invoice changed while the original was saving.");
    access.stored = { reference: retained.reference, size: retained.size };
  });
  return handle;
}
/** Called only inside the final fresh command; it never trusts an earlier UI actor. */
export function consumeInvoiceUpload(
  state: DemoState,
  actor: AuthenticatedActor,
  handle: InvoiceUploadHandle,
) {
  const access = uploads.get(handle);
  if (!access?.stored) throw new Error("Original access changed.");
  const source = uploadSource(state, actor, access.invoice_id);
  if (
    source.current.user_id !== access.user_id ||
    source.current.session_id !== access.session_id ||
    source.snapshot !== access.snapshot
  )
    throw new Error("The invoice changed while the original was saving.");
  uploads.delete(handle);
  return {
    file_name: access.name,
    file_type: access.type,
    file_data: access.stored.reference,
    file_size: access.stored.size,
  };
}
