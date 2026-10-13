import { createId } from "./ids";
import { OperationError } from "./operations";
import type { DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { requireCapability } from "./permissions";

export function saveDateReminderSettings(
  state: DemoState,
  context: AuthenticatedActor,
  days: number,
): void {
  context = freshActor(state, context);
  requireCapability(state, context, "settings.manage", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
    mutation: true,
  });
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
    actor_username: context.username,
    actor_user_id: context.user_id,
    actor_role: context.role,
    at: new Date().toISOString(),
    reversible: true,
    entity_type: "settings",
    entity_id: "date_tracking",
    before: { expiring_soon_days: before },
    after: { expiring_soon_days: days },
  });
}
