import { createId } from "./ids";
import { configuredBranches, branchId } from "./settings";
import { effectiveExpiryLocation } from "./received";
import type { Activity, Branch, DemoState, Role } from "./types";
import type { RequestTransferEvent } from "./branch-requests";
import Decimal from "decimal.js";

export interface HistoryContext {
  company_id: string;
  role: Role;
  actor: string;
  username?: string;
  branch: Branch;
  allowed_branches: Branch[];
}
export type HistoryPath = (string | { key: string; value: string })[];
export interface ReversalPatch {
  path: HistoryPath;
  before?: unknown;
  after?: unknown;
  before_exists: boolean;
  after_exists: boolean;
  creation?:
    | "archive"
    | "deactivate"
    | "stop"
    | "reject"
    | "resolve"
    | "remove"
    | "cancel"
    | "clear";
  guards?: { path: HistoryPath; after?: unknown; exists: boolean }[];
  /** Immutable originals retained when recording a request transition is undone. */
  transfer_events?: RequestTransferEvent[];
  transfer_movements?: NonNullable<DemoState["stock_movements"]>;
}
export type HistoryErrorCode =
  | "permission"
  | "scope"
  | "irreversible"
  | "conflict"
  | "barcode_conflict"
  | "expired";
export class HistoryError extends Error {
  constructor(public readonly code: HistoryErrorCode) {
    super(code);
  }
}
const own = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const equal = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length && left.every((v, i) => equal(v, right[i]))
    );
  if (own(left) && own(right)) {
    const a = Object.keys(left).filter((key) => left[key] !== undefined);
    const b = Object.keys(right).filter((key) => right[key] !== undefined);
    return (
      a.length === b.length && a.every((key) => equal(left[key], right[key]))
    );
  }
  return false;
};
const safeRoots = new Set([
  "config",
  "products",
  "approvals",
  "alerts",
  "offers",
  "templates",
  "expiry",
  "notes",
  "invoice",
  "invoices",
  "suppliers",
  "supplier_items",
  "notebooks",
  "notebook_entries",
  "label_waitlist",
  "label_settings",
  "orders",
  "branch_requests",
]);
const neverUndo =
  /print|posted invoice|invoice_posted|payment|ledger|opening count|opening balance|stock|return_|replacement|received short|new_supplier_confirmed|move invoice|correct invoice|invoice_location_correction|invoice_content_correction/i;
const simpleActions = new Set([
  "Stop offer",
  "Dismiss",
  "Confirm offer",
  "Create offer",
  "Approve price",
  "Approve product",
  "Keep barcode mappings",
  "Reject barcode change",
  "Reject proposal",
  "Apply price to all branches",
  "Keep approved price",
  "Mark as taken care of",
  "expiry_cleared",
  "note_seen",
  "note_resolved",
  "note_added",
  "Save draft",
  "Edit draft",
  "Mark ordered",
  "Add date",
  "Remove date",
  "Stop tracking this product",
]);
const requestActions = new Set([
  "Save draft",
  "Send request",
  "Mark as sent",
  "Mark as received",
  "Close request",
  "Cancel request",
  "Copy short or missing items",
]);
const orderActions = new Set([
  "Create order draft",
  "Edit order draft",
  "Add To order note to draft",
  "Place order",
  "Cancel order",
]);
function eligibleOperationalAction(
  entry: Activity,
  before: DemoState,
  after: DemoState,
) {
  if (
    entry.entity_type === "branch_request" &&
    requestActions.has(entry.action)
  ) {
    const request = after.branch_requests?.find(
      (item) => item.id === entry.entity_id,
    );
    const previous = before.branch_requests?.find(
      (item) => item.id === entry.entity_id,
    );
    if (!request || request.company_id !== entry.company_id) return false;
    const transitions: Record<string, [string | undefined, string][]> = {
      "Save draft": [
        [undefined, "draft"],
        ["draft", "draft"],
      ],
      "Copy short or missing items": [[undefined, "draft"]],
      "Send request": [["draft", "requested"]],
      "Mark as sent": [["requested", "sent"]],
      "Mark as received": [["sent", "received"]],
      "Close request": [["received", "closed"]],
      "Cancel request": [
        ["draft", "cancelled"],
        ["requested", "cancelled"],
      ],
    };
    return transitions[entry.action].some(
      ([from, to]) => previous?.status === from && request.status === to,
    );
  }
  if (entry.entity_type === "order" && orderActions.has(entry.action)) {
    const old = before.orders?.find((item) => item.id === entry.entity_id);
    const order = after.orders?.find((item) => item.id === entry.entity_id);
    if (
      !order ||
      order.company_id !== entry.company_id ||
      order.receipts.length ||
      order.linked_invoice_ids.length
    )
      return false;
    return entry.action === "Create order draft"
      ? !old && order.status === "draft"
      : old?.status === "draft" &&
          ["draft", "ordered", "cancelled"].includes(order.status);
  }
  return (
    entry.entity_type === "supplier" &&
    ["Confirm supplier", "Reject supplier"].includes(entry.action)
  );
}
const creationMode = (root: string): ReversalPatch["creation"] => {
  if (
    [
      "products",
      "notebooks",
      "notebook_entries",
      "notes",
      "templates",
      "supplier_items",
    ].includes(root)
  )
    return "archive";
  if (root === "suppliers") return "deactivate";
  if (root === "offers") return "stop";
  if (root === "approvals") return "reject";
  if (root === "alerts") return "resolve";
  if (["orders", "branch_requests", "invoices"].includes(root)) return "cancel";
  if (root === "expiry") return "clear";
  if (["label_waitlist", "config"].includes(root)) return "remove";
  return undefined;
};

function difference(
  before: unknown,
  after: unknown,
  path: HistoryPath,
  result: ReversalPatch[],
  beforeExists = before !== undefined,
  afterExists = after !== undefined,
) {
  if (equal(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    const key = ["id", "code", "key"].find((candidate) =>
      [...before, ...after].every(
        (item) => own(item) && typeof item[candidate] === "string",
      ),
    );
    if (key) {
      const keys = new Set(
        [...before, ...after].map((item) => String(item[key])),
      );
      for (const value of keys) {
        const a = before.find((item) => item[key] === value);
        const b = after.find((item) => item[key] === value);
        difference(
          a,
          b,
          [...path, { key, value }],
          result,
          a !== undefined,
          b !== undefined,
        );
      }
      return;
    }
  }
  if (own(before) && own(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
      difference(
        before[key],
        after[key],
        [...path, key],
        result,
        before[key] !== undefined,
        after[key] !== undefined,
      );
    return;
  }
  result.push({
    path,
    before: structuredClone(before),
    after: structuredClone(after),
    before_exists: beforeExists,
    after_exists: afterExists,
    ...(!beforeExists && afterExists && typeof path[0] === "string"
      ? {
          creation:
            typeof path.at(-1) === "object"
              ? creationMode(path[0])
              : ("remove" as const),
        }
      : {}),
  });
}
export function changedPaths(
  before: DemoState,
  after: DemoState,
): ReversalPatch[] {
  const result: ReversalPatch[] = [];
  for (const root of safeRoots)
    difference(
      (before as unknown as Record<string, unknown>)[root] ??
        (Array.isArray((after as unknown as Record<string, unknown>)[root])
          ? []
          : undefined),
      (after as unknown as Record<string, unknown>)[root],
      [root],
      result,
    );
  for (const patch of result) {
    let lastRecord = -1;
    for (let index = 0; index < patch.path.length; index++)
      if (typeof patch.path[index] !== "string") lastRecord = index;
    const guardPath =
      lastRecord >= 0
        ? patch.path.slice(0, lastRecord + 1)
        : patch.path[0] === "config"
          ? patch.path.slice(0, Math.min(2, patch.path.length))
          : patch.path.slice(0, 1);
    const record = readPath(after, guardPath);
    patch.guards = [
      {
        path: guardPath,
        after: structuredClone(record.value),
        exists: record.exists,
      },
    ];
    if (
      patch.path[0] === "offers" &&
      own(record.value) &&
      typeof record.value.product_code === "string"
    ) {
      const productPath: HistoryPath = [
        "products",
        { key: "code", value: record.value.product_code },
      ];
      const product = readPath(after, productPath);
      patch.guards.push({
        path: productPath,
        after: structuredClone(product.value),
        exists: product.exists,
      });
    }
  }
  return result;
}
function postedInvoicesChanged(before: DemoState, after: DemoState): boolean {
  const snapshots = [...(before.invoices ?? []), ...(after.invoices ?? [])];
  return snapshots.some(
    (invoice) =>
      invoice.status === "posted" &&
      !equal(
        before.invoices?.find((item) => item.id === invoice.id),
        after.invoices?.find((item) => item.id === invoice.id),
      ),
  );
}
function appendedRequestTransfers(
  before: DemoState,
  after: DemoState,
  entry: Activity,
) {
  if (
    entry.entity_type !== "branch_request" ||
    !["Mark as sent", "Mark as received"].includes(entry.action)
  )
    return null;
  const prior = before.request_transfer_events ?? [];
  const current = after.request_transfer_events ?? [];
  if (!equal(prior, current.slice(0, prior.length))) return null;
  const events = current.slice(prior.length);
  const expectedKind =
    entry.action === "Mark as sent" ? "transfer_sent" : "transfer_received";
  if (
    events.some(
      (event) =>
        event.company_id !== entry.company_id ||
        event.request_id !== entry.entity_id ||
        event.kind !== expectedKind ||
        event.branch !== entry.branch,
    )
  )
    return null;
  const oldMovements = before.stock_movements ?? [];
  const currentMovements = after.stock_movements ?? [];
  if (!equal(oldMovements, currentMovements.slice(0, oldMovements.length)))
    return null;
  const movements = currentMovements.slice(oldMovements.length);
  const catalogEvents = events.filter(
    (event) => event.product_code && event.normalized_units !== null,
  );
  if (
    movements.length !== catalogEvents.length ||
    movements.some(
      (movement) =>
        !catalogEvents.some(
          (event) =>
            movement.id === event.id &&
            movement.company_id === event.company_id &&
            movement.branch === event.branch &&
            movement.product_code === event.product_code &&
            movement.type === event.kind &&
            movement.qty ===
              (event.kind === "transfer_sent"
                ? -event.normalized_units!
                : event.normalized_units!),
        ),
    )
  )
    return null;
  return { events, movements };
}
function unsafeTransaction(
  before: DemoState,
  after: DemoState,
  transfers: ReturnType<typeof appendedRequestTransfers>,
): boolean {
  return (
    !equal(before.ledger, after.ledger) ||
    !equal(before.stock, after.stock) ||
    (!transfers && !equal(before.stock_movements, after.stock_movements)) ||
    (!transfers &&
      !equal(before.request_transfer_events, after.request_transfer_events)) ||
    !equal(before.returns, after.returns) ||
    !equal(
      before.invoice_location_corrections,
      after.invoice_location_corrections,
    ) ||
    postedInvoicesChanged(before, after) ||
    (!equal(before.invoice, after.invoice) &&
      (before.invoice.status === "posted" || after.invoice.status === "posted"))
  );
}

/** Capture only values touched by one atomic action, never the entire saved demo. */
export function attachReversals(
  before: DemoState,
  after: DemoState,
  context: HistoryContext,
): Activity[] {
  const previous = new Set(before.activity.map((entry) => entry.id));
  const entries = after.activity.filter((entry) => !previous.has(entry.id));
  const patches = changedPaths(before, after);
  for (const entry of entries) {
    entry.by = context.actor;
    entry.actor_username = context.username;
    entry.device = "Browser";
    if (entry.reversal_kind) continue;
    if (
      entry.action === "note_resolved" &&
      patches.some(
        (patch) =>
          patch.path[0] === "notes" &&
          patch.path.at(-1) === "status" &&
          patch.guards?.some(
            (guard) => own(guard.after) && guard.after.type === "to_order",
          ),
      )
    )
      entry.action = "Mark ordered";
    // Placing an order and marking its source notes are one transaction. The
    // parent action owns one Undo; its companion audit entries stay retained.
    if (
      entry.action === "To order note ordered" &&
      entries.some((item) => item.action === "Place order")
    ) {
      entry.reversible = false;
      continue;
    }
    const operational = eligibleOperationalAction(entry, before, after);
    const transfers = operational
      ? appendedRequestTransfers(before, after, entry)
      : null;
    const allowed =
      operational ||
      (entry.reversible !== false &&
        (entry.reversible === true || simpleActions.has(entry.action)));
    entry.reversible = Boolean(
      allowed &&
      patches.length &&
      !unsafeTransaction(before, after, transfers) &&
      !neverUndo.test(entry.action) &&
      patches.every((patch) => patch.before_exists || patch.creation),
    );
    if (!entry.reversible) continue;
    entry.reversal = structuredClone(patches);
    if (transfers?.events.length) {
      entry.reversal[0].transfer_events = structuredClone(transfers.events);
      entry.reversal[0].transfer_movements = structuredClone(
        transfers.movements,
      );
    }
    entry.before ??= Object.fromEntries(
      patches.map((patch) => [pathLabel(patch.path), patch.before]),
    );
    entry.after ??= Object.fromEntries(
      patches.map((patch) => [pathLabel(patch.path), patch.after]),
    );
  }
  return entries;
}
function readPath(
  state: unknown,
  path: HistoryPath,
): { exists: boolean; value: unknown } {
  let value = state;
  for (const part of path) {
    if (typeof part === "string") {
      if (!own(value) || value[part] === undefined)
        return { exists: false, value: undefined };
      value = value[part];
    } else {
      if (!Array.isArray(value)) return { exists: false, value: undefined };
      value = value.find(
        (item) => own(item) && String(item[part.key]) === part.value,
      );
      if (value === undefined) return { exists: false, value: undefined };
    }
  }
  return { exists: true, value };
}
function writePath(
  state: unknown,
  path: HistoryPath,
  value: unknown,
  exists: boolean,
) {
  const parentPath = path.slice(0, -1);
  const parent = readPath(state, parentPath).value;
  const part = path.at(-1)!;
  if (typeof part === "string") {
    if (!own(parent)) throw new HistoryError("conflict");
    if (exists) parent[part] = structuredClone(value);
    else delete parent[part];
  } else {
    if (!Array.isArray(parent)) throw new HistoryError("conflict");
    const index = parent.findIndex(
      (item) => own(item) && String(item[part.key]) === part.value,
    );
    if (!exists) {
      if (index >= 0) parent.splice(index, 1);
    } else if (index >= 0) parent[index] = structuredClone(value);
    else parent.push(structuredClone(value));
  }
}
export function pathLabel(path: HistoryPath): string {
  return path
    .map((part) => (typeof part === "string" ? part : part.value))
    .join(" · ");
}
function ownedBy(entry: Activity, context: HistoryContext): boolean {
  return entry.actor_username
    ? entry.actor_username === context.username
    : entry.by === context.actor;
}
const workerSharedActions = new Set([
  "Create template",
  "Save template",
  "Duplicate template",
  "Archive template",
  "Restore template",
  "Add supplier",
  "Add product",
  "Stop offer",
  "Dismiss",
  "Confirm offer",
  "Create offer",
]);
function accessible(entry: Activity, context: HistoryContext): boolean {
  return (
    context.role !== "cashier" &&
    entry.company_id === context.company_id &&
    (entry.branch === "all"
      ? context.role === "supervisor" ||
        workerSharedActions.has(entry.action) ||
        entry.reversal_kind === "undo"
      : context.allowed_branches.includes(entry.branch)) &&
    (context.role === "supervisor" || ownedBy(entry, context))
  );
}
export function selectHistory(
  state: DemoState,
  context: HistoryContext,
): Activity[] {
  if (context.company_id !== state.config.company.seed_key) return [];
  return state.activity
    .filter(
      (entry) =>
        accessible(entry, context) &&
        (entry.branch !== "all" ||
          context.role !== "supervisor" ||
          configuredBranches(state.config, true).every((branch) =>
            context.allowed_branches.includes(branch),
          )),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}
export function hasBeenReversed(state: DemoState, id: string): boolean {
  return state.activity.some((entry) => entry.reversed_activity_id === id);
}
export function canReverse(
  state: DemoState,
  entry: Activity,
  context: HistoryContext,
  mode: "undo" | "revert",
): boolean {
  return (
    accessible(entry, context) &&
    (entry.branch !== "all" ||
      context.role !== "supervisor" ||
      configuredBranches(state.config, true).every((branch) =>
        context.allowed_branches.includes(branch),
      )) &&
    Boolean(entry.reversible && entry.reversal?.length) &&
    !hasBeenReversed(state, entry.id) &&
    (mode === "undo" || context.role === "supervisor") &&
    (mode !== "undo" || ownedBy(entry, context))
  );
}
function patchScope(
  state: DemoState,
  patch: ReversalPatch,
  context: HistoryContext,
  entry: Activity,
) {
  if (typeof patch.path[0] !== "string" || !safeRoots.has(patch.path[0]))
    throw new HistoryError("irreversible");
  const productSelector = patch.path[1];
  const trackedProduct =
    patch.path[0] === "products" &&
    typeof productSelector === "object" &&
    productSelector.key === "code"
      ? state.products.find((product) => product.code === productSelector.value)
      : undefined;
  // C5 authorizes only a worker's explicit tracking switch (or Add date's
  // atomic auto-enable), not general catalog editing through a reversal.
  const workerDatePreference =
    context.role === "floor_worker" &&
    patch.path.length === 3 &&
    patch.path[0] === "products" &&
    patch.path[2] === "date_tracking" &&
    trackedProduct?.company_id === context.company_id &&
    trackedProduct.code === entry.product_code &&
    ["Add date", "Turn on date tracking", "Turn off date tracking"].includes(
      entry.action,
    ) &&
    entry.branch !== "all" &&
    entry.branch === context.branch &&
    context.allowed_branches.includes(entry.branch) &&
    configuredBranches(state.config).includes(entry.branch) &&
    patch.after_exists &&
    typeof patch.after === "boolean" &&
    (!patch.before_exists || typeof patch.before === "boolean") &&
    patch.after === (entry.action !== "Turn off date tracking");
  if (
    context.role !== "supervisor" &&
    !workerDatePreference &&
    ![
      "notes",
      "expiry",
      "notebook_entries",
      "label_waitlist",
      "invoice",
      "templates",
      "offers",
      "orders",
      "branch_requests",
    ].includes(patch.path[0])
  )
    throw new HistoryError("permission");
  if (
    patch.path[0] === "orders" &&
    context.role === "floor_worker" &&
    !state.config.orders?.allow_floor_worker
  )
    throw new HistoryError("permission");
  if (patch.path[0] === "branch_requests") {
    const request = state.branch_requests?.find(
      (item) => item.id === entry.entity_id,
    );
    if (!request || request.company_id !== context.company_id)
      throw new HistoryError("scope");
    const endpoint =
      entry.action === "Mark as sent" ? request.to_branch : request.from_branch;
    if (
      !context.allowed_branches.includes(endpoint) ||
      (context.branch !== endpoint &&
        !(context.role === "supervisor" && context.branch === "all"))
    )
      throw new HistoryError("scope");
  }
  for (let i = 1; i <= patch.path.length; i++) {
    const value = readPath(state, patch.path.slice(0, i)).value;
    if (!own(value)) continue;
    if (
      typeof value.company_id === "string" &&
      value.company_id !== context.company_id
    )
      throw new HistoryError("scope");
    const trackedDate =
      patch.path[0] === "expiry" && typeof value.id === "string"
        ? state.expiry.find(
            (date) =>
              date.id === value.id && date.company_id === value.company_id,
          )
        : undefined;
    const location = trackedDate
      ? effectiveExpiryLocation(state, trackedDate)
      : value.branch;
    if (
      typeof location === "string" &&
      location !== "all" &&
      patch.path[0] !== "branch_requests" &&
      !context.allowed_branches.includes(location)
    )
      throw new HistoryError("scope");
    if (
      value.status === "posted" &&
      ["invoice", "invoices"].includes(String(patch.path[0]))
    )
      throw new HistoryError("irreversible");
  }
  if (
    patch.path[0] === "products" &&
    patch.path.some(
      (part) =>
        typeof part === "string" && ["code", "company_id"].includes(part),
    )
  )
    throw new HistoryError("irreversible");
}
export function historyChangePreview(
  state: DemoState,
  entry: Activity,
): { patch: ReversalPatch; current: unknown; conflict: boolean }[] {
  return (entry.reversal ?? []).map((patch) => {
    const current = readPath(state, patch.path);
    return {
      patch,
      current: current.value,
      conflict:
        current.exists !== patch.after_exists ||
        !equal(current.value, patch.after) ||
        Boolean(
          patch.guards?.some((guard) => {
            const value = readPath(state, guard.path);
            return (
              value.exists !== guard.exists || !equal(value.value, guard.after)
            );
          }),
        ),
    };
  });
}

/** Validation precedes every mutation, and the audit trail is append-only. */
export function reverseActivity(
  state: DemoState,
  context: HistoryContext,
  id: string,
  mode: "undo" | "revert",
  now = new Date(),
): Activity {
  if (context.company_id !== state.config.company.seed_key)
    throw new HistoryError("scope");
  const entry = state.activity.find((item) => item.id === id);
  if (!entry || !accessible(entry, context))
    throw new HistoryError("permission");
  if (!canReverse(state, entry, context, mode))
    throw new HistoryError("irreversible");
  const preview = historyChangePreview(state, entry);
  if (preview.some((item) => item.conflict)) throw new HistoryError("conflict");
  for (const { patch } of preview) patchScope(state, patch, context, entry);
  const request =
    entry.entity_type === "branch_request"
      ? state.branch_requests?.find((item) => item.id === entry.entity_id)
      : undefined;
  if (
    request &&
    (state.branch_requests ?? []).some(
      (item) =>
        item.company_id === context.company_id &&
        item.source_request_id === request.id &&
        item.status !== "cancelled",
    )
  )
    throw new HistoryError("conflict");
  const order =
    entry.entity_type === "order"
      ? state.orders?.find((item) => item.id === entry.entity_id)
      : undefined;
  if (
    order &&
    (order.receipts.length ||
      order.linked_invoice_ids.length ||
      [state.invoice, ...(state.invoices ?? [])].some(
        (invoice) =>
          invoice.status === "posted" &&
          invoice.company_id === context.company_id &&
          invoice.order_id === order.id,
      ))
  )
    throw new HistoryError("conflict");
  for (const { patch } of preview) {
    for (const event of patch.transfer_events ?? []) {
      if (
        !equal(
          state.request_transfer_events?.find((item) => item.id === event.id),
          event,
        ) ||
        state.request_transfer_events?.some(
          (item) => item.reverses_event_id === event.id,
        )
      )
        throw new HistoryError("conflict");
    }
    for (const movement of patch.transfer_movements ?? [])
      if (
        !equal(
          state.stock_movements?.find((item) => item.id === movement.id),
          movement,
        )
      )
        throw new HistoryError("conflict");
  }
  for (const { patch } of preview) {
    if (
      patch.path[0] === "supplier_items" &&
      !patch.before_exists &&
      patch.creation === "archive" &&
      own(patch.after) &&
      typeof patch.after.id === "string"
    ) {
      const itemId = patch.after.id;
      if (
        [state.invoice, ...(state.invoices ?? [])].some(
          (invoice) =>
            invoice.company_id === context.company_id &&
            invoice.lines.some((line) => line.supplier_item_id === itemId),
        ) ||
        (state.orders ?? []).some(
          (order) =>
            order.company_id === context.company_id &&
            order.lines.some((line) => line.supplier_item_id === itemId),
        )
      )
        throw new HistoryError("conflict");
    }
    if (
      patch.path[0] === "config" &&
      patch.path[1] === "pricing_categories" &&
      !patch.before_exists &&
      patch.creation === "remove" &&
      own(patch.after) &&
      typeof patch.after.key === "string"
    ) {
      const key = patch.after.key;
      if (
        state.products.some(
          (product) =>
            product.company_id === context.company_id &&
            product.pricing_category === key,
        ) ||
        [state.invoice, ...(state.invoices ?? [])].some(
          (invoice) =>
            invoice.company_id === context.company_id &&
            invoice.lines.some((line) => line.pricing_category === key),
        )
      )
        throw new HistoryError("conflict");
    }
    if (
      patch.path[0] === "config" &&
      patch.path[1] === "branches" &&
      !patch.before_exists &&
      patch.creation === "remove" &&
      own(patch.after)
    ) {
      const id = branchId(
        patch.after as DemoState["config"]["branches"][number],
      );
      if (
        [
          ...state.ledger,
          ...(state.invoices ?? []),
          ...state.returns,
          ...state.notes,
          ...state.expiry,
          ...(state.notebook_entries ?? []),
          ...(state.label_waitlist ?? []),
          ...(state.stock_movements ?? []),
          ...(state.orders ?? []),
        ].some(
          (record) =>
            record.company_id === context.company_id && record.branch === id,
        ) ||
        (state.branch_requests ?? []).some(
          (request) =>
            request.company_id === context.company_id &&
            [request.from_branch, request.to_branch].includes(id),
        ) ||
        (state.invoice.branch === id && state.invoice.status !== "empty")
      )
        throw new HistoryError("conflict");
    }
  }
  const candidate = structuredClone(state);
  for (const { patch } of [...preview].reverse()) {
    if (!patch.before_exists && patch.creation && patch.creation !== "remove") {
      const record = structuredClone(patch.after) as Record<string, unknown>;
      if (patch.creation === "archive") {
        record.archived = true;
        if (patch.path[0] === "products") record.status = "archived";
      }
      if (patch.creation === "deactivate") record.active = false;
      if (patch.creation === "stop") record.status = "stopped";
      if (patch.creation === "resolve") record.status = "resolved";
      if (patch.creation === "reject") {
        record.status = "rejected";
        record.reason = "Reverted approved decision";
      }
      if (patch.creation === "cancel") record.status = "cancelled";
      if (patch.creation === "clear") {
        record.status = "removed";
        record.removal_action = "undo";
        record.removed_by = context.actor;
        record.removed_at = now.toISOString();
      }
      writePath(candidate, patch.path, record, true);
    } else writePath(candidate, patch.path, patch.before, patch.before_exists);
  }
  // Original quantities remain immutable. These inverse entries correct the
  // recording only; they are not receipts or evidence that goods moved back.
  for (const { patch } of preview) {
    for (const event of patch.transfer_events ?? []) {
      candidate.request_transfer_events ??= [];
      candidate.request_transfer_events.push({
        ...structuredClone(event),
        id: createId("request-transfer-correction"),
        kind: "transfer_correction",
        reverses_event_id: event.id,
        quantity: new Decimal(event.quantity).negated().toFixed(),
        normalized_units:
          event.normalized_units === null ? null : -event.normalized_units,
        at: now.toISOString(),
        by: context.actor,
        username: context.username,
        device: "Browser",
      });
    }
    for (const movement of patch.transfer_movements ?? []) {
      candidate.stock_movements ??= [];
      candidate.stock_movements.push({
        ...structuredClone(movement),
        id: createId("request-movement-correction"),
        type: "request_transfer_correction",
        qty: -movement.qty,
        reference: movement.id,
        by: context.actor,
        at: now.toISOString(),
      });
    }
  }
  if (request) {
    const restored = candidate.branch_requests!.find(
      (item) => item.id === request.id,
    )!;
    restored.revision = request.revision + 1;
    restored.updated_at = now.toISOString();
  }
  if (order)
    candidate.orders!.find((item) => item.id === order.id)!.version =
      order.version + 1;
  // Names are labels, while older invoice/ledger records retain their original
  // supplier text. Restoring a display name must keep every recorded alias.
  for (const supplier of candidate.suppliers ?? []) {
    if (supplier.company_id !== context.company_id) continue;
    const current = state.suppliers?.find(
      (record) =>
        record.company_id === context.company_id && record.id === supplier.id,
    );
    if (!current || supplier.name === current.name) continue;
    supplier.previous_names = [
      ...new Set([
        ...(supplier.previous_names ?? []),
        ...(current.previous_names ?? []),
        current.name,
      ]),
    ].filter((name) => name !== supplier.name);
  }
  const barcodes = new Set<string>();
  for (const product of candidate.products.filter(
    (item) =>
      item.company_id === context.company_id && item.status !== "archived",
  )) {
    if (!product.barcode) continue;
    if (barcodes.has(product.barcode))
      throw new HistoryError("barcode_conflict");
    barcodes.add(product.barcode);
  }
  const audit: Activity = {
    id: createId("history"),
    company_id: context.company_id,
    branch: entry.branch,
    action: mode === "undo" ? "Undone" : `Reverted ${entry.action}`,
    by: context.actor,
    actor_username: context.username,
    device: "Browser",
    at: now.toISOString(),
    product_code: entry.product_code,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    before: entry.after,
    after:
      entry.entity_type === "supplier"
        ? structuredClone(
            candidate.suppliers?.find(
              (record) =>
                record.company_id === context.company_id &&
                record.id === entry.entity_id,
            ) ?? entry.before,
          )
        : entry.before,
    reversible: false,
    reversed_activity_id: entry.id,
    reversal_kind: mode,
  };
  candidate.activity.push(audit);
  Object.assign(state, candidate);
  return audit;
}

/** Earlier A2 product snapshots become conflict-aware patches without rewriting evidence. */
export function hydrateLegacyReversals(state: DemoState): void {
  for (const entry of state.activity) {
    if (
      !entry.reversible ||
      entry.reversal?.length ||
      !own(entry.before) ||
      !own(entry.after)
    )
      continue;
    if (!own(entry.before.product) || !own(entry.after.product)) continue;
    const before = structuredClone(state),
      after = structuredClone(state);
    for (const [target, snapshot] of [
      [before, entry.before],
      [after, entry.after],
    ] as const) {
      const product = snapshot.product as DemoState["products"][number];
      target.products = target.products.map((item) =>
        item.code === product.code && item.company_id === entry.company_id
          ? structuredClone(product)
          : item,
      );
      for (const root of ["offers", "alerts", "approvals"] as const) {
        if (!Array.isArray(snapshot[root])) continue;
        (target as unknown as Record<string, unknown>)[root] = [
          ...target[root].filter(
            (item) =>
              item.company_id !== entry.company_id ||
              item.product_code !== product.code,
          ),
          ...structuredClone(snapshot[root]),
        ];
      }
    }
    entry.reversal = changedPaths(before, after);
    if (entry.reversal.some((patch) => !patch.before_exists && !patch.creation))
      entry.reversible = false;
  }
}
