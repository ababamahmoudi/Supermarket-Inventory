import { supplierRecords, supplierMatches } from "./supplier-editor";
import { companyDate } from "./invoice";
import { OperationError, type OperationsContext } from "./operations";
import { supplierBalanceSummary } from "./supplier-balances";
import { projectInvoiceLocation } from "./received";
import type {
  Alert,
  Branch,
  DemoInvoice,
  DemoState,
  NoteRecord,
  ReturnRecord,
} from "./types";

export interface SupplierMoney {
  balance: string;
  overdue: string;
  next_due_date?: string;
}
export interface SupplierOverviewRow {
  id?: string;
  active?: boolean;
  previous_names?: string[];
  address?: string;
  notes?: string;
  name: string;
  status: "confirmed" | "proposed";
  phone: string | null;
  email: string | null;
  sales_rep_name: string | null;
  sales_rep_phone: string | null;
  payment_terms: string | null;
  last_delivery?: string;
  deliveries_this_month: number;
  open_returns: number;
  open_shorts: number;
  financial?: SupplierMoney;
}
export interface SupplierInvoiceRow {
  id: string;
  number: string;
  branch: Branch;
  received: string;
  due_date?: string;
  items: number;
  status: DemoInvoice["status"];
  financial?: { total: string; outstanding: string };
}
export interface SuppliedProductRow {
  code: string;
  name_en: string;
  name_fa: string;
  unit_size: string;
  last_delivery?: string;
  financial?: {
    last_cost: string;
    history: { invoice: string; date: string; cost: string }[];
  };
}
export interface SupplierReturnRow {
  id: string;
  number: number;
  branch: Branch;
  status: ReturnRecord["status"];
  items: number;
  created_at?: string;
  financial?: { compensation?: string };
}
export interface SupplierShortRow {
  invoice_id: string;
  invoice: string;
  branch: Branch;
  product_code: string;
  name_en: string;
  name_fa: string;
  quantity: number;
}
export interface SupplierAlertRow {
  id: string;
  branch: Branch;
  product_code: string;
  name_en: string;
  name_fa: string;
  type: Alert["type"];
  status: Alert["status"];
}
export interface SupplierPageData {
  supplier: SupplierOverviewRow;
  invoices: SupplierInvoiceRow[];
  products: SuppliedProductRow[];
  returns: SupplierReturnRow[];
  shorts: SupplierShortRow[];
  alerts: SupplierAlertRow[];
  notes: Pick<
    NoteRecord,
    "id" | "branch" | "text" | "by" | "created_at" | "status"
  >[];
  payments?: {
    id: string;
    branch: Branch;
    date: string;
    reference: string;
    amount: string;
    cheque_number?: string;
  }[];
}

function guard(state: DemoState, context: OperationsContext) {
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
  if (context.role === "cashier") throw new OperationError("supervisor");
  if (context.role !== "supervisor" && context.branch === "all")
    throw new OperationError("scope");
}
function inScope(
  record: { company_id: string; branch: Branch },
  context: OperationsContext,
) {
  return (
    record.company_id === context.company_id &&
    (context.branch === "all" || record.branch === context.branch)
  );
}
function postedInvoices(state: DemoState, context: OperationsContext) {
  const invoices = new Map(
    [...(state.invoices ?? []), state.invoice].map((invoice) => [
      invoice.id,
      invoice,
    ]),
  );
  return [...invoices.values()]
    .map((invoice) => projectInvoiceLocation(state, invoice))
    .filter(
      (invoice) => inScope(invoice, context) && invoice.status === "posted",
    );
}
function receivedDate(invoice: DemoInvoice) {
  return (
    invoice.received_at ??
    invoice.invoice_date ??
    invoice.posted_at ??
    ""
  ).slice(0, 10);
}
function supplierShorts(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
): SupplierShortRow[] {
  return postedInvoices(state, context)
    .filter((invoice) => invoice.supplier === supplier)
    .flatMap((invoice) =>
      invoice.lines
        .filter((line) => line.company_id === context.company_id)
        .flatMap((line) => {
          const quantity = Math.max(
            0,
            line.qty_invoiced -
              (line.qty_received_at_posting ?? line.qty_invoiced) -
              (line.qty_later_received ?? 0),
          );
          if (quantity === 0) return [];
          const product = state.products.find(
            (item) =>
              item.company_id === context.company_id &&
              item.code === line.product_code,
          );
          return [
            {
              invoice_id: invoice.id,
              invoice: invoice.supplier_invoice_number,
              branch: invoice.branch,
              product_code: line.product_code,
              name_en: product?.name_en ?? line.description,
              name_fa: product?.name_fa ?? "",
              quantity,
            },
          ];
        }),
    );
}

/** Role-filtered read models deliberately omit financial values for workers. */
export function suppliersOverview(
  state: DemoState,
  context: OperationsContext,
): SupplierOverviewRow[] {
  guard(state, context);
  const metadata = supplierRecords(state).filter(
    (record) => record.company_id === context.company_id,
  );
  const names = new Set(metadata.map((supplier) => supplier.name));
  const addName = (name: string) =>
    names.add(
      metadata.find((record) => supplierMatches(record, name))?.name ?? name,
    );
  state.products
    .filter((product) => product.company_id === context.company_id)
    .forEach((product) => addName(product.main_supplier));
  postedInvoices(state, context).forEach((invoice) =>
    addName(invoice.supplier),
  );
  state.returns
    .filter((record) => inScope(record, context))
    .forEach((record) => addName(record.supplier));
  const month = companyDate(state.config).slice(0, 7);
  return [...names].map((name) => {
    const details = metadata.find((supplier) => supplier.name === name);
    const matches = (supplier: string) =>
      details ? supplierMatches(details, supplier) : supplier === name;
    const invoices = postedInvoices(state, context).filter((invoice) =>
      matches(invoice.supplier),
    );
    const dates = invoices.map(receivedDate).filter(Boolean).sort();
    return {
      name,
      id: details?.id,
      active: details?.active ?? true,
      previous_names: details?.previous_names,
      address: details?.address,
      notes: details?.notes,
      status: details?.status === "proposed" ? "proposed" : "confirmed",
      phone: details?.phone ?? null,
      email: details?.email ?? null,
      sales_rep_name: details?.sales_rep_name ?? null,
      sales_rep_phone: details?.sales_rep_phone ?? null,
      payment_terms: details?.payment_terms ?? null,
      last_delivery: dates.at(-1),
      deliveries_this_month: dates.filter((date) => date.startsWith(month))
        .length,
      open_returns: state.returns.filter(
        (record) =>
          inScope(record, context) &&
          matches(record.supplier) &&
          record.status !== "resolved" &&
          record.status !== "cancelled",
      ).length,
      open_shorts: supplierShorts(
        canonicalSupplierState(state, name),
        context,
        name,
      ).length,
      ...(context.role === "supervisor"
        ? {
            financial: (() => {
              const summary = supplierBalanceSummary(
                canonicalSupplierState(state, name),
                context,
                name,
              );
              return {
                balance: summary.balance,
                overdue: summary.overdue,
                next_due_date: summary.next_due_date,
              };
            })(),
          }
        : {}),
    };
  });
}

export function supplierPage(
  state: DemoState,
  context: OperationsContext,
  name: string,
): SupplierPageData {
  guard(state, context);
  const matching = supplierRecords(state).find(
    (record) =>
      record.company_id === context.company_id && supplierMatches(record, name),
  );
  name = matching?.name ?? name;
  state = canonicalSupplierState(state, name);
  const supplier = suppliersOverview(state, context).find(
    (item) => item.name === name,
  );
  if (!supplier) throw new OperationError("scope");
  const financial =
    context.role === "supervisor"
      ? supplierBalanceSummary(state, context, name)
      : null;
  const invoices = postedInvoices(state, context)
    .filter((invoice) => invoice.supplier === name)
    .sort((a, b) => receivedDate(b).localeCompare(receivedDate(a)));
  const products = state.products.filter(
    (product) =>
      product.company_id === context.company_id &&
      product.main_supplier === name,
  );
  const codes = new Set(products.map((product) => product.code));
  const result: SupplierPageData = {
    supplier,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.supplier_invoice_number,
      branch: invoice.branch,
      received: receivedDate(invoice),
      due_date: invoice.due_date,
      items: invoice.lines.length,
      status: invoice.status,
      ...(financial
        ? {
            financial: {
              total: invoice.final_total,
              outstanding:
                financial.invoices.find(
                  (item) => item.invoice_id === invoice.id,
                )?.amount ?? "0.00",
            },
          }
        : {}),
    })),
    products: products.map((product) => {
      const receipts = invoices.flatMap((invoice) =>
        invoice.lines
          .filter(
            (line) =>
              line.company_id === context.company_id &&
              line.product_code === product.code,
          )
          .map((line) => ({
            invoice: invoice.supplier_invoice_number,
            date: receivedDate(invoice),
            cost: line.unit_cost_before_tax,
          })),
      );
      return {
        code: product.code,
        name_en: product.name_en,
        name_fa: product.name_fa,
        unit_size: product.unit_size,
        last_delivery: receipts[0]?.date,
        ...(financial
          ? {
              financial: {
                last_cost: receipts[0]?.cost ?? product.last_cost_before_tax,
                history: receipts,
              },
            }
          : {}),
      };
    }),
    returns: state.returns
      .filter((record) => inScope(record, context) && record.supplier === name)
      .map((record) => ({
        id: record.id,
        number: state.returns.indexOf(record) + 1,
        branch: record.branch,
        status: record.status,
        items: record.lines.length,
        created_at:
          "created_at" in record ? (record.created_at as string) : undefined,
        ...(financial
          ? { financial: { compensation: record.compensation_amount } }
          : {}),
      })),
    shorts: supplierShorts(state, context, name),
    alerts: state.alerts
      .filter(
        (alert) =>
          inScope(alert, context) &&
          (alert.supplier === name ||
            (!alert.supplier && codes.has(alert.product_code))),
      )
      .map((alert) => {
        const product = products.find(
          (item) => item.code === alert.product_code,
        );
        return {
          id: alert.id,
          branch: alert.branch,
          product_code: alert.product_code,
          name_en: product?.name_en ?? alert.product_code,
          name_fa: product?.name_fa ?? "",
          type: alert.type,
          status: alert.status,
        };
      }),
    notes: state.notes
      .filter(
        (note) =>
          inScope(note, context) &&
          note.product_code &&
          codes.has(note.product_code),
      )
      .map(({ id, branch, text, by, created_at, status }) => ({
        id,
        branch,
        text,
        by,
        created_at,
        status,
      })),
  };
  if (financial)
    result.payments = state.ledger
      .filter(
        (row) =>
          inScope(row, context) &&
          row.supplier === name &&
          row.type === "payment",
      )
      .map(({ id, branch, date, reference, amount, cheque_number }) => ({
        id,
        branch,
        date,
        reference,
        amount,
        cheque_number,
      }));
  return result;
}

/** Renames preserve original stored invoice/ledger text; read models resolve stable identity. */
function canonicalSupplierState(state: DemoState, name: string): DemoState {
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === state.config.company.seed_key &&
      record.name === name,
  );
  if (!supplier?.previous_names?.length) return state;
  const canonical = <T extends { company_id: string; supplier: string }>(
    record: T,
  ): T =>
    record.company_id === supplier.company_id &&
    supplierMatches(supplier, record.supplier)
      ? { ...record, supplier: name }
      : record;
  return {
    ...state,
    invoice: canonical(state.invoice),
    invoices: state.invoices?.map(canonical),
    returns: state.returns.map(canonical),
    ledger: state.ledger.map(canonical),
    products: state.products.map((product) =>
      product.company_id === supplier.company_id &&
      supplierMatches(supplier, product.main_supplier)
        ? { ...product, main_supplier: name }
        : product,
    ),
    alerts: state.alerts.map((alert) =>
      alert.supplier
        ? canonical({ ...alert, supplier: alert.supplier })
        : alert,
    ),
  };
}
