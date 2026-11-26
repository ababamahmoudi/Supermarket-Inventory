import { afterEach, expect, it, vi } from "vitest";
import sample from "../tests/fixtures/fictional-readings-export.json";
import {
  LIVE_READING_TIMEOUT_MS,
  requestLiveInvoiceReading,
} from "./invoice-live-reader";
import { failureFromLiveReadingCause } from "./live-reading-failure-cause";
import { LiveImagePreparationError } from "./invoice-live-images";
const image = [{ mime: "image/jpeg", data: "AQIDBA==" }];
const response = () => ({
  reading: structuredClone(sample.invoices[0].ai_reading),
  statuses: structuredClone(sample.invoices[0].ai_statuses),
  checksPassed: true,
  models: [
    {
      id: "fictional-model-violet",
      ok: true,
      seconds: 12.345,
      costUSD: 0.0123,
      error: null,
    },
  ],
  costUSD: 0.0123,
  seconds: 12.345,
  checkFailures: [],
});
function returning(value: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(value), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("maps only known preparation codes and safely ignores a future code", () => {
  expect(
    failureFromLiveReadingCause(new LiveImagePreparationError("pdf_decode")),
  ).toEqual({ reason: "pdf_decode" });
  expect(
    failureFromLiveReadingCause(
      new LiveImagePreparationError("fictional_future_preparation" as never),
    ),
  ).toEqual({ reason: "unknown" });
});
it.each([
  [null, "invalid_envelope", "response"],
  [{ models: {} }, "invalid_models", "models"],
  [
    { models: [{ id: "  ", error: "Wholly fictional private model error" }] },
    "invalid_model_id",
    "models[].id",
  ],
  [{ statuses: { field: "unknown" } }, "invalid_statuses", "statuses"],
  [{ checksPassed: "yes" }, "invalid_checks_passed", "checksPassed"],
  [{ seconds: -1 }, "invalid_seconds", "seconds"],
  [{ costUSD: "-1.00" }, "invalid_cost_usd", "costUSD"],
  [{ reading: { lines: [] } }, "invalid_items", "reading.lines"],
  [
    { reading: { lines: [{ description: "Fictional" }], private_nested: {} } },
    "invalid_reading",
    "reading",
  ],
] as const)(
  "classifies malformed envelope %j with safe %s details",
  async (patch, reason, field) => {
    returning(patch === null ? null : { ...response(), ...patch });
    await expect(
      requestLiveInvoiceReading("http://fictional-reader.test:5191", image),
    ).rejects.toMatchObject({
      code: "invalid_response",
      diagnostic: { reason, field },
    });
  },
);
it("accepts F0 object/string models and ignores unknown optional metadata", async () => {
  const input = {
    ...response(),
    models: [
      "fictional-model-plain",
      ...response().models,
      {
        id: "fictional-model-optional",
        ok: "unknown",
        seconds: "unavailable",
        costUSD: "invalid",
        error: { private: "Wholly fictional private model error" },
      },
    ],
    extra_unknown: { unused: "Wholly fictional ignored response field" },
  };
  const before = structuredClone(input);
  returning(input);
  const read = await requestLiveInvoiceReading(
    "http://fictional-reader.test:5191",
    image,
  );
  expect(read.models).toEqual([
    "fictional-model-plain",
    "fictional-model-violet",
    "fictional-model-optional",
  ]);
  expect(read.modelDetails).toEqual([
    {
      id: "fictional-model-violet",
      ok: true,
      seconds: 12.345,
      costUSD: "0.0123",
    },
    { id: "fictional-model-optional" },
  ]);
  expect(read.costUSD).toBe("0.0123");
  expect(read.seconds).toBe(12.345);
  expect(JSON.stringify(read)).not.toContain("Wholly fictional");
  expect(input).toEqual(before);
});
it("distinguishes malformed JSON without retaining response text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("{ Wholly fictional private JSON", { status: 200 }),
    ),
  );
  await expect(
    requestLiveInvoiceReading("http://fictional-reader.test:5191", image),
  ).rejects.toMatchObject({
    diagnostic: { reason: "invalid_json", field: "response" },
  });
});
it("records HTTP status without response body or URL", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("Wholly fictional private HTTP body", { status: 503 }),
    ),
  );
  let failure: unknown;
  try {
    await requestLiveInvoiceReading("http://fictional-reader.test:5191", image);
  } catch (cause) {
    failure = cause;
  }
  expect(failureFromLiveReadingCause(failure)).toEqual({
    reason: "http",
    status: 503,
  });
  expect(JSON.stringify(failureFromLiveReadingCause(failure))).not.toMatch(
    /private|reader.test/,
  );
});
it("reports network-or-CORS honestly and discards arbitrary exception text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Wholly fictional private network error");
    }),
  );
  let failure: unknown;
  try {
    await requestLiveInvoiceReading("http://fictional-reader.test:5191", image);
  } catch (cause) {
    failure = cause;
  }
  expect(failureFromLiveReadingCause(failure)).toEqual({
    reason: "network_or_cors",
  });
  expect(
    failureFromLiveReadingCause(
      new Error("Wholly fictional private unknown cause"),
    ),
  ).toEqual({ reason: "unknown" });
});
it("retains a timeout code at the real deadline without an unhandled pending request", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const request = requestLiveInvoiceReading(
    "http://fictional-reader.test:5191",
    image,
  );
  const checked = expect(request).rejects.toMatchObject({
    code: "timeout",
    diagnostic: { reason: "timeout" },
  });
  await vi.advanceTimersByTimeAsync(LIVE_READING_TIMEOUT_MS);
  await checked;
  expect(vi.getTimerCount()).toBe(0);
});
