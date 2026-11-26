import Decimal from "decimal.js";
import type { SupplierOverviewRow } from "./suppliers";

/** Legacy `proposed` preferences now mean incomplete profile, never inactive approval status. */
export function supplierMatchesFilters(
  supplier: SupplierOverviewRow,
  search: string,
  filters: readonly string[],
): boolean {
  if (
    !supplier.name
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  )
    return false;
  return filters.every((filter) => {
    switch (filter) {
      case "overdue":
        return (
          !!supplier.financial && new Decimal(supplier.financial.overdue).gt(0)
        );
      case "returns":
        return supplier.open_returns > 0;
      case "shorts":
        return supplier.open_shorts > 0;
      case "proposed":
      case "profile_incomplete":
        return supplier.profile_missing.length > 0;
      default:
        return true;
    }
  });
}
