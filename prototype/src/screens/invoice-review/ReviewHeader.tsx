import { useId, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useDemo } from "../../store";
import { Badge, Button } from "../../ui";
import { DateText, LtrValue, NotAdded } from "../../presentation";
import { branchLabel } from "../../settings";
import type { InvoiceReadDTO } from "../../invoice-projections";
import { DiscardInvoice } from "../DiscardInvoice";
import { useLiveReadingActivity } from "../../live-reading-activity";
import { InvoiceSimulationNotice } from "../InvoiceSimulationNotice";
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
  const activity = useLiveReadingActivity(invoice);
  const processing =
    invoice.status === "reading" ||
    (invoice.status === "empty" && invoice.original_available);
  const processingCaption = activity.active
    ? t("Reading with AI…", "در حال خواندن با هوش مصنوعی…")
    : !invoice.live_reading
      ? t("Simulated reading…", "خوانش شبیه‌سازی‌شده…")
      : invoice.live_reading.phase === "ready"
        ? t(
            "Original saved · ready to read",
            "اصل فایل ذخیره شد · آمادهٔ خواندن",
          )
        : invoice.live_reading.phase === "failed"
          ? t(
              "Reading did not finish · original saved",
              "خوانش کامل نشد · اصل فایل ذخیره شد",
            )
          : invoice.live_reading.phase === "cancelled"
            ? t(
                "Reading cancelled · original saved",
                "خوانش لغو شد · اصل فایل ذخیره شد",
              )
            : t(
                "Reading interrupted · read again",
                "خوانش متوقف شد · دوباره بخوانید",
              );
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
            {processing ? (
              t("New invoice", "فاکتور جدید")
            ) : (
              <>
                {t("Invoice", "فاکتور")}{" "}
                <span className="invoice-title-reference">
                  <LtrValue value={invoice.supplier_invoice_number} />
                </span>
              </>
            )}
          </h1>
          {processing ? (
            <p className="receiving-meta" role="status">
              {processingCaption}
            </p>
          ) : (
            <div className="receiving-meta">
              {invoice.supplier || !invoice.live_reading ? (
                <a
                  href={`#suppliers?name=${encodeURIComponent(invoice.supplier)}`}
                >
                  <LtrValue value={invoice.supplier} />
                </a>
              ) : (
                <NotAdded />
              )}
              <span>{branchLabel(state.config, invoice.branch, lang)}</span>
              {invoice.invoice_date || !invoice.live_reading ? (
                <DateText value={invoice.invoice_date ?? ""} />
              ) : (
                <NotAdded />
              )}
              <Badge
                tone={invoice.status === "posted" ? "approved" : "neutral"}
              >
                {invoice.status === "cancelled"
                  ? t("Cancelled", "لغوشده")
                  : invoice.status === "posted"
                    ? t("Posted", "ثبت‌شده")
                    : invoice.status === "reading" && invoice.live_reading
                      ? t("Processing", "در حال پردازش")
                      : t("In review", "در حال بررسی")}
              </Badge>
            </div>
          )}
          {(invoice.reading_record ||
            invoice.live_reading?.phase === "complete") && (
            <Badge tone="neutral" wrap>
              {invoice.reading_record?.source === "live" ||
              invoice.live_reading?.phase === "complete"
                ? t("Read by AI", "خوانده‌شده با هوش مصنوعی")
                : t(
                    "Read by AI · imported file",
                    "خوانده‌شده با هوش مصنوعی · فایل واردشده",
                  )}
            </Badge>
          )}
        </div>
        <div className="actions">
          <DiscardInvoice invoice={invoice} onDiscarded={onClose} />
          <Button variant="neutral" onClick={onClose}>
            {invoice.status === "cancelled"
              ? t("Close", "بستن")
              : t("Save and close", "ذخیره و بستن")}
          </Button>
          {invoice.status !== "cancelled" && !processing && (
            <PostInvoiceControl
              missing={missing}
              disabled={postDisabled}
              onPost={onPost}
              onAttemptPost={onAttemptPost}
              className="receiving-desktop-post"
            />
          )}
        </div>
      </div>
      {invoice.simulated_reading && <InvoiceSimulationNotice />}
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
