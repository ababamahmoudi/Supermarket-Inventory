import { useState } from "react";
import { useDemo } from "../store";
import { returnSettings, updateReturnSettings } from "../return-workflow";
import { DateText, demoUserLabel } from "../presentation";
import { Button, Card, Checkbox, Field, NumberField, Select } from "../ui";
import { WhatsMissing, type ValidationIssue } from "../WhatsMissing";
import { saveSupplierDocumentSettings } from "../supplier-document-settings";
import { saveDateReminderSettings } from "../date-reminder-settings";

export function ReturnsSettings() {
  const { state, update, role, user, t, lang } = useDemo();
  const saved = returnSettings(state);
  const [deduct, setDeduct] = useState<boolean | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const [defaultDays, setDefaultDays] = useState<string | null>(null);
  const [defaultError, setDefaultError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [memoLanguage, setMemoLanguage] = useState<"en" | "bilingual" | null>(
    null,
  );
  const [orderLanguage, setOrderLanguage] = useState<"en" | "bilingual" | null>(
    null,
  );
  if (role !== "supervisor") return null;
  const enabled = deduct ?? saved.deduct_expected_credit_at_pickup;
  const reminder = days ?? String(saved.waiting_credit_days);
  const dateReminder =
    defaultDays ?? String(state.config.expiry.expiring_soon_days);
  const changed =
    enabled !== saved.deduct_expected_credit_at_pickup ||
    reminder !== String(saved.waiting_credit_days) ||
    dateReminder !== String(state.config.expiry.expiring_soon_days) ||
    (memoLanguage ?? state.config.supplier_documents?.return_memo ?? "en") !==
      (state.config.supplier_documents?.return_memo ?? "en") ||
    (orderLanguage ??
      state.config.supplier_documents?.supplier_order ??
      "en") !== (state.config.supplier_documents?.supplier_order ?? "en");
  return (
    <Card title={t("Returns", "مرجوعی‌ها")} className="form-card">
      <WhatsMissing issues={issues} />
      <Checkbox
        checked={enabled}
        onChange={(value) => {
          setDeduct(value);
          setMessage("");
        }}
      >
        {t(
          "Deduct expected credit at pickup",
          "کسر اعتبار مورد انتظار هنگام جمع‌آوری",
        )}
      </Checkbox>
      <Field
        className="field-short"
        label={t(
          "Waiting-credit reminder (days)",
          "یادآوری اعتبار در انتظار (روز)",
        )}
        error={error}
      >
        <NumberField
          id="return-reminder-days"
          value={reminder}
          min="1"
          step="1"
          onChange={(value) => {
            setDays(value);
            setError("");
            setIssues([]);
            setMessage("");
          }}
        />
      </Field>
      <p className="muted">
        {t(
          "Pickup records a pending claim. Only a Supervisor posts confirmed credit.",
          "جمع‌آوری یک ادعای در انتظار ثبت می‌کند. فقط سرپرست اعتبار تأییدشده را ثبت می‌کند.",
        )}
      </p>
      <div className="form-grid">
        <Field
          label={t(
            "Default date reminder (days)",
            "یادآوری پیش‌فرض تاریخ (روز)",
          )}
          error={defaultError}
          className="field-short"
        >
          <NumberField
            id="default-date-reminder-days"
            min="0"
            step="1"
            value={dateReminder}
            onChange={(value) => {
              setDefaultDays(value);
              setDefaultError("");
              setIssues((previous) =>
                previous.filter((issue) => issue.id !== "default-date-days"),
              );
              setMessage("");
            }}
          />
        </Field>
        <Field label={t("Return memo language", "زبان رسید مرجوعی")}>
          <Select
            value={
              memoLanguage ??
              state.config.supplier_documents?.return_memo ??
              "en"
            }
            onChange={(value) => {
              setMemoLanguage(value as "en" | "bilingual");
              setMessage("");
            }}
            options={[
              { value: "en", label: t("English only", "فقط انگلیسی") },
              {
                value: "bilingual",
                label: t("English and Persian", "انگلیسی و فارسی"),
              },
            ]}
          />
        </Field>
        <Field
          label={t(
            "Printed supplier order language",
            "زبان سفارش چاپی تأمین‌کننده",
          )}
        >
          <Select
            value={
              orderLanguage ??
              state.config.supplier_documents?.supplier_order ??
              "en"
            }
            onChange={(value) => {
              setOrderLanguage(value as "en" | "bilingual");
              setMessage("");
            }}
            options={[
              { value: "en", label: t("English only", "فقط انگلیسی") },
              {
                value: "bilingual",
                label: t("English and Persian", "انگلیسی و فارسی"),
              },
            ]}
          />
        </Field>
      </div>
      <Button
        onClick={() => {
          const threshold = Number(reminder);
          const dateThreshold = Number(dateReminder);
          const missing: ValidationIssue[] = [];
          if (
            !dateReminder.trim() ||
            !/^\d+$/.test(dateReminder) ||
            !Number.isSafeInteger(dateThreshold)
          ) {
            const message = t(
              "Enter zero or more whole days.",
              "تعداد روز صحیح صفر یا بیشتر وارد کنید.",
            );
            setDefaultError(message);
            missing.push({
              id: "default-date-days",
              fieldId: "default-date-reminder-days",
              message,
            });
          }
          if (!Number.isSafeInteger(threshold) || threshold < 1) {
            const message = t(
              "Enter a positive whole number of days.",
              "تعداد روز صحیح مثبت وارد کنید.",
            );
            setError(message);
            missing.push({
              id: "return-days",
              fieldId: "return-reminder-days",
              message,
            });
          }
          setIssues(missing);
          if (missing.length) return;
          if (!changed) {
            setMessage(t("Changes saved.", "تغییرات ذخیره شد."));
            return;
          }
          update((draft) => {
            if (
              enabled !== saved.deduct_expected_credit_at_pickup ||
              threshold !== saved.waiting_credit_days
            )
              updateReturnSettings(
                draft,
                {
                  company_id: state.config.company.seed_key,
                  role,
                  branch: "all",
                  actor: user?.name ?? "",
                },
                {
                  deduct_expected_credit_at_pickup: enabled,
                  waiting_credit_days: threshold,
                },
              );
            saveSupplierDocumentSettings(
              draft,
              {
                company_id: state.config.company.seed_key,
                role,
                branch: "all",
                actor: user?.name ?? "",
              },
              {
                return_memo:
                  memoLanguage ??
                  state.config.supplier_documents?.return_memo ??
                  "en",
                supplier_order:
                  orderLanguage ??
                  state.config.supplier_documents?.supplier_order ??
                  "en",
              },
            );
            saveDateReminderSettings(
              draft,
              {
                company_id: state.config.company.seed_key,
                role,
                branch: "all",
                actor: user?.name ?? "",
              },
              dateThreshold,
            );
          });
          setDeduct(null);
          setDays(null);
          setDefaultDays(null);
          setDefaultError("");
          setMemoLanguage(null);
          setOrderLanguage(null);
          setIssues([]);
          setMessage(t("Changes saved.", "تغییرات ذخیره شد."));
        }}
      >
        {t("Save changes", "ذخیره تغییرات")}
      </Button>
      {message && <p role="status">{message}</p>}
      {state.activity.find(
        (item) =>
          item.company_id === state.config.company.seed_key &&
          item.entity_type === "settings" &&
          item.entity_id === "returns",
      ) &&
        (() => {
          const change = state.activity.find(
            (item) =>
              item.company_id === state.config.company.seed_key &&
              item.entity_type === "settings" &&
              item.entity_id === "returns",
          )!;
          return (
            <p className="muted">
              <a href="#history">
                {t("Changed by", "تغییردهنده")} {demoUserLabel(change.by, lang)}{" "}
                · <DateText value={change.at} />
              </a>
            </p>
          );
        })()}
    </Card>
  );
}
