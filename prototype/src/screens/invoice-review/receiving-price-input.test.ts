import { describe, expect, it } from "vitest";
import { initialState } from "../../e1-bootstrap";
import { authenticatedTestActor } from "../../authority-test-fixture";
import { cloneWithAuthority } from "../../authority";
import { createInvoice, recalculateInvoice } from "../../invoice";
import {
  receivingPriceQuote,
  setInvoiceReceivingPrice,
} from "../../invoice-receiving-price";
import type { ReviewUpdate } from "./types";
import { ReceivingPriceInputQueue } from "./receiving-price-input";

function fixture() {
  let state = initialState();
  const actor = authenticatedTestActor(state, "floor_worker", {
    locations: ["Branch 1"],
  });
  state.invoice = createInvoice(state, actor, "Branch 1");
  state.invoice.status = "review";
  state.invoice.lines = [state.invoice.lines[0]];
  Object.assign(state.invoice.lines[0], {
    unit_cost_before_tax: "1.0000",
    quantity_unit: "units",
    quantity_entered: "1",
    qty_invoiced: 1,
    qty_received_at_posting: 1,
    pricing_category: "grocery",
    sold_by: "each",
  });
  recalculateInvoice(state.invoice, state.config);
  let commands = Promise.resolve();
  let fail = false;
  let afterCommit: (() => void) | undefined;
  const update: ReviewUpdate = <T>(mutate: Parameters<ReviewUpdate>[0]) => {
    const result = commands.then(() => {
      const draft = cloneWithAuthority(state);
      const value = mutate(draft, actor);
      if (fail) {
        fail = false;
        throw new Error("fictional_repository_failure");
      }
      state = draft;
      afterCommit?.();
      return value as T;
    });
    commands = result.then(
      () => undefined,
      () => undefined,
    );
    return result.catch(() => undefined);
  };
  return {
    get state() {
      return state;
    },
    actor,
    update,
    failNext: () => {
      fail = true;
    },
    afterCommit: (fn: () => void) => {
      afterCommit = fn;
    },
  };
}

describe("receiving price input command queue", () => {
  it("submits every rapid keystroke immediately and chains only its own returned tokens", async () => {
    const f = fixture();
    const q = new ReceivingPriceInputQueue();
    q.refresh(receivingPriceQuote(f.state, 0));
    const saved = ["", "1", "1.", "1.7", "1.73"].map((value) =>
      q.save(f.update, 0, value),
    );
    expect(q.pending).toBe(5);
    // A delayed render/focus cannot replace the in-flight owned chain.
    q.refresh("stale_rendered_quote");
    expect(await Promise.all(saved)).toEqual([true, true, true, true, true]);
    expect(await q.settled()).toBe(true);
    expect(q.pending).toBe(0);
    expect(f.state.invoice.lines[0].receiving_price).toMatchObject({
      price: "1.73",
      entered_price: "1.73",
      price_unit: "each",
      calculated_price: "1.99",
    });
    expect(
      f.state.activity.filter((row) => row.action === "Set receiving price"),
    ).toHaveLength(5);
  });

  it("a failed repository save leaves no price or token and can be retried from the visible current quote", async () => {
    const f = fixture();
    const q = new ReceivingPriceInputQueue();
    const original = receivingPriceQuote(f.state, 0);
    q.refresh(original);
    f.failNext();
    expect(await q.save(f.update, 0, "1.73")).toBe(false);
    expect(await q.settled()).toBe(false);
    expect(receivingPriceQuote(f.state, 0)).toBe(original);
    expect(f.state.invoice.lines[0].receiving_price).toBeUndefined();
    expect(
      f.state.activity.filter((row) => row.action === "Set receiving price"),
    ).toHaveLength(0);
    q.refresh(receivingPriceQuote(f.state, 0));
    expect(await q.settled()).toBe(true);
    expect(await q.save(f.update, 0, "1.83")).toBe(true);
    expect(await q.settled()).toBe(true);
    expect(f.state.invoice.lines[0].receiving_price?.price).toBe("1.83");
  });

  it("a failed first commit with another keystroke already queued can retry the latest text from its current quote", async () => {
    const f = fixture();
    const q = new ReceivingPriceInputQueue();
    q.refresh(receivingPriceQuote(f.state, 0));
    f.failNext();
    const first = q.save(f.update, 0, "1.7");
    const last = q.save(f.update, 0, "1.73");
    expect(q.pending).toBe(2);
    expect(await first).toBe(false);
    expect(await last).toBe(false);
    expect(q.pending).toBe(0);
    expect(f.state.invoice.lines[0].receiving_price).toBeUndefined();
    expect(
      f.state.activity.filter((row) => row.action === "Set receiving price"),
    ).toHaveLength(0);
    // Retry is explicit: the person first reviews the current committed value.
    q.refresh(receivingPriceQuote(f.state, 0));
    expect(await q.save(f.update, 0, "1.73")).toBe(true);
    expect(f.state.invoice.lines[0].receiving_price?.price).toBe("1.73");
    expect(await q.settled()).toBe(true);
  });

  it("another receiver between queued edits wins over stale buffered text", async () => {
    const f = fixture();
    const other = authenticatedTestActor(f.state, "manager", {
      locations: ["Branch 1"],
      name_en: "Fictional second receiver",
    });
    const q = new ReceivingPriceInputQueue();
    q.refresh(receivingPriceQuote(f.state, 0));
    let intervened = false;
    f.afterCommit(() => {
      if (intervened) return;
      intervened = true;
      setInvoiceReceivingPrice(
        f.state,
        other,
        0,
        "1.89",
        receivingPriceQuote(f.state, 0),
      );
    });
    const saved = ["1.7", "1.73", "1.75"].map((value) =>
      q.save(f.update, 0, value),
    );
    expect(await Promise.all(saved)).toEqual([true, false, false]);
    expect(await q.settled()).toBe(false);
    expect(f.state.invoice.lines[0].receiving_price).toMatchObject({
      price: "1.89",
      set_by: other.actor,
    });
  });
});
