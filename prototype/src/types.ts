import configSeed from "../../seed/arzon-config.json";
import demoSeed from "../../seed/demo-data.json";

export type Role = "supervisor" | "floor_worker" | "cashier";
export type Language = "en" | "fa";
export type Branch = "Branch 1" | "Branch 2" | "Branch 3" | "all";
export type CompanyConfig = typeof configSeed;
export interface ScopedRecord {
  company_id: string;
  branch: Branch;
  branch_id?: string;
}
export type Product = Omit<(typeof demoSeed.products)[number], "status"> & {
  company_id: string;
  status: "active" | "pending_approval" | "archived";
  branch_prices?: Record<string, string>;
  pending_price?: string | null;
  pending_branch?: Branch;
  description_en?: string;
  description_fa?: string;
};
export interface Approval extends ScopedRecord {
  id: string;
  type:
    | "new_product"
    | "price_change"
    | "margin_review"
    | "barcode_conflict"
    | "tax_profile";
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
  acknowledgment_reason?: string;
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
export type InvoiceLine = (typeof demoSeed.demo_invoice.lines)[number] & {
  company_id: string;
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
    number_is_system_assigned?: boolean;
    short_receipt_keys?: string[];
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
}
export interface ExpiryRecord extends ScopedRecord {
  id: string;
  product_code: string;
  expires_in_days: number;
  date: string;
  status: "active" | "cleared";
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
  id: string;
  action: string;
  by: string;
  at: string;
  product_code?: string;
}
export interface DemoState {
  version: 1;
  config: CompanyConfig;
  products: Product[];
  approvals: Approval[];
  alerts: Alert[];
  invoice: DemoInvoice;
  invoices?: DemoInvoice[];
  offers: Offer[];
  templates: LabelTemplate[];
  returns: ReturnRecord[];
  expiry: ExpiryRecord[];
  notes: NoteRecord[];
  ledger: LedgerEntry[];
  stock: Record<string, number>;
  activity: Activity[];
}
