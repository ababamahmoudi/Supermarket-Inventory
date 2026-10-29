import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";

export interface LiveReaderImage {
  mime: string;
  data: string;
}

export const LIVE_READER_MAX_SIDE = 2400;
export const LIVE_READER_MAX_PDF_PAGES = 10;
export const LIVE_READER_JPEG_QUALITY = 0.85;
export const LIVE_READER_PDF_DPI = 200;

export type LiveImagePreparationErrorCode =
  | "empty"
  | "unsupported_file"
  | "image_decode"
  | "pdf_decode"
  | "pdf_pages"
  | "canvas";

export class LiveImagePreparationError extends Error {
  constructor(
    readonly code: LiveImagePreparationErrorCode,
    readonly pageCount?: number,
  ) {
    super(code);
    this.name = "LiveImagePreparationError";
  }
}

function aborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Invoice preparation cancelled.", "AbortError");
}

async function withAbort<T>(promise: Promise<T>, signal?: AbortSignal) {
  aborted(signal);
  if (!signal) return promise;
  let cancel!: () => void;
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () =>
      reject(new DOMException("Invoice preparation cancelled.", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
  try {
    return await Promise.race([promise, cancelled]);
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

/** Preserve aspect ratio without upscaling a photograph. */
export function fitReaderImageDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new LiveImagePreparationError("image_decode");
  const ratio = Math.min(1, LIVE_READER_MAX_SIDE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function canvasFor(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new LiveImagePreparationError("canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

function jpeg(canvas: HTMLCanvasElement): LiveReaderImage {
  let encoded: string;
  try {
    encoded = canvas.toDataURL("image/jpeg", LIVE_READER_JPEG_QUALITY);
  } catch {
    throw new LiveImagePreparationError("canvas");
  }
  const data = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    encoded,
  )?.[1];
  if (!data) throw new LiveImagePreparationError("canvas");
  return { mime: "image/jpeg", data };
}

async function preparePhoto(file: File, signal?: AbortSignal) {
  const image = new Image();
  const url = URL.createObjectURL(file);
  let canvas: HTMLCanvasElement | undefined;
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new LiveImagePreparationError("image_decode"));
      image.src = url;
    });
    await withAbort(loaded, signal);
    aborted(signal);
    const { width, height } = fitReaderImageDimensions(
      image.naturalWidth,
      image.naturalHeight,
    );
    const target = canvasFor(width, height);
    canvas = target.canvas;
    target.context.drawImage(image, 0, 0, width, height);
    aborted(signal);
    return jpeg(canvas);
  } catch (error) {
    aborted(signal);
    if (error instanceof LiveImagePreparationError) throw error;
    throw new LiveImagePreparationError("image_decode");
  } finally {
    image.onload = null;
    image.onerror = null;
    image.removeAttribute("src");
    URL.revokeObjectURL(url);
    if (canvas) canvas.width = canvas.height = 0;
  }
}

async function preparePdf(file: File, signal?: AbortSignal) {
  let task: PDFDocumentLoadingTask | undefined;
  let render: RenderTask | undefined;
  const cancel = () => {
    render?.cancel();
    void task?.destroy().catch(() => undefined);
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const [{ getDocument, GlobalWorkerOptions }, bytes] = await withAbort(
      Promise.all([import("pdfjs-dist"), file.arrayBuffer()]),
      signal,
    );
    aborted(signal);
    GlobalWorkerOptions.workerSrc = workerUrl;
    task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
    // A password-protected file must fail calmly rather than wait for a prompt.
    task.onPassword = () => void task?.destroy().catch(() => undefined);
    const pdf = await withAbort(task.promise, signal);
    aborted(signal);
    if (pdf.numPages > LIVE_READER_MAX_PDF_PAGES)
      throw new LiveImagePreparationError("pdf_pages", pdf.numPages);
    if (!pdf.numPages) throw new LiveImagePreparationError("pdf_decode");
    const pages: LiveReaderImage[] = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      aborted(signal);
      const page = await withAbort(pdf.getPage(index), signal);
      const requested = page.getViewport({ scale: LIVE_READER_PDF_DPI / 72 });
      const ratio = Math.min(
        1,
        LIVE_READER_MAX_SIDE / Math.max(requested.width, requested.height),
      );
      const viewport = page.getViewport({
        scale: (LIVE_READER_PDF_DPI / 72) * ratio,
      });
      const { width, height } = fitReaderImageDimensions(
        viewport.width,
        viewport.height,
      );
      const { canvas, context } = canvasFor(width, height);
      try {
        render = page.render({
          canvas,
          canvasContext: context,
          viewport,
          background: "#ffffff",
        });
        await withAbort(render.promise, signal);
        aborted(signal);
        pages.push(jpeg(canvas));
      } finally {
        render = undefined;
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    }
    return pages;
  } catch (error) {
    aborted(signal);
    if (error instanceof LiveImagePreparationError) throw error;
    throw new LiveImagePreparationError("pdf_decode");
  } finally {
    signal?.removeEventListener("abort", cancel);
    await task?.destroy().catch(() => undefined);
  }
}

/** Prepare only transport images. The supplied original Files are never edited. */
export async function prepareLiveReaderImages(
  files: readonly File[],
  signal?: AbortSignal,
): Promise<LiveReaderImage[]> {
  aborted(signal);
  if (!files.length) throw new LiveImagePreparationError("empty");
  const images: LiveReaderImage[] = [];
  for (const file of files) {
    aborted(signal);
    if (
      file.type === "application/pdf" ||
      (!file.type && /\.pdf$/i.test(file.name))
    )
      images.push(...(await preparePdf(file, signal)));
    else if (
      file.type.startsWith("image/") ||
      (!file.type &&
        /\.(?:jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name))
    )
      images.push(await preparePhoto(file, signal));
    else throw new LiveImagePreparationError("unsupported_file");
  }
  return images;
}
