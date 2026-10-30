import { configSeed } from "./config";

export type FinalEndingAdjustment = {
  source_endings: string[];
  target_ending: string;
};

export type RoundingBands = Omit<
  typeof configSeed.rounding_bands,
  "final_ending_adjustment"
> & {
  /** Missing legacy settings inherit the configured default; null disables it. */
  final_ending_adjustment?: FinalEndingAdjustment | null;
};

/** Resolve defaults without migrating records or changing any stored price. */
export function effectiveRoundingBands(config: {
  rounding_bands: RoundingBands;
}) {
  return {
    ...config.rounding_bands,
    final_ending_adjustment:
      config.rounding_bands.final_ending_adjustment === undefined
        ? configSeed.rounding_bands.final_ending_adjustment
        : config.rounding_bands.final_ending_adjustment,
  };
}
