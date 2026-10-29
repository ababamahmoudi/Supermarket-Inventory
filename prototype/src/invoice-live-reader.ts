import Decimal from "decimal.js";
import { createId } from "./ids";
import type { LiveReaderImage } from "./invoice-live-images";
import { readerEndpoint } from "./live-reader-settings";
import { isUsableLiveReadingItem } from "./live-reading-content";
import {
  parseInvoiceReadings,
  type InvoiceReading,
  type InvoiceReadingsExport,
} from "./invoice-readings";
export type { LiveReaderImage } from "./invoice-live-images";

export const LIVE_READING_TIMEOUT_MS = 4 * 60 * 1000;

export interface LiveReaderResponse {
  reading: InvoiceReading;
  statuses: Record<string, "auto" | "check">;
  alternatives?: unknown;
  checksPassed: boolean;
  models: string[];
  /** Decimal text, independent of the company's invoice currency. */
  costUSD: string;
  seconds: number;
}

export type LiveReaderErrorCode =
  | "address"
  | "images"
  | "network"
  | "http"
  | "invalid_response"
  | "timeout"
  | "cancelled";

export class LiveReaderError extends Error {
  constructor(
    readonly code: LiveReaderErrorCode,
    readonly status?: number,
  ) {
    super(
      {
        address: "The reader address is invalid.",
        images: "The invoice has no usable images to send.",
        network: "The reader could not be reached or did not allow this page.",
        http: "The reader could not finish the request.",
        invalid_response:
          "The reader returned an incomplete or invalid reading.",
        timeout: "The reading exceeded the four-minute limit.",
        cancelled: "The reading was cancelled.",
      }[code],
    );
    this.name = "LiveReaderError";
  }
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const scalar = (value: unknown) =>
  value === null ||
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value)) ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));

function hasUsableReading(value: unknown): value is InvoiceReading {
  if (
    !object(value) ||
    (value.schema_version !== undefined &&
      value.schema_version !== "invoice-reading-v2") ||
    !Array.isArray(value.lines) ||
    !value.lines.length ||
    !Object.entries(value).every(
      ([key, item]) => key === "lines" || scalar(item),
    ) ||
    !value.lines.every(
      (line) => object(line) && Object.values(line).every(scalar),
    )
  )
    return false;
  // Core import and transport agree on genuine v2 item evidence. Missing
  // names/quantities/costs still belong in ordinary review, not a second mapper.
  return value.lines.some(isUsableLiveReadingItem);
}

function readResponse(value: unknown): LiveReaderResponse {
  if (
    !object(value) ||
    !hasUsableReading(value.reading) ||
    !object(value.statuses) ||
    !Object.values(value.statuses).every(
      (status) => status === "auto" || status === "check",
    ) ||
    typeof value.checksPassed !== "boolean" ||
    !Array.isArray(value.models) ||
    !value.models.every(
      (model) => typeof model === "string" && Boolean(model.trim()),
    ) ||
    typeof value.seconds !== "number" ||
    !Number.isFinite(value.seconds) ||
    value.seconds < 0 ||
    !["string", "number"].includes(typeof value.costUSD)
  )
    throw new LiveReaderError("invalid_response");
  let costUSD: string;
  try {
    const text = String(value.costUSD).trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))
      throw new LiveReaderError("invalid_response");
    const cost = new Decimal(text);
    if (!cost.isFinite() || cost.isNegative())
      throw new LiveReaderError("invalid_response");
    costUSD = cost.toFixed();
  } catch {
    throw new LiveReaderError("invalid_response");
  }
  return {
    reading: value.reading,
    statuses: value.statuses as LiveReaderResponse["statuses"],
    alternatives: value.alternatives,
    checksPassed: value.checksPassed,
    models: value.models.map((model) => model.trim()),
    costUSD,
    seconds: value.seconds,
  };
}

function imagesOnly(images: readonly LiveReaderImage[]): LiveReaderImage[] {
  if (
    !Array.isArray(images) ||
    !images.length ||
    images.some(
      (image) =>
        !image ||
        typeof image.mime !== "string" ||
        !/^image\/(jpeg|png|webp|gif)$/.test(image.mime) ||
        typeof image.data !== "string" ||
        !image.data ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data) ||
        image.data.length % 4 !== 0,
    )
  )
    throw new LiveReaderError("images");
  return images.map(({ mime, data }) => ({ mime, data }));
}

/** One press makes one images-only request. No retry, provider call or credential is added. */
export async function requestLiveInvoiceReading(
  readerAddress: string,
  images: readonly LiveReaderImage[],
  signal?: AbortSignal,
): Promise<LiveReaderResponse> {
  if (signal?.aborted) throw new LiveReaderError("cancelled");
  const payload = imagesOnly(images);
  let endpoint: string;
  try {
    endpoint = readerEndpoint(readerAddress, "api/v1/invoice-readings");
  } catch {
    throw new LiveReaderError("address");
  }
  const controller = new AbortController();
  let stoppedReason: LiveReaderError | undefined;
  let rejectStopped!: (reason: LiveReaderError) => void;
  const stopped = new Promise<never>((_, reject) => {
    rejectStopped = reject;
  });
  const stop = (code: "cancelled" | "timeout") => {
    if (stoppedReason) return;
    stoppedReason = new LiveReaderError(code);
    controller.abort();
    rejectStopped(stoppedReason);
  };
  const cancel = () => stop("cancelled");
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => stop("timeout"), LIVE_READING_TIMEOUT_MS);
  try {
    const result = (async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "omit",
          mode: "cors",
          cache: "no-store",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
          body: JSON.stringify({ images: payload }),
        });
        if (!response.ok) throw new LiveReaderError("http", response.status);
        let value: unknown;
        try {
          value = await response.json();
        } catch {
          throw new LiveReaderError("invalid_response");
        }
        return readResponse(value);
      } catch (error) {
        if (stoppedReason) throw stoppedReason;
        if (error instanceof LiveReaderError) throw error;
        throw new LiveReaderError("network");
      }
    })();
    return await Promise.race([result, stopped]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

/** Normalize through the existing R1 parser; the normal importer remains the sole mapping path. */
export function buildLiveInvoiceReadingsExport(
  response: LiveReaderResponse,
  options: {
    images: readonly LiveReaderImage[];
    originalSha256: readonly string[];
    fileName: string;
    id?: string;
    exportedAt?: string;
  },
): InvoiceReadingsExport {
  const valid = readResponse(response);
  const images = imagesOnly(options.images);
  try {
    return parseInvoiceReadings(
      JSON.stringify({
        format: "super-arzon-invoice-readings",
        version: 1,
        reading_schema: "invoice-reading-v2",
        exported_at: options.exportedAt ?? new Date().toISOString(),
        invoices: [
          {
            id: options.id ?? createId("live-reading"),
            file_name: options.fileName,
            pages: images.map((image, index) => ({
              page: index + 1,
              ...image,
            })),
            original_sha256: [...options.originalSha256],
            ai_reading: valid.reading,
            ai_statuses: valid.statuses,
            ai_source: "live local reader kit",
            ai_models: valid.models,
            checked_answer: null,
            reading_cost_usd: valid.costUSD,
          },
        ],
      }),
    );
  } catch {
    throw new LiveReaderError("invalid_response");
  }
}
