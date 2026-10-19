import { describe, expect, it } from "vitest";
import { returnFixture } from "./return-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { proposeRegularPrice, resolveApproval } from "./approvals";
import { regularPrice } from "./catalog";
import { manualPrice } from "./manual-prices";
import { recordPickup, submitFinancialClaim } from "./operations";

describe("E1 regular proposal decision identity and retained write-off safety", () => {
  it("only the real Manager approval executes the proposal and captures requester and decider separately", () => {
    const state = returnFixture();
    const supervisor = authenticatedTestActor(state, "branch_supervisor");
    const manager = authenticatedTestActor(state, "manager");
    const product = state.products.find((item) => item.code === "0003")!;
    const price = regularPrice(state, product, "Branch 1");
    const money = JSON.stringify({
      ledger: state.ledger,
      stock: state.stock,
      stock_movements: state.stock_movements,
    });
    const request = proposeRegularPrice(
      state,
      supervisor,
      product.code,
      "Branch 1",
      "15.99",
    );
    expect(regularPrice(state, product, "Branch 1")).toBe(price);
    expect(request.source_manual_request?.requester_user_id).toBe(
      supervisor.user_id,
    );
    const pending = cloneWithAuthority(state);
    expect(() =>
      resolveApproval(
        state,
        supervisor,
        request.id,
        "approve",
        "branch",
        "Branch 1",
      ),
    ).toThrow();
    expect(state).toEqual(pending);
    resolveApproval(
      state,
      manager,
      request.id,
      "approve",
      "branch",
      "Branch 1",
    );
    expect(regularPrice(state, product, "Branch 1")).toBe("15.99");
    expect(request.decided_by_user_id).toBe(manager.user_id);
    expect(request.decision_attribution?.user_id).toBe(manager.user_id);
    expect(request.source_manual_request?.requester_user_id).toBe(
      supervisor.user_id,
    );
    expect(manualPrice(state, product, "Branch 1")?.set_by_user_id).toBe(
      manager.user_id,
    );
    expect(
      JSON.stringify({
        ledger: state.ledger,
        stock: state.stock,
        stock_movements: state.stock_movements,
      }),
    ).toBe(money);
  });
  it("missing cost blocks execution but still allows rejecting the request without modifying prices", () => {
    const state = returnFixture();
    const supervisor = authenticatedTestActor(state, "branch_supervisor");
    const manager = authenticatedTestActor(state, "manager");
    const product = state.products.find((item) => item.code === "0003")!;
    product.last_cost_before_tax = "";
    const price = regularPrice(state, product, "Branch 1");
    const request = proposeRegularPrice(
      state,
      supervisor,
      product.code,
      "Branch 1",
      "15.99",
    );
    const pending = cloneWithAuthority(state);
    expect(() =>
      resolveApproval(
        state,
        manager,
        request.id,
        "approve",
        "branch",
        "Branch 1",
      ),
    ).toThrow();
    expect(state).toEqual(pending);
    resolveApproval(
      state,
      manager,
      request.id,
      "reject",
      "branch",
      "Branch 1",
      "Fictional cost needs checking",
    );
    expect(request.status).toBe("rejected");
    expect(request.decided_by_user_id).toBe(manager.user_id);
    expect(regularPrice(state, product, "Branch 1")).toBe(price);
  });
  it("retains the original Worker write-off denial and permits actual Manager review", () => {
    const state = returnFixture();
    const worker = authenticatedTestActor(state, "floor_worker");
    const manager = authenticatedTestActor(state, "manager");
    recordPickup(state, worker, "c4-return", {
      quantities: { "0003": 3 },
      representative: "Fictional driver",
      slip: "SIGNED-WRITE-OFF",
    });
    const input = {
      type: "no_compensation" as const,
      covers: { "0003": 3 },
      reason: "Fictional supplier declined compensation",
    };
    const before = cloneWithAuthority(state);
    expect(() =>
      submitFinancialClaim(state, worker, "c4-return", input),
    ).toThrow();
    expect(state).toEqual(before);
    submitFinancialClaim(state, manager, "c4-return", input);
    expect(state.returns[0].status).toBe("claim_pending");
    expect(state.ledger).toEqual(before.ledger);
  });
});
