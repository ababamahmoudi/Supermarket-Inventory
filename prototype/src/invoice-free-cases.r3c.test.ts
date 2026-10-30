import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  matchingBusiness,
  matchingReading,
} from "./test/r2b-product-matching-fixture";
import {
  importInvoiceReadings,
  prepareInvoiceReadingPages,
  previewInvoiceReadings,
} from "./invoice-readings";
import {
  invoiceWorkspaceRead,
  selectInvoiceWorkspace,
} from "./invoice-workspace-read";
import {
  confirmInvoiceLineChecks,
  invoiceCheckCount,
  setInvoiceLineCategory,
} from "./invoice-checks";
import {
  invoiceBlockers,
  lineRefused,
  lineShort,
  postInvoice,
  recalculateInvoice,
  receiveShort,
} from "./invoice";
import {
  answerInvoiceFreeCases,
  freeCaseActionQuote,
  groupInvoiceFreeCases,
  setFreeCaseMemberDelivery,
  validFreeCaseGroup,
  type FreeCaseChoice,
} from "./invoice-free-cases";
import { invoiceLineAmount } from "./invoice-weight";
import { invoiceView } from "./invoice-projections";
import { businessAuditRead } from "./business-audit-read";
import { approvalViews } from "./sales-projections";
import { resolveApproval } from "./approvals";
import {
  invoiceDisplayLineAmount,
  invoiceDisplayPaperMismatch,
  invoiceDisplayShortTotals,
  invoiceDisplayRefusedTotals,
} from "./invoice-display-arithmetic";
import { invoiceContentCorrectionPreview } from "./invoice-corrections";
import {
  receivingPriceQuote,
  receivingPriceProblem,
  setInvoiceReceivingPrice,
} from "./invoice-receiving-price";

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

async function prepare() {
  const state = matchingBusiness();
  const owner = authenticatedTestActor(state, "owner");
  const exported = matchingReading(0);
  const source = exported.invoices[0];
  const paid = source.ai_reading!.lines![0];
  Object.assign(paid, {
    description: "NORTHSTAR JAM 24 X 300G",
    unit_cost_before_tax: "1.2500",
    line_total: "30.00",
  });
  source.ai_reading!.lines!.push({
    ...paid,
    description: "NORTHSTAR JAM 24 X 300G BONUS",
    unit_cost_before_tax: "0.0000",
    cost_per_unit_before_tax: "0.0000",
    cost_per_case_before_tax: "0.0000",
    line_total: "0.00",
  });
  source.checked_answer = {
    lines: [
      { description: "Northstar Jam 300 g" },
      { description: "Northstar Jam 300 g" },
    ],
  };
  const original = structuredClone(exported);
  const preview = previewInvoiceReadings(
    state,
    owner,
    exported,
    "checked",
    "Branch 1",
  );
  const pages = await prepareInvoiceReadingPages(
    exported,
    [source.id],
    state.config.company.seed_key,
  );
  const result = importInvoiceReadings(state, owner, {
    exported,
    pages,
    selectedIds: [source.id],
    locations: { [source.id]: "Branch 1" },
    mode: "checked",
    fileName: "fictional-paid-free.json",
  });
  expect(result.imported).toHaveLength(1);
  selectInvoiceWorkspace(state, owner, result.imported[0]);
  expect(state.invoice.lines).toHaveLength(1);
  expect(preview[0].check_count).toBe(invoiceCheckCount(state.invoice));
  expect(exported).toEqual(original);
  setInvoiceLineCategory(state.invoice.lines[0], "grocery", state.config);
  const floor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Fictional Free-case Receiver",
  });
  state.invoice.handler_user_ids = [floor.user_id];
  return { state, owner, floor, original };
}

function answer(
  current: Awaited<ReturnType<typeof prepare>>,
  choice: FreeCaseChoice,
) {
  answerInvoiceFreeCases(
    current.state,
    current.floor,
    0,
    choice,
    freeCaseActionQuote(current.state, current.floor, 0),
    new Date("2026-10-30T12:00:00Z"),
  );
  recalculateInvoice(current.state.invoice, current.state.config);
}

describe("R3c K8 paid/free source decisions", () => {
  it.each(["bonus", "two_for_one", "mistake"] as const)(
    "posts one product with exact paper and actual floor %s attribution",
    async (choice) => {
      const current = await prepare();
      const { state, owner, floor } = current;
      const before = structuredClone(state.invoice.original_pages);
      expect(() => confirmInvoiceLineChecks(state, floor, 0)).toThrow(
        /free-case/,
      );
      expect(state.products).toEqual([]);
      answer(current, choice);
      const line = state.invoice.lines[0];
      expect(validFreeCaseGroup(line)).toBe(true);
      expect(line.qty_invoiced).toBe(choice === "mistake" ? 24 : 48);
      expect(line.unit_cost_before_tax).toBe(
        choice === "two_for_one" ? "0.6250" : "1.2500",
      );
      expect(invoiceLineAmount(line)).toBe("30.00");
      confirmInvoiceLineChecks(state, floor, 0);
      expect(invoiceBlockers(state, owner)).toEqual([]);
      expect(postInvoice(state, owner)).toBe(true);
      expect(state.products).toHaveLength(1);
      expect(state.invoice.lines).toHaveLength(1);
      expect(state.invoice.final_total).toBe("30.00");
      expect(state.invoice.original_pages).toEqual(before);
      expect(validFreeCaseGroup(line)).toBe(true);
      expect(state.approvals).toHaveLength(1);
      expect(state.approvals[0].free_case_answer).toMatchObject({
        decision: choice,
        answer: {
          by_user_id: floor.user_id,
          by: "Fictional Free-case Receiver",
          at: "2026-10-30T12:00:00.000Z",
        },
      });
      expect(state.approvals[0].triggered_by_user_id).toBe(owner.user_id);
      const supervisor = authenticatedTestActor(state, "branch_supervisor", {
        locations: ["Branch 1"],
      });
      const publicApproval = approvalViews(state, supervisor)[0];
      expect(publicApproval.free_case_answer).toMatchObject({
        decision: choice,
        answer: { by_user_id: floor.user_id },
      });
      expect(JSON.stringify(publicApproval)).not.toMatch(
        /paid_amount|pricing_unit_cost/,
      );
      expect(approvalViews(state, owner)[0].free_case_answer).toMatchObject({
        paid_amount: "30.00",
        pricing_unit_cost: line.unit_cost_before_tax,
      });
      expect(
        (state.stock_movements ?? []).filter(
          (row) =>
            row.invoice_id === state.invoice.id && row.type === "received",
        ),
      ).toHaveLength(1);
      expect(state.supplier_items![0].printed_description_keys).toHaveLength(
        choice === "mistake" ? 1 : 2,
      );
      const view = invoiceView(state, floor, state.invoice.id);
      expect(
        invoiceDisplayLineAmount(
          view.lines[0] as Parameters<typeof invoiceDisplayLineAmount>[0],
        ),
      ).toBe("30.00");
      expect(
        invoiceDisplayPaperMismatch(
          view.lines[0] as Parameters<typeof invoiceDisplayPaperMismatch>[0],
        ),
      ).toBeUndefined();
      expect(JSON.stringify(view)).not.toContain("source_fingerprint");
      expect(JSON.stringify(view)).not.toContain("free_case_group");
      expect(
        JSON.stringify(
          businessAuditRead({
            scalar: 1,
            free_case_group: line.free_case_group,
            path: ["invoice", "free_case_group"],
            before: "private",
          }),
        ),
      ).not.toContain("private");
    },
  );

  it("missing or refused free members deduct zero while paid members retain exact amount", async () => {
    const current = await prepare();
    answer(current, "bonus");
    const { state, floor } = current;
    const line = state.invoice.lines[0];
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      1,
      0,
      0,
      freeCaseActionQuote(state, floor, 0),
    );
    recalculateInvoice(state.invoice, state.config);
    expect(lineShort(line)).toMatchObject({ quantity: 24, total: "0.00" });
    expect(state.invoice.payable_after_open_shorts).toBe("30.00");
    const displayed = invoiceWorkspaceRead(state, floor).invoice;
    expect(invoiceDisplayShortTotals(displayed).total).toBe("0.00");
    expect(invoiceDisplayRefusedTotals(displayed).total).toBe("0.00");
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      1,
      24,
      24,
      freeCaseActionQuote(state, floor, 0),
    );
    expect(lineRefused(line)).toMatchObject({ quantity: 24, total: "0.00" });
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      0,
      0,
      0,
      freeCaseActionQuote(state, floor, 0),
    );
    expect(lineShort(line)).toMatchObject({ quantity: 24, total: "30.00" });
    const paidMissing = invoiceWorkspaceRead(state, floor).invoice;
    expect(invoiceDisplayShortTotals(paidMissing).total).toBe("30.00");
    expect(invoiceDisplayRefusedTotals(paidMissing).total).toBe("0.00");
  });

  it("later free delivery restores physical coverage once without another payable", async () => {
    const current = await prepare();
    answer(current, "bonus");
    const { state, owner, floor } = current;
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      1,
      0,
      0,
      freeCaseActionQuote(state, floor, 0),
    );
    recalculateInvoice(state.invoice, state.config);
    confirmInvoiceLineChecks(state, floor, 0);
    postInvoice(state, owner);
    expect(
      receiveShort(
        state,
        state.products[0].code,
        24,
        "FICTIONAL-FREE-DELIVERY",
        owner,
        0,
        1,
      ),
    ).toBe("0.00");
    const after = structuredClone(state.ledger);
    expect(
      receiveShort(
        state,
        state.products[0].code,
        24,
        "FICTIONAL-FREE-DELIVERY",
        owner,
        0,
        1,
      ),
    ).toBe("0.00");
    expect(state.ledger).toEqual(after);
    expect(state.invoice.lines[0].free_case_group!.allocation[1].later).toBe(
      24,
    );
    expect(validFreeCaseGroup(state.invoice.lines[0])).toBe(true);
  });

  it("keeps conflicting positive amounts, packs and unknown quantities separate", async () => {
    const { state } = await prepare();
    const group = state.invoice.lines[0].free_case_group!;
    const base = state.invoice.lines[0];
    const members = group.members.map((m) => ({
      ...structuredClone(base),
      free_case_group: undefined,
      id: m.id,
      qty_invoiced: m.qty,
      qty_received_at_posting: m.received,
      quantity_entered: m.quantity_entered,
      line_total: m.paper_amount,
      unit_cost_before_tax: m.unit_cost,
    }));
    members[1].line_total = "1.00";
    expect(groupInvoiceFreeCases(members)).toHaveLength(2);
    members[1].line_total = "0.00";
    members[1].units_per_case = 12;
    expect(groupInvoiceFreeCases(members)).toHaveLength(2);
    members[1].units_per_case = 24;
    members[1].qty_invoiced = 0;
    expect(groupInvoiceFreeCases(members)).toHaveLength(2);
  });

  it("groups a blank-cost candidate conservatively but refuses competing identifiers and ambiguous extras", async () => {
    const { state } = await prepare();
    const base = state.invoice.lines[0];
    const members = base.free_case_group!.members.map((member) => ({
      ...structuredClone(base),
      free_case_group: undefined,
      id: member.id,
      qty_invoiced: member.qty,
      qty_received_at_posting: member.received,
      quantity_entered: member.quantity_entered,
      line_total: member.paper_amount,
      unit_cost_before_tax: member.unit_cost,
      imported_unit_cost_basis: structuredClone(member.imported_cost_basis),
    }));
    members[1].unit_cost_before_tax = "";
    expect(groupInvoiceFreeCases(members)).toHaveLength(1);
    members[1].barcode = "fictional-other-product";
    expect(groupInvoiceFreeCases(members)).toHaveLength(2);
    members[1].barcode = members[0].barcode;
    members[1].tax_profile = "hst_13";
    expect(groupInvoiceFreeCases(members)).toHaveLength(2);
    members[1].tax_profile = members[0].tax_profile;
    expect(
      groupInvoiceFreeCases([
        ...members,
        { ...members[1], id: "fictional-third-member" },
      ]),
    ).toHaveLength(3);
    members[1].unit_cost_before_tax = "1.2500";
    members[1].line_total = "30.00";
    expect(groupInvoiceFreeCases(members)).toHaveLength(2);
  });

  it.each([false, true])(
    "both accepted printed aliases match the one approved Product on later AI reading (free alias %s)",
    async (useFreeAlias) => {
      const current = await prepare();
      answer(current, "bonus");
      const { state, floor, owner } = current;
      confirmInvoiceLineChecks(state, floor, 0);
      postInvoice(state, owner);
      resolveApproval(
        state,
        owner,
        state.approvals[0].id,
        "approve",
        "branch",
        "Branch 1",
      );
      const code = state.products[0].code;
      const exported = matchingReading(1);
      const entry = exported.invoices[0];
      entry.ai_reading!.lines![0].description = useFreeAlias
        ? "NORTHSTAR JAM 24 X 300G BONUS"
        : "NORTHSTAR JAM 24 X 300G";
      const pages = await prepareInvoiceReadingPages(
        exported,
        [entry.id],
        state.config.company.seed_key,
      );
      const result = importInvoiceReadings(state, owner, {
        exported,
        pages,
        selectedIds: [entry.id],
        locations: { [entry.id]: "Branch 1" },
        mode: "ai",
        fileName: "fictional-repeat-alias.json",
      });
      expect(result.imported).toHaveLength(1);
      selectInvoiceWorkspace(state, owner, result.imported[0]);
      expect(state.invoice.lines[0].product_code).toBe(code);
      expect(state.invoice.lines[0].known_delivery?.status).toBe("same");
      expect(state.products).toHaveLength(1);
    },
  );

  it("rejects stale answers and leaves genuine changes blocked instead of pinning source amount", async () => {
    const current = await prepare();
    const { state, floor } = current;
    const old = freeCaseActionQuote(state, floor, 0);
    answer(current, "bonus");
    const before = structuredClone(state.invoice);
    expect(() =>
      answerInvoiceFreeCases(state, floor, 0, "mistake", old),
    ).toThrow(/changed/);
    expect(state.invoice).toEqual(before);
    state.invoice.lines[0].unit_cost_before_tax = "2.0000";
    expect(validFreeCaseGroup(state.invoice.lines[0])).toBe(false);
    expect(() => confirmInvoiceLineChecks(state, floor, 0)).toThrow(
      /free-case/,
    );
    expect(new Decimal(invoiceLineAmount(state.invoice.lines[0]))).not.toEqual(
      new Decimal("30.00"),
    );
  });

  it("binds both answer and delivery commands to the actual person and session", async () => {
    const current = await prepare();
    const { state, floor, owner } = current;
    const quote = invoiceWorkspaceRead(state, floor).lineDetails[0]
      .freeCaseQuote!;
    const before = JSON.stringify(state);
    expect(() =>
      answerInvoiceFreeCases(state, owner, 0, "bonus", quote),
    ).toThrow(/changed/);
    expect(JSON.stringify(state)).toBe(before);
    answerInvoiceFreeCases(state, floor, 0, "bonus", quote);
    const deliveryQuote = freeCaseActionQuote(state, floor, 0);
    const answered = JSON.stringify(state);
    expect(() =>
      setFreeCaseMemberDelivery(state, owner, 0, 1, 0, 0, deliveryQuote),
    ).toThrow(/quantities/);
    expect(JSON.stringify(state)).toBe(answered);
    const nextSession = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    expect(() =>
      setFreeCaseMemberDelivery(state, nextSession, 0, 1, 0, 0, deliveryQuote),
    ).toThrow(/quantities/);
    expect(() =>
      setFreeCaseMemberDelivery(
        state,
        nextSession,
        0,
        1,
        0,
        0,
        freeCaseActionQuote(state, nextSession, 0),
      ),
    ).not.toThrow();
  });

  it.each(["file", "config", "line_id", "cancelled"] as const)(
    "rejects stale %s evidence atomically",
    async (change) => {
      const { state, floor } = await prepare();
      const quote = freeCaseActionQuote(state, floor, 0);
      if (change === "file")
        state.invoice.file_data = "data:image/png;base64,cmVwbGFjZWQ=";
      if (change === "config")
        state.config.company.name_en = "Fictional Changed Company";
      if (change === "line_id")
        state.invoice.lines[0].id = "fictional-replacement-line";
      if (change === "cancelled") state.invoice.status = "cancelled";
      const before = JSON.stringify(state);
      expect(() =>
        answerInvoiceFreeCases(state, floor, 0, "bonus", quote),
      ).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it.each(["barcode", "pack_size", "lot_number"] as const)(
    "does not re-prove conflicting %s through a fresh answer",
    async (field) => {
      const { state, floor } = await prepare();
      state.invoice.lines[0][field] =
        field === "pack_size" ? "24 × 900 g" : "fictional-conflict";
      const before = JSON.stringify(state);
      expect(() =>
        answerInvoiceFreeCases(
          state,
          floor,
          0,
          "bonus",
          freeCaseActionQuote(state, floor, 0),
        ),
      ).toThrow(/identity/);
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it.each(["tax_profile", "date_value", "lot_number", "pack_size"] as const)(
    "retires an answered group's changed %s basis",
    async (field) => {
      const current = await prepare();
      answer(current, "bonus");
      const line = current.state.invoice.lines[0];
      line[field] = "fictional-changed-basis";
      expect(validFreeCaseGroup(line)).toBe(false);
      expect(() =>
        confirmInvoiceLineChecks(current.state, current.floor, 0),
      ).toThrow(/free-case/);
    },
  );

  it("keeps receiving price attribution but requires revalidation after changing the free-case basis", async () => {
    const current = await prepare();
    answer(current, "bonus");
    const { state, floor } = current;
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "2.99",
      receivingPriceQuote(state, 0),
    );
    expect(receivingPriceProblem(state, 0)).toBe(false);
    answer(current, "two_for_one");
    expect(state.invoice.lines[0].receiving_price).toMatchObject({
      price: "2.99",
      set_by_user_id: floor.user_id,
    });
    expect(receivingPriceProblem(state, 0)).toBe(true);
  });

  it("reuses a compatible normalized catalog identity and blocks conflicting same-name reuse before posting", async () => {
    const current = await prepare();
    answer(current, "bonus");
    const { state, floor, owner } = current;
    confirmInvoiceLineChecks(state, floor, 0);
    postInvoice(state, owner);
    const product = structuredClone(state.products[0]);
    const next = await prepare();
    answer(next, "bonus");
    next.state.products.push({
      ...product,
      name_en: "  NORTHSTAR  JAM 300 g  ",
    });
    confirmInvoiceLineChecks(next.state, next.floor, 0);
    expect(invoiceBlockers(next.state, next.owner)).not.toContain("matching");
    const originalBarcode = next.state.invoice.lines[0].barcode;
    next.state.products[0].barcode = "fictional-other-barcode";
    next.state.invoice.lines[0].barcode = "fictional-printed-barcode";
    expect(invoiceBlockers(next.state, next.owner)).toContain("matching");
    const before = JSON.stringify(next.state);
    expect(() => postInvoice(next.state, next.owner)).toThrow("matching");
    expect(JSON.stringify(next.state)).toBe(before);
    next.state.products[0].barcode = product.barcode;
    next.state.invoice.lines[0].barcode = originalBarcode;
    expect(postInvoice(next.state, next.owner)).toBe(true);
    expect(next.state.products).toHaveLength(1);
    expect(next.state.invoice.lines[0].product_code).toBe(product.code);
  });

  it("denies unsupported grouped posted cost and date corrections without changing source evidence", async () => {
    const current = await prepare();
    answer(current, "bonus");
    const { state, floor, owner } = current;
    confirmInvoiceLineChecks(state, floor, 0);
    postInvoice(state, owner);
    for (const field of ["unit_cost_before_tax", "date_value"] as const) {
      const lines = structuredClone(state.invoice.lines);
      lines[0][field] = field === "date_value" ? "2027-12-01" : "3.0000";
      const before = JSON.stringify(state);
      expect(() =>
        invoiceContentCorrectionPreview(state, owner, state.invoice.id, {
          lines,
          reason: "Fictional grouped correction",
        }),
      ).toThrow(/grouped source/);
      expect(JSON.stringify(state)).toBe(before);
    }
  });
});
