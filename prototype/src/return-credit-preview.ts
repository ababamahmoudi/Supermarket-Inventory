import Decimal from "decimal.js";
import { freshActor } from "./authority";
import type { AuthenticatedActor } from "./authority-types";
import { can, requireCapability } from "./permissions";
import { domainScope, selectedLocations } from "./domain-authority";
import { returnUiStatus } from "./return-workflow";
import { companyDate } from "./invoice";
import type { DemoState } from "./types";
import { groupedReturnLineAmount } from "./invoice-free-acquisition";

export interface AwaitingPickupReturnCredit {
  return_id: string;
  supplier: string;
  branch: string;
  created_at: string;
  amount: string;
  currency: string;
  currency_mismatch: boolean;
  deducted: false;
}
/** Informational only: no pickup, pending-credit deduction or ledger posting is inferred. */
export function awaitingPickupReturnCredits(
  state: DemoState,
  actor: AuthenticatedActor,
  throughDate?: string,
): AwaitingPickupReturnCredit[] {
  actor = freshActor(state, actor);
  requireCapability(state, actor, "returns.amount_read", domainScope(state));
  const locations = new Set(selectedLocations(state, actor, true));
  return state.returns
    .filter(
      (record) =>
        record.company_id === actor.company_id &&
        record.creation_request_id &&
        record.currency &&
        locations.has(record.branch) &&
        returnUiStatus(record) === "waiting_for_pickup" &&
        record.created_at &&
        (!throughDate ||
          companyDate(state.config, new Date(record.created_at)) <=
            throughDate) &&
        can(state, actor, "returns.amount_read", domainScope(state, record))
          .allowed,
    )
    .map((record) => ({
      return_id: record.id,
      supplier: record.supplier,
      branch: record.branch,
      created_at: record.created_at!,
      currency: record.currency!,
      currency_mismatch: record.currency !== state.config.company.currency,
      deducted: false as const,
      amount: record.lines
        .reduce(
          (sum, line) =>
            sum.plus(
              groupedReturnLineAmount(line) ??
                new Decimal(line.unit_cost!).times(line.qty),
            ),
          new Decimal(0),
        )
        .toFixed(2, Decimal.ROUND_HALF_UP),
    }));
}
