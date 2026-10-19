import Decimal from "decimal.js";
import type { PriceSnapshot } from "./price-updates";

export interface SellingAmount {
  amount: string;
  unit: "each" | "lb" | "kg";
}
export interface SellingPriceDisplay {
  main: SellingAmount;
  secondary?: SellingAmount | null;
}

/** Comparison uses Decimal amounts in the same unit, never formatted text. */
export function isDiscountPrice(
  current: SellingPriceDisplay,
  regular?: SellingPriceDisplay | null,
): boolean {
  if (!regular || current.main.unit !== regular.main.unit) return false;
  try {
    return (
      new Decimal(current.main.amount).gt(0) &&
      new Decimal(current.main.amount).lt(regular.main.amount)
    );
  } catch {
    return false;
  }
}

export function snapshotHasDiscount(value: PriceSnapshot): boolean {
  return Boolean(
    value.sale_id &&
    value.price !== null &&
    value.regular_price !== null &&
    isDiscountPrice(
      { main: { amount: value.price, unit: value.unit } },
      { main: { amount: value.regular_price, unit: value.unit } },
    ),
  );
}
