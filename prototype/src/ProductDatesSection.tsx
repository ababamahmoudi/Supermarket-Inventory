import "./date-tracking.css";
import { useState } from "react";
import { lookupBranch } from "./catalog";
import {
  dateTrackingErrorMessage,
  scopedTrackedDates,
  setProductDateTracking,
  trackedDateDaysLeft,
  validTrackedDate,
} from "./date-tracking";
import { DateQuickAdd } from "./DateQuickAdd";
import { companyDate } from "./invoice";
import { DateText, LtrText } from "./presentation";
import { branchLabel } from "./settings";
import { useDemo } from "./store";
import type { Product } from "./types";
import { Badge, Switch } from "./ui";

export function ProductDatesSection({ product }: { product: Product }) {
  const { state, branch, role, historyContext, update, lang, t } = useDemo();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newDateId, setNewDateId] = useState("");
  const location = lookupBranch(branch);
  const canChange = role === "supervisor" || role === "floor_worker";
  const dates = historyContext
    ? scopedTrackedDates(state, { ...historyContext, branch: location })
        .filter(
          (entry) =>
            entry.product_code === product.code && validTrackedDate(entry.date),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  if (product.company_id !== state.config.company.seed_key) return null;
  return (
    <section
      className="product-dates-section"
      aria-label={t("Dates", "تاریخ‌ها")}
    >
      <div className="product-dates-header">
        <div>
          <h3>{t("Dates", "تاریخ‌ها")}</h3>
          <p className="muted">{branchLabel(state.config, location, lang)}</p>
        </div>
        {canChange && (
          <Switch
            checked={product.date_tracking === true}
            aria-label={t("Date tracking", "پیگیری تاریخ")}
            onChange={(enabled) => {
              setError("");
              try {
                if (!historyContext) return;
                update((next) =>
                  setProductDateTracking(
                    next,
                    historyContext,
                    product.code,
                    enabled,
                    location,
                  ),
                );
                setMessage(
                  enabled
                    ? t("Date tracking turned on.", "پیگیری تاریخ روشن شد.")
                    : t("Date tracking turned off.", "پیگیری تاریخ خاموش شد."),
                );
              } catch (caught) {
                setError(dateTrackingErrorMessage(caught, t));
              }
            }}
          >
            {product.date_tracking ? t("On", "روشن") : t("Off", "خاموش")}
          </Switch>
        )}
      </div>
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
                data-new-date={entry.id === newDateId || undefined}
              >
                <span>
                  {entry.date_type === "best_before"
                    ? t("Best before", "بهترین زمان مصرف")
                    : t("Expiry", "انقضا")}{" "}
                  <DateText value={entry.date} />
                </span>
                {days <= state.config.expiry.expiring_soon_days && (
                  <Badge tone={days < 0 ? "danger" : "pending"}>
                    {days < 0
                      ? t("Expired", "منقضی‌شده")
                      : t("Expiring soon", "به‌زودی منقضی")}
                  </Badge>
                )}
                {(entry.quantity || entry.lot_number) && (
                  <span className="muted product-date-evidence">
                    {entry.quantity && (
                      <span>
                        {t("Quantity", "مقدار")}:{" "}
                        <LtrText>{entry.quantity}</LtrText>
                      </span>
                    )}
                    {entry.lot_number && (
                      <span>
                        {t("Lot", "سری ساخت")}:{" "}
                        <LtrText>{entry.lot_number}</LtrText>
                      </span>
                    )}
                  </span>
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
      {canChange && (
        <DateQuickAdd
          key={`${product.code}-${location}`}
          inline
          productCode={product.code}
          defaultLocation={location}
          onAdded={(id) => {
            setNewDateId(id);
            setMessage("");
          }}
        />
      )}
      {message && (
        <p className="date-quick-feedback" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
