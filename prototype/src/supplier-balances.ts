import Decimal from "decimal.js";
import { configSeed, demoSeed } from "./config";
import { supplierRecords, supplierMatches } from "./supplier-editor";
import { companyDate, dateAfter } from "./invoice";
import {
  ledgerCsv,
  ledgerSummary,
  OperationError,
  type LedgerSummary,
  type OperationsContext,
} from "./operations";
import type { Branch, DemoState } from "./types";
import {
  pendingReturnCredits,
  type PendingReturnCredit,
} from "./return-workflow";

export interface SupplierBalanceSummary extends LedgerSummary {
  confirmed_balance: string;
  pending_credit: string;
  pending_returns: PendingReturnCredit[];
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
  confirmed_balance: string;
  pending_credit: string;
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
 * A2 figures are derived only from posted invoice and allocated ledger rows.
 * The older snapshot adapter remains solely for a saved demo whose backup
 * could not be verified; it is never added to an A2 fixture ledger.
 */
export function supplierBalanceSummary(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
  throughDate?: string,
): SupplierBalanceSummary {
  guard(state, context);
  const identity = supplierRecords(state).find(
    (record) =>
      record.company_id === context.company_id &&
      supplierMatches(record, supplier),
  );
  if (identity?.previous_names?.length) {
    supplier = identity.name;
    state = {
      ...state,
      ledger: state.ledger.map((row) =>
        row.company_id === context.company_id &&
        supplierMatches(identity, row.supplier)
          ? { ...row, supplier }
          : row,
      ),
      invoices: state.invoices?.map((invoice) =>
        invoice.company_id === context.company_id &&
        supplierMatches(identity, invoice.supplier)
          ? { ...invoice, supplier }
          : invoice,
      ),
      invoice:
        state.invoice.company_id === context.company_id &&
        supplierMatches(identity, state.invoice.supplier)
          ? { ...state.invoice, supplier }
          : state.invoice,
    };
  }
  const summary = ledgerSummary(state, context, supplier, throughDate);
  const snapshotDate =
    state.supplier_balance_snapshot_date ?? companyDate(state.config);
  const asOf = throughDate ?? companyDate(state.config);
  const snapshotApplies =
    state.demo_fixture_schema !== 2 &&
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
  const pendingReturns = pendingReturnCredits(
    state,
    context,
    throughDate,
  ).filter((claim) =>
    identity
      ? supplierMatches(identity, claim.supplier)
      : claim.supplier === supplier,
  );
  const pendingCredit = pendingReturns.reduce(
    (sum, claim) => sum.plus(claim.amount),
    new Decimal(0),
  );
  const confirmedBalance = new Decimal(summary.balance).plus(snapshotBalance);
  return {
    ...summary,
    balance: confirmedBalance.minus(pendingCredit).toFixed(2),
    confirmed_balance: confirmedBalance.toFixed(2),
    pending_credit: pendingCredit.toFixed(2),
    pending_returns: pendingReturns,
    overdue: actualOverdue.plus(snapshotOverdue).toFixed(2),
    next_due_date:
      dueDates.filter((date) => date >= asOf).sort()[0] ?? dueDates.sort()[0],
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
  const registry = supplierRecords(state).filter(
    (record) => record.company_id === context.company_id,
  );
  registry.forEach((supplier) => suppliers.add(supplier.name));
  const addName = (name: string) =>
    suppliers.add(
      registry.find((record) => supplierMatches(record, name))?.name ?? name,
    );
  state.products
    .filter((product) => product.company_id === context.company_id)
    .forEach((product) => addName(product.main_supplier));
  state.ledger
    .filter((row) => row.company_id === context.company_id)
    .forEach((row) => addName(row.supplier));
  return [...suppliers].map((supplier) => {
    const {
      balance,
      confirmed_balance,
      pending_credit,
      overdue,
      next_due_date,
    } = supplierBalanceSummary(state, context, supplier);
    return {
      supplier,
      balance,
      confirmed_balance,
      pending_credit,
      overdue,
      next_due_date,
    };
  });
}

/** Export the dated demo figure separately from the unchanged ledger rows. */
export function supplierBalanceCsv(
  summary: SupplierBalanceSummary,
  supplier: string,
): string {
  let csv = ledgerCsv(
    { ...summary, balance: summary.confirmed_balance },
    supplier,
  );
  if (summary.pending_returns.length) {
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const pending = [
      ["Confirmed balance", summary.confirmed_balance],
      ["Pending credit", summary.pending_credit],
      ["Projected owed", summary.balance],
      ["Return", "Memo", "Location", "Pending credit"],
      ...summary.pending_returns.map((claim) => [
        claim.return_id,
        claim.reference,
        claim.branch,
        claim.amount,
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n");
    csv = `\uFEFF${pending}\r\n\r\n${csv.replace(/^\uFEFF/, "")}`;
  }
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
