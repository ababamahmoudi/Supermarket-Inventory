import {
  BrowserAuthorityRepository,
  requireSystemReconciliation,
} from "./authority-repository";
import { sha256Bytes } from "./sha256";
import type { DemoState } from "./types";

/**
 * Ali's 2026-11-15 rule: only 1.49, 2.49 and 3.49 are raised (Grocery and
 * Grocery (Taxable)). Remove the old all-.49 setting and add 1.49 → 1.99 to an
 * untouched default correction list. No stored or approved price changes.
 */
export function upgradePriceEndingRule(state: DemoState): DemoState {
  if (state.price_ending_rule_schema === 2) return state;
  delete (state.config.rounding_bands as Record<string, unknown>)
    .final_ending_adjustment;
  const corrections = state.config.special_corrections.map(
    (entry) => `${entry.from}>${entry.to}`,
  );
  if (corrections.join() === "2.49>2.99,3.49>3.99")
    state.config.special_corrections.unshift({ from: "1.49", to: "1.99" });
  state.price_ending_rule_schema = 2;
  return state;
}

const hash = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
class MigrationChanged extends Error {}

/** Verified private backup and revision comparison precede the upgrade. */
export async function migratePriceEndingRule(
  repository: BrowserAuthorityRepository,
  companyId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const loaded = await repository.loadBusiness<DemoState>(companyId);
    if (loaded.state.price_ending_rule_schema === 2) return;
    const raw = JSON.stringify(loaded.state);
    await repository.archivePrivateBackup(
      {
        id: `price-ending-rule:${companyId}:${loaded.revision}:${hash(raw)}`,
        company_id: companyId,
        source_key: `business:${companyId}:revision:${loaded.revision}`,
        raw,
        sha256: hash(raw),
        created_at: new Date().toISOString(),
      },
      hash,
    );
    try {
      await repository.runSystemReconciliation<DemoState, void>(
        companyId,
        "pricing_rule_migration",
        (state, attribution) => {
          requireSystemReconciliation(
            state,
            attribution,
            "pricing_rule_migration",
          );
          if (state.price_ending_rule_schema === 2) return;
          if (JSON.stringify(state) !== raw) throw new MigrationChanged();
          upgradePriceEndingRule(state);
        },
      );
      return;
    } catch (error) {
      if (!(error instanceof MigrationChanged)) throw error;
    }
  }
  throw new Error("migration_conflict");
}
