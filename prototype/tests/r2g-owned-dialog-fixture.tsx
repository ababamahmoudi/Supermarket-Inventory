/* eslint-disable react-refresh/only-export-components -- Private Playwright lifecycle entry; never an application route or a hot-reloaded page. */
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CalendarDays } from "lucide-react";
import { DemoProvider, relativeDate, useDemo } from "../src/store";
import { createBrowserProviderOptions } from "../src/e1-application-options";
import { BrowserAuthorityRepository } from "../src/authority-repository";
import type { CommandIdentity } from "../src/authority-types";
import type { DemoState } from "../src/types";
import { addTrackedDate, scopedTrackedDates } from "../src/date-tracking";
import { clearExpiry } from "../src/operations";
import { Button, Dialog, Field } from "../src/ui";
import UndoToasts from "../src/UndoToasts";

function OwnedDialog() {
  const { actor, command, state, t } = useDemo();
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("Check the fictional delivery reminder.");
  const clearDate = async () => {
    if (!actor || pending) return;
    setPending(true);
    setError("");
    try {
      const id = await command(
        "dates.remove",
        {
          company_id: actor.company_id,
          kind: "location_record",
          location_ids: ["Branch 1"],
          mutation: true,
        },
        (draft, current) => {
          let entry = scopedTrackedDates(draft, current).find(
            (item) => item.branch === "Branch 1" && item.status === "active",
          );
          if (!entry) {
            const product = draft.products.find(
              (item) =>
                item.company_id === current.company_id &&
                item.status === "active",
            );
            if (!product)
              throw new Error("The fictional practice product is missing.");
            entry = addTrackedDate(draft, current, {
              product_code: product.code,
              branch: "Branch 1",
              date_type: "expiry",
              date: relativeDate(30),
            });
          }
          clearExpiry(draft, current, entry.id);
          return entry.id;
        },
      );
      setTarget(id);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The scoped date action failed.",
      );
    } finally {
      setPending(false);
    }
  };
  const entry = state.expiry.find((item) => item.id === target);
  if (!actor)
    return (
      <p data-testid="owned-dialog-loading">Restoring the existing session.</p>
    );
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Fictional reminder review", "بازبینی یادآور آزمایشی")}
        description={t(
          "Review a retained reminder without leaving this window.",
          "یک یادآور ذخیره‌شده را بدون خروج از این پنجره بازبینی کنید.",
        )}
        icon={<CalendarDays size={20} aria-hidden="true" />}
        className="r2g-owned-dialog"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              data-testid="owned-dialog-cancel"
            >
              {t("Cancel", "انصراف")}
            </Button>
            <Button
              onClick={() => setOpen(false)}
              data-testid="owned-dialog-done"
            >
              {t("Done", "تمام")}
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label={t("Review note", "یادداشت بازبینی")}>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="actions">
            <Button
              variant="neutral"
              onClick={() => void clearDate()}
              disabled={pending}
              aria-busy={pending}
              data-testid="owned-dialog-trigger"
            >
              {t("Clear fictional date", "پاک کردن تاریخ آزمایشی")}
            </Button>
          </div>
          <p className="muted">
            {t(
              "The original reminder remains in History. Undo restores it through the same guarded date workflow.",
              "یادآور اصلی در تاریخچه می‌ماند. واگرد آن را از همان گردش کار محافظت‌شده بازمی‌گرداند.",
            )}
          </p>
          <Field label={t("Follow-up", "پیگیری")}>
            <textarea
              readOnly
              value={t(
                "Nora will review the fictional delivery before the next shift. No invoice or supplier information is sent anywhere.",
                "نورا تحویل آزمایشی را پیش از شیفت بعدی بازبینی می‌کند. هیچ اطلاعات فاکتور یا تأمین‌کننده‌ای ارسال نمی‌شود.",
              )}
            />
          </Field>
          <output data-testid="owned-dialog-actor">{actor.user_id}</output>
          <output data-testid="owned-dialog-record" data-record-id={target}>
            {target ? (entry?.status ?? "unavailable") : "ready"}
          </output>
          {error && <p role="alert">{error}</p>}
        </div>
      </Dialog>
      <UndoToasts />
    </>
  );
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

export function mountOwnedDialogProof(): void {
  if (root) throw new Error("The private dialog proof is already mounted.");
  host = document.createElement("div");
  host.dataset.r2gOwnedDialogProof = "";
  document.body.append(host);
  root = createRoot(host, { identifierPrefix: "r2g-owned-proof-" });
  root.render(
    <DemoProvider options={createBrowserProviderOptions()}>
      <OwnedDialog />
    </DemoProvider>,
  );
}

export function unmountOwnedDialogProof(): void {
  root?.unmount();
  root = null;
  host?.remove();
  host = null;
}

/** Read the real current principal through the production readonly authority query. */
export async function resolveOwnedDialogPrincipal(identity: CommandIdentity) {
  const repository = new BrowserAuthorityRepository();
  try {
    const result = await repository.queryBusiness<
      DemoState,
      { user_id: string; company_id: string; session_id: string }
    >(
      identity,
      (_state, actor) => ({
        user_id: actor.user_id,
        company_id: actor.company_id,
        session_id: actor.session_id,
      }),
      {
        capability: "dates.read",
        resource: {
          company_id: identity.company_id,
          kind: "location_record",
          location_ids: ["Branch 1"],
        },
      },
    );
    return result.value;
  } finally {
    repository.dispose();
  }
}
