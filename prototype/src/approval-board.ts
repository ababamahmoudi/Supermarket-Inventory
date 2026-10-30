import { branchIsActive } from "./settings";
import { businessAuditRead } from "./business-audit-read";
import { productStoreCost } from "./product-costs";
import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import { actorAtLocation, freshActor } from "./authority";
import { can, requireCapability } from "./permissions";
import { domainScope } from "./domain-authority";
import { approvalViews } from "./sales-projections";
import {
  approvalLocationEffects,
  manualRegularApprovalPreview,
  type PriceScope,
} from "./approvals";
import { effectiveApprovalLocation } from "./received";
import { regularPrice } from "./catalog";
import type { DemoState, Branch } from "./types";
import { calculatePrice } from "./pricing";
import { calculateWeighedPrice } from "./weighed";

export function approvalCategoryPreview(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  category: string,
): string {
  actor = freshActor(state, actor);
  const approval = state.approvals.find(
    (item) => item.id === id && item.company_id === actor.company_id,
  );
  if (!approval) throw new Error("Approval changed. Refresh the preview");
  requireCapability(
    state,
    actor,
    "approvals.decide",
    domainScope(state, approval),
  );
  const product = state.products.find(
    (item) =>
      item.company_id === actor.company_id &&
      item.code === approval.product_code,
  );
  if (!product) throw new Error("Product changed. Refresh the price preview");
  const cost = approval.source_manual_request
    ? productStoreCost(
        state,
        actorAtLocation(
          state,
          actor,
          effectiveApprovalLocation(state, approval),
        ),
        product,
      )
    : (approval.unit_cost ?? product.last_cost_before_tax);
  if (!cost) throw new Error("A current unit cost is required");
  return (
    product.sold_by === "weight"
      ? calculateWeighedPrice(cost, "lb", category, state.config)
      : calculatePrice(cost, category, state.config)
  ).selling_price;
}

export function approvalBoard(state: DemoState, actor: AuthenticatedActor) {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "approvals.read", domainScope(state));
  const financial = can(
    state,
    actor,
    "approvals.decide",
    domainScope(state),
  ).allowed;
  return approvalViews(state, actor).map((approval) => {
    const actual = state.approvals.find(
      (item) => item.id === approval.id && item.company_id === actor.company_id,
    )!;
    const branch = effectiveApprovalLocation(state, actual);
    const product = state.products.find(
      (item) =>
        item.company_id === actor.company_id &&
        item.code === actual.product_code,
    );
    const cost = financial
      ? (actual.source_manual_request && product
          ? branchIsActive(state.config, branch)
            ? productStoreCost(
                state,
                actorAtLocation(state, actor, branch),
                product,
              )
            : (actual.unit_cost ?? null)
          : (actual.unit_cost ?? product?.last_cost_before_tax)) || null
      : null;
    const margin = financial
      ? (actual.margin ??
        (cost &&
        actual.proposed_price &&
        new Decimal(actual.proposed_price).gt(0)
          ? new Decimal(actual.proposed_price)
              .minus(cost)
              .div(actual.proposed_price)
              .toFixed(4)
          : null))
      : null;
    const invoices = [state.invoice, ...(state.invoices ?? [])].filter(
      (item) => item.company_id === actor.company_id,
    );
    const invoice =
      invoices.find((item) => item.id === actual.source_invoice_id) ??
      invoices.find((item) => actual.invoice_ids?.includes(item.id));
    return {
      approval: { ...approval, branch },
      unitCost: cost,
      margin,
      minimumMargin: financial
        ? (actual.threshold ??
          state.config.pricing_categories.find(
            (category) =>
              category.key ===
              (actual.pricing_category ?? product?.pricing_category),
          )?.minimum_margin ??
          null)
        : null,
      triggeredBy:
        actual.triggered_by ??
        (financial
          ? actual.manual_override
            ? [...state.activity]
                .reverse()
                .find(
                  (entry) =>
                    entry.company_id === actor.company_id &&
                    entry.product_code === actual.product_code &&
                    entry.branch === actual.branch &&
                    entry.action === "Propose manual override",
                )?.by
            : invoice?.receiving_employee
          : undefined),
      invoiceNumber: invoice?.supplier_invoice_number ?? actual.invoice_number,
      invoiceId: actual.source_invoice_id ?? invoice?.id,
      supplierName: invoice?.supplier ?? actual.supplier_name,
      category: actual.pricing_category ?? product?.pricing_category,
    };
  });
}
export function approvalPanelRead(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  scope: PriceScope,
  target: Branch,
  regularDecision: "rule" | "keep",
  showEffects: boolean,
) {
  actor = freshActor(state, actor);
  const approval = state.approvals.find(
    (item) => item.id === id && item.company_id === actor.company_id,
  );
  if (!approval) throw new Error("Approval changed. Refresh the preview");
  const origin = effectiveApprovalLocation(state, approval);
  requireCapability(
    state,
    actor,
    "approvals.decide",
    domainScope(state, { ...approval, branch: origin }),
  );
  const product = state.products.find(
    (item) =>
      item.company_id === actor.company_id &&
      item.code === approval.product_code,
  );
  if (!product) throw new Error("Product changed. Refresh the price preview");
  const cost =
    (approval.source_manual_request
      ? branchIsActive(state.config, origin)
        ? productStoreCost(
            state,
            actorAtLocation(state, actor, origin),
            product,
          )
        : (approval.unit_cost ?? null)
      : (approval.unit_cost ?? product.last_cost_before_tax)) || null;
  const manualReview =
    showEffects &&
    (approval.manual_price_review ||
      approval.source_manual_request ||
      approval.receiving_price)
      ? manualRegularApprovalPreview(state, actor, approval, regularDecision)
      : null;
  const proposedPrice = manualReview?.price ?? approval.proposed_price;
  const margin =
    cost && new Decimal(proposedPrice).gt(0)
      ? new Decimal(proposedPrice)
          .minus(cost)
          .div(proposedPrice)
          .times(100)
          .toFixed(2)
      : null;
  return businessAuditRead({
    approval,
    origin,
    oldPrice: regularPrice(state, product, origin === "all" ? target : origin),
    cost,
    manualReview,
    proposedPrice,
    margin,
    effects: showEffects
      ? approvalLocationEffects(state, actor, approval, scope, target)
      : [],
  });
}
