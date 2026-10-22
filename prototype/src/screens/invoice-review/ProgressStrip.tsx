import { useDemo } from "../../store";
import { Button } from "../../ui";
import { Money } from "../../presentation";
import { invoiceCheckCount, invoiceTotalsCheck } from "../../invoice-checks";
import type { InvoiceReadDTO } from "../../invoice-projections";
export function ProgressStrip({
  invoice,
  onNext,
}: {
  invoice: InvoiceReadDTO;
  onNext(): void;
}) {
  const { t } = useDemo();
  const confirmed = invoice.lines.filter((x) => x.review_confirmed).length;
  const difference = invoiceTotalsCheck(invoice);
  const amount = difference.totalDifference ?? difference.subtotalDifference;
  return (
    <div className="receiving-progress" role="status">
      <span>
        {t(
          `${confirmed} of ${invoice.lines.length} lines confirmed`,
          `${confirmed} از ${invoice.lines.length} ردیف تأیید شد`,
        )}{" "}
        ·{" "}
        {t(
          `${invoiceCheckCount(invoice)} highlighted fields`,
          `${invoiceCheckCount(invoice)} فیلد مشخص‌شده`,
        )}{" "}
        ·{" "}
        {amount ? (
          <>
            {t("Totals differ by", "اختلاف جمع‌ها")} <Money value={amount} />
          </>
        ) : (
          t("Totals match ✓", "جمع‌ها برابرند ✓")
        )}
      </span>
      <Button variant="secondary" size="sm" onClick={onNext}>
        {t("Next to check", "مورد بعدی برای بررسی")}
      </Button>
    </div>
  );
}
