import { File as NodeFile } from "node:buffer";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import sample from "../tests/fixtures/fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { authoritySnapshot, bindAuthoritySnapshot } from "./authority";
import type { RoleId } from "./authority-types";
import { addManualLine, createInvoice } from "./invoice";
import {
  storeInvoiceUpload,
  type ProtectedInvoiceQuery,
} from "./invoice-file-access";
import { invoiceView } from "./invoice-projections";
import { projectHistoryEntry } from "./history";
import {
  importInvoiceReadings,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
} from "./invoice-readings";
import {
  applyLiveInvoiceReading,
  attachLiveInvoiceOriginals,
  beginLiveInvoiceReading,
  canUseLiveManualInvoice,
  reorderLiveInvoiceOriginals,
  settleLiveInvoiceReading,
  useSimulatedLiveInvoiceReading,
} from "./invoice-live-reading";
import type { DemoState } from "./types";

const retained = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(
    async (file: Blob & { name?: string }, company: string) => {
      const bytes =
        typeof file.arrayBuffer === "function"
          ? await file.arrayBuffer()
          : await new Promise<ArrayBuffer>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as ArrayBuffer);
              reader.onerror = reject;
              reader.readAsArrayBuffer(file);
            });
      const sha = createHash("sha256")
        .update(new Uint8Array(bytes))
        .digest("hex");
      retained.set(sha, new Uint8Array(bytes));
      return {
        reference: `idb-file:v1:${company}:${sha}`,
        name: file.name ?? "page.jpg",
        type: file.type,
        size: file.size,
      };
    },
  ),
}));

function source(
  name = "fictional-source.pdf",
  bytes = "fictional untouched source",
  type = "application/pdf",
) {
  return new NodeFile([bytes], name, { type }) as unknown as File;
}
async function draft(role: RoleId = "manager", files = [source()]) {
  const state = initialState();
  state.invoices = [];
  state.activity = [];
  const actor = authenticatedTestActor(state, role);
  state.invoice = createInvoice(state, actor, "Branch 1", false, {
    empty: true,
  });
  const query: ProtectedInvoiceQuery = async (_capability, _scope, project) =>
    project(state, actor);
  const uploads = await Promise.all(
    files.map((file) =>
      storeInvoiceUpload(query, file, {
        company_id: actor.company_id,
        invoice_id: state.invoice.id,
      }),
    ),
  );
  const attached = attachLiveInvoiceOriginals(state, actor, {
    invoice_id: state.invoice.id,
    uploads,
  });
  return { state, actor, attached, files, query };
}
async function processing(role: RoleId = "manager", files?: File[]) {
  const data = await draft(role, files);
  const attempt = beginLiveInvoiceReading(
    data.state,
    data.actor,
    data.state.invoice.id,
  );
  return { ...data, attempt };
}
function envelope(
  attempt: { original_sha256s: string[] },
  count = attempt.original_sha256s.length,
) {
  const exported = parseInvoiceReadings(JSON.stringify(sample));
  exported.invoices = [exported.invoices[0]];
  const entry = exported.invoices[0];
  const image = entry.pages[0];
  entry.pages = Array.from({ length: count }, (_, index) => ({
    ...image,
    page: index + 1,
  }));
  entry.original_sha256 = entry.pages.map((_, index) =>
    attempt.original_sha256s.length === 1
      ? attempt.original_sha256s[0]
      : attempt.original_sha256s[index],
  );
  return exported;
}
const provenance = {
  seconds: 84,
  costUSD: "0.1100",
  models: ["Fictional Reader A", "Fictional Reader B"],
};
function accept(data: Awaited<ReturnType<typeof processing>>, count?: number) {
  return applyLiveInvoiceReading(data.state, data.actor, {
    ...data.attempt,
    exported: envelope(data.attempt, count),
    provenance,
  });
}
const snapshot = (state: DemoState) => JSON.stringify(state);

describe("R3 protected live reading domain", () => {
  it("saves every exact source first and starts a blank recoverable Processing draft", async () => {
    const data = await draft();
    const invoice = data.state.invoice;
    expect(invoice.status).toBe("reading");
    expect(invoice.live_reading?.phase).toBe("ready");
    expect(invoice.live_reading?.attempt_id).toBeTruthy();
    expect(invoice.lines).toEqual([]);
    expect(invoice.short_lines).toEqual([]);
    expect(invoice.supplier).toBe("");
    expect(invoice.supplier_invoice_number).toBe("");
    const sha = data.attached.original_sha256s[0];
    expect(retained.get(sha)).toEqual(
      new Uint8Array(await data.files[0].arrayBuffer()),
    );
    expect(invoice.original_pages?.[0].original_sha256).toBe(sha);
    expect(data.state.invoices?.find((item) => item.id === invoice.id)).toEqual(
      invoice,
    );
  });

  it("the empty upload factory contains no fictional shortage evidence", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    const ordinary = createInvoice(state, actor, "Branch 1");
    const empty = createInvoice(state, actor, "Branch 1", false, {
      empty: true,
    });
    expect(empty.lines).toEqual([]);
    expect(empty.short_lines).toEqual([]);
    expect(ordinary.short_lines).toEqual(state.invoice.short_lines);
  });

  it.each(["owner", "manager", "floor_worker"] as const)(
    "%s applies the existing importer to the same pre-saved PDF draft without a self-duplicate",
    async (role) => {
      const data = await processing(role);
      const before = structuredClone(data.state.invoice);
      const result = accept(data, 2);
      const invoice = data.state.invoice;
      expect(result.imported).toEqual([before.id]);
      expect(result.skipped).toEqual([]);
      expect(invoice.id).toBe(before.id);
      expect(invoice.status).toBe("review");
      expect(invoice.live_reading?.phase).toBe("complete");
      expect(invoice.original_pages).toEqual(before.original_pages);
      for (const field of [
        "file_data",
        "file_name",
        "file_type",
        "file_size",
        "created_by_user_id",
        "handler_user_ids",
        "reviewer_user_ids",
        "reviewer_origin_location_id",
        "received_at",
        "receiving_employee",
      ] as const)
        expect(invoice[field], field).toEqual(before[field]);
      expect(invoice.lines[0].unit_cost_before_tax).toBe("0.9800");
      expect(invoice.lines[0].qty_invoiced).toBe(24);
      expect(invoice.low_confidence_fields).toContain(
        "supplier_invoice_number",
      );
      expect(invoice.reading_record).toMatchObject({
        source: "live",
        seconds: 84,
        reading_cost_usd: "0.1100",
        models: provenance.models,
      });
      expect(invoice.reading_record?.page_sha256s).toEqual([
        data.attached.original_sha256s[0],
        data.attached.original_sha256s[0],
      ]);
      expect(
        data.state.invoices?.filter((item) => item.id === before.id),
      ).toHaveLength(1);
    },
  );

  it("reuses the JSON mapper's exact amounts, packs, date fields and confidence checks", async () => {
    const data = await processing();
    const exported = envelope(data.attempt);
    const state = initialState();
    state.invoice.status = "empty";
    state.invoice.supplier = "";
    state.invoice.supplier_invoice_number = "";
    delete state.invoice.file_data;
    delete state.invoice.original_pages;
    delete state.invoice.reading_record;
    state.invoices = [];
    const actor = authenticatedTestActor(state, "manager");
    const pages = await prepareInvoiceReadingPages(
      exported,
      [exported.invoices[0].id],
      actor.company_id,
    );
    const old = importInvoiceReadings(state, actor, {
      exported,
      fileName: "fictional.json",
      mode: "ai",
      locations: { [exported.invoices[0].id]: "Branch 1" },
      selectedIds: [exported.invoices[0].id],
      pages,
    });
    expect(old.imported).toHaveLength(1);
    const expected = state.invoices!.find(
      (record) => record.id === old.imported[0],
    )!;
    accept(data);
    const fields = [
      "product_code",
      "description",
      "qty_invoiced",
      "qty_received_at_posting",
      "quantity_unit",
      "quantity_entered",
      "units_per_case",
      "unit_cost_before_tax",
      "case_cost_before_tax",
      "line_total",
      "taxable",
      "low_confidence_fields",
      "date_tracking",
      "date_confirmed",
      "expiry_as_printed",
    ] as const;
    const values = (invoice: typeof expected) =>
      invoice.lines.map((line) =>
        Object.fromEntries(fields.map((field) => [field, line[field]])),
      );
    expect(values(data.state.invoice)).toEqual(values(expected));
    expect(data.state.invoice.subtotal).toBe(expected.subtotal);
    expect(data.state.invoice.tax).toBe(expected.tax);
    expect(data.state.invoice.final_total).toBe(expected.final_total);
  });

  it("reorders only a complete saved-photo permutation and follows it in wire hash mapping", async () => {
    const data = await draft("manager", [
      source("red.jpg", "fictional red original", "image/jpeg"),
      source("blue.jpg", "fictional blue original", "image/jpeg"),
    ]);
    const before = structuredClone(data.state.invoice.original_pages!);
    for (const order of [[0, 0], [0], [0, 2], [-1, 0]]) {
      const unchanged = snapshot(data.state);
      expect(() =>
        reorderLiveInvoiceOriginals(data.state, data.actor, {
          invoice_id: data.state.invoice.id,
          order,
        }),
      ).toThrow();
      expect(snapshot(data.state)).toBe(unchanged);
    }
    reorderLiveInvoiceOriginals(data.state, data.actor, {
      invoice_id: data.state.invoice.id,
      order: [1, 0],
    });
    expect(data.state.invoice.original_pages).toEqual([before[1], before[0]]);
    expect(data.state.invoice.file_data).toBe(before[1].file_data);
    const attempt = beginLiveInvoiceReading(
      data.state,
      data.actor,
      data.state.invoice.id,
    );
    expect(attempt.original_sha256s).toEqual([
      before[1].original_sha256,
      before[0].original_sha256,
    ]);
    const unchanged = snapshot(data.state);
    expect(() =>
      reorderLiveInvoiceOriginals(data.state, data.actor, {
        invoice_id: attempt.invoice_id,
        order: [0, 1],
      }),
    ).toThrow();
    expect(snapshot(data.state)).toBe(unchanged);
    applyLiveInvoiceReading(data.state, data.actor, {
      ...attempt,
      exported: envelope(attempt),
      provenance,
    });
    expect(data.state.invoice.original_pages).toEqual([before[1], before[0]]);
    expect(data.state.invoice.reading_record?.page_sha256s).toEqual(
      attempt.original_sha256s,
    );
  });

  it.each(["failed", "cancelled"] as const)(
    "%s retains the source, permits an explicit new attempt and rejects the old response/repeated settlement",
    async (outcome) => {
      const data = await processing();
      const original = structuredClone(data.state.invoice.original_pages);
      settleLiveInvoiceReading(data.state, data.actor, {
        ...data.attempt,
        outcome,
      });
      expect(data.state.invoice.original_pages).toEqual(original);
      const unchanged = snapshot(data.state);
      expect(() =>
        settleLiveInvoiceReading(data.state, data.actor, {
          ...data.attempt,
          outcome,
        }),
      ).toThrow();
      expect(snapshot(data.state)).toBe(unchanged);
      const next = beginLiveInvoiceReading(
        data.state,
        data.actor,
        data.attempt.invoice_id,
      );
      expect(next.attempt_id).not.toBe(data.attempt.attempt_id);
      expect(() => accept(data)).toThrow();
      expect(data.state.invoice.original_pages).toEqual(original);
      applyLiveInvoiceReading(data.state, data.actor, {
        ...next,
        exported: envelope(next),
        provenance,
      });
      expect(data.state.invoice.status).toBe("review");
    },
  );

  it("a reload-style explicit Read again invalidates an unfinished processing attempt", async () => {
    const data = await processing();
    const next = beginLiveInvoiceReading(
      data.state,
      data.actor,
      data.attempt.invoice_id,
    );
    expect(next.attempt_id).not.toBe(data.attempt.attempt_id);
    const unchanged = snapshot(data.state);
    expect(() => accept(data)).toThrow();
    expect(snapshot(data.state)).toBe(unchanged);
  });

  it("settles a saved target without selecting or overwriting another active workspace", async () => {
    const data = await processing();
    data.state.invoice = createInvoice(
      data.state,
      data.actor,
      "Branch 1",
      false,
      { empty: true },
    );
    const active = structuredClone(data.state.invoice);
    settleLiveInvoiceReading(data.state, data.actor, {
      ...data.attempt,
      outcome: "cancelled",
    });
    expect(data.state.invoice).toEqual(active);
    expect(
      data.state.invoices?.find(
        (record) => record.id === data.attempt.invoice_id,
      )?.live_reading?.phase,
    ).toBe("cancelled");
  });

  it("keeps a different supplier/invoice-number duplicate blocked and the current original saved", async () => {
    const data = await processing();
    accept(data);
    data.state.invoice = createInvoice(
      data.state,
      data.actor,
      "Branch 1",
      false,
      { empty: true },
    );
    const file = source(
      "fictional-second.pdf",
      "different fictional untouched source",
    );
    const uploads = [
      await storeInvoiceUpload(data.query, file, {
        company_id: data.actor.company_id,
        invoice_id: data.state.invoice.id,
      }),
    ];
    attachLiveInvoiceOriginals(data.state, data.actor, {
      invoice_id: data.state.invoice.id,
      uploads,
    });
    const attempt = beginLiveInvoiceReading(
      data.state,
      data.actor,
      data.state.invoice.id,
    );
    const before = structuredClone(data.state.invoice);
    const money = JSON.stringify([
      data.state.ledger,
      data.state.products,
      data.state.approvals,
    ]);
    const result = applyLiveInvoiceReading(data.state, data.actor, {
      ...attempt,
      exported: envelope(attempt),
      provenance,
    });
    expect(result.imported).toEqual([]);
    expect(result.skipped[0].reason).toBe("invoice_number");
    expect(data.state.invoice).toEqual(before);
    expect(
      JSON.stringify([
        data.state.ledger,
        data.state.products,
        data.state.approvals,
      ]),
    ).toBe(money);
  });

  it.each([
    "attempt",
    "branch",
    "version",
    "content",
    "original",
    "session",
    "posted",
  ] as const)(
    "rejects stale %s completions without business writes",
    async (change) => {
      const data = await processing();
      if (change === "attempt") data.attempt.attempt_id += "-stale";
      if (change === "branch") data.state.invoice.branch = "Branch 2";
      if (change === "version")
        data.state.invoice.version = (data.state.invoice.version ?? 1) + 1;
      if (change === "content")
        data.state.invoice.supplier_invoice_number = "HUMAN-EDIT";
      if (change === "original")
        data.state.invoice.original_pages![0].original_sha256 = "f".repeat(64);
      if (change === "session")
        data.actor = authenticatedTestActor(data.state, "manager");
      if (change === "posted") data.state.invoice.status = "posted";
      const before = snapshot(data.state);
      expect(() => accept(data)).toThrow();
      expect(snapshot(data.state)).toBe(before);
    },
  );

  it("rejects wrong source hashes and unusable readings before altering the saved draft", async () => {
    const data = await processing();
    const before = snapshot(data.state);
    for (const kind of ["hash", "lines"] as const) {
      const exported = envelope(data.attempt);
      if (kind === "hash")
        exported.invoices[0].original_sha256[0] = "f".repeat(64);
      else exported.invoices[0].ai_reading!.lines = [];
      expect(() =>
        applyLiveInvoiceReading(data.state, data.actor, {
          ...data.attempt,
          exported,
          provenance,
        }),
      ).toThrow();
      expect(snapshot(data.state)).toBe(before);
    }
  });

  it("manual fallback gives only the verified uploader a retained-original edit path", async () => {
    const data = await processing("floor_worker");
    settleLiveInvoiceReading(data.state, data.actor, {
      ...data.attempt,
      outcome: "failed",
    });
    settleLiveInvoiceReading(data.state, data.actor, {
      ...data.attempt,
      outcome: "manual",
    });
    expect(data.state.invoice.entry_mode).toBe("manual");
    expect(data.state.invoice.status).toBe("review");
    expect(
      canUseLiveManualInvoice(data.state, data.actor, data.attempt.invoice_id),
    ).toBe(true);
    expect(() => addManualLine(data.state, data.actor, "0002")).not.toThrow();
    expect(data.state.invoice.lines).toHaveLength(1);
    expect(data.state.invoice.original_pages).toHaveLength(1);
    expect(() =>
      createInvoice(data.state, data.actor, "Branch 1", true),
    ).toThrow();
    const before = snapshot(data.state);
    const other = authenticatedTestActor(data.state, "floor_worker", {
      user_id: "fictional-other-worker",
      username: "fictional-other-worker",
    });
    expect(
      canUseLiveManualInvoice(data.state, other, data.attempt.invoice_id),
    ).toBe(false);
    expect(() => addManualLine(data.state, other, "0002")).toThrow();
    expect(snapshot(data.state)).toBe(before);
  });

  it("a forged manual marker or missing original never grants direct manual-entry authority", async () => {
    const data = await processing("floor_worker");
    data.state.invoice.entry_mode = "manual";
    data.state.invoice.status = "review";
    data.state.invoice.live_reading = { phase: "manual", attempt_id: "forged" };
    expect(() => addManualLine(data.state, data.actor, "0002")).toThrow();
    delete data.state.invoice.live_reading;
    expect(() => addManualLine(data.state, data.actor, "0002")).toThrow();
  });

  it("the explicit demo fallback invalidates live provenance while keeping exact originals and identity", async () => {
    const data = await processing();
    const before = structuredClone(data.state.invoice);
    settleLiveInvoiceReading(data.state, data.actor, {
      ...data.attempt,
      outcome: "failed",
    });
    useSimulatedLiveInvoiceReading(data.state, data.actor, before.id);
    expect(data.state.invoice.id).toBe(before.id);
    expect(data.state.invoice.original_pages).toEqual(before.original_pages);
    expect(data.state.invoice.file_data).toBe(before.file_data);
    expect(data.state.invoice.live_reading).toBeUndefined();
    expect(data.state.invoice.reading_record).toBeUndefined();
    expect(data.state.invoice.status).toBe("reading");
    expect(data.state.invoice.simulated_reading).toBe(true);
    expect(
      invoiceView(data.state, data.actor, before.id).simulated_reading,
    ).toBe(true);
    const retainedState = structuredClone(data.state.invoice);
    data.state.invoice = structuredClone(retainedState);
    expect(
      invoiceView(data.state, data.actor, before.id).simulated_reading,
    ).toBe(true);
    expect(data.state.invoice.lines.length).toBeGreaterThan(0);
    expect(() => accept(data)).toThrow();
  });

  it.each(["owner", "manager", "floor_worker"] as const)(
    "%s gets only the permitted live provenance in actual invoice and History projections",
    async (role) => {
      const data = await processing(role);
      accept(data);
      const view = invoiceView(data.state, data.actor, data.attempt.invoice_id);
      const json = JSON.stringify(view);
      expect(view.live_reading?.phase).toBe("complete");
      expect(view.live_reading).not.toHaveProperty("authority");
      if (role === "floor_worker") {
        expect(view.reading_record).toBeUndefined();
        expect(json).not.toContain("Fictional Reader A");
        expect(json).not.toContain("0.1100");
        const history = data.state.activity.find(
          (entry) => entry.entity_id === data.attempt.invoice_id,
        )!;
        history.after = { invoice: structuredClone(data.state.invoice) };
        const visible = JSON.stringify(
          projectHistoryEntry(data.state, data.actor, history),
        );
        expect(visible).not.toContain("Fictional Reader A");
        expect(visible).not.toContain("0.1100");
        expect(visible).not.toContain(data.actor.session_id);
      } else
        expect(view.reading_record).toMatchObject(
          provenance.models.length
            ? {
                models: provenance.models,
                seconds: 84,
                reading_cost_usd: "0.1100",
              }
            : {},
        );
    },
  );

  it.each(["manager", "floor_worker"] as const)(
    "%s History respects whole-record and leaf-path live provenance privacy",
    async (role) => {
      const data = await processing(role);
      accept(data);
      const entry = data.state.activity.find(
        (record) => record.entity_id === data.attempt.invoice_id,
      )!;
      const record = structuredClone(data.state.invoice.reading_record);
      entry.reversal = [
        {
          path: ["invoice", "reading_record"],
          before_exists: false,
          after_exists: true,
          after: record,
        },
        {
          path: [
            "invoices",
            { key: "id", value: data.attempt.invoice_id },
            "reading_record",
          ],
          before_exists: true,
          after_exists: true,
          before: record,
          after: record,
        },
        {
          path: ["invoice", "reading_record", "models"],
          before_exists: false,
          after_exists: true,
          after: provenance.models,
        },
      ];
      const before = snapshot(data.state);
      const visible = JSON.stringify(
        projectHistoryEntry(data.state, data.actor, entry),
      );
      if (role === "manager") {
        expect(visible).toContain("Fictional Reader A");
        expect(visible).toContain("0.1100");
      } else {
        expect(visible).not.toContain("Fictional Reader A");
        expect(visible).not.toContain("0.1100");
      }
      expect(snapshot(data.state)).toBe(before);
    },
  );

  it.each(["original", "branch", "posted", "origin", "company"] as const)(
    "manual fallback rejects a changed %s without writes",
    async (change) => {
      const data = await processing("floor_worker");
      settleLiveInvoiceReading(data.state, data.actor, {
        ...data.attempt,
        outcome: "manual",
      });
      if (change === "original") {
        delete data.state.invoice.file_data;
        delete data.state.invoice.original_pages;
      }
      if (change === "branch") data.state.invoice.branch = "Branch 2";
      if (change === "company")
        data.state.invoice.company_id = "fictional-other-company";
      if (change === "posted") data.state.invoice.status = "posted";
      if (change === "origin")
        delete data.state.invoice.live_reading!.authority;
      const before = snapshot(data.state);
      expect(
        canUseLiveManualInvoice(
          data.state,
          data.actor,
          data.attempt.invoice_id,
        ),
      ).toBe(false);
      expect(() => addManualLine(data.state, data.actor, "0002")).toThrow();
      expect(snapshot(data.state)).toBe(before);
    },
  );

  it("a rejected upload batch leaves its valid opaque handle reusable", async () => {
    const data = await draft();
    const id = data.state.invoice.id;
    const valid = await storeInvoiceUpload(
      data.query,
      source("extra.jpg", "extra fictional bytes", "image/jpeg"),
      { company_id: data.actor.company_id, invoice_id: id },
    );
    const before = snapshot(data.state);
    expect(() =>
      attachLiveInvoiceOriginals(data.state, data.actor, {
        invoice_id: id,
        uploads: [valid, { name: "forged.jpg", type: "image/jpeg", size: 1 }],
      }),
    ).toThrow();
    expect(snapshot(data.state)).toBe(before);
    expect(() =>
      attachLiveInvoiceOriginals(data.state, data.actor, {
        invoice_id: id,
        uploads: [valid],
      }),
    ).not.toThrow();
  });

  it("Cashier authority cannot read live invoice provenance or start a reading", async () => {
    const data = await processing();
    accept(data);
    const cashier = authenticatedTestActor(data.state, "cashier");
    const before = snapshot(data.state);
    expect(() =>
      invoiceView(data.state, cashier, data.attempt.invoice_id),
    ).toThrow();
    expect(() =>
      beginLiveInvoiceReading(data.state, cashier, data.attempt.invoice_id),
    ).toThrow();
    expect(snapshot(data.state)).toBe(before);
  });

  it.each(["same-manager", "other-manager", "same-worker"] as const)(
    "a fresh %s can continue the existing manual fallback under current authority",
    async (kind) => {
      const data = await processing(
        kind === "same-worker" ? "floor_worker" : "manager",
      );
      settleLiveInvoiceReading(data.state, data.actor, {
        ...data.attempt,
        outcome: "manual",
      });
      const stale = data.actor;
      const current = authenticatedTestActor(
        data.state,
        kind === "same-worker" ? "floor_worker" : "manager",
        kind === "other-manager"
          ? {
              user_id: "fictional-other-manager",
              username: "fictional-other-manager",
            }
          : {},
      );
      const original = structuredClone(data.state.invoice.original_pages);
      const before = snapshot(data.state);
      if (kind !== "other-manager") {
        const directory = structuredClone(authoritySnapshot(data.state));
        directory.sessions.find(
          (session) => session.id === stale.session_id,
        )!.state = "revoked";
        bindAuthoritySnapshot(data.state, directory);
        expect(() => addManualLine(data.state, stale, "0002")).toThrow();
        expect(snapshot(data.state)).toBe(before);
      }
      expect(() => addManualLine(data.state, current, "0002")).not.toThrow();
      expect(data.state.invoice.lines).toHaveLength(1);
      expect(data.state.invoice.original_pages).toEqual(original);
      if (kind === "same-worker")
        expect(
          canUseLiveManualInvoice(data.state, current, data.attempt.invoice_id),
        ).toBe(true);
    },
  );

  it.each(["same-worker", "other-manager"] as const)(
    "a fresh %s can explicitly choose manual entry for its recoverable original",
    async (kind) => {
      const data = await processing(
        kind === "same-worker" ? "floor_worker" : "manager",
      );
      const actor = authenticatedTestActor(
        data.state,
        kind === "same-worker" ? "floor_worker" : "manager",
        kind === "other-manager"
          ? {
              user_id: "fictional-adopting-manager",
              username: "fictional-adopting-manager",
            }
          : {},
      );
      const originals = structuredClone(data.state.invoice.original_pages);
      settleLiveInvoiceReading(data.state, actor, {
        ...data.attempt,
        outcome: "manual",
      });
      expect(() => addManualLine(data.state, actor, "0002")).not.toThrow();
      expect(data.state.invoice.original_pages).toEqual(originals);
      expect(() =>
        applyLiveInvoiceReading(data.state, actor, {
          ...data.attempt,
          exported: envelope(data.attempt),
          provenance,
        }),
      ).toThrow();
    },
  );

  it.each([
    { line_type: "item", line_no: 1, confidence: 0.9 },
    { line_type: "item", pack_size: "12 x fictional packs" },
    { line_type: "note", description: "Fictional note only" },
    { line_type: "fee", description: "Fictional charge", line_total: "1.00" },
  ])(
    "does not turn incomplete or non-item content into phantom items: %j",
    async (line) => {
      const data = await processing();
      const exported = envelope(data.attempt);
      exported.invoices[0].ai_reading!.lines = [line];
      const before = snapshot(data.state);
      expect(() =>
        applyLiveInvoiceReading(data.state, data.actor, {
          ...data.attempt,
          exported,
          provenance,
        }),
      ).toThrow();
      expect(snapshot(data.state)).toBe(before);
    },
  );

  it("a genuinely recognized partial item remains reviewable with unreadable money", async () => {
    const data = await processing();
    const exported = envelope(data.attempt);
    exported.invoices[0].ai_reading!.lines = [
      {
        line_type: "item",
        barcode: "FICTIONAL-PARTIAL-ITEM",
        quantity: null,
        unit_cost_before_tax: null,
        line_total: null,
      },
    ];
    exported.invoices[0].ai_statuses = {
      "lines[0].quantity": "check",
      "lines[0].unit_cost_before_tax": "check",
    };
    const result = applyLiveInvoiceReading(data.state, data.actor, {
      ...data.attempt,
      exported,
      provenance,
    });
    expect(result.imported).toEqual([data.attempt.invoice_id]);
    expect(data.state.invoice.status).toBe("review");
    expect(data.state.invoice.lines[0].low_confidence_fields).toContain(
      "quantity_entered",
    );
  });

  it("a three-photo tail reorder changes the public version and refreshes the guarded order", async () => {
    const data = await draft("manager", [
      source("a.jpg", "fictional A", "image/jpeg"),
      source("b.jpg", "fictional B", "image/jpeg"),
      source("c.jpg", "fictional C", "image/jpeg"),
    ]);
    const before = structuredClone(data.state.invoice);
    reorderLiveInvoiceOriginals(data.state, data.actor, {
      invoice_id: before.id,
      order: [0, 2, 1],
    });
    expect(data.state.invoice.file_name).toBe(before.file_name);
    expect(data.state.invoice.file_type).toBe(before.file_type);
    expect(data.state.invoice.file_size).toBe(before.file_size);
    expect(data.state.invoice.original_pages).toHaveLength(3);
    expect(data.state.invoice.version).toBe((before.version ?? 1) + 1);
    expect(invoiceView(data.state, data.actor, before.id).version).toBe(
      data.state.invoice.version,
    );
    const attempt = beginLiveInvoiceReading(data.state, data.actor, before.id);
    expect(attempt.original_sha256s).toEqual([
      before.original_pages![0].original_sha256,
      before.original_pages![2].original_sha256,
      before.original_pages![1].original_sha256,
    ]);
    applyLiveInvoiceReading(data.state, data.actor, {
      ...attempt,
      exported: envelope(attempt),
      provenance,
    });
    expect(data.state.invoice.status).toBe("review");
    expect(data.state.invoice.reading_record?.page_sha256s).toEqual(
      attempt.original_sha256s,
    );
  });

  it.each(["same-worker", "other-manager"] as const)(
    "a fresh %s can explicitly recover with simulated reading",
    async (kind) => {
      const data = await processing(
        kind === "same-worker" ? "floor_worker" : "manager",
      );
      settleLiveInvoiceReading(data.state, data.actor, {
        ...data.attempt,
        outcome: "failed",
      });
      const actor = authenticatedTestActor(
        data.state,
        kind === "same-worker" ? "floor_worker" : "manager",
        kind === "other-manager"
          ? {
              user_id: "fictional-sim-manager",
              username: "fictional-sim-manager",
            }
          : {},
      );
      const original = structuredClone(data.state.invoice.original_pages);
      expect(() =>
        useSimulatedLiveInvoiceReading(
          data.state,
          actor,
          data.attempt.invoice_id,
        ),
      ).not.toThrow();
      expect(data.state.invoice.original_pages).toEqual(original);
      expect(data.state.invoice.simulated_reading).toBe(true);
      expect(data.state.invoice.live_reading).toBeUndefined();
    },
  );

  it.each([
    ["same-worker", "ready"],
    ["same-worker", "failed"],
    ["same-worker", "cancelled"],
    ["other-manager", "ready"],
    ["other-manager", "failed"],
    ["other-manager", "cancelled"],
  ] as const)(
    "a fresh %s can reorder the recoverable %s originals",
    async (kind, phase) => {
      const data = await draft(
        kind === "same-worker" ? "floor_worker" : "manager",
        [
          source("a.jpg", "fictional A", "image/jpeg"),
          source("b.jpg", "fictional B", "image/jpeg"),
          source("c.jpg", "fictional C", "image/jpeg"),
        ],
      );
      if (phase !== "ready") {
        const attempt = beginLiveInvoiceReading(
          data.state,
          data.actor,
          data.state.invoice.id,
        );
        settleLiveInvoiceReading(data.state, data.actor, {
          ...attempt,
          outcome: phase,
        });
      }
      const actor = authenticatedTestActor(
        data.state,
        kind === "same-worker" ? "floor_worker" : "manager",
        kind === "other-manager"
          ? {
              user_id: "fictional-order-manager",
              username: "fictional-order-manager",
            }
          : {},
      );
      const before = structuredClone(data.state.invoice);
      expect(() =>
        reorderLiveInvoiceOriginals(data.state, actor, {
          invoice_id: before.id,
          order: [0, 2, 1],
        }),
      ).not.toThrow();
      expect(data.state.invoice.original_pages).toEqual([
        before.original_pages![0],
        before.original_pages![2],
        before.original_pages![1],
      ]);
      expect(data.state.invoice.version).toBe((before.version ?? 1) + 1);
      const next = beginLiveInvoiceReading(data.state, actor, before.id);
      applyLiveInvoiceReading(data.state, actor, {
        ...next,
        exported: envelope(next),
        provenance,
      });
      expect(data.state.invoice.status).toBe("review");
    },
  );

  it("automatic failed or cancelled settlement remains bound to the original request session", async () => {
    const data = await processing("floor_worker");
    const actor = authenticatedTestActor(data.state, "floor_worker");
    const before = snapshot(data.state);
    for (const outcome of ["failed", "cancelled"] as const)
      expect(() =>
        settleLiveInvoiceReading(data.state, actor, {
          ...data.attempt,
          outcome,
        }),
      ).toThrow();
    expect(() =>
      applyLiveInvoiceReading(data.state, actor, {
        ...data.attempt,
        exported: envelope(data.attempt),
        provenance,
      }),
    ).toThrow();
    expect(snapshot(data.state)).toBe(before);
  });

  it("a foreign-company record with the same invoice ID is never replaced by live adoption", async () => {
    const data = await processing();
    const foreign = {
      ...structuredClone(data.state.invoice),
      company_id: "fictional-other-company",
    };
    data.state.invoices!.unshift(foreign);
    const before = structuredClone(foreign);
    accept(data);
    expect(
      data.state.invoices?.find(
        (record) => record.company_id === "fictional-other-company",
      ),
    ).toEqual(before);
    expect(
      data.state.invoices?.filter(
        (record) =>
          record.id === data.attempt.invoice_id &&
          record.company_id === data.actor.company_id,
      ),
    ).toHaveLength(1);
  });
});
