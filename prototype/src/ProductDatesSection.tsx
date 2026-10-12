import "./date-tracking.css";
import { CalendarClock, Truck } from "lucide-react";
import { lookupBranch } from "./catalog";
import {
  scopedTrackedDates,
  productReminderDays,
  trackedDateDaysLeft,
  validTrackedDate,
} from "./date-tracking";
import { companyDate } from "./invoice";
import { DateText, LtrText } from "./presentation";
import { branchLabel } from "./settings";
import { lookupLastReceipt } from "./receipt-lots";
import { useDemo } from "./store";
import type { Product } from "./types";
import { Badge } from "./ui";

/** Lookup is a reading surface for every role; edits belong to the product form. */
export function ProductDatesSection({ product }: { product: Product }) {
  const { state, branch, historyContext, lang, t } = useDemo();
  const location = lookupBranch(branch);
  const dates = historyContext
    ? scopedTrackedDates(state, { ...historyContext, branch: location })
        .filter(
          (entry) =>
            entry.product_code === product.code && validTrackedDate(entry.date),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const received = historyContext
    ? lookupLastReceipt(
        state,
        { ...historyContext, branch: location },
        product.code,
      )
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
              <li key={entry.id} className="product-quiet-row">
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
      ) : (
        <p className="muted product-no-dates">
          {t(
            "No open dates in this location.",
            "در این مکان تاریخ بازی وجود ندارد.",
          )}
        </p>
      )}
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
    </section>
  );
}
