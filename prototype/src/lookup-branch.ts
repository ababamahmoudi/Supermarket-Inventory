import Decimal from "decimal.js";
import { actorAtLocation, freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { effectivePrice } from "./catalog";
import { allowedLocationIds, can, requireCapability } from "./permissions";
import { lookupLastReceipt } from "./receipt-lots";
import { activeSaleAt } from "./sales";
import { branchSellsToCustomers } from "./settings";
import { effectiveApprovalLocation } from "./received";
import type { DemoState, Product } from "./types";

export interface LookupBranchProduct {
  code: string;
  present: boolean;
  at_other_locations: boolean;
  price: string | null;
  other_prices: { location: string; price: string }[];
}

function equalPrice(left: string | undefined, right: string) {
  try {
    return !!left && new Decimal(left).eq(right);
  } catch {
    return false;
  }
}

function currencyAtReview(
  state: DemoState,
  company: string,
  reviewedAt: string,
) {
  let currency = state.config.company.currency;
  for (const change of state.activity
    .filter(
      (row) =>
        row.company_id === company &&
        row.entity_type === "settings" &&
        row.entity_id === "company" &&
        row.at >= reviewedAt,
    )
    .sort((a, b) => b.at.localeCompare(a.at))) {
    const before = change.before as { currency?: string } | null;
    const after = change.after as { currency?: string } | null;
    if (
      typeof before?.currency === "string" &&
      typeof after?.currency === "string" &&
      before.currency !== after.currency
    ) {
      // Equal wall-clock timestamps do not prove which command ran first.
      if (change.at === reviewedAt) return null;
      currency = before.currency;
    }
  }
  return currency;
}

/** Ending an accepted sale restores the exact regular basis reviewed in that store.
 * The snapshot is canonical (per lb for weight), never the kg display price. */
function reviewedSaleBasis(
  state: DemoState,
  product: Product,
  location: string,
  price: string,
) {
  const approvedRole = (role: string | undefined) =>
    role === "owner" || role === "manager";
  return (state.sales ?? []).some((sale) => {
    if (
      sale.company_id !== product.company_id ||
      sale.product_code !== product.code ||
      sale.branch !== location ||
      sale.branch_id !== location ||
      !["active", "ended"].includes(sale.status) ||
      !sale.created_by_user_id ||
      !approvedRole(sale.created_by_role_snapshot) ||
      !equalPrice(sale.regular_price_snapshot, price) ||
      !Number.isFinite(Date.parse(sale.created_at)) ||
      (sale.decision_attribution &&
        sale.decision_attribution.company_id !== product.company_id)
    )
      return false;
    const reviews = (state.sale_events ?? [])
      .filter(
        (event) =>
          event.company_id === product.company_id &&
          event.sale_id === sale.id &&
          event.product_code === product.code &&
          event.branch === location &&
          ["scheduled", "started", "changed"].includes(event.kind) &&
          equalPrice(event.after.regular_price_snapshot, price) &&
          event.source_decision?.company_id === product.company_id &&
          approvedRole(event.source_decision.role_snapshot),
      )
      .map((event) => event.source_decision!.at)
      .filter((at) => Number.isFinite(Date.parse(at)));
    const reviewedAt = [sale.created_at, ...reviews].sort().at(-1)!;
    return (
      currencyAtReview(state, product.company_id, reviewedAt) ===
      state.config.company.currency
    );
  });
}

/** A company default alone is not evidence that a store approved this product. */
function approvedHere(state: DemoState, product: Product, location: string) {
  if (!branchSellsToCustomers(state.config, location)) return false;
  if (activeSaleAt(state, product, location)) return true;
  if (product.branch_prices?.[location]) return true;
  const price = product.selling_price;
  if (!price) return false;
  if (reviewedSaleBasis(state, product, location, price)) return true;
  if (equalPrice(product.manual_prices?.all?.price, price)) return true;
  const source =
    product.price_provenance?.[location] ?? product.price_provenance?.all;
  if (source?.changed_at && equalPrice(source.changed_price, price))
    return true;
  if (
    state.approvals.some(
      (row) =>
        row.company_id === product.company_id &&
        row.product_code === product.code &&
        row.status === "approved" &&
        ["new_product", "price_change"].includes(row.type) &&
        (row.scope === "all" ||
          row.branch === "all" ||
          effectiveApprovalLocation(state, row) === location) &&
        equalPrice(row.proposed_price, price),
    )
  )
    return true;
  // Apply-to-all can also originate in an explicit price-conflict resolution.
  // Reverted decisions cannot establish approval at another store.
  const reversed = new Set(
    state.activity
      .filter((row) => row.company_id === product.company_id)
      .map((row) => row.reversed_activity_id)
      .filter(Boolean),
  );
  return state.activity.some((row) => {
    const added =
      row.after && typeof row.after === "object"
        ? (row.after as Partial<Product>)
        : null;
    return (
      row.company_id === product.company_id &&
      row.product_code === product.code &&
      row.branch === "all" &&
      !reversed.has(row.id) &&
      ([
        "Apply price to all branches",
        "Approve price",
        "Approve product",
        "Set regular price",
      ].includes(row.action) ||
        (row.action === "Add product" &&
          added?.company_id === product.company_id &&
          added.code === product.code &&
          added.status === "active" &&
          equalPrice(added.selling_price, price)))
    );
  });
}

/** Public branch membership and selling prices; never return receipt or approval identities. */
export function lookupBranchCatalog(
  state: DemoState,
  actor: AuthenticatedActor,
): LookupBranchProduct[] {
  const current = freshActor(state, actor);
  requireCapability(state, current, "lookup.read");
  const locations = allowedLocationIds(state, current);
  if (current.branch === "all" || !locations.includes(current.branch))
    throw new Error("Choose one permitted location");
  return state.products
    .filter(
      (product) =>
        product.company_id === current.company_id &&
        product.status !== "archived",
    )
    .map((product) => {
      const prices = locations.flatMap((location) => {
        if (!approvedHere(state, product, location)) return [];
        const price = effectivePrice(state, product, location);
        return price ? [{ location, price }] : [];
      });
      const own =
        prices.find((row) => row.location === current.branch)?.price ?? null;
      const presentAt = (location: string) => {
        if (
          prices.some((row) => row.location === location) ||
          product.last_received_relative_days?.[location] !== undefined ||
          (state.stock[`${location}:${product.code}`] ?? 0) > 0
        )
          return true;
        const scoped = actorAtLocation(state, current, location);
        const scope = {
          company_id: current.company_id,
          kind: "location_record" as const,
          location_ids: [location],
        };
        return (
          can(state, scoped, "lookup.receipt_hint", scope).allowed &&
          !!lookupLastReceipt(state, scoped, product.code)
        );
      };
      return {
        code: product.code,
        present: presentAt(current.branch),
        at_other_locations: locations.some(
          (location) => location !== current.branch && presentAt(location),
        ),
        price: own,
        other_prices: own
          ? []
          : prices.filter((row) => row.location !== current.branch),
      };
    });
}
