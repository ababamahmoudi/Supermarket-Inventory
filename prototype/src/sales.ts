import { notificationReadable } from "./notification-access";
import { migrateSupplierProfiles } from "./supplier-profiles";
import {
  invoiceEvidenceActor,
  type InternalPurchaseEvidence,
} from "./purchase-evidence.internal";
import {
  requireSystemReconciliation,
  type BrowserAuthorityRepository,
} from "./authority-repository";
import { sha256Bytes } from "./sha256";
import type { SystemAttribution } from "./authority-types";
import { freshActor } from "./authority";
import { decodeCurrentRole } from "./role-config";
import type {
  AuthenticatedActor,
  DecisionAttribution,
  RoleId,
} from "./authority-types";
import {
  actorAtLocation,
  cloneWithAuthority,
  decisionAttribution,
} from "./authority";
import {
  can,
  directoryRecipients,
  requireCapability as requireCentralCapability,
  requireConcreteLocation,
  allowedLocationIds,
} from "./permissions";
import {
  actorAudit,
  domainScope,
  guardDomain as requireDomainScope,
} from "./domain-authority";
import Decimal from "decimal.js";
import { configSeed, demoSeed } from "./config";
import { createId } from "./ids";
import { companyLocalToUtc } from "./company-time";
import { branchId } from "./settings";
import {
  effectiveInvoiceVersion,
  invoiceContentVersions,
} from "./invoice-version";
import { effectiveInvoiceLocation } from "./received";
import { productStoreCost } from "./product-costs";
import {
  weightConversionFactor,
  weighedSettings,
  weightPriceDisplay,
} from "./weighed";
import { setManualPriceMarker, rulePrice } from "./manual-prices";
import { reconcileOffers, syncPriceConflicts } from "./approvals";
import type { Branch, CompanyConfig, DemoState, Product } from "./types";

const SaleDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
});

export type SalePriceUnit = "each" | "lb" | "kg";
export type SaleClockConfig = Pick<
  CompanyConfig,
  "company" | "branches" | "weighed_items"
>;
export type SalePriceProduct = Pick<Product, "code" | "company_id" | "status">;
export type TemporalSale = Pick<
  SaleSchedule,
  | "id"
  | "company_id"
  | "branch"
  | "product_code"
  | "group_id"
  | "status"
  | "starts_on"
  | "last_day"
  | "sale_price"
  | "price_unit"
>;
export type TemporalRequest = Pick<
  SaleRequest,
  | "id"
  | "company_id"
  | "branch"
  | "product_code"
  | "status"
  | "last_day"
  | "requested_price"
  | "price_unit"
  | "starts_on"
  | "revision"
>;
export interface SalePriceReadState<
  S extends TemporalSale = TemporalSale,
  R extends TemporalRequest = TemporalRequest,
> {
  config: SaleClockConfig;
  products: readonly SalePriceProduct[];
  sales?: readonly S[];
  sale_requests?: readonly R[];
}

export interface SalesSettings {
  default_length_days: number;
  open_ended_reminder_days: number;
  add_promo_labels_on_start: boolean;
  add_regular_labels_on_end: boolean;
  quick_discount_percentages: number[];
  round_down_endings: string[];
}
export interface SaleRecipient {
  username: string;
  role: RoleId;
  user_id: string;
  allowed_branches: readonly Branch[];
}
export type SalesContext = AuthenticatedActor;
export interface SaleSchedule {
  decision_attribution?: DecisionAttribution;
  id: string;
  company_id: string;
  branch: Branch;
  branch_id: Branch;
  product_code: string;
  group_id: string;
  sale_price: string;
  price_unit: SalePriceUnit;
  starts_on: string;
  last_day: string | null;
  status: "scheduled" | "active" | "ended";
  revision: number;
  created_by: string;
  created_by_user_id?: string;
  created_by_role_snapshot?: RoleId;
  created_by_username: string;
  created_at: string;
  changed_by?: string;
  changed_by_user_id?: string;
  changed_by_role_snapshot?: RoleId;
  changed_at?: string;
  started_at?: string;
  ended_at?: string;
  ended_reason?: string;
  release_reminder_on?: string;
  source_request_id?: string;
  add_promo_labels: boolean;
  minimum_margin_accepted: boolean;
  below_cost_reason?: string;
  regular_price_snapshot: string;
  cost_snapshot: string;
  last_reminded_on?: string;
  deferred_regular_labels?: boolean;
}
export interface SaleRequest {
  decision_attribution?: DecisionAttribution;
  id: string;
  company_id: string;
  branch: Branch;
  branch_id: Branch;
  product_code: string;
  requested_price: string;
  price_unit: SalePriceUnit;
  starts_on: string;
  last_day: string | null;
  why?: string;
  requester: string;
  requester_user_id?: string;
  requester_role_snapshot?: RoleId;
  requester_username: string;
  requested_at: string;
  revision: number;
  status: "pending" | "approved" | "rejected" | "withdrawn" | "expired";
  add_promo_labels: boolean;
  existing_sale_id?: string;
  expected_sale_revision?: number;
  decided_by?: string;
  decided_by_user_id?: string;
  decided_by_role_snapshot?: RoleId;
  decided_at?: string;
  decision_reason?: string;
  approved_sale_id?: string;
  /** The approved terms are evidence, independent of later sale edits. */
  approved_terms?: ApprovedSaleTerms;
}
export interface ApprovedSaleTerms {
  sale_id: string;
  sale_revision: number;
  sale_price: string;
  price_unit: SalePriceUnit;
  starts_on: string;
  last_day: string | null;
}
export interface SaleLifecycleEvent {
  source_decision?: DecisionAttribution;
  applied_at?: string;
  id: string;
  company_id: string;
  branch: Branch;
  sale_id: string;
  product_code: string;
  revision: number;
  kind: "scheduled" | "started" | "changed" | "ended" | "reminded" | "reverted";
  by: string;
  actor_username?: string;
  actor_user_id?: string;
  actor_role_snapshot?: RoleId;
  occurred_at: string;
  local_boundary: string;
  effect_key: string;
  before: SaleSchedule | null;
  after: SaleSchedule;
  effective_price_before: string | null;
  effective_price_after: string | null;
}
export type NotificationKind =
  | "supplier_profile_incomplete"
  | "note_added"
  | "notebook_entry_added"
  | "price_update_created"
  | "price_update_reminder"
  | "price_update_escalation"
  | "approval_waiting"
  | "branch_request_waiting"
  | "return_waiting_credit"
  | "expiry_date_waiting"
  | "sale_request_decision"
  | "sale_request_submitted"
  | "sale_request_approved"
  | "sale_request_rejected"
  | "sale_request_withdrawn"
  | "sale_request_expired"
  | "sale_no_end_reminder"
  | "sale_cost_increase"
  | "sale_regular_not_above_sale"
  | "sale_delivery_release";
export interface NotificationRecord {
  id: string;
  event_key: string;
  company_id: string;
  branch: Branch;
  target_username: string;
  task_id?: string;
  count?: number;
  recipient_user_id?: string;
  kind: NotificationKind;
  product_code?: string;
  sale_id?: string;
  request_id?: string;
  alert_id?: string;
  invoice_id?: string;
  note_id?: string;
  notebook_entry_id?: string;
  supplier_id?: string;
  reason?: string;
  href: string;
  created_at: string;
  read_at?: string;
}
export interface SaleDeliveryHold {
  id: string;
  company_id: string;
  branch: Branch;
  product_code: string;
  sale_id: string;
  invoice_id: string;
  invoice_number: string;
  line_index: number;
  note_id: string;
  held_by: string;
  held_by_user_id?: string;
  held_by_role_snapshot?: RoleId;
  held_at: string;
  planned_last_day: string | null;
  released_reminder_at?: string;
  released_sale_revision?: number;
}
export interface ChangePriceInput {
  product_code: string;
  mode: "sale" | "regular";
  scope: "all" | "current" | "selected";
  price: string;
  price_unit: SalePriceUnit;
  branches: Branch[];
  starts_on: string;
  last_day: string | null;
  accept_below_margin: boolean;
  below_cost_reason: string;
  add_labels: boolean;
  why?: string;
  existing_sale_id?: string;
  expected_revision?: number;
  expected_revisions?: Record<string, number>;
  regular_sale_resolutions?: RegularSaleResolution[];
}
export interface RegularSaleResolution {
  sale_id: string;
  expected_revision: number;
  action: "end" | "change";
  sale_price?: string;
  price_unit?: SalePriceUnit;
}
export interface RegularSaleConflict {
  sale_id: string;
  revision: number;
  branch: Branch;
  sale_price: string;
  price_unit: SalePriceUnit;
  display_price: string;
}
export type SalesErrorCode =
  | "permission"
  | "company"
  | "product"
  | "stores"
  | "price"
  | "price_unit"
  | "sale_price_not_lower"
  | "regular_sale_conflict"
  | "replacement_sale_price_not_lower"
  | "start_date"
  | "last_day"
  | "end_before_start"
  | "elapsed"
  | "sale_overlap"
  | "request_exists"
  | "below_margin"
  | "below_cost_reason"
  | "reason"
  | "revision"
  | "request_decided"
  | "identity";
export interface SalesValidationIssue {
  code: SalesErrorCode;
  field: string;
  branch?: Branch;
  regular_price?: string;
  sale_id?: string;
}
export class SalesError extends Error {
  constructor(
    readonly code: SalesErrorCode,
    readonly issues: SalesValidationIssue[] = [],
  ) {
    super(code);
    this.name = "SalesError";
  }
}
function requireCapability(
  ...args: Parameters<typeof requireCentralCapability>
) {
  try {
    return requireCentralCapability(...args);
  } catch {
    throw new SalesError("permission");
  }
}
function guardDomain(...args: Parameters<typeof requireDomainScope>) {
  try {
    return requireDomainScope(...args);
  } catch {
    throw new SalesError("permission");
  }
}

export interface SaleLocationEffect {
  branch: Branch;
  regular_price: string | null;
  regular_display_price: string | null;
  proposed_price: string | null;
  cost: string | null;
  margin: string | null;
  minimum_margin: string | null;
  below_minimum_margin: boolean;
  below_cost: boolean;
  savings: string | null;
  percentage_off: string | null;
  existing_sale_id?: string;
  regular_sale_conflict?: RegularSaleConflict;
}
export interface PriceChangePreview {
  product: Product | null;
  branches: Branch[];
  effects: SaleLocationEffect[];
  issues: SalesValidationIssue[];
  existing_sales: SaleSchedule[];
  can_save: boolean;
}
export interface PriceChangeResult {
  kind: "sale" | "regular";
  sales: SaleSchedule[];
  product_code: string;
  branches: Branch[];
  group_id?: string;
}

export function saleStoreDate(
  config: SaleClockConfig,
  branch: Branch,
  now = new Date(),
): string {
  const location = config.branches.find(
    (entry, index) => branchId(entry, index) === branch,
  );
  const timezone = location?.timezone || config.company.timezone;
  const parts = new Intl.DateTimeFormat("en-CA-u-ca-gregory-nu-latn", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function saleDateAfter(date: string, days: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return Number.isFinite(day.getTime()) ? day.toISOString().slice(0, 10) : "";
}
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && saleDateAfter(value, 0) === value;
const priceValue = (value: string) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  try {
    const amount = new SaleDecimal(value);
    return amount.isFinite() && amount.gt(0) ? amount : null;
  } catch {
    return null;
  }
};
function productInCompany<P extends SalePriceProduct>(
  state: { config: { company: { seed_key: string } }; products: readonly P[] },
  value: SalePriceProduct | string,
): P | null {
  const code = typeof value === "string" ? value : value.code;
  if (
    typeof value !== "string" &&
    value.company_id !== state.config.company.seed_key
  )
    return null;
  return (
    state.products.find(
      (item) =>
        item.company_id === state.config.company.seed_key && item.code === code,
    ) ?? null
  );
}
export function salesSettings(state: {
  config: Pick<CompanyConfig, "sales">;
}): SalesSettings {
  return { ...structuredClone(configSeed.sales), ...state.config.sales };
}
/** C8 sales never target the Warehouse, even if a legacy retail flag was enabled. */
export function sellingSaleBranches(state: {
  config: Pick<CompanyConfig, "branches">;
}): Branch[] {
  return state.config.branches.flatMap((entry, index) =>
    entry.active !== false &&
    entry.type !== "warehouse" &&
    entry.sells_to_customers !== false
      ? [branchId(entry, index)]
      : [],
  );
}
export function allowedSaleBranches(
  state: DemoState,
  context: SalesContext,
): Branch[] {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  if (!can(state, context, "sales.read").allowed) return [];
  const allowed = allowedLocationIds(state, context, { sellingOnly: true });
  return sellingSaleBranches(state).filter(
    (branch) =>
      allowed.includes(branch) &&
      (can(state, context, "sales.manage").allowed ||
        context.branch === "all" ||
        branch === context.branch),
  );
}
/** Pure temporal selector; reading prices does not generate audit or label writes. */
export function activeSaleAt<S extends TemporalSale>(
  state: SalePriceReadState<S>,
  productOrCode: SalePriceProduct | string,
  branch: Branch,
  now = new Date(),
): S | null {
  const product = productInCompany(state, productOrCode);
  if (
    !product ||
    product.status !== "active" ||
    !sellingSaleBranches(state).includes(branch)
  )
    return null;
  const date = saleStoreDate(state.config, branch, now);
  return (
    (state.sales ?? []).find(
      (sale) =>
        sale.company_id === product.company_id &&
        sale.product_code === product.code &&
        sale.branch === branch &&
        ["scheduled", "active"].includes(sale.status) &&
        validDate(sale.starts_on) &&
        (!sale.last_day || validDate(sale.last_day)) &&
        Boolean(priceValue(sale.sale_price)) &&
        ["each", "kg", "lb"].includes(sale.price_unit) &&
        sale.starts_on <= date &&
        (!sale.last_day || sale.last_day >= date),
    ) ?? null
  );
}
/** Advertising a sale requires a real reduction against this store's regular price. */
export function discountSaleAt<
  S extends TemporalSale,
  P extends SalePriceProduct & Pick<Product, "selling_price" | "branch_prices">,
>(
  state: SalePriceReadState<S> & { products: readonly P[] },
  productOrCode: SalePriceProduct | string,
  branch: Branch,
  now = new Date(),
): S | null {
  const product = productInCompany(state, productOrCode);
  const sale = activeSaleAt(state, productOrCode, branch, now);
  const regular = product && baseRegularPrice(product, branch);
  if (
    !sale ||
    !regular ||
    !priceValue(regular) ||
    !new SaleDecimal(saleCanonicalPrice(sale, state.config)).lt(regular)
  )
    return null;
  // An exact reduction can disappear when the configured display unit rounds
  // to cents. Advertise only a reduction the customer can actually see.
  const shownSale = salePriceDisplay(sale, state.config).main;
  const shownRegular =
    sale.price_unit === "each"
      ? regular
      : weightPriceDisplay(regular, state.config).main.amount;
  return new SaleDecimal(shownSale.amount).lt(shownRegular) ? sale : null;
}
export function pendingSaleRequest<R extends TemporalRequest>(
  state: SalePriceReadState<TemporalSale, R>,
  productOrCode: SalePriceProduct | string,
  branch: Branch,
  now = new Date(),
): R | null {
  const product = productInCompany(state, productOrCode);
  if (!product || !sellingSaleBranches(state).includes(branch)) return null;
  const date = saleStoreDate(state.config, branch, now);
  return (
    (state.sale_requests ?? []).find(
      (request) =>
        request.company_id === product.company_id &&
        request.product_code === product.code &&
        request.branch === branch &&
        request.status === "pending" &&
        (!request.last_day || request.last_day >= date),
    ) ?? null
  );
}
export function saleGroup<S extends TemporalSale>(
  state: SalePriceReadState<S>,
  saleOrId: S | string,
): S[] {
  const selected =
    typeof saleOrId === "string"
      ? (state.sales ?? []).find(
          (sale) =>
            sale.company_id === state.config.company.seed_key &&
            sale.id === saleOrId,
        )
      : saleOrId;
  if (!selected || selected.company_id !== state.config.company.seed_key)
    return [];
  return (state.sales ?? []).filter(
    (sale) =>
      sale.company_id === selected.company_id &&
      sale.group_id === selected.group_id &&
      sale.status !== "ended",
  );
}
export function saleCanonicalPrice(
  sale: Pick<SaleSchedule, "sale_price" | "price_unit">,
  config: Pick<CompanyConfig, "weighed_items">,
): string {
  return (
    sale.price_unit === "kg"
      ? new SaleDecimal(sale.sale_price).div(weightConversionFactor(config))
      : new SaleDecimal(sale.sale_price)
  ).toFixed();
}
/** Derive both units directly from entered cents; never round through lb first. */
export function salePriceDisplay(
  sale: Pick<SaleSchedule, "sale_price" | "price_unit">,
  config: Pick<CompanyConfig, "weighed_items">,
): {
  main: { amount: string; unit: SalePriceUnit };
  secondary: { amount: string; unit: "lb" | "kg" } | null;
} {
  if (sale.price_unit === "each")
    return {
      main: {
        amount: new SaleDecimal(sale.sale_price).toFixed(2),
        unit: "each" as const,
      },
      secondary: null,
    };
  const settings = weighedSettings(config);
  const factor = weightConversionFactor(config);
  const entered = new SaleDecimal(sale.sale_price);
  const lb = sale.price_unit === "lb" ? entered : entered.div(factor);
  const kg = sale.price_unit === "kg" ? entered : entered.times(factor);
  const amounts = {
    lb: lb.toFixed(2, Decimal.ROUND_HALF_UP),
    kg: kg.toFixed(2, Decimal.ROUND_HALF_UP),
  };
  const mainUnit = settings.main_display_unit;
  const secondaryUnit = mainUnit === "lb" ? "kg" : "lb";
  return {
    main: { amount: amounts[mainUnit], unit: mainUnit },
    secondary: settings.show_second_unit
      ? { amount: amounts[secondaryUnit], unit: secondaryUnit }
      : null,
  };
}
export function quickSalePrices(
  regularDisplayPrice: string,
  state: { config: Pick<CompanyConfig, "sales"> },
): { percentage: number; price: string | null }[] {
  const settings = salesSettings(state);
  const regular = priceValue(regularDisplayPrice);
  return settings.quick_discount_percentages.map((percentage) => {
    if (
      !regular ||
      !Number.isFinite(percentage) ||
      percentage <= 0 ||
      percentage >= 100
    )
      return { percentage, price: null };
    const target = regular
      .times(new SaleDecimal(100).minus(percentage))
      .div(100);
    const dollar = target.floor();
    const candidates = settings.round_down_endings
      .flatMap((ending) => {
        const fraction = new SaleDecimal(ending);
        return [dollar.plus(fraction), dollar.minus(1).plus(fraction)];
      })
      .filter((candidate) => candidate.gt(0) && candidate.lte(target));
    return {
      percentage,
      price: candidates.length
        ? SaleDecimal.max(...candidates).toFixed(2)
        : null,
    };
  });
}

function baseRegularPrice(
  product: Pick<Product, "selling_price" | "branch_prices">,
  branch: Branch,
): string | null {
  return product.branch_prices?.[branch] || product.selling_price || null;
}
function canonicalInputPrice(
  input: ChangePriceInput,
  state: DemoState,
): Decimal | null {
  const value = priceValue(input.price);
  if (!value) return null;
  const normalized =
    input.price_unit === "kg"
      ? value.div(weightConversionFactor(state.config))
      : value;
  const actual =
    input.mode === "regular"
      ? normalized.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      : normalized;
  return actual.gt(0) ? actual : null;
}
function overlaps(
  leftStart: string,
  leftEnd: string | null,
  rightStart: string,
  rightEnd: string | null,
): boolean {
  return (
    (!leftEnd || rightStart <= leftEnd) && (!rightEnd || leftStart <= rightEnd)
  );
}
export function previewPriceChange(
  state: DemoState,
  context: SalesContext,
  input: ChangePriceInput,
  now = new Date(),
): PriceChangePreview {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  const issues: SalesValidationIssue[] = [];
  const product =
    context.company_id === state.config.company.seed_key
      ? productInCompany(state, input.product_code)
      : null;
  const branches = [...new Set(input.branches)];
  const permitted = allowedSaleBranches(state, context);
  const supervisor = can(
    state,
    context,
    input.mode === "sale" ? "sales.manage" : "pricing.regular_manage",
  ).allowed;
  const requestAllowed = can(
    state,
    context,
    input.mode === "sale" ? "sales.request" : "pricing.propose_manual",
  ).allowed;
  if (context.company_id !== state.config.company.seed_key)
    issues.push({ code: "company", field: "stores" });
  if (!supervisor && !requestAllowed)
    issues.push({ code: "permission", field: "price" });
  if (!product || product.status !== "active")
    issues.push({ code: "product", field: "product" });
  if (
    !branches.length ||
    branches.some((branch) => !permitted.includes(branch)) ||
    (!supervisor && (branches.length !== 1 || branches[0] !== context.branch))
  )
    issues.push({ code: "stores", field: "stores" });
  if (
    input.mode === "regular" &&
    input.scope === "all" &&
    (sellingSaleBranches(state).some((branch) => !branches.includes(branch)) ||
      branches.length !== sellingSaleBranches(state).length)
  )
    issues.push({ code: "stores", field: "stores" });
  if (!priceValue(input.price)) issues.push({ code: "price", field: "price" });
  if (
    product &&
    (product.sold_by === "weight"
      ? !["lb", "kg"].includes(input.price_unit)
      : input.price_unit !== "each")
  )
    issues.push({ code: "price_unit", field: "price" });
  if (input.mode === "sale") {
    if (!validDate(input.starts_on))
      issues.push({ code: "start_date", field: "starts_on" });
    if (input.last_day !== null && !validDate(input.last_day))
      issues.push({ code: "last_day", field: "last_day" });
    if (input.last_day && input.starts_on > input.last_day)
      issues.push({ code: "end_before_start", field: "last_day" });
    if (
      branches.some(
        (branch) =>
          input.last_day !== null &&
          input.last_day < saleStoreDate(state.config, branch, now),
      )
    )
      issues.push({ code: "elapsed", field: "last_day" });
  }
  const existing =
    input.mode === "sale" && input.existing_sale_id
      ? (state.sales ?? []).find(
          (sale) =>
            sale.id === input.existing_sale_id &&
            sale.company_id === context.company_id &&
            permitted.includes(sale.branch),
        )
      : undefined;
  if (
    input.mode === "sale" &&
    input.existing_sale_id &&
    (!existing ||
      existing.product_code !== input.product_code ||
      existing.status === "ended" ||
      input.expected_revision !== existing.revision)
  )
    issues.push({ code: "revision", field: "price" });
  const group =
    existing && supervisor
      ? saleGroup(state, existing)
      : existing
        ? [existing]
        : [];
  if (group.some((sale) => !permitted.includes(sale.branch)))
    issues.push({ code: "stores", field: "stores" });
  if (
    input.expected_revisions &&
    group.some((sale) => input.expected_revisions?.[sale.id] !== sale.revision)
  )
    issues.push({ code: "revision", field: "price" });
  const canonical = canonicalInputPrice(input, state);
  if (!canonical && priceValue(input.price))
    issues.push({ code: "price", field: "price" });
  const category =
    product &&
    state.config.pricing_categories.find(
      (entry) => entry.key === product.pricing_category,
    );
  const effects: SaleLocationEffect[] = [];
  const conflicting: SaleSchedule[] = [];
  for (const branch of branches.filter((target) =>
    permitted.includes(target),
  )) {
    const regular = product ? baseRegularPrice(product, branch) : null;
    const validRegular = regular && priceValue(regular);
    const factor =
      input.price_unit === "kg"
        ? weightConversionFactor(state.config)
        : new SaleDecimal(1);
    const regularDisplay = validRegular
      ? new SaleDecimal(regular).times(factor)
      : null;
    const costText =
      product && supervisor
        ? productStoreCost(
            state,
            actorAtLocation(state, context, branch),
            product,
          )
        : null;
    let cost: Decimal | null = null;
    try {
      if (costText) cost = new SaleDecimal(costText);
    } catch {
      cost = null;
    }
    if (supervisor && (!cost || !cost.isFinite() || cost.lt(0)))
      issues.push({ code: "price", field: "price", branch });
    const margin =
      canonical && cost ? canonical.minus(cost).div(canonical) : null;
    const threshold = category?.minimum_margin;
    let belowMargin =
      margin !== null &&
      threshold !== null &&
      threshold !== undefined &&
      threshold !== "" &&
      margin.lt(threshold);
    let belowCost = canonical !== null && cost !== null && canonical.lt(cost);
    let regularSaleConflict: RegularSaleConflict | undefined;
    const runningSale = product && activeSaleAt(state, product, branch, now);
    if (
      input.mode === "regular" &&
      supervisor &&
      canonical &&
      runningSale &&
      canonical.lte(saleCanonicalPrice(runningSale, state.config))
    ) {
      regularSaleConflict = {
        sale_id: runningSale.id,
        revision: runningSale.revision,
        branch,
        sale_price: runningSale.sale_price,
        price_unit: runningSale.price_unit,
        display_price: new SaleDecimal(
          saleCanonicalPrice(runningSale, state.config),
        )
          .times(factor)
          .toFixed(2),
      };
      const resolutions = (input.regular_sale_resolutions ?? []).filter(
        (item) => item.sale_id === runningSale.id,
      );
      const resolution = resolutions[0];
      if (
        resolutions.length !== 1 ||
        !["end", "change"].includes(resolution.action)
      )
        issues.push({ code: "regular_sale_conflict", field: "price", branch });
      else if (resolution.expected_revision !== runningSale.revision)
        issues.push({ code: "revision", field: "price", branch });
      else if (resolution.action === "change") {
        const field = `sale_price_${runningSale.id}`;
        const validUnit =
          product?.sold_by === "weight"
            ? ["lb", "kg"].includes(resolution.price_unit ?? "")
            : resolution.price_unit === "each";
        if (!resolution.sale_price || !priceValue(resolution.sale_price))
          issues.push({ code: "price", field, branch });
        else if (!validUnit) issues.push({ code: "price_unit", field, branch });
        else {
          const replacement = new SaleDecimal(
            saleCanonicalPrice(
              {
                sale_price: resolution.sale_price,
                price_unit: resolution.price_unit!,
              },
              state.config,
            ),
          );
          if (replacement.gte(canonical))
            issues.push({
              code: "replacement_sale_price_not_lower",
              field,
              branch,
              regular_price: canonical.times(factor).toFixed(2),
              sale_id: runningSale.id,
            });
          if (cost) {
            const replacementMargin = replacement.minus(cost).div(replacement);
            belowMargin ||= Boolean(
              threshold !== null &&
              threshold !== undefined &&
              threshold !== "" &&
              replacementMargin.lt(threshold),
            );
            belowCost ||= replacement.lt(cost);
          }
        }
      }
    }
    if (
      input.mode === "sale" &&
      canonical &&
      (!validRegular || canonical.gte(regular!))
    )
      issues.push({
        code: "sale_price_not_lower",
        field: "price",
        branch,
        regular_price: regularDisplay?.toFixed(2),
      });
    if (supervisor && belowMargin && !input.accept_below_margin)
      issues.push({
        code: "below_margin",
        field: "accept_below_margin",
        branch,
      });
    if (supervisor && belowCost && !input.below_cost_reason.trim())
      issues.push({
        code: "below_cost_reason",
        field: "below_cost_reason",
        branch,
      });
    if (input.mode === "sale") {
      for (const sale of state.sales ?? []) {
        if (
          sale.company_id !== context.company_id ||
          sale.product_code !== input.product_code ||
          sale.branch !== branch ||
          sale.status === "ended" ||
          group.some((member) => member.id === sale.id)
        )
          continue;
        if (
          overlaps(
            input.starts_on,
            input.last_day,
            sale.starts_on,
            sale.last_day,
          )
        ) {
          conflicting.push(sale);
          issues.push({
            code: "sale_overlap",
            field: "starts_on",
            branch,
            sale_id: sale.id,
          });
        }
      }
    }
    const savings =
      regularDisplay && priceValue(input.price)
        ? regularDisplay.minus(
            input.mode === "regular" && canonical
              ? canonical.times(factor)
              : input.price,
          )
        : null;
    effects.push({
      branch,
      regular_price: regular,
      regular_display_price: regularDisplay?.toFixed(2) ?? null,
      proposed_price: canonical?.toFixed() ?? null,
      cost: supervisor ? (cost?.toFixed(4) ?? null) : null,
      margin: supervisor ? (margin?.toFixed(8) ?? null) : null,
      minimum_margin: supervisor ? (threshold ?? null) : null,
      below_minimum_margin: supervisor && belowMargin,
      below_cost: supervisor && belowCost,
      savings: savings?.toFixed(2) ?? null,
      percentage_off:
        savings && regularDisplay?.gt(0)
          ? savings
              .div(regularDisplay)
              .times(100)
              .toFixed(0, Decimal.ROUND_HALF_UP)
          : null,
      existing_sale_id: activeSaleAt(state, input.product_code, branch, now)
        ?.id,
      regular_sale_conflict: regularSaleConflict,
    });
  }
  return {
    product,
    branches,
    effects,
    issues,
    existing_sales: conflicting,
    can_save: issues.length === 0,
  };
}
export function validatePriceChange(
  state: DemoState,
  context: SalesContext,
  input: ChangePriceInput,
  now = new Date(),
): SalesValidationIssue[] {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return previewPriceChange(state, context, input, now).issues;
}

function arrays(state: DemoState) {
  state.sales ??= [];
  state.sale_requests ??= [];
  state.sale_events ??= [];
  state.notifications ??= [];
  state.sale_delivery_holds ??= [];
  state.sale_label_effects ??= [];
}
function transact<T>(state: DemoState, action: (draft: DemoState) => T): T {
  const draft = cloneWithAuthority(state);
  arrays(draft);
  const result = action(draft);
  Object.assign(state, draft);
  return result;
}
function saleAuthority(
  state: DemoState,
  context: SalesContext,
  capability:
    | "sales.manage"
    | "pricing.regular_manage"
    | "approvals.decide"
    | "settings.manage"
    | "sales.cost_alert_decide",
) {
  try {
    requireCapability(state, context, capability, domainScope(state));
  } catch {
    throw new SalesError("permission");
  }
}
function saleRecipients(state: DemoState): SaleRecipient[] {
  return directoryRecipients(state, { capability: "approvals.decide" }).map(
    (person) => ({
      username: person.username,
      user_id: person.user_id,
      role: person.role,
      allowed_branches: [...person.allowed_branches],
    }),
  );
}
function saleRecord(state: DemoState, context: SalesContext, id: string) {
  if (context.company_id !== state.config.company.seed_key)
    throw new SalesError("company");
  const sale = (state.sales ?? []).find(
    (entry) =>
      entry.id === id &&
      entry.company_id === context.company_id &&
      allowedSaleBranches(state, context).includes(entry.branch),
  );
  if (!sale) throw new SalesError("stores");
  return sale;
}
function assertPreview(preview: PriceChangePreview) {
  if (!preview.can_save)
    throw new SalesError(preview.issues[0].code, preview.issues);
}
function notification(
  state: DemoState,
  input: Omit<NotificationRecord, "id" | "read_at">,
) {
  arrays(state);
  const event =
    input.kind === "sale_request_submitted"
      ? "sale_requests"
      : ["sale_cost_increase", "sale_regular_not_above_sale"].includes(
            input.kind,
          )
        ? "cost_went_up_during_sale"
        : null;
  const routedRoles = event
    ? state.config.notifications?.events[event]
    : undefined;
  if (
    routedRoles &&
    !directoryRecipients(state, {
      roles: routedRoles,
      location_ids: input.branch === "all" ? undefined : [input.branch],
    }).some((person) => person.user_id === input.recipient_user_id)
  )
    return;
  if (
    state.notifications!.some(
      (entry) =>
        entry.company_id === input.company_id &&
        (entry.recipient_user_id && input.recipient_user_id
          ? entry.recipient_user_id === input.recipient_user_id
          : !entry.recipient_user_id &&
            !input.recipient_user_id &&
            entry.target_username === input.target_username) &&
        entry.event_key === input.event_key,
    )
  )
    return;
  state.notifications!.push({ id: createId("notification"), ...input });
}
function notifySupervisors(
  state: DemoState,
  _recipients: SaleRecipient[],
  input: Omit<NotificationRecord, "id" | "read_at" | "target_username">,
) {
  for (const recipient of directoryRecipients(state, {
    capability:
      input.kind === "sale_request_submitted"
        ? "approvals.read"
        : "approvals.decide",
    location_ids: [input.branch],
  }))
    notification(state, {
      ...input,
      target_username: recipient.username,
      recipient_user_id: recipient.user_id,
    });
}
function auditSale(
  state: DemoState,
  sale: SaleSchedule,
  context: SalesContext | null,
  action: string,
  before: SaleSchedule | null,
  now: Date,
  eventId: string,
) {
  state.activity.push({
    id: createId("sale-history"),
    company_id: sale.company_id,
    branch: sale.branch,
    product_code: sale.product_code,
    action,
    by: context?.actor ?? "System",
    actor_username: context?.username,
    ...(context ? actorAudit(state, context, now) : {}),
    at: now.toISOString(),
    reversible: action !== "Sale reminder",
    reversal:
      action === "Sale reminder"
        ? undefined
        : [
            {
              path: ["sales", { key: "id", value: sale.id }],
              before: before && structuredClone(before),
              after: structuredClone(sale),
              before_exists: Boolean(before),
              after_exists: true,
              creation: before ? undefined : "stop",
              guards: [
                {
                  path: ["sales", { key: "id", value: sale.id }, "revision"],
                  after: sale.revision,
                  exists: true,
                },
              ],
            },
          ],
    entity_type: "sale",
    entity_id: sale.id,
    before: before && structuredClone(before),
    after: { ...structuredClone(sale), lifecycle_event_id: eventId },
  });
}
function queueSaleLabel(
  state: DemoState,
  sale: Pick<SaleSchedule, "company_id" | "branch" | "product_code">,
  template: "regular" | "promo",
  eventKey: string,
  reason: NonNullable<DemoState["label_waitlist"]>[number]["source_reason"],
  actor: string,
  now: Date,
) {
  arrays(state);
  if (state.sale_label_effects!.includes(eventKey)) return;
  state.sale_label_effects!.push(eventKey);
  state.label_waitlist ??= [];
  const existing = state.label_waitlist.find(
    (entry) =>
      entry.company_id === sale.company_id &&
      entry.branch === sale.branch &&
      entry.product_code === sale.product_code &&
      !entry.lot_id,
  );
  if (existing) {
    existing.preferred_template = template;
    existing.source_event_id = eventKey;
    existing.source_reason = reason;
  } else
    state.label_waitlist.push({
      id: createId("sale-label"),
      company_id: sale.company_id,
      branch: sale.branch,
      branch_id: sale.branch,
      product_code: sale.product_code,
      copies: 1,
      added_by: actor,
      added_at: now.toISOString(),
      preferred_template: template,
      source_event_id: eventKey,
      source_reason: reason,
    });
}
function recordEvent(
  state: DemoState,
  sale: SaleSchedule,
  before: SaleSchedule | null,
  kind: SaleLifecycleEvent["kind"],
  now: Date,
  context: SalesContext | null,
  boundary: string,
  effectKey = `${sale.company_id}:${sale.id}:${sale.revision}:${kind}`,
) {
  arrays(state);
  if (
    state.sale_events!.some(
      (entry) =>
        entry.company_id === sale.company_id && entry.effect_key === effectKey,
    )
  )
    return;
  const product = productInCompany(state, sale.product_code);
  const regular = product ? baseRegularPrice(product, sale.branch) : null;
  const effective = (value: SaleSchedule | null) =>
    value?.status === "active"
      ? saleCanonicalPrice(value, state.config)
      : regular;
  const event: SaleLifecycleEvent = {
    source_decision:
      sale.decision_attribution && structuredClone(sale.decision_attribution),
    applied_at: now.toISOString(),
    id: createId("sale-event"),
    company_id: sale.company_id,
    branch: sale.branch,
    sale_id: sale.id,
    product_code: sale.product_code,
    revision: sale.revision,
    kind,
    by: context?.actor ?? "System",
    actor_username: context?.username,
    ...(context ? actorAudit(state, context, now) : {}),
    occurred_at: now.toISOString(),
    local_boundary: boundary,
    effect_key: effectKey,
    before: before && structuredClone(before),
    after: structuredClone(sale),
    effective_price_before: effective(before),
    effective_price_after: effective(sale),
  };
  state.sale_events!.push(event);
  const action = {
    scheduled: "Schedule sale",
    started: "Start sale",
    changed: "Change sale",
    ended: "End sale",
    reminded: "Sale reminder",
    reverted: "Revert sale",
  }[kind];
  auditSale(state, sale, context, action, before, now, event.id);
  if (
    (kind === "started" || kind === "changed" || kind === "reverted") &&
    sale.status === "active" &&
    sale.add_promo_labels
  )
    queueSaleLabel(
      state,
      sale,
      "promo",
      effectKey,
      ("sale_" + (kind === "started" ? "started" : "changed")) as
        "sale_started" | "sale_changed",
      context?.actor ?? "System",
      now,
    );
  if (
    (kind === "ended" || kind === "reverted") &&
    sale.status === "ended" &&
    (salesSettings(state).add_regular_labels_on_end ||
      sale.deferred_regular_labels)
  )
    queueSaleLabel(
      state,
      sale,
      "regular",
      effectKey,
      "sale_ended",
      context?.actor ?? "System",
      now,
    );
}
function saleReleaseReminderDate(
  state: DemoState,
  sale: SaleSchedule,
  endedAt: Date,
) {
  const endingDate = saleStoreDate(state.config, sale.branch, endedAt);
  const lastSaleDate =
    sale.last_day && validDate(sale.last_day) && sale.last_day < endingDate
      ? sale.last_day
      : endingDate;
  return saleDateAfter(lastSaleDate, 1);
}
function endRecord(
  state: DemoState,
  sale: SaleSchedule,
  reason: string,
  now: Date,
  context: SalesContext | null,
) {
  if (sale.status === "ended") return;
  const before = structuredClone(sale);
  sale.status = "ended";
  sale.revision += 1;
  sale.ended_at = now.toISOString();
  sale.ended_reason = reason;
  sale.release_reminder_on = saleReleaseReminderDate(state, sale, now);
  if (context)
    sale.decision_attribution = decisionAttribution(state, context, now);
  sale.changed_by = context?.actor ?? "System";
  sale.changed_by_user_id = context?.user_id;
  sale.changed_by_role_snapshot = context?.role;
  sale.changed_at = now.toISOString();
  recordEvent(
    state,
    sale,
    before,
    "ended",
    now,
    context,
    saleStoreDate(state.config, sale.branch, now),
  );
}
function savePriceChangeDraft(
  state: DemoState,
  context: SalesContext,
  input: ChangePriceInput,
  now: Date,
): PriceChangeResult {
  saleAuthority(
    state,
    context,
    input.mode === "sale" ? "sales.manage" : "pricing.regular_manage",
  );
  const preview = previewPriceChange(state, context, input, now);
  assertPreview(preview);
  const product = preview.product!;
  if (input.mode === "regular") {
    const price = canonicalInputPrice(input, state)!.toFixed(
      2,
      Decimal.ROUND_HALF_UP,
    );
    const before = structuredClone(product);
    product.branch_prices ??= {};
    if (input.scope === "all") {
      // Only the concrete, reviewed selling locations lose their overrides.
      // Company default supplies these locations and newly created stores.
      product.selling_price = price;
      for (const branch of preview.branches)
        delete product.branch_prices[branch];
      setManualPriceMarker(state, context, product, "all", price, now);
      product.manual_prices ??= {};
      product.manual_prices.all = {
        price,
        rule_price: rulePrice(state, product) ?? price,
        set_by: context.actor,
        set_by_user_id: context.user_id,
        set_by_role_snapshot: context.role,
        decision_attribution: decisionAttribution(state, context, now),
        set_at: now.toISOString(),
      };
    } else
      for (const effect of preview.effects) {
        product.branch_prices[effect.branch] = price;
        setManualPriceMarker(
          state,
          actorAtLocation(state, context, effect.branch),
          product,
          effect.branch,
          price,
          now,
          effect.cost!,
        );
        product.manual_prices ??= {};
        product.manual_prices[effect.branch] = {
          price,
          rule_price: rulePrice(state, product, effect.cost!) ?? price,
          set_by: context.actor,
          set_by_user_id: context.user_id,
          set_by_role_snapshot: context.role,
          decision_attribution: decisionAttribution(state, context, now),
          set_at: now.toISOString(),
        };
      }
    if (input.scope === "all" && product.price_provenance) {
      product.price_provenance = Object.fromEntries(
        Object.entries(product.price_provenance).map(([key, source]) => [
          key,
          key !== "all" && !preview.branches.includes(key)
            ? source
            : {
                ...source,
                changed_price: price,
                changed_by: context.actor,
                changed_at: now.toISOString(),
              },
        ]),
      );
    } else
      for (const branch of preview.branches) {
        const provenance =
          product.price_provenance?.[branch] ?? product.price_provenance?.all;
        if (provenance)
          product.price_provenance = {
            ...product.price_provenance,
            [branch]: {
              ...provenance,
              changed_price: price,
              changed_by: context.actor,
              changed_at: now.toISOString(),
            },
          };
      }
    for (const effect of preview.effects) {
      const branch = effect.branch;
      const conflict = effect.regular_sale_conflict;
      if (conflict) {
        const sale = saleRecord(state, context, conflict.sale_id);
        const resolution = input.regular_sale_resolutions!.find(
          (item) => item.sale_id === sale.id,
        )!;
        sale.deferred_regular_labels ||= input.add_labels;
        if (resolution.action === "end") {
          endRecord(
            state,
            sale,
            "New regular price is not above the sale price",
            now,
            context,
          );
          continue;
        }
        const beforeSale = structuredClone(sale);
        Object.assign(sale, {
          sale_price: new SaleDecimal(resolution.sale_price!).toFixed(2),
          price_unit: resolution.price_unit!,
          revision: sale.revision + 1,
          decision_attribution: decisionAttribution(state, context, now),
          changed_by: context.actor,
          changed_by_user_id: context.user_id,
          changed_by_role_snapshot: context.role,
          changed_at: now.toISOString(),
          minimum_margin_accepted: input.accept_below_margin,
          below_cost_reason: input.below_cost_reason.trim() || undefined,
          regular_price_snapshot: price,
          cost_snapshot: effect.cost!,
        });
        recordEvent(
          state,
          sale,
          beforeSale,
          "changed",
          now,
          context,
          saleStoreDate(state.config, branch, now),
        );
      }
      const sale = activeSaleAt(state, product, branch, now);
      if (sale && input.add_labels) sale.deferred_regular_labels = true;
      else if (input.add_labels)
        queueSaleLabel(
          state,
          {
            company_id: context.company_id,
            branch,
            product_code: product.code,
          },
          "regular",
          createId("regular-label-event"),
          "regular_price_changed",
          context.actor,
          now,
        );
    }
    reconcileOffers(state, context, product.code);
    syncPriceConflicts(state, context, product.code);
    state.activity.push({
      id: createId("regular-price-history"),
      company_id: context.company_id,
      branch: input.scope === "all" ? "all" : preview.branches[0],
      product_code: product.code,
      action: "Set regular price",
      by: context.actor,
      ...actorAudit(state, context, now),
      at: now.toISOString(),
      reversible: true,
      entity_type: "product",
      entity_id: product.code,
      before,
      after: structuredClone(product),
    });
    return {
      kind: "regular",
      sales: [],
      product_code: product.code,
      branches: preview.branches,
    };
  }
  const current = input.existing_sale_id
    ? saleRecord(state, context, input.existing_sale_id)
    : null;
  const group = current ? saleGroup(state, current) : [];
  const groupId = current?.group_id ?? createId("sale-group");
  for (const sale of group)
    if (!preview.branches.includes(sale.branch))
      endRecord(state, sale, "Scope changed", now, context);
  const saved: SaleSchedule[] = [];
  for (const effect of preview.effects) {
    const previous = group.find((entry) => entry.branch === effect.branch);
    const before = previous ? structuredClone(previous) : null;
    const date = saleStoreDate(state.config, effect.branch, now);
    const status =
      input.starts_on <= date ? ("active" as const) : ("scheduled" as const);
    const sale: SaleSchedule = previous ?? {
      id: createId("sale"),
      company_id: context.company_id,
      branch: effect.branch,
      branch_id: effect.branch,
      product_code: product.code,
      group_id: groupId,
      sale_price: input.price,
      price_unit: input.price_unit,
      starts_on: input.starts_on,
      last_day: input.last_day,
      status,
      revision: 0,
      decision_attribution: decisionAttribution(state, context, now),
      created_by: context.actor,
      created_by_user_id: context.user_id,
      created_by_role_snapshot: context.role,
      created_by_username: context.username ?? "",
      created_at: now.toISOString(),
      add_promo_labels: input.add_labels,
      minimum_margin_accepted: input.accept_below_margin,
      regular_price_snapshot: effect.regular_price!,
      cost_snapshot: effect.cost!,
    };
    Object.assign(sale, {
      sale_price: new SaleDecimal(input.price).toFixed(2),
      price_unit: input.price_unit,
      starts_on: input.starts_on,
      last_day: input.last_day,
      status,
      revision: sale.revision + 1,
      decision_attribution: decisionAttribution(state, context, now),
      changed_by: context.actor,
      changed_by_user_id: context.user_id,
      changed_by_role_snapshot: context.role,
      changed_at: now.toISOString(),
      add_promo_labels: input.add_labels,
      minimum_margin_accepted: input.accept_below_margin,
      below_cost_reason: input.below_cost_reason.trim() || undefined,
      regular_price_snapshot: effect.regular_price,
      cost_snapshot: effect.cost,
    });
    if (status === "active") sale.started_at ??= now.toISOString();
    if (!previous) state.sales!.push(sale);
    recordEvent(
      state,
      sale,
      before,
      previous ? "changed" : status === "active" ? "started" : "scheduled",
      now,
      context,
      date,
    );
    if (
      before?.status === "active" &&
      status === "scheduled" &&
      salesSettings(state).add_regular_labels_on_end
    )
      queueSaleLabel(
        state,
        sale,
        "regular",
        `${sale.id}:${sale.revision}:paused`,
        "sale_ended",
        context.actor,
        now,
      );
    saved.push(sale);
  }
  return {
    kind: "sale",
    sales: saved,
    product_code: product.code,
    branches: preview.branches,
    group_id: groupId,
  };
}
export function savePriceChange(
  state: DemoState,
  context: SalesContext,
  input: ChangePriceInput,
  now = new Date(),
): PriceChangeResult {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    evaluateSalesDraft(draft, now, [], allowedSaleBranches(draft, context));
    const result = savePriceChangeDraft(draft, context, input, now);
    evaluateSalesDraft(draft, now, [], allowedSaleBranches(draft, context));
    return result;
  });
}
export function changeSale(
  state: DemoState,
  context: SalesContext,
  id: string,
  input: ChangePriceInput,
  now = new Date(),
) {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return savePriceChange(
    state,
    context,
    { ...input, mode: "sale", existing_sale_id: id },
    now,
  );
}
export function endSale(
  state: DemoState,
  context: SalesContext,
  id: string,
  options: { expected_revision: number; reason?: string; branches?: Branch[] },
  now = new Date(),
): SaleSchedule[] {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    saleAuthority(draft, context, "sales.manage");
    const selected = saleRecord(draft, context, id);
    if (selected.revision !== options.expected_revision)
      throw new SalesError("revision");
    if (selected.status === "ended") return [selected];
    const targets = options.branches ?? [selected.branch];
    const group = saleGroup(draft, selected).filter((entry) =>
      targets.includes(entry.branch),
    );
    if (
      !group.length ||
      targets.some(
        (branch) => !group.some((entry) => entry.branch === branch),
      ) ||
      group.some(
        (entry) => !allowedSaleBranches(draft, context).includes(entry.branch),
      )
    )
      throw new SalesError("stores");
    for (const sale of group)
      endRecord(
        draft,
        sale,
        options.reason?.trim() || "Ended early",
        now,
        context,
      );
    evaluateSalesDraft(draft, now, [], allowedSaleBranches(draft, context));
    return group;
  });
}
function requestRecord(
  state: DemoState,
  context: SalesContext,
  id: string,
  ownOnly = false,
) {
  if (context.company_id !== state.config.company.seed_key)
    throw new SalesError("company");
  const request = (state.sale_requests ?? []).find(
    (entry) =>
      entry.id === id &&
      entry.company_id === context.company_id &&
      allowedSaleBranches(state, context).includes(entry.branch),
  );
  if (!request) throw new SalesError("stores");
  guardDomain(state, context, "sales.read", request);
  if (
    ownOnly &&
    (!context.username || request.requester_user_id !== context.user_id)
  )
    throw new SalesError("permission");
  return request;
}
function auditRequest(
  state: DemoState,
  request: SaleRequest,
  context: SalesContext,
  action: string,
  before: SaleRequest | null,
  now: Date,
) {
  state.activity.push({
    id: createId("sale-request-history"),
    company_id: request.company_id,
    branch: request.branch,
    product_code: request.product_code,
    action,
    by: context.actor,
    ...actorAudit(state, context, now),
    at: now.toISOString(),
    reversible: false,
    entity_type: "sale_request",
    entity_id: request.id,
    before: before && structuredClone(before),
    after: structuredClone(request),
  });
}
export function requestSale(
  state: DemoState,
  context: SalesContext,
  input: ChangePriceInput,
  now = new Date(),
): SaleRequest {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    if (input.branches.length !== 1) throw new SalesError("stores");
    context = actorAtLocation(draft, context, input.branches[0]);
    requireConcreteLocation(draft, context);
    guardDomain(
      draft,
      context,
      "sales.request",
      { company_id: draft.config.company.seed_key, branch: context.branch },
      true,
    );
    evaluateSalesDraft(draft, now, [], allowedSaleBranches(draft, context));
    const preview = previewPriceChange(
      draft,
      context,
      { ...input, mode: "sale" },
      now,
    );
    assertPreview(preview);
    if (pendingSaleRequest(draft, input.product_code, context.branch, now))
      throw new SalesError("request_exists");
    const request: SaleRequest = {
      id: createId("sale-request"),
      company_id: context.company_id,
      branch: context.branch,
      branch_id: context.branch,
      product_code: input.product_code,
      requested_price: new SaleDecimal(input.price).toFixed(2),
      price_unit: input.price_unit,
      starts_on: input.starts_on,
      last_day: input.last_day,
      why: input.why?.trim() || undefined,
      decision_attribution: decisionAttribution(state, context, now),
      requester: context.actor,
      requester_user_id: context.user_id,
      requester_role_snapshot: context.role,
      requester_username: context.username,
      requested_at: now.toISOString(),
      revision: 1,
      status: "pending",
      add_promo_labels: input.add_labels,
      existing_sale_id: input.existing_sale_id,
      expected_sale_revision: input.expected_revision,
    };
    draft.sale_requests!.push(request);
    auditRequest(draft, request, context, "Request sale", null, now);
    notifySupervisors(draft, saleRecipients(draft), {
      event_key: `${request.id}:submitted:1`,
      company_id: request.company_id,
      branch: request.branch,
      kind: "sale_request_submitted",
      product_code: request.product_code,
      request_id: request.id,
      href: `approvals?sale-request=${encodeURIComponent(request.id)}`,
      created_at: now.toISOString(),
    });
    return request;
  });
}
export function editSaleRequest(
  state: DemoState,
  context: SalesContext,
  id: string,
  input: ChangePriceInput,
  expectedRevision: number,
  now = new Date(),
): SaleRequest {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    const request = requestRecord(draft, context, id, true);
    requireCapability(draft, context, "sales.request_edit_own", {
      ...domainScope(draft, request, true),
      owner_user_id: request.requester_user_id,
    });
    if (request.revision !== expectedRevision) throw new SalesError("revision");
    if (request.status !== "pending") throw new SalesError("request_decided");
    if (
      request.last_day &&
      request.last_day < saleStoreDate(draft.config, request.branch, now)
    )
      throw new SalesError("elapsed");
    if (input.product_code !== request.product_code)
      throw new SalesError("product");
    if (input.branches.length !== 1 || input.branches[0] !== request.branch)
      throw new SalesError("stores");
    assertPreview(
      previewPriceChange(
        draft,
        actorAtLocation(draft, context, request.branch),
        {
          ...input,
          mode: "sale",
          branches: [request.branch],
          scope: "current",
        },
        now,
      ),
    );
    const before = structuredClone(request);
    Object.assign(request, {
      requested_price: new SaleDecimal(input.price).toFixed(2),
      price_unit: input.price_unit,
      starts_on: input.starts_on,
      last_day: input.last_day,
      why: input.why?.trim() || undefined,
      revision: request.revision + 1,
      add_promo_labels: input.add_labels,
      existing_sale_id: input.existing_sale_id,
      expected_sale_revision: input.expected_revision,
    });
    auditRequest(draft, request, context, "Change sale request", before, now);
    return request;
  });
}
export function withdrawSaleRequest(
  state: DemoState,
  context: SalesContext,
  id: string,
  expectedRevision: number,
  now = new Date(),
): SaleRequest {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    const request = requestRecord(draft, context, id, true);
    requireCapability(draft, context, "sales.request_withdraw_own", {
      ...domainScope(draft, request, true),
      owner_user_id: request.requester_user_id,
    });
    if (request.revision !== expectedRevision) throw new SalesError("revision");
    if (request.status !== "pending") throw new SalesError("request_decided");
    const before = structuredClone(request);
    request.status = "withdrawn";
    request.revision++;
    request.decision_attribution = decisionAttribution(draft, context, now);
    request.decided_by = context.actor;
    request.decided_by_user_id = context.user_id;
    request.decided_by_role_snapshot = context.role;
    request.decided_at = now.toISOString();
    auditRequest(draft, request, context, "Withdraw sale request", before, now);
    return request;
  });
}
export function saleRequestInput(
  request: SaleRequest,
  state: DemoState,
  now = new Date(),
): ChangePriceInput {
  const today = saleStoreDate(state.config, request.branch, now);
  return {
    product_code: request.product_code,
    mode: "sale",
    scope: "current",
    branches: [request.branch],
    price: request.requested_price,
    price_unit: request.price_unit,
    starts_on: request.starts_on < today ? today : request.starts_on,
    last_day: request.last_day,
    accept_below_margin: false,
    below_cost_reason: "",
    add_labels: request.add_promo_labels,
    why: request.why,
    existing_sale_id: request.existing_sale_id,
    expected_revision: request.expected_sale_revision,
  };
}
export function resolveSaleRequest(
  state: DemoState,
  context: SalesContext,
  id: string,
  decision: "approve" | "reject",
  options: {
    expected_revision: number;
    input?: ChangePriceInput;
    reason?: string;
  },
  now = new Date(),
): SaleRequest {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    saleAuthority(draft, context, "approvals.decide");
    const request = requestRecord(draft, context, id);
    if (request.status !== "pending") {
      if (
        (decision === "approve" && request.status === "approved") ||
        (decision === "reject" && request.status === "rejected")
      )
        return request;
      throw new SalesError("request_decided");
    }
    if (request.revision !== options.expected_revision)
      throw new SalesError("revision");
    const before = structuredClone(request);
    if (
      request.last_day &&
      request.last_day < saleStoreDate(draft.config, request.branch, now)
    ) {
      request.status = "expired";
      request.decided_at = now.toISOString();
      request.revision++;
    } else if (decision === "reject") {
      if (!options.reason?.trim()) throw new SalesError("reason");
      request.status = "rejected";
      request.decision_reason = options.reason.trim();
      request.revision++;
    } else {
      const input = options.input ?? saleRequestInput(request, draft, now);
      if (
        input.product_code !== request.product_code ||
        input.mode !== "sale" ||
        input.branches.length !== 1 ||
        input.branches[0] !== request.branch
      )
        throw new SalesError("stores");
      const today = saleStoreDate(draft.config, request.branch, now);
      const approved = savePriceChangeDraft(
        draft,
        context,
        {
          ...input,
          starts_on: input.starts_on < today ? today : input.starts_on,
        },
        now,
      );
      for (const sale of approved.sales) sale.source_request_id = request.id;
      request.status = "approved";
      request.approved_sale_id = approved.sales[0].id;
      request.approved_terms = approvedSaleTerms(approved.sales[0]);
      request.revision++;
    }
    request.decision_attribution = decisionAttribution(draft, context, now);
    request.decided_by = context.actor;
    request.decided_by_user_id = context.user_id;
    request.decided_by_role_snapshot = context.role;
    request.decided_at = now.toISOString();
    auditRequest(
      draft,
      request,
      context,
      request.status === "expired"
        ? "Expire sale request"
        : decision === "approve"
          ? "Approve sale request"
          : "Reject sale request",
      before,
      now,
    );
    notification(draft, {
      company_id: request.company_id,
      branch: request.branch,
      event_key: `${request.id}:${request.status}`,
      target_username: request.requester_username,
      recipient_user_id: request.requester_user_id,
      kind: `sale_request_${request.status}` as NotificationKind,
      request_id: request.id,
      product_code: request.product_code,
      reason: request.decision_reason,
      href: `product?code=${encodeURIComponent(request.product_code)}`,
      created_at: now.toISOString(),
    });
    return request;
  });
}
function boundaryInstant(state: DemoState, branch: Branch, date: string) {
  const location = state.config.branches.find(
    (entry, index) => branchId(entry, index) === branch,
  );
  return companyLocalToUtc(
    {
      ...state.config,
      company: {
        ...state.config.company,
        timezone: location?.timezone || state.config.company.timezone,
      },
    },
    date,
    "00:00",
  );
}
/** Idempotent local-calendar lifecycle. No money, stock or ledger record is touched. */
function evaluateSalesDraft(
  state: DemoState,
  now = new Date(),
  recipients: SaleRecipient[] = [],
  locations?: readonly string[],
): boolean {
  const prior = JSON.stringify({
    sales: state.sales,
    requests: state.sale_requests,
    events: state.sale_events,
    notifications: state.notifications,
    holds: state.sale_delivery_holds,
    alerts: state.alerts,
    labels: state.label_waitlist,
    activity: state.activity,
    effects: state.sale_label_effects,
  });
  arrays(state);
  for (const sale of state.sales!) {
    if (
      sale.company_id !== state.config.company.seed_key ||
      (locations !== undefined && !locations.includes(sale.branch)) ||
      !sellingSaleBranches(state).includes(sale.branch) ||
      !productInCompany(state, sale.product_code) ||
      !validDate(sale.starts_on) ||
      (sale.last_day !== null && !validDate(sale.last_day)) ||
      !priceValue(sale.sale_price) ||
      !["each", "kg", "lb"].includes(sale.price_unit)
    )
      continue;
    const date = saleStoreDate(state.config, sale.branch, now);
    if (sale.status !== "ended" && sale.last_day && sale.last_day < date) {
      // A missed interval never produces a retroactive Promo or a fictional active price.
      const endDate = saleDateAfter(sale.last_day, 1);
      endRecord(
        state,
        sale,
        "Last day passed",
        new Date(boundaryInstant(state, sale.branch, endDate)),
        null,
      );
    } else if (sale.status === "scheduled" && sale.starts_on <= date) {
      const before = structuredClone(sale);
      sale.status = "active";
      sale.revision++;
      sale.started_at = boundaryInstant(state, sale.branch, sale.starts_on);
      recordEvent(
        state,
        sale,
        before,
        "started",
        new Date(sale.started_at),
        null,
        sale.starts_on,
      );
    }
    if (sale.status === "active" && !sale.last_day) {
      const interval = salesSettings(state).open_ended_reminder_days;
      const due = saleDateAfter(
        sale.last_reminded_on ?? sale.starts_on,
        interval,
      );
      if (Number.isInteger(interval) && interval > 0 && due <= date) {
        const before = structuredClone(sale);
        sale.last_reminded_on = date;
        const key = `${sale.company_id}:${sale.id}:reminder:${date}`;
        recordEvent(state, sale, before, "reminded", now, null, date, key);
        const alertId = `sale-reminder:${sale.id}:${date}`;
        if (
          !state.alerts.some(
            (entry) =>
              entry.company_id === sale.company_id && entry.id === alertId,
          )
        )
          state.alerts.push({
            id: alertId,
            company_id: sale.company_id,
            branch: sale.branch,
            type: "sale_no_end_reminder",
            status: "pending",
            product_code: sale.product_code,
            sale_id: sale.id,
            sale_revision: sale.revision,
            sale_price: sale.sale_price,
            sale_price_unit: sale.price_unit,
            sale_last_day: null,
          });
        notifySupervisors(state, recipients, {
          company_id: sale.company_id,
          branch: sale.branch,
          event_key: key,
          kind: "sale_no_end_reminder",
          sale_id: sale.id,
          product_code: sale.product_code,
          alert_id: alertId,
          href: `alerts?sale=${encodeURIComponent(sale.id)}`,
          created_at: now.toISOString(),
        });
      }
    }
  }
  for (const request of state.sale_requests!) {
    if (
      request.company_id !== state.config.company.seed_key ||
      (locations !== undefined && !locations.includes(request.branch)) ||
      request.status !== "pending" ||
      !sellingSaleBranches(state).includes(request.branch) ||
      !request.last_day ||
      request.last_day >= saleStoreDate(state.config, request.branch, now)
    )
      continue;
    const before = structuredClone(request);
    request.status = "expired";
    request.revision++;
    request.decided_at = now.toISOString();
    state.activity.push({
      id: createId("sale-request-expired"),
      company_id: request.company_id,
      branch: request.branch,
      product_code: request.product_code,
      action: "Expire sale request",
      by: "System",
      at: now.toISOString(),
      reversible: false,
      entity_type: "sale_request",
      entity_id: request.id,
      before,
      after: structuredClone(request),
    });
    notification(state, {
      company_id: request.company_id,
      branch: request.branch,
      event_key: `${request.id}:expired`,
      target_username: request.requester_username,
      recipient_user_id: request.requester_user_id,
      kind: "sale_request_expired",
      request_id: request.id,
      product_code: request.product_code,
      href: `product?code=${encodeURIComponent(request.product_code)}`,
      created_at: now.toISOString(),
    });
  }
  for (const hold of state.sale_delivery_holds!) {
    if (
      hold.company_id !== state.config.company.seed_key ||
      (locations !== undefined && !locations.includes(hold.branch))
    )
      continue;
    const sale = state.sales!.find(
      (entry) =>
        entry.id === hold.sale_id &&
        entry.company_id === hold.company_id &&
        entry.branch === hold.branch,
    );
    if (!sale) continue;
    hold.planned_last_day = sale.last_day;
    syncHoldInstruction(state, hold, sale, now);
    if (sale.status !== "ended") {
      if (hold.released_reminder_at) {
        for (const alert of state.alerts)
          if (
            alert.company_id === hold.company_id &&
            alert.hold_id === hold.id &&
            alert.type === "sale_delivery_release" &&
            alert.status === "pending"
          ) {
            alert.status = "resolved";
            alert.sale_decision = "keep";
            alert.decided_by = sale.changed_by ?? "System";
            alert.decided_by_user_id = sale.changed_by_user_id;
            alert.decision_attribution = sale.decision_attribution;
            alert.decided_at = now.toISOString();
          }
        delete hold.released_reminder_at;
        delete hold.released_sale_revision;
      }
      continue;
    }
    if (
      hold.released_reminder_at &&
      (hold.released_sale_revision === sale.revision ||
        hold.released_sale_revision === undefined)
    )
      continue;
    const endedAt = sale.ended_at ? new Date(sale.ended_at) : null;
    const reminderOn =
      sale.release_reminder_on ??
      (endedAt && Number.isFinite(endedAt.getTime())
        ? saleReleaseReminderDate(state, sale, endedAt)
        : "");
    if (
      !validDate(reminderOn) ||
      saleStoreDate(state.config, sale.branch, now) < reminderOn
    )
      continue;
    hold.released_reminder_at = now.toISOString();
    hold.released_sale_revision = sale.revision;
    const alertId = `sale-release:${hold.id}:${sale.revision}`;
    if (
      !state.alerts.some(
        (entry) => entry.id === alertId && entry.company_id === hold.company_id,
      )
    )
      state.alerts.push({
        id: alertId,
        company_id: hold.company_id,
        branch: hold.branch,
        type: "sale_delivery_release",
        status: "pending",
        product_code: hold.product_code,
        sale_id: sale.id,
        invoice_id: hold.invoice_id,
        invoice_line_index: hold.line_index,
        hold_id: hold.id,
        sale_last_day: sale.last_day,
      });
    notifySupervisors(state, recipients, {
      company_id: hold.company_id,
      branch: hold.branch,
      event_key: alertId,
      kind: "sale_delivery_release",
      sale_id: sale.id,
      product_code: hold.product_code,
      invoice_id: hold.invoice_id,
      alert_id: alertId,
      href: `alerts?alert=${encodeURIComponent(alertId)}`,
      created_at: now.toISOString(),
    });
  }
  return (
    prior !==
    JSON.stringify({
      sales: state.sales,
      requests: state.sale_requests,
      events: state.sale_events,
      notifications: state.notifications,
      holds: state.sale_delivery_holds,
      alerts: state.alerts,
      labels: state.label_waitlist,
      activity: state.activity,
      effects: state.sale_label_effects,
    })
  );
}
/** Repository-only clock operation. Plain, stale, wrong-source and cloned witnesses fail closed. */
export function evaluateSales(
  state: DemoState,
  attribution: SystemAttribution,
  now = new Date(attribution.applied_at),
): boolean {
  requireSystemReconciliation(state, attribution, "sales_clock");
  return evaluateSalesDraft(state, now);
}
export function syncSales(
  state: DemoState,
  attribution: SystemAttribution,
): boolean {
  return evaluateSales(state, attribution);
}
export function saveSalesSettings(
  state: DemoState,
  context: SalesContext,
  settings: SalesSettings,
) {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  saleAuthority(state, context, "settings.manage");
  if (
    !Number.isInteger(settings.default_length_days) ||
    settings.default_length_days < 1 ||
    !Number.isSafeInteger(settings.default_length_days) ||
    !Number.isInteger(settings.open_ended_reminder_days) ||
    settings.open_ended_reminder_days < 1 ||
    !Number.isSafeInteger(settings.open_ended_reminder_days) ||
    settings.quick_discount_percentages.some(
      (value) => !Number.isFinite(value) || value <= 0 || value >= 100,
    ) ||
    settings.round_down_endings.some((value) => !/^0\.\d{2}$/.test(value)) ||
    !validDate(saleDateAfter("2000-01-01", settings.default_length_days)) ||
    !validDate(saleDateAfter("2000-01-01", settings.open_ended_reminder_days))
  )
    throw new SalesError("price");
  const before = structuredClone(state.config.sales);
  state.config.sales = structuredClone(settings);
  state.activity.push({
    id: createId("sales-settings"),
    company_id: context.company_id,
    branch: "all",
    action: "Save sales settings",
    by: context.actor,
    ...actorAudit(state, context),
    at: new Date().toISOString(),
    reversible: true,
    entity_type: "config",
    entity_id: "sales",
    before,
    after: structuredClone(settings),
  });
}
export function userNotifications(
  state: DemoState,
  context: SalesContext,
): NotificationRecord[] {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  requireCapability(state, context, "notifications.read", {
    ...domainScope(state),
    owner_user_id: context.user_id,
  });
  return (state.notifications ?? [])
    .filter((entry) => notificationReadable(state, context, entry))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function markNotificationRead(
  state: DemoState,
  context: SalesContext,
  id: string,
  now = new Date(),
) {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  requireCapability(state, context, "notifications.mark_read", {
    ...domainScope(state),
    owner_user_id: context.user_id,
  });
  const record = userNotifications(state, context).find(
    (entry) => entry.id === id,
  );
  if (!record) throw new SalesError("permission");
  record.read_at ??= now.toISOString();
}
export function markAllNotificationsRead(
  state: DemoState,
  context: SalesContext,
  now = new Date(),
) {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  requireCapability(state, context, "notifications.mark_read", {
    ...domainScope(state),
    owner_user_id: context.user_id,
  });
  for (const record of userNotifications(state, context))
    record.read_at ??= now.toISOString();
}

export interface SaleReceiptCostInput {
  invoice_id: string;
  product_code: string;
  line_index: number;
  previous_cost: string;
  new_cost: string;
  regular_price_before: string;
  proposed_regular_price: string;
  source_event_id?: string;
}
/** Called only after an accepted, non-short-dated invoice has actually posted. */
export function recordSaleReceiptCost(
  state: DemoState,
  context: SalesContext,
  input: SaleReceiptCostInput,
  source:
    "invoice_post" | "invoice_content_correction" | "invoice_short_receipt",
  evidence: InternalPurchaseEvidence,
  now = new Date(),
  recipients: SaleRecipient[] = [],
): string[] {
  const original = [...(state.invoices ?? []), state.invoice].find(
    (entry) =>
      entry.company_id === state.config.company.seed_key &&
      entry.id === input.invoice_id &&
      entry.status === "posted",
  );
  if (!original) throw new SalesError("permission");
  context = freshActor(state, context);
  const purpose =
    source === "invoice_post"
      ? "invoice_post"
      : source === "invoice_content_correction"
        ? "invoice_correct"
        : source === "invoice_short_receipt"
          ? "invoice_short_resolve"
          : null;
  if (!purpose) throw new SalesError("permission");
  const authorised = invoiceEvidenceActor(
    state,
    evidence,
    original.id,
    purpose,
  );
  if (
    authorised.user_id !== context.user_id ||
    authorised.session_id !== context.session_id
  )
    throw new SalesError("permission");
  const invoice = original
    ? {
        ...effectiveInvoiceVersion(state, original),
        branch: effectiveInvoiceLocation(state, original),
      }
    : null;
  if (input.source_event_id && original) {
    const version = invoiceContentVersions(state, original).at(-1);
    const correction = state.invoice_content_corrections?.find(
      (entry) =>
        entry.id === input.source_event_id &&
        entry.company_id === original.company_id &&
        entry.invoice_id === original.id,
    );
    const receipt = state.stock_movements?.find(
      (entry) =>
        entry.id === input.source_event_id &&
        entry.company_id === original.company_id &&
        entry.invoice_id === original.id &&
        entry.line_index === input.line_index &&
        entry.product_code === input.product_code &&
        entry.type === "short_resolved_received" &&
        new SaleDecimal(entry.qty).gt(0),
    );
    if ((!correction || version?.version_id !== correction.id) && !receipt)
      return [];
  }
  const line = invoice?.lines[input.line_index];
  if (
    !invoice ||
    !line ||
    line.company_id !== invoice.company_id ||
    line.product_code !== input.product_code ||
    line.short_dated ||
    new SaleDecimal(line.qty_received_at_posting)
      .minus(line.refused_units ?? 0)
      .plus(line.qty_later_received ?? 0)
      .lte(0) ||
    !new SaleDecimal(line.unit_cost_before_tax).eq(input.new_cost)
  )
    return [];
  const sale = activeSaleAt(state, input.product_code, invoice.branch, now);
  const product = productInCompany(state, input.product_code);
  if (!sale || !product) return [];
  const costBefore = new SaleDecimal(input.previous_cost),
    costAfter = new SaleDecimal(input.new_cost);
  if (
    !costBefore.isFinite() ||
    !costAfter.isFinite() ||
    costBefore.lt(0) ||
    costAfter.lt(0)
  )
    return [];
  const salePrice = new SaleDecimal(saleCanonicalPrice(sale, state.config));
  const approval = state.approvals.find(
    (entry) =>
      entry.company_id === invoice.company_id &&
      entry.product_code === input.product_code &&
      entry.branch === invoice.branch &&
      entry.status === "pending" &&
      (entry.source_invoice_id === invoice.id ||
        entry.invoice_ids?.includes(invoice.id)),
  );
  if (approval) {
    approval.applies_after_sale = true;
    approval.sale_id = sale.id;
  }
  const types: ("sale_cost_increase" | "sale_regular_not_above_sale")[] = [];
  if (costAfter.gt(costBefore)) types.push("sale_cost_increase");
  if (
    !costAfter.eq(costBefore) &&
    new SaleDecimal(input.proposed_regular_price).lte(salePrice)
  )
    types.push("sale_regular_not_above_sale");
  const ids: string[] = [];
  for (const type of types) {
    const id = `${input.source_event_id ?? invoice.id}:${input.product_code}:${invoice.branch}:${type}`;
    if (
      state.alerts.some(
        (entry) => entry.company_id === invoice.company_id && entry.id === id,
      )
    ) {
      ids.push(id);
      continue;
    }
    state.alerts.push({
      id,
      company_id: invoice.company_id,
      branch: invoice.branch,
      branch_id: invoice.branch,
      product_code: input.product_code,
      type,
      status: "pending",
      invoice_id: invoice.id,
      invoice_line_index: input.line_index,
      supplier: invoice.supplier,
      sale_id: sale.id,
      sale_revision: sale.revision,
      sale_price: sale.sale_price,
      sale_price_unit: sale.price_unit,
      sale_last_day: sale.last_day,
      previous_cost: costBefore.toFixed(4),
      new_cost: costAfter.toFixed(4),
      regular_price_before: input.regular_price_before,
      proposed_regular_price: input.proposed_regular_price,
      prior_margin: salePrice.minus(costBefore).div(salePrice).toFixed(8),
      new_margin: salePrice.minus(costAfter).div(salePrice).toFixed(8),
      minimum_margin:
        state.config.pricing_categories.find(
          (entry) => entry.key === product.pricing_category,
        )?.minimum_margin ?? null,
      approval_id: approval?.id,
    });
    notifySupervisors(state, recipients, {
      company_id: invoice.company_id,
      branch: invoice.branch,
      event_key: id,
      kind: type,
      invoice_id: invoice.id,
      product_code: product.code,
      sale_id: sale.id,
      alert_id: id,
      href: `alerts?alert=${encodeURIComponent(id)}`,
      created_at: now.toISOString(),
    });
    ids.push(id);
  }
  return ids;
}
export interface SaleAlertDecisionInput {
  decision: "keep" | "change" | "end";
  expected_sale_revision: number;
  input?: ChangePriceInput;
  hold_delivery?: boolean;
  reason?: string;
}
function holdInstruction(
  state: DemoState,
  sale: SaleSchedule,
  invoiceNumber: string,
) {
  const product = productInCompany(state, sale.product_code);
  const en = product?.name_en ?? sale.product_code,
    fa = product?.name_fa || en;
  if (sale.status === "ended")
    return {
      en: `Sale ended: put the held ${en} on the shelf.`,
      fa: `حراج پایان یافت: ${fa} نگه‌داشته‌شده را روی قفسه بگذارید.`,
    };
  return {
    en: `Keep ${invoiceNumber}'s ${en} in the back until the sale ends${sale.last_day ? ` on ${sale.last_day}` : "; no end date"}.`,
    fa: `${fa} فاکتور ${invoiceNumber} را تا پایان حراج${sale.last_day ? ` در ${sale.last_day}` : " (بدون تاریخ پایان)"} در پشت فروشگاه نگه دارید.`,
  };
}
function syncHoldInstruction(
  state: DemoState,
  hold: SaleDeliveryHold,
  sale: SaleSchedule,
  now: Date,
) {
  const note = state.notes.find(
    (entry) =>
      entry.id === hold.note_id &&
      entry.company_id === hold.company_id &&
      entry.branch === hold.branch,
  );
  if (!note) return;
  const text = holdInstruction(state, sale, hold.invoice_number);
  if (note.text === text.en && note.text_fa === text.fa) return;
  const before = structuredClone(note);
  note.text = text.en;
  note.text_fa = text.fa;
  state.activity.push({
    id: createId("sale-hold-instruction"),
    company_id: hold.company_id,
    branch: hold.branch,
    product_code: hold.product_code,
    action: "Update held delivery instruction",
    by: sale.changed_by ?? "System",
    at: now.toISOString(),
    reversible: false,
    entity_type: "note",
    entity_id: note.id,
    before,
    after: structuredClone(note),
  });
}
function holdDelivery(
  state: DemoState,
  sale: SaleSchedule,
  alertId: string,
  context: SalesContext,
  now: Date,
) {
  const alert = state.alerts.find(
    (entry) => entry.id === alertId && entry.company_id === context.company_id,
  );
  const invoice = [...(state.invoices ?? []), state.invoice].find(
    (entry) =>
      entry.id === alert?.invoice_id &&
      entry.company_id === context.company_id &&
      entry.status === "posted" &&
      entry.branch === sale.branch,
  );
  if (!alert || !invoice || alert.invoice_line_index === undefined)
    throw new SalesError("product");
  const heldLine = effectiveInvoiceVersion(state, invoice).lines[
    alert.invoice_line_index
  ];
  if (
    !heldLine ||
    heldLine.company_id !== context.company_id ||
    heldLine.product_code !== sale.product_code ||
    heldLine.short_dated ||
    new SaleDecimal(heldLine.qty_received_at_posting)
      .minus(heldLine.refused_units ?? 0)
      .plus(heldLine.qty_later_received ?? 0)
      .lte(0)
  )
    throw new SalesError("product");
  const key = `${invoice.id}:${alert.invoice_line_index}:${sale.id}:hold`;
  if (
    state.sale_delivery_holds!.some(
      (entry) => entry.company_id === context.company_id && entry.id === key,
    )
  )
    return;
  const product = productInCompany(state, sale.product_code)!;
  const noteId = createId("sale-hold-note");
  const text = holdInstruction(state, sale, invoice.supplier_invoice_number);
  state.notes.push({
    id: noteId,
    company_id: context.company_id,
    branch: sale.branch,
    branch_id: sale.branch,
    type: "note_to_supervisor",
    text: text.en,
    text_fa: text.fa,
    sale_delivery_hold_id: key,
    by: context.actor,
    status: "open",
    created_at: now.toISOString(),
    product_code: product.code,
  });
  state.sale_delivery_holds!.push({
    id: key,
    company_id: context.company_id,
    branch: sale.branch,
    product_code: product.code,
    sale_id: sale.id,
    invoice_id: invoice.id,
    invoice_number: invoice.supplier_invoice_number,
    line_index: alert.invoice_line_index,
    note_id: noteId,
    held_by: context.actor,
    held_by_user_id: context.user_id,
    held_by_role_snapshot: context.role,
    held_at: now.toISOString(),
    planned_last_day: sale.last_day,
  });
}
export function holdSaleDelivery(
  state: DemoState,
  context: SalesContext,
  id: string,
  expectedSaleRevision: number,
  now = new Date(),
) {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    const alert = draft.alerts.find((item) => item.id === id);
    if (
      !alert ||
      !alert.sale_id ||
      alert.status !== "pending" ||
      !["sale_cost_increase", "sale_regular_not_above_sale"].includes(
        alert.type,
      )
    )
      throw new SalesError("product");
    guardDomain(draft, context, "sales.delivery_hold", alert, true);
    const sale = saleRecord(draft, context, alert.sale_id);
    if (sale.revision !== expectedSaleRevision)
      throw new SalesError("revision");
    holdDelivery(draft, sale, id, context, now);
    draft.activity.push({
      id: createId("sale-hold-history"),
      company_id: sale.company_id,
      branch: sale.branch,
      product_code: sale.product_code,
      action: "Keep this delivery in the back",
      by: context.actor,
      ...actorAudit(draft, context, now),
      at: now.toISOString(),
      reversible: false,
      entity_type: "sale_hold",
      entity_id: id,
    });
    return draft.sale_delivery_holds!.find(
      (hold) =>
        hold.sale_id === sale.id && hold.invoice_id === alert.invoice_id,
    );
  });
}

export function decideSaleCostAlert(
  state: DemoState,
  context: SalesContext,
  id: string,
  options: SaleAlertDecisionInput,
  now = new Date(),
) {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    saleAuthority(draft, context, "sales.cost_alert_decide");
    const alert = draft.alerts.find(
      (entry) =>
        entry.id === id &&
        entry.company_id === context.company_id &&
        allowedSaleBranches(draft, context).includes(entry.branch) &&
        [
          "sale_cost_increase",
          "sale_regular_not_above_sale",
          "sale_no_end_reminder",
        ].includes(entry.type),
    );
    if (!alert || !alert.sale_id) throw new SalesError("stores");
    if (alert.status !== "pending") return alert;
    const sale = saleRecord(draft, context, alert.sale_id);
    if (sale.revision !== options.expected_sale_revision)
      throw new SalesError("revision");
    const before = structuredClone(alert);
    if (options.hold_delivery) holdDelivery(draft, sale, id, context, now);
    if (options.decision === "change") {
      if (
        !options.input ||
        options.input.mode !== "sale" ||
        options.input.product_code !== sale.product_code
      )
        throw new SalesError("price");
      savePriceChangeDraft(
        draft,
        context,
        {
          ...options.input,
          existing_sale_id: sale.id,
          expected_revision: sale.revision,
        },
        now,
      );
    } else if (options.decision === "end")
      endRecord(
        draft,
        sale,
        options.reason?.trim() || "Ended early",
        now,
        context,
      );
    else if (alert.type === "sale_no_end_reminder")
      sale.last_reminded_on = saleStoreDate(draft.config, sale.branch, now);
    alert.status = "resolved";
    alert.sale_decision = options.decision;
    alert.decided_by = context.actor;
    alert.decided_by_user_id = context.user_id;
    alert.decision_attribution = decisionAttribution(draft, context, now);
    alert.decided_at = now.toISOString();
    draft.activity.push({
      id: createId("sale-alert-decision"),
      company_id: context.company_id,
      branch: alert.branch,
      product_code: alert.product_code,
      action: "Decide sale alert",
      by: context.actor,
      ...actorAudit(state, context, now),
      at: now.toISOString(),
      reversible: false,
      entity_type: "alert",
      entity_id: alert.id,
      before,
      after: structuredClone(alert),
    });
    evaluateSalesDraft(draft, now, [], allowedSaleBranches(draft, context));
    return alert;
  });
}
export const resolveSaleCostAlert = decideSaleCostAlert;
function approvedSaleTerms(sale: SaleSchedule): ApprovedSaleTerms {
  return {
    sale_id: sale.id,
    sale_revision: sale.revision,
    sale_price: sale.sale_price,
    price_unit: sale.price_unit,
    starts_on: sale.starts_on,
    last_day: sale.last_day,
  };
}

function invalidRetainedSales(state: DemoState): SaleSchedule[] {
  return (state.sales ?? []).filter((sale) => {
    if (
      sale.company_id !== state.config.company.seed_key ||
      sale.status === "ended"
    )
      return false;
    const product = productInCompany(state, sale.product_code);
    const regular = product && baseRegularPrice(product, sale.branch);
    if (
      !regular ||
      !priceValue(regular) ||
      !priceValue(sale.sale_price) ||
      !["each", "lb", "kg"].includes(sale.price_unit)
    )
      return false;
    return new SaleDecimal(saleCanonicalPrice(sale, state.config)).gte(regular);
  });
}

/** Retain the original record and evidence; append the end of an invalid overlay. */
function repairSalePriceInvariantsDraft(state: DemoState, now: Date) {
  for (const sale of invalidRetainedSales(state))
    endRecord(
      state,
      sale,
      "Saved sale price is not below the regular price",
      now,
      null,
    );
  for (const request of state.sale_requests ?? []) {
    if (
      request.company_id !== state.config.company.seed_key ||
      request.status !== "approved" ||
      request.approved_terms ||
      !request.approved_sale_id
    )
      continue;
    // Never substitute today's mutable sale terms for historical approval evidence.
    const evidence = (state.sale_events ?? []).filter(
      (event) =>
        event.company_id === request.company_id &&
        event.sale_id === request.approved_sale_id &&
        event.occurred_at === request.decided_at &&
        ["started", "scheduled", "changed"].includes(event.kind) &&
        (!request.decided_by_user_id ||
          event.actor_user_id === request.decided_by_user_id),
    );
    if (evidence.length === 1)
      request.approved_terms = approvedSaleTerms(evidence[0].after);
  }
}

/** Existing IDB shops bypass legacy hydration. Back up and verify before repairing them. */
export async function migrateSalePriceInvariants(
  repository: BrowserAuthorityRepository,
  companyId: string,
): Promise<void> {
  await migrateSupplierProfiles(repository, companyId);
  const hash = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
  class ChangedDuringBackup extends Error {}
  for (let attempt = 0; attempt < 8; attempt++) {
    const loaded = await repository.loadBusiness<DemoState>(companyId);
    const candidate = structuredClone(loaded.state);
    repairSalePriceInvariantsDraft(candidate, new Date());
    const raw = JSON.stringify(loaded.state);
    if (JSON.stringify(candidate) === raw) return;
    await repository.archivePrivateBackup(
      {
        id: `c9-sales:${companyId}:${loaded.revision}:${hash(raw)}`,
        company_id: companyId,
        source_key: `business:${companyId}:revision:${loaded.revision}`,
        raw,
        sha256: hash(raw),
        created_at: new Date().toISOString(),
      },
      hash,
    );
    try {
      await repository.runSystemReconciliation<DemoState, void>(
        companyId,
        "sales_clock",
        (draft, attribution) => {
          requireSystemReconciliation(draft, attribution, "sales_clock");
          if (JSON.stringify(draft) !== raw) throw new ChangedDuringBackup();
          repairSalePriceInvariantsDraft(
            draft,
            new Date(attribution.applied_at),
          );
        },
      );
      return;
    } catch (cause) {
      if (!(cause instanceof ChangedDuringBackup)) throw cause;
    }
  }
  throw new Error("migration_conflict");
}
/** Additive schema migration: never populate fixture business records into a saved shop. */
export function hydrateSalesState(state: DemoState): DemoState {
  if (state.prototype_c8_schema === 1) return state;
  state.config.sales = {
    ...structuredClone(configSeed.sales),
    ...state.config.sales,
  };
  arrays(state);
  const product = state.products.find(
    (entry) =>
      entry.company_id === state.config.company.seed_key &&
      entry.code === "0015",
  );
  if (product?.name_fa === "زرشک خشک 100 گرمی")
    product.name_fa = "زرشک خشک ۱۰۰ گرمی";
  const configuredIdentity = (username: string | undefined) => {
    if (!username) return null;
    const matches = demoSeed.demo_users.filter(
      (person) =>
        person.username === username ||
        ("aliases" in person &&
          Array.isArray(person.aliases) &&
          person.aliases.some((alias) => String(alias) === username)),
    );
    return matches.length === 1 && "id" in matches[0]
      ? String(matches[0].id)
      : null;
  };
  for (const sale of state.sales ?? []) {
    if (sale.company_id !== state.config.company.seed_key) continue;
    sale.created_by_user_id ??=
      configuredIdentity(sale.created_by_username) ?? undefined;
  }
  for (const request of state.sale_requests ?? []) {
    if (request.company_id !== state.config.company.seed_key) continue;
    request.requester_user_id ??=
      configuredIdentity(request.requester_username) ?? undefined;
  }
  for (const item of state.notifications ?? []) {
    if (item.company_id !== state.config.company.seed_key) continue;
    item.recipient_user_id ??=
      configuredIdentity(item.target_username) ?? undefined;
  }
  state.prototype_c8_schema = 1;
  return state;
}
/** Fresh/reset only. These are configured fictional demo scenarios, never restored over user records. */
export function hydrateSalesDemo(
  state: DemoState,
  now = new Date(),
): DemoState {
  hydrateSalesState(state);
  const fixture = demoSeed.sales_demo;
  if (!fixture || state.config.company.seed_key !== configSeed.company.seed_key)
    return state;
  const manager = demoSeed.demo_users.find(
    (entry) => entry.username === "manager" || entry.username === "supervisor",
  )!;
  const worker = demoSeed.demo_users.find(
    (entry) => entry.role === "floor_worker",
  )!;
  const saleData = fixture.running_sale;
  const product = productInCompany(state, saleData.product_code);
  const demoRegular = product && baseRegularPrice(product, saleData.branch);
  if (
    product &&
    demoRegular &&
    priceValue(demoRegular) &&
    new SaleDecimal(saleData.sale_price).lt(demoRegular) &&
    sellingSaleBranches(state).includes(saleData.branch)
  ) {
    const date = saleStoreDate(state.config, saleData.branch, now);
    state.sales!.push({
      id: saleData.id,
      company_id: state.config.company.seed_key,
      branch: saleData.branch,
      branch_id: saleData.branch,
      product_code: product.code,
      group_id: saleData.id,
      sale_price: saleData.sale_price,
      price_unit: "each",
      starts_on: saleDateAfter(date, saleData.starts_relative_days),
      last_day: saleDateAfter(date, saleData.last_day_relative_days),
      status: "active",
      revision: 1,
      created_by: manager.name,
      created_by_user_id: "id" in manager ? String(manager.id) : undefined,
      created_by_role_snapshot: decodeCurrentRole(manager.role) ?? undefined,
      created_by_username: manager.username,
      created_at: now.toISOString(),
      started_at: now.toISOString(),
      add_promo_labels: true,
      minimum_margin_accepted: false,
      regular_price_snapshot: baseRegularPrice(product, saleData.branch)!,
      cost_snapshot: product.last_cost_before_tax,
    });
  }
  const seeded = state.sales!.find(
    (entry) =>
      entry.id === saleData.id &&
      entry.company_id === state.config.company.seed_key,
  );
  if (seeded)
    recordEvent(state, seeded, null, "started", now, null, seeded.starts_on);
  const request = fixture.pending_request;
  if (
    productInCompany(state, request.product_code) &&
    sellingSaleBranches(state).includes(request.branch)
  ) {
    const date = saleStoreDate(state.config, request.branch, now);
    state.sale_requests!.push({
      id: request.id,
      company_id: state.config.company.seed_key,
      branch: request.branch,
      branch_id: request.branch,
      product_code: request.product_code,
      requested_price: request.requested_price,
      price_unit: "each",
      starts_on: saleDateAfter(date, request.starts_relative_days),
      last_day: saleDateAfter(date, request.last_day_relative_days),
      why: request.why,
      requester: worker.name,
      requester_user_id: "id" in worker ? String(worker.id) : undefined,
      requester_role_snapshot: decodeCurrentRole(worker.role) ?? undefined,
      requester_username: worker.username,
      requested_at: now.toISOString(),
      revision: 1,
      status: "pending",
      add_promo_labels: true,
    });
  }
  return state;
}

/** Sale-specific inverse: retain lifecycle/print evidence and the CURRENT regular baseline. */
export function revertSaleLifecycle(
  state: DemoState,
  context: SalesContext,
  activityId: string,
  mode: "undo" | "revert",
  now = new Date(),
) {
  try {
    context = freshActor(state, context);
  } catch {
    throw new SalesError("permission");
  }
  return transact(state, (draft) => {
    saleAuthority(draft, context, "sales.manage");
    const entry = draft.activity.find(
      (item) =>
        item.id === activityId &&
        item.company_id === context.company_id &&
        item.entity_type === "sale" &&
        context.allowed_branches.includes(item.branch),
    );
    if (
      !entry ||
      !entry.entity_id ||
      !entry.reversible ||
      draft.activity.some((item) => item.reversed_activity_id === entry.id)
    )
      throw new SalesError("permission");
    const sale = saleRecord(draft, context, entry.entity_id);
    const expected = entry.after as SaleSchedule;
    if (!expected || sale.revision !== expected.revision)
      throw new SalesError("revision");
    const original = entry.before as SaleSchedule | null;
    const before = structuredClone(sale);
    if (!original) {
      sale.status = "ended";
      sale.ended_at = now.toISOString();
      sale.ended_reason = "Reverted";
      sale.release_reminder_on = saleReleaseReminderDate(draft, sale, now);
    } else {
      const today = saleStoreDate(draft.config, sale.branch, now);
      if (
        original.last_day &&
        original.last_day < today &&
        original.status !== "ended"
      )
        throw new SalesError("elapsed");
      if (original.status !== "ended") {
        const preview = previewPriceChange(
          draft,
          context,
          {
            product_code: sale.product_code,
            mode: "sale",
            scope: "current",
            branches: [sale.branch],
            price: original.sale_price,
            price_unit: original.price_unit,
            starts_on: original.starts_on,
            last_day: original.last_day,
            add_labels: original.add_promo_labels,
            accept_below_margin: original.minimum_margin_accepted,
            below_cost_reason: original.below_cost_reason ?? "",
            existing_sale_id: sale.id,
            expected_revision: sale.revision,
          },
          now,
        );
        // Ending was the action being reverted; the record is intentionally ended now.
        const currentCost = productInCompany(draft, sale.product_code);
        const cost = currentCost
          ? productStoreCost(
              draft,
              actorAtLocation(draft, context, sale.branch),
              currentCost,
            )
          : null;
        const kept = draft.alerts.find(
          (alert) =>
            alert.company_id === sale.company_id &&
            alert.branch === sale.branch &&
            alert.sale_id === sale.id &&
            alert.status === "resolved" &&
            alert.sale_decision === "keep" &&
            alert.sale_price === original.sale_price &&
            alert.sale_price_unit === original.price_unit &&
            Boolean(
              cost &&
              alert.new_cost &&
              new SaleDecimal(cost).eq(alert.new_cost),
            ),
        );
        const issues = preview.issues.filter((issue) => {
          if (issue.code === "revision" && sale.status === "ended")
            return false;
          if (
            kept &&
            ["below_margin", "below_cost_reason"].includes(issue.code)
          )
            return false;
          if (
            kept &&
            kept.type === "sale_regular_not_above_sale" &&
            issue.code === "sale_price_not_lower" &&
            kept.proposed_regular_price ===
              baseRegularPrice(currentCost!, sale.branch)
          )
            return false;
          return true;
        });
        if (issues.length) throw new SalesError(issues[0].code, issues);
      }
      const revision = sale.revision;
      Object.assign(sale, structuredClone(original), {
        revision,
        status:
          original.status === "ended"
            ? "ended"
            : original.starts_on <= today
              ? "active"
              : "scheduled",
      });
      if (sale.status !== "ended") {
        delete sale.ended_at;
        delete sale.ended_reason;
        delete sale.release_reminder_on;
      } else if (!original.release_reminder_on) {
        delete sale.release_reminder_on;
      }
    }
    sale.revision = before.revision + 1;
    sale.changed_by = context.actor;
    sale.changed_at = now.toISOString();
    recordEvent(
      draft,
      sale,
      before,
      "reverted",
      now,
      context,
      saleStoreDate(draft.config, sale.branch, now),
    );
    const audit = draft.activity.at(-1)!;
    audit.action = mode === "undo" ? "Undo" : "Revert";
    audit.reversible = false;
    audit.reversed_activity_id = entry.id;
    audit.reversal_kind = mode;
    evaluateSalesDraft(draft, now, [], allowedSaleBranches(draft, context));
    return audit;
  });
}
