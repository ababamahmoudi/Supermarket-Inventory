/** Test-only jsdom has no native raster decoder; retained fixture PNG bytes are deliberately invalid. */
import { vi } from "vitest";
export function installMissingInvoiceImageDecoder() {
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    },
  );
}
