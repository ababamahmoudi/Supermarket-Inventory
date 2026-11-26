import { beginAppWork } from "./app-work";
import { inspectLiveInvoiceMatching } from "./invoice-live-matching";
import { paintLiveReadingStage } from "./live-reading-paint";
import { failureFromLiveReadingCause } from "./live-reading-failure-cause";
import { liveReadingFailure } from "./live-reading-failure";
import type { AuthenticatedActor } from "./authority-types";
import type { E1DemoContextValue } from "./e1-demo-context";
import {
  loadInvoiceOriginal,
  type ProtectedInvoiceQuery,
} from "./invoice-file-access";
import { requireInvoiceAuthority } from "./invoice-authority";
import {
  beginLiveInvoiceReading,
  settleLiveInvoiceReading,
  applyLiveInvoiceReading,
} from "./invoice-live-reading";
import { prepareLiveReaderImages } from "./invoice-live-images";
import {
  buildLiveInvoiceReadingsExport,
  LIVE_READING_TIMEOUT_MS,
  requestLiveInvoiceReading,
} from "./invoice-live-reader";
import type { InvoiceReadDTO } from "./invoice-projections";
import { getLiveReaderSettings } from "./live-reader-settings";
import {
  clearLiveReadingActive,
  markLiveReadingActive,
} from "./live-reading-activity";

export type LiveReadingStage =
  "preparing" | "reading" | "finding" | "calculating";
export type LiveReadingDetail =
  "pdf_pages" | "invoice_number" | "page_sha256" | "import";
export interface LiveReadingOperation {
  readonly busy: boolean;
  readonly stage: LiveReadingStage;
  readonly failure: boolean;
  readonly detailCode?: LiveReadingDetail;
  readonly attemptId?: string;
}
export interface ReadyInvoiceReading {
  readonly companyId: string;
  readonly invoiceId: string;
  readonly reference: string;
  readonly attemptId: string;
  readonly identity: string;
}
type Ports = Pick<
  E1DemoContextValue,
  "actor" | "command" | "query" | "navigate" | "state"
>;
interface Pending {
  companyId: string;
  invoiceId: string;
  identity: string;
  controller: AbortController;
  timedOut: boolean;
  applying: boolean;
  retired: boolean;
  snapshot: LiveReadingOperation;
}
const idle: LiveReadingOperation = Object.freeze({
  busy: false,
  stage: "preparing",
  failure: false,
});
const noReady: readonly ReadyInvoiceReading[] = Object.freeze([]);
const key = (company: string, invoice: string) =>
  JSON.stringify([company, invoice]);
export function liveReadingIdentity(actor: AuthenticatedActor | null): string {
  return actor
    ? JSON.stringify([
        actor.company_id,
        actor.user_id,
        actor.session_id,
        actor.role,
        actor.authority_epoch,
        actor.person_version,
      ])
    : "";
}
const scope = (entry: Pick<Pending, "companyId" | "invoiceId">) => ({
  company_id: entry.companyId,
  kind: "company_shared" as const,
  entity_id: entry.invoiceId,
});
export function untilReadingCancelled<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted)
    return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", cancel));
  });
}
export async function retainedLiveFiles(
  query: ProtectedInvoiceQuery,
  companyId: string,
  invoiceId: string,
  count: number,
) {
  const files: File[] = [];
  for (let page = 0; page < count; page++) {
    const original = await loadInvoiceOriginal(query, {
      company_id: companyId,
      invoice_id: invoiceId,
      page,
      purpose: "reading",
    });
    files.push(
      new File([original.source], original.name, { type: original.type }),
    );
  }
  return files;
}

/** Owns requests for one mounted application, independently of routed screens. */
export class LiveInvoiceReadingService {
  private entries = new Map<string, Pending>();
  private listeners = new Set<() => void>();
  private ready: readonly ReadyInvoiceReading[] = noReady;
  private readyCheck = 0;
  constructor(private currentPorts: Ports) {}
  private ports() {
    return this.currentPorts;
  }
  setPorts(ports: Ports) {
    const previous = this.currentPorts;
    this.currentPorts = ports;
    // Undo timers and preferences also refresh Context; they do not change
    // invoice authority or source data and must not trigger private read loops.
    if (previous.actor !== ports.actor || previous.state !== ports.state)
      this.reconcile();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish() {
    this.listeners.forEach((listener) => listener());
  }
  snapshot = (companyId: string, invoiceId: string): LiveReadingOperation => {
    const entry = this.entries.get(key(companyId, invoiceId));
    return entry?.identity === liveReadingIdentity(this.ports().actor)
      ? entry.snapshot
      : idle;
  };
  readyReadings = (): readonly ReadyInvoiceReading[] =>
    this.ready.every(
      (notice) => notice.identity === liveReadingIdentity(this.ports().actor),
    )
      ? this.ready
      : noReady;
  private clearActivity(entry: Pending) {
    if (entry.snapshot.attemptId)
      clearLiveReadingActive(
        entry.companyId,
        entry.invoiceId,
        entry.snapshot.attemptId,
      );
  }
  private update(entry: Pending, patch: Partial<LiveReadingOperation>) {
    if (this.entries.get(key(entry.companyId, entry.invoiceId)) !== entry)
      return;
    entry.snapshot = { ...entry.snapshot, ...patch };
    this.publish();
  }
  private present(entry: Pending) {
    return (
      this.entries.get(key(entry.companyId, entry.invoiceId)) === entry &&
      entry.identity === liveReadingIdentity(this.ports().actor)
    );
  }
  private assertIdentity(entry: Pending, actor?: AuthenticatedActor) {
    if (
      !this.present(entry) ||
      (actor && entry.identity !== liveReadingIdentity(actor))
    )
      throw new DOMException("Cancelled", "AbortError");
  }
  private assertActive(entry: Pending) {
    this.assertIdentity(entry);
    if (entry.controller.signal.aborted)
      throw new DOMException("Cancelled", "AbortError");
  }
  /** Selection/settings changes do not own a request; genuine identity/source changes do. */
  reconcile() {
    const current = this.ports();
    const identity = liveReadingIdentity(current.actor);
    let changed = false;
    for (const [id, entry] of this.entries) {
      if (entry.identity !== identity) {
        entry.controller.abort();
        this.clearActivity(entry);
        this.entries.delete(id);
        changed = true;
      } else if (
        entry.snapshot.busy &&
        entry.snapshot.attemptId &&
        !entry.applying
      ) {
        const invoice =
          current.state.invoice?.id === entry.invoiceId
            ? current.state.invoice
            : current.state.invoices?.find(
                (invoice) =>
                  invoice.id === entry.invoiceId &&
                  invoice.company_id === entry.companyId,
              );
        // An invoice can leave a location-filtered read view while its genuine
        // retained handling branch remains permitted. Absence is not cancellation.
        if (
          invoice &&
          (invoice.live_reading?.attempt_id !== entry.snapshot.attemptId ||
            invoice.live_reading?.phase !== "processing")
        ) {
          entry.retired = true;
          entry.controller.abort();
        }
      }
    }
    const retained = this.ready.filter(
      (notice) => notice.identity === identity,
    );
    if (retained.length !== this.ready.length) {
      this.ready = retained;
      changed = true;
    }
    if (changed) this.publish();
    const notices = this.ready;
    if (notices.length) {
      const check = ++this.readyCheck;
      void Promise.all(
        notices.map((notice) =>
          current
            .query(
              "invoices.read",
              {
                company_id: notice.companyId,
                kind: "company_shared",
                entity_id: notice.invoiceId,
              },
              (state, actor) => {
                if (liveReadingIdentity(actor) !== notice.identity)
                  return false;
                try {
                  requireInvoiceAuthority(
                    state,
                    actor,
                    "invoices.read",
                    notice.invoiceId,
                  );
                  const saved =
                    state.invoice.id === notice.invoiceId
                      ? state.invoice
                      : state.invoices?.find(
                          (item) =>
                            item.id === notice.invoiceId &&
                            item.company_id === notice.companyId,
                        );
                  return (
                    !!saved &&
                    ["review", "draft"].includes(saved.status) &&
                    saved.live_reading?.phase === "complete" &&
                    saved.live_reading.attempt_id === notice.attemptId
                  );
                } catch {
                  return false;
                }
              },
            )
            .catch(() => false),
        ),
      ).then((readable) => {
        if (
          check !== this.readyCheck ||
          this.ready !== notices ||
          liveReadingIdentity(this.ports().actor) !== identity
        )
          return;
        if (readable.some((allowed) => !allowed)) {
          this.ready = notices.filter((_, index) => readable[index]);
          this.publish();
        }
      });
    }
  }
  dispose() {
    for (const entry of this.entries.values()) {
      entry.controller.abort();
      this.clearActivity(entry);
    }
    this.entries.clear();
    this.ready = noReady;
    this.publish();
  }
  cancel = (
    companyId: string,
    invoiceId: string,
    expectedAttemptId?: string,
  ) => {
    const entry = this.entries.get(key(companyId, invoiceId));
    if (
      !entry ||
      !entry.snapshot.busy ||
      !this.present(entry) ||
      (expectedAttemptId && entry.snapshot.attemptId !== expectedAttemptId)
    )
      return;
    entry.controller.abort();
    this.clearActivity(entry);
    this.update(entry, { failure: false });
  };
  /** A separately committed source/discard transition has already retired the attempt. */
  retire = (
    companyId: string,
    invoiceId: string,
    expectedAttemptId?: string,
  ) => {
    const notices = this.ready;
    this.ready = notices.filter(
      (notice) =>
        notice.companyId !== companyId ||
        notice.invoiceId !== invoiceId ||
        (expectedAttemptId && notice.attemptId !== expectedAttemptId) ||
        notice.identity !== liveReadingIdentity(this.ports().actor),
    );
    if (this.ready.length !== notices.length) this.publish();
    const entry = this.entries.get(key(companyId, invoiceId));
    if (
      !entry ||
      !this.present(entry) ||
      (expectedAttemptId && entry.snapshot.attemptId !== expectedAttemptId)
    )
      return;
    entry.retired = true;
    this.cancel(companyId, invoiceId, expectedAttemptId);
    this.update(entry, { failure: false, detailCode: undefined });
  };
  dismissReady = (attemptId: string) => {
    this.ready = this.ready.filter((notice) => notice.attemptId !== attemptId);
    this.publish();
  };
  acceptNavigation = (hash: string) => {
    const [route, search = ""] = hash.replace(/^#/, "").split("?");
    if (route !== "invoices") return;
    const invoiceId = new URLSearchParams(search).get("id");
    if (!invoiceId) return;
    const retained = this.ready.filter(
      (notice) =>
        notice.invoiceId !== invoiceId ||
        notice.identity !== liveReadingIdentity(this.ports().actor),
    );
    if (retained.length !== this.ready.length) {
      this.ready = retained;
      this.publish();
    }
  };
  openReady = async (
    notice: ReadyInvoiceReading,
    stillCurrent: () => boolean,
  ) => {
    const captured = liveReadingIdentity(this.ports().actor);
    if (
      notice.identity !== captured ||
      !this.ready.includes(notice) ||
      !stillCurrent()
    )
      return;
    try {
      await this.ports().query(
        "invoices.read",
        {
          company_id: notice.companyId,
          kind: "company_shared",
          entity_id: notice.invoiceId,
        },
        (state, actor) => {
          if (liveReadingIdentity(actor) !== captured)
            throw new Error("Invoice access changed.");
          requireInvoiceAuthority(
            state,
            actor,
            "invoices.read",
            notice.invoiceId,
          );
          const saved =
            state.invoice.id === notice.invoiceId
              ? state.invoice
              : state.invoices?.find(
                  (item) =>
                    item.id === notice.invoiceId &&
                    item.company_id === notice.companyId,
                );
          if (
            !saved ||
            !["review", "draft"].includes(saved.status) ||
            saved.live_reading?.phase !== "complete" ||
            saved.live_reading.attempt_id !== notice.attemptId
          )
            throw new Error("The ready invoice changed.");
        },
      );
      if (
        liveReadingIdentity(this.ports().actor) !== captured ||
        !this.ready.includes(notice) ||
        !stillCurrent()
      )
        return;
      const route = `invoices?id=${encodeURIComponent(notice.invoiceId)}`;
      const unchanged = window.location.hash === `#${route}`;
      this.ports().navigate(route);
      // Same-hash Open still goes through App's existing pending-save guard.
      if (unchanged) window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch {
      this.dismissReady(notice.attemptId);
    }
  };
  start = async (invoice: InvoiceReadDTO): Promise<void> => {
    const initial = this.ports();
    const settings = getLiveReaderSettings(initial.state.config.receiving);
    const identity = liveReadingIdentity(initial.actor);
    if (
      !identity ||
      settings.mode !== "live" ||
      this.snapshot(invoice.company_id, invoice.id).busy
    )
      return;
    const entry: Pending = {
      companyId: invoice.company_id,
      invoiceId: invoice.id,
      identity,
      controller: new AbortController(),
      timedOut: false,
      applying: false,
      retired: false,
      snapshot: { busy: true, stage: "preparing", failure: false },
    };
    this.entries.set(key(entry.companyId, entry.invoiceId), entry);
    this.ready = this.ready.filter(
      (notice) =>
        notice.companyId !== entry.companyId ||
        notice.invoiceId !== entry.invoiceId,
    );
    this.publish();
    let deadline: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      entry.timedOut = true;
      entry.controller.abort();
    }, LIVE_READING_TIMEOUT_MS);
    try {
      const attempt = await this.ports().command(
        "invoices.edit",
        scope(entry),
        (draft, actor) => {
          this.assertActive(entry);
          this.assertIdentity(entry, actor);
          return beginLiveInvoiceReading(draft, actor, entry.invoiceId);
        },
      );
      this.update(entry, { attemptId: attempt.attempt_id });
      this.assertActive(entry);
      markLiveReadingActive(
        entry.companyId,
        entry.invoiceId,
        attempt.attempt_id,
        attempt.started_at,
      );
      const files = await untilReadingCancelled(
        retainedLiveFiles(
          this.ports().query,
          entry.companyId,
          entry.invoiceId,
          attempt.original_sha256s.length,
        ),
        entry.controller.signal,
      );
      const images = await untilReadingCancelled(
        prepareLiveReaderImages(
          files,
          entry.controller.signal,
          attempt.pdf_pages,
        ),
        entry.controller.signal,
      );
      this.assertActive(entry);
      this.update(entry, { stage: "reading" });
      const response = await requestLiveInvoiceReading(
        settings.readerAddress,
        images,
        entry.controller.signal,
      );
      this.assertActive(entry);
      clearTimeout(deadline);
      deadline = undefined;
      this.update(entry, { stage: "finding" });
      const hashes =
        files.length === 1 && files[0].type === "application/pdf"
          ? images.map(() => attempt.original_sha256s[0])
          : attempt.original_sha256s;
      const exported = buildLiveInvoiceReadingsExport(response, {
        images,
        originalSha256: hashes,
        fileName: files[0].name,
        id: entry.invoiceId,
      });
      this.assertActive(entry);
      await paintLiveReadingStage(entry.controller.signal);
      await this.ports().query(
        "invoices.edit",
        scope(entry),
        (state, actor) => {
          this.assertActive(entry);
          this.assertIdentity(entry, actor);
          return inspectLiveInvoiceMatching(state, actor, {
            invoice_id: entry.invoiceId,
            attempt_id: attempt.attempt_id,
            exported,
          });
        },
      );
      this.assertActive(entry);
      this.update(entry, { stage: "calculating" });
      await paintLiveReadingStage(entry.controller.signal);
      this.assertActive(entry);
      entry.applying = true;
      const release = beginAppWork();
      try {
        const result = await this.ports().command(
          "invoices.edit",
          scope(entry),
          (draft, actor) => {
            this.assertActive(entry);
            this.assertIdentity(entry, actor);
            return applyLiveInvoiceReading(draft, actor, {
              invoice_id: entry.invoiceId,
              attempt_id: attempt.attempt_id,
              exported,
              provenance: {
                seconds: response.seconds,
                costUSD: String(response.costUSD),
                models: response.models,
                ...(response.modelDetails
                  ? { modelDetails: response.modelDetails }
                  : {}),
              },
            });
          },
        );
        if (result.skipped.length) {
          const reason = result.skipped[0].reason;
          await this.ports().command(
            "invoices.edit",
            scope(entry),
            (draft, actor) => {
              this.assertIdentity(entry, actor);
              return settleLiveInvoiceReading(draft, actor, {
                invoice_id: entry.invoiceId,
                attempt_id: attempt.attempt_id,
                outcome: "failed",
                diagnostic: liveReadingFailure(
                  reason === "invoice_number" || reason === "page_sha256"
                    ? reason
                    : "import",
                ),
              });
            },
          );
          this.update(entry, {
            failure: true,
            detailCode:
              reason === "invoice_number" || reason === "page_sha256"
                ? reason
                : "import",
          });
        } else if (result.imported.includes(entry.invoiceId)) {
          const reference = await this.ports().query(
            "invoices.read",
            scope(entry),
            (state, actor) => {
              this.assertIdentity(entry, actor);
              requireInvoiceAuthority(
                state,
                actor,
                "invoices.read",
                entry.invoiceId,
              );
              const saved =
                state.invoice.id === entry.invoiceId
                  ? state.invoice
                  : state.invoices?.find(
                      (item) =>
                        item.id === entry.invoiceId &&
                        item.company_id === entry.companyId,
                    );
              if (
                !saved ||
                saved.live_reading?.attempt_id !== attempt.attempt_id ||
                saved.live_reading.phase !== "complete"
              )
                throw new Error("Invoice changed.");
              return saved.supplier_invoice_number;
            },
          );
          this.assertActive(entry);
          this.ready = [
            ...this.ready,
            {
              companyId: entry.companyId,
              invoiceId: entry.invoiceId,
              reference,
              attemptId: attempt.attempt_id,
              identity,
            },
          ];
          this.publish();
        }
      } finally {
        release();
      }
    } catch (cause) {
      const cancelled = entry.controller.signal.aborted && !entry.timedOut;
      if (entry.snapshot.attemptId && this.present(entry) && !entry.retired)
        await this.ports()
          .command("invoices.edit", scope(entry), (draft, actor) => {
            this.assertIdentity(entry, actor);
            return settleLiveInvoiceReading(draft, actor, {
              invoice_id: entry.invoiceId,
              attempt_id: entry.snapshot.attemptId!,
              outcome: cancelled ? "cancelled" : "failed",
              ...(!cancelled
                ? {
                    diagnostic: failureFromLiveReadingCause(
                      cause,
                      entry.timedOut,
                    ),
                  }
                : {}),
            });
          })
          .catch(() => undefined);
      if (this.present(entry) && !cancelled)
        this.update(entry, {
          failure: true,
          ...(cause &&
          typeof cause === "object" &&
          "code" in cause &&
          cause.code === "pdf_pages"
            ? { detailCode: "pdf_pages" as const }
            : {}),
        });
    } finally {
      clearTimeout(deadline);
      this.clearActivity(entry);
      this.update(entry, { busy: false });
    }
  };
}
