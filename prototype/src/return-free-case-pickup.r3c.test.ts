import { describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  authoritySnapshot,
  bindAuthoritySnapshot,
  cloneWithAuthority,
} from "./authority";
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
import { invoiceBlockers, postInvoice, recalculateInvoice } from "./invoice";
import {
  answerInvoiceFreeCases,
  freeCaseActionQuote,
} from "./invoice-free-cases";
import { createReturn, returnCreateChoices } from "./return-create";
import {
  correctReturnPickup,
  postReturnClaim,
  recordPickup,
  submitFinancialClaim,
  type OperationalReturn,
} from "./operations";
import { pendingReturnCredits } from "./return-workflow";
import { returnOverviewCredits } from "./return-overview-credit";
import { signedReturnPickupQuantities } from "./signed-return-pickups";

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

async function postedReturn(choice: "bonus" | "two_for_one" = "bonus") {
  const state = matchingBusiness();
  state.returns = [];
  const manager = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  const exported = matchingReading(0);
  const source = exported.invoices[0];
  Object.assign(source.ai_reading!, {
    subtotal: "0.02",
    tax: "0.00",
    final_total: "0.02",
  });
  const paid = source.ai_reading!.lines![0];
  Object.assign(paid, {
    description: "FICTIONAL ORCHARD JAM 300G",
    quantity: "1",
    unit: "units",
    units_per_case: "1",
    pack_size: "1 × 300 g",
    unit_cost_before_tax: "0.0200",
    cost_per_unit_before_tax: "0.0200",
    cost_per_case_before_tax: "0.0200",
    line_total: "0.02",
  });
  source.ai_reading!.lines!.push({
    ...paid,
    description: "FICTIONAL ORCHARD JAM 300G BONUS",
    quantity: "2",
    unit_cost_before_tax: "0.0000",
    cost_per_unit_before_tax: "0.0000",
    cost_per_case_before_tax: "0.0000",
    line_total: "0.00",
  });
  source.checked_answer = {
    lines: [
      { description: "Fictional Orchard Jam 300 g" },
      { description: "Fictional Orchard Jam 300 g" },
    ],
  };
  const pages = await prepareInvoiceReadingPages(
    exported,
    [source.id],
    state.config.company.seed_key,
  );
  const imported = importInvoiceReadings(state, manager, {
    exported,
    pages,
    selectedIds: [source.id],
    locations: { [source.id]: "Branch 1" },
    mode: "checked",
    fileName: "fictional-composed-acquisition-pickup.json",
  });
  expect(imported.imported).toHaveLength(1);
  selectInvoiceWorkspace(state, manager, imported.imported[0]);
  expect(state.invoice.lines).toHaveLength(1);
  const line = state.invoice.lines[0];
  setInvoiceLineCategory(line, "grocery", state.config);
  const worker = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Fictional Combined Receiver",
  });
  state.invoice.handler_user_ids = [worker.user_id];
  answerInvoiceFreeCases(
    state,
    worker,
    0,
    choice,
    freeCaseActionQuote(state, worker, 0),
  );
  recalculateInvoice(state.invoice, state.config);
  confirmInvoiceLineChecks(state, worker, 0);
  expect(invoiceBlockers(state, manager)).toEqual([]);
  expect(postInvoice(state, manager)).toBe(true);
  const original = structuredClone(state.invoice.original_pages);
  const retainedInvoice = structuredClone(state.invoice);
  const product = returnCreateChoices(state, manager, "Branch 1").products[0];
  const id = createReturn(state, manager, {
    request_id: "fictional-composed-return",
    branch: "Branch 1",
    supplier_id: product.supplier_id,
    product_code: product.product_code,
    source_fingerprint: product.source_fingerprint,
    quantity: "3",
    quantity_unit: "units",
    reason: "wrong_item",
    note: "Fictional counted paid/free return",
    photos: [],
  });
  const record = state.returns.find(
    (item) => item.id === id,
  )! as OperationalReturn;
  const read = () =>
    returnOverviewCredits(state, manager).find((item) => item.return_id === id)!
      .amount;
  const pending = () =>
    Decimal.sum(
      0,
      ...pendingReturnCredits(state, manager).map((item) => item.amount),
    ).toFixed(2);
  const pickup = (sequence: number, quantity: number) => ({
    request_id: `fictional-composed-pickup-${sequence}`,
    quantities: { [line.product_code]: quantity },
    representative: "Fictional Orchard Driver",
    slip: "",
    shortfalls: {
      [line.product_code]: {
        reason: "Fictional uncollected remainder",
        outcome: "keep_for_next_pickup" as const,
      },
    },
  });
  return {
    state,
    manager,
    worker,
    line,
    id,
    record,
    read,
    pending,
    pickup,
    original,
    retainedInvoice,
  };
}

describe("R3c K8/K9 counted acquisition and optional pickup evidence", () => {
  it.each(["bonus", "two_for_one"] as const)(
    "%s conserves two paper cents through blank-reference pickups, correction, replay and real credit",
    async (choice) => {
      const current = await postedReturn(choice);
      const {
        state,
        manager,
        worker,
        line,
        id,
        record,
        read,
        pending,
        pickup,
      } = current;
      const code = line.product_code;
      const ledger = structuredClone(state.ledger);
      const physical = structuredClone(state.stock_movements);
      expect(line.unit_cost_before_tax).toBe(
        choice === "bonus" ? "0.0200" : "0.0067",
      );
      expect(record.lines[0]).toMatchObject({
        qty: 3,
        unit_cost: "0.0067",
        acquisition_basis: {
          source_amount: "0.02",
          source_quantity: 3,
          amount: "0.02",
          quantity: 3,
        },
      });
      expect(read()).toBe("0.02");
      recordPickup(state, worker, id, pickup(1, 1));
      const second = pickup(2, 2);
      recordPickup(state, worker, id, second);
      expect(record.pickup_memos!.map((memo) => memo.expected_credit)).toEqual([
        "0.01",
        "0.01",
      ]);
      const original = structuredClone(record.pickup_memos!.at(-1)!);
      expect(original).toMatchObject({
        pickup_request_id: second.request_id,
        signed_evidence_reference: "",
        lines: [{ acquisition_basis: { offset: 1 } }],
      });
      correctReturnPickup(state, manager, id, {
        memo_id: original.id,
        quantities: { [code]: 1 },
        reason: "Fictional driver collected one of the final two units",
        shortfalls: {
          [code]: {
            reason: "One unit remains for the next pickup",
            outcome: "keep_for_next_pickup",
          },
        },
      });
      expect(record.pickup_memos![1]).toEqual(original);
      expect(record.pickup_memos!.at(-1)).toMatchObject({
        correction_of: original.id,
        pickup_request_id: second.request_id,
        signed_evidence_reference: "",
        expected_credit: "0.00",
        lines: [{ quantity: 1, acquisition_basis: { offset: 1 } }],
      });
      expect(signedReturnPickupQuantities(record).get(code)).toBe(2);
      expect(pending()).toBe("0.01");
      // Overview also retains the final unpicked cent from the acquisition.
      expect(read()).toBe("0.02");
      const corrected = JSON.stringify(state);
      recordPickup(state, worker, id, second);
      expect(JSON.stringify(state)).toBe(corrected);
      expect(record.lines[0].picked_up).toBe(2);
      recordPickup(state, worker, id, pickup(3, 1));
      expect(record.pickup_memos!.at(-1)).toMatchObject({
        pickup_request_id: "fictional-composed-pickup-3",
        expected_credit: "0.01",
        lines: [{ quantity: 1, acquisition_basis: { offset: 2 } }],
      });
      expect(signedReturnPickupQuantities(record).get(code)).toBe(3);
      expect(pending()).toBe("0.02");
      expect(read()).toBe("0.02");
      expect(state.ledger).toEqual(ledger);
      expect(state.stock_movements).toEqual(physical);
      expect(state.invoice.original_pages).toEqual(current.original);
      expect(state.invoice).toEqual(current.retainedInvoice);
      submitFinancialClaim(state, worker, id, {
        type: "credit_current_invoice",
        covers: { [code]: 1 },
        document: "FICTIONAL-COMBINED-CENT-CREDIT",
        invoice_id: state.invoice.id,
      });
      expect(pending()).toBe("0.02");
      expect(read()).toBe("0.02");
      expect(state.ledger).toEqual(ledger);
      postReturnClaim(state, manager, id, record.claims![0].id, "0.01");
      expect(pending()).toBe("0.01");
      expect(read()).toBe("0.01");
      expect(
        state.ledger.filter((item) => item.type === "credit"),
      ).toMatchObject([{ amount: "-0.01", currency: "CAD" }]);
      const settled = JSON.stringify(state);
      recordPickup(state, worker, id, second);
      expect(JSON.stringify(state)).toBe(settled);
    },
  );

  it("denies altered blank-reference proof and rechecks actual authority before accepted replay", async () => {
    const { state, manager, worker, line, id, record, pickup } =
      await postedReturn();
    const input = pickup(1, 3);
    recordPickup(state, worker, id, input);
    for (const corruption of ["request", "actor", "quantity"] as const) {
      const broken = cloneWithAuthority(state);
      const target = broken.returns.find(
        (item) => item.id === id,
      )! as OperationalReturn;
      const event = target.evidence!.find((item) => item.kind === "pickup")!;
      if (corruption === "request")
        target.pickup_memos![0].pickup_request_id = "fictional-copied-request";
      if (corruption === "actor") event.actor_user_id = manager.user_id;
      if (corruption === "quantity") event.quantities![line.product_code] = 2;
      expect(signedReturnPickupQuantities(target).get(line.product_code)).toBe(
        undefined,
      );
      expect(
        returnOverviewCredits(broken, manager).find(
          (item) => item.return_id === id,
        )?.amount,
      ).toBeNull();
      const before = JSON.stringify(broken);
      expect(() =>
        submitFinancialClaim(broken, worker, id, {
          type: "credit_current_invoice",
          covers: { [line.product_code]: 1 },
          document: "FICTIONAL-DENIED-COPIED-CREDIT",
          invoice_id: state.invoice.id,
        }),
      ).toThrow("pickup_required");
      expect(JSON.stringify(broken)).toBe(before);
    }
    const before = JSON.stringify(state);
    expect(() => recordPickup(state, manager, id, input)).toThrow(
      "duplicate_document",
    );
    expect(() =>
      recordPickup(state, worker, id, {
        ...input,
        representative: "Fictional different driver",
      }),
    ).toThrow("duplicate_document");
    expect(JSON.stringify(state)).toBe(before);
    const snapshot = structuredClone(authoritySnapshot(state));
    snapshot.people = snapshot.people.map((person) =>
      person.id === worker.user_id
        ? { ...person, authority_epoch: person.authority_epoch + 1 }
        : person,
    );
    bindAuthoritySnapshot(state, snapshot);
    expect(() => recordPickup(state, worker, id, input)).toThrow("scope");
    expect(JSON.stringify(state)).toBe(before);
    expect(record.lines[0].picked_up).toBe(3);
  });
});
