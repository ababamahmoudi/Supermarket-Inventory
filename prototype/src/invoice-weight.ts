import { freeCasePaperAmount } from "./invoice-free-cases";
import type { InvoiceEditableLine } from "./invoice-edit-types";
import Decimal from "decimal.js";
import { calculatePrice } from "./pricing";
import {
  calculateWeighedPrice,
  validateWeightQuantity,
  weightConversionFactor,
  weightCostPerLb,
  weightLineAmount,
  weightQuantityFromLb,
  weightQuantityPerLb,
  type WeightUnit,
} from "./weighed";
import type { CompanyConfig } from "./types";
import { invoicePackWeight } from "./invoice-case-weight";

export function invoiceLineCalculation(
  line: InvoiceEditableLine,
  category: string,
  config: CompanyConfig,
) {
  return line.sold_by === "weight"
    ? calculateWeighedPrice(
        line.source_cost_before_tax ?? line.unit_cost_before_tax,
        line.source_cost_unit ?? "lb",
        category,
        config,
        line.weight_conversion_factor,
      )
    : calculatePrice(line.unit_cost_before_tax, category, config);
}

function hasValidCaseWeight(line: InvoiceEditableLine): boolean {
  try {
    return Boolean(
      line.case_weight_unit && validateWeightQuantity(line.case_weight ?? ""),
    );
  } catch {
    return false;
  }
}

function caseCostFromWeight(
  line: InvoiceEditableLine,
  cost = line.source_cost_before_tax ?? "",
  unit: WeightUnit = line.source_cost_unit ?? "lb",
): string {
  const quantity = weightQuantityPerLb(
    line.case_weight ?? "",
    line.case_weight_unit ?? "lb",
    line.weight_conversion_factor,
  );
  const quantityInCostUnit = weightQuantityFromLb(
    quantity,
    unit,
    line.weight_conversion_factor,
  );
  const result = new Decimal(quantityInCostUnit).times(cost).toDecimalPlaces(4);
  return result.toFixed(result.decimalPlaces() <= 2 ? 2 : 4);
}

/** Calculate from the original cost basis before rounding the final line amount. */
export function invoiceLineAmount(line: InvoiceEditableLine): string {
  const grouped = freeCasePaperAmount(line);
  if (grouped !== undefined) return grouped;
  if (line.sold_by === "weight") {
    const basis = line.weight_case_cost_basis;
    if (
      basis &&
      basis.case_cost === line.case_cost_before_tax &&
      basis.weight === line.case_weight &&
      basis.unit === line.case_weight_unit &&
      new Decimal(basis.case_cost).div(basis.weight).toFixed(4) ===
        line.source_cost_before_tax &&
      basis.unit === line.source_cost_unit
    )
      return new Decimal(
        weightQuantityPerLb(
          line.source_quantity ?? "",
          line.source_quantity_unit ?? "lb",
          line.weight_conversion_factor,
        ),
      )
        .div(
          weightQuantityPerLb(
            basis.weight,
            basis.unit,
            line.weight_conversion_factor,
          ),
        )
        .times(basis.case_cost)
        .toFixed(2);
    return weightLineAmount(
      line.source_quantity ?? "",
      line.source_quantity_unit ?? "lb",
      line.source_cost_before_tax ?? line.unit_cost_before_tax,
      line.source_cost_unit ?? "lb",
      line.weight_conversion_factor,
    );
  }
  const basis = line.imported_unit_cost_basis;
  if (
    basis &&
    /^\d+(?:\.\d{1,2})?$/.test(basis.amount) &&
    /^\d+(?:\.\d+)?$/.test(basis.units) &&
    new Decimal(basis.units).gt(0) &&
    basis.product_code === line.product_code &&
    basis.unit_cost_before_tax === line.unit_cost_before_tax &&
    basis.units_per_case === line.units_per_case
  ) {
    return new Decimal(basis.amount)
      .times(line.qty_invoiced)
      .div(basis.units)
      .toFixed(2);
  }
  if (
    line.quantity_unit === "cases" &&
    /^\d+(?:\.\d{1,4})?$/.test(line.case_cost_before_tax ?? "")
  )
    return new Decimal(line.case_cost_before_tax!)
      .times(
        line.quantity_entered ??
          new Decimal(line.qty_invoiced).div(line.units_per_case ?? 1),
      )
      .toFixed(2);
  if (
    line.quantity_unit === "units" &&
    line.converted_case_cost_before_tax !== undefined &&
    /^\d+(?:\.\d{1,4})?$/.test(line.converted_case_cost_before_tax) &&
    Number.isSafeInteger(line.converted_case_units_per_case) &&
    line.converted_case_units_per_case! > 0 &&
    line.units_per_case === line.converted_case_units_per_case &&
    new Decimal(line.converted_case_cost_before_tax)
      .div(line.converted_case_units_per_case!)
      .toFixed(4) === line.unit_cost_before_tax
  )
    return new Decimal(line.converted_case_cost_before_tax)
      .times(line.qty_invoiced)
      .div(line.converted_case_units_per_case!)
      .toFixed(2);
  return new Decimal(line.unit_cost_before_tax)
    .times(line.qty_invoiced)
    .toFixed(2);
}

/** Case-derived mass may have more decimals than a manually entered weight. */
export function invoiceSourceWeightQuantity(
  line: InvoiceEditableLine,
  received = false,
): string {
  const value = received
    ? (line.source_received_quantity ?? "")
    : (line.source_quantity ?? "");
  const cases = received
    ? line.weight_case_received_quantity
    : line.weight_case_quantity;
  try {
    if (
      cases !== undefined &&
      line.case_weight &&
      line.case_weight_unit === line.source_quantity_unit
    ) {
      const count = validateWeightQuantity(cases, { allowZero: received });
      const mass = validateWeightQuantity(line.case_weight);
      if (new Decimal(count).times(mass).eq(value))
        return new Decimal(value).toString();
    }
  } catch {
    /* Only an exact valid case entry grants the derived precision. */
  }
  return validateWeightQuantity(value, { allowZero: received });
}

/** Source kg/lb precision and original cost are independent of canonical pricing. */
export function refreshInvoiceWeight(
  line: InvoiceEditableLine,
  config: Pick<CompanyConfig, "weighed_items">,
): void {
  if (line.sold_by !== "weight") return;
  line.weight_conversion_factor ??= weightConversionFactor(config);
  const factor = line.weight_conversion_factor;
  const unit = line.source_quantity_unit ?? "lb";
  const enteredCases =
    line.quantity_unit === "cases"
      ? validateWeightQuantity(line.quantity_entered ?? "")
      : undefined;
  const expectedCaseQuantity = enteredCases
    ? new Decimal(enteredCases)
        .times(validateWeightQuantity(line.case_weight ?? ""))
        .toString()
    : undefined;
  const quantity = expectedCaseQuantity ?? invoiceSourceWeightQuantity(line);
  if (
    expectedCaseQuantity &&
    (!new Decimal(line.source_quantity ?? "0").eq(expectedCaseQuantity) ||
      line.case_weight_unit !== unit)
  )
    throw new Error("quantity");
  const enteredReceived = line.source_received_quantity ?? quantity;
  const received =
    expectedCaseQuantity && new Decimal(enteredReceived).eq(quantity)
      ? quantity
      : invoiceSourceWeightQuantity(line, true);
  if (new Decimal(received).gt(quantity)) throw new Error("quantity");
  const sourceCost = line.source_cost_before_tax ?? line.unit_cost_before_tax;
  const costUnit = line.source_cost_unit ?? "lb";
  line.unit_cost_before_tax = weightCostPerLb(sourceCost, costUnit, factor);
  line.canonical_lb_quantity = weightQuantityPerLb(quantity, unit, factor);
  line.qty_invoiced = new Decimal(line.canonical_lb_quantity).toNumber();
  line.qty_received_at_posting = new Decimal(
    weightQuantityPerLb(received, unit, factor),
  ).toNumber();
  line.line_total = invoiceLineAmount(line);
  if (line.quantity_unit !== "cases") {
    if (line.quantity_unit !== "kg" && line.quantity_unit !== "lb")
      line.quantity_unit = unit;
    line.quantity_entered = invoiceWeightDisplayedQuantity(line);
  } else if (
    !line.weight_case_cost_basis &&
    line.case_weight &&
    line.case_weight_unit
  ) {
    line.case_cost_before_tax = caseCostFromWeight(line, sourceCost, costUnit);
  }
  if (line.case_weight && line.case_weight_unit) {
    const casePounds = new Decimal(
      weightQuantityPerLb(line.case_weight, line.case_weight_unit, factor),
    );
    line.weight_case_quantity = new Decimal(line.canonical_lb_quantity)
      .div(casePounds)
      .toString();
    line.weight_case_received_quantity = new Decimal(
      weightQuantityPerLb(received, unit, factor),
    )
      .div(casePounds)
      .toString();
  }
}

export function setInvoiceWeightQuantity(
  line: InvoiceEditableLine,
  quantity: string | number,
  unit: WeightUnit | "cases",
  config: Pick<CompanyConfig, "weighed_items">,
) {
  const full = new Decimal(line.qty_received_at_posting).eq(line.qty_invoiced);
  const previousReceived = line.qty_received_at_posting;
  line.sold_by = "weight";
  line.quantity_unit = unit;
  line.quantity_entered = quantity;
  line.weight_conversion_factor ??= weightConversionFactor(config);
  try {
    const sourceUnit =
      unit === "cases" ? (line.case_weight_unit ?? "kg") : unit;
    const source =
      unit === "cases"
        ? new Decimal(validateWeightQuantity(quantity))
            .times(validateWeightQuantity(line.case_weight ?? "0"))
            .toString()
        : String(quantity);
    line.source_quantity_unit = sourceUnit;
    line.source_quantity = source;
    const oldInSourceUnit = weightQuantityFromLb(
      previousReceived,
      sourceUnit,
      line.weight_conversion_factor,
    );
    line.source_received_quantity = full
      ? source
      : Decimal.min(oldInSourceUnit, source).toString();
    refreshInvoiceWeight(line, config);
  } catch {
    line.source_quantity = unit === "cases" ? "" : String(quantity);
    line.source_quantity_unit =
      unit === "cases" ? (line.case_weight_unit ?? "kg") : unit;
    line.qty_invoiced = 0;
    if (full) line.qty_received_at_posting = 0;
  }
  line.review_confirmed = false;
  line.refused_units = 0;
  line.extra_delivery_decision = undefined;
}

export function setInvoiceWeightReceived(
  line: InvoiceEditableLine,
  value: string,
  config: Pick<CompanyConfig, "weighed_items">,
) {
  line.source_received_quantity = value;
  try {
    refreshInvoiceWeight(line, config);
  } catch {
    line.qty_received_at_posting = -1;
  }
  line.review_confirmed = false;
}

export function setInvoiceWeightCost(
  line: InvoiceEditableLine,
  value: string,
  unit: WeightUnit,
  config: Pick<CompanyConfig, "weighed_items">,
) {
  line.weight_case_cost_basis = undefined;
  if (line.case_weight && line.case_weight_unit) {
    try {
      line.case_cost_before_tax = caseCostFromWeight(line, value, unit);
    } catch {
      line.case_cost_before_tax = undefined;
    }
  }
  line.source_cost_before_tax = value;
  line.source_cost_unit = unit;
  try {
    refreshInvoiceWeight(line, config);
  } catch {
    line.unit_cost_before_tax = "";
  }
  line.review_confirmed = false;
}

export function initializeInvoiceWeight<Line extends InvoiceEditableLine>(
  line: Line,
  config: Pick<CompanyConfig, "weighed_items">,
): Line {
  if (line.sold_by !== "weight") return line;
  line.source_quantity_unit ??= "lb";
  line.source_quantity ??= String(line.qty_invoiced);
  line.source_received_quantity ??= String(line.qty_received_at_posting);
  line.source_cost_unit ??= "lb";
  line.source_cost_before_tax ??= line.unit_cost_before_tax;
  line.weight_conversion_factor ??= weightConversionFactor(config);
  refreshInvoiceWeight(line, config);
  return line;
}

/** A displayed unit may change without rewriting the original source arithmetic. */
export function invoiceWeightDisplayedQuantity(
  line: InvoiceEditableLine,
): string {
  if (line.quantity_unit === "cases")
    return String(line.quantity_entered ?? "");
  if (!line.source_quantity) return "";
  return new Decimal(
    weightQuantityFromLb(
      weightQuantityPerLb(
        line.source_quantity,
        line.source_quantity_unit ?? "lb",
        line.weight_conversion_factor,
      ),
      line.quantity_unit === "kg" ? "kg" : "lb",
      line.weight_conversion_factor,
    ),
  )
    .toDecimalPlaces(3)
    .toString();
}
export function invoiceWeightDisplayedCost(line: InvoiceEditableLine): string {
  if (!line.source_cost_before_tax) return "";
  const displayUnit =
    line.quantity_unit === "kg"
      ? "kg"
      : line.quantity_unit === "lb"
        ? "lb"
        : (line.source_cost_unit ?? "lb");
  const source = new Decimal(line.source_cost_before_tax);
  const factor = weightConversionFactor(line.weight_conversion_factor);
  return (
    displayUnit === line.source_cost_unit
      ? source
      : displayUnit === "kg"
        ? source.times(factor)
        : source.div(factor)
  ).toFixed(4);
}
export function setInvoiceCaseWeight(
  line: InvoiceEditableLine,
  weight: string,
  unit: WeightUnit,
  config: Pick<CompanyConfig, "weighed_items">,
): void {
  const fullyDelivered = line.qty_received_at_posting === line.qty_invoiced;
  const cases =
    line.quantity_unit === "cases"
      ? String(line.quantity_entered ?? "")
      : (line.weight_case_quantity ?? "");
  line.case_weight = weight;
  line.case_weight_unit = unit;
  try {
    validateWeightQuantity(weight);
    validateWeightQuantity(cases);
    if (
      line.case_cost_before_tax === undefined &&
      /^\d+(?:\.\d{1,4})?$/.test(line.source_cost_before_tax ?? "")
    )
      line.case_cost_before_tax = caseCostFromWeight(line);
    if (!/^\d+(?:\.\d{1,4})?$/.test(line.case_cost_before_tax ?? ""))
      throw new Error("cost");
    line.source_cost_before_tax = new Decimal(line.case_cost_before_tax!)
      .div(weight)
      .toFixed(4);
    line.source_cost_unit = unit;
    line.weight_case_cost_basis = {
      case_cost: line.case_cost_before_tax!,
      weight,
      unit,
    };
    line.source_quantity_unit = unit;
    line.source_quantity = new Decimal(cases).times(weight).toString();
    line.source_received_quantity =
      line.weight_case_received_quantity !== undefined
        ? new Decimal(line.weight_case_received_quantity)
            .times(weight)
            .toString()
        : fullyDelivered
          ? line.source_quantity
          : "";
    line.sold_by = "weight";
    if (line.source_received_quantity === "") {
      // Derive valid invoice facts without inventing a persisted physical receipt.
      line.source_received_quantity = "0";
      refreshInvoiceWeight(line, config);
      line.source_received_quantity = "";
      line.qty_received_at_posting = -1;
      line.weight_case_received_quantity = undefined;
    } else refreshInvoiceWeight(line, config);
  } catch {
    line.source_quantity = "";
    if (line.case_cost_before_tax !== undefined)
      line.source_cost_before_tax = "";
    line.source_received_quantity = "";
    line.unit_cost_before_tax = "";
    line.qty_invoiced = 0;
    line.qty_received_at_posting = fullyDelivered ? 0 : -1;
  }
  line.review_confirmed = false;
}
export function setInvoiceWeightCaseCost(
  line: InvoiceEditableLine,
  cost: string,
  config: Pick<CompanyConfig, "weighed_items">,
): void {
  line.case_cost_before_tax = cost;
  setInvoiceCaseWeight(
    line,
    line.case_weight ?? "",
    line.case_weight_unit ?? "lb",
    config,
  );
}
/** Choosing weight requires real pack evidence; a case price is never a price per lb. */
export function selectInvoiceWeightUnit(
  line: InvoiceEditableLine,
  unit: WeightUnit,
  config: Pick<CompanyConfig, "weighed_items">,
): void {
  if (line.sold_by !== "weight") {
    const cases =
      line.quantity_unit === "cases"
        ? String(line.quantity_entered ?? "")
        : new Decimal(line.qty_invoiced)
            .div(line.units_per_case ?? 1)
            .toString();
    const measured = invoicePackWeight(line.pack_size || line.description);
    line.weight_case_quantity = cases;
    line.weight_case_received_quantity = new Decimal(
      line.qty_received_at_posting,
    )
      .div(line.units_per_case ?? 1)
      .toString();
    if (line.quantity_unit !== "cases")
      line.case_cost_before_tax = line.converted_case_cost_before_tax;
    line.case_cost_before_tax ??= new Decimal(line.unit_cost_before_tax || 0)
      .times(line.units_per_case ?? 1)
      .toFixed(4);
    line.case_weight ??= measured?.weight;
    line.case_weight_unit ??= measured?.unit;
    line.sold_by = "weight";
    line.quantity_unit = unit;
    setInvoiceCaseWeight(
      line,
      line.case_weight ?? "",
      line.case_weight_unit ?? unit,
      config,
    );
  } else {
    line.quantity_unit = unit;
    line.quantity_entered = invoiceWeightDisplayedQuantity(line);
  }
  line.review_confirmed = false;
}
/** Changes an entry representation and its cost together, retaining paper cents. */
export function selectInvoiceLineUnit(
  line: InvoiceEditableLine,
  unit: "cases" | "units" | WeightUnit,
  config: Pick<CompanyConfig, "weighed_items">,
): void {
  if (unit === "lb" || unit === "kg")
    return selectInvoiceWeightUnit(line, unit, config);
  const full = line.qty_received_at_posting === line.qty_invoiced;
  const pack = line.units_per_case ?? 1;
  let cases: Decimal;
  let deliveredCases: Decimal | undefined;
  if (line.sold_by === "weight") {
    if (
      !line.case_weight ||
      !line.case_weight_unit ||
      !hasValidCaseWeight(line)
    ) {
      if (
        line.weight_case_quantity &&
        /^\d+(?:\.\d{1,4})?$/.test(line.case_cost_before_tax ?? "") &&
        Number.isSafeInteger(pack) &&
        pack > 0
      ) {
        // Cancelling a weight choice restores known package counts and money, without needing a mass.
        line.sold_by = "each";
        line.quantity_unit = "cases";
        line.quantity_entered = line.weight_case_quantity;
        line.qty_invoiced = new Decimal(line.weight_case_quantity)
          .times(pack)
          .toNumber();
        line.qty_received_at_posting =
          line.weight_case_received_quantity !== undefined
            ? new Decimal(line.weight_case_received_quantity)
                .times(pack)
                .toNumber()
            : -1;
        line.unit_cost_before_tax = new Decimal(line.case_cost_before_tax!)
          .div(pack)
          .toFixed(4);
        selectInvoiceLineUnit(line, unit, config);
        return;
      }
      line.quantity_unit = "cases";
      line.quantity_entered = line.weight_case_quantity ?? "";
      return;
    }
    cases = new Decimal(
      weightQuantityPerLb(
        line.source_quantity ?? "",
        line.source_quantity_unit ?? "lb",
        line.weight_conversion_factor,
      ),
    ).div(
      weightQuantityPerLb(
        line.case_weight,
        line.case_weight_unit,
        line.weight_conversion_factor,
      ),
    );
    deliveredCases = new Decimal(
      weightQuantityPerLb(
        line.source_received_quantity || "0",
        line.source_quantity_unit ?? "lb",
        line.weight_conversion_factor,
      ),
    ).div(
      weightQuantityPerLb(
        line.case_weight,
        line.case_weight_unit,
        line.weight_conversion_factor,
      ),
    );
    line.case_cost_before_tax ??= caseCostFromWeight(line);
    line.weight_case_quantity = cases.toString();
    line.weight_case_received_quantity = deliveredCases.toString();
    if (unit === "cases") {
      line.quantity_unit = "cases";
      line.quantity_entered = cases.toString();
      line.source_quantity = cases.times(line.case_weight).toString();
      line.source_quantity_unit = line.case_weight_unit;
      line.source_received_quantity = deliveredCases
        .times(line.case_weight)
        .toString();
      refreshInvoiceWeight(line, config);
      line.review_confirmed = false;
      return;
    }
  } else
    cases =
      line.quantity_unit === "cases"
        ? new Decimal(line.quantity_entered ?? "0")
        : new Decimal(line.qty_invoiced).div(pack);
  const caseCost =
    line.case_cost_before_tax ??
    line.converted_case_cost_before_tax ??
    new Decimal(line.unit_cost_before_tax || 0).times(pack).toFixed(4);
  line.sold_by = "each";
  line.quantity_unit = unit;
  line.quantity_entered = (
    unit === "cases" ? cases : cases.times(pack)
  ).toString();
  line.qty_invoiced = cases.times(pack).toNumber();
  if (deliveredCases)
    line.qty_received_at_posting = deliveredCases.times(pack).toNumber();
  else if (full) line.qty_received_at_posting = line.qty_invoiced;
  line.unit_cost_before_tax = new Decimal(caseCost).div(pack).toFixed(4);
  line.case_cost_before_tax = unit === "cases" ? caseCost : undefined;
  line.converted_case_cost_before_tax = unit === "units" ? caseCost : undefined;
  line.converted_case_units_per_case = unit === "units" ? pack : undefined;
  line.imported_unit_cost_basis = undefined;
  line.weight_case_cost_basis = undefined;
  line.line_total = invoiceLineAmount(line);
  line.review_confirmed = false;
}

/** Reconciliation is independent of the current calculated line total. */
export function invoicePaperTotalMismatch(
  line: InvoiceEditableLine,
): { paper: string; calculated: string } | undefined {
  const paper = line.paper_line_total;
  if (!paper || !/^\d+(?:\.\d{1,2})?$/.test(paper)) return undefined;
  try {
    const calculated = invoiceLineAmount(line);
    if (new Decimal(calculated).minus(paper).abs().lte("0.01"))
      return undefined;
    const acknowledged = line.paper_total_acknowledgement;
    if (
      acknowledged?.paper === paper &&
      acknowledged.calculated === calculated &&
      acknowledged.checked_by_user_id &&
      acknowledged.checked_at
    )
      return undefined;
    return { paper, calculated };
  } catch {
    return undefined;
  }
}
