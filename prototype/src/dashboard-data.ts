import Decimal from "decimal.js";
import { demoSeed } from "./config";
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
      invoice.company_id === context.company_id &&
      (context.branch === "all" || invoice.branch === context.branch) &&
      invoice.status === "posted",
  );
  if (
    state.invoice.status === "posted" &&
    state.invoice.company_id === context.company_id &&
    (context.branch === "all" || state.invoice.branch === context.branch) &&
    !posted.some((invoice) => invoice.id === state.invoice.id)
  )
    posted.push(state.invoice);
  for (const row of state.ledger as OperationalLedger[]) {
    if (
      row.company_id !== context.company_id ||
      (context.branch !== "all" && row.branch !== context.branch) ||
      row.currency !== state.config.company.currency ||
      row.date > today ||
      ["payment", "opening_balance"].includes(row.type)
    )
      continue;
    const invoice = posted.find(
      (item) =>
        item.id === row.invoice_id &&
        item.branch === row.branch &&
        item.supplier === row.supplier,
    );
    let amount: Decimal;
    if (invoice) amount = new Decimal(row.amount);
    else if (row.type === "credit") {
      amount = (row.allocations ?? []).reduce(
        (sum, allocation) =>
          posted.some(
            (item) =>
              item.id === allocation.invoice_id &&
              item.branch === row.branch &&
              item.supplier === row.supplier,
          )
            ? sum.minus(allocation.amount)
            : sum,
        new Decimal(0),
      );
    } else continue;
    if (row.date.startsWith(today.slice(0, 7)))
      suppliers.set(
        row.supplier,
        (suppliers.get(row.supplier) ?? new Decimal(0)).plus(amount),
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

export function dashboardLowStock(
  state: DemoState,
  context: OperationsContext,
) {
  scoped(state, context);
  const branches =
    context.branch === "all" ? demoSeed.branches : [context.branch];
  const reminders = state.notes.filter(
    (note) =>
      note.company_id === context.company_id &&
      note.type === "to_order" &&
      note.status === "open",
  );
  return branches.flatMap((branch) =>
    state.products
      .filter(
        (product) =>
          product.company_id === context.company_id &&
          product.status === "active",
      )
      .flatMap((product) => {
        const estimate = state.stock[`${branch}:${product.code}`];
        const reminder = reminders.find(
          (note) =>
            note.branch === branch && note.product_code === product.code,
        );
        return estimate !== undefined && (estimate <= 0 || reminder)
          ? [{ product, branch, estimate, reminder }]
          : [];
      }),
  );
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
