import { expect, it } from "vitest";
import { initialState } from "../../e1-bootstrap";
import { authenticatedTestActor } from "../../authority-test-fixture";
import { invoiceView } from "../../invoice-projections";
import { setInvoiceLineQuantity } from "../../invoice";
import { setInvoiceWeightQuantity } from "../../invoice-weight";
import { missingGroups } from "./missing-groups";
import { invoiceAmountIssue } from "./amount-issue";
function invoice() {
  const state = initialState();
  const actor = authenticatedTestActor(state, "owner");
  return invoiceView(state, actor, state.invoice.id);
}
it.each(["subtotal", "tax", "final_total"] as const)(
  "names missing %s and its actual input",
  (field) => {
    const value = invoice();
    Object.assign(value, { [field]: "" });
    const issue = invoiceAmountIssue(field, "", (en) => en)!;
    const result = missingGroups(value, (en) => en, ["money"]);
    expect(result).toContainEqual({
      label: issue,
      target:
        field === "final_total" ? "invoice-final-total" : `invoice-${field}`,
    });
    expect(issue).toContain("is empty.");
    expect(issue).toContain("Enter");
    expect(invoiceAmountIssue(field, "-1", (en) => en)).toContain(
      "nonnegative",
    );
    expect(invoiceAmountIssue(field, "0.00", (en) => en)).toBeUndefined();
    expect(invoiceAmountIssue(field, "", (_, fa) => fa)).not.toBe(issue);
  },
);
it("splits header blockers into actionable number, invoice date, received date and receiver fields", () => {
  const value = invoice();
  Object.assign(value, {
    supplier_invoice_number: "",
    invoice_date: "2026-02-31",
    received_at: "not-a-date",
    receiving_employee: "",
  });
  const result = missingGroups(value, (en) => en, ["header"]);
  for (const target of [
    "invoice-number",
    "invoice-date",
    "invoice-received-date",
    "invoice-employee",
  ])
    expect(result.find((group) => group.target === target)?.label).toMatch(
      /Enter|Choose|Set/,
    );
  expect(
    result.some((group) =>
      group.label.includes("complete the number, date and receiver"),
    ),
  ).toBe(false);
});
it("routes every posting blocker to an actionable field or permission explanation", () => {
  const value = invoice();
  const blockers = [
    "permission",
    "company",
    "branch",
    "supplier",
    "header",
    "money",
    "file",
    "lines",
    "checks",
    "review",
    "payment_terms",
    "lower_price",
    "order",
    "order_decisions",
    "matching",
    "cost",
    "quantity",
    "date",
    "manual_price",
    "barcode",
  ];
  Object.assign(value, {
    supplier: "",
    supplier_invoice_number: "",
    tax: "",
    invoice_date: "",
    received_at: "",
    receiving_employee: "",
  });
  Object.assign(value.lines[0], {
    product_code: "NEW",
    new_name_en: "",
    pricing_category: "",
    unit_cost_before_tax: "bad",
    qty_received_at_posting: -1,
    review_confirmed: false,
    date_tracking: true,
    date_value: "",
    low_confidence_fields: ["description"],
  });
  const result = missingGroups(
    value,
    (en) => en,
    blockers,
    Object.fromEntries(
      ["matching", "cost", "quantity", "date", "manual_price", "barcode"].map(
        (key) => [key, [0]],
      ),
    ),
  );
  for (const target of [
    "invoice-review-header",
    "invoice-back-link",
    "invoice-location",
    "invoice-supplier",
    "invoice-number",
    "invoice-tax",
    "invoice-original-field",
    "invoice-add-product",
    "invoice-payment-terms-days",
    "invoice-lower-answer",
    "invoice-order",
    "invoice-line-0-name-en",
    "invoice-line-0-cost",
    "invoice-line-0-delivered",
    "invoice-line-0-date",
    "invoice-line-0-manual",
    "invoice-line-0-barcode",
  ])
    expect(
      result.some((group) => group.target === target),
      target,
    ).toBe(true);
  expect(result.every((group) => group.label.trim() && group.target)).toBe(
    true,
  );
});

it.each([
  {
    answer: { same_expiry: "unknown", note: "" },
    target: "invoice-lower-note",
  },
  { answer: { same_expiry: "yes" }, target: "invoice-lower-units-left" },
  {
    answer: { same_expiry: "no", new_expiry: "2026-12-01" },
    target: "invoice-lower-old-expiry",
  },
  {
    answer: { same_expiry: "no", old_expiry: "2026-12-01" },
    target: "invoice-lower-new-expiry",
  },
])(
  "focuses the unanswered lower-price subfield $target",
  ({ answer, target }) => {
    const value = invoice();
    value.lower_price_answers = answer;
    expect(
      missingGroups(value, (en) => en, ["lower_price"]).map(
        (row) => row.target,
      ),
    ).toContain(target);
    expect(
      missingGroups(value, (en) => en, ["lower_price"]).map(
        (row) => row.target,
      ),
    ).not.toContain("invoice-lower-answer");
  },
);
it("names an invalid due date when the payment terms themselves are valid", () => {
  const value = invoice();
  Object.assign(value, {
    payment_terms: "Net 30",
    due_date: "",
    due_date_manual: false,
  });
  expect(missingGroups(value, (en) => en, ["payment_terms"])).toContainEqual({
    label: expect.stringContaining("Due date is missing or invalid"),
    target: "invoice-due-date",
  });
});
it("directs a short-dated Best-before mismatch to Date type, rather than the valid date", () => {
  const value = invoice();
  Object.assign(value.lines[0], {
    short_dated: true,
    date_tracking: true,
    date_type: "best_before",
    date_value: "2026-12-01",
    date_confirmed: true,
  });
  expect(
    missingGroups(value, (en) => en, ["date"], { date: [0] }),
  ).toContainEqual({
    label: expect.stringContaining("Change Date type to Expiry"),
    target: "invoice-line-0-date-type",
    line: 0,
  });
});
it("uses actual quantity setters to prioritize pack and source-quantity causes before dependent delivery facts", () => {
  const state = initialState();
  const actor = authenticatedTestActor(state, "owner");
  const line = state.invoice.lines[0];
  setInvoiceLineQuantity(line, "2", "cases", 0);
  let value = invoiceView(state, actor, state.invoice.id);
  expect(
    missingGroups(value, (en) => en, ["quantity"], { quantity: [0] }).some(
      (row) => row.target === "invoice-line-0-pack",
    ),
  ).toBe(true);
  setInvoiceWeightQuantity(line, "", "kg", state.config);
  value = invoiceView(state, actor, state.invoice.id);
  expect(
    missingGroups(value, (en) => en, ["quantity"], { quantity: [0] }).some(
      (row) => row.target === "invoice-line-0-invoiced",
    ),
  ).toBe(true);
});
it.each([
  { problem: { kind: "stale" as const }, target: "invoice-order-refresh" },
  { problem: { kind: "supplier" as const }, target: "invoice-supplier" },
  {
    problem: {
      kind: "association" as const,
      line: 2,
      order_line_id: "temporary fictional",
    },
    target: "invoice-order-match-temporary%20fictional",
  },
  {
    problem: { kind: "extra" as const, line: 2 },
    target: "invoice-order-line-2-extra-decision",
  },
  {
    problem: { kind: "price" as const, line: 2 },
    target: "invoice-order-line-2-price-decision",
  },
  {
    problem: { kind: "missing" as const, order_line_id: "fictional missing" },
    target: "invoice-order-missing-fictional%20missing-decision",
  },
])("uses fresh order provenance for $target", ({ problem, target }) => {
  const value = invoice();
  expect(
    missingGroups(value, (en) => en, ["order_decisions"], {}, [problem]),
  ).toContainEqual({ label: expect.any(String), target });
});
