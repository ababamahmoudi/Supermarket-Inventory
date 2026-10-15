import { configSeed } from "./config";
import { initialState, loadInitialBusiness } from "./e1-bootstrap";
import {
  createReadModel,
  signedOutReadView,
  type ReadModelProjectors,
} from "./e1-read-model";
import {
  configuredDemoPeople,
  configuredDemoComputers,
} from "./e1-seed-fixtures";
import {
  migrateE1BusinessAttribution,
  migrateE1BusinessState,
} from "./e1-state-migration";
import { autoAddApprovedLabelChanges } from "./label-workflow";
import { evaluateSales } from "./sales";
import { syncReturnCreditAlerts } from "./return-workflow";
import { syncDateReminderAlerts } from "./date-tracking";
import type { DemoState } from "./types";
import {
  historyRecoveryStatus,
  prepareHistoryRecoveryReset,
  finishHistoryRecoveryReset,
} from "./history-recovery.e1";
import type {
  SystemAttribution,
  SystemReconciliationSource,
} from "./authority-types";

/** Required concrete adapters are assembled once after all E1 domain modules are installed. */
export function browserShellOptions(projectors: ReadModelProjectors) {
  const computers = configuredDemoComputers();
  return {
    companyId: configSeed.company.seed_key,
    loadInitialBusiness,
    historyRecovery: {
      status: historyRecoveryStatus,
      prepareReset: prepareHistoryRecoveryReset,
      finishReset: (
        controller: Parameters<typeof finishHistoryRecoveryReset>[0],
      ) => finishHistoryRecoveryReset(controller, configSeed.company.seed_key),
    },
    migrateInitialAttribution: migrateE1BusinessAttribution,
    freshDemoBusiness: async () => migrateE1BusinessState(initialState()),
    demoUsers: configuredDemoPeople(),
    configuredComputers: computers,
    defaultComputerId: computers.length === 1 ? computers[0].id : null,
    projectView: createReadModel(projectors),
    signedOutView: (state?: DemoState) =>
      signedOutReadView(state?.config ?? configSeed),
    systemJobs: [
      { source: "sales_clock", apply: evaluateSales },
      { source: "date_reminders", apply: syncDateReminderAlerts },
      { source: "return_credit_reminders", apply: syncReturnCreditAlerts },
    ] satisfies readonly {
      source: SystemReconciliationSource;
      apply(state: DemoState, attribution: SystemAttribution): void;
    }[],
    prepareCommit: (
      draft: Parameters<typeof autoAddApprovedLabelChanges>[1],
      before: Parameters<typeof autoAddApprovedLabelChanges>[0],
      actor: Parameters<typeof autoAddApprovedLabelChanges>[2],
    ) => autoAddApprovedLabelChanges(before, draft, actor),
  };
}
