import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import { requireCapability } from "./permissions";
import {
  invoiceAuthorityScope,
  requireInvoiceAuthority,
} from "./invoice-authority";
import {
  requirePurchase,
  purchaseLocationAllowed,
  purchaseLocationScope,
} from "./purchase-authority";
import { effectiveInvoiceVersion } from "./invoice-version";
import { weightQuantityFromLb } from "./weighed";
import { clearInvoiceOrder } from "./invoice-orders";
import { companyDate } from "./invoice";
import { branchId, configuredBranches } from "./settings";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import { createId } from "./ids";
import { invoiceLineId } from "./invoice-line-links";
import type { OperationalLedger, OperationalReturn } from "./operations";
import type {
  Approval,
  Branch,
  DemoInvoice,
  DemoState,
  ExpiryRecord,
} from "./types";

export interface InvoiceLocationCorrection {
  id: string;
  company_id: string;
  invoice_id: string;
  from_branch: Branch;
  to_branch: Branch;
  reason: string;
  by: string;
  at: string;
  device?: string;
  prior_correction_id?: string;
  outstanding_amount: string;
  currency: string;
  allocations: { ledger_id: string; branch: Branch; amount: string }[];
  receipt_ids: string[];
  approval_ids: string[];
  ledger_out_id: string;
  ledger_in_id: string;
}

export interface DeliveryReceipt {
  id: string;
  invoice_id: string;
  line_index: number;
  line_id?: string;
  company_id: string;
  branch: Branch;
  product_code: string;
  supplier: string;
  invoice_number: string;
  date: string;
  received_at?: string;
  received_by: string;
  units: number;
  units_per_case: number;
  cases: string;
  kind: "invoice" | "short_delivery" | "replacement";
  return_id?: string;
  sold_by?: "each" | "weight";
  source_quantity?: string;
  source_quantity_unit?: "kg" | "lb";
  case_weight?: string;
  case_weight_unit?: "kg" | "lb";
}

export interface ReceivedFilters {
  from?: string;
  to?: string;
  location?: Branch;
  supplier?: string;
  product?: string;
  search?: string;
}

/** Pure location projection consumes only already-permitted identity metadata. */
export type InvoiceLocationIdentity = Pick<
  DemoInvoice,
  | "id"
  | "company_id"
  | "branch"
  | "status"
  | "posted_at"
  | "supplier_invoice_number"
>;
export interface InvoiceLocationReadState {
  readonly invoice: InvoiceLocationIdentity | null;
  readonly invoices?: readonly InvoiceLocationIdentity[];
  readonly invoice_location_corrections?: readonly Pick<
    InvoiceLocationCorrection,
    "company_id" | "invoice_id" | "from_branch" | "to_branch"
  >[];
}

/** Resolve an append-only chain without changing the posted document. */
export function effectiveInvoiceLocation(
  state: InvoiceLocationReadState,
  invoice: InvoiceLocationIdentity,
): Branch {
  if (invoice.status !== "posted") return invoice.branch;
  const original =
    state.invoices?.find(
      (record) =>
        record.company_id === invoice.company_id &&
        record.id === invoice.id &&
        record.status === "posted",
    ) ??
    (state.invoice?.id === invoice.id &&
    state.invoice.company_id === invoice.company_id &&
    state.invoice.status === "posted"
      ? state.invoice
      : invoice);
  let location = original.branch;
  for (const correction of state.invoice_location_corrections ?? []) {
    if (
      correction.company_id === invoice.company_id &&
      correction.invoice_id === invoice.id &&
      correction.from_branch === location
    )
      location = correction.to_branch;
  }
  return location;
}

/** A merged proposal follows its latest cost-basis source, not older evidence. */
export function effectiveApprovalLocation(
  state: InvoiceLocationReadState,
  approval: Pick<
    Approval,
    | "status"
    | "branch"
    | "company_id"
    | "source_invoice_id"
    | "invoice_ids"
    | "invoice_number"
  >,
): Branch {
  if (approval.status !== "pending") return approval.branch;
  const sources = [
    ...(state.invoices ?? []),
    ...(state.invoice ? [state.invoice] : []),
  ].filter(
    (invoice) =>
      invoice.company_id === approval.company_id &&
      invoice.status === "posted" &&
      (invoice.id === approval.source_invoice_id ||
        approval.invoice_ids?.includes(invoice.id)),
  );
  const source =
    sources.find((invoice) => invoice.id === approval.source_invoice_id) ??
    sources
      .filter(
        (invoice) =>
          invoice.supplier_invoice_number === approval.invoice_number,
      )
      .sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""))[0];
  return source ? effectiveInvoiceLocation(state, source) : approval.branch;
}

export function projectInvoiceLocation<I extends InvoiceLocationIdentity>(
  state: InvoiceLocationReadState,
  invoice: I,
): I {
  const branch = effectiveInvoiceLocation(state, invoice);
  return branch === invoice.branch ? invoice : { ...invoice, branch };
}

function postedInvoices(state: DemoState): DemoInvoice[] {
  const unique = new Map(
    [...(state.invoices ?? []), state.invoice]
      .filter((invoice) => invoice.status === "posted")
      .map((invoice) => [`${invoice.company_id}:${invoice.id}`, invoice]),
  );
  return [...unique.values()];
}

export function effectiveExpiryLocation(
  state: DemoState,
  entry: ExpiryRecord,
): Branch {
  if (!entry.invoice_id) return entry.branch;
  const invoice = postedInvoices(state).find(
    (invoice) =>
      invoice.id === entry.invoice_id &&
      invoice.company_id === entry.company_id,
  );
  return invoice ? effectiveInvoiceLocation(state, invoice) : entry.branch;
}

export function projectExpiryLocation(
  state: DemoState,
  entry: ExpiryRecord,
): ExpiryRecord {
  const branch = effectiveExpiryLocation(state, entry);
  return branch === entry.branch ? entry : { ...entry, branch };
}

function dateInCompany(state: DemoState, value?: string): string {
  if (!value) return "";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(parsed.getTime())
    ? companyDate(state.config, parsed)
    : "";
}

/** Actual receipts only: an order or an unposted invoice is never a delivery. */
export function receivedLog(
  state: DemoState,
  context: AuthenticatedActor,
  filters: ReceivedFilters = {},
): DeliveryReceipt[] {
  context = requirePurchase(state, context, "received.read");
  const receipts: DeliveryReceipt[] = [];
  const add = (
    invoice: DemoInvoice,
    lineIndex: number,
    units: number,
    id: string,
    at: string | undefined,
    receivedBy: string,
    kind: DeliveryReceipt["kind"],
  ) => {
    const line = invoice.lines[lineIndex];
    if (
      !line ||
      line.company_id !== context.company_id ||
      (line.sold_by === "weight"
        ? !Number.isFinite(units)
        : !Number.isSafeInteger(units)) ||
      units <= 0
    )
      return;
    const pack =
      Number.isSafeInteger(line.units_per_case) &&
      (line.units_per_case ?? 0) > 0
        ? line.units_per_case!
        : 1;
    receipts.push({
      id,
      invoice_id: invoice.id,
      line_index: lineIndex,
      line_id: invoiceLineId(line, lineIndex),
      company_id: invoice.company_id,
      branch: effectiveInvoiceLocation(state, invoice),
      product_code: line.product_code,
      supplier: invoice.supplier,
      invoice_number: invoice.supplier_invoice_number,
      date: dateInCompany(state, at),
      received_at: at,
      received_by: receivedBy,
      units,
      units_per_case: pack,
      cases: new Decimal(units).div(pack).toDecimalPlaces(4).toString(),
      kind,
      sold_by: line.sold_by ?? "each",
      source_quantity:
        line.sold_by === "weight"
          ? new Decimal(
              weightQuantityFromLb(
                units,
                line.source_quantity_unit ?? "lb",
                line.weight_conversion_factor ?? state.config,
              ),
            )
              .toDecimalPlaces(3)
              .toString()
          : undefined,
      source_quantity_unit: line.source_quantity_unit,
      case_weight: line.case_weight,
      case_weight_unit: line.case_weight_unit,
    });
  };
  for (const original of postedInvoices(state)) {
    if (
      !purchaseLocationAllowed(
        state,
        context,
        "received.read",
        original.company_id,
        effectiveInvoiceLocation(state, original),
      )
    )
      continue;
    const invoice = effectiveInvoiceVersion(state, original);
    invoice.lines.forEach((line, index) => {
      add(
        invoice,
        index,
        new Decimal(line.qty_received_at_posting)
          .minus(line.refused_units ?? 0)
          .toNumber(),
        `${invoice.id}:received:${index}`,
        invoice.received_at ?? invoice.invoice_date ?? invoice.posted_at,
        invoice.receiving_employee ?? "",
        "invoice",
      );
      const later = (state.stock_movements ?? []).filter(
        (movement) =>
          movement.company_id === context.company_id &&
          movement.type === "short_resolved_received" &&
          (movement.invoice_id === invoice.id ||
            movement.id.startsWith(`${invoice.id}:delivery:`)) &&
          (movement.line_index !== undefined
            ? movement.line_index === index
            : movement.product_code === line.product_code &&
              invoice.lines.findIndex(
                (entry) => entry.product_code === line.product_code,
              ) === index),
      );
      for (const movement of later)
        add(
          invoice,
          index,
          movement.qty,
          movement.id,
          movement.at,
          movement.by,
          "short_delivery",
        );
    });
  }
  // Replacement receipts are deliveries with return evidence, never fake invoices.
  for (const movement of state.stock_movements ?? []) {
    if (
      !purchaseLocationAllowed(
        state,
        context,
        "received.read",
        movement.company_id,
        movement.branch,
      ) ||
      !["replacement", "replacement_received"].includes(movement.type) ||
      !Number.isSafeInteger(movement.qty) ||
      movement.qty <= 0
    )
      continue;
    const record = (state.returns as OperationalReturn[]).find(
      (record) =>
        record.company_id === context.company_id &&
        record.branch === movement.branch &&
        (record.id === movement.reference ||
          record.evidence?.some(
            (event) =>
              event.kind === "replacement" &&
              event.document === movement.reference,
          )),
    );
    if (!record) continue;
    const evidence = record.evidence?.find(
      (event) =>
        event.kind === "replacement" && event.document === movement.reference,
    );
    const linked = postedInvoices(state).find(
      (invoice) =>
        invoice.company_id === context.company_id &&
        invoice.id === record.linked_invoice,
    );
    receipts.push({
      id: movement.id,
      company_id: movement.company_id,
      branch: movement.branch,
      product_code: movement.product_code,
      supplier: record.supplier,
      invoice_id: linked?.id ?? "",
      invoice_number: linked?.supplier_invoice_number ?? "",
      line_index: 0,
      date: dateInCompany(state, evidence?.received_date ?? movement.at),
      received_by: evidence?.by ?? movement.by,
      units: movement.qty,
      units_per_case: 1,
      cases: String(movement.qty),
      kind: "replacement",
      return_id: record.id,
    });
  }
  const registry = supplierRecords(state);
  return receipts
    .filter((receipt) => {
      if (
        !purchaseLocationAllowed(
          state,
          context,
          "received.read",
          receipt.company_id,
          receipt.branch,
        )
      )
        return false;
      if (
        filters.location &&
        filters.location !== "all" &&
        receipt.branch !== filters.location
      )
        return false;
      const supplier = registry.find(
        (record) =>
          record.company_id === context.company_id &&
          supplierMatches(record, receipt.supplier),
      );
      if (
        filters.supplier &&
        filters.supplier !== "all" &&
        !(supplier
          ? supplierMatches(supplier, filters.supplier)
          : receipt.supplier === filters.supplier)
      )
        return false;
      if (
        filters.product &&
        filters.product !== "all" &&
        receipt.product_code !== filters.product
      )
        return false;
      if (filters.from && receipt.date < filters.from) return false;
      if (filters.to && receipt.date > filters.to) return false;
      const product = state.products.find(
        (item) =>
          item.company_id === context.company_id &&
          item.code === receipt.product_code,
      );
      const location = state.config.branches.find(
        (item, index) => branchId(item, index) === receipt.branch,
      );
      const haystack = [
        product?.name_en,
        product?.name_fa,
        receipt.product_code,
        receipt.supplier,
        supplier?.name,
        receipt.invoice_number,
        receipt.received_by,
        location?.name_en,
        location?.name_fa,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        !filters.search ||
        haystack.includes(filters.search.trim().toLocaleLowerCase())
      );
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.received_at ?? "").localeCompare(a.received_at ?? "") ||
        a.id.localeCompare(b.id),
    );
}

export function lastReceivedByLocation(
  state: DemoState,
  context: AuthenticatedActor,
  product: string,
): DeliveryReceipt[] {
  const latest = new Map<Branch, DeliveryReceipt>();
  for (const receipt of receivedLog(state, context, { product }))
    if (!latest.has(receipt.branch)) latest.set(receipt.branch, receipt);
  return [...latest.values()];
}

/** The location suggestion is evidence, never a silent relocation. */
export function suggestedInvoiceLocation(
  state: DemoState,
  invoice: DemoInvoice,
): Branch | null {
  const shipTo = invoice.ship_to?.trim().toLocaleLowerCase();
  if (!shipTo) return null;
  const active = configuredBranches(state.config);
  const match = state.config.branches.find(
    (location) =>
      active.includes(branchId(location)) &&
      [
        location.name_en,
        location.name_fa,
        location.code,
        location.id,
        location.address,
      ]
        .filter(Boolean)
        .some((name) => shipTo.includes(String(name).toLocaleLowerCase())),
  );
  return match ? branchId(match) : null;
}

export function setInvoiceLocation(
  state: DemoState,
  actor: AuthenticatedActor,
  destination: Branch,
): void {
  const invoice = state.invoice;
  const current = requireInvoiceAuthority(
    state,
    actor,
    "invoices.assign_receiving_location",
    invoice.id,
    true,
  );
  if (invoice.status === "posted")
    throw new Error("Choose an allowed receiving location for your draft.");
  const scope = invoiceAuthorityScope(state, invoice.id, true);
  requireCapability(state, current, "invoices.assign_receiving_location", {
    ...scope,
    location_ids: [destination],
  });
  invoice.handling_branch ??= invoice.branch;
  invoice.reviewer_origin_location_id ??= invoice.handling_branch;
  if (invoice.branch === destination) return;
  clearInvoiceOrder(invoice);
  invoice.branch = destination;
  invoice.lower_price_answers = undefined;
  for (const line of invoice.lines) {
    line.review_confirmed = false;
    line.manual_price_decision = undefined;
  }
}

export interface InvoiceMovePreview {
  invoice: DemoInvoice;
  from_branch: Branch;
  to_branch: Branch;
  outstanding_amount: string;
  currency: string;
  allocations: InvoiceLocationCorrection["allocations"];
  receipts: DeliveryReceipt[];
  approval_ids: string[];
  snapshot: string;
}

export function invoiceLocationMovePreview(
  state: DemoState,
  context: AuthenticatedActor,
  invoiceId: string,
  destination: Branch,
): InvoiceMovePreview {
  const invoice = postedInvoices(state).find(
    (record) =>
      record.id === invoiceId && record.company_id === context.company_id,
  );
  if (!invoice) throw new Error("The posted invoice was not found.");
  context = requirePurchase(state, context, "invoices.relocate", {
    ...invoiceAuthorityScope(state, invoice.id, true, true),
    location_policy: "retained_correction",
  });
  requireCapability(
    state,
    context,
    "invoices.relocate",
    purchaseLocationScope(invoice.company_id, destination, true),
  );
  const from = effectiveInvoiceLocation(state, invoice);
  if (context.branch !== "all" && context.branch !== from)
    throw new Error("Choose the invoice's current receiving location.");
  if (from === destination) throw new Error("Choose a different location.");
  const currency = state.ledger.find(
    (row) =>
      row.company_id === context.company_id &&
      row.invoice_id === invoiceId &&
      row.type === "invoice",
  )?.currency;
  if (!currency) throw new Error("The original invoice ledger is missing.");
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === context.company_id &&
      supplierMatches(record, invoice.supplier),
  );
  const rows = (state.ledger as OperationalLedger[]).filter(
    (row) =>
      row.company_id === context.company_id &&
      row.branch === from &&
      row.currency === currency &&
      (supplier
        ? supplierMatches(supplier, row.supplier)
        : row.supplier === invoice.supplier),
  );
  let outstanding = new Decimal(0);
  const allocations: InvoiceLocationCorrection["allocations"] = [];
  for (const row of rows) {
    if (row.type === "payment" || row.type === "credit") {
      for (const allocation of row.allocations ?? []) {
        if (allocation.invoice_id !== invoiceId) continue;
        outstanding = outstanding.minus(allocation.amount);
        allocations.push({
          ledger_id: row.id,
          branch: row.branch,
          amount: allocation.amount,
        });
      }
    } else if (row.invoice_id === invoiceId)
      outstanding = outstanding.plus(row.amount);
  }
  const receipts = receivedLog(state, context, { location: from }).filter(
    (receipt) => receipt.invoice_id === invoiceId,
  );
  const approval_ids = state.approvals
    .filter(
      (approval) =>
        approval.company_id === context.company_id &&
        approval.status === "pending" &&
        effectiveApprovalLocation(state, approval) === from &&
        (approval.source_invoice_id === invoiceId ||
          (!approval.source_invoice_id &&
            approval.invoice_ids?.includes(invoiceId) &&
            approval.invoice_number === invoice.supplier_invoice_number)),
    )
    .map((approval) => approval.id);
  return {
    invoice,
    from_branch: from,
    to_branch: destination,
    outstanding_amount: outstanding
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2),
    currency,
    allocations,
    receipts,
    approval_ids,
    snapshot: JSON.stringify({
      invoice,
      from,
      destination,
      rows,
      corrections: state.invoice_location_corrections ?? [],
      receipts,
      approval_ids,
    }),
  };
}

/** Append financial/physical corrections; the invoice, payments and approvals stay intact. */
export function movePostedInvoice(
  state: DemoState,
  context: AuthenticatedActor,
  invoiceId: string,
  destination: Branch,
  reason: string,
  snapshot: string,
): InvoiceLocationCorrection {
  const preview = invoiceLocationMovePreview(
    state,
    context,
    invoiceId,
    destination,
  );
  if (preview.snapshot !== snapshot)
    throw new Error(
      "The invoice or allocations changed. Review the move again.",
    );
  if (!reason.trim())
    throw new Error("Add a reason before moving the invoice.");
  const at = new Date().toISOString();
  const correctionId = createId("invoice-location");
  const correction: InvoiceLocationCorrection = {
    id: correctionId,
    company_id: context.company_id,
    invoice_id: invoiceId,
    from_branch: preview.from_branch,
    to_branch: destination,
    reason: reason.trim(),
    by: context.actor,
    at,
    device: "Prototype browser",
    prior_correction_id: state.invoice_location_corrections
      ?.filter(
        (record) =>
          record.company_id === context.company_id &&
          record.invoice_id === invoiceId,
      )
      .at(-1)?.id,
    outstanding_amount: preview.outstanding_amount,
    currency: preview.currency,
    allocations: structuredClone(preview.allocations),
    receipt_ids: preview.receipts.map((receipt) => receipt.id),
    approval_ids: [...preview.approval_ids],
    ledger_out_id: `${correctionId}:out`,
    ledger_in_id: `${correctionId}:in`,
  };
  for (const [location, amount, id] of [
    [
      preview.from_branch,
      new Decimal(preview.outstanding_amount).negated().toFixed(2),
      correction.ledger_out_id,
    ],
    [destination, preview.outstanding_amount, correction.ledger_in_id],
  ])
    state.ledger.push({
      id,
      company_id: context.company_id,
      branch: location,
      supplier: preview.invoice.supplier,
      type: "adjustment",
      amount,
      date: companyDate(state.config),
      reference: preview.invoice.supplier_invoice_number,
      invoice_id: invoiceId,
      currency: preview.currency,
      note: reason.trim(),
    });
  state.stock_movements ??= [];
  for (const receipt of preview.receipts)
    for (const [location, sign] of [
      [preview.from_branch, -1],
      [destination, 1],
    ] as const)
      state.stock_movements.push({
        id: `${correctionId}:${receipt.id}:${sign}`,
        company_id: context.company_id,
        branch: location,
        product_code: receipt.product_code,
        qty: receipt.units * sign,
        type: "invoice_location_correction",
        reference: receipt.id,
        invoice_id: invoiceId,
        line_index: receipt.line_index,
        by: context.actor,
        at,
      });
  state.invoice_location_corrections ??= [];
  state.invoice_location_corrections.push(correction);
  state.activity.push({
    id: `${correctionId}:history`,
    company_id: context.company_id,
    branch: destination,
    action: "Move invoice",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    at,
    device: "Prototype browser",
    reversible: false,
    entity_type: "invoice_location_correction",
    entity_id: invoiceId,
    before: {
      branch: preview.from_branch,
      outstanding_amount: preview.outstanding_amount,
    },
    after: {
      branch: destination,
      outstanding_amount: preview.outstanding_amount,
      reason: reason.trim(),
    },
  });
  return correction;
}
