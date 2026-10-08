import Decimal from "decimal.js";
import { demoSeed } from "./config";
import { effectiveOffer, effectivePrice } from "./catalog";
export { isOfferScheduledNow } from "./catalog";
import type {
  Approval,
  Branch,
  DemoState,
  Offer,
  Product,
  Role,
} from "./types";

export type PriceScope = "all" | "branch";
export const demoBranches = demoSeed.branches as Exclude<Branch, "all">[];

export function recordDemoActivity(
  state: DemoState,
  action: string,
  productCode: string,
  branch: Branch,
  role: Role = "supervisor",
): void {
  state.activity.push({
    id: `activity:${state.activity.length}`,
    company_id: state.config.company.seed_key,
    branch,
    product_code: productCode,
    action,
    by: demoSeed.demo_users.find((user) => user.role === role)!.name,
    at: new Date().toISOString(),
  });
}

function currentProduct(state: DemoState, code: string): Product {
  const product = state.products.find(
    (p) => p.code === code && p.company_id === state.config.company.seed_key,
  );
  if (!product) throw new Error("Product not found in this company");
  return product;
}

function priceAmount(value: string): string {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a nonnegative price with at most two decimals");
  return new Decimal(value).toFixed(2);
}

function samePrice(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return Boolean(left && right && new Decimal(left).eq(right));
}

export function offerMapping(
  state: DemoState,
  price: string | null | undefined,
) {
  return price
    ? state.config.promotions.price_to_offer.find((mapping) =>
        samePrice(mapping.price, price),
      )
    : undefined;
}

export function approvalSnapshot(
  state: DemoState,
  productCode: string,
): string {
  const product = currentProduct(state, productCode);
  return JSON.stringify({
    price: product.selling_price,
    overrides: product.branch_prices ?? {},
    proposals: state.approvals
      .filter(
        (approval) =>
          approval.company_id === product.company_id &&
          approval.product_code === productCode &&
          approval.status === "pending",
      )
      .map((approval) => [approval.id, approval.proposed_price, approval.type]),
    offers: state.offers
      .filter(
        (offer) =>
          offer.product_code === productCode &&
          offer.company_id === product.company_id,
      )
      .map((offer) => [
        offer.id,
        offer.status,
        offer.price,
        offer.branch,
        offer.start_date,
        offer.end_date,
      ]),
  });
}

/** Recheck after every effective price change, including removal of branch overrides. */
export function reconcileOffers(
  state: DemoState,
  productCode: string,
  companyId = state.config.company.seed_key,
): void {
  if (companyId !== state.config.company.seed_key) return;
  const product = currentProduct(state, productCode);
  const ownOffers = state.offers.filter(
    (offer) =>
      offer.company_id === companyId && offer.product_code === productCode,
  );
  for (const offer of ownOffers) {
    const price =
      offer.scope === "all"
        ? product.selling_price
        : effectivePrice(state, product, offer.branch);
    const mapping = offerMapping(state, price);
    if (
      offer.status !== "stopped" &&
      (!samePrice(offer.price, price) ||
        !mapping ||
        mapping.offer !== offer.label)
    )
      offer.status = "stopped";
  }
  const scopes: { scope: PriceScope; branch: Branch; price: string | null }[] =
    [
      { scope: "all", branch: "all", price: product.selling_price || null },
      ...demoBranches
        .filter((branch) => Boolean(product.branch_prices?.[branch]))
        .map((branch) => ({
          scope: "branch" as const,
          branch,
          price: effectivePrice(state, product, branch),
        })),
    ];
  for (const item of scopes) {
    const mapping = offerMapping(state, item.price);
    if (!mapping || !item.price) continue;
    const existsInScope = state.offers.some(
      (offer) =>
        offer.company_id === companyId &&
        offer.product_code === productCode &&
        offer.status !== "stopped" &&
        offer.scope === item.scope &&
        offer.branch === item.branch &&
        samePrice(offer.price, item.price),
    );
    const inherited =
      item.scope === "branch" &&
      ownOffers.some(
        (offer) =>
          offer.scope === "all" &&
          offer.status === "active" &&
          samePrice(offer.price, item.price),
      );
    if (existsInScope || inherited) continue;
    state.offers.push({
      id: `offer:${companyId}:${productCode}:${item.branch}:${state.offers.length}`,
      company_id: companyId,
      product_code: productCode,
      branch: item.branch,
      scope: item.scope,
      price: item.price,
      label: mapping.offer,
      pool: mapping.mix_and_match_pool,
      currency: state.config.company.currency,
      mix_and_match: true,
      status: "suggested",
    });
  }
}

/** Intentional conflicts acknowledge an exact set of effective prices, never future changes. */
export function syncPriceConflicts(
  state: DemoState,
  productCode: string,
  companyId = state.config.company.seed_key,
): void {
  if (companyId !== state.config.company.seed_key) return;
  const product = currentProduct(state, productCode);
  const prices = Object.fromEntries(
    demoBranches
      .map((branch) => [branch, effectivePrice(state, product, branch)])
      .filter((entry): entry is [Branch, string] => Boolean(entry[1])),
  );
  const snapshot = JSON.stringify(prices);
  const own = state.alerts.filter(
    (alert) =>
      alert.company_id === companyId &&
      alert.type === "price_conflict" &&
      alert.product_code === productCode,
  );
  const differs = new Set(Object.values(prices)).size > 1;
  const current = own.find(
    (alert) =>
      JSON.stringify(alert.branch_prices) === snapshot &&
      alert.status !== "resolved",
  );
  for (const alert of own)
    if (!differs || JSON.stringify(alert.branch_prices) !== snapshot)
      alert.status = "resolved";
  if (differs && !current)
    state.alerts.push({
      id: `conflict:${companyId}:${productCode}:${state.alerts.length}`,
      company_id: companyId,
      branch: "all",
      type: "price_conflict",
      product_code: productCode,
      status: "pending",
      branch_prices: prices,
    });
}

export function applyApprovedPrice(
  state: DemoState,
  productCode: string,
  price: string,
  scope: PriceScope,
  branch: Branch,
  action = "Apply price to all branches",
): void {
  const product = currentProduct(state, productCode);
  const amount = priceAmount(price);
  if (scope === "all") {
    product.selling_price = amount;
    product.branch_prices = {};
  } else {
    if (branch === "all" || !demoBranches.includes(branch))
      throw new Error("Choose one branch");
    product.branch_prices = { ...product.branch_prices, [branch]: amount };
  }
  product.status = "active";
  reconcileOffers(state, productCode);
  syncPriceConflicts(state, productCode);
  recordDemoActivity(
    state,
    action,
    productCode,
    scope === "all" ? "all" : branch,
  );
}

export function resolveApproval(
  state: DemoState,
  id: string,
  decision: "approve" | "reject",
  scope: PriceScope,
  branch: Branch,
  reason?: string,
  expectedSnapshot?: string,
): void {
  const approval = state.approvals.find(
    (item) =>
      item.id === id && item.company_id === state.config.company.seed_key,
  );
  if (!approval || approval.status !== "pending")
    throw new Error("Approval is no longer pending");
  const product = currentProduct(state, approval.product_code);
  if (
    expectedSnapshot !== undefined &&
    expectedSnapshot !== approvalSnapshot(state, product.code)
  )
    throw new Error("Prices changed. Refresh the approval preview");
  if (decision === "approve" && approval.type === "margin_review")
    throw new Error(
      "Keep the approved price with a reason or propose an override",
    );
  if (approval.type === "barcode_conflict") {
    approval.status = decision === "approve" ? "approved" : "rejected";
    if (reason?.trim()) approval.acknowledgment_reason = reason.trim();
    recordDemoActivity(
      state,
      decision === "approve"
        ? "Keep barcode mappings"
        : "Reject barcode change",
      product.code,
      approval.branch,
    );
    return;
  }
  if (decision === "approve")
    applyApprovedPrice(
      state,
      product.code,
      approval.proposed_price,
      scope,
      branch,
      approval.type === "new_product" ? "Approve product" : "Approve price",
    );
  approval.status = decision === "approve" ? "approved" : "rejected";
  approval.scope = scope;
  if (decision === "reject")
    recordDemoActivity(state, "Reject proposal", product.code, approval.branch);
  if (reason?.trim()) approval.acknowledgment_reason = reason.trim();
  const pending = state.approvals.find(
    (item) =>
      item.company_id === product.company_id &&
      item.product_code === product.code &&
      item.status === "pending" &&
      item.type !== "margin_review",
  );
  product.pending_price = pending?.proposed_price ?? null;
  product.pending_branch = pending?.branch;
  if (
    decision === "reject" &&
    approval.type === "new_product" &&
    !product.selling_price &&
    !Object.keys(product.branch_prices ?? {}).length
  )
    product.status = "archived";
}

export function keepApprovedPrice(
  state: DemoState,
  id: string,
  reason: string,
): void {
  if (!reason.trim()) throw new Error("Add a reason for keeping this price");
  const review = state.approvals.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.id === id &&
      item.type === "margin_review" &&
      item.status === "pending",
  );
  if (!review) throw new Error("Margin review is no longer pending");
  review.status = "approved";
  review.acknowledgment_reason = reason.trim();
  recordDemoActivity(
    state,
    "Keep approved price",
    review.product_code,
    review.branch,
  );
}

export function proposeManualOverride(
  state: DemoState,
  reviewId: string,
  price: string,
  reason: string,
): Approval {
  const review = state.approvals.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.id === reviewId &&
      item.type === "margin_review" &&
      item.status === "pending",
  );
  if (!review) throw new Error("Margin review is no longer pending");
  const product = currentProduct(state, review.product_code);
  const amount = priceAmount(price);
  if (!reason.trim()) throw new Error("Add a reason for the manual override");
  const approval: Approval = {
    ...review,
    id: `override:${review.company_id}:${state.approvals.length}`,
    type: "price_change",
    proposed_price: amount,
    current_price: effectivePrice(state, product, review.branch),
    reason: reason.trim(),
    manual_override: true,
    status: "pending",
  };
  state.approvals.push(approval);
  product.pending_price = amount;
  product.pending_branch = review.branch;
  review.status = "approved";
  review.acknowledgment_reason = reason.trim();
  recordDemoActivity(
    state,
    "Propose manual override",
    review.product_code,
    review.branch,
  );
  return approval;
}

export function markPriceConflictIntentional(
  state: DemoState,
  id: string,
): void {
  const alert = state.alerts.find(
    (item) =>
      item.id === id &&
      item.company_id === state.config.company.seed_key &&
      item.type === "price_conflict" &&
      item.status === "pending",
  );
  if (!alert) throw new Error("Conflict is no longer pending");
  const product = currentProduct(state, alert.product_code);
  const prices = Object.fromEntries(
    demoBranches
      .map((branch) => [branch, effectivePrice(state, product, branch)])
      .filter((entry): entry is [Branch, string] => Boolean(entry[1])),
  );
  if (
    Object.entries(alert.branch_prices ?? {}).some(
      ([branch, price]) => !samePrice(prices[branch], price),
    )
  ) {
    syncPriceConflicts(state, alert.product_code);
    throw new Error("Prices changed. Review the new conflict");
  }
  alert.branch_prices = prices;
  alert.status = "intentional";
  recordDemoActivity(state, "Mark as intentional", alert.product_code, "all");
}

export function businessDate(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function offerReadiness(
  state: DemoState,
  offer: Offer,
):
  | "ready"
  | "price_changed"
  | "mapping_missing"
  | "dates_invalid"
  | "company_mismatch" {
  const product = state.products.find(
    (item) =>
      item.code === offer.product_code &&
      item.company_id === state.config.company.seed_key,
  );
  if (offer.company_id !== state.config.company.seed_key || !product)
    return "company_mismatch";
  const price =
    offer.scope === "all"
      ? product.selling_price
      : effectivePrice(state, product, offer.branch);
  if (!samePrice(price, offer.price)) return "price_changed";
  const mapping = offerMapping(state, price);
  if (
    !mapping ||
    mapping.offer !== offer.label ||
    mapping.mix_and_match_pool !== offer.pool ||
    offer.currency !== state.config.company.currency
  )
    return "mapping_missing";
  const validDate = (value?: string) =>
    !value ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
      new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value);
  if (
    !validDate(offer.start_date) ||
    !validDate(offer.end_date) ||
    (offer.start_date && offer.end_date && offer.start_date > offer.end_date)
  )
    return "dates_invalid";
  return "ready";
}

export function activateOffer(
  state: DemoState,
  candidate: Offer,
  role: Role = "floor_worker",
): void {
  const action =
    candidate.status === "suggested" ? "Confirm offer" : "Create offer";
  if (offerReadiness(state, candidate) !== "ready")
    throw new Error("Offer is not ready to activate");
  if (candidate.scope === "branch" && candidate.branch === "all")
    throw new Error("Choose one branch");
  for (const offer of state.offers)
    if (
      offer.id !== candidate.id &&
      offer.company_id === candidate.company_id &&
      offer.product_code === candidate.product_code &&
      offer.scope === candidate.scope &&
      offer.branch === candidate.branch &&
      offer.status !== "stopped"
    )
      offer.status = "stopped";
  const existing = state.offers.find(
    (offer) =>
      offer.id === candidate.id && offer.company_id === candidate.company_id,
  );
  if (existing) Object.assign(existing, candidate, { status: "active" });
  else state.offers.push({ ...candidate, status: "active" });
  recordDemoActivity(
    state,
    action,
    candidate.product_code,
    candidate.branch,
    role,
  );
}

export function stopOffer(
  state: DemoState,
  id: string,
  dismissed = false,
  role: Role = "floor_worker",
): void {
  const offer = state.offers.find(
    (item) =>
      item.id === id && item.company_id === state.config.company.seed_key,
  );
  if (!offer || offer.status === "stopped") return;
  offer.status = "stopped";
  recordDemoActivity(
    state,
    dismissed ? "Dismiss" : "Stop offer",
    offer.product_code,
    offer.branch,
    role,
  );
}

export function setAlertStatus(
  state: DemoState,
  id: string,
  status: "pending" | "resolved",
  note?: string,
): void {
  const alert = state.alerts.find(
    (item) =>
      item.id === id && item.company_id === state.config.company.seed_key,
  );
  if (!alert) return;
  alert.status = status;
  if (note?.trim()) alert.note = note.trim();
  recordDemoActivity(
    state,
    status === "pending" ? "Keep as pending" : "Mark as taken care of",
    alert.product_code,
    alert.branch,
  );
}

export function effectivePool(
  state: DemoState,
  branch: Branch,
  pool: string,
  currency: string,
): Product[] {
  if (branch === "all") return [];
  return state.products
    .filter(
      (product) =>
        product.company_id === state.config.company.seed_key &&
        product.status === "active",
    )
    .filter((product) => {
      const offer = effectiveOffer(state, product, branch);
      return Boolean(
        offer &&
        offer.mix_and_match &&
        offer.pool === pool &&
        offer.currency === currency,
      );
    });
}
