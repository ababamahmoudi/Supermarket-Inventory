import { describe, expect, it } from "vitest";
import { authenticatedTestActor } from "./authority-test-fixture";
import { returnFixture } from "./return-test-fixture";
import {
  markNotificationRead,
  requestSale,
  resolveSaleRequest,
  saleStoreDate,
  saleDateAfter,
} from "./sales";
import { projectSalesReadView } from "./sales-projections";

function fixture() {
  const state = returnFixture();
  const requester = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
  });
  const manager = authenticatedTestActor(state, "manager");
  const now = new Date();
  const today = saleStoreDate(state.config, "Branch 1", now);
  const request = requestSale(
    state,
    requester,
    {
      mode: "sale",
      product_code: "0003",
      branches: ["Branch 1"],
      scope: "current",
      price: "1.99",
      price_unit: "each",
      starts_on: today,
      last_day: saleDateAfter(today, 3),
      why: "Fictional request",
      add_labels: false,
      accept_below_margin: false,
      below_cost_reason: "",
    },
    now,
  );
  resolveSaleRequest(
    state,
    manager,
    request.id,
    "reject",
    {
      expected_revision: request.revision,
      reason: "Fictional rejection reason",
    },
    now,
  );
  const notification = state.notifications!.find(
    (item) => item.kind === "sale_request_rejected",
  )!;
  return { state, requester, manager, requestId: request.id, notification };
}

describe("E1 personal rejection notifications retain only the actual requester's outcome reason", () => {
  it("a real Manager at Branch 2 still receives and marks its Branch 1 request notification before changing the location picker", () => {
    const { state, requestId } = fixture();
    const managerAtBranch2 = authenticatedTestActor(state, "manager", {
      selection: { kind: "location", location_id: "Branch 2" },
    });
    const own = projectSalesReadView(
      state,
      managerAtBranch2,
    ).notifications.find(
      (item) =>
        item.kind === "sale_request_submitted" && item.request_id === requestId,
    )!;
    expect(managerAtBranch2.branch).toBe("Branch 2");
    expect(own.branch).toBe("Branch 1");
    expect(own.read_at).toBeUndefined();
    markNotificationRead(state, managerAtBranch2, own.id);
    expect(
      projectSalesReadView(state, managerAtBranch2).notifications.find(
        (item) => item.id === own.id,
      )?.read_at,
    ).toBeDefined();
    expect(managerAtBranch2.branch).toBe("Branch 2");
    expect(projectSalesReadView(state, managerAtBranch2).sale_requests).toEqual(
      [],
    );
  });
  it("shows the genuine rejection reason to its stable requester without exposing other decision metadata", () => {
    const { state, requester, notification } = fixture();
    Object.assign(notification, {
      below_cost_reason: "Fictional private cost reason",
      minimum_margin: "0.25",
    });
    const row = projectSalesReadView(state, requester).notifications.find(
      (item) => item.id === notification.id,
    )!;
    expect(row.reason).toBe("Fictional rejection reason");
    expect(row).not.toHaveProperty("below_cost_reason");
    expect(row).not.toHaveProperty("minimum_margin");
    expect(row).not.toHaveProperty("recipient_user_id");
  });

  it("another genuine person cannot read the outcome by matching its legacy username", () => {
    const { state, notification } = fixture();
    const other = authenticatedTestActor(state, "floor_worker", {
      user_id: "fictional-other-notification-reader",
      username: "fictional-other-notification-reader",
      locations: ["Branch 1"],
    });
    notification.target_username = other.username;
    expect(
      projectSalesReadView(state, other).notifications.some(
        (item) => item.id === notification.id,
      ),
    ).toBe(false);
  });

  it("a reason without the exact canonical rejected source and decision timestamp is omitted", () => {
    const { state, requester, notification } = fixture();
    notification.request_id = "unrelated-request";
    const missingSource = projectSalesReadView(state, requester).notifications;
    expect(missingSource.some((item) => item.id === notification.id)).toBe(
      false,
    );
    expect(JSON.stringify(missingSource)).not.toContain(
      "Fictional rejection reason",
    );
    notification.request_id = state.sale_requests![0].id;
    notification.created_at = "2026-01-01T00:00:00Z";
    const mismatchedDecision = projectSalesReadView(
      state,
      requester,
    ).notifications.find((item) => item.id === notification.id);
    expect(mismatchedDecision).toBeDefined();
    expect(mismatchedDecision).not.toHaveProperty("reason");
    expect(JSON.stringify(mismatchedDecision)).not.toContain(
      "Fictional rejection reason",
    );
  });

  it("cost alerts and non-rejection outcomes never publish raw reason fields", () => {
    const { state, requester, notification } = fixture();
    notification.kind = "sale_cost_increase";
    notification.reason = "Fictional private cost justification";
    Object.assign(notification, {
      below_cost_reason: "Fictional private cost reason",
      minimum_margin: "0.25",
    });
    const forbiddenCostAlert = projectSalesReadView(
      state,
      requester,
    ).notifications;
    expect(forbiddenCostAlert.some((item) => item.id === notification.id)).toBe(
      false,
    );
    expect(JSON.stringify(forbiddenCostAlert)).not.toContain(
      "Fictional private cost justification",
    );
    expect(JSON.stringify(forbiddenCostAlert)).not.toContain(
      "below_cost_reason",
    );
    expect(JSON.stringify(forbiddenCostAlert)).not.toContain("minimum_margin");
    notification.kind = "sale_request_approved";
    const nonRejection = projectSalesReadView(
      state,
      requester,
    ).notifications.find((item) => item.id === notification.id);
    expect(nonRejection).toBeDefined();
    expect(nonRejection).not.toHaveProperty("reason");
    expect(nonRejection).not.toHaveProperty("below_cost_reason");
    expect(nonRejection).not.toHaveProperty("minimum_margin");
    expect(JSON.stringify(nonRejection)).not.toContain(
      "Fictional private cost justification",
    );
  });
});
