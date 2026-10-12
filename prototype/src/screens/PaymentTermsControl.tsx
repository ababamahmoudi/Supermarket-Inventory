import { useState } from "react";
import { useDemo } from "../store";
import { paymentTermsDays } from "../invoice-entry";
import { Field, NumberField, Select } from "../ui";

export function PaymentTermsControl({
  value,
  onChange,
  id,
  disabled = false,
  label,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
  disabled?: boolean;
  label: string;
  error?: string;
}) {
  const { t } = useDemo();
  const [other, setOther] = useState(false);
  const days = paymentTermsDays(value);
  const custom = other || (!!value && ![0, 7, 14, 30].includes(days ?? -1));
  return (
    <div className="invoice-payment-terms">
      <Field label={label} error={error}>
        <Select
          id={id}
          value={custom ? "other" : days === undefined ? "" : String(days)}
          disabled={disabled}
          onChange={(next) => {
            setOther(next === "other");
            onChange(
              next === "other"
                ? "Net "
                : next === ""
                  ? ""
                  : next === "0"
                    ? "Cash on delivery"
                    : `Net ${next}`,
            );
          }}
          options={[
            {
              value: "",
              label: t("Choose payment terms", "انتخاب شرایط پرداخت"),
            },
            { value: "0", label: t("Cash on delivery", "پرداخت هنگام تحویل") },
            { value: "7", label: t("Weekly (7 days)", "هفتگی (7 روز)") },
            {
              value: "14",
              label: t("Every 2 weeks (14 days)", "هر دو هفته (14 روز)"),
            },
            { value: "30", label: t("Monthly (30 days)", "ماهانه (30 روز)") },
            { value: "other", label: t("Other", "سایر") },
          ]}
        />
      </Field>
      {custom && (
        <Field
          label={t("Number of days", "تعداد روزها")}
          error={
            value && days === undefined
              ? t(
                  "Enter a nonnegative whole number of days.",
                  "تعداد روزها را به صورت عدد صحیح غیرمنفی وارد کنید.",
                )
              : undefined
          }
        >
          <NumberField
            id={`${id}-days`}
            dir="ltr"
            className="control-narrow"
            min="0"
            step="1"
            value={value.replace(/^net\s*/i, "")}
            disabled={disabled}
            onChange={(next) => onChange(`Net ${next}`)}
          />
        </Field>
      )}
    </div>
  );
}
