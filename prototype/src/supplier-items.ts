import Decimal from "decimal.js";
import { createId } from "./ids";
import { configuredBranches } from "./settings";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import { effectiveInvoiceLocation, receivedLog } from "./received";
import { effectiveInvoiceVersion } from "./invoice-version";
import { weightQuantityPerLb, weightQuantityFromLb } from "./weighed";
import type { OperationsContext } from "./operations";
import type { Branch, DemoState, DemoInvoice } from "./types";

/** Editable supplier metadata. Purchases remain immutable invoice evidence. */
export interface SupplierItemDefinition {
  id: string;
  company_id: string;
  supplier_id: string;
  supplier_name: string;
  product_code: string;
  supplier_item_code: string;
  units_per_case: number;
  case_weight?: string;
  case_weight_unit?: "kg" | "lb";
  weight_conversion_factor?: string;
  source_keys?: { product_code: string; supplier_item_code: string }[];
  quoted_unit_cost_before_tax?: string;
  quoted_by?: string;
  quoted_at?: string;
  archived?: boolean;
  created_at: string;
  created_by: string;
  updated_at?: string;
  updated_by?: string;
}

export interface SupplierItemPurchase {
  id: string;
  invoice_id: string;
  invoice_number: string;
  line_index: number;
  supplier: string;
  product_code: string;
  supplier_item_code: string;
  original_branch: Branch;
  branch: Branch;
  date: string;
  at: string;
  by: string;
  units_per_case: number;
  received_units: number;
  unit_cost_before_tax: string;
  case_cost_before_tax: string;
  short_dated: boolean;
  case_weight?: string;
  case_weight_unit?: "kg" | "lb";
  weight_conversion_factor?: string;
}

/** Internal purchasing facts; presentation must use the role-redacted selector. */
export interface SupplierItemFact {
  id: string;
  company_id: string;
  supplier_id: string;
  supplier_name: string;
  product_code: string;
  supplier_item_code: string;
  name_en: string;
  name_fa: string;
  unit_size: string;
  units_per_case: number;
  last_bought_unit_cost: string | null;
  last_bought_case_cost: string | null;
  last_bought_units_per_case: number | null;
  regular_unit_cost: string | null;
  last_bought_date: string | null;
  last_invoice_id: string | null;
  last_invoice_number: string | null;
  quoted_unit_cost_before_tax?: string;
  quoted_by?: string;
  quoted_at?: string;
  history: SupplierItemPurchase[];
  case_weight?: string;
  case_weight_unit?: "kg" | "lb";
  weight_conversion_factor?: string;
}

export interface SupplierItemRow {
  id: string;
  product_code: string;
  supplier_item_code: string;
  name_en: string;
  name_fa: string;
  unit_size: string;
  units_per_case: number;
  last_bought_date: string | null;
  last_invoice_id: string | null;
  last_invoice_number: string | null;
  financial?: Pick<
    SupplierItemFact,
    | "last_bought_unit_cost"
    | "last_bought_case_cost"
    | "last_bought_units_per_case"
    | "regular_unit_cost"
    | "quoted_unit_cost_before_tax"
    | "quoted_by"
    | "quoted_at"
    | "history"
  >;
}

export class SupplierItemError extends Error {
  constructor(
    public readonly code:
      | "permission"
      | "scope"
      | "supplier"
      | "product"
      | "pack"
      | "quantity"
      | "cost"
      | "duplicate"
      | "not_found",
  ) {
    super(code);
  }
}

function validPack(pack: number): number {
  if (!Number.isSafeInteger(pack) || pack <= 0)
    throw new SupplierItemError("pack");
  return pack;
}

/** Fractional cases are accepted only when their exact converted units are whole. */
export function packUnits(
  quantity: number | string,
  unit: "cases" | "units",
  pack: number,
): number {
  validPack(pack);
  try {
    const entered = new Decimal(quantity);
    const units = unit === "cases" ? entered.times(pack) : entered;
    if (
      !entered.isFinite() ||
      entered.lte(0) ||
      !units.isInteger() ||
      units.gt(Number.MAX_SAFE_INTEGER)
    )
      throw new SupplierItemError("quantity");
    return units.toNumber();
  } catch (cause) {
    if (cause instanceof SupplierItemError) throw cause;
    throw new SupplierItemError("quantity");
  }
}

function cost(value: string): Decimal {
  if (!/^\d+(\.\d{1,4})?$/.test(value)) throw new SupplierItemError("cost");
  const amount = new Decimal(value);
  if (!amount.isFinite()) throw new SupplierItemError("cost");
  return amount;
}

export function costPerCase(unitCost: string, pack: number): string {
  return cost(unitCost).times(validPack(pack)).toFixed(4);
}

export function costPerUnit(caseCost: string, pack: number): string {
  return cost(caseCost).div(validPack(pack)).toFixed(4, Decimal.ROUND_HALF_UP);
}

/** Retained source weight/cost preserve case estimates independently of rounded per-lb prices. */
export function invoiceCaseCostBeforeTax(
  line: DemoInvoice["lines"][number],
): string {
  if (
    line.source_quantity_unit &&
    line.case_weight &&
    line.case_weight_unit &&
    line.weight_conversion_factor &&
    line.source_cost_before_tax &&
    line.source_cost_unit
  )
    return new Decimal(line.source_cost_before_tax)
      .times(
        weightQuantityFromLb(
          weightQuantityPerLb(
            line.case_weight,
            line.case_weight_unit,
            line.weight_conversion_factor,
          ),
          line.source_cost_unit,
          line.weight_conversion_factor,
        ),
      )
      .toFixed(4, Decimal.ROUND_HALF_UP);
  return line.case_cost_before_tax !== undefined
    ? cost(line.case_cost_before_tax).toFixed(4)
    : costPerCase(line.unit_cost_before_tax, line.units_per_case ?? 1);
}

const sourceKey = (product: string, code: string) =>
  JSON.stringify([product, code]);

function scope(state: DemoState, company: string, branch: Branch): void {
  if (
    company !== state.config.company.seed_key ||
    (branch !== "all" &&
      !configuredBranches(state.config, true).includes(branch))
  )
    throw new SupplierItemError("scope");
}

/** Branch scopes purchase evidence; company item associations remain usable at new locations. */
export function supplierItemFacts(
  state: DemoState,
  company: string,
  supplierName: string,
  branch: Branch,
): SupplierItemFact[] {
  scope(state, company, branch);
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === company && supplierMatches(record, supplierName),
  );
  const supplierId = supplier?.id ?? `name:${supplierName}`;
  const matches = (name: string) =>
    supplier ? supplierMatches(supplier, name) : name === supplierName;
  const definitions = (state.supplier_items ?? []).filter(
    (record) =>
      record.company_id === company &&
      (supplier
        ? record.supplier_id === supplierId
        : matches(record.supplier_name)),
  );
  const receipts = receivedLog(state, {
    company_id: company,
    branch: "all",
    role: "supervisor",
    actor: "",
  }).filter((receipt) => receipt.kind !== "replacement");
  const invoices = new Map(
    [...(state.invoices ?? []), state.invoice]
      .filter(
        (invoice) =>
          invoice.company_id === company &&
          invoice.status === "posted" &&
          matches(invoice.supplier),
      )
      .map((invoice) => [invoice.id, invoice]),
  );
  const facts = new Map<string, SupplierItemFact>();
  const factFor = (
    id: string,
    productCode: string,
    itemCode: string,
    pack: number,
    description = "",
  ): SupplierItemFact => {
    const found = facts.get(id);
    if (found) return found;
    const definition = definitions.find(
      (record) => record.id === id && !record.archived,
    );
    const product = state.products.find(
      (record) =>
        record.company_id === company &&
        record.code === (definition?.product_code ?? productCode),
    );
    const fact: SupplierItemFact = {
      id,
      company_id: company,
      supplier_id: supplierId,
      supplier_name: supplier?.name ?? supplierName,
      product_code: definition?.product_code ?? productCode,
      supplier_item_code: definition?.supplier_item_code ?? itemCode,
      name_en: product?.name_en ?? description,
      name_fa: product?.name_fa ?? "",
      unit_size: product?.unit_size ?? "",
      units_per_case: definition?.units_per_case ?? pack,
      last_bought_unit_cost: null,
      last_bought_case_cost: null,
      last_bought_units_per_case: null,
      regular_unit_cost: null,
      last_bought_date: null,
      last_invoice_id: null,
      last_invoice_number: null,
      ...(definition?.quoted_unit_cost_before_tax !== undefined
        ? {
            quoted_unit_cost_before_tax: definition.quoted_unit_cost_before_tax,
            quoted_by: definition.quoted_by,
            quoted_at: definition.quoted_at,
          }
        : {}),
      history: [],
      ...(definition?.case_weight
        ? {
            case_weight: definition.case_weight,
            case_weight_unit: definition.case_weight_unit,
            weight_conversion_factor: definition.weight_conversion_factor,
          }
        : {}),
    };
    facts.set(id, fact);
    return fact;
  };
  for (const definition of definitions.filter((record) => !record.archived))
    factFor(
      definition.id,
      definition.product_code,
      definition.supplier_item_code,
      definition.units_per_case,
    );
  for (const original of invoices.values()) {
    const invoice = effectiveInvoiceVersion(state, original);
    invoice.lines.forEach((line, index) => {
      const accepted = Decimal.max(
        0,
        new Decimal(line.qty_received_at_posting).minus(
          line.refused_units ?? 0,
        ),
      )
        .plus(line.qty_later_received ?? 0)
        .toNumber();
      if (line.company_id !== company || accepted <= 0) return;
      const itemCode = line.supplier_item_code?.trim() ?? "";
      const key = sourceKey(line.product_code, itemCode);
      const definition =
        definitions.find((record) => record.id === line.supplier_item_id) ??
        definitions.find((record) =>
          [record, ...(record.source_keys ?? [])].some(
            (binding) =>
              sourceKey(binding.product_code, binding.supplier_item_code) ===
              key,
          ),
        );
      const id =
        definition?.id ??
        line.supplier_item_id ??
        `supplier-item:${encodeURIComponent(company)}:${encodeURIComponent(supplierId)}:${encodeURIComponent(key)}`;
      const pack =
        Number.isSafeInteger(line.units_per_case) &&
        (line.units_per_case ?? 0) > 0
          ? line.units_per_case!
          : 1;
      const matchingReceipts = receipts
        .filter(
          (receipt) =>
            receipt.invoice_id === invoice.id && receipt.line_index === index,
        )
        .sort((a, b) =>
          (b.received_at ?? b.date).localeCompare(a.received_at ?? a.date),
        );
      const latest = matchingReceipts[0];
      const at =
        latest?.received_at ??
        original.posted_at ??
        original.received_at ??
        original.invoice_date ??
        "";
      const date =
        latest?.date ??
        (
          original.received_at ??
          original.posted_at ??
          original.invoice_date ??
          ""
        ).slice(0, 10);
      const fact = factFor(
        id,
        line.product_code,
        itemCode,
        pack,
        line.description,
      );
      fact.history.push({
        id: `${invoice.id}:supplier-item:${index}`,
        invoice_id: invoice.id,
        invoice_number: invoice.supplier_invoice_number,
        line_index: index,
        supplier: invoice.supplier,
        product_code: line.product_code,
        supplier_item_code: itemCode,
        original_branch: invoice.branch,
        branch: effectiveInvoiceLocation(state, invoice),
        date,
        at,
        by: latest?.received_by ?? invoice.receiving_employee ?? "",
        units_per_case: pack,
        received_units: accepted,
        unit_cost_before_tax: cost(line.unit_cost_before_tax).toFixed(4),
        case_cost_before_tax: invoiceCaseCostBeforeTax(line),
        short_dated: line.short_dated === true,
        ...(line.case_weight
          ? {
              case_weight: line.case_weight,
              case_weight_unit: line.case_weight_unit,
              weight_conversion_factor: line.weight_conversion_factor,
            }
          : {}),
      });
    });
  }
  return [...facts.values()]
    .map((fact) => {
      fact.history.sort(
        (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
      );
      if (
        !definitions.some((record) => record.id === fact.id && !record.archived)
      )
        fact.units_per_case =
          fact.history[0]?.units_per_case ?? fact.units_per_case;
      fact.history = fact.history.filter(
        (purchase) => branch === "all" || purchase.branch === branch,
      );
      const last = fact.history[0];
      const definition = definitions.find((record) => record.id === fact.id);
      if (!definition?.case_weight && last?.case_weight) {
        fact.case_weight = last.case_weight;
        fact.case_weight_unit = last.case_weight_unit;
        fact.weight_conversion_factor = last.weight_conversion_factor;
      }
      fact.last_bought_unit_cost = last?.unit_cost_before_tax ?? null;
      fact.last_bought_case_cost = last?.case_cost_before_tax ?? null;
      fact.last_bought_units_per_case = last?.units_per_case ?? null;
      fact.regular_unit_cost =
        fact.history.find((purchase) => !purchase.short_dated)
          ?.unit_cost_before_tax ?? null;
      fact.last_bought_date = last?.date || null;
      fact.last_invoice_id = last?.invoice_id ?? null;
      fact.last_invoice_number = last?.invoice_number ?? null;
      return fact;
    })
    .sort(
      (a, b) =>
        a.name_en.localeCompare(b.name_en) ||
        a.supplier_item_code.localeCompare(b.supplier_item_code),
    );
}

export function resolveSupplierItem(
  state: DemoState,
  company: string,
  supplier: string,
  branch: Branch,
  selector: { id?: string; product_code?: string; supplier_item_code?: string },
): SupplierItemFact | null {
  scope(state, company, branch);
  if (
    selector.id === undefined &&
    selector.product_code === undefined &&
    selector.supplier_item_code === undefined
  )
    return null;
  const candidates = supplierItemFacts(state, company, supplier, branch).filter(
    (fact) =>
      selector.id !== undefined
        ? fact.id === selector.id
        : (selector.product_code === undefined ||
            fact.product_code === selector.product_code) &&
          (selector.supplier_item_code === undefined ||
            fact.supplier_item_code === selector.supplier_item_code.trim()),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function supplierItems(
  state: DemoState,
  context: OperationsContext,
  supplier: string,
): SupplierItemRow[] {
  scope(state, context.company_id, context.branch);
  if (context.role === "cashier") throw new SupplierItemError("permission");
  if (context.role !== "supervisor" && context.branch === "all")
    throw new SupplierItemError("scope");
  return supplierItemFacts(
    state,
    context.company_id,
    supplier,
    context.branch,
  ).map(
    ({
      id,
      product_code,
      supplier_item_code,
      name_en,
      name_fa,
      unit_size,
      units_per_case,
      last_bought_date,
      last_invoice_id,
      last_invoice_number,
      last_bought_unit_cost,
      last_bought_case_cost,
      last_bought_units_per_case,
      regular_unit_cost,
      quoted_unit_cost_before_tax,
      quoted_by,
      quoted_at,
      history,
    }) => ({
      id,
      product_code,
      supplier_item_code,
      name_en,
      name_fa,
      unit_size,
      units_per_case,
      last_bought_date,
      last_invoice_id,
      last_invoice_number,
      ...(context.role === "supervisor"
        ? {
            financial: {
              last_bought_unit_cost,
              last_bought_case_cost,
              last_bought_units_per_case,
              regular_unit_cost,
              quoted_unit_cost_before_tax,
              quoted_by,
              quoted_at,
              history,
            },
          }
        : {}),
    }),
  );
}

export interface SupplierItemEdits {
  product_code: string;
  supplier_item_code: string;
  units_per_case: number;
  quoted_unit_cost_before_tax?: string;
}

export function saveSupplierItem(
  state: DemoState,
  context: OperationsContext,
  supplierName: string,
  edits: SupplierItemEdits,
  id?: string,
  now = new Date(),
): SupplierItemDefinition {
  scope(state, context.company_id, context.branch);
  if (context.role !== "supervisor") throw new SupplierItemError("permission");
  const supplier = supplierRecords(state).find(
    (record) =>
      record.company_id === context.company_id &&
      supplierMatches(record, supplierName),
  );
  if (!supplier?.active || supplier.status !== "confirmed")
    throw new SupplierItemError("supplier");
  if (
    !state.products.some(
      (product) =>
        product.company_id === context.company_id &&
        product.code === edits.product_code &&
        product.status !== "archived",
    )
  )
    throw new SupplierItemError("product");
  validPack(edits.units_per_case);
  const quote = edits.quoted_unit_cost_before_tax?.trim();
  if (quote) cost(quote);
  const facts = supplierItemFacts(
    state,
    context.company_id,
    supplierName,
    "all",
  );
  const current = id ? facts.find((record) => record.id === id) : undefined;
  if (id && !current) throw new SupplierItemError("not_found");
  const code = edits.supplier_item_code.trim();
  if (
    facts.some(
      (record) =>
        record.id !== id &&
        record.product_code === edits.product_code &&
        record.supplier_item_code === code,
    )
  )
    throw new SupplierItemError("duplicate");
  const previous = state.supplier_items?.find(
    (record) => record.id === id && record.company_id === context.company_id,
  );
  const before = previous ? structuredClone(previous) : null;
  const record: SupplierItemDefinition = previous ?? {
    id: id ?? createId("supplier-item"),
    company_id: context.company_id,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    product_code: current?.product_code ?? edits.product_code,
    supplier_item_code: current?.supplier_item_code ?? code,
    units_per_case: edits.units_per_case,
    created_at: now.toISOString(),
    created_by: context.actor,
  };
  if (
    record.product_code !== edits.product_code ||
    record.supplier_item_code !== code
  ) {
    const keys = [
      ...(record.source_keys ?? []),
      {
        product_code: record.product_code,
        supplier_item_code: record.supplier_item_code,
      },
    ];
    record.source_keys = keys.filter(
      (binding, index) =>
        keys.findIndex(
          (item) =>
            sourceKey(item.product_code, item.supplier_item_code) ===
            sourceKey(binding.product_code, binding.supplier_item_code),
        ) === index,
    );
  }
  record.product_code = edits.product_code;
  record.supplier_item_code = code;
  record.units_per_case = edits.units_per_case;
  record.archived = false;
  record.updated_at = now.toISOString();
  record.updated_by = context.actor;
  if (quote !== undefined) {
    if (quote) {
      if (record.quoted_unit_cost_before_tax !== cost(quote).toFixed(4)) {
        record.quoted_unit_cost_before_tax = cost(quote).toFixed(4);
        record.quoted_by = context.actor;
        record.quoted_at = now.toISOString();
      }
    } else {
      delete record.quoted_unit_cost_before_tax;
      delete record.quoted_by;
      delete record.quoted_at;
    }
  }
  state.supplier_items ??= [];
  if (!previous) state.supplier_items.push(record);
  state.activity.push({
    id: createId("supplier-item-activity"),
    company_id: context.company_id,
    branch: "all",
    action: id ? "Save supplier item" : "Add supplier item",
    by: context.actor,
    at: now.toISOString(),
    reversible: true,
    entity_type: "supplier_item",
    entity_id: record.id,
    before,
    after: structuredClone(record),
  });
  return record;
}

/** A received temporary order item becomes supplier metadata only at posting. */
export function associatePostedSupplierItem(
  state: DemoState,
  context: OperationsContext,
  invoice: DemoInvoice,
  lineIndex: number,
): SupplierItemDefinition {
  scope(state, context.company_id, context.branch);
  const line = invoice.lines[lineIndex];
  if (context.role === "cashier") throw new SupplierItemError("permission");
  if (
    invoice.company_id !== context.company_id ||
    invoice.status !== "posted" ||
    !line ||
    line.company_id !== context.company_id ||
    (context.role !== "supervisor" &&
      context.branch !== (invoice.handling_branch ?? invoice.branch))
  )
    throw new SupplierItemError("scope");
  if (
    new Decimal(line.qty_received_at_posting)
      .minus(line.refused_units ?? 0)
      .lte(0)
  )
    throw new SupplierItemError("quantity");
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === context.company_id &&
      supplierMatches(item, invoice.supplier),
  );
  if (!supplier?.active || supplier.status !== "confirmed")
    throw new SupplierItemError("supplier");
  if (
    !state.products.some(
      (product) =>
        product.company_id === context.company_id &&
        product.code === line.product_code &&
        product.status !== "archived",
    )
  )
    throw new SupplierItemError("product");
  const pack = validPack(line.units_per_case ?? 1);
  const code = line.supplier_item_code?.trim() ?? "";
  const facts = supplierItemFacts(
    state,
    context.company_id,
    invoice.supplier,
    "all",
  );
  const fact = facts.find(
    (item) =>
      item.product_code === line.product_code &&
      item.supplier_item_code === code,
  );
  const prior = state.supplier_items?.find(
    (item) =>
      item.company_id === context.company_id &&
      item.supplier_id === supplier.id &&
      (item.id === line.supplier_item_id ||
        (item.product_code === line.product_code &&
          item.supplier_item_code === code)),
  );
  if (prior) {
    if (
      prior.archived ||
      prior.product_code !== line.product_code ||
      prior.supplier_item_code !== code
    )
      throw new SupplierItemError("duplicate");
    return prior;
  }
  if (
    line.supplier_item_id &&
    state.supplier_items?.some(
      (item) =>
        item.id === line.supplier_item_id &&
        (item.company_id !== context.company_id ||
          item.supplier_id !== supplier.id),
    )
  )
    throw new SupplierItemError("scope");
  const record: SupplierItemDefinition = {
    id: fact?.id ?? line.supplier_item_id ?? createId("supplier-item"),
    company_id: context.company_id,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    product_code: line.product_code,
    supplier_item_code: code,
    units_per_case: pack,
    created_at: invoice.posted_at ?? new Date().toISOString(),
    created_by: context.actor,
  };
  state.supplier_items ??= [];
  state.supplier_items.push(record);
  state.activity.push({
    id: `${invoice.id}:order-supplier-item:${lineIndex}`,
    company_id: context.company_id,
    branch: effectiveInvoiceLocation(state, invoice),
    action: "Associate ordered new item",
    by: context.actor,
    at: record.created_at,
    reversible: false,
    entity_type: "supplier_item",
    entity_id: record.id,
    before: null,
    after: structuredClone(record),
  });
  return record;
}
