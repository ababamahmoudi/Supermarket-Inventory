import { File as NodeFile } from "node:buffer";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { initialState } from "./e1-bootstrap";
import { businessAuditRead } from "./business-audit-read";
import { createInvoice } from "./invoice";
import { discardInvoice } from "./invoice-discard";
import { storeInvoiceUpload } from "./invoice-file-access";
import { readLiveInvoiceFailure } from "./invoice-live-failure";
import {
  attachLiveInvoiceOriginals,
  beginLiveInvoiceReading,
  removeLiveInvoicePage,
  settleLiveInvoiceReading,
} from "./invoice-live-reading";
import {
  projectLiveInvoiceReading,
  redactLiveReadingProvenance,
} from "./invoice-live-reading-projection";
import { invoiceView } from "./invoice-projections";
import { projectHistoryEntry, historyChangePreview } from "./history";
import {
  liveReadingFailure,
  normalizeLiveReadingFailure,
} from "./live-reading-failure";
import type { Activity } from "./types";
import type { RoleId } from "./authority-types";

vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(async (file: File, company: string) => ({
    reference: `idb-file:v1:${company}:${createHash("sha256")
      .update(new Uint8Array(await file.arrayBuffer()))
      .digest("hex")}`,
    name: file.name,
    type: file.type,
    size: file.size,
  })),
}));

async function processing(role: RoleId = "manager") {
  const state = initialState();
  state.invoices = [];
  state.activity = [];
  const actor = authenticatedTestActor(state, role);
  state.invoice = createInvoice(state, actor, "Branch 1", false, {
    empty: true,
  });
  const original = new NodeFile(
    ["Wholly fictional retained original bytes"],
    "fictional-diagnostic.png",
    { type: "image/png" },
  ) as unknown as File;
  const uploaded = await storeInvoiceUpload(
    async (_capability, _scope, project) => project(state, actor),
    original,
    { company_id: actor.company_id, invoice_id: state.invoice.id },
  );
  attachLiveInvoiceOriginals(state, actor, {
    invoice_id: state.invoice.id,
    uploads: [uploaded],
  });
  const attempt = beginLiveInvoiceReading(state, actor, state.invoice.id);
  return { state, actor, attempt };
}

function fail(data: Awaited<ReturnType<typeof processing>>) {
  settleLiveInvoiceReading(data.state, data.actor, {
    ...data.attempt,
    outcome: "failed",
    diagnostic: liveReadingFailure("invalid_model_id"),
  });
}

describe("F11 private accepted-attempt failure details", () => {
  it("retires failure details when F8 changes the active source while preserving its saved original", async () => {
    const data = await processing();
    fail(data);
    const original = structuredClone(data.state.invoice.original_pages);
    const version = data.state.invoice.version ?? 1;
    const edited = removeLiveInvoicePage(data.state, data.actor, {
      invoice_id: data.attempt.invoice_id,
      attempt_id: data.attempt.attempt_id,
      version,
      index: 0,
    });
    expect(edited.retired_attempt_id).toBe(data.attempt.attempt_id);
    expect(data.state.invoice.original_pages).toEqual([]);
    expect(data.state.invoice.retained_original_pages).toEqual(original);
    expect(data.state.invoice.live_reading?.phase).toBe("ready");
    expect(data.state.invoice.live_reading).not.toHaveProperty(
      "failure_diagnostic",
    );
    expect(() =>
      readLiveInvoiceFailure(
        data.state,
        data.actor,
        data.attempt.invoice_id,
        data.attempt.attempt_id,
      ),
    ).toThrow();
    const projected = JSON.stringify(
      invoiceView(data.state, data.actor, data.attempt.invoice_id),
    );
    expect(projected).not.toContain("retained_original_pages");
    expect(projected).not.toContain("failure_diagnostic");
  });
  it("normalizes only fixed reason/field codes and bounded HTTP status, without any supplied payload", () => {
    expect(
      normalizeLiveReadingFailure({
        reason: "invalid_model_id",
        field: "Fictional private field",
        models: ["Fictional private model"],
        response: { key: "Fictional private value" },
        stack: "Fictional private stack",
        status: 503,
      }),
    ).toEqual({ reason: "invalid_model_id", field: "models[].id" });
    expect(
      normalizeLiveReadingFailure({
        reason: "http",
        status: 503,
        body: "Fictional private reader body",
      }),
    ).toEqual({ reason: "http", status: 503 });
    expect(
      normalizeLiveReadingFailure({ reason: "http", status: 9999 }),
    ).toEqual({ reason: "http" });
    expect(() =>
      normalizeLiveReadingFailure({
        reason: "Fictional private arbitrary error",
      }),
    ).toThrow();
  });

  it.each(["owner", "manager"] as const)(
    "%s reads safe retained failure after a genuine new login without changing originals or finance",
    async (role) => {
      const data = await processing();
      const before = structuredClone({
        originals: data.state.invoice.original_pages,
        products: data.state.products,
        ledger: data.state.ledger,
        approvals: data.state.approvals,
      });
      fail(data);
      const actor = authenticatedTestActor(data.state, role);
      const read = readLiveInvoiceFailure(
        data.state,
        actor,
        data.attempt.invoice_id,
        data.attempt.attempt_id,
      );
      expect(read).toEqual({
        reason: "invalid_model_id",
        field: "models[].id",
      });
      expect(data.state.invoice.live_reading?.failure_diagnostic).toEqual(read);
      expect(
        projectLiveInvoiceReading(data.state.invoice.live_reading),
      ).not.toHaveProperty("failure_diagnostic");
      expect(
        JSON.stringify(invoiceView(data.state, actor, data.attempt.invoice_id)),
      ).not.toContain("failure_diagnostic");
      expect({
        originals: data.state.invoice.original_pages,
        products: data.state.products,
        ledger: data.state.ledger,
        approvals: data.state.approvals,
      }).toEqual(before);
      // A reload restores business data, not the former request session witness.
      const { bindAuthoritySnapshot, authoritySnapshot } =
        await import("./authority");
      const restored = structuredClone(data.state);
      bindAuthoritySnapshot(restored, authoritySnapshot(data.state));
      expect(
        readLiveInvoiceFailure(
          restored,
          actor,
          data.attempt.invoice_id,
          data.attempt.attempt_id,
        ),
      ).toEqual(read);
      const next = beginLiveInvoiceReading(
        restored,
        actor,
        data.attempt.invoice_id,
      );
      expect(next.attempt_id).not.toBe(data.attempt.attempt_id);
      expect(restored.invoice.live_reading).not.toHaveProperty(
        "failure_diagnostic",
      );
    },
  );

  it.each(["floor_worker", "branch_supervisor"] as const)(
    "%s can retain an own readable failed invoice but never its diagnostic DTO",
    async (role) => {
      const data = await processing(role);
      fail(data);
      const before = JSON.stringify(data.state);
      expect(
        invoiceView(data.state, data.actor, data.attempt.invoice_id).id,
      ).toBe(data.attempt.invoice_id);
      expect(() =>
        readLiveInvoiceFailure(
          data.state,
          data.actor,
          data.attempt.invoice_id,
          data.attempt.attempt_id,
        ),
      ).toThrow();
      expect(
        JSON.stringify(
          invoiceView(data.state, data.actor, data.attempt.invoice_id),
        ),
      ).not.toContain("failure_diagnostic");
      expect(JSON.stringify(data.state)).toBe(before);
    },
  );

  it.each([
    "attempt",
    "source",
    "version",
    "content",
    "actor",
    "discard",
  ] as const)(
    "rejects stale %s automatic failure before any diagnostic write",
    async (change) => {
      const data = await processing();
      if (change === "attempt")
        beginLiveInvoiceReading(
          data.state,
          data.actor,
          data.attempt.invoice_id,
        );
      if (change === "source")
        data.state.invoice.original_pages![0].original_sha256 = "b".repeat(64);
      if (change === "version")
        data.state.invoice.version = (data.state.invoice.version ?? 1) + 1;
      if (change === "content")
        data.state.invoice.supplier_invoice_number = "FICTIONAL-CHANGED";
      if (change === "actor") authenticatedTestActor(data.state, "manager");
      if (change === "discard")
        discardInvoice(data.state, data.actor, {
          invoice_id: data.attempt.invoice_id,
          expected_version: data.state.invoice.version ?? 1,
          reason: "Fictional discard test",
        });
      const before = JSON.stringify(data.state);
      expect(() => fail(data)).toThrow();
      expect(JSON.stringify(data.state)).toBe(before);
      expect(data.state.invoice.live_reading).not.toHaveProperty(
        "failure_diagnostic",
      );
    },
  );

  it("rejects foreign-company and superseded diagnostic reads without exposing or changing retained evidence", async () => {
    const data = await processing();
    fail(data);
    const foreign = initialState();
    foreign.config.company.seed_key = "fictional-foreign-diagnostics";
    const intruder = authenticatedTestActor(foreign, "manager");
    const before = JSON.stringify(data.state);
    expect(() =>
      readLiveInvoiceFailure(
        data.state,
        intruder,
        data.attempt.invoice_id,
        data.attempt.attempt_id,
      ),
    ).toThrow();
    expect(() =>
      readLiveInvoiceFailure(
        data.state,
        data.actor,
        data.attempt.invoice_id,
        "fictional-wrong-attempt",
      ),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(before);
  });

  it("does not expose another branch's failed source to a genuinely assigned worker", async () => {
    const data = await processing();
    fail(data);
    const otherBranch = authenticatedTestActor(data.state, "floor_worker", {
      locations: ["Branch 2"],
      selection: { kind: "location", location_id: "Branch 2" },
    });
    const before = JSON.stringify(data.state);
    expect(() =>
      invoiceView(data.state, otherBranch, data.attempt.invoice_id),
    ).toThrow();
    expect(() =>
      readLiveInvoiceFailure(
        data.state,
        otherBranch,
        data.attempt.invoice_id,
        data.attempt.attempt_id,
      ),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(before);
  });

  it("does not retain a diagnostic on Cancel and rejects an unknown diagnostic before changing phase", async () => {
    const data = await processing();
    const before = JSON.stringify(data.state);
    expect(() =>
      settleLiveInvoiceReading(data.state, data.actor, {
        ...data.attempt,
        outcome: "failed",
        diagnostic: { reason: "Fictional arbitrary code" } as never,
      }),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(before);
    settleLiveInvoiceReading(data.state, data.actor, {
      ...data.attempt,
      outcome: "cancelled",
      diagnostic: liveReadingFailure("invalid_model_id"),
    });
    expect(data.state.invoice.live_reading?.phase).toBe("cancelled");
    expect(data.state.invoice.live_reading).not.toHaveProperty(
      "failure_diagnostic",
    );
  });

  it("redacts nested diagnostics and selector/dotted patch values from Manager History and generic exports", async () => {
    const data = await processing();
    fail(data);
    const privateValue = "Wholly fictional private transport value";
    const entry: Activity = {
      id: "fictional-diagnostic-history",
      company_id: data.actor.company_id,
      branch: "Branch 1",
      action: "Edit invoice",
      by: data.actor.actor,
      actor_user_id: data.actor.user_id,
      at: new Date().toISOString(),
      entity_type: "invoice",
      entity_id: data.attempt.invoice_id,
      reversible: true,
      before: {
        nested: {
          live_reading: {
            failure_diagnostic: {
              reason: "invalid_model_id",
              raw: privateValue,
            },
          },
        },
      },
      after: { failure_diagnostic: privateValue },
      reversal: [
        {
          path: [
            "invoices",
            { key: "id", value: data.attempt.invoice_id },
            "live_reading",
            "failure_diagnostic",
            "reason",
          ],
          before: privateValue,
          after: privateValue,
          before_exists: true,
          after_exists: true,
        },
      ],
    };
    data.state.activity.push(entry);
    const patch = {
      path: ["invoice.live_reading.failure_diagnostic.reason"],
      before: privateValue,
      after: privateValue,
      current: privateValue,
      guards: privateValue,
    };
    const nested = {
      patch: {
        path: ["invoice", { key: "failure_diagnostic", value: "reason" }],
      },
      before: privateValue,
      after: privateValue,
      current: privateValue,
      guards: privateValue,
    };
    const before = JSON.stringify(data.state);
    const safe = [
      businessAuditRead([entry, patch, nested]),
      redactLiveReadingProvenance([entry, patch, nested]),
      projectHistoryEntry(data.state, data.actor, entry),
      historyChangePreview(data.state, data.actor, entry.id),
    ];
    expect(JSON.stringify(safe)).not.toContain(privateValue);
    expect(JSON.stringify(safe)).not.toContain("failure_diagnostic");
    expect(JSON.stringify(data.state)).toBe(before);
  });
});
