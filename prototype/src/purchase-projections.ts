import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { can } from "./permissions";
import { canInvoiceAuthority } from "./invoice-authority";
import { purchaseLocationAllowed } from "./purchase-authority";
import { receiptLots, type ReceiptLot } from "./receipt-lots";
import { supplierRecords } from "./supplier-editor";
import type { SupplierItemDefinition } from "./supplier-items";
import type { Order, OrderLine, OrderReceiptEvent } from "./orders";
import type { OperationalLedger } from "./operations";
import type { DemoState, SupplierRecord } from "./types";

/** Lookup needs only actual scoped lot identity to validate a clearance offer. */
export type ClearanceLotReadDTO = Pick<
  ReceiptLot,
  "id" | "company_id" | "product_code" | "branch"
>;

export type ReceiptLotSourceReadDTO = Omit<
  ReceiptLot["source_receipts"][number],
  "unit_cost" | "invoice_id" | "line_index"
> & {
  unit_cost?: string;
  invoice_id?: string;
  line_index?: number;
};
export type ReceiptLotReadDTO = Omit<
  ReceiptLot,
  "unit_cost" | "source_receipts"
> & {
  unit_cost?: string;
  source_receipts: ReceiptLotSourceReadDTO[];
};
export type SupplierItemReadDTO = Omit<
  SupplierItemDefinition,
  | "quoted_unit_cost_before_tax"
  | "quoted_by"
  | "quoted_by_user_id"
  | "quoted_at"
> & {
  quoted_unit_cost_before_tax?: string;
  quoted_by?: string;
  quoted_by_user_id?: string;
  quoted_at?: string;
};
export type OrderLineReadDTO = Omit<
  OrderLine,
  | "expected_unit_cost"
  | "expected_case_cost"
  | "expected_line_total"
  | "expected_cost_source"
> & {
  expected_unit_cost?: string | null;
  expected_case_cost?: string | null;
  expected_line_total?: string | null;
  expected_cost_source?: OrderLine["expected_cost_source"];
};
export type OrderReadDTO = Omit<
  Order,
  "lines" | "receipts" | "expected_total_before_tax"
> & {
  expected_total_before_tax?: string | null;
  lines: OrderLineReadDTO[];
  receipts: OrderReceiptReadDTO[];
};
export type OrderReceiptReadDTO = Omit<OrderReceiptEvent, "invoice_id"> & {
  invoice_id?: string;
};

function select<T extends object, K extends keyof T>(
  record: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys)
    if (Object.hasOwn(record, key)) result[key] = structuredClone(record[key]);
  return result;
}
export type StockMovementReadDTO = NonNullable<
  DemoState["stock_movements"]
>[number];
export interface PurchaseOperationalReadDTO {
  clearance_lots: ClearanceLotReadDTO[];
  receipt_lots: ReceiptLotReadDTO[];
  stock_movements: StockMovementReadDTO[];
  stock: DemoState["stock"];
  supplier_items: SupplierItemReadDTO[];
  orders: OrderReadDTO[];
}

/** Runtime whitelists are built from a privately bound fresh canonical snapshot. */
export function projectPurchaseOperational(
  state: DemoState,
  actor: AuthenticatedActor,
): PurchaseOperationalReadDTO {
  actor = freshActor(state, actor);
  const shared = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  const rows: PurchaseOperationalReadDTO = {
    clearance_lots: [],
    receipt_lots: [],
    stock_movements: [],
    stock: {},
    supplier_items: [],
    orders: [],
  };
  if (can(state, actor, "lots.read", shared).allowed) {
    const permittedLots = receiptLots(state).filter((lot) =>
      purchaseLocationAllowed(
        state,
        actor,
        "lots.read",
        lot.company_id,
        lot.branch,
      ),
    );
    rows.clearance_lots = permittedLots.map(
      ({ id, company_id, product_code, branch }) => ({
        id,
        company_id,
        product_code,
        branch,
      }),
    );
    if (can(state, actor, "received.read", shared).allowed) {
      rows.receipt_lots = permittedLots.map((lot) => {
        const costAllowed = can(state, actor, "lots.cost_read", {
          company_id: lot.company_id,
          kind: "location_record",
          location_ids: [lot.branch],
          entity_id: lot.id,
          location_policy: "retained_read",
        }).allowed;
        return {
          id: lot.id,
          company_id: lot.company_id,
          branch: lot.branch,
          product_code: lot.product_code,
          supplier_id: lot.supplier_id,
          supplier: lot.supplier,
          date_type: lot.date_type,
          expiry_date: lot.expiry_date,
          received_quantity: lot.received_quantity,
          quantity_unit: lot.quantity_unit,
          ...(costAllowed ? { unit_cost: lot.unit_cost } : {}),
          source_receipts: lot.source_receipts.map((receipt) => ({
            quantity: receipt.quantity,
            received_at: receipt.received_at,
            short_dated: receipt.short_dated,
            ...(canInvoiceAuthority(
              state,
              actor,
              "invoices.read",
              receipt.invoice_id,
            )
              ? {
                  invoice_id: receipt.invoice_id,
                  line_index: receipt.line_index,
                }
              : {}),
            ...(costAllowed ? { unit_cost: receipt.unit_cost } : {}),
          })),
        };
      });
    }
  }
  if (can(state, actor, "received.read", shared).allowed) {
    rows.stock_movements = (state.stock_movements ?? [])
      .filter((movement) =>
        purchaseLocationAllowed(
          state,
          actor,
          "received.read",
          movement.company_id,
          movement.branch,
        ),
      )
      .map((movement) => ({
        id: movement.id,
        company_id: movement.company_id,
        branch: movement.branch,
        product_code: movement.product_code,
        qty: movement.qty,
        type: movement.type,
        reference: movement.reference,
        by: movement.by,
        at: movement.at,
        ...(movement.invoice_id &&
        canInvoiceAuthority(state, actor, "invoices.read", movement.invoice_id)
          ? { invoice_id: movement.invoice_id, line_index: movement.line_index }
          : {}),
      }));
    const locations = state.config.branches
      .map(
        (location, index) =>
          location.id ?? location.name_en ?? `Branch ${index + 1}`,
      )
      .sort((first, second) => second.length - first.length);
    for (const [key, quantity] of Object.entries(state.stock)) {
      const location = locations.find((candidate) =>
        key.startsWith(`${candidate}:`),
      );
      if (
        location &&
        purchaseLocationAllowed(
          state,
          actor,
          "received.read",
          state.config.company.seed_key,
          location,
        )
      )
        rows.stock[key] = quantity;
    }
  }
  if (can(state, actor, "supplier_items.read", shared).allowed) {
    const costs = can(state, actor, "supplier_items.cost_read", shared).allowed;
    rows.supplier_items = (state.supplier_items ?? [])
      .filter((item) => item.company_id === actor.company_id)
      .map((item) => ({
        id: item.id,
        company_id: item.company_id,
        supplier_id: item.supplier_id,
        supplier_name: item.supplier_name,
        product_code: item.product_code,
        supplier_item_code: item.supplier_item_code,
        units_per_case: item.units_per_case,
        case_weight: item.case_weight,
        case_weight_unit: item.case_weight_unit,
        weight_conversion_factor: item.weight_conversion_factor,
        source_keys: item.source_keys
          ? item.source_keys.map((source) =>
              select(source, ["product_code", "supplier_item_code"]),
            )
          : undefined,
        archived: item.archived,
        created_at: item.created_at,
        created_by: item.created_by,
        created_by_user_id: item.created_by_user_id,
        updated_at: item.updated_at,
        updated_by: item.updated_by,
        updated_by_user_id: item.updated_by_user_id,
        ...(costs
          ? {
              quoted_unit_cost_before_tax: item.quoted_unit_cost_before_tax,
              quoted_by: item.quoted_by,
              quoted_by_user_id: item.quoted_by_user_id,
              quoted_at: item.quoted_at,
            }
          : {}),
      }));
  }
  if (can(state, actor, "orders.read", shared).allowed) {
    rows.orders = (state.orders ?? [])
      .filter((order) =>
        purchaseLocationAllowed(
          state,
          actor,
          "orders.read",
          order.company_id,
          order.branch,
        ),
      )
      .map((order) => {
        const costs = can(state, actor, "orders.cost_read", {
          company_id: order.company_id,
          kind: "location_record",
          location_ids: [order.branch],
          entity_id: order.id,
          location_policy: "retained_read",
        }).allowed;
        return {
          ...select(order, [
            "id",
            "company_id",
            "branch",
            "supplier",
            "supplier_id",
            "reference",
            "date",
            "currency",
            "status",
            "created_at",
            "created_by",
            "created_by_user_id",
            "ordered_at",
            "ordered_by",
            "cancelled_at",
            "cancelled_by",
            "cancellation_reason",
            "estimate_incomplete",
            "source_note_ids",
            "version",
          ]),
          linked_invoice_ids: order.linked_invoice_ids.filter((id) =>
            canInvoiceAuthority(state, actor, "invoices.read", id),
          ),
          ...(costs
            ? { expected_total_before_tax: order.expected_total_before_tax }
            : {}),
          lines: order.lines.map((line) => ({
            ...select(line, [
              "id",
              "company_id",
              "supplier_item_id",
              "product_code",
              "supplier_item_code",
              "name_en",
              "name_fa",
              "unit_size",
              "units_per_case",
              "ordered_cases",
              "ordered_units",
              "new_item",
              "quantity_unit",
              "case_weight",
              "case_weight_unit",
              "weight_conversion_factor",
              "received_units",
              "cancelled_units",
              "outstanding_decision",
              "source_note_ids",
            ]),
            ...(costs
              ? select(line, [
                  "expected_unit_cost",
                  "expected_case_cost",
                  "expected_line_total",
                  "expected_cost_source",
                ])
              : {}),
            ...(line.new_item_association &&
            canInvoiceAuthority(
              state,
              actor,
              "invoices.read",
              line.new_item_association.invoice_id,
            )
              ? {
                  new_item_association: select(line.new_item_association, [
                    "invoice_id",
                    "invoice_line_index",
                    "product_code",
                    "supplier_item_id",
                    "supplier_item_code",
                    "units_per_case",
                    "ordered_quantity",
                    "quantity_unit",
                    "case_weight",
                    "case_weight_unit",
                    "weight_conversion_factor",
                    "fingerprint",
                  ]),
                }
              : {}),
          })),
          receipts: order.receipts.map((receipt) => ({
            ...select(receipt, [
              "event_key",
              "kind",
              "receiving_branch",
              "at",
              "by",
            ]),
            ...(canInvoiceAuthority(
              state,
              actor,
              "invoices.read",
              receipt.invoice_id,
            )
              ? { invoice_id: receipt.invoice_id }
              : {}),
            lines: receipt.lines.map((line) =>
              select(line, [
                "order_line_id",
                "invoice_line_index",
                "accepted_units",
                "credited_units",
                "extra_units",
              ]),
            ),
            residual: receipt.residual.map((line) =>
              select(line, ["order_line_id", "decision"]),
            ),
          })),
        };
      });
  }
  return rows;
}

export function projectSuppliers(
  state: DemoState,
  actor: AuthenticatedActor,
): SupplierRecord[] {
  actor = freshActor(state, actor);
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  if (!can(state, actor, "suppliers.read", scope).allowed) return [];
  return supplierRecords(state)
    .filter((supplier) => supplier.company_id === actor.company_id)
    .map((supplier) => ({
      id: supplier.id,
      company_id: supplier.company_id,
      name: supplier.name,
      previous_names: supplier.previous_names
        ? [...supplier.previous_names]
        : undefined,
      phone: supplier.phone,
      email: supplier.email,
      website: supplier.website,
      sales_rep_name: supplier.sales_rep_name,
      sales_rep_phone: supplier.sales_rep_phone,
      payment_terms: supplier.payment_terms,
      status: supplier.status,
      active: supplier.active,
      address: supplier.address,
      notes: supplier.notes,
      created_at: supplier.created_at,
      created_by: supplier.created_by,
      created_by_user_id: supplier.created_by_user_id,
      updated_by_user_id: supplier.updated_by_user_id,
      confirmed_by_user_id: supplier.confirmed_by_user_id,
      invoice_review_required: supplier.invoice_review_required,
    }));
}
export function projectLedger(
  state: DemoState,
  actor: AuthenticatedActor,
): DemoState["ledger"] {
  actor = freshActor(state, actor);
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  if (!can(state, actor, "supplier_balances.read", scope).allowed) return [];
  return state.ledger
    .filter((row) =>
      purchaseLocationAllowed(
        state,
        actor,
        "supplier_balances.read",
        row.company_id,
        row.branch,
      ),
    )
    .map((entry) => {
      const row = entry as OperationalLedger;
      return {
        ...select(row, [
          "id",
          "company_id",
          "branch",
          "branch_id",
          "supplier",
          "type",
          "amount",
          "date",
          "reference",
          "invoice_id",
          "invoice_line_index",
          "cheque_number",
          "currency",
          "note",
          "payment_date",
          "posted_by",
          "disputed",
          "dispute_note",
          "due_date",
        ]),
        ...(row.allocations
          ? {
              allocations: row.allocations.map((allocation) =>
                select(allocation, ["invoice_id", "amount"]),
              ),
            }
          : {}),
        ...(row.dispute_history
          ? {
              dispute_history: row.dispute_history.map((event) =>
                select(event, [
                  "id",
                  "kind",
                  "at",
                  "by",
                  "actor_user_id",
                  "actor_role_snapshot",
                  "actor_username",
                  "device_id",
                  "note",
                  "representative",
                  "received_date",
                  "product_code",
                  "actual_qty",
                  "invoice_id",
                  "corrects_event_id",
                ]),
              ),
            }
          : {}),
      };
    });
}
