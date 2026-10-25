import type { NoteDoneRule } from "./note-engagement";
import type { configSeed, demoSeed } from "./config";
import type { NotebookDefinition, NotebookEntry } from "./notebooks";
import type { ReversalPatch } from "./history";
import type { InvoiceLocationCorrection } from "./received";
import type { SupplierItemDefinition } from "./supplier-items";
import type { Order, OrderComparison, InvoiceNewItemMatch } from "./orders";
import type { InvoiceContentCorrection } from "./invoice-corrections";
import type { ReturnMemo, ReturnPickupCorrection } from "./return-workflow";
import type { ReceiptLot } from "./receipt-lots";
import type { BranchRequest, RequestTransferEvent } from "./branch-requests";
import type { InvoiceOrderDifference } from "./invoice-orders";
import type {
  SaleSchedule,
  SaleRequest,
  SaleLifecycleEvent,
  NotificationRecord,
  SaleDeliveryHold,
  SalesSettings,
  SalePriceUnit,
} from "./sales";

import type { RoleId, DecisionAttribution } from "./authority-types";
import type {
  PriceUpdateTask,
  PriceSnapshot,
  PriceTaskPrint,
  PriceUpdatesSettings,
  NotificationSettings,
} from "./price-updates";
import type { RoleDefinition } from "./role-config";
import type { NoteEngagement } from "./note-engagement";
export type Role = RoleId;
/** Old serialized input only; never a current authority role. */
export type LegacyRole = "supervisor" | "floor_worker" | "cashier";
export type Language = "en" | "fa";
export type Branch = string;
export type CompanyConfig = Omit<
  typeof configSeed,
  | "company"
  | "branches"
  | "pricing_categories"
  | "promotions"
  | "weighed_items"
  | "returns"
  | "sales"
  | "price_updates"
  | "notifications"
  | "roles"
  | "notebooks"
> & {
  roles: RoleDefinition[];
  notebooks: {
    built_in: {
      kind: string;
      name_en: string;
      name_fa: string;
      name_role_key?: Role;
      read_roles: Role[];
      add_roles: Role[];
      has_status?: boolean;
      creates_stock_movement?: boolean;
      notify_supervisor?: boolean;
      notify_roles?: Role[];
      /** Who may mark this built-in notebook's notes done. */
      done_rule?: NoteDoneRule;
    }[];
    custom_created_by: Role[];
  };
  company: typeof configSeed.company & {
    logo_data?: string;
    date_format?: "yyyy-mm-dd" | "dd/mm/yyyy" | "mm/dd/yyyy";
    text_size?: "normal" | "large";
  };
  branches: (Omit<
    (typeof configSeed.branches)[number],
    "id" | "type" | "sells_to_customers"
  > & {
    id?: string;
    active?: boolean;
    address?: string;
    phone?: string;
    opening_hours?: string;
    tax_region?: string;
    timezone?: string;
    type?: "store" | "warehouse";
    sells_to_customers?: boolean;
  })[];
  pricing_categories: ((typeof configSeed.pricing_categories)[number] & {
    label_fa?: string;
    archived?: boolean;
  })[];
  promotions: typeof configSeed.promotions & {
    ai_suggestions_enabled?: boolean;
  };
  orders?: { allow_floor_worker: boolean };
  weighed_items?: {
    conversion_factor: string;
    main_display_unit: "lb" | "kg";
    show_second_unit: boolean;
    use_rounding_bands: boolean;
  };
  returns?: {
    deduct_expected_credit_at_pickup: boolean;
    waiting_credit_days: number;
  };
  supplier_documents?: {
    return_memo: "en" | "bilingual";
    supplier_order: "en" | "bilingual";
  };
  sales?: SalesSettings;
  price_updates?: PriceUpdatesSettings;
  notifications?: NotificationSettings;
};
export interface PriceProvenance {
  invoice_number: string;
  calculated_price: string;
  invoice_date?: string;
  changed_price?: string;
  changed_by?: string;
  changed_at?: string;
}
export interface ScopedRecord {
  company_id: string;
  branch: Branch;
  branch_id?: string;
}
export type Product = Omit<
  (typeof demoSeed.products)[number],
  | "status"
  | "last_received_relative_days"
  | "price_approved_relative_days"
  | "date_tracking"
  | "sold_by"
> & {
  company_id: string;
  last_received_relative_days?: Partial<Record<string, number>>;
  price_approved_relative_days?: number;
  status: "active" | "pending_approval" | "archived";
  branch_prices?: Record<string, string>;
  pending_price?: string | null;
  pending_branch?: Branch;
  description_en?: string;
  description_fa?: string;
  date_tracking?: boolean;
  date_reminder_days?: number;
  first_added_branch?: Branch;
  sold_by?: "each" | "weight";
  price_provenance?: Record<Branch, PriceProvenance>;
  manual_prices?: Record<
    Branch,
    {
      price: string;
      rule_price: string;
      set_by: string;
      set_by_user_id?: string;
      set_by_role_snapshot?: Role;
      decision_attribution?: DecisionAttribution;
      set_at: string;
    }
  >;
};
export interface Approval extends ScopedRecord {
  pricing_category?: string;
  resubmitted_from_id?: string;
  resubmitted_as_id?: string;
  decided_by_user_id?: string;
  decided_at?: string;
  decision_attribution?: DecisionAttribution;
  source_manual_request?: {
    requester_user_id: string;
    requester_name_snapshot: string;
    requester_role_snapshot: Role;
    requested_at: string;
    entered_price: string;
    price_unit: "each" | "lb" | "kg";
    regular_price_snapshot: string | null;
  };
  triggered_by_user_id?: string;
  supplier_id?: string;
  supplier_name?: string;
  barcode?: string;
  conflicting_product_code?: string;
  id: string;
  type:
    | "new_product"
    | "price_change"
    | "margin_review"
    | "barcode_conflict"
    | "tax_profile"
    | "new_supplier";
  product_code: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  correction_id?: string;
  proposed_price: string;
  current_price?: string | null;
  reason?: string;
  scope?: "all" | "branch";
  created_at?: string;
  unit_cost?: string;
  margin?: string | null;
  threshold?: string | null;
  invoice_ids?: string[];
  config_version?: string;
  manual_override?: boolean;
  clear_manual_price?: boolean;
  manual_price_review?: {
    kept_price: string;
    calculated_price: string;
    prior_cost: string;
    received_cost: string;
    receiver_recommendation: "keep" | "rule";
    decision?: "keep" | "rule";
  };
  source_invoice_id?: string;
  acknowledgment_reason?: string;
  invoice_number?: string;
  triggered_by?: string;
  posted_at?: string;
  applies_after_sale?: boolean;
  sale_id?: string;
}
export interface Alert extends ScopedRecord {
  decided_by_user_id?: string;
  decision_attribution?: DecisionAttribution;
  id: string;
  type:
    | "lower_price"
    | "price_conflict"
    | "tax_discrepancy"
    | "barcode_conflict"
    | "other_supplier"
    | "order_differences"
    | "return_credit_overdue"
    | "date_reminder"
    | "sale_cost_increase"
    | "sale_regular_not_above_sale"
    | "sale_no_end_reminder"
    | "sale_delivery_release";
  sale_id?: string;
  sale_revision?: number;
  sale_price?: string;
  sale_price_unit?: SalePriceUnit;
  sale_last_day?: string | null;
  regular_price_before?: string;
  proposed_regular_price?: string;
  prior_margin?: string;
  new_margin?: string;
  minimum_margin?: string | null;
  approval_id?: string;
  invoice_line_index?: number;
  hold_id?: string;
  sale_decision?: "keep" | "change" | "end";
  decided_by?: string;
  decided_at?: string;
  expiry_id?: string;
  date?: string;
  days_left?: number;
  date_suppressed?: boolean;
  return_id?: string;
  product_code: string;
  status: "pending" | "resolved" | "intentional";
  supplier?: string;
  previous_cost?: string;
  new_cost?: string;
  same_expiry?: string;
  old_expiry?: string;
  new_expiry?: string;
  units_left?: number;
  note?: string;
  branch_prices?: Record<string, string>;
  invoice_id?: string;
  order_id?: string;
  order_differences?: InvoiceOrderDifference[];
}
export type InvoiceLine = Omit<
  (typeof demoSeed.demo_invoice.lines)[number],
  | "confidence"
  | "low_confidence_fields"
  | "units_per_case"
  | "quantity_unit"
  | "quantity_entered"
  | "case_cost_before_tax"
  | "sold_by"
  | "source_quantity"
  | "source_quantity_unit"
  | "source_received_quantity"
  | "source_cost_before_tax"
  | "source_cost_unit"
  | "weight_conversion_factor"
  | "case_weight"
  | "case_weight_unit"
  | "canonical_lb_quantity"
  | "order_new_item_match"
> & {
  company_id: string;
  id?: string;
  confidence?: number;
  low_confidence_fields?: string[];
  taxable_inferred?: boolean;
  barcode?: string;
  handwritten_note?: string;
  expiry_as_printed?: string;
  pack_size?: string;
  import_line_index?: number;
  pricing_category?: string;
  date_tracking?: boolean;
  date_type?: "expiry" | "best_before";
  date_value?: string;
  date_confirmed?: boolean;
  lot_number?: string;
  qty_later_received?: number;
  review_confirmed?: boolean;
  review_changed_after_confirmation?: boolean;
  short_before_tax?: string;
  short_tax?: string;
  line_tax?: string;
  new_name_en?: string;
  new_name_suggestion?: string;
  new_name_fa?: string;
  units_per_case?: number;
  manual_price_decision?: "keep" | "rule";
  short_dated?: boolean;
  supplier_item_id?: string;
  supplier_item_code?: string;
  supplier_item_code_inferred?: boolean;
  quantity_unit?: "cases" | "units" | "kg" | "lb";
  quantity_entered?: string | number;
  case_cost_before_tax?: string;
  order_item_id?: string;
  refused_units?: number;
  extra_delivery_decision?: "keep" | "refuse";
  order_price_decision?: "accept" | "short_dated";
  sold_by?: "each" | "weight";
  source_quantity?: string;
  source_quantity_unit?: "kg" | "lb";
  source_received_quantity?: string;
  source_cost_before_tax?: string;
  source_cost_unit?: "kg" | "lb";
  weight_conversion_factor?: string;
  case_weight?: string;
  case_weight_unit?: "kg" | "lb";
  canonical_lb_quantity?: string;
  order_new_item_match?: InvoiceNewItemMatch;
};
export type DemoInvoice = Omit<
  typeof demoSeed.demo_invoice,
  "lines" | "branch" | "demo_original_snapshot" | "legacy_demo_original"
> &
  ScopedRecord & {
    id: string;
    created_by_user_id?: string;
    handler_user_ids?: string[];
    reviewer_user_ids?: string[];
    reviewer_origin_location_id?: string;
    version?: number;
    status: "empty" | "reading" | "draft" | "review" | "posted";
    lines: InvoiceLine[];
    file_name?: string;
    file_type?: string;
    file_data?: string;
    file_size?: number;
    original_file_invoice_id?: string;
    original_pages?: {
      file_name: string;
      file_type: string;
      file_data: string;
      file_size: number;
      original_sha256: string;
    }[];
    low_confidence_fields?: string[];
    reading_record?: {
      source: "imported";
      file_name: string;
      page_sha256s: string[];
      models: string[];
      reading_cost_usd: string;
      exported_at: string;
      ai_source: string;
    };
    import_currency?: string;
    import_warnings?: string[];
    import_handwritten_notes?: string[];
    order_reference?: string;
    bill_to?: string;
    supplier_tax_number?: string;
    other_charges?: {
      line_no?: number;
      line_type: "deposit" | "fee" | "discount" | "credit" | "other";
      description: string;
      amount: string;
      taxable: boolean;
      low_confidence_fields?: string[];
    }[];
    demo_original_snapshot?: true;
    legacy_demo_original?: {
      file_name?: string;
      file_type?: string;
      file_data?: string;
    };
    invoice_date?: string;
    received_at?: string;
    imported_received_source?: "handwriting" | "invoice_date" | "unresolved";
    receiving_employee?: string;
    due_date?: string;
    posted_at?: string;
    supplier_confirmed?: boolean;
    entry_mode?: "upload" | "manual";
    payment_terms?: string;
    payment_term_days?: number;
    payment_terms_inferred?: boolean;
    due_date_manual?: boolean;
    final_total_manual?: boolean;
    supplier_review_required?: boolean;
    supplier_review_confirmed?: boolean;
    number_is_system_assigned?: boolean;
    short_receipt_keys?: string[];
    handling_branch?: Branch;
    ship_to?: string;
    order_id?: string;
    order_missing_decisions?: Record<
      string,
      "short" | "back_ordered" | "cancelled"
    >;
    order_review_version?: number;
    order_comparison?: OrderComparison;
    lower_price_answers?: {
      same_expiry: string;
      old_expiry?: string;
      new_expiry?: string;
      units_left?: number;
      note?: string;
    };
  };
export interface Offer extends ScopedRecord {
  version?: number;
  decision_attribution?: DecisionAttribution;
  created_by_user_id?: string;
  stopped_by_user_id?: string;
  id: string;
  product_code: string;
  label: string;
  price: string;
  pool: string;
  mix_and_match: boolean;
  status: "suggested" | "active" | "stopped";
  scope: "all" | "branch";
  currency: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  stopped_at?: string;
  lot_id?: string;
  expiry_date?: string;
  clearance?: boolean;
}
export interface OfferStoreSuppression extends ScopedRecord {
  id: string;
  offer_id: string;
  offer_version: number;
  status: "active" | "cleared";
  stopped_at: string;
  stopped_by_user_id: string;
  stopped_by: string;
  cleared_at?: string;
  cleared_by_user_id?: string;
}
export interface LabelTemplate {
  id: string;
  company_id: string;
  name: string;
  width: number;
  height: number;
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  gap_x: number;
  gap_y: number;
  offset_x?: number;
  offset_y?: number;
  archived?: boolean;
  style?: "regular" | "promo";
  built_in?: "regular" | "promo";
}
export interface LabelWaitlistItem extends ScopedRecord {
  id: string;
  product_code: string;
  lot_id?: string;
  copies: number;
  added_by: string;
  added_by_user_id?: string;
  added_at: string;
  preferred_template?: "regular" | "promo";
  source_event_id?: string;
  source_reason?:
    | "sale_started"
    | "sale_changed"
    | "sale_ended"
    | "regular_price_changed"
    | "price_update";
}
export interface ReturnLine {
  quantity_unit?: "units" | "lb";
  unit_cost?: string;
  product_code: string;
  qty: number;
  reason: string;
  location?: string;
  picked_up?: number;
  replaced?: number;
  settled?: number;
  pickup_shortfall?: {
    reason: string;
    outcome: "keep_for_next_pickup" | "put_back_on_shelf" | "throw_away";
    quantity: number;
  };
  outstanding_expected_date?: string;
  outstanding_note?: string;
}
export interface ReturnRecord extends ScopedRecord {
  id: string;
  supplier: string;
  lines: ReturnLine[];
  status:
    | "open"
    | "picked_up"
    | "partially_resolved"
    | "resolved"
    | "cancelled"
    | "cancellation_review"
    | "claim_pending";
  resolution?: string;
  original_units_recovered: number;
  supplier_rep_name?: string;
  signed_pickup_slip_reference?: string;
  replacement_received?: {
    product_code: string;
    qty: number;
    covers_original_qty: number;
  };
  cancellation_demo_note?: string;
  cancellation_reason?: string;
  safe_to_restore?: boolean;
  compensation_amount?: string;
  credit_document?: string;
  linked_invoice?: string;
  note?: string;
  created_at?: string;
  created_by?: string;
  pickup_memos?: ReturnMemo[];
  pickup_completed?: boolean;
  pickup_corrections?: ReturnPickupCorrection[];
  picked_up_at?: string;
  closure_subtype?: "credited" | "replaced" | "written_off";
}
export interface ExpiryRecord extends ScopedRecord {
  created_by_user_id?: string;
  removed_by_user_id?: string;
  id: string;
  product_code: string;
  expires_in_days: number;
  date: string;
  status: "active" | "cleared" | "removed";
  created_by?: string;
  created_at?: string;
  source?: "invoice" | "manual" | "correction";
  date_type?: "expiry" | "best_before";
  quantity?: string;
  lot_number?: string;
  note?: string;
  invoice_line_index?: number;
  removed_reason?:
    "sold_out" | "thrown_away" | "returned_to_supplier" | "entered_by_mistake";
  removed_by?: string;
  removed_at?: string;
  removal_action?: "remove" | "stop_tracking" | "undo" | "correction";
  correction_id?: string;
  previous_entry_id?: string;
  invoice_id?: string;
  invoice_number?: string;
  received_date?: string;
  supplier_id?: string;
  supplier?: string;
  lot_id?: string;
  reminder_alert_id?: string;
  reminded_at?: string;
}
export interface NoteRecord extends ScopedRecord, NoteEngagement {
  id: string;
  /** Generated bilingual instruction only; user-entered note text remains original. */
  text_fa?: string;
  sale_delivery_hold_id?: string;
  archived?: boolean;
  type: "to_order" | "store_use" | "note_to_supervisor";
  text: string;
  by: string;
  /** Author identity, written by actorAudit when the note is added. */
  actor_user_id?: string;
  status: "open" | "read" | "resolved" | "ordered";
  created_at: string;
  product_code?: string;
  qty?: number;
}
export interface LedgerEntry extends ScopedRecord {
  id: string;
  supplier: string;
  type:
    | "invoice"
    | "short_deduction"
    | "short_restoration"
    | "refused_deduction"
    | "payment"
    | "credit"
    | "opening_balance"
    | "adjustment";
  amount: string;
  date: string;
  reference: string;
  invoice_id?: string;
  invoice_line_index?: number;
  cheque_number?: string;
  currency: string;
  note?: string;
}
export interface Activity extends ScopedRecord {
  actor_user_id?: string;
  actor_role?: Role;
  actor_role_snapshot?: Role;
  device_id?: string;
  actor_username?: string;
  device?: string;
  id: string;
  action: string;
  by: string;
  at: string;
  product_code?: string;
  reversible?: boolean;
  before?: unknown;
  after?: unknown;
  scope?: "all" | "branch";
  entity_type?: string;
  entity_id?: string;
  reversal?: ReversalPatch[];
  reversed_activity_id?: string;
  reversal_kind?: "undo" | "revert";
}
export interface SupplierRecord {
  created_by_user_id?: string;
  updated_by_user_id?: string;
  confirmed_by_user_id?: string;
  id: string;
  company_id: string;
  name: string;
  phone: string;
  email: string;
  sales_rep_name: string;
  sales_rep_phone: string;
  payment_terms: string;
  invoice_review_required?: boolean;
  address?: string;
  tax_number?: string;
  created_from_import?: true;
  notes?: string;
  status: "confirmed" | "proposed";
  active: boolean;
  previous_names?: string[];
  created_at: string;
  created_by: string;
}
/** Private canonical quarantine metadata; never an authenticated/public DTO. */
export interface HistoryRecoveryMarker {
  version: 1;
  source_key: string;
  source_sha256: string;
  backup_reference: string;
  phase: "quarantined" | "reset_committed";
}
export interface DemoState {
  version: 1;
  /** The supplied balance figures are a dated demo snapshot, not ledger entries. */
  supplier_balance_snapshot_date?: string;
  supplier_balance_snapshot_currency?: string;
  pricing_minimum_margin_schema?: 2;
  demo_fixture_schema?: 2;
  prototype_b_schema?: 1;
  prototype_c1_schema?: 1;
  prototype_c2_schema?: 1;
  prototype_c4_schema?: 1;
  prototype_c6_schema?: 1;
  prototype_c8_schema?: 1;
  prototype_e1_schema?: 1;
  prototype_e2_schema?: 1;
  prototype_r2_supplier_schema?: 1;
  supplier_name_distinctions?: string[];
  price_update_tasks?: PriceUpdateTask[];
  price_update_baseline?: Record<string, PriceSnapshot>;
  price_task_prints?: PriceTaskPrint[];
  prototype_e1_history_recovery?: HistoryRecoveryMarker;
  sales?: SaleSchedule[];
  sale_requests?: SaleRequest[];
  sale_events?: SaleLifecycleEvent[];
  sale_delivery_holds?: SaleDeliveryHold[];
  notifications?: NotificationRecord[];
  sale_label_effects?: string[];
  receipt_lots?: ReceiptLot[];
  invoice_content_corrections?: InvoiceContentCorrection[];
  supplier_items?: SupplierItemDefinition[];
  orders?: Order[];
  branch_requests?: BranchRequest[];
  request_transfer_events?: RequestTransferEvent[];
  invoice_location_corrections?: InvoiceLocationCorrection[];
  demo_fixture_anchor_date?: string;
  stock_movements?: {
    id: string;
    company_id: string;
    branch: Branch;
    product_code: string;
    qty: number;
    type: string;
    reference: string;
    by: string;
    at: string;
    invoice_id?: string;
    line_index?: number;
  }[];
  config: CompanyConfig;
  suppliers?: SupplierRecord[];
  product_code_high_water?: number;
  products: Product[];
  approvals: Approval[];
  alerts: Alert[];
  invoice: DemoInvoice;
  invoices?: DemoInvoice[];
  offers: Offer[];
  offer_store_suppressions?: OfferStoreSuppression[];
  templates: LabelTemplate[];
  label_waitlist?: LabelWaitlistItem[];
  label_settings?: {
    recent_price_days: number;
    auto_add_approved: boolean;
    fields?: {
      name: boolean;
      description: boolean;
      price: boolean;
      offer: boolean;
      code: boolean;
      logo: boolean;
      unit: boolean;
      tax: boolean;
    };
    languages?: Language[];
  };
  notebooks?: NotebookDefinition[];
  notebook_entries?: NotebookEntry[];
  returns: ReturnRecord[];
  expiry: ExpiryRecord[];
  notes: NoteRecord[];
  ledger: LedgerEntry[];
  stock: Record<string, number>;
  activity: Activity[];
}
