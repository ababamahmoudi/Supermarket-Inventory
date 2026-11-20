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
} from "./invoice-readings";
import { selectInvoiceWorkspace } from "./invoice-workspace-read";
import {
  confirmInvoiceLineChecks,
  setInvoiceLineCategory,
} from "./invoice-checks";
import {
  invoiceBlockers,
  postInvoice,
  receiveShort,
  recalculateInvoice,
  shortTotals,
} from "./invoice";
import {
  answerInvoiceFreeCases,
  freeCaseActionQuote,
  setFreeCaseMemberDelivery,
  type FreeCaseChoice,
} from "./invoice-free-cases";
import { invoiceFreeAcquisition } from "./invoice-free-acquisition";
import {
  createReturn,
  returnCreateChoices,
  type CreateReturnInput,
} from "./return-create";
import {
  cancelReturn,
  correctReturnPickup,
  recordPickup,
  submitFinancialClaim,
  postReturnClaim,
  type OperationalReturn,
} from "./operations";
import { awaitingPickupReturnCredits } from "./return-credit-preview";
import { pendingReturnCredits } from "./return-workflow";
import { returnOverviewCredits } from "./return-overview-credit";
import { returnView } from "./return-projections";
import { receiptLots } from "./receipt-lots";
import { projectPurchaseOperational } from "./purchase-projections";

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

async function prepare(
  choice: FreeCaseChoice = "bonus",
  amount = "0.02",
  paid = 1,
  free = 2,
  tax = "0.00",
) {
  const state = matchingBusiness();
  state.returns = [];
  const actor = authenticatedTestActor(state, "owner", {
    locations: ["Branch 1"],
  });
  const exported = matchingReading(0);
  const entry = exported.invoices[0];
  Object.assign(entry.ai_reading!, {
    subtotal: amount,
    tax,
    final_total: new Decimal(amount).plus(tax).toFixed(2),
  });
  const item = entry.ai_reading!.lines![0];
  Object.assign(item, {
    description: "MEADOW JAM 300G",
    quantity: String(paid),
    unit: "units",
    units_per_case: "1",
    pack_size: "1 × 300 g",
    unit_cost_before_tax: new Decimal(amount).div(paid).toFixed(4),
    cost_per_unit_before_tax: new Decimal(amount).div(paid).toFixed(4),
    cost_per_case_before_tax: new Decimal(amount).div(paid).toFixed(4),
    cost_basis: "each",
    line_total: amount,
    taxable: new Decimal(tax).gt(0),
  });
  if (new Decimal(tax).gt(0)) {
    const rate = new Decimal(tax).div(amount).toString();
    state.config.tax.rate = rate;
    for (const profile of state.config.tax.profiles)
      if (new Decimal(profile.rate).gt(0)) profile.rate = rate;
  }
  entry.ai_reading!.lines!.push({
    ...item,
    description: "MEADOW JAM 300G BONUS",
    quantity: String(free),
    unit_cost_before_tax: "0.0000",
    cost_per_unit_before_tax: "0.0000",
    cost_per_case_before_tax: "0.0000",
    line_total: "0.00",
  });
  entry.checked_answer = {
    lines: [
      { description: "Meadow Jam 300 g" },
      { description: "Meadow Jam 300 g" },
    ],
  };
  const pages = await prepareInvoiceReadingPages(
    exported,
    [entry.id],
    state.config.company.seed_key,
  );
  const imported = importInvoiceReadings(state, actor, {
    exported,
    pages,
    selectedIds: [entry.id],
    locations: { [entry.id]: "Branch 1" },
    mode: "checked",
    fileName: "fictional-acquisition.json",
  });
  selectInvoiceWorkspace(state, actor, imported.imported[0]);
  expect(state.invoice.lines).toHaveLength(1);
  const line = state.invoice.lines[0];
  setInvoiceLineCategory(line, "grocery", state.config);
  line.date_tracking = true;
  line.date_type = "best_before";
  line.date_value = "2027-06-30";
  const floor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Fictional Acquisition Receiver",
  });
  state.invoice.handler_user_ids = [floor.user_id];
  answerInvoiceFreeCases(
    state,
    floor,
    0,
    choice,
    freeCaseActionQuote(state, floor, 0),
  );
  recalculateInvoice(state.invoice, state.config);
  return { state, actor, floor, line };
}
type Current = Awaited<ReturnType<typeof prepare>>;
function post(current: Current) {
  confirmInvoiceLineChecks(current.state, current.floor, 0);
  expect(invoiceBlockers(current.state, current.actor)).toEqual([]);
  expect(postInvoice(current.state, current.actor)).toBe(true);
}
function input(
  current: Current,
  quantity: number,
  sequence = 1,
): CreateReturnInput {
  const choice = returnCreateChoices(current.state, current.actor, "Branch 1")
    .products[0];
  expect(choice).toBeTruthy();
  return {
    request_id: `fictional-acquisition-return-${sequence}`,
    branch: "Branch 1",
    supplier_id: choice.supplier_id,
    product_code: choice.product_code,
    source_fingerprint: choice.source_fingerprint,
    quantity: String(quantity),
    quantity_unit: "units",
    reason: "wrong_item",
    note: "Fictional grouped source return",
    photos: [],
  };
}
function pickup(current: Current, id: string, quantity: number, sequence = 1) {
  recordPickup(current.state, current.floor, id, {
    quantities: { [current.line.product_code]: quantity },
    shortfalls: {
      [current.line.product_code]: {
        reason: "Fictional later collection",
        outcome: "keep_for_next_pickup",
      },
    },
    representative: "Fictional Driver",
    slip: `FICTIONAL-ACQUISITION-PICKUP-${sequence}`,
  });
}
const sum = (values: string[]) => Decimal.sum(0, ...values).toFixed(2);

describe("R3c K8 exact acquisition and return coverage", () => {
  it.each(["bonus", "two_for_one", "mistake"] as const)(
    "%s preserves actual acquired money independently of pricing and original paper",
    async (choice) => {
      const current = await prepare(choice);
      const { state, line, actor } = current;
      const originals = structuredClone(state.invoice.original_pages);
      post(current);
      expect(line.unit_cost_before_tax).toBe(
        choice === "two_for_one" ? "0.0067" : "0.0200",
      );
      expect(invoiceFreeAcquisition(line)).toEqual({
        amount: "0.02",
        quantity: choice === "mistake" ? 1 : 3,
        unit_cost: choice === "mistake" ? "0.0200" : "0.0067",
      });
      expect(state.invoice.final_total).toBe("0.02");
      const lot = receiptLots(state).find(
        (item) => item.product_code === line.product_code,
      )!;
      expect(lot.unit_cost).toBe(choice === "mistake" ? "0.0200" : "0.0067");
      expect(lot.source_receipts[0].acquisition_amount).toBe("0.02");
      const id = createReturn(
        state,
        actor,
        input(current, choice === "mistake" ? 1 : 3),
      );
      expect(awaitingPickupReturnCredits(state, actor)).toMatchObject([
        { return_id: id, amount: "0.02" },
      ]);
      pickup(current, id, choice === "mistake" ? 1 : 3);
      expect(state.returns[0].pickup_memos![0].expected_credit).toBe("0.02");
      expect(returnOverviewCredits(state, actor)).toMatchObject([
        { return_id: id, amount: "0.02" },
      ]);
      expect(state.invoice.original_pages).toEqual(originals);
      expect(state.products).toHaveLength(1);
      expect(
        state.ledger.filter((entry) => entry.type === "invoice"),
      ).toHaveLength(1);
    },
  );

  it("three separate one-unit claims cannot turn two paper cents into three", async () => {
    const current = await prepare();
    post(current);
    const { state, actor } = current;
    const inputs = [1, 2, 3].map((sequence) => input(current, 1, sequence));
    const ids = inputs.map((value) => createReturn(state, actor, value));
    expect(
      sum(
        state.returns.map(
          (record) => record.lines[0].acquisition_basis!.amount,
        ),
      ),
    ).toBe("0.02");
    const unchanged = JSON.stringify(state);
    expect(createReturn(state, actor, inputs[0])).toBe(ids[0]);
    expect(JSON.stringify(state)).toBe(unchanged);
    expect(() => createReturn(state, actor, input(current, 1, 4))).toThrow(
      "quantity",
    );
    expect(JSON.stringify(state)).toBe(unchanged);
    ids.forEach((id, index) => pickup(current, id, 1, index + 1));
    expect(
      sum(
        state.returns.flatMap((record) =>
          record.pickup_memos!.map((memo) => memo.expected_credit),
        ),
      ),
    ).toBe("0.02");
    expect(
      sum(pendingReturnCredits(state, actor).map((row) => row.amount)),
    ).toBe("0.02");
  });

  it("split pickups and a corrected final pickup retain exact cumulative cents", async () => {
    const current = await prepare();
    post(current);
    const { state, actor, line } = current;
    const id = createReturn(state, actor, input(current, 3));
    pickup(current, id, 1, 1);
    pickup(current, id, 1, 2);
    pickup(current, id, 1, 3);
    const record = state.returns[0];
    expect(record.pickup_memos!.map((memo) => memo.expected_credit)).toEqual([
      "0.01",
      "0.00",
      "0.01",
    ]);
    expect(
      sum(pendingReturnCredits(state, actor).map((row) => row.amount)),
    ).toBe("0.02");
    correctReturnPickup(state, actor, id, {
      memo_id: record.pickup_memos!.at(-1)!.id,
      quantities: { [line.product_code]: 0 },
      reason: "Fictional correction",
      shortfalls: {
        [line.product_code]: {
          reason: "Fictional driver left one",
          outcome: "keep_for_next_pickup",
        },
      },
    });
    expect(record.pickup_memos!.at(-1)!.expected_credit).toBe("0.00");
    expect(
      sum(pendingReturnCredits(state, actor).map((row) => row.amount)),
    ).toBe("0.01");
    expect(returnOverviewCredits(state, actor)).toMatchObject([
      { return_id: id, amount: "0.02" },
    ]);
    pickup(current, id, 1, 4);
    expect(
      sum(pendingReturnCredits(state, actor).map((row) => row.amount)),
    ).toBe("0.02");
  });

  it("actual partial settlement consumes the correct pickup cents once", async () => {
    const current = await prepare();
    post(current);
    const { state, actor, floor, line } = current;
    const id = createReturn(state, actor, input(current, 3));
    pickup(current, id, 3);
    submitFinancialClaim(state, floor, id, {
      type: "credit_current_invoice",
      covers: { [line.product_code]: 1 },
      invoice_id: state.invoice.id,
      document: "FICTIONAL-TWO-CENT-CREDIT",
    });
    const record = state.returns[0] as OperationalReturn;
    postReturnClaim(state, actor, id, record.claims![0].id, "0.01");
    expect(
      sum(pendingReturnCredits(state, actor).map((row) => row.amount)),
    ).toBe("0.01");
    expect(returnOverviewCredits(state, actor)).toMatchObject([
      { return_id: id, amount: "0.01" },
    ]);
    expect(
      state.ledger.filter((entry) => entry.type === "credit"),
    ).toHaveLength(1);
  });

  it("cancellation releases only physically recovered unspent source coverage", async () => {
    const current = await prepare();
    post(current);
    const { state, actor, floor, line } = current;
    const id = createReturn(state, actor, input(current, 3));
    cancelReturn(state, floor, id, {
      reason: "Fictional safe recovery",
      dispositions: { [line.product_code]: "recovered_sellable" },
      recovered: { [line.product_code]: 3 },
      safe: true,
    });
    expect(state.returns[0].status).toBe("cancelled");
    const second = createReturn(state, actor, input(current, 3, 2));
    expect(
      state.returns.find((record) => record.id === second)!.lines[0]
        .acquisition_basis!.amount,
    ).toBe("0.02");
    pickup(current, second, 3);
    cancelReturn(state, floor, second, {
      reason: "Fictional supplier still holds all",
      dispositions: { [line.product_code]: "supplier_held" },
      recovered: { [line.product_code]: 0 },
      safe: false,
    });
    const before = JSON.stringify(state);
    expect(() => createReturn(state, actor, input(current, 1, 3))).toThrow(
      "quantity",
    );
    expect(JSON.stringify(state)).toBe(before);
    expect(pendingReturnCredits(state, actor)).toEqual([]);
  });

  it("member-specific paid/free shortages, refusal and later receipts allocate actual acquired money", async () => {
    const current = await prepare("bonus", "30.00", 2, 2);
    const { state, floor, line, actor } = current;
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      0,
      1,
      0,
      freeCaseActionQuote(state, floor, 0),
    );
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      1,
      2,
      1,
      freeCaseActionQuote(state, floor, 0),
    );
    recalculateInvoice(state.invoice, state.config);
    expect(invoiceFreeAcquisition(line)).toEqual({
      amount: "15.00",
      quantity: 2,
      unit_cost: "7.5000",
    });
    post(current);
    const first = createReturn(state, actor, input(current, 2));
    expect(
      state.returns.find((record) => record.id === first)!.lines[0]
        .acquisition_basis!.amount,
    ).toBe("15.00");
    expect(
      receiveShort(
        state,
        line.product_code,
        1,
        "FICTIONAL-PAID-LATER",
        actor,
        0,
        0,
      ),
    ).toBe("15.00");
    expect(invoiceFreeAcquisition(line)).toEqual({
      amount: "30.00",
      quantity: 3,
      unit_cost: "10.0000",
    });
    const second = createReturn(state, actor, input(current, 1, 2));
    expect(
      state.returns.find((record) => record.id === second)!.lines[0]
        .acquisition_basis!.amount,
    ).toBe("15.00");
    pickup(current, first, 2);
    pickup(current, second, 1, 2);
    expect(
      sum(pendingReturnCredits(state, actor).map((row) => row.amount)),
    ).toBe("30.00");
  });

  it("free-first later deliveries restore only the paid member's payable cents", async () => {
    const current = await prepare("bonus", "30.00", 2, 2);
    const { state, floor, line, actor } = current;
    for (const member of [0, 1])
      setFreeCaseMemberDelivery(
        state,
        floor,
        0,
        member,
        0,
        0,
        freeCaseActionQuote(state, floor, 0),
      );
    recalculateInvoice(state.invoice, state.config);
    post(current);
    expect(state.invoice.payable_after_open_shorts).toBe("0.00");
    expect(
      receiveShort(state, line.product_code, 2, "FREE-FIRST", actor, 0, 1),
    ).toBe("0.00");
    expect(shortTotals(state.invoice).total).toBe("30.00");
    expect(state.invoice.payable_after_open_shorts).toBe("0.00");
    expect(
      receiveShort(state, line.product_code, 1, "FREE-FIRST", actor, 0, 0),
    ).toBe("15.00");
    expect(shortTotals(state.invoice).total).toBe("15.00");
    expect(state.invoice.payable_after_open_shorts).toBe("15.00");
    expect(invoiceFreeAcquisition(line)).toMatchObject({
      amount: "15.00",
      quantity: 3,
    });
    expect(
      receiveShort(state, line.product_code, 1, "PAID-TWO", actor, 0, 0),
    ).toBe("15.00");
    expect(shortTotals(state.invoice).total).toBe("0.00");
    expect(state.invoice.payable_after_open_shorts).toBe("30.00");
    expect(
      sum(
        state.ledger
          .filter((entry) => entry.type === "short_restoration")
          .map((entry) => entry.amount),
      ),
    ).toBe("30.00");
    const unchanged = JSON.stringify(state);
    expect(
      receiveShort(state, line.product_code, 1, "PAID-TWO", actor, 0, 0),
    ).toBe("0.00");
    expect(JSON.stringify(state)).toBe(unchanged);
  });

  it("mixed missing and refused thirds conserve paid amount and tax cents through later delivery", async () => {
    const current = await prepare("bonus", "0.02", 3, 3, "0.01");
    const { state, floor, line, actor } = current;
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      0,
      1,
      1,
      freeCaseActionQuote(state, floor, 0),
    );
    setFreeCaseMemberDelivery(
      state,
      floor,
      0,
      1,
      1,
      0,
      freeCaseActionQuote(state, floor, 0),
    );
    recalculateInvoice(state.invoice, state.config);
    post(current);
    expect(state.invoice.payable_after_open_shorts).toBe("0.00");
    expect(
      receiveShort(
        state,
        line.product_code,
        2,
        "FICTIONAL-TAX-FREE",
        actor,
        0,
        1,
      ),
    ).toBe("0.00");
    expect(state.invoice.payable_after_open_shorts).toBe("0.00");
    expect(
      receiveShort(
        state,
        line.product_code,
        1,
        "FICTIONAL-TAX-PAID-1",
        actor,
        0,
        0,
      ),
    ).toBe("0.01");
    expect(state.invoice.payable_after_open_shorts).toBe("0.01");
    expect(
      receiveShort(
        state,
        line.product_code,
        1,
        "FICTIONAL-TAX-PAID-2",
        actor,
        0,
        0,
      ),
    ).toBe("0.01");
    expect(state.invoice.payable_after_open_shorts).toBe("0.02");
    expect(invoiceFreeAcquisition(line)).toMatchObject({
      amount: "0.01",
      quantity: 5,
    });
    expect(
      sum(
        state.ledger
          .filter((entry) => entry.type === "short_restoration")
          .map((entry) => entry.amount),
      ),
    ).toBe("0.02");
  });

  it("source coverage stays company scoped and private acquisition evidence is omitted from operational reads", async () => {
    const current = await prepare();
    post(current);
    const { state, actor, floor } = current;
    const id = createReturn(state, actor, input(current, 1));
    const projected = returnView(state, floor, id);
    expect(JSON.stringify(projected)).not.toMatch(
      /acquisition_basis|source_key|source_amount|source_quantity|source_receipt/,
    );
    const purchase = projectPurchaseOperational(state, floor);
    expect(JSON.stringify(purchase.receipt_lots)).not.toMatch(
      /acquisition_amount|unit_cost/,
    );
    const foreign = structuredClone(state.returns[0]);
    foreign.id = "fictional-other-company-claim";
    foreign.company_id = "fictional-other-company";
    state.returns = [foreign];
    expect(() =>
      createReturn(state, actor, input(current, 3, 2)),
    ).not.toThrow();
    const before = JSON.stringify(state);
    const ordinary = state.invoice.lines[0];
    ordinary.unit_cost_before_tax = "1.0000";
    expect(() => invoiceFreeAcquisition(ordinary)).toThrow(/free-case/);
    ordinary.unit_cost_before_tax = "0.0200";
    expect(JSON.stringify(state)).toBe(before);
  });
});
