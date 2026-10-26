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

/** Calculate from the original cost basis before rounding the final line amount. */
export function invoiceLineAmount(line: InvoiceEditableLine): string {
  if (line.sold_by === "weight")
    return weightLineAmount(
      line.source_quantity ?? "",
      line.source_quantity_unit ?? "lb",
      line.source_cost_before_tax ?? line.unit_cost_before_tax,
      line.source_cost_unit ?? "lb",
      line.weight_conversion_factor,
    );
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
  const quantity =
    expectedCaseQuantity ?? validateWeightQuantity(line.source_quantity ?? "0");
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
      : validateWeightQuantity(enteredReceived, { allowZero: true });
  if (new Decimal(received).gt(quantity)) throw new Error("quantity");
  const sourceCost = line.source_cost_before_tax ?? line.unit_cost_before_tax;
  const costUnit = line.source_cost_unit ?? "lb";
  line.unit_cost_before_tax = weightCostPerLb(sourceCost, costUnit, factor);
  line.canonical_lb_quantity = weightQuantityPerLb(quantity, unit, factor);
  line.qty_invoiced = new Decimal(line.canonical_lb_quantity).toNumber();
  line.qty_received_at_posting = new Decimal(
    weightQuantityPerLb(received, unit, factor),
  ).toNumber();
  line.line_total = weightLineAmount(
    quantity,
    unit,
    sourceCost,
    costUnit,
    factor,
  );
  if (line.quantity_unit !== "cases") {
    line.quantity_unit = unit;
    line.quantity_entered = line.source_quantity;
    line.case_cost_before_tax = undefined;
  } else if (line.case_weight && line.case_weight_unit) {
    line.case_cost_before_tax = weightLineAmount(
      line.case_weight,
      line.case_weight_unit,
      sourceCost,
      costUnit,
      factor,
    );
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

/** Choosing a weight unit establishes source evidence before weight initialization. */
export function selectInvoiceWeightUnit(
  line: InvoiceEditableLine,
  unit: WeightUnit,
  config: Pick<CompanyConfig, "weighed_items">,
): void {
  if (line.sold_by !== "weight") {
    const displayedCost =
      line.quantity_unit === "cases"
        ? (line.case_cost_before_tax ?? "")
        : line.unit_cost_before_tax;
    const fullyDelivered = new Decimal(line.qty_received_at_posting).eq(
      line.qty_invoiced,
    );
    line.sold_by = "weight";
    line.source_quantity_unit = unit;
    line.source_cost_unit = unit;
    line.source_quantity = String(line.quantity_entered ?? line.qty_invoiced);
    // Unit changes cannot reinterpret a partial individual-unit receipt as a weight.
    line.source_received_quantity = fullyDelivered ? line.source_quantity : "";
    line.source_cost_before_tax = displayedCost;
  }
  line.quantity_unit = unit;
  try {
    initializeInvoiceWeight(line, config);
  } catch {
    line.qty_invoiced = 0;
    line.qty_received_at_posting = -1;
  }
}
