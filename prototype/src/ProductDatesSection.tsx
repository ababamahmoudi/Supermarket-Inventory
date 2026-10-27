import "./date-tracking.css";
import { CalendarClock, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { actorAtLocation } from "./authority";
import { trackedDateView } from "./notes-dates-read";
import {
  productReminderDays,
  trackedDateDaysLeft,
  validTrackedDate,
} from "./date-tracking";
import { companyDate } from "./invoice";
import { DateText, LtrText } from "./presentation";
import { branchLabel } from "./settings";
import { lookupLastReceipt } from "./receipt-lots";
import { useDemo } from "./store";
import type { ProductReadDTO } from "./e1-read-model";
import { Badge } from "./ui";

/** Lookup is a reading surface for every role; edits belong to the product form. */
export function ProductDatesSection({
  product,
  showReceived = true,
  hideEmptyDates = false,
}: {
  product: ProductReadDTO;
  showReceived?: boolean;
  hideEmptyDates?: boolean;
}) {
  const {
    state,
    branch,
    actor,
    query,
    can,
    businessRevision,
    authorityGeneration,
    lang,
    t,
  } = useDemo();
  // The public view already contains only the current scoped date projection.
  // Aggregate reads stay aggregate; never silently choose the first store.
  const dates = actor
    ? trackedDateView(state)
        .filter(
          (entry) =>
            entry.company_id === product.company_id &&
            entry.product_code === product.code &&
            validTrackedDate(entry.date),
        )
        .sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        )
    : [];
  const receiptScope = {
    company_id: product.company_id,
    kind: "location_record" as const,
    location_ids: [branch],
  };
  const readsReceipt =
    showReceived &&
    branch !== "all" &&
    actor !== null &&
    can("lookup.receipt_hint", receiptScope);
  type ReceiptHint = ReturnType<typeof lookupLastReceipt>;
  const [receiptResult, setReceiptResult] = useState<{
    key: string;
    hint: ReceiptHint;
  } | null>(null);
  const receiptKey = `${product.company_id}:${product.code}:${branch}:${businessRevision}:${authorityGeneration}`;
  useEffect(() => {
    if (!readsReceipt) return;
    let active = true;
    void query(
      "lookup.receipt_hint",
      {
        company_id: product.company_id,
        kind: "location_record",
        location_ids: [branch],
      },
      (freshState, freshActor) =>
        lookupLastReceipt(
          freshState,
          actorAtLocation(freshState, freshActor, branch),
          product.code,
        ),
    )
      .then((hint) => {
        if (active) setReceiptResult({ key: receiptKey, hint });
      })
      .catch(() => {
        if (active) setReceiptResult({ key: receiptKey, hint: undefined });
      });
    return () => {
      active = false;
    };
  }, [
    readsReceipt,
    product.company_id,
    product.code,
    branch,
    receiptKey,
    query,
  ]);
  const received =
    readsReceipt && receiptResult?.key === receiptKey
      ? receiptResult.hint
      : undefined;
  if (product.company_id !== state.config.company.seed_key) return null;
  return (
    <section
      className="product-dates-section product-dates-readonly"
      aria-label={t("Dates", "تاریخ‌ها")}
    >
      {dates.length ? (
        <ul className="product-open-dates">
          {dates.map((entry) => {
            const days = trackedDateDaysLeft(
              entry.date,
              companyDate(state.config),
            );
            return (
              <li
                key={entry.id}
                className="product-quiet-row"
                data-tone={
                  days < 0
                    ? "danger"
                    : days <= productReminderDays(state, product)
                      ? "pending"
                      : "neutral"
                }
              >
                <span className="product-quiet-icon">
                  <CalendarClock size={20} aria-hidden="true" />
                </span>
                <span>
                  {entry.date_type === "best_before"
                    ? t("Best before", "بهترین زمان مصرف")
                    : t("Expires", "انقضا")}{" "}
                  <DateText value={entry.date} /> ·{" "}
                  {branchLabel(state.config, entry.branch, lang)}
                </span>
                {days <= productReminderDays(state, product) && (
                  <Badge tone={days < 0 ? "danger" : "pending"}>
                    {days < 0
                      ? t("Expired", "منقضی‌شده")
                      : t("Expiring soon", "به‌زودی منقضی")}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      ) : !hideEmptyDates ? (
        <p className="muted product-no-dates">
          {t(
            "No open dates in this location.",
            "در این مکان تاریخ بازی وجود ندارد.",
          )}
        </p>
      ) : null}
      {readsReceipt && (
        <div className="product-quiet-row product-last-delivery-row">
          <span className="product-quiet-icon">
            <Truck size={20} aria-hidden="true" />
          </span>
          <span>
            {t("Last received", "آخرین دریافت")}{" "}
            {received ? (
              <DateText value={received.date} />
            ) : (
              t("No deliveries yet", "هنوز تحویلی ثبت نشده است")
            )}
          </span>
          {received && (received.supplier || received.invoice_number) && (
            <span className="muted">
              <LtrText>{received.supplier}</LtrText> ·{" "}
              <LtrText>{received.invoice_number}</LtrText>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
