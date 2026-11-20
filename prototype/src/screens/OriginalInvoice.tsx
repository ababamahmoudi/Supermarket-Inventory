import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
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
  onPageCount,
  onThumbnail,
}: {
  invoice: InvoiceReadDTO;
  onAttach?: () => void;
  children?: ReactNode;
  bare?: boolean;
  onPageCount?: (count: number) => void;
  onThumbnail?: (sourceKey: string, url: string) => void;
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
      onPageCount={onPageCount}
      onThumbnail={onThumbnail}
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
  onPageCount,
  onThumbnail,
}: {
  invoice: InvoiceReadDTO;
  file: ReturnType<typeof useInvoiceOriginal>;
  imagePage: number;
  onImagePage: (page: number) => void;
  onAttach?: () => void;
  children?: ReactNode;
  bare: boolean;
  onPageCount?: (count: number) => void;
  onThumbnail?: (sourceKey: string, url: string) => void;
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
  const [previewReady, setPreviewReady] = useState(false);
  const previewable =
    invoice.file_type === "application/pdf" ||
    invoice.file_type?.startsWith("image/");
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
          onPageCount?.(pdf.numPages);
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
  }, [file.source, invoice.file_type, onPageCount]);
  useEffect(() => {
    if (!document || !onThumbnail) return;
    let active = true;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    void document
      .getPage(1)
      .then(async (pdfPage) => {
        if (!active) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: 56 / natural.width });
        const thumbnail = window.document.createElement("canvas");
        thumbnail.width = Math.ceil(viewport.width);
        thumbnail.height = Math.ceil(viewport.height);
        const context = thumbnail.getContext("2d");
        if (!context) return;
        render = pdfPage.render({
          canvas: thumbnail,
          canvasContext: context,
          viewport,
        });
        await render.promise;
        if (active) onThumbnail(file.key, thumbnail.toDataURL("image/png"));
      })
      .catch(() => {
        // The full viewer reports a failed PDF; a thumbnail stays optional.
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [document, file.key, onThumbnail]);
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
        return render.promise.then(() => {
          if (!cancelled) setPreviewReady(true);
        });
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
            <Button data-invoice-attach="" onClick={onAttach}>
              {t("Attach original", "پیوست اصل فاکتور")}
            </Button>
          )}
        </>
      ) : (
        <>
          {!bare && (
            <p className="invoice-original-name">
              <LtrValue value={file.name ?? invoice.file_name} />
            </p>
          )}
          <div className="invoice-original-toolbar-container">
            <div
              className="invoice-original-controls"
              role="toolbar"
              aria-label={t("Original invoice", "فاکتور اصلی")}
            >
              <div
                className="invoice-original-control-group"
                role="group"
                aria-label={t("Pages", "صفحه‌ها")}
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
                  <ChevronLeft size={16} className="directional" />
                </IconButton>
                <span
                  className="invoice-original-page"
                  aria-live="polite"
                  aria-label={t(
                    `Page ${document ? page : imagePage + 1} of ${document?.numPages ?? invoice.original_page_count ?? 1}`,
                    `صفحه ${document ? page : imagePage + 1} از ${document?.numPages ?? invoice.original_page_count ?? 1}`,
                  )}
                >
                  <LtrValue
                    value={`${document ? page : imagePage + 1} / ${document?.numPages ?? invoice.original_page_count ?? 1}`}
                  />
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
                  <ChevronRight size={16} className="directional" />
                </IconButton>
              </div>
              <div
                className="invoice-original-control-group"
                role="group"
                aria-label={t("Zoom", "بزرگ‌نمایی")}
              >
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
              </div>
              <div
                className="invoice-original-control-group"
                role="group"
                aria-label={t("View", "نما")}
              >
                <IconButton
                  size="sm"
                  aria-label={t("Fit width", "اندازه عرض")}
                  onClick={() => setFit("width")}
                >
                  <MoveHorizontal size={16} aria-hidden="true" />
                </IconButton>
                <IconButton
                  size="sm"
                  className="invoice-original-rotate"
                  onClick={() => setRotation((value) => (value + 90) % 360)}
                  aria-label={t("Rotate", "چرخش")}
                >
                  <RotateCw size={16} />
                </IconButton>
              </div>
              <div
                className="invoice-original-control-group invoice-original-toolbar-end"
                role="group"
                aria-label={t("More document actions", "گزینه‌های بیشتر سند")}
              >
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
                  <MenuItem
                    onClick={() => setRotation((value) => (value + 90) % 360)}
                  >
                    {t("Rotate", "چرخش")}
                  </MenuItem>
                  <MenuItem onClick={download} disabled={!file.source}>
                    {t("Download", "دانلود")}
                  </MenuItem>
                  {onAttach && (
                    <MenuItem onClick={onAttach}>
                      {t("Replace file", "جایگزینی فایل")}
                    </MenuItem>
                  )}
                </Menu>
              </div>
            </div>
          </div>
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
            {!error &&
              !file.error &&
              (loading || file.loading || (previewable && !previewReady)) && (
                <div
                  className="invoice-original-skeleton"
                  role="status"
                  aria-label={t(
                    "Loading original invoice",
                    "بارگذاری اصل فاکتور",
                  )}
                >
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              )}
            {invoice.file_type === "application/pdf" ? (
              <canvas
                ref={canvas}
                role="img"
                aria-label={t("Original invoice PDF", "PDF اصل فاکتور")}
              />
            ) : invoice.file_type?.startsWith("image/") &&
              file.url &&
              !error &&
              !file.error ? (
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
                    if (image.naturalWidth > 0) {
                      setPageRatio(image.naturalHeight / image.naturalWidth);
                      setPreviewReady(true);
                    }
                  }}
                  onError={() => setError(true)}
                />
              </div>
            ) : (
              !invoice.file_type?.startsWith("image/") && (
                <p>
                  {t(
                    "Download the original file to view it.",
                    "برای مشاهده، فایل اصلی را دانلود کنید.",
                  )}
                </p>
              )
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
      title={t("Original invoice", "فاکتور اصلی")}
      className="invoice-original-card"
    >
      {content}
    </Card>
  );
}
