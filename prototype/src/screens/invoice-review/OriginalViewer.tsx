import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Maximize2, FileImage } from "lucide-react";
import type { InvoiceReadDTO } from "../../invoice-projections";
import { useDemo } from "../../store";
import { useInvoiceOriginal } from "../../use-invoice-original";
import { Button, Dialog } from "../../ui";
import { LtrValue } from "../../presentation";
import { OriginalInvoice } from "../OriginalInvoice";
import { FitText } from "../../FitText";
import "./invoice-review.css";

/** The preference belongs to the person, never to a particular invoice. */
function preferenceKey(companyId: string, personId: string) {
  return `invoice-original-hidden:${companyId}:${personId}`;
}

export function OriginalViewer({
  invoice,
  onAttach,
  onVisibilityChange,
}: {
  invoice: InvoiceReadDTO;
  onAttach?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const { actor, t } = useDemo();
  const key = preferenceKey(invoice.company_id, actor?.user_id ?? "");
  const [preference, setPreference] = useState(() => {
    try {
      return { key, hidden: localStorage.getItem(key) === "true" };
    } catch {
      return { key, hidden: false };
    }
  });
  let storedHidden = false;
  if (preference.key !== key) {
    try {
      storedHidden = localStorage.getItem(key) === "true";
    } catch {
      // In-memory review still works when preferences cannot be read.
    }
  }
  const hidden = preference.key === key ? preference.hidden : storedHidden;
  const [expanded, setExpanded] = useState(false);
  const [failedThumbnail, setFailedThumbnail] = useState("");
  const [pdfThumbnail, setPdfThumbnail] = useState({ sourceKey: "", url: "" });
  const onThumbnail = useCallback(
    (sourceKey: string, url: string) => setPdfThumbnail({ sourceKey, url }),
    [],
  );
  const documentKey = JSON.stringify([
    invoice.id,
    invoice.file_name,
    invoice.file_size,
    invoice.file_type,
  ]);
  const [pdfPages, setPdfPages] = useState({ documentKey, count: 0 });
  const onPageCount = useCallback(
    (count: number) =>
      setPdfPages((previous) =>
        previous.documentKey === documentKey && previous.count === count
          ? previous
          : { documentKey, count },
      ),
    [documentKey],
  );
  const pageCount =
    pdfPages.documentKey === documentKey && pdfPages.count
      ? pdfPages.count
      : (invoice.original_page_count ?? 1);
  const firstPage = useInvoiceOriginal(invoice, 0);
  const fileName =
    firstPage.name ?? invoice.file_name ?? t("Not added", "ثبت نشده");
  const pageCountLabel = t(
    `${pageCount} ${pageCount === 1 ? "page" : "pages"}`,
    `${pageCount.toLocaleString("fa-IR")} صفحه`,
  );
  const fileCaption = (
    <span className="original-viewer-file-caption">
      <FitText
        className="original-viewer-file-name"
        value={fileName}
        render={(visible) => (
          <>
            <span className="sr-only">
              <LtrValue value={fileName} />{" "}
            </span>
            <span aria-hidden="true">
              <LtrValue value={visible} />
            </span>
          </>
        )}
      />
      <span className="original-viewer-file-separator" aria-hidden="true">
        ·
      </span>
      <span className="original-viewer-page-count">{pageCountLabel}</span>
    </span>
  );
  const thumbnailUrl =
    invoice.file_type === "application/pdf"
      ? pdfThumbnail.sourceKey === firstPage.key &&
        !firstPage.loading &&
        !firstPage.error
        ? pdfThumbnail.url
        : undefined
      : firstPage.url;
  useEffect(() => {
    onVisibilityChange?.(!hidden);
  }, [hidden, onVisibilityChange]);
  function toggle() {
    const next = !hidden;
    setPreference({ key, hidden: next });
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // A storage restriction must never prevent invoice review.
    }
  }
  return (
    <aside
      id="invoice-original-field"
      aria-label={t("Original invoice", "فاکتور اصلی")}
      tabIndex={-1}
      className="original-viewer"
      data-hidden={hidden}
      data-invoice-id={invoice.id}
    >
      <div className="original-viewer-header">
        <div className="original-viewer-title">
          <h2>{t("Original invoice", "فاکتور اصلی")}</h2>
          {invoice.original_available && (
            <p className="original-viewer-file muted">{fileCaption}</p>
          )}
        </div>
        <div className="original-viewer-header-actions" data-control-row>
          <Button
            variant="plain"
            size="sm"
            className="original-viewer-expand"
            disabled={!invoice.original_available}
            onClick={() => setExpanded(true)}
          >
            <Maximize2 size={16} aria-hidden="true" />
            {t("Expand", "بزرگ کردن")}
          </Button>
          <Button
            variant="plain"
            size="sm"
            className="original-viewer-hide"
            aria-label={
              hidden
                ? t("Show original", "نمایش اصل")
                : t("Hide original", "پنهان کردن اصل")
            }
            onClick={toggle}
          >
            {hidden ? t("Show original", "نمایش اصل") : t("Hide", "پنهان")}
          </Button>
        </div>
      </div>
      <div className="original-viewer-panel">
        {!expanded && (
          <OriginalInvoice
            invoice={invoice}
            onAttach={onAttach}
            onPageCount={onPageCount}
            onThumbnail={onThumbnail}
            bare
          />
        )}
      </div>
      <Button
        variant="secondary"
        className="original-viewer-phone-trigger"
        data-control-kind="disclosure"
        aria-haspopup={invoice.original_available ? "dialog" : undefined}
        aria-expanded={invoice.original_available ? expanded : undefined}
        aria-label={
          invoice.original_available
            ? t(
                `View original (${pageCount} pages)`,
                `مشاهده اصل (${pageCount} صفحه)`,
              )
            : undefined
        }
        onClick={() =>
          invoice.original_available ? setExpanded(true) : onAttach?.()
        }
      >
        <span className="original-viewer-thumbnail" aria-hidden="true">
          {thumbnailUrl && failedThumbnail !== firstPage.key ? (
            <img
              src={thumbnailUrl}
              alt=""
              onError={() => setFailedThumbnail(firstPage.key)}
            />
          ) : firstPage.loading ? (
            <span className="original-viewer-thumbnail-skeleton" />
          ) : (
            <FileImage size={24} />
          )}
        </span>
        {/* Phone (reference screen 05): a card that opens full screen. */}
        <span className="original-viewer-phone-text">
          <strong>
            {invoice.original_available
              ? t("View original", "مشاهده اصل")
              : t("Attach original", "پیوست اصل فاکتور")}
          </strong>
          {invoice.original_available && (
            <span>
              {t(
                `${pageCount} ${pageCount === 1 ? "page" : "pages"} · opens full screen`,
                `${pageCount} صفحه · تمام‌صفحه باز می‌شود`,
              )}
            </span>
          )}
        </span>
        <ChevronRight
          size={18}
          className="directional original-viewer-phone-chevron"
          aria-hidden="true"
        />
      </Button>
      <Dialog
        open={expanded}
        onOpenChange={setExpanded}
        title={t("Original invoice", "فاکتور اصلی")}
        description={fileCaption}
        className="original-viewer-dialog dialog-phone-fullscreen"
      >
        {expanded && (
          <OriginalInvoice
            invoice={invoice}
            onAttach={onAttach}
            onPageCount={onPageCount}
            onThumbnail={onThumbnail}
            bare
          />
        )}
      </Dialog>
    </aside>
  );
}
