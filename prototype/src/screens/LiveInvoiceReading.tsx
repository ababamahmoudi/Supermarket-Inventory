import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, FileText, Upload } from "lucide-react";
import { beginAppWork } from "../app-work";
import {
  loadInvoiceOriginal,
  storeInvoiceUpload,
  type InvoiceUploadHandle,
  type ProtectedInvoiceQuery,
} from "../invoice-file-access";
import {
  attachLiveInvoiceOriginals,
  beginLiveInvoiceReading,
  settleLiveInvoiceReading,
  applyLiveInvoiceReading,
  reorderLiveInvoiceOriginals,
  useSimulatedLiveInvoiceReading as applySimulatedLiveReading,
} from "../invoice-live-reading";
import { prepareLiveReaderImages } from "../invoice-live-images";
import {
  buildLiveInvoiceReadingsExport,
  LIVE_READING_TIMEOUT_MS,
  requestLiveInvoiceReading,
} from "../invoice-live-reader";
import { getLiveReaderSettings } from "../live-reader-settings";
import {
  clearLiveReadingActive,
  markLiveReadingActive,
  useLiveReadingActivity,
} from "../live-reading-activity";
import type { InvoiceReadDTO } from "../invoice-projections";
import { FitText } from "../FitText";
import { useDemo } from "../store";
import { Button, Card, CardHeader, IconButton } from "../ui";
import "./live-invoice-reading.css";

type Translate = (en: string, fa: string) => string;
const demoReadingAvailable = import.meta.env.VITE_DEMO_BUILD !== "false";
const invoiceScope = (invoice: InvoiceReadDTO) => ({
  company_id: invoice.company_id,
  kind: "company_shared" as const,
  entity_id: invoice.id,
});
function untilCancelled<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", cancel));
  });
}
async function retainedFiles(
  query: ProtectedInvoiceQuery,
  companyId: string,
  invoiceId: string,
  count: number,
) {
  const files: File[] = [];
  for (let page = 0; page < count; page++) {
    const original = await loadInvoiceOriginal(query, {
      company_id: companyId,
      invoice_id: invoiceId,
      page,
    });
    files.push(
      new File([original.source], original.name, { type: original.type }),
    );
  }
  return files;
}

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
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
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

type Stage = "preparing" | "reading" | "finding" | "calculating";
function stepText(stage: Stage, t: Translate) {
  if (stage === "preparing")
    return t("Preparing pages…", "در حال آماده‌سازی صفحه‌ها…");
  if (stage === "finding") return t("Finding products", "یافتن کالاها");
  if (stage === "calculating")
    return t("Calculating prices", "محاسبهٔ قیمت‌ها");
  return t("Reading the invoice", "خواندن فاکتور");
}
function sourceScope(actor: ReturnType<typeof useDemo>["actor"]) {
  return JSON.stringify([
    actor?.company_id,
    actor?.user_id,
    actor?.session_id,
    actor?.role,
    actor?.authority_epoch,
    actor?.person_version,
    actor?.selection,
  ]);
}

/** A persisted live draft is recoverable independently of this request's lifetime. */
export function LiveInvoiceReading({ invoice }: { invoice: InvoiceReadDTO }) {
  const { state, actor, command, query, t } = useDemo();
  const settings = getLiveReaderSettings(state.config.receiving);
  const identity = sourceScope(actor);
  const requestScope = JSON.stringify([
    identity,
    invoice.id,
    settings.mode,
    settings.readerAddress,
  ]);
  const token = requestScope;
  const current = useRef(token);
  useLayoutEffect(() => {
    current.current = token;
  }, [token]);
  const alive = useRef(true);
  const operation = useRef<{
    controller: AbortController;
    attemptId?: string;
    timedOut?: boolean;
  } | null>(null);
  const [fileState, setFileState] = useState<{
    key: string;
    files: File[];
  } | null>(null);
  const [working, setWorking] = useState({ token, busy: false });
  const busy = working.token === token && working.busy;
  const setBusy = (value: boolean) => setWorking({ token, busy: value });
  const [stage, setStage] = useState<Stage>("preparing");
  const [failure, setFailure] = useState(false);
  const [detail, setDetail] = useState("");
  const [changingOrder, setChangingOrder] = useState(false);
  const activity = useLiveReadingActivity(invoice);
  const sourceKey = JSON.stringify([
    invoice.id,
    invoice.file_name,
    invoice.file_type,
    invoice.file_size,
    invoice.original_page_count,
    identity,
  ]);
  const files = fileState?.key === sourceKey ? fileState.files : [];
  const loading = fileState?.key !== sourceKey;
  useEffect(() => {
    let permitted = true;
    void (async () => {
      const count =
        invoice.file_type === "application/pdf"
          ? 1
          : Math.max(1, invoice.original_page_count);
      const loaded = await retainedFiles(
        query,
        invoice.company_id,
        invoice.id,
        count,
      );
      if (permitted) setFileState({ key: sourceKey, files: loaded });
    })().catch(() => {
      if (permitted) {
        setFileState({ key: sourceKey, files: [] });
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
    };
  }, [
    sourceKey,
    query,
    invoice.company_id,
    invoice.id,
    invoice.file_type,
    invoice.original_page_count,
    t,
  ]);
  useEffect(() => {
    alive.current = true;
    operation.current = null;
    return () => {
      alive.current = false;
      const pending = operation.current;
      pending?.controller.abort();
      clearLiveReadingActive(
        invoice.company_id,
        invoice.id,
        pending?.attemptId,
      );
      if (pending?.attemptId)
        void command(
          "invoices.edit",
          {
            company_id: invoice.company_id,
            kind: "company_shared",
            entity_id: invoice.id,
          },
          (draft, currentActor) =>
            settleLiveInvoiceReading(draft, currentActor, {
              invoice_id: invoice.id,
              attempt_id: pending.attemptId!,
              outcome: "cancelled",
            }),
        ).catch(() => undefined);
    };
  }, [token, command, invoice.company_id, invoice.id]);
  useEffect(() => {
    const pending = operation.current;
    if (
      pending?.attemptId &&
      (invoice.live_reading?.attempt_id !== pending.attemptId ||
        invoice.live_reading?.phase !== "processing")
    )
      pending.controller.abort();
  }, [invoice.live_reading?.attempt_id, invoice.live_reading?.phase]);

  async function read() {
    if (
      settings.mode !== "live" ||
      operation.current ||
      loading ||
      changingOrder ||
      !files.length
    )
      return;
    const pending = {
      controller: new AbortController(),
      attemptId: undefined as string | undefined,
      timedOut: false,
    };
    operation.current = pending;
    const present = () =>
      alive.current &&
      current.current === token &&
      operation.current === pending;
    const valid = () => present() && !pending.controller.signal.aborted;
    let deadline: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      pending.timedOut = true;
      pending.controller.abort();
    }, LIVE_READING_TIMEOUT_MS);
    setBusy(true);
    setFailure(false);
    setDetail("");
    setStage("preparing");
    try {
      const attempt = await command(
        "invoices.edit",
        invoiceScope(invoice),
        (draft, currentActor) =>
          beginLiveInvoiceReading(draft, currentActor, invoice.id),
      );
      pending.attemptId = attempt.attempt_id;
      if (!valid()) throw new DOMException("Cancelled", "AbortError");
      markLiveReadingActive(
        invoice.company_id,
        invoice.id,
        attempt.attempt_id,
        attempt.started_at,
      );
      // Read the current protected source order after the accepted begin. A
      // different tab's saved reorder must never pair old images with new hashes.
      const readingFiles = await untilCancelled(
        retainedFiles(
          query,
          invoice.company_id,
          invoice.id,
          attempt.original_sha256s.length,
        ),
        pending.controller.signal,
      );
      const images = await untilCancelled(
        prepareLiveReaderImages(readingFiles, pending.controller.signal),
        pending.controller.signal,
      );
      if (!valid()) throw new DOMException("Cancelled", "AbortError");
      setStage("reading");
      const response = await requestLiveInvoiceReading(
        settings.readerAddress,
        images,
        pending.controller.signal,
      );
      if (!valid()) throw new DOMException("Cancelled", "AbortError");
      clearTimeout(deadline);
      deadline = undefined;
      setStage("finding");
      const hashes =
        readingFiles.length === 1 && readingFiles[0].type === "application/pdf"
          ? images.map(() => attempt.original_sha256s[0])
          : attempt.original_sha256s;
      const exported = buildLiveInvoiceReadingsExport(response, {
        images,
        originalSha256: hashes,
        fileName: readingFiles[0].name,
        id: invoice.id,
      });
      if (!valid()) throw new DOMException("Cancelled", "AbortError");
      setStage("calculating");
      const release = beginAppWork();
      try {
        const result = await command(
          "invoices.edit",
          invoiceScope(invoice),
          (draft, currentActor) => {
            if (!valid()) throw new DOMException("Cancelled", "AbortError");
            return applyLiveInvoiceReading(draft, currentActor, {
              invoice_id: invoice.id,
              attempt_id: attempt.attempt_id,
              exported,
              provenance: {
                seconds: response.seconds,
                costUSD: String(response.costUSD),
                models: response.models,
              },
            });
          },
        );
        if (!result.imported.length && !valid())
          throw new DOMException("Cancelled", "AbortError");
        if (result.skipped.length && valid()) {
          await command(
            "invoices.edit",
            invoiceScope(invoice),
            (draft, currentActor) =>
              settleLiveInvoiceReading(draft, currentActor, {
                invoice_id: invoice.id,
                attempt_id: attempt.attempt_id,
                outcome: "failed",
              }),
          );
          const duplicate = result.skipped[0].reason;
          setDetail(
            duplicate === "invoice_number"
              ? t(
                  "This supplier already has that invoice number in the app.",
                  "این شمارهٔ فاکتور برای این تأمین‌کننده از قبل در برنامه است.",
                )
              : duplicate === "page_sha256"
                ? t(
                    "An original page with the same SHA-256 is already in the app.",
                    "یک صفحهٔ اصل با همین SHA-256 از قبل در برنامه است.",
                  )
                : t(
                    "The invoice could not be imported.",
                    "ورود این فاکتور ممکن نشد.",
                  ),
          );
          setFailure(true);
        }
      } finally {
        release();
      }
    } catch (cause) {
      const cancelled = pending.controller.signal.aborted && !pending.timedOut;
      if (pending.attemptId)
        await command(
          "invoices.edit",
          invoiceScope(invoice),
          (draft, currentActor) =>
            settleLiveInvoiceReading(draft, currentActor, {
              invoice_id: invoice.id,
              attempt_id: pending.attemptId!,
              outcome: cancelled ? "cancelled" : "failed",
            }),
        ).catch(() => undefined);
      if (present() && !cancelled) {
        setFailure(true);
        if (
          cause &&
          typeof cause === "object" &&
          "code" in cause &&
          cause.code === "pdf_pages"
        )
          setDetail(
            t(
              "A PDF can contain at most 10 pages. Choose a shorter PDF or enter this invoice by hand.",
              "PDF می‌تواند حداکثر ۱۰ صفحه داشته باشد. PDF کوتاه‌تری انتخاب کنید یا فاکتور را دستی وارد کنید.",
            ),
          );
      }
    } finally {
      clearTimeout(deadline);
      clearLiveReadingActive(invoice.company_id, invoice.id, pending.attemptId);
      if (operation.current === pending) {
        operation.current = null;
        if (alive.current && current.current === token) setBusy(false);
      }
    }
  }
  function cancel() {
    const pending = operation.current;
    if (!pending) return;
    pending.controller.abort();
    clearLiveReadingActive(invoice.company_id, invoice.id, pending.attemptId);
    setFailure(false);
  }
  async function manual() {
    operation.current?.controller.abort();
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
    operation.current?.controller.abort();
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
  async function move(index: number, delta: number) {
    const next = index + delta;
    if (busy || changingOrder || next < 0 || next >= files.length) return;
    const order = files.map((_, position) => position);
    [order[index], order[next]] = [order[next], order[index]];
    setChangingOrder(true);
    try {
      await command(
        "invoices.edit",
        invoiceScope(invoice),
        (draft, currentActor) =>
          reorderLiveInvoiceOriginals(draft, currentActor, {
            invoice_id: invoice.id,
            order,
          }),
      );
      setFileState(
        (previous) =>
          previous && {
            key: previous.key,
            files: order.map((position) => previous.files[position]),
          },
      );
    } catch {
      setDetail(
        t(
          "The page order could not be saved. Try again.",
          "ترتیب صفحه‌ها ذخیره نشد. دوباره تلاش کنید.",
        ),
      );
    } finally {
      setChangingOrder(false);
    }
  }
  const failed = failure || invoice.live_reading?.phase === "failed";
  const recovered = invoice.live_reading?.phase !== "ready";
  return (
    <Card className="live-reading-card" data-testid="live-reading-progress">
      <CardHeader
        title={
          busy
            ? stepText(stage, t)
            : t("Read this invoice", "خواندن این فاکتور")
        }
      />
      {busy ? (
        <>
          <p role="status" className="live-reading-time">
            {stage === "preparing"
              ? t("Preparing pages…", "در حال آماده‌سازی صفحه‌ها…")
              : t("Reading with AI…", "در حال خواندن با هوش مصنوعی…")}{" "}
            <bdi>{activity.elapsed}</bdi>
          </p>
          <p className="helper">
            {t("Usually 1–2 minutes", "معمولاً ۱ تا ۲ دقیقه")}
          </p>
          <ol className="live-reading-steps">
            <li
              aria-current={
                stage === "preparing" || stage === "reading"
                  ? "step"
                  : undefined
              }
            >
              {t("Reading the invoice", "خواندن فاکتور")}
            </li>
            <li aria-current={stage === "finding" ? "step" : undefined}>
              {t("Finding products", "یافتن کالاها")}
            </li>
            <li aria-current={stage === "calculating" ? "step" : undefined}>
              {t("Calculating prices", "محاسبهٔ قیمت‌ها")}
            </li>
          </ol>
          <Button variant="neutral" onClick={() => void cancel()}>
            {t("Cancel", "انصراف")}
          </Button>
        </>
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
          {detail && (
            <p className="helper" role="status">
              {detail}
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
          {files.length > 0 && (
            <ol className="live-reading-pages" data-testid="live-reading-pages">
              {files.map((file, index) => (
                <li key={String(index) + ":" + file.name}>
                  <span className="live-reading-page-number">{index + 1}</span>
                  <FitText
                    className="live-reading-page-name"
                    value={file.name}
                  />
                  {files.length > 1 && (
                    <span className="actions">
                      <IconButton
                        variant="secondary"
                        disabled={changingOrder || index === 0}
                        aria-label={t(
                          "Move page " + (index + 1) + " up",
                          "انتقال صفحهٔ " + (index + 1) + " به بالا",
                        )}
                        onClick={() => void move(index, -1)}
                      >
                        <ArrowUp size={18} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        variant="secondary"
                        disabled={changingOrder || index === files.length - 1}
                        aria-label={t(
                          "Move page " + (index + 1) + " down",
                          "انتقال صفحهٔ " + (index + 1) + " به پایین",
                        )}
                        onClick={() => void move(index, 1)}
                      >
                        <ArrowDown size={18} aria-hidden="true" />
                      </IconButton>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div className="actions live-reading-choices">
            <Button
              disabled={
                settings.mode !== "live" ||
                loading ||
                changingOrder ||
                !files.length
              }
              onClick={() => void read()}
            >
              {failed
                ? t("Try again", "تلاش دوباره")
                : recovered
                  ? t("Read again", "خواندن دوباره")
                  : t("Read invoice", "خواندن فاکتور")}
            </Button>
            <Button variant="secondary" onClick={() => void manual()}>
              {t("Enter by hand", "ورود دستی")}
            </Button>
            {(failed || settings.mode !== "live") && demoReadingAvailable && (
              <Button variant="neutral" onClick={() => void simulate()}>
                {t("Use simulated reading", "استفاده از خوانش شبیه‌سازی‌شده")}
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
