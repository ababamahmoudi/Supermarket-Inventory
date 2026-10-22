import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  MoreHorizontal,
  Plus,
  RotateCw,
} from "lucide-react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useDemo } from "../store";
import { Button, Card, IconButton, Menu, MenuItem } from "../ui";
import { LtrText, LtrValue } from "../presentation";
import type { InvoiceReadDTO } from "../invoice-projections";
import { loadInvoiceOriginal } from "../invoice-file-access";
import { useInvoiceOriginal } from "../use-invoice-original";
import "./invoice-document-c4.css";
import "./invoices-c7.css";
import "./invoice-review/invoice-review.css";

export function OriginalInvoice({
  invoice,
  onAttach,
  children,
  bare = false,
}: {
  invoice: InvoiceReadDTO;
  onAttach?: () => void;
  children?: ReactNode;
  bare?: boolean;
}) {
  const [imageSelection, setImageSelection] = useState({
    invoiceId: invoice.id,
    page: 0,
  });
  const imagePage =
    imageSelection.invoiceId === invoice.id ? imageSelection.page : 0;
  const currentImagePage = Math.min(
    imagePage,
    Math.max(0, (invoice.original_page_count ?? 1) - 1),
  );
  const file = useInvoiceOriginal(invoice, currentImagePage);
  return (
    <OriginalInvoiceContent
      key={file.key}
      invoice={invoice}
      file={file}
      imagePage={currentImagePage}
      onImagePage={(page) => setImageSelection({ invoiceId: invoice.id, page })}
      onAttach={onAttach}
      bare={bare}
    >
      {children}
    </OriginalInvoiceContent>
  );
}

function OriginalInvoiceContent({
  invoice,
  file,
  imagePage,
  onImagePage,
  onAttach,
  children,
  bare,
}: {
  invoice: InvoiceReadDTO;
  file: ReturnType<typeof useInvoiceOriginal>;
  imagePage: number;
  onImagePage: (page: number) => void;
  onAttach?: () => void;
  children?: ReactNode;
  bare: boolean;
}) {
  const { t, query } = useDemo();
  const media = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(420);
  const [pageRatio, setPageRatio] = useState(1);
  const [fit, setFit] = useState<"page" | "width" | "custom">("width");
  const [customZoom, setCustomZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
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
    invoice.file_type === "application/pdf" && invoice.original_available,
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
  }, [invoice.id, invoice.original_available]);
  useEffect(() => {
    if (!file.source || invoice.file_type !== "application/pdf") return;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    void Promise.all([import("pdfjs-dist"), file.source.arrayBuffer()])
      .then(([{ getDocument, GlobalWorkerOptions }, bytes]) => {
        if (cancelled) return;
        GlobalWorkerOptions.workerSrc = workerUrl;
        task = getDocument({
          data: new Uint8Array(bytes),
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
  }, [file.source, invoice.file_type]);
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
        const natural = pdfPage.getViewport({ scale: 1, rotation });
        setPageRatio(natural.height / natural.width);
        const viewport = pdfPage.getViewport({
          scale: (width / natural.width) * zoom,
          rotation,
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
  }, [document, page, width, zoom, rotation]);
  const download = async () => {
    if (!file.source) return;
    let source: Blob;
    try {
      source = (
        await loadInvoiceOriginal(query, {
          company_id: invoice.company_id,
          invoice_id: invoice.id,
          page: imagePage,
        })
      ).source;
    } catch {
      setError(true);
      return;
    }
    const anchor = window.document.createElement("a");
    const url = URL.createObjectURL(source);
    anchor.href = url;
    anchor.download = file.name ?? invoice.file_name ?? "invoice";
    window.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const content = (
    <>
      {children}
      {!invoice.original_available ? (
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
            <LtrValue value={file.name ?? invoice.file_name} />
          </p>
          <div
            className="invoice-original-controls"
            role="group"
            aria-label={t("Original invoice", "اصل فاکتور")}
          >
            <IconButton
              size="sm"
              disabled={document ? page <= 1 : imagePage <= 0}
              onClick={() =>
                document
                  ? setPage((value) => value - 1)
                  : onImagePage(imagePage - 1)
              }
              aria-label={t("Previous page", "صفحه قبل")}
            >
              <ChevronLeft size={16} />
            </IconButton>
            <span className="invoice-original-page" aria-live="polite">
              {t(
                `Page ${document ? page : imagePage + 1} of ${document?.numPages ?? invoice.original_page_count ?? 1}`,
                `صفحه ${document ? page : imagePage + 1} از ${document?.numPages ?? invoice.original_page_count ?? 1}`,
              )}
            </span>
            <IconButton
              size="sm"
              disabled={
                document
                  ? page >= document.numPages
                  : imagePage >= (invoice.original_page_count ?? 1) - 1
              }
              onClick={() =>
                document
                  ? setPage((value) => value + 1)
                  : onImagePage(imagePage + 1)
              }
              aria-label={t("Next page", "صفحه بعد")}
            >
              <ChevronRight size={16} />
            </IconButton>
            <IconButton
              size="sm"
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
              size="sm"
              onClick={() => changeZoom(zoom + 0.25)}
              disabled={zoom >= 4}
              aria-label={t("Zoom in", "بزرگ‌نمایی")}
            >
              <Plus size={16} />
            </IconButton>
            <Button variant="neutral" size="sm" onClick={() => setFit("width")}>
              {t("Fit width", "اندازه عرض")}
            </Button>
            <IconButton
              size="sm"
              onClick={() => setRotation((value) => (value + 90) % 360)}
              aria-label={t("Rotate", "چرخش")}
            >
              <RotateCw size={16} />
            </IconButton>
            <IconButton
              size="sm"
              onClick={download}
              disabled={!file.source}
              aria-label={t("Download", "دانلود")}
            >
              <Download size={16} />
            </IconButton>
            <Menu
              label={t("More", "بیشتر")}
              aria-label={t("More", "بیشتر")}
              icon={<MoreHorizontal size={16} />}
              iconOnly
              showChevron={false}
            >
              <MenuItem onClick={() => setFit("page")}>
                {t("Fit page", "اندازه صفحه")}
              </MenuItem>
              {onAttach && (
                <MenuItem onClick={onAttach}>
                  {t("Replace file", "جایگزینی فایل")}
                </MenuItem>
              )}
            </Menu>
          </div>
          {(loading || file.loading) && (
            <p role="status">
              {t("Loading original invoice…", "در حال بارگذاری اصل فاکتور…")}
            </p>
          )}
          {(error || file.error) && (
            <p role="alert" className="form-error">
              {file.error
                ? t(
                    "The original could not be opened. Allow browser storage and reload the page.",
                    "اصل فایل باز نشد. حافظهٔ مرورگر را فعال کنید و صفحه را دوباره بارگذاری کنید.",
                  )
                : t(
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
            data-rotation={rotation}
            onPointerDown={(event) => {
              if (event.pointerType !== "touch") return;
              event.currentTarget.setPointerCapture(event.pointerId);
              pointers.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              if (pointers.current.size === 2) {
                const [first, second] = [...pointers.current.values()];
                pinch.current = {
                  distance: Math.hypot(first.x - second.x, first.y - second.y),
                  zoom,
                };
              }
            }}
            onPointerMove={(event) => {
              const previous = pointers.current.get(event.pointerId);
              if (!previous) return;
              pointers.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              if (pointers.current.size === 2 && pinch.current) {
                const [first, second] = [...pointers.current.values()];
                const distance = Math.hypot(
                  first.x - second.x,
                  first.y - second.y,
                );
                if (pinch.current.distance > 0)
                  changeZoom(
                    (distance / pinch.current.distance) * pinch.current.zoom,
                  );
              } else if (pointers.current.size === 1) {
                event.currentTarget.scrollLeft += previous.x - event.clientX;
                event.currentTarget.scrollTop += previous.y - event.clientY;
              }
            }}
            onPointerUp={(event) => {
              pointers.current.delete(event.pointerId);
              pinch.current = null;
            }}
            onPointerCancel={(event) => {
              pointers.current.delete(event.pointerId);
              pinch.current = null;
            }}
          >
            {invoice.file_type === "application/pdf" ? (
              <canvas
                ref={canvas}
                role="img"
                aria-label={t("Original invoice PDF", "PDF اصل فاکتور")}
              />
            ) : invoice.file_type?.startsWith("image/") ? (
              <div
                className="invoice-original-image-page"
                style={{
                  width: `${zoom * 100}%`,
                  aspectRatio: rotation % 180 ? pageRatio : 1 / pageRatio,
                }}
              >
                <img
                  src={file.url}
                  key={file.key}
                  alt={t("Original invoice image", "تصویر اصل فاکتور")}
                  style={{
                    width: `${rotation % 180 ? 100 / pageRatio : 100}%`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  }}
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    if (image.naturalWidth > 0)
                      setPageRatio(image.naturalHeight / image.naturalWidth);
                  }}
                />
              </div>
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
