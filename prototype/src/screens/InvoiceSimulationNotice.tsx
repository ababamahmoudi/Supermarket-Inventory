import { TriangleAlert } from "lucide-react";
import { useDemo } from "../store";
import "./invoice-simulation-notice.css";

/** An invoice's retained marker, rather than current settings, owns this notice. */
export function InvoiceSimulationNotice({
  entry = false,
}: {
  entry?: boolean;
}) {
  const { t } = useDemo();
  return (
    <div
      className="invoice-simulation-notice"
      role="note"
      aria-label={t("Simulated reading warning", "هشدار خوانش شبیه‌سازی‌شده")}
      data-testid="invoice-simulation-warning"
    >
      <TriangleAlert size={22} aria-hidden="true" />
      <div>
        <strong>
          {entry
            ? t(
                "AI reading is simulated in this demo",
                "خوانش هوش مصنوعی در این دمو شبیه‌سازی شده است",
              )
            : t("Simulated reading", "خوانش شبیه‌سازی‌شده")}
        </strong>
        <p>
          {t(
            "The uploaded invoice is not read. Photos and PDFs fill fictional example values.",
            "فاکتور بارگذاری‌شده خوانده نمی‌شود. عکس‌ها و PDFها با مقادیر نمونهٔ ساختگی پر می‌شوند.",
          )}
        </p>
      </div>
    </div>
  );
}
