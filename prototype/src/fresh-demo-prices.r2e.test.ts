import { Blob as NodeBlob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialState, loadInitialBusiness, STORAGE_KEY } from "./e1-bootstrap";
import { authenticatedTestFixture } from "./authority-test-fixture";
import { lookupBranchCatalog } from "./lookup-branch";
import { branchId, branchSellsToCustomers } from "./settings";
import { encodeHistoryStorage } from "./history-storage";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Blob", NodeBlob);
});
afterEach(() => vi.unstubAllGlobals());
it("C14 fresh demo has exactly one North York unapproved product and approved prices at every other selling location", () => {
  const state = initialState();
  for (const location of state.config.branches
    .map((branch, index) => branchId(branch, index))
    .filter((location) => branchSellsToCustomers(state.config, location))) {
    const actor = authenticatedTestFixture(state, "manager", {
      selection: { kind: "location", location_id: location },
    }).actor;
    const facts = lookupBranchCatalog(state, actor);
    expect(facts.filter((row) => !row.price).map((row) => row.code)).toEqual(
      location === "Branch 1" ? ["0015"] : [],
    );
  }
  expect(
    state.products.find((row) => row.code === "0004")?.branch_prices,
  ).toMatchObject({ "Branch 1": "6.49", "Branch 2": "6.99" });
  expect(
    state.approvals
      .filter((row) => row.status === "pending")
      .map((row) => row.id),
  ).toEqual(
    expect.arrayContaining(["demo-lavash-price", "demo-barberries-product"]),
  );
});
it("C14 loading saved records never fills or replaces existing branch price decisions", async () => {
  const saved = initialState();
  const product = saved.products.find((row) => row.code === "0009")!;
  product.branch_prices = { "Branch 2": "7.49" };
  product.selling_price = "6.49";
  const before = structuredClone(saved.products);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(encodeHistoryStorage(saved)),
  );
  const loaded = await loadInitialBusiness();
  expect(loaded.products).toEqual(before);
});
