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
import type { CompanyConfig, InvoiceLine } from "./types";

export function invoiceLineCalculation(
  line: InvoiceLine,
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

/** Source kg/lb precision and original cost are independent of canonical pricing. */
export function refreshInvoiceWeight(
  line: InvoiceLine,
  config: CompanyConfig,
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
  line: InvoiceLine,
  quantity: string | number,
  unit: WeightUnit | "cases",
  config: CompanyConfig,
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
  line: InvoiceLine,
  value: string,
  config: CompanyConfig,
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
  line: InvoiceLine,
  value: string,
  unit: WeightUnit,
  config: CompanyConfig,
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

export function initializeInvoiceWeight(
  line: InvoiceLine,
  config: CompanyConfig,
): InvoiceLine {
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
