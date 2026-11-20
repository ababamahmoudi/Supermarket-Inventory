import Decimal from "decimal.js";
import { offerParts } from "./formatters";

/** Presentation only: the configured offer and approved price remain unchanged. */
export function offerSuggestionAmounts(label: string, regularPrice: string) {
  const terms = offerParts(label);
  if (!terms) return undefined;
  try {
    const regular = new Decimal(regularPrice);
    const quantity = new Decimal(terms.quantity);
    const total = new Decimal(terms.price);
    if (
      !regular.isFinite() ||
      !regular.gt(0) ||
      !quantity.isInteger() ||
      !quantity.gt(0) ||
      !total.isFinite() ||
      !total.gte(0)
    )
      return undefined;
    const saving = regular.times(quantity).minus(total);
    return {
      quantity: quantity.toString(),
      total: total.toFixed(2),
      saving: saving.gt(0) ? saving.toFixed(2, Decimal.ROUND_HALF_UP) : null,
    };
  } catch {
    return undefined;
  }
}
