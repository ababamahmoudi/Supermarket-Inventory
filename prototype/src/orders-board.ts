import { actorAtLocation, cloneWithAuthority, freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { can, requireCapability } from "./permissions";
import { canInvoiceAuthority } from "./invoice-authority";
import {
  purchaseLocationAllowed,
  purchaseLocationScope,
} from "./purchase-authority";
import {
  projectPurchaseOperational,
  projectSuppliers,
  type OrderReadDTO,
} from "./purchase-projections";
import {
  createOrder,
  orderCandidates,
  orderLocations,
  placeOrder,
  saveOrderDraft,
  type OrderCandidate,
  type OrderDraftInput,
} from "./orders";
import { supplierMatches } from "./supplier-editor";
import type {
  CompanyConfig,
  DemoState,
  NoteRecord,
  SupplierRecord,
} from "./types";

export type OrderPrintConfig = Pick<
  CompanyConfig,
  "company" | "branches" | "supplier_documents"
>;
export type OrderSupplierChoice = Pick<
  SupplierRecord,
  "id" | "company_id" | "name" | "previous_names" | "active" | "status"
>;
export type ToOrderNoteReadDTO = Pick<
  NoteRecord,
  "id" | "company_id" | "branch" | "text" | "qty" | "product_code" | "status"
>;
export type OrderCandidateReadDTO = Omit<
  OrderCandidate,
  "expected_unit_cost" | "expected_case_cost" | "expected_cost_source"
> & {
  expected_unit_cost?: string | null;
  expected_case_cost?: string | null;
  expected_cost_source?: OrderCandidate["expected_cost_source"];
};
export interface OrdersBoardReadDTO {
  orders: OrderReadDTO[];
  suppliers: OrderSupplierChoice[];
  locations: string[];
  notes: ToOrderNoteReadDTO[];
  invoice_numbers: Record<string, string>;
  writable_order_ids: string[];
}
export function ordersBoard(
  state: DemoState,
  actor: AuthenticatedActor,
): OrdersBoardReadDTO {
  actor = freshActor(state, actor);
  const company_id = state.config.company.seed_key;
  requireCapability(state, actor, "orders.read", {
    company_id,
    kind: "company_shared",
  });
  const orders = projectPurchaseOperational(state, actor).orders.sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const suppliers = projectSuppliers(state, actor)
    .filter((supplier) => supplier.active)
    .map((supplier) => ({
      id: supplier.id,
      company_id: supplier.company_id,
      name: supplier.name,
      previous_names: supplier.previous_names
        ? [...supplier.previous_names]
        : undefined,
      active: supplier.active,
      status: supplier.status,
    }));
  const locations = orderLocations(state, actor);
  const notes = state.notes
    .filter(
      (note) =>
        note.company_id === company_id &&
        note.type === "to_order" &&
        purchaseLocationAllowed(
          state,
          actor,
          "notes.read",
          note.company_id,
          note.branch,
        ),
    )
    .map((note) => ({
      id: note.id,
      company_id: note.company_id,
      branch: note.branch,
      text: note.text,
      qty: note.qty,
      product_code: note.product_code,
      status: note.status,
    }));
  const invoice_numbers: Record<string, string> = {};
  for (const id of new Set(
    orders.flatMap((order) => order.linked_invoice_ids),
  )) {
    if (!canInvoiceAuthority(state, actor, "invoices.read", id)) continue;
    const invoice = [...(state.invoices ?? []), state.invoice].find(
      (item) => item.company_id === company_id && item.id === id,
    );
    if (invoice) invoice_numbers[id] = invoice.supplier_invoice_number;
  }
  return {
    orders,
    suppliers,
    locations,
    notes,
    invoice_numbers,
    writable_order_ids: orders
      .filter((order) =>
        purchaseLocationAllowed(
          state,
          actor,
          "orders.write",
          company_id,
          order.branch,
          true,
        ),
      )
      .map((order) => order.id),
  };
}
export function orderFormCandidates(
  state: DemoState,
  actor: AuthenticatedActor,
  location: string,
  supplierName: string,
): { candidates: OrderCandidateReadDTO[]; costs_visible: boolean } {
  actor = freshActor(state, actor);
  if (
    !location ||
    location === "all" ||
    !orderLocations(state, actor).includes(location)
  )
    throw new Error("location");
  const scoped = actorAtLocation(state, actor, location);
  requireCapability(
    state,
    scoped,
    "orders.read",
    purchaseLocationScope(actor.company_id, location),
  );
  const supplier = projectSuppliers(state, scoped).find(
    (record) => record.active && supplierMatches(record, supplierName),
  );
  if (!supplier) throw new Error("supplier");
  const costs_visible = can(
    state,
    scoped,
    "orders.cost_read",
    purchaseLocationScope(actor.company_id, location),
  ).allowed;
  if (costs_visible)
    return {
      candidates: orderCandidates(state, scoped, supplier.name),
      costs_visible,
    };
  // Metadata only when money is unavailable. Receipt/cost history is never queried.
  const candidates = projectPurchaseOperational(state, scoped)
    .supplier_items.filter(
      (item) => !item.archived && item.supplier_id === supplier.id,
    )
    .flatMap((item) => {
      const product = state.products.find(
        (product) =>
          product.company_id === actor.company_id &&
          product.code === item.product_code &&
          product.status !== "archived",
      );
      if (
        !product ||
        !can(
          state,
          scoped,
          "lookup.read",
          purchaseLocationScope(actor.company_id, location),
        ).allowed
      )
        return [];
      return [
        {
          id: item.id,
          product_code: product.code,
          supplier_item_code: item.supplier_item_code,
          name_en: product.name_en,
          name_fa: product.name_fa,
          unit_size: product.unit_size,
          units_per_case: item.units_per_case,
          ...(product.sold_by === "weight"
            ? {
                quantity_unit: "lb" as const,
                case_weight: item.case_weight,
                case_weight_unit: item.case_weight_unit,
                weight_conversion_factor: item.weight_conversion_factor,
              }
            : {}),
        },
      ];
    });
  return { candidates, costs_visible: false };
}
/** Read-only validation clones the private canonical draft with its SDK binding. */
export function previewOrderDraft(
  state: DemoState,
  actor: AuthenticatedActor,
  input: OrderDraftInput,
  options: { id?: string; expected_version?: number; place: boolean },
): void {
  actor = freshActor(state, actor);
  if (!input.branch || input.branch === "all") throw new Error("location");
  requireCapability(
    state,
    actor,
    "orders.write",
    purchaseLocationScope(actor.company_id, input.branch, true),
  );
  if (options.id && options.expected_version === undefined)
    throw new Error("stale");
  const preview = cloneWithAuthority(state);
  const order = options.id
    ? saveOrderDraft(
        preview,
        actor,
        options.id,
        input,
        options.expected_version,
      )
    : createOrder(preview, actor, input);
  if (options.place) placeOrder(preview, actor, order.id, order.version);
}
export function previewPlaceOrder(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  expected_version: number,
): void {
  actor = freshActor(state, actor);
  const order = state.orders?.find(
    (record) => record.company_id === actor.company_id && record.id === id,
  );
  if (!order) throw new Error("scope");
  requireCapability(
    state,
    actor,
    "orders.write",
    purchaseLocationScope(order.company_id, order.branch, true),
  );
  placeOrder(cloneWithAuthority(state), actor, order.id, expected_version);
}
export function orderPrintSnapshot(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  expected_version: number,
): { order: OrderReadDTO; config: OrderPrintConfig } {
  actor = freshActor(state, actor);
  const canonical = state.orders?.find(
    (order) => order.id === id && order.company_id === actor.company_id,
  );
  if (
    !canonical ||
    !purchaseLocationAllowed(
      state,
      actor,
      "orders.read",
      canonical.company_id,
      canonical.branch,
    )
  )
    throw new Error("scope");
  requireCapability(
    state,
    actor,
    "orders.read",
    purchaseLocationScope(canonical.company_id, canonical.branch),
  );
  if (canonical.version !== expected_version) throw new Error("stale");
  const order = projectPurchaseOperational(state, actor).orders.find(
    (item) => item.id === canonical.id,
  );
  if (!order) throw new Error("scope");
  return {
    order,
    config: structuredClone({
      company: state.config.company,
      branches: state.config.branches,
      supplier_documents: state.config.supplier_documents,
    }),
  };
}

/** Reject a handler created for another session/person/epoch, even inside a fresh callback. */
export function requireSameOrderActor(
  state: DemoState,
  fresh: AuthenticatedActor,
  initiating: AuthenticatedActor,
): void {
  const current = freshActor(state, fresh);
  freshActor(state, initiating);
  if (
    current.company_id !== initiating.company_id ||
    current.user_id !== initiating.user_id ||
    current.session_id !== initiating.session_id ||
    current.authority_epoch !== initiating.authority_epoch ||
    current.person_version !== initiating.person_version
  )
    throw new Error("stale");
}
