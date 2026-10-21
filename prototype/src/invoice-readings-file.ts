import type { InvoiceReadingsExport } from "./invoice-readings";

/** The worker receives the File itself, avoiding a blocking main-thread JSON.parse. */
export function readInvoiceReadingsFile(
  file: File,
  signal?: AbortSignal,
): Promise<InvoiceReadingsExport> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("cancelled"));
      return;
    }
    const worker = new Worker(
      new URL("./invoice-readings-worker.ts", import.meta.url),
      { type: "module" },
    );
    const close = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      close();
      reject(new Error("cancelled"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<
        | { ok: true; exported: InvoiceReadingsExport }
        | { ok: false; code: string; message: string }
      >,
    ) => {
      close();
      if (event.data.ok) resolve(event.data.exported);
      else {
        const error = new Error(event.data.message);
        Object.assign(error, { code: event.data.code });
        reject(error);
      }
    };
    worker.onerror = () => {
      close();
      reject(new Error("file_read_failed"));
    };
    worker.postMessage(file);
  });
}
