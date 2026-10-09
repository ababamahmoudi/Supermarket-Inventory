import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  addManualLine,
  createInvoice,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
  setInvoiceLineQuantity,
} from "./invoice";
import {
  createOrder,
  placeOrder,
  orderCandidates,
  compareInvoiceOrder,
  remainingOrderUnits,
  saveOrderDraft,
  type OrderContext,
} from "./orders";
import {
  currentInvoiceOrderComparison,
  invoiceOrderIssues,
  setInvoiceNewItemMatch,
  setInvoiceOrder,
} from "./invoice-orders";
import { saveSupplierItem, supplierItemFacts } from "./supplier-items";
import {
  setInvoiceWeightCost,
  setInvoiceWeightQuantity,
} from "./invoice-weight";

const context: OrderContext = {
  company_id: "super-arzon",
  role: "supervisor",
  branch: "all",
  actor: "Order reviewer",
};
function fixture(
  cases = "1",
  pack: number | null = 12,
  expectedCost = "0.9800",
) {
  const state = initialState();
  state.invoice = createInvoice(state, "Branch 1", true);
  Object.assign(state.invoice, {
    supplier: "Fresh Valley Foods",
    supplier_confirmed: true,
    supplier_invoice_number: "C4-ORDER-TEST",
    file_name: "fictional.png",
    file_data: "data:image/png;base64,ZGVtbw==",
  });
  addManualLine(state, "0002");
  const line = state.invoice.lines[0];
  line.supplier_item_id = undefined;
  line.supplier_item_code = "C4-NEW-ITEM";
  line.unit_cost_before_tax = "0.9800";
  setInvoiceLineQuantity(line, "12", "units", 12);
  line.date_tracking = false;
  line.date_confirmed = true;
  line.review_confirmed = true;
  recalculateInvoice(state.invoice, state.config);
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional comparison test.",
  };
  const input = {
    branch: "Branch 1",
    supplier: state.invoice.supplier,
    lines: [
      {
        new_item: {
          id: "temporary-c4-line",
          name_en: "Fictional new delivery item",
          units_per_case: pack,
        },
        cases,
        expected_unit_cost: expectedCost,
      },
    ],
  };
  const order = createOrder(state, context, input);
  return { state, order, line, input };
}

describe("C4 intentional temporary orders", () => {
  it("places an explicitly unknown estimate without inventing a product, pack or bought history, retaining its stable draft ID", () => {
    const { state, order, input } = fixture("2", null, "");
    const products = structuredClone(state.products);
    const ledger = structuredClone(state.ledger);
    const items = structuredClone(state.supplier_items);
    expect(order.lines[0]).toMatchObject({
      id: "temporary-c4-line",
      product_code: "",
      supplier_item_id: "",
      new_item: true,
      units_per_case: null,
      ordered_units: null,
      expected_unit_cost: null,
      expected_line_total: null,
    });
    expect(order).toMatchObject({
      estimate_incomplete: true,
      expected_total_before_tax: null,
    });
    saveOrderDraft(
      state,
      context,
      order.id,
      {
        ...input,
        lines: [
          {
            ...input.lines[0],
            new_item: {
              ...input.lines[0].new_item,
              name_en: "Revised temporary name",
            },
          },
        ],
      },
      order.version,
    );
    expect(order.lines[0].id).toBe("temporary-c4-line");
    placeOrder(state, context, order.id, order.version);
    expect(order.status).toBe("ordered");
    expect(state.products).toEqual(products);
    expect(state.ledger).toEqual(ledger);
    expect(state.supplier_items).toEqual(items);
  });

  it("still blocks a real unbought supplier item without an explicit expected cost", () => {
    const { state } = fixture();
    const item = saveSupplierItem(state, context, "Fresh Valley Foods", {
      product_code: "0008",
      supplier_item_code: "NO-COST-C4",
      units_per_case: 12,
    });
    const order = createOrder(state, context, {
      branch: "Branch 1",
      supplier: "Fresh Valley Foods",
      lines: [{ supplier_item_id: item.id, cases: "1" }],
    });
    expect(() => placeOrder(state, context, order.id)).toThrow("cost");
    expect(order.status).toBe("draft");
  });

  it.each([
    ["name", { name_en: "" }, "1"],
    ["pack", { units_per_case: 0 }, "1"],
    ["quantity", { units_per_case: null }, "0.5"],
  ] as const)(
    "rejects invalid %s before creating a draft",
    (code, patch, cases) => {
      const { state, input } = fixture();
      const before = structuredClone(state.orders);
      expect(() =>
        createOrder(state, context, {
          ...input,
          lines: [
            {
              ...input.lines[0],
              cases,
              new_item: {
                ...input.lines[0].new_item,
                id: "another-temporary",
                ...patch,
              },
            },
          ],
        }),
      ).toThrow(code);
      expect(state.orders).toEqual(before);
    },
  );

  it("never infers the temporary name, records an explicit match without purchase history, and associates only when posted once", () => {
    const { state, order, line } = fixture();
    const original = structuredClone(order.lines[0]);
    const items = structuredClone(state.supplier_items);
    placeOrder(state, context, order.id);
    setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
    expect(
      currentInvoiceOrderComparison(state)?.lines[0].order_line_id,
    ).toBeUndefined();
    expect(invoiceOrderIssues(state, "supervisor", "Branch 1")).toEqual([
      "order_decisions",
    ]);
    setInvoiceNewItemMatch(state, "supervisor", "Branch 1", original.id, 0);
    expect(line.order_new_item_match).toMatchObject({
      order_line_id: original.id,
      product_code: "0002",
      invoice_line_index: 0,
      order_version: order.version,
    });
    expect(state.supplier_items).toEqual(items);
    expect(order.lines[0].new_item_association).toBeUndefined();
    line.review_confirmed = true;
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual([]);
    postInvoice(state, "supervisor", "Branch 1", context.actor);
    expect(order.lines[0]).toMatchObject({
      ...original,
      received_units: 12,
      new_item_association: {
        product_code: "0002",
        ordered_quantity: 12,
        invoice_id: state.invoice.id,
        supplier_item_code: "C4-NEW-ITEM",
      },
    });
    expect(order.status).toBe("received");
    const item = supplierItemFacts(
      state,
      context.company_id,
      state.invoice.supplier,
      "all",
    ).find((item) => item.supplier_item_code === "C4-NEW-ITEM")!;
    expect(item.history).toHaveLength(1);
    expect(item.last_bought_unit_cost).toBe("0.9800");
    const once = structuredClone({
      orders: state.orders,
      items: state.supplier_items,
      ledger: state.ledger,
    });
    expect(postInvoice(state, "supervisor", "Branch 1", context.actor)).toBe(
      false,
    );
    expect({
      orders: state.orders,
      items: state.supplier_items,
      ledger: state.ledger,
    }).toEqual(once);
  });

  it("resolves an unknown pack from the explicitly selected invoice while preserving the original null snapshot", () => {
    const { state, order, line } = fixture("1", null, "");
    placeOrder(state, context, order.id);
    setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
    setInvoiceNewItemMatch(
      state,
      "supervisor",
      "Branch 1",
      order.lines[0].id,
      0,
    );
    line.review_confirmed = true;
    postInvoice(state, "supervisor", "Branch 1");
    expect(order.lines[0]).toMatchObject({
      units_per_case: null,
      ordered_units: null,
      expected_unit_cost: null,
      received_units: 12,
      new_item_association: { units_per_case: 12, ordered_quantity: 12 },
    });
    expect(order.expected_total_before_tax).toBeNull();
  });

  it("rejects duplicate explicit consumption, stale fingerprints and foreign location links before any money changes", () => {
    const { state, order, line, input } = fixture();
    saveOrderDraft(state, context, order.id, {
      ...input,
      lines: [
        ...input.lines,
        {
          ...input.lines[0],
          new_item: { ...input.lines[0].new_item, id: "temporary-second" },
        },
      ],
    });
    placeOrder(state, context, order.id);
    setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
    setInvoiceNewItemMatch(
      state,
      "supervisor",
      "Branch 1",
      order.lines[0].id,
      0,
    );
    const before = structuredClone(state);
    expect(() =>
      setInvoiceNewItemMatch(
        state,
        "supervisor",
        "Branch 1",
        "temporary-second",
        0,
      ),
    ).toThrow("match");
    expect(state).toEqual(before);
    line.units_per_case = 6;
    expect(invoiceOrderIssues(state, "supervisor", "Branch 1")).toEqual([
      "order_decisions",
    ]);
    expect(() => postInvoice(state, "supervisor", "Branch 1")).toThrow();
    expect(state.ledger).toEqual(before.ledger);
    line.units_per_case = 12;
    state.invoice.branch = "Branch 2";
    expect(() =>
      setInvoiceNewItemMatch(
        state,
        "supervisor",
        "Branch 1",
        "temporary-second",
        0,
      ),
    ).toThrow("match");
    expect(state.ledger).toEqual(before.ledger);
  });

  it("supports a normal receiving proposal and associates its actual assigned product only after posting", () => {
    const { state, order, line } = fixture();
    line.product_code = "NEW";
    line.new_name_en = "Fictional C4 proposed food";
    line.new_name_fa = "خوراک پیشنهادی آزمایشی";
    line.pricing_category = "grocery";
    placeOrder(state, context, order.id);
    setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
    setInvoiceNewItemMatch(
      state,
      "supervisor",
      "Branch 1",
      order.lines[0].id,
      0,
    );
    line.review_confirmed = true;
    postInvoice(state, "supervisor", "Branch 1");
    expect(line.product_code).not.toBe("NEW");
    expect(order.lines[0].new_item_association?.product_code).toBe(
      line.product_code,
    );
    expect(
      state.supplier_items?.find(
        (item) => item.supplier_item_code === "C4-NEW-ITEM",
      )?.product_code,
    ).toBe(line.product_code);
    expect(order.lines[0].product_code).toBe("");
  });

  it("requires explicit case weight for a weighed match and compares its exact canonical pounds", () => {
    const { state, order, line } = fixture("2", null, "");
    Object.assign(line, {
      source_quantity: "20",
      source_quantity_unit: "kg",
      source_cost_before_tax: "11.0000",
      source_cost_unit: "kg",
      weight_conversion_factor: "2.20462",
      qty_invoiced: 44.0924,
      qty_received_at_posting: 44.0924,
      unit_cost_before_tax: "4.9895",
    });
    placeOrder(state, context, order.id);
    setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
    expect(() =>
      setInvoiceNewItemMatch(
        state,
        "supervisor",
        "Branch 1",
        order.lines[0].id,
        0,
      ),
    ).toThrow("case_weight");
    line.case_weight = "10";
    line.case_weight_unit = "kg";
    setInvoiceNewItemMatch(
      state,
      "supervisor",
      "Branch 1",
      order.lines[0].id,
      0,
    );
    expect(currentInvoiceOrderComparison(state)?.lines[0]).toMatchObject({
      expected_remaining_units: 44.0924,
      delivered_units: 44.0924,
      extra_units: 0,
      price_changed: false,
    });
    expect(order.lines[0]).toMatchObject({
      units_per_case: null,
      ordered_units: null,
    });
  });

  it("posts an explicitly matched weighed temporary receipt and retains exact source case costs separately from the original unknown estimate", () => {
    const { state, order, line } = fixture("2", null, "");
    const product = state.products.find(
      (item) => item.code === line.product_code,
    )!;
    product.sold_by = "weight";
    product.date_tracking = false;
    line.case_weight = "10";
    line.case_weight_unit = "kg";
    setInvoiceWeightCost(line, "11.0000", "kg", state.config);
    setInvoiceWeightQuantity(line, "2", "cases", state.config);
    recalculateInvoice(state.invoice, state.config);
    placeOrder(state, context, order.id);
    setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
    setInvoiceNewItemMatch(
      state,
      "supervisor",
      "Branch 1",
      order.lines[0].id,
      0,
    );
    line.review_confirmed = true;
    expect(invoiceBlockers(state, "supervisor", "Branch 1")).toEqual([]);
    postInvoice(state, "supervisor", "Branch 1");
    expect(order.status).toBe("received");
    expect(order.lines[0]).toMatchObject({
      ordered_units: null,
      expected_unit_cost: null,
      received_units: 44.0924,
      new_item_association: {
        ordered_quantity: 44.0924,
        quantity_unit: "lb",
        case_weight: "10",
        case_weight_unit: "kg",
        weight_conversion_factor: "2.20462",
      },
    });
    expect(remainingOrderUnits(order.lines[0])).toBe(0);
    expect(order.expected_total_before_tax).toBeNull();
    const fact = supplierItemFacts(
      state,
      context.company_id,
      state.invoice.supplier,
      "all",
    ).find((item) => item.supplier_item_code === "C4-NEW-ITEM")!;
    expect(fact).toMatchObject({
      case_weight: "10",
      case_weight_unit: "kg",
      last_bought_unit_cost: "4.9895",
      last_bought_case_cost: "110.0000",
    });
    expect(fact.history[0].received_units).toBe(44.0924);
  });

  it("uses a real weighed supplier item's retained case weight and exact source cost, and scales a changed case pack without rewriting purchase history", () => {
    const { state, line } = fixture("2", null, "");
    state.products.find((item) => item.code === line.product_code)!.sold_by =
      "weight";
    line.case_weight = "10";
    line.case_weight_unit = "kg";
    setInvoiceWeightCost(line, "11.0000", "kg", state.config);
    setInvoiceWeightQuantity(line, "2", "cases", state.config);
    recalculateInvoice(state.invoice, state.config);
    line.review_confirmed = true;
    postInvoice(state, "supervisor", "Branch 1");
    const candidate = orderCandidates(
      state,
      context,
      state.invoice.supplier,
    ).find((item) => item.supplier_item_code === "C4-NEW-ITEM")!;
    expect(candidate).toMatchObject({
      quantity_unit: "lb",
      case_weight: "10",
      expected_unit_cost: "4.9895",
      expected_case_cost: "110.0000",
    });
    const order = createOrder(state, context, {
      branch: "Branch 1",
      supplier: state.invoice.supplier,
      lines: [{ supplier_item_id: candidate.id, cases: "2" }],
    });
    placeOrder(state, context, order.id);
    expect(order).toMatchObject({
      expected_total_before_tax: "220.00",
      lines: [
        {
          ordered_units: 44.0924,
          quantity_unit: "lb",
          case_weight: "10",
          expected_case_cost: "110.0000",
        },
      ],
    });
    const definition = saveSupplierItem(
      state,
      context,
      state.invoice.supplier,
      {
        product_code: line.product_code,
        supplier_item_code: line.supplier_item_code!,
        units_per_case: 12,
      },
      candidate.id,
    );
    Object.assign(definition, {
      case_weight: "5",
      case_weight_unit: "kg",
      weight_conversion_factor: "2.20462",
    });
    const changed = orderCandidates(
      state,
      context,
      state.invoice.supplier,
    ).find((item) => item.id === candidate.id)!;
    expect(changed.expected_case_cost).toBe("55.0000");
    const changedOrder = createOrder(state, context, {
      branch: "Branch 1",
      supplier: state.invoice.supplier,
      lines: [{ supplier_item_id: changed.id, cases: "2" }],
    });
    expect(changedOrder.lines[0].ordered_units).toBe(22.0462);
    expect(changedOrder.expected_total_before_tax).toBe("110.00");
    const fact = supplierItemFacts(
      state,
      context.company_id,
      state.invoice.supplier,
      "all",
    ).find((item) => item.id === candidate.id)!;
    expect(fact.history[0]).toMatchObject({
      case_weight: "10",
      received_units: 44.0924,
      case_cost_before_tax: "110.0000",
    });
    expect(order.lines[0]).toMatchObject({
      case_weight: "10",
      ordered_units: 44.0924,
      expected_case_cost: "110.0000",
    });
  });

  it("does not treat a real weighed supplier case with no retained case weight as one Each unit", () => {
    const { state } = fixture();
    state.products.find((item) => item.code === "0008")!.sold_by = "weight";
    const item = saveSupplierItem(state, context, "Fresh Valley Foods", {
      product_code: "0008",
      supplier_item_code: "UNKNOWN-WEIGHT-PACK",
      units_per_case: 1,
      quoted_unit_cost_before_tax: "2.0000",
    });
    const orders = structuredClone(state.orders);
    expect(() =>
      createOrder(state, context, {
        branch: "Branch 1",
        supplier: "Fresh Valley Foods",
        lines: [{ supplier_item_id: item.id, cases: "1" }],
      }),
    ).toThrow("case_weight");
    expect(state.orders).toEqual(orders);
  });

  it("does not reinterpret retained Each order quantities as lb after a product's selling basis changes", () => {
    const { state, line } = fixture();
    const item = saveSupplierItem(state, context, state.invoice.supplier, {
      product_code: line.product_code,
      supplier_item_code: line.supplier_item_code!,
      units_per_case: 12,
      quoted_unit_cost_before_tax: "2.0000",
    });
    const order = createOrder(state, context, {
      branch: "Branch 1",
      supplier: state.invoice.supplier,
      lines: [{ supplier_item_id: item.id, cases: "2" }],
    });
    placeOrder(state, context, order.id);
    const retainedOrder = structuredClone(order);
    state.products.find(
      (product) => product.code === line.product_code,
    )!.sold_by = "weight";
    line.case_weight = "10";
    line.case_weight_unit = "kg";
    setInvoiceWeightCost(line, "11.0000", "kg", state.config);
    setInvoiceWeightQuantity(line, "2", "cases", state.config);
    recalculateInvoice(state.invoice, state.config);
    expect(() => compareInvoiceOrder(order, state.invoice)).toThrow("quantity");
    setInvoiceOrder(state, "supervisor", "Branch 1", order.id);
    expect(currentInvoiceOrderComparison(state)).toBeNull();
    expect(invoiceOrderIssues(state, "supervisor", "Branch 1")).toEqual([
      "order_decisions",
    ]);
    expect(order).toEqual(retainedOrder);
  });
});
