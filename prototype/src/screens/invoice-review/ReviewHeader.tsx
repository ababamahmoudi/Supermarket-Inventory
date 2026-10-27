import { useId, useRef, useState } from "react";
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
  postDisabled = false,
}: {
  invoice: InvoiceReadDTO;
  missing: string;
  onClose(): void;
  onPost(): void;
  onAttemptPost(): void;
  postDisabled?: boolean;
}) {
  const { state, t, lang } = useDemo();
  return (
    <header
      className="receiving-header"
      id="invoice-review-header"
      tabIndex={-1}
    >
      <a id="invoice-back-link" className="back-link" href="#invoices">
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
                "Read by AI · imported file",
                "خوانده‌شده با هوش مصنوعی · فایل واردشده",
              )}
            </Badge>
          )}
        </div>
        <div className="actions">
          <Button variant="neutral" onClick={onClose}>
            {t("Save and close", "ذخیره و بستن")}
          </Button>
          <PostInvoiceControl
            missing={missing}
            disabled={postDisabled}
            onPost={onPost}
            onAttemptPost={onAttemptPost}
            className="receiving-desktop-post"
          />
        </div>
      </div>
    </header>
  );
}

function postHint(
  missing: string,
  t: (en: string, fa: string) => string,
  disabled: boolean,
) {
  const items = missing.split(/\r?\n/).filter((item) => item.trim());
  if (items.length <= 1) return missing;
  const lines = new Set(
    items.flatMap((item) => {
      const line = /^(?:Line|ردیف)\s+(\d+):/.exec(item)?.[1];
      return line ? [line] : [];
    }),
  );
  const instruction = disabled
    ? t(
        "Posting is unavailable. Ask an Owner or Manager to check access and invoice status.",
        "ثبت در دسترس نیست. از مالک یا مدیر بخواهید دسترسی و وضعیت فاکتور را بررسی کند.",
      )
    : t(
        "Click Post invoice for the full What's missing list.",
        "برای دیدن فهرست کامل «موارد ناقص»، روی «ثبت فاکتور» بزنید.",
      );
  return t(
    `${items.length} items need attention${lines.size ? ` (${lines.size} ${lines.size === 1 ? "line" : "lines"})` : ""}.\n${instruction}`,
    `${items.length} مورد نیاز به بررسی دارد${lines.size ? ` (${lines.size} ردیف)` : ""}.\n${instruction}`,
  );
}

export function PostInvoiceControl({
  missing,
  onPost,
  onAttemptPost,
  className,
  disabled = false,
}: {
  missing: string;
  onPost(): void;
  onAttemptPost(): void;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useDemo();
  const tooltipId = useId();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const pointerDown = useRef<string | null>(null);
  const shown = Boolean(missing && (focused || hovered));
  const hint = postHint(missing, t, disabled);
  return (
    <span
      className={`receiving-post-control ${className ?? ""}`}
      tabIndex={disabled && missing ? 0 : undefined}
      aria-describedby={shown ? tooltipId : undefined}
      onFocus={(event) =>
        setFocused(
          pointerDown.current !== "touch" &&
            pointerDown.current !== "pen" &&
            event.target instanceof HTMLElement &&
            event.target.matches(":focus-visible"),
        )
      }
      onBlur={() => setFocused(false)}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") {
          setHovered(false);
          setFocused(false);
        }
      }}
      onPointerMove={(event) => {
        // A newly revealed button under an import click must not open a hint.
        // Only movement from an actual mouse, not compatibility mouse-enter,
        // counts as hover; keyboard focus remains independently available.
        setHovered(event.pointerType === "mouse" && event.buttons === 0);
        if (event.pointerType !== "mouse") setFocused(false);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerDownCapture={(event) => {
        pointerDown.current = event.pointerType;
        setHovered(false);
        setFocused(false);
      }}
      onPointerUpCapture={() => {
        pointerDown.current = null;
      }}
      onPointerCancel={() => {
        pointerDown.current = null;
        setHovered(false);
      }}
      onKeyDown={(event) => {
        pointerDown.current = null;
        if (event.key === "Escape") {
          setFocused(false);
          setHovered(false);
        }
      }}
    >
      <Button
        disabled={disabled}
        aria-disabled={Boolean(disabled || missing)}
        variant={disabled || missing ? "neutral" : "primary"}
        aria-describedby={shown ? tooltipId : undefined}
        onClick={() => {
          if (missing) {
            setFocused(false);
            setHovered(false);
            onAttemptPost();
          } else onPost();
        }}
      >
        {t("Post invoice", "ثبت فاکتور")}
      </Button>
      {shown && (
        <span className="reading-check-tooltip" role="tooltip" id={tooltipId}>
          {hint}
        </span>
      )}
    </span>
  );
}
