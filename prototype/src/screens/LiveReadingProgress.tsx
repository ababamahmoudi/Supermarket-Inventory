import { Check } from "lucide-react";
import type { LiveReadingStage } from "../live-invoice-reading-service";
import { Button } from "../ui";
import "./live-invoice-progress.css";

export function LiveReadingProgress({
  stage,
  elapsed,
  onCancel,
  t,
}: {
  stage: LiveReadingStage;
  elapsed: string;
  onCancel(): void;
  t(en: string, fa: string): string;
}) {
  const current =
    stage === "preparing"
      ? 0
      : ["reading", "finding", "calculating"].indexOf(stage);
  const reading = current === 0;
  const steps = [
    { stage: "reading", label: t("Reading the invoice", "خواندن فاکتور") },
    { stage: "finding", label: t("Finding products", "یافتن کالاها") },
    { stage: "calculating", label: t("Calculating prices", "محاسبهٔ قیمت‌ها") },
  ];
  return (
    <div className="live-reading-progress-content">
      <p
        role="timer"
        aria-live="off"
        aria-label={t("Reading time", "زمان خواندن")}
        className="live-reading-time"
      >
        <bdi dir="ltr">{elapsed}</bdi>
        <span aria-hidden="true">·</span>
        <span>
          {stage === "preparing"
            ? t("Preparing pages…", "در حال آماده‌سازی صفحه‌ها…")
            : t("usually about a minute", "معمولاً حدود یک دقیقه")}
        </span>
      </p>
      <div
        className="live-reading-indeterminate"
        data-active={reading}
        role={reading ? "progressbar" : undefined}
        aria-label={reading ? steps[0].label : undefined}
        aria-hidden={!reading}
      />
      <ol
        className="live-reading-steps"
        aria-label={t("Reading steps", "مراحل خواندن")}
      >
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li
              key={step.stage}
              className="live-reading-step"
              data-stage={step.stage}
              data-state={complete ? "complete" : active ? "active" : "waiting"}
              aria-current={active ? "step" : undefined}
            >
              <span className="live-reading-step-icon" aria-hidden="true">
                {complete ? <Check size={16} /> : index + 1}
              </span>
              <span className="live-reading-step-label">{step.label}</span>
              {complete && (
                <span className="sr-only">{t("Complete", "کامل")}</span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="actions live-reading-cancel">
        <Button variant="neutral" onClick={onCancel}>
          {t("Cancel", "انصراف")}
        </Button>
      </div>
    </div>
  );
}
