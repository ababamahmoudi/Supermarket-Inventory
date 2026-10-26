import type { InvoiceEditableLine } from "./invoice-edit-types";

export const correctionDisplayFields = [
  "product_code",
  "quantity_unit",
  "quantity_entered",
  "qty_invoiced",
  "qty_received_at_posting",
  "units_per_case",
  "unit_cost_before_tax",
  "case_cost_before_tax",
  "source_quantity",
  "source_quantity_unit",
  "source_received_quantity",
  "source_cost_before_tax",
  "source_cost_unit",
  "case_weight",
  "case_weight_unit",
  "date_tracking",
  "date_type",
  "date_value",
  "lot_number",
  "taxable",
  "line_total",
  "line_tax",
] as const satisfies readonly (keyof InvoiceEditableLine)[];

/** Only correction controls and their derived amounts enter the public difference. */
export function correctionLineChanges(
  before: readonly InvoiceEditableLine[],
  after: readonly InvoiceEditableLine[],
) {
  return after.flatMap((line, line_index) => {
    const previous = before[line_index];
    if (!previous) return [];
    const fields = correctionDisplayFields.flatMap((field) => {
      const old = String(previous[field] ?? "");
      const next = String(line[field] ?? "");
      return old === next ? [] : [{ field, before: old, after: next }];
    });
    return fields.length ? [{ line_index, fields }] : [];
  });
}

/** Keep an exact imported basis only while its original unit-cost meaning survives. */
export function invalidateCorrectionCaseBasis(
  before: InvoiceEditableLine,
  after: InvoiceEditableLine,
  unitCostReentered = false,
) {
  if (
    unitCostReentered ||
    (
      [
        "product_code",
        "sold_by",
        "quantity_unit",
        "units_per_case",
        "unit_cost_before_tax",
        "case_cost_before_tax",
      ] as const
    ).some((field) => before[field] !== after[field])
  ) {
    after.converted_case_cost_before_tax = undefined;
    after.imported_unit_cost_basis = undefined;
    after.converted_case_units_per_case = undefined;
  }
}
