import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { addManualLine, createInvoice, postInvoice } from "./invoice";
import { attachReversals, reverseActivity } from "./history";
import {
  discardInvoice,
  invoiceDiscardRead,
  isEmptyInvoiceDraft,
} from "./invoice-discard";
import { canInvoiceAuthority } from "./invoice-authority";
import { invoiceView } from "./invoice-projections";
import { invoiceListStage } from "./invoice-records";
import {
  applyLiveInvoiceReading,
  canUseLiveManualInvoice,
  beginLiveInvoiceReading,
  settleLiveInvoiceReading,
} from "./invoice-live-reading";
import {
  liveContentSignature,
  liveOriginalSignature,
} from "./invoice-live-reading-state";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import sample from "../tests/fixtures/fictional-readings-export.json";
import { parseInvoiceReadings } from "./invoice-readings";
import type { DemoState } from "./types";

function draft(role: "manager" | "floor_worker" = "manager") {
  const state = initialState();
  const actor = authenticatedTestActor(state, role);
  state.invoices = [];
  state.activity = [];
  state.invoice = createInvoice(state, actor, "Branch 1", false, {
    empty: true,
  });
  return { state, actor };
}
const snapshot = (state: DemoState) => JSON.stringify(state);
function processing() {
  const data = draft("floor_worker");
  const invoice = data.state.invoice;
  const sha = "a".repeat(64);
  invoice.status = "reading";
  invoice.file_data = `idb-file:v1:${invoice.company_id}:${sha}`;
  invoice.file_name = "fictional-original.png";
  invoice.file_type = "image/png";
  invoice.file_size = 321;
  invoice.original_pages = [
    {
      file_data: invoice.file_data,
      file_name: invoice.file_name,
      file_type: invoice.file_type,
      file_size: 321,
      original_sha256: sha,
    },
  ];
  invoice.live_reading = {
    phase: "processing",
    attempt_id: "fictional-inflight",
    started_at: new Date().toISOString(),
    authority: {
      origin: "local-reader-v1",
      user_id: data.actor.user_id,
      session_id: data.actor.session_id,
      authority_epoch: data.actor.authority_epoch,
      person_version: data.actor.person_version,
      branch: invoice.branch,
      invoice_version: invoice.version ?? 1,
      original_signature: liveOriginalSignature(invoice),
      content_signature: liveContentSignature(invoice),
    },
  };
  data.state.invoices = [structuredClone(invoice)];
  return data;
}

describe("R3c F4 retained invoice discard", () => {
  it("discards a truly empty draft without requiring an entered reason and supports Undo", () => {
    const { state, actor } = draft();
    const before = cloneWithAuthority(state);
    expect(invoiceDiscardRead(state, actor, state.invoice.id).empty).toBe(true);
    discardInvoice(state, actor, {
      invoice_id: state.invoice.id,
      expected_version: 1,
      reason: "",
    });
    const [entry] = attachReversals(before, state, actor);
    expect(state.invoice.status).toBe("cancelled");
    expect(state.invoice.cancellation).toMatchObject({
      by_user_id: actor.user_id,
      by: actor.actor,
      reason: "Empty draft",
    });
    expect(invoiceListStage(state.invoice, {})).toBe("cancelled");
    expect(entry.reversible).toBe(true);
    reverseActivity(state, actor, entry.id, "undo");
    expect(state.invoice.status).toBe("draft");
    expect(state.invoice.cancellation).toBeUndefined();
    expect(state.invoice.version).toBe(3);
    expect(state.activity.at(-1)?.after).toMatchObject({
      status: "draft",
      version: 3,
    });
  });
  it.each(["draft", "review", "reading"] as const)(
    "requires a reason for a nonempty %s and rejects stale/unauthorized attempts atomically",
    (status) => {
      const { state, actor } = draft();
      state.invoice.status = status;
      state.invoice.supplier = "Fictional Meadow Supplier";
      const input = {
        invoice_id: state.invoice.id,
        expected_version: 1,
        reason: "",
      };
      const before = snapshot(state);
      expect(() => discardInvoice(state, actor, input)).toThrow("reason");
      expect(snapshot(state)).toBe(before);
      expect(() =>
        discardInvoice(state, actor, {
          ...input,
          expected_version: 0,
          reason: "Duplicate upload",
        }),
      ).toThrow("changed");
      expect(snapshot(state)).toBe(before);
      const cashier = authenticatedTestActor(state, "cashier");
      const authorityBefore = snapshot(state);
      expect(() =>
        discardInvoice(state, cashier, { ...input, reason: "Duplicate" }),
      ).toThrow();
      expect(snapshot(state)).toBe(authorityBefore);
      discardInvoice(
        state,
        actor,
        { ...input, reason: "  Uploaded twice  " },
        new Date("2026-10-29T17:00:00Z"),
      );
      expect(state.invoice.cancellation).toEqual({
        by_user_id: actor.user_id,
        by: actor.actor,
        at: "2026-10-29T17:00:00.000Z",
        reason: "Uploaded twice",
      });
    },
  );
  it("retains originals/business records, denies cancelled writes and retires old reading across floor-worker Undo", () => {
    const { state, actor } = processing();
    const invoice = structuredClone(state.invoice);
    const finance = structuredClone({
      ledger: state.ledger,
      movements: state.stock_movements,
      products: state.products,
      approvals: state.approvals,
    });
    expect(isEmptyInvoiceDraft(state.invoice)).toBe(false);
    const before = cloneWithAuthority(state);
    discardInvoice(state, actor, {
      invoice_id: invoice.id,
      expected_version: 1,
      reason: "Wrong delivery uploaded",
    });
    const [entry] = attachReversals(before, state, actor);
    expect(entry.reversible).toBe(true);
    expect(state.invoice.original_pages).toEqual(invoice.original_pages);
    expect(state.invoices?.[0]).toEqual(state.invoice);
    expect(
      canInvoiceAuthority(state, actor, "invoices.edit", invoice.id, true),
    ).toBe(false);
    expect(canInvoiceAuthority(state, actor, "invoices.read", invoice.id)).toBe(
      true,
    );
    expect(invoiceView(state, actor, invoice.id).cancellation?.reason).toBe(
      "Wrong delivery uploaded",
    );
    const cancelled = snapshot(state);
    expect(() => beginLiveInvoiceReading(state, actor, invoice.id)).toThrow();
    expect(() =>
      settleLiveInvoiceReading(state, actor, {
        invoice_id: invoice.id,
        attempt_id: "fictional-inflight",
        outcome: "failed",
      }),
    ).toThrow();
    expect(() =>
      applyLiveInvoiceReading(state, actor, {
        invoice_id: invoice.id,
        attempt_id: "fictional-inflight",
        exported: parseInvoiceReadings(JSON.stringify(sample)),
        provenance: {
          seconds: 1,
          costUSD: "0.001",
          models: ["Fictional reader"],
        },
      }),
    ).toThrow();
    expect(() => postInvoice(state, actor)).toThrow();
    expect(snapshot(state)).toBe(cancelled);
    selectInvoiceWorkspace(state, actor, invoice.id);
    expect(snapshot(state)).toBe(cancelled);
    reverseActivity(state, actor, entry.id, "undo");
    expect(state.invoice.status).toBe("reading");
    expect(state.invoice.live_reading?.phase).toBe("cancelled");
    expect(state.invoice.live_reading?.attempt_id).not.toBe(
      "fictional-inflight",
    );
    expect(state.invoice.original_pages).toEqual(invoice.original_pages);
    expect(state.invoices?.[0]).toEqual(state.invoice);
    expect(() =>
      settleLiveInvoiceReading(state, actor, {
        invoice_id: invoice.id,
        attempt_id: "fictional-inflight",
        outcome: "cancelled",
      }),
    ).toThrow();
    const next = beginLiveInvoiceReading(state, actor, invoice.id);
    expect(next.attempt_id).not.toBe("fictional-inflight");
    expect({
      ledger: state.ledger,
      movements: state.stock_movements,
      products: state.products,
      approvals: state.approvals,
    }).toEqual(finance);
  });
  it("discards a saved invoice without replacing active workspace and preserves foreign/posted guards", () => {
    const { state, actor } = draft();
    const saved = structuredClone(state.invoice);
    saved.id = "fictional-saved-invoice";
    saved.supplier = "Fictional saved supplier";
    state.invoices = [saved];
    const active = structuredClone(state.invoice);
    discardInvoice(state, actor, {
      invoice_id: saved.id,
      expected_version: 1,
      reason: "Not this delivery",
    });
    expect(state.invoice).toEqual(active);
    expect(state.invoices[0].status).toBe("cancelled");
    state.invoices[0].status = "posted";
    const posted = snapshot(state);
    expect(() =>
      discardInvoice(state, actor, {
        invoice_id: saved.id,
        expected_version: 2,
        reason: "Cannot",
      }),
    ).toThrow();
    expect(snapshot(state)).toBe(posted);
    state.invoices[0].status = "draft";
    state.invoices[0].company_id = "fictional-foreign-company";
    const foreign = snapshot(state);
    expect(() =>
      discardInvoice(state, actor, {
        invoice_id: saved.id,
        expected_version: 2,
        reason: "Cannot",
      }),
    ).toThrow();
    expect(snapshot(state)).toBe(foreign);
  });
  it.each(["payment_terms", "supplier_tax_number"] as const)(
    "does not treat entered %s as an empty draft",
    (field) => {
      const { state, actor } = draft();
      state.invoice[field] = "Fictional entered value";
      expect(invoiceDiscardRead(state, actor, state.invoice.id).empty).toBe(
        false,
      );
      const before = snapshot(state);
      expect(() =>
        discardInvoice(state, actor, {
          invoice_id: state.invoice.id,
          expected_version: 1,
          reason: "",
        }),
      ).toThrow("reason");
      expect(snapshot(state)).toBe(before);
    },
  );
  it.each(["unsaved", "saved", "stale_saved"] as const)(
    "restores exact active A after opening B, keeping B unchanged (%s A)",
    (kind) => {
      const { state, actor } = processing();
      const originalA = structuredClone(state.invoice);
      if (kind === "unsaved") state.invoices = [];
      if (kind === "stale_saved")
        state.invoices![0].supplier = "Fictional stale saved caption";
      const other = createInvoice(state, actor, "Branch 1", false, {
        empty: true,
      });
      other.id = "fictional-other-workspace";
      state.invoices!.push(other);
      const before = cloneWithAuthority(state);
      discardInvoice(state, actor, {
        invoice_id: originalA.id,
        expected_version: 1,
        reason: "Fictional duplicate",
      });
      const [entry] = attachReversals(before, state, actor);
      expect(entry.reversible).toBe(true);
      expect(entry.reversal).toHaveLength(1);
      selectInvoiceWorkspace(state, actor, other.id);
      const workspaceB = structuredClone(state.invoice);
      reverseActivity(state, actor, entry.id, "undo");
      expect(state.invoice).toEqual(workspaceB);
      const restored = state.invoices!.find(
        (invoice) => invoice.id === originalA.id,
      )!;
      expect(restored.status).toBe("reading");
      expect(restored.supplier).toBe(originalA.supplier);
      expect(restored.original_pages).toEqual(originalA.original_pages);
      expect(restored.live_reading?.phase).toBe("cancelled");
      expect(restored.live_reading?.attempt_id).not.toBe(
        originalA.live_reading?.attempt_id,
      );
      expect(restored.version).toBe(3);
      expect(state.activity.at(-1)?.after).toEqual(restored);
    },
  );
  it("preserves a Floor Worker's genuine Enter-by-hand capability after discard and Undo", () => {
    const { state, actor } = processing();
    settleLiveInvoiceReading(state, actor, {
      invoice_id: state.invoice.id,
      attempt_id: "fictional-inflight",
      outcome: "manual",
    });
    expect(
      canInvoiceAuthority(
        state,
        actor,
        "invoices.enter_manual",
        state.invoice.id,
        true,
      ),
    ).toBe(false);
    expect(canUseLiveManualInvoice(state, actor, state.invoice.id)).toBe(true);
    addManualLine(state, actor, "0002");
    const lines = structuredClone(state.invoice.lines);
    const original = structuredClone(state.invoice.original_pages);
    const manualAt = state.invoice.live_reading!.completed_at;
    const before = cloneWithAuthority(state);
    discardInvoice(state, actor, {
      invoice_id: state.invoice.id,
      expected_version: state.invoice.version ?? 1,
      reason: "Fictional wrong upload",
    });
    const [entry] = attachReversals(before, state, actor);
    reverseActivity(state, actor, entry.id, "undo");
    expect(state.invoice.status).toBe("review");
    expect(state.invoice.live_reading?.phase).toBe("manual");
    expect(state.invoice.live_reading?.completed_at).toBe(manualAt);
    expect(state.invoice.lines).toEqual(lines);
    expect(state.invoice.original_pages).toEqual(original);
    expect(canUseLiveManualInvoice(state, actor, state.invoice.id)).toBe(true);
    expect(() => addManualLine(state, actor, "0001")).not.toThrow();
    expect(state.invoice.lines.length).toBe(lines.length + 1);
  });
  it("projects cancellation metadata through an explicit nested allowlist", () => {
    const { state, actor } = draft("floor_worker");
    discardInvoice(state, actor, {
      invoice_id: state.invoice.id,
      expected_version: 1,
      reason: "Fictional duplicate",
    });
    Object.assign(state.invoice.cancellation!, {
      private_cost: "fictional-private",
      arbitrary_payload: { unit_cost_before_tax: "99.99" },
    });
    expect(
      Object.keys(
        invoiceView(state, actor, state.invoice.id).cancellation!,
      ).sort(),
    ).toEqual(["at", "by", "by_user_id", "reason"]);
  });
  it("does not let earlier field Undo mutate a Cancelled invoice", () => {
    const { state, actor } = draft();
    const initial = cloneWithAuthority(state);
    state.invoice.supplier_invoice_number = "FICTIONAL-1";
    state.activity.push({
      id: "fictional-earlier-edit",
      company_id: actor.company_id,
      branch: "Branch 1",
      action: "Edit draft",
      by: actor.actor,
      actor_user_id: actor.user_id,
      at: new Date().toISOString(),
      reversible: true,
      entity_type: "invoice",
      entity_id: state.invoice.id,
    });
    const [edit] = attachReversals(initial, state, actor);
    discardInvoice(state, actor, {
      invoice_id: state.invoice.id,
      expected_version: 1,
      reason: "No longer needed",
    });
    const before = snapshot(state);
    expect(() => reverseActivity(state, actor, edit.id, "undo")).toThrow();
    expect(snapshot(state)).toBe(before);
  });
});
