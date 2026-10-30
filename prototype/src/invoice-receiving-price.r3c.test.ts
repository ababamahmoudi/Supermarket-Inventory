import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { authenticatedProviderFixture } from "./authority-provider-test-fixture";
import { DemoProvider } from "./store";
import { ApprovalReviewPanel } from "./screens/ApprovalReviewPanel";
import i18n from "./i18n";
import { initialState } from "./e1-bootstrap";
import { cloneWithAuthority } from "./authority";
import { attachReversals, reverseActivity } from "./history";
import { discardInvoice, invoiceDiscardRead } from "./invoice-discard";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  createInvoice,
  invoiceBlockers,
  postInvoice,
  recalculateInvoice,
} from "./invoice";
import { confirmInvoiceLineChecks } from "./invoice-checks";
import { regularPrice } from "./catalog";
import { resolveApproval, manualRegularApprovalPreview } from "./approvals";
import { manualPrice } from "./manual-prices";
import { savePriceChange, saleStoreDate } from "./sales";
import { invoiceWorkspaceRead } from "./invoice-workspace-read";
import { invoiceView } from "./invoice-projections";
import { businessAuditRead } from "./business-audit-read";
import {
  receivingPriceQuote,
  receivingPriceProblem,
  setInvoiceReceivingPrice,
} from "./invoice-receiving-price";

function prepare() {
  const state = initialState();
  const floor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    name_en: "Fictional Receiver",
  });
  state.invoice = createInvoice(state, floor, "Branch 1");
  state.invoice.status = "review";
  state.invoice.file_name = "fictional-original.png";
  state.invoice.file_data = "data:image/png;base64,ZmFrZQ==";
  state.invoice.file_type = "image/png";
  state.invoice.lines = [state.invoice.lines[0]];
  const line = state.invoice.lines[0];
  Object.assign(line, {
    unit_cost_before_tax: "1.0000",
    quantity_unit: "units",
    quantity_entered: "1",
    qty_invoiced: 1,
    qty_received_at_posting: 1,
    pricing_category: "grocery",
    sold_by: "each",
    date_tracking: false,
    date_confirmed: true,
    taxable: false,
    low_confidence_fields: [],
  });
  delete line.case_cost_before_tax;
  delete line.paper_line_total;
  state.invoice.lower_price_answers = { same_expiry: "no_previous_stock" };
  state.approvals = [];
  recalculateInvoice(state.invoice, state.config);
  confirmInvoiceLineChecks(state, floor, 0, true);
  return { state, floor, line };
}

describe("receiving price proposals", () => {
  it("a kg price entry preserves its unit and actual receiver while proposing canonical per-lb prices", () => {
    const { state, floor, line } = prepare();
    Object.assign(line, {
      sold_by: "weight",
      quantity_unit: "lb",
      quantity_entered: "1",
      source_cost_before_tax: "1.0000",
      source_cost_unit: "lb",
    });
    state.config.weighed_items = {
      ...state.config.weighed_items!,
      main_display_unit: "kg",
    };
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "17.61",
      receivingPriceQuote(state, 0),
      undefined,
      "kg",
    );
    expect(line.receiving_price).toMatchObject({
      price: "7.99",
      entered_price: "17.61",
      price_unit: "kg",
      set_by_user_id: floor.user_id,
    });
    const floorRead = invoiceWorkspaceRead(state, floor);
    expect(floorRead.lineDetails[0].receivingMargin).toBeNull();
    expect(floorRead.lineDetails[0].receivingBelowMinimum).toBe(false);
    const manager = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
    });
    const managerRead = invoiceWorkspaceRead(state, manager);
    expect(managerRead.lineDetails[0].receivingMargin).toBe("87.48");
    expect(
      state.products.find((product) => product.code === line.product_code)
        ?.selling_price,
    ).not.toBe("7.99");
    expect(
      invoiceView(state, floor, state.invoice.id).lines[0].receiving_price,
    ).toMatchObject({
      price: "7.99",
      entered_price: "17.61",
      price_unit: "kg",
    });
    state.config.weighed_items.conversion_factor = "2";
    expect(receivingPriceProblem(state, 0)).toBe(true);
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "17.61",
      receivingPriceQuote(state, 0),
      undefined,
      "kg",
    );
    expect(line.receiving_price).toMatchObject({
      price: "8.81",
      entered_price: "17.61",
      price_unit: "kg",
    });
    expect(receivingPriceProblem(state, 0)).toBe(false);
  });

  it("an arbitrary entered price reaches the real pending approval with source money and actual editor preserved", () => {
    const { state, floor, line } = prepare();
    const source = structuredClone(state.invoice);
    const before = structuredClone(state.products);
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.83",
      receivingPriceQuote(state, 0),
    );
    confirmInvoiceLineChecks(state, floor, 0, true);
    const poster = authenticatedTestActor(state, "manager", {
      name_en: "Fictional Different Poster",
    });
    postInvoice(state, poster);
    const approval = state.approvals.find((row) => row.receiving_price)!;
    expect(approval.status).toBe("pending");
    expect(approval.receiving_price).toMatchObject({
      price: "1.83",
      entered_price: "1.83",
      price_unit: "each",
      calculated_price: "1.99",
      set_by_user_id: floor.user_id,
      set_by: floor.actor,
    });
    expect([
      state.invoice.subtotal,
      state.invoice.tax,
      state.invoice.final_total,
    ]).toEqual([source.subtotal, source.tax, source.final_total]);
    expect(state.invoice.file_data).toBe(source.file_data);
    expect(state.invoice.lines[0].unit_cost_before_tax).toBe(
      source.lines[0].unit_cost_before_tax,
    );
    expect(
      state.products.find((row) => row.code === line.product_code)
        ?.branch_prices,
    ).toEqual(
      before.find((row) => row.code === line.product_code)?.branch_prices,
    );
    expect(
      manualRegularApprovalPreview(state, poster, approval).calculated_price,
    ).toBe("1.99");
  });

  it("warnings use the entered price while numeric margins remain private to margin readers", () => {
    const { state, floor } = prepare();
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "0.50",
      receivingPriceQuote(state, 0),
    );
    const view = invoiceWorkspaceRead(state, floor);
    expect(view.lineDetails[0]).toMatchObject({
      receivingBelowCost: true,
      receivingMargin: null,
      receivingBelowMinimum: false,
    });
    const manager = authenticatedTestActor(state, "manager");
    expect(invoiceWorkspaceRead(state, manager).lineDetails[0]).toMatchObject({
      receivingBelowCost: true,
      receivingMargin: "-100.00",
      receivingBelowMinimum: true,
    });
  });

  it("Set then Reset never resurrects an earlier token for either set or reset", () => {
    const { state, floor } = prepare();
    const original = receivingPriceQuote(state, 0);
    const afterSet = setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.49",
      original,
    );
    const afterReset = setInvoiceReceivingPrice(
      state,
      floor,
      0,
      null,
      afterSet,
    );
    expect(state.invoice.lines[0].receiving_price).toBeUndefined();
    expect(afterReset).not.toBe(original);
    const before = JSON.stringify(state);
    expect(() =>
      setInvoiceReceivingPrice(state, floor, 0, "1.69", original),
    ).toThrow(/changed/);
    expect(() =>
      setInvoiceReceivingPrice(state, floor, 0, null, original),
    ).toThrow(/changed/);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("real Discard and Undo retire the old action token while keeping the valid proposal and actual editor", () => {
    const { state, floor } = prepare();
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.49",
      receivingPriceQuote(state, 0),
    );
    const retained = structuredClone(state.invoice.lines[0].receiving_price);
    const originals = [
      state.invoice.file_data,
      structuredClone(state.invoice.original_pages),
    ];
    const oldAction = receivingPriceQuote(state, 0);
    const before = cloneWithAuthority(state);
    discardInvoice(state, floor, {
      invoice_id: state.invoice.id,
      expected_version: invoiceDiscardRead(state, floor, state.invoice.id)
        .version,
      reason: "Fictional duplicate reviewed before undo",
    });
    const cancellation = attachReversals(before, state, floor).find(
      (entry) => entry.action === "Cancel invoice",
    )!;
    expect(() =>
      setInvoiceReceivingPrice(state, floor, 0, "1.79", oldAction),
    ).toThrow();
    reverseActivity(state, floor, cancellation.id, "undo");
    expect(state.invoice.lines[0].receiving_price).toEqual(retained);
    expect(receivingPriceProblem(state, 0)).toBe(false);
    expect([state.invoice.file_data, state.invoice.original_pages]).toEqual(
      originals,
    );
    expect(receivingPriceQuote(state, 0)).not.toBe(oldAction);
    const restored = JSON.stringify(state);
    expect(() =>
      setInvoiceReceivingPrice(state, floor, 0, "1.79", oldAction),
    ).toThrow(/changed/);
    expect(JSON.stringify(state)).toBe(restored);
    confirmInvoiceLineChecks(state, floor, 0, true);
    const poster = authenticatedTestActor(state, "manager", {
      name_en: "Fictional Different Poster",
    });
    postInvoice(state, poster);
    expect(
      state.approvals.find(
        (entry) => entry.source_invoice_id === state.invoice.id,
      )?.receiving_price,
    ).toMatchObject({
      price: "1.49",
      set_by_user_id: floor.user_id,
      set_by: "Fictional Receiver",
    });
  });

  it("rejects a stale receiver action after a newer authorized price decision", () => {
    const { state, floor, line } = prepare();
    const manager = authenticatedTestActor(state, "manager");
    const old = receivingPriceQuote(state, 0);
    const afterFirst = setInvoiceReceivingPrice(state, floor, 0, "1.49", old);
    expect(afterFirst).not.toBe(old);
    setInvoiceReceivingPrice(state, manager, 0, "1.69", afterFirst);
    const before = JSON.stringify(state);
    expect(() =>
      setInvoiceReceivingPrice(state, floor, 0, "1.79", afterFirst),
    ).toThrow(/changed/);
    expect(JSON.stringify(state)).toBe(before);
    expect(line.receiving_price).toMatchObject({
      price: "1.69",
      set_by_user_id: manager.user_id,
    });
  });

  it("a new action version retires an old token without invalidating unchanged retained price evidence", () => {
    const { state, floor, line } = prepare();
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.49",
      receivingPriceQuote(state, 0),
    );
    const retained = structuredClone(line.receiving_price);
    const old = receivingPriceQuote(state, 0);
    state.invoice.version = (state.invoice.version ?? 0) + 1;
    expect(receivingPriceProblem(state, 0)).toBe(false);
    expect(() =>
      setInvoiceReceivingPrice(state, floor, 0, "1.79", old),
    ).toThrow(/changed/);
    expect(line.receiving_price).toEqual(retained);
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.79",
      receivingPriceQuote(state, 0),
    );
    expect(line.receiving_price?.price).toBe("1.79");
  });

  it("the real protected approval panel shows the receiver, requested price and independently calculated price", async () => {
    const { state, floor } = prepare();
    Object.assign(state.invoice, {
      file_name: "fictional-original.pdf",
      file_type: "application/pdf",
      file_data: "data:application/pdf;base64,JSVGSUNUSU9OQUxQREY=",
    });
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.49",
      receivingPriceQuote(state, 0),
    );
    confirmInvoiceLineChecks(state, floor, 0, true);
    const poster = authenticatedTestActor(state, "manager", {
      name_en: "Fictional Poster",
    });
    postInvoice(state, poster);
    const approval = state.approvals.find((row) => row.receiving_price)!;
    await i18n.changeLanguage("en");
    const fixture = await authenticatedProviderFixture({
      state,
      role: "manager",
    });
    try {
      render(
        createElement(DemoProvider, {
          options: fixture.options,
          children: createElement(ApprovalReviewPanel, {
            approval,
            scope: "branch",
            target: "Branch 1",
            onScopeChange() {},
          }),
        }),
      );
      const details = await screen.findByTestId("receiving-price-approval");
      expect(details).toHaveTextContent(
        "Set by Fictional Receiver during receiving",
      );
      expect(details).toHaveTextContent("Requested price: $1.49");
      expect(details).toHaveTextContent("Calculated price: $1.99");
      expect(details).not.toHaveTextContent("Fictional Poster");
    } finally {
      cleanup();
      fixture.dispose();
    }
  });

  it("the enabled ending rule preserves a deliberate .49 manual price on a same-cost receipt", () => {
    const { state, floor, line } = prepare();
    postInvoice(state, floor);
    const first = structuredClone(state.invoice);
    const manager = authenticatedTestActor(state, "manager");
    let product = state.products.find((row) => row.code === line.product_code)!;
    savePriceChange(state, manager, {
      product_code: product.code,
      mode: "regular",
      scope: "current",
      price: "3.49",
      price_unit: "each",
      branches: ["Branch 1"],
      starts_on: saleStoreDate(state.config, "Branch 1"),
      last_day: null,
      accept_below_margin: false,
      below_cost_reason: "",
      add_labels: false,
    });
    // The genuine price command publishes a cloned candidate, so read its current Product.
    product = state.products.find((row) => row.code === product.code)!;
    state.invoices ??= [];
    state.invoices.push(first);
    state.invoice = createInvoice(state, floor, "Branch 1");
    Object.assign(state.invoice, {
      status: "review",
      file_name: "fictional-second.png",
      file_type: "image/png",
      file_data: "data:image/png;base64,ZmFrZTI=",
      supplier_invoice_number: "FICTIONAL-SAME-COST-2",
      lower_price_answers: { same_expiry: "no_previous_stock" },
    });
    state.invoice.lines = [
      {
        ...structuredClone(first.lines[0]),
        id: "fictional-repeat-line",
        review_confirmed: false,
      },
    ];
    recalculateInvoice(state.invoice, state.config);
    confirmInvoiceLineChecks(state, floor, 0, true);
    const marker = structuredClone(manualPrice(state, product, "Branch 1"));
    postInvoice(state, floor);
    expect(state.config.rounding_bands.final_ending_adjustment).toBeTruthy();
    expect(regularPrice(state, product, "Branch 1")).toBe("3.49");
    expect(manualPrice(state, product, "Branch 1")).toEqual(marker);
    expect(
      state.approvals.filter(
        (row) =>
          row.source_invoice_id === state.invoice.id &&
          row.product_code === product.code,
      ),
    ).toEqual([]);
  });

  it("default ending changes a new receipt proposal without repricing the stored approved charge", () => {
    const { state, floor, line } = prepare();
    const product = state.products.find(
      (row) => row.code === line.product_code,
    )!;
    const stored = regularPrice(state, product, "Branch 1");
    const allPrices = state.products.map((row) => [
      row.code,
      row.selling_price,
      structuredClone(row.branch_prices),
    ]);
    expect(state.config.rounding_bands.final_ending_adjustment).toMatchObject({
      source_endings: ["0.49"],
      target_ending: "0.99",
    });
    expect(invoiceWorkspaceRead(state, floor).lineDetails[0]).toMatchObject({
      price: "1.99",
      roundedUpFrom: "1.49",
    });
    postInvoice(state, floor);
    expect(
      state.approvals.find((row) => row.source_invoice_id === state.invoice.id),
    ).toMatchObject({ proposed_price: "1.99", status: "pending" });
    expect(regularPrice(state, product, "Branch 1")).toBe(stored);
    expect(
      state.products.map((row) => [
        row.code,
        row.selling_price,
        row.branch_prices,
      ]),
    ).toEqual(allPrices);
  });

  it("uses the lower band price through approval while retaining the actual receiver and paper money", () => {
    const { state, floor, line } = prepare();
    const product = state.products.find(
      (row) => row.code === line.product_code,
    )!;
    const approved = regularPrice(state, product, "Branch 1");
    const paper = [
      state.invoice.subtotal,
      state.invoice.tax,
      state.invoice.final_total,
      line.line_total,
      line.unit_cost_before_tax,
    ];
    const detail = invoiceWorkspaceRead(state, floor).lineDetails[0];
    expect(detail).toMatchObject({
      price: "1.99",
      roundedUpFrom: "1.49",
      receivingPriceEligible: true,
    });
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      detail.roundedUpFrom!,
      detail.receivingPriceQuote,
      new Date("2026-10-29T16:00:00Z"),
    );
    expect(regularPrice(state, product, "Branch 1")).toBe(approved);
    expect(line.review_confirmed).toBe(false);
    expect(line.receiving_price).toMatchObject({
      price: "1.49",
      set_by_user_id: floor.user_id,
      set_by: "Fictional Receiver",
      set_at: "2026-10-29T16:00:00.000Z",
    });
    confirmInvoiceLineChecks(state, floor, 0, true);
    const manager = authenticatedTestActor(state, "manager", {
      name_en: "Fictional Poster",
    });
    expect(invoiceBlockers(state, manager)).toEqual([]);
    postInvoice(state, manager);
    const proposal = state.approvals.find(
      (row) => row.source_invoice_id === state.invoice.id,
    )!;
    expect(proposal).toMatchObject({
      proposed_price: "1.49",
      manual_override: true,
      triggered_by: "Fictional Poster",
      receiving_price: {
        price: "1.49",
        calculated_price: "1.99",
        set_by: "Fictional Receiver",
        set_by_user_id: floor.user_id,
      },
    });
    expect(regularPrice(state, product, "Branch 1")).toBe(approved);
    expect([
      state.invoice.subtotal,
      state.invoice.tax,
      state.invoice.final_total,
      line.line_total,
      line.unit_cost_before_tax,
    ]).toEqual(paper);
    expect(
      manualRegularApprovalPreview(state, manager, proposal),
    ).toMatchObject({
      price: "1.49",
      calculated_price: "1.99",
    });
    expect(
      state.activity.find((entry) => entry.action === "Set receiving price"),
    ).toHaveProperty("device_id", floor.device_id);
    resolveApproval(
      state,
      manager,
      proposal.id,
      "approve",
      "branch",
      "Branch 1",
    );
    expect(regularPrice(state, product, "Branch 1")).toBe("1.49");
    expect(manualPrice(state, product, "Branch 1")?.price).toBe("1.49");
  });

  it("requires an approver reason below cost and does not silently approve after rejection", () => {
    const { state, floor, line } = prepare();
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      ".50",
      receivingPriceQuote(state, 0),
    );
    confirmInvoiceLineChecks(state, floor, 0, true);
    postInvoice(state, floor);
    const manager = authenticatedTestActor(state, "manager");
    const approval = state.approvals.find((row) => row.receiving_price)!;
    const product = state.products.find(
      (row) => row.code === line.product_code,
    )!;
    const before = regularPrice(state, product, "Branch 1");
    expect(() =>
      resolveApproval(
        state,
        manager,
        approval.id,
        "approve",
        "branch",
        "Branch 1",
      ),
    ).toThrow(/reason/);
    expect(approval.status).toBe("pending");
    resolveApproval(
      state,
      manager,
      approval.id,
      "reject",
      "branch",
      "Branch 1",
      "Fictional rejection",
    );
    expect(regularPrice(state, product, "Branch 1")).toBe(before);
  });

  it.each(["", "0", "-1", "NaN", "1.234", "."])(
    "keeps invalid typed value %j as a blocker without changing money",
    (value) => {
      const { state, floor } = prepare();
      const ledger = structuredClone(state.ledger);
      setInvoiceReceivingPrice(
        state,
        floor,
        0,
        value,
        receivingPriceQuote(state, 0),
      );
      expect(invoiceBlockers(state, floor)).toContain("selling_price");
      expect(() => postInvoice(state, floor)).toThrow(/selling_price/);
      expect(state.ledger).toEqual(ledger);
      setInvoiceReceivingPrice(
        state,
        floor,
        0,
        null,
        receivingPriceQuote(state, 0),
      );
      expect(invoiceBlockers(state, floor)).not.toContain("selling_price");
    },
  );

  it("refuses stale quotes/foreign actors and blocks a proposal after its pricing facts change", () => {
    const { state, floor, line } = prepare();
    const quote = receivingPriceQuote(state, 0);
    line.unit_cost_before_tax = "1.2000";
    const before = JSON.stringify(state);
    expect(() =>
      setInvoiceReceivingPrice(state, floor, 0, "1.49", quote),
    ).toThrow(/changed/);
    expect(JSON.stringify(state)).toBe(before);
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.49",
      receivingPriceQuote(state, 0),
    );
    line.pricing_category = "kitchenware";
    expect(invoiceBlockers(state, floor)).toContain("selling_price");
    expect(() =>
      setInvoiceReceivingPrice(
        state,
        { ...floor, company_id: "fictional-other-company" },
        0,
        "1.49",
        receivingPriceQuote(state, 0),
      ),
    ).toThrow();
    expect(() =>
      setInvoiceReceivingPrice(
        state,
        { ...floor, session_id: "replaced-session" },
        0,
        "1.49",
        receivingPriceQuote(state, 0),
      ),
    ).toThrow();
  });

  it("projects attribution but never the internal quote or private margins", () => {
    const { state, floor } = prepare();
    setInvoiceReceivingPrice(
      state,
      floor,
      0,
      "1.49",
      receivingPriceQuote(state, 0),
    );
    const view = invoiceView(state, floor, state.invoice.id);
    expect(view.lines[0].receiving_price?.set_by).toBe("Fictional Receiver");
    expect(JSON.stringify(view)).not.toContain("pricing_quote");
    expect(
      JSON.stringify(businessAuditRead(state.activity.at(-1))),
    ).not.toContain("pricing_quote");
    expect(view.margin_allowed).toBe(false);
  });

  it("refuses short-dated, wholly refused, and posted price edits", () => {
    const { state, floor, line } = prepare();
    line.short_dated = true;
    expect(() =>
      setInvoiceReceivingPrice(
        state,
        floor,
        0,
        "1.49",
        receivingPriceQuote(state, 0),
      ),
    ).toThrow(/rules/);
    line.short_dated = false;
    line.refused_units = line.qty_received_at_posting;
    expect(() =>
      setInvoiceReceivingPrice(
        state,
        floor,
        0,
        "1.49",
        receivingPriceQuote(state, 0),
      ),
    ).toThrow(/rules/);
    line.refused_units = 0;
    state.invoice.status = "posted";
    expect(() =>
      setInvoiceReceivingPrice(
        state,
        floor,
        0,
        "1.49",
        receivingPriceQuote(state, 0),
      ),
    ).toThrow();
  });
});
