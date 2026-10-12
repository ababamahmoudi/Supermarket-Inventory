import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDemo } from "./store";
import { historyActionLabel, historyErrorMessage } from "./history-copy";
import type { UndoToast } from "./undo-queue";
import { Button, IconButton } from "./ui";
import "./undo-toasts.css";

function UndoToastItem({ toast }: { toast: UndoToast }) {
  const { lang, t, undoActivity, pauseUndo, dismissUndo } = useDemo();
  const [error, setError] = useState("");
  useEffect(() => () => pauseUndo(toast.id, false), [toast.id, pauseUndo]);
  return (
    <div
      className="undo-toast"
      data-testid="undo-toast"
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
        variant="plain"
        className="undo-toast-link"
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
      <IconButton
        aria-label={t("Dismiss Undo message", "بستن پیام واگرد")}
        onClick={() => dismissUndo(toast.id)}
      >
        <X size={18} aria-hidden="true" />
      </IconButton>
      {error && (
        <span className="undo-toast-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default function UndoToasts() {
  const { undoToasts, user, locked, mustChangePassword, t } = useDemo();
  const stackRef = useRef<HTMLElement>(null);
  const [host, setHost] = useState<HTMLElement>(() => document.body);
  useEffect(() => {
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
    if (!stack) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height =
          document.documentElement.clientHeight || window.innerHeight;
        let offset = 24;
        // Reserve the real footer geometry rather than placing a message over its controls.
        for (const bar of document.querySelectorAll<HTMLElement>(
          ".bottom-bar, .invoice-action-footer, .labels-selection-bar, .sticky-actions, [data-sticky-actions], dialog[open] .dialog-actions, dialog[open] .c3-dialog-actions, dialog[open] .product-editor-actions",
        )) {
          const style = getComputedStyle(bar);
          const bounds = bar.getBoundingClientRect();
          if (
            !bounds.height ||
            style.visibility === "hidden" ||
            style.display === "none" ||
            bounds.bottom > height + 2 ||
            bounds.top < 0
          )
            continue;
          if (
            ["fixed", "sticky"].includes(style.position) ||
            bounds.bottom > height - 120
          )
            offset = Math.max(offset, height - bounds.top + 12);
        }
        stack.style.setProperty(
          "--undo-footer-offset",
          `${Math.ceil(offset)}px`,
        );
      });
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      cancelAnimationFrame(frame);
    };
  }, [host, undoToasts.length, user, locked, mustChangePassword]);
  if (!user || locked || mustChangePassword || !undoToasts.length) return null;
  return createPortal(
    <aside
      ref={stackRef}
      className="undo-toast-stack"
      aria-label={t("Recent actions", "کارهای اخیر")}
    >
      <div aria-live="polite" aria-atomic="true">
        <UndoToastItem key={undoToasts[0].id} toast={undoToasts[0]} />
      </div>
    </aside>,
    host,
  );
}
