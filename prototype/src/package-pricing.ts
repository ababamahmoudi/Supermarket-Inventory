import Decimal from "decimal.js";
import { configSeed } from "./config";
import { roundCategoryPrice, type PricingConfig } from "./pricing";
import { weightConversionFactor, weighedSettings } from "./weighed";
import type { CompanyConfig } from "./types";

const PackageDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
});
export type PackageUnit = "g" | "kg" | "lb" | "oz";
type PackageConfig = Pick<CompanyConfig, "weighed_items">;
export class PackageValidationError extends Error {
  constructor(readonly code: "size" | "unit" | "settings" | "price" | "cost") {
    super(code);
    this.name = "PackageValidationError";
  }
}
function amount(value: string, code: PackageValidationError["code"]) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value.trim()))
    throw new PackageValidationError(code);
  const result = new PackageDecimal(value.trim());
  if (!result.isFinite() || result.lt(0))
    throw new PackageValidationError(code);
  return result;
}
export function packageSettings(config: PackageConfig) {
  const weighed = weighedSettings(config);
  const fee = amount(
    weighed.package_container_fee ??
      configSeed.weighed_items.package_container_fee,
    "settings",
  );
  const cost = amount(
    weighed.package_container_cost ??
      configSeed.weighed_items.package_container_cost,
    "settings",
  );
  const ounces = amount(
    weighed.ounces_per_lb ?? configSeed.weighed_items.ounces_per_lb,
    "settings",
  );
  if (fee.decimalPlaces() > 2 || cost.decimalPlaces() > 4 || ounces.lte(0))
    throw new PackageValidationError("settings");
  return {
    container_fee: fee.toFixed(2),
    container_cost: cost.toFixed(4),
    barcode_prefix:
      weighed.package_barcode_prefix ??
      configSeed.weighed_items.package_barcode_prefix,
    ounces_per_lb: ounces.toString(),
  };
}
export function packageSizeInLb(
  size: string,
  unit: PackageUnit,
  config: PackageConfig = configSeed,
): string {
  const value = amount(size, "size");
  if (value.lte(0) || value.decimalPlaces() > 6)
    throw new PackageValidationError("size");
  if (unit === "lb") return value.toString();
  if (unit === "kg")
    return value.times(weightConversionFactor(config)).toString();
  if (unit === "g")
    return value.div("1000").times(weightConversionFactor(config)).toString();
  if (unit === "oz")
    return value.div(packageSettings(config).ounces_per_lb).toString();
  throw new PackageValidationError("unit");
}
export function calculatePackageCost(
  size: string,
  unit: PackageUnit,
  parentCostPerLb: string,
  config: PackageConfig = configSeed,
): string {
  const parentCost = amount(parentCostPerLb, "cost");
  if (parentCost.decimalPlaces() > 4) throw new PackageValidationError("cost");
  return new PackageDecimal(packageSizeInLb(size, unit, config))
    .times(parentCost)
    .plus(packageSettings(config).container_cost)
    .toFixed(4);
}
export function calculatePackagePrice(
  size: string,
  unit: PackageUnit,
  parentPricePerLb: string,
  parentCostPerLb: string,
  category: string,
  config: PricingConfig & PackageConfig = configSeed,
) {
  const size_lb = packageSizeInLb(size, unit, config);
  const settings = packageSettings(config);
  const parentPrice = amount(parentPricePerLb, "price");
  const parentCost = amount(parentCostPerLb, "cost");
  if (
    parentPrice.lte(0) ||
    parentPrice.decimalPlaces() > 2
  )
    throw new PackageValidationError("price");
  if (parentCost.decimalPlaces() > 4) throw new PackageValidationError("cost");
  const raw = new PackageDecimal(size_lb)
    .times(parentPrice)
    .plus(settings.container_fee);
  // This is already a selling amount: do not divide by the category divisor again.
  const rounded = roundCategoryPrice(raw.toString(), category, config);
  const cost = new PackageDecimal(
    calculatePackageCost(size, unit, parentCostPerLb, config),
  );
  const price = new PackageDecimal(rounded.selling_price);
  return {
    ...rounded,
    size_lb,
    container_fee: settings.container_fee,
    container_cost: settings.container_cost,
    cost_before_tax: cost.toFixed(4),
    margin: price.isZero() ? null : price.minus(cost).div(price).toString(),
    formula: `${size_lb} lb × ${parentPrice.toFixed(2)}/lb + ${settings.container_fee} = ${raw.toString()} → ${rounded.selling_price}`,
  };
}
