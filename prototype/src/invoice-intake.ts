import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import { actorAudit } from "./domain-authority";
import { configSeed, demoSeed } from "./config";
import { INCLUDED_COST_INVOICE_SHA256 } from "./file-database";
import { createId } from "./ids";
import {
  createInvoice,
  demoSaleCostInvoice,
  initializeInvoiceManualPriceDecisions,
} from "./invoice";
import { requireInvoiceAuthority } from "./invoice-authority";
import { attachLiveInvoiceOriginals } from "./invoice-live-reading";
import {
  consumeInvoiceUploadBatch,
  storeInvoiceUpload,
  type ProtectedInvoiceQuery,
  type InvoiceUploadHandle,
} from "./invoice-file-access";
import { getLiveReaderSettings } from "./live-reader-settings";
import { sha256Bytes } from "./sha256";
import type { DemoInvoice, DemoState } from "./types";

export class InvoiceSelectionError extends Error {}
export type InvoiceSourceChoice = "photo" | "pdf";
export interface PickedInvoiceFiles {
  source: InvoiceSourceChoice;
  files: readonly File[];
  origin: string;
  /** The native selection still belongs to its mounted route before creation. */
  isCurrent?: () => boolean;
}
export type InvoiceIntakeCommand = <T>(
  capability: Capability,
  scope: ResourceScope,
  operation: (state: DemoState, actor: AuthenticatedActor) => T,
) => Promise<T>;
export function invoiceEntryOrigin(actor: AuthenticatedActor): string {
  return JSON.stringify([
    actor.company_id,
    actor.user_id,
    actor.session_id,
    actor.authority_epoch,
    actor.person_version,
    actor.selection.kind,
    actor.selection.kind === "location" ? actor.selection.location_id : null,
  ]);
}
export function requireInvoiceEntryOrigin(
  actor: AuthenticatedActor,
  origin: string,
): void {
  if (
    invoiceEntryOrigin(actor) !== origin ||
    actor.selection.kind !== "location"
  )
    throw new Error(
      "The person or receiving location changed. Choose the file again.",
    );
}
export function retainInvoiceWorkspace(state: DemoState): void {
  if (
    (state.invoice.status === "empty" && !state.invoice.file_data) ||
    state.invoice.company_id !== state.config.company.seed_key
  )
    return;
  state.invoices ??= [];
  const index = state.invoices.findIndex(
    (invoice) =>
      invoice.id === state.invoice.id &&
      invoice.company_id === state.invoice.company_id,
  );
  if (index < 0) state.invoices.push(structuredClone(state.invoice));
  else state.invoices[index] = structuredClone(state.invoice);
}
export async function validateInvoiceSelection(
  files: readonly File[],
  source: InvoiceSourceChoice,
) {
  if (
    !files.length ||
    files.some((file) => file.size <= 0) ||
    (source === "pdf"
      ? files.length !== 1 || files[0].type !== "application/pdf"
      : files.some((file) => !file.type.startsWith("image/")))
  )
    throw new InvoiceSelectionError("Choose invoice photos or one PDF.");
  const included =
    files.length === 1 &&
    files[0].type === "image/svg+xml" &&
    sha256Bytes(new Uint8Array(await files[0].arrayBuffer())) ===
      INCLUDED_COST_INVOICE_SHA256;
  return {
    included,
    simulatedImages: files.every((file) =>
      /^image\/(png|jpeg|webp|gif)$/.test(file.type),
    ),
  };
}
function publish(state: DemoState, invoice: DemoInvoice): void {
  const index =
    state.invoices?.findIndex(
      (record) =>
        record.id === invoice.id && record.company_id === invoice.company_id,
    ) ?? -1;
  if (index >= 0) state.invoices![index] = structuredClone(invoice);
  else (state.invoices ??= []).push(structuredClone(invoice));
  if (
    state.invoice.id === invoice.id &&
    state.invoice.company_id === invoice.company_id
  )
    state.invoice = invoice;
}

/** The first business write happens only after a valid native selection. */
export async function createPickedInvoice(
  ports: { command: InvoiceIntakeCommand; query: ProtectedInvoiceQuery },
  actor: AuthenticatedActor,
  selected: PickedInvoiceFiles,
  onCreated: (id: string) => void,
): Promise<string> {
  const validation = await validateInvoiceSelection(
    selected.files,
    selected.source,
  );
  if (selected.isCurrent && !selected.isCurrent())
    throw new Error("The invoice entry view changed. Choose the file again.");
  if (actor.selection.kind !== "location")
    throw new Error("Choose one receiving location.");
  const location = actor.selection.location_id;
  const result = await ports.command(
    "invoices.enter",
    {
      company_id: actor.company_id,
      kind: "location_record",
      location_ids: [location],
      mutation: true,
      location_policy: "active_only",
    },
    (state, currentActor) => {
      if (selected.isCurrent && !selected.isCurrent())
        throw new Error(
          "The invoice entry view changed. Choose the file again.",
        );
      requireInvoiceEntryOrigin(currentActor, selected.origin);
      const live =
        getLiveReaderSettings(state.config.receiving).mode === "live";
      if (
        !live &&
        selected.source === "photo" &&
        !validation.simulatedImages &&
        !validation.included
      )
        throw new InvoiceSelectionError(
          "Choose a PNG, JPEG, WebP or GIF photo.",
        );
      const included =
        !live &&
        validation.included &&
        state.config.company.seed_key === configSeed.company.seed_key;
      const existing = included
        ? [state.invoice, ...(state.invoices ?? [])].find(
            (invoice) =>
              invoice.company_id === currentActor.company_id &&
              invoice.id === demoSeed.sales_demo.cost_increase_invoice.id,
          )
        : undefined;
      if (existing)
        requireInvoiceAuthority(
          state,
          currentActor,
          "invoices.cost_read",
          existing.id,
        );
      retainInvoiceWorkspace(state);
      const invoice = existing
        ? structuredClone(existing)
        : included
          ? demoSaleCostInvoice(state, currentActor, location)
          : createInvoice(state, currentActor, location, false, {
              empty: live,
            });
      if (!existing) invoice.receiving_employee = currentActor.actor;
      state.invoice = invoice;
      if (!live && invoice.status !== "posted")
        initializeInvoiceManualPriceDecisions(state, currentActor);
      if (!existing) {
        const now = new Date();
        state.activity.push({
          id: createId("invoice-entry"),
          company_id: currentActor.company_id,
          branch: invoice.branch,
          action: "Create invoice draft",
          by: currentActor.actor,
          ...actorAudit(state, currentActor, now),
          at: now.toISOString(),
          entity_type: "invoice",
          entity_id: invoice.id,
          reversible: false,
          after: {
            invoice_id: invoice.id,
            entry_mode: "upload",
            source: selected.source,
            selected_files: selected.files.length,
          },
        });
      }
      return {
        id: invoice.id,
        company_id: invoice.company_id,
        live,
        posted: invoice.status === "posted",
        retained_original: Boolean(existing?.file_data),
      };
    },
  );
  onCreated(result.id);
  if (result.posted || result.retained_original) return result.id;
  const guardedQuery: ProtectedInvoiceQuery = (capability, scope, project) =>
    ports.query(capability, scope, (state, currentActor) => {
      requireInvoiceEntryOrigin(currentActor, selected.origin);
      return project(state, currentActor);
    });
  const uploads: InvoiceUploadHandle[] = [];
  for (const file of selected.files)
    uploads.push(
      await storeInvoiceUpload(guardedQuery, file, {
        company_id: result.company_id,
        invoice_id: result.id,
      }),
    );
  await ports.command(
    "invoices.edit",
    {
      company_id: result.company_id,
      kind: "company_shared",
      entity_id: result.id,
      mutation: true,
    },
    (state, currentActor) => {
      requireInvoiceEntryOrigin(currentActor, selected.origin);
      if (result.live) {
        attachLiveInvoiceOriginals(state, currentActor, {
          invoice_id: result.id,
          uploads,
        });
        return;
      }
      requireInvoiceAuthority(
        state,
        currentActor,
        "invoices.edit",
        result.id,
        true,
      );
      const invoice =
        state.invoice.id === result.id
          ? state.invoice
          : state.invoices?.find(
              (record) =>
                record.id === result.id &&
                record.company_id === result.company_id,
            );
      if (
        !invoice ||
        invoice.status === "posted" ||
        invoice.status === "cancelled" ||
        invoice.file_data ||
        invoice.live_reading
      )
        throw new Error("The invoice changed while its original was saving.");
      const pages = consumeInvoiceUploadBatch(state, currentActor, uploads);
      Object.assign(invoice, pages[0], {
        original_pages: pages,
        status: invoice.lines.length ? "reading" : "draft",
      });
      publish(state, invoice);
    },
  );
  return result.id;
}
