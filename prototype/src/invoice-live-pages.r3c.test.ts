import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { authoritySnapshot, bindAuthoritySnapshot } from "./authority";
import { initialState } from "./e1-bootstrap";
import { createInvoice, addManualLine } from "./invoice";
import {
  storeInvoiceUpload,
  loadInvoiceOriginal,
  type ProtectedInvoiceQuery,
} from "./invoice-file-access";
import {
  addLiveInvoicePages,
  removeLiveInvoicePage,
  selectLiveInvoicePdfPages,
  attachLiveInvoiceOriginals,
  beginLiveInvoiceReading,
  settleLiveInvoiceReading,
  applyLiveInvoiceReading,
  reorderLiveInvoiceOriginals,
  useSimulatedLiveInvoiceReading,
  type LiveSourceTarget,
} from "./invoice-live-reading";
import { liveOriginalPages } from "./invoice-live-reading-state";
import {
  inspectLivePdfPages,
  readLiveOriginalSelection,
  loadLiveOriginalSelection,
  verifyLivePdfPages,
} from "./invoice-live-pdf-pages";
import { invoiceView } from "./invoice-projections";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import { discardInvoice, isEmptyInvoiceDraft } from "./invoice-discard";
import { parseInvoiceReadings } from "./invoice-readings";
import { businessAuditRead } from "./business-audit-read";
import type { DemoState, DemoInvoice } from "./types";
import type { RoleId } from "./authority-types";

const storage = vi.hoisted(() => ({
  records: new Map<
    string,
    { bytes: Uint8Array; name: string; type: string; company: string }
  >(),
  gate: null as Promise<void> | null,
  started: vi.fn(),
}));
const pdf = vi.hoisted(() => ({
  getDocument: vi.fn(),
  gate: null as Promise<void> | null,
  workerSrc: "",
}));
vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(async (file: File, company: string) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    storage.started();
    await storage.gate;
    const reference = `idb-file:v1:${encodeURIComponent(company)}:${createHash("sha256").update(bytes).digest("hex")}`;
    storage.records.set(reference, {
      bytes,
      name: file.name,
      type: file.type,
      company,
    });
    return { reference, name: file.name, type: file.type, size: file.size };
  }),
  readStoredFile: vi.fn(async (reference: string, company: string) => {
    const saved = storage.records.get(reference);
    if (!saved || saved.company !== company)
      throw new Error("Fictional file scope mismatch");
    const source = new NodeFile([saved.bytes], saved.name, {
      type: saved.type,
    });
    return {
      reference,
      company_id: company,
      name: saved.name,
      type: saved.type,
      source_size: saved.bytes.length,
      sha256: reference.split(":").at(-1)!,
      source,
      preview: source,
      saved_at: "2026-10-30T00:00:00.000Z",
    };
  }),
}));
vi.mock("pdfjs-dist", () => ({
  getDocument: pdf.getDocument,
  GlobalWorkerOptions: pdf,
}));
const twoPdf = readFileSync("tests/fixtures/r3-fictional-two-page.pdf");
const elevenPdf = readFileSync("tests/fixtures/r3-fictional-eleven-page.pdf");
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
beforeEach(() => {
  storage.records.clear();
  storage.gate = null;
  storage.started.mockClear();
  pdf.gate = null;
  pdf.getDocument.mockReset();
  vi.stubGlobal("File", NodeFile);
  vi.stubGlobal("Blob", NodeBlob);
  pdf.getDocument.mockImplementation(({ data }: { data: Uint8Array }) => {
    const hash = digest(data);
    const count =
      hash === digest(twoPdf) ? 2 : hash === digest(elevenPdf) ? 11 : 0;
    return {
      promise: (async () => {
        await pdf.gate;
        if (!count) throw new Error("Fictional unreadable PDF");
        return { numPages: count };
      })(),
      destroy: vi.fn(async () => undefined),
    };
  });
});
afterEach(() => vi.unstubAllGlobals());
const file = (name: string, bytes = name, type = "image/png") =>
  new NodeFile([bytes], name, { type }) as unknown as File;
const target = (invoice: DemoInvoice): LiveSourceTarget => ({
  invoice_id: invoice.id,
  version: invoice.version ?? 1,
  attempt_id: invoice.live_reading?.attempt_id ?? "",
});
const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
};
async function fixture(
  role: RoleId = "manager",
  files = [file("fictional-first.png")],
  company?: string,
) {
  const state = initialState();
  if (company) state.config.company.seed_key = company;
  state.invoices = [];
  state.activity = [];
  let actor = authenticatedTestActor(state, role);
  state.invoice = createInvoice(state, actor, "Branch 1", false, {
    empty: true,
  });
  const returned: unknown[] = [];
  const query: ProtectedInvoiceQuery = async (_capability, _scope, project) => {
    const value = project(state, actor);
    returned.push(value);
    return value;
  };
  const upload = async (original: File, id = state.invoice.id) =>
    storeInvoiceUpload(query, original, {
      company_id: actor.company_id,
      invoice_id: id,
    });
  const uploads = await Promise.all(files.map((original) => upload(original)));
  attachLiveInvoiceOriginals(state, actor, {
    invoice_id: state.invoice.id,
    uploads,
  });
  state.activity = [];
  return {
    state,
    get actor() {
      return actor;
    },
    query,
    returned,
    upload,
    replaceActor(nextRole: RoleId = role) {
      actor = authenticatedTestActor(state, nextRole);
    },
  };
}
function finance(state: DemoState) {
  return structuredClone({
    products: state.products,
    approvals: state.approvals,
    stock: state.stock,
    movements: state.stock_movements,
    ledger: state.ledger,
  });
}
const provenance = {
  models: ["fictional-page-model"],
  seconds: 1,
  costUSD: "0.00",
};
function reading(
  invoice: DemoInvoice,
  count = liveOriginalPages(invoice).length,
) {
  const originals = liveOriginalPages(invoice),
    pdfSource = originals[0].file_type === "application/pdf";
  return parseInvoiceReadings(
    JSON.stringify({
      format: "super-arzon-invoice-readings",
      version: 1,
      reading_schema: "invoice-reading-v2",
      exported_at: "2026-10-30T00:00:00.000Z",
      invoices: [
        {
          id: invoice.id,
          file_name: "fictional-page-reading.png",
          pages: Array.from({ length: count }, (_, index) => ({
            page: index + 1,
            mime: "image/jpeg",
            data: "AQIDBA==",
          })),
          original_sha256: Array.from(
            { length: count },
            (_, index) => originals[pdfSource ? 0 : index].original_sha256,
          ),
          ai_reading: {
            supplier_name: "Fictional Prism Supply",
            supplier_invoice_number: `FICTIONAL-${invoice.id}`,
            invoice_date: "2026-10-30",
            payment_terms: "Net 14",
            currency: "CAD",
            subtotal: "1.00",
            tax: "0.00",
            final_total: "1.00",
            ship_to: "North York",
            lines: [
              {
                description: "Fictional Page Oats 300 g",
                quantity: "1",
                unit: "each",
                unit_cost_before_tax: "1.00",
                line_total: "1.00",
                taxable: false,
              },
            ],
          },
          ai_statuses: {},
          ai_source: "wholly fictional unit reading",
          ai_models: provenance.models,
          checked_answer: null,
          reading_cost_usd: "0.00",
        },
      ],
    }),
  );
}

describe("F8 retained active photo sources", () => {
  it("adds ordered originals, archives middle/all pages, restores after empty and keeps exact bytes with one audited edit per change", async () => {
    const data = await fixture("floor_worker");
    const money = finance(data.state),
      first = structuredClone(data.state.invoice.original_pages![0]);
    const before = target(data.state.invoice);
    const added = await Promise.all([
      data.upload(file("fictional-second.png")),
      data.upload(file("fictional-third.png")),
    ]);
    const accepted = addLiveInvoicePages(data.state, data.actor, {
      ...before,
      uploads: added,
    });
    expect(accepted).toEqual({
      invoice_id: before.invoice_id,
      retired_attempt_id: before.attempt_id,
      version: before.version + 1,
    });
    expect(data.state.invoice.live_reading?.phase).toBe("ready");
    expect(data.state.invoice.live_reading?.attempt_id).not.toBe(
      before.attempt_id,
    );
    expect(
      data.state.invoice.original_pages?.map((page) => page.file_name),
    ).toEqual([first.file_name, "fictional-second.png", "fictional-third.png"]);
    const all = structuredClone(data.state.invoice.original_pages!);
    removeLiveInvoicePage(data.state, data.actor, {
      ...target(data.state.invoice),
      index: 1,
    });
    expect(data.state.invoice.original_pages).toEqual([all[0], all[2]]);
    expect(data.state.invoice.retained_original_pages).toEqual([all[1]]);
    expect(
      invoiceView(data.state, data.actor, data.state.invoice.id)
        .original_page_count,
    ).toBe(3);
    expect(
      readLiveOriginalSelection(data.state, data.actor, before.invoice_id),
    ).toEqual({ count: 2, pdf: false, selected: null, editable: true });
    for (let index = 0; index < 3; index++) {
      const loaded = await loadInvoiceOriginal(data.query, {
        company_id: data.actor.company_id,
        invoice_id: before.invoice_id,
        page: index,
      });
      expect(digest(new Uint8Array(await loaded.source.arrayBuffer()))).toBe(
        loaded.sha256,
      );
    }
    while (liveOriginalPages(data.state.invoice).length)
      removeLiveInvoicePage(data.state, data.actor, {
        ...target(data.state.invoice),
        index: 0,
      });
    expect(liveOriginalPages(data.state.invoice)).toEqual([]);
    expect(data.state.invoice.original_pages).toEqual([]);
    expect(data.state.invoice.retained_original_pages).toHaveLength(3);
    expect(
      invoiceView(data.state, data.actor, data.state.invoice.id)
        .original_available,
    ).toBe(true);
    expect(isEmptyInvoiceDraft(data.state.invoice)).toBe(false);
    const empty = JSON.stringify(data.state);
    expect(() =>
      beginLiveInvoiceReading(data.state, data.actor, before.invoice_id),
    ).toThrow();
    expect(() =>
      useSimulatedLiveInvoiceReading(data.state, data.actor, before.invoice_id),
    ).toThrow();
    await expect(
      loadInvoiceOriginal(data.query, {
        company_id: data.actor.company_id,
        invoice_id: before.invoice_id,
        purpose: "reading",
      }),
    ).rejects.toThrow();
    expect(JSON.stringify(data.state)).toBe(empty);
    const restored = await data.upload(file("fictional-restored.png"));
    addLiveInvoicePages(data.state, data.actor, {
      ...target(data.state.invoice),
      uploads: [restored],
    });
    expect(
      liveOriginalPages(data.state.invoice).map((page) => page.file_name),
    ).toEqual(["fictional-restored.png"]);
    expect(data.state.invoice.retained_original_pages).toHaveLength(3);
    const attempt = beginLiveInvoiceReading(
      data.state,
      data.actor,
      before.invoice_id,
    );
    applyLiveInvoiceReading(data.state, data.actor, {
      ...attempt,
      exported: reading(data.state.invoice),
      provenance,
    });
    expect(data.state.invoice.status).toBe("review");
    expect(data.state.invoice.retained_original_pages).toHaveLength(3);
    expect(
      invoiceView(data.state, data.actor, data.state.invoice.id)
        .original_page_count,
    ).toBe(4);
    expect(
      readLiveOriginalSelection(data.state, data.actor, before.invoice_id)
        .editable,
    ).toBe(false);
    expect(
      data.state.activity.filter(
        (entry) => entry.action === "Invoice pages changed",
      ),
    ).toHaveLength(5);
    expect(
      data.state.activity
        .filter((entry) => entry.action === "Invoice pages changed")
        .every(
          (entry) =>
            entry.reversible === false &&
            entry.actor_user_id === data.actor.user_id,
        ),
    ).toBe(true);
    expect(
      JSON.stringify(
        data.state.activity.filter(
          (entry) => entry.action === "Invoice pages changed",
        ),
      ),
    ).not.toContain("idb-file:");
    expect(finance(data.state)).toEqual(money);
  });

  it("keeps encoded company ownership in original references instead of assuming a supermarket key", async () => {
    const data = await fixture(
      "manager",
      [file("fictional-scoped.png")],
      "fictional:pages/shop",
    );
    expect(liveOriginalPages(data.state.invoice)[0].file_data).toContain(
      "fictional%3Apages%2Fshop:",
    );
    const original = await loadInvoiceOriginal(data.query, {
      company_id: data.actor.company_id,
      invoice_id: data.state.invoice.id,
    });
    expect(original.company_id).toBe("fictional:pages/shop");
    removeLiveInvoicePage(data.state, data.actor, {
      ...target(data.state.invoice),
      index: 0,
    });
    expect(
      invoiceView(data.state, data.actor, data.state.invoice.id)
        .original_available,
    ).toBe(true);
  });

  it("publishes only captured saved A when storage finishes after actual workspace selection B", async () => {
    const data = await fixture();
    const a = target(data.state.invoice),
      wait = gate();
    storage.gate = wait.promise;
    storage.started.mockClear();
    const upload = data.upload(file("fictional-delayed.png"));
    await vi.waitFor(() => expect(storage.started).toHaveBeenCalledOnce());
    const b = createInvoice(data.state, data.actor, "Branch 1", true);
    data.state.invoices!.push(b);
    selectInvoiceWorkspace(data.state, data.actor, b.id);
    const exactB = structuredClone(data.state.invoice);
    wait.resolve();
    const saved = await upload;
    addLiveInvoicePages(data.state, data.actor, { ...a, uploads: [saved] });
    expect(data.state.invoice).toEqual(exactB);
    const retainedA = data.state.invoices!.find(
      (invoice) => invoice.id === a.invoice_id,
    )!;
    expect(retainedA.original_pages?.map((page) => page.file_name)).toEqual([
      "fictional-first.png",
      "fictional-delayed.png",
    ]);
    expect(data.state.invoice.id).toBe(b.id);
  });

  it("rejects mixed and forged batches atomically, keeps valid handles reusable and denies legacy replacement", async () => {
    const data = await fixture();
    const valid = await data.upload(file("fictional-extra.png"));
    const pdfUpload = await data.upload(
      new NodeFile([twoPdf], "fictional-two.pdf", {
        type: "application/pdf",
      }) as unknown as File,
    );
    const expected = target(data.state.invoice),
      before = JSON.stringify(data.state);
    for (const uploads of [
      [valid, pdfUpload],
      [valid, { name: "fictional-forged.png", type: "image/png", size: 1 }],
      [],
    ]) {
      expect(() =>
        addLiveInvoicePages(data.state, data.actor, { ...expected, uploads }),
      ).toThrow();
      expect(JSON.stringify(data.state)).toBe(before);
    }
    expect(() =>
      attachLiveInvoiceOriginals(data.state, data.actor, {
        invoice_id: expected.invoice_id,
        uploads: [valid],
      }),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(before);
    addLiveInvoicePages(data.state, data.actor, {
      ...expected,
      uploads: [valid],
    });
    expect(data.state.invoice.original_pages).toHaveLength(2);
  });

  it("a real recovery edit retires old failure/read identities; a no-op leaves the exact target and audit alone", async () => {
    const data = await fixture("manager", [
      file("fictional-a.png"),
      file("fictional-b.png"),
    ]);
    const old = beginLiveInvoiceReading(
      data.state,
      data.actor,
      data.state.invoice.id,
    );
    const oldReading = reading(data.state.invoice);
    settleLiveInvoiceReading(data.state, data.actor, {
      ...old,
      outcome: "failed",
    });
    const expected = target(data.state.invoice),
      before = JSON.stringify(data.state);
    expect(
      reorderLiveInvoiceOriginals(data.state, data.actor, {
        ...expected,
        order: [0, 1],
      }),
    ).toEqual({
      invoice_id: expected.invoice_id,
      retired_attempt_id: "",
      version: expected.version,
    });
    expect(JSON.stringify(data.state)).toBe(before);
    const result = reorderLiveInvoiceOriginals(data.state, data.actor, {
      ...expected,
      order: [1, 0],
    });
    expect(result.retired_attempt_id).toBe(old.attempt_id);
    expect(data.state.invoice.live_reading?.phase).toBe("ready");
    const changed = JSON.stringify(data.state);
    expect(() =>
      settleLiveInvoiceReading(data.state, data.actor, {
        ...old,
        outcome: "failed",
      }),
    ).toThrow();
    expect(() =>
      applyLiveInvoiceReading(data.state, data.actor, {
        ...old,
        exported: oldReading,
        provenance,
      }),
    ).toThrow();
    expect(() =>
      removeLiveInvoicePage(data.state, data.actor, { ...expected, index: 0 }),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(changed);
  });

  it.each([
    "processing",
    "manual",
    "completed",
    "discarded",
    "line",
    "charge",
    "version",
    "attempt",
    "source",
    "content",
    "session",
    "branch",
    "company",
  ] as const)(
    "rejects %s source edits without any canonical write",
    async (change) => {
      const data = await fixture();
      const expected = target(data.state.invoice);
      const initiatingActor = data.actor;
      if (change === "processing")
        beginLiveInvoiceReading(data.state, data.actor, expected.invoice_id);
      if (change === "manual")
        settleLiveInvoiceReading(data.state, data.actor, {
          invoice_id: expected.invoice_id,
          attempt_id: expected.attempt_id,
          outcome: "manual",
        });
      if (change === "completed") {
        const begun = beginLiveInvoiceReading(
          data.state,
          data.actor,
          expected.invoice_id,
        );
        applyLiveInvoiceReading(data.state, data.actor, {
          ...begun,
          exported: reading(data.state.invoice),
          provenance,
        });
      }
      if (change === "discarded")
        discardInvoice(data.state, data.actor, {
          invoice_id: expected.invoice_id,
          expected_version: expected.version,
          reason: "Fictional source test",
        });
      if (change === "line")
        data.state.invoice.lines.push(
          structuredClone(initialState().invoice.lines[0]),
        );
      if (change === "charge")
        data.state.invoice.other_charges = [
          { description: "Fictional human charge", amount: "1.00" },
        ] as never;
      if (change === "version")
        data.state.invoice.version = expected.version + 1;
      if (change === "attempt") expected.attempt_id = "fictional-stale-attempt";
      if (change === "source")
        data.state.invoice.original_pages![0].original_sha256 = "a".repeat(64);
      if (change === "content")
        data.state.invoice.supplier_invoice_number = "FICTIONAL-HUMAN-EDIT";
      if (change === "session") {
        const directory = structuredClone(authoritySnapshot(data.state));
        directory.sessions.find(
          (session) => session.id === initiatingActor.session_id,
        )!.state = "revoked";
        bindAuthoritySnapshot(data.state, directory);
      }
      if (change === "branch") data.state.invoice.branch = "Branch 2";
      let actor = change === "session" ? initiatingActor : data.actor;
      if (change === "company") {
        const foreign = initialState();
        foreign.config.company.seed_key = "fictional-foreign-page-company";
        actor = authenticatedTestActor(foreign, "manager");
      }
      const before = JSON.stringify(data.state);
      expect(() =>
        removeLiveInvoicePage(data.state, actor, { ...expected, index: 0 }),
      ).toThrow();
      expect(JSON.stringify(data.state)).toBe(before);
    },
  );

  it("manual recovery retains active and removed originals and never permits source edits over entered work", async () => {
    const data = await fixture("floor_worker", [
      file("fictional-kept.png"),
      file("fictional-removed.png"),
    ]);
    removeLiveInvoicePage(data.state, data.actor, {
      ...target(data.state.invoice),
      index: 1,
    });
    const kept = structuredClone(data.state.invoice.original_pages),
      removed = structuredClone(data.state.invoice.retained_original_pages);
    const source = target(data.state.invoice);
    settleLiveInvoiceReading(data.state, data.actor, {
      invoice_id: source.invoice_id,
      attempt_id: source.attempt_id,
      outcome: "manual",
    });
    addManualLine(data.state, data.actor, "0002");
    expect(data.state.invoice.lines).toHaveLength(1);
    expect(data.state.invoice.original_pages).toEqual(kept);
    expect(data.state.invoice.retained_original_pages).toEqual(removed);
    expect(
      invoiceView(data.state, data.actor, data.state.invoice.id)
        .original_page_count,
    ).toBe(2);
    const before = JSON.stringify(data.state);
    expect(() =>
      removeLiveInvoicePage(data.state, data.actor, {
        ...target(data.state.invoice),
        index: 0,
      }),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(before);
  });

  it("keeps duplicate-byte logical originals distinct and archives them without any raw-reference DTO/history export", async () => {
    const data = await fixture("manager", [
      file("fictional-copy.png", "same fictional bytes"),
      file("fictional-copy.png", "same fictional bytes"),
    ]);
    expect(data.state.invoice.original_pages).toHaveLength(2);
    removeLiveInvoicePage(data.state, data.actor, {
      ...target(data.state.invoice),
      index: 0,
    });
    expect(data.state.invoice.original_pages).toHaveLength(1);
    expect(data.state.invoice.retained_original_pages).toHaveLength(1);
    const view = invoiceView(data.state, data.actor, data.state.invoice.id);
    expect(view.original_page_count).toBe(2);
    expect(view).not.toHaveProperty("retained_original_pages");
    expect(view).not.toHaveProperty("pdf_page_selection");
    const secret = data.state.invoice.retained_original_pages![0].file_data;
    const patch = {
      path: [
        "invoice.retained_original_pages",
        { key: "file_data", value: secret },
      ],
      before: secret,
      after: secret,
      current: secret,
      guards: secret,
    };
    expect(
      JSON.stringify(
        businessAuditRead({ snapshot: data.state.invoice, patch }),
      ),
    ).not.toContain("retained_original_pages");
    expect(JSON.stringify(businessAuditRead(patch))).not.toContain(secret);
    const backup = JSON.parse(JSON.stringify(data.state));
    expect(backup.invoice.retained_original_pages).toEqual(
      data.state.invoice.retained_original_pages,
    );
  });
});

describe("F8 genuine logical PDF selection witnesses", () => {
  const pdfFile = (bytes = twoPdf) =>
    new NodeFile([bytes], "fictional-pages.pdf", {
      type: "application/pdf",
    }) as unknown as File;
  it.each([
    { selected: ["Wholly fictional private selection text"] },
    { selected: [{ file_data: "Wholly fictional private reference" }] },
    { selected: "Wholly fictional private selection" },
    { selected: null },
    { selected: [1, 1] },
    { selected: [0] },
    { selected: [1.5] },
  ])(
    "rejects malformed retained PDF selection $selected before any private query result",
    async ({ selected }) => {
      const data = await fixture("manager", [pdfFile()]);
      Object.assign(data.state.invoice, { pdf_page_selection: selected });
      data.returned.length = 0;
      const before = JSON.stringify(data.state);
      expect(() =>
        readLiveOriginalSelection(
          data.state,
          data.actor,
          data.state.invoice.id,
        ),
      ).toThrow("The saved PDF selection is invalid.");
      await expect(
        loadLiveOriginalSelection(data.query, {
          company_id: data.actor.company_id,
          invoice_id: data.state.invoice.id,
        }),
      ).rejects.toThrow("The saved PDF selection is invalid.");
      expect(data.returned).toEqual([]);
      expect(JSON.stringify(data.state)).toBe(before);
    },
  );

  it("decodes protected full bytes without returning private snapshots, removes/restores logical pages and imports only the exact selected count", async () => {
    const data = await fixture("manager", [pdfFile()]);
    const full = structuredClone(data.state.invoice.original_pages);
    data.returned.length = 0;
    const access = await inspectLivePdfPages(data.query, {
      company_id: data.actor.company_id,
      invoice_id: data.state.invoice.id,
    });
    expect(access).toEqual({ pages: 2 });
    expect(Object.isFrozen(access)).toBe(true);
    expect(data.returned[0]).toBeUndefined();
    expect(JSON.stringify(data.returned)).not.toMatch(
      /snapshot|idb-file:|session_id|authority/,
    );
    expect(digest(pdf.getDocument.mock.calls[0][0].data)).toBe(digest(twoPdf));
    const start = target(data.state.invoice),
      before = JSON.stringify(data.state);
    expect(
      selectLiveInvoicePdfPages(data.state, data.actor, {
        ...start,
        selection: [1, 2],
        access,
      }).retired_attempt_id,
    ).toBe("");
    expect(JSON.stringify(data.state)).toBe(before);
    for (const selection of [[1, 1], [0], [3], [1.5]]) {
      expect(() =>
        selectLiveInvoicePdfPages(data.state, data.actor, {
          ...start,
          selection,
          access,
        }),
      ).toThrow();
      expect(JSON.stringify(data.state)).toBe(before);
    }
    expect(() =>
      selectLiveInvoicePdfPages(data.state, data.actor, {
        ...start,
        selection: [2],
        access: { ...access },
      }),
    ).toThrow();
    selectLiveInvoicePdfPages(data.state, data.actor, {
      ...start,
      selection: [],
      access,
    });
    expect(data.state.invoice.original_pages).toEqual(full);
    expect(
      invoiceView(data.state, data.actor, data.state.invoice.id)
        .original_available,
    ).toBe(true);
    expect(() =>
      beginLiveInvoiceReading(data.state, data.actor, start.invoice_id),
    ).toThrow();
    expect(() =>
      verifyLivePdfPages(data.state, data.actor, start.invoice_id, access),
    ).toThrow();
    const renewed = await inspectLivePdfPages(data.query, {
      company_id: data.actor.company_id,
      invoice_id: start.invoice_id,
    });
    selectLiveInvoicePdfPages(data.state, data.actor, {
      ...target(data.state.invoice),
      selection: [2],
      access: renewed,
    });
    expect(
      await loadLiveOriginalSelection(data.query, {
        company_id: data.actor.company_id,
        invoice_id: start.invoice_id,
      }),
    ).toEqual({ count: 1, pdf: true, selected: [2], editable: true });
    const attempt = beginLiveInvoiceReading(
      data.state,
      data.actor,
      start.invoice_id,
    );
    expect(attempt.pdf_pages).toEqual([2]);
    expect(attempt.original_sha256s).toEqual([full![0].original_sha256]);
    const exact = JSON.stringify(data.state);
    expect(() =>
      applyLiveInvoiceReading(data.state, data.actor, {
        ...attempt,
        exported: reading(data.state.invoice, 2),
        provenance,
      }),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(exact);
    applyLiveInvoiceReading(data.state, data.actor, {
      ...attempt,
      exported: reading(data.state.invoice, 1),
      provenance,
    });
    expect(data.state.invoice.status).toBe("review");
    expect(data.state.invoice.pdf_page_selection).toEqual([2]);
    expect(data.state.invoice.original_pages).toEqual(full);
    const original = await loadInvoiceOriginal(data.query, {
      company_id: data.actor.company_id,
      invoice_id: start.invoice_id,
    });
    expect(Buffer.from(await original.source.arrayBuffer())).toEqual(twoPdf);
  });

  it("keeps the full PDF and its chosen logical pages on an explicit simulated recovery", async () => {
    const data = await fixture("manager", [pdfFile()]);
    const full = structuredClone(data.state.invoice.original_pages);
    const access = await inspectLivePdfPages(data.query, {
      company_id: data.actor.company_id,
      invoice_id: data.state.invoice.id,
    });
    selectLiveInvoicePdfPages(data.state, data.actor, {
      ...target(data.state.invoice),
      selection: [2],
      access,
    });
    useSimulatedLiveInvoiceReading(
      data.state,
      data.actor,
      data.state.invoice.id,
    );
    expect(data.state.invoice.pdf_page_selection).toEqual([2]);
    expect(data.state.invoice.original_pages).toEqual(full);
    expect(data.state.invoice.simulated_reading).toBe(true);
    const saved = await loadInvoiceOriginal(data.query, {
      company_id: data.actor.company_id,
      invoice_id: data.state.invoice.id,
    });
    expect(Buffer.from(await saved.source.arrayBuffer())).toEqual(twoPdf);
  });

  it.each(["actor", "source", "version", "abort"] as const)(
    "refuses metadata accepted after %s changed during actual decoder await",
    async (change) => {
      const data = await fixture("manager", [pdfFile()]);
      const wait = gate();
      pdf.gate = wait.promise;
      const controller = new AbortController();
      const pending = inspectLivePdfPages(
        data.query,
        {
          company_id: data.actor.company_id,
          invoice_id: data.state.invoice.id,
        },
        controller.signal,
      );
      const checked = expect(pending).rejects.toThrow();
      await vi.waitFor(() => expect(pdf.getDocument).toHaveBeenCalledOnce());
      if (change === "actor") data.replaceActor();
      if (change === "source")
        data.state.invoice.original_pages![0].file_name =
          "fictional-changed.pdf";
      if (change === "version")
        data.state.invoice.version = (data.state.invoice.version ?? 1) + 1;
      if (change === "abort") controller.abort();
      const before = JSON.stringify(data.state);
      wait.resolve();
      await checked;
      expect(JSON.stringify(data.state)).toBe(before);
    },
  );

  it("observes an actual over-limit PDF count but cannot use selection to bypass the raw PDF transport limit", async () => {
    const data = await fixture("manager", [pdfFile(elevenPdf)]);
    const access = await inspectLivePdfPages(data.query, {
      company_id: data.actor.company_id,
      invoice_id: data.state.invoice.id,
    });
    expect(access.pages).toBe(11);
    const before = JSON.stringify(data.state);
    expect(() =>
      selectLiveInvoicePdfPages(data.state, data.actor, {
        ...target(data.state.invoice),
        selection: [1],
        access,
      }),
    ).toThrow();
    expect(JSON.stringify(data.state)).toBe(before);
    expect(() =>
      beginLiveInvoiceReading(data.state, data.actor, data.state.invoice.id),
    ).not.toThrow();
  });
});
