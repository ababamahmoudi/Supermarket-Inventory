import Decimal from "decimal.js";
import { supplierDetails } from "./config";
import { createId } from "./ids";
import { configuredBranches } from "./settings";
import type { Branch, DemoState, SupplierRecord } from "./types";
import type { OperationsContext } from "./operations";

export interface SupplierEdits {
  name: string;
  phone: string;
  email: string;
  sales_rep_name: string;
  sales_rep_phone: string;
  payment_terms: string;
  address: string;
  notes: string;
  opening_balances?: { branch: Branch; amount: string; date: string }[];
  similar_name_confirmed?: boolean;
}
export class SupplierEditError extends Error {
  constructor(
    public readonly code:
      | "permission"
      | "scope"
      | "name"
      | "email"
      | "similar"
      | "balance"
      | "date"
      | "not_found",
  ) {
    super(code);
  }
}
export function supplierRecords(state: DemoState): SupplierRecord[] {
  return (
    state.suppliers ??
    supplierDetails.map((record, index) => ({
      ...record,
      id: `seed-supplier-${index + 1}`,
      company_id: state.config.company.seed_key,
      phone: record.phone ?? "",
      email: record.email ?? "",
      sales_rep_name: record.sales_rep_name ?? "",
      sales_rep_phone: record.sales_rep_phone ?? "",
      payment_terms: record.payment_terms ?? "",
      status:
        record.status === "proposed"
          ? ("proposed" as const)
          : ("confirmed" as const),
      active: true,
      address: "",
      notes: "",
      created_at: "",
      created_by: "",
    }))
  );
}
export function hydrateSuppliers(state: DemoState): void {
  state.suppliers ??= structuredClone(supplierRecords(state));
}
export function supplierMatches(record: SupplierRecord, name: string): boolean {
  return record.name === name || (record.previous_names ?? []).includes(name);
}
export function supplierChoices(state: DemoState): SupplierRecord[] {
  return supplierRecords(state).filter(
    (record) =>
      record.company_id === state.config.company.seed_key && record.active,
  );
}
const normalizedName = (name: string) =>
  name
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
/** Comparison is a warning, never a silent merge of two supplier identities. */
export function similarSupplierNames(
  state: DemoState,
  name: string,
  exceptId?: string,
): SupplierRecord[] {
  const words = normalizedName(name).split(" ").filter(Boolean);
  if (!words.length) return [];
  return supplierRecords(state).filter((record) => {
    if (
      record.company_id !== state.config.company.seed_key ||
      record.id === exceptId
    )
      return false;
    const existing = normalizedName(record.name);
    const shared = words.filter((word) =>
      existing.split(" ").includes(word),
    ).length;
    return (
      existing === normalizedName(name) ||
      (words.length >= 2 && shared >= 2) ||
      (words.length === 1 &&
        words[0].length >= 5 &&
        existing.startsWith(words[0]))
    );
  });
}
function guard(
  state: DemoState,
  context: OperationsContext,
  invoiceQuickAdd = false,
): void {
  if (context.company_id !== state.config.company.seed_key)
    throw new SupplierEditError("scope");
  if (
    context.role !== "supervisor" &&
    !(
      invoiceQuickAdd &&
      context.role === "floor_worker" &&
      context.branch !== "all"
    )
  )
    throw new SupplierEditError("permission");
  if (
    context.branch !== "all" &&
    !configuredBranches(state.config).includes(context.branch)
  )
    throw new SupplierEditError("scope");
}
export function saveSupplier(
  state: DemoState,
  context: OperationsContext,
  edits: SupplierEdits,
  options: { id?: string; invoice_quick_add?: boolean } = {},
  now = new Date(),
): SupplierRecord {
  guard(state, context, !options.id && options.invoice_quick_add);
  if (!edits.name.trim()) throw new SupplierEditError("name");
  if (
    edits.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edits.email.trim())
  )
    throw new SupplierEditError("email");
  if (
    similarSupplierNames(state, edits.name, options.id).length &&
    !edits.similar_name_confirmed
  )
    throw new SupplierEditError("similar");
  const balances = edits.opening_balances ?? [];
  if (
    context.role !== "supervisor" &&
    balances.some((row) => row.amount.trim())
  )
    throw new SupplierEditError("permission");
  if (options.id && balances.some((row) => row.amount.trim()))
    throw new SupplierEditError("balance");
  for (const row of balances.filter((row) => row.amount.trim())) {
    if (
      row.branch === "all" ||
      !configuredBranches(state.config).includes(row.branch)
    )
      throw new SupplierEditError("scope");
    if (
      !/^-?\d+(\.\d{1,2})?$/.test(row.amount) ||
      !new Decimal(row.amount).isFinite()
    )
      throw new SupplierEditError("balance");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      Number.isNaN(Date.parse(`${row.date}T12:00:00Z`)) ||
      new Date(`${row.date}T12:00:00Z`).toISOString().slice(0, 10) !== row.date
    )
      throw new SupplierEditError("date");
  }
  if (
    new Set(
      balances.filter((row) => row.amount.trim()).map((row) => row.branch),
    ).size !== balances.filter((row) => row.amount.trim()).length
  )
    throw new SupplierEditError("balance");
  hydrateSuppliers(state);
  const previous = options.id
    ? state.suppliers!.find(
        (record) =>
          record.company_id === context.company_id && record.id === options.id,
      )
    : undefined;
  if (options.id && !previous) throw new SupplierEditError("not_found");
  const before = previous ? structuredClone(previous) : null;
  const record: SupplierRecord = previous ?? {
    id: createId("supplier"),
    company_id: context.company_id,
    name: "",
    phone: "",
    email: "",
    sales_rep_name: "",
    sales_rep_phone: "",
    payment_terms: "",
    status: context.role === "supervisor" ? "confirmed" : "proposed",
    active: true,
    created_at: now.toISOString(),
    created_by: context.actor,
  };
  if (previous && previous.name !== edits.name.trim())
    record.previous_names = [
      ...new Set([...(previous.previous_names ?? []), previous.name]),
    ];
  for (const field of [
    "name",
    "phone",
    "email",
    "sales_rep_name",
    "sales_rep_phone",
    "payment_terms",
    "address",
    "notes",
  ] as const)
    record[field] = edits[field].trim();
  if (!previous) state.suppliers!.push(record);
  for (const row of balances.filter((row) => row.amount.trim()))
    state.ledger.push({
      id: `${record.id}:opening:${row.branch}`,
      company_id: context.company_id,
      branch: row.branch,
      branch_id: row.branch,
      supplier: record.name,
      type: "opening_balance",
      amount: new Decimal(row.amount).toFixed(2),
      date: row.date,
      reference: "Opening balance",
      currency: state.config.company.currency,
      note: context.actor,
    });
  if (record.status === "proposed" && !previous)
    state.approvals.push({
      id: `${record.id}:confirmation`,
      company_id: context.company_id,
      branch: context.branch,
      type: "new_supplier",
      supplier_id: record.id,
      supplier_name: record.name,
      product_code: "",
      proposed_price: "",
      status: "pending",
      created_at: now.toISOString(),
      triggered_by: context.actor,
    });
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: "all",
    action: previous ? "Save supplier" : "Add supplier",
    by: context.actor,
    at: now.toISOString(),
    reversible:
      !balances.some((row) => row.amount.trim()) &&
      record.status === "confirmed",
    entity_type: "supplier",
    entity_id: record.id,
    before,
    after: structuredClone(record),
  });
  return record;
}
export function deactivateSupplier(
  state: DemoState,
  context: OperationsContext,
  id: string,
  now = new Date(),
): void {
  guard(state, context);
  hydrateSuppliers(state);
  const record = state.suppliers!.find(
    (item) => item.company_id === context.company_id && item.id === id,
  );
  if (!record) throw new SupplierEditError("not_found");
  if (!record.active) return;
  const before = structuredClone(record);
  record.active = false;
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: "all",
    action: "Deactivate supplier",
    by: context.actor,
    at: now.toISOString(),
    reversible: true,
    entity_type: "supplier",
    entity_id: record.id,
    before,
    after: structuredClone(record),
  });
}
export function confirmSupplier(
  state: DemoState,
  context: OperationsContext,
  id: string,
  now = new Date(),
): void {
  guard(state, context);
  hydrateSuppliers(state);
  const record = state.suppliers!.find(
    (item) => item.company_id === context.company_id && item.id === id,
  );
  if (!record) throw new SupplierEditError("not_found");
  if (!record.active) throw new Error("Supplier is inactive");
  if (record.status === "confirmed") return;
  record.status = "confirmed";
  for (const approval of state.approvals)
    if (
      approval.company_id === context.company_id &&
      approval.supplier_id === id &&
      approval.type === "new_supplier" &&
      approval.status === "pending"
    )
      approval.status = "approved";
  for (const invoice of [state.invoice, ...(state.invoices ?? [])])
    if (
      invoice.company_id === context.company_id &&
      supplierMatches(record, invoice.supplier)
    )
      invoice.supplier_confirmed = true;
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: "all",
    action: "Confirm supplier",
    by: context.actor,
    at: now.toISOString(),
    reversible: false,
    entity_type: "supplier",
    entity_id: record.id,
  });
}

/** Supplier confirmation has its own snapshot; it never enters price approval. */
export function supplierApprovalSnapshot(
  state: DemoState,
  approvalId: string,
): string {
  const approval = state.approvals.find(
    (item) =>
      item.id === approvalId &&
      item.company_id === state.config.company.seed_key &&
      item.type === "new_supplier",
  );
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.id === approval?.supplier_id,
  );
  if (!approval || !supplier) throw new SupplierEditError("not_found");
  return JSON.stringify({ approval, supplier });
}

export function resolveSupplierApproval(
  state: DemoState,
  context: OperationsContext,
  approvalId: string,
  decision: "approve" | "reject",
  expectedSnapshot?: string,
  now = new Date(),
): void {
  guard(state, context);
  const approval = state.approvals.find(
    (item) =>
      item.company_id === context.company_id &&
      item.id === approvalId &&
      item.type === "new_supplier" &&
      item.status === "pending",
  );
  if (!approval || !approval.supplier_id)
    throw new Error("Supplier approval is no longer pending");
  if (
    context.branch !== "all" &&
    approval.branch !== context.branch &&
    approval.branch !== "all"
  )
    throw new SupplierEditError("scope");
  const currentSupplier = supplierRecords(state).find(
    (item) =>
      item.company_id === context.company_id &&
      item.id === approval.supplier_id,
  );
  if (!currentSupplier) throw new SupplierEditError("not_found");
  if (
    expectedSnapshot !== undefined &&
    expectedSnapshot !== supplierApprovalSnapshot(state, approvalId)
  )
    throw new Error("Supplier changed. Review the supplier again");
  if (decision === "approve") {
    confirmSupplier(state, context, approval.supplier_id, now);
    return;
  }
  hydrateSuppliers(state);
  const supplier = state.suppliers!.find(
    (item) =>
      item.company_id === context.company_id &&
      item.id === approval.supplier_id,
  )!;
  const before = structuredClone(supplier);
  supplier.active = false;
  for (const item of state.approvals)
    if (
      item.company_id === context.company_id &&
      item.type === "new_supplier" &&
      item.supplier_id === supplier.id &&
      item.status === "pending"
    )
      item.status = "rejected";
  for (const invoice of [state.invoice, ...(state.invoices ?? [])])
    if (
      invoice.company_id === context.company_id &&
      supplierMatches(supplier, invoice.supplier)
    )
      invoice.supplier_confirmed = false;
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: approval.branch,
    action: "Reject supplier",
    by: context.actor,
    at: now.toISOString(),
    reversible: false,
    entity_type: "supplier",
    entity_id: supplier.id,
    before,
    after: structuredClone(supplier),
  });
}
