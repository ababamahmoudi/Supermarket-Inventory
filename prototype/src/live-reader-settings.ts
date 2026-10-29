import type { AuthenticatedActor } from "./authority-types";
import { AuthorityError } from "./authority";
import { actorAudit, guardDomain } from "./domain-authority";
import { createId } from "./ids";
import type { CompanyConfig, DemoState } from "./types";

export type LiveReadingMode = "simulated" | "live";
export const READER_HEALTH_TIMEOUT_MS = 5000;
export class ReaderAddressError extends Error {
  constructor() {
    super(
      "Enter an http:// or https:// reader address without credentials, a query or a fragment.",
    );
    this.name = "ReaderAddressError";
  }
}

export function defaultReaderAddress(
  hostname = typeof window === "undefined"
    ? "localhost"
    : window.location.hostname,
): string {
  const host = hostname || "localhost";
  return `http://${host.includes(":") && !host.startsWith("[") ? `[${host}]` : host}:5191`;
}

export function normalizeReaderAddress(address: string): string {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    throw new ReaderAddressError();
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ReaderAddressError();
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function readerEndpoint(address: string, path: string): string {
  return `${normalizeReaderAddress(address)}/${path.replace(/^\/+/, "")}`;
}

export function getLiveReaderSettings(
  receiving: CompanyConfig["receiving"],
  hostname?: string,
): { mode: LiveReadingMode; readerAddress: string } {
  const retained: unknown = receiving.ai_reader_address;
  let custom = "";
  if (typeof retained === "string") custom = retained.trim();
  else if (retained !== null && retained !== undefined) {
    try {
      custom = JSON.stringify(retained) ?? "Invalid reader address";
    } catch {
      custom = "Invalid reader address";
    }
  }
  let readerAddress = custom || defaultReaderAddress(hostname);
  try {
    readerAddress = normalizeReaderAddress(readerAddress);
  } catch {
    // Keep a retained custom value visible for correction; never silently send
    // an invoice to a different reader when the saved address is malformed.
  }
  return {
    mode: receiving.ai_reading_mode === "live" ? "live" : "simulated",
    readerAddress,
  };
}

/** The settings form and Demo shortcut use this same current-authority command. */
export function saveLiveReaderSettings(
  state: DemoState,
  actor: AuthenticatedActor,
  value: { mode: LiveReadingMode; readerAddress?: string | null },
  now = new Date(),
): void {
  actor = guardDomain(state, actor, "settings.manage", undefined, true);
  if (actor.role !== "owner" && actor.role !== "manager")
    throw new AuthorityError("capability");
  if (value.mode !== "simulated" && value.mode !== "live")
    throw new Error("Invalid reading mode.");
  const before = structuredClone(state.config.receiving);
  const after = { ...before, ai_reading_mode: value.mode };
  if (Object.hasOwn(value, "readerAddress"))
    after.ai_reader_address =
      value.readerAddress === null
        ? null
        : normalizeReaderAddress(value.readerAddress ?? "");
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  state.config.receiving = after;
  state.activity.unshift({
    id: createId("reading-settings"),
    company_id: actor.company_id,
    branch: "all",
    scope: "all",
    action: "AI reading settings changed",
    by: actor.actor,
    at: now.toISOString(),
    ...actorAudit(state, actor, now),
    entity_type: "settings",
    entity_id: "receiving",
    before,
    after: structuredClone(after),
    reversible: true,
  });
}

export type ReaderConnectionResult =
  | { ok: true }
  | {
      ok: false;
      reason: "network-or-cors" | "timeout" | "http";
      status?: number;
    };

export async function testReaderConnection(
  address: string,
  signal?: AbortSignal,
): Promise<ReaderConnectionResult> {
  const endpoint = readerEndpoint(address, "/health");
  const controller = new AbortController();
  const abortError = () =>
    new DOMException("Connection test cancelled.", "AbortError");
  if (signal?.aborted) throw abortError();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, READER_HEALTH_TIMEOUT_MS);
  let stopWaiting: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    stopWaiting = () => reject(abortError());
    controller.signal.addEventListener("abort", stopWaiting, { once: true });
  });
  try {
    const response = await Promise.race([
      fetch(endpoint, {
        method: "GET",
        credentials: "omit",
        signal: controller.signal,
      }),
      aborted,
    ]);
    if (signal?.aborted) throw abortError();
    return response.ok
      ? { ok: true }
      : { ok: false, reason: "http", status: response.status };
  } catch {
    if (signal?.aborted) throw abortError();
    return { ok: false, reason: timedOut ? "timeout" : "network-or-cors" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    if (stopWaiting)
      controller.signal.removeEventListener("abort", stopWaiting);
  }
}
