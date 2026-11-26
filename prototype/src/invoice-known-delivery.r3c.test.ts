import { describe, expect, it, vi } from "vitest";
import { invoiceView } from "./invoice-projections";
import {
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
} from "./invoice";
import {
  invoiceCheckCount,
  setInvoiceLineCategory,
  confirmInvoiceLineChecks,
} from "./invoice-checks";
import {
  importInvoiceReadings,
  prepareInvoiceReadingPages,
  previewInvoiceReadings,
} from "./invoice-readings";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import { authenticatedTestActor } from "./authority-test-fixture";
import { projectHistoryEntry } from "./history";
import {
  correctPostedInvoice,
  invoiceContentCorrectionPreview,
} from "./invoice-corrections";
import {
  matchingReading,
  matchingBusiness,
  postedMatchingProduct,
} from "./test/r2b-product-matching-fixture";
import type { DemoState } from "./types";
import type { AuthenticatedActor } from "./authority-types";

vi.mock("./file-database", async (original) => ({
  ...(await original<typeof import("./file-database")>()),
  storeUploadedFile: vi.fn(
    async (file: Blob & { name?: string }, company: string) => ({
      reference: `idb-file:v1:${company}:${"a".repeat(64)}`,
      name: file.name ?? "fictional.png",
      type: file.type,
      size: file.size,
    }),
  ),
}));

async function nextDelivery(
  state: DemoState,
  actor: AuthenticatedActor,
  change?: (
    source: NonNullable<
      ReturnType<typeof matchingReading>["invoices"][number]["ai_reading"]
    >,
  ) => void,
  flags = true,
) {
  const exported = matchingReading(1, undefined, "CAR-24");
  const entry = exported.invoices[0];
  entry.ai_statuses = flags
    ? Object.fromEntries(
        [
          "description",
          "supplier_sku",
          "units_per_case",
          "pack_size",
          "unit_cost_before_tax",
          "cost_per_case_before_tax",
          "pricing_category",
          "unit",
          "cost_basis",
        ].map((field) => [`lines[0].${field}`, "check"]),
      )
    : {};
  change?.(entry.ai_reading!);
  const preview = previewInvoiceReadings(
    state,
    actor,
    exported,
    "ai",
    "Branch 1",
  );
  const pages = await prepareInvoiceReadingPages(
    exported,
    [entry.id],
    state.config.company.seed_key,
  );
  const result = importInvoiceReadings(state, actor, {
    exported,
    pages,
    selectedIds: [entry.id],
    locations: { [entry.id]: "Branch 1" },
    mode: "ai",
    fileName: "fictional-known-delivery.json",
  });
  expect(result.imported).toHaveLength(1);
  selectInvoiceWorkspace(state, actor, result.imported[0]);
  return { invoice: state.invoice, exported, preview };
}

async function postedUnitDelivery(unit: "each" | "kg" | "lb") {
  const state = matchingBusiness();
  const actor = authenticatedTestActor(state, "owner");
  const exported = matchingReading(0, undefined, "CAR-24");
  const entry = exported.invoices[0];
  Object.assign(entry.ai_reading!.lines![0], {
    unit,
    cost_basis: unit,
    quantity: unit === "each" ? "24" : "1",
    units_received: unit === "each" ? "24" : "1",
    unit_cost_before_tax: unit === "each" ? "1.2500" : "30.0000",
    cost_per_unit_before_tax: unit === "each" ? "1.2500" : "30.0000",
  });
  const pages = await prepareInvoiceReadingPages(
    exported,
    [entry.id],
    state.config.company.seed_key,
  );
  const result = importInvoiceReadings(state, actor, {
    exported,
    pages,
    selectedIds: [entry.id],
    locations: { [entry.id]: "Branch 1" },
    mode: "ai",
    fileName: "fictional-known-unit.json",
  });
  selectInvoiceWorkspace(state, actor, result.imported[0]);
  setInvoiceLineCategory(state.invoice.lines[0], "grocery", state.config);
  confirmInvoiceLineChecks(state, actor, 0);
  postInvoice(state, actor);
  return { state, actor };
}

describe("R3c K1 repeat-delivery confirmation", () => {
  it.each(["", "other", "crate", undefined, null])(
    "keeps an unknown raw unit %s checked instead of trusting the units fallback",
    async (unit) => {
      const { state, actor } = await postedUnitDelivery("each");
      const { invoice, preview } = await nextDelivery(
        state,
        actor,
        (reading) => {
          Object.assign(reading.lines![0], {
            unit,
            quantity: "24",
            units_received: "24",
          });
        },
      );
      expect(invoice.lines[0].quantity_unit).toBe("units");
      expect(invoice.lines[0].known_delivery?.status).toBe("same");
      expect(invoice.lines[0].low_confidence_fields).toEqual(["quantity_unit"]);
      expect(invoice.lines[0].review_confirmed).toBe(false);
      expect(preview[0].check_count).toBe(1);
    },
  );

  it.each(["", "other", "box", "cs24", undefined])(
    "does not clear a flagged unit using an unknown raw cost basis %s",
    async (cost_basis) => {
      const { state, actor } = await postedMatchingProduct("CAR-24");
      const { invoice } = await nextDelivery(state, actor, (reading) => {
        Object.assign(reading.lines![0], { cost_basis });
      });
      expect(invoice.lines[0].low_confidence_fields).toEqual(["quantity_unit"]);
      expect(invoice.lines[0].review_confirmed).toBe(false);
    },
  );

  it("keeps the existing unflagged legacy missing-basis behavior", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(
      state,
      actor,
      (reading) => {
        delete reading.lines![0].cost_basis;
      },
      false,
    );
    expect(invoice.lines[0].low_confidence_fields).toEqual([]);
    expect(invoice.lines[0].review_confirmed).toBe(true);
  });

  it.each(["kg", "lb"] as const)(
    "clears matching %s quantity and cost-basis checks without changing source values",
    async (unit) => {
      const { state, actor } = await postedUnitDelivery(unit);
      const { invoice } = await nextDelivery(state, actor, (reading) => {
        Object.assign(reading.lines![0], {
          unit,
          cost_basis: unit,
          quantity: "1",
          units_received: "1",
          unit_cost_before_tax: "30.0000",
          cost_per_unit_before_tax: "30.0000",
        });
      });
      expect(invoice.lines[0]).toMatchObject({
        source_quantity_unit: unit,
        source_cost_unit: unit,
        source_cost_before_tax: "30.0000",
        low_confidence_fields: [],
        review_confirmed: true,
      });
      expect(invoice.lines[0].checked_fields).toBeUndefined();
    },
  );

  it.each([true, false])(
    "keeps a changed weighted cost basis checked with AI flags=%s",
    async (flags) => {
      const { state, actor } = await postedUnitDelivery("kg");
      const { invoice } = await nextDelivery(
        state,
        actor,
        (reading) => {
          Object.assign(reading.lines![0], {
            unit: "kg",
            cost_basis: "lb",
            quantity: "1",
            units_received: "1",
            unit_cost_before_tax: "13.6078",
            cost_per_unit_before_tax: "13.6078",
          });
        },
        flags,
      );
      expect(invoice.lines[0].known_delivery?.status).toBe("same");
      expect(invoice.lines[0].unit_cost_before_tax).toBe("13.6078");
      expect(invoice.lines[0].low_confidence_fields).toEqual(["quantity_unit"]);
      expect(invoice.lines[0].review_confirmed).toBe(false);
    },
  );

  it("uses explicit per-unit cost evidence when the paper also includes a case cost", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      Object.assign(reading.lines![0], {
        cost_basis: "case",
        unit_cost_before_tax: "30.0000",
        cost_per_unit_before_tax: "1.2500",
        cost_per_case_before_tax: "30.0000",
      });
    });
    expect(invoice.lines[0].imported_unit_cost_basis).toMatchObject({
      printed_cost_basis: "unit",
      printed_unit_cost_before_tax: "1.2500",
      printed_case_cost_before_tax: "30.0000",
    });
    expect(invoice.lines[0].review_confirmed).toBe(true);
    expect(invoice.lines[0].low_confidence_fields).toEqual([]);
  });

  it("does not promote an unflagged normalized fractional case into a proven same unit", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(
      state,
      actor,
      (reading) => {
        reading.subtotal = reading.final_total = "15.00";
        Object.assign(reading.lines![0], {
          quantity: "0.5",
          units_received: "12",
          line_total: "15.00",
        });
      },
      false,
    );
    expect(invoice.lines[0].quantity_unit).toBe("units");
    expect(invoice.lines[0].low_confidence_fields).toEqual(["quantity_unit"]);
    expect(invoice.lines[0].review_confirmed).toBe(false);
  });

  it("clears the unchanged weighted unit independently of a real changed cost", async () => {
    const { state, actor } = await postedUnitDelivery("kg");
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      reading.subtotal = reading.final_total = "33.00";
      Object.assign(reading.lines![0], {
        unit: "kg",
        cost_basis: "kg",
        quantity: "1",
        units_received: "1",
        unit_cost_before_tax: "33.0000",
        cost_per_unit_before_tax: "33.0000",
        line_total: "33.00",
      });
    });
    expect(invoice.lines[0].low_confidence_fields).toEqual([
      "unit_cost_before_tax",
    ]);
    expect(invoice.lines[0].review_confirmed).toBe(false);
  });

  it("keeps a recognized kg/lb quantity change checked even without an AI unit flag", async () => {
    const { state, actor } = await postedUnitDelivery("lb");
    const { invoice } = await nextDelivery(
      state,
      actor,
      (reading) => {
        reading.subtotal = reading.final_total = "66.14";
        Object.assign(reading.lines![0], {
          unit: "kg",
          cost_basis: "lb",
          quantity: "1",
          units_received: "1",
          unit_cost_before_tax: "30.0000",
          cost_per_unit_before_tax: "30.0000",
          line_total: "66.14",
        });
      },
      false,
    );
    expect(invoice.lines[0].known_delivery?.status).toBe("same");
    expect(invoice.lines[0].unit_cost_before_tax).toBe("30.0000");
    expect(invoice.lines[0].low_confidence_fields).toEqual(["quantity_unit"]);
    expect(invoice.lines[0].review_confirmed).toBe(false);
  });

  it.each(["case", "cases", "cs24", "carton", "box"])(
    "clears the reader unit check for a proven same %s delivery",
    async (unit) => {
      const { state, actor } = await postedMatchingProduct("CAR-24");
      const { invoice, preview } = await nextDelivery(
        state,
        actor,
        (reading) => {
          reading.lines![0].unit = unit;
        },
      );
      expect(invoice.lines[0]).toMatchObject({
        quantity_unit: "cases",
        low_confidence_fields: [],
        review_confirmed: true,
        known_delivery: { status: "same", changes: [] },
      });
      expect(invoice.lines[0].checked_fields).toBeUndefined();
      expect(invoiceCheckCount(invoice)).toBe(0);
      expect(preview[0].check_count).toBe(0);
      expect(invoiceBlockers(state, actor)).toEqual([]);
    },
  );

  it.each([true, false])(
    "keeps a recognized changed quantity unit unresolved with AI flags=%s",
    async (flags) => {
      const { state, actor } = await postedMatchingProduct("CAR-24");
      const { invoice } = await nextDelivery(
        state,
        actor,
        (reading) => {
          Object.assign(reading.lines![0], {
            unit: "each",
            quantity: "24",
            units_received: "24",
          });
        },
        flags,
      );
      expect(invoice.lines[0].quantity_unit).toBe("units");
      expect(invoice.lines[0].low_confidence_fields).toEqual(["quantity_unit"]);
      expect(invoice.lines[0].review_confirmed).toBe(false);
      expect(invoiceBlockers(state, actor)).toContain("review");
    },
  );

  it.each([true, false])(
    "keeps a changed printed cost basis unresolved with AI flags=%s",
    async (flags) => {
      const { state, actor } = await postedMatchingProduct("CAR-24");
      const { invoice } = await nextDelivery(
        state,
        actor,
        (reading) => {
          Object.assign(reading.lines![0], {
            cost_basis: "case",
            unit_cost_before_tax: "30.0000",
          });
          delete reading.lines![0].cost_per_unit_before_tax;
        },
        flags,
      );
      expect(invoice.lines[0].unit_cost_before_tax).toBe("1.2500");
      expect(invoice.lines[0].low_confidence_fields).toEqual(["quantity_unit"]);
      expect(invoice.lines[0].review_confirmed).toBe(false);
      expect(invoiceBlockers(state, actor)).toContain("review");
    },
  );

  it("never treats coincident per-Each and per-lb costs as the same delivery basis", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      reading.subtotal = reading.final_total = "1.25";
      Object.assign(reading.lines![0], {
        unit: "lb",
        cost_basis: "lb",
        quantity: "1",
        units_received: "1",
        unit_cost_before_tax: "1.2500",
        cost_per_unit_before_tax: "1.2500",
        line_total: "1.25",
      });
    });
    expect(invoice.lines[0].unit_cost_before_tax).toBe("1.2500");
    expect(invoice.lines[0].known_delivery?.changes).toEqual([
      { field: "quantity_unit", before: "each", after: "weight" },
    ]);
    expect(invoice.lines[0].low_confidence_fields).toEqual([
      "unit_cost_before_tax",
      "case_cost_before_tax",
      "quantity_unit",
    ]);
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoiceBlockers(state, actor)).toContain("review");
  });
  it("retains a current paper-cost disagreement independently of a Weight to Each basis change", async () => {
    const state = matchingBusiness(),
      actor = authenticatedTestActor(state, "owner");
    const exported = matchingReading(0, undefined, "CAR-24"),
      entry = exported.invoices[0];
    entry.ai_reading!.subtotal = entry.ai_reading!.final_total = "1.25";
    Object.assign(entry.ai_reading!.lines![0], {
      unit: "lb",
      cost_basis: "lb",
      quantity: "1",
      units_received: "1",
      line_total: "1.25",
    });
    const pages = await prepareInvoiceReadingPages(
      exported,
      [entry.id],
      state.config.company.seed_key,
    );
    const result = importInvoiceReadings(state, actor, {
      exported,
      pages,
      selectedIds: [entry.id],
      locations: { [entry.id]: "Branch 1" },
      mode: "ai",
      fileName: "fictional-basis.json",
    });
    selectInvoiceWorkspace(state, actor, result.imported[0]);
    setInvoiceLineCategory(state.invoice.lines[0], "grocery", state.config);
    confirmInvoiceLineChecks(state, actor, 0);
    postInvoice(state, actor);
    const { invoice } = await nextDelivery(
      state,
      actor,
      (reading) => {
        Object.assign(reading.lines![0], {
          unit: "each",
          cost_basis: "each",
          quantity: "24",
          units_received: "24",
          unit_cost_before_tax: "1.4000",
          cost_per_unit_before_tax: "1.4000",
        });
      },
      false,
    );
    expect(invoice.lines[0].known_delivery?.changes).toEqual([
      { field: "quantity_unit", before: "weight", after: "each" },
    ]);
    expect(invoice.lines[0].low_confidence_fields).toEqual([
      "quantity_unit",
      "unit_cost_before_tax",
    ]);
    expect(invoice.lines[0].review_confirmed).toBe(false);
  });
  it("does not clear a printed-cost arithmetic disagreement merely because the paper-derived cost matches history", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      reading.lines![0].unit_cost_before_tax =
        reading.lines![0].cost_per_unit_before_tax = "1.4000";
    });
    expect(invoice.lines[0].unit_cost_before_tax).toBe("1.2500");
    expect(
      invoice.lines[0].imported_unit_cost_basis?.printed_unit_cost_before_tax,
    ).toBe("1.4000");
    expect(invoice.lines[0].low_confidence_fields).toEqual([
      "case_cost_before_tax",
    ]);
    expect(invoice.lines[0].review_confirmed).toBe(false);
  });
  it("keeps a genuinely new printed supplier code as the only changed field on a uniquely named known product", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      reading.lines![0].supplier_sku = "CAR-NEW";
    });
    expect(invoice.lines[0].known_delivery?.changes).toEqual([
      { field: "supplier_item_code", before: "CAR-24", after: "CAR-NEW" },
    ]);
    expect(invoice.lines[0].low_confidence_fields).toEqual([
      "supplier_item_code",
    ]);
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoice.lines[0].checked_fields).toBeUndefined();
  });
  it("compares effective posted corrections instead of silently using the original price", async () => {
    const {
      state,
      actor,
      invoice: original,
    } = await postedMatchingProduct("CAR-24");
    const lines = structuredClone(original.lines);
    lines[0].unit_cost_before_tax = "1.5000";
    lines[0].case_cost_before_tax = "36.0000";
    const input = { lines, reason: "Correct the fictional paid case cost." };
    const preview = invoiceContentCorrectionPreview(
      state,
      actor,
      original.id,
      input,
    );
    correctPostedInvoice(
      state,
      actor,
      original.id,
      input,
      preview.snapshot,
      "fictional-k1-correction",
    );
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      reading.subtotal = reading.final_total = "36.00";
      Object.assign(reading.lines![0], {
        unit_cost_before_tax: "1.5000",
        cost_per_unit_before_tax: "1.5000",
        cost_per_case_before_tax: "36.0000",
        line_total: "36.00",
      });
    });
    expect(invoice.lines[0].known_delivery?.status).toBe("same");
    expect(invoice.lines[0].review_confirmed).toBe(true);
    expect(original.lines[0].unit_cost_before_tax).toBe("1.2500");
  });

  it("keeps comparison amounts within genuine invoice authority and redacts them from operational History", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      reading.subtotal = reading.final_total = "34.20";
      Object.assign(reading.lines![0], {
        unit_cost_before_tax: "1.4250",
        cost_per_unit_before_tax: "1.4250",
        cost_per_case_before_tax: "34.2000",
        line_total: "34.20",
      });
    });
    const worker = authenticatedTestActor(state, "floor_worker");
    const view = invoiceView(state, worker, invoice.id);
    expect(view.purchase_cost_allowed).toBe(true);
    expect(view.lines[0].known_delivery?.changes[0].before).toBe("30.0000");
    expect(view.lines[0].known_delivery).not.toHaveProperty(
      "source_invoice_id",
    );
    expect(view.lines[0].known_delivery).not.toHaveProperty("fingerprint");
    const entry = {
      id: "fictional-k1-private-comparison",
      company_id: worker.company_id,
      branch: invoice.branch,
      action: "Review invoice",
      actor_user_id: worker.user_id,
      by: worker.actor,
      at: new Date().toISOString(),
      entity_type: "invoice",
      entity_id: invoice.id,
      after: {
        known_delivery: structuredClone(invoice.lines[0].known_delivery),
      },
      reversible: false,
    };
    state.activity.push(entry);
    expect(projectHistoryEntry(state, worker, entry).after).toEqual({});
    expect(invoice.lines[0].known_delivery?.changes[0].before).toBe("30.0000");
    const cashier = authenticatedTestActor(state, "cashier");
    expect(() => invoiceView(state, cashier, invoice.id)).toThrow();
    const original = state.invoices!.find(
      (candidate) => candidate.status === "posted",
    )!;
    original.branch = "Branch 2";
    expect(
      invoiceView(state, worker, invoice.id).lines[0].known_delivery,
    ).toBeUndefined();
  });
  it("posts the first delivery, then recognizes unchanged values with zero checks and no human receipts", async () => {
    const {
      state,
      actor,
      product,
      invoice: first,
    } = await postedMatchingProduct("CAR-24");
    expect(product.status).toBe("pending_approval");
    const approvals = structuredClone(state.approvals),
      ledger = structuredClone(state.ledger);
    const { invoice, exported, preview } = await nextDelivery(state, actor);
    expect(invoice.lines[0]).toMatchObject({
      product_code: product.code,
      review_confirmed: true,
      low_confidence_fields: [],
      known_delivery: { status: "same", date: "2026-08-12", changes: [] },
    });
    expect(invoice.lines[0].checked_fields).toBeUndefined();
    expect(invoiceCheckCount(invoice)).toBe(0);
    expect(preview[0].check_count).toBe(0);
    expect(invoiceBlockers(state, actor)).toEqual([]);
    expect(state.approvals).toEqual(approvals);
    expect(state.ledger).toEqual(ledger);
    expect(state.products).toHaveLength(1);
    expect(state.products[0].status).toBe("pending_approval");
    expect(first.lines[0].description).toBe("CARROT 24");
    expect(invoice.original_pages?.map((page) => page.original_sha256)).toEqual(
      exported.invoices[0].original_sha256,
    );
    const view = invoiceView(state, actor, invoice.id).lines[0];
    expect(view.known_delivery).toEqual({
      status: "same",
      date: "2026-08-12",
      changes: [],
    });
    expect(view.known_delivery).not.toHaveProperty("fingerprint");
    expect(view.known_delivery).not.toHaveProperty("source_invoice_id");
    postInvoice(state, actor);
    expect(state.invoice.status).toBe("posted");
    expect(state.products).toHaveLength(1);
  });

  it("highlights exactly one changed cost, retaining the earlier date and all source money", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice, preview } = await nextDelivery(state, actor, (reading) => {
      reading.subtotal = reading.final_total = "34.20";
      Object.assign(reading.lines![0], {
        unit_cost_before_tax: "1.4250",
        cost_per_unit_before_tax: "1.4250",
        cost_per_case_before_tax: "34.2000",
        line_total: "34.20",
      });
    });
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoice.lines[0].low_confidence_fields).toEqual([
      "case_cost_before_tax",
    ]);
    expect(invoice.lines[0].known_delivery).toMatchObject({
      status: "changed",
      date: "2026-08-12",
      changes: [
        {
          field: "unit_cost_before_tax",
          before: "30.0000",
          after: "34.2000",
          unit: "case",
        },
      ],
    });
    expect(invoice.lines[0].line_total).toBe("34.20");
    expect(invoice.final_total).toBe("34.20");
    expect(preview[0].check_count).toBe(1);
  });

  it("keeps a unique Product and highlights only its changed pack when the paid case cost is unchanged", async () => {
    const { state, actor, product } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor, (reading) =>
      Object.assign(reading.lines![0], {
        units_per_case: "20",
        pack_size: "20 × 300 g",
        unit_cost_before_tax: "1.5000",
        cost_per_unit_before_tax: "1.5000",
      }),
    );
    expect(invoice.lines[0].product_code).toBe(product.code);
    expect(invoice.lines[0].known_delivery?.changes).toEqual([
      { field: "units_per_case", before: "24", after: "20" },
    ]);
    expect(invoice.lines[0].low_confidence_fields).toEqual(["units_per_case"]);
    expect(invoice.lines[0].reading_product_match?.requires_check).toBe(false);
    expect(invoice.lines[0].review_confirmed).toBe(false);
  });

  it("retains independent quantity checks and invalidates automatic confirmation on a real edit", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor, (reading) => {
      reading.lines![0].quantity = "";
    });
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoice.lines[0].low_confidence_fields).toContain(
      "quantity_entered",
    );
    expect(invoiceBlockers(state, actor)).toContain("quantity");
    setInvoiceLineQuantity(invoice.lines[0], "2", "cases", 24);
    expect(invoice.lines[0].known_delivery).toBeUndefined();
    recalculateInvoice(invoice, state.config);
    expect(invoice.lines[0].review_confirmed).toBe(false);
  });

  it("does not use another-location purchase evidence to auto-confirm a new local delivery", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    state.invoices!.find((invoice) => invoice.status === "posted")!.branch =
      "Branch 2";
    state.invoice.branch = "Branch 2";
    const { invoice } = await nextDelivery(state, actor);
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoice.lines[0].known_delivery).toBeUndefined();
  });

  it("removes stale comparison captions and confirmation when category changes", async () => {
    const { state, actor } = await postedMatchingProduct("CAR-24");
    const { invoice } = await nextDelivery(state, actor);
    setInvoiceLineCategory(invoice.lines[0], "rice", state.config);
    expect(invoice.lines[0].review_confirmed).toBe(false);
    expect(invoice.lines[0].known_delivery).toBeUndefined();
    expect(
      invoiceView(state, actor, invoice.id).lines[0].known_delivery,
    ).toBeUndefined();
  });
});
