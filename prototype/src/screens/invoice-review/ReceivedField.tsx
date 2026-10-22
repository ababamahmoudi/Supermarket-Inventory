import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { useDemo } from "../../store";
import { Button, DateField, Field, Select, usePopover } from "../../ui";
import { formatDate, LtrValue } from "../../presentation";

/** A compact summary keeps three details columns level; edits stay in one popup. */
export function ReceivedField({
  date,
  time,
  employee,
  onReceived,
  onEmployee,
}: {
  date: string;
  time: string;
  employee: string;
  onReceived(date: string, time: string): void;
  onEmployee(value: string): void;
}) {
  const { state, demoUsers, t } = useDemo();
  const { open, close, show, position, portalTarget, triggerRef, popupRef } =
    usePopover(320);
  const id = useId();
  const today = formatDate(new Date(), state.config.company.timezone);
  useEffect(() => {
    if (open)
      popupRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open, popupRef]);
  return (
    <Field className="receiving-received-field" label={t("Received", "دریافت")}>
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
        {open &&
          createPortal(
            <div
              ref={popupRef}
              id={id}
              role="dialog"
              aria-label={t("Change received details", "تغییر اطلاعات دریافت")}
              className="ui-popover ui-form-large receiving-received-popover"
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
              <Field label={t("Received date", "تاریخ دریافت")}>
                <DateField
                  id="invoice-received-date"
                  value={date}
                  onChange={(value) => onReceived(value, time)}
                />
              </Field>
              <Field label={t("Received time", "زمان دریافت")}>
                <input
                  id="invoice-received-time"
                  dir="ltr"
                  value={time}
                  onChange={(event) => onReceived(date, event.target.value)}
                />
              </Field>
              <Field label={t("Received by", "دریافت‌کننده")}>
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
              </Field>
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
