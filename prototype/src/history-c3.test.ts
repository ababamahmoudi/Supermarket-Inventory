import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import {
  attachReversals,
  reverseActivity,
  type HistoryContext,
} from "./history";
import { configuredBranches, saveCompanySettings } from "./settings";
import {
  saveBranchRequestDraft,
  sendBranchRequest,
  markBranchRequestSent,
  markBranchRequestReceived,
  closeBranchRequest,
  cancelBranchRequest,
  copyBranchRequestResidual,
  type BranchRequestContext,
} from "./branch-requests";
import {
  createOrder,
  saveOrderDraft,
  placeOrder,
  cancelOrder,
  type OrderContext,
} from "./orders";
import { supplierRecords, confirmSupplier } from "./supplier-editor";
import { addNote } from "./operations";
import { activateOffer, resolveApproval, stopOffer } from "./approvals";
import { addLabelsToWaitlist, editLabelWaitlist } from "./label-workflow";
import {
  addNotebookEntry,
  archiveNotebook,
  editNotebookEntry,
} from "./notebooks";
import { saveSupplierItem } from "./supplier-items";
import type { Activity, DemoState } from "./types";

function supervisor(state: DemoState): HistoryContext {
  return {
    company_id: state.config.company.seed_key,
    branch: "all",
    role: "supervisor",
    actor: "Undo Supervisor",
    username: "supervisor",
    allowed_branches: configuredBranches(state.config, true),
  };
}
function capture(
  state: DemoState,
  context: HistoryContext,
  mutate: () => void,
): Activity {
  const before = structuredClone(state);
  mutate();
  const entries = attachReversals(before, state, context);
  const reversible = entries.filter((entry) => entry.reversible);
  expect(reversible).toHaveLength(1);
  return reversible[0];
}
function requestFixture(freeText = false) {
  const state = initialState();
  state.branch_requests = [];
  state.request_transfer_events = [];
  const worker = (branch: string): HistoryContext & BranchRequestContext => ({
    company_id: state.config.company.seed_key,
    branch,
    allowed_branches: [branch],
    role: "floor_worker",
    actor: `Worker ${branch}`,
    username: `worker-${branch}`,
  });
  const source = worker("Branch 1"),
    target = worker("Branch 2");
  const draft = saveBranchRequestDraft(state, source, {
    from_branch: source.branch,
    to_branch: target.branch,
    items: [
      freeText
        ? {
            kind: "free_text",
            free_text: "Paper bags",
            quantity: "3",
            quantity_unit: "cases",
          }
        : {
            kind: "catalog",
            product_code: state.products[0].code,
            quantity: "2",
            quantity_unit: "cases",
            units_per_case: 12,
          },
    ],
  });
  return { state, source, target, id: draft.id };
}
function orderFixture() {
  const state = initialState();
  state.orders = [];
  const context: HistoryContext & OrderContext = supervisor(state);
  const supplier = supplierRecords(state).find(
    (item) => item.active && item.status === "confirmed",
  )!;
  state.supplier_items = [
    {
      id: "undo-item",
      company_id: context.company_id,
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      product_code: state.products[0].code,
      supplier_item_code: "UNDO-1",
      units_per_case: 12,
      quoted_unit_cost_before_tax: "2.5000",
      quoted_by: context.actor,
      quoted_at: "2026-10-09T10:00:00Z",
      created_at: "2026-10-09T10:00:00Z",
      created_by: context.actor,
    },
  ];
  const input = {
    branch: "Branch 1",
    supplier: supplier.name,
    lines: [{ supplier_item_id: "undo-item", cases: "1" }],
  };
  return { state, context, input };
}

describe("C3 request Undo preserves evidence and endpoint permissions", () => {
  it("retains a newly saved draft as Cancelled with its permanent reference", () => {
    const { state, source } = requestFixture();
    let id = "";
    const entry = capture(state, source, () => {
      id = saveBranchRequestDraft(state, source, {
        from_branch: "Branch 1",
        to_branch: "Branch 2",
        items: [
          {
            kind: "free_text",
            free_text: "Bread",
            quantity: "2",
            quantity_unit: "units",
          },
        ],
      }).id;
    });
    const reference = state.branch_requests!.find(
      (item) => item.id === id,
    )!.reference;
    reverseActivity(state, source, entry.id, "undo");
    expect(state.branch_requests!.find((item) => item.id === id)).toMatchObject(
      { status: "cancelled", reference, revision: 2 },
    );
    expect(state.request_transfer_events).toEqual([]);
  });
  it("undoes sending a request and keeps revisions monotonic", () => {
    const { state, source, id } = requestFixture();
    const entry = capture(state, source, () =>
      sendBranchRequest(state, source, id, 1),
    );
    reverseActivity(state, source, entry.id, "undo");
    expect(state.branch_requests![0]).toMatchObject({
      status: "draft",
      revision: 3,
    });
    expect(() => sendBranchRequest(state, source, id, 1)).toThrow("stale");
    expect(state.request_transfer_events).toEqual([]);
  });
  it.each([false, true])(
    "undoes a sent %s request through its sender, retaining signed recording corrections",
    (freeText) => {
      const { state, source, target, id } = requestFixture(freeText);
      sendBranchRequest(state, source, id, 1);
      const originalMovements = structuredClone(state.stock_movements);
      const entry = capture(state, target, () =>
        markBranchRequestSent(state, target, id, 2, [
          { item_id: state.branch_requests![0].items[0].id, decision: "sent" },
        ]),
      );
      const event = structuredClone(state.request_transfer_events![0]);
      const ledger = structuredClone(state.ledger),
        stock = structuredClone(state.stock);
      reverseActivity(state, target, entry.id, "undo");
      expect(state.branch_requests![0]).toMatchObject({
        status: "requested",
        revision: 4,
      });
      expect(state.request_transfer_events![0]).toEqual(event);
      expect(state.request_transfer_events![1]).toMatchObject({
        kind: "transfer_correction",
        reverses_event_id: event.id,
        quantity: freeText ? "-3" : "-2",
        normalized_units: freeText ? null : -24,
        branch: "Branch 2",
        username: target.username,
      });
      expect(state.ledger).toEqual(ledger);
      expect(state.stock).toEqual(stock);
      if (freeText) expect(state.stock_movements).toEqual(originalMovements);
      else {
        expect(state.stock_movements!.at(-2)).toMatchObject({
          id: event.id,
          qty: -24,
          type: "transfer_sent",
        });
        expect(state.stock_movements!.at(-1)).toMatchObject({
          qty: 24,
          type: "request_transfer_correction",
          reference: event.id,
        });
      }
      expect(state.activity.at(-1)).toMatchObject({
        action: "Undone",
        reversible: false,
        reversed_activity_id: entry.id,
      });
      expect(() => reverseActivity(state, target, entry.id, "undo")).toThrow(
        "irreversible",
      );
      markBranchRequestSent(state, target, id, 4, [
        {
          item_id: state.branch_requests![0].items[0].id,
          decision: "sent",
        },
      ]);
      expect(state.request_transfer_events![0]).toEqual(event);
      expect(state.request_transfer_events).toHaveLength(3);
      expect(
        state.request_transfer_events!.reduce(
          (total, item) => total + Number(item.quantity),
          0,
        ),
      ).toBe(freeText ? 3 : 2);
    },
  );
  it("undoes receiving only, retaining the earlier sending evidence and later unrelated payment", () => {
    const { state, source, target, id } = requestFixture();
    sendBranchRequest(state, source, id, 1);
    markBranchRequestSent(state, target, id, 2, [
      { item_id: state.branch_requests![0].items[0].id, decision: "sent" },
    ]);
    const sent = structuredClone(state.request_transfer_events![0]);
    const entry = capture(state, source, () =>
      markBranchRequestReceived(state, source, id, 3, [
        {
          item_id: state.branch_requests![0].items[0].id,
          decision: "received",
        },
      ]),
    );
    const received = structuredClone(state.request_transfer_events![1]);
    state.ledger.push({
      ...state.ledger[0],
      id: "independent-payment",
      type: "payment",
      amount: "-9.00",
    });
    const ledger = structuredClone(state.ledger),
      invoices = structuredClone(state.invoices);
    reverseActivity(state, source, entry.id, "undo");
    expect(state.branch_requests![0]).toMatchObject({
      status: "sent",
      revision: 5,
    });
    expect(state.request_transfer_events!.slice(0, 2)).toEqual([
      sent,
      received,
    ]);
    expect(state.request_transfer_events![2]).toMatchObject({
      reverses_event_id: received.id,
      kind: "transfer_correction",
      normalized_units: -24,
    });
    expect(state.ledger).toEqual(ledger);
    expect(state.invoices).toEqual(invoices);
  });
  it("undoes closing without altering any physical evidence", () => {
    const { state, source, target, id } = requestFixture();
    sendBranchRequest(state, source, id, 1);
    markBranchRequestSent(state, target, id, 2, [
      { item_id: state.branch_requests![0].items[0].id, decision: "sent" },
    ]);
    markBranchRequestReceived(state, source, id, 3, [
      { item_id: state.branch_requests![0].items[0].id, decision: "received" },
    ]);
    const entry = capture(state, source, () =>
      closeBranchRequest(state, source, id, 4),
    );
    const evidence = structuredClone(state.request_transfer_events);
    reverseActivity(state, source, entry.id, "undo");
    expect(state.branch_requests![0]).toMatchObject({
      status: "received",
      revision: 6,
    });
    expect(state.request_transfer_events).toEqual(evidence);
  });
  it("restores a cancelled draft, retaining cancellation audit", () => {
    const { state, source, id } = requestFixture();
    const entry = capture(state, source, () =>
      cancelBranchRequest(state, source, id, 1, "Entered twice"),
    );
    reverseActivity(state, source, entry.id, "undo");
    expect(state.branch_requests![0]).toMatchObject({
      status: "draft",
      revision: 3,
    });
    expect(state.activity).toContainEqual(
      expect.objectContaining({ id: entry.id, action: "Cancel request" }),
    );
  });
  it("keeps a residual-copy reference cancelled on Undo, leaving its original unchanged", () => {
    const { state, source, target, id } = requestFixture();
    sendBranchRequest(state, source, id, 1);
    markBranchRequestSent(state, target, id, 2, [
      {
        item_id: state.branch_requests![0].items[0].id,
        decision: "short",
        sent_quantity: "1",
      },
    ]);
    const original = structuredClone(state.branch_requests![0]);
    const entry = capture(state, source, () =>
      copyBranchRequestResidual(state, source, id, 3),
    );
    reverseActivity(state, source, entry.id, "undo");
    expect(state.branch_requests![0]).toEqual(original);
    expect(state.branch_requests![1]).toMatchObject({
      source_request_id: id,
      status: "cancelled",
    });
  });
  it.each(["received", "residual", "physical edit"])(
    "refuses sent Undo after %s without partial mutation",
    (later) => {
      const { state, source, target, id } = requestFixture();
      sendBranchRequest(state, source, id, 1);
      const entry = capture(state, target, () =>
        markBranchRequestSent(state, target, id, 2, [
          {
            item_id: state.branch_requests![0].items[0].id,
            decision: "short",
            sent_quantity: "1",
          },
        ]),
      );
      if (later === "received")
        markBranchRequestReceived(state, source, id, 3, [
          {
            item_id: state.branch_requests![0].items[0].id,
            decision: "received",
          },
        ]);
      else if (later === "residual")
        copyBranchRequestResidual(state, source, id, 3);
      else state.request_transfer_events![0].quantity = "7";
      const before = structuredClone(state);
      expect(() => reverseActivity(state, target, entry.id, "undo")).toThrow(
        "conflict",
      );
      expect(state).toEqual(before);
    },
  );
  it("refuses another employee, company, Cashier and a different acting endpoint", () => {
    const { state, source, target, id } = requestFixture();
    sendBranchRequest(state, source, id, 1);
    const entry = capture(state, target, () =>
      markBranchRequestSent(state, target, id, 2, [
        { item_id: state.branch_requests![0].items[0].id, decision: "sent" },
      ]),
    );
    for (const context of [
      { ...target, username: "other" },
      { ...target, company_id: "foreign" },
      { ...target, role: "cashier" as const },
      {
        ...target,
        branch: "Branch 1",
        allowed_branches: ["Branch 1", "Branch 2"],
      },
    ]) {
      const before = structuredClone(state);
      expect(() => reverseActivity(state, context, entry.id, "undo")).toThrow();
      expect(state).toEqual(before);
    }
  });
});

describe("C3 draft-order and approval Undo", () => {
  it("restores an approved price, related offers and pending decision without touching money", () => {
    const state = initialState(),
      context = supervisor(state);
    const approval = state.approvals[0];
    const product = structuredClone(
      state.products.find((item) => item.code === approval.product_code),
    );
    const offers = structuredClone(state.offers),
      ledger = structuredClone(state.ledger);
    const entry = capture(state, context, () =>
      resolveApproval(state, approval.id, "approve", "all", "Branch 1"),
    );
    reverseActivity(state, context, entry.id, "undo");
    expect(
      state.products.find((item) => item.code === approval.product_code),
    ).toEqual(product);
    expect(
      state.approvals.find((item) => item.id === approval.id)!.status,
    ).toBe("pending");
    expect(state.offers.filter((item) => item.status !== "stopped")).toEqual(
      offers.filter((item) => item.status !== "stopped"),
    );
    expect(state.ledger).toEqual(ledger);
  });
  it("lets a worker undo create and stop offer independently", () => {
    const state = initialState(),
      context = {
        ...supervisor(state),
        role: "floor_worker" as const,
        branch: "Branch 1",
        allowed_branches: ["Branch 1"],
        actor: "Offer Worker",
        username: "floorworker",
      };
    const offer = {
      ...state.offers[0],
      id: "c3-worker-created",
      branch: "Branch 1",
      scope: "branch" as const,
    };
    const created = capture(state, context, () =>
      activateOffer(state, offer, "floor_worker"),
    );
    reverseActivity(state, context, created.id, "undo");
    expect(state.offers.find((item) => item.id === offer.id)!.status).toBe(
      "stopped",
    );
    activateOffer(state, offer, "floor_worker");
    const stopped = capture(state, context, () =>
      stopOffer(state, offer.id, false, "floor_worker"),
    );
    reverseActivity(state, context, stopped.id, "undo");
    expect(state.offers.find((item) => item.id === offer.id)!.status).toBe(
      "active",
    );
  });
  it("undoes waitlist addition/removal without altering another location's queue", () => {
    const state = initialState(),
      context = { ...supervisor(state), branch: "Branch 1" };
    const actor = {
      name: context.actor,
      role: context.role,
      branch: context.branch,
    };
    const other = structuredClone(
      state.label_waitlist!.filter((item) => item.branch !== "Branch 1"),
    );
    const added = capture(state, context, () =>
      addLabelsToWaitlist(
        state,
        [state.products[0].code],
        2,
        "Branch 1",
        actor,
      ),
    );
    reverseActivity(state, context, added.id, "undo");
    expect(
      state.label_waitlist!.filter((item) => item.branch !== "Branch 1"),
    ).toEqual(other);
    addLabelsToWaitlist(state, [state.products[0].code], 2, "Branch 1", actor);
    const row = state.label_waitlist!.find(
      (item) => item.branch === "Branch 1",
    )!;
    const removed = capture(state, context, () =>
      editLabelWaitlist(state, row.id, null, "Branch 1", actor),
    );
    reverseActivity(state, context, removed.id, "undo");
    expect(state.label_waitlist).toContainEqual(row);
  });
  it("undoes note editing and notebook archival while preserving the original author", () => {
    const state = initialState(),
      context = { ...supervisor(state), branch: "Branch 1" };
    const notebook = state.notebooks![0];
    const record = addNotebookEntry(state, context, notebook.id, {
      text: "Initial check",
    });
    const original = structuredClone(record);
    const edited = capture(state, context, () =>
      editNotebookEntry(
        state,
        context,
        record.id,
        { text: "Rechecked" },
        JSON.stringify(record),
      ),
    );
    reverseActivity(state, context, edited.id, "undo");
    expect(
      state.notebook_entries!.find((item) => item.id === record.id),
    ).toEqual(original);
    const archived = capture(state, context, () =>
      archiveNotebook(state, context, notebook.id),
    );
    reverseActivity(state, context, archived.id, "undo");
    expect(
      state.notebooks!.find((item) => item.id === notebook.id)!.archived,
    ).toBe(false);
  });
  it("undoes supplier item metadata and settings without rewriting bought history", () => {
    const { state, context } = orderFixture();
    const item = state.supplier_items![0],
      original = structuredClone(item);
    const edited = capture(state, context, () =>
      saveSupplierItem(
        state,
        context,
        item.supplier_name,
        {
          product_code: item.product_code,
          supplier_item_code: "UPDATED",
          units_per_case: 6,
          quoted_unit_cost_before_tax: "3.0000",
        },
        item.id,
      ),
    );
    reverseActivity(state, context, edited.id, "undo");
    expect(state.supplier_items![0]).toEqual(original);
    const oldName = state.config.company.name_en;
    const changed = capture(state, context, () =>
      saveCompanySettings(
        state,
        { ...state.config.company, name_en: "Updated company" },
        {
          company_id: context.company_id,
          by: context.actor,
          role: context.role,
        },
      ),
    );
    reverseActivity(state, context, changed.id, "undo");
    expect(state.config.company.name_en).toBe(oldName);
  });
  it("retains a new draft reference and cancels the draft on Undo", () => {
    const { state, context, input } = orderFixture();
    const entry = capture(state, context, () =>
      createOrder(state, context, input),
    );
    const reference = state.orders![0].reference;
    reverseActivity(state, context, entry.id, "undo");
    expect(state.orders![0]).toMatchObject({
      status: "cancelled",
      reference,
      version: 2,
    });
    expect(createOrder(state, context, input).reference).not.toBe(reference);
  });
  it("restores a draft edit and a cancelled draft with fresh versions", () => {
    const { state, context, input } = orderFixture();
    const order = createOrder(state, context, input);
    const entry = capture(state, context, () =>
      saveOrderDraft(
        state,
        context,
        order.id,
        { ...input, lines: [{ ...input.lines[0], cases: "2" }] },
        1,
      ),
    );
    reverseActivity(state, context, entry.id, "undo");
    expect(state.orders![0]).toMatchObject({ status: "draft", version: 3 });
    expect(state.orders![0].lines[0].ordered_cases).toBe("1");
    const cancelled = capture(state, context, () =>
      cancelOrder(state, context, order.id, "Duplicate", 3),
    );
    reverseActivity(state, context, cancelled.id, "undo");
    expect(state.orders![0]).toMatchObject({ status: "draft", version: 5 });
  });
  it("atomically restores placed order and its source To order note without freeing the reference", () => {
    const { state, context, input } = orderFixture();
    const note = state.notes.find(
      (item) => item.type === "to_order" && item.branch === "Branch 1",
    )!;
    note.product_code = state.products[0].code;
    const order = createOrder(state, context, {
      ...input,
      source_note_ids: [note.id],
      lines: [{ ...input.lines[0], source_note_ids: [note.id] }],
    });
    const entry = capture(state, context, () =>
      placeOrder(state, context, order.id, 1),
    );
    expect(note.status).toBe("ordered");
    const ledger = structuredClone(state.ledger);
    reverseActivity(state, context, entry.id, "undo");
    expect(state.orders![0]).toMatchObject({
      status: "draft",
      reference: order.reference,
      version: 3,
    });
    expect(state.notes.find((item) => item.id === note.id)!.status).toBe(
      "open",
    );
    expect(state.ledger).toEqual(ledger);
    expect(
      state.activity.find((item) => item.action === "To order note ordered")!
        .reversible,
    ).toBe(false);
  });
  it("refuses draft Undo after a posted receipt even if an order projection has not yet changed", () => {
    const { state, context, input } = orderFixture();
    const order = createOrder(state, context, input);
    const entry = capture(state, context, () =>
      placeOrder(state, context, order.id, 1),
    );
    state.invoices!.push({
      ...structuredClone(state.invoice),
      id: "later-posted",
      status: "posted",
      order_id: order.id,
    });
    const before = structuredClone(state);
    expect(() => reverseActivity(state, context, entry.id, "undo")).toThrow(
      "conflict",
    );
    expect(state).toEqual(before);
  });
  it("does not offer Undo for cancelling an already ordered purchase order", () => {
    const { state, context, input } = orderFixture();
    const order = createOrder(state, context, input);
    placeOrder(state, context, order.id, 1);
    const before = structuredClone(state);
    cancelOrder(state, context, order.id, "Supplier cannot supply", 2);
    expect(
      attachReversals(before, state, context).every(
        (entry) => !entry.reversible,
      ),
    ).toBe(true);
  });
  it("offers scoped rejection Undo and restores the pending approval", () => {
    const state = initialState(),
      context = supervisor(state);
    const approval = state.approvals[0];
    const entry = capture(state, context, () =>
      resolveApproval(state, approval.id, "reject", "all", "Branch 1"),
    );
    reverseActivity(state, context, entry.id, "undo");
    expect(
      state.approvals.find((item) => item.id === approval.id)!.status,
    ).toBe("pending");
  });
  it("archives an added ordinary note while preserving later independent notes", () => {
    const state = initialState(),
      context = { ...supervisor(state), branch: "Branch 1" };
    const entry = capture(state, context, () =>
      addNote(state, context, {
        type: "note_to_supervisor",
        text: "Clean the display",
      }),
    );
    const id = state.notes[0].id;
    addNote(state, context, {
      type: "note_to_supervisor",
      text: "Later independent note",
    });
    reverseActivity(state, context, entry.id, "undo");
    expect(state.notes.find((item) => item.id === id)).toMatchObject({
      archived: true,
      text: "Clean the display",
    });
    expect(state.notes[0].text).toBe("Later independent note");
  });
  it("undoes supplier confirmation across draft flags while retaining historical posted invoices", () => {
    const state = initialState(),
      context = supervisor(state);
    const supplier = state.suppliers![0];
    supplier.status = "proposed";
    state.invoice = {
      ...state.invoice,
      supplier: supplier.name,
      status: "draft",
      supplier_confirmed: false,
    };
    state.invoices!.push({
      ...structuredClone(state.invoice),
      id: "saved-draft",
    });
    const posted = structuredClone(
      state.invoices!.filter((item) => item.status === "posted"),
    );
    const entry = capture(state, context, () =>
      confirmSupplier(state, context, supplier.id),
    );
    reverseActivity(state, context, entry.id, "undo");
    expect(state.suppliers![0].status).toBe("proposed");
    expect(state.invoice.supplier_confirmed).toBe(false);
    expect(
      state.invoices!.find((item) => item.id === "saved-draft")!
        .supplier_confirmed,
    ).toBe(false);
    expect(state.invoices!.filter((item) => item.status === "posted")).toEqual(
      posted,
    );
  });
});
