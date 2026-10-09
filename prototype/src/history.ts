import { createId } from "./ids";
import { configuredBranches, branchId } from "./settings";
import type { Activity, Branch, DemoState, Role } from "./types";

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
    "archive" | "deactivate" | "stop" | "reject" | "resolve" | "remove";
  guards?: { path: HistoryPath; after?: unknown; exists: boolean }[];
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
  "suppliers",
  "supplier_items",
  "notebooks",
  "notebook_entries",
  "label_waitlist",
  "label_settings",
]);
const neverUndo =
  /print|posted invoice|invoice_posted|payment|ledger|opening count|opening balance|stock|return_|replacement|received short|new_supplier_confirmed/i;
const simpleActions = new Set([
  "Stop offer",
  "Dismiss",
  "Confirm offer",
  "Create offer",
  "Approve price",
  "Approve product",
  "Apply price to all branches",
  "Keep approved price",
  "Mark as taken care of",
  "expiry_cleared",
  "note_seen",
  "note_resolved",
  "note_added",
  "Save draft",
  "Edit draft",
]);
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
function unsafeTransaction(before: DemoState, after: DemoState): boolean {
  return (
    !equal(before.ledger, after.ledger) ||
    !equal(before.stock, after.stock) ||
    !equal(before.stock_movements, after.stock_movements) ||
    !equal(before.returns, after.returns) ||
    !equal(before.invoices, after.invoices) ||
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
  const unsafe = unsafeTransaction(before, after);
  for (const entry of entries) {
    entry.by = context.actor;
    entry.actor_username = context.username;
    entry.device = "Browser";
    if (entry.reversal_kind) continue;
    const allowed =
      entry.reversible !== false &&
      (entry.reversible === true || simpleActions.has(entry.action));
    entry.reversible = Boolean(
      allowed &&
      patches.length &&
      !unsafe &&
      !neverUndo.test(entry.action) &&
      patches.every((patch) => patch.before_exists || patch.creation),
    );
    if (!entry.reversible) continue;
    entry.reversal = structuredClone(patches);
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
) {
  if (typeof patch.path[0] !== "string" || !safeRoots.has(patch.path[0]))
    throw new HistoryError("irreversible");
  if (
    context.role !== "supervisor" &&
    ![
      "notes",
      "expiry",
      "notebook_entries",
      "label_waitlist",
      "invoice",
      "templates",
      "offers",
    ].includes(patch.path[0])
  )
    throw new HistoryError("permission");
  for (let i = 1; i <= patch.path.length; i++) {
    const value = readPath(state, patch.path.slice(0, i)).value;
    if (!own(value)) continue;
    if (
      typeof value.company_id === "string" &&
      value.company_id !== context.company_id
    )
      throw new HistoryError("scope");
    if (
      typeof value.branch === "string" &&
      value.branch !== "all" &&
      !context.allowed_branches.includes(value.branch)
    )
      throw new HistoryError("scope");
    if (value.status === "posted" && patch.path[0] === "invoice")
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
  for (const { patch } of preview) patchScope(state, patch, context);
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
        ].some(
          (record) =>
            record.company_id === context.company_id && record.branch === id,
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
      writePath(candidate, patch.path, record, true);
    } else writePath(candidate, patch.path, patch.before, patch.before_exists);
  }
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
