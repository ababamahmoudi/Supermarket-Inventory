import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useDemo } from "../../store";
import {
  Button,
  DateField,
  Field as BaseField,
  Select,
  usePopover,
} from "../../ui";
import { ReadingField as Field } from "../../InvoiceReadingReview";
import { companyDateTime } from "../../company-time";
import { formatDate, LtrValue } from "../../presentation";

/** A compact summary keeps three details columns level; edits stay in one popup. */
export function ReceivedField({
  date,
  time,
  employee,
  source,
  alternative,
  onReceived,
  onEmployee,
}: {
  date: string;
  time: string;
  employee: string;
  source?: "handwriting" | "invoice_date" | "unresolved";
  alternative?: string;
  onReceived(date: string, time: string): void;
  onEmployee(value: string): void;
}) {
  const { state, demoUsers, t } = useDemo();
  const { open, close, show, position, portalTarget, triggerRef, popupRef } =
    usePopover(320);
  const id = useId();
  const alternate = companyDateTime(state.config, alternative);
  const today = formatDate(new Date(), state.config.company.timezone);
  useEffect(() => {
    if (open)
      popupRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open, popupRef]);
  return (
    <Field
      className="receiving-received-field"
      readingField="received_at"
      readingHint={
        source === "handwriting"
          ? alternative
            ? t(
                `Read as ${time} from the handwriting`,
                `از دست‌نوشته ${time} خوانده شد`,
              )
            : t(
                "Taken from the handwriting on the invoice",
                "از دست‌نوشتهٔ روی فاکتور گرفته شده است",
              )
          : source === "invoice_date"
            ? t(
                "Set to the invoice date; change it if delivery was another day",
                "بر اساس تاریخ فاکتور تنظیم شده؛ اگر تحویل روز دیگری بود آن را تغییر دهید",
              )
            : undefined
      }
      label={t("Received", "دریافت")}
      hint={
        source === "invoice_date"
          ? t(
              "Received date from the invoice date",
              "تاریخ دریافت از تاریخ فاکتور",
            )
          : undefined
      }
    >
      <div className="receiving-readonly-field receiving-received-summary">
        <span
          title={`${date}, ${time} · ${employee || t("Not added", "اضافه نشده")}`}
        >
          {date === today ? t("Today", "امروز") : <LtrValue value={date} />}
          {", "}
          <LtrValue value={time} />
          {" · "}
          {employee || t("Not added", "اضافه نشده")}
        </span>
        <Button
          ref={triggerRef}
          variant="plain"
          size="sm"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? id : undefined}
          onClick={() => (open ? close(true) : show())}
        >
          {t("Change", "تغییر")}
        </Button>
        {alternative && alternate.time && (
          <Button
            variant="plain"
            size="sm"
            onClick={() => onReceived(alternate.date, alternate.time)}
          >
            {t(
              `Use ${alternate.time} instead`,
              `استفاده از ${alternate.time} به‌جای آن`,
            )}
          </Button>
        )}
        {open &&
          createPortal(
            <div
              ref={popupRef}
              id={id}
              role="dialog"
              aria-label={t("Change received details", "تغییر اطلاعات دریافت")}
              className="ui-popover ui-form-large ui-form-surface receiving-received-popover"
              data-popover-root=""
              style={position}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) {
                  event.preventDefault();
                  event.stopPropagation();
                  close(true);
                }
              }}
            >
              <BaseField label={t("Received date", "تاریخ دریافت")}>
                <DateField
                  id="invoice-received-date"
                  value={date}
                  onChange={(value) => onReceived(value, time)}
                />
              </BaseField>
              <BaseField label={t("Received time", "زمان دریافت")}>
                <input
                  id="invoice-received-time"
                  dir="ltr"
                  value={time}
                  onChange={(event) => onReceived(date, event.target.value)}
                />
              </BaseField>
              <BaseField label={t("Received by", "دریافت‌کننده")}>
                <Select
                  id="invoice-employee"
                  value={employee}
                  onChange={onEmployee}
                  options={demoUsers
                    .filter((person) => person.role !== "cashier")
                    .map((person) => ({
                      value: person.name,
                      label: person.name,
                    }))}
                />
              </BaseField>
              <Button variant="secondary" onClick={() => close(true)}>
                {t("Done", "انجام شد")}
              </Button>
            </div>,
            portalTarget ?? document.body,
          )}
      </div>
    </Field>
  );
}
