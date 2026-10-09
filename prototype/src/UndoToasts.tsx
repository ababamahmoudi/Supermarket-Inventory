import { useState } from "react";
import { useDemo } from "./store";
import { historyActionLabel, historyErrorMessage } from "./history-copy";
import type { UndoToast } from "./undo-queue";
import "./undo-toasts.css";

function UndoToastItem({
  toast,
  hidden,
}: {
  toast: UndoToast;
  hidden: boolean;
}) {
  const { lang, t, undoActivity, pauseUndo } = useDemo();
  const [error, setError] = useState("");
  return (
    <div
      className="undo-toast"
      data-testid="undo-toast"
      hidden={hidden}
      onMouseEnter={() => pauseUndo(toast.id, true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement))
          pauseUndo(toast.id, false);
      }}
      onFocus={() => pauseUndo(toast.id, true)}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.matches(":hover")
        )
          pauseUndo(toast.id, false);
      }}
    >
      <span>{historyActionLabel(toast.action, lang)}</span>
      <button
        className="undo-toast-link"
        type="button"
        onClick={() => {
          try {
            undoActivity(toast.id);
          } catch (caught) {
            setError(historyErrorMessage(caught, t));
          }
        }}
      >
        {t("Undo", "واگرد")}
      </button>
      {error && (
        <span className="undo-toast-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default function UndoToasts() {
  const { undoToasts, user, locked, mustChangePassword, t, tCount } = useDemo();
  if (!user || locked || mustChangePassword || !undoToasts.length) return null;
  const extra = Math.max(0, undoToasts.length - 3);
  return (
    <aside
      className="undo-toast-stack"
      aria-label={t("Recent actions", "کارهای اخیر")}
    >
      <div aria-live="polite" aria-atomic="false" className="undo-toast-items">
        {undoToasts.map((toast, index) => (
          <UndoToastItem key={toast.id} toast={toast} hidden={index >= 3} />
        ))}
      </div>
      {extra > 0 && (
        <span className="undo-toast-more">
          {tCount(
            "+{{count}} more",
            "+{{count}} more",
            "+{{count}} مورد دیگر",
            "+{{count}} مورد دیگر",
            extra,
          )}
        </span>
      )}
    </aside>
  );
}
