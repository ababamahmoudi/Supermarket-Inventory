import Decimal from "decimal.js";
import type { AuthenticatedActor } from "./authority-types";
import { canInvoiceAuthority } from "./invoice-authority";
import { invoiceCheckField, visibleInvoiceCheckFields } from "./invoice-checks";
import { effectiveInvoiceVersion } from "./invoice-version";
import { invoicePaperTotalMismatch } from "./invoice-weight";
import {
  validCost,
  validInvoiceLineQuantity,
  validInvoiceLineReceived,
} from "./invoice";
import {
  supplierItemFacts,
  supplierItemFactsForInvoice,
} from "./supplier-items";
import { splitInvoiceProductDescription } from "./invoice-reading-products";
import type {
  Branch,
  DemoState,
  InvoiceKnownDelivery,
  InvoiceLine,
} from "./types";

/** Separate from supplier/invoice identity normalization: these are printed item keys. */
export function normalizedPrintedItem(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(
        Math.max("۰۱۲۳۴۵۶۷۸۹".indexOf(digit), "٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
      ),
    )
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
const money = (value: string) => new Decimal(value).toFixed(4);
const itemName = (line: InvoiceLine) =>
  normalizedPrintedItem(
    splitInvoiceProductDescription({
      description: line.description,
      supplierCode: line.supplier_item_code_inferred
        ? ""
        : (line.supplier_item_code ?? ""),
      unitsPerCase: String(line.units_per_case ?? ""),
      packSize: line.pack_size ?? "",
      unit: line.quantity_unit === "cases" ? "case" : "each",
    }).name || line.description,
  );
const pack = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(
        Math.max("۰۱۲۳۴۵۶۷۸۹".indexOf(digit), "٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
      ),
    )
    .replace(/\d+(?:\.\d+)?/g, (number) => new Decimal(number).toString())
    .replace(/[×*]/g, "x")
    .replace(/\s/g, "");

export function knownDeliveryFingerprint(
  line: Omit<InvoiceLine, "demo_note">,
): string {
  return JSON.stringify([
    line.product_code,
    line.description,
    line.new_name_en,
    line.supplier_item_code,
    line.supplier_item_code_inferred,
    line.barcode,
    line.pricing_category,
    line.units_per_case,
    line.pack_size,
    line.unit_cost_before_tax,
    line.case_cost_before_tax,
    line.quantity_unit,
    line.sold_by,
    line.source_cost_before_tax,
    line.source_cost_unit,
    line.case_weight,
    line.case_weight_unit,
  ]);
}
export function currentKnownDelivery(
  line: Omit<InvoiceLine, "demo_note">,
):
  | (InvoiceKnownDelivery & { source_invoice_id: string; fingerprint: string })
  | undefined {
  const known = line.known_delivery;
  return known?.fingerprint === knownDeliveryFingerprint(line) &&
    typeof known.source_invoice_id === "string"
    ? (known as InvoiceKnownDelivery & {
        source_invoice_id: string;
        fingerprint: string;
      })
    : undefined;
}

/** Only called during an authorized import, after source quantity/cost normalization. */
export function compareKnownDelivery(
  state: DemoState,
  actor: AuthenticatedActor,
  line: InvoiceLine,
  supplier: string,
  context: { invoiceId: string } | { previewBranch: Branch },
): void {
  const matched = line.reading_product_match;
  if (
    line.company_id !== state.config.company.seed_key ||
    !matched ||
    matched.identity_requires_check !== false ||
    !matched.earlier_delivery ||
    matched.basis === "other_supplier_description" ||
    line.product_code === "NEW"
  )
    return;
  const facts =
    "invoiceId" in context
      ? supplierItemFactsForInvoice(state, actor, supplier, context.invoiceId)
      : supplierItemFacts(state, actor, supplier, context.previewBranch);
  const candidates = facts.filter(
    (fact) =>
      fact.product_code === line.product_code &&
      (!line.supplier_item_id || fact.id === line.supplier_item_id),
  );
  let purchases = [
    ...new Map(
      candidates
        .flatMap((fact) => fact.history)
        .filter((purchase) => purchase.product_code === line.product_code)
        .map((purchase) => [purchase.id, purchase]),
    ).values(),
  ].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  if (line.supplier_item_code && !line.supplier_item_code_inferred) {
    const sameCode = purchases.filter(
      (purchase) => purchase.supplier_item_code === line.supplier_item_code,
    );
    if (sameCode.length) purchases = sameCode;
  }
  const latest = purchases[0];
  if (
    !latest ||
    purchases.some(
      (purchase) =>
        purchase.at === latest.at &&
        (purchase.unit_cost_before_tax !== latest.unit_cost_before_tax ||
          purchase.units_per_case !== latest.units_per_case),
    )
  )
    return;
  const original = [state.invoice, ...(state.invoices ?? [])].find(
    (invoice) =>
      invoice.company_id === state.config.company.seed_key &&
      invoice.id === latest.invoice_id,
  );
  if (
    !original ||
    original.status !== "posted" ||
    !canInvoiceAuthority(state, actor, "invoices.read", original.id)
  )
    return;
  const prior = effectiveInvoiceVersion(state, original).lines[
    latest.line_index
  ];
  if (!prior || prior.product_code !== line.product_code) return;
  const changes: InvoiceKnownDelivery["changes"] = [];
  const sameSoldBy = (line.sold_by ?? "each") === (prior.sold_by ?? "each");
  if (!sameSoldBy)
    changes.push({
      field: "quantity_unit",
      before: prior.sold_by ?? "each",
      after: line.sold_by ?? "each",
    });
  if (
    line.supplier_item_code &&
    !line.supplier_item_code_inferred &&
    line.supplier_item_code !== latest.supplier_item_code &&
    !candidates.some(
      (fact) => fact.supplier_item_code === line.supplier_item_code,
    )
  )
    changes.push({
      field: "supplier_item_code",
      before: latest.supplier_item_code,
      after: line.supplier_item_code,
    });
  if (itemName(line) !== itemName(prior))
    changes.push({
      field: "description",
      before: prior.description,
      after: line.description,
    });
  if (line.units_per_case !== prior.units_per_case)
    changes.push({
      field: "units_per_case",
      before: String(prior.units_per_case ?? 1),
      after: String(line.units_per_case ?? 1),
    });
  if (
    pack(line.pack_size ?? "") !== pack(prior.pack_size ?? "") &&
    line.units_per_case === prior.units_per_case
  )
    changes.push({
      field: "pack_size",
      before: prior.pack_size ?? "",
      after: line.pack_size ?? "",
    });
  if ((line.pricing_category ?? "") !== (prior.pricing_category ?? ""))
    changes.push({
      field: "pricing_category",
      before: prior.pricing_category ?? "",
      after: line.pricing_category ?? "",
    });
  const costUnit =
    line.sold_by === "weight"
      ? "lb"
      : line.quantity_unit === "cases"
        ? "case"
        : "unit";
  const beforeCost =
    costUnit === "case"
      ? latest.case_cost_before_tax
      : latest.unit_cost_before_tax;
  const afterCost =
    costUnit === "case"
      ? (line.case_cost_before_tax ?? "")
      : line.unit_cost_before_tax;
  if (!validCost(beforeCost) || !validCost(afterCost)) return;
  if (sameSoldBy && money(beforeCost) !== money(afterCost))
    changes.push({
      field: "unit_cost_before_tax",
      before: money(beforeCost),
      after: money(afterCost),
      unit: costUnit,
    });
  const comparable = new Set([
    "description",
    "supplier_item_code",
    "product_code",
    "supplier_item_id",
    "units_per_case",
    "pack_size",
    "unit_cost_before_tax",
    "case_cost_before_tax",
    "pricing_category",
  ]);
  const uncertainPack = splitInvoiceProductDescription({
    description: line.description,
    supplierCode: line.supplier_item_code_inferred
      ? ""
      : line.supplier_item_code,
    unitsPerCase: line.units_per_case,
    packSize: line.pack_size,
    unit: line.quantity_unit === "cases" ? "case" : "each",
  }).uncertain;
  const sourceCost = line.imported_unit_cost_basis;
  const currentCaseCost =
    line.case_cost_before_tax ??
    line.converted_case_cost_before_tax ??
    (sourceCost && new Decimal(sourceCost.units).gt(0)
      ? new Decimal(sourceCost.amount)
          .div(sourceCost.units)
          .times(line.units_per_case ?? 1)
          .toFixed(4)
      : new Decimal(line.unit_cost_before_tax)
          .times(line.units_per_case ?? 1)
          .toFixed(4));
  const sourceCostQuestion = Boolean(
    sourceCost &&
    ((sourceCost.printed_cost_basis &&
      validCost(sourceCost.printed_unit_cost_before_tax) &&
      money(sourceCost.printed_unit_cost_before_tax) !==
        money(
          sourceCost.printed_cost_basis === "case"
            ? currentCaseCost
            : line.unit_cost_before_tax,
        )) ||
      (sourceCost.printed_case_cost_before_tax &&
        validCost(sourceCost.printed_case_cost_before_tax) &&
        validCost(currentCaseCost) &&
        money(sourceCost.printed_case_cost_before_tax) !==
          money(currentCaseCost))),
  );
  line.low_confidence_fields = (line.low_confidence_fields ?? []).filter(
    (field) => {
      const key = invoiceCheckField(field);
      return (
        !comparable.has(key) ||
        (!sameSoldBy &&
          ["unit_cost_before_tax", "case_cost_before_tax"].includes(key)) ||
        (uncertainPack &&
          ["description", "pack_size", "units_per_case"].includes(key)) ||
        (line.units_per_case_inferred === true && key === "units_per_case")
      );
    },
  );
  for (const change of changes)
    line.low_confidence_fields.push(
      change.field === "unit_cost_before_tax" && change.unit === "case"
        ? "case_cost_before_tax"
        : change.field,
    );
  if (sourceCostQuestion)
    line.low_confidence_fields.push(
      line.quantity_unit === "cases"
        ? "case_cost_before_tax"
        : "unit_cost_before_tax",
    );
  line.low_confidence_fields = [...new Set(line.low_confidence_fields)];
  // A pack variance is a precise field question, not an uncertain Product identity.
  matched.requires_check = false;
  const complete =
    validInvoiceLineQuantity(line) &&
    validInvoiceLineReceived(line) &&
    validCost(line.unit_cost_before_tax) &&
    !invoicePaperTotalMismatch(line) &&
    (!line.date_tracking || Boolean(line.date_confirmed && line.date_value)) &&
    state.config.pricing_categories.some(
      (category) => category.key === line.pricing_category,
    );
  line.review_confirmed =
    changes.length === 0 &&
    visibleInvoiceCheckFields(line).length === 0 &&
    complete;
  line.known_delivery = {
    status: changes.length ? "changed" : "same",
    date: latest.date,
    changes,
    source_invoice_id: original.id,
    source_line_id: prior.id ?? String(latest.line_index),
    fingerprint: knownDeliveryFingerprint(line),
  };
}
