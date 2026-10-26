import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { BufferedInput, BufferedTextarea, Button } from "../ui";
import { useDemo } from "../store";
import { parseTimesheetTime } from "../timesheets";

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
}: {
  id: string;
  value: string;
  save: (value: string) => Promise<unknown>;
  time?: boolean;
  label: string;
  now?: () => string;
  multiline?: boolean;
}) {
  const { t } = useDemo();
  const registry = useContext(TimesheetSaveContext);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const raw = useRef(value),
    dirty = useRef(false),
    focused = useRef(false);
  const version = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(save),
    queue = useRef(Promise.resolve(true));
  const lastCommitted = useRef(value),
    alive = useRef(true);
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
      setError(
        t(
          "Enter a 24-hour time, such as 07:30 or 1915.",
          "زمان ۲۴ ساعته مانند 07:30 یا 1915 وارد کنید.",
        ),
      );
      return false;
    }
    const ownVersion = version.current;
    if (normalized === lastCommitted.current) {
      dirty.current = false;
      if (!focused.current) {
        raw.current = normalized;
        setText(normalized);
      }
      setError("");
      return queue.current;
    }
    const operation = queue.current
      .catch(() => false)
      .then(async () => {
        if (!alive.current) return false;
        setSaving(true);
        try {
          await callback.current(normalized);
          lastCommitted.current = normalized;
          if (alive.current && ownVersion === version.current) {
            dirty.current = false;
            setError("");
            setSaved(true);
            if (!focused.current) {
              raw.current = normalized;
              setText(normalized);
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
          if (alive.current) setSaving(false);
        }
      });
    queue.current = operation;
    return operation;
  }, [time, t]);
  useEffect(() => registry?.register(id, flush), [registry, id, flush]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const change = (next: string) => {
    raw.current = next;
    dirty.current = true;
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
    },
    onBlur: blur,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => change(event.target.value),
  };
  return (
    <div className={`timesheet-saved-field${time ? " is-time" : ""}`}>
      {multiline ? (
        <BufferedTextarea {...common} rows={3} />
      ) : (
        <BufferedInput
          {...common}
          inputMode={time ? "numeric" : undefined}
          dir={time ? "ltr" : undefined}
          autoComplete="off"
          placeholder={time ? "HH:mm" : undefined}
        />
      )}
      {now && (
        <Button
          variant="neutral"
          className="timesheet-now"
          onClick={() => {
            change(now());
            focused.current = false;
            void flush();
          }}
        >
          {t("Now", "اکنون")}
        </Button>
      )}
      <span
        id={`${id}-status`}
        className={`timesheet-save-state${error ? " form-error" : " muted"}`}
        aria-live="polite"
      >
        {error ||
          (saving
            ? t("Saving…", "در حال ذخیره…")
            : saved
              ? t("Saved", "ذخیره شد")
              : "")}
      </span>
      {error && (
        <Button
          variant="plain"
          className="timesheet-retry"
          onClick={() => void flush()}
        >
          {t("Try again", "تلاش دوباره")}
        </Button>
      )}
    </div>
  );
}
