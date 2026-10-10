import Decimal from "decimal.js";
import { configSeed } from "./config";
import {
  calculatePrice,
  type PricingConfig,
  type PricingResult,
} from "./pricing";
import type { CompanyConfig } from "./types";

const WeightDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
});
export type WeightUnit = "lb" | "kg";
export type WeighedSettings = NonNullable<CompanyConfig["weighed_items"]>;
type WeightConfig = { weighed_items?: WeighedSettings };
type FactorSource = WeightConfig | string;
export const DEFAULT_WEIGHED_SETTINGS: Readonly<WeighedSettings> =
  Object.freeze({
    conversion_factor: "2.20462",
    main_display_unit: "lb",
    show_second_unit: true,
    use_rounding_bands: true,
  });
export class WeightValidationError extends Error {
  constructor(
    public readonly code:
      "factor" | "unit" | "quantity" | "cost" | "settings" | "price",
  ) {
    super(code);
    this.name = "WeightValidationError";
  }
}
function amount(
  value: Decimal.Value,
  code: WeightValidationError["code"],
): Decimal {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new WeightValidationError(code);
  const parsed = new WeightDecimal(text);
  if (!parsed.isFinite() || parsed.isNegative())
    throw new WeightValidationError(code);
  return parsed;
}
function unit(value: WeightUnit) {
  if (value !== "lb" && value !== "kg") throw new WeightValidationError("unit");
}
export function weighedSettings(config: WeightConfig): WeighedSettings {
  return { ...DEFAULT_WEIGHED_SETTINGS, ...config.weighed_items };
}
export function weightConversionFactor(
  source: FactorSource = "2.20462",
): string {
  const value =
    typeof source === "string"
      ? source
      : weighedSettings(source).conversion_factor;
  const factor = amount(value, "factor");
  if (factor.lte(0)) throw new WeightValidationError("factor");
  return factor.toString();
}
export function validateWeighedSettings(config: WeightConfig): void {
  const settings = weighedSettings(config);
  weightConversionFactor(config);
  if (
    (settings.main_display_unit !== "lb" &&
      settings.main_display_unit !== "kg") ||
    typeof settings.show_second_unit !== "boolean" ||
    typeof settings.use_rounding_bands !== "boolean"
  )
    throw new WeightValidationError("settings");
}
export function validateWeightQuantity(
  quantity: Decimal.Value,
  options: { allowZero?: boolean } = {},
): string {
  const parsed = amount(quantity, "quantity");
  if (
    (!options.allowZero && parsed.isZero()) ||
    (String(quantity).trim().split(".")[1]?.length ?? 0) > 3
  )
    throw new WeightValidationError("quantity");
  return parsed.toString();
}
export function weightQuantityPerLb(
  quantity: Decimal.Value,
  sourceUnit: WeightUnit,
  source: FactorSource = "2.20462",
): string {
  unit(sourceUnit);
  const parsed = amount(quantity, "quantity");
  return (
    sourceUnit === "kg" ? parsed.times(weightConversionFactor(source)) : parsed
  ).toString();
}
export function weightQuantityFromLb(
  quantity: Decimal.Value,
  targetUnit: WeightUnit,
  source: FactorSource = "2.20462",
): string {
  unit(targetUnit);
  const parsed = amount(quantity, "quantity");
  return (
    targetUnit === "kg" ? parsed.div(weightConversionFactor(source)) : parsed
  ).toString();
}
export function weightCostPerLb(
  cost: string,
  sourceUnit: WeightUnit,
  source: FactorSource = "2.20462",
): string {
  unit(sourceUnit);
  const parsed = amount(cost, "cost");
  if ((cost.trim().split(".")[1]?.length ?? 0) > 4)
    throw new WeightValidationError("cost");
  return (
    sourceUnit === "kg" ? parsed.div(weightConversionFactor(source)) : parsed
  ).toFixed(4, Decimal.ROUND_HALF_UP);
}
export function calculateWeighedPrice(
  cost: string,
  sourceUnit: WeightUnit,
  category: string,
  config: PricingConfig & WeightConfig = configSeed,
  factorSnapshot?: string,
): PricingResult & { canonical_cost_per_lb: string } {
  validateWeighedSettings(config);
  const canonical = weightCostPerLb(cost, sourceUnit, factorSnapshot ?? config);
  return {
    ...calculatePrice(canonical, category, config, {
      skip_band_rounding: !weighedSettings(config).use_rounding_bands,
    }),
    canonical_cost_per_lb: canonical,
  };
}
/** Invoice totals use original evidence, before canonical cost is rounded. */
export function weightLineAmount(
  quantity: Decimal.Value,
  quantityUnit: WeightUnit,
  cost: string,
  costUnit: WeightUnit,
  source: FactorSource = "2.20462",
): string {
  unit(quantityUnit);
  unit(costUnit);
  const parsedQuantity = amount(quantity, "quantity");
  const parsedCost = amount(cost, "cost");
  if ((cost.trim().split(".")[1]?.length ?? 0) > 4)
    throw new WeightValidationError("cost");
  const inCostUnits =
    quantityUnit === costUnit
      ? parsedQuantity
      : quantityUnit === "kg"
        ? parsedQuantity.times(weightConversionFactor(source))
        : parsedQuantity.div(weightConversionFactor(source));
  return inCostUnits.times(parsedCost).toFixed(2, Decimal.ROUND_HALF_UP);
}
export function weightPriceDisplay(approvedLb: string, config: WeightConfig) {
  validateWeighedSettings(config);
  const settings = weighedSettings(config);
  const lb = amount(approvedLb, "price").toFixed(2, Decimal.ROUND_HALF_UP);
  const kg = amount(lb, "price")
    .times(weightConversionFactor(config))
    .toFixed(2, Decimal.ROUND_HALF_UP);
  const main =
    settings.main_display_unit === "lb"
      ? { amount: lb, unit: "lb" as const }
      : { amount: kg, unit: "kg" as const };
  const secondary = settings.show_second_unit
    ? settings.main_display_unit === "lb"
      ? { amount: kg, unit: "kg" as const }
      : { amount: lb, unit: "lb" as const }
    : null;
  return { main, secondary };
}
/** A displayed kg edit is normalized only when the user explicitly saves a price change. */
export function approvedWeightPricePerLb(
  price: string,
  displayedUnit: WeightUnit,
  config: WeightConfig,
): string {
  unit(displayedUnit);
  const parsed = amount(price, "price");
  if ((price.trim().split(".")[1]?.length ?? 0) > 2 || parsed.lte(0))
    throw new WeightValidationError("price");
  return (
    displayedUnit === "kg" ? parsed.div(weightConversionFactor(config)) : parsed
  ).toFixed(2, Decimal.ROUND_HALF_UP);
}
