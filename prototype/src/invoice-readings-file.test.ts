import { afterEach, expect, it, vi } from "vitest";
import { readInvoiceReadingsFile } from "./invoice-readings-file";
import type { InvoiceReadingsExport } from "./invoice-readings";

class ImportWorker {
  static current: ImportWorker;
  onmessage?: (event: MessageEvent) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    ImportWorker.current = this;
  }
}
afterEach(() => vi.unstubAllGlobals());

it("sends the File to a module worker and releases the worker after successful parsing", async () => {
  vi.stubGlobal("Worker", ImportWorker);
  const file = new File(
    ["a large export is read in the worker"],
    "readings.json",
  );
  const pending = readInvoiceReadingsFile(file);
  const worker = ImportWorker.current;
  expect(worker.postMessage).toHaveBeenCalledWith(file);
  const exported: InvoiceReadingsExport = {
    format: "super-arzon-invoice-readings",
    version: 1,
    reading_schema: "invoice-reading-v2",
    exported_at: "2026-10-21T00:00:00Z",
    invoices: [],
  };
  worker.onmessage?.({ data: { ok: true, exported } } as MessageEvent);
  await expect(pending).resolves.toBe(exported);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it("preserves a validation error code for a precise translated screen error", async () => {
  vi.stubGlobal("Worker", ImportWorker);
  const pending = readInvoiceReadingsFile(new File(["{}"], "wrong.json"));
  ImportWorker.current.onmessage?.({
    data: { ok: false, code: "version", message: "Version 1 is required." },
  } as MessageEvent);
  await expect(pending).rejects.toMatchObject({ code: "version" });
  expect(ImportWorker.current.terminate).toHaveBeenCalledOnce();
});

it("cancelling or leaving the screen terminates parsing without leaving a live worker", async () => {
  vi.stubGlobal("Worker", ImportWorker);
  const controller = new AbortController();
  const pending = readInvoiceReadingsFile(
    new File(["{}"], "readings.json"),
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toThrow("cancelled");
  expect(ImportWorker.current.terminate).toHaveBeenCalledOnce();
});

it("reports a worker read failure and releases its resources", async () => {
  vi.stubGlobal("Worker", ImportWorker);
  const pending = readInvoiceReadingsFile(new File(["{}"], "readings.json"));
  ImportWorker.current.onerror?.();
  await expect(pending).rejects.toThrow("file_read_failed");
  expect(ImportWorker.current.terminate).toHaveBeenCalledOnce();
});
