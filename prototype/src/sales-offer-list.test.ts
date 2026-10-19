import { describe, expect, it } from "vitest";
import { initialState } from "./e1-bootstrap";
import {
  offerPausedStores,
  saleListStatus,
  salesOfferRows,
} from "./sales-offer-list";
import type { SaleSchedule } from "./sales";
import {
  catalogTestActor,
  foreignCatalogManager,
} from "./catalog-authority-test-fixture";
import type { DemoState, Offer } from "./types";
import type { AuthenticatedActor } from "./authority-types";
import { projectCatalogReadView } from "./catalog-read-model";
import { projectOffersReadView } from "./offers-read-model";
import { signedOutReadView } from "./e1-read-model";

const now = new Date("2026-10-12T16:00:00Z");
const filters = {
  tab: "offers" as const,
  search: "",
  status: "",
  category: "",
  supplier: "",
  type: "",
};
/** Use the same cost-free projections as the actual public Offers screen. */
function listView(
  state: DemoState,
  actor: AuthenticatedActor = catalogTestActor(state, "manager", "all"),
) {
  return {
    config: signedOutReadView(state.config).config,
    products: projectCatalogReadView(state, actor).products,
    ...projectOffersReadView(state, actor),
  };
}
function fixture() {
  const state = initialState();
  const sale = {
    ...state.sales![0],
    starts_on: "2026-10-08",
    last_day: "2026-10-22",
  };
  state.sales = [sale];
  state.sale_requests = [
    {
      ...state.sale_requests![0],
      starts_on: "2026-10-12",
      last_day: "2026-10-25",
    },
  ];
  const context = catalogTestActor(state, "manager");
  return { state, sale, context };
}

describe("sale offer list boundaries", () => {
  it("combines visible store sales without disclosing another company, unauthorized store or Warehouse", () => {
    const { state, sale } = fixture();
    state.sales!.push(
      { ...sale, id: "another-company", company_id: "another-company" },
      {
        ...sale,
        id: "same-group-rh",
        branch: "Branch 2",
        branch_id: "Branch 2",
      },
      {
        ...sale,
        id: "same-group-nm",
        branch: "Branch 3",
        branch_id: "Branch 3",
      },
      { ...sale, id: "warehouse", branch: "Warehouse", branch_id: "Warehouse" },
    );
    const assignedActor = catalogTestActor(state, "branch_supervisor", "all", {
      locations: ["Branch 1", "Branch 2", "Warehouse"],
      user_id: "test-list-supervisor",
    });
    const rows = salesOfferRows(
      listView(state, assignedActor),
      assignedActor,
      "all",
      filters,
      now,
    );
    const saleRows = rows.filter((row) => row.kind === "sale");
    expect(saleRows).toHaveLength(1);
    expect(saleRows[0].sales.map((item) => item.id)).toEqual([
      sale.id,
      "same-group-rh",
    ]);
    expect(
      salesOfferRows(
        listView(state),
        foreignCatalogManager(state),
        "all",
        filters,
        now,
      ),
    ).toEqual([]);
    expect(salesOfferRows(listView(state), null, "all", filters, now)).toEqual(
      [],
    );
  });
  it("shows a worker only their own pending request and keeps decided/elapsed requests out of Current offers", () => {
    const { state } = fixture();
    const worker = catalogTestActor(state, "floor_worker");
    const otherWorker = catalogTestActor(state, "floor_worker", "Branch 1", {
      user_id: "test-other-worker",
      username: "different-worker",
    });
    const request = state.sale_requests![0];
    request.requester_user_id = worker.user_id;
    state.sale_requests!.push(
      {
        ...request,
        id: "another-worker",
        requester_username: otherWorker.username,
        requester_user_id: otherWorker.user_id,
      },
      { ...request, id: "elapsed", last_day: "2026-10-11" },
      { ...request, id: "decided", status: "approved" },
      { ...request, id: "another-company", company_id: "another-company" },
    );
    const rows = salesOfferRows(
      listView(state, worker),
      worker,
      "all",
      { ...filters, status: "requested" },
      now,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "request",
      request: { id: request.id },
    });
    expect(
      salesOfferRows(listView(state, worker), worker, "Branch 2", filters, now),
    ).toEqual([]);
  });
  it("moves an inclusive last-day sale to Past offers at the store's next midnight even before the scheduler persists status", () => {
    const { state, sale, context } = fixture();
    sale.last_day = "2026-10-12";
    state.sales = [sale];
    expect(
      saleListStatus(listView(state), sale, new Date("2026-10-13T03:59:59Z")),
    ).toBe("active");
    const nextMidnight = new Date("2026-10-13T04:00:00Z");
    expect(
      salesOfferRows(
        listView(state),
        context,
        "Branch 1",
        { ...filters, type: "sale" },
        nextMidnight,
      ).filter((row) => row.kind === "sale"),
    ).toHaveLength(0);
    expect(
      salesOfferRows(
        listView(state),
        context,
        "Branch 1",
        { ...filters, tab: "past", type: "sale" },
        nextMidnight,
      ),
    ).toMatchObject([{ kind: "sale", sales: [{ id: sale.id }] }]);
    expect(sale.status).toBe("active");
  });
  it("combines search/category/supplier/status/type filters without adding sale rows to multi-buy or clearance results", () => {
    const { state, context } = fixture();
    const product = state.products.find(
      (item) => item.code === state.sales![0].product_code,
    )!;
    const matches = {
      ...filters,
      search: product.name_en.split(" ")[0],
      category: product.ai_category,
      supplier: product.main_supplier,
      status: "active",
      type: "sale",
    };
    expect(
      salesOfferRows(listView(state), context, "Branch 1", matches, now),
    ).toHaveLength(1);
    expect(
      salesOfferRows(
        listView(state),
        context,
        "Branch 1",
        { ...matches, type: "multi_buy" },
        now,
      ),
    ).toHaveLength(0);
    expect(
      salesOfferRows(
        listView(state),
        context,
        "Branch 1",
        { ...matches, type: "clearance" },
        now,
      ),
    ).toHaveLength(0);
    expect(
      salesOfferRows(
        listView(state),
        context,
        "Branch 1",
        { ...matches, supplier: "another supplier" },
        now,
      ),
    ).toHaveLength(0);
  });
  it("reports a paused company multi-buy only at the selling store with a live sale, while retaining the record and independent clearance", () => {
    const { state, sale, context } = fixture();
    const offer: Offer = {
      id: "retained-multibuy",
      company_id: context.company_id,
      branch: "all",
      scope: "all",
      product_code: sale.product_code,
      label: "2 for $5",
      price: "2.99",
      pool: "2_for_5",
      currency: "CAD",
      mix_and_match: true,
      status: "active",
    };
    const before = structuredClone(offer);
    expect(
      offerPausedStores(
        listView(state),
        offer,
        "all",
        context.allowed_branches,
        now,
      ),
    ).toEqual(["Branch 1"]);
    expect(
      offerPausedStores(
        listView(state),
        offer,
        "Branch 2",
        context.allowed_branches,
        now,
      ),
    ).toEqual([]);
    expect(
      offerPausedStores(
        listView(state),
        { ...offer, clearance: true },
        "Branch 1",
        context.allowed_branches,
        now,
      ),
    ).toEqual([]);
    expect(
      offerPausedStores(
        listView(state),
        offer,
        "Branch 1",
        context.allowed_branches,
        new Date("2026-10-23T16:00:00Z"),
      ),
    ).toEqual([]);
    expect(offer).toEqual(before);
  });
  it("keeps future and historical sale records visible in their proper tabs with newest endings first", () => {
    const { state, sale, context } = fixture();
    const future: SaleSchedule = {
      ...sale,
      id: "future",
      group_id: "future-group",
      starts_on: "2026-10-24",
      last_day: "2026-10-31",
      status: "scheduled",
    };
    state.sales!.push(
      future,
      {
        ...sale,
        id: "old",
        group_id: "old-group",
        status: "ended",
        ended_at: "2026-10-08T12:00:00Z",
      },
      {
        ...sale,
        id: "newer",
        group_id: "new-group",
        status: "ended",
        ended_at: "2026-10-10T12:00:00Z",
      },
    );
    expect(
      salesOfferRows(
        listView(state),
        context,
        "Branch 1",
        { ...filters, status: "scheduled" },
        now,
      ),
    ).toMatchObject([{ sales: [{ id: "future" }] }]);
    const past = salesOfferRows(
      listView(state),
      context,
      "Branch 1",
      { ...filters, tab: "past" },
      now,
    );
    expect(past.map((row) => row.kind === "sale" && row.sales[0].id)).toEqual([
      "newer",
      "old",
    ]);
  });
});
