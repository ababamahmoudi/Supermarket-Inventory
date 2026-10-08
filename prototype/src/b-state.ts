import { hydrateNotebooks } from "./notebooks";
import { hydrateSuppliers } from "./supplier-editor";
import { hydrateLegacyReversals } from "./history";
import type { DemoState } from "./types";

export const B_BACKUP_KEY = "supermarket-prototype-before-b";
export function hydrateBState(state: DemoState): DemoState {
  if (state.prototype_b_schema === 1) return state;
  state.label_waitlist ??= [];
  state.label_settings ??= { recent_price_days: 3, auto_add_approved: false };
  hydrateNotebooks(state);
  hydrateSuppliers(state);
  state.product_code_high_water = Math.max(
    state.product_code_high_water ?? 0,
    ...state.products.map((product) =>
      /^\d+$/.test(product.code) ? Number(product.code) : 0,
    ),
  );
  hydrateLegacyReversals(state);
  state.prototype_b_schema = 1;
  return state;
}
/** An exact, verified and restorable backup precedes the additive B upgrade. */
export function restoreBState(
  state: DemoState,
  storage: Pick<Storage, "getItem" | "setItem">,
): DemoState {
  if (state.prototype_b_schema === 1) return state;
  const backup = JSON.stringify(state);
  try {
    storage.setItem(B_BACKUP_KEY, backup);
    if (storage.getItem(B_BACKUP_KEY) !== backup) return state;
  } catch {
    return state;
  }
  return hydrateBState(structuredClone(state));
}
