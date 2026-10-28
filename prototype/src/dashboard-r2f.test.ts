import { describe, expect, it } from "vitest";
import { receivedDeliveryCount } from "./dashboard-data";
import type { DeliveryReceipt } from "./received";

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
        receipt({
          id: "fictional-replacement-b",
          kind: "replacement",
          return_id: "fictional-return-a",
          line_index: 1,
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
});
