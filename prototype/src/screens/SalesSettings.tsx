import { useSettingsConfiguration } from "../settings-configuration";
import { useState } from "react";
import { configSeed } from "../config";
import { saveSalesSettings } from "../sales";
import { useDemo } from "../store";
import { WhatsMissing } from "../WhatsMissing";
import { Button, Card, Field, NumberField, Switch } from "../ui";

export function SalesSettings() {
  const { command, t } = useDemo();
  const configuration = useSettingsConfiguration();
  const current = configuration.sales ?? configSeed.sales;
  const [length, setLength] = useState(String(current.default_length_days));
  const [reminder, setReminder] = useState(
    String(current.open_ended_reminder_days),
  );
  const [promo, setPromo] = useState(current.add_promo_labels_on_start);
  const [regular, setRegular] = useState(current.add_regular_labels_on_end);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const positiveDays = (value: string) =>
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;
  const invalid = [
    ...(!positiveDays(length)
      ? [
          {
            id: "length",
            fieldId: "sale-default-length",
            message: t(
              "Default sale length: enter a whole number of days above zero.",
              "مدت پیش‌فرض حراج: تعداد روزها باید عدد صحیح و بیشتر از صفر باشد.",
            ),
          },
        ]
      : []),
    ...(!positiveDays(reminder)
      ? [
          {
            id: "reminder",
            fieldId: "sale-reminder-days",
            message: t(
              "Sale reminder: enter a whole number of days above zero.",
              "یادآوری حراج: تعداد روزها باید عدد صحیح و بیشتر از صفر باشد.",
            ),
          },
        ]
      : []),
  ];
  const dirty =
    length !== String(current.default_length_days) ||
    reminder !== String(current.open_ended_reminder_days) ||
    promo !== current.add_promo_labels_on_start ||
    regular !== current.add_regular_labels_on_end;
  const save = async () => {
    setSubmitted(true);
    if (invalid.length) return;
    try {
      await command(
        "settings.manage",
        {
          company_id: configuration.company.seed_key,
          kind: "company_shared",
          mutation: true,
        },
        (draft, freshActor) =>
          saveSalesSettings(draft, freshActor, {
            ...current,
            default_length_days: Number(length),
            open_ended_reminder_days: Number(reminder),
            add_promo_labels_on_start: promo,
            add_regular_labels_on_end: regular,
          }),
      );
      setSubmitted(false);
      setMessage(t("Saved changes", "تغییرات ذخیره شد"));
    } catch {
      setMessage(
        t(
          "Ask an Owner or Manager to save these settings.",
          "برای ذخیره این تنظیمات از مالک یا مدیر بخواهید.",
        ),
      );
    }
  };
  return (
    <Card
      title={t("Sales", "حراج‌ها")}
      className="settings-form-card sales-settings-card"
    >
      <WhatsMissing issues={submitted ? invalid : []} />
      <div className="form-grid">
        <Field
          label={t("Default sale length (days)", "مدت پیش‌فرض حراج (روز)")}
          error={
            submitted
              ? invalid.find((item) => item.id === "length")?.message
              : undefined
          }
        >
          <NumberField
            id="sale-default-length"
            value={length}
            min="1"
            step="1"
            onChange={(value) => {
              setLength(value);
              setMessage("");
            }}
          />
        </Field>
        <Field
          label={t(
            "Remind me about sales with no end date every (days)",
            "یادآوری حراج‌های بدون تاریخ پایان هر (روز)",
          )}
          error={
            submitted
              ? invalid.find((item) => item.id === "reminder")?.message
              : undefined
          }
        >
          <NumberField
            id="sale-reminder-days"
            value={reminder}
            min="1"
            step="1"
            onChange={(value) => {
              setReminder(value);
              setMessage("");
            }}
          />
        </Field>
      </div>
      <div className="settings-switch-list">
        <Switch checked={promo} onChange={setPromo}>
          {t(
            "Add Promo labels when a sale starts",
            "هنگام شروع حراج برچسب تبلیغاتی اضافه شود",
          )}
        </Switch>
        <Switch checked={regular} onChange={setRegular}>
          {t(
            "Add regular labels when a sale ends",
            "هنگام پایان حراج برچسب عادی اضافه شود",
          )}
        </Switch>
      </div>
      {message && <p role="status">{message}</p>}
      <div className="settings-section-actions">
        <Button
          variant="neutral"
          onClick={() => {
            setLength(String(current.default_length_days));
            setReminder(String(current.open_ended_reminder_days));
            setPromo(current.add_promo_labels_on_start);
            setRegular(current.add_regular_labels_on_end);
            setSubmitted(false);
            setMessage("");
          }}
        >
          {t("Cancel", "لغو")}
        </Button>
        <Button onClick={save} disabled={!dirty}>
          {t("Save changes", "ذخیره تغییرات")}
        </Button>
      </div>
    </Card>
  );
}
