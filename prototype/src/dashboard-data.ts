import Decimal from "decimal.js";
import {
  receivedLog,
  effectiveInvoiceLocation,
  effectiveApprovalLocation,
  type DeliveryReceipt,
} from "./received";
import { supplierRecords, supplierMatches } from "./supplier-editor";
import { companyDate, dateAfter } from "./invoice";
import { type OperationalLedger } from "./operations";
import type { DemoState, Product } from "./types";
import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { requireCapability } from "./permissions";
import { selectedLocations, domainScope } from "./domain-authority";
import { activeTrackedDates, dateIsDueSoon } from "./date-tracking";
import {
  supplierBalanceOverview,
  supplierBalanceSummary,
} from "./supplier-balances";
import { projectNotesDatesRequests } from "./notes-dates-projections";
import { selectHistory } from "./history";
import { projectInvoiceState } from "./invoice-projections";
import { regularPrice } from "./catalog";
import { approvalBoard } from "./approval-board";
import { priceUpdateTasks } from "./price-updates";
import { previewPriceChange, saleStoreDate } from "./sales";
import { saleRequestViews } from "./sales-projections";

function scoped(state: DemoState, context: AuthenticatedActor) {
  requireCapability(state, context, "dashboard.company", domainScope(state));
  return freshActor(state, context);
}

export function dashboardPurchases(
  state: DemoState,
  context: AuthenticatedActor,
  today = companyDate(state.config),
) {
  context = scoped(state, context);
  const suppliers = new Map<string, Decimal>();
  const thisWeek = companyWeekStart(today);
  const weeks = Array.from({ length: 8 }, (_, index) => ({
    start: dateAfter(thisWeek, -49 + index * 7),
    end: dateAfter(thisWeek, -43 + index * 7),
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
  context: AuthenticatedActor,
  today = companyDate(state.config),
) {
  context = scoped(state, context);
  return receivedLog(state, context, {
    from: companyWeekStart(today),
    to: today,
  });
}

/** Count actual authorized delivery groups, not one delivery per product line. */
export function receivedDeliveryCount(
  rows: readonly DeliveryReceipt[],
): number {
  return new Set(
    rows.map((row) =>
      JSON.stringify([
        row.company_id,
        row.branch,
        row.kind,
        row.kind === "replacement" ? row.id : row.invoice_id || row.id,
        row.received_at || row.date,
      ]),
    ),
  ).size;
}

export function companyWeekStart(today: string) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  return dateAfter(today, -(weekday === 0 ? 6 : weekday - 1));
}

export function dashboardPriceChanges(
  state: DemoState,
  context: AuthenticatedActor,
  today = companyDate(state.config),
) {
  context = scoped(state, context);
  const start = companyWeekStart(today);
  const actions = new Set([
    "Approve price",
    "Apply price to all branches",
    "Apply Branch 1 price to all",
    "Apply Branch 2 price to all",
    "Change selling price",
    "Set regular price",
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

/** Exact company dashboard computations; canonical rows/snapshots never leave this query. */
export function dashboardSummary(
  state: DemoState,
  actor: AuthenticatedActor,
  now = new Date(),
) {
  actor = scoped(state, actor);
  const today = companyDate(state.config, now);
  const locations = new Set(selectedLocations(state, actor, true));
  const invoices = projectInvoiceState(state, actor);
  const visible = [...invoices.invoices];
  if (invoices.invoice && invoices.invoice.status !== "empty") {
    const index = visible.findIndex(
      (invoice) => invoice.id === invoices.invoice?.id,
    );
    if (index < 0) visible.push(invoices.invoice);
    else visible[index] = invoices.invoice;
  }
  const recentInvoices = visible
    .filter(
      (invoice) => invoice.status !== "empty" && locations.has(invoice.branch),
    )
    .sort((left, right) =>
      (
        right.posted_at ??
        right.received_at ??
        right.invoice_date ??
        ""
      ).localeCompare(
        left.posted_at ?? left.received_at ?? left.invoice_date ?? "",
      ),
    )
    .slice(0, 5)
    .map((invoice) => ({
      id: invoice.id,
      company_id: invoice.company_id,
      branch: invoice.branch,
      status: invoice.status,
      supplier: invoice.supplier,
      supplier_invoice_number: invoice.supplier_invoice_number,
      invoice_date: invoice.invoice_date,
      total: invoice.purchase_cost_allowed ? invoice.final_total : undefined,
      currency: invoice.import_currency || state.config.company.currency,
    }));
  const canonicalInvoices = [...(state.invoices ?? [])];
  const currentIndex = canonicalInvoices.findIndex(
    (invoice) => invoice.id === state.invoice.id,
  );
  if (currentIndex < 0) canonicalInvoices.push(state.invoice);
  else canonicalInvoices[currentIndex] = state.invoice;
  const shortCount = canonicalInvoices
    .filter(
      (invoice) =>
        invoice.company_id === actor.company_id &&
        invoice.status === "posted" &&
        locations.has(effectiveInvoiceLocation(state, invoice)),
    )
    .flatMap((invoice) =>
      invoice.lines.filter(
        (line) =>
          line.qty_invoiced -
            line.qty_received_at_posting -
            (line.qty_later_received ?? 0) >
          0,
      ),
    ).length;
  const expiryCount = activeTrackedDates(state, actor).filter((date) =>
    dateIsDueSoon(state, date, now),
  ).length;
  const notes = projectNotesDatesRequests(state, actor)
    .notes.filter(
      (note) =>
        !note.archived &&
        note.type === "note_to_supervisor" &&
        note.status !== "resolved",
    )
    .sort(
      (left, right) =>
        Number(right.status === "open") - Number(left.status === "open") ||
        right.created_at.localeCompare(left.created_at),
    )
    .map((note) => ({
      id: note.id,
      text: note.text,
      by: note.by,
      branch: note.branch,
      status: note.status,
      created_at: note.created_at,
    }));
  const activity = selectHistory(state, actor)
    .filter((entry) => entry.branch === "all" || locations.has(entry.branch))
    .sort((left, right) => right.at.localeCompare(left.at))
    .map((entry) => ({
      id: entry.id,
      action: entry.action,
      at: entry.at,
      by: entry.by,
      branch: entry.branch,
      product_code: entry.product_code,
    }));
  const balances = supplierBalanceOverview(state, actor)
    .sort((left, right) => new Decimal(right.balance).cmp(left.balance))
    .slice(0, 5)
    .map((row) => ({
      supplier: row.supplier,
      balance: row.balance,
      overdue: row.overdue,
      nextDueDate: row.next_due_date,
      supplierId: supplierRecords(state).find(
        (supplier) =>
          supplier.company_id === actor.company_id &&
          supplierMatches(supplier, row.supplier),
      )?.id,
      outstandingCount: supplierBalanceSummary(
        state,
        actor,
        row.supplier,
      ).invoices.filter((invoice) => new Decimal(invoice.amount).gt(0)).length,
    }));
  const purchases = dashboardPurchases(state, actor, today);
  const receivedArrivals = dashboardArrivals(state, actor, today);
  const deliveryCount = receivedDeliveryCount(receivedArrivals);
  const arrivals = receivedArrivals.map((row) => ({
    id: row.id,
    product_code: row.product_code,
    branch: row.branch,
    date: row.date,
    invoice_number: row.invoice_number,
    units: row.units,
  }));
  const weeklyChanges = dashboardPriceChanges(state, actor, today).map(
    (entry) => {
      const product = state.products.find(
        (product) =>
          product.company_id === actor.company_id &&
          product.code === entry.product_code,
      );
      return {
        id: entry.id,
        product_code: entry.product_code,
        at: entry.at,
        by: entry.by,
        branch: entry.branch,
        regular_price: product
          ? regularPrice(
              state,
              product,
              entry.branch === "all" ? actor.branch : entry.branch,
            )
          : null,
      };
    },
  );
  const approvalPrices = state.approvals
    .filter(
      (approval) =>
        approval.company_id === actor.company_id &&
        (approval.branch === "all" || locations.has(approval.branch)),
    )
    .map((approval) => {
      const product = state.products.find(
        (product) =>
          product.company_id === actor.company_id &&
          product.code === approval.product_code,
      );
      return {
        id: approval.id,
        regular_price: product
          ? regularPrice(
              state,
              product,
              effectiveApprovalLocation(state, approval),
            )
          : null,
      };
    });
  const pendingApprovals = approvalBoard(state, actor)
    .filter((row) => row.approval.status === "pending")
    .map((row) => ({
      id: row.approval.id,
      kind: row.approval.type,
      productCode: row.approval.product_code,
      category: row.category,
      supplier: row.supplierName,
      branch: row.approval.branch,
      oldPrice:
        row.approval.type === "new_product"
          ? null
          : (approvalPrices.find((price) => price.id === row.approval.id)
              ?.regular_price ?? null),
      price: row.approval.proposed_price,
      margin: row.margin,
      belowMinimum: !!(
        row.margin !== null &&
        row.approval.threshold &&
        new Decimal(row.margin).lt(row.approval.threshold)
      ),
      requiresReview:
        !!row.approval.manual_override ||
        !["new_product", "price_change"].includes(row.approval.type),
      sourceDate: row.approval.created_at,
    }));
  const pendingSales = saleRequestViews(state, actor)
    .filter((request) => request.status === "pending")
    .map((request) => {
      const localToday = saleStoreDate(state.config, request.branch, now);
      const preview = previewPriceChange(
        state,
        actor,
        {
          product_code: request.product_code,
          mode: "sale",
          scope: "current",
          price: request.requested_price,
          price_unit: request.price_unit,
          branches: [request.branch],
          starts_on:
            request.starts_on < localToday ? localToday : request.starts_on,
          last_day: request.last_day,
          accept_below_margin: false,
          below_cost_reason: "",
          add_labels: request.add_promo_labels ?? false,
          why: request.why,
          existing_sale_id: request.existing_sale_id,
          expected_revision: request.expected_sale_revision,
        },
        now,
      );
      const effect = preview.effects[0];
      const product = state.products.find(
        (item) =>
          item.company_id === actor.company_id &&
          item.code === request.product_code,
      );
      return {
        id: request.id,
        kind: "sale_request" as const,
        productCode: request.product_code,
        category: product?.pricing_category,
        supplier: product?.main_supplier,
        branch: request.branch,
        oldPrice: effect?.regular_display_price ?? null,
        price: effect?.proposed_price ?? request.requested_price,
        margin: effect?.margin ?? null,
        belowMinimum: effect?.below_minimum_margin ?? false,
        requiresReview: true,
        sourceDate: request.starts_on,
      };
    });
  const priceUpdates = priceUpdateTasks(state, actor)
    .filter((task) => task.status === "pending")
    .map((task) => ({
      id: task.id,
      productCode: task.product_code,
      branch: task.branch,
      price: task.new_price.price,
      oldPrice: task.old_price.price,
      unit: task.new_price.unit,
      effectiveAt: task.effective_at,
    }));
  return {
    approvalRows: [...pendingSales, ...pendingApprovals],
    priceUpdates,
    purchaseMonthTotal: purchases.suppliers
      .reduce((total, row) => total.plus(row.amount), new Decimal(0))
      .toFixed(2),
    today,
    recentInvoices,
    shortCount,
    expiryCount,
    notes,
    activity,
    balances,
    purchases,
    arrivals,
    deliveryCount,
    weeklyChanges,
    approvalPrices,
  };
}
export type DashboardSummary = ReturnType<typeof dashboardSummary>;
