import { configSeed } from "./config";
import {
  BrowserAuthorityRepository,
  requireSystemReconciliation,
} from "./authority-repository";
import { sha256Bytes } from "./sha256";
import type { DemoState } from "./types";

/** Additive defaults only: no products, prices, names or barcodes are rewritten. */
export function initializePackageState(state: DemoState): DemoState {
  if (state.prototype_r2e_package_schema === 1) return state;
  state.config.weighed_items ??= structuredClone(configSeed.weighed_items);
  for (const key of [
    "package_container_fee",
    "package_container_cost",
    "package_barcode_prefix",
    "ounces_per_lb",
  ] as const)
    state.config.weighed_items[key] ??= configSeed.weighed_items[key];
  state.prototype_r2e_package_schema = 1;
  return state;
}
const hash = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
class MigrationChanged extends Error {}

/** Verified exact private backup and revision comparison precede the upgrade. */
export async function migratePackageState(
  repository: BrowserAuthorityRepository,
  companyId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const loaded = await repository.loadBusiness<DemoState>(companyId);
    if (loaded.state.prototype_r2e_package_schema === 1) return;
    const raw = JSON.stringify(loaded.state);
    await repository.archivePrivateBackup(
      {
        id: `r2e-packages:${companyId}:${loaded.revision}:${hash(raw)}`,
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
        "packages_migration",
        (state, attribution) => {
          requireSystemReconciliation(state, attribution, "packages_migration");
          if (state.prototype_r2e_package_schema === 1) return;
          if (JSON.stringify(state) !== raw) throw new MigrationChanged();
          initializePackageState(state);
        },
      );
      return;
    } catch (error) {
      if (!(error instanceof MigrationChanged)) throw error;
    }
  }
  throw new Error("migration_conflict");
}
