import Decimal from "decimal.js";

/** English singular/plural for a counted word; Persian keeps one form after numbers. */
export function countedWord(
  count: Decimal.Value,
  singular: string,
  plural: string,
): string {
  try {
    return new Decimal(count).eq(1) ? singular : plural;
  } catch {
    return plural;
  }
}
