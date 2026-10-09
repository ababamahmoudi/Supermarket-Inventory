import Decimal from "decimal.js";
import { receivedLog, effectiveInvoiceLocation } from "./received";
import { supplierRecords, supplierMatches } from "./supplier-editor";
import { companyDate, dateAfter } from "./invoice";
import {
  OperationError,
  type OperationalLedger,
  type OperationsContext,
} from "./operations";
import type { DemoState, Product } from "./types";

function scoped(state: DemoState, context: OperationsContext) {
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
  if (context.role !== "supervisor") throw new OperationError("supervisor");
}

export function dashboardPurchases(
  state: DemoState,
  context: OperationsContext,
  today = companyDate(state.config),
) {
  scoped(state, context);
  const suppliers = new Map<string, Decimal>();
  const weeks = Array.from({ length: 8 }, (_, index) => ({
    start: dateAfter(today, -55 + index * 7),
    end: dateAfter(today, -49 + index * 7),
    amount: new Decimal(0),
  }));
  const posted = (state.invoices ?? []).filter(
    (invoice) =>
      invoice.company_id === context.company_id && invoice.status === "posted",
  );
  if (
    state.invoice.status === "posted" &&
    state.invoice.company_id === context.company_id &&
    !posted.some((invoice) => invoice.id === state.invoice.id)
  )
    posted.push(state.invoice);
  const locationCorrections = new Set(
    (state.invoice_location_corrections ?? []).flatMap((correction) => [
      correction.ledger_out_id,
      correction.ledger_in_id,
    ]),
  );
  const identities = supplierRecords(state).filter(
    (supplier) => supplier.company_id === context.company_id,
  );
  const sameSupplier = (left: string, right: string) =>
    left === right ||
    identities.some(
      (identity) =>
        supplierMatches(identity, left) && supplierMatches(identity, right),
    );
  const inLocation = (invoice: typeof state.invoice) =>
    context.branch === "all" ||
    effectiveInvoiceLocation(state, invoice) === context.branch;
  for (const row of state.ledger as OperationalLedger[]) {
    if (
      row.company_id !== context.company_id ||
      row.currency !== state.config.company.currency ||
      row.date > today ||
      ["payment", "opening_balance"].includes(row.type) ||
      locationCorrections.has(row.id)
    )
      continue;
    const invoice = posted.find(
      (item) =>
        item.id === row.invoice_id &&
        inLocation(item) &&
        sameSupplier(item.supplier, row.supplier),
    );
    let amount: Decimal;
    if (invoice) amount = new Decimal(row.amount);
    else if (row.type === "credit") {
      amount = (row.allocations ?? []).reduce(
        (sum, allocation) =>
          posted.some(
            (item) =>
              item.id === allocation.invoice_id &&
              inLocation(item) &&
              sameSupplier(item.supplier, row.supplier),
          )
            ? sum.minus(allocation.amount)
            : sum,
        new Decimal(0),
      );
    } else continue;
    const supplierName =
      identities.find((identity) => supplierMatches(identity, row.supplier))
        ?.name ?? row.supplier;
    if (row.date.startsWith(today.slice(0, 7)))
      suppliers.set(
        supplierName,
        (suppliers.get(supplierName) ?? new Decimal(0)).plus(amount),
      );
    const week = weeks.find(
      (item) => row.date >= item.start && row.date <= item.end,
    );
    if (week) week.amount = week.amount.plus(amount);
  }
  return {
    suppliers: [...suppliers.entries()]
      .map(([supplier, amount]) => ({ supplier, amount: amount.toFixed(2) }))
      .sort((left, right) => new Decimal(right.amount).cmp(left.amount)),
    weeks: weeks.map((item) => ({ ...item, amount: item.amount.toFixed(2) })),
  };
}

export function dashboardArrivals(
  state: DemoState,
  context: OperationsContext,
  today = companyDate(state.config),
) {
  scoped(state, context);
  return receivedLog(state, context, {
    from: companyWeekStart(today),
    to: today,
  });
}

export function companyWeekStart(today: string) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return dateAfter(today, -(weekday === 0 ? 6 : weekday - 1));
}

export function dashboardPriceChanges(
  state: DemoState,
  context: OperationsContext,
  today = companyDate(state.config),
) {
  scoped(state, context);
  const start = companyWeekStart(today);
  const actions = new Set([
    "Approve price",
    "Apply price to all branches",
    "Apply Branch 1 price to all",
    "Apply Branch 2 price to all",
    "Change selling price",
  ]);
  const isPriceChange = (item: DemoState["activity"][number]) => {
    if (actions.has(item.action)) return true;
    if (item.action !== "Save product") return false;
    const before = (item.before as { product?: Product } | undefined)?.product;
    const after = (item.after as { product?: Product } | undefined)?.product;
    if (!before || !after) return false;
    if (before.selling_price !== after.selling_price) return true;
    const branches = new Set([
      ...Object.keys(before.branch_prices ?? {}),
      ...Object.keys(after.branch_prices ?? {}),
    ]);
    return [...branches].some(
      (branch) =>
        (before.branch_prices?.[branch] ?? before.selling_price) !==
        (after.branch_prices?.[branch] ?? after.selling_price),
    );
  };
  return state.activity
    .filter(
      (item) =>
        item.company_id === context.company_id &&
        (context.branch === "all" ||
          item.branch === "all" ||
          item.branch === context.branch) &&
        item.product_code &&
        isPriceChange(item) &&
        companyDate(state.config, new Date(item.at)) >= start &&
        companyDate(state.config, new Date(item.at)) <= today,
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter(
      (item, index, all) =>
        all.findIndex(
          (other) =>
            other.product_code === item.product_code &&
            other.branch === item.branch,
        ) === index,
    );
}
