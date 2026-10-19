import Decimal from "decimal.js";
import { effectiveInvoiceVersion } from "./invoice-version";
import { effectiveInvoiceLocation } from "./received";
import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { allowedLocationIds, can } from "./permissions";
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
  const invoices = new Map(
    [...(state.invoices ?? []), state.invoice]
      .filter(
        (invoice) =>
          invoice.status === "posted" &&
          invoice.company_id === context.company_id,
      )
      .map((invoice) => [invoice.id, invoice]),
  );
  return [...invoices.values()]
    .flatMap((original) => {
      const invoice = effectiveInvoiceVersion(state, original);
      const branch = effectiveInvoiceLocation(state, original);
      if (
        !visibleLocations.has(branch) ||
        (context.branch !== "all" && branch !== context.branch)
      )
        return [];
      return invoice.lines.flatMap((line, index): ProductCostEntry[] => {
        if (
          line.company_id !== context.company_id ||
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
                  movement.company_id === context.company_id &&
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
  return (
    productCostHistory(state, context, product).find(
      (entry) => !entry.short_dated,
    )?.unit_cost_before_tax ?? product.last_cost_before_tax
  );
}
