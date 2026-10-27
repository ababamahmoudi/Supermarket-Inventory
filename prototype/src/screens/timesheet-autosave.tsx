import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, Check } from "lucide-react";
import { BufferedInput, BufferedTextarea, Button, usePopover } from "../ui";
import { useDemo } from "../store";
import { parseTimesheetTime } from "../timesheets";
import { beginAppWork } from "../app-work";

import { TimesheetSaveContext } from "./timesheet-save-context";

/** Local typing is never replaced by a slower canonical save echo. */
export function TimesheetSavedField({
  id,
  value,
  save,
  time = false,
  label,
  now,
  multiline = false,
  minHeight,
}: {
  id: string;
  value: string;
  save: (value: string) => Promise<unknown>;
  time?: boolean;
  label: string;
  now?: () => string;
  multiline?: boolean;
  minHeight?: number;
}) {
  const { t } = useDemo();
  const registry = useContext(TimesheetSaveContext);
  const {
    open: suggestionOpen,
    show: showSuggestion,
    close: closeSuggestion,
    position: suggestionPosition,
    portalTarget: suggestionPortalTarget,
    triggerRef: suggestionTriggerRef,
    popupRef: suggestionPopupRef,
  } = usePopover<HTMLInputElement>(150, { minimumHeight: 56, gap: 6 });
  const nowOption = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(multiline);
  const raw = useRef(value),
    dirty = useRef(false),
    focused = useRef(false);
  const version = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(save),
    editingCallback = useRef(save),
    queue = useRef(Promise.resolve(true));
  const lastCommitted = useRef(value),
    alive = useRef(true);
  const releaseWork = useRef<null | (() => void)>(null);
  const pendingEntry = useRef<{
    version: number;
    value: string;
    promise: Promise<boolean>;
  } | null>(null);
  useEffect(() => {
    callback.current = save;
  }, [save]);
  useEffect(() => {
    if (!dirty.current && !focused.current) {
      raw.current = value;
      setText(value);
      lastCommitted.current = value;
    }
  }, [value]);
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return queue.current;
    const input = raw.current;
    const normalized = time ? parseTimesheetTime(input) : input;
    if (normalized === null) {
      if (alive.current)
        setError(
          t(
            "Enter a 24-hour time, such as 07:30 or 1915.",
            "زمان ۲۴ ساعته مانند 07:30 یا 1915 وارد کنید.",
          ),
        );
      return false;
    }
    const ownVersion = version.current;
    if (
      pendingEntry.current?.version === ownVersion &&
      pendingEntry.current.value === normalized
    )
      return pendingEntry.current.promise;
    if (normalized === lastCommitted.current && !pendingEntry.current) {
      // A completed failure is no longer pending when the saved value is restored.
      queue.current = Promise.resolve(true);
      dirty.current = false;
      releaseWork.current?.();
      releaseWork.current = null;
      if (alive.current) {
        if (!focused.current) {
          raw.current = normalized;
          setText(normalized);
        }
        setError("");
      }
      return queue.current;
    }
    // Capture the edit's callback before any queued predecessor can settle.
    const commit = editingCallback.current;
    const operation = queue.current
      .catch(() => false)
      .then(async () => {
        if (alive.current) setSaving(true);
        try {
          await commit(normalized);
          lastCommitted.current = normalized;
          if (ownVersion === version.current) {
            dirty.current = false;
            releaseWork.current?.();
            releaseWork.current = null;
            if (alive.current) {
              setError("");
              setSaved(true);
              if (!focused.current) {
                raw.current = normalized;
                setText(normalized);
              }
            }
          }
          return true;
        } catch {
          if (alive.current)
            setError(
              t(
                "Could not save. Your entry is kept here; try again.",
                "ذخیره نشد. نوشته شما اینجا نگه داشته شده است؛ دوباره تلاش کنید.",
              ),
            );
          return false;
        } finally {
          if (pendingEntry.current?.version === ownVersion)
            pendingEntry.current = null;
          if (alive.current) setSaving(false);
        }
      });
    queue.current = operation;
    pendingEntry.current = {
      version: ownVersion,
      value: normalized,
      promise: operation,
    };
    return operation;
  }, [time, t]);
  useEffect(() => registry?.register(id, flush), [registry, id, flush]);
  const teardownFlush = useRef(flush);
  useEffect(() => {
    teardownFlush.current = flush;
  }, [flush]);
  useEffect(() => {
    alive.current = true;
    const protectUnload = (event: BeforeUnloadEvent) => {
      if (!dirty.current && !pendingEntry.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnload);
    return () => {
      alive.current = false;
      // DOM removal need not blur a focused input. Drain its valid edit without
      // touching the retired UI, and keep reload protection through the queue.
      void Promise.all([teardownFlush.current(), queue.current]).finally(() => {
        window.removeEventListener("beforeunload", protectUnload);
        releaseWork.current?.();
        releaseWork.current = null;
      });
    };
  }, []);
  const change = (next: string) => {
    raw.current = next;
    editingCallback.current = callback.current;
    dirty.current = true;
    releaseWork.current ??= beginAppWork();
    version.current += 1;
    setText(next);
    setError("");
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, 350);
  };
  const blur = () => {
    focused.current = false;
    const normalized = time ? parseTimesheetTime(raw.current) : raw.current;
    if (normalized !== null) {
      raw.current = normalized;
      setText(normalized);
    }
    void flush();
  };
  const common = {
    id,
    value: text,
    "aria-label": label,
    "aria-invalid": Boolean(error),
    "aria-describedby": `${id}-status`,
    onFocus: () => {
      focused.current = true;
      if (time && now && !raw.current.trim()) showSuggestion();
    },
    onBlur: blur,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      change(event.target.value);
      if (time && event.target.value.trim()) closeSuggestion();
      else if (time && now) showSuggestion();
    },
  };
  return (
    <div className={`timesheet-saved-field${time ? " is-time" : ""}`}>
      {multiline ? (
        <BufferedTextarea
          {...common}
          className="ui-input"
          rows={2}
          minHeight={minHeight}
        />
      ) : (
        <BufferedInput
          {...common}
          ref={suggestionTriggerRef}
          className="ui-input"
          type="text"
          inputMode={time ? "numeric" : undefined}
          dir={time ? "ltr" : undefined}
          autoComplete="off"
          placeholder={time ? "--:--" : undefined}
          aria-haspopup={time && now ? "listbox" : undefined}
          aria-expanded={
            time && now ? suggestionOpen && !text.trim() : undefined
          }
          aria-controls={time && now ? `${id}-now` : undefined}
          onKeyDown={(event) => {
            if (
              event.key === "ArrowDown" &&
              suggestionOpen &&
              !raw.current.trim()
            ) {
              event.preventDefault();
              nowOption.current?.focus();
            }
          }}
        />
      )}
      {now &&
        suggestionOpen &&
        !text.trim() &&
        createPortal(
          <div
            ref={suggestionPopupRef}
            id={`${id}-now`}
            role="listbox"
            aria-label={t("Suggested time", "زمان پیشنهادی")}
            className="ui-popover timesheet-now-popover"
            style={suggestionPosition}
          >
            <button
              ref={nowOption}
              type="button"
              role="option"
              aria-selected="false"
              className="ui-option timesheet-now"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                change(now());
                focused.current = false;
                closeSuggestion(true);
                void flush();
              }}
            >
              <Clock size={16} aria-hidden="true" />
              <span>{t("Now", "اکنون")}</span>
              <bdi dir="ltr">{now()}</bdi>
            </button>
          </div>,
          suggestionPortalTarget ?? document.body,
        )}
      <span
        id={`${id}-status`}
        className={`timesheet-save-state${error ? " form-error" : " muted"}`}
        aria-live="polite"
      >
        {error ? (
          <Button
            variant="plain"
            className="timesheet-retry"
            title={error}
            aria-label={`${t("Try again", "تلاش دوباره")}. ${error}`}
            onClick={() => void flush()}
          >
            {time ? t("Retry", "تلاش") : error}
          </Button>
        ) : saving ? (
          t("Saving…", "در حال ذخیره…")
        ) : saved ? (
          <>
            {multiline && <Check size={16} aria-hidden="true" />}
            {t("Saved", "ذخیره شد")}
          </>
        ) : (
          ""
        )}
      </span>
    </div>
  );
}
