/** Display-only dialog identity. It never enters a business record or request. */
let sequence = 0;

export function beginDialogFeedbackScope(dialog: HTMLDialogElement): string {
  const scope = `dialog-feedback-${++sequence}`;
  dialog.dataset.dialogFeedbackScope = scope;
  return scope;
}

export function endDialogFeedbackScope(dialog: HTMLDialogElement): void {
  delete dialog.dataset.dialogFeedbackScope;
}

export function dialogFeedbackScope(dialog: HTMLDialogElement): string {
  return dialog.dataset.dialogFeedbackScope ?? beginDialogFeedbackScope(dialog);
}

/** Capture the actual open instance before an asynchronous command starts. */
export function currentDialogFeedbackScope(): string | undefined {
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  const dialog = dialogs.item(dialogs.length - 1);
  return dialog ? dialogFeedbackScope(dialog) : undefined;
}
