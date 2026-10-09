import Decimal from "decimal.js";
import { configSeed, demoSeed, supplierDetails } from "./config";
import { companyDate, dateAfter } from "./invoice";
import {
  ledgerCsv,
  ledgerSummary,
  OperationError,
  type LedgerSummary,
  type OperationsContext,
} from "./operations";
import type { Branch, DemoState } from "./types";

export interface SupplierBalanceSummary extends LedgerSummary {
  overdue: string;
  next_due_date?: string;
  /** A separately displayed seed snapshot; never a fabricated ledger record. */
  snapshot_balance: string;
  snapshot_overdue: string;
  snapshot_date?: string;
}

export interface SupplierBalanceRow {
  supplier: string;
  balance: string;
  overdue: string;
  next_due_date?: string;
}

interface SeedBalance {
  balance: string;
  overdue: string;
  next_due_relative_days: number;
}

const seedBalances = demoSeed.supplier_balances_demo as unknown as Record<
  string,
  Record<string, SeedBalance> | string
>;

function guard(state: DemoState, context: OperationsContext) {
  if (context.role !== "supervisor") throw new OperationError("supervisor");
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
}

/**
 * The owner's seed supplies aggregate figures, not historical invoices. Keep
 * those figures separate from the real ledger and anchor relative dates once
 * when a demo is created or an older saved demo is opened.
 */
export function supplierBalanceSummary(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
  throughDate?: string,
): SupplierBalanceSummary {
  guard(state, context);
  const summary = ledgerSummary(state, context, supplier, throughDate);
  const snapshotDate =
    state.supplier_balance_snapshot_date ?? companyDate(state.config);
  const asOf = throughDate ?? companyDate(state.config);
  const snapshotApplies =
    context.company_id === configSeed.company.seed_key &&
    (state.supplier_balance_snapshot_currency ??
      configSeed.company.currency) === state.config.company.currency &&
    snapshotDate <= asOf;
  let snapshotBalance = new Decimal(0);
  let snapshotOverdue = new Decimal(0);
  const dueDates: string[] = [];
  let hasSnapshot = false;

  if (snapshotApplies) {
    for (const [branch, balances] of Object.entries(seedBalances)) {
      if (
        typeof balances === "string" ||
        (context.branch !== "all" && branch !== context.branch)
      )
        continue;
      const balance = balances[supplier];
      if (!balance) continue;

      // Fresh Valley's supplied figure already includes the original demo
      // invoice after its short deduction. Once that document is really posted,
      // use its actual ledger amount (including any later corrections) instead.
      const demoInvoicePosted =
        supplier === demoSeed.demo_invoice.supplier &&
        branch === demoSeed.demo_invoice.branch &&
        summary.rows.some(
          (row) =>
            row.branch === branch &&
            row.type === "invoice" &&
            (row.reference === demoSeed.demo_invoice.supplier_invoice_number ||
              row.invoice_id === "demo-fv-20417"),
        );
      if (demoInvoicePosted) continue;
      hasSnapshot = true;
      snapshotBalance = snapshotBalance.plus(balance.balance);
      const branchSummary =
        context.branch === "all"
          ? ledgerSummary(
              state,
              { ...context, branch: branch as Branch },
              supplier,
              throughDate,
            )
          : summary;
      // An unallocated payment can clear a supplied balance only in its own
      // branch. Its original allocation remains untouched in the real ledger.
      const branchCredit = Decimal.max(0, branchSummary.unapplied_credit);
      snapshotOverdue = snapshotOverdue.plus(
        Decimal.max(0, new Decimal(balance.overdue).minus(branchCredit)),
      );
      if (new Decimal(balance.balance).minus(branchCredit).gt(0))
        dueDates.push(dateAfter(snapshotDate, balance.next_due_relative_days));
    }
  }

  let actualOverdue = new Decimal(0);
  for (const invoice of summary.invoices) {
    if (!invoice.due_date || !new Decimal(invoice.amount).gt(0)) continue;
    dueDates.push(invoice.due_date);
    if (invoice.due_date < asOf)
      actualOverdue = actualOverdue.plus(invoice.amount);
  }
  return {
    ...summary,
    balance: new Decimal(summary.balance).plus(snapshotBalance).toFixed(2),
    overdue: actualOverdue.plus(snapshotOverdue).toFixed(2),
    next_due_date: dueDates.sort()[0],
    snapshot_balance: snapshotBalance.toFixed(2),
    snapshot_overdue: snapshotOverdue.toFixed(2),
    snapshot_date: hasSnapshot ? snapshotDate : undefined,
  };
}

/** Include zero-balance and proposed suppliers, not only suppliers in a ledger. */
export function supplierBalanceOverview(
  state: DemoState,
  context: OperationsContext,
): SupplierBalanceRow[] {
  guard(state, context);
  const suppliers = new Set<string>();
  if (context.company_id === configSeed.company.seed_key)
    supplierDetails.forEach((supplier) => suppliers.add(supplier.name));
  state.products
    .filter((product) => product.company_id === context.company_id)
    .forEach((product) => suppliers.add(product.main_supplier));
  state.ledger
    .filter((row) => row.company_id === context.company_id)
    .forEach((row) => suppliers.add(row.supplier));
  return [...suppliers].map((supplier) => {
    const { balance, overdue, next_due_date } = supplierBalanceSummary(
      state,
      context,
      supplier,
    );
    return { supplier, balance, overdue, next_due_date };
  });
}

/** Export the dated demo figure separately from the unchanged ledger rows. */
export function supplierBalanceCsv(
  summary: SupplierBalanceSummary,
  supplier: string,
): string {
  const csv = ledgerCsv(summary, supplier);
  if (summary.snapshot_balance === "0.00") return csv;
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const snapshot = [
    "Demo balance",
    supplier,
    summary.snapshot_date ?? "",
    summary.snapshot_balance,
  ];
  return `\uFEFF${snapshot.map(cell).join(",")}\r\n\r\n${csv.replace(/^\uFEFF/, "")}`;
}
