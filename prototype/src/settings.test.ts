import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { calculatePrice } from "./pricing";
import {
  activePricingCategories,
  branchId,
  branchIsActive,
  branchLabel,
  configuredBranches,
  moduleEnabled,
  newBranch,
  saveBranchSettings,
  saveCompanySettings,
  saveModuleSettings,
  saveOfferSettings,
  savePricingSettings,
  setBranchActive,
} from "./settings";
import type { Role } from "./types";
const actor = {
  role: "supervisor" as Role,
  company_id: "super-arzon",
  by: "Settings Supervisor",
};

describe("company-scoped, reversible Settings", () => {
  it("preserves the supplied pricing and approved prices while company details change", () => {
    const state = initialState();
    const products = structuredClone(state.products);
    const rules = structuredClone(state.config.pricing_categories);
    saveCompanySettings(
      state,
      {
        ...state.config.company,
        name_en: "Arzon Market",
        name_fa: "فروشگاه ارزان",
      },
      actor,
    );
    expect(state.config.company.name).toBe("Arzon Market");
    expect(state.products).toEqual(products);
    expect(state.config.pricing_categories).toEqual(rules);
    expect(state.activity[0]).toMatchObject({
      by: actor.by,
      company_id: actor.company_id,
      branch: "all",
      reversible: true,
      entity_type: "settings",
      entity_id: "company",
    });
    expect(state.activity[0].before).toMatchObject({ name_en: "Super Arzon" });
    expect(state.activity[0].after).toMatchObject({ name_en: "Arzon Market" });
  });
  it("uses configured branch identifiers after renaming and adding branches", () => {
    const state = initialState();
    expect(configuredBranches(state.config)).toEqual([
      "Branch 1",
      "Branch 2",
      "Branch 3",
    ]);
    const original = state.config.branches[0];
    saveBranchSettings(
      state,
      {
        ...original,
        id: branchId(original),
        name_en: "Downtown",
        name_fa: "مرکز شهر",
      },
      actor,
    );
    expect(configuredBranches(state.config)[0]).toBe("Branch 1");
    expect(branchLabel(state.config, "Branch 1", "en")).toBe("Downtown");
    expect(branchLabel(state.config, "Branch 1", "fa")).toBe("مرکز شهر");
    const branch = {
      ...newBranch(state.config),
      name_en: "North Market",
      name_fa: "بازار شمال",
    };
    saveBranchSettings(state, branch, actor);
    expect(configuredBranches(state.config)).toContain("Branch 4");
    expect(branchLabel(state.config, "Branch 4", "en")).toBe("North Market");
    setBranchActive(state, "B4", false, actor);
    expect(branchIsActive(state.config, "Branch 4")).toBe(false);
    expect(configuredBranches(state.config, true)).toContain("Branch 4");
    expect(newBranch(state.config).code).toBe("B5");
    expect(
      state.invoices?.some((invoice) => invoice.branch === "Branch 1"),
    ).toBe(true);
  });
  it("rejects duplicate names, branch-id changes and deactivating the final branch atomically", () => {
    const state = initialState();
    const previous = structuredClone(state);
    expect(() =>
      saveBranchSettings(
        state,
        {
          ...newBranch(state.config),
          name_en: state.config.branches[0].name_en,
          name_fa: "شعبه",
        },
        actor,
      ),
    ).toThrow("duplicate");
    expect(state).toEqual(previous);
    expect(() =>
      saveBranchSettings(
        state,
        { ...state.config.branches[0], id: "unrelated", name_en: "Updated" },
        actor,
      ),
    ).toThrow("branch");
    setBranchActive(state, "B2", false, actor);
    setBranchActive(state, "B3", false, actor);
    expect(() => setBranchActive(state, "B1", false, actor)).toThrow(
      "last_branch",
    );
    expect(configuredBranches(state.config)).toEqual(["Branch 1"]);
  });
  it("adds pricing categories and rules as data without changing approved product prices", () => {
    const state = initialState();
    const prices = state.products.map((product) => product.selling_price);
    const candidate = structuredClone(state.config);
    candidate.pricing_categories.push({
      ...candidate.pricing_categories[0],
      key: "bakery",
      label: "Bakery",
      label_fa: "نانوایی",
      cost_divisor: "0.50",
      minimum_margin: "0.25",
    });
    savePricingSettings(state, candidate, actor);
    expect(activePricingCategories(state.config).at(-1)?.key).toBe("bakery");
    expect(calculatePrice("1.00", "bakery", state.config).selling_price).toBe(
      "1.99",
    );
    expect(state.products.map((product) => product.selling_price)).toEqual(
      prices,
    );
    expect(state.activity[0]).toMatchObject({
      entity_id: "catalog",
      reversible: true,
    });
    const archived = structuredClone(state.config);
    archived.pricing_categories.find(
      (category) => category.key === "bakery",
    )!.archived = true;
    savePricingSettings(state, archived, actor);
    expect(
      activePricingCategories(state.config).some(
        (category) => category.key === "bakery",
      ),
    ).toBe(false);
    expect(calculatePrice("1.00", "bakery", state.config).selling_price).toBe(
      "1.99",
    );
  });
  it("invalid rounding, corrections and minimum margins leave saved rules unchanged", () => {
    for (const change of [
      (config: ReturnType<typeof initialState>["config"]) => {
        config.rounding_bands.bands[0].upper_exclusive = "0.24";
      },
      (config: ReturnType<typeof initialState>["config"]) => {
        config.special_corrections.push({ ...config.special_corrections[0] });
      },
      (config: ReturnType<typeof initialState>["config"]) => {
        config.pricing_categories[0].minimum_margin = "1.01";
      },
    ]) {
      const state = initialState();
      const before = structuredClone(state);
      const candidate = structuredClone(state.config);
      change(candidate);
      expect(() => savePricingSettings(state, candidate, actor)).toThrow();
      expect(state).toEqual(before);
    }
  });
  it("saves offer mappings and suggestion preferences without changing active offers", () => {
    const state = initialState();
    const offers = structuredClone(state.offers);
    saveOfferSettings(
      state,
      {
        ...state.config.promotions,
        ai_suggestions_enabled: false,
        price_to_offer: [
          ...state.config.promotions.price_to_offer,
          {
            price: "4.99",
            offer: "2 for $9",
            mix_and_match_pool: "2_for_9",
            assumption: false,
          },
        ],
      },
      actor,
    );
    expect(state.config.promotions.ai_suggestions_enabled).toBe(false);
    expect(state.config.promotions.price_to_offer).toHaveLength(4);
    expect(state.offers).toEqual(offers);
    expect(() =>
      saveOfferSettings(
        state,
        {
          ...state.config.promotions,
          price_to_offer: [
            { ...state.config.promotions.price_to_offer[0] },
            { ...state.config.promotions.price_to_offer[0], price: "1.990" },
          ],
        },
        actor,
      ),
    ).toThrow("mapping");
  });
  it("module visibility is configuration, while unbuilt modules remain unavailable", () => {
    const state = initialState();
    saveModuleSettings(
      state,
      { ...state.config.modules, returns: false, register: true },
      actor,
    );
    expect(moduleEnabled(state.config, "returns")).toBe(false);
    expect(moduleEnabled(state.config, "products")).toBe(true);
    expect(state.config.modules.register).toBe(false);
    expect(state.returns.length).toBeGreaterThan(0);
  });
  it.each(["floor_worker", "cashier"] as Role[])(
    "blocks every mutation for %s",
    (role) => {
      const state = initialState();
      const before = structuredClone(state);
      const unauthorized = { ...actor, role };
      for (const mutate of [
        () => saveCompanySettings(state, state.config.company, unauthorized),
        () => saveBranchSettings(state, state.config.branches[0], unauthorized),
        () => savePricingSettings(state, state.config, unauthorized),
        () => saveOfferSettings(state, state.config.promotions, unauthorized),
        () => saveModuleSettings(state, state.config.modules, unauthorized),
      ])
        expect(mutate).toThrow("permission");
      expect(state).toEqual(before);
    },
  );
  it("rejects another company's settings and invalid company values", () => {
    const state = initialState();
    const before = structuredClone(state);
    expect(() =>
      saveCompanySettings(state, state.config.company, {
        ...actor,
        company_id: "other-store",
      }),
    ).toThrow("company");
    expect(() =>
      saveCompanySettings(
        state,
        { ...state.config.company, timezone: "Invalid/Zone" },
        actor,
      ),
    ).toThrow("timezone");
    expect(() =>
      saveCompanySettings(
        state,
        { ...state.config.company, currency: "bad" },
        actor,
      ),
    ).toThrow("currency");
    for (const key of ["primary_color", "dark_primary_color"] as const) {
      expect(() =>
        saveCompanySettings(
          state,
          {
            ...state.config.company,
            branding: {
              ...state.config.company.branding,
              [key]: "invalid color",
            },
          },
          actor,
        ),
      ).toThrow("color");
      expect(state).toEqual(before);
    }
    expect(state).toEqual(before);
  });
});
