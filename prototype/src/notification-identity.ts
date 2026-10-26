import type { NotificationRecord } from "./sales";
import type { DemoState } from "./types";

/** Only a real shared decision joins branch tasks. Same product/time alone never does. */
export function notificationGroupIdentity(
  state: DemoState,
  row: NotificationRecord,
): string {
  if (
    row.kind === "price_update_created" ||
    row.kind === "price_update_reminder"
  ) {
    const task = state.price_update_tasks?.find(
      (task) =>
        task.company_id === row.company_id &&
        task.id === row.task_id &&
        task.branch === row.branch &&
        task.product_code === row.product_code,
    );
    const prefix =
      row.kind === "price_update_created"
        ? "price-task:"
        : "price-task-reminder:";
    const version = task?.steps.find(
      (step) =>
        row.event_key ===
        `${prefix}${task.id}:${step.version}:${row.recipient_user_id}`,
    );
    const source =
      version?.source_activity_id &&
      state.activity.find(
        (entry) =>
          entry.company_id === row.company_id &&
          entry.id === version.source_activity_id,
      );
    if (source)
      return JSON.stringify([
        row.kind,
        row.company_id,
        row.product_code,
        source.id,
        version.effective_at,
      ]);
    // Legacy/unattributed events keep their exact identity rather than inventing a decision.
    return JSON.stringify([
      row.kind,
      row.company_id,
      task?.id ?? row.id,
      version?.version ?? row.id,
    ]);
  }
  return JSON.stringify([row.company_id, row.id]);
}
