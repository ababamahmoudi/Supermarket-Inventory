import Decimal from "decimal.js";
import { supplierDetails } from "./config";
import { createId } from "./ids";
import { businessFingerprint } from "./business-fingerprint";
import { configuredBranches } from "./settings";
import type { Branch, DemoState, SupplierRecord } from "./types";
import type { AuthenticatedActor, Capability } from "./authority-types";
import { can, requireCapability } from "./permissions";
import { requirePurchase, purchaseLocationScope } from "./purchase-authority";
import { invoiceAuthorityScope } from "./invoice-authority";
import { paymentTermsDays } from "./invoice-entry";
import { syncSupplierProfileNotifications } from "./supplier-profiles";

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
export type SupplierReadState = {
  readonly config: { readonly company: { readonly seed_key: string } };
  readonly suppliers?: readonly SupplierRecord[];
  readonly supplier_name_distinctions?: readonly string[];
};
export function supplierRecords(
  state: SupplierReadState,
): readonly SupplierRecord[] {
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
      status: "confirmed" as const,
      active: true,
      address: "",
      notes: "",
      created_at: "",
      created_by: "",
    }))
  );
}
export function hydrateSuppliers(state: DemoState): void {
  state.suppliers ??= structuredClone([...supplierRecords(state)]);
}
export function supplierMatches(
  record: Pick<SupplierRecord, "name" | "previous_names">,
  name: string,
): boolean {
  return record.name === name || (record.previous_names ?? []).includes(name);
}
export const invoiceSupplierFields = [
  "phone",
  "email",
  "sales_rep_name",
  "sales_rep_phone",
  "payment_terms",
] as const;
export function missingInvoiceSupplierDetails(
  record: SupplierRecord,
): (typeof invoiceSupplierFields)[number][] {
  return invoiceSupplierFields.filter(
    (field) =>
      !record[field]?.trim() ||
      (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) ||
      (field === "payment_terms" &&
        /^net/i.test(record.payment_terms) &&
        paymentTermsDays(record.payment_terms) === undefined),
  );
}
export function supplierChoices(state: SupplierReadState): SupplierRecord[] {
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
const genericSupplierWords = new Set([
  "inc",
  "ltd",
  "co",
  "corp",
  "limited",
  "incorporated",
  "food",
  "foods",
  "trading",
  "group",
  "import",
  "export",
  "distribution",
  "the",
  "of",
  "and",
]);
function distinctiveName(name: string): string {
  return normalizedName(name)
    .split(" ")
    .filter((word) => word && !genericSupplierWords.has(word))
    .sort()
    .join(" ");
}
function nameSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const next = [row];
    for (let column = 1; column <= right.length; column++)
      next[column] = Math.min(
        next[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + Number(left[row - 1] !== right[column - 1]),
      );
    previous = next;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}
function supplierPairKey(
  companyId: string,
  left: string,
  right: string,
): string {
  return JSON.stringify([
    companyId,
    ...[normalizedName(left), normalizedName(right)].sort(),
  ]);
}
/** Comparison is a warning, never a silent merge of two supplier identities. */
export function similarSupplierNames(
  state: SupplierReadState,
  name: string,
  exceptId?: string,
): SupplierRecord[] {
  const distinctive = distinctiveName(name);
  if (!normalizedName(name)) return [];
  return supplierRecords(state).filter((record) => {
    if (
      record.company_id !== state.config.company.seed_key ||
      record.id === exceptId ||
      state.supplier_name_distinctions?.includes(
        supplierPairKey(record.company_id, name, record.name),
      )
    )
      return false;
    const existing = distinctiveName(record.name);
    return (
      (!!distinctive && existing === distinctive) ||
      nameSimilarity(distinctive, existing) >= 0.85 ||
      normalizedName(record.name) === normalizedName(name)
    );
  });
}
/** A recorded pair dismissal never edits either supplier's correct legal name. */
export function dismissSimilarSupplier(
  state: DemoState,
  context: AuthenticatedActor,
  name: string,
  existingId: string,
  invoiceQuickAdd = false,
  now = new Date(),
): void {
  context = guard(state, context, invoiceQuickAdd);
  const existing = supplierRecords(state).find(
    (record) =>
      record.company_id === context.company_id && record.id === existingId,
  );
  if (!existing || !name.trim()) throw new SupplierEditError("not_found");
  const key = supplierPairKey(context.company_id, name, existing.name);
  state.supplier_name_distinctions ??= [];
  if (state.supplier_name_distinctions.includes(key)) return;
  state.supplier_name_distinctions.push(key);
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: "all",
    action: "Distinguish suppliers",
    by: context.actor,
    at: now.toISOString(),
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    reversible: false,
    entity_type: "supplier",
    entity_id: existing.id,
    after: { name: name.trim(), different_from: existing.name },
  });
}
function guard(
  state: DemoState,
  context: AuthenticatedActor,
  invoiceQuickAdd = false,
  capability: Capability = "suppliers.manage",
): AuthenticatedActor {
  return invoiceQuickAdd
    ? requirePurchase(
        state,
        context,
        "invoices.supplier_propose",
        invoiceAuthorityScope(state, state.invoice.id, true),
      )
    : requirePurchase(state, context, capability);
}
export function saveSupplier(
  state: DemoState,
  context: AuthenticatedActor,
  edits: SupplierEdits,
  options: {
    id?: string;
    invoice_quick_add?: boolean;
    complete_invoice_details?: boolean;
  } = {},
  now = new Date(),
): SupplierRecord {
  context = guard(state, context, !options.id && options.invoice_quick_add);
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
    balances.some((row) => row.amount.trim()) &&
    !can(state, context, "payables.opening_balance_write", {
      company_id: context.company_id,
      kind: "company_shared",
    }).allowed
  )
    throw new SupplierEditError("permission");
  if (options.id && balances.some((row) => row.amount.trim()))
    throw new SupplierEditError("balance");
  for (const row of balances.filter((row) => row.amount.trim())) {
    requireCapability(
      state,
      context,
      "payables.opening_balance_write",
      purchaseLocationScope(context.company_id, row.branch, true),
    );
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
    status: "confirmed",
    invoice_review_required: false,
    active: true,
    created_at: now.toISOString(),
    created_by: context.actor,
    created_by_user_id: context.user_id,
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
  record.updated_by_user_id = context.user_id;
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
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: "all",
    action: previous ? "Save supplier" : "Add supplier",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    at: now.toISOString(),
    reversible:
      !balances.some((row) => row.amount.trim()) &&
      record.status === "confirmed",
    entity_type: "supplier",
    entity_id: record.id,
    before,
    after: structuredClone(record),
  });
  syncSupplierProfileNotifications(state, now);
  return record;
}
export function deactivateSupplier(
  state: DemoState,
  context: AuthenticatedActor,
  id: string,
  now = new Date(),
): void {
  context = guard(state, context);
  hydrateSuppliers(state);
  const record = state.suppliers!.find(
    (item) => item.company_id === context.company_id && item.id === id,
  );
  if (!record) throw new SupplierEditError("not_found");
  if (!record.active) return;
  const before = structuredClone(record);
  record.active = false;
  record.updated_by_user_id = context.user_id;
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: "all",
    action: "Deactivate supplier",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
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
  context: AuthenticatedActor,
  id: string,
  now = new Date(),
): void {
  context = guard(state, context, false, "suppliers.confirm");
  hydrateSuppliers(state);
  const record = state.suppliers!.find(
    (item) => item.company_id === context.company_id && item.id === id,
  );
  if (!record) throw new SupplierEditError("not_found");
  if (!record.active) throw new Error("Supplier is inactive");
  if (
    record.invoice_review_required &&
    missingInvoiceSupplierDetails(record).length
  )
    throw new Error("Complete supplier details before confirming.");
  if (record.status === "confirmed") return;
  record.status = "confirmed";
  record.confirmed_by_user_id = context.user_id;
  record.updated_by_user_id = context.user_id;
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
    ) {
      invoice.supplier_confirmed = true;
      if (invoice.status !== "posted" && invoice.supplier_review_required)
        invoice.supplier_review_confirmed = true;
    }
  state.activity.push({
    id: createId("supplier-activity"),
    company_id: context.company_id,
    branch: "all",
    action: "Confirm supplier",
    by: context.actor,
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    at: now.toISOString(),
    reversible: false,
    entity_type: "supplier",
    entity_id: record.id,
  });
}

/** Supplier confirmation has its own snapshot; it never enters price approval. */
export function supplierApprovalSnapshot(
  state: DemoState,
  context: AuthenticatedActor,
  approvalId: string,
): string {
  context = guard(state, context, false, "suppliers.confirm");
  const approval = state.approvals.find(
    (item) =>
      item.id === approvalId &&
      item.company_id === context.company_id &&
      item.type === "new_supplier",
  );
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === context.company_id &&
      item.id === approval?.supplier_id,
  );
  if (!approval || !supplier) throw new SupplierEditError("not_found");
  return businessFingerprint({ approval, supplier });
}

export function resolveSupplierApproval(
  state: DemoState,
  context: AuthenticatedActor,
  approvalId: string,
  decision: "approve" | "reject",
  expectedSnapshot?: string,
  now = new Date(),
): void {
  context = guard(state, context, false, "suppliers.confirm");
  const approval = state.approvals.find(
    (item) =>
      item.company_id === context.company_id &&
      item.id === approvalId &&
      item.type === "new_supplier" &&
      item.status === "pending",
  );
  if (!approval || !approval.supplier_id)
    throw new Error("Supplier approval is no longer pending");
  const currentSupplier = supplierRecords(state).find(
    (item) =>
      item.company_id === context.company_id &&
      item.id === approval.supplier_id,
  );
  if (!currentSupplier) throw new SupplierEditError("not_found");
  if (
    expectedSnapshot !== undefined &&
    expectedSnapshot !== supplierApprovalSnapshot(state, context, approvalId)
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
  supplier.updated_by_user_id = context.user_id;
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
    actor_user_id: context.user_id,
    actor_username: context.username,
    actor_role_snapshot: context.role,
    at: now.toISOString(),
    reversible: false,
    entity_type: "supplier",
    entity_id: supplier.id,
    before,
    after: structuredClone(supplier),
  });
}
