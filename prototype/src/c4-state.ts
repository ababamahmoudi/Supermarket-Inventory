import Decimal from "decimal.js";
import { configSeed, demoSeed } from "./config";
import {
  isGeneratedDemoTextOriginal,
  retainDemoOriginal,
} from "./demo-originals";
import type { DemoInvoice, DemoState } from "./types";

export const C4_BACKUP_KEY = "supermarket-prototype-before-c4";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;

function freshPacks(invoice: DemoInvoice) {
  const packs: Record<string, number> = demoSeed.demo_case_packs;
  for (const line of invoice.lines) {
    if (line.sold_by === "weight") continue;
    const pack = packs[line.product_code] ?? 1;
    line.units_per_case = pack;
    line.case_cost_before_tax = new Decimal(line.unit_cost_before_tax)
      .times(pack)
      .toFixed(4);
    const cases = new Decimal(line.qty_invoiced).div(pack);
    const exactCases = cases.decimalPlaces() <= 3;
    line.quantity_unit = exactCases && pack > 1 ? "cases" : "units";
    line.quantity_entered =
      exactCases && pack > 1 ? cases.toFixed() : String(line.qty_invoiced);
  }
}

/** Fresh/reset data may improve fictional starting evidence. A saved user's
 * purchase quantities, packs, prices and invoice snapshots are never rewritten. */
export function hydrateC4State(state: DemoState, fresh = false): DemoState {
  if (state.prototype_c4_schema === 1) return state;
  state.config.weighed_items = {
    ...configSeed.weighed_items,
    ...state.config.weighed_items,
  };
  state.config.returns = { ...configSeed.returns, ...state.config.returns };
  if (state.config.company.seed_key === configSeed.company.seed_key) {
    for (const invoice of [...(state.invoices ?? []), state.invoice]) {
      if (invoice.company_id !== state.config.company.seed_key) continue;
      if (fresh) freshPacks(invoice);
      if (invoice.demo_original_snapshot) continue;
      if (
        isGeneratedDemoTextOriginal(invoice) ||
        (fresh && invoice === state.invoice && !invoice.file_data)
      )
        retainDemoOriginal(invoice, state.config);
    }
  }
  state.prototype_c4_schema = 1;
  return state;
}

function isSavedState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<DemoState>;
  return (
    record.version === 1 &&
    typeof record.config?.company?.seed_key === "string" &&
    Array.isArray(record.products) &&
    Array.isArray(record.approvals) &&
    Array.isArray(record.ledger) &&
    Array.isArray(record.returns) &&
    Boolean(record.invoice && typeof record.invoice === "object")
  );
}

/** Save/read-verify the exact raw original before any C4 changes are published.
 * An existing different backup remains intact; failure returns the untouched state. */
export function restoreC4State(
  state: DemoState,
  storage: StorageAccess,
  rawOriginal = JSON.stringify(state),
): DemoState {
  if (state.prototype_c4_schema === 1) return state;
  try {
    if (!isSavedState(JSON.parse(rawOriginal))) return state;
    const existing = storage.getItem(C4_BACKUP_KEY);
    if (existing !== null && existing !== rawOriginal) return state;
    if (existing === null) storage.setItem(C4_BACKUP_KEY, rawOriginal);
    if (storage.getItem(C4_BACKUP_KEY) !== rawOriginal) return state;
    return hydrateC4State(structuredClone(state));
  } catch {
    return state;
  }
}

/** An explicit recovery helper restores the verified raw backup byte for byte. */
export function restoreC4Backup(
  storage: StorageAccess,
  businessStorageKey: string,
): boolean {
  try {
    const backup = storage.getItem(C4_BACKUP_KEY);
    if (!backup || !isSavedState(JSON.parse(backup))) return false;
    storage.setItem(businessStorageKey, backup);
    return storage.getItem(businessStorageKey) === backup;
  } catch {
    return false;
  }
}
