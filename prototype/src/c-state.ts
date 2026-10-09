import { configSeed } from "./config";
import { ensureBuiltInLabelTemplates } from "./labels";
import { hydrateManualPriceMarkers } from "./manual-prices";
import { branchId } from "./settings";
import type { DemoState } from "./types";

export const C1_BACKUP_KEY = "supermarket-prototype-before-c1";

/** Add C records without replacing saved names, passwords or operational history. */
export function hydrateCState(state: DemoState): DemoState {
  if (state.prototype_c1_schema === 1) return state;
  if (state.config.company.seed_key === configSeed.company.seed_key) {
    for (const source of configSeed.branches) {
      const index = state.config.branches.findIndex(
        (branch) => branch.code === source.code,
      );
      if (index < 0) {
        if (
          !state.config.branches.some(
            (branch, position) => branchId(branch, position) === source.id,
          )
        )
          state.config.branches.push(structuredClone(source));
        continue;
      }
      const branch = state.config.branches[index];
      branch.id ??= branchId(branch, index);
      const placeholder = /^Branch \d+(?:\s*\(PLACEHOLDER.*\))?$/i.test(
        branch.name_en,
      );
      if (placeholder) {
        branch.name = source.name;
        branch.name_en = source.name_en;
        if (
          /^(?:شعبه\s*\d+|Branch \d+(?:\s*\(PLACEHOLDER.*\))?)$/.test(
            branch.name_fa,
          )
        )
          branch.name_fa = source.name_fa;
      }
      branch.type ??= source.type;
    }
  }
  state.invoice_location_corrections ??= [];
  hydrateManualPriceMarkers(state);
  ensureBuiltInLabelTemplates(state);
  state.prototype_c1_schema = 1;
  return state;
}

/** Keep an exact restorable copy before the first additive C migration. */
export function restoreCState(
  state: DemoState,
  storage: Pick<Storage, "getItem" | "setItem">,
): DemoState {
  if (state.prototype_c1_schema === 1) return state;
  const backup = JSON.stringify(state);
  try {
    storage.setItem(C1_BACKUP_KEY, backup);
    if (storage.getItem(C1_BACKUP_KEY) !== backup) return state;
  } catch {
    return state;
  }
  return hydrateCState(structuredClone(state));
}
