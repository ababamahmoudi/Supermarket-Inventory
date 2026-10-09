import DecimalLibrary from "decimal.js";
import { createId } from "./ids";
import { configuredBranches } from "./settings";
import type { Branch, DemoState, Role } from "./types";
// Keep quantity arithmetic independent of the pricing engine's Decimal settings.
const Decimal = DecimalLibrary.clone({ precision: 80 });

export interface BranchRequestContext {
  company_id: string;
  role: Role;
  actor: string;
  username?: string;
  device?: string;
  branch: Branch;
  allowed_branches: readonly Branch[];
}
export type BranchRequestStatus =
  "draft" | "requested" | "sent" | "received" | "closed" | "cancelled";
export interface BranchRequestItem {
  id: string;
  kind: "catalog" | "free_text";
  product_code?: string;
  name_en: string;
  name_fa: string;
  unit_size?: string;
  free_text?: string;
  quantity: string;
  quantity_unit: "units" | "cases";
  units_per_case?: number;
  normalized_units: number | null;
  note?: string;
  source_item_id?: string;
  sending_decision?: "sent" | "short";
  sent_quantity?: string;
  short_quantity?: string;
  receiving_decision?: "received" | "missing";
  received_quantity?: string;
  missing_quantity?: string;
}
export interface BranchRequest {
  id: string;
  reference: string;
  company_id: string;
  branch: Branch;
  from_branch: Branch;
  to_branch: Branch;
  status: BranchRequestStatus;
  revision: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  items: BranchRequestItem[];
  requested_at?: string;
  requested_by?: string;
  sent_at?: string;
  sent_by?: string;
  received_at?: string;
  received_by?: string;
  closed_at?: string;
  closed_by?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  source_request_id?: string;
  source_revision?: number;
}
export interface RequestTransferEvent {
  id: string;
  company_id: string;
  request_id: string;
  item_id: string;
  kind: "transfer_sent" | "transfer_received";
  branch: Branch;
  from_branch: Branch;
  to_branch: Branch;
  product_code?: string;
  name_en: string;
  name_fa: string;
  free_text?: string;
  quantity: string;
  quantity_unit: "units" | "cases";
  units_per_case?: number;
  normalized_units: number | null;
  at: string;
  by: string;
  username?: string;
  device?: string;
}
export interface BranchRequestItemInput {
  id?: string;
  kind: "catalog" | "free_text";
  product_code?: string;
  free_text?: string;
  quantity: string;
  quantity_unit: "units" | "cases";
  units_per_case?: number;
  note?: string;
}
export interface BranchRequestDraftInput {
  id?: string;
  expected_revision?: number;
  from_branch: Branch;
  to_branch: Branch;
  items: BranchRequestItemInput[];
}
export class BranchRequestError extends Error {
  constructor(
    public code:
      | "permission"
      | "scope"
      | "location"
      | "stale"
      | "status"
      | "items"
      | "quantity"
      | "pack"
      | "decision"
      | "reason"
      | "residual",
  ) {
    super(code);
    this.name = "BranchRequestError";
  }
}
function fail(code: BranchRequestError["code"]): never {
  throw new BranchRequestError(code);
}
function authorized(state: DemoState, context: BranchRequestContext) {
  if (context.role === "cashier" || !context.actor.trim()) fail("permission");
  if (context.company_id !== state.config.company.seed_key) fail("scope");
}
function endpoint(
  state: DemoState,
  context: BranchRequestContext,
  location: Branch,
) {
  authorized(state, context);
  if (
    location === "all" ||
    !configuredBranches(state.config).includes(location) ||
    !context.allowed_branches.includes(location) ||
    context.branch !== location
  )
    fail("location");
}
function canRead(
  state: DemoState,
  context: BranchRequestContext,
  request: BranchRequest,
) {
  if (
    context.role === "cashier" ||
    context.company_id !== state.config.company.seed_key ||
    request.company_id !== context.company_id
  )
    return false;
  const unsent =
    request.status === "draft" ||
    (request.status === "cancelled" && !request.requested_at);
  const relevant = unsent
    ? [request.from_branch]
    : [request.from_branch, request.to_branch];
  return relevant.some(
    (location) =>
      configuredBranches(state.config, true).includes(location) &&
      context.allowed_branches.includes(location) &&
      (context.branch === location ||
        (context.role === "supervisor" && context.branch === "all")),
  );
}
function record(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
  revision: number,
) {
  authorized(state, context);
  const request = state.branch_requests?.find(
    (item) => item.id === id && canRead(state, context, item),
  );
  if (!request) fail("scope");
  if (request.revision !== revision) fail("stale");
  return request;
}
function status(request: BranchRequest, expected: BranchRequestStatus) {
  if (request.status !== expected) fail("status");
}
function decimal(value: string, positive = true) {
  try {
    const result = new Decimal(value);
    if (
      !result.isFinite() ||
      result.isNegative() ||
      (positive && result.isZero())
    )
      fail("quantity");
    return result;
  } catch {
    return fail("quantity");
  }
}
export function requestQuantityUnits(
  quantity: string,
  unit: "units" | "cases",
  pack?: number,
): number | null {
  const qty = decimal(quantity);
  if (unit !== "units" && unit !== "cases") fail("quantity");
  if (pack !== undefined && (!Number.isSafeInteger(pack) || pack < 1))
    fail("pack");
  if (unit === "cases" && pack === undefined) {
    if (!qty.isInteger() || qty.gt(Number.MAX_SAFE_INTEGER)) fail("quantity");
    return null;
  }
  const ExactDecimal = Decimal.clone({
    precision: Math.max(80, qty.sd() + String(pack ?? 1).length + 8),
  });
  const units = unit === "cases" ? new ExactDecimal(qty).times(pack!) : qty;
  if (!units.isInteger() || units.gt(Number.MAX_SAFE_INTEGER)) fail("quantity");
  return units.toNumber();
}
function items(
  state: DemoState,
  input: BranchRequestItemInput[],
  existing?: BranchRequest,
) {
  if (!input.length || input.length > 200) fail("items");
  const ids = new Set<string>();
  return input.map((line): BranchRequestItem => {
    const id = line.id ?? createId("request-item");
    if (
      ids.has(id) ||
      (line.id && existing && !existing.items.some((item) => item.id === id))
    )
      fail("items");
    ids.add(id);
    const product =
      line.kind === "catalog"
        ? state.products.find(
            (item) =>
              item.company_id === state.config.company.seed_key &&
              item.code === line.product_code &&
              item.status !== "archived",
          )
        : undefined;
    if (line.kind === "catalog" && !product) fail("items");
    if (line.kind !== "catalog" && line.kind !== "free_text") fail("items");
    if (line.kind === "free_text" && !line.free_text?.trim()) fail("items");
    if (
      line.kind === "catalog" &&
      line.quantity_unit === "cases" &&
      line.units_per_case === undefined
    )
      fail("pack");
    const normalized_units = requestQuantityUnits(
      line.quantity,
      line.quantity_unit,
      line.units_per_case,
    );
    const previous = existing?.items.find((item) => item.id === id);
    const sourceItem = previous?.source_item_id
      ? state.branch_requests
          ?.find(
            (request) =>
              request.company_id === state.config.company.seed_key &&
              request.id === existing?.source_request_id,
          )
          ?.items.find((item) => item.id === previous.source_item_id)
      : undefined;
    const sameDimension =
      (sourceItem?.normalized_units !== null &&
        sourceItem !== undefined &&
        normalized_units !== null) ||
      (previous?.quantity_unit === line.quantity_unit &&
        previous?.units_per_case === line.units_per_case);
    const retainedSource =
      previous &&
      previous.kind === line.kind &&
      previous.product_code === product?.code &&
      previous.free_text ===
        (line.kind === "free_text" ? line.free_text!.trim() : undefined) &&
      sameDimension
        ? previous.source_item_id
        : undefined;
    return {
      id,
      kind: line.kind,
      product_code: product?.code,
      name_en: product?.name_en ?? "",
      name_fa: product?.name_fa ?? "",
      unit_size: product?.unit_size,
      free_text: line.kind === "free_text" ? line.free_text!.trim() : undefined,
      quantity: decimal(line.quantity).toFixed(),
      quantity_unit: line.quantity_unit,
      units_per_case: line.units_per_case,
      normalized_units,
      note: line.note?.trim() || undefined,
      source_item_id: retainedSource,
    };
  });
}
function audit(
  state: DemoState,
  context: BranchRequestContext,
  request: BranchRequest,
  action: string,
  before?: BranchRequest,
) {
  state.activity.push({
    id: createId("request-activity"),
    company_id: context.company_id,
    branch: context.branch,
    action,
    by: context.actor,
    actor_username: context.username,
    device: context.device,
    at: request.updated_at,
    entity_type: "branch_request",
    entity_id: request.id,
    before,
    after: structuredClone(request),
    reversible: false,
  });
}
function transition(
  state: DemoState,
  context: BranchRequestContext,
  request: BranchRequest,
  next: BranchRequestStatus,
  action: string,
  before: BranchRequest,
) {
  request.status = next;
  request.revision += 1;
  request.updated_at = new Date().toISOString();
  audit(state, context, request, action, before);
}
export function listBranchRequests(
  state: DemoState,
  context: BranchRequestContext,
  filters: {
    tab?: "incoming" | "outgoing";
    status?: BranchRequestStatus | "open" | "all";
    query?: string;
  } = {},
) {
  const query = filters.query?.trim().toLocaleLowerCase() ?? "";
  return (state.branch_requests ?? [])
    .filter((request) => {
      if (!canRead(state, context, request)) return false;
      if (filters.tab) {
        const location =
          filters.tab === "incoming" ? request.to_branch : request.from_branch;
        if (!(
          context.branch === location ||
          (context.role === "supervisor" &&
            context.branch === "all" &&
            context.allowed_branches.includes(location))
        ))
          return false;
        if (filters.tab === "incoming" && !request.requested_at) return false;
      }
      if (
        filters.status === "open" &&
        ["closed", "cancelled"].includes(request.status)
      )
        return false;
      if (
        filters.status &&
        !["open", "all"].includes(filters.status) &&
        request.status !== filters.status
      )
        return false;
      return (
        !query ||
        `${request.reference} ${request.items.map((item) => `${item.name_en} ${item.name_fa} ${item.free_text ?? ""} ${item.product_code ?? ""} ${item.note ?? ""}`).join(" ")}`
          .toLocaleLowerCase()
          .includes(query)
      );
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export function branchRequestCount(
  state: DemoState,
  context: BranchRequestContext,
) {
  return listBranchRequests(state, context).filter((request) => {
    const responsible =
      request.status === "requested"
        ? request.to_branch
        : ["draft", "sent", "received"].includes(request.status)
          ? request.from_branch
          : null;
    return (
      responsible &&
      context.allowed_branches.includes(responsible) &&
      configuredBranches(state.config).includes(responsible) &&
      (context.branch === responsible ||
        (context.role === "supervisor" && context.branch === "all"))
    );
  }).length;
}
export function saveBranchRequestDraft(
  state: DemoState,
  context: BranchRequestContext,
  input: BranchRequestDraftInput,
) {
  endpoint(state, context, input.from_branch);
  if (
    input.to_branch === input.from_branch ||
    !configuredBranches(state.config).includes(input.to_branch)
  )
    fail("location");
  const previous = input.id
    ? record(state, context, input.id, input.expected_revision ?? -1)
    : undefined;
  if (previous) {
    status(previous, "draft");
    if (previous.from_branch !== input.from_branch) fail("location");
  }
  const nextItems = items(state, input.items, previous);
  const before = previous && structuredClone(previous);
  const now = new Date().toISOString();
  if (previous) {
    previous.to_branch = input.to_branch;
    previous.items = nextItems;
    previous.revision += 1;
    previous.updated_at = now;
    audit(state, context, previous, "Save draft", before);
    return previous;
  }
  const references = (state.branch_requests ?? [])
    .filter((item) => item.company_id === context.company_id)
    .map((item) => Number(/^REQ-(\d+)$/.exec(item.reference)?.[1] ?? 0));
  const request: BranchRequest = {
    id: createId("request"),
    reference: `REQ-${String(Math.max(0, ...references) + 1).padStart(4, "0")}`,
    company_id: context.company_id,
    branch: input.from_branch,
    from_branch: input.from_branch,
    to_branch: input.to_branch,
    status: "draft",
    revision: 1,
    created_at: now,
    created_by: context.actor,
    updated_at: now,
    items: nextItems,
  };
  state.branch_requests ??= [];
  state.branch_requests.push(request);
  audit(state, context, request, "Save draft");
  return request;
}
export function sendBranchRequest(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
  revision: number,
) {
  const request = record(state, context, id, revision);
  endpoint(state, context, request.from_branch);
  status(request, "draft");
  if (!configuredBranches(state.config).includes(request.to_branch))
    fail("location");
  const before = structuredClone(request);
  request.requested_at = new Date().toISOString();
  request.requested_by = context.actor;
  transition(state, context, request, "requested", "Send request", before);
  return request;
}
export interface SendingDecision {
  item_id: string;
  decision: "sent" | "short";
  sent_quantity?: string;
}
export interface ReceivingDecision {
  item_id: string;
  decision: "received" | "missing";
  received_quantity?: string;
}
function subsetQuantity(
  item: BranchRequestItem,
  value: string,
  maximum: string,
) {
  const quantity = decimal(value, false);
  if (quantity.gt(decimal(maximum, false))) fail("quantity");
  if (quantity.isZero())
    return { quantity: "0", units: item.normalized_units === null ? null : 0 };
  return {
    quantity: quantity.toFixed(),
    units: requestQuantityUnits(
      quantity.toFixed(),
      item.quantity_unit,
      item.units_per_case,
    ),
  };
}
function transfer(
  state: DemoState,
  context: BranchRequestContext,
  request: BranchRequest,
  item: BranchRequestItem,
  quantity: string,
  kind: RequestTransferEvent["kind"],
) {
  if (new Decimal(quantity).isZero()) return;
  const normalized_units = requestQuantityUnits(
    quantity,
    item.quantity_unit,
    item.units_per_case,
  );
  const event: RequestTransferEvent = {
    id: createId("request-transfer"),
    company_id: context.company_id,
    request_id: request.id,
    item_id: item.id,
    kind,
    branch: context.branch,
    from_branch: request.to_branch,
    to_branch: request.from_branch,
    product_code: item.product_code,
    name_en: item.name_en,
    name_fa: item.name_fa,
    free_text: item.free_text,
    quantity,
    quantity_unit: item.quantity_unit,
    units_per_case: item.units_per_case,
    normalized_units,
    at: new Date().toISOString(),
    by: context.actor,
    username: context.username,
    device: context.device,
  };
  state.request_transfer_events ??= [];
  state.request_transfer_events.push(event);
  if (item.product_code && normalized_units !== null) {
    state.stock_movements ??= [];
    state.stock_movements.push({
      id: event.id,
      company_id: context.company_id,
      branch: context.branch,
      product_code: item.product_code,
      qty: kind === "transfer_sent" ? -normalized_units : normalized_units,
      type: kind,
      reference: request.reference,
      by: context.actor,
      at: event.at,
    });
  }
}
export function markBranchRequestSent(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
  revision: number,
  decisions: SendingDecision[],
) {
  const request = record(state, context, id, revision);
  endpoint(state, context, request.to_branch);
  status(request, "requested");
  if (
    decisions.length !== request.items.length ||
    new Set(decisions.map((item) => item.item_id)).size !== decisions.length
  )
    fail("decision");
  const resolved = request.items.map((item) => {
    const decision = decisions.find((entry) => entry.item_id === item.id);
    if (!decision || !["sent", "short"].includes(decision.decision))
      fail("decision");
    const value = subsetQuantity(
      item,
      decision.decision === "sent"
        ? item.quantity
        : (decision.sent_quantity ?? "0"),
      item.quantity,
    );
    if (
      decision.decision === "short" &&
      new Decimal(value.quantity).eq(item.quantity)
    )
      fail("decision");
    return { item, decision: decision.decision, quantity: value.quantity };
  });
  const before = structuredClone(request);
  for (const entry of resolved) {
    entry.item.sending_decision = entry.decision;
    entry.item.sent_quantity = entry.quantity;
    entry.item.short_quantity = new Decimal(entry.item.quantity)
      .minus(entry.quantity)
      .toFixed();
    transfer(
      state,
      context,
      request,
      entry.item,
      entry.quantity,
      "transfer_sent",
    );
  }
  request.sent_at = new Date().toISOString();
  request.sent_by = context.actor;
  transition(state, context, request, "sent", "Mark as sent", before);
  return request;
}
export function markBranchRequestReceived(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
  revision: number,
  decisions: ReceivingDecision[],
) {
  const request = record(state, context, id, revision);
  endpoint(state, context, request.from_branch);
  status(request, "sent");
  const shipped = request.items.filter((item) =>
    new Decimal(item.sent_quantity ?? "0").gt(0),
  );
  if (
    decisions.length !== shipped.length ||
    new Set(decisions.map((item) => item.item_id)).size !== decisions.length
  )
    fail("decision");
  const resolved = shipped.map((item) => {
    const decision = decisions.find((entry) => entry.item_id === item.id);
    if (!decision || !["received", "missing"].includes(decision.decision))
      fail("decision");
    const value = subsetQuantity(
      item,
      decision.decision === "received"
        ? item.sent_quantity!
        : (decision.received_quantity ?? "0"),
      item.sent_quantity!,
    );
    if (
      decision.decision === "missing" &&
      new Decimal(value.quantity).eq(item.sent_quantity!)
    )
      fail("decision");
    return { item, decision: decision.decision, quantity: value.quantity };
  });
  const before = structuredClone(request);
  for (const entry of resolved) {
    entry.item.receiving_decision = entry.decision;
    entry.item.received_quantity = entry.quantity;
    entry.item.missing_quantity = new Decimal(entry.item.sent_quantity!)
      .minus(entry.quantity)
      .toFixed();
    transfer(
      state,
      context,
      request,
      entry.item,
      entry.quantity,
      "transfer_received",
    );
  }
  for (const item of request.items.filter((item) =>
    new Decimal(item.sent_quantity ?? "0").isZero(),
  )) {
    item.received_quantity = "0";
    item.missing_quantity = "0";
  }
  request.received_at = new Date().toISOString();
  request.received_by = context.actor;
  transition(state, context, request, "received", "Mark as received", before);
  return request;
}
export function closeBranchRequest(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
  revision: number,
) {
  const request = record(state, context, id, revision);
  endpoint(state, context, request.from_branch);
  status(request, "received");
  const before = structuredClone(request);
  request.closed_at = new Date().toISOString();
  request.closed_by = context.actor;
  transition(state, context, request, "closed", "Close request", before);
  return request;
}
export function cancelBranchRequest(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
  revision: number,
  reason: string,
) {
  const request = record(state, context, id, revision);
  endpoint(state, context, request.from_branch);
  if (!["draft", "requested"].includes(request.status)) fail("status");
  if (!reason.trim()) fail("reason");
  const before = structuredClone(request);
  request.cancellation_reason = reason.trim();
  request.cancelled_at = new Date().toISOString();
  request.cancelled_by = context.actor;
  transition(state, context, request, "cancelled", "Cancel request", before);
  return request;
}
export function branchRequestResidual(request: BranchRequest) {
  if (!["sent", "received", "closed"].includes(request.status)) return [];
  return request.items.flatMap((item) => {
    const completed =
      request.status === "sent"
        ? (item.sent_quantity ?? "0")
        : (item.received_quantity ?? "0");
    const remainder = new Decimal(item.quantity).minus(completed);
    return remainder.gt(0)
      ? [
          {
            ...item,
            quantity: remainder.toFixed(),
            normalized_units: requestQuantityUnits(
              remainder.toFixed(),
              item.quantity_unit,
              item.units_per_case,
            ),
          },
        ]
      : [];
  });
}
export function copyBranchRequestResidual(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
  revision: number,
) {
  const request = record(state, context, id, revision);
  endpoint(state, context, request.from_branch);
  const existing = state.branch_requests?.find(
    (item) =>
      item.company_id === context.company_id &&
      item.source_request_id === request.id &&
      item.source_revision === revision &&
      item.status !== "cancelled",
  );
  const residual = availableBranchRequestResidual(state, request);
  if (!residual.length) {
    if (existing) return existing;
    fail("residual");
  }
  // Build a new draft. Original decisions and physical evidence remain immutable.
  const copied = saveBranchRequestDraft(state, context, {
    from_branch: request.from_branch,
    to_branch: request.to_branch,
    items: residual.map((item) => ({
      kind: item.kind,
      product_code: item.product_code,
      free_text: item.free_text,
      quantity: item.quantity,
      quantity_unit: item.quantity_unit,
      units_per_case: item.units_per_case,
      note: item.note,
    })),
  });
  copied.source_request_id = request.id;
  copied.source_revision = revision;
  copied.items.forEach((item, index) => {
    item.source_item_id = residual[index].id;
  });
  const activity = state.activity.at(-1);
  if (activity?.entity_id === copied.id) {
    activity.action = "Copy short or missing items";
    activity.after = structuredClone(copied);
  }
  return copied;
}
export function availableBranchRequestResidual(
  state: DemoState,
  request: BranchRequest,
) {
  return branchRequestResidual(request).flatMap((item) => {
    const copies = (state.branch_requests ?? [])
      .filter(
        (entry) =>
          entry.company_id === request.company_id &&
          entry.source_request_id === request.id &&
          entry.status !== "cancelled",
      )
      .flatMap((entry) => entry.items)
      .filter((entry) => entry.source_item_id === item.id);
    if (item.normalized_units !== null) {
      const copiedUnits = copies.reduce(
        (sum, entry) =>
          sum.plus(
            requestQuantityUnits(
              entry.quantity,
              entry.quantity_unit,
              entry.units_per_case,
            ) ?? 0,
          ),
        new Decimal(0),
      );
      const remainingUnits = new Decimal(item.normalized_units).minus(
        copiedUnits,
      );
      if (!remainingUnits.gt(0)) return [];
      const cases =
        item.quantity_unit === "cases"
          ? remainingUnits.div(item.units_per_case!)
          : remainingUnits;
      // Some packs (e.g. three) cannot express a residual unit as an exact
      // finite decimal case fraction. Keep the truthful whole-unit remainder.
      let asCases = false;
      if (item.quantity_unit === "cases") {
        try {
          asCases =
            requestQuantityUnits(
              cases.toFixed(),
              "cases",
              item.units_per_case,
            ) === remainingUnits.toNumber();
        } catch {
          /* A recurring case fraction stays in whole Units. */
        }
      }
      return [
        {
          ...item,
          quantity: (asCases ? cases : remainingUnits).toFixed(),
          quantity_unit: asCases ? ("cases" as const) : ("units" as const),
          normalized_units: remainingUnits.toNumber(),
        },
      ];
    }
    const copied = copies.reduce(
      (sum, entry) => sum.plus(entry.quantity),
      new Decimal(0),
    );
    const remaining = new Decimal(item.quantity).minus(copied);
    return remaining.gt(0)
      ? [
          {
            ...item,
            quantity: remaining.toFixed(),
            normalized_units: requestQuantityUnits(
              remaining.toFixed(),
              item.quantity_unit,
              item.units_per_case,
            ),
          },
        ]
      : [];
  });
}
export function pickingListSnapshot(
  state: DemoState,
  context: BranchRequestContext,
  id: string,
) {
  const request = listBranchRequests(state, context).find(
    (item) => item.id === id,
  );
  if (!request) fail("scope");
  return structuredClone(request);
}
