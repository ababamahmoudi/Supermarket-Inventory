import { afterEach, describe, expect, it, vi } from "vitest";
import fictional from "../tests/fixtures/fictional-readings-export.json";
import { parseInvoiceReadings } from "./invoice-readings";
import {
  buildLiveInvoiceReadingsExport,
  LIVE_READING_TIMEOUT_MS,
  LiveReaderError,
  requestLiveInvoiceReading,
  type LiveReaderImage,
  type LiveReaderResponse,
} from "./invoice-live-reader";

const source = fictional.invoices[0];
const images: LiveReaderImage[] = source.pages.map(({ mime, data }) => ({
  mime,
  data,
}));
const response = (): LiveReaderResponse => ({
  reading: structuredClone(source.ai_reading),
  statuses: structuredClone(
    source.ai_statuses,
  ) as LiveReaderResponse["statuses"],
  checksPassed: true,
  models: ["Fictional model A", "Fictional model B"],
  costUSD: "0.11",
  seconds: 84,
});
const options = () => ({
  images,
  originalSha256: [...source.original_sha256],
  fileName: "fictional-live-original.pdf",
  id: "fictional-live-reading",
  exportedAt: "2026-10-28T20:00:00.000Z",
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("live reading envelope uses the existing JSON parser", () => {
  it("retains AI uncertainty and exact source identity without checked-value overlays", () => {
    const input = response();
    const before = structuredClone(input);
    const result = buildLiveInvoiceReadingsExport(input, options());
    const legacy = parseInvoiceReadings(JSON.stringify(fictional));
    expect(result).toMatchObject({
      format: "super-arzon-invoice-readings",
      version: 1,
      reading_schema: "invoice-reading-v2",
      exported_at: "2026-10-28T20:00:00.000Z",
    });
    expect(result.invoices).toHaveLength(1);
    const invoice = result.invoices[0];
    expect(invoice).toMatchObject({
      id: "fictional-live-reading",
      file_name: "fictional-live-original.pdf",
      original_sha256: source.original_sha256,
      ai_reading: legacy.invoices[0].ai_reading,
      ai_statuses: source.ai_statuses,
      ai_source: "live local reader kit",
      ai_models: input.models,
      reading_cost_usd: "0.1100",
      checked_answer: null,
    });
    expect(invoice.pages).toEqual(
      images.map((image, index) => ({ page: index + 1, ...image })),
    );
    expect(input).toEqual(before);
    expect(options().originalSha256).toEqual(source.original_sha256);
  });

  it("keeps ordered pages and the actual repeated PDF-source hash", () => {
    const originalHash = source.original_sha256[0];
    const prepared = [images[0], { mime: "image/jpeg", data: "AQIDBA==" }];
    const result = buildLiveInvoiceReadingsExport(response(), {
      ...options(),
      images: prepared,
      originalSha256: [originalHash, originalHash],
    });
    expect(result.invoices[0].pages).toEqual([
      { page: 1, ...prepared[0] },
      { page: 2, ...prepared[1] },
    ]);
    expect(result.invoices[0].original_sha256).toEqual([
      originalHash,
      originalHash,
    ]);
  });

  it("normalizes numeric reading values and rounds USD metadata with the shared Decimal contract", () => {
    const input = response();
    input.reading.lines![0].unit_cost_before_tax = 0.98015;
    input.costUSD = "0.11005";
    const invoice = buildLiveInvoiceReadingsExport(input, options())
      .invoices[0];
    // No second adapter computes a rounded unit cost before ordinary mapping.
    expect(invoice.ai_reading!.lines![0].unit_cost_before_tax).toBe("0.98015");
    expect(invoice.reading_cost_usd).toBe("0.1101");
  });

  it("allows a failed cross-check with usable lines and retains its check highlights", () => {
    const input = response();
    input.checksPassed = false;
    const invoice = buildLiveInvoiceReadingsExport(input, options())
      .invoices[0];
    expect(invoice.ai_reading!.lines).toHaveLength(
      source.ai_reading.lines.length,
    );
    expect(invoice.ai_statuses["header.supplier_invoice_number"]).toBe("check");
    expect(invoice.checked_answer).toBeNull();
  });

  it.each([
    { originalSha256: [] },
    { originalSha256: ["broken"] },
    { fileName: "" },
  ])(
    "rejects incomplete source evidence rather than manufacturing it: %j",
    (patch) => {
      expect(() =>
        buildLiveInvoiceReadingsExport(response(), { ...options(), ...patch }),
      ).toThrowError(LiveReaderError);
    },
  );

  it("rejects invalid Decimal reading data through the same parser as JSON files", () => {
    const input = response();
    input.reading.lines![0].unit_cost_before_tax = "NaN";
    expect(() => buildLiveInvoiceReadingsExport(input, options())).toThrowError(
      expect.objectContaining({ code: "invalid_response" }),
    );
  });
});

describe("one live request", () => {
  it("sends only ordered images, never credentials, record fields or extra image properties", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(response()));
    vi.stubGlobal("fetch", fetcher);
    const withOtherData = images.map((image) => ({
      ...image,
      invoice_id: "must-not-leave-the-browser",
      business: { cost: "12.5000" },
    }));
    const result = await requestLiveInvoiceReading(
      "http://reader.example:5191/local/",
      withOtherData,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [address, init] = fetcher.mock.calls[0];
    expect(address).toBe(
      "http://reader.example:5191/local/api/v1/invoice-readings",
    );
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      mode: "cors",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
    });
    expect(JSON.parse(String(init?.body))).toEqual({ images });
    expect(Object.keys(JSON.parse(String(init?.body)))).toEqual(["images"]);
    expect(result).toMatchObject({
      checksPassed: true,
      costUSD: "0.11",
      seconds: 84,
      models: ["Fictional model A", "Fictional model B"],
    });
  });

  it("accepts numeric kit cost and a failed cross-check when usable lines remain", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          json({ ...response(), costUSD: 0.11, checksPassed: false }),
        ),
    );
    const result = await requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
    );
    expect(result.costUSD).toBe("0.11");
    expect(result.checksPassed).toBe(false);
    expect(result.statuses).toEqual(source.ai_statuses);
  });

  it.each([
    [
      "HTTP500",
      () => Promise.resolve(json({ error: "fictional" }, 500)),
      "http",
    ],
    [
      "network/CORS",
      () => Promise.reject(new TypeError("Failed to fetch")),
      "network",
    ],
    [
      "invalid JSON",
      () => Promise.resolve(new Response("{")),
      "invalid_response",
    ],
    ["wrong shape", () => Promise.resolve(json({})), "invalid_response"],
  ] as const)(
    "returns a calm typed failure for %s without any retry",
    async (_label, reply, code) => {
      vi.useFakeTimers();
      const fetcher = vi.fn<typeof fetch>().mockImplementation(reply);
      vi.stubGlobal("fetch", fetcher);
      await expect(
        requestLiveInvoiceReading("http://localhost:5191", images),
      ).rejects.toMatchObject({ code });
      await vi.advanceTimersByTimeAsync(LIVE_READING_TIMEOUT_MS * 2);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each([
    { reading: null },
    { reading: { lines: [] }, checksPassed: false },
    { reading: { lines: [{}] }, checksPassed: false },
    {
      reading: { lines: [{ unknown_reader_metadata: "not an item" }] },
      checksPassed: false,
    },
    {
      reading: {
        lines: [
          {
            line_type: "fee",
            description: "Fictional fee",
            line_total: "1.00",
          },
        ],
      },
      checksPassed: false,
    },
    {
      reading: { lines: [{ line_type: "item", pack_size: "12 × 500 g" }] },
      checksPassed: false,
    },
    {
      reading: { lines: [{ line_no: 1, line_type: "item" }] },
      checksPassed: false,
    },
    {
      reading: { lines: [{ line_type: "item", unclear_fields: ["quantity"] }] },
    },
    { reading: { lines: [{ description: { invalid: "object" } }] } },
    {
      reading: {
        schema_version: "other-schema",
        lines: [{ description: "fictional" }],
      },
    },
    { statuses: { "lines[0].quantity": "not-a-status" } },
    { models: ["Fictional model", 42] },
    { seconds: -1 },
    { seconds: "84" },
    { costUSD: "NaN" },
    { costUSD: "0x10" },
    { costUSD: "-0.11" },
  ])("rejects an incomplete or damaged response: %j", async (patch) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ ...response(), ...patch })),
    );
    await expect(
      requestLiveInvoiceReading("http://localhost:5191", images),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("allows incomplete line details to reach the ordinary importer review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        json({
          ...response(),
          checksPassed: false,
          reading: { lines: [{ description: null, quantity: "1" }] },
        }),
      ),
    );
    const result = await requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
    );
    expect(
      buildLiveInvoiceReadingsExport(result, options()).invoices[0].ai_reading,
    ).toMatchObject({ lines: [{ description: null, quantity: "1" }] });
  });

  it("retains a genuine partial barcode item and its checks without requiring readable money", async () => {
    const partial = {
      line_type: "item",
      barcode: "0000000000000",
      description: null,
      quantity: null,
      unit_cost_before_tax: null,
    };
    const statuses = {
      "lines[0].quantity": "check",
      "lines[0].unit_cost_before_tax": "check",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          json({
            ...response(),
            checksPassed: false,
            reading: { lines: [partial] },
            statuses,
          }),
        ),
    );
    const result = await requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
    );
    const exported = buildLiveInvoiceReadingsExport(result, options())
      .invoices[0];
    expect(exported.ai_reading!.lines).toEqual([partial]);
    expect(exported.ai_statuses).toEqual(statuses);
    expect(exported.checked_answer).toBeNull();
  });

  it("keeps a measured zero as item evidence for ordinary review", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          json({
            ...response(),
            checksPassed: false,
            reading: { lines: [{ line_type: "item", quantity: 0 }] },
          }),
        ),
    );
    const result = await requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
    );
    expect(
      buildLiveInvoiceReadingsExport(result, options()).invoices[0].ai_reading!
        .lines![0].quantity,
    ).toBe("0");
  });

  it.each([
    { invalid: [] },
    { invalid: [{ mime: "text/plain", data: "AQIDBA==" }] },
    { invalid: [{ mime: "image/jpeg", data: "broken=" }] },
  ])(
    "rejects unusable image payloads before the network call: %j",
    async ({ invalid }) => {
      const fetcher = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", fetcher);
      await expect(
        requestLiveInvoiceReading("http://localhost:5191", invalid),
      ).rejects.toMatchObject({ code: "images" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid reader address before sending images", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      requestLiveInvoiceReading("http://user:password@localhost:5191", images),
    ).rejects.toMatchObject({ code: "address" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("four-minute deadline and cancellation", () => {
  it("stops at exactly four minutes even if the transport ignores its AbortSignal", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null | undefined;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation((_address, init) => {
        requestSignal = init?.signal;
        return new Promise<Response>(() => undefined);
      });
    vi.stubGlobal("fetch", fetcher);
    let failure: unknown;
    const result = requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
    ).catch((error) => {
      failure = error;
      return error;
    });
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000 - 1);
    expect(failure).toBeUndefined();
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ code: "timeout" });
    expect(requestSignal?.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also limits a response whose body never completes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: () => new Promise(() => undefined),
      } as unknown as Response),
    );
    const result = requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
    ).catch((error) => error);
    await vi.advanceTimersByTimeAsync(LIVE_READING_TIMEOUT_MS);
    expect(await result).toMatchObject({ code: "timeout" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("makes no request when already cancelled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const cancel = new AbortController();
    cancel.abort();
    await expect(
      requestLiveInvoiceReading("http://localhost:5191", images, cancel.signal),
    ).rejects.toMatchObject({ code: "cancelled" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("cancels once and ignores a late success without resubmitting", async () => {
    vi.useFakeTimers();
    let reply!: (value: Response) => void;
    let requestSignal: AbortSignal | null | undefined;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation((_address, init) => {
        requestSignal = init?.signal;
        return new Promise<Response>((resolve) => {
          reply = resolve;
        });
      });
    vi.stubGlobal("fetch", fetcher);
    const cancel = new AbortController();
    const remove = vi.spyOn(cancel.signal, "removeEventListener");
    const result = requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
      cancel.signal,
    ).catch((error) => error);
    cancel.abort();
    expect(await result).toMatchObject({ code: "cancelled" });
    expect(requestSignal?.aborted).toBe(true);
    reply(json(response()));
    await vi.advanceTimersByTimeAsync(LIVE_READING_TIMEOUT_MS);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer and external listener after success", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (_address, init) => {
        requestSignal = init?.signal;
        return json(response());
      }),
    );
    const cancel = new AbortController();
    const remove = vi.spyOn(cancel.signal, "removeEventListener");
    await requestLiveInvoiceReading(
      "http://localhost:5191",
      images,
      cancel.signal,
    );
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    cancel.abort();
    expect(requestSignal?.aborted).toBe(false);
  });
});
