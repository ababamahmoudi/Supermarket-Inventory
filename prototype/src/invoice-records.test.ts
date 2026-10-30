import { describe, expect, it } from "vitest";
import { invoiceListStage, invoiceRecords } from "./invoice-records";
import type { DemoInvoice } from "./types";

describe("invoice list records", () => {
  it("includes a workspace-only invoice and prefers it over stale saved copies", () => {
    const saved: Pick<DemoInvoice, "id" | "company_id" | "status"> = {
      id: "fictional-invoice",
      company_id: "company",
      status: "review" as const,
    };
    const workspace = { ...saved, status: "posted" as const };
    const records = invoiceRecords(
      { invoice: workspace, invoices: [saved, saved] },
      "company",
    );
    expect(records).toEqual([workspace]);
    expect(
      invoiceRecords({ invoice: workspace, invoices: [] }, "company"),
    ).toEqual([workspace]);
    expect(
      records.filter((invoice) => invoiceListStage(invoice, {}) === "posted"),
    ).toEqual([workspace]);
  });

  it("filters company before de-duplication and accepts a denied null workspace", () => {
    const own = { id: "shared-id", company_id: "own" };
    const foreign = { id: "shared-id", company_id: "foreign" };
    expect(
      invoiceRecords({ invoice: foreign, invoices: [own, foreign] }, "own"),
    ).toEqual([own]);
    expect(
      invoiceRecords({ invoice: null, invoices: [own, foreign] }, "own"),
    ).toEqual([own]);
  });

  it("uses open blockers consistently and never counts a blank workspace as a draft", () => {
    const review = { id: "review", status: "review" as const };
    expect(invoiceListStage(review, {})).toBe("needs_review");
    expect(invoiceListStage(review, { review: ["checks"] })).toBe(
      "needs_review",
    );
    expect(invoiceListStage(review, { review: [] })).toBe("ready_to_post");
    expect(invoiceListStage({ id: "blank", status: "empty" }, {})).toBeNull();
    expect(
      invoiceListStage(
        { id: "retained", status: "empty", original_available: true },
        {},
      ),
    ).toBe("drafts");
  });
});
