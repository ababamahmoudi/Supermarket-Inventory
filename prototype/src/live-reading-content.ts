/** Item evidence only; the existing importer owns all amounts and review checks. */
export function isUsableLiveReadingItem(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const line = value as Record<string, unknown>;
  const kind =
    typeof line.line_type === "string" ? line.line_type.trim() : line.line_type;
  if (kind != null && kind !== "" && kind !== "item") return false;
  return [
    "description",
    "supplier_sku",
    "barcode",
    "quantity",
    "unit_cost_before_tax",
    "line_total",
    "units_received",
    "cost_per_unit_before_tax",
    "cost_per_case_before_tax",
  ].some((key) => {
    const item = line[key];
    return typeof item === "number"
      ? Number.isFinite(item)
      : typeof item === "string" && item.trim().length > 0;
  });
}
