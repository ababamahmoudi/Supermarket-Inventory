import Decimal from "decimal.js";
import type { WeightUnit } from "./weighed";

/** A measured pack is evidence, never an assumed weight for an unknown case. */
export function invoicePackWeight(
  text: string,
): { weight: string; unit: WeightUnit; units: number } | undefined {
  const value = text.trim();
  const nested = /\d\s*[x×*]\s*\d+(?:\.\d+)?\s*[x×*]/i.test(value);
  if (nested) return undefined;
  const match =
    /(?:\b(\d+)\s*[x×*]\s*)?(\d+(?:\.\d+)?)\s*(kg|lbs?|g|gr|oz)\b(?:\s*\/\s*(?:case|bag|box|carton|ctn))?/i.exec(
      value,
    );
  if (!match) return undefined;
  // Two different measurements cannot establish one unambiguous case weight.
  if (
    /\d+(?:\.\d+)?\s*(?:kg|lbs?|g|gr|oz)\b/i.test(
      value.slice(match.index + match[0].length),
    )
  )
    return undefined;
  const units = Number(match[1] ?? 1);
  let weight = new Decimal(match[2]).times(units);
  if (!Number.isSafeInteger(units) || units <= 0 || weight.lte(0))
    return undefined;
  const sourceUnit = match[3].toLowerCase();
  if (sourceUnit === "g" || sourceUnit === "gr") weight = weight.div(1000);
  if (sourceUnit === "oz") weight = weight.div(16);
  return {
    weight: weight.toString(),
    unit: /^(?:kg|g|gr)$/.test(sourceUnit) ? "kg" : "lb",
    units,
  };
}
