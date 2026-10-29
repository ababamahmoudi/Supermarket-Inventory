import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import { requireInvoiceAuthority } from "./invoice-authority";
import { acknowledgeInvoiceOtherChargeCheck } from "./invoice-checks";
import { recalculateInvoice } from "./invoice";
import { createId } from "./ids";

export type InvoiceChargeField = "description" | "line_total" | "taxable";

/** Charges are draft invoice evidence, with the same fresh receiving authority. */
function changeCharge(
  state: DemoState,
  actor: AuthenticatedActor,
  action: string,
  change: (current: AuthenticatedActor) => void,
): void {
  const current = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    state.invoice.id,
    true,
  );
  if (!["draft", "review"].includes(state.invoice.status))
    throw new Error("Choose a draft invoice.");
  const before = structuredClone(state.invoice);
  change(current);
  recalculateInvoice(state.invoice, state.config);
  state.activity.push({
    id: createId("invoice-charge"),
    company_id: state.invoice.company_id,
    branch: state.invoice.branch,
    action,
    by: current.actor,
    actor_user_id: current.user_id,
    actor_username: current.username,
    actor_role_snapshot: current.role,
    at: new Date().toISOString(),
    reversible: true,
    entity_type: "invoice",
    entity_id: state.invoice.id,
    before,
    after: structuredClone(state.invoice),
  });
}

export function addInvoiceOtherCharge(
  state: DemoState,
  actor: AuthenticatedActor,
): void {
  changeCharge(state, actor, "Add invoice charge or credit", () => {
    state.invoice.other_charges ??= [];
    state.invoice.other_charges.push({
      line_type: "other",
      description: "",
      amount: "",
      taxable: false,
    });
  });
}

export function editInvoiceOtherCharge(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
  field: InvoiceChargeField,
  value: string,
): void {
  changeCharge(state, actor, "Edit invoice charge or credit", (current) => {
    const charge = Number.isSafeInteger(index)
      ? state.invoice.other_charges?.[index]
      : undefined;
    if (!charge || !["description", "line_total", "taxable"].includes(field))
      throw new Error("Choose an invoice charge.");
    if (field === "description") charge.description = value;
    else if (field === "line_total") charge.amount = value;
    else charge.taxable = value === "true";
    acknowledgeInvoiceOtherChargeCheck(state, current, index, field);
  });
}

export function removeInvoiceOtherCharge(
  state: DemoState,
  actor: AuthenticatedActor,
  index: number,
): void {
  changeCharge(state, actor, "Remove invoice charge or credit", () => {
    if (!Number.isSafeInteger(index) || !state.invoice.other_charges?.[index])
      throw new Error("Choose an invoice charge.");
    state.invoice.other_charges.splice(index, 1);
  });
}
