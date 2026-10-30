import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Upload } from "lucide-react";
import { beginAppWork } from "../app-work";
import {
  storeInvoiceUpload,
  type InvoiceUploadHandle,
} from "../invoice-file-access";
import {
  attachLiveInvoiceOriginals,
  settleLiveInvoiceReading,
  useSimulatedLiveInvoiceReading as applySimulatedLiveReading,
} from "../invoice-live-reading";
import { getLiveReaderSettings } from "../live-reader-settings";
import { useLiveReadingActivity } from "../live-reading-activity";
import {
  useLiveInvoiceReadingOperation,
  useLiveInvoiceReadingService,
} from "../live-invoice-reading-context";
import {
  retainedLiveFiles as retainedFiles,
  liveReadingIdentity,
  type LiveReadingDetail,
} from "../live-invoice-reading-service";
import type { InvoiceReadDTO } from "../invoice-projections";
import { useDemo } from "../store";
import { Button, Card, CardHeader } from "../ui";
import { LiveInvoicePages } from "./LiveInvoicePages";
import {
  inspectLivePdfPages,
  loadLiveOriginalSelection,
  type LivePdfPagesAccess,
} from "../invoice-live-pdf-pages";
import "./live-invoice-reading.css";
import { LiveReadingProgress } from "./LiveReadingProgress";

type Translate = (en: string, fa: string) => string;
const demoReadingAvailable = import.meta.env.VITE_DEMO_BUILD !== "false";
const invoiceScope = (invoice: InvoiceReadDTO) => ({
  company_id: invoice.company_id,
  kind: "company_shared" as const,
  entity_id: invoice.id,
});
/** Store all original bytes before any preparation or external request. */
export function LiveInvoiceUpload({
  invoice,
  source,
  disabled,
}: {
  invoice: InvoiceReadDTO;
  source?: string | null;
  disabled?: boolean;
}) {
  const { command, query, t } = useDemo();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const photos = source !== "pdf";
  async function save(files: readonly File[]) {
    if (saving || disabled || !files.length) return;
    if (
      files.some((file) =>
        photos
          ? !file.type.startsWith("image/")
          : file.type !== "application/pdf",
      ) ||
      (!photos && files.length !== 1)
    ) {
      setError(
        photos
          ? t("Choose invoice photos.", "عکس‌های فاکتور را انتخاب کنید.")
          : t("Choose one PDF invoice.", "یک فاکتور PDF انتخاب کنید."),
      );
      return;
    }
    setSaving(true);
    setError("");
    const release = beginAppWork();
    try {
      const uploads: InvoiceUploadHandle[] = [];
      for (const file of files)
        uploads.push(
          await storeInvoiceUpload(query, file, {
            company_id: invoice.company_id,
            invoice_id: invoice.id,
          }),
        );
      await command("invoices.edit", invoiceScope(invoice), (state, actor) =>
        attachLiveInvoiceOriginals(state, actor, {
          invoice_id: invoice.id,
          uploads,
        }),
      );
    } catch {
      if (mounted.current)
        setError(
          t(
            "The original could not be saved. Allow browser storage and try again.",
            "اصل فایل ذخیره نشد. ذخیره‌سازی مرورگر را فعال کنید و دوباره تلاش کنید.",
          ),
        );
    } finally {
      release();
      if (mounted.current) setSaving(false);
    }
  }
  return (
    <div
      className="ui-dropzone live-invoice-dropzone"
      data-testid="live-invoice-upload"
      aria-busy={saving}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void save(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        id="invoice-original"
        ref={input}
        className="ui-file-input"
        type="file"
        accept={photos ? "image/*" : "application/pdf"}
        multiple={photos}
        disabled={saving || disabled}
        aria-label={t("Upload a PDF or photo", "بارگذاری PDF یا عکس")}
        onChange={(event) => {
          void save(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      {photos && (
        <input
          ref={camera}
          className="ui-file-input"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={saving || disabled}
          aria-label={t("Take photo", "گرفتن عکس")}
          onChange={(event) => {
            void save(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      )}
      <Upload className="ui-upload-icon" size={28} aria-hidden="true" />
      <p>
        {photos
          ? t(
              "Choose the pages of one invoice. You can reorder them before reading.",
              "صفحه‌های یک فاکتور را انتخاب کنید. پیش از خواندن می‌توانید ترتیب را تغییر دهید.",
            )
          : t("Choose one PDF invoice.", "یک فاکتور PDF انتخاب کنید.")}
      </p>
      <div className="actions">
        <Button
          variant="secondary"
          disabled={saving || disabled}
          onClick={() => input.current?.click()}
        >
          <FileText size={18} aria-hidden="true" />
          {photos
            ? t("Choose photos", "انتخاب عکس‌ها")
            : t("Choose PDF", "انتخاب PDF")}
        </Button>
        {photos && (
          <Button
            variant="neutral"
            className="live-invoice-camera"
            disabled={saving || disabled}
            onClick={() => camera.current?.click()}
          >
            <Camera size={18} aria-hidden="true" />
            {t("Take photo", "گرفتن عکس")}
          </Button>
        )}
      </div>
      {saving && (
        <p role="status">
          {t("Saving the original…", "در حال ذخیرهٔ اصل فایل…")}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}

function readingDetail(code: LiveReadingDetail | undefined, t: Translate) {
  if (code === "pdf_pages")
    return t(
      "A PDF can contain at most 10 pages. Choose a shorter PDF or enter this invoice by hand.",
      "PDF می‌تواند حداکثر ۱۰ صفحه داشته باشد. PDF کوتاه‌تری انتخاب کنید یا فاکتور را دستی وارد کنید.",
    );
  if (code === "invoice_number")
    return t(
      "This supplier already has that invoice number in the app.",
      "این شمارهٔ فاکتور برای این تأمین‌کننده از قبل در برنامه است.",
    );
  if (code === "page_sha256")
    return t(
      "An original page with the same SHA-256 is already in the app.",
      "یک صفحهٔ اصل با همین SHA-256 از قبل در برنامه است.",
    );
  if (code === "import")
    return t("The invoice could not be imported.", "ورود این فاکتور ممکن نشد.");
  return "";
}

/** A persisted live draft is recoverable independently of this request's lifetime. */
export function LiveInvoiceReading({ invoice }: { invoice: InvoiceReadDTO }) {
  const { state, actor, command, query, t } = useDemo();
  const settings = getLiveReaderSettings(state.config.receiving);
  const identity = liveReadingIdentity(actor);
  const service = useLiveInvoiceReadingService();
  const operation = useLiveInvoiceReadingOperation(invoice);
  const { busy, stage, failure } = operation;
  const [fileState, setFileState] = useState<{
    key: string;
    files: File[];
    pdf: boolean;
    pdfAccess?: LivePdfPagesAccess;
    pdfSelection: number[] | null;
    editable: boolean;
  } | null>(null);
  const [detail, setDetail] = useState("");
  const [changingOrder, setChangingOrder] = useState(false);
  const activity = useLiveReadingActivity(invoice);
  const sourceKey = JSON.stringify([
    invoice.id,
    invoice.version,
    invoice.file_name,
    invoice.file_type,
    invoice.file_size,
    invoice.original_page_count,
    invoice.live_reading?.phase,
    invoice.live_reading?.attempt_id,
    identity,
  ]);
  const files = fileState?.key === sourceKey ? fileState.files : [];
  const loading = fileState?.key !== sourceKey;
  useEffect(() => {
    let permitted = true;
    const controller = new AbortController();
    void (async () => {
      const selected = await loadLiveOriginalSelection(query, {
        company_id: invoice.company_id,
        invoice_id: invoice.id,
      });
      const loaded = await retainedFiles(
        query,
        invoice.company_id,
        invoice.id,
        selected.count,
      );
      let pdfAccess: LivePdfPagesAccess | undefined;
      if (selected.pdf) {
        try {
          pdfAccess = await inspectLivePdfPages(
            query,
            {
              company_id: invoice.company_id,
              invoice_id: invoice.id,
            },
            controller.signal,
          );
        } catch {
          // Source is retained; the explicit Read action still owns decode/limit errors.
        }
      }
      if (permitted)
        setFileState({
          key: sourceKey,
          files: loaded,
          pdf: selected.pdf,
          pdfAccess,
          pdfSelection:
            selected.selected ??
            (pdfAccess
              ? Array.from(
                  { length: Math.min(pdfAccess.pages, 10) },
                  (_, index) => index + 1,
                )
              : null),
          editable: selected.editable,
        });
    })().catch(() => {
      if (permitted) {
        setFileState({
          key: sourceKey,
          files: [],
          pdf: false,
          pdfSelection: null,
          editable: false,
        });
        setDetail(
          t(
            "The original could not be opened. Allow browser storage and try again.",
            "اصل فایل باز نشد. ذخیره‌سازی مرورگر را فعال کنید و دوباره تلاش کنید.",
          ),
        );
      }
    });
    return () => {
      permitted = false;
      controller.abort();
    };
  }, [
    sourceKey,
    query,
    invoice.company_id,
    invoice.id,
    invoice.version,
    invoice.file_type,
    invoice.original_page_count,
    t,
  ]);
  const selectedFileState = fileState?.key === sourceKey ? fileState : null;
  const hasReadPages =
    files.length > 0 &&
    !(selectedFileState?.pdf && selectedFileState.pdfSelection?.length === 0);
  function read() {
    if (
      settings.mode !== "live" ||
      busy ||
      loading ||
      changingOrder ||
      !hasReadPages
    )
      return;
    void service.start(invoice);
  }
  function cancel() {
    service.cancel(invoice.company_id, invoice.id, operation.attemptId);
  }
  async function manual() {
    service.cancel(invoice.company_id, invoice.id, operation.attemptId);
    const attemptId = invoice.live_reading?.attempt_id;
    if (!attemptId) return;
    try {
      await command(
        "invoices.edit",
        invoiceScope(invoice),
        (draft, currentActor) =>
          settleLiveInvoiceReading(draft, currentActor, {
            invoice_id: invoice.id,
            attempt_id: attemptId,
            outcome: "manual",
          }),
      );
    } catch {
      setDetail(
        t(
          "The invoice changed. Open the saved draft and try again.",
          "فاکتور تغییر کرد. پیش‌نویس ذخیره‌شده را باز کنید و دوباره تلاش کنید.",
        ),
      );
    }
  }
  async function simulate() {
    service.cancel(invoice.company_id, invoice.id, operation.attemptId);
    await command(
      "invoices.edit",
      invoiceScope(invoice),
      (draft, currentActor) =>
        applySimulatedLiveReading(draft, currentActor, invoice.id),
    ).catch(() =>
      setDetail(
        t(
          "The invoice changed. Open it again.",
          "فاکتور تغییر کرد. دوباره آن را باز کنید.",
        ),
      ),
    );
  }
  const failed = failure || invoice.live_reading?.phase === "failed";
  const recovered = invoice.live_reading?.phase !== "ready";
  return (
    <Card className="live-reading-card" data-testid="live-reading-progress">
      <CardHeader
        title={
          busy
            ? t("Reading with AI…", "در حال خواندن با هوش مصنوعی…")
            : t("Read this invoice", "خواندن این فاکتور")
        }
      />
      {busy ? (
        <LiveReadingProgress
          stage={stage}
          elapsed={activity.elapsed}
          onCancel={cancel}
          t={t}
        />
      ) : (
        <>
          <p role={failed ? "alert" : "status"}>
            {failed
              ? t(
                  "The AI reading didn't finish. Your original is saved.",
                  "خوانش هوش مصنوعی کامل نشد. اصل فایل شما ذخیره شده است.",
                )
              : recovered
                ? t(
                    "Your original is saved. Read again or enter this invoice by hand.",
                    "اصل فایل شما ذخیره شده است. دوباره بخوانید یا فاکتور را دستی وارد کنید.",
                  )
                : t(
                    "Your original is saved. Check the page order before reading.",
                    "اصل فایل شما ذخیره شده است. پیش از خواندن ترتیب صفحه‌ها را بررسی کنید.",
                  )}
          </p>
          {(detail || operation.detailCode) && (
            <p className="helper" role="status">
              {detail || readingDetail(operation.detailCode, t)}
            </p>
          )}
          {settings.mode !== "live" && (
            <p className="helper">
              {t(
                "Live reading is off. Use simulated reading or enter by hand.",
                "خوانش زنده خاموش است. از خوانش شبیه‌سازی‌شده یا ورود دستی استفاده کنید.",
              )}
            </p>
          )}
          {loading && (
            <p role="status">
              {t("Opening the original…", "در حال باز کردن اصل فایل…")}
            </p>
          )}
          <LiveInvoicePages
            invoice={invoice}
            files={files}
            pdf={
              selectedFileState?.pdf ?? invoice.file_type === "application/pdf"
            }
            pdfAccess={selectedFileState?.pdfAccess}
            pdfSelection={selectedFileState?.pdfSelection ?? null}
            disabled={
              loading || busy || changingOrder || !selectedFileState?.editable
            }
            onChanging={setChangingOrder}
            onDetail={setDetail}
          />
          <div className="actions live-reading-choices">
            <Button
              disabled={
                settings.mode !== "live" ||
                loading ||
                changingOrder ||
                !hasReadPages
              }
              onClick={() => void read()}
            >
              {failed
                ? t("Try again", "تلاش دوباره")
                : recovered
                  ? t("Read again", "خواندن دوباره")
                  : t("Read invoice", "خواندن فاکتور")}
            </Button>
            <Button
              variant="secondary"
              disabled={changingOrder}
              onClick={() => void manual()}
            >
              {t("Enter by hand", "ورود دستی")}
            </Button>
            {(failed || settings.mode !== "live") && demoReadingAvailable && (
              <Button
                variant="neutral"
                disabled={changingOrder || !hasReadPages}
                onClick={() => void simulate()}
              >
                {t("Use simulated reading", "استفاده از خوانش شبیه‌سازی‌شده")}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
