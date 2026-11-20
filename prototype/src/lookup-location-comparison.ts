import Decimal from "decimal.js";
export function differingLookupLocations(
  rows: readonly { location: string; price: string | null }[],
): string[] {
  const priced = rows.filter(
    (row): row is { location: string; price: string } => Boolean(row.price),
  );
  const count = new Map<string, number>();
  for (const row of priced) {
    const key = new Decimal(row.price).toString();
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  if (count.size < 2) return [];
  const maximum = Math.max(...count.values());
  const modes = [...count].filter(([, total]) => total === maximum);
  // Only an actual unique majority is a reference; a tie marks all differing public prices.
  const ordinary = modes.length === 1 ? modes[0][0] : null;
  return priced
    .filter((row) => ordinary === null || !new Decimal(row.price).eq(ordinary))
    .map((row) => row.location);
}
