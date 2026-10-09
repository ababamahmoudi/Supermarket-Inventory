import Decimal from "decimal.js";
import { createId } from "./ids";
import { companyDate } from "./invoice";
import { projectExpiryLocation } from "./received";
import { configuredBranches } from "./settings";
import type { HistoryContext } from "./history";
import type { Branch, DemoState, ExpiryRecord, Product } from "./types";

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
export type DateTrackingErrorCode =
  | "permission"
  | "scope"
  | "product"
  | "location"
  | "date_type"
  | "date"
  | "quantity"
  | "reason"
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
    entity_type: action === "Stop tracking this product" ? "product" : "date",
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
  };
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
  removeOpenDates: boolean,
): void {
  requireOperator(state, context);
  if (context.role !== "supervisor") throw new DateTrackingError("permission");
  const product = state.products.find(
    (item) =>
      item.company_id === context.company_id && item.code === productCode,
  );
  if (!product) throw new DateTrackingError("product");
  const at = new Date().toISOString();
  const open = removeOpenDates
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
