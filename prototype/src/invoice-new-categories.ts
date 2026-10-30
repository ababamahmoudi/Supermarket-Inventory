import Decimal from "decimal.js";
import { cloneWithAuthority } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { businessFingerprint } from "./business-fingerprint";
import { actorAudit } from "./domain-authority";
import { createId } from "./ids";
import {
  canInvoiceAuthority,
  requireInvoiceAuthority,
} from "./invoice-authority";
import {
  acknowledgeInvoiceCheck,
  fillCalculatedInvoiceTotals,
  setInvoiceLineCategory,
} from "./invoice-checks";
import { invoiceLineId } from "./invoice-line-links";
import { refusedTotals, shortTotals, validMoney } from "./invoice";
import type { Activity, DemoInvoice, DemoState } from "./types";

export interface NewInvoiceCategoriesRead {
  count: number;
  line_ids: string[];
  token: string;
}

const editable = (invoice: DemoInvoice) =>
  ["draft", "review"].includes(invoice.status) &&
  invoice.live_reading?.phase !== "processing";

function invoiceFor(state: DemoState, id: string) {
  return state.invoice.id === id
    ? state.invoice
    : state.invoices?.find((invoice) => invoice.id === id);
}

function newLineIds(invoice: DemoInvoice) {
  return invoice.lines.flatMap((line, index) =>
    line.product_code === "NEW" && line.company_id === invoice.company_id
      ? [invoiceLineId(line, index)]
      : [],
  );
}

function tokenFor(
  state: DemoState,
  actor: AuthenticatedActor,
  invoice: DemoInvoice,
) {
  return businessFingerprint({
    actor: {
      company: actor.company_id,
      user: actor.user_id,
      session: actor.session_id,
      authenticated_at: actor.authenticated_at,
      second_step_verified_at: actor.second_step_verified_at,
      device: actor.device_id,
      role: actor.role,
      epoch: actor.authority_epoch,
      version: actor.person_version,
      selection: actor.selection,
      scope: actor.location_scope,
      locations: actor.allowed_branches,
    },
    invoice,
    // Includes current category/tax/pricing inputs and receiving-location topology.
    config: state.config,
    products: state.products.filter(
      (product) =>
        product.company_id === invoice.company_id &&
        invoice.lines.some((line) => line.product_code === product.code),
    ),
    // Retained History retires an old action even after its values are undone.
    history: state.activity.filter(
      (entry) =>
        entry.company_id === invoice.company_id &&
        entry.entity_id === invoice.id,
    ),
    latest_action: [...state.activity]
      .reverse()
      .find((entry) => entry.company_id === invoice.company_id)?.id,
  });
}

/** The protected workspace exposes only current targets and an opaque action token. */
export function newInvoiceCategoriesRead(
  state: DemoState,
  actor: AuthenticatedActor,
  id = state.invoice.id,
): NewInvoiceCategoriesRead | null {
  if (
    !canInvoiceAuthority(state, actor, "invoices.edit", id, true) ||
    !canInvoiceAuthority(state, actor, "invoices.cost_read", id)
  )
    return null;
  actor = requireInvoiceAuthority(state, actor, "invoices.edit", id, true);
  const invoice = invoiceFor(state, id);
  if (!invoice || !editable(invoice)) return null;
  const ids = newLineIds(invoice);
  const allIds = invoice.lines.map(invoiceLineId);
  if (!ids.length || new Set(allIds).size !== allIds.length) return null;
  return {
    count: ids.length,
    line_ids: ids,
    token: tokenFor(state, actor, invoice),
  };
}

/** One human category choice; first-time checks, original money and prices stay retained. */
export function setNewInvoiceLineCategories(
  state: DemoState,
  actor: AuthenticatedActor,
  input: {
    invoice_id: string;
    expected_token: string;
    line_ids: readonly string[];
    category: string;
  },
  now = new Date(),
): void {
  actor = requireInvoiceAuthority(
    state,
    actor,
    "invoices.edit",
    input.invoice_id,
    true,
  );
  requireInvoiceAuthority(state, actor, "invoices.cost_read", input.invoice_id);
  const current = newInvoiceCategoriesRead(state, actor, input.invoice_id);
  if (
    !current ||
    input.expected_token !== current.token ||
    !Array.isArray(input.line_ids) ||
    input.line_ids.length !== current.count ||
    new Set(input.line_ids).size !== current.count ||
    current.line_ids.some((id) => !input.line_ids.includes(id))
  )
    throw new Error("The new invoice products changed. Review them again.");
  if (
    !state.config.pricing_categories.some(
      (category) => category.key === input.category && !category.archived,
    )
  )
    throw new Error("Choose a current pricing category.");
  const before = structuredClone(invoiceFor(state, input.invoice_id)!);
  const candidate = cloneWithAuthority(state);
  candidate.invoice = structuredClone(before);
  candidate.invoice.lines.forEach((line, index) => {
    if (
      line.product_code !== "NEW" ||
      line.company_id !== candidate.invoice.company_id ||
      !current.line_ids.includes(invoiceLineId(line, index))
    )
      return;
    setInvoiceLineCategory(line, input.category, candidate.config);
    acknowledgeInvoiceCheck(candidate, actor, "pricing_category", index, now);
  });
  const invoice = candidate.invoice;
  if (
    invoice.calculated_fields?.some((field) =>
      ["subtotal", "tax", "final_total"].includes(field),
    )
  ) {
    // The shared helper also completes missing paper amounts. A category choice
    // may refresh existing calculated headers, but cannot answer another question.
    const calculated = structuredClone(invoice);
    fillCalculatedInvoiceTotals(calculated);
    const fields = ["subtotal", "tax", "final_total"] as const;
    for (const field of fields)
      if (invoice.calculated_fields?.includes(field))
        invoice[field] = calculated[field];
    invoice.calculated_fields = invoice.calculated_fields?.filter(
      (field) =>
        !fields.some((header) => header === field) ||
        calculated.calculated_fields?.includes(field),
    );
  }
  invoice.payable_after_open_shorts = new Decimal(
    validMoney(invoice.final_total) ? invoice.final_total : "0",
  )
    .minus(shortTotals(invoice).total)
    .minus(refusedTotals(invoice).total)
    .toFixed(2);
  const activity: Activity = {
    id: createId("invoice-new-categories"),
    company_id: invoice.company_id,
    branch: invoice.branch,
    action: "Set category for new invoice products",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    reversible: true,
    entity_type: "invoice",
    entity_id: invoice.id,
    invoice_category_selection: {
      line_ids: [...current.line_ids],
      count: current.count,
      category: input.category,
    },
    before,
    after: structuredClone(invoice),
  };
  if (state.invoice.id === invoice.id) state.invoice = invoice;
  else {
    const index = state.invoices!.findIndex((row) => row.id === invoice.id);
    state.invoices![index] = invoice;
  }
  state.activity.push(activity);
}
