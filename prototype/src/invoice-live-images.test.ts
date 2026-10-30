import { File as NodeFile } from "node:buffer";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fitReaderImageDimensions,
  LIVE_READER_JPEG_QUALITY,
  LIVE_READER_MAX_PDF_PAGES,
  prepareLiveReaderImages,
  livePdfPageCount,
} from "./invoice-live-images";

const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), workerSrc: "" }));
vi.mock("pdfjs-dist", () => ({
  getDocument: pdf.getDocument,
  GlobalWorkerOptions: pdf,
}));

const twoPages = readFileSync("tests/fixtures/r3-fictional-two-page.pdf");
const elevenPages = readFileSync("tests/fixtures/r3-fictional-eleven-page.pdf");
const file = (name: string, type: string, bytes: Uint8Array | string = name) =>
  new NodeFile([bytes], name, { type }) as unknown as File;
const originalPdf = () =>
  file("fictional-two-page.pdf", "application/pdf", twoPages);
const urls = new Map<string, File>();
let serial = 0;
let hangPhoto = false;
let whiteBackgrounds: string[];
let encoded: { type: string | undefined; quality: number | undefined }[];

class FictionalImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  sourceName = "";
  set src(value: string) {
    const source = urls.get(value)!;
    this.sourceName = source.name;
    [this.naturalWidth, this.naturalHeight] = source.name.includes("large")
      ? [6000, 4000]
      : [800, 1200];
    if (!hangPhoto)
      queueMicrotask(() =>
        source.name.includes("broken") ? this.onerror?.() : this.onload?.(),
      );
  }
  removeAttribute() {}
}

function documentTask(pageCount = 2) {
  const renders: { page: number; width: number; height: number }[] = [];
  const getPage = vi.fn(async (index: number) => ({
    getViewport: ({ scale }: { scale: number }) => ({
      width: (index % 2 ? 1440 : 612) * scale,
      height: (index % 2 ? 720 : 792) * scale,
    }),
    render: vi.fn(({ canvas }: { canvas: HTMLCanvasElement }) => {
      canvas.dataset.page = String(index);
      renders.push({ page: index, width: canvas.width, height: canvas.height });
      return { promise: Promise.resolve(), cancel: vi.fn() };
    }),
    cleanup: vi.fn(),
  }));
  const task = {
    promise: Promise.resolve({ numPages: pageCount, getPage }),
    destroy: vi.fn(async () => undefined),
    onPassword: undefined as undefined | (() => void),
  };
  pdf.getDocument.mockReturnValue(task);
  return { task, getPage, renders };
}

beforeEach(() => {
  urls.clear();
  serial = 0;
  hangPhoto = false;
  whiteBackgrounds = [];
  encoded = [];
  pdf.getDocument.mockReset();
  vi.stubGlobal("Image", FictionalImage);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL(blob: File) {
        const url = `blob:fictional-${++serial}`;
        urls.set(url, blob);
        return url;
      }
      static revokeObjectURL = vi.fn((url: string) => urls.delete(url));
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      const context = {
        fillStyle: "",
        fillRect() {
          whiteBackgrounds.push(context.fillStyle);
        },
        drawImage: (image: FictionalImage) => {
          this.dataset.source = image.sourceName;
        },
      };
      return context as unknown as CanvasRenderingContext2D;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
    function (this: HTMLCanvasElement, type, quality) {
      encoded.push({ type, quality });
      return `data:image/jpeg;base64,${btoa(
        JSON.stringify({
          width: this.width,
          height: this.height,
          source: this.dataset.source,
          page: this.dataset.page,
        }),
      )}`;
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("reader image preparation limits", () => {
  it.each([
    [6000, 4000, 2400, 1600],
    [4000, 6000, 1600, 2400],
    [2400, 2400, 2400, 2400],
    [320, 180, 320, 180],
    [100000, 1, 2400, 1],
  ])(
    "fits %s × %s without upscaling",
    (width, height, expectedW, expectedH) => {
      expect(fitReaderImageDimensions(width, height)).toEqual({
        width: expectedW,
        height: expectedH,
      });
    },
  );
  it.each([0, -1, NaN, Infinity])("rejects invalid dimensions %s", (width) => {
    expect(() => fitReaderImageDimensions(width, 100)).toThrow("image_decode");
  });
  it("prepares ordered photos as bounded white-backed JPEGs without changing their originals", async () => {
    const files = [
      file("large-first.png", "image/png"),
      file("small-second.jpg", "image/jpeg"),
    ];
    const before = await Promise.all(
      files.map((source) => source.arrayBuffer()),
    );
    const images = await prepareLiveReaderImages(files);
    expect(images.map((image) => image.mime)).toEqual([
      "image/jpeg",
      "image/jpeg",
    ]);
    expect(images.map((image) => JSON.parse(atob(image.data)))).toEqual([
      { source: "large-first.png", width: 2400, height: 1600 },
      { source: "small-second.jpg", width: 800, height: 1200 },
    ]);
    expect(encoded).toEqual(
      files.map(() => ({
        type: "image/jpeg",
        quality: LIVE_READER_JPEG_QUALITY,
      })),
    );
    expect(whiteBackgrounds).toEqual(["#ffffff", "#ffffff"]);
    expect(urls.size).toBe(0);
    expect(
      await Promise.all(files.map((source) => source.arrayBuffer())),
    ).toEqual(before);
  });
  it("renders both ordered pages of the fictional PDF at about200dpi within2400px", async () => {
    const { task, getPage, renders } = documentTask();
    const source = originalPdf();
    const images = await prepareLiveReaderImages([source]);
    const input = pdf.getDocument.mock.calls[0][0];
    expect(input.isEvalSupported).toBe(false);
    expect(input.data).toEqual(new Uint8Array(twoPages));
    expect(pdf.workerSrc).toContain("pdf.worker");
    expect(getPage.mock.calls).toEqual([[1], [2]]);
    expect(renders).toEqual([
      { page: 1, width: 2400, height: 1200 },
      { page: 2, width: 1700, height: 2200 },
    ]);
    expect(images.map((image) => JSON.parse(atob(image.data)).page)).toEqual([
      "1",
      "2",
    ]);
    expect(task.destroy).toHaveBeenCalledOnce();
    expect(new Uint8Array(await source.arrayBuffer())).toEqual(
      new Uint8Array(twoPages),
    );
  });
  it("rejects the fictional11-page PDF before rendering or encoding a page", async () => {
    const { task, getPage } = documentTask(11);
    await expect(
      prepareLiveReaderImages([
        file("fictional-eleven-page.pdf", "application/pdf", elevenPages),
      ]),
    ).rejects.toMatchObject({ code: "pdf_pages", pageCount: 11 });
    expect(LIVE_READER_MAX_PDF_PAGES).toBe(10);
    expect(getPage).not.toHaveBeenCalled();
    expect(encoded).toEqual([]);
    expect(task.destroy).toHaveBeenCalledOnce();
  });
  it("keeps mixed source order without sharing a canvas between pages or photos", async () => {
    documentTask();
    const images = await prepareLiveReaderImages([
      file("first.jpg", "image/jpeg"),
      originalPdf(),
      file("last.png", "image/png"),
    ]);
    expect(
      images.map((image) => {
        const evidence = JSON.parse(atob(image.data));
        return evidence.source ?? evidence.page;
      }),
    ).toEqual(["first.jpg", "1", "2", "last.png"]);
  });
});

describe("F8 logical PDF pages and genuine count decoding", () => {
  it("renders only selected PDF pages in their exact order while retaining full source bytes", async () => {
    const { task, getPage } = documentTask();
    const source = originalPdf(),
      before = await source.arrayBuffer();
    const images = await prepareLiveReaderImages([source], undefined, [2, 1]);
    expect(getPage.mock.calls).toEqual([[2], [1]]);
    expect(images.map((image) => JSON.parse(atob(image.data)).page)).toEqual([
      "2",
      "1",
    ]);
    expect(await source.arrayBuffer()).toEqual(before);
    expect(task.destroy).toHaveBeenCalledOnce();
  });
  it.each([[[]], [[0]], [[3]], [[1, 1]], [[NaN]], [[1.5]]])(
    "rejects invalid selection %j before rendering any source page",
    async (selection) => {
      const { task, getPage } = documentTask();
      await expect(
        prepareLiveReaderImages([originalPdf()], undefined, selection),
      ).rejects.toMatchObject({ code: "pdf_selection" });
      expect(getPage).not.toHaveBeenCalled();
      expect(encoded).toEqual([]);
      expect(task.destroy).toHaveBeenCalledOnce();
    },
  );
  it("cannot apply PDF page numbers to a photo or a mixed source batch", async () => {
    const photo = file("fictional-photo.png", "image/png");
    await expect(
      prepareLiveReaderImages([photo], undefined, [1]),
    ).rejects.toMatchObject({ code: "pdf_selection" });
    await expect(
      prepareLiveReaderImages([originalPdf(), photo], undefined, [1]),
    ).rejects.toMatchObject({ code: "pdf_selection" });
    expect(pdf.getDocument).not.toHaveBeenCalled();
    expect(encoded).toEqual([]);
  });
  it("decodes the actual eleven-page metadata without rendering or relaxing the ten-page read guard", async () => {
    const { task, getPage } = documentTask(11);
    const source = file("fictional-eleven.pdf", "application/pdf", elevenPages);
    expect(await livePdfPageCount(source)).toBe(11);
    expect(pdf.getDocument.mock.calls[0][0].data).toEqual(
      new Uint8Array(elevenPages),
    );
    expect(getPage).not.toHaveBeenCalled();
    expect(encoded).toEqual([]);
    expect(task.destroy).toHaveBeenCalledOnce();
    expect(new Uint8Array(await source.arrayBuffer())).toEqual(
      new Uint8Array(elevenPages),
    );
  });
  it("honours cancelled metadata inspection before reading or decoding an original", async () => {
    const controller = new AbortController();
    controller.abort();
    const source = originalPdf(),
      read = vi.spyOn(source, "arrayBuffer");
    await expect(
      livePdfPageCount(source, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(read).not.toHaveBeenCalled();
    expect(pdf.getDocument).not.toHaveBeenCalled();
  });
});

describe("preparation failures and cancellation", () => {
  it("rejects empty and unsupported input without decoding", async () => {
    await expect(prepareLiveReaderImages([])).rejects.toMatchObject({
      code: "empty",
    });
    await expect(
      prepareLiveReaderImages([file("fictional.txt", "text/plain")]),
    ).rejects.toMatchObject({ code: "unsupported_file" });
    expect(urls.size).toBe(0);
    expect(pdf.getDocument).not.toHaveBeenCalled();
  });
  it("releases an undecodable photo's object URL", async () => {
    await expect(
      prepareLiveReaderImages([file("broken.jpg", "image/jpeg")]),
    ).rejects.toMatchObject({ code: "image_decode" });
    expect(urls.size).toBe(0);
  });
  it("reports a failed PDF parse and releases its loading task", async () => {
    const task = {
      promise: Promise.reject(new Error("fictional damaged PDF")),
      destroy: vi.fn(async () => undefined),
    };
    pdf.getDocument.mockReturnValue(task);
    await expect(
      prepareLiveReaderImages([originalPdf()]),
    ).rejects.toMatchObject({
      code: "pdf_decode",
    });
    expect(task.destroy).toHaveBeenCalledOnce();
  });
  it("honours an already-cancelled operation before reading any original", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareLiveReaderImages([originalPdf()], controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(pdf.getDocument).not.toHaveBeenCalled();
  });
  it("cancels a pending photo decode and releases its source URL", async () => {
    hangPhoto = true;
    const controller = new AbortController();
    const preparing = prepareLiveReaderImages(
      [file("pending.jpg", "image/jpeg")],
      controller.signal,
    );
    controller.abort();
    await expect(preparing).rejects.toMatchObject({ name: "AbortError" });
    expect(urls.size).toBe(0);
  });
  it("cancels an active PDF render without encoding or starting its next page", async () => {
    let entered!: () => void;
    const rendering = new Promise<void>((resolve) => (entered = resolve));
    const cancel = vi.fn();
    const cleanup = vi.fn();
    const getPage = vi.fn(async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 300 * scale,
        height: 400 * scale,
      }),
      render: () => {
        entered();
        return { promise: new Promise<void>(() => undefined), cancel };
      },
      cleanup,
    }));
    const destroy = vi.fn(async () => undefined);
    pdf.getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 2, getPage }),
      destroy,
    });
    const controller = new AbortController();
    const preparing = prepareLiveReaderImages(
      [originalPdf()],
      controller.signal,
    );
    await rendering;
    controller.abort();
    await expect(preparing).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(getPage).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalled();
    expect(encoded).toEqual([]);
  });
});
