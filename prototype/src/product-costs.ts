import Decimal from "decimal.js";
import { effectiveInvoiceLocation } from "./received";
import type { OperationsContext } from "./operations";
import type { DemoState, Product } from "./types";

export interface ProductCostEntry {
  id: string;
  invoice_id: string;
  invoice_number: string;
  supplier: string;
  branch: string;
  date: string;
  posted_at: string;
  unit_cost_before_tax: string;
  short_dated: boolean;
}

/** Catalog costs are Supervisor-only, including calls outside the presentation. */
export function productCostHistory(
  state: DemoState,
  context: OperationsContext,
  product: Product,
): ProductCostEntry[] {
  if (
    context.role !== "supervisor" ||
    context.company_id !== state.config.company.seed_key ||
    product.company_id !== context.company_id
  )
    return [];
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
    .flatMap((invoice) => {
      const branch = effectiveInvoiceLocation(state, invoice);
      if (context.branch !== "all" && branch !== context.branch) return [];
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
        return [
          {
            id: `${invoice.id}:cost:${index}`,
            invoice_id: invoice.id,
            invoice_number: invoice.supplier_invoice_number,
            supplier: invoice.supplier,
            branch,
            date: invoice.invoice_date ?? invoice.posted_at?.slice(0, 10) ?? "",
            posted_at:
              invoice.posted_at ??
              invoice.received_at ??
              invoice.invoice_date ??
              "",
            unit_cost_before_tax: new Decimal(
              line.unit_cost_before_tax,
            ).toFixed(4),
            short_dated: line.short_dated === true,
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
  context: OperationsContext,
  product: Product,
): string | null {
  if (
    context.role !== "supervisor" ||
    context.company_id !== state.config.company.seed_key ||
    product.company_id !== context.company_id
  )
    return null;
  return (
    productCostHistory(state, context, product).find(
      (entry) => !entry.short_dated,
    )?.unit_cost_before_tax ?? product.last_cost_before_tax
  );
}
