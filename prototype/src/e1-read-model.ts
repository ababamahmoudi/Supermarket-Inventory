import {
  priceUpdateTasks,
  priceChangeHints,
  type PriceChangeHint,
} from "./price-updates";
import type { AuthenticatedActor } from "./authority-types";
import type {
  DemoState,
  CompanyConfig,
  Approval,
  Alert,
  Activity,
  SupplierRecord,
} from "./types";
import type { InvoiceReadDTO } from "./invoice-projections";
import type { InvoiceWorkspaceRead } from "./invoice-workspace-read";
import type {
  ReceiptLotReadDTO,
  ClearanceLotReadDTO,
  OrderReadDTO,
  SupplierItemReadDTO,
} from "./purchase-projections";
import type { OperationalReturnRead } from "./return-projections";
import type {
  SaleEventReadDTO,
  SaleHoldReadDTO,
  NotificationReadDTO,
} from "./sales-projections";
export type { OperationalReturnRead } from "./return-projections";
import { can } from "./permissions";

import type { ProductReadDTO } from "./catalog-read-model";
import type {
  OfferReadDTO,
  SaleReadDTO,
  SaleRequestReadDTO,
  OfferStoreSuppressionReadDTO,
} from "./offers-read-model";
import type {
  LabelTemplateReadDTO,
  LabelWaitlistReadDTO,
} from "./labels-read-model";
export type { ProductReadDTO } from "./catalog-read-model";
export type CompanyReadConfig = Omit<
  CompanyConfig,
  | "notifications"
  | "pricing_categories"
  | "_comment"
  | "approvals"
  | "rounding_bands"
  | "special_corrections"
  | "returns"
  | "supplier_cost_comparison"
  | "stock_counts"
  | "session"
> & {
  session: Omit<CompanyConfig["session"], "pins">;
  pricing_categories: Pick<
    CompanyConfig["pricing_categories"][number],
    "key" | "label" | "label_fa" | "archived" | "default_tax_profile"
  >[];
  approvals?: CompanyConfig["approvals"];
  rounding_bands?: CompanyConfig["rounding_bands"];
  special_corrections?: CompanyConfig["special_corrections"];
  returns?: CompanyConfig["returns"];
};
/** No canonical invoice or unavailable money is synthesized to satisfy a component. */
export interface ScopedReadView extends Omit<
  DemoState,
  | "price_update_baseline"
  | "price_task_prints"
  | "config"
  | "prototype_e1_history_recovery"
  | "products"
  | "invoice"
  | "invoices"
  | "returns"
  | "supplier_cost_comparison"
  | "stock_counts"
  | "approvals"
  | "alerts"
  | "activity"
  | "offers"
  | "offer_store_suppressions"
  | "sales"
  | "sale_requests"
  | "sale_events"
  | "sale_delivery_holds"
  | "notifications"
  | "templates"
  | "label_waitlist"
  | "receipt_lots"
  | "orders"
  | "supplier_items"
> {
  price_change_hints?: PriceChangeHint[];
  config: CompanyReadConfig;
  products: ProductReadDTO[];
  offers: OfferReadDTO[];
  offer_store_suppressions: OfferStoreSuppressionReadDTO[];
  sales?: SaleReadDTO[];
  sale_requests?: SaleRequestReadDTO[];
  sale_events?: SaleEventReadDTO[];
  sale_delivery_holds?: SaleHoldReadDTO[];
  notifications?: NotificationReadDTO[];
  templates: LabelTemplateReadDTO[];
  label_waitlist?: LabelWaitlistReadDTO[];
  invoice: InvoiceReadDTO | null;
  invoice_workspace: InvoiceWorkspaceRead | null;
  invoices: InvoiceReadDTO[];
  returns: OperationalReturnRead[];
  approvals: Approval[];
  alerts: Alert[];
  activity: Activity[];
  receipt_lots?: ReceiptLotReadDTO[];
  clearance_lots?: ClearanceLotReadDTO[];
  orders?: OrderReadDTO[];
  supplier_items?: SupplierItemReadDTO[];
}
export interface ReadModelProjectors {
  catalog(
    state: DemoState,
    actor: AuthenticatedActor,
  ): Pick<
    ScopedReadView,
    | "products"
    | "offers"
    | "offer_store_suppressions"
    | "templates"
    | "label_waitlist"
    | "label_settings"
  >;
  invoices(
    state: DemoState,
    actor: AuthenticatedActor,
  ): Pick<ScopedReadView, "invoice" | "invoices" | "invoice_workspace">;
  operational(
    state: DemoState,
    actor: AuthenticatedActor,
  ): Pick<
    ScopedReadView,
    | "receipt_lots"
    | "clearance_lots"
    | "stock_movements"
    | "stock"
    | "supplier_items"
    | "orders"
    | "branch_requests"
    | "request_transfer_events"
    | "notebooks"
    | "notebook_entries"
    | "expiry"
    | "notes"
  >;
  returns(state: DemoState, actor: AuthenticatedActor): OperationalReturnRead[];
  approvals(state: DemoState, actor: AuthenticatedActor): Approval[];
  alerts(state: DemoState, actor: AuthenticatedActor): Alert[];
  sales(
    state: DemoState,
    actor: AuthenticatedActor,
  ): Pick<
    ScopedReadView,
    | "sales"
    | "sale_requests"
    | "sale_events"
    | "sale_delivery_holds"
    | "notifications"
  >;
  suppliers(state: DemoState, actor: AuthenticatedActor): SupplierRecord[];
  history(state: DemoState, actor: AuthenticatedActor): Activity[];
  /** Safe ledger summaries only when supplier-balance capability is granted. */
  ledger(state: DemoState, actor: AuthenticatedActor): DemoState["ledger"];
}
function publicSession(session: CompanyConfig["session"]) {
  const { pins, ...policy } = session;
  void pins;
  return policy;
}
function operationalConfig(config: CompanyConfig): CompanyReadConfig {
  const source = structuredClone(config);
  return {
    company: source.company,
    branches: source.branches,
    roles: source.roles,
    pricing_categories: source.pricing_categories.map((category) => ({
      key: category.key,
      label: category.label,
      label_fa: category.label_fa,
      archived: category.archived,
      default_tax_profile: category.default_tax_profile,
    })),
    tax: source.tax,
    promotions: source.promotions,
    expiry: source.expiry,
    product_codes: source.product_codes,
    invoices: source.invoices,
    labels: source.labels,
    session: publicSession(source.session),
    dashboard_order: source.dashboard_order,
    terminology: source.terminology,
    notebooks: source.notebooks,
    history: source.history,
    receiving: source.receiving,
    modules: source.modules,
    weighed_items: source.weighed_items,
    sales: source.sales,
    orders: source.orders,
    price_updates: source.price_updates,
  };
}
function configView(
  state: DemoState,
  actor: AuthenticatedActor | null,
): CompanyReadConfig {
  const scope = {
    company_id: state.config.company.seed_key,
    kind: "company_shared" as const,
  };
  if (!can(state, actor, "settings.manage", scope).allowed)
    return operationalConfig(state.config);
  const source = structuredClone(state.config);
  return { ...source, session: publicSession(source.session) };
}
export function signedOutReadView(config: CompanyConfig): ScopedReadView {
  return {
    version: 1,
    config: operationalConfig(config),
    products: [],
    clearance_lots: [],
    invoice: null,
    invoice_workspace: null,
    invoices: [],
    returns: [],
    approvals: [],
    alerts: [],
    activity: [],
    offers: [],
    offer_store_suppressions: [],
    templates: [],
    expiry: [],
    notes: [],
    ledger: [],
    stock: {},
  };
}
/** Every family projector is required; absent adapters never fall back to canonical data. */
export function createReadModel(projectors: ReadModelProjectors) {
  return (state: DemoState, actor: AuthenticatedActor): ScopedReadView => {
    const scope = {
      company_id: state.config.company.seed_key,
      kind: "company_shared" as const,
    };
    const allows = (capability: Parameters<typeof can>[2]) =>
      can(state, actor, capability, scope).allowed;
    const catalog =
      allows("catalog.read") || allows("lookup.read")
        ? projectors.catalog(state, actor)
        : {
            products: [],
            offers: [],
            offer_store_suppressions: [],
            templates: [],
          };
    const invoices = allows("invoices.read")
      ? projectors.invoices(state, actor)
      : { invoice: null, invoices: [], invoice_workspace: null };
    // Adapters must individually guard operational families; Cashier note ACLs are independent.
    const operational = projectors.operational(state, actor);
    return {
      version: state.version,
      price_update_tasks: allows("price_updates.read")
        ? priceUpdateTasks(state, actor)
        : [],
      price_change_hints: priceChangeHints(state, actor),
      config: configView(state, actor),
      ...catalog,
      ...invoices,
      ...operational,
      returns: allows("returns.read") ? projectors.returns(state, actor) : [],
      approvals: allows("approvals.read")
        ? projectors.approvals(state, actor)
        : [],
      alerts: allows("alerts.read") ? projectors.alerts(state, actor) : [],
      ...(allows("sales.read") || allows("notifications.read")
        ? projectors.sales(state, actor)
        : {}),
      suppliers: allows("suppliers.read")
        ? projectors.suppliers(state, actor)
        : [],
      activity:
        allows("history.read_all") || allows("history.read_own")
          ? projectors.history(state, actor)
          : [],
      ledger: allows("supplier_balances.read")
        ? projectors.ledger(state, actor)
        : [],
      ...(allows("supplier_balances.read")
        ? {
            supplier_balance_snapshot_date:
              state.supplier_balance_snapshot_date,
            supplier_balance_snapshot_currency:
              state.supplier_balance_snapshot_currency,
          }
        : {}),
      stock: operational.stock ?? {},
      expiry: operational.expiry ?? [],
      notes: operational.notes ?? [],
    };
  };
}
