import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { authenticatedTestActor } from "./authority-test-fixture";
import { canInvoiceAuthority } from "./invoice-authority";
import {
  createInvoice,
  demoSaleCostInvoice,
  invoiceBlockers,
  postInvoice,
  receiveShort,
} from "./invoice";
import { receivedLog, setInvoiceLocation } from "./received";
import { bindAuthoritySnapshot, authoritySnapshot } from "./authority";
function prepared() {
  const state = initialState();
  const actor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
    selection: { kind: "location", location_id: "Branch 1" },
  });
  state.invoice = demoSaleCostInvoice(state, actor, "Branch 1");
  state.invoice.receiving_employee = actor.actor;
  state.invoice.file_name = "actual-demo-source.png";
  state.invoice.file_type = "image/png";
  state.invoice.file_data = "data:image/png;base64,ZGVtbw==";
  state.invoice.lines.forEach((line) => {
    line.review_confirmed = true;
    line.date_tracking = false;
    line.date_confirmed = true;
  });
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Retain actual receiving evidence",
  };
  return { state, actor };
}
describe("retained canonical handling-origin receiving", () => {
  it("allows the actual own-invoice Floor Worker to choose Warehouse and post once while Received browsing stays assigned", () => {
    const { state, actor } = prepared();
    expect(actor.allowed_branches).toEqual(["Branch 1"]);
    expect(state.invoice.created_by_user_id).toBe(actor.user_id);
    setInvoiceLocation(state, actor, "Warehouse");
    expect(state.invoice).toMatchObject({
      branch: "Warehouse",
      handling_branch: "Branch 1",
      reviewer_origin_location_id: "Branch 1",
    });
    state.invoice.lines.forEach((line) => {
      line.review_confirmed = true;
    });
    expect(invoiceBlockers(state, actor)).toEqual([]);
    expect(postInvoice(state, actor)).toBe(true);
    const id = state.invoice.id;
    expect(state.invoices?.find((row) => row.id === id)).toMatchObject({
      status: "posted",
      branch: "Warehouse",
    });
    expect(
      state.ledger.filter((row) => row.id === `${id}:posted`),
    ).toHaveLength(1);
    expect(canInvoiceAuthority(state, actor, "invoices.read", id)).toBe(false);
    expect(receivedLog(state, actor, { search: "HW-5012" })).toEqual([]);
    const manager = authenticatedTestActor(state, "manager", {
      selection: { kind: "location", location_id: "Warehouse" },
    });
    expect(receivedLog(state, manager, { search: "HW-5012" })).toHaveLength(1);
    expect(() =>
      receiveShort(state, "0009", 1, "unassigned-later-short", actor),
    ).toThrow();
  });
  it.each(["creator", "handler", "reviewer"] as const)(
    "uses the canonical %s user ID rather than a caption to authorize the unposted invoice",
    (kind) => {
      const { state, actor } = prepared();
      state.invoice.created_by_user_id =
        kind === "creator" ? actor.user_id : "other-user";
      state.invoice.handler_user_ids =
        kind === "handler" ? [actor.user_id] : [];
      state.invoice.reviewer_user_ids =
        kind === "reviewer" ? [actor.user_id] : [];
      setInvoiceLocation(state, actor, "Warehouse");
      expect(
        canInvoiceAuthority(
          state,
          actor,
          "invoices.post",
          state.invoice.id,
          true,
        ),
      ).toBe(true);
    },
  );
  it.each([
    "unrelated",
    "inactive-origin",
    "inactive-destination",
    "unknown-destination",
    "foreign-company",
    "revoked",
  ] as const)(
    "rejects %s before changing invoice, money or physical evidence",
    (kind) => {
      const { state, actor } = prepared();
      let destination = "Warehouse";
      if (kind === "unrelated") {
        state.invoice.created_by_user_id = "other-user";
        state.invoice.handler_user_ids = [];
        state.invoice.reviewer_user_ids = [];
        state.invoice.branch = "Warehouse";
      }
      if (kind === "inactive-origin") {
        state.config.branches[0].active = false;
        state.invoice.branch = "Warehouse";
      }
      if (kind === "inactive-destination")
        state.config.branches.find(
          (row) => row.name_en === "Warehouse",
        )!.active = false;
      if (kind === "unknown-destination")
        destination = "other-company-warehouse";
      if (kind === "foreign-company")
        state.invoice.company_id = "other-company";
      if (kind === "revoked") {
        const snapshot = structuredClone(authoritySnapshot(state));
        snapshot.sessions.find((row) => row.id === actor.session_id)!.state =
          "revoked";
        bindAuthoritySnapshot(state, snapshot);
      }
      const before = JSON.stringify(state);
      expect(() => setInvoiceLocation(state, actor, destination)).toThrow();
      expect(JSON.stringify(state)).toBe(before);
    },
  );
  it("does not grant Branch Supervisor or Cashier the Floor Worker origin exception", () => {
    for (const role of ["branch_supervisor", "cashier"] as const) {
      const { state } = prepared();
      const actor = authenticatedTestActor(state, role, {
        locations: ["Branch 1"],
      });
      state.invoice.created_by_user_id = actor.user_id;
      state.invoice.handler_user_ids = [actor.user_id];
      const before = JSON.stringify(state);
      expect(() => setInvoiceLocation(state, actor, "Warehouse")).toThrow();
      expect(JSON.stringify(state)).toBe(before);
      expect(() => createInvoice(state, actor, "Warehouse")).toThrow();
    }
  });
});
