import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useDemo } from "../store";
import { companyDate, dateAfter } from "../invoice";
import { Button, DateField, Dialog, Field } from "../ui";
import { DateText } from "../presentation";
import { WhatsMissing } from "../WhatsMissing";

export function ReceivedDateRange({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const { state, t } = useDemo();
  const [open, setOpen] = useState(false);
  const [draftFrom, setFrom] = useState(from);
  const [draftTo, setTo] = useState(to);
  const [attempted, setAttempted] = useState(false);
  const invalid = !!draftFrom && !!draftTo && draftFrom > draftTo;
  const selectQuick = (kind: "today" | "week" | "month") => {
    const today = companyDate(state.config);
    const date = new Date(`${today}T12:00:00Z`);
    const first =
      kind === "today"
        ? today
        : kind === "week"
          ? dateAfter(today, -((date.getUTCDay() + 6) % 7))
          : `${today.slice(0, 7)}-01`;
    const last =
      kind === "today"
        ? today
        : kind === "week"
          ? dateAfter(first, 6)
          : new Date(
              Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12),
            )
              .toISOString()
              .slice(0, 10);
    onChange(first, last);
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="neutral"
        className="received-range-trigger"
        aria-label={t("Date range", "بازه تاریخ")}
        onClick={() => {
          setFrom(from);
          setTo(to);
          setAttempted(false);
          setOpen(true);
        }}
      >
        <CalendarDays size={18} aria-hidden="true" />{" "}
        {from || to ? (
          <>
            <span>{t("From", "از")}</span>
            <DateText value={from} />
            <span>{t("To", "تا")}</span>
            <DateText value={to} />
          </>
        ) : (
          t("Any date", "هر تاریخی")
        )}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Date range", "بازه تاریخ")}
      >
        <div className="stack">
          <WhatsMissing
            issues={
              attempted && invalid
                ? [
                    {
                      id: "received-range-invalid",
                      fieldId: "received-range-to",
                      message: t(
                        "Choose an end date on or after the start date.",
                        "تاریخ پایان را برابر یا پس از تاریخ شروع انتخاب کنید.",
                      ),
                    },
                  ]
                : []
            }
          />
          <div className="received-range-quick-actions">
            <Button
              variant="tinted"
              size="sm"
              onClick={() => selectQuick("today")}
            >
              {t("Today", "امروز")}
            </Button>
            <Button
              variant="tinted"
              size="sm"
              onClick={() => selectQuick("week")}
            >
              {t("This week", "این هفته")}
            </Button>
            <Button
              variant="tinted"
              size="sm"
              onClick={() => selectQuick("month")}
            >
              {t("This month", "این ماه")}
            </Button>
          </div>
          <div className="manual-entry-pair">
            <Field label={t("From", "از")}>
              <DateField
                id="received-range-from"
                value={draftFrom}
                onChange={setFrom}
              />
            </Field>
            <Field
              label={t("To", "تا")}
              error={
                attempted && invalid
                  ? t(
                      "Choose an end date on or after the start date.",
                      "تاریخ پایان را برابر یا پس از تاریخ شروع انتخاب کنید.",
                    )
                  : undefined
              }
            >
              <DateField
                id="received-range-to"
                value={draftTo}
                onChange={setTo}
              />
            </Field>
          </div>
          <div className="dialog-actions">
            <Button variant="neutral" onClick={() => setOpen(false)}>
              {t("Cancel", "انصراف")}
            </Button>
            <Button
              onClick={() => {
                setAttempted(true);
                if (!invalid) {
                  onChange(draftFrom, draftTo);
                  setOpen(false);
                }
              }}
            >
              {t("Apply", "اعمال")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
