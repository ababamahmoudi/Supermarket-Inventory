import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { initialState } from "./e1-bootstrap";
import { authenticatedTestActor } from "./authority-test-fixture";
import { cloneWithAuthority } from "./authority";
import { effectivePrice, regularPrice } from "./catalog";
import {
  activeSaleAt,
  changeSale,
  discountSaleAt,
  migrateSalePriceInvariants,
  previewPriceChange,
  requestSale,
  resolveSaleRequest,
  saleGroup,
  saleCanonicalPrice,
  savePriceChange,
  type ChangePriceInput,
} from "./sales";
import {
  projectOffersReadView,
  projectSaleRequestReadDTO,
} from "./offers-read-model";
import {
  AUTHORITY_DATABASE_NAME,
  BrowserAuthorityRepository,
} from "./authority-repository";
import { initializeAuthority } from "./authority-initialization";
import {
  configuredDemoComputers,
  configuredDemoPeople,
} from "./e1-seed-fixtures";

const now = new Date("2026-10-12T16:00:00Z");
const input = (patch: Partial<ChangePriceInput> = {}): ChangePriceInput => ({
  product_code: "0012",
  mode: "sale",
  scope: "current",
  branches: ["Branch 1"],
  price: "16.99",
  price_unit: "each",
  starts_on: "2026-10-12",
  last_day: "2026-10-25",
  accept_below_margin: false,
  below_cost_reason: "",
  add_labels: true,
  ...patch,
});
function fixture() {
  const state = initialState();
  state.sales = [];
  state.sale_events = [];
  state.sale_requests = [];
  state.label_waitlist = [];
  state.sale_label_effects = [];
  const manager = authenticatedTestActor(state, "manager", {
    selection: { kind: "location", location_id: "Branch 1" },
  });
  return { state, manager };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe("C9 regular prices during a running sale", () => {
  it.each(["lb", "kg"] as const)(
    "advertises only a visible cent reduction in main unit %s without changing retained sale terms",
    (mainUnit) => {
      const { state, manager } = fixture();
      const product = state.products.find((item) => item.code === "0016")!;
      product.selling_price = "9.99";
      product.branch_prices = { "Branch 1": "9.99" };
      state.config.weighed_items!.main_display_unit = "kg";
      const sale = savePriceChange(
        state,
        manager,
        input({
          product_code: product.code,
          price: "22.01",
          price_unit: "kg",
          accept_below_margin: true,
          below_cost_reason: "Fictional retained-unit boundary proof",
          add_labels: false,
        }),
        now,
      ).sales[0];
      state.config.weighed_items!.main_display_unit = mainUnit;
      for (const entered of ["22.01", "22.02", "22.03"]) {
        // Include an old invalid retained amount without passing it through a
        // new transaction or invoking the separately tested load repair.
        sale.sale_price = entered;
        const before = cloneWithAuthority(state);
        expect(activeSaleAt(state, product, "Branch 1", now)?.sale_price).toBe(
          entered,
        );
        expect(Boolean(discountSaleAt(state, product, "Branch 1", now))).toBe(
          entered === "22.01",
        );
        expect(effectivePrice(state, product, "Branch 1", now)).toBe(
          saleCanonicalPrice(sale, state.config),
        );
        expect(state).toEqual(before);
      }
    },
  );

  it("saves a regular price from a branch-filtered group without treating it as a group sale edit", () => {
    const { state, manager } = fixture();
    const sale = savePriceChange(
      state,
      manager,
      input({ branches: ["Branch 1", "Branch 2"], scope: "selected" }),
      now,
    ).sales[0];
    const visible = projectOffersReadView(state, manager);
    const group = saleGroup(
      { config: state.config, products: state.products, sales: visible.sales },
      sale,
    );
    expect(group.map((item) => item.branch)).toEqual(["Branch 1"]);
    const regular = input({
      mode: "regular",
      price: "24.99",
      existing_sale_id: sale.id,
      expected_revision: sale.revision,
      expected_revisions: Object.fromEntries(
        group.map((item) => [item.id, item.revision]),
      ),
    });
    expect(previewPriceChange(state, manager, regular, now).issues).toEqual([]);
    savePriceChange(state, manager, regular, now);
    expect(regularPrice(state, "0012", "Branch 1")).toBe("24.99");
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("16.99");
    expect(regularPrice(state, "0012", "Branch 2")).toBe("20.99");
    expect(state.sales!.every((item) => item.status === "active")).toBe(true);
  });

  it.each(["16.99", "15.99"])(
    "requires a decision for regular %s, then ends only its selected store sale",
    (price) => {
      const { state, manager } = fixture();
      const sale = savePriceChange(
        state,
        manager,
        input({ branches: ["Branch 1", "Branch 2"], scope: "selected" }),
        now,
      ).sales[0];
      const prior = cloneWithAuthority(state);
      expect(() =>
        savePriceChange(state, manager, input({ mode: "regular", price }), now),
      ).toThrow("regular_sale_conflict");
      expect(state).toEqual(prior);
      savePriceChange(
        state,
        manager,
        input({
          mode: "regular",
          price,
          accept_below_margin: true,
          regular_sale_resolutions: [
            {
              sale_id: sale.id,
              expected_revision: sale.revision,
              action: "end",
            },
          ],
        }),
        now,
      );
      expect(effectivePrice(state, "0012", "Branch 1", now)).toBe(price);
      expect(activeSaleAt(state, "0012", "Branch 1", now)).toBeNull();
      expect(activeSaleAt(state, "0012", "Branch 2", now)?.sale_price).toBe(
        "16.99",
      );
      expect(state.sales!.find((item) => item.id === sale.id)).toMatchObject({
        status: "ended",
        sale_price: "16.99",
      });
      expect(
        state.label_waitlist!.find((item) => item.branch === "Branch 1")
          ?.preferred_template,
      ).toBe("regular");
      for (const key of [
        "ledger",
        "returns",
        "stock",
        "invoice",
        "invoices",
      ] as const)
        expect(state[key]).toEqual(prior[key]);
    },
  );

  it("changes the sale and regular price together, rechecking replacement price and fresh revision", () => {
    const { state, manager } = fixture();
    const sale = savePriceChange(state, manager, input(), now).sales[0];
    const regular = input({
      mode: "regular",
      price: "16.99",
      regular_sale_resolutions: [
        {
          sale_id: sale.id,
          expected_revision: sale.revision,
          action: "change",
          sale_price: "16.99",
          price_unit: "each",
        },
      ],
    });
    const before = cloneWithAuthority(state);
    expect(() => savePriceChange(state, manager, regular, now)).toThrow(
      "replacement_sale_price_not_lower",
    );
    expect(state).toEqual(before);
    regular.regular_sale_resolutions![0].sale_price = "15.99";
    regular.regular_sale_resolutions![0].expected_revision--;
    expect(() => savePriceChange(state, manager, regular, now)).toThrow(
      "revision",
    );
    expect(state).toEqual(before);
    regular.regular_sale_resolutions![0].expected_revision = sale.revision;
    regular.accept_below_margin = true;
    savePriceChange(state, manager, regular, now);
    expect(regularPrice(state, "0012", "Branch 1")).toBe("16.99");
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("15.99");
    expect(discountSaleAt(state, "0012", "Branch 1", now)?.sale_price).toBe(
      "15.99",
    );
  });

  it("checks the replacement sale's margin, even if the proposed regular price passes", () => {
    const { state, manager } = fixture();
    const sale = savePriceChange(state, manager, input(), now).sales[0];
    const regular = input({
      mode: "regular",
      price: "16.99",
      regular_sale_resolutions: [
        {
          sale_id: sale.id,
          expected_revision: sale.revision,
          action: "change",
          sale_price: "11.99",
          price_unit: "each",
        },
      ],
    });
    expect(
      previewPriceChange(state, manager, regular, now).issues.map(
        (issue) => issue.code,
      ),
    ).toEqual(expect.arrayContaining(["below_margin", "below_cost_reason"]));
    regular.accept_below_margin = true;
    regular.below_cost_reason = "Owner-approved clearance";
    savePriceChange(state, manager, regular, now);
    expect(effectivePrice(state, "0012", "Branch 1", now)).toBe("11.99");
  });

  it("keeps a Branch Supervisor regular proposal free of managerial sale actions", () => {
    const { state, manager } = fixture();
    savePriceChange(state, manager, input(), now);
    const supervisor = authenticatedTestActor(state, "branch_supervisor", {
      locations: ["Branch 1"],
    });
    const proposal = input({ mode: "regular", price: "15.99" });
    const preview = previewPriceChange(state, supervisor, proposal, now);
    expect(preview.issues).toEqual([]);
    expect(preview.effects[0].regular_sale_conflict).toBeUndefined();
    expect(preview.effects[0].cost).toBeNull();
    const before = cloneWithAuthority(state);
    expect(() => savePriceChange(state, supervisor, proposal, now)).toThrow(
      "permission",
    );
    expect(state).toEqual(before);
  });

  it("retains approved terms and the decider after the linked sale changes", () => {
    const { state, manager } = fixture();
    const worker = authenticatedTestActor(state, "floor_worker", {
      locations: ["Branch 1"],
    });
    const request = requestSale(state, worker, input(), now);
    resolveSaleRequest(
      state,
      manager,
      request.id,
      "approve",
      {
        expected_revision: request.revision,
        input: input({ price: "17.99", last_day: "2026-10-23" }),
      },
      now,
    );
    const decided = state.sale_requests![0];
    const terms = structuredClone(decided.approved_terms);
    const sale = state.sales![0];
    changeSale(
      state,
      manager,
      sale.id,
      input({
        price: "18.49",
        last_day: "2026-10-30",
        expected_revision: sale.revision,
      }),
      now,
    );
    expect(decided.requested_price).toBe("16.99");
    expect(state.sale_requests![0].approved_terms).toEqual(terms);
    expect(terms).toMatchObject({
      sale_price: "17.99",
      last_day: "2026-10-23",
    });
    expect(
      projectSaleRequestReadDTO(state.sale_requests![0], true),
    ).toMatchObject({ approved_terms: terms, decided_by: manager.actor });
    expect(
      projectSaleRequestReadDTO(state.sale_requests![0]),
    ).not.toHaveProperty("approved_terms");
    expect(
      projectSaleRequestReadDTO(state.sale_requests![0]),
    ).not.toHaveProperty("decided_by");
  });
});

it("backs up invalid saved sales before ending them once, preserving all original records", async () => {
  const { state, manager } = fixture();
  const sale = savePriceChange(state, manager, input(), now).sales[0];
  state.products.find((product) => product.code === "0012")!.branch_prices = {
    "Branch 1": "16.99",
  };
  state.sales!.push({
    ...sale,
    id: "foreign-sale",
    company_id: "another-company",
  });
  expect(discountSaleAt(state, "0012", "Branch 1", now)).toBeNull();
  const factory = new IDBFactory();
  const repository = new BrowserAuthorityRepository(factory);
  await initializeAuthority(repository, {
    state,
    demo_users: configuredDemoPeople(),
    registered_computers: configuredDemoComputers(),
    now,
  });
  const prior = await repository.loadBusiness<typeof state>(
    state.config.company.seed_key,
  );
  const raw = JSON.stringify(prior.state);
  await migrateSalePriceInvariants(repository, state.config.company.seed_key);
  const migrated = await repository.loadBusiness<typeof state>(
    state.config.company.seed_key,
  );
  expect(
    migrated.state.sales!.find((item) => item.id === sale.id),
  ).toMatchObject({
    status: "ended",
    sale_price: "16.99",
    starts_on: sale.starts_on,
  });
  expect(
    migrated.state.sales!.find((item) => item.id === "foreign-sale"),
  ).toEqual(prior.state.sales!.find((item) => item.id === "foreign-sale"));
  expect(
    migrated.state.sale_events!.slice(0, prior.state.sale_events!.length),
  ).toEqual(prior.state.sale_events);
  for (const key of [
    "products",
    "ledger",
    "returns",
    "stock",
    "invoice",
    "invoices",
  ] as const)
    expect(migrated.state[key]).toEqual(prior.state[key]);
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(AUTHORITY_DATABASE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const backups = await new Promise<{ raw: string }[]>((resolve, reject) => {
    const request = database
      .transaction("private_backups", "readonly")
      .objectStore("private_backups")
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  expect(backups.some((backup) => backup.raw === raw)).toBe(true);
  await migrateSalePriceInvariants(repository, state.config.company.seed_key);
  expect(
    (await repository.loadBusiness<typeof state>(state.config.company.seed_key))
      .revision,
  ).toBe(migrated.revision);
  database.close();
  repository.dispose();
  const reset = initialState();
  expect(discountSaleAt(reset, "0012", "Branch 1", now)).not.toBeNull();
});
