import { useEffect, useState } from "react";
import { Expand, FileImage } from "lucide-react";
import type { InvoiceReadDTO } from "../../invoice-projections";
import { useDemo } from "../../store";
import { useInvoiceOriginal } from "../../use-invoice-original";
import { Button, Dialog } from "../../ui";
import { OriginalInvoice } from "../OriginalInvoice";
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
  const firstPage = useInvoiceOriginal(invoice, 0);
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
      tabIndex={-1}
      className="original-viewer"
      data-hidden={hidden}
    >
      <div className="original-viewer-header">
        <h2>{t("Original invoice", "اصل فاکتور")}</h2>
        <Button
          variant="secondary"
          size="sm"
          className="original-viewer-hide"
          onClick={toggle}
        >
          {hidden
            ? t("Show original", "نمایش اصل")
            : t("Hide original", "پنهان کردن اصل")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="original-viewer-expand"
          onClick={() => setExpanded(true)}
        >
          <Expand size={16} aria-hidden="true" />
          {t("Expand", "بزرگ کردن")}
        </Button>
      </div>
      <div className="original-viewer-panel">
        {!expanded && (
          <OriginalInvoice invoice={invoice} onAttach={onAttach} bare />
        )}
      </div>
      <Button
        variant="secondary"
        className="original-viewer-phone-trigger"
        onClick={() =>
          invoice.original_available ? setExpanded(true) : onAttach?.()
        }
      >
        {firstPage.url ? (
          <img
            src={firstPage.url}
            alt=""
            className="original-viewer-thumbnail"
          />
        ) : (
          <FileImage size={24} aria-hidden="true" />
        )}
        {invoice.original_available
          ? t(
              `View original (${invoice.original_page_count ?? 1} pages)`,
              `مشاهده اصل (${invoice.original_page_count ?? 1} صفحه)`,
            )
          : t("Attach original", "پیوست اصل فاکتور")}
      </Button>
      <Dialog
        open={expanded}
        onOpenChange={setExpanded}
        title={t("Original invoice", "اصل فاکتور")}
        className="original-viewer-dialog"
      >
        {expanded && (
          <OriginalInvoice invoice={invoice} onAttach={onAttach} bare />
        )}
      </Dialog>
    </aside>
  );
}
