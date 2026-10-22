import { offerVersion, stopCompanyOfferAtStore } from "./offer-store-scopes";
import { businessFingerprint } from "./business-fingerprint";
import type { AuthenticatedActor } from "./authority-types";
import { actorAtLocation, freshActor, decisionAttribution } from "./authority";
import { requireCapability } from "./permissions";
import { actorAudit, domainScope } from "./domain-authority";
import Decimal from "decimal.js";
import { demoSeed } from "./config";
import { createId } from "./ids";
import {
  effectiveOffer,
  conflictingBarcodeProduct,
  regularPrice,
  type CatalogPriceReadState,
  type PriceProduct,
} from "./catalog";
import { branchSellsToCustomers, sellingBranches } from "./settings";
import {
  clearManualPriceMarker,
  hydrateProductManualPriceMarkers,
  setManualPriceMarker,
  manualPrice,
} from "./manual-prices";
import { productStoreCost } from "./product-costs";
import { effectiveApprovalLocation } from "./received";
export { isOfferScheduledNow } from "./catalog";
import type {
  Approval,
  CompanyConfig,
  Branch,
  DemoState,
  Offer,
  Product,
} from "./types";

export type PriceScope = "all" | "branch";
export const demoBranches = demoSeed.branches as Exclude<Branch, "all">[];

function recordDemoActivity(
  state: DemoState,
  actor: AuthenticatedActor,
  action: string,
  productCode: string,
  branch: Branch,
): void {
  actor = freshActor(state, actor);
  state.activity.push({
    id: `activity:${state.activity.length}`,
    company_id: state.config.company.seed_key,
    branch,
    product_code: productCode,
    action,
    reversible: true,
    by: actor.actor,
    ...actorAudit(state, actor),
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
  state: { config: Pick<CompanyConfig, "promotions"> },
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
  actor: AuthenticatedActor,
  productCode: string,
): string {
  actor = freshActor(state, actor);
  const product = currentProduct(state, productCode);
  requireCapability(
    state,
    actor,
    "approvals.decide",
    domainScope(state, product),
  );
  return businessFingerprint({
    selling_locations: sellingBranches(state.config),
    price: product.selling_price,
    overrides: product.branch_prices ?? {},
    manual_prices: product.manual_prices,
    store_costs: sellingBranches(state.config).map((branch) => [
      branch,
      productStoreCost(state, actorAtLocation(state, actor, branch), product),
    ]),
    proposals: state.approvals
      .filter(
        (approval) =>
          approval.company_id === product.company_id &&
          approval.product_code === productCode &&
          approval.status === "pending",
      )
      .map((approval) => [
        approval.id,
        approval.proposed_price,
        approval.type,
        effectiveApprovalLocation(state, approval),
        approval.source_invoice_id,
        approval.invoice_ids,
        approval.unit_cost,
        approval.margin,
        approval.threshold,
        approval.manual_price_review,
        (state.invoice_location_corrections ?? [])
          .filter(
            (correction) =>
              correction.company_id === product.company_id &&
              (correction.invoice_id === approval.source_invoice_id ||
                approval.invoice_ids?.includes(correction.invoice_id)),
          )
          .map((correction) => [
            correction.id,
            correction.from_branch,
            correction.to_branch,
          ]),
      ]),
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

export interface ApprovalLocationEffect {
  locations: Branch[];
  old_price: string | null;
  new_price: string;
  offer_label?: string;
  offer_stops: boolean;
  override_removed: boolean;
}

/** Group locations only when every visible consequence is identical. */
export function approvalLocationEffects(
  state: DemoState,
  actor: AuthenticatedActor,
  approval: Approval,
  scope: PriceScope,
  target: Branch,
): ApprovalLocationEffect[] {
  actor = freshActor(state, actor);
  const canonical = state.approvals.find((item) => item.id === approval.id);
  if (!canonical || canonical !== approval)
    throw new Error("Approval changed. Refresh the preview");
  requireCapability(state, actor, "approvals.decide", {
    ...domainScope(state, canonical),
    location_policy: "retained_read",
  });
  if (approval.company_id !== state.config.company.seed_key) return [];
  const product = currentProduct(state, approval.product_code);

  const locations =
    scope === "all"
      ? sellingBranches(state.config)
      : branchSellsToCustomers(state.config, target)
        ? [target]
        : [];
  const groups = new Map<string, ApprovalLocationEffect>();
  for (const location of locations) {
    const offer = effectiveOffer(state, product, location);
    const mapping = offerMapping(state, approval.proposed_price);
    const effect: ApprovalLocationEffect = {
      locations: [location],
      old_price: regularPrice(state, product, location),
      new_price: approval.proposed_price,
      offer_label: offer?.label,
      offer_stops: Boolean(
        offer &&
        (!samePrice(offer.price, approval.proposed_price) ||
          !mapping ||
          mapping.offer !== offer.label),
      ),
      override_removed:
        scope === "all" && Boolean(product.branch_prices?.[location]),
    };
    const key = JSON.stringify({ ...effect, locations: undefined });
    const previous = groups.get(key);
    if (previous) previous.locations.push(location);
    else groups.set(key, effect);
  }
  return [...groups.values()];
}

/** Public maintenance entry points remain guarded price operations; internal bodies are private. */
export function reconcileOffers(
  state: DemoState,
  actor: AuthenticatedActor,
  productCode: string,
  companyId = state.config.company.seed_key,
): void {
  actor = freshActor(state, actor);
  const product = currentProduct(state, productCode);
  requireCapability(state, actor, "pricing.regular_manage", {
    ...domainScope(state, product, true),
    location_ids: sellingBranches(state.config),
  });
  if (companyId !== actor.company_id)
    throw new Error("Company changed. Refresh this product");
  reconcileOffersDraft(state, productCode, companyId);
}
export function syncPriceConflicts(
  state: DemoState,
  actor: AuthenticatedActor,
  productCode: string,
): void {
  actor = freshActor(state, actor);
  const product = currentProduct(state, productCode);
  requireCapability(state, actor, "pricing.regular_manage", {
    ...domainScope(state, product, true),
    location_ids: sellingBranches(state.config),
  });
  syncPriceConflictsDraft(state, productCode);
}

/** Recheck after every effective price change, including removal of branch overrides. */
function reconcileOffersDraft(
  state: DemoState,
  productCode: string,
  companyId = state.config.company.seed_key,
): void {
  if (companyId !== state.config.company.seed_key) return;
  const product = currentProduct(state, productCode);
  const ownOffers = state.offers.filter(
    (offer) =>
      offer.company_id === companyId &&
      offer.product_code === productCode &&
      !offer.clearance &&
      !offer.lot_id,
  );
  for (const offer of ownOffers) {
    // Keep historical warehouse offers as evidence, without treating a warehouse
    // receipt or company-price change as a retail offer action there.
    if (
      offer.scope === "branch" &&
      !branchSellsToCustomers(state.config, offer.branch)
    )
      continue;
    const price =
      offer.scope === "all"
        ? product.selling_price
        : regularPrice(state, product, offer.branch);
    const mapping = offerMapping(state, price);
    if (
      offer.status !== "stopped" &&
      (!samePrice(offer.price, price) ||
        !mapping ||
        mapping.offer !== offer.label)
    ) {
      offer.status = "stopped";
      offer.version = offerVersion(offer) + 1;
      offer.stopped_at = new Date().toISOString();
    }
  }
  const scopes: { scope: PriceScope; branch: Branch; price: string | null }[] =
    [
      ...(sellingBranches(state.config).length
        ? [
            {
              scope: "all" as const,
              branch: "all",
              price: product.selling_price || null,
            },
          ]
        : []),
      ...sellingBranches(state.config)
        .filter((branch) => Boolean(product.branch_prices?.[branch]))
        .map((branch) => ({
          scope: "branch" as const,
          branch,
          price: regularPrice(state, product, branch),
        })),
    ];
  for (const item of scopes) {
    if (state.config.promotions.ai_suggestions_enabled === false) continue;
    const mapping = offerMapping(state, item.price);
    if (!mapping || !item.price) continue;
    const existsInScope = state.offers.some(
      (offer) =>
        offer.company_id === companyId &&
        !offer.clearance &&
        !offer.lot_id &&
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
function syncPriceConflictsDraft(
  state: DemoState,
  productCode: string,
  companyId = state.config.company.seed_key,
): void {
  if (companyId !== state.config.company.seed_key) return;
  const product = currentProduct(state, productCode);
  const prices = Object.fromEntries(
    sellingBranches(state.config, true)
      .map((branch) => [branch, regularPrice(state, product, branch)])
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
  actor: AuthenticatedActor,
  productCode: string,
  price: string,
  scope: PriceScope,
  branch: Branch,
  action = "Apply price to all branches",
): void {
  actor = freshActor(state, actor);
  const product = currentProduct(state, productCode);
  requireCapability(state, actor, "pricing.regular_manage", {
    ...domainScope(state, product, true),
    location_ids: scope === "all" ? sellingBranches(state.config) : [branch],
  });
  const amount = priceAmount(price);
  const sellingLocations = sellingBranches(state.config);
  if (
    (scope === "all" && !sellingLocations.length) ||
    (scope === "branch" && !branchSellsToCustomers(state.config, branch))
  )
    throw new Error("Choose one branch that sells to customers");
  hydrateProductManualPriceMarkers(state, product);
  if (scope === "all") {
    product.selling_price = amount;
    product.branch_prices = Object.fromEntries(
      Object.entries(product.branch_prices ?? {}).filter(
        ([location]) => !sellingLocations.includes(location),
      ),
    );
    product.manual_prices = Object.fromEntries(
      Object.entries(product.manual_prices ?? {}).filter(
        ([location]) =>
          location !== "all" && !sellingLocations.includes(location),
      ),
    );
  } else {
    product.branch_prices = { ...product.branch_prices, [branch]: amount };
    clearManualPriceMarker(state, actor, product, branch);
  }
  product.status = "active";
  reconcileOffersDraft(state, productCode);
  syncPriceConflictsDraft(state, productCode);
  recordDemoActivity(
    state,
    actor,
    action,
    productCode,
    scope === "all" ? "all" : branch,
  );
}

export function manualRegularApprovalPreview(
  state: DemoState,
  actor: AuthenticatedActor,
  approval: Approval,
  decision: "rule" | "keep" = "rule",
) {
  actor = freshActor(state, actor);
  const canonical = state.approvals.find((item) => item.id === approval.id);
  if (!canonical || canonical !== approval)
    throw new Error("Approval changed. Refresh the preview");
  requireCapability(
    state,
    actor,
    "approvals.decide",
    domainScope(state, canonical),
  );
  const review = approval.manual_price_review;
  const product = state.products.find(
    (entry) =>
      entry.company_id === state.config.company.seed_key &&
      entry.company_id === approval.company_id &&
      entry.code === approval.product_code,
  );
  const origin = effectiveApprovalLocation(state, approval);
  const price = review
    ? decision === "keep"
      ? review.kept_price
      : review.calculated_price
    : approval.proposed_price;
  const cost =
    approval.source_manual_request && product
      ? productStoreCost(state, actorAtLocation(state, actor, origin), product)
      : approval.unit_cost;
  const parsedCost = (() => {
    try {
      const value = cost ? new Decimal(cost) : null;
      return value?.isFinite() && value.gte(0) ? value : null;
    } catch {
      return null;
    }
  })();
  const validCost = parsedCost !== null;
  const margin =
    validCost && new Decimal(price).gt(0)
      ? new Decimal(price).minus(parsedCost!).div(price).toFixed(8)
      : null;
  const threshold =
    approval.threshold ??
    (product
      ? state.config.pricing_categories.find(
          (entry) => entry.key === product.pricing_category,
        )?.minimum_margin
      : null) ??
    null;
  return {
    price,
    has_current_cost: validCost,
    regular_price: review?.kept_price ?? approval.current_price ?? null,
    calculated_price: review?.calculated_price ?? approval.proposed_price,
    margin,
    threshold,
    below_minimum_margin: Boolean(
      margin !== null &&
      threshold !== null &&
      threshold !== "" &&
      new Decimal(margin).lt(threshold),
    ),
    below_cost: Boolean(validCost && new Decimal(price).lt(parsedCost!)),
    can_keep: Boolean(
      review &&
      product &&
      regularPrice(state, product, origin) === review.kept_price &&
      manualPrice(state, product, origin),
    ),
  };
}
export function resolveApproval(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  decision: "approve" | "reject",
  scope: PriceScope,
  branch: Branch,
  reason?: string,
  expectedSnapshot?: string,
  regularDecision: "rule" | "keep" = "rule",
): void {
  actor = freshActor(state, actor);
  const approval = state.approvals.find(
    (item) =>
      item.id === id && item.company_id === state.config.company.seed_key,
  );
  if (!approval || approval.status !== "pending")
    throw new Error("Approval is no longer pending");
  const origin = effectiveApprovalLocation(state, approval);
  requireCapability(state, actor, "approvals.decide", {
    ...domainScope(state, { ...approval, branch: origin }, true),
    location_policy: "retained_correction",
  });
  const targetBranch =
    scope === "all" ? "all" : origin === "all" ? branch : origin;
  if (approval.type === "new_supplier")
    throw new Error("Review this supplier with supplier confirmation");
  const product = currentProduct(state, approval.product_code);
  if (
    decision === "approve" &&
    approval.type === "new_product" &&
    conflictingBarcodeProduct(
      state.products,
      approval.company_id,
      product.barcode,
      product.code,
    )
  )
    throw new Error(
      "This barcode already belongs to another product. Correct it before approving.",
    );
  if (
    expectedSnapshot !== undefined &&
    expectedSnapshot !== approvalSnapshot(state, actor, product.code)
  )
    throw new Error("Prices changed. Refresh the approval preview");
  const sourceRequest = approval.source_manual_request;
  if (
    sourceRequest &&
    decision === "approve" &&
    regularPrice(state, product, origin) !==
      sourceRequest.regular_price_snapshot
  )
    throw new Error("Prices changed. Refresh the approval preview");
  const regularReview = approval.manual_price_review;
  const regularPreview =
    decision === "approve"
      ? manualRegularApprovalPreview(state, actor, approval, regularDecision)
      : null;
  if (
    decision === "approve" &&
    sourceRequest &&
    !regularPreview?.has_current_cost
  )
    throw new Error("Prices changed. Refresh the approval preview");
  if (
    decision === "approve" &&
    sourceRequest &&
    (regularPreview?.below_minimum_margin || regularPreview?.below_cost) &&
    !reason?.trim()
  )
    throw new Error(
      "Add a reason for keeping or approving this price below the minimum margin",
    );
  if (decision === "approve" && sourceRequest) {
    approval.unit_cost =
      productStoreCost(state, actorAtLocation(state, actor, origin), product) ??
      undefined;
    approval.margin = regularPreview?.margin ?? null;
  }
  if (decision === "approve" && regularReview) {
    const currentCost = productStoreCost(
      state,
      actorAtLocation(state, actor, origin),
      product,
    );
    if (
      !regularPreview?.can_keep ||
      !currentCost ||
      !new Decimal(currentCost).eq(regularReview.received_cost) ||
      !new Decimal(approval.unit_cost ?? "-1").eq(regularReview.received_cost)
    )
      throw new Error("Prices changed. Refresh the approval preview");
    if (
      regularDecision === "keep" &&
      (scope !== "branch" || targetBranch !== origin)
    )
      throw new Error("Keep this regular price at its receiving location");
    if (
      (regularPreview?.below_minimum_margin || regularPreview?.below_cost) &&
      !reason?.trim()
    )
      throw new Error(
        "Add a reason for keeping or approving this price below the minimum margin",
      );
  }
  if (decision === "approve" && approval.type === "margin_review")
    throw new Error(
      "Keep the approved price with a reason or propose an override",
    );
  if (approval.type === "barcode_conflict") {
    approval.status = decision === "approve" ? "approved" : "rejected";
    approval.decided_by_user_id = actor.user_id;
    approval.decided_at = new Date().toISOString();
    approval.decision_attribution = decisionAttribution(state, actor);
    if (reason?.trim()) approval.acknowledgment_reason = reason.trim();
    recordDemoActivity(
      state,
      actor,
      decision === "approve"
        ? "Keep barcode mappings"
        : "Reject barcode change",
      product.code,
      origin,
    );
    return;
  }
  if (decision === "approve" && regularReview && regularDecision === "keep") {
    regularReview.decision = "keep";
    approval.proposed_price = regularReview.kept_price;
    approval.manual_override = true;
    approval.clear_manual_price = false;
    approval.margin = regularPreview?.margin ?? null;
    recordDemoActivity(
      state,
      actor,
      "Keep regular price",
      product.code,
      origin,
    );
  } else if (decision === "approve")
    applyApprovedPrice(
      state,
      actor,
      product.code,
      regularReview?.calculated_price ?? approval.proposed_price,
      scope,
      targetBranch,
      approval.type === "new_product" ? "Approve product" : "Approve price",
    );
  if (decision === "approve" && regularReview && regularDecision === "rule") {
    regularReview.decision = "rule";
    approval.proposed_price = regularReview.calculated_price;
    approval.clear_manual_price = true;
  }
  if (
    decision === "approve" &&
    approval.manual_override &&
    !(regularReview && regularDecision === "keep")
  ) {
    const retained =
      scope === "all" ? structuredClone(product.manual_prices ?? {}) : {};
    setManualPriceMarker(
      state,
      actor,
      product,
      targetBranch,
      approval.proposed_price,
      new Date(),
      approval.unit_cost,
    );
    if (scope === "all")
      product.manual_prices = { ...retained, ...product.manual_prices };
  }
  approval.status = decision === "approve" ? "approved" : "rejected";
  approval.decided_by_user_id = actor.user_id;
  approval.decided_at = new Date().toISOString();
  approval.decision_attribution = decisionAttribution(state, actor);
  approval.scope = scope;
  if (decision === "reject")
    recordDemoActivity(state, actor, "Reject proposal", product.code, origin);
  if (reason?.trim()) approval.acknowledgment_reason = reason.trim();
  const pending = state.approvals.find(
    (item) =>
      item.company_id === product.company_id &&
      item.product_code === product.code &&
      item.status === "pending" &&
      item.type !== "margin_review",
  );
  product.pending_price = pending?.proposed_price ?? null;
  product.pending_branch = pending
    ? effectiveApprovalLocation(state, pending)
    : undefined;
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
  actor: AuthenticatedActor,
  id: string,
  reason: string,
): void {
  actor = freshActor(state, actor);
  if (!reason.trim()) throw new Error("Add a reason for keeping this price");
  const review = state.approvals.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.id === id &&
      item.type === "margin_review" &&
      item.status === "pending",
  );
  if (!review) throw new Error("Margin review is no longer pending");
  requireCapability(
    state,
    actor,
    "approvals.decide",
    domainScope(state, review, true),
  );
  const origin = effectiveApprovalLocation(state, review);
  review.status = "approved";
  review.decided_by_user_id = actor.user_id;
  review.decided_at = new Date().toISOString();
  review.decision_attribution = decisionAttribution(state, actor);
  review.acknowledgment_reason = reason.trim();
  recordDemoActivity(
    state,
    actor,
    "Keep approved price",
    review.product_code,
    origin,
  );
}

export function proposeManualOverride(
  state: DemoState,
  actor: AuthenticatedActor,
  reviewId: string,
  price: string,
  reason: string,
): Approval {
  actor = freshActor(state, actor);
  const review = state.approvals.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.id === reviewId &&
      item.type === "margin_review" &&
      item.status === "pending",
  );
  if (!review) throw new Error("Margin review is no longer pending");
  requireCapability(
    state,
    actor,
    "approvals.decide",
    domainScope(state, review, true),
  );
  const origin = effectiveApprovalLocation(state, review);
  const product = currentProduct(state, review.product_code);
  const amount = priceAmount(price);
  if (!reason.trim()) throw new Error("Add a reason for the manual override");
  const approval: Approval = {
    ...review,
    branch: origin,
    id: `override:${review.company_id}:${state.approvals.length}`,
    type: "price_change",
    proposed_price: amount,
    current_price: regularPrice(state, product, origin),
    reason: reason.trim(),
    manual_override: true,
    status: "pending",
  };
  state.approvals.push(approval);
  product.pending_price = amount;
  product.pending_branch = origin;
  review.status = "approved";
  review.decided_by_user_id = actor.user_id;
  review.decided_at = new Date().toISOString();
  review.decision_attribution = decisionAttribution(state, actor);
  review.acknowledgment_reason = reason.trim();
  recordDemoActivity(
    state,
    actor,
    "Propose manual override",
    review.product_code,
    origin,
  );
  return approval;
}

export function markPriceConflictIntentional(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
): void {
  actor = freshActor(state, actor);
  const alert = state.alerts.find(
    (item) =>
      item.id === id &&
      item.company_id === state.config.company.seed_key &&
      item.type === "price_conflict" &&
      item.status === "pending",
  );
  if (!alert) throw new Error("Conflict is no longer pending");
  requireCapability(
    state,
    actor,
    "alerts.decide",
    domainScope(state, alert, true),
  );
  const product = currentProduct(state, alert.product_code);
  const prices = Object.fromEntries(
    sellingBranches(state.config, true)
      .map((branch) => [branch, regularPrice(state, product, branch)])
      .filter((entry): entry is [Branch, string] => Boolean(entry[1])),
  );
  if (
    Object.entries(alert.branch_prices ?? {}).some(
      ([branch, price]) => !samePrice(prices[branch], price),
    )
  ) {
    syncPriceConflictsDraft(state, alert.product_code);
    throw new Error("Prices changed. Review the new conflict");
  }
  alert.branch_prices = prices;
  alert.status = "intentional";
  recordDemoActivity(
    state,
    actor,
    "Mark as intentional",
    alert.product_code,
    "all",
  );
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

export function offerReadiness<P extends PriceProduct>(
  state: CatalogPriceReadState<P> & {
    config: Pick<CompanyConfig, "promotions">;
  },
  offer: Offer,
):
  | "ready"
  | "price_changed"
  | "mapping_missing"
  | "dates_invalid"
  | "company_mismatch"
  | "location_not_selling" {
  const product = state.products.find(
    (item) =>
      item.code === offer.product_code &&
      item.company_id === state.config.company.seed_key,
  );
  if (offer.company_id !== state.config.company.seed_key || !product)
    return "company_mismatch";
  if (
    (offer.scope === "all" && !sellingBranches(state.config).length) ||
    (offer.scope === "branch" &&
      !branchSellsToCustomers(state.config, offer.branch))
  )
    return "location_not_selling";
  const price =
    offer.scope === "all"
      ? product.selling_price
      : regularPrice(state, product, offer.branch);
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
  actor: AuthenticatedActor,
  candidate: Offer,
): "created" | "unchanged" {
  actor = freshActor(state, actor);
  const authorize = (offer: Offer) => {
    const locations =
      offer.scope === "all" ? sellingBranches(state.config) : [offer.branch];
    if (offer.branch === "all" && offer.scope !== "all")
      throw new Error("Choose one branch");
    requireCapability(state, actor, "offers.multibuy_manage", {
      company_id: offer.company_id,
      kind: "location_record",
      location_ids: locations,
      entity_id: offer.id,
      mutation: true,
      location_policy: "active_only",
    });
  };
  authorize(candidate);
  if (candidate.clearance || candidate.lot_id)
    throw new Error("Clearance offers use the separate receipt-lot workflow");
  const action =
    candidate.status === "suggested" ? "Confirm offer" : "Create offer";
  if (offerReadiness(state, candidate) !== "ready")
    throw new Error("Offer is not ready to activate");
  if (candidate.scope === "branch" && candidate.branch === "all")
    throw new Error("Choose one branch");
  const existing = state.offers.find(
    (offer) =>
      offer.id === candidate.id && offer.company_id === candidate.company_id,
  );
  if (existing) authorize(existing);
  // Repeating the same Create action must not manufacture another historical
  // version. Different terms still replace only this exact price scope.
  const duplicate = state.offers.find(
    (offer) =>
      !offer.clearance &&
      !offer.lot_id &&
      offer.status === "active" &&
      offer.company_id === candidate.company_id &&
      offer.product_code === candidate.product_code &&
      offer.scope === candidate.scope &&
      offer.branch === candidate.branch &&
      samePrice(offer.price, candidate.price) &&
      offer.label === candidate.label &&
      offer.pool === candidate.pool &&
      offer.currency === candidate.currency &&
      offer.mix_and_match === candidate.mix_and_match &&
      (offer.start_date || undefined) === (candidate.start_date || undefined) &&
      (offer.end_date || undefined) === (candidate.end_date || undefined),
  );
  const now = new Date().toISOString();
  const attribution = decisionAttribution(state, actor, new Date(now));
  if (duplicate) {
    // A redundant retained suggestion still needs its own confirmation to leave
    // the queue. Preserve the active version and the dismissed task as evidence.
    if (candidate.status === "suggested" && existing?.status === "suggested") {
      existing.status = "stopped";
      existing.version = offerVersion(existing) + 1;
      existing.stopped_at = now;
      existing.stopped_by_user_id = actor.user_id;
      recordDemoActivity(
        state,
        actor,
        action,
        candidate.product_code,
        candidate.branch,
      );
      return "created";
    }
    return "unchanged";
  }
  for (const offer of state.offers)
    if (
      (offer.id !== candidate.id || offer.status === "active") &&
      !offer.clearance &&
      !offer.lot_id &&
      offer.company_id === candidate.company_id &&
      offer.product_code === candidate.product_code &&
      offer.scope === candidate.scope &&
      offer.branch === candidate.branch &&
      offer.status !== "stopped"
    ) {
      offer.status = "stopped";
      offer.version = offerVersion(offer) + 1;
      offer.stopped_at = now;
      offer.stopped_by_user_id = actor.user_id;
    }
  if (existing?.status === "suggested")
    Object.assign(existing, candidate, {
      status: "active",
      version: offerVersion(existing) + 1,
      created_at: existing.created_at ?? now,
      stopped_at: undefined,
      decision_attribution: attribution,
      created_by_user_id: actor.user_id,
    });
  else
    state.offers.push({
      ...candidate,
      id: existing ? createId("offer") : candidate.id,
      version: 1,
      status: "active",
      created_at: now,
      stopped_at: undefined,
      decision_attribution: attribution,
      created_by_user_id: actor.user_id,
    });
  recordDemoActivity(
    state,
    actor,
    action,
    candidate.product_code,
    candidate.branch,
  );
  return "created";
}

export function stopOffer(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  dismissed = false,
  expectedVersion?: number,
): void {
  actor = freshActor(state, actor);
  const offer = state.offers.find(
    (item) =>
      item.id === id && item.company_id === state.config.company.seed_key,
  );
  if (!offer) throw new Error("Offer not found in this company");
  if (expectedVersion !== undefined && offerVersion(offer) !== expectedVersion)
    throw new Error("Offer changed before stopping it");
  if (offer.scope === "all" && actor.location_scope.kind === "assigned") {
    const suppression = stopCompanyOfferAtStore(
      state,
      actor,
      offer.id,
      expectedVersion ?? offerVersion(offer),
    );
    if (suppression)
      recordDemoActivity(
        state,
        actor,
        dismissed ? "Dismiss" : "Stop offer",
        offer.product_code,
        suppression.branch,
      );
    return;
  }
  requireCapability(state, actor, "offers.multibuy_manage", {
    company_id: offer.company_id,
    kind: "location_record",
    location_ids:
      offer.scope === "all" ? sellingBranches(state.config) : [offer.branch],
    entity_id: offer.id,
    mutation: true,
    location_policy: "active_only",
  });
  if (offer.status === "stopped") return;
  offer.status = "stopped";
  offer.version = offerVersion(offer) + 1;
  offer.stopped_at = new Date().toISOString();
  offer.stopped_by_user_id = actor.user_id;
  recordDemoActivity(
    state,
    actor,
    dismissed ? "Dismiss" : "Stop offer",
    offer.product_code,
    offer.branch,
  );
}

export function setAlertStatus(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  status: "pending" | "resolved",
  note?: string,
): void {
  actor = freshActor(state, actor);
  const alert = state.alerts.find(
    (item) =>
      item.id === id && item.company_id === state.config.company.seed_key,
  );
  if (!alert) return;
  requireCapability(
    state,
    actor,
    "alerts.decide",
    domainScope(state, alert, true),
  );
  alert.status = status;
  if (alert.type === "date_reminder") alert.date_suppressed = false;
  if (note?.trim()) alert.note = note.trim();
  recordDemoActivity(
    state,
    actor,
    status === "pending" ? "Keep as pending" : "Mark as taken care of",
    alert.product_code,
    alert.branch,
  );
}

export function effectivePool<P extends PriceProduct>(
  state: CatalogPriceReadState<P>,
  branch: Branch,
  pool: string,
  currency: string,
): P[] {
  if (!branchSellsToCustomers(state.config, branch)) return [];
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

export function proposeRegularPrice(
  state: DemoState,
  actor: AuthenticatedActor,
  productCode: string,
  branch: Branch,
  price: string,
  priceUnit: "each" | "lb" | "kg" = "each",
  now = new Date(),
): Approval {
  actor = freshActor(state, actor);
  const product = currentProduct(state, productCode);
  requireCapability(state, actor, "pricing.propose_manual", {
    ...domainScope(state, { ...product, branch }, true),
  });
  actor = actorAtLocation(state, actor, branch);
  if (!branchSellsToCustomers(state.config, branch))
    throw new Error("Choose one branch that sells to customers");
  const amount = priceAmount(price);
  if (new Decimal(amount).lte(0))
    throw new Error("Enter a price greater than zero");
  if (
    product.sold_by === "weight"
      ? !["lb", "kg"].includes(priceUnit)
      : priceUnit !== "each"
  )
    throw new Error("Choose the product price unit");
  // Stored canonical value is computed without round-tripping entered retail cents.
  const canonical =
    priceUnit === "kg"
      ? new Decimal(amount)
          .div(state.config.weighed_items?.conversion_factor ?? "2.20462")
          .toFixed(2, Decimal.ROUND_HALF_UP)
      : amount;
  const proposal: Approval = {
    id: createId("manual-price-request"),
    company_id: product.company_id,
    branch,
    product_code: product.code,
    type: "price_change",
    status: "pending",
    proposed_price: canonical,
    current_price: regularPrice(state, product, branch),
    manual_override: true,
    clear_manual_price: false,
    created_at: now.toISOString(),
    triggered_by: actor.actor,
    triggered_by_user_id: actor.user_id,
    ...actorAudit(state, actor, now),
    source_manual_request: {
      requester_user_id: actor.user_id,
      requester_name_snapshot: actor.actor,
      requester_role_snapshot: actor.role,
      requested_at: now.toISOString(),
      entered_price: amount,
      price_unit: priceUnit,
      regular_price_snapshot: regularPrice(state, product, branch),
    },
  };
  state.approvals.push(proposal);
  product.pending_price = canonical;
  product.pending_branch = branch;
  recordDemoActivity(
    state,
    actor,
    "Propose manual override",
    product.code,
    branch,
  );
  return proposal;
}
