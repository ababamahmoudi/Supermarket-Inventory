import type { DemoState } from "./types";

export const C2_BACKUP_KEY = "supermarket-prototype-before-c2";

/** Empty operational collections never invent orders, transfers or purchases. */
export function hydrateC2State(state: DemoState): DemoState {
  if (state.prototype_c2_schema === 1) return state;
  state.config.orders ??= { allow_floor_worker: false };
  state.supplier_items ??= [];
  state.orders ??= [];
  state.branch_requests ??= [];
  state.request_transfer_events ??= [];
  state.prototype_c2_schema = 1;
  return state;
}

/** Save and read back the exact original before changing a saved C1 demo. */
export function restoreC2State(
  state: DemoState,
  storage: Pick<Storage, "getItem" | "setItem">,
): DemoState {
  if (state.prototype_c2_schema === 1) return state;
  const backup = JSON.stringify(state);
  try {
    storage.setItem(C2_BACKUP_KEY, backup);
    if (storage.getItem(C2_BACKUP_KEY) !== backup) return state;
  } catch {
    return state;
  }
  return hydrateC2State(structuredClone(state));
}
