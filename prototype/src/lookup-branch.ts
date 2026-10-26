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

/** A company default alone is not evidence that a store approved this product. */
function approvedHere(state: DemoState, product: Product, location: string) {
  if (!branchSellsToCustomers(state.config, location)) return false;
  if (activeSaleAt(state, product, location)) return true;
  if (product.branch_prices?.[location]) return true;
  const price = product.selling_price;
  if (!price) return false;
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
