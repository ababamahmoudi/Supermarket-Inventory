import { ArrowLeft } from "lucide-react";
import { useDemo } from "../../store";
import { Badge, Button } from "../../ui";
import { DateText, LtrValue } from "../../presentation";
import { branchLabel } from "../../settings";
import type { InvoiceReadDTO } from "../../invoice-projections";
export function ReviewHeader({
  invoice,
  missing,
  onClose,
  onPost,
  onAttemptPost,
}: {
  invoice: InvoiceReadDTO;
  missing: string;
  onClose(): void;
  onPost(): void;
  onAttemptPost(): void;
}) {
  const { state, t, lang } = useDemo();
  return (
    <header className="receiving-header">
      <a className="back-link" href="#invoices">
        <ArrowLeft size={16} />
        {t("Invoices", "فاکتورها")}
      </a>
      <div className="receiving-header-main">
        <div>
          <h1>
            {t("Invoice", "فاکتور")}{" "}
            <LtrValue value={invoice.supplier_invoice_number} />
          </h1>
          <div className="receiving-meta">
            <a href={`#suppliers?name=${encodeURIComponent(invoice.supplier)}`}>
              <LtrValue value={invoice.supplier} />
            </a>
            <span>{branchLabel(state.config, invoice.branch, lang)}</span>
            <DateText value={invoice.invoice_date ?? ""} />
            <Badge tone={invoice.status === "posted" ? "approved" : "neutral"}>
              {invoice.status === "posted"
                ? t("Posted", "ثبت‌شده")
                : t("In review", "در حال بررسی")}
            </Badge>
          </div>
          {invoice.reading_record && (
            <Badge tone="neutral" wrap>
              {t(
                "AI reading, imported (not live)",
                "خوانش هوش مصنوعی، واردشده (زنده نیست)",
              )}{" "}
              · <LtrValue value={invoice.reading_record.models.join(", ")} />
            </Badge>
          )}
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={onClose}>
            {t("Save and close", "ذخیره و بستن")}
          </Button>
          <span
            tabIndex={missing ? 0 : undefined}
            title={missing || undefined}
            onPointerDownCapture={() => {
              if (missing) onAttemptPost();
            }}
            onKeyDown={(e) => {
              if (missing && (e.key === "Enter" || e.key === " "))
                onAttemptPost();
            }}
          >
            <Button disabled={!!missing} onClick={onPost}>
              {t("Post invoice", "ثبت فاکتور")}
            </Button>
          </span>
        </div>
      </div>
    </header>
  );
}
