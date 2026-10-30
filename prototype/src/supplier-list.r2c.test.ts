import { describe, expect, it, vi } from "vitest";
import fixture from "../tests/fixtures/r2b-fictional-readings-export.json";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  importInvoiceReadings,
  parseInvoiceReadings,
  prepareInvoiceReadingPages,
} from "./invoice-readings";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import {
  acknowledgeInvoiceCheck,
  confirmInvoiceLineChecks,
} from "./invoice-checks";
import { postInvoice, recalculateInvoice } from "./invoice";
import {
  invoiceContentCorrectionPreview,
  correctPostedInvoice,
} from "./invoice-corrections";
import { effectiveInvoiceVersion } from "./invoice-version";
import { invoiceLocationMovePreview, movePostedInvoice } from "./received";
import { suppliersOverview } from "./suppliers";
import { supplierMatchesFilters } from "./supplier-list";

vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(
    async (file: Blob & { name?: string }, company: string) => ({
      reference: `idb-file:v1:${company}:${"b".repeat(64)}`,
      name: file.name ?? "fictional.png",
      type: file.type,
      size: file.size,
    }),
  ),
}));

describe("R2c 3.1 retained imported suppliers", () => {
  it("keeps incomplete suppliers through three-branch import, post, correct, move, reload and role/location switches", async () => {
    let state = initialState();
    state.products = [];
    state.invoices = [];
    state.invoice.status = "empty";
    state.invoice.lines = [];
    state.suppliers = [];
    state.supplier_items = [];
    state.returns = [];
    state.ledger = [];
    const manager = authenticatedTestActor(state, "manager", {
      selection: { kind: "all_locations" },
    });
    const exported = parseInvoiceReadings(JSON.stringify(fixture));
    const selectedIds = exported.invoices.map((entry) => entry.id);
    const pages = await prepareInvoiceReadingPages(
      exported,
      selectedIds,
      state.config.company.seed_key,
    );
    importInvoiceReadings(state, manager, {
      exported,
      fileName: "fictional-suppliers.json",
      mode: "ai",
      selectedIds,
      locations: Object.fromEntries(
        selectedIds.map((id, index) => [id, `Branch ${(index % 3) + 1}`]),
      ),
      pages,
    });
    const expected = state
      .suppliers!.filter((supplier) => supplier.active)
      .map((supplier) => supplier.name)
      .sort();
    expect(expected.length).toBeGreaterThanOrEqual(3);
    const verify = () => {
      for (const role of ["owner", "manager"] as const)
        for (const branch of ["all", "Branch 1", "Branch 2", "Branch 3"]) {
          const actor = authenticatedTestActor(state, role, {
            user_id: `fixture-${role}-${branch}`,
            selection:
              branch === "all"
                ? { kind: "all_locations" }
                : { kind: "location", location_id: branch },
          });
          const overview = suppliersOverview(state, actor);
          expect(overview.map((supplier) => supplier.name).sort()).toEqual(
            expected,
          );
          expect(
            overview
              .filter((supplier) =>
                supplierMatchesFilters(supplier, "", ["proposed"]),
              )
              .map((supplier) => supplier.name)
              .sort(),
          ).toEqual(expected);
        }
    };
    verify();
    selectInvoiceWorkspace(state, manager, state.invoices![0].id);
    state.invoice.lines[0].pricing_category = "grocery";
    recalculateInvoice(state.invoice, state.config);
    for (const field of [...(state.invoice.low_confidence_fields ?? [])])
      acknowledgeInvoiceCheck(state, manager, field);
    confirmInvoiceLineChecks(state, manager, 0);
    postInvoice(state, manager);
    verify();
    const input = {
      lines: structuredClone(
        effectiveInvoiceVersion(state, state.invoice).lines,
      ),
      reason: "Fictional price transcription correction",
    };
    input.lines[0].unit_cost_before_tax = "2.0000";
    const correction = invoiceContentCorrectionPreview(
      state,
      manager,
      state.invoice.id,
      input,
    );
    correctPostedInvoice(
      state,
      manager,
      state.invoice.id,
      input,
      correction.snapshot,
      "r2c-supplier-lifecycle",
    );
    verify();
    const move = invoiceLocationMovePreview(
      state,
      manager,
      state.invoice.id,
      "Branch 2",
    );
    movePostedInvoice(
      state,
      manager,
      state.invoice.id,
      "Branch 2",
      "Fictional receiving location correction",
      move.snapshot,
    );
    verify();
    state = JSON.parse(JSON.stringify(state));
    verify();
    const worker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
      selection: { kind: "location", location_id: "Branch 1" },
    });
    const workerRows = suppliersOverview(state, worker);
    expect(workerRows.map((supplier) => supplier.name).sort()).toEqual(
      expected,
    );
    expect(
      workerRows.every((supplier) => supplier.financial === undefined),
    ).toBe(true);
    expect(
      state.activity.some(
        (entry) => entry.entity_type === "invoice_content_correction",
      ),
    ).toBe(true);
    expect(state.invoice_location_corrections).toHaveLength(1);
  });
  it("treats the remembered proposed chip as missing profile details, independent of active status", () => {
    const state = initialState();
    const actor = authenticatedTestActor(state, "manager");
    const rows = suppliersOverview(state, actor);
    for (const row of rows)
      expect(supplierMatchesFilters(row, "", ["proposed"])).toBe(
        row.profile_missing.length > 0,
      );
    expect(
      rows.some(
        (row) =>
          row.status === "confirmed" &&
          supplierMatchesFilters(row, "", ["proposed"]),
      ),
    ).toBe(true);
    expect(
      rows.every((row) => supplierMatchesFilters(row, "", ["retired-filter"])),
    ).toBe(true);
  });
});
