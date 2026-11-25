import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Tag } from "lucide-react";
import { useDemo } from "../store";
import { useProtectedQuery } from "../use-protected-query";
import {
  confirmPriceTaskLabel,
  preparePriceTaskPrint,
  queuePriceTaskLabels,
  recordPriceTaskPrint,
  type PriceTaskPrint,
  type PriceUpdateTask,
} from "../price-updates";
import { labelLayout } from "../labels";
import { branchLabel } from "../settings";
import { Button, Dialog, DialogActions, Field, Radio, Select } from "../ui";
import { LtrText } from "../presentation";
import { PhysicalSheet, ShelfLabel } from "./Labels";
import { printLabelSheets, waitForPrintImages } from "../print-images";
import type { ScopedReadView } from "../e1-read-model";
import type { ResourceScope } from "../authority-types";

function scopeFor(
  company_id: string,
  branches: string[],
  mutation = false,
): ResourceScope {
  return {
    company_id,
    kind: "location_record",
    location_ids: branches,
    mutation,
    location_policy: "active_only",
  };
}

/**
 * PR 29 (Ali, 2026-11-20): "Print label" on a price update asks Print now or
 * Add to print queue. Print now opens the ordinary print flow for exactly
 * these labels, starting at the chosen slot on the sheet, then asks "Did the
 * labels print correctly?". Add to queue puts them on the location's label
 * waitlist (an existing entry is counted up, never duplicated).
 */
export function PriceLabelPrintDialog({
  tasks,
  open,
  onOpenChange,
  onNotice,
}: {
  tasks: PriceUpdateTask[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotice: (message: string) => void;
}) {
  const { state, actor, can, command, query, lang, t, tCount } = useDemo();
  const company = state.config.company.seed_key;
  const ids = tasks.map((task) => task.id);
  const branches = [...new Set(tasks.map((task) => task.branch))];
  const oneLocation = branches.length === 1;
  const mayPrint =
    oneLocation && can("labels.print", scopeFor(company, branches));
  const mayQueue =
    branches.length > 0 &&
    can("labels.queue_write", scopeFor(company, branches, true));
  const preview = useProtectedQuery(
    open && mayPrint ? "labels.print" : null,
    scopeFor(company, branches),
    (canonical, freshActor) =>
      preparePriceTaskPrint(canonical, freshActor, ids),
    `price-label-preview:${ids.join(",")}`,
  );
  const batch = preview.data?.batches[0];
  const capacity = batch ? labelLayout(batch.template).capacity : 1;
  const canPrintNow = mayPrint && Boolean(batch);
  const [choice, setChoice] = useState<"now" | "queue">("now");
  const [startSlot, setStartSlot] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingPrint, setPendingPrint] = useState<PriceTaskPrint | null>(null);
  const [printState, setPrintState] = useState<ScopedReadView | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const effective = canPrintNow ? choice : "queue";
  const intent = actor
    ? `${actor.session_id}:${actor.authority_epoch}:${ids.join(",")}`
    : "";
  const currentIntent = useRef(intent);
  useEffect(() => {
    currentIntent.current = intent;
  }, [intent]);
  const waiting = (state.label_waitlist ?? [])
    .filter(
      (row) => row.company_id === company && branches.includes(row.branch),
    )
    .reduce((sum, row) => sum + (row.copies || 1), 0);
  const location = oneLocation
    ? branchLabel(state.config, branches[0], lang)
    : t("Several locations", "چند مکان");
  const changed = () =>
    setError(
      t(
        "This price update has changed. Open it again.",
        "این به‌روزرسانی قیمت تغییر کرده است. دوباره آن را باز کنید.",
      ),
    );
  const close = (next: boolean) => {
    if (busy) return;
    onOpenChange(next);
    if (!next) {
      setChoice("now");
      setStartSlot(1);
      setError("");
    }
  };
  const queue = async () => {
    setBusy(true);
    try {
      await command(
        "labels.queue_write",
        scopeFor(company, branches, true),
        (draft, freshActor) => queuePriceTaskLabels(draft, freshActor, ids),
      );
      if (currentIntent.current !== intent) return;
      onNotice(
        tCount(
          "Added {{count}} label to the print queue in Labels",
          "Added {{count}} labels to the print queue in Labels",
          "{{count}} برچسب به صف چاپ در برچسب‌ها اضافه شد",
          "{{count}} برچسب به صف چاپ در برچسب‌ها اضافه شد",
          ids.length,
        ),
      );
      setBusy(false);
      close(false);
    } catch {
      if (currentIntent.current === intent) changed();
    } finally {
      setBusy(false);
    }
  };
  const printNow = async () => {
    setBusy(true);
    try {
      const snapshot = await query(
        "labels.print",
        scopeFor(company, branches),
        (canonical, freshActor) =>
          preparePriceTaskPrint(
            canonical,
            freshActor,
            ids,
            new Date(),
            Math.min(Math.max(1, startSlot), capacity),
          ),
      );
      if (currentIntent.current !== intent) return;
      flushSync(() => {
        setPendingPrint(snapshot);
        setPrintState(structuredClone(state));
      });
      await waitForPrintImages(
        document.querySelector(".price-task-print-output"),
      );
      if (currentIntent.current !== intent) return;
      printLabelSheets();
      await command(
        "labels.print",
        scopeFor(company, branches, true),
        (draft, freshActor) =>
          recordPriceTaskPrint(draft, freshActor, snapshot),
      );
      if (currentIntent.current !== intent) return;
      setConfirmation(true);
    } catch {
      if (currentIntent.current === intent) {
        setPendingPrint(null);
        setPrintState(null);
        changed();
      }
    } finally {
      setBusy(false);
    }
  };
  const clearPrint = () => {
    setConfirmation(false);
    setPendingPrint(null);
    setPrintState(null);
    onOpenChange(false);
  };
  const single = tasks.length === 1;
  return (
    <>
      <Dialog
        open={open && !pendingPrint}
        onOpenChange={close}
        className="price-label-print-dialog"
        icon={<Tag size={20} />}
        footer={
          <>
            <Button
              variant="neutral"
              disabled={busy}
              onClick={() => close(false)}
            >
              {t("Cancel", "انصراف")}
            </Button>
            <Button
              disabled={
                busy || (effective === "now" ? !canPrintNow : !mayQueue)
              }
              onClick={() => void (effective === "now" ? printNow() : queue())}
            >
              {effective === "now"
                ? t("Print now", "همین حالا چاپ کن")
                : t("Add to queue", "افزودن به صف")}
            </Button>
          </>
        }
        title={
          single
            ? t("Print label", "چاپ برچسب")
            : tCount(
                "Print {{count}} label",
                "Print {{count}} labels",
                "چاپ {{count}} برچسب",
                "چاپ {{count}} برچسب",
                tasks.length,
              )
        }
        description={
          <>
            {batch && (
              <>
                <LtrText>
                  {batch.template.width} × {batch.template.height} mm
                </LtrText>{" "}
                {t("label", "برچسب")} ·{" "}
              </>
            )}
            {location}
          </>
        }
      >
        {single && batch && printState === null && batch.products[0] && (
          <div className="price-label-print-preview" dir="ltr">
            <div
              className={`shelf-label${batch.template.style === "promo" ? " promo-shelf-label" : ""}`}
              style={{
                position: "relative",
                width: `${batch.template.width}mm`,
                height: `${batch.template.height}mm`,
              }}
            >
              <ShelfLabel
                product={batch.products[0]}
                state={state}
                branch={batch.branch}
                template={batch.template}
              />
            </div>
          </div>
        )}
        <div
          role="radiogroup"
          aria-label={t("How to print", "روش چاپ")}
          className="price-label-print-choices"
        >
          <Radio
            checked={effective === "now"}
            disabled={!canPrintNow}
            onChange={() => setChoice("now")}
            className="price-label-print-choice"
          >
            <strong>{t("Print now", "همین حالا چاپ کن")}</strong>
            <small className="muted">
              {!oneLocation
                ? t(
                    "Print now works for one location at a time.",
                    "چاپ فوری هر بار برای یک مکان انجام می‌شود.",
                  )
                : !mayPrint
                  ? t(
                      "You do not have permission to print labels.",
                      "اجازهٔ چاپ برچسب را ندارید.",
                    )
                  : single
                    ? t(
                        "Opens the print window for this one label",
                        "پنجرهٔ چاپ برای همین یک برچسب باز می‌شود",
                      )
                    : t(
                        "Opens the print window for these labels",
                        "پنجرهٔ چاپ برای این برچسب‌ها باز می‌شود",
                      )}
            </small>
          </Radio>
          {effective === "now" && canPrintNow && (
            <Field
              className="price-label-print-slot"
              label={t("Starting slot", "خانهٔ شروع")}
              hint={t(
                "The first unused place on the label sheet.",
                "اولین جای استفاده‌نشده روی برگهٔ برچسب.",
              )}
            >
              <Select
                value={String(startSlot)}
                onChange={(value) => setStartSlot(Number(value))}
                options={Array.from({ length: capacity }, (_, index) => ({
                  value: String(index + 1),
                  label: String(index + 1),
                }))}
              />
            </Field>
          )}
          <Radio
            checked={effective === "queue"}
            disabled={!mayQueue}
            onChange={() => setChoice("queue")}
            className="price-label-print-choice"
          >
            <strong>{t("Add to print queue", "افزودن به صف چاپ")}</strong>
            <small className="muted">
              {tCount(
                "{{count}} label is waiting in Labels",
                "{{count}} labels are waiting in Labels",
                "{{count}} برچسب در بخش برچسب‌ها منتظر است",
                "{{count}} برچسب در بخش برچسب‌ها منتظرند",
                waiting,
              )}
            </small>
          </Radio>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </Dialog>
      {pendingPrint &&
        printState &&
        createPortal(
          <div className="label-print-output price-task-print-output">
            {pendingPrint.batches.flatMap((item, batchIndex) =>
              item.pages.map((page, index) => (
                <PhysicalSheet
                  key={`${batchIndex}:${index}`}
                  template={item.template}
                  products={page}
                  state={printState}
                  branch={pendingPrint.branch}
                />
              )),
            )}
          </div>,
          document.body,
        )}
      <Dialog
        open={confirmation}
        onOpenChange={(next) => {
          if (!next) clearPrint();
        }}
        title={t(
          "Did the labels print correctly?",
          "آیا برچسب‌ها درست چاپ شدند؟",
        )}
      >
        <DialogActions>
          <Button variant="neutral" onClick={clearPrint}>
            {t("No", "خیر")}
          </Button>
          <Button
            onClick={() => {
              const print = pendingPrint;
              if (!print) return;
              void command(
                "price_updates.label_confirm",
                scopeFor(company, [print.branch], true),
                (draft, freshActor) => {
                  for (const item of print.items)
                    confirmPriceTaskLabel(
                      draft,
                      freshActor,
                      item.task_id,
                      print.id,
                    );
                },
              )
                .then(() => {
                  if (currentIntent.current === intent) clearPrint();
                })
                .catch(() => {
                  if (currentIntent.current === intent) {
                    clearPrint();
                    onNotice(
                      t(
                        "This price update has changed. Open it again.",
                        "این به‌روزرسانی قیمت تغییر کرده است. دوباره آن را باز کنید.",
                      ),
                    );
                  }
                });
            }}
          >
            {t("Yes", "بله")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
