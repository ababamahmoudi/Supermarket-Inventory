import { useState, type AriaAttributes } from "react";
import { useDemo } from "../store";
import { isMonthlyPaymentTerms, paymentTermsDays } from "../invoice-entry";
import { NumberField, Select } from "../ui";
import { ReadingField as Field } from "../InvoiceReadingReview";
import "./payment-terms-control.css";

function TermsInputs({
  id,
  choice,
  custom,
  value,
  disabled,
  onChoice,
  onDays,
  ...aria
}: AriaAttributes & {
  id: string;
  choice: string;
  custom: boolean;
  value: string;
  disabled: boolean;
  onChoice(value: string): void;
  onDays(value: string): void;
}) {
  const { t } = useDemo();
  return (
    <div className="invoice-payment-terms-row" data-custom={custom}>
      <Select
        {...aria}
        id={id}
        value={choice}
        disabled={disabled}
        onChange={onChoice}
        options={[
          {
            placeholder: true,
            value: "",
            label: t("Choose payment terms", "انتخاب شرایط پرداخت"),
          },
          { value: "0", label: t("Cash on delivery", "پرداخت هنگام تحویل") },
          { value: "7", label: t("Weekly (7 days)", "هفتگی (7 روز)") },
          {
            value: "14",
            label: t("Every 2 weeks (14 days)", "هر دو هفته (14 روز)"),
          },
          { value: "30", label: t("Net 30 (30 days)", "خالص 30 (30 روز)") },
          { value: "45", label: t("Net 45 (45 days)", "خالص 45 (45 روز)") },
          { value: "60", label: t("Net 60 (60 days)", "خالص 60 (60 روز)") },
          {
            value: "monthly",
            selectedLabel: t("Monthly", "ماهانه"),
            label: t(
              "Monthly (due the 1st of next month)",
              "ماهانه (سررسید اول ماه بعد)",
            ),
          },
          { value: "other", label: t("Other", "سایر") },
        ]}
      />
      {custom && (
        <NumberField
          id={`${id}-days`}
          aria-label={t("Number of days", "تعداد روزها")}
          placeholder={t("Days", "روز")}
          keepTyping
          dir="ltr"
          min="0"
          step="1"
          value={value.replace(/^net\s*/i, "")}
          disabled={disabled}
          onChange={onDays}
        />
      )}
    </div>
  );
}

export function PaymentTermsControl({
  value,
  onChange,
  id,
  disabled = false,
  label,
  error,
  inferred = false,
  defaulted = false,
}: {
  value: string;
  onChange(value: string): void;
  id: string;
  disabled?: boolean;
  label: string;
  error?: string;
  inferred?: boolean;
  defaulted?: boolean;
}) {
  const { t } = useDemo();
  const [other, setOther] = useState(false);
  const days = paymentTermsDays(value),
    monthly = isMonthlyPaymentTerms(value);
  const custom =
    other ||
    Boolean(value && !monthly && ![0, 7, 14, 30, 45, 60].includes(days ?? -1));
  const invalid = custom && Boolean(value) && days === undefined;
  return (
    <Field
      className="invoice-payment-terms"
      readingField="payment_terms"
      readingHint={
        inferred
          ? t(
              "Taken from this supplier's earlier invoice; check the terms on this paper.",
              "از فاکتور قبلی این تأمین‌کننده گرفته شده؛ شرایط روی این فاکتور را بررسی کنید.",
            )
          : undefined
      }
      label={label}
      hint={
        defaulted
          ? monthly
            ? t("Default: first of next month", "پیش‌فرض: اول ماه بعد")
            : t(`Default: ${value}`, `پیش‌فرض: ${value}`)
          : undefined
      }
      error={
        error ||
        (invalid
          ? t(
              "Enter a nonnegative whole number of days.",
              "تعداد روزها را به صورت عدد صحیح غیرمنفی وارد کنید.",
            )
          : undefined)
      }
    >
      <TermsInputs
        id={id}
        choice={
          custom
            ? "other"
            : monthly
              ? "monthly"
              : days === undefined
                ? ""
                : String(days)
        }
        custom={custom}
        value={value}
        disabled={disabled}
        onChoice={(next) => {
          setOther(next === "other");
          onChange(
            next === "other"
              ? "Net "
              : next === ""
                ? ""
                : next === "monthly"
                  ? "Monthly"
                  : next === "0"
                    ? "Cash on delivery"
                    : `Net ${next}`,
          );
        }}
        onDays={(next) => onChange(`Net ${next}`)}
      />
    </Field>
  );
}
