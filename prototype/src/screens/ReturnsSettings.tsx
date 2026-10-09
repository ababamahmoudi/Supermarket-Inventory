import { useState } from "react";
import { useDemo } from "../store";
import { returnSettings, updateReturnSettings } from "../return-workflow";
import { DateText, demoUserLabel } from "../presentation";
import { Button, Card, Checkbox, Field, NumberField } from "../ui";

export function ReturnsSettings() {
  const { state, update, role, user, t, lang } = useDemo();
  const saved = returnSettings(state);
  const [deduct, setDeduct] = useState<boolean | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (role !== "supervisor") return null;
  const enabled = deduct ?? saved.deduct_expected_credit_at_pickup;
  const reminder = days ?? String(saved.waiting_credit_days);
  const changed =
    enabled !== saved.deduct_expected_credit_at_pickup ||
    reminder !== String(saved.waiting_credit_days);
  return (
    <Card title={t("Returns", "مرجوعی‌ها")} className="form-card">
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
          value={reminder}
          min="1"
          step="1"
          onChange={(value) => {
            setDays(value);
            setError("");
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
      <Button
        disabled={!changed}
        onClick={() => {
          const threshold = Number(reminder);
          if (!Number.isSafeInteger(threshold) || threshold < 1) {
            setError(
              t(
                "Enter a positive whole number of days.",
                "تعداد روز صحیح مثبت وارد کنید.",
              ),
            );
            return;
          }
          update((draft) =>
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
            ),
          );
          setDeduct(null);
          setDays(null);
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
