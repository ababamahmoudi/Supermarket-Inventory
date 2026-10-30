import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { AuthenticatedActor } from "../authority-types";
import type { DemoState } from "../types";
import type { InvoiceReadDTO } from "../invoice-projections";
import {
  addLiveInvoicePages,
  removeLiveInvoicePage,
  reorderLiveInvoiceOriginals,
  selectLiveInvoicePdfPages,
} from "../invoice-live-reading";
import type { LivePdfPagesAccess } from "../invoice-live-pdf-pages";
import {
  storeInvoiceUpload,
  type ProtectedInvoiceQuery,
  type InvoiceUploadHandle,
} from "../invoice-file-access";
import {
  invoiceEntryOrigin,
  requireInvoiceEntryOrigin,
} from "../invoice-intake";
import { useLiveInvoiceReadingService } from "../live-invoice-reading-context";
import { useNavigationIntent } from "../use-navigation-intent";
import { FitText } from "../FitText";
import { useDemo } from "../store";
import { Button, Dialog, IconButton } from "../ui";

type EditResult = {
  invoice_id: string;
  retired_attempt_id: string;
  version: number;
};

/** Edits one captured unread source; opening a different workspace never retargets it. */
export function LiveInvoicePages({
  invoice,
  files,
  pdfAccess,
  pdfSelection,
  pdf,
  disabled,
  onChanging,
  onDetail,
}: {
  invoice: InvoiceReadDTO;
  files: readonly File[];
  pdfAccess?: LivePdfPagesAccess;
  pdfSelection: readonly number[] | null;
  pdf: boolean;
  disabled: boolean;
  onChanging(changing: boolean): void;
  onDetail(detail: string): void;
}) {
  const { actor, command, query, t } = useDemo();
  const service = useLiveInvoiceReadingService();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const origin = actor ? invoiceEntryOrigin(actor) : "signed-out";
  const captureIntent = useNavigationIntent(
    `${origin}:${invoice.id}:${invoice.version}:${invoice.live_reading?.attempt_id}`,
  );
  const pending = useRef(false);
  const picker = useRef<{
    origin: string;
    isCurrent(): boolean;
    target: ReturnType<typeof target>;
  } | null>(null);
  const [addPdfOpen, setAddPdfOpen] = useState(false);
  const [error, setError] = useState("");
  const editable =
    ["ready", "failed", "cancelled"].includes(
      invoice.live_reading?.phase ?? "",
    ) &&
    invoice.status === "reading" &&
    !invoice.lines.length &&
    !invoice.reading_record;
  const unavailable = disabled || !editable;
  const scope = {
    company_id: invoice.company_id,
    kind: "company_shared" as const,
    entity_id: invoice.id,
    mutation: true,
  };
  function target() {
    return {
      invoice_id: invoice.id,
      version: invoice.version ?? 1,
      attempt_id: invoice.live_reading?.attempt_id ?? "",
    };
  }
  function start() {
    if (!actor || unavailable || pending.current) return false;
    pending.current = true;
    onChanging(true);
    setError("");
    onDetail("");
    return true;
  }
  function finish() {
    pending.current = false;
    if (mounted.current) onChanging(false);
  }
  function fail() {
    if (mounted.current)
      setError(
        t(
          "The pages changed. Open the saved draft and try again.",
          "صفحه‌ها تغییر کردند. پیش‌نویس ذخیره‌شده را باز کنید و دوباره تلاش کنید.",
        ),
      );
  }
  async function edit(
    operation: (state: DemoState, current: AuthenticatedActor) => EditResult,
  ) {
    if (!start()) return false;
    try {
      const result = await command("invoices.edit", scope, (state, current) => {
        requireInvoiceEntryOrigin(current, origin);
        return operation(state, current);
      });
      if (result.retired_attempt_id)
        service.retire(
          invoice.company_id,
          result.invoice_id,
          result.retired_attempt_id,
        );
      return true;
    } catch {
      fail();
      return false;
    } finally {
      finish();
    }
  }
  function choosePhotos() {
    if (!actor || unavailable || pending.current || !input.current) return;
    picker.current = { origin, isCurrent: captureIntent(), target: target() };
    input.current.value = "";
    input.current.click();
  }
  async function addPhotos(filesChosen: readonly File[]) {
    const request = picker.current;
    picker.current = null;
    if (!request || !filesChosen.length || !request.isCurrent()) return;
    if (
      filesChosen.some(
        (file) => !file.size || !/^image\/(png|jpeg|webp|gif)$/.test(file.type),
      )
    ) {
      setError(
        t(
          "Choose PNG, JPEG, WebP or GIF invoice photos.",
          "عکس‌های فاکتور با قالب PNG، JPEG، WebP یا GIF انتخاب کنید.",
        ),
      );
      return;
    }
    if (!start()) return;
    try {
      const guardedQuery: ProtectedInvoiceQuery = (
        capability,
        resource,
        project,
      ) =>
        query(capability, resource, (state, current) => {
          requireInvoiceEntryOrigin(current, request.origin);
          return project(state, current);
        });
      const uploads: InvoiceUploadHandle[] = [];
      for (const file of filesChosen)
        uploads.push(
          await storeInvoiceUpload(guardedQuery, file, {
            company_id: invoice.company_id,
            invoice_id: request.target.invoice_id,
          }),
        );
      const result = await command("invoices.edit", scope, (state, current) => {
        requireInvoiceEntryOrigin(current, request.origin);
        return addLiveInvoicePages(state, current, {
          ...request.target,
          uploads,
        });
      });
      if (result.retired_attempt_id)
        service.retire(
          invoice.company_id,
          result.invoice_id,
          result.retired_attempt_id,
        );
    } catch {
      fail();
    } finally {
      finish();
    }
  }
  async function selectPdf(selection: number[]) {
    if (!pdfAccess) return false;
    return edit((state, current) =>
      selectLiveInvoicePdfPages(state, current, {
        ...target(),
        selection,
        access: pdfAccess,
      }),
    );
  }
  function move(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= files.length) return;
    const order = files.map((_, position) => position);
    [order[index], order[next]] = [order[next], order[index]];
    void edit((state, current) =>
      reorderLiveInvoiceOriginals(state, current, { ...target(), order }),
    );
  }
  const selected = pdfSelection ?? [];
  const omitted =
    pdfAccess && pdfAccess.pages <= 10
      ? Array.from({ length: pdfAccess.pages }, (_, index) => index + 1).filter(
          (page) => !selected.includes(page),
        )
      : [];
  return (
    <div
      className="live-invoice-page-editor"
      data-testid="live-invoice-page-editor"
    >
      {pdf && pdfAccess && pdfAccess.pages <= 10 ? (
        <>
          <ol className="live-reading-pages" data-testid="live-reading-pages">
            {selected.map((page) => (
              <li key={page}>
                <span className="live-reading-page-name">
                  {t(`Page ${page}`, `صفحهٔ ${page}`)}
                </span>
                <IconButton
                  variant="secondary"
                  disabled={unavailable}
                  aria-label={t(`Remove page ${page}`, `حذف صفحهٔ ${page}`)}
                  onClick={() =>
                    void selectPdf(selected.filter((number) => number !== page))
                  }
                >
                  <Trash2 size={18} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            disabled={unavailable || !omitted.length}
            onClick={() => setAddPdfOpen(true)}
          >
            <Plus size={18} aria-hidden="true" />
            {t("Add page", "افزودن صفحه")}
          </Button>
          <p className="helper">
            {t(
              "Only listed pages are read. The full original PDF stays saved.",
              "فقط صفحه‌های این فهرست خوانده می‌شوند. اصل کامل PDF ذخیره می‌ماند.",
            )}
          </p>
          <Dialog
            open={addPdfOpen}
            onOpenChange={setAddPdfOpen}
            title={t("Add a PDF page", "افزودن صفحهٔ PDF")}
            description={t(
              "Choose a saved page from this PDF.",
              "صفحه‌ای ذخیره‌شده از همین PDF انتخاب کنید.",
            )}
            footer={
              <Button variant="neutral" onClick={() => setAddPdfOpen(false)}>
                {t("Cancel", "انصراف")}
              </Button>
            }
          >
            <div className="live-pdf-page-choices">
              {omitted.map((page) => (
                <Button
                  key={page}
                  variant="secondary"
                  disabled={unavailable}
                  onClick={() =>
                    void selectPdf(
                      [...selected, page].sort((a, b) => a - b),
                    ).then((accepted) => {
                      if (accepted && mounted.current) setAddPdfOpen(false);
                    })
                  }
                >
                  {t(`Add page ${page}`, `افزودن صفحهٔ ${page}`)}
                </Button>
              ))}
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </Dialog>
        </>
      ) : (
        <>
          {files.length > 0 && (
            <ol className="live-reading-pages" data-testid="live-reading-pages">
              {files.map((file, index) => (
                <li key={`${index}:${file.name}`}>
                  <span className="live-reading-page-number">{index + 1}</span>
                  <FitText
                    className="live-reading-page-name"
                    value={file.name}
                  />
                  {!pdf && (
                    <span className="actions">
                      {files.length > 1 && (
                        <>
                          <IconButton
                            variant="secondary"
                            disabled={unavailable || index === 0}
                            aria-label={t(
                              `Move page ${index + 1} up`,
                              `انتقال صفحهٔ ${index + 1} به بالا`,
                            )}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp size={18} aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            variant="secondary"
                            disabled={unavailable || index === files.length - 1}
                            aria-label={t(
                              `Move page ${index + 1} down`,
                              `انتقال صفحهٔ ${index + 1} به پایین`,
                            )}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown size={18} aria-hidden="true" />
                          </IconButton>
                        </>
                      )}
                      <IconButton
                        variant="secondary"
                        disabled={unavailable}
                        aria-label={t(
                          `Remove page ${index + 1}`,
                          `حذف صفحهٔ ${index + 1}`,
                        )}
                        onClick={() =>
                          void edit((state, current) =>
                            removeLiveInvoicePage(state, current, {
                              ...target(),
                              index,
                            }),
                          )
                        }
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </IconButton>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {!pdf && (
            <>
              <Button
                variant="secondary"
                disabled={unavailable}
                onClick={choosePhotos}
              >
                <Plus size={18} aria-hidden="true" />
                {t("Add page", "افزودن صفحه")}
              </Button>
              <input
                ref={input}
                type="file"
                className="ui-file-input"
                accept="image/*"
                multiple
                aria-label={t("Add invoice photos", "افزودن عکس‌های فاکتور")}
                data-testid="live-invoice-add-pages"
                disabled={unavailable}
                onChange={(event) => {
                  const chosen = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  void addPhotos(chosen);
                }}
              />
              {invoice.original_page_count > files.length && (
                <p className="helper">
                  {t(
                    "Only listed pages are read. Removed pages remain in the saved original.",
                    "فقط صفحه‌های این فهرست خوانده می‌شوند. صفحه‌های حذف‌شده در اصل ذخیره‌شده باقی می‌مانند.",
                  )}
                </p>
              )}
            </>
          )}
        </>
      )}
      {(!files.length || (pdf && pdfSelection?.length === 0)) && (
        <p role="status">
          {t(
            "No pages selected for reading. Add a page to continue.",
            "صفحه‌ای برای خواندن انتخاب نشده است. برای ادامه یک صفحه اضافه کنید.",
          )}
        </p>
      )}
      {error && !addPdfOpen && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
