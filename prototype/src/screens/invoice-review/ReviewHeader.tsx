import { useId, useState } from "react";
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
      <div className="page-header receiving-header-main">
        <div>
          <h1>
            {t("Invoice", "فاکتور")}{" "}
            <span className="invoice-title-reference">
              <LtrValue value={invoice.supplier_invoice_number} />
            </span>
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
          <Button variant="neutral" onClick={onClose}>
            {t("Save and close", "ذخیره و بستن")}
          </Button>
          <PostInvoiceControl
            missing={missing}
            onPost={onPost}
            onAttemptPost={onAttemptPost}
            className="receiving-desktop-post"
          />
        </div>
      </div>
    </header>
  );
}

export function PostInvoiceControl({
  missing,
  onPost,
  onAttemptPost,
  className,
}: {
  missing: string;
  onPost(): void;
  onAttemptPost(): void;
  className?: string;
}) {
  const { t } = useDemo();
  const tooltipId = useId();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <span
      className={`receiving-post-control ${className ?? ""}`}
      tabIndex={missing ? 0 : undefined}
      aria-describedby={missing && (focused || hovered) ? tooltipId : undefined}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDownCapture={() => {
        if (missing) onAttemptPost();
      }}
      onKeyDown={(e) => {
        if (missing && (e.key === "Enter" || e.key === " ")) onAttemptPost();
      }}
    >
      <Button disabled={!!missing} onClick={onPost}>
        {t("Post invoice", "ثبت فاکتور")}
      </Button>
      {missing && (focused || hovered) && (
        <span className="reading-check-tooltip" role="tooltip" id={tooltipId}>
          {missing}
        </span>
      )}
    </span>
  );
}
