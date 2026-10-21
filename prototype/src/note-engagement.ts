import type { AuthenticatedActor } from "./authority-types";

/** Reader identity is stable; names are the genuine label at the action time. */
export interface NoteSeenReceipt {
  id: string;
  user_id: string;
  by: string;
  at: string;
}

export interface NoteEngagement {
  seen_receipts?: NoteSeenReceipt[];
  done_by?: string;
  done_by_user_id?: string;
  done_at?: string;
}

/** The caller must first authorize the current canonical note and reader. */
export function appendSeenReceipt(
  record: NoteEngagement & { id: string },
  actor: AuthenticatedActor,
  now = new Date(),
): NoteSeenReceipt | null {
  if (
    record.seen_receipts?.some((receipt) => receipt.user_id === actor.user_id)
  )
    return null;
  const receipt = {
    id: `${record.id}:${actor.user_id}`,
    user_id: actor.user_id,
    by: actor.actor,
    at: now.toISOString(),
  };
  (record.seen_receipts ??= []).push(receipt);
  return receipt;
}

export function recordNoteCompletion(
  record: NoteEngagement,
  actor: AuthenticatedActor,
  completed: boolean,
  now = new Date(),
): void {
  if (completed) {
    record.done_by = actor.actor;
    record.done_by_user_id = actor.user_id;
    record.done_at = now.toISOString();
  } else {
    delete record.done_by;
    delete record.done_by_user_id;
    delete record.done_at;
  }
}
