import { describe, expect, it } from "vitest";
import { returnFixture } from "./return-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import {
  actorAtLocation,
  bindAuthoritySnapshot,
  authoritySnapshot,
  cloneWithAuthority,
} from "./authority";
import {
  recordPickup,
  receiveReplacement,
  correctReturnPickup,
  ledgerSummary,
  addNote,
  updateNoteStatus,
} from "./operations";
import { requestSale, savePriceChange, type ChangePriceInput } from "./sales";
import { proposeRegularPrice } from "./approvals";
import { returnView, returnMemoView } from "./return-projections";
import { ReturnMemoDocument } from "./return-memo";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { AuthenticatedActor, RoleId } from "./authority-types";

const source = () => {
  const state = returnFixture();
  state.sales = [];
  state.sale_requests = [];
  state.sale_events = [];
  state.notifications = [];
  return state;
};
const pickup = {
  quantities: { "0003": 3 },
  representative: "Fictional driver",
  slip: "SIGNED-E1",
};
const replacement = {
  product_code: "0003",
  qty: 1,
  covers: { "0003": 1 },
  date: "2026-10-13",
  representative: "Fictional driver",
  receipt: "REPLACEMENT-E1",
};
const saleInput: ChangePriceInput = {
  product_code: "0003",
  mode: "sale",
  scope: "current",
  price: "1.49",
  price_unit: "each",
  branches: ["Branch 1"],
  starts_on: "2026-10-13",
  last_day: "2026-10-25",
  accept_below_margin: false,
  below_cost_reason: "",
  add_labels: true,
};

describe("E1 return and price authority", () => {
  it.each([
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
  ] as RoleId[])("%s records its permitted actual signed pickup", (role) => {
    const state = source();
    const actor = authenticatedTestActor(state, role, {
      locations: ["Branch 1"],
    });
    recordPickup(state, actor, "c4-return", pickup);
    expect(state.returns[0].pickup_memos?.[0].signed_evidence_reference).toBe(
      "SIGNED-E1",
    );
    expect(state.ledger).toHaveLength(1);
  });
  it("denies Branch Supervisor replacement while retaining Floor Worker authority", () => {
    const state = source();
    const supervisor = authenticatedTestActor(state, "branch_supervisor", {
      locations: ["Branch 1"],
    });
    const worker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    recordPickup(state, supervisor, "c4-return", pickup);
    const before = structuredClone(state);
    expect(() =>
      receiveReplacement(state, supervisor, "c4-return", replacement),
    ).toThrow();
    expect(state).toEqual(before);
    receiveReplacement(state, worker, "c4-return", replacement);
    expect(state.returns[0].replacement_received?.qty).toBe(1);
    expect(state.ledger).toHaveLength(1);
  });
  it.each(["branch_supervisor", "floor_worker", "cashier"] as RoleId[])(
    "%s cannot correct signed pickup or read Payables",
    (role) => {
      const state = source();
      const manager = authenticatedTestActor(state, "manager", {
        locations: ["Branch 1"],
      });
      recordPickup(state, manager, "c4-return", pickup);
      const actor = authenticatedTestActor(state, role, {
        locations: ["Branch 1"],
      });
      const before = structuredClone(state);
      expect(() =>
        correctReturnPickup(state, actor, "c4-return", {
          memo_id: state.returns[0].pickup_memos![0].id,
          quantities: { "0003": 2 },
          reason: "Correct actual signed quantity",
        }),
      ).toThrow();
      expect(() =>
        ledgerSummary(state, actor, state.returns[0].supplier),
      ).toThrow();
      expect(state).toEqual(before);
    },
  );
  it("denies forged, spread and stale authenticated actors without changing records", () => {
    const state = source();
    const manager = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
    });
    const before = structuredClone(state);
    expect(() =>
      recordPickup(
        state,
        { ...manager } as AuthenticatedActor,
        "c4-return",
        pickup,
      ),
    ).toThrow();
    expect(() =>
      recordPickup(
        state,
        {
          role: "manager",
          branch: "Branch 1",
          company_id: "super-arzon",
        } as AuthenticatedActor,
        "c4-return",
        pickup,
      ),
    ).toThrow();
    const snapshot = structuredClone(authoritySnapshot(state));
    snapshot.people = snapshot.people.map((person) =>
      person.id === manager.user_id
        ? { ...person, authority_epoch: person.authority_epoch + 1 }
        : person,
    );
    bindAuthoritySnapshot(state, snapshot);
    expect(() => recordPickup(state, manager, "c4-return", pickup)).toThrow();
    expect(state).toEqual(before);
  });
  it("keeps authority binding only through the verified clone helper", () => {
    const state = source();
    const actor = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
    });
    expect(() =>
      recordPickup(structuredClone(state), actor, "c4-return", pickup),
    ).toThrow();
    const draft = cloneWithAuthority(state);
    recordPickup(
      draft,
      actorAtLocation(draft, actor, "Branch 1"),
      "c4-return",
      pickup,
    );
    expect(draft.returns[0].pickup_completed).toBe(true);
    expect(state.returns[0].pickup_completed).not.toBe(true);
  });
  it("Branch Supervisor proposes a regular price without executing price, Sale or labels", () => {
    const state = source();
    const actor = authenticatedTestActor(state, "branch_supervisor", {
      locations: ["Branch 1"],
    });
    const product = state.products.find((item) => item.code === "0003")!;
    const oldPrice = product.selling_price;
    const oldMarkers = structuredClone(product.manual_prices);
    const labels = structuredClone(state.label_waitlist);
    const approval = proposeRegularPrice(
      state,
      actor,
      product.code,
      "Branch 1",
      "2.79",
    );
    expect(approval.status).toBe("pending");
    expect(approval.source_manual_request?.requester_user_id).toBe(
      actor.user_id,
    );
    expect(product.selling_price).toBe(oldPrice);
    expect(product.manual_prices).toEqual(oldMarkers);
    expect(state.sales).toEqual([]);
    expect(state.label_waitlist).toEqual(labels);
    expect(() =>
      savePriceChange(state, actor, { ...saleInput, mode: "regular" }),
    ).toThrow();
  });
  it.each(["branch_supervisor", "floor_worker"] as RoleId[])(
    "%s requests a Sale at its own assigned Store only",
    (role) => {
      const state = source();
      const actor = authenticatedTestActor(state, role, {
        locations: ["Branch 1"],
      });
      const request = requestSale(
        state,
        actor,
        saleInput,
        new Date("2026-10-13T16:00:00Z"),
      );
      expect(request.requester_user_id).toBe(actor.user_id);
      expect(request.status).toBe("pending");
      expect(state.sales).toEqual([]);
    },
  );
  it("supervisory notebook status is independent of ordinary operational status", () => {
    const state = source();
    const worker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    const supervisor = authenticatedTestActor(state, "branch_supervisor", {
      locations: ["Branch 1"],
    });
    addNote(state, worker, {
      type: "note_to_supervisor",
      text: "Fictional staff instruction",
    });
    const note = state.notes[0];
    updateNoteStatus(state, worker, note.id, "read");
    expect(() =>
      updateNoteStatus(state, worker, note.id, "resolved"),
    ).toThrow();
    updateNoteStatus(state, supervisor, note.id, "read");
    expect(note.status).toBe("open");
    expect(note.seen_receipts?.map((row) => row.user_id)).toEqual([
      worker.user_id,
      supervisor.user_id,
    ]);
  });
  it.each(["branch_supervisor", "floor_worker"] as RoleId[])(
    "%s gets operational memo and print with retained money kept private",
    (role) => {
      const state = source();
      const actor = authenticatedTestActor(state, role, {
        locations: ["Branch 1"],
      });
      recordPickup(state, actor, "c4-return", pickup);
      const original = structuredClone(state.returns[0].pickup_memos![0]);
      expect(original.lines[0].unit_cost).toBe("10.0000");
      expect(original.expected_credit).toBe("30.00");
      const view = returnView(state, actor, "c4-return");
      expect(view.pickup_memos![0]).not.toHaveProperty("expected_credit");
      expect(view.pickup_memos![0].lines[0]).not.toHaveProperty("unit_cost");
      const memo = returnMemoView(state, actor, "c4-return", original.id);
      const html = renderToStaticMarkup(
        createElement(ReturnMemoDocument, { memo, language: "en" }),
      );
      expect(html).toContain("SIGNED-E1");
      expect(html).toContain("Fictional driver");
      expect(html).not.toContain("Unit cost");
      expect(html).not.toContain("Total credit expected");
      expect(state.returns[0].pickup_memos![0]).toEqual(original);
    },
  );
  it("Manager retains the complete immutable financial supplier memo", () => {
    const state = source();
    const actor = authenticatedTestActor(state, "manager", {
      locations: ["Branch 1"],
    });
    recordPickup(state, actor, "c4-return", pickup);
    const original = state.returns[0].pickup_memos![0];
    const memo = returnMemoView(state, actor, "c4-return", original.id);
    const html = renderToStaticMarkup(
      createElement(ReturnMemoDocument, { memo, language: "en" }),
    );
    expect(memo).toEqual(original);
    expect(html).toContain("Unit cost");
    expect(html).toContain("Total credit expected");
    expect(html).toContain("30.00");
  });
  it("record ID fixes the actual source location even when Manager views an aggregate", () => {
    const state = source();
    const actor = authenticatedTestActor(state, "manager", {
      selection: { kind: "all_locations" },
    });
    recordPickup(state, actor, "c4-return", pickup);
    expect(state.returns[0].pickup_memos![0].branch).toBe("Branch 1");
    expect(state.activity.at(0)?.branch).toBe("Branch 1");
    expect(state.activity.at(0)?.actor_user_id).toBe(actor.user_id);
  });
});
