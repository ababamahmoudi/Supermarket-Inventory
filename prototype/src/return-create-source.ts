import { weightQuantityPerLb, weightConversionFactor } from "./weighed";
import Decimal from "decimal.js";
import { freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { can, requireCapability, requireConcreteLocation } from "./permissions";
import { invoiceRecords } from "./invoice-records";
import { effectiveInvoiceVersion } from "./invoice-version";
import { effectiveInvoiceLocation } from "./received";
import { supplierRecords, supplierMatches } from "./supplier-editor";
import { businessFingerprint } from "./business-fingerprint";
import type { DemoInvoice, DemoState, Product, SupplierRecord } from "./types";

const ReturnQuantity = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
});

export class ReturnCreateError extends Error {
  constructor(
    public readonly code:
      | "permission"
      | "module"
      | "location"
      | "supplier"
      | "product"
      | "source"
      | "source_cost"
      | "source_ambiguous"
      | "source_currency"
      | "quantity"
      | "unit"
      | "reason"
      | "note"
      | "photos"
      | "request"
      | "changed",
  ) {
    super(code);
    this.name = "ReturnCreateError";
  }
}
export interface ReturnCreateSourceInput {
  request_id: string;
  branch: string;
  supplier_id: string;
  product_code: string;
  source_fingerprint: string;
}
export type ReturnQuantityUnit = "units" | "cases" | "lb" | "kg";
export interface ReturnCreateProductChoice {
  product_code: string;
  supplier_id: string;
  name_en: string;
  name_fa: string;
  unit_size: string;
  barcode: string;
  quantity_unit: "units" | "lb";
  received_unit: ReturnQuantityUnit;
  unit_multipliers: Partial<Record<ReturnQuantityUnit, string>>;
  last_received_at: string;
  source_fingerprint: string;
  issue?: "source_cost" | "source_ambiguous" | "source_currency";
  unit_cost?: string;
  currency?: string;
}
export interface ReturnCreateChoices {
  branch: string;
  suppliers: { id: string; name: string }[];
  products: ReturnCreateProductChoice[];
}
export function returnCreateScope(
  company: string,
  branch: string,
  mutation = false,
) {
  return {
    company_id: company,
    kind: "location_record" as const,
    location_ids: branch && branch !== "all" ? [branch] : [],
    mutation,
  };
}
export function requireReturnCreation(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
) {
  actor = freshActor(state, actor);
  if (state.config.modules.returns === false)
    throw new ReturnCreateError("module");
  if (!branch || branch === "all") throw new ReturnCreateError("location");
  requireCapability(
    state,
    actor,
    "returns.create",
    returnCreateScope(state.config.company.seed_key, branch, true),
  );
  requireConcreteLocation(state, actor, branch);
  // A concrete selection stays the context; aggregate may explicitly choose a branch.
  if (actor.branch !== "all" && actor.branch !== branch)
    throw new ReturnCreateError("location");
  return actor;
}
interface ReceiptSource {
  supplier: SupplierRecord;
  product: Product;
  invoice_id: string;
  line_index: number;
  received_at: string;
  cost: string | null;
  currency: string | null;
  fingerprint: string;
  quantity_unit: "units" | "lb";
  received_unit: ReturnQuantityUnit;
  unit_multipliers: Partial<Record<ReturnQuantityUnit, string>>;
}
function validCost(value: unknown): string | null {
  try {
    if (typeof value !== "string" || !/^\d+(?:\.\d{1,4})?$/.test(value))
      return null;
    const cost = new Decimal(value);
    return cost.isFinite() && cost.gte(0) ? cost.toFixed(4) : null;
  } catch {
    return null;
  }
}
/** Historical receipt value needs historical currency evidence, never today's setting. */
function receiptCurrency(
  state: DemoState,
  original: DemoInvoice,
  effective: DemoInvoice,
) {
  const postings = state.ledger
    .filter(
      (entry) =>
        entry.company_id === original.company_id &&
        entry.invoice_id === original.id &&
        entry.type === "invoice",
    )
    .map((entry) => ({ id: entry.id, currency: entry.currency }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const imports = [original.import_currency, effective.import_currency].filter(
    (value) => value !== undefined,
  );
  const values = [...imports, ...postings.map((entry) => entry.currency)];
  const currencies = new Set(values);
  return {
    currency:
      values.length > 0 &&
      values.every(
        (value) => typeof value === "string" && /^[A-Z]{3}$/.test(value),
      ) &&
      currencies.size === 1
        ? values[0]!
        : null,
    witness: { imports, postings },
  };
}
function receiptSources(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
): ReceiptSource[] {
  const suppliers = supplierRecords(state).filter(
    (supplier) => supplier.company_id === actor.company_id && supplier.active,
  );
  return invoiceRecords(state, actor.company_id)
    .filter(
      (original) =>
        original.status === "posted" &&
        effectiveInvoiceLocation(state, original) === branch,
    )
    .flatMap((original) => {
      const invoice = effectiveInvoiceVersion(state, original);
      const currency = receiptCurrency(state, original, invoice);
      const supplier = suppliers.find((item) =>
        supplierMatches(item, invoice.supplier),
      );
      if (!supplier) return [];
      return invoice.lines.flatMap((line, index): ReceiptSource[] => {
        const product = state.products.find(
          (product) =>
            product.company_id === actor.company_id &&
            product.code === line.product_code &&
            product.status !== "archived",
        );
        if (!product || line.company_id !== actor.company_id) return [];
        try {
          if (
            new Decimal(line.qty_received_at_posting)
              .minus(line.refused_units ?? 0)
              .plus(line.qty_later_received ?? 0)
              .lte(0)
          )
            return [];
        } catch {
          return [];
        }
        const later = (state.stock_movements ?? [])
          .filter(
            (movement) =>
              movement.company_id === actor.company_id &&
              movement.invoice_id === original.id &&
              movement.line_index === index &&
              movement.product_code === product.code &&
              movement.type === "short_resolved_received" &&
              new Decimal(movement.qty).gt(0) &&
              (original.short_receipt_keys ?? []).some(
                (key) => movement.id === `${original.id}:delivery:${key}:stock`,
              ) &&
              Number.isFinite(Date.parse(movement.at)),
          )
          .sort(
            (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
          )[0];
        const received_at =
          later?.at ?? invoice.received_at ?? original.posted_at ?? "";
        if (!Number.isFinite(Date.parse(received_at))) return [];
        const cost = validCost(line.unit_cost_before_tax);
        const quantity_unit = line.sold_by === "weight" ? "lb" : "units";
        const unit_multipliers: Partial<Record<ReturnQuantityUnit, string>> =
          quantity_unit === "lb"
            ? { lb: "1", kg: weightConversionFactor(state.config) }
            : { units: "1" };
        const pack =
          Number.isSafeInteger(line.units_per_case) &&
          (line.units_per_case ?? 0) > 0
            ? line.units_per_case!
            : null;
        if (quantity_unit === "units" && pack)
          unit_multipliers.cases = String(pack);
        if (
          quantity_unit === "lb" &&
          line.case_weight &&
          line.case_weight_unit
        ) {
          try {
            const weight = new ReturnQuantity(
              weightQuantityPerLb(
                line.case_weight,
                line.case_weight_unit,
                state.config,
              ),
            );
            if (weight.gt(0)) {
              unit_multipliers.cases = weight.toString();
              if (pack) unit_multipliers.units = weight.div(pack).toString();
            }
          } catch {
            /* Unusable retained pack evidence never creates a unit choice. */
          }
        }
        const printedUnit = line.quantity_unit ?? quantity_unit;
        const received_unit: ReturnQuantityUnit = unit_multipliers[printedUnit]
          ? printedUnit
          : quantity_unit;
        return [
          {
            supplier,
            product,
            invoice_id: original.id,
            line_index: index,
            received_at,
            cost,
            currency: currency.currency,
            quantity_unit,
            received_unit,
            unit_multipliers,
            fingerprint: businessFingerprint({
              branch,
              supplier: {
                id: supplier.id,
                name: supplier.name,
                previous_names: supplier.previous_names,
                active: supplier.active,
              },
              product: {
                code: product.code,
                name_en: product.name_en,
                name_fa: product.name_fa,
                status: product.status,
                sold_by: product.sold_by,
              },
              invoice_id: original.id,
              line_index: index,
              line,
              received_unit,
              unit_multipliers,
              received_at,
              currency: currency.currency,
              currency_evidence: currency.witness,
            }),
          },
        ];
      });
    });
}
function latestSources(
  sources: ReceiptSource[],
): { source: ReceiptSource; issue?: "source_cost" | "source_ambiguous" }[] {
  const groups = new Map<string, ReceiptSource[]>();
  for (const source of sources) {
    const key = JSON.stringify([source.supplier.id, source.product.code]);
    groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  return [...groups.values()].map((records) => {
    records.sort(
      (a, b) =>
        Date.parse(b.received_at) - Date.parse(a.received_at) ||
        a.invoice_id.localeCompare(b.invoice_id) ||
        a.line_index - b.line_index,
    );
    const latest = records.filter(
      (record) =>
        Date.parse(record.received_at) === Date.parse(records[0].received_at),
    );
    const costSet = new Set(
      latest.map(
        (record) =>
          `${record.quantity_unit}:${record.currency}:${record.cost}:${JSON.stringify(record.unit_multipliers)}`,
      ),
    );
    const source = records[0];
    // Include every tied source in the opaque version, so a later source change invalidates choices.
    source.fingerprint = businessFingerprint(
      latest.map((record) => record.fingerprint),
    );
    return {
      source,
      ...(costSet.size > 1
        ? { issue: "source_ambiguous" as const }
        : source.cost === null
          ? { issue: "source_cost" as const }
          : {}),
    };
  });
}
export function returnCreateChoices(
  state: DemoState,
  actor: AuthenticatedActor,
  branch: string,
): ReturnCreateChoices {
  actor = requireReturnCreation(state, actor, branch);
  const available = latestSources(receiptSources(state, actor, branch)).map(
    (choice) => ({
      ...choice,
      issue:
        choice.issue ??
        (choice.source.currency !== state.config.company.currency
          ? ("source_currency" as const)
          : undefined),
    }),
  );
  const showCost = can(
    state,
    actor,
    "supplier_items.cost_read",
    returnCreateScope(actor.company_id, branch),
  ).allowed;
  return {
    branch,
    suppliers: [
      ...new Map(
        available.map(({ source }) => [
          source.supplier.id,
          { id: source.supplier.id, name: source.supplier.name },
        ]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    products: available
      .map(({ source, issue }) => ({
        supplier_id: source.supplier.id,
        product_code: source.product.code,
        name_en: source.product.name_en,
        name_fa: source.product.name_fa,
        unit_size: source.product.unit_size,
        barcode: source.product.barcode,
        quantity_unit: source.quantity_unit,
        received_unit: source.received_unit,
        unit_multipliers: source.unit_multipliers,
        last_received_at: source.received_at,
        source_fingerprint: source.fingerprint,
        ...(issue ? { issue } : {}),
        ...(showCost && source.cost !== null && source.currency
          ? { unit_cost: source.cost, currency: source.currency }
          : {}),
      }))
      .sort((a, b) => a.name_en.localeCompare(b.name_en)),
  };
}
export function resolveReturnCreateSource(
  state: DemoState,
  actor: AuthenticatedActor,
  input: ReturnCreateSourceInput,
) {
  actor = requireReturnCreation(state, actor, input.branch);
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(input.request_id))
    throw new ReturnCreateError("request");
  if (
    !supplierRecords(state).some(
      (supplier) =>
        supplier.company_id === actor.company_id &&
        supplier.id === input.supplier_id &&
        supplier.active,
    )
  )
    throw new ReturnCreateError("supplier");
  const choice = latestSources(receiptSources(state, actor, input.branch)).find(
    ({ source }) =>
      source.supplier.id === input.supplier_id &&
      source.product.code === input.product_code,
  );
  if (!choice) throw new ReturnCreateError("product");
  if (choice.issue) throw new ReturnCreateError(choice.issue);
  if (choice.source.currency !== state.config.company.currency)
    throw new ReturnCreateError("source_currency");
  if (choice.source.fingerprint !== input.source_fingerprint)
    throw new ReturnCreateError("changed");
  return { actor, source: choice.source };
}
