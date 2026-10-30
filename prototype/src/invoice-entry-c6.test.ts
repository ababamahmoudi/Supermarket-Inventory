import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  companyDateTime,
  companyLocalToUtc,
  CompanyLocalTimeError,
  companyTimestampText,
} from "./company-time";
import {
  invoiceTotalDiffers,
  setInvoiceAmount,
  setInvoicePaymentTerms,
  refreshInvoiceDueDate,
} from "./invoice-entry";
import {
  addManualLine,
  createInvoice,
  invoiceBlockers,
  markInvoiceSupplierReview,
  confirmInvoiceSupplierReview,
  removeInvoiceLine,
  recalculateInvoice,
} from "./invoice";
import { saveSupplier, confirmSupplier } from "./supplier-editor";
import { attachReversals, reverseActivity } from "./history";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";

function fixture() {
  const state = initialState();
  const actor = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
    name_en: "Reviewing Manager",
  });
  state.invoice = createInvoice(state, actor, "Branch 1", true);
  state.invoice.invoice_date = "2026-10-10";
  state.invoice.received_at = "2026-10-11T00:10:00.000Z";
  return { state, actor };
}

describe("configured local invoice time", () => {
  it.each([
    ["2026-10-10", "20:10", "2026-10-11T00:10:00.000Z"],
    ["2026-01-10", "20:10", "2026-01-11T01:10:00.000Z"],
    ["2026-03-08", "03:15", "2026-03-08T07:15:00.000Z"],
  ])(
    "round-trips Toronto %s %s instead of displaying the UTC day",
    (date, time, utc) => {
      const { state } = fixture();
      expect(companyLocalToUtc(state.config, date, time)).toBe(utc);
      expect(companyDateTime(state.config, utc)).toEqual({ date, time });
      expect(companyTimestampText(state.config, utc)).toBe(`${date} ${time}`);
    },
  );
  it("rejects the spring DST gap rather than inventing an instant", () => {
    const { state } = fixture();
    expect(() =>
      companyLocalToUtc(state.config, "2026-03-08", "02:30"),
    ).toThrow(CompanyLocalTimeError);
  });
  it("uses the earlier repeated hour and preserves an existing later occurrence", () => {
    const { state } = fixture();
    expect(companyLocalToUtc(state.config, "2026-11-01", "01:30")).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(
      companyLocalToUtc(
        state.config,
        "2026-11-01",
        "01:30",
        "2026-11-01T06:30:00.000Z",
      ),
    ).toBe("2026-11-01T06:30:00.000Z");
  });
  it("uses company configuration instead of hardcoding Toronto", () => {
    const { state } = fixture();
    state.config.company.timezone = "Asia/Tehran";
    expect(companyLocalToUtc(state.config, "2026-10-10", "20:10")).toBe(
      "2026-10-10T16:40:00.000Z",
    );
  });
  it.each([
    ["2026-02-30", "20:10"],
    ["2026-10-10", "24:10"],
    ["2026-10-10", "20:60"],
  ])("rejects invalid local input %s %s", (date, time) => {
    expect(() => companyLocalToUtc(fixture().state.config, date, time)).toThrow(
      CompanyLocalTimeError,
    );
  });
});

describe("payment terms and editable totals", () => {
  it.each(["Net -1", "Net 9000000000000000"])(
    "blocks invalid/custom calendar terms %s without imposing a business maximum",
    (terms) => {
      const { state, actor } = fixture();
      setInvoicePaymentTerms(state.invoice, terms);
      expect(invoiceBlockers(state, actor)).toContain("payment_terms");
    },
  );
  it.each([
    ["Cash on delivery", "2026-10-10"],
    ["Net 7", "2026-10-17"],
    ["Net 14", "2026-10-24"],
    ["Net 30", "2026-11-09"],
    ["Net 45", "2026-11-24"],
    ["Net 4000", "2037-09-22"],
  ])(
    "calculates %s due date without a fabricated business maximum",
    (terms, due) => {
      const { state } = fixture();
      setInvoicePaymentTerms(state.invoice, terms);
      expect(state.invoice.due_date).toBe(due);
    },
  );
  it("retains an edited due date until a deliberate new term selection", () => {
    const { state } = fixture();
    setInvoicePaymentTerms(state.invoice, "Net 14");
    state.invoice.due_date = "2026-12-01";
    state.invoice.due_date_manual = true;
    state.invoice.invoice_date = "2026-10-12";
    refreshInvoiceDueDate(state.invoice);
    expect(state.invoice.due_date).toBe("2026-12-01");
    setInvoicePaymentTerms(state.invoice, "Net 7");
    expect(state.invoice.due_date).toBe("2026-10-19");
  });
  it("auto-fills a Decimal final total and warns on an explicit difference", () => {
    const { state, actor } = fixture();
    setInvoiceAmount(state.invoice, "subtotal", "400.00");
    expect(state.invoice.final_total).toBe("400.00");
    setInvoiceAmount(state.invoice, "tax", "52.00");
    expect(state.invoice.final_total).toBe("452.00");
    setInvoiceAmount(state.invoice, "final_total", "450.00");
    expect(invoiceTotalDiffers(state.invoice)).toBe(true);
    setInvoiceAmount(state.invoice, "subtotal", "500.00");
    expect(state.invoice.final_total).toBe("450.00");
    expect(invoiceBlockers(state, actor)).not.toContain("money");
  });
  it("returns to automatic mode when an entered final total equals Subtotal plus Tax", () => {
    const { state } = fixture();
    setInvoiceAmount(state.invoice, "subtotal", "0.10");
    setInvoiceAmount(state.invoice, "tax", "0.20");
    expect(state.invoice.final_total).toBe("0.30");
    setInvoiceAmount(state.invoice, "final_total", "0.29");
    setInvoiceAmount(state.invoice, "final_total", "0.30");
    expect(state.invoice.final_total_manual).toBe(false);
    setInvoiceAmount(state.invoice, "tax", "0.25");
    expect(state.invoice.final_total).toBe("0.35");
  });
  it("preserves a deliberately overridden total through recalculated line edits", () => {
    const { state, actor } = fixture();
    addManualLine(state, actor, "0002");
    setInvoiceAmount(state.invoice, "final_total", "1.00");
    state.invoice.lines[0].unit_cost_before_tax = "2.0000";
    recalculateInvoice(state.invoice, state.config);
    expect(state.invoice.subtotal).toBe("2.00");
    expect(state.invoice.final_total).toBe("1.00");
    expect(invoiceTotalDiffers(state.invoice)).toBe(true);
  });
});

describe("optional supplier profiles", () => {
  const fields = {
    name: "Fictional C6 Supplier",
    phone: "",
    email: "",
    sales_rep_name: "",
    sales_rep_phone: "",
    payment_terms: "",
    address: "",
    notes: "",
  };
  it("accepts optional contact fields in a new invoice proposal for either permitted role", () => {
    for (const role of ["manager", "floor_worker"] as const) {
      const { state, actor } = fixture();
      const receiver =
        role === "manager"
          ? actor
          : authenticatedTestActor(state, "floor_worker", {
              locations: ["Branch 1"],
              name_en: "Receiving Worker",
            });
      const supplier = saveSupplier(state, receiver, fields, {
        invoice_quick_add: true,
      });
      expect(supplier.status).toBe("confirmed");
      state.invoice.supplier = supplier.name;
      markInvoiceSupplierReview(state.invoice, supplier);
      expect(state.invoice.supplier_review_required).toBe(false);
      expect(invoiceBlockers(state, receiver)).not.toContain(
        "supplier_details",
      );
      expect(() => confirmSupplier(state, actor, supplier.id)).not.toThrow();
    }
  });
  it("allows optional profile completion without posting or mutating money", () => {
    const { state, actor } = fixture();
    const supplier = saveSupplier(state, actor, fields, {
      invoice_quick_add: true,
    });
    state.invoice.supplier = supplier.name;
    markInvoiceSupplierReview(state.invoice, supplier);
    Object.assign(supplier, {
      phone: "416-555-0140",
      email: "orders@example.test",
      sales_rep_name: "Fictional Rep",
      sales_rep_phone: "416-555-0141",
      payment_terms: "Net 14",
    });
    const ledger = structuredClone(state.ledger);
    expect(invoiceBlockers(state, actor)).not.toContain("supplier_review");
    confirmInvoiceSupplierReview(state, actor);
    expect(invoiceBlockers(state, actor)).not.toContain("supplier_review");
    expect(supplier.status).toBe("confirmed");
    expect(state.invoice.status).not.toBe("posted");
    expect(state.ledger).toEqual(ledger);
  });
  it("keeps an incomplete supplier usable in manual and uploaded invoices", () => {
    const { state, actor } = fixture();
    const supplier = saveSupplier(state, actor, fields);
    expect(supplier.status).toBe("confirmed");
    state.invoice.supplier = supplier.name;
    state.invoice.supplier_confirmed = true;
    expect(invoiceBlockers(state, actor)).not.toContain("supplier_details");
    state.invoice.entry_mode = "upload";
    expect(invoiceBlockers(state, actor)).not.toContain("supplier_details");
  });
  it("keeps reselecting the same supplier independent from profile completion", () => {
    const { state, actor } = fixture();
    const supplier = saveSupplier(state, actor, fields);
    state.invoice.supplier = supplier.name;
    markInvoiceSupplierReview(state.invoice, supplier);
    Object.assign(supplier, {
      phone: "416-555-0140",
      email: "orders@example.test",
      sales_rep_name: "Fictional Rep",
      sales_rep_phone: "416-555-0141",
      payment_terms: "Net 14",
    });
    markInvoiceSupplierReview(state.invoice, supplier, supplier.name);
    expect(invoiceBlockers(state, actor)).not.toContain("supplier_review");
    confirmInvoiceSupplierReview(state, actor);
    expect(invoiceBlockers(state, actor)).not.toContain("supplier_review");
  });
  it("does not let a Worker, Cashier or foreign company confirm manual review", () => {
    const { state } = fixture();
    const before = structuredClone(state);
    const foreign = initialState();
    foreign.config.company.seed_key = "another-company";
    for (const invalid of [
      authenticatedTestActor(state, "floor_worker", {
        locations: ["Branch 1"],
      }),
      authenticatedTestActor(state, "cashier", { locations: ["Branch 1"] }),
      authenticatedTestActor(foreign, "manager", { locations: ["Branch 1"] }),
    ]) {
      expect(() => confirmInvoiceSupplierReview(state, invalid)).toThrow();
      expect(state).toEqual(before);
    }
  });
});

describe("draft line removal", () => {
  it("recalculates the draft, gives a scoped Undo, and preserves all money/receipt evidence", () => {
    const { state, actor } = fixture();
    addManualLine(state, actor, "0002");
    addManualLine(state, actor, "0003");
    const before = cloneWithAuthority(state);
    const ledger = structuredClone(state.ledger);
    const movements = structuredClone(state.stock_movements);
    removeInvoiceLine(state, actor, 0);
    expect(state.invoice.lines).toHaveLength(1);
    expect(state.invoice.lines[0].product_code).toBe("0003");
    expect(state.activity.at(-1)?.action).toBe("Remove line");
    const history = actor;
    attachReversals(before, state, history);
    reverseActivity(state, history, state.activity.at(-1)!.id, "undo");
    expect(state.invoice.lines).toEqual(before.invoice.lines);
    expect(state.ledger).toEqual(ledger);
    expect(state.stock_movements).toEqual(movements);
  });
  it("refuses line-removal Undo after an intervening edit to another stable line", () => {
    const { state, actor } = fixture();
    addManualLine(state, actor, "0002");
    addManualLine(state, actor, "0003");
    const before = cloneWithAuthority(state);
    removeInvoiceLine(state, actor, 0);
    attachReversals(before, state, actor);
    const removal = state.activity.at(-1)!.id;
    state.invoice.lines[0].unit_cost_before_tax = "4.0000";
    const changed = structuredClone(state);
    expect(() => reverseActivity(state, actor, removal, "undo")).toThrow(
      "conflict",
    );
    expect(state).toEqual(changed);
  });
  it("rejects posted removal and unauthorized locations atomically", () => {
    const { state, actor } = fixture();
    addManualLine(state, actor, "0002");
    for (const invalid of [
      authenticatedTestActor(state, "cashier", { locations: ["Branch 1"] }),
      authenticatedTestActor(state, "floor_worker", {
        locations: ["Branch 2"],
      }),
    ]) {
      const before = structuredClone(state);
      expect(() => removeInvoiceLine(state, invalid, 0)).toThrow();
      expect(state).toEqual(before);
    }
    state.invoice.status = "posted";
    const posted = structuredClone(state);
    expect(() => removeInvoiceLine(state, actor, 0)).toThrow();
    expect(state).toEqual(posted);
  });
});
