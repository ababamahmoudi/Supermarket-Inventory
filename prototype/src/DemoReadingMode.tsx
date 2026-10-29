import { useEffect, useRef, useState } from "react";
import {
  getLiveReaderSettings,
  saveLiveReaderSettings,
} from "./live-reader-settings";
import { useDemo } from "./store";
import { MenuItem } from "./ui";

/** The menu and Settings edit one protected company setting. */
export default function DemoReadingMode() {
  const { actor, can, command, state, t } = useDemo();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const currentRequest = useRef(0);
  const requestPending = useRef(false);
  useEffect(
    () => () => {
      currentRequest.current += 1;
    },
    [],
  );
  if (
    !actor ||
    !can("settings.manage") ||
    (actor.role !== "owner" && actor.role !== "manager")
  )
    return null;
  return (
    <>
      <MenuItem
        checked={
          getLiveReaderSettings(state.config.receiving).mode === "simulated"
        }
        closeOnSelect={false}
        aria-disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (requestPending.current) return;
          requestPending.current = true;
          const mode =
            getLiveReaderSettings(state.config.receiving).mode === "simulated"
              ? "live"
              : "simulated";
          const request = ++currentRequest.current;
          setPending(true);
          setError("");
          void command(
            "settings.manage",
            {
              company_id: actor.company_id,
              kind: "company_shared",
              mutation: true,
            },
            (draft, current) =>
              saveLiveReaderSettings(draft, current, { mode }),
          )
            .catch(() => {
              if (request !== currentRequest.current) return;
              setError(
                t(
                  "Reading mode could not be saved. Check your access and try again.",
                  "حالت خواندن ذخیره نشد. دسترسی خود را بررسی و دوباره تلاش کنید.",
                ),
              );
            })
            .finally(() => {
              if (request === currentRequest.current) {
                requestPending.current = false;
                setPending(false);
              }
            });
        }}
      >
        {t("Simulated reading", "خواندن شبیه‌سازی‌شده")}
      </MenuItem>
      {error && (
        <p className="helper" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
