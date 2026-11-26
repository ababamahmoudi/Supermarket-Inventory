import { supplierMatches, supplierRecords } from "./supplier-editor";
import type { AuthenticatedActor } from "./authority-types";
import { businessAuditRead } from "./business-audit-read";
import { freshActor } from "./authority";
import { requireCapability } from "./permissions";
import { domainScope } from "./domain-authority";
import {
  supplierBalanceOverview,
  supplierBalanceSummary,
} from "./supplier-balances";
import type { DemoState } from "./types";

/** Financial read model is recomputed from canonical posted evidence under current authority. */
export function payablesBoard(
  state: DemoState,
  actor: AuthenticatedActor,
  supplier: string,
  throughDate?: string,
) {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "payables.read", domainScope(state));
  const registry = supplierRecords(state).filter(
    (record) => record.company_id === actor.company_id,
  );
  const overview = supplierBalanceOverview(state, actor).map((row) => ({
    ...row,
    supplier_id: registry.find((record) =>
      supplierMatches(record, row.supplier),
    )?.id,
  }));
  const selected = overview.find(
    (row) => row.supplier_id === supplier || row.supplier === supplier,
  );
  const selectedSupplier = selected?.supplier ?? "";
  return businessAuditRead({
    overview,
    selectedSupplier,
    summary: supplierBalanceSummary(
      state,
      actor,
      selectedSupplier,
      throughDate,
    ),
    paymentSummary: supplierBalanceSummary(state, actor, selectedSupplier),
    ledger: state.ledger.filter(
      (row) =>
        row.company_id === actor.company_id &&
        (actor.branch === "all" || row.branch === actor.branch),
    ),
  });
}
