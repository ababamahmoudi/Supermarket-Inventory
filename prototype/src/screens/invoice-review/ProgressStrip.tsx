import { useDemo } from "../../store";
import { Button } from "../../ui";
import { Money } from "../../presentation";
import { invoiceCheckCount, invoiceTotalsCheck } from "../../invoice-checks";
import type { InvoiceReadDTO } from "../../invoice-projections";
import { PostInvoiceControl } from "./ReviewHeader";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
export function ProgressStrip({
  invoice,
  onNext,
  missing,
  onPost,
  onAttemptPost,
  postDisabled = false,
}: {
  invoice: InvoiceReadDTO;
  onNext(): void;
  missing: string;
  onPost(): void;
  onAttemptPost(): void;
  postDisabled?: boolean;
}) {
  const { t } = useDemo();
  const checkCount = invoiceCheckCount(invoice);
  const confirmed = invoice.lines.filter((x) => x.review_confirmed).length;
  const difference = invoiceTotalsCheck(invoice);
  const amount = difference.totalDifference ?? difference.subtotalDifference;
  const same = invoice.lines.filter(
    (line) => line.known_delivery?.status === "same",
  ).length;
  const changed = invoice.lines.filter(
    (line) => line.known_delivery?.status === "changed",
  ).length;
  return (
    <div className="receiving-progress" role="status">
      <span className="receiving-progress-count">
        {t(
          `${confirmed} of ${invoice.lines.length} lines confirmed`,
          `${confirmed} از ${invoice.lines.length} ردیف تأیید شد`,
        )}
      </span>
      {invoice.lines.some((line) => line.import_line_index !== undefined) && (
        <span className="receiving-known-counts">
          {t(
            `${same} same as before · ${changed} changed · ${invoice.lines.length - same - changed} new`,
            `${same} مانند قبل · ${changed} تغییرکرده · ${invoice.lines.length - same - changed} جدید`,
          )}
        </span>
      )}
      <span className="receiving-progress-track" aria-hidden="true">
        <span
          style={{
            inlineSize: `${invoice.lines.length ? (confirmed / invoice.lines.length) * 100 : 0}%`,
          }}
        />
      </span>
      <span
        className="receiving-progress-checks"
        data-clear={checkCount === 0 || undefined}
      >
        {checkCount ? (
          <CircleAlert size={16} aria-hidden="true" />
        ) : (
          <CheckCircle2 size={16} aria-hidden="true" />
        )}
        {t(
          `${checkCount} highlighted ${checkCount === 1 ? "field" : "fields"}`,
          `${checkCount} فیلد مشخص‌شده`,
        )}
      </span>
      <span className="receiving-progress-totals" data-match={!amount}>
        {amount ? (
          <>
            {t("Totals differ by", "اختلاف جمع‌ها")} <Money value={amount} />
          </>
        ) : (
          <>
            <CheckCircle2 size={16} aria-hidden="true" />
            {t("Totals match ✓", "جمع‌ها برابرند ✓")}
          </>
        )}
      </span>
      <div className="receiving-progress-actions">
        <Button variant="secondary" size="sm" onClick={onNext}>
          {t("Next to check", "مورد بعدی برای بررسی")}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
        <PostInvoiceControl
          missing={missing}
          disabled={postDisabled}
          onPost={onPost}
          onAttemptPost={onAttemptPost}
          className="receiving-mobile-post"
        />
      </div>
    </div>
  );
}
