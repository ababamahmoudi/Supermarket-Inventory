import { createId } from "./ids";
import { OperationError, type OperationsContext } from "./operations";
import type { DemoState } from "./types";

export function saveDateReminderSettings(
  state: DemoState,
  context: OperationsContext,
  days: number,
): void {
  if (context.role !== "supervisor") throw new OperationError("supervisor");
  if (context.company_id !== state.config.company.seed_key)
    throw new OperationError("scope");
  if (!Number.isSafeInteger(days) || days < 0)
    throw new Error("Enter zero or more whole days.");
  const before = state.config.expiry.expiring_soon_days;
  if (before === days) return;
  state.config.expiry.expiring_soon_days = days;
  state.activity.unshift({
    id: createId("date-reminder-settings"),
    company_id: context.company_id,
    branch: "all",
    scope: "all",
    action: "Date tracking settings changed",
    by: context.actor,
    at: new Date().toISOString(),
    reversible: true,
    entity_type: "settings",
    entity_id: "date_tracking",
    before: { expiring_soon_days: before },
    after: { expiring_soon_days: days },
  });
}
