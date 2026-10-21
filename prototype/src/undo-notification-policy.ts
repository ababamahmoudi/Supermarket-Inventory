/** Audit and History keep all edits; transient Undo is reserved for a final action. */
export function shouldShowUndoNotification(action: string): boolean {
  if (/^(save|edit|add|create|copy|change|turn on)\b/i.test(action))
    return false;
  return (
    /^(remove|stop|approve|reject|send|complete|cancel|close|archive|clear)\b/i.test(
      action,
    ) ||
    /^(confirm supplier|confirm offer|place order|mark as (sent|received|taken care of)|mark ordered|keep approved price|keep barcode mappings|apply price to all branches|turn off date tracking)$/i.test(
      action,
    ) ||
    [
      "note_resolved",
      "note_seen",
      "note_reopened",
      "notebook_entry_seen",
      "notebook_entry_reopened",
      "notebook_entry_done",
      "notebook_archived",
      "expiry_cleared",
    ].includes(action)
  );
}
