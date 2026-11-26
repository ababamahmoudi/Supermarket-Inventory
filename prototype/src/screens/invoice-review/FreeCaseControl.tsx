import { useState } from "react";
import { useDemo } from "../../store";
import { Button, Field, NumberField } from "../../ui";
import { Money } from "../../presentation";
import {
  answerInvoiceFreeCases,
  setFreeCaseMemberDelivery,
  type FreeCaseView,
  type FreeCaseChoice,
} from "../../invoice-free-cases";
import { recalculateInvoice } from "../../invoice";
import type { ReviewUpdate } from "./types";

export function FreeCaseControl({
  view,
  index,
  quote,
  update,
}: {
  view: FreeCaseView;
  index: number;
  quote: string;
  update: ReviewUpdate;
}) {
  const { t } = useDemo();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const choices: { value: FreeCaseChoice; label: string }[] = [
    { value: "bonus", label: t("Free case (bonus)", "کارتن رایگان (جایزه)") },
    {
      value: "two_for_one",
      label: t("Two for the price of one", "دو تا به قیمت یکی"),
    },
    {
      value: "mistake",
      label: t("Mistake on the invoice", "اشتباه در فاکتور"),
    },
  ];
  return (
    <section
      id={`invoice-line-${index}-free-case`}
      tabIndex={-1}
      className={`list-box${view.valid ? "" : " please-check-field"}`}
      data-testid="free-case-question"
    >
      <h3>
        {view.free_cases
          ? t(
              `${view.free_cases} case free?`,
              `${view.free_cases} کارتن رایگان؟`,
            )
          : t(
              `${view.free_units} units free?`,
              `${view.free_units} واحد رایگان؟`,
            )}
      </h3>
      <p>
        {t(
          "Choose using the original printed paid/free quantities and paid amount. This decision restores that printed quantity and cost basis.",
          "براساس تعداد پولی/رایگان و مبلغ چاپ‌شده تصمیم بگیرید. این انتخاب، تعداد و مبنای هزینهٔ چاپ‌شده را بازمی‌گرداند.",
        )}
      </p>
      <div className="actions">
        {choices.map((choice) => (
          <Button
            key={choice.value}
            variant={
              view.valid && view.decision === choice.value
                ? "primary"
                : "secondary"
            }
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await update((draft, actor) => {
                  answerInvoiceFreeCases(
                    draft,
                    actor,
                    index,
                    choice.value,
                    quote,
                  );
                  recalculateInvoice(draft.invoice, draft.config);
                  return true;
                });
                if (!result)
                  setError(
                    t(
                      "The invoice changed. Open this question again.",
                      "فاکتور تغییر کرده است. این پرسش را دوباره باز کنید.",
                    ),
                  );
              } finally {
                setBusy(false);
              }
            }}
          >
            {choice.label}
          </Button>
        ))}
      </div>
      {view.valid && view.decision === "bonus" && (
        <p>
          {t(
            `Free ${view.free_cases ?? view.free_units} ${view.free_cases ? "case" : "units"}`,
            `${view.free_cases ?? view.free_units} ${view.free_cases ? "کارتن" : "واحد"} رایگان`,
          )}
        </p>
      )}
      {view.valid && view.decision === "two_for_one" && (
        <p>
          <Money value={view.paid_amount ?? ""} /> ÷ {view.physical_units} ={" "}
          {view.pricing_unit_cost}{" "}
          {t("per unit for pricing", "برای قیمت‌گذاری هر واحد")}
        </p>
      )}
      {view.valid && view.decision === "mistake" && (
        <p>
          {t(
            "Supplier invoice difference: the extra printed line was a mistake; only the paid quantity is accepted.",
            "اختلاف فاکتور تأمین‌کننده: ردیف چاپی اضافه اشتباه بود؛ فقط تعداد پولی پذیرفته می‌شود.",
          )}
        </p>
      )}
      {view.answer && (
        <p>
          {t(
            `Answered by ${view.answer.by} during receiving`,
            `پاسخ ${view.answer.by} هنگام دریافت`,
          )}
        </p>
      )}
      {!view.valid && (
        <p>
          {t(
            "Choose how these printed paid and free quantities were delivered.",
            "نحوهٔ تحویل تعداد پولی و رایگان چاپ‌شده را انتخاب کنید.",
          )}
        </p>
      )}
      {view.decision &&
        view.members
          .filter((member) => view.decision !== "mistake" || !member.free)
          .map((member) => (
            <MemberDelivery
              key={`${member.index}:${member.received}:${member.refused}`}
              member={member}
              disabled={busy}
              save={async (received, refused) => {
                setBusy(true);
                setError("");
                try {
                  const result = await update((draft, actor) => {
                    setFreeCaseMemberDelivery(
                      draft,
                      actor,
                      index,
                      member.index,
                      received,
                      refused,
                      quote,
                    );
                    recalculateInvoice(draft.invoice, draft.config);
                    return true;
                  });
                  if (!result)
                    setError(
                      t(
                        "Check the paid and free delivered quantities.",
                        "تعداد تحویل‌شدهٔ پولی و رایگان را بررسی کنید.",
                      ),
                    );
                } finally {
                  setBusy(false);
                }
              }}
            />
          ))}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  );
}

function MemberDelivery({
  member,
  disabled,
  save,
}: {
  member: FreeCaseView["members"][number];
  disabled: boolean;
  save(received: number, refused: number): Promise<void>;
}) {
  const { t } = useDemo();
  const [received, setReceived] = useState(String(member.received));
  const [refused, setRefused] = useState(String(member.refused));
  return (
    <div className="form-grid">
      <Field
        label={
          member.free
            ? t("Free units delivered", "واحد رایگان تحویل‌شده")
            : t("Paid units delivered", "واحد پولی تحویل‌شده")
        }
      >
        <NumberField
          value={received}
          onChange={(value) => setReceived(String(value))}
          min={0}
          max={member.quantity}
          step={1}
        />
      </Field>
      <Field
        label={
          member.free
            ? t("Free units refused", "واحد رایگان نپذیرفته")
            : t("Paid units refused", "واحد پولی نپذیرفته")
        }
      >
        <NumberField
          value={refused}
          onChange={(value) => setRefused(String(value))}
          min={0}
          max={Number(received)}
          step={1}
        />
      </Field>
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() => void save(Number(received), Number(refused))}
      >
        {t("Save delivered quantities", "ذخیرهٔ تعداد تحویل‌شده")}
      </Button>
    </div>
  );
}
