import Decimal from "decimal.js";
import { businessFingerprint } from "./business-fingerprint";
import { effectiveInvoiceVersion } from "./invoice-version";
import { effectiveInvoiceLocation } from "./received";
import { createId } from "./ids";
import { actorAudit } from "./domain-authority";
import { requireSystemReconciliation } from "./authority-repository";
import { calculatePackageCost } from "./package-pricing";
import type { SystemAttribution } from "./authority-types";
import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { allowedLocationIds, can, requireCapability } from "./permissions";
import type { DemoState, Product } from "./types";

export interface ProductCostEntry {
  id: string;
  invoice_id: string;
  invoice_number: string;
  supplier: string;
  branch: string;
  date: string;
  /** Effective cost-source time: a retained later delivery can follow the original posting. */
  posted_at: string;
  receipt_id?: string;
  received_at?: string;
  unit_cost_before_tax: string;
  short_dated: boolean;
  sold_by: "each" | "weight";
}

/** Catalog cost authority is independent of operational invoice-cost grants. */
export function productCostHistory(
  state: DemoState,
  context: AuthenticatedActor,
  product: Product,
): ProductCostEntry[] {
  if (
    !can(state, context, "catalog.cost_read", {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    }).allowed
  )
    return [];
  context = freshActor(state, context);
  const visibleLocations = new Set(
    allowedLocationIds(state, context, { includeInactive: true }),
  );
  return costHistoryForLocations(
    state,
    product,
    visibleLocations,
    context.branch,
  );
}

function costHistoryForLocations(
  state: DemoState,
  product: Product,
  visibleLocations: Set<string>,
  selectedBranch: string,
): ProductCostEntry[] {
  const invoices = new Map(
    [...(state.invoices ?? []), state.invoice]
      .filter(
        (invoice) =>
          invoice.status === "posted" &&
          invoice.company_id === product.company_id,
      )
      .map((invoice) => [invoice.id, invoice]),
  );
  return [...invoices.values()]
    .flatMap((original) => {
      const invoice = effectiveInvoiceVersion(state, original);
      const branch = effectiveInvoiceLocation(state, original);
      if (
        !visibleLocations.has(branch) ||
        (selectedBranch !== "all" && selectedBranch !== branch)
      )
        return [];
      return invoice.lines.flatMap((line, index): ProductCostEntry[] => {
        if (
          line.company_id !== product.company_id ||
          line.product_code !== product.code ||
          Math.max(
            0,
            line.qty_received_at_posting - (line.refused_units ?? 0),
          ) +
            (line.qty_later_received ?? 0) <=
            0
        )
          return [];
        const later = line.short_dated
          ? undefined
          : (state.stock_movements ?? [])
              .filter(
                (movement) =>
                  movement.company_id === product.company_id &&
                  movement.invoice_id === original.id &&
                  movement.line_index === index &&
                  movement.product_code === product.code &&
                  movement.type === "short_resolved_received" &&
                  new Decimal(movement.qty).gt(0) &&
                  (original.short_receipt_keys ?? []).some(
                    (key) =>
                      movement.id === `${original.id}:delivery:${key}:stock`,
                  ) &&
                  Number.isFinite(Date.parse(movement.at)),
              )
              .sort(
                (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
              )[0];
        return [
          {
            id: `${invoice.id}:cost:${index}`,
            invoice_id: invoice.id,
            invoice_number: invoice.supplier_invoice_number,
            supplier: invoice.supplier,
            branch,
            date:
              original.invoice_date ?? original.posted_at?.slice(0, 10) ?? "",
            receipt_id: later?.id,
            received_at: later?.at,
            posted_at:
              later?.at ??
              original.posted_at ??
              original.received_at ??
              original.invoice_date ??
              "",
            unit_cost_before_tax: new Decimal(
              line.unit_cost_before_tax,
            ).toFixed(4),
            short_dated: line.short_dated === true,
            sold_by: line.sold_by ?? "each",
          },
        ];
      });
    })
    .sort(
      (left, right) =>
        right.posted_at.localeCompare(left.posted_at) ||
        right.id.localeCompare(left.id),
    );
}

export function productStoreCost(
  state: DemoState,
  context: AuthenticatedActor,
  product: Product,
): string | null {
  if (
    !can(state, context, "catalog.cost_read", {
      company_id: product.company_id,
      kind: "company_shared",
      entity_id: product.code,
    }).allowed
  )
    return null;
  context = freshActor(state, context);
  return canonicalCostAtLocation(
    state,
    product,
    context.branch,
    new Set(allowedLocationIds(state, context, { includeInactive: true })),
  );
}

/** Fingerprint the effective evidence, including an append-only correction or later delivery. */
function costSourceFingerprint(
  entry: ProductCostEntry | undefined,
): string | null {
  return entry
    ? businessFingerprint({
        id: entry.id,
        receipt_id: entry.receipt_id ?? null,
        posted_at: entry.posted_at,
        received_at: entry.received_at ?? null,
        unit_cost_before_tax: new Decimal(entry.unit_cost_before_tax).toFixed(
          4,
        ),
        sold_by: entry.sold_by,
      })
    : null;
}

function canonicalCostAtLocation(
  state: DemoState,
  product: Product,
  branch: string,
  visibleLocations?: Set<string>,
): string {
  const locations =
    visibleLocations ??
    new Set(
      state.config.branches.map(
        (location, index) =>
          location.id ?? location.name_en ?? `Branch ${index + 1}`,
      ),
    );
  const latest = costHistoryForLocations(
    state,
    product,
    locations,
    branch,
  ).find((entry) => !entry.short_dated);
  if (product.package_of_product_id && product.package_branch_costs?.[branch])
    return product.package_branch_costs[branch];
  const marker = product.manual_costs?.[branch] ?? product.manual_costs?.all;
  if (
    marker?.company_id === product.company_id &&
    (marker.branch === branch || marker.branch === "all") &&
    marker.receipt_basis[branch] === costSourceFingerprint(latest) &&
    /^\d+(?:\.\d{1,4})?$/.test(marker.unit_cost_before_tax)
  )
    return marker.unit_cost_before_tax;
  return latest?.unit_cost_before_tax ?? product.last_cost_before_tax;
}

/** Save a real manual cost decision while retaining the exact known receipt basis. */
export function recordManualProductCost(
  state: DemoState,
  actor: AuthenticatedActor,
  product: Product,
  cost: string,
  now = new Date(),
): void {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "catalog.edit", {
    company_id: product.company_id,
    kind: "company_shared",
    mutation: true,
  });
  requireCapability(state, actor, "catalog.cost_read", {
    company_id: product.company_id,
    kind: "company_shared",
  });
  if (
    product.company_id !== actor.company_id ||
    state.products.find(
      (item) =>
        item.company_id === actor.company_id && item.code === product.code,
    ) !== product ||
    product.package_of_product_id ||
    !/^\d+(?:\.\d{1,4})?$/.test(cost)
  )
    throw new Error("cost");
  const locations = new Set(
    state.config.branches.map(
      (location, index) =>
        location.id ?? location.name_en ?? `Branch ${index + 1}`,
    ),
  );
  const receipt_basis = Object.fromEntries(
    ["all", ...locations].map((branch) => [
      branch,
      costSourceFingerprint(
        costHistoryForLocations(state, product, locations, branch).find(
          (entry) => !entry.short_dated,
        ),
      ),
    ]),
  );
  const before = {
    unit_cost_before_tax: productStoreCost(state, actor, product),
    manual_costs: structuredClone(product.manual_costs),
  };
  product.manual_costs ??= {};
  product.manual_costs[actor.branch] = {
    company_id: actor.company_id,
    branch: actor.branch,
    unit_cost_before_tax: new Decimal(cost).toFixed(4),
    receipt_basis,
    at: now.toISOString(),
    by_user_id: actor.user_id,
    by: actor.actor,
  };
  product.last_cost_before_tax = new Decimal(cost).toFixed(4);
  state.activity.push({
    id: createId("manual-product-cost"),
    company_id: actor.company_id,
    branch: actor.branch,
    product_code: product.code,
    entity_type: "product",
    entity_id: product.code,
    action: "Edit weight product cost",
    by: actor.actor,
    ...actorAudit(state, actor, now),
    at: now.toISOString(),
    reversible: false,
    before,
    after: {
      unit_cost_before_tax: product.last_cost_before_tax,
      manual_costs: structuredClone(product.manual_costs),
    },
  });
}

/** Trusted derived write only: computes costs from real canonical sources and returns no financial DTO. */
export function reconcilePackageBranchCosts(
  state: DemoState,
  actor: AuthenticatedActor | null,
  productCode: string,
  now: Date,
  system?: {
    attribution: SystemAttribution;
    source: "price_updates" | "sales_clock";
  },
): void {
  if (actor) actor = freshActor(state, actor);
  else if (system)
    requireSystemReconciliation(state, system.attribution, system.source);
  else throw new Error("permission");
  const child = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.code === productCode &&
      item.package_of_product_id &&
      item.status !== "archived",
  );
  const parent =
    child &&
    state.products.find(
      (item) =>
        item.company_id === child.company_id &&
        item.code === child.package_of_product_id &&
        item.sold_by === "weight" &&
        !item.package_of_product_id &&
        item.status !== "archived",
    );
  if (!child || !parent || !child.package_size || !child.package_size_unit)
    throw new Error("parent");
  child.package_branch_costs ??= {};
  for (const branch of [
    "all",
    ...state.config.branches.map(
      (location, index) =>
        location.id ?? location.name_en ?? `Branch ${index + 1}`,
    ),
  ]) {
    const cost = calculatePackageCost(
      child.package_size,
      child.package_size_unit,
      canonicalCostAtLocation(state, parent, branch),
      state.config,
    );
    const prior = child.package_branch_costs[branch];
    child.package_branch_costs[branch] = cost;
    if (branch === "all") child.last_cost_before_tax = cost;
    if (prior === cost) continue;
    state.activity.push({
      id: createId("package-branch-cost"),
      company_id: child.company_id,
      branch,
      product_code: child.code,
      entity_type: "product",
      entity_id: child.code,
      action: "Package cost recalculated",
      by: actor?.actor ?? "System",
      ...(actor ? actorAudit(state, actor, now) : {}),
      at: now.toISOString(),
      reversible: false,
      before: { unit_cost_before_tax: prior ?? null },
      after: {
        unit_cost_before_tax: cost,
        package_cost_basis: {
          parent_product_code: parent.code,
          size_lb: child.package_size_lb,
          parent_cost_per_lb: canonicalCostAtLocation(state, parent, branch),
        },
      },
    });
  }
}
