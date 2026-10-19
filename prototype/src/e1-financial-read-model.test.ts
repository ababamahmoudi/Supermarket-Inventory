import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { returnFixture } from "./return-test-fixture";
import { approvalBoard, approvalPanelRead } from "./approval-board";
import { payablesBoard } from "./payables-board";
import type { RoleId } from "./authority-types";

function fixture() {
  const state = returnFixture();
  state.approvals = [
    {
      id: "e1-private-approval",
      company_id: state.config.company.seed_key,
      branch: "Branch 1",
      product_code: "0003",
      type: "price_change",
      status: "pending",
      proposed_price: "2.99",
      current_price: "2.49",
      unit_cost: "1.5501",
      margin: "0.4816",
      threshold: "0.25",
      reason: "Fictional private justification",
    },
    {
      id: "e1-other-store-approval",
      company_id: state.config.company.seed_key,
      branch: "Branch 2",
      product_code: "0003",
      type: "price_change",
      status: "pending",
      proposed_price: "2.99",
      unit_cost: "1.7000",
    },
  ];
  return state;
}
describe("E1 approval and Payables canonical read models", () => {
  it("Branch Supervisor reads only its pending core without financial or reason metadata or a decision preview", () => {
    const state = fixture();
    const actor = authenticatedTestActor(state, "branch_supervisor", {
      locations: ["Branch 1"],
    });
    const rows = approvalBoard(state, actor);
    expect(rows.map((row) => row.approval.id)).toEqual(["e1-private-approval"]);
    expect(rows[0].unitCost).toBeNull();
    expect(rows[0].margin).toBeNull();
    expect(rows[0].approval.unit_cost).toBeUndefined();
    expect(rows[0].approval.reason).toBeUndefined();
    expect(rows[0].approval.threshold).toBeUndefined();
    expect(() =>
      approvalPanelRead(
        state,
        actor,
        "e1-private-approval",
        "branch",
        "Branch 1",
        "rule",
        true,
      ),
    ).toThrow();
  });
  it("the real Manager receives unchanged private precision and canonical effect details", () => {
    const state = fixture();
    const actor = authenticatedTestActor(state, "manager");
    const row = approvalBoard(state, actor).find(
      (item) => item.approval.id === "e1-private-approval",
    )!;
    expect(row.unitCost).toBe("1.5501");
    expect(row.approval.reason).toBe("Fictional private justification");
    const panel = approvalPanelRead(
      state,
      actor,
      row.approval.id,
      "branch",
      "Branch 1",
      "rule",
      true,
    );
    expect(panel.cost).toBe("1.5501");
    expect(panel.effects[0].locations).toEqual(["Branch 1"]);
    expect(
      payablesBoard(state, actor, "Fresh Valley Foods").summary.balance,
    ).toBe("600.00");
  });
  it.each(["branch_supervisor", "floor_worker", "cashier"] as RoleId[])(
    "%s cannot obtain a Payables DTO",
    (role) => {
      const state = fixture();
      const actor = authenticatedTestActor(state, role, {
        locations: ["Branch 1"],
      });
      expect(() => payablesBoard(state, actor, "Fresh Valley Foods")).toThrow();
    },
  );
});
