import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "../../authority-test-fixture";
import { initialState } from "../../e1-bootstrap";
import { addManualLine, createInvoice } from "../../invoice";
import { invoiceWorkspaceRead } from "../../invoice-workspace-read";
import { missingGroups } from "./missing-groups";

function receiving() {
  const state = initialState();
  const actor = authenticatedTestActor(state, "manager", {
    locations: ["Branch 1"],
  });
  state.invoice = createInvoice(state, actor, "Branch 1", true);
  state.invoice.supplier = "Fresh Valley Foods";
  state.invoice.supplier_invoice_number = "FICTIONAL-MISSING-025";
  for (let index = 0; index < 3; index++) {
    addManualLine(state, actor, "0001");
    Object.assign(state.invoice.lines[index], {
      review_confirmed: true,
      date_tracking: false,
      date_confirmed: true,
      quantity_unit: "units",
      quantity_entered: "2",
      qty_invoiced: 2,
      qty_received_at_posting: 2,
      unit_cost_before_tax: "0.9800",
    });
  }
  return { state, actor };
}

describe("receiving missing-item navigation", () => {
  it.each([
    { blocker: "cost", target: "cost" },
    { blocker: "quantity", target: "invoiced" },
    { blocker: "matching", target: "matching" },
  ] as const)(
    "opens the first affected line for $blocker instead of a valid first line",
    ({ blocker, target }) => {
      const { state, actor } = receiving();
      for (const line of state.invoice.lines.slice(1)) {
        if (blocker === "cost") line.unit_cost_before_tax = "unreadable";
        if (blocker === "quantity") line.qty_received_at_posting = 3;
        if (blocker === "matching") line.product_code = "FICTIONAL-NOT-MATCHED";
      }
      const workspace = invoiceWorkspaceRead(state, actor);
      expect(workspace.blockers).toContain(blocker);
      expect(workspace.blockerLineIndexes[blocker]).toEqual([1, 2]);
      expect(
        missingGroups(
          workspace.invoice,
          (en) => en,
          workspace.blockers,
          workspace.blockerLineIndexes,
        ).find((group) => group.target === `invoice-line-1-${target}`),
      ).toMatchObject({ line: 1 });
    },
  );

  it("uses the case-cost validation provenance when the unit cost itself is valid", () => {
    const { state, actor } = receiving();
    Object.assign(state.invoice.lines[2], {
      quantity_unit: "cases",
      quantity_entered: "1",
      units_per_case: 12,
      qty_invoiced: 12,
      qty_received_at_posting: 12,
      case_cost_before_tax: "",
    });
    const workspace = invoiceWorkspaceRead(state, actor);
    expect(workspace.blockerLineIndexes.cost).toEqual([2]);
    expect(
      missingGroups(
        workspace.invoice,
        (en) => en,
        workspace.blockers,
        workspace.blockerLineIndexes,
      ).find((group) => group.target === "invoice-line-2-case-cost"),
    ).toMatchObject({ line: 2 });
  });
});
