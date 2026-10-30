/** Normalize the reader's existing quantity aliases without guessing unknown units. */
export function readingUnit(value: unknown): string {
  const unit =
    typeof value === "string" || typeof value === "number"
      ? String(value).trim().toLocaleLowerCase()
      : "";
  return /^(?:case|cases|cs\d*|ctn\d*|carton|cartons|box|boxes)$/.test(unit)
    ? "case"
    : /^(?:each|ea|unit|units|piece|pieces|pcs)$/.test(unit)
      ? "each"
      : unit;
}
