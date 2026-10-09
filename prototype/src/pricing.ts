import Decimal from "decimal.js";
import { configSeed as seedConfig } from "./config";

// A local constructor keeps other modules from changing the engine's precision.
const Money = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_HALF_UP });
type SeedCategory = (typeof seedConfig.pricing_categories)[number];
export type PricingConfig = Pick<
  typeof seedConfig,
  "rounding_bands" | "special_corrections"
> & {
  pricing_categories: (Omit<SeedCategory, "minimum_margin"> & {
    minimum_margin: string | null;
  })[];
};

export type PricingResult = {
  selling_price: string;
  raw_price: string;
  rounded_raw: string;
  after_band_rounding: string | null;
  special_correction_applied: boolean;
  margin: string | null;
  below_minimum_margin: boolean;
};

export type PricingErrorCode =
  | "invalid_cost"
  | "invalid_divisor"
  | "unknown_category"
  | "invalid_bands"
  | "invalid_ending"
  | "invalid_correction"
  | "invalid_minimum"
  | "invalid_margin"
  | "invalid_rounding";

export class PricingValidationError extends Error {
  constructor(public readonly code: PricingErrorCode) {
    super(code);
    this.name = "PricingValidationError";
  }
}

function decimal(value: string, code: PricingErrorCode): Decimal {
  if (
    typeof value !== "string" ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())
  ) {
    throw new PricingValidationError(code);
  }
  const parsed = new Money(value.trim());
  if (!parsed.isFinite()) throw new PricingValidationError(code);
  return parsed;
}

function centAmount(value: string, code: PricingErrorCode): Decimal {
  const amount = decimal(value, code);
  if (amount.isNegative() && !amount.isZero())
    throw new PricingValidationError(code);
  if (!amount.eq(amount.toDecimalPlaces(2)))
    throw new PricingValidationError(code);
  return amount;
}

function ending(value: string): Decimal {
  const amount = centAmount(value, "invalid_ending");
  if (amount.gte("1")) throw new PricingValidationError("invalid_ending");
  return amount;
}

export function validatePricingConfig(config: PricingConfig): void {
  const keys = new Set<string>();
  for (const category of config.pricing_categories) {
    if (keys.has(category.key))
      throw new PricingValidationError("unknown_category");
    keys.add(category.key);
    if (decimal(category.cost_divisor, "invalid_divisor").lte("0")) {
      throw new PricingValidationError("invalid_divisor");
    }
    if (category.minimum_margin !== null) {
      const threshold = decimal(category.minimum_margin, "invalid_margin");
      if (threshold.lt("0") || threshold.gt("1")) {
        throw new PricingValidationError("invalid_margin");
      }
    }
    if (category.rounding === "always_up_to_next_99") {
      if (category.rounding_ending === undefined)
        throw new PricingValidationError("invalid_ending");
      ending(category.rounding_ending);
    } else if (category.rounding !== "bands") {
      throw new PricingValidationError("invalid_rounding");
    }
  }

  let expectedLower = new Money("0");
  const bands = config.rounding_bands.bands;
  if (!bands.length) throw new PricingValidationError("invalid_bands");
  for (const band of bands) {
    const lower = decimal(band.lower_inclusive, "invalid_bands");
    const upper = decimal(band.upper_exclusive, "invalid_bands");
    if (!lower.eq(expectedLower) || upper.lte(lower) || upper.gt("1")) {
      throw new PricingValidationError("invalid_bands");
    }
    if (!Number.isSafeInteger(band.dollar_offset)) {
      throw new PricingValidationError("invalid_bands");
    }
    ending(band.ending);
    expectedLower = upper;
  }
  if (!expectedLower.eq("1")) throw new PricingValidationError("invalid_bands");
  centAmount(
    config.rounding_bands.minimum_result_when_previous_dollar_does_not_exist,
    "invalid_minimum",
  );

  const corrections = new Set<string>();
  for (const correction of config.special_corrections) {
    const from = centAmount(correction.from, "invalid_correction").toFixed(2);
    centAmount(correction.to, "invalid_correction");
    if (corrections.has(from))
      throw new PricingValidationError("invalid_correction");
    corrections.add(from);
  }
}

/** One configuration-driven engine for live previews and invoice calculations. */
export function calculatePrice(
  costInput: string,
  categoryKey: string,
  config: PricingConfig = seedConfig,
  options: { skip_band_rounding?: boolean } = {},
): PricingResult {
  const cost = decimal(costInput, "invalid_cost");
  const fractionalDigits = costInput.trim().split(".")[1]?.length ?? 0;
  if (cost.lt("0") || fractionalDigits > 4)
    throw new PricingValidationError("invalid_cost");
  validatePricingConfig(config);
  const category = config.pricing_categories.find(
    (entry) => entry.key === categoryKey,
  );
  if (!category) throw new PricingValidationError("unknown_category");

  const raw = cost.div(decimal(category.cost_divisor, "invalid_divisor"));
  const roundedRaw = raw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  let price: Decimal;
  let afterBands: Decimal | null = null;
  let correctionApplied = false;

  if (category.rounding === "always_up_to_next_99") {
    // Rice compares with the unrounded quotient, including values just above .99.
    const candidate = raw.floor().plus(ending(category.rounding_ending!));
    price = candidate.gte(raw) ? candidate : candidate.plus("1");
  } else if (options.skip_band_rounding) {
    price = roundedRaw;
  } else {
    const dollars = roundedRaw.floor();
    const fraction = roundedRaw.minus(dollars);
    const band = config.rounding_bands.bands.find(
      (entry) =>
        fraction.gte(entry.lower_inclusive) &&
        fraction.lt(entry.upper_exclusive),
    );
    if (!band) throw new PricingValidationError("invalid_bands");
    const targetDollars = dollars.plus(String(band.dollar_offset));
    price = targetDollars.lt("0")
      ? new Money(
          config.rounding_bands
            .minimum_result_when_previous_dollar_does_not_exist,
        )
      : targetDollars.plus(band.ending);
    afterBands = price;
    if (category.apply_special_correction) {
      const correction = config.special_corrections.find((entry) =>
        price.eq(entry.from),
      );
      if (correction) {
        price = new Money(correction.to);
        correctionApplied = true;
      }
    }
  }

  const margin = price.isZero() ? null : price.minus(cost).div(price);
  // Cross multiplication avoids formatting or recurring-ratio precision affecting review.
  const belowMinimum =
    price.isZero() ||
    (category.minimum_margin !== null &&
      price.minus(cost).lt(price.times(category.minimum_margin)));
  return {
    selling_price: price.toFixed(2),
    raw_price: raw.toString(),
    rounded_raw: roundedRaw.toFixed(2),
    after_band_rounding: afterBands?.toFixed(2) ?? null,
    special_correction_applied: correctionApplied,
    margin: margin?.toString() ?? null,
    below_minimum_margin: belowMinimum,
  };
}
