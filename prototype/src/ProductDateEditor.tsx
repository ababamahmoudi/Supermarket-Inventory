import { useState, type SetStateAction } from "react";
import Decimal from "decimal.js";
import { X } from "lucide-react";
import { useDemo } from "./store";
import { companyDate } from "./invoice";
import { DateText, LtrText } from "./presentation";
import { formatQuantity } from "./formatters";
import { branchLabel } from "./settings";
import {
  dateRemovalReasons,
  dateRemovalReasonLabel,
  dateTrackingErrorMessage,
  DateTrackingError,
  trackedDateDaysLeft,
  validTrackedDate,
  type ProductDateDraft,
  type StopTrackingChoice,
} from "./date-tracking";
import { WhatsMissing, type ValidationIssue } from "./WhatsMissing";
import type { Branch } from "./types";
import {
  Badge,
  Button,
  DateField,
  Field,
  IconButton,
  NumberField,
  Select,
  Switch,
} from "./ui";
import "./product-dates-c6.css";

export type ProductPendingDate = {
  date_type: ProductDateDraft["date_type"];
  date: string;
  quantity: string;
  lot_number: string;
};

export function ProductDateEditor({
  productCode,
  location,
  enabled,
  onEnabledChange,
  dates,
  onDatesChange,
  reminderDays,
  onReminderDaysChange,
  stopRequired,
  stopChoice,
  onStopChoiceChange,
  idPrefix,
  issues,
  onFieldChange,
  pendingDate,
  onPendingDateChange,
}: {
  productCode: string;
  location: Branch;
  enabled: boolean | undefined;
  onEnabledChange: (value: boolean) => void;
  dates: ProductDateDraft[];
  onDatesChange: (rows: ProductDateDraft[]) => void;
  reminderDays: string;
  onReminderDaysChange: (value: string) => void;
  stopRequired: boolean;
  stopChoice: StopTrackingChoice | "";
  onStopChoiceChange: (value: StopTrackingChoice) => void;
  idPrefix: string;
  issues: ValidationIssue[];
  onFieldChange: (fieldId: string) => void;
  pendingDate?: ProductPendingDate;
  onPendingDateChange?: (draft: ProductPendingDate) => void;
}) {
  const { state, lang, t } = useDemo();
  const [editing, setEditing] = useState<number | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const [localAdd, setLocalAdd] = useState<ProductPendingDate>({
    date_type: "expiry",
    date: "",
    quantity: "",
    lot_number: "",
  });
  const add = pendingDate ?? localAdd;
  const setAdd = (value: SetStateAction<ProductPendingDate>) => {
    const next = typeof value === "function" ? value(add) : value;
    if (onPendingDateChange) onPendingDateChange(next);
    else setLocalAdd(next);
  };
  const [addIssues, setAddIssues] = useState<ValidationIssue[]>([]);
  const issue = (field: string) =>
    issues.find((item) => item.fieldId === `${idPrefix}-${field}`)?.message;
  const patchRow = (
    index: number,
    field: keyof ProductDateDraft,
    value: ProductDateDraft[keyof ProductDateDraft],
  ) => {
    onDatesChange(
      dates.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
    onFieldChange(`${idPrefix}-date-${index}-${field}`);
  };
  const patchAdd = (field: keyof typeof add, value: string) => {
    setAdd((previous) => ({ ...previous, [field]: value }));
    setAddIssues((previous) => previous.filter((item) => item.id !== field));
    onFieldChange(`${idPrefix}-new-${field}`);
  };
  const addRow = () => {
    const missing: ValidationIssue[] = [];
    if (!validTrackedDate(add.date))
      missing.push({
        id: "date",
        fieldId: `${idPrefix}-new-date`,
        message: dateTrackingErrorMessage(new DateTrackingError("date"), t),
      });
    if (add.quantity.trim()) {
      try {
        if (
          !new Decimal(add.quantity).isFinite() ||
          new Decimal(add.quantity).lte(0)
        )
          throw new Error();
      } catch {
        missing.push({
          id: "quantity",
          fieldId: `${idPrefix}-new-quantity`,
          message: dateTrackingErrorMessage(
            new DateTrackingError("quantity"),
            t,
          ),
        });
      }
    }
    if (missing.length) {
      setAddIssues(missing);
      return;
    }
    onDatesChange([
      ...dates,
      {
        product_code: productCode,
        branch: location,
        date_type: add.date_type,
        date: add.date,
        quantity: add.quantity,
        lot_number: add.lot_number,
      },
    ]);
    setAdd((previous) => ({
      ...previous,
      date: "",
      quantity: "",
      lot_number: "",
    }));
    setAddIssues([]);
  };
  return (
    <section
      className="product-date-editor"
      id={`${idPrefix}-dates`}
      aria-label={t("Date tracking", "پیگیری تاریخ")}
    >
      <div className="product-date-editor-heading">
        <div>
          <h3>{t("Date tracking", "پیگیری تاریخ")}</h3>
          <p className="muted">
            {t(
              "Track expiry dates here and get a reminder before they pass.",
              "تاریخ انقضا را اینجا پیگیری کنید و پیش از آن یادآوری دریافت کنید.",
            )}
          </p>
        </div>
        <Switch
          checked={enabled === true}
          onChange={onEnabledChange}
          aria-label={t("Date tracking", "پیگیری تاریخ")}
        >
          {enabled === undefined
            ? t("Not set", "تنظیم نشده")
            : enabled
              ? t("Yes", "بله")
              : t("No", "خیر")}
        </Switch>
      </div>
      {!enabled && stopRequired && (
        <Field
          label={t("Stop tracking", "توقف پیگیری")}
          error={issue("stop-choice")}
        >
          <Select
            id={`${idPrefix}-stop-choice`}
            value={stopChoice}
            onChange={(value) => {
              onStopChoiceChange(value as StopTrackingChoice);
              onFieldChange(`${idPrefix}-stop-choice`);
            }}
            options={[
              {
                value: "",
                label: t(
                  "Choose what to do with the dates",
                  "انتخاب کنید با تاریخ‌ها چه شود",
                ),
              },
              {
                value: "keep",
                label: t(
                  "Stop tracking, keep the date on the product",
                  "توقف پیگیری، نگه‌داشتن تاریخ روی محصول",
                ),
              },
              {
                value: "clear",
                label: t(
                  "Stop tracking and clear the dates",
                  "توقف پیگیری و پاک‌کردن تاریخ‌ها",
                ),
              },
            ]}
          />
        </Field>
      )}
      {enabled && (
        <>
          <div className="product-reminder-setting">
            <label htmlFor={`${idPrefix}-reminder`}>
              {t("Remind me", "یادآوری")}
            </label>
            <NumberField
              id={`${idPrefix}-reminder`}
              aria-label={t("Reminder days", "روزهای یادآوری")}
              value={reminderDays}
              onChange={(value) => {
                onReminderDaysChange(value);
                onFieldChange(`${idPrefix}-reminder`);
              }}
              min="0"
              step="1"
            />
            <span>{t("days before expiry", "روز پیش از انقضا")}</span>
          </div>
          {issue("reminder") && (
            <p className="form-error" role="alert">
              {issue("reminder")}
            </p>
          )}
          <h4 className="muted">
            {t("Dates at", "تاریخ‌ها در")}{" "}
            {branchLabel(state.config, location, lang)}
          </h4>
          <div className="product-editor-date-rows">
            {dates.map((row, index) => {
              const days = validTrackedDate(row.date)
                ? trackedDateDaysLeft(row.date, companyDate(state.config))
                : null;
              return (
                <div
                  key={row.id ?? `new-${index}`}
                  className="product-editor-date-row"
                  data-removed={row.remove_reason ? "true" : undefined}
                >
                  {row.remove_reason !== undefined ||
                  pendingRemoval === index ? (
                    <>
                      <p>
                        {t("Remove date", "حذف تاریخ")}{" "}
                        <DateText value={row.date} />
                      </p>
                      <Field
                        label={t("Reason", "دلیل")}
                        error={issue(`date-${index}-remove_reason`)}
                      >
                        <Select
                          id={`${idPrefix}-date-${index}-remove_reason`}
                          value={row.remove_reason ?? ""}
                          onChange={(value) =>
                            patchRow(
                              index,
                              "remove_reason",
                              value as ProductDateDraft["remove_reason"],
                            )
                          }
                          options={[
                            {
                              value: "",
                              label: t("Choose reason", "دلیل را انتخاب کنید"),
                            },
                            ...dateRemovalReasons.map((value) => ({
                              value,
                              label: dateRemovalReasonLabel(value, t),
                            })),
                          ]}
                        />
                      </Field>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => {
                          patchRow(index, "remove_reason", undefined);
                          setPendingRemoval(null);
                        }}
                      >
                        {t("Keep date", "نگه‌داشتن تاریخ")}
                      </Button>
                    </>
                  ) : editing === index ? (
                    <>
                      <div className="product-editor-date-fields">
                        <Field label={t("Type", "نوع")}>
                          <Select
                            value={row.date_type}
                            onChange={(value) =>
                              patchRow(index, "date_type", value)
                            }
                            options={[
                              { value: "expiry", label: t("Expiry", "انقضا") },
                              {
                                value: "best_before",
                                label: t("Best before", "بهترین زمان مصرف"),
                              },
                            ]}
                          />
                        </Field>
                        <Field
                          label={t("Date", "تاریخ")}
                          error={issue(`date-${index}-date`)}
                        >
                          <DateField
                            id={`${idPrefix}-date-${index}-date`}
                            value={row.date}
                            onChange={(value) => patchRow(index, "date", value)}
                          />
                        </Field>
                        <Field
                          label={t("Quantity (optional)", "مقدار (اختیاری)")}
                          error={issue(`date-${index}-quantity`)}
                        >
                          <NumberField
                            id={`${idPrefix}-date-${index}-quantity`}
                            value={row.quantity ?? ""}
                            onChange={(value) =>
                              patchRow(index, "quantity", value)
                            }
                          />
                        </Field>
                        <Field
                          label={t("Lot (optional)", "سری ساخت (اختیاری)")}
                        >
                          <input
                            value={row.lot_number ?? ""}
                            onChange={(event) =>
                              patchRow(index, "lot_number", event.target.value)
                            }
                          />
                        </Field>
                      </div>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => setEditing(null)}
                      >
                        {t("Done", "انجام شد")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="product-editor-date-value"
                        onClick={() => setEditing(index)}
                        aria-label={t(
                          `Edit date ${row.date}`,
                          `ویرایش تاریخ ${row.date}`,
                        )}
                      >
                        <span
                          className={`product-date-dot ${days !== null && days < 0 ? "danger" : days !== null && days <= Number(reminderDays) ? "pending" : "approved"}`}
                          aria-hidden="true"
                        />
                        <strong>
                          {row.date_type === "best_before"
                            ? t("Best before", "بهترین زمان مصرف")
                            : t("Expiry", "انقضا")}{" "}
                          <DateText value={row.date} />
                        </strong>
                        <span className="muted product-date-evidence">
                          {row.quantity && (
                            <LtrText>
                              {formatQuantity(
                                row.quantity,
                                state.products.find(
                                  (product) =>
                                    product.code === productCode &&
                                    product.company_id ===
                                      state.config.company.seed_key,
                                )?.sold_by === "weight"
                                  ? "lb"
                                  : "units",
                                lang,
                              )}
                            </LtrText>
                          )}
                          {row.quantity && row.lot_number && " · "}
                          {row.lot_number && (
                            <>
                              <span>{t("Lot", "سری ساخت")} </span>
                              <LtrText>{row.lot_number}</LtrText>
                            </>
                          )}
                        </span>
                      </button>
                      {days !== null && (
                        <Badge
                          className="product-editor-date-status"
                          tone={
                            days < 0
                              ? "danger"
                              : days <= Number(reminderDays)
                                ? "pending"
                                : "approved"
                          }
                        >
                          <LtrText>{Math.abs(days)}</LtrText>{" "}
                          {days < 0
                            ? t(
                                Math.abs(days) === 1 ? "day ago" : "days ago",
                                "روز گذشته",
                              )
                            : t(
                                days === 1 ? "day left" : "days left",
                                "روز مانده",
                              )}
                        </Badge>
                      )}
                      <IconButton
                        className="product-editor-remove-date"
                        aria-label={t(
                          `Remove date ${row.date}`,
                          `حذف تاریخ ${row.date}`,
                        )}
                        onClick={() => {
                          if (row.id) {
                            setPendingRemoval(index);
                            patchRow(index, "remove_reason", "");
                          } else
                            onDatesChange(dates.filter((_, i) => i !== index));
                        }}
                      >
                        <X size={18} aria-hidden="true" />
                      </IconButton>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <WhatsMissing issues={addIssues} />
          <div className="product-editor-date-inline">
            <Field label={t("Type", "نوع")}>
              <Select
                value={add.date_type}
                onChange={(value) => patchAdd("date_type", value)}
                options={[
                  { value: "expiry", label: t("Expiry", "انقضا") },
                  {
                    value: "best_before",
                    label: t("Best before", "بهترین زمان مصرف"),
                  },
                ]}
              />
            </Field>
            <Field
              label={t("Date", "تاریخ")}
              error={
                addIssues.find((item) => item.id === "date")?.message ??
                issue("new-date")
              }
            >
              <DateField
                id={`${idPrefix}-new-date`}
                value={add.date}
                onChange={(value) => patchAdd("date", value)}
              />
            </Field>
            <Field
              label={t("Quantity (optional)", "مقدار (اختیاری)")}
              error={
                addIssues.find((item) => item.id === "quantity")?.message ??
                issue("new-quantity")
              }
            >
              <NumberField
                id={`${idPrefix}-new-quantity`}
                value={add.quantity}
                onChange={(value) => patchAdd("quantity", value)}
              />
            </Field>
            <Field label={t("Lot (optional)", "سری ساخت (اختیاری)")}>
              <input
                value={add.lot_number}
                onChange={(event) => patchAdd("lot_number", event.target.value)}
              />
            </Field>
            <Button onClick={addRow}>{t("Add", "افزودن")}</Button>
          </div>
          <p className="helper">
            {t(
              "Dates save with the product.",
              "تاریخ‌ها همراه محصول ذخیره می‌شوند.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
