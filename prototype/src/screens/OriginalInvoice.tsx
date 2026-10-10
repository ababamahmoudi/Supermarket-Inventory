import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useDemo } from "../store";
import { Button, Card, IconButton } from "../ui";
import { LtrText } from "../presentation";
import type { DemoInvoice } from "../types";
import "./invoice-document-c4.css";

function originalBytes(dataUrl: string): Uint8Array {
  const [metadata, payload = ""] = dataUrl.split(/,(.*)/s);
  if (metadata.includes(";base64"))
    return Uint8Array.from(atob(payload), (value) => value.charCodeAt(0));
  return new TextEncoder().encode(decodeURIComponent(payload));
}

export function OriginalInvoice({
  invoice,
  onAttach,
  children,
  bare = false,
}: {
  invoice: DemoInvoice;
  onAttach?: () => void;
  children?: ReactNode;
  bare?: boolean;
}) {
  return (
    <OriginalInvoiceContent
      key={invoice.file_data ?? invoice.id}
      invoice={invoice}
      onAttach={onAttach}
      bare={bare}
    >
      {children}
    </OriginalInvoiceContent>
  );
}

function OriginalInvoiceContent({
  invoice,
  onAttach,
  children,
  bare,
}: {
  invoice: DemoInvoice;
  onAttach?: () => void;
  children?: ReactNode;
  bare: boolean;
}) {
  const { t } = useDemo();
  const media = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(420);
  const [pageRatio, setPageRatio] = useState(1);
  const [fit, setFit] = useState<"page" | "width" | "custom">("page");
  const [customZoom, setCustomZoom] = useState(1);
  const zoom =
    fit === "page"
      ? Math.max(0.25, Math.min(1, height / (width * pageRatio)))
      : fit === "width"
        ? 1
        : customZoom;
  const changeZoom = (next: number) => {
    setCustomZoom(Math.max(0.25, Math.min(4, next)));
    setFit("custom");
  };
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(
    invoice.file_type === "application/pdf" && !!invoice.file_data,
  );
  useEffect(() => {
    const node = media.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(1, entry.contentRect.width));
      setHeight(Math.max(1, entry.contentRect.height));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [invoice.file_data]);
  useEffect(() => {
    if (!invoice.file_data || invoice.file_type !== "application/pdf") return;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    const data = invoice.file_data;
    void import("pdfjs-dist")
      .then(({ getDocument, GlobalWorkerOptions }) => {
        if (cancelled) return;
        GlobalWorkerOptions.workerSrc = workerUrl;
        task = getDocument({
          data: originalBytes(data),
          isEvalSupported: false,
        });
        return task.promise;
      })
      .then((pdf) => {
        if (!cancelled && pdf) {
          setDocument(pdf);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [invoice.file_data, invoice.file_type]);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let cancelled = false;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    void document
      .getPage(page)
      .then((pdfPage) => {
        if (cancelled || !canvas.current) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        setPageRatio(natural.height / natural.width);
        const viewport = pdfPage.getViewport({
          scale: (width / pdfPage.getViewport({ scale: 1 }).width) * zoom,
        });
        const target = canvas.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        target.width = Math.ceil(viewport.width * ratio);
        target.height = Math.ceil(viewport.height * ratio);
        target.style.width = `${viewport.width}px`;
        target.style.height = `${viewport.height}px`;
        const context = target.getContext("2d");
        if (!context) throw new Error("canvas");
        render = pdfPage.render({
          canvas: target,
          canvasContext: context,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        return render.promise;
      })
      .catch((caught: unknown) => {
        if (
          !cancelled &&
          (!(caught instanceof Error) ||
            caught.name !== "RenderingCancelledException")
        )
          setError(true);
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, page, width, zoom]);
  const download = () => {
    if (!invoice.file_data) return;
    const anchor = window.document.createElement("a");
    anchor.href = invoice.file_data;
    anchor.download = invoice.file_name ?? "invoice";
    anchor.click();
  };
  const content = (
    <>
      {children}
      {!invoice.file_data ? (
        <>
          <p className="muted">
            {t("No original attached", "اصل فاکتور پیوست نشده است")}
          </p>
          {onAttach && (
            <Button onClick={onAttach}>
              {t("Attach original", "پیوست اصل فاکتور")}
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="invoice-original-name">
            <LtrText>{invoice.file_name}</LtrText>
          </p>
          <div
            className="invoice-original-controls"
            role="group"
            aria-label={t("Original invoice", "اصل فاکتور")}
          >
            <IconButton
              onClick={() => changeZoom(zoom - 0.25)}
              disabled={zoom <= 0.25}
              aria-label={t("Zoom out", "کوچک‌نمایی")}
            >
              <Minus size={16} />
            </IconButton>
            <LtrText className="invoice-original-zoom" aria-live="polite">
              {Math.round(zoom * 100)}%
            </LtrText>
            <IconButton
              onClick={() => changeZoom(zoom + 0.25)}
              disabled={zoom >= 4}
              aria-label={t("Zoom in", "بزرگ‌نمایی")}
            >
              <Plus size={16} />
            </IconButton>
            <Button variant="secondary" onClick={() => setFit("width")}>
              {t("Fit width", "اندازه عرض")}
            </Button>
            <Button variant="secondary" onClick={() => setFit("page")}>
              {t("Fit page", "اندازه صفحه")}
            </Button>
            <Button variant="secondary" onClick={download}>
              <Download size={16} />
              {t("Download", "دانلود")}
            </Button>
          </div>
          {document && (
            <div className="invoice-pdf-pages">
              <IconButton
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                aria-label={t("Previous page", "صفحه قبل")}
              >
                <ChevronLeft size={16} />
              </IconButton>
              <span>
                {t("Page", "صفحه")}{" "}
                <LtrText>
                  {page} / {document.numPages}
                </LtrText>
              </span>
              <IconButton
                disabled={page >= document.numPages}
                onClick={() => setPage((value) => value + 1)}
                aria-label={t("Next page", "صفحه بعد")}
              >
                <ChevronRight size={16} />
              </IconButton>
            </div>
          )}
          {loading && (
            <p role="status">
              {t("Loading original invoice…", "در حال بارگذاری اصل فاکتور…")}
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {t(
                "The preview could not be opened. Download the original file.",
                "پیش‌نمایش باز نشد. فایل اصلی را دانلود کنید.",
              )}
            </p>
          )}
          <div
            className="invoice-original-media"
            ref={media}
            data-zoom={zoom}
            data-fit={fit}
          >
            {invoice.file_type === "application/pdf" ? (
              <canvas
                ref={canvas}
                role="img"
                aria-label={t("Original invoice PDF", "PDF اصل فاکتور")}
              />
            ) : invoice.file_type?.startsWith("image/") ? (
              <img
                src={invoice.file_data}
                alt={t("Original invoice image", "تصویر اصل فاکتور")}
                style={{ width: `${zoom * 100}%` }}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  if (image.naturalWidth > 0)
                    setPageRatio(image.naturalHeight / image.naturalWidth);
                }}
              />
            ) : (
              <p>
                {t(
                  "Download the original file to view it.",
                  "برای مشاهده، فایل اصلی را دانلود کنید.",
                )}
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
  return bare ? (
    content
  ) : (
    <Card
      title={t("Original invoice", "اصل فاکتور")}
      className="invoice-original-card"
    >
      {content}
    </Card>
  );
}
