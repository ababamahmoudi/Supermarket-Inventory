import { expect, it } from "vitest";
import { returnCreateFixture } from "./return-create-test-fixture";
import { authenticatedTestActor } from "./authority-test-fixture";
import { lookupProductSignals } from "./lookup-signals";
import { emptyLookupFilters, matchesLookupFilters } from "./lookup-filters";
import { projectProductReadDTO } from "./catalog-read-model";
const now = new Date("2026-10-27T18:00:00Z");
function fixture() {
  const state = returnCreateFixture();
  const product = state.products.find((row) => row.code === "0003")!;
  state.price_update_tasks = [];
  state.invoices![0].received_at = "2026-10-27T14:00:00Z";
  product.date_tracking = true;
  product.date_reminder_days = 5;
  product.price_provenance = {
    "Branch 1": {
      invoice_number: "",
      calculated_price: "2.99",
      changed_price: "2.99",
      changed_at: now.toISOString(),
    },
  };
  state.expiry = [
    {
      id: "fictional-due",
      company_id: product.company_id,
      branch: "Branch 1",
      product_code: product.code,
      date: "2026-10-29",
      expires_in_days: 2,
      status: "active",
    },
  ];
  const actor = authenticatedTestActor(state, "cashier", {
    locations: ["Branch 1"],
    now,
  });
  const signals = () =>
    lookupProductSignals(state, actor, now).find(
      (row) => row.code === product.code,
    )!;
  return { state, product, actor, signals };
}
it("C11 public signals combine current-branch offer, open reminder, actual arrival and price window", () => {
  const { state, actor, product, signals } = fixture();
  const flags = signals();
  expect(flags).toEqual({
    code: "0003",
    onOffer: true,
    expiringSoon: true,
    arrivedToday: true,
    priceChangedRecently: true,
  });
  expect(Object.keys(flags).sort()).toEqual([
    "arrivedToday",
    "code",
    "expiringSoon",
    "onOffer",
    "priceChangedRecently",
  ]);
  const filters = {
    ...emptyLookupFilters,
    category: product.ai_category,
    pricingCategory: product.pricing_category,
    onOffer: true,
    expiringSoon: true,
    arrivedToday: true,
    priceChangedRecently: true,
  };
  const publicProduct = projectProductReadDTO(state, actor, product);
  expect(
    matchesLookupFilters(
      state.config,
      publicProduct,
      filters,
      undefined,
      false,
      flags,
    ),
  ).toBe(true);
  expect(
    matchesLookupFilters(
      state.config,
      publicProduct,
      filters,
      undefined,
      false,
      { ...flags, arrivedToday: false },
    ),
  ).toBe(false);
});
it("C11 other-company and unassigned location evidence cannot create local flags", () => {
  const { state, actor, product, signals } = fixture();
  state.invoices![0].branch = "Branch 2";
  state.expiry[0].branch = "Branch 2";
  product.price_provenance = {
    "Branch 2": product.price_provenance!["Branch 1"],
  };
  state.offers = state.offers.filter(
    (row) => row.product_code !== product.code,
  );
  state.expiry.push({
    ...state.expiry[0],
    id: "foreign",
    company_id: "foreign-company",
    branch: "Branch 1",
  });
  state.products.push({
    ...structuredClone(product),
    company_id: "foreign-company",
    code: "foreign-only",
  });
  expect(signals()).toEqual({
    code: "0003",
    onOffer: false,
    expiringSoon: false,
    arrivedToday: false,
    priceChangedRecently: false,
  });
  expect(
    lookupProductSignals(state, actor, now).some(
      (row) => row.code === "foreign-only",
    ),
  ).toBe(false);
});
it("C11 removed dates, old/future decisions and historical arrivals do not count", () => {
  const { state, product, signals } = fixture();
  state.expiry[0].status = "removed";
  state.invoices![0].received_at = "2026-10-26T14:00:00Z";
  product.price_provenance!["Branch 1"].changed_at = "2026-10-28T14:00:00Z";
  expect(signals()).toMatchObject({
    expiringSoon: false,
    arrivedToday: false,
    priceChangedRecently: false,
  });
  product.price_provenance!["Branch 1"].changed_at = "2026-10-01T14:00:00Z";
  expect(signals().priceChangedRecently).toBe(false);
});
