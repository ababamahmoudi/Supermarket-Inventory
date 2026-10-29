import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDemo } from "./store";
import { historyActionLabel, historyErrorMessage } from "./history-copy";
import type { UndoToast } from "./undo-queue";
import { dialogFeedbackScope } from "./dialog-feedback";
import { Button, IconButton } from "./ui";
import "./undo-toasts.css";

function UndoToastItem({
  toast,
  inline = false,
}: {
  toast: UndoToast;
  inline?: boolean;
}) {
  const { state, lang, t, undoActivity, pauseUndo, dismissUndo } = useDemo();
  const [error, setError] = useState("");
  useEffect(
    () => (inline ? undefined : () => pauseUndo(toast.id, false)),
    [toast.id, pauseUndo, inline],
  );
  return (
    <div
      className={inline ? "dialog-action-status" : "undo-toast"}
      data-testid={inline ? "dialog-action-status" : "undo-toast"}
      onMouseEnter={() => {
        if (!inline) pauseUndo(toast.id, true);
      }}
      onMouseLeave={(event) => {
        if (!inline && !event.currentTarget.contains(document.activeElement))
          pauseUndo(toast.id, false);
      }}
      onFocus={() => {
        if (!inline) pauseUndo(toast.id, true);
      }}
      onBlur={(event) => {
        if (
          !inline &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !event.currentTarget.matches(":hover")
        )
          pauseUndo(toast.id, false);
      }}
    >
      <span>
        {inline && toast.action === "Approve product"
          ? t("1 product approved", "۱ کالا تأیید شد")
          : inline && toast.action === "Approve price"
            ? t("1 price approved", "۱ قیمت تأیید شد")
            : historyActionLabel(toast.action, lang)}
      </span>
      <Button
        variant="plain"
        className={inline ? "dialog-action-undo" : "undo-toast-link"}
        onClick={() => {
          try {
            void undoActivity(toast.id).catch((caught: unknown) => {
              setError(historyErrorMessage(caught, t, state.config));
            });
          } catch (caught) {
            setError(historyErrorMessage(caught, t, state.config));
          }
        }}
      >
        {t("Undo", "واگرد")}
      </Button>
      {!inline && (
        <IconButton
          aria-label={t("Dismiss Undo message", "بستن پیام واگرد")}
          onClick={() => dismissUndo(toast.id)}
        >
          <X size={18} aria-hidden="true" />
        </IconButton>
      )}
      {error && (
        <span className="undo-toast-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function OwnedDialogFeedback({
  dialog,
  children,
}: {
  dialog: HTMLDialogElement;
  children: ReactNode;
}) {
  // This read precedes the portal commit, while the footer still has no status.
  const [frame] = useState(() => {
    const bounds = dialog.getBoundingClientRect();
    return { top: bounds.top, height: bounds.height };
  });
  useLayoutEffect(() => {
    if (dialog.dataset.dialogFeedbackFrame !== undefined) return;
    dialog.style.setProperty("--dialog-feedback-frame-top", `${frame.top}px`);
    dialog.style.setProperty(
      "--dialog-feedback-frame-height",
      `${frame.height}px`,
    );
    dialog.setAttribute("data-dialog-feedback-frame", "");
  }, [dialog, frame]);
  return (
    <div
      className="dialog-action-feedback"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </div>
  );
}

export default function UndoToasts() {
  const { undoToasts, user, locked, mustChangePassword, t, pauseUndo } =
    useDemo();
  const stackRef = useRef<HTMLElement>(null);
  const [destination, setDestination] = useState<{
    host: HTMLElement;
    dialog: HTMLDialogElement | null;
    scope: string | null;
  }>(() => ({ host: document.body, dialog: null, scope: null }));
  const { host, dialog, scope } = destination;
  const modal = dialog !== null;
  useEffect(() => {
    const chooseHost = () => {
      const dialogs =
        document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      const dialog = dialogs.item(dialogs.length - 1);
      let host = document.body;
      const scope = dialog ? dialogFeedbackScope(dialog) : null;
      if (dialog) {
        const footer = dialog.querySelector<HTMLElement>(
          ".ui-dialog-actions, .dialog-actions, .c3-dialog-actions, .product-editor-actions",
        );
        // A dialog without an action footer never gains an empty feedback band.
        if (footer) {
          let feedback = footer.querySelector<HTMLElement>(
            "[data-dialog-feedback-host]",
          );
          if (!feedback) {
            feedback = document.createElement("div");
            feedback.className = "dialog-action-feedback-host";
            feedback.dataset.dialogFeedbackHost = "";
            footer.prepend(feedback);
          }
          host = feedback;
        }
      }
      setDestination((previous) =>
        previous.host === host &&
        previous.dialog === dialog &&
        previous.scope === scope
          ? previous
          : { host, dialog, scope },
      );
    };
    chooseHost();
    const observer = new MutationObserver(chooseHost);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "data-dialog-feedback-scope"],
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
          ".bottom-bar, .invoice-action-footer, .labels-selection-bar, .sticky-actions, [data-sticky-actions], dialog[open] .dialog-actions, dialog[open] .ui-dialog-actions, dialog[open] .c3-dialog-actions, dialog[open] .product-editor-actions",
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
  // Only the person who did the action is offered its Undo.
  const own = undoToasts.filter(
    (item) => !item.actor_username || item.actor_username === user?.username,
  );
  const visibleId = !locked && !mustChangePassword && own[0]?.id;
  // Keep the existing Undo available until the modal closes. Inline status is
  // separate from the page toast, so neither can cover the modal's content.
  useEffect(() => {
    if (!modal || !visibleId) return;
    pauseUndo(visibleId, true);
    return () => pauseUndo(visibleId, false);
  }, [modal, visibleId, pauseUndo]);
  if (!user || locked || mustChangePassword || !own.length) return null;
  if (modal && (own[0].dialog_scope !== scope || host === document.body))
    return null;
  if (modal)
    return createPortal(
      <OwnedDialogFeedback key={`${scope}:${own[0].id}`} dialog={dialog}>
        <UndoToastItem key={own[0].id} toast={own[0]} inline />
      </OwnedDialogFeedback>,
      host,
    );
  return createPortal(
    <aside
      ref={stackRef}
      className="undo-toast-stack"
      aria-label={t("Recent actions", "کارهای اخیر")}
    >
      <div aria-live="polite" aria-atomic="true">
        <UndoToastItem key={own[0].id} toast={own[0]} />
      </div>
    </aside>,
    host,
  );
}
