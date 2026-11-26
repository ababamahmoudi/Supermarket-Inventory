import { describe, expect, it } from "vitest";
import { receivedDeliveryCount } from "./dashboard-data";
import { receivedLog, type DeliveryReceipt } from "./received";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import { recordPickup, receiveReplacement } from "./operations";

const receipt = (edits: Partial<DeliveryReceipt> = {}): DeliveryReceipt => ({
  id: "fictional-receipt-a",
  invoice_id: "fictional-invoice-a",
  line_index: 0,
  company_id: "fictional-company",
  branch: "fictional-store-a",
  product_code: "0001",
  supplier: "Fictional Meadow Supplier",
  invoice_number: "FICTIONAL-01",
  date: "2026-10-27",
  received_at: "2026-10-27T14:00:00Z",
  received_by: "Fictional Receiver",
  units: 6,
  units_per_case: 6,
  cases: "1",
  kind: "invoice",
  ...edits,
});

describe("R2f D7 received delivery count", () => {
  it("counts one multi-product receipt once, retaining later short and replacement deliveries", () => {
    expect(
      receivedDeliveryCount([
        receipt(),
        receipt({
          id: "fictional-receipt-b",
          line_index: 1,
          product_code: "0002",
        }),
        receipt({
          id: "fictional-short-a",
          kind: "short_delivery",
          received_at: "2026-10-27T17:00:00Z",
        }),
        receipt({
          id: "fictional-replacement-a",
          kind: "replacement",
          return_id: "fictional-return-a",
        }),
      ]),
    ).toBe(3);
  });
  it("does not merge distinct companies, locations, source documents or unknown legacy receipts", () => {
    expect(
      receivedDeliveryCount([
        receipt(),
        receipt({ company_id: "fictional-other-company" }),
        receipt({ branch: "fictional-store-b" }),
        receipt({ invoice_id: "fictional-invoice-b" }),
        receipt({ id: "fictional-legacy-a", invoice_id: "" }),
        receipt({ id: "fictional-legacy-b", invoice_id: "" }),
      ]),
    ).toBe(6);
    expect(receivedDeliveryCount([])).toBe(0);
  });
  it("retains two genuine replacement receipts for the same return on the same day", () => {
    const state = initialState();
    const manager = authenticatedTestActor(state, "manager", {
      selection: { kind: "location", location_id: "Branch 1" },
    });
    const record = state.returns[0];
    recordPickup(state, manager, record.id, {
      quantities: { "0003": 3 },
      representative: "Fictional Representative",
      slip: "FICTIONAL-PICKUP-D7",
    });
    for (const document of [
      "FICTIONAL-REPLACEMENT-D7-A",
      "FICTIONAL-REPLACEMENT-D7-B",
    ]) {
      receiveReplacement(state, manager, record.id, {
        product_code: "0002",
        qty: 1,
        covers: { "0003": 1 },
        date: "2026-10-27",
        representative: "Fictional Representative",
        receipt: document,
      });
    }
    const rows = receivedLog(state, manager).filter(
      (row) => row.kind === "replacement" && row.return_id === record.id,
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.date)).size).toBe(1);
    expect(rows.every((row) => !row.received_at)).toBe(true);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
    expect(receivedDeliveryCount(rows)).toBe(2);
  });
});
