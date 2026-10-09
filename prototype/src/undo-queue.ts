export interface UndoToast {
  id: string;
  actor_username?: string;
  action: string;
  remaining: number;
  running_since: number | null;
}
export const UNDO_DURATION = 5_000;
export function remainingTime(toast: UndoToast, now: number): number {
  return Math.max(
    0,
    toast.remaining -
      (toast.running_since === null
        ? 0
        : Math.max(0, now - toast.running_since)),
  );
}
export function addUndoToast(
  queue: UndoToast[],
  toast: Pick<UndoToast, "id" | "action" | "actor_username">,
  now: number,
): UndoToast[] {
  return [
    { ...toast, remaining: UNDO_DURATION, running_since: now },
    ...queue.filter(
      (item) => item.id !== toast.id && remainingTime(item, now) > 0,
    ),
  ];
}
export function pauseUndoToast(
  queue: UndoToast[],
  id: string,
  paused: boolean,
  now: number,
): UndoToast[] {
  return queue.map((item) =>
    item.id !== id || (item.running_since === null) === paused
      ? item
      : {
          ...item,
          remaining: remainingTime(item, now),
          running_since: paused ? null : now,
        },
  );
}
export function expireUndoToasts(queue: UndoToast[], now: number): UndoToast[] {
  return queue.filter((item) => remainingTime(item, now) > 0);
}
