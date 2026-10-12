import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDemo } from "./store";
import { historyActionLabel, historyErrorMessage } from "./history-copy";
import type { UndoToast } from "./undo-queue";
import { Button } from "./ui";
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
  useEffect(() => () => pauseUndo(toast.id, false), [toast.id, pauseUndo]);
  useEffect(() => {
    // A hovered/focused item can become the hidden fourth item after another
    // action. Hidden items must keep counting down instead of staying paused.
    if (hidden && toast.running_since === null) pauseUndo(toast.id, false);
  }, [hidden, toast.id, toast.running_since, pauseUndo]);
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
      <Button
        variant="secondary"
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
      </Button>
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
  const stackRef = useRef<HTMLElement>(null);
  const [host, setHost] = useState<HTMLElement>(() => document.body);
  useEffect(() => {
    // showModal dialogs live above every CSS stacking context. Keeping the
    // stack in the active dialog also keeps Undo inside its keyboard boundary.
    const chooseHost = () => {
      const dialogs =
        document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      setHost(dialogs.item(dialogs.length - 1) ?? document.body);
    };
    chooseHost();
    const observer = new MutationObserver(chooseHost);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const stack = stackRef.current;
    if (!(host instanceof HTMLDialogElement) || !stack) return;
    // Phone dialogs need scrollable space below their actions so the fixed
    // Undo stack remains accessible without covering Save or confirmation.
    const reserveSpace = () =>
      host.style.setProperty(
        "--undo-toast-block-size",
        `${Math.max(64, Math.ceil(stack.getBoundingClientRect().height))}px`,
      );
    reserveSpace();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(reserveSpace);
    observer?.observe(stack);
    return () => {
      observer?.disconnect();
      host.style.removeProperty("--undo-toast-block-size");
    };
  }, [host, undoToasts.length, user, locked, mustChangePassword]);
  if (!user || locked || mustChangePassword || !undoToasts.length) return null;
  const extra = Math.max(0, undoToasts.length - 3);
  return createPortal(
    <aside
      ref={stackRef}
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
    </aside>,
    host,
  );
}
