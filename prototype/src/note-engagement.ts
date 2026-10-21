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

/**
 * Who may mark a notebook's notes done (Ali, Oct 2026). "anyone" keeps the
 * notebook's normal rule (people who can add notes); "chosen" limits Done to
 * the listed roles and people, who must still be able to read the note.
 */
export interface NoteDoneRule {
  mode: "anyone" | "chosen";
  roles: AuthenticatedActor["role"][];
  user_ids: string[];
}
export function normalizeDoneRule(
  rule: NoteDoneRule | undefined,
): NoteDoneRule | undefined {
  if (!rule || rule.mode !== "chosen") return undefined;
  return {
    mode: "chosen",
    roles: [...new Set(rule.roles)],
    user_ids: [...new Set(rule.user_ids.filter(Boolean))],
  };
}
/** "default" means: use the notebook's normal permission. */
export function doneRuleDecision(
  rule: NoteDoneRule | undefined,
  actor: Pick<AuthenticatedActor, "role" | "user_id">,
): "default" | "allowed" | "denied" {
  const chosen = normalizeDoneRule(rule);
  if (!chosen) return "default";
  return chosen.roles.includes(actor.role) ||
    chosen.user_ids.includes(actor.user_id)
    ? "allowed"
    : "denied";
}
/** The author of a note cannot mark their own note as seen. */
export function isNoteAuthor(
  record: { by_user_id?: string; actor_user_id?: string },
  actor: Pick<AuthenticatedActor, "user_id">,
): boolean {
  const author = record.by_user_id ?? record.actor_user_id;
  return Boolean(author) && author === actor.user_id;
}
