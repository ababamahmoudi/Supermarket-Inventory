import type { AuthenticatedActor, RoleId } from "./authority-types";
import { createId } from "./ids";
import { directoryRecipients } from "./permissions";
import type { NotebookDefinition, NotebookEntry } from "./notebooks";
import type { DemoState, NoteRecord } from "./types";
import { notificationReadable } from "./notification-access";

const defaultRecipients: RoleId[] = ["owner", "manager", "branch_supervisor"];

function notifyReaders(
  state: DemoState,
  record: NoteRecord | NotebookEntry,
  roles: readonly RoleId[],
  notebook?: NotebookDefinition,
): void {
  for (const recipient of directoryRecipients(state, {
    roles,
    capability: notebook ? "notebooks.read" : "notes.read",
    location_ids: [record.branch],
  })) {
    if (
      notebook &&
      !["owner", "manager"].includes(recipient.role) &&
      !notebook.read_roles.includes(recipient.role)
    )
      continue;
    const kind = notebook ? "notebook_entry_added" : "note_added";
    const event_key = `${kind}:${record.id}:${recipient.user_id}`;
    if (
      state.notifications?.some(
        (notice) =>
          notice.company_id === record.company_id &&
          notice.event_key === event_key,
      )
    )
      continue;
    (state.notifications ??= []).push({
      id: createId("note-notification"),
      company_id: record.company_id,
      branch: record.branch,
      event_key,
      recipient_user_id: recipient.user_id,
      target_username: recipient.username,
      kind,
      ...(notebook ? { notebook_entry_id: record.id } : { note_id: record.id }),
      href: `#notes?${notebook ? "entry" : "note"}=${encodeURIComponent(record.id)}`,
      created_at: record.created_at,
    });
  }
}

export function notifyBuiltinNote(state: DemoState, note: NoteRecord): void {
  const kind =
    note.type === "note_to_supervisor" ? "for_supervisor" : note.type;
  const definition = state.config.notebooks.built_in.find(
    (record) => record.kind === kind,
  );
  if (!definition?.notify_supervisor) return;
  notifyReaders(state, note, definition.notify_roles ?? defaultRecipients);
}

export function notifyNotebookEntry(
  state: DemoState,
  entry: NotebookEntry,
  notebook: NotebookDefinition,
): void {
  if (notebook.notify_supervisor)
    notifyReaders(
      state,
      entry,
      notebook.notify_roles ?? defaultRecipients,
      notebook,
    );
}

/** Seen acknowledges only this reader's linked, currently readable bell rows. */
export function markLinkedNoteNotificationsRead(
  state: DemoState,
  actor: AuthenticatedActor,
  record: NoteRecord | NotebookEntry,
  now = new Date(),
): void {
  for (const notice of state.notifications ?? []) {
    const linked =
      "notebook_id" in record
        ? notice.notebook_entry_id === record.id
        : notice.note_id === record.id ||
          (notice.kind === "sale_delivery_release" &&
            state.sale_delivery_holds?.some(
              (hold) =>
                hold.company_id === record.company_id &&
                hold.note_id === record.id &&
                hold.sale_id === notice.sale_id &&
                hold.invoice_id === notice.invoice_id,
            ));
    if (linked && notificationReadable(state, actor, notice))
      notice.read_at ??= now.toISOString();
  }
}
