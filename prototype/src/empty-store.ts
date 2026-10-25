import type { AuthenticatedActor } from "./authority-types";
import { actorAudit, guardDomain } from "./domain-authority";
import { configuredBranches } from "./settings";
import { createId } from "./ids";
import type { DemoState } from "./types";

/** Explicit destructive demo action; never invoked by startup or a migration. */
export function removeFictionalData(
  state: DemoState,
  actor: AuthenticatedActor,
  now = new Date(),
): void {
  actor = guardDomain(state, actor, "settings.manage", undefined, true);
  const company = state.config.company.seed_key;
  const retained = <T extends { company_id: string }>(rows?: T[]): T[] =>
    (rows ?? []).filter((row) => row.company_id !== company);

  state.products = retained(state.products);
  state.suppliers = retained(state.suppliers);
  state.supplier_items = retained(state.supplier_items);
  state.invoices = retained(state.invoices);
  state.approvals = retained(state.approvals);
  state.alerts = retained(state.alerts);
  state.offers = retained(state.offers);
  state.offer_store_suppressions = retained(state.offer_store_suppressions);
  state.sales = retained(state.sales);
  state.sale_requests = retained(state.sale_requests);
  state.sale_events = retained(state.sale_events);
  state.sale_delivery_holds = retained(state.sale_delivery_holds);
  state.returns = retained(state.returns);
  state.orders = retained(state.orders);
  state.branch_requests = retained(state.branch_requests);
  state.request_transfer_events = retained(state.request_transfer_events);
  state.ledger = retained(state.ledger);
  state.notes = retained(state.notes);
  state.notebook_entries = retained(state.notebook_entries);
  state.expiry = retained(state.expiry);
  state.receipt_lots = retained(state.receipt_lots);
  state.stock_movements = retained(state.stock_movements);
  state.invoice_content_corrections = retained(
    state.invoice_content_corrections,
  );
  state.invoice_received_corrections = retained(
    state.invoice_received_corrections,
  );
  state.invoice_location_corrections = retained(
    state.invoice_location_corrections,
  );
  state.price_update_tasks = retained(state.price_update_tasks);
  state.price_task_prints = retained(state.price_task_prints);
  state.notifications = retained(state.notifications);
  state.label_waitlist = retained(state.label_waitlist);
  state.sale_label_effects = [];
  state.price_update_baseline = {};
  state.stock = {};
  // Retired demo balance snapshots must never reappear beside imported invoices.
  state.demo_fixture_schema = 2;
  delete state.supplier_balance_snapshot_date;
  delete state.supplier_balance_snapshot_currency;
  if (state.invoice.company_id === company) {
    state.invoice = {
      id: createId("empty-invoice"),
      company_id: company,
      branch: configuredBranches(state.config)[0] ?? "all",
      status: "empty",
      supplier: "",
      supplier_invoice_number: "",
      invoice_date_relative_days: 0,
      payment_terms: "",
      subtotal: "0.00",
      tax: "0.00",
      final_total: "0.00",
      payable_after_open_shorts: "0.00",
      short_lines: [],
      lines: [],
      _confidence_note: "",
    };
  }
  state.activity = retained(state.activity);
  state.activity.push({
    id: createId("empty-store"),
    company_id: company,
    branch: "all",
    scope: "all",
    action: "Removed fictional data",
    by: actor.actor,
    at: now.toISOString(),
    ...actorAudit(state, actor, now),
    entity_type: "settings",
    entity_id: "data",
    reversible: false,
  });
}
