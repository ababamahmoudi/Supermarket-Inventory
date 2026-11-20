import { configSeed } from "./config";
import {
  BrowserAuthorityRepository,
  requireSystemReconciliation,
} from "./authority-repository";
import { sha256Bytes } from "./sha256";
import type { DemoState } from "./types";

/** Additive defaults only. Existing stores never gain fictional staff or shifts. */
export function initializeTimesheetState(state: DemoState): DemoState {
  if (state.prototype_r2d_timesheet_schema === 1) return state;
  state.config.modules.timesheets ??= configSeed.modules.timesheets;
  state.config.timesheets ??= structuredClone(configSeed.timesheets);
  for (const role of state.config.roles) {
    const source = configSeed.roles.find((item) => item.key === role.key);
    if (source?.capabilities && !role.capabilities)
      role.capabilities = structuredClone(source.capabilities);
  }
  state.timesheet_staff ??= [];
  state.timesheet_days ??= [];
  state.timesheet_rows ??= [];
  state.prototype_r2d_timesheet_schema = 1;
  return state;
}
const hash = (raw: string) => sha256Bytes(new TextEncoder().encode(raw));
class MigrationChanged extends Error {}
/** Verify an exact restorable private backup before changing an existing IDB state. */
export async function migrateTimesheetState(
  repository: BrowserAuthorityRepository,
  companyId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const loaded = await repository.loadBusiness<DemoState>(companyId);
    if (loaded.state.prototype_r2d_timesheet_schema === 1) return;
    const raw = JSON.stringify(loaded.state);
    await repository.archivePrivateBackup(
      {
        id: `r2d-timesheets:${companyId}:${loaded.revision}:${hash(raw)}`,
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
        "timesheets_migration",
        (state, attribution) => {
          requireSystemReconciliation(
            state,
            attribution,
            "timesheets_migration",
          );
          if (state.prototype_r2d_timesheet_schema === 1) return;
          if (JSON.stringify(state) !== raw) throw new MigrationChanged();
          initializeTimesheetState(state);
        },
      );
      return;
    } catch (error) {
      if (!(error instanceof MigrationChanged)) throw error;
    }
  }
  throw new Error("migration_conflict");
}
