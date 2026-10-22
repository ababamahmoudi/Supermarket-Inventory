import type {
  AuthenticatedActor,
  DecisionAttribution,
  RoleId,
  SystemAttribution,
} from "./authority-types";
import {
  freshActor,
  decisionAttribution,
  cloneWithAuthority,
} from "./authority";
import {
  BrowserAuthorityRepository,
  requireSystemReconciliation,
} from "./authority-repository";
import { can, requireCapability, directoryRecipients } from "./permissions";
import { actorAudit, domainScope, selectedLocations } from "./domain-authority";
import { effectivePrice, regularPrice, effectiveOffer } from "./catalog";
import {
  activeSaleAt,
  saleStoreDate,
  salePriceDisplay,
  saleDateAfter,
  sellingSaleBranches,
  type NotificationKind,
} from "./sales";
import { companyLocalToUtc } from "./company-time";
import { weightPriceDisplay } from "./weighed";
import { effectiveClearanceOffers } from "./receipt-lots";
import { configSeed } from "./config";
import { createId } from "./ids";
import { sha256Bytes } from "./sha256";
import { projectProductReadDTO } from "./catalog-read-model";
import { projectSaleReadDTO, projectOfferReadDTO } from "./offers-read-model";
import { ensureBuiltInLabelTemplates, labelPages } from "./labels";
import {
  addLabelsToWaitlist,
  addClearanceLabelToWaitlist,
  validateLabelTemplate,
  type LabelPrintSnapshot,
  type LabelPrintProduct,
} from "./label-workflow";
import type { DemoState, Activity } from "./types";
import { syncSupplierProfileNotifications } from "./supplier-profiles";

export interface PriceUpdatesSettings {
  allow_floor_worker_complete: boolean;
  remind_after_hours: number;
  escalate_after_hours: number;
}
export const notificationEvents = [
  "price_updates",
  "approvals_waiting",
  "branch_requests",
  "returns_waiting_for_credit",
  "expiring_dates",
  "sale_requests",
  "sale_decisions",
  "cost_went_up_during_sale",
] as const;
export type NotificationEvent = (typeof notificationEvents)[number];
export interface NotificationSettings {
  events: Record<NotificationEvent, RoleId[]>;
}
export interface PriceSnapshot {
  price: string | null;
  regular_price: string | null;
  canonical_price?: string | null;
  canonical_regular_price?: string | null;
  secondary_price?: { price: string; unit: "lb" | "kg" };
  unit: "each" | "lb" | "kg";
  sale_id?: string;
  sale_last_day?: string | null;
  offer_id?: string;
  offer_label?: string;
  offer_price?: string;
  offer_pool?: string;
  clearance_offers?: {
    id: string;
    lot_id?: string;
    price: string;
    label: string;
    expiry_date?: string;
  }[];
}
export interface PriceTaskAcknowledgement {
  by_user_id: string;
  by: string;
  at: string;
  version: number;
}
export interface PriceTaskStep {
  version: number;
  old_price: PriceSnapshot;
  new_price: PriceSnapshot;
  at: string;
  reason: string;
  effective_at: string;
  source_activity_id?: string;
  decided_by?: string;
  decided_by_user_id?: string;
  source_decision?: DecisionAttribution;
}
export interface PriceUpdateTask {
  id: string;
  company_id: string;
  branch: string;
  product_code: string;
  version: number;
  status: "pending" | "done" | "cancelled";
  old_price: PriceSnapshot;
  new_price: PriceSnapshot;
  created_at: string;
  updated_at: string;
  effective_at: string;
  due_at: string;
  reason: string;
  source_activity_id?: string;
  decided_by?: string;
  decided_by_user_id?: string;
  source_decision?: DecisionAttribution;
  steps: PriceTaskStep[];
  /** Who first opened and acknowledged this version of the change. */
  seen?: PriceTaskAcknowledgement;
  /** Older checklist evidence; retained for history, no longer required. */
  register_changed?: PriceTaskAcknowledgement;
  label_printed?: PriceTaskAcknowledgement & { print_id: string };
  no_label?: PriceTaskAcknowledgement & { reason: string };
  acted_at?: string;
  completed_by?: string;
  completed_by_user_id?: string;
  completed_at?: string;
  cancelled_at?: string;
  sale_end_preparation?: { sale_id: string; last_day: string };
  reminded_at?: string;
  escalated_at?: string;
}
export interface PriceChangeHint {
  task_id: string;
  company_id: string;
  branch: string;
  product_code: string;
  old_price: string | null;
  new_price: string | null;
  effective_at: string;
  old_unit: "each" | "lb" | "kg";
  new_unit: "each" | "lb" | "kg";
}
export interface PriceTaskPrintItem {
  task_id: string;
  version: number;
  product_code: string;
  name_en: string;
  name_fa: string;
  barcode: string;
  price: PriceSnapshot;
  template: "regular" | "promo";
}
export interface PriceTaskPrint {
  id: string;
  company_id: string;
  branch: string;
  created_at: string;
  items: PriceTaskPrintItem[];
  batches: LabelPrintSnapshot[];
  printed_at?: string;
  printed_by_user_id?: string;
}
export class PriceUpdatesError extends Error {
  constructor(
    readonly code:
      | "permission"
      | "task"
      | "status"
      | "checkboxes"
      | "reason"
      | "settings"
      | "stale_print"
      | "print",
  ) {
    super(code);
  }
}
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  return value;
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b));
const keyFor = (branch: string, code: string) => JSON.stringify([branch, code]);
const hashRaw = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
export function priceUpdatesSettings(
  state: Pick<DemoState, "config">,
): PriceUpdatesSettings {
  return { ...configSeed.price_updates, ...state.config.price_updates };
}
export function notificationSettings(
  state: Pick<DemoState, "config">,
): NotificationSettings {
  const configured = state.config.notifications;
  return {
    events: Object.fromEntries(
      notificationEvents.map((event) => [
        event,
        [
          ...(configured?.events[event] ??
            configSeed.notifications.events[event]),
        ],
      ]),
    ) as NotificationSettings["events"],
  };
}
function snapshot(
  state: DemoState,
  code: string,
  branch: string,
  now: Date,
): PriceSnapshot {
  const product = state.products.find(
    (row) =>
      row.company_id === state.config.company.seed_key && row.code === code,
  );
  const sale = product && activeSaleAt(state, product, branch, now);
  const offer = product && effectiveOffer(state, product, branch, now);
  const clearance = product
    ? effectiveClearanceOffers(state, product, branch, now)
        .map((row) => ({
          id: row.id,
          lot_id: row.lot_id,
          price: row.price,
          label: row.label,
          expiry_date: row.expiry_date,
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];
  const canonicalPrice = product
    ? effectivePrice(state, product, branch, now)
    : null;
  const canonicalRegular = product
    ? regularPrice(state, product, branch)
    : null;
  const weight =
    product?.sold_by === "weight" && canonicalPrice
      ? sale
        ? salePriceDisplay(sale, state.config)
        : weightPriceDisplay(canonicalPrice, state.config)
      : null;
  const weightRegular =
    product?.sold_by === "weight" && canonicalRegular
      ? weightPriceDisplay(canonicalRegular, state.config)
      : null;
  return {
    price: weight?.main.amount ?? canonicalPrice,
    regular_price: weightRegular?.main.amount ?? canonicalRegular,
    canonical_price: canonicalPrice,
    canonical_regular_price: canonicalRegular,
    unit: weight?.main.unit ?? "each",
    ...(weight?.secondary &&
    (weight.secondary.unit === "lb" || weight.secondary.unit === "kg")
      ? {
          secondary_price: {
            price: weight.secondary.amount,
            unit: weight.secondary.unit,
          },
        }
      : {}),
    ...(sale ? { sale_id: sale.id, sale_last_day: sale.last_day } : {}),
    ...(offer
      ? {
          offer_id: offer.id,
          offer_label: offer.label,
          offer_price: offer.price,
          offer_pool: offer.pool,
        }
      : {}),
    ...(clearance.length ? { clearance_offers: clearance } : {}),
  };
}
/** The task adapter sees only customer terms; receipt cost/margin/financial state never enters its baseline. */
function snapshots(state: DemoState, now: Date) {
  const output: Record<string, PriceSnapshot> = {};
  for (const branch of sellingSaleBranches(state))
    for (const product of state.products)
      if (
        product.company_id === state.config.company.seed_key &&
        product.status === "active"
      )
        output[keyFor(branch, product.code)] = snapshot(
          state,
          product.code,
          branch,
          now,
        );
  return output;
}
function changed(a: PriceSnapshot, b: PriceSnapshot) {
  // A regular proposal hidden by an active sale does not change the price the store charges today.
  return (
    a.price !== b.price ||
    a.unit !== b.unit ||
    a.sale_id !== b.sale_id ||
    a.sale_last_day !== b.sale_last_day ||
    a.offer_id !== b.offer_id ||
    a.offer_label !== b.offer_label ||
    a.offer_price !== b.offer_price ||
    a.offer_pool !== b.offer_pool ||
    !same(a.secondary_price, b.secondary_price) ||
    !same(a.clearance_offers ?? [], b.clearance_offers ?? [])
  );
}
function taskScope(state: DemoState, task: PriceUpdateTask, mutation = false) {
  return domainScope(state, task, mutation);
}
function taskFor(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  capability:
    | "price_updates.read"
    | "price_updates.register_confirm"
    | "price_updates.label_confirm"
    | "price_updates.complete" = "price_updates.read",
) {
  const current = freshActor(state, actor);
  const task = state.price_update_tasks?.find(
    (row) => row.id === id && row.company_id === current.company_id,
  );
  if (!task || !sellingSaleBranches(state).includes(task.branch))
    throw new PriceUpdatesError("task");
  requireCapability(
    state,
    current,
    capability,
    taskScope(state, task, capability !== "price_updates.read"),
  );
  return { task, actor: current };
}
function audit(
  state: DemoState,
  actor: AuthenticatedActor,
  task: PriceUpdateTask,
  action: string,
  before: unknown,
  now: Date,
) {
  state.activity.push({
    id: createId("price-update-activity"),
    company_id: task.company_id,
    branch: task.branch,
    product_code: task.product_code,
    entity_type: "price_update",
    entity_id: task.id,
    action,
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    reversible: false,
    before: structuredClone(before),
    after: structuredClone(task),
  });
}
function notify(
  state: DemoState,
  input: {
    kind: NotificationKind;
    event: NotificationEvent;
    key: string;
    branch: string;
    task?: PriceUpdateTask;
    count?: number;
    product_code?: string;
    request_id?: string;
    href: string;
    mandatoryRoles?: RoleId[];
    now: Date;
  },
) {
  const roles =
    input.mandatoryRoles ?? notificationSettings(state).events[input.event];
  const capabilities = {
    price_updates: "price_updates.read",
    approvals_waiting: "approvals.read",
    branch_requests: "branch_requests.read",
    returns_waiting_for_credit: "supplier_balances.read",
    expiring_dates: "dates.read",
    sale_requests: "approvals.read",
    sale_decisions: "dashboard.company",
    cost_went_up_during_sale: "sales.cost_alert_decide",
  } as const;
  for (const person of directoryRecipients(state, {
    roles,
    capability: capabilities[input.event],
    location_ids: input.branch === "all" ? undefined : [input.branch],
  })) {
    // A configurable role cannot expand access to its target record.
    const eligible = input.task
      ? person.allowed_branches.includes(input.task.branch) &&
        person.role !== "cashier"
      : true;
    if (!eligible) continue;
    const event_key = `${input.key}:${person.user_id}`;
    state.notifications ??= [];
    if (
      state.notifications.some(
        (row) =>
          row.company_id === person.company_id &&
          row.recipient_user_id === person.user_id &&
          row.event_key === event_key,
      )
    )
      continue;
    state.notifications.push({
      id: createId("notification"),
      company_id: person.company_id,
      branch: input.branch,
      event_key,
      recipient_user_id: person.user_id,
      target_username: person.username,
      kind: input.kind,
      product_code: input.task?.product_code ?? input.product_code,
      request_id: input.request_id,
      task_id: input.task?.id,
      count: input.count,
      href: input.href,
      created_at: input.now.toISOString(),
    });
  }
}
function sourceOf(
  state: DemoState,
  before: DemoState | null,
  code: string,
  branch: string,
  actor: AuthenticatedActor | null,
  now: Date,
  previous?: PriceSnapshot,
  next?: PriceSnapshot,
) {
  const oldIds = new Set(before?.activity.map((row) => row.id) ?? []);
  const candidates = before
    ? state.activity.filter(
        (row) =>
          row.company_id === state.config.company.seed_key &&
          !oldIds.has(row.id) &&
          row.entity_type !== "price_update",
      )
    : [];
  const specific = candidates.filter(
    (row) =>
      row.product_code === code ||
      (row.entity_type === "product" && row.entity_id === code) ||
      (row.entity_type === "sale" &&
        state.sales?.some(
          (sale) =>
            sale.company_id === row.company_id &&
            sale.id === row.entity_id &&
            sale.product_code === code &&
            sale.branch === branch,
        )) ||
      (row.entity_type === "offer" &&
        state.offers.some(
          (offer) =>
            offer.company_id === row.company_id &&
            offer.id === row.entity_id &&
            offer.product_code === code,
        )),
  );
  const invoiceSource = candidates.find(
    (row) =>
      row.action === "Posted invoice" &&
      [state.invoice, ...(state.invoices ?? [])].some(
        (invoice) =>
          invoice.company_id === row.company_id &&
          `${invoice.id}:activity` === row.id &&
          invoice.branch === branch &&
          invoice.lines.some((line) => line.product_code === code),
      ),
  );
  const configSource = candidates.find(
    (row) =>
      (row.entity_type === "config" &&
        [
          "weighed_items",
          "promotions",
          "offers",
          "pricing_categories",
        ].includes(row.entity_id ?? "")) ||
      (row.entity_type === "settings" &&
        ["catalog", "offers", "company"].includes(row.entity_id ?? "")),
  );
  const entry = specific.at(-1) ?? invoiceSource ?? configSource;
  const saleId = next?.sale_id ?? previous?.sale_id;
  const sale = saleId
    ? state.sales?.find(
        (row) =>
          row.company_id === state.config.company.seed_key &&
          row.id === saleId &&
          row.branch === branch &&
          row.product_code === code,
      )
    : undefined;
  const saleEvent = saleId
    ? [...(state.sale_events ?? [])]
        .reverse()
        .find(
          (row) =>
            row.company_id === state.config.company.seed_key &&
            row.sale_id === saleId &&
            row.branch === branch &&
            row.product_code === code &&
            row.occurred_at <= now.toISOString() &&
            row.kind !== "scheduled" &&
            row.kind !== "reminded",
        )
    : undefined;
  const offerId = next?.offer_id ?? previous?.offer_id;
  const offer = offerId
    ? state.offers.find(
        (row) =>
          row.company_id === state.config.company.seed_key &&
          row.id === offerId &&
          row.product_code === code,
      )
    : undefined;
  const original = offerId
    ? state.activity.find(
        (row) =>
          row.company_id === state.config.company.seed_key &&
          row.entity_type === "offer" &&
          row.entity_id === offerId &&
          row.actor_user_id,
      )
    : undefined;
  const originalDecision: DecisionAttribution | undefined =
    original?.actor_user_id &&
    original.actor_role_snapshot &&
    original.actor_username
      ? {
          user_id: original.actor_user_id,
          company_id: original.company_id,
          username: original.actor_username,
          name_snapshot: original.by,
          role_snapshot: original.actor_role_snapshot,
          device_id: original.device_id,
          at: original.at,
        }
      : undefined;
  const source_decision = actor
    ? decisionAttribution(state, actor, now)
    : (saleEvent?.source_decision ??
      sale?.decision_attribution ??
      offer?.decision_attribution ??
      originalDecision);
  const temporalReason = next?.sale_id
    ? previous?.sale_id === next.sale_id
      ? "Change sale"
      : "Start sale"
    : previous?.sale_id
      ? "End sale"
      : next?.offer_id
        ? "Create offer"
        : previous?.offer_id
          ? "Stop offer"
          : !same(
                previous?.clearance_offers ?? [],
                next?.clearance_offers ?? [],
              )
            ? next?.clearance_offers?.length
              ? "Create clearance offer"
              : "Stop offer"
            : "Selling price changed";
  return {
    reason: entry?.action ?? temporalReason,
    source_activity_id: entry?.id ?? original?.id,
    decided_by: actor?.actor ?? source_decision?.name_snapshot,
    decided_by_user_id: actor?.user_id ?? source_decision?.user_id,
    source_decision,
  };
}

function createOrCoalesce(
  state: DemoState,
  branch: string,
  code: string,
  previous: PriceSnapshot,
  next: PriceSnapshot,
  now: Date,
  source: ReturnType<typeof sourceOf>,
  effectiveAt = now.toISOString(),
  preparation?: PriceUpdateTask["sale_end_preparation"],
) {
  if (!changed(previous, next) || !next.price) return;
  state.price_update_tasks ??= [];
  let task = state.price_update_tasks.find(
    (row) =>
      row.company_id === state.config.company.seed_key &&
      row.branch === branch &&
      row.product_code === code &&
      row.status === "pending",
  );
  if (
    task &&
    !changed(task.new_price, next) &&
    task.effective_at === effectiveAt
  )
    return;
  if (task && !changed(task.new_price, next) && !preparation) return;
  const beforeTask = task ? structuredClone(task) : null;
  const step: PriceTaskStep = {
    version: (task?.version ?? 0) + 1,
    old_price: structuredClone(task?.new_price ?? previous),
    new_price: structuredClone(next),
    at: now.toISOString(),
    effective_at: effectiveAt,
    ...source,
  };
  if (task) {
    task.steps.push(step);
    task.version = step.version;
    task.new_price = structuredClone(next);
    task.updated_at = now.toISOString();
    task.effective_at = effectiveAt;
    task.due_at = now.toISOString();
    task.reason = source.reason;
    task.source_activity_id = source.source_activity_id;
    task.decided_by = source.decided_by;
    task.decided_by_user_id = source.decided_by_user_id;
    task.source_decision = source.source_decision;
    task.sale_end_preparation = preparation;
    // Real earlier acknowledgements remain in immutable activity, but cannot confirm new terms.
    delete task.register_changed;
    delete task.label_printed;
    delete task.no_label;
    delete task.reminded_at;
    delete task.escalated_at;
    if (!preparation && !task.acted_at && !changed(task.old_price, next)) {
      task.status = "cancelled";
      task.cancelled_at = now.toISOString();
    }
  } else {
    task = {
      id: createId("price-update"),
      company_id: state.config.company.seed_key,
      branch,
      product_code: code,
      version: 1,
      status: "pending",
      old_price: structuredClone(previous),
      new_price: structuredClone(next),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      effective_at: effectiveAt,
      due_at: now.toISOString(),
      ...source,
      steps: [step],
      ...(preparation ? { sale_end_preparation: preparation } : {}),
    };
    state.price_update_tasks.push(task);
  }
  state.activity.push({
    id: createId("price-update-transition"),
    company_id: task.company_id,
    branch: task.branch,
    product_code: task.product_code,
    entity_type: "price_update",
    entity_id: task.id,
    action:
      task.status === "cancelled"
        ? "Cancel price update"
        : beforeTask
          ? "Replace pending price update"
          : "Create price update",
    by: source.decided_by ?? "System",
    actor_user_id: source.decided_by_user_id,
    actor_role_snapshot: source.source_decision?.role_snapshot,
    at: now.toISOString(),
    reversible: false,
    before: beforeTask,
    after: structuredClone(task),
  });
  if (task.status === "pending")
    notify(state, {
      kind: "price_update_created",
      event: "price_updates",
      key: `price-task:${task.id}:${task.version}`,
      branch,
      task,
      href: `price-update?id=${encodeURIComponent(task.id)}`,
      now,
    });
}
function localMidnight(state: DemoState, branch: string, day: string) {
  const location = state.config.branches.find(
    (row, index) =>
      (row.id ?? row.name_en ?? row.code ?? String(index)) === branch,
  );
  return companyLocalToUtc(
    {
      company: {
        ...state.config.company,
        timezone: location?.timezone || state.config.company.timezone,
      },
    },
    day,
    "00:00",
  );
}
function prepareSaleEnds(state: DemoState, now: Date) {
  for (const sale of state.sales ?? []) {
    if (
      sale.company_id !== state.config.company.seed_key ||
      sale.status === "ended" ||
      !sale.last_day ||
      !sellingSaleBranches(state).includes(sale.branch) ||
      saleStoreDate(state.config, sale.branch, now) !== sale.last_day
    )
      continue;
    const effectiveAt = localMidnight(
      state,
      sale.branch,
      saleDateAfter(sale.last_day, 1),
    );
    const prior = snapshot(state, sale.product_code, sale.branch, now);
    const future = snapshot(
      state,
      sale.product_code,
      sale.branch,
      new Date(effectiveAt),
    );
    const existing = state.price_update_tasks?.find(
      (task) =>
        task.company_id === sale.company_id &&
        task.product_code === sale.product_code &&
        task.branch === sale.branch &&
        task.sale_end_preparation?.sale_id === sale.id &&
        task.sale_end_preparation.last_day === sale.last_day &&
        !changed(task.new_price, future) &&
        task.status !== "cancelled",
    );
    if (existing) continue;
    createOrCoalesce(
      state,
      sale.branch,
      sale.product_code,
      prior,
      future,
      now,
      {
        reason: "Sale ends after today",
        source_activity_id: undefined,
        source_decision: sale.decision_attribution,
        decided_by: sale.decision_attribution?.name_snapshot,
        decided_by_user_id: sale.decision_attribution?.user_id,
      },
      effectiveAt,
      { sale_id: sale.id, last_day: sale.last_day },
    );
  }
}
function reconcileChanges(
  state: DemoState,
  previous: Record<string, PriceSnapshot>,
  now: Date,
  actor: AuthenticatedActor | null,
  before: DemoState | null,
) {
  const current = snapshots(state, now);
  for (const [key, next] of Object.entries(current)) {
    const prior =
      previous[key] ??
      (before ? { price: null, regular_price: null, unit: next.unit } : null);
    if (!prior || !changed(prior, next)) continue;
    const [branch, code] = JSON.parse(key) as [string, string];
    // The already-prepared last-day task is also the end transition task; no second tomorrow task.
    const preparation = state.price_update_tasks?.find(
      (task) =>
        task.company_id === state.config.company.seed_key &&
        task.branch === branch &&
        task.product_code === code &&
        task.sale_end_preparation?.sale_id === prior.sale_id &&
        task.effective_at <= now.toISOString() &&
        task.status !== "cancelled" &&
        !changed(task.new_price, next),
    );
    if (preparation) continue;
    createOrCoalesce(
      state,
      branch,
      code,
      prior,
      next,
      now,
      sourceOf(state, before, code, branch, actor, now, prior, next),
    );
  }
  state.price_update_baseline = current;
  prepareSaleEnds(state, now);
}
/** Invoked only inside the genuine controller transaction after its protected domain mutation. */
export function capturePriceUpdateChanges(
  before: DemoState,
  state: DemoState,
  actor: AuthenticatedActor,
  now = new Date(),
) {
  actor = freshActor(state, actor);
  if (!state.prototype_e2_schema) initializePriceUpdates(state, now);
  reconcileChanges(state, snapshots(before, now), now, actor, before);
  syncGeneralNotifications(state, now);
}
function initializePriceUpdates(state: DemoState, now: Date) {
  state.config.price_updates = priceUpdatesSettings(state);
  state.config.notifications = notificationSettings(state);
  state.price_update_tasks ??= [];
  state.price_task_prints ??= [];
  state.price_update_baseline = snapshots(state, now);
  state.prototype_e2_schema = 1;
}
/** Backup + verified reread precedes the first E2 write to an existing browser's private canonical state. */
class MigrationChanged extends Error {}
export async function migratePriceUpdates(
  repository: BrowserAuthorityRepository,
  companyId: string,
) {
  // If another real tab commits while the verified backup is being stored, back up
  // that newer revision before migration. Never initialize from a stale preload.
  for (let attempt = 0; attempt < 8; attempt++) {
    const loaded = await repository.loadBusiness<DemoState>(companyId);
    if (loaded.state.prototype_e2_schema === 1) return;
    const raw = JSON.stringify(loaded.state);
    await repository.archivePrivateBackup(
      {
        id: `e2-business:${companyId}:${loaded.revision}:${hashRaw(raw)}`,
        company_id: companyId,
        source_key: `business:${companyId}:revision:${loaded.revision}`,
        raw,
        sha256: hashRaw(raw),
        created_at: new Date().toISOString(),
      },
      hashRaw,
    );
    try {
      await repository.runSystemReconciliation<DemoState, void>(
        companyId,
        "price_updates",
        (state, attribution) => {
          requireSystemReconciliation(state, attribution, "price_updates");
          if (state.prototype_e2_schema === 1) return;
          if (JSON.stringify(state) !== raw) throw new MigrationChanged();
          initializePriceUpdates(state, new Date(attribution.applied_at));
        },
      );
      return;
    } catch (error) {
      if (!(error instanceof MigrationChanged)) throw error;
    }
  }
  throw new Error("migration_conflict");
}

function reminders(state: DemoState, now: Date) {
  const settings = priceUpdatesSettings(state);
  const groups = new Map<string, PriceUpdateTask[]>();
  for (const task of state.price_update_tasks ?? []) {
    if (
      task.company_id !== state.config.company.seed_key ||
      task.status !== "pending" ||
      !sellingSaleBranches(state).includes(task.branch)
    )
      continue;
    const hours = (now.getTime() - Date.parse(task.updated_at)) / 3_600_000;
    if (hours >= settings.remind_after_hours && !task.reminded_at) {
      notify(state, {
        kind: "price_update_reminder",
        event: "price_updates",
        mandatoryRoles: ["branch_supervisor"],
        key: `price-task-reminder:${task.id}:${task.version}`,
        branch: task.branch,
        task,
        href: `price-update?id=${encodeURIComponent(task.id)}`,
        now,
      });
      task.reminded_at = now.toISOString();
    }
    if (hours >= settings.escalate_after_hours)
      groups.set(task.branch, [...(groups.get(task.branch) ?? []), task]);
  }
  for (const [branch, tasks] of groups) {
    if (tasks.every((task) => task.escalated_at)) continue;
    const identity = tasks
      .map((task) => `${task.id}:${task.version}`)
      .sort()
      .join("|");
    notify(state, {
      kind: "price_update_escalation",
      event: "price_updates",
      mandatoryRoles: ["owner", "manager"],
      key: `price-task-escalation:${branch}:${identity}`,
      branch,
      count: tasks.length,
      href: `price-updates?location=${encodeURIComponent(branch)}&status=pending`,
      now,
    });
    for (const task of tasks) task.escalated_at ??= now.toISOString();
  }
}
/** Clock transitions require a repository-minted live witness; callers cannot fabricate a System actor. */
export function evaluatePriceUpdates(
  state: DemoState,
  attribution: SystemAttribution,
  now = new Date(attribution.applied_at),
) {
  requireSystemReconciliation(state, attribution, "price_updates");
  if (!state.prototype_e2_schema) initializePriceUpdates(state, now);
  else
    reconcileChanges(
      state,
      state.price_update_baseline ?? snapshots(state, now),
      now,
      null,
      null,
    );
  reminders(state, now);
  syncGeneralNotifications(state, now);
}
export function priceUpdateTasks(
  state: DemoState,
  actor: AuthenticatedActor,
): PriceUpdateTask[] {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "price_updates.read", domainScope(state));
  const locations = new Set(selectedLocations(state, actor, true));
  return (state.price_update_tasks ?? [])
    .filter(
      (task) =>
        task.company_id === actor.company_id &&
        locations.has(task.branch) &&
        can(state, actor, "price_updates.read", taskScope(state, task)).allowed,
    )
    .map((task) => structuredClone(task))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
/** Cashier receives public prices and record IDs only, never decisions, staff evidence, costs or other locations. */
export function priceChangeHints(
  state: DemoState,
  actor: AuthenticatedActor,
): PriceChangeHint[] {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "lookup.read", domainScope(state));
  const locations = new Set(selectedLocations(state, actor));
  return (state.price_update_tasks ?? [])
    .filter(
      (task) =>
        task.company_id === actor.company_id &&
        task.status === "pending" &&
        locations.has(task.branch) &&
        task.effective_at <= new Date().toISOString(),
    )
    .map((task) => ({
      task_id: task.id,
      company_id: task.company_id,
      branch: task.branch,
      product_code: task.product_code,
      old_price: task.old_price.price,
      new_price: task.new_price.price,
      effective_at: task.effective_at,
      old_unit: task.old_price.unit,
      new_unit: task.new_price.unit,
    }));
}
export function updatePriceTask(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  input: {
    register_changed?: boolean;
    label_printed?: boolean;
    no_label_reason?: string;
  },
  now = new Date(),
) {
  const { task, actor: current } = taskFor(state, actor, id);
  if (task.status !== "pending") throw new PriceUpdatesError("status");
  if (input.label_printed === true) throw new PriceUpdatesError("print");
  if (input.register_changed !== undefined)
    requireCapability(
      state,
      current,
      "price_updates.register_confirm",
      taskScope(state, task, true),
    );
  if (input.label_printed === false)
    requireCapability(
      state,
      current,
      "price_updates.label_confirm",
      taskScope(state, task, true),
    );
  if (input.no_label_reason !== undefined)
    requireCapability(
      state,
      current,
      "price_updates.register_confirm",
      taskScope(state, task, true),
    );
  if (input.no_label_reason !== undefined && !input.no_label_reason.trim())
    throw new PriceUpdatesError("reason");
  const before = structuredClone(task),
    ack: PriceTaskAcknowledgement = {
      by_user_id: current.user_id,
      by: current.actor,
      at: now.toISOString(),
      version: task.version,
    };
  if (input.register_changed === true) task.register_changed = ack;
  if (input.register_changed === false) delete task.register_changed;
  if (input.label_printed === false) delete task.label_printed;
  if (input.no_label_reason !== undefined) {
    task.no_label = { ...ack, reason: input.no_label_reason.trim() };
    delete task.label_printed;
  }
  task.acted_at ??= now.toISOString();
  audit(state, current, task, "Update price task", before, now);
}
/**
 * Seen: the person has read this version of the price change. Anyone who may
 * read the task at an active location can mark it; repeat marks change nothing.
 */
export function markPriceTaskSeen(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  now = new Date(),
) {
  const { task, actor: current } = taskFor(state, actor, id);
  requireCapability(
    state,
    current,
    "price_updates.read",
    taskScope(state, task, true),
  );
  if (task.status !== "pending") throw new PriceUpdatesError("status");
  if (task.seen?.version === task.version) return;
  const before = structuredClone(task);
  task.seen = {
    by_user_id: current.user_id,
    by: current.actor,
    at: now.toISOString(),
    version: task.version,
  };
  task.acted_at ??= now.toISOString();
  audit(state, current, task, "Mark price update seen", before, now);
}
/**
 * Done: the register and shelf label are handled. Ali's rule (Oct 2026): only
 * Seen and Done are tracked, each with who and when; no checklist is required.
 */
export function completePriceTasks(
  state: DemoState,
  actor: AuthenticatedActor,
  ids: string[],
  now = new Date(),
) {
  const tasks = [...new Set(ids)].map(
    (id) => taskFor(state, actor, id, "price_updates.complete").task,
  );
  if (!tasks.length) throw new PriceUpdatesError("task");
  for (const task of tasks)
    if (task.status !== "pending") throw new PriceUpdatesError("status");
  actor = freshActor(state, actor);
  for (const task of tasks) {
    const before = structuredClone(task);
    // Finishing a task also means it was seen.
    if (task.seen?.version !== task.version)
      task.seen = {
        by_user_id: actor.user_id,
        by: actor.actor,
        at: now.toISOString(),
        version: task.version,
      };
    task.status = "done";
    task.completed_by = actor.actor;
    task.completed_by_user_id = actor.user_id;
    task.completed_at = now.toISOString();
    task.acted_at ??= now.toISOString();
    audit(state, actor, task, "Complete price update", before, now);
  }
}
export function queuePriceTaskLabels(
  state: DemoState,
  actor: AuthenticatedActor,
  ids: string[],
  now = new Date(),
) {
  const tasks = [...new Set(ids)].map(
    (id) => taskFor(state, actor, id, "price_updates.label_confirm").task,
  );
  if (!tasks.length) throw new PriceUpdatesError("task");
  if (tasks.some((task) => task.status !== "pending"))
    throw new PriceUpdatesError("status");
  // Validate the entire batch first; a forbidden second store cannot partially queue the first.
  for (const task of tasks)
    requireCapability(
      state,
      actor,
      "labels.queue_write",
      taskScope(state, task, true),
    );
  for (const task of tasks) {
    addLabelsToWaitlist(state, [task.product_code], 1, task.branch, actor);
    const entry = state.label_waitlist!.find(
      (row) =>
        row.company_id === task.company_id &&
        row.branch === task.branch &&
        row.product_code === task.product_code &&
        !row.lot_id,
    )!;
    entry.preferred_template =
      task.new_price.sale_id ||
      task.new_price.offer_id ||
      task.new_price.clearance_offers?.length
        ? "promo"
        : "regular";
    entry.source_event_id = `price-task:${task.id}:${task.version}`;
    entry.source_reason = "price_update";
    for (const term of task.new_price.clearance_offers ?? []) {
      if (!term.lot_id) continue;
      addClearanceLabelToWaitlist(
        state,
        task.product_code,
        term.lot_id,
        1,
        task.branch,
        actor,
      );
      const lotEntry = state.label_waitlist!.find(
        (row) =>
          row.company_id === task.company_id &&
          row.branch === task.branch &&
          row.product_code === task.product_code &&
          row.lot_id === term.lot_id,
      )!;
      lotEntry.source_event_id = `price-task:${task.id}:${task.version}`;
      lotEntry.source_reason = "price_update";
      lotEntry.preferred_template = "promo";
    }
    task.acted_at ??= now.toISOString();
  }
}
export function preparePriceTaskPrint(
  state: DemoState,
  actor: AuthenticatedActor,
  ids: string[],
  now = new Date(),
): PriceTaskPrint {
  const tasks = [...new Set(ids)].map(
    (id) => taskFor(state, actor, id, "price_updates.label_confirm").task,
  );
  if (
    !tasks.length ||
    tasks.some(
      (task) => task.status !== "pending" || task.branch !== tasks[0].branch,
    )
  )
    throw new PriceUpdatesError("task");
  for (const task of tasks)
    requireCapability(
      state,
      actor,
      "labels.print",
      taskScope(state, task, true),
    );
  const working = cloneWithAuthority(state);
  ensureBuiltInLabelTemplates(working);
  const items: PriceTaskPrintItem[] = [],
    batches: LabelPrintSnapshot[] = [];
  for (const kind of ["regular", "promo"] as const) {
    const subset = tasks.filter(
      (task) =>
        (task.new_price.sale_id ||
        task.new_price.offer_id ||
        task.new_price.clearance_offers?.length
          ? "promo"
          : "regular") === kind,
    );
    if (!subset.length) continue;
    const template = working.templates.find(
      (row) =>
        row.company_id === actor.company_id &&
        !row.archived &&
        (row.built_in === kind || row.style === kind),
    );
    if (!template) throw new PriceUpdatesError("print");
    validateLabelTemplate(
      template,
      working.label_settings?.fields?.logo !== false,
    );
    const products: LabelPrintProduct[] = subset.flatMap((task) => {
      const product = working.products.find(
        (row) =>
          row.company_id === actor.company_id &&
          row.code === task.product_code &&
          row.status === "active",
      );
      if (!product) throw new PriceUpdatesError("task");
      const sale =
        task.new_price.sale_id &&
        working.sales?.find(
          (row) =>
            row.company_id === actor.company_id &&
            row.id === task.new_price.sale_id,
        );
      const offer =
        task.new_price.offer_id &&
        working.offers.find(
          (row) =>
            row.company_id === actor.company_id &&
            row.id === task.new_price.offer_id,
        );
      const frozen: LabelPrintProduct = {
        ...projectProductReadDTO(working, actor, product),
        label_effective_price:
          task.new_price.canonical_price ?? task.new_price.price,
        label_regular_price:
          task.new_price.canonical_regular_price ??
          task.new_price.regular_price,
        label_sale: sale ? projectSaleReadDTO(sale) : null,
        label_offer: offer ? projectOfferReadDTO(offer) : null,
      };
      items.push({
        task_id: task.id,
        version: task.version,
        product_code: product.code,
        name_en: product.name_en,
        name_fa: product.name_fa,
        barcode: product.barcode,
        price: structuredClone(task.new_price),
        template: kind,
      });
      const clearance = (task.new_price.clearance_offers ?? []).map((term) => {
        const offer = working.offers.find(
          (row) =>
            row.company_id === actor.company_id &&
            row.id === term.id &&
            row.lot_id === term.lot_id &&
            row.price === term.price,
        );
        if (!offer) throw new PriceUpdatesError("stale_print");
        return {
          ...frozen,
          label_lot_id: term.lot_id,
          label_clearance_offer: projectOfferReadDTO(offer),
        };
      });
      return [frozen, ...clearance];
    });
    batches.push({
      id: createId("price-task-label-batch"),
      company_id: actor.company_id,
      branch: tasks[0].branch,
      template: structuredClone(template),
      startSlot: 1,
      entries: [],
      products,
      pages: labelPages(products, template, 1),
    });
  }
  return {
    id: createId("price-task-print"),
    company_id: actor.company_id,
    branch: tasks[0].branch,
    created_at: now.toISOString(),
    items,
    batches,
  };
}
function printComparable(print: PriceTaskPrint) {
  return {
    company_id: print.company_id,
    branch: print.branch,
    items: print.items,
    batches: print.batches.map((batch) => ({
      company_id: batch.company_id,
      branch: batch.branch,
      template: batch.template,
      startSlot: batch.startSlot,
      entries: batch.entries,
      products: batch.products,
      pages: batch.pages,
    })),
  };
}
/** Call after invoking the actual browser print dialog; this records evidence, not staff confirmation. */
export function recordPriceTaskPrint(
  state: DemoState,
  actor: AuthenticatedActor,
  print: PriceTaskPrint,
  now = new Date(),
) {
  if (print.company_id !== actor.company_id || !print.items.length)
    throw new PriceUpdatesError("permission");
  const fresh = preparePriceTaskPrint(
    state,
    actor,
    print.items.map((row) => row.task_id),
    new Date(print.created_at),
  );
  if (!same(printComparable(print), printComparable(fresh)))
    throw new PriceUpdatesError("stale_print");
  state.price_task_prints ??= [];
  if (
    state.price_task_prints.some(
      (row) => row.company_id === actor.company_id && row.id === print.id,
    )
  )
    return;
  const record = {
    ...structuredClone(print),
    printed_at: now.toISOString(),
    printed_by_user_id: actor.user_id,
  };
  state.price_task_prints.push(record);
  for (const item of print.items) {
    const { task } = taskFor(
      state,
      actor,
      item.task_id,
      "price_updates.label_confirm",
    );
    task.acted_at ??= now.toISOString();
  }
  state.activity.push({
    id: createId("price-task-print-activity"),
    company_id: actor.company_id,
    branch: print.branch,
    action: "Print price update labels",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    reversible: false,
    entity_type: "price_update_print",
    entity_id: print.id,
    after: {
      print_id: print.id,
      task_ids: print.items.map((item) => item.task_id),
    },
  });
}
export function confirmPriceTaskLabel(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  printId: string,
  now = new Date(),
) {
  const { task, actor: current } = taskFor(
    state,
    actor,
    id,
    "price_updates.label_confirm",
  );
  const print = state.price_task_prints?.find(
    (row) =>
      row.company_id === current.company_id &&
      row.id === printId &&
      row.branch === task.branch &&
      row.printed_at,
  );
  const item = print?.items.find(
    (row) =>
      row.task_id === id &&
      row.version === task.version &&
      same(row.price, task.new_price),
  );
  if (task.status !== "pending" || !item)
    throw new PriceUpdatesError("stale_print");
  const before = structuredClone(task);
  task.label_printed = {
    by_user_id: current.user_id,
    by: current.actor,
    at: now.toISOString(),
    version: task.version,
    print_id: printId,
  };
  delete task.no_label;
  task.acted_at ??= now.toISOString();
  audit(state, current, task, "Confirm price update label", before, now);
}
export function savePriceUpdateSettings(
  state: DemoState,
  actor: AuthenticatedActor,
  settings: PriceUpdatesSettings,
  now = new Date(),
) {
  requireCapability(
    state,
    actor,
    "settings.manage",
    domainScope(state, undefined, true),
  );
  if (
    typeof settings.allow_floor_worker_complete !== "boolean" ||
    !Number.isInteger(settings.remind_after_hours) ||
    !Number.isInteger(settings.escalate_after_hours) ||
    settings.remind_after_hours < 1 ||
    settings.escalate_after_hours <= settings.remind_after_hours ||
    settings.escalate_after_hours > 8760
  )
    throw new PriceUpdatesError("settings");
  const before = state.config.price_updates;
  state.config.price_updates = structuredClone(settings);
  settingsAudit(
    state,
    actor,
    "Save price update settings",
    "price_updates",
    before,
    settings,
    now,
  );
}
export function saveNotificationSettings(
  state: DemoState,
  actor: AuthenticatedActor,
  settings: NotificationSettings,
  now = new Date(),
) {
  requireCapability(
    state,
    actor,
    "notifications.settings_manage",
    domainScope(state, undefined, true),
  );
  const roles = new Set(state.config.roles.map((role) => role.key));
  if (
    notificationEvents.some(
      (event) =>
        !Array.isArray(settings.events[event]) ||
        settings.events[event].some((role) => !roles.has(role)),
    )
  )
    throw new PriceUpdatesError("settings");
  const before = state.config.notifications;
  state.config.notifications = structuredClone(settings);
  settingsAudit(
    state,
    actor,
    "Save notification settings",
    "notifications",
    before,
    settings,
    now,
  );
}
function settingsAudit(
  state: DemoState,
  actor: AuthenticatedActor,
  action: string,
  id: string,
  before: unknown,
  after: unknown,
  now: Date,
) {
  state.activity.push({
    id: createId("settings-activity"),
    company_id: actor.company_id,
    branch: "all",
    entity_type: "config",
    entity_id: id,
    action,
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    before: structuredClone(before),
    after: structuredClone(after),
    reversible: true,
  });
}
function syncGeneralNotifications(state: DemoState, now: Date) {
  syncSupplierProfileNotifications(state, now);
  for (const request of state.sale_requests ?? [])
    if (
      request.company_id === state.config.company.seed_key &&
      ["approved", "rejected", "expired", "withdrawn"].includes(request.status)
    )
      notify(state, {
        kind: "sale_request_decision",
        event: "sale_decisions",
        key: `sale-request-decision:${request.id}:${request.revision}`,
        branch: request.branch,
        request_id: request.id,
        product_code: request.product_code,
        href: `product?code=${encodeURIComponent(request.product_code)}`,
        now,
      });

  for (const approval of state.approvals)
    if (
      approval.company_id === state.config.company.seed_key &&
      approval.type !== "new_supplier" &&
      approval.status === "pending"
    )
      notify(state, {
        kind: "approval_waiting",
        event: "approvals_waiting",
        key: `approval:${approval.id}`,
        branch: approval.branch,
        href: "approvals",
        now,
      });
  for (const request of state.branch_requests ?? [])
    if (
      request.company_id === state.config.company.seed_key &&
      request.status === "requested"
    )
      notify(state, {
        kind: "branch_request_waiting",
        event: "branch_requests",
        key: `branch-request:${request.id}`,
        branch: request.to_branch,
        href: `requests?id=${encodeURIComponent(request.id)}`,
        now,
      });
  for (const record of state.returns)
    if (
      record.company_id === state.config.company.seed_key &&
      ["picked_up", "partially_resolved"].includes(record.status)
    )
      notify(state, {
        kind: "return_waiting_credit",
        event: "returns_waiting_for_credit",
        key: `return-credit:${record.id}`,
        branch: record.branch,
        href: `returns?id=${encodeURIComponent(record.id)}`,
        now,
      });
  for (const alert of state.alerts)
    if (
      alert.company_id === state.config.company.seed_key &&
      alert.status === "pending" &&
      alert.type === "date_reminder"
    )
      notify(state, {
        kind: "expiry_date_waiting",
        event: "expiring_dates",
        key: `expiry:${alert.id}`,
        branch: alert.branch,
        href: "expiry",
        now,
      });
}
/** Explicit source-lifetime projection used by task History rows without leaking unrelated canonical data. */
export function priceTaskHistory(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
): Activity[] {
  const { task } = taskFor(state, actor, id);
  return state.activity
    .filter(
      (row) =>
        row.company_id === task.company_id &&
        row.entity_type === "price_update" &&
        row.entity_id === task.id,
    )
    .map((row) => structuredClone(row));
}

/** The existing Labels physical-print Yes invokes this in the same protected command.
 * A stale sheet is retained as historical printing, but never acknowledges newer task terms. */
export function confirmPriceTaskWaitlistLabels(
  state: DemoState,
  actor: AuthenticatedActor,
  sheet: LabelPrintSnapshot,
  now = new Date(),
) {
  actor = freshActor(state, actor);
  if (sheet.company_id !== actor.company_id)
    throw new PriceUpdatesError("permission");
  for (const entry of sheet.entries) {
    if (entry.source_reason !== "price_update") continue;
    const task = state.price_update_tasks?.find(
      (row) =>
        row.company_id === sheet.company_id &&
        row.branch === sheet.branch &&
        row.product_code === entry.product_code &&
        row.status === "pending" &&
        entry.source_event_id === `price-task:${row.id}:${row.version}`,
    );
    if (!task) continue;
    const prepared = preparePriceTaskPrint(state, actor, [task.id], now);
    const expectedProducts = prepared.batches.flatMap(
      (batch) => batch.products,
    );
    if (
      !expectedProducts.every((expected) =>
        sheet.products.some((printed) => same(printed, expected)),
      )
    )
      continue;
    prepared.id = `${sheet.id}:${task.id}`;
    recordPriceTaskPrint(state, actor, prepared, now);
    confirmPriceTaskLabel(state, actor, task.id, prepared.id, now);
  }
}

/** Company-wide progress is explicit and separately protected from the location list. */
export function priceUpdateProgress(
  state: DemoState,
  actor: AuthenticatedActor,
): PriceUpdateTask[] {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "dashboard.company", domainScope(state));
  return (state.price_update_tasks ?? [])
    .filter(
      (task) =>
        task.company_id === actor.company_id &&
        can(state, actor, "price_updates.read", taskScope(state, task)).allowed,
    )
    .map((task) => structuredClone(task))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
