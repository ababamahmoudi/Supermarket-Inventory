import { parseInvoiceReadings } from "./invoice-readings";

/** Large photo exports are read and parsed away from the UI thread. */
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const exported = parseInvoiceReadings(await event.data.text());
    self.postMessage({ ok: true, exported });
  } catch (error) {
    self.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : "invalid_file",
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "invalid_file",
    });
  }
};
