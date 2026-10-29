import Decimal from "decimal.js";
import {
  normalizeInvoiceReceivingReview,
  fillCalculatedInvoiceTotals,
} from "./invoice-checks";
import { setInvoiceAmount } from "./invoice-entry";
import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import { authoritySnapshot, bindAuthoritySnapshot } from "./authority";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  addInvoiceOtherCharge,
  editInvoiceOtherCharge,
  removeInvoiceOtherCharge,
} from "./invoice-other-charges";

function draft() {
  const state = initialState();
  state.invoice.status = "review";
  state.invoice.lines = [];
  state.invoice.other_charges = [];
  state.invoice.final_total_manual = false;
  const actor = authenticatedTestActor(state, "manager");
  return { state, actor };
}

describe("B4 inline invoice charges and credits", () => {
  it("calculates signed charges and taxable amounts with Decimal and retains actor audit", () => {
    const { state, actor } = draft();
    addInvoiceOtherCharge(state, actor);
    expect(state.invoice.other_charges).toEqual([
      { line_type: "other", description: "", amount: "", taxable: false },
    ]);
    editInvoiceOtherCharge(
      state,
      actor,
      0,
      "description",
      "Fictional delivery",
    );
    editInvoiceOtherCharge(state, actor, 0, "line_total", "5.00");
    editInvoiceOtherCharge(state, actor, 0, "taxable", "true");
    addInvoiceOtherCharge(state, actor);
    editInvoiceOtherCharge(state, actor, 1, "description", "Fictional credit");
    editInvoiceOtherCharge(state, actor, 1, "line_total", "-1.20");
    const tax = new Decimal("5.00").times(state.config.tax.rate).toFixed(2);
    expect(state.invoice.subtotal).toBe("3.80");
    expect(state.invoice.tax).toBe(tax);
    expect(state.invoice.final_total).toBe(
      new Decimal("3.80").plus(tax).toFixed(2),
    );
    expect(state.activity.at(-1)).toMatchObject({
      action: "Edit invoice charge or credit",
      company_id: state.invoice.company_id,
      branch: state.invoice.branch,
      actor_user_id: actor.user_id,
      entity_id: state.invoice.id,
      before: { other_charges: [expect.anything(), { amount: "" }] },
      after: { other_charges: [expect.anything(), { amount: "-1.20" }] },
    });
    removeInvoiceOtherCharge(state, actor, 1);
    expect(state.invoice.other_charges).toHaveLength(1);
    expect(state.invoice.subtotal).toBe("5.00");
    expect(state.activity.at(-1)?.action).toBe(
      "Remove invoice charge or credit",
    );
  });

  it("acknowledges only the edited charge field and keeps original bytes, source provenance and printed totals", () => {
    const { state, actor } = draft();
    state.invoice.file_data = "idb-file:v1:fictional:original-unchanged";
    state.invoice.reading_record = {
      source: "imported",
      file_name: "fictional.json",
      page_sha256s: ["f".repeat(64)],
      models: ["fictional-model"],
      reading_cost_usd: "0.11",
      exported_at: "2026-10-29T12:00:00Z",
      ai_source: "fictional",
    };
    state.invoice.subtotal = "21.00";
    state.invoice.tax = "1.00";
    state.invoice.final_total = "22.00";
    state.invoice.other_charges = [
      {
        line_type: "fee",
        description: "Fictional delivery",
        amount: "3.00",
        taxable: false,
        low_confidence_fields: ["description", "line_total", "taxable"],
      },
    ];
    const provenance = structuredClone(state.invoice.reading_record);
    editInvoiceOtherCharge(state, actor, 0, "line_total", "-1.25");
    expect(state.invoice.other_charges[0].low_confidence_fields).toEqual([
      "description",
      "taxable",
    ]);
    expect(
      state.invoice.other_charges[0].checked_fields?.line_total,
    ).toMatchObject({ checked_by_user_id: actor.user_id });
    expect([
      state.invoice.subtotal,
      state.invoice.tax,
      state.invoice.final_total,
    ]).toEqual(["21.00", "1.00", "22.00"]);
    expect(state.invoice.file_data).toBe(
      "idb-file:v1:fictional:original-unchanged",
    );
    expect(state.invoice.reading_record).toEqual(provenance);
  });

  it.each(["posted", "reading", "empty"] as const)(
    "rejects %s targets before changing any record",
    (status) => {
      const { state, actor } = draft();
      state.invoice.status = status;
      const before = structuredClone(state);
      expect(() => addInvoiceOtherCharge(state, actor)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it.each(["company", "cashier", "revoked"] as const)(
    "rejects a fresh authority mismatch: %s",
    (reason) => {
      const { state } = draft();
      const actor = authenticatedTestActor(
        state,
        reason === "cashier" ? "cashier" : "manager",
      );
      if (reason === "company") state.invoice.company_id = "other-company";
      if (reason === "revoked") {
        const snapshot = structuredClone(authoritySnapshot(state));
        snapshot.people.find((person) => person.id === actor.user_id)!
          .authority_epoch++;
        bindAuthoritySnapshot(state, snapshot);
      }
      const before = structuredClone(state);
      expect(() => addInvoiceOtherCharge(state, actor)).toThrow();
      expect(state).toEqual(before);
    },
  );

  it.each([-1, 1, 0.5, Number.NaN])(
    "rejects a nonexistent charge %s without partial changes",
    (index) => {
      const { state, actor } = draft();
      addInvoiceOtherCharge(state, actor);
      const before = structuredClone(state);
      expect(() =>
        editInvoiceOtherCharge(state, actor, index, "line_total", "4.00"),
      ).toThrow();
      expect(() => removeInvoiceOtherCharge(state, actor, index)).toThrow();
      expect(state).toEqual(before);
    },
  );
});

function lineDerivedDraft() {
  const value = draft();
  value.state.invoice.reading_record = {
    source: "imported",
    file_name: "fictional-derived.json",
    page_sha256s: ["f".repeat(64)],
    models: ["fictional-model"],
    reading_cost_usd: "0.01",
    exported_at: "2026-10-29T12:00:00Z",
    ai_source: "fictional",
  };
  value.state.invoice.lines = [
    {
      ...initialState().invoice.lines[0],
      quantity_unit: "units",
      quantity_entered: "2",
      qty_invoiced: 2,
      qty_received_at_posting: 2,
      unit_cost_before_tax: "1.1000",
      case_cost_before_tax: undefined,
      line_total: "2.20",
    },
  ];
  value.state.invoice.other_charges = [
    {
      line_type: "fee",
      description: "Fictional handling",
      amount: "1.13",
      taxable: false,
    },
    {
      line_type: "credit",
      description: "Fictional credit",
      amount: "-0.03",
      taxable: false,
    },
  ];
  Object.assign(value.state.invoice, {
    subtotal: "3.30",
    tax: "",
    final_total: "",
    calculated_from_lines: true,
    calculated_fields: ["subtotal"],
  });
  return value;
}

it("refreshes only the current line-derived subtotal through charge edit/add/remove with exact cents", () => {
  const { state, actor } = lineDerivedDraft();
  editInvoiceOtherCharge(state, actor, 0, "line_total", "1.23");
  expect(state.invoice.subtotal).toBe("3.40");
  expect([state.invoice.tax, state.invoice.final_total]).toEqual(["", ""]);
  addInvoiceOtherCharge(state, actor);
  expect(state.invoice.subtotal).toBe("");
  editInvoiceOtherCharge(state, actor, 2, "line_total", "-0.01");
  expect(state.invoice.subtotal).toBe("3.39");
  removeInvoiceOtherCharge(state, actor, 0);
  expect(state.invoice.subtotal).toBe("2.16");
  expect([state.invoice.tax, state.invoice.final_total]).toEqual(["", ""]);
  expect(state.invoice.lines[0].unit_cost_before_tax).toBe("1.1000");
});

it.each(["", "1.234", "not an amount"])(
  "keeps a line-derived subtotal unresolved for an incomplete amount %s, including normalization",
  (amount) => {
    const { state, actor } = lineDerivedDraft();
    Object.assign(state.invoice, { tax: "0.00", final_total: "3.30" });
    editInvoiceOtherCharge(state, actor, 0, "line_total", amount);
    expect(state.invoice.subtotal).toBe("");
    normalizeInvoiceReceivingReview(state.invoice);
    expect(state.invoice.subtotal).toBe("");
    expect(state.invoice.low_confidence_fields).toContain("subtotal");
    expect([state.invoice.tax, state.invoice.final_total]).toEqual([
      "0.00",
      "3.30",
    ]);
  },
);

it("retains a human subtotal override despite a stale calculated_from_lines flag", () => {
  const { state, actor } = lineDerivedDraft();
  Object.assign(state.invoice, { tax: "0.00", final_total: "3.30" });
  setInvoiceAmount(state.invoice, "subtotal", "8.88");
  expect(state.invoice.calculated_from_lines).toBe(true);
  expect(state.invoice.calculated_fields).not.toContain("subtotal");
  const printed = [
    state.invoice.subtotal,
    state.invoice.tax,
    state.invoice.final_total,
  ];
  editInvoiceOtherCharge(state, actor, 0, "line_total", "1.23");
  expect([
    state.invoice.subtotal,
    state.invoice.tax,
    state.invoice.final_total,
  ]).toEqual(printed);
});

it("never refreshes a retained posted subtotal while normalizing its reading", () => {
  const { state } = lineDerivedDraft();
  Object.assign(state.invoice, {
    status: "posted",
    tax: "0.00",
    final_total: "3.30",
  });
  state.invoice.other_charges![0].amount = "9.99";
  const printed = [
    state.invoice.subtotal,
    state.invoice.tax,
    state.invoice.final_total,
  ];
  normalizeInvoiceReceivingReview(state.invoice);
  fillCalculatedInvoiceTotals(state.invoice);
  expect([
    state.invoice.subtotal,
    state.invoice.tax,
    state.invoice.final_total,
  ]).toEqual(printed);
});

it.each(["tax", "final_total"] as const)(
  "completes a missing dependent header from the refreshed subtotal and supplied %s",
  (field) => {
    const { state } = lineDerivedDraft();
    state.invoice[field] = field === "tax" ? "0.43" : "3.73";
    normalizeInvoiceReceivingReview(state.invoice);
    expect([
      state.invoice.subtotal,
      state.invoice.tax,
      state.invoice.final_total,
    ]).toEqual(["3.30", "0.43", "3.73"]);
    expect(state.invoice.calculated_fields).toContain(
      field === "tax" ? "final_total" : "tax",
    );
  },
);

it.each(["tax", "final_total"] as const)(
  "refreshes a currently calculated %s and preserves its independent paper amount",
  (field) => {
    const { state, actor } = lineDerivedDraft();
    Object.assign(state.invoice, {
      tax: "0.43",
      final_total: "3.73",
      calculated_fields: ["subtotal", field],
    });
    editInvoiceOtherCharge(state, actor, 0, "line_total", "1.23");
    expect(state.invoice.subtotal).toBe("3.40");
    expect(state.invoice.tax).toBe(field === "tax" ? "0.33" : "0.43");
    expect(state.invoice.final_total).toBe(
      field === "final_total" ? "3.83" : "3.73",
    );
  },
);

it.each(["tax", "final_total"] as const)(
  "leaves a calculated %s unresolved when its subtotal becomes incomplete, then completes it from real amounts",
  (field) => {
    const { state, actor } = lineDerivedDraft();
    Object.assign(state.invoice, {
      tax: "0.43",
      final_total: "3.73",
      calculated_fields: ["subtotal", field],
    });
    editInvoiceOtherCharge(state, actor, 0, "line_total", "");
    expect(state.invoice.subtotal).toBe("");
    expect(state.invoice[field]).toBe("");
    expect(state.invoice.calculated_fields).not.toContain(field);
    expect(state.invoice[field === "tax" ? "final_total" : "tax"]).toBe(
      field === "tax" ? "3.73" : "0.43",
    );
    editInvoiceOtherCharge(state, actor, 0, "line_total", "1.23");
    expect(state.invoice[field]).toBe(field === "tax" ? "0.33" : "3.83");
    expect(state.invoice.calculated_fields).toContain(field);
  },
);

it("does not replace an explicitly human-entered dependent final with a former calculated value", () => {
  const { state, actor } = lineDerivedDraft();
  Object.assign(state.invoice, {
    tax: "0.43",
    final_total: "3.73",
    calculated_fields: ["subtotal", "final_total"],
  });
  setInvoiceAmount(state.invoice, "final_total", "9.99");
  editInvoiceOtherCharge(state, actor, 0, "line_total", "1.23");
  expect([
    state.invoice.subtotal,
    state.invoice.tax,
    state.invoice.final_total,
  ]).toEqual(["3.40", "0.43", "9.99"]);
  expect(state.invoice.calculated_fields).not.toContain("final_total");
});
