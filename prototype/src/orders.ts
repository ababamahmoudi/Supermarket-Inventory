import Decimal from "decimal.js";
import { createId } from "./ids";
import { configuredBranches } from "./settings";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import { costPerCase, packUnits, supplierItemFacts } from "./supplier-items";
import { effectiveInvoiceLocation } from "./received";
import type { OperationsContext } from "./operations";
import type { Branch, DemoInvoice, DemoState, NoteRecord } from "./types";

export type OrderStatus =
  "draft" | "ordered" | "partially_received" | "received" | "cancelled";
export type OrderDecision = "short" | "back_ordered" | "cancelled";
export interface OrderLine {
  id: string;
  company_id: string;
  supplier_item_id: string;
  product_code: string;
  supplier_item_code: string;
  name_en: string;
  name_fa: string;
  unit_size: string;
  units_per_case: number;
  ordered_cases: string;
  ordered_units: number;
  expected_unit_cost: string | null;
  expected_case_cost: string | null;
  expected_line_total: string | null;
  expected_cost_source: "last_bought" | "quoted" | "entered" | null;
  received_units: number;
  cancelled_units: number;
  outstanding_decision?: OrderDecision;
  source_note_ids: string[];
}
export interface OrderReceiptInput {
  invoice_id: string;
  event_key: string;
  kind: "invoice" | "short_delivery";
  lines: {
    order_line_id: string;
    invoice_line_index: number;
    accepted_units: number;
  }[];
  residual: { order_line_id: string; decision: OrderDecision }[];
}
export interface OrderReceiptEvent extends OrderReceiptInput {
  receiving_branch: Branch;
  at: string;
  by: string;
  lines: (OrderReceiptInput["lines"][number] & {
    credited_units: number;
    extra_units: number;
  })[];
}
export interface Order {
  id: string;
  company_id: string;
  branch: Branch;
  supplier: string;
  supplier_id: string;
  reference: string;
  date: string;
  currency: string;
  status: OrderStatus;
  created_at: string;
  created_by: string;
  ordered_at?: string;
  ordered_by?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  expected_total_before_tax: string | null;
  source_note_ids: string[];
  linked_invoice_ids: string[];
  version: number;
  lines: OrderLine[];
  receipts: OrderReceiptEvent[];
}
export interface OrderContext extends OperationsContext {
  username?: string;
  device?: string;
  allowed_branches?: Branch[];
}
export interface OrderCandidate {
  id: string;
  product_code: string;
  supplier_item_code: string;
  name_en: string;
  name_fa: string;
  unit_size: string;
  units_per_case: number;
  expected_unit_cost: string | null;
  expected_case_cost: string | null;
  expected_cost_source: "last_bought" | "quoted" | null;
}
export interface OrderDraftLineInput {
  supplier_item_id: string;
  cases: string;
  expected_unit_cost?: string;
  source_note_ids?: string[];
}
export interface OrderDraftInput {
  branch: Branch;
  supplier: string;
  lines: OrderDraftLineInput[];
  source_note_ids?: string[];
}
export interface OrderComparisonLine {
  invoice_line_index: number;
  order_line_id?: string;
  expected_remaining_units: number;
  delivered_units: number;
  accepted_units: number;
  extra_units: number;
  short_units: number;
  previous_unit_cost: string | null;
  new_unit_cost: string;
  price_changed: boolean;
  old_units_per_case: number | null;
  new_units_per_case: number;
  previous_case_cost: string | null;
  new_case_cost: string;
}
export interface OrderComparison {
  order_id: string;
  order_version: number;
  lines: OrderComparisonLine[];
  residual: {
    order_line_id: string;
    expected_remaining_units: number;
    received_units: number;
    missing_units: number;
    absent: boolean;
  }[];
}
export class OrderError extends Error {
  constructor(
    public readonly code:
      | "permission"
      | "scope"
      | "location"
      | "supplier"
      | "item"
      | "quantity"
      | "cost"
      | "empty"
      | "notes"
      | "status"
      | "stale"
      | "reason"
      | "receipt"
      | "decision",
  ) {
    super(code);
  }
}
function fail(code: OrderError["code"]): never {
  throw new OrderError(code);
}
const now = () => new Date().toISOString();
export const remainingOrderUnits = (line: OrderLine) =>
  Math.max(0, line.ordered_units - line.received_units - line.cancelled_units);
export function canUseOrders(state: DemoState, context: OrderContext): boolean {
  return (
    context.company_id === state.config.company.seed_key &&
    (context.branch === "all"
      ? context.role === "supervisor"
      : locationAllowed(state, context, context.branch)) &&
    (context.role === "supervisor" ||
      (context.role === "floor_worker" &&
        context.branch !== "all" &&
        state.config.orders?.allow_floor_worker === true))
  );
}
function guard(state: DemoState, context: OrderContext): void {
  if (!canUseOrders(state, context))
    fail(
      context.company_id !== state.config.company.seed_key
        ? "scope"
        : "permission",
    );
}
function locationAllowed(
  state: DemoState,
  context: OrderContext,
  branch: Branch,
  active = false,
): boolean {
  return (
    branch !== "all" &&
    configuredBranches(state.config, !active).includes(branch) &&
    (
      context.allowed_branches ??
      (context.role === "supervisor"
        ? configuredBranches(state.config, true)
        : [context.branch])
    ).includes(branch) &&
    (context.branch === "all" || context.branch === branch)
  );
}
export function orderLocations(
  state: DemoState,
  context: OrderContext,
): Branch[] {
  guard(state, context);
  return configuredBranches(state.config).filter((branch) =>
    locationAllowed(state, context, branch, true),
  );
}
export function scopedOrders(state: DemoState, context: OrderContext): Order[] {
  guard(state, context);
  return (state.orders ?? [])
    .filter(
      (order) =>
        order.company_id === context.company_id &&
        locationAllowed(state, context, order.branch),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function orderCandidates(
  state: DemoState,
  context: OrderContext,
  supplier: string,
): OrderCandidate[] {
  guard(state, context);
  return supplierItemFacts(state, context.company_id, supplier, "all")
    .filter((item) =>
      state.products.some(
        (product) =>
          product.company_id === context.company_id &&
          product.code === item.product_code &&
          product.status !== "archived",
      ),
    )
    .map((item) => {
      const unit =
        item.last_bought_unit_cost ?? item.quoted_unit_cost_before_tax ?? null;
      return {
        id: item.id,
        product_code: item.product_code,
        supplier_item_code: item.supplier_item_code,
        name_en: item.name_en,
        name_fa: item.name_fa,
        unit_size: item.unit_size,
        units_per_case: item.units_per_case,
        expected_unit_cost: unit,
        expected_case_cost:
          item.last_bought_case_cost !== null &&
          item.last_bought_units_per_case !== null
            ? new Decimal(item.last_bought_case_cost)
                .times(item.units_per_case)
                .div(item.last_bought_units_per_case)
                .toFixed(4, Decimal.ROUND_HALF_UP)
            : unit === null
              ? null
              : costPerCase(unit, item.units_per_case),
        expected_cost_source:
          item.last_bought_unit_cost !== null
            ? "last_bought"
            : item.quoted_unit_cost_before_tax !== undefined
              ? "quoted"
              : null,
      };
    });
}
export function openToOrderNotes(
  state: DemoState,
  context: OrderContext,
  location: Branch,
): NoteRecord[] {
  guard(state, context);
  if (!locationAllowed(state, context, location, true)) fail("scope");
  return state.notes.filter(
    (note) =>
      note.company_id === context.company_id &&
      note.branch === location &&
      note.type === "to_order" &&
      note.status === "open",
  );
}
function expectedCost(value: string): string {
  if (!/^\d+(\.\d{1,4})?$/.test(value) || !new Decimal(value).isFinite())
    fail("cost");
  return new Decimal(value).toFixed(4);
}
function draftValues(
  state: DemoState,
  context: OrderContext,
  input: OrderDraftInput,
  prior?: Order,
): Pick<
  Order,
  | "branch"
  | "supplier"
  | "supplier_id"
  | "lines"
  | "source_note_ids"
  | "expected_total_before_tax"
> {
  if (!locationAllowed(state, context, input.branch, true)) fail("location");
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === context.company_id &&
      record.active &&
      record.status === "confirmed" &&
      supplierMatches(record, input.supplier),
  );
  if (!supplier) fail("supplier");
  const candidates = orderCandidates(state, context, supplier.name);
  const selected = [...new Set(input.source_note_ids ?? [])];
  for (const id of selected)
    if (
      !openToOrderNotes(state, context, input.branch).some(
        (note) => note.id === id,
      )
    )
      fail("notes");
  const seen = new Set<string>();
  const lines = input.lines.map((inputLine) => {
    const item = candidates.find(
      (candidate) => candidate.id === inputLine.supplier_item_id,
    );
    if (!item || seen.has(item.id)) fail("item");
    seen.add(item.id);
    let units: number;
    try {
      units = packUnits(inputLine.cases, "cases", item.units_per_case);
    } catch {
      return fail("quantity");
    }
    const rawCost = inputLine.expected_unit_cost?.trim();
    const unit = rawCost
      ? expectedCost(rawCost)
      : item.expected_unit_cost === null
        ? null
        : expectedCost(item.expected_unit_cost);
    const entered = Boolean(
      rawCost &&
      (item.expected_unit_cost === null ||
        !new Decimal(rawCost).eq(item.expected_unit_cost)),
    );
    const caseCost =
      unit === null
        ? null
        : entered
          ? costPerCase(unit, item.units_per_case)
          : item.expected_case_cost;
    const noteIds = [...new Set(inputLine.source_note_ids ?? [])];
    if (noteIds.some((id) => !selected.includes(id))) fail("notes");
    const old = prior?.lines.find((line) => line.supplier_item_id === item.id);
    return {
      id: old?.id ?? createId("order-line"),
      company_id: context.company_id,
      supplier_item_id: item.id,
      product_code: item.product_code,
      supplier_item_code: item.supplier_item_code,
      name_en: item.name_en,
      name_fa: item.name_fa,
      unit_size: item.unit_size,
      units_per_case: item.units_per_case,
      ordered_cases: new Decimal(inputLine.cases).toString(),
      ordered_units: units,
      expected_unit_cost: unit,
      expected_case_cost: caseCost,
      expected_line_total:
        caseCost === null
          ? null
          : new Decimal(caseCost)
              .times(inputLine.cases)
              .toFixed(2, Decimal.ROUND_HALF_UP),
      expected_cost_source: entered
        ? ("entered" as const)
        : item.expected_cost_source,
      received_units: 0,
      cancelled_units: 0,
      source_note_ids: noteIds,
    };
  });
  if (
    lines.flatMap((line) => line.source_note_ids).length !==
    new Set(lines.flatMap((line) => line.source_note_ids)).size
  )
    fail("notes");
  return {
    branch: input.branch,
    supplier: supplier.name,
    supplier_id: supplier.id,
    lines,
    source_note_ids: selected,
    expected_total_before_tax: lines.some(
      (line) => line.expected_line_total === null,
    )
      ? null
      : lines
          .reduce(
            (total, line) => total.plus(line.expected_line_total!),
            new Decimal(0),
          )
          .toFixed(2),
  };
}
function audit(
  state: DemoState,
  context: OrderContext,
  action: string,
  order: Order,
  before?: Order,
  actingBranch = order.branch,
): void {
  state.activity.unshift({
    id: createId("order-activity"),
    company_id: order.company_id,
    branch: actingBranch,
    action,
    by: context.actor,
    actor_username: context.username,
    device: context.device ?? "Browser demo",
    at: now(),
    entity_type: "order",
    entity_id: order.id,
    reversible: false,
    before,
    after: structuredClone(order),
  });
}
export function createOrder(
  state: DemoState,
  context: OrderContext,
  input: OrderDraftInput,
): Order {
  guard(state, context);
  const values = draftValues(state, context, input);
  const sequence =
    (state.orders ?? [])
      .filter((order) => order.company_id === context.company_id)
      .reduce(
        (max, order) =>
          Math.max(max, Number(order.reference.match(/^ORD-(\d+)$/)?.[1] ?? 0)),
        0,
      ) + 1;
  const at = now();
  const order: Order = {
    id: createId("order"),
    company_id: context.company_id,
    ...values,
    reference: `ORD-${String(sequence).padStart(4, "0")}`,
    date: new Intl.DateTimeFormat("en-CA", {
      timeZone: state.config.company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(at)),
    currency: state.config.company.currency,
    status: "draft",
    created_at: at,
    created_by: context.actor,
    linked_invoice_ids: [],
    receipts: [],
    version: 1,
  };
  state.orders ??= [];
  state.orders.push(order);
  audit(state, context, "Create order draft", order);
  return order;
}
function getOrder(state: DemoState, context: OrderContext, id: string): Order {
  guard(state, context);
  return (
    scopedOrders(state, context).find((order) => order.id === id) ??
    fail("scope")
  );
}
export function saveOrderDraft(
  state: DemoState,
  context: OrderContext,
  id: string,
  input: OrderDraftInput,
  version?: number,
): Order {
  const order = getOrder(state, context, id);
  if (order.status !== "draft") fail("status");
  if (version !== undefined && version !== order.version) fail("stale");
  const values = draftValues(state, context, input, order);
  const before = structuredClone(order);
  Object.assign(order, values, { version: order.version + 1 });
  audit(state, context, "Edit order draft", order, before);
  return order;
}
export function addToOrderNote(
  state: DemoState,
  context: OrderContext,
  orderId: string,
  noteId: string,
): Order {
  const order = getOrder(state, context, orderId);
  if (order.status !== "draft") fail("status");
  const note = openToOrderNotes(state, context, order.branch).find(
    (item) => item.id === noteId,
  );
  if (!note) fail("notes");
  if (order.source_note_ids.includes(noteId)) return order;
  const before = structuredClone(order);
  order.source_note_ids.push(noteId);
  order.version++;
  audit(state, context, "Add To order note to draft", order, before);
  return order;
}
export function placeOrder(
  state: DemoState,
  context: OrderContext,
  id: string,
  version?: number,
): Order {
  const order = getOrder(state, context, id);
  if (order.status !== "draft") fail("status");
  if (version !== undefined && version !== order.version) fail("stale");
  if (!locationAllowed(state, context, order.branch, true)) fail("location");
  if (
    !supplierRecords(state).some(
      (supplier) =>
        supplier.company_id === context.company_id &&
        supplier.id === order.supplier_id &&
        supplier.active &&
        supplier.status === "confirmed",
    )
  )
    fail("supplier");
  if (!order.lines.length) fail("empty");
  if (
    order.lines.some(
      (line) =>
        line.company_id !== context.company_id ||
        !state.products.some(
          (product) =>
            product.company_id === context.company_id &&
            product.code === line.product_code &&
            product.status !== "archived",
        ),
    )
  )
    fail("item");
  if (order.lines.some((line) => line.expected_unit_cost === null))
    fail("cost");
  for (const noteId of order.source_note_ids)
    if (
      !openToOrderNotes(state, context, order.branch).some(
        (note) => note.id === noteId,
      ) ||
      !order.lines.some((line) => line.source_note_ids.includes(noteId))
    )
      fail("notes");
  const before = structuredClone(order);
  order.status = "ordered";
  order.ordered_at = now();
  order.ordered_by = context.actor;
  order.version++;
  for (const note of state.notes.filter(
    (note) =>
      order.source_note_ids.includes(note.id) &&
      note.company_id === context.company_id &&
      note.branch === order.branch,
  )) {
    note.status = "ordered";
    state.activity.unshift({
      id: createId("note-order"),
      company_id: context.company_id,
      branch: order.branch,
      by: context.actor,
      actor_username: context.username,
      device: context.device ?? "Browser demo",
      at: now(),
      action: "To order note ordered",
      entity_type: "note",
      entity_id: note.id,
      reversible: false,
      after: { note_id: note.id, order_id: order.id },
    });
  }
  audit(state, context, "Place order", order, before);
  return order;
}
export function cancelOrder(
  state: DemoState,
  context: OrderContext,
  id: string,
  reason: string,
  version?: number,
): Order {
  const order = getOrder(state, context, id);
  if (!["draft", "ordered", "partially_received"].includes(order.status))
    fail("status");
  if (version !== undefined && version !== order.version) fail("stale");
  if (!reason.trim()) fail("reason");
  const before = structuredClone(order);
  for (const line of order.lines) {
    line.cancelled_units += remainingOrderUnits(line);
    line.outstanding_decision = "cancelled";
  }
  order.status = "cancelled";
  order.cancellation_reason = reason.trim();
  order.cancelled_at = now();
  order.cancelled_by = context.actor;
  order.version++;
  audit(state, context, "Cancel order", order, before);
  return order;
}
function matchingLine(
  order: Order,
  invoiceLine: DemoInvoice["lines"][number],
): OrderLine | undefined {
  if (invoiceLine.supplier_item_id)
    return order.lines.find(
      (line) =>
        line.supplier_item_id === invoiceLine.supplier_item_id &&
        line.product_code === invoiceLine.product_code,
    );
  const matches = order.lines.filter(
    (line) =>
      line.product_code === invoiceLine.product_code &&
      line.supplier_item_code === (invoiceLine.supplier_item_code ?? ""),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
/** Pure comparison uses the pre-post remaining snapshot; never re-run a posted invoice for its locked review. */
export function compareInvoiceOrder(
  order: Order,
  invoice: DemoInvoice,
): OrderComparison {
  const consumed = new Map<string, number>();
  const present = new Set<string>();
  const lines = invoice.lines.map((line, index): OrderComparisonLine => {
    const matched = matchingLine(order, line);
    const expected = matched ? remainingOrderUnits(matched) : 0;
    const delivered = line.qty_received_at_posting;
    const accepted = Math.max(0, delivered - (line.refused_units ?? 0));
    const before = matched ? (consumed.get(matched.id) ?? 0) : 0;
    const available = Math.max(0, expected - before);
    if (matched) {
      consumed.set(matched.id, before + accepted);
      present.add(matched.id);
    }
    const pack = line.units_per_case ?? 1;
    const newCaseCost =
      line.case_cost_before_tax ?? costPerCase(line.unit_cost_before_tax, pack);
    return {
      invoice_line_index: index,
      order_line_id: matched?.id,
      expected_remaining_units: expected,
      delivered_units: delivered,
      accepted_units: accepted,
      extra_units: Math.max(0, delivered - available),
      short_units: Math.max(0, line.qty_invoiced - delivered),
      previous_unit_cost: matched?.expected_unit_cost ?? null,
      new_unit_cost: line.unit_cost_before_tax,
      price_changed:
        matched?.expected_unit_cost !== null &&
        matched?.expected_unit_cost !== undefined &&
        (!new Decimal(matched.expected_unit_cost).eq(
          line.unit_cost_before_tax,
        ) ||
          (matched.units_per_case === pack &&
            matched.expected_case_cost !== null &&
            !new Decimal(matched.expected_case_cost).eq(newCaseCost))),
      old_units_per_case: matched?.units_per_case ?? null,
      new_units_per_case: pack,
      previous_case_cost: matched?.expected_case_cost ?? null,
      new_case_cost: newCaseCost,
    };
  });
  return {
    order_id: order.id,
    order_version: order.version,
    lines,
    residual: order.lines
      .filter((line) => remainingOrderUnits(line) > 0)
      .map((line) => {
        const expected = remainingOrderUnits(line);
        const received = consumed.get(line.id) ?? 0;
        return {
          order_line_id: line.id,
          expected_remaining_units: expected,
          received_units: Math.min(expected, received),
          missing_units: Math.max(0, expected - received),
          absent: !present.has(line.id),
        };
      })
      .filter((line) => line.missing_units > 0),
  };
}
/** Invoice callers already authorize review. This narrowly suggests compatible open orders, not general browsing. */
export function suggestOpenOrders(
  state: DemoState,
  invoice: DemoInvoice,
): Order[] {
  if (invoice.company_id !== state.config.company.seed_key) return [];
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === invoice.company_id &&
      supplierMatches(record, invoice.supplier),
  );
  return (state.orders ?? []).filter(
    (order) =>
      order.company_id === invoice.company_id &&
      order.branch === effectiveInvoiceLocation(state, invoice) &&
      (order.supplier_id === supplier?.id ||
        order.supplier === invoice.supplier) &&
      (order.status === "ordered" || order.status === "partially_received"),
  );
}
function receiptOrder(
  state: DemoState,
  context: OrderContext,
  id: string,
  input: OrderReceiptInput,
): { order: Order; invoice: DemoInvoice } {
  if (
    context.company_id !== state.config.company.seed_key ||
    (context.role !== "supervisor" && context.role !== "floor_worker")
  )
    fail("permission");
  const order =
    (state.orders ?? []).find(
      (record) => record.id === id && record.company_id === context.company_id,
    ) ?? fail("scope");
  const invoice =
    [...(state.invoices ?? []), state.invoice].find(
      (record) =>
        record.id === input.invoice_id &&
        record.company_id === context.company_id &&
        record.status === "posted",
    ) ?? fail("receipt");
  if (
    invoice.order_id !== id ||
    invoice.order_comparison?.order_id !== id ||
    (input.kind === "invoice"
      ? effectiveInvoiceLocation(state, invoice) !== order.branch
      : invoice.branch !== order.branch) ||
    !supplierRecords(state).some(
      (supplier) =>
        supplier.id === order.supplier_id &&
        supplier.company_id === context.company_id &&
        supplierMatches(supplier, invoice.supplier),
    )
  )
    fail("scope");
  const receivingBranch = effectiveInvoiceLocation(state, invoice);
  if (!configuredBranches(state.config).includes(receivingBranch))
    fail("scope");
  if (
    input.kind === "short_delivery" &&
    (!order.linked_invoice_ids.includes(invoice.id) ||
      !order.receipts.some(
        (event) => event.kind === "invoice" && event.invoice_id === invoice.id,
      ))
  )
    fail("receipt");
  const actingBranch =
    input.kind === "invoice"
      ? (invoice.handling_branch ?? invoice.branch)
      : receivingBranch;
  if (
    context.role !== "supervisor" &&
    (context.branch === "all" ||
      context.branch !== actingBranch ||
      (context.allowed_branches !== undefined &&
        !context.allowed_branches.includes(actingBranch)))
  )
    fail("scope");
  if (
    context.role === "supervisor" &&
    !locationAllowed(
      state,
      { ...context, branch: "all" },
      receivingBranch,
      true,
    )
  )
    fail("scope");
  return { order, invoice };
}
/** Validate against saved invoice evidence before any caller writes financial records. No mutation. */
export function validateOrderReceipt(
  state: DemoState,
  context: OrderContext,
  id: string,
  input: OrderReceiptInput,
): void {
  const { order, invoice } = receiptOrder(state, context, id, input);
  const prior = order.receipts.find(
    (event) =>
      event.event_key === input.event_key ||
      (input.kind === "invoice" &&
        event.kind === "invoice" &&
        event.invoice_id === input.invoice_id),
  );
  if (prior) {
    const canonical = (value: OrderReceiptInput) =>
      JSON.stringify({
        invoice_id: value.invoice_id,
        kind: value.kind,
        lines: value.lines.map(
          ({ order_line_id, invoice_line_index, accepted_units }) => ({
            order_line_id,
            invoice_line_index,
            accepted_units,
          }),
        ),
        residual: value.residual,
      });
    if (canonical(prior) !== canonical(input)) fail("receipt");
    return;
  }
  if (
    order.status !== "ordered" &&
    order.status !== "partially_received" &&
    !(input.kind === "short_delivery" && order.status === "received")
  )
    fail("status");
  if (
    input.kind === "invoice" &&
    invoice.order_comparison?.order_version !== order.version
  )
    fail("stale");
  if (
    !input.event_key.trim() ||
    !["invoice", "short_delivery"].includes(input.kind)
  )
    fail("receipt");
  if (
    input.kind === "short_delivery" &&
    (input.residual.length > 0 || input.lines.length === 0)
  )
    fail("receipt");
  const seen = new Set<number>();
  for (const entry of input.lines) {
    const line = invoice.lines[entry.invoice_line_index];
    const comparison = invoice.order_comparison?.lines.find(
      (row) => row.invoice_line_index === entry.invoice_line_index,
    );
    if (
      !line ||
      line.company_id !== context.company_id ||
      matchingLine(order, line)?.id !== entry.order_line_id ||
      seen.has(entry.invoice_line_index) ||
      comparison?.order_line_id !== entry.order_line_id ||
      !order.lines.some((item) => item.id === entry.order_line_id) ||
      !Number.isSafeInteger(entry.accepted_units) ||
      entry.accepted_units < 0
    )
      fail("receipt");
    seen.add(entry.invoice_line_index);
    const already = order.receipts
      .filter(
        (event) =>
          event.invoice_id === input.invoice_id &&
          event.kind === "short_delivery",
      )
      .flatMap((event) => event.lines)
      .filter((row) => row.invoice_line_index === entry.invoice_line_index)
      .reduce((total, row) => total + row.accepted_units, 0);
    const expected =
      input.kind === "invoice"
        ? line.qty_received_at_posting - (line.refused_units ?? 0)
        : (line.qty_later_received ?? 0) - already;
    if (
      input.kind === "invoice" &&
      (comparison!.delivered_units !== line.qty_received_at_posting ||
        comparison!.accepted_units !== expected ||
        comparison!.expected_remaining_units !==
          remainingOrderUnits(
            order.lines.find((item) => item.id === entry.order_line_id)!,
          ))
    )
      fail("receipt");
    if (
      entry.accepted_units !== expected ||
      expected < 0 ||
      (input.kind === "short_delivery" && expected === 0)
    )
      fail("receipt");
  }
  if (
    input.kind === "invoice" &&
    invoice.order_comparison?.lines
      .filter((row) => row.order_line_id)
      .some((row) => !seen.has(row.invoice_line_index))
  )
    fail("receipt");
  if (
    input.kind === "short_delivery" &&
    !order.receipts.some(
      (event) =>
        event.invoice_id === input.invoice_id && event.kind === "invoice",
    )
  )
    fail("receipt");
  const residualIds = new Set<string>();
  for (const entry of input.residual) {
    if (
      residualIds.has(entry.order_line_id) ||
      !["short", "back_ordered", "cancelled"].includes(entry.decision) ||
      !invoice.order_comparison?.residual.some(
        (row) => row.order_line_id === entry.order_line_id,
      )
    )
      fail("decision");
    residualIds.add(entry.order_line_id);
    if (
      input.kind === "invoice" &&
      invoice.order_missing_decisions?.[entry.order_line_id] !== entry.decision
    )
      fail("decision");
  }
  if (
    input.kind === "invoice" &&
    invoice.order_comparison?.residual.some(
      (row) => !residualIds.has(row.order_line_id),
    )
  )
    fail("decision");
}
export function applyInvoiceToOrder(
  state: DemoState,
  context: OrderContext,
  id: string,
  input: OrderReceiptInput,
): Order {
  validateOrderReceipt(state, context, id, input);
  const { order, invoice } = receiptOrder(state, context, id, input);
  if (
    order.receipts.some(
      (event) =>
        event.event_key === input.event_key ||
        (input.kind === "invoice" &&
          event.kind === "invoice" &&
          event.invoice_id === input.invoice_id),
    )
  )
    return order;
  const before = structuredClone(order);
  const lines = input.lines.map((entry) => {
    const line = order.lines.find(
      (record) => record.id === entry.order_line_id,
    )!;
    const credited = Math.min(remainingOrderUnits(line), entry.accepted_units);
    line.received_units += credited;
    if (remainingOrderUnits(line) === 0) delete line.outstanding_decision;
    return {
      ...entry,
      credited_units: credited,
      extra_units: entry.accepted_units - credited,
    };
  });
  for (const residual of input.residual) {
    const line = order.lines.find(
      (record) => record.id === residual.order_line_id,
    )!;
    if (residual.decision === "cancelled")
      line.cancelled_units += remainingOrderUnits(line);
    line.outstanding_decision = residual.decision;
  }
  order.receipts.push({
    ...structuredClone(input),
    lines,
    receiving_branch: effectiveInvoiceLocation(state, invoice),
    at: now(),
    by: context.actor,
  });
  if (!order.linked_invoice_ids.includes(input.invoice_id))
    order.linked_invoice_ids.push(input.invoice_id);
  order.status = order.lines.every((line) => remainingOrderUnits(line) === 0)
    ? "received"
    : "partially_received";
  order.version++;
  audit(
    state,
    context,
    input.kind === "invoice"
      ? "Receive order invoice"
      : "Receive order Short delivery",
    order,
    before,
    effectiveInvoiceLocation(state, invoice),
  );
  return order;
}
