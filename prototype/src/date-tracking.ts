import Decimal from "decimal.js";
import { createId } from "./ids";
import { companyDate } from "./invoice";
import { projectExpiryLocation } from "./received";
import { configuredBranches } from "./settings";
import type { HistoryContext } from "./history";
import type {
  Alert,
  Branch,
  DemoState,
  ExpiryRecord,
  Language,
  Product,
} from "./types";
import { branchLabel } from "./settings";
import { translateCount } from "./i18n";

export type TrackedDateType = "expiry" | "best_before";
export type DateRemovalReason = NonNullable<ExpiryRecord["removed_reason"]>;
export const dateRemovalReasons: DateRemovalReason[] = [
  "sold_out",
  "thrown_away",
  "returned_to_supplier",
  "entered_by_mistake",
];
export interface AddTrackedDateInput {
  product_code: string;
  branch: Branch;
  date_type: TrackedDateType;
  date: string;
  quantity?: string;
  lot_number?: string;
  note?: string;
}
/** Unsaved rows in the shared product form; every mutation commits with Save. */
export interface ProductDateDraft extends AddTrackedDateInput {
  id?: string;
  remove_reason?: DateRemovalReason | "";
}
export type StopTrackingChoice = "keep" | "clear";
export type DateTrackingErrorCode =
  | "permission"
  | "scope"
  | "product"
  | "location"
  | "date_type"
  | "date"
  | "quantity"
  | "reason"
  | "reminder"
  | "stop_choice"
  | "inactive";
export class DateTrackingError extends Error {
  constructor(public readonly code: DateTrackingErrorCode) {
    super(code);
    this.name = "DateTrackingError";
  }
}

/** An explicit preference answers the invoice choice; an unknown answer stays unknown. */
export function trackingChoiceForProduct(
  product?: Pick<Product, "date_tracking"> | null,
): "yes" | "no" | undefined {
  return product?.date_tracking === true
    ? "yes"
    : product?.date_tracking === false
      ? "no"
      : undefined;
}

export function validTrackedDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function trackedDateDaysLeft(date: string, today: string): number {
  return Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
}

export function allowedDateLocations(
  state: DemoState,
  context: HistoryContext,
  includeInactive = false,
): Branch[] {
  if (context.company_id !== state.config.company.seed_key) return [];
  if (!Array.isArray(context.allowed_branches)) return [];
  const configured = configuredBranches(state.config, includeInactive);
  return configured.filter(
    (location) =>
      context.allowed_branches.includes(location) &&
      (context.role === "supervisor" || location === context.branch),
  );
}

/** Project posted location corrections before applying company/user location guards. */
export function scopedTrackedDates(
  state: DemoState,
  context: HistoryContext,
  includeRemoved = false,
): ExpiryRecord[] {
  const allowed = allowedDateLocations(state, context, true);
  if (!allowed.length) return [];
  return state.expiry
    .filter((entry) => entry.company_id === context.company_id)
    .map((entry) => projectExpiryLocation(state, entry))
    .filter(
      (entry) =>
        allowed.includes(entry.branch) &&
        (context.branch === "all" || entry.branch === context.branch) &&
        (includeRemoved || entry.status === "active"),
    );
}

export function nextTrackedDate(
  state: DemoState,
  context: HistoryContext,
  productCode: string,
): ExpiryRecord | undefined {
  return scopedTrackedDates(state, context)
    .filter(
      (entry) =>
        entry.product_code === productCode && validTrackedDate(entry.date),
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    )[0];
}

/** Kept dates stay readable on Lookup, but an untracked product has no work queue. */
export function activeTrackedDates(
  state: DemoState,
  context: HistoryContext,
): ExpiryRecord[] {
  return scopedTrackedDates(state, context).filter((entry) =>
    state.products.some(
      (product) =>
        product.company_id === context.company_id &&
        product.code === entry.product_code &&
        product.status !== "archived" &&
        product.date_tracking === true,
    ),
  );
}

export function productReminderDays(
  state: DemoState,
  product?: Pick<Product, "date_reminder_days">,
): number {
  return product?.date_reminder_days ?? state.config.expiry.expiring_soon_days;
}

export function dateIsDueSoon(
  state: DemoState,
  entry: ExpiryRecord,
  now = new Date(),
): boolean {
  const product = state.products.find(
    (item) =>
      item.company_id === entry.company_id && item.code === entry.product_code,
  );
  return Boolean(
    product?.date_tracking === true &&
    entry.status === "active" &&
    validTrackedDate(entry.date) &&
    trackedDateDaysLeft(entry.date, companyDate(state.config, now)) <=
      productReminderDays(state, product),
  );
}

/** A derived alert identity survives refresh, day changes and stopped-date history. */
export function syncDateReminderAlerts(
  state: DemoState,
  now = new Date(),
): boolean {
  let changed = false;
  const company = state.config.company.seed_key;
  const today = companyDate(state.config, now);
  const visible = new Map(
    state.expiry
      .filter((entry) => entry.company_id === company)
      .map((entry) => projectExpiryLocation(state, entry))
      .filter(
        (entry) =>
          configuredBranches(state.config).includes(entry.branch) &&
          dateIsDueSoon(state, entry, now),
      )
      .map((entry) => [entry.id, entry]),
  );
  for (const alert of state.alerts) {
    if (alert.company_id !== company || alert.type !== "date_reminder")
      continue;
    const date = visible.get(alert.expiry_id ?? "");
    if (!date && alert.status === "pending") {
      alert.status = "resolved";
      alert.date_suppressed = true;
      changed = true;
    }
    if (date) {
      if (alert.date_suppressed) {
        alert.status = "pending";
        alert.date_suppressed = false;
        changed = true;
      }
      const days = trackedDateDaysLeft(date.date, today);
      if (
        alert.days_left !== days ||
        alert.branch !== date.branch ||
        alert.date !== date.date
      ) {
        alert.days_left = days;
        alert.branch = date.branch;
        alert.branch_id = date.branch;
        alert.date = date.date;
        changed = true;
      }
    }
  }
  for (const entry of visible.values()) {
    const existing = state.alerts.find(
      (alert) =>
        alert.company_id === company &&
        alert.type === "date_reminder" &&
        alert.expiry_id === entry.id,
    );
    if (existing || entry.reminded_at) continue;
    const id = `date-reminder:${encodeURIComponent(company)}:${encodeURIComponent(entry.id)}`;
    state.alerts.push({
      id,
      company_id: company,
      branch: entry.branch,
      branch_id: entry.branch,
      type: "date_reminder",
      product_code: entry.product_code,
      expiry_id: entry.id,
      date: entry.date,
      days_left: trackedDateDaysLeft(entry.date, today),
      status: "pending",
    });
    // Alert identity is the persisted once-per-date marker. Do not mutate the
    // audited date object after its action snapshot: that would block safe Undo.
    changed = true;
  }
  return changed;
}

export function dateReminderMessage(
  state: DemoState,
  alert: Alert,
  language: Language,
  now = new Date(),
): string {
  const product = state.products.find(
    (item) =>
      item.company_id === alert.company_id && item.code === alert.product_code,
  );
  const name =
    language === "fa" ? product?.name_fa || product?.name_en : product?.name_en;
  const days = validTrackedDate(alert.date ?? "")
    ? trackedDateDaysLeft(alert.date!, companyDate(state.config, now))
    : (alert.days_left ?? 0);
  const count = translateCount(
    "{{count}} day",
    "{{count}} days",
    "{{count}} روز",
    "{{count}} روز",
    Math.abs(days),
    language,
  );
  const timing =
    days < 0
      ? language === "fa"
        ? `${count} پیش منقضی شد`
        : `expired ${count} ago`
      : language === "fa"
        ? `در ${count} منقضی می‌شود`
        : `expires in ${count}`;
  return `${name ?? alert.product_code} ${timing} · ${branchLabel(state.config, alert.branch, language)}`;
}

export function productDateDrafts(
  state: DemoState,
  context: HistoryContext,
  productCode: string,
  branch: Branch,
): ProductDateDraft[] {
  return scopedTrackedDates(state, { ...context, branch })
    .filter((entry) => entry.product_code === productCode)
    .map((entry) => ({
      id: entry.id,
      product_code: productCode,
      branch: entry.branch,
      date_type: entry.date_type ?? "expiry",
      date: entry.date,
      quantity: entry.quantity ?? "",
      lot_number: entry.lot_number ?? "",
      note: entry.note ?? "",
    }));
}

/** Validate every row before a product or its high-water code is changed. */
export function validateProductDateDrafts(
  state: DemoState,
  context: Pick<
    HistoryContext,
    "company_id" | "role" | "actor" | "branch" | "allowed_branches"
  >,
  productCode: string,
  drafts: ProductDateDraft[] | undefined,
  reminderDays?: number,
  stopChoice?: StopTrackingChoice,
): void {
  if (context.company_id !== state.config.company.seed_key)
    throw new DateTrackingError("scope");
  if (context.role !== "supervisor" && context.role !== "floor_worker")
    throw new DateTrackingError("permission");
  if (
    reminderDays !== undefined &&
    (!Number.isSafeInteger(reminderDays) || reminderDays < 0)
  )
    throw new DateTrackingError("reminder");
  if (stopChoice !== undefined && !["keep", "clear"].includes(stopChoice))
    throw new DateTrackingError("stop_choice");
  const allowed = configuredBranches(state.config).filter(
    (branch) =>
      context.allowed_branches.includes(branch) &&
      (context.role === "supervisor" || context.branch === branch),
  );
  const seen = new Set<string>();
  for (const draft of drafts ?? []) {
    if (!allowed.includes(draft.branch))
      throw new DateTrackingError("location");
    if (draft.product_code !== productCode)
      throw new DateTrackingError("product");
    if (draft.id) {
      if (context.role !== "supervisor")
        throw new DateTrackingError("permission");
      const existing = state.expiry.find(
        (entry) =>
          entry.id === draft.id &&
          entry.company_id === context.company_id &&
          entry.product_code === productCode,
      );
      if (
        !existing ||
        projectExpiryLocation(state, existing).branch !== draft.branch
      )
        throw new DateTrackingError("scope");
      if (existing.status !== "active") throw new DateTrackingError("inactive");
      if (seen.has(draft.id)) throw new DateTrackingError("scope");
      seen.add(draft.id);
    }
    if (draft.remove_reason !== undefined) {
      if (
        !draft.id ||
        !draft.remove_reason ||
        !dateRemovalReasons.includes(draft.remove_reason)
      )
        throw new DateTrackingError("reason");
      continue;
    }
    if (!validTrackedDate(draft.date)) throw new DateTrackingError("date");
    if (!["expiry", "best_before"].includes(draft.date_type))
      throw new DateTrackingError("date_type");
    if (draft.quantity?.trim()) {
      try {
        if (
          !new Decimal(draft.quantity.trim()).isFinite() ||
          new Decimal(draft.quantity.trim()).lte(0)
        )
          throw new Error();
      } catch {
        throw new DateTrackingError("quantity");
      }
    }
  }
}

/** Applied only after whole-form validation. Existing source dates are never erased. */
export function applyProductDateDrafts(
  state: DemoState,
  context: Pick<
    HistoryContext,
    "company_id" | "role" | "actor" | "branch" | "allowed_branches"
  >,
  product: Product,
  drafts: ProductDateDraft[] | undefined,
  now = new Date(),
): void {
  if (product.company_id !== context.company_id)
    throw new DateTrackingError("scope");
  validateProductDateDrafts(state, context, product.code, drafts);
  const at = now.toISOString();
  for (const draft of drafts ?? []) {
    const previous = draft.id
      ? state.expiry.find(
          (entry) =>
            entry.company_id === context.company_id && entry.id === draft.id,
        )
      : undefined;
    const normalized = {
      date_type: draft.date_type,
      date: draft.date,
      quantity: draft.quantity?.trim()
        ? new Decimal(draft.quantity.trim()).toFixed()
        : undefined,
      lot_number: draft.lot_number?.trim() || undefined,
      note: draft.note?.trim() || undefined,
    };
    if (
      previous &&
      !draft.remove_reason &&
      Object.entries(normalized).every(
        ([key, value]) =>
          (key === "date_type"
            ? (previous.date_type ?? "expiry")
            : previous[key as keyof ExpiryRecord]) === value,
      )
    )
      continue;
    if (previous) {
      previous.status = "removed";
      previous.removed_reason = draft.remove_reason || undefined;
      previous.removal_action = draft.remove_reason ? "remove" : "correction";
      previous.removed_by = context.actor;
      previous.removed_at = at;
    }
    if (draft.remove_reason) continue;
    state.expiry.push({
      id: createId("product-date"),
      company_id: context.company_id,
      product_code: product.code,
      branch: draft.branch,
      branch_id: draft.branch,
      ...normalized,
      status: "active",
      source: previous ? "correction" : "manual",
      previous_entry_id: previous?.id,
      invoice_id: previous?.invoice_id,
      invoice_number: previous?.invoice_number,
      invoice_line_index: previous?.invoice_line_index,
      supplier: previous?.supplier ?? product.main_supplier,
      supplier_id: previous?.supplier_id,
      received_date: previous?.received_date,
      created_at: at,
      created_by: context.actor,
      expires_in_days: trackedDateDaysLeft(
        draft.date,
        companyDate(state.config, now),
      ),
    });
  }
}

function requireOperator(state: DemoState, context: HistoryContext) {
  if (context.company_id !== state.config.company.seed_key)
    throw new DateTrackingError("scope");
  if (context.role !== "supervisor" && context.role !== "floor_worker")
    throw new DateTrackingError("permission");
}

function appendAudit(
  state: DemoState,
  context: HistoryContext,
  action: string,
  productCode: string,
  location: Branch,
  entityId: string,
  at: string,
) {
  state.activity.push({
    id: createId("date-activity"),
    company_id: context.company_id,
    branch: location,
    action,
    by: context.actor,
    actor_username: context.username,
    device: "Browser",
    at,
    product_code: productCode,
    reversible: true,
    entity_type:
      action === "Add date" || action === "Remove date" ? "date" : "product",
    entity_id: entityId,
    scope: location === "all" ? "all" : "branch",
  });
}

/** Optional quantity is retained evidence. It never updates stock, receipts or money. */
export function addTrackedDate(
  state: DemoState,
  context: HistoryContext,
  input: AddTrackedDateInput,
): ExpiryRecord {
  requireOperator(state, context);
  const product = state.products.find(
    (item) =>
      item.company_id === context.company_id &&
      item.code === input.product_code &&
      item.status !== "archived",
  );
  if (!product) throw new DateTrackingError("product");
  if (!allowedDateLocations(state, context).includes(input.branch))
    throw new DateTrackingError("location");
  if (!["expiry", "best_before"].includes(input.date_type))
    throw new DateTrackingError("date_type");
  if (!validTrackedDate(input.date)) throw new DateTrackingError("date");
  let quantity: string | undefined;
  if (input.quantity?.trim()) {
    try {
      const parsed = new Decimal(input.quantity.trim());
      if (!parsed.isFinite() || !parsed.gt(0))
        throw new DateTrackingError("quantity");
      quantity = parsed.toFixed();
    } catch {
      throw new DateTrackingError("quantity");
    }
  }
  const at = new Date().toISOString();
  const entry: ExpiryRecord = {
    id: createId("manual-date"),
    company_id: context.company_id,
    branch: input.branch,
    branch_id: input.branch,
    product_code: product.code,
    source: "manual",
    date_type: input.date_type,
    date: input.date,
    expires_in_days: trackedDateDaysLeft(input.date, companyDate(state.config)),
    status: "active",
    quantity,
    lot_number: input.lot_number?.trim() || undefined,
    note: input.note?.trim() || undefined,
    created_by: context.actor,
    created_at: at,
    supplier: product.main_supplier,
  };
  // An explicit manual date is also the operator's decision to track this
  // product. Keep it in the same transaction and History entry, so Undo
  // restores the prior preference together with the retained date evidence.
  product.date_tracking = true;
  state.expiry.push(entry);
  appendAudit(
    state,
    context,
    "Add date",
    product.code,
    entry.branch,
    entry.id,
    at,
  );
  return entry;
}

/** The inline preference switch never removes existing date evidence. */
export function setProductDateTracking(
  state: DemoState,
  context: HistoryContext,
  productCode: string,
  enabled: boolean,
  location: Branch,
): void {
  requireOperator(state, context);
  if (context.role !== "supervisor") throw new DateTrackingError("permission");
  if (!allowedDateLocations(state, context).includes(location))
    throw new DateTrackingError("location");
  const product = state.products.find(
    (item) =>
      item.company_id === context.company_id &&
      item.code === productCode &&
      item.status !== "archived",
  );
  if (!product) throw new DateTrackingError("product");
  if (product.date_tracking === enabled) return;
  product.date_tracking = enabled;
  appendAudit(
    state,
    context,
    enabled ? "Turn on date tracking" : "Turn off date tracking",
    product.code,
    location,
    product.code,
    new Date().toISOString(),
  );
}

export function removeTrackedDate(
  state: DemoState,
  context: HistoryContext,
  entryId: string,
  reason: DateRemovalReason,
): void {
  requireOperator(state, context);
  if (!dateRemovalReasons.includes(reason))
    throw new DateTrackingError("reason");
  const projected = scopedTrackedDates(state, context, true).find(
    (entry) => entry.id === entryId,
  );
  if (!projected) throw new DateTrackingError("scope");
  const entry = state.expiry.find(
    (item) => item.id === entryId && item.company_id === context.company_id,
  )!;
  if (entry.status !== "active") throw new DateTrackingError("inactive");
  const at = new Date().toISOString();
  entry.status = "removed";
  entry.removed_reason = reason;
  entry.removal_action = "remove";
  entry.removed_by = context.actor;
  entry.removed_at = at;
  appendAudit(
    state,
    context,
    "Remove date",
    entry.product_code,
    projected.branch,
    entry.id,
    at,
  );
}

export function stopProductDateTracking(
  state: DemoState,
  context: HistoryContext,
  productCode: string,
  choice: StopTrackingChoice | boolean,
): void {
  requireOperator(state, context);
  if (context.role !== "supervisor") throw new DateTrackingError("permission");
  const product = state.products.find(
    (item) =>
      item.company_id === context.company_id && item.code === productCode,
  );
  if (!product) throw new DateTrackingError("product");
  if (!["keep", "clear", true, false].includes(choice))
    throw new DateTrackingError("stop_choice");
  const at = new Date().toISOString();
  const open =
    choice === "clear" || choice === true
      ? scopedTrackedDates(state, { ...context, branch: "all" }).filter(
          (entry) => entry.product_code === productCode,
        )
      : [];
  product.date_tracking = false;
  for (const projected of open) {
    const entry = state.expiry.find(
      (item) =>
        item.company_id === context.company_id && item.id === projected.id,
    )!;
    entry.status = "removed";
    entry.removal_action = "stop_tracking";
    entry.removed_by = context.actor;
    entry.removed_at = at;
  }
  appendAudit(
    state,
    context,
    "Stop tracking this product",
    productCode,
    "all",
    productCode,
    at,
  );
}

export function dateTrackingErrorMessage(
  error: unknown,
  t: (english: string, persian: string) => string,
): string {
  const code = error instanceof DateTrackingError ? error.code : "scope";
  const messages: Record<DateTrackingErrorCode, [string, string]> = {
    permission: [
      "Your role cannot change date tracking.",
      "نقش شما اجازه تغییر پیگیری تاریخ را ندارد.",
    ],
    scope: [
      "This date is outside your allowed locations. Refresh and try again.",
      "این تاریخ خارج از مکان‌های مجاز شما است. صفحه را تازه‌سازی و دوباره تلاش کنید.",
    ],
    product: ["Choose an active product.", "یک محصول فعال انتخاب کنید."],
    location: [
      "Choose an allowed, active location.",
      "یک مکان فعال و مجاز انتخاب کنید.",
    ],
    date_type: [
      "Choose Expiry or Best before.",
      "انقضا یا بهترین زمان مصرف را انتخاب کنید.",
    ],
    date: ["Choose a valid date.", "یک تاریخ معتبر انتخاب کنید."],
    quantity: [
      "Enter a quantity greater than zero, or leave it empty.",
      "مقداری بزرگ‌تر از صفر وارد کنید یا آن را خالی بگذارید.",
    ],
    reason: [
      "Choose a reason for removing this date.",
      "دلیل حذف این تاریخ را انتخاب کنید.",
    ],
    inactive: [
      "This date has already been removed. Refresh the list.",
      "این تاریخ قبلاً حذف شده است. فهرست را تازه‌سازی کنید.",
    ],
    reminder: [
      "Enter a nonnegative whole reminder period in days.",
      "بازهٔ یادآوری را به‌صورت تعداد روز صحیح و نامنفی وارد کنید.",
    ],
    stop_choice: [
      "Choose whether to keep or clear the dates.",
      "نگه‌داشتن یا پاک‌کردن تاریخ‌ها را انتخاب کنید.",
    ],
  };
  return t(...messages[code]);
}

export function dateRemovalReasonLabel(
  reason: DateRemovalReason,
  t: (english: string, persian: string) => string,
): string {
  const labels: Record<DateRemovalReason, [string, string]> = {
    sold_out: ["Sold out", "تمام‌شده"],
    thrown_away: ["Thrown away", "دور ریخته‌شده"],
    returned_to_supplier: ["Returned to supplier", "مرجوع به تأمین‌کننده"],
    entered_by_mistake: ["Entered by mistake", "ثبت اشتباه"],
  };
  return t(...labels[reason]);
}
