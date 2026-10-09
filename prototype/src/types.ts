import { configSeed, demoSeed } from "./config";
import type { NotebookDefinition, NotebookEntry } from "./notebooks";
import type { ReversalPatch } from "./history";
import type { InvoiceLocationCorrection } from "./received";

export type Role = "supervisor" | "floor_worker" | "cashier";
export type Language = "en" | "fa";
export type Branch = string;
export type CompanyConfig = Omit<
  typeof configSeed,
  "company" | "branches" | "pricing_categories" | "promotions"
> & {
  company: typeof configSeed.company & {
    logo_data?: string;
    date_format?: "yyyy-mm-dd" | "dd/mm/yyyy" | "mm/dd/yyyy";
    text_size?: "normal" | "large";
  };
  branches: (Omit<(typeof configSeed.branches)[number], "id" | "type"> & {
    id?: string;
    active?: boolean;
    address?: string;
    phone?: string;
    opening_hours?: string;
    tax_region?: string;
    type?: "store" | "warehouse";
  })[];
  pricing_categories: ((typeof configSeed.pricing_categories)[number] & {
    label_fa?: string;
    archived?: boolean;
  })[];
  promotions: typeof configSeed.promotions & {
    ai_suggestions_enabled?: boolean;
  };
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
  "status" | "last_received_relative_days" | "price_approved_relative_days"
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
  price_provenance?: Record<Branch, PriceProvenance>;
  manual_prices?: Record<
    Branch,
    {
      price: string;
      rule_price: string;
      set_by: string;
      set_at: string;
    }
  >;
};
export interface Approval extends ScopedRecord {
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
  status: "pending" | "approved" | "rejected";
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
  source_invoice_id?: string;
  acknowledgment_reason?: string;
  invoice_number?: string;
  triggered_by?: string;
  posted_at?: string;
}
export interface Alert extends ScopedRecord {
  id: string;
  type:
    | "lower_price"
    | "price_conflict"
    | "tax_discrepancy"
    | "barcode_conflict"
    | "other_supplier";
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
}
export type InvoiceLine = Omit<
  (typeof demoSeed.demo_invoice.lines)[number],
  "confidence" | "low_confidence_fields"
> & {
  company_id: string;
  confidence?: number;
  low_confidence_fields?: string[];
  pricing_category?: string;
  date_tracking?: boolean;
  date_type?: "expiry" | "best_before";
  date_value?: string;
  date_confirmed?: boolean;
  lot_number?: string;
  qty_later_received?: number;
  review_confirmed?: boolean;
  short_before_tax?: string;
  short_tax?: string;
  line_tax?: string;
  new_name_en?: string;
  new_name_fa?: string;
  units_per_case?: number;
  manual_price_decision?: "keep" | "rule";
  short_dated?: boolean;
};
export type DemoInvoice = Omit<
  typeof demoSeed.demo_invoice,
  "lines" | "branch"
> &
  ScopedRecord & {
    id: string;
    status: "empty" | "reading" | "draft" | "review" | "posted";
    lines: InvoiceLine[];
    file_name?: string;
    file_type?: string;
    file_data?: string;
    invoice_date?: string;
    received_at?: string;
    receiving_employee?: string;
    due_date?: string;
    posted_at?: string;
    supplier_confirmed?: boolean;
    entry_mode?: "upload" | "manual";
    payment_terms?: string;
    number_is_system_assigned?: boolean;
    short_receipt_keys?: string[];
    handling_branch?: Branch;
    ship_to?: string;
    lower_price_answers?: {
      same_expiry: string;
      old_expiry?: string;
      new_expiry?: string;
      units_left?: number;
      note?: string;
    };
  };
export interface Offer extends ScopedRecord {
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
  copies: number;
  added_by: string;
  added_at: string;
}
export interface ReturnLine {
  product_code: string;
  qty: number;
  reason: string;
  location?: string;
  picked_up?: number;
  replaced?: number;
  settled?: number;
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
}
export interface ExpiryRecord extends ScopedRecord {
  id: string;
  product_code: string;
  expires_in_days: number;
  date: string;
  status: "active" | "cleared";
  invoice_id?: string;
  invoice_number?: string;
  received_date?: string;
}
export interface NoteRecord extends ScopedRecord {
  id: string;
  type: "to_order" | "store_use" | "note_to_supervisor";
  text: string;
  by: string;
  status: "open" | "read" | "resolved";
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
    | "payment"
    | "credit"
    | "opening_balance"
    | "adjustment";
  amount: string;
  date: string;
  reference: string;
  invoice_id?: string;
  cheque_number?: string;
  currency: string;
  note?: string;
}
export interface Activity extends ScopedRecord {
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
  id: string;
  company_id: string;
  name: string;
  phone: string;
  email: string;
  sales_rep_name: string;
  sales_rep_phone: string;
  payment_terms: string;
  address?: string;
  notes?: string;
  status: "confirmed" | "proposed";
  active: boolean;
  previous_names?: string[];
  created_at: string;
  created_by: string;
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
