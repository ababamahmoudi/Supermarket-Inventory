import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  defaultReaderAddress,
  getLiveReaderSettings,
  normalizeReaderAddress,
  ReaderAddressError,
  readerEndpoint,
  saveLiveReaderSettings,
  testReaderConnection,
} from "./live-reader-settings";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("R3 local reader settings", () => {
  it.each([
    ["localhost", "http://localhost:5191"],
    ["172.16.66.128", "http://localhost:5191"],
    ["reader-mac.local", "http://localhost:5191"],
    ["::1", "http://localhost:5191"],
    ["[::1]", "http://localhost:5191"],
  ])("uses localhost regardless of this page host: %s", (host, expected) => {
    expect(defaultReaderAddress(host)).toBe(expected);
  });

  it("uses safe defaults for legacy configuration without writing or resetting it", () => {
    const state = initialState();
    delete state.config.receiving.ai_reading_mode;
    delete state.config.receiving.ai_reader_address;
    const before = structuredClone(state.config);
    expect(
      getLiveReaderSettings(state.config.receiving, "172.16.66.128"),
    ).toEqual({
      mode: "simulated",
      readerAddress: "http://localhost:5191",
    });
    expect(state.config).toEqual(before);
  });

  it.each([undefined, null, "", "  "])(
    "uses localhost for absent or blank retained address %s without changing it",
    (address) => {
      const receiving = initialState().config.receiving;
      receiving.ai_reading_mode = "live";
      receiving.ai_reader_address = address;
      const before = structuredClone(receiving);
      expect(getLiveReaderSettings(receiving, "phone.example.test")).toEqual({
        mode: "live",
        readerAddress: "http://localhost:5191",
      });
      expect(receiving).toEqual(before);
    },
  );

  it("retains an explicit custom address and mode, including malformed input for correction", () => {
    const receiving = initialState().config.receiving;
    receiving.ai_reading_mode = "live";
    receiving.ai_reader_address = "http://other-mac.local:5191/reader/";
    expect(getLiveReaderSettings(receiving)).toEqual({
      mode: "live",
      readerAddress: "http://other-mac.local:5191/reader",
    });
    receiving.ai_reader_address = "not an address";
    expect(getLiveReaderSettings(receiving).readerAddress).toBe(
      "not an address",
    );
    expect(() =>
      readerEndpoint(getLiveReaderSettings(receiving).readerAddress, "/health"),
    ).toThrow(ReaderAddressError);
  });

  it("normalizes one base consistently for health and reading endpoints", () => {
    expect(normalizeReaderAddress(" http://READER.local:5191/base/// ")).toBe(
      "http://reader.local:5191/base",
    );
    expect(readerEndpoint("http://reader.local:5191/base/", "/health")).toBe(
      "http://reader.local:5191/base/health",
    );
    expect(
      readerEndpoint(
        "http://reader.local:5191/base/",
        "/api/v1/invoice-readings",
      ),
    ).toBe("http://reader.local:5191/base/api/v1/invoice-readings");
  });

  it("keeps a malformed restored non-string address visible and rejects it before network", async () => {
    const receiving = initialState().config.receiving;
    Object.assign(receiving, {
      ai_reader_address: { invalid: "retained-address" },
    });
    const before = structuredClone(receiving);
    const result = getLiveReaderSettings(receiving, "default-mac.local");
    expect(result.readerAddress).toBe('{"invalid":"retained-address"}');
    expect(result.readerAddress).not.toBe(
      defaultReaderAddress("default-mac.local"),
    );
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      testReaderConnection(result.readerAddress),
    ).rejects.toBeInstanceOf(ReaderAddressError);
    expect(fetcher).not.toHaveBeenCalled();
    expect(receiving).toEqual(before);
  });

  it.each([
    "ftp://reader.local",
    "javascript:alert(1)",
    "http://person:secret@reader.local",
    "http://reader.local?key=fictional",
    "http://reader.local#key",
    "reader.local:5191",
    "",
  ])(
    "rejects an unsafe or incomplete address before any request: %s",
    (address) => {
      expect(() => normalizeReaderAddress(address)).toThrow(ReaderAddressError);
    },
  );

  it.each(["owner", "manager"] as const)(
    "%s saves only the requested reading settings and records who changed them",
    (role) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, role);
      const products = structuredClone(state.products);
      const rest = structuredClone(state.config.receiving);
      saveLiveReaderSettings(state, actor, {
        mode: "live",
        readerAddress: "http://reader.local:5191/",
      });
      expect(state.config.receiving).toEqual({
        ...rest,
        ai_reading_mode: "live",
        ai_reader_address: "http://reader.local:5191",
      });
      expect(state.products).toEqual(products);
      expect(state.activity[0]).toMatchObject({
        action: "AI reading settings changed",
        entity_id: "receiving",
        company_id: actor.company_id,
        actor_user_id: actor.user_id,
      });
      // The Demo shortcut updates the same mode without overwriting the address.
      saveLiveReaderSettings(state, actor, { mode: "simulated" });
      expect(state.config.receiving.ai_reader_address).toBe(
        "http://reader.local:5191",
      );
      saveLiveReaderSettings(state, actor, {
        mode: "live",
        readerAddress: null,
      });
      expect(state.config.receiving.ai_reader_address).toBeNull();
      expect(
        getLiveReaderSettings(state.config.receiving, "phone-host.local")
          .readerAddress,
      ).toBe("http://localhost:5191");
    },
  );

  it.each(["branch_supervisor", "floor_worker", "cashier"] as const)(
    "%s cannot change the mode or reader address",
    (role) => {
      const state = initialState();
      const actor = authenticatedTestActor(state, role);
      const before = structuredClone(state);
      expect(() =>
        saveLiveReaderSettings(state, actor, {
          mode: "live",
          readerAddress: "http://reader.local:5191",
        }),
      ).toThrow();
      expect(state).toEqual(before);
    },
  );

  it("rejects foreign-company, forged and stale authority without any change", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    const before = structuredClone(state);
    for (const changed of [
      { ...actor, company_id: "other-company" },
      { ...actor, authority_epoch: actor.authority_epoch + 1 },
      { ...actor, session_id: "forged-session" },
    ]) {
      expect(() =>
        saveLiveReaderSettings(state, changed, { mode: "live" }),
      ).toThrow();
      expect(state).toEqual(before);
    }
  });

  it("invalid input leaves settings and history unchanged", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    const before = structuredClone(state);
    expect(() =>
      saveLiveReaderSettings(state, actor, {
        mode: "live",
        readerAddress: "https://reader.local/?key=fictional",
      }),
    ).toThrow(ReaderAddressError);
    expect(state).toEqual(before);
  });
});

describe("R3 reader connection test", () => {
  it("sends exactly one anonymous GET and accepts a successful health response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("ready", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await testReaderConnection("http://reader.local:5191/")).toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("http://reader.local:5191/health", {
      method: "GET",
      credentials: "omit",
      signal: expect.any(AbortSignal),
    });
  });
  it("distinguishes a reachable HTTP failure from an indistinguishable network/CORS failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not ready", { status: 503 })),
    );
    expect(await testReaderConnection("http://reader.local:5191")).toEqual({
      ok: false,
      reason: "http",
      status: 503,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    expect(await testReaderConnection("http://reader.local:5191")).toEqual({
      ok: false,
      reason: "network-or-cors",
    });
  });
  it("stops at five seconds even when the fetch implementation never resolves", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const pending = testReaderConnection("http://reader.local:5191");
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, reason: "timeout" });
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("cancels an obsolete connection result without a retry or a later status", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const result = testReaderConnection(
      "http://reader.local:5191",
      controller.signal,
    );
    const rejected = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
