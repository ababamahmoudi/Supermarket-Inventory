import { describe, expect, it } from "vitest";
import configSeed from "../../seed/arzon-config.json";
import demoSeed from "../../seed/demo-data.json";
import {
  activateOffer,
  applyApprovedPrice,
  approvalSnapshot,
  effectivePool,
  keepApprovedPrice,
  markPriceConflictIntentional,
  offerReadiness,
  proposeManualOverride,
  reconcileOffers,
  resolveApproval,
  syncPriceConflicts,
} from "./approvals";
import {
  effectiveOffer,
  effectivePrice,
  isOfferScheduledNow,
  pendingPrice,
} from "./catalog";
import { createInvoice, postInvoice, recalculateInvoice } from "./invoice";
import { initialState } from "./store";
import type { Approval, DemoState, Offer, Product } from "./types";

function fixture(): DemoState {
  const company_id = configSeed.company.seed_key;
  return {
    version: 1,
    config: structuredClone(configSeed),
    products: demoSeed.products.map(
      (product) => ({ ...product, company_id, status: "active" }) as Product,
    ),
    approvals: [],
    alerts: [],
    invoice: {
      ...structuredClone(demoSeed.demo_invoice),
      branch: "Branch 1",
      company_id,
      id: "invoice:1",
      status: "empty",
      lines: [],
    },
    offers: [],
    templates: [],
    returns: [],
    expiry: [],
    notes: [],
    ledger: [],
    stock: {},
    activity: [],
  };
}

function offer(state: DemoState, values: Partial<Offer> = {}): Offer {
  return {
    id: "offer:juice",
    company_id: state.config.company.seed_key,
    branch: "all",
    scope: "all",
    product_code: "0003",
    label: "2 for $5",
    price: "2.99",
    pool: "2_for_5",
    currency: "CAD",
    mix_and_match: true,
    status: "active",
    ...values,
  };
}

function approval(state: DemoState, values: Partial<Approval> = {}): Approval {
  return {
    id: "approval:lavash",
    company_id: state.config.company.seed_key,
    branch: "Branch 1",
    product_code: "0006",
    status: "pending",
    type: "price_change",
    proposed_price: "2.99",
    current_price: "1.99",
    ...values,
  };
}

function prepareInvoice(state: DemoState, cost?: string): void {
  state.invoice = createInvoice(state, "Branch 1");
  state.invoice.file_name = "fictional-demo.png";
  state.invoice.file_type = "image/png";
  state.invoice.file_data = "data:image/png;base64,ZGVtby1vbmx5";
  state.invoice.lower_price_answers = {
    same_expiry: "unknown",
    note: "Fictional supplier label needs checking.",
  };
  if (cost) {
    state.invoice.lines.find(
      (line) => line.product_code === "0002",
    )!.unit_cost_before_tax = cost;
    recalculateInvoice(state.invoice, state.config);
  }
  state.invoice.lines.forEach((line) => {
    line.review_confirmed = true;
    line.date_confirmed = true;
  });
}

describe("invoice, approval, offer and catalog integration", () => {
  it("uses a posted invoice proposal without changing cashier price until approval and worker offer confirmation", () => {
    const state = initialState();
    prepareInvoice(state);
    postInvoice(state, "floor_worker", "Branch 1");
    const proposal = state.approvals.find(
      (item) => item.product_code === "0006" && item.status === "pending",
    )!;
    const product = state.products.find((item) => item.code === "0006")!;
    expect(proposal.unit_cost).toBe("1.55");
    expect(proposal.invoice_ids).toContain(state.invoice.id);
    expect(effectivePrice(state, product, "Branch 1")).toBe("1.99");
    expect(pendingPrice(state, product, "Branch 1")).toBe("2.99");
    resolveApproval(state, proposal.id, "approve", "branch", "Branch 1");
    expect(effectivePrice(state, product, "Branch 1")).toBe("2.99");
    expect(effectivePrice(state, product, "Branch 2")).toBe("1.99");
    expect(pendingPrice(state, product, "Branch 1")).toBeNull();
    expect(effectiveOffer(state, product, "Branch 1")).toBeNull();
    const suggestion = state.offers.find(
      (item) =>
        item.product_code === product.code &&
        item.branch === "Branch 1" &&
        item.status === "suggested",
    )!;
    activateOffer(state, suggestion, "floor_worker");
    expect(state.activity.at(-1)?.action).toBe("Confirm offer");
    expect(effectiveOffer(state, product, "Branch 1")?.label).toBe("2 for $5");
    expect(
      effectivePool(state, "Branch 1", "2_for_5", "CAD").map(
        (item) => item.code,
      ),
    ).toEqual(expect.arrayContaining(["0003", "0006", "0009"]));
    expect(
      effectivePool(state, "Branch 2", "2_for_5", "CAD").some(
        (item) => item.code === "0006",
      ),
    ).toBe(false);
  });

  it("keeps an invoice margin review out of pending-price lookup and sends an override through normal approval", () => {
    const state = initialState();
    prepareInvoice(state, "1.12");
    postInvoice(state, "floor_worker", "Branch 1");
    const product = state.products.find((item) => item.code === "0002")!;
    const first = state.approvals.find(
      (item) =>
        item.product_code === product.code && item.type === "margin_review",
    )!;
    expect(first.unit_cost).toBe("1.12");
    expect(first.margin).toBeTruthy();
    expect(first.threshold).toBe("0.25");
    expect(pendingPrice(state, product, "Branch 1")).toBeNull();
    keepApprovedPrice(state, first.id, "Keep the agreed shelf price.");
    expect(effectivePrice(state, product, "Branch 1")).toBe("1.49");
    prepareInvoice(state, "1.1201");
    postInvoice(state, "floor_worker", "Branch 1");
    const next = state.approvals.find(
      (item) =>
        item.product_code === product.code &&
        item.type === "margin_review" &&
        item.status === "pending",
    )!;
    const override = proposeManualOverride(
      state,
      next.id,
      "1.99",
      "Cover the received cost.",
    );
    expect(effectivePrice(state, product, "Branch 1")).toBe("1.49");
    expect(pendingPrice(state, product, "Branch 1")).toBe("1.99");
    resolveApproval(state, override.id, "approve", "all", "all");
    expect(effectivePrice(state, product, "Branch 2")).toBe("1.99");
    expect(effectiveOffer(state, product, "Branch 1")).toBeNull();
    expect(
      state.offers.some(
        (item) =>
          item.product_code === product.code &&
          item.scope === "all" &&
          item.status === "suggested",
      ),
    ).toBe(true);
  });
});

describe("approval scopes and prices", () => {
  it("keeps successive Lavash and Barberries approvals isolated by product code", () => {
    const state = initialState();
    const lavash = state.approvals.find(
      (item) => item.product_code === "0006",
    )!;
    const barberries = state.approvals.find(
      (item) => item.product_code === "0015",
    )!;
    resolveApproval(state, lavash.id, "approve", "branch", "Branch 1");
    resolveApproval(state, barberries.id, "approve", "all", "all");
    expect(effectivePrice(state, "0006", "Branch 1")).toBe("2.99");
    expect(effectivePrice(state, "0006", "Branch 2")).toBe("1.99");
    expect(effectivePrice(state, "0015", "Branch 1")).toBe("5.49");
    expect(effectivePrice(state, "0015", "Branch 2")).toBe("5.49");
    expect(effectivePrice(state, "0015", "Branch 3")).toBe("5.49");
  });

  it("keeps cashier charging approved Lavash until the branch proposal is approved", () => {
    const state = fixture();
    state.approvals.push(approval(state));
    const product = state.products.find((item) => item.code === "0006")!;
    product.pending_price = "2.99";
    expect(effectivePrice(state, product, "Branch 1")).toBe("1.99");
    resolveApproval(state, "approval:lavash", "approve", "branch", "Branch 1");
    expect(effectivePrice(state, product, "Branch 1")).toBe("2.99");
    expect(effectivePrice(state, product, "Branch 2")).toBe("1.99");
    expect(product.selling_price).toBe("1.99");
    expect(product.pending_price).toBeNull();
    expect(state.approvals[0].scope).toBe("branch");
  });

  it("all-branch approval removes every override and updates all branches", () => {
    const state = fixture();
    const product = state.products.find((item) => item.code === "0004")!;
    product.branch_prices = {
      "Branch 1": "6.49",
      "Branch 2": "6.99",
      "Branch 3": "7.49",
    };
    state.approvals.push(
      approval(state, { product_code: product.code, proposed_price: "6.99" }),
    );
    resolveApproval(state, "approval:lavash", "approve", "all", "all");
    expect(product.branch_prices).toEqual({});
    expect(
      ["Branch 1", "Branch 2", "Branch 3"].map((branch) =>
        effectivePrice(state, product, branch as "Branch 1"),
      ),
    ).toEqual(["6.99", "6.99", "6.99"]);
    expect(state.alerts.filter((item) => item.status === "pending")).toEqual(
      [],
    );
  });

  it("rejects a stale preview without applying any prices", () => {
    const state = fixture();
    state.approvals.push(approval(state));
    const snapshot = approvalSnapshot(state, "0006");
    state.products.find((item) => item.code === "0006")!.branch_prices = {
      "Branch 2": "3.99",
    };
    expect(() =>
      resolveApproval(
        state,
        "approval:lavash",
        "approve",
        "all",
        "all",
        undefined,
        snapshot,
      ),
    ).toThrow("Prices changed");
    expect(effectivePrice(state, "0006", "Branch 1")).toBe("1.99");
    expect(state.approvals[0].status).toBe("pending");
  });

  it("refreshes a preview when its proposed price changed and logs a completed approval once", () => {
    const state = fixture();
    state.approvals.push(approval(state));
    const snapshot = approvalSnapshot(state, "0006");
    state.approvals[0].proposed_price = "3.99";
    expect(() =>
      resolveApproval(
        state,
        "approval:lavash",
        "approve",
        "all",
        "all",
        undefined,
        snapshot,
      ),
    ).toThrow("Prices changed");
    resolveApproval(
      state,
      "approval:lavash",
      "approve",
      "all",
      "all",
      undefined,
      approvalSnapshot(state, "0006"),
    );
    expect(state.activity).toHaveLength(1);
    expect(state.activity[0].action).toBe("Approve price");
    expect(() =>
      resolveApproval(state, "approval:lavash", "approve", "all", "all"),
    ).toThrow("no longer pending");
    expect(state.activity).toHaveLength(1);
  });

  it("rejecting a new product archives it without reusing its code", () => {
    const state = fixture();
    const product = {
      ...state.products[0],
      code: "0015",
      name_en: "Dried Barberries",
      selling_price: "",
      status: "pending_approval" as const,
      pending_price: "5.49",
    };
    state.products.push(product);
    state.approvals.push(
      approval(state, {
        product_code: "0015",
        type: "new_product",
        proposed_price: "5.49",
      }),
    );
    resolveApproval(state, "approval:lavash", "reject", "all", "all");
    expect(product.status).toBe("archived");
    expect(state.products.some((item) => item.code === "0015")).toBe(true);
    expect(effectivePrice(state, product, "Branch 1")).toBeNull();
  });

  it("isolates records of another company even with an identical product code", () => {
    const state = fixture();
    const foreign = {
      ...state.products.find((item) => item.code === "0006")!,
      company_id: "other-company",
      branch_prices: { "Branch 2": "9.99" },
    };
    state.products.unshift(foreign);
    state.offers.push(
      offer(state, {
        company_id: "other-company",
        product_code: "0006",
        price: "9.99",
      }),
    );
    state.approvals.push(
      approval(state, { id: "foreign", company_id: "other-company" }),
    );
    const before = JSON.stringify(foreign);
    applyApprovedPrice(state, "0006", "2.99", "all", "all");
    expect(JSON.stringify(foreign)).toBe(before);
    expect(state.offers[0].status).toBe("active");
    expect(() =>
      resolveApproval(state, "foreign", "approve", "all", "all"),
    ).toThrow("no longer pending");
  });
});

describe("minimum margin review", () => {
  it("requires a reason to keep the approved price and never changes prices or offers", () => {
    const state = fixture();
    state.offers.push(offer(state));
    state.approvals.push(
      approval(state, {
        type: "margin_review",
        product_code: "0003",
        proposed_price: "2.99",
        unit_cost: "2.30",
        margin: "0.2307",
        threshold: "0.25",
      }),
    );
    const before = JSON.stringify({
      products: state.products,
      offers: state.offers,
    });
    expect(() => keepApprovedPrice(state, "approval:lavash", "  ")).toThrow(
      "Add a reason",
    );
    keepApprovedPrice(state, "approval:lavash", "Keep the agreed shelf price");
    expect(state.approvals[0].status).toBe("approved");
    expect(state.approvals[0].acknowledgment_reason).toBe(
      "Keep the agreed shelf price",
    );
    expect(
      JSON.stringify({ products: state.products, offers: state.offers }),
    ).toBe(before);
  });

  it("manual overrides remain pending and cannot update cashier price before approval", () => {
    const state = fixture();
    state.approvals.push(
      approval(state, {
        type: "margin_review",
        product_code: "0003",
        proposed_price: "2.99",
      }),
    );
    const pending = proposeManualOverride(
      state,
      "approval:lavash",
      "3.99",
      "Cover the new cost",
    );
    expect(pending.type).toBe("price_change");
    expect(pending.manual_override).toBe(true);
    expect(pending.status).toBe("pending");
    expect(effectivePrice(state, "0003", "Branch 1")).toBe("2.99");
    expect(() =>
      proposeManualOverride(state, "approval:lavash", "3.999", "reason"),
    ).toThrow();
  });
});

describe("cross-branch conflict acknowledgment", () => {
  it("acknowledges the seed's two-branch conflict and captures all effective branch prices", () => {
    const state = fixture();
    state.products.find((item) => item.code === "0004")!.branch_prices = {
      "Branch 2": "6.99",
    };
    state.alerts.push({
      id: "seed-conflict",
      company_id: state.config.company.seed_key,
      branch: "all",
      type: "price_conflict",
      product_code: "0004",
      status: "pending",
      branch_prices: { "Branch 1": "6.49", "Branch 2": "6.99" },
    });
    markPriceConflictIntentional(state, "seed-conflict");
    syncPriceConflicts(state, "0004");
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0].status).toBe("intentional");
    expect(state.alerts[0].branch_prices?.["Branch 3"]).toBe("6.49");
  });

  it("quietly remembers exact intentional prices and raises a fresh alert after either changes", () => {
    const state = fixture();
    const product = state.products.find((item) => item.code === "0004")!;
    product.branch_prices = { "Branch 2": "6.99" };
    syncPriceConflicts(state, "0004");
    expect(state.alerts).toHaveLength(1);
    markPriceConflictIntentional(state, state.alerts[0].id);
    syncPriceConflicts(state, "0004");
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0].status).toBe("intentional");
    applyApprovedPrice(state, "0004", "7.49", "branch", "Branch 2");
    expect(
      state.alerts.filter((item) => item.status === "pending"),
    ).toHaveLength(1);
    expect(state.alerts[0].status).toBe("resolved");
    applyApprovedPrice(state, "0004", "6.49", "all", "all");
    expect(state.alerts.every((item) => item.status === "resolved")).toBe(true);
  });
});

describe("offers and mix-and-match", () => {
  it("creates a suggestion after approval and waits for worker confirmation", () => {
    const state = fixture();
    applyApprovedPrice(state, "0006", "2.99", "branch", "Branch 1");
    const suggestion = state.offers.find(
      (item) => item.product_code === "0006" && item.branch === "Branch 1",
    )!;
    expect(suggestion.status).toBe("suggested");
    expect(suggestion.label).toBe("2 for $5");
    expect(effectiveOffer(state, "0006", "Branch 1")).toBeNull();
    activateOffer(state, { ...suggestion, mix_and_match: false });
    expect(effectiveOffer(state, "0006", "Branch 1")?.label).toBe("2 for $5");
    expect(
      effectivePool(state, "Branch 1", "2_for_5", "CAD").some(
        (item) => item.code === "0006",
      ),
    ).toBe(false);
  });

  it("stops incompatible branch offers on unmapped prices while preserving other branches", () => {
    const state = fixture();
    state.offers.push(
      offer(state),
      offer(state, { id: "branch", scope: "branch", branch: "Branch 1" }),
    );
    applyApprovedPrice(state, "0003", "5.49", "branch", "Branch 1");
    expect(state.offers.find((item) => item.id === "branch")!.status).toBe(
      "stopped",
    );
    expect(state.offers.find((item) => item.id === "offer:juice")!.status).toBe(
      "active",
    );
    expect(effectiveOffer(state, "0003", "Branch 1")).toBeNull();
    expect(effectiveOffer(state, "0003", "Branch 2")?.id).toBe("offer:juice");
    expect(
      state.offers.filter(
        (item) =>
          item.product_code === "0003" &&
          item.branch === "Branch 1" &&
          item.status === "suggested",
      ),
    ).toEqual([]);
  });

  it("one branch offer precedes company offer and confirming another stops its predecessor", () => {
    const state = fixture();
    state.offers.push(offer(state));
    activateOffer(
      state,
      offer(state, {
        id: "branch:first",
        scope: "branch",
        branch: "Branch 1",
        mix_and_match: false,
      }),
    );
    activateOffer(
      state,
      offer(state, {
        id: "branch:second",
        scope: "branch",
        branch: "Branch 1",
      }),
    );
    expect(
      state.offers.find((item) => item.id === "branch:first")!.status,
    ).toBe("stopped");
    expect(effectiveOffer(state, "0003", "Branch 1")?.id).toBe("branch:second");
    expect(effectiveOffer(state, "0003", "Branch 2")?.id).toBe("offer:juice");
  });

  it("all-branch approval stops every incompatible offer, deduplicates suggestions, and never reactivates stopped offers", () => {
    const state = fixture();
    const product = state.products.find((item) => item.code === "0003")!;
    product.branch_prices = { "Branch 2": "3.99" };
    state.offers.push(
      offer(state),
      offer(state, {
        id: "branch",
        scope: "branch",
        branch: "Branch 2",
        price: "3.99",
        label: "2 for $7",
        pool: "2_for_7",
      }),
    );
    applyApprovedPrice(state, "0003", "1.99", "all", "all");
    expect(
      state.offers.slice(0, 2).every((item) => item.status === "stopped"),
    ).toBe(true);
    reconcileOffers(state, "0003");
    expect(
      state.offers.filter(
        (item) => item.status === "suggested" && item.product_code === "0003",
      ),
    ).toHaveLength(1);
    applyApprovedPrice(state, "0003", "2.99", "all", "all");
    expect(state.offers[0].status).toBe("stopped");
    expect(effectiveOffer(state, "0003", "Branch 1")).toBeNull();
  });

  it("juice and chips share one pool without mixing branch, company, currency or definition", () => {
    const state = fixture();
    state.offers.push(
      offer(state),
      offer(state, { id: "chips", product_code: "0009" }),
    );
    expect(
      effectivePool(state, "Branch 1", "2_for_5", "CAD").map(
        (item) => item.code,
      ),
    ).toEqual(["0003", "0009"]);
    state.offers.push(
      offer(state, {
        id: "foreign",
        company_id: "other-company",
        product_code: "0002",
      }),
    );
    state.offers.push(
      offer(state, {
        id: "different-currency",
        currency: "USD",
        product_code: "0005",
        price: "1.99",
      }),
    );
    state.offers.push(
      offer(state, {
        id: "different-definition",
        product_code: "0006",
        price: "1.99",
        pool: "3_for_5",
        label: "3 for $5",
      }),
    );
    expect(
      effectivePool(state, "Branch 1", "2_for_5", "CAD").map(
        (item) => item.code,
      ),
    ).toEqual(["0003", "0009"]);
    state.offers[0].scope = "branch";
    state.offers[0].branch = "Branch 1";
    expect(
      effectivePool(state, "Branch 2", "2_for_5", "CAD").map(
        (item) => item.code,
      ),
    ).toEqual(["0009"]);
    expect(effectivePool(state, "Branch 1", "2_for_5", "USD")).toEqual([]);
  });

  it("validates dates and evaluates schedules inclusively in company business time", () => {
    const state = fixture();
    const scheduled = offer(state, {
      start_date: "2026-10-06",
      end_date: "2026-10-07",
    });
    expect(offerReadiness(state, scheduled)).toBe("ready");
    expect(
      offerReadiness(state, { ...scheduled, end_date: "2026-10-05" }),
    ).toBe("dates_invalid");
    expect(
      offerReadiness(state, { ...scheduled, start_date: "2026-02-30" }),
    ).toBe("dates_invalid");
    expect(
      isOfferScheduledNow(
        scheduled,
        "America/Toronto",
        new Date("2026-10-06T02:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isOfferScheduledNow(
        scheduled,
        "America/Toronto",
        new Date("2026-10-06T12:00:00Z"),
      ),
    ).toBe(true);
    expect(
      isOfferScheduledNow(
        scheduled,
        "America/Toronto",
        new Date("2026-10-08T04:00:00Z"),
      ),
    ).toBe(false);
  });
});
