import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import { freshActor } from "./authority";
import { can, requireCapability, allowedLocationIds } from "./permissions";
import { effectiveInvoiceLocation } from "./received";
import type { DemoInvoice, DemoState } from "./types";

export type InvoiceCapability = Extract<Capability, `invoices.${string}`>;

/** Canonical IDs/location/status are derived here, never copied from form claims. */
export function invoiceAuthorityScope(
  state: DemoState,
  invoiceId: string,
  mutation = false,
  retainedCorrection = false,
): ResourceScope {
  const invoice =
    invoiceId === state.invoice.id
      ? state.invoice
      : (state.invoices ?? []).find((record) => record.id === invoiceId);
  if (!invoice) throw new Error("Invoice was not found.");
  const identity = invoice as DemoInvoice & {
    created_by_user_id?: string;
    handler_user_ids?: readonly string[];
    reviewer_user_ids?: readonly string[];
    reviewer_origin_location_id?: string;
    version?: number;
  };
  const posted = invoice.status === "posted";
  return {
    company_id: invoice.company_id,
    kind: "location_record",
    location_ids: [
      posted ? effectiveInvoiceLocation(state, invoice) : invoice.branch,
    ],
    entity_id: invoice.id,
    status: invoice.status,
    version: identity.version,
    owner_user_id: identity.created_by_user_id,
    handling_user_ids: [
      ...(identity.handler_user_ids ?? []),
      ...(identity.reviewer_user_ids ?? []),
    ],
    invoice_reviewer_origin_location_id: posted
      ? undefined
      : (identity.reviewer_origin_location_id ??
        invoice.handling_branch ??
        invoice.branch),
    mutation,
    location_policy: retainedCorrection
      ? "retained_correction"
      : mutation
        ? "active_only"
        : "retained_read",
  };
}

export function requireInvoiceAuthority(
  state: DemoState,
  actor: AuthenticatedActor,
  capability: InvoiceCapability,
  invoiceId = state.invoice.id,
  mutation = false,
): AuthenticatedActor {
  const correction =
    capability === "invoices.correct" ||
    capability === "invoices.attach_posted_original";
  const scope = invoiceAuthorityScope(state, invoiceId, mutation, correction);
  if (["invoices.short_resolve", "invoices.short_close"].includes(capability))
    delete scope.invoice_reviewer_origin_location_id;
  requireCapability(state, actor, capability, scope);
  return freshActor(state, actor);
}

/** An affordance only; protected commands/queries independently require it again. */
export function canInvoiceAuthority(
  state: DemoState,
  actor: AuthenticatedActor | null,
  capability: InvoiceCapability,
  invoiceId = state.invoice.id,
  mutation = false,
) {
  try {
    const correction =
      capability === "invoices.correct" ||
      capability === "invoices.attach_posted_original";
    const scope = invoiceAuthorityScope(state, invoiceId, mutation, correction);
    if (["invoices.short_resolve", "invoices.short_close"].includes(capability))
      delete scope.invoice_reviewer_origin_location_id;
    return can(state, actor, capability, scope).allowed;
  } catch {
    return false;
  }
}

export function invoiceReceivingLocations(
  state: DemoState,
  actor: AuthenticatedActor,
): readonly string[] {
  const current = freshActor(state, actor);
  return allowedLocationIds(state, current);
}
