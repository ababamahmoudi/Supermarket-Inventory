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
  return businessAuditRead({
    overview: supplierBalanceOverview(state, actor),
    summary: supplierBalanceSummary(state, actor, supplier, throughDate),
    paymentSummary: supplierBalanceSummary(state, actor, supplier),
    ledger: state.ledger.filter(
      (row) =>
        row.company_id === actor.company_id &&
        (actor.branch === "all" || row.branch === actor.branch),
    ),
  });
}
