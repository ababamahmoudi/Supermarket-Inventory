import Decimal from "decimal.js";
import { createId } from "./ids";
import { validatePricingConfig } from "./pricing";
import type { Branch, CompanyConfig, DemoState, Language, Role } from "./types";

export type SettingsGroup =
  "company" | "branches" | "catalog" | "offers" | "modules" | "orders";
export type SettingsActor = { role: Role; company_id: string; by: string };
export type ConfigBranch = CompanyConfig["branches"][number];
export type PricingCategory = CompanyConfig["pricing_categories"][number];

/** Stable storage identifiers survive branch renames; labels come from configuration. */
export function branchId(branch: ConfigBranch, index = 0): Branch {
  return (
    branch.id ??
    (branch.name_en.replace(/\s*\(PLACEHOLDER.*$/i, "") ||
      `Branch ${index + 1}`)
  );
}
export function configuredBranches(
  config: CompanyConfig,
  includeInactive = false,
): Branch[] {
  return config.branches.flatMap((branch, index) =>
    includeInactive || branch.active !== false ? [branchId(branch, index)] : [],
  );
}
/** Retail prices and offers apply only to locations configured to sell. */
export function sellingBranches(
  config: CompanyConfig,
  includeInactive = false,
): Branch[] {
  return config.branches.flatMap((branch, index) =>
    (includeInactive || branch.active !== false) &&
    (branch.sells_to_customers ?? branch.type !== "warehouse")
      ? [branchId(branch, index)]
      : [],
  );
}
export function branchSellsToCustomers(
  config: CompanyConfig,
  id: Branch,
): boolean {
  return id !== "all" && sellingBranches(config).includes(id);
}
export function branchLabel(
  config: CompanyConfig,
  id: Branch,
  language: Language,
): string {
  if (id === "all") return language === "fa" ? "همه شعب" : "All branches";
  const branch = config.branches.find(
    (entry, index) => branchId(entry, index) === id,
  );
  if (!branch) return id;
  return language === "fa"
    ? branch.name_fa || branch.name_en.replace(/\s*\(PLACEHOLDER.*$/i, "")
    : branch.name_en.replace(/\s*\(PLACEHOLDER.*$/i, "");
}
export function branchIsActive(config: CompanyConfig, id: Branch): boolean {
  return id === "all" || configuredBranches(config).includes(id);
}
export function branchAllowsRole(
  config: CompanyConfig,
  id: Branch,
  role: Role,
): boolean {
  if (!branchIsActive(config, id) || id === "all")
    return role === "supervisor" && id === "all";
  const target = config.branches.find(
    (entry, index) => branchId(entry, index) === id,
  );
  return (
    Boolean(target) && !(role === "cashier" && target?.type === "warehouse")
  );
}
export function activePricingCategories(
  config: CompanyConfig,
): PricingCategory[] {
  return config.pricing_categories.filter((category) => !category.archived);
}
export function moduleEnabled(config: CompanyConfig, key: string): boolean {
  return (
    !Object.hasOwn(config.modules, key) ||
    config.modules[key as keyof typeof config.modules] !== false
  );
}

export class SettingsError extends Error {
  constructor(
    public readonly code:
      | "permission"
      | "company"
      | "name"
      | "duplicate"
      | "branch"
      | "last_branch"
      | "currency"
      | "timezone"
      | "color"
      | "mapping",
  ) {
    super(code);
    this.name = "SettingsError";
  }
}
function guard(state: DemoState, actor: SettingsActor) {
  if (actor.role !== "supervisor") throw new SettingsError("permission");
  if (actor.company_id !== state.config.company.seed_key)
    throw new SettingsError("company");
}
function record(
  state: DemoState,
  group: SettingsGroup,
  before: unknown,
  after: unknown,
  actor: SettingsActor,
) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const actions: Record<SettingsGroup, string> = {
    company: "Company settings changed",
    branches: "Branches changed",
    catalog: "Pricing rules changed",
    offers: "Offer settings changed",
    modules: "Modules changed",
    orders: "Order settings changed",
  };
  state.activity.unshift({
    id: createId("settings"),
    company_id: actor.company_id,
    branch: "all",
    scope: "all",
    action: actions[group],
    by: actor.by,
    at: new Date().toISOString(),
    reversible: true,
    before: structuredClone(before),
    after: structuredClone(after),
    entity_type: "settings",
    entity_id: group,
  });
}

export function saveCompanySettings(
  state: DemoState,
  company: CompanyConfig["company"],
  actor: SettingsActor,
) {
  guard(state, actor);
  if (!company.name_en.trim() || !company.name_fa.trim())
    throw new SettingsError("name");
  if (company.seed_key !== state.config.company.seed_key)
    throw new SettingsError("company");
  if (!/^[A-Z]{3}$/.test(company.currency)) throw new SettingsError("currency");
  try {
    new Intl.DateTimeFormat("en", { timeZone: company.timezone }).format();
  } catch {
    throw new SettingsError("timezone");
  }
  if (
    ![
      company.branding.primary_color,
      company.branding.dark_primary_color,
    ].every((color) => color === undefined || /^#[0-9a-f]{6}$/i.test(color))
  )
    throw new SettingsError("color");
  const before = state.config.company;
  state.config.company = {
    ...structuredClone(company),
    name: company.name_en.trim(),
    name_en: company.name_en.trim(),
    name_fa: company.name_fa.trim(),
  };
  record(state, "company", before, state.config.company, actor);
}
export function saveBranchSettings(
  state: DemoState,
  branch: ConfigBranch,
  actor: SettingsActor,
) {
  guard(state, actor);
  if (!branch.name_en.trim() || !branch.name_fa.trim())
    throw new SettingsError("name");
  if (
    branch.type !== undefined &&
    !["store", "warehouse"].includes(branch.type)
  )
    throw new SettingsError("branch");
  if (
    branch.sells_to_customers !== undefined &&
    typeof branch.sells_to_customers !== "boolean"
  )
    throw new SettingsError("branch");
  const before = structuredClone(state.config.branches);
  const index = state.config.branches.findIndex(
    (entry) => entry.code === branch.code,
  );
  if (
    state.config.branches.some(
      (entry) =>
        entry.code !== branch.code &&
        entry.name_en.trim().toLocaleLowerCase() ===
          branch.name_en.trim().toLocaleLowerCase(),
    )
  )
    throw new SettingsError("duplicate");
  if (index >= 0 && branch.id !== branchId(state.config.branches[index], index))
    throw new SettingsError("branch");
  const value = {
    ...structuredClone(branch),
    name: branch.name_en.trim(),
    name_en: branch.name_en.trim(),
    name_fa: branch.name_fa.trim(),
    active: branch.active !== false,
    type: branch.type ?? ("store" as const),
  };
  if (index < 0) state.config.branches.push(value);
  else state.config.branches[index] = value;
  record(state, "branches", before, state.config.branches, actor);
}
export function newBranch(config: CompanyConfig): ConfigBranch {
  const next =
    Math.max(
      0,
      ...config.branches.map((entry) =>
        Number(entry.code.match(/\d+$/)?.[0] ?? 0),
      ),
    ) + 1;
  return {
    code: `B${next}`,
    id: `Branch ${next}`,
    name: "",
    name_en: "",
    name_fa: "",
    active: true,
    type: "store",
    sells_to_customers: true,
    address: "",
    phone: "",
    opening_hours: "",
    tax_region: "",
  };
}
export function setBranchActive(
  state: DemoState,
  code: string,
  active: boolean,
  actor: SettingsActor,
) {
  guard(state, actor);
  const target = state.config.branches.find((branch) => branch.code === code);
  if (!target) throw new SettingsError("branch");
  if (
    !active &&
    target.active !== false &&
    configuredBranches(state.config).length <= 1
  )
    throw new SettingsError("last_branch");
  saveBranchSettings(state, { ...target, id: branchId(target), active }, actor);
}
export function savePricingSettings(
  state: DemoState,
  candidate: CompanyConfig,
  actor: SettingsActor,
) {
  guard(state, actor);
  validatePricingConfig(candidate);
  if (candidate.pricing_categories.some((category) => !category.label.trim()))
    throw new SettingsError("name");
  const before = {
    pricing_categories: structuredClone(state.config.pricing_categories),
    rounding_bands: structuredClone(state.config.rounding_bands),
    special_corrections: structuredClone(state.config.special_corrections),
  };
  state.config.pricing_categories = structuredClone(
    candidate.pricing_categories,
  );
  state.config.rounding_bands = structuredClone(candidate.rounding_bands);
  state.config.special_corrections = structuredClone(
    candidate.special_corrections,
  );
  record(
    state,
    "catalog",
    before,
    {
      pricing_categories: state.config.pricing_categories,
      rounding_bands: state.config.rounding_bands,
      special_corrections: state.config.special_corrections,
    },
    actor,
  );
}
export function saveOfferSettings(
  state: DemoState,
  promotions: CompanyConfig["promotions"],
  actor: SettingsActor,
) {
  guard(state, actor);
  const prices = new Set<string>();
  for (const mapping of promotions.price_to_offer) {
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(mapping.price) ||
      !mapping.offer.trim() ||
      !mapping.mix_and_match_pool.trim()
    )
      throw new SettingsError("mapping");
    const price = new Decimal(mapping.price).toFixed(2);
    if (prices.has(price)) throw new SettingsError("mapping");
    prices.add(price);
  }
  const before = state.config.promotions;
  state.config.promotions = structuredClone(promotions);
  record(state, "offers", before, state.config.promotions, actor);
}
export function saveModuleSettings(
  state: DemoState,
  modules: CompanyConfig["modules"],
  actor: SettingsActor,
) {
  guard(state, actor);
  const before = state.config.modules;
  // Planned modules remain unavailable until their workflows exist.
  state.config.modules = {
    ...structuredClone(modules),
    register: false,
    online_orders: false,
  };
  record(state, "modules", before, state.config.modules, actor);
}

export function saveOrderSettings(
  state: DemoState,
  orders: NonNullable<CompanyConfig["orders"]>,
  actor: SettingsActor,
) {
  guard(state, actor);
  if (typeof orders.allow_floor_worker !== "boolean")
    throw new SettingsError("mapping");
  const before = state.config.orders ?? { allow_floor_worker: false };
  state.config.orders = { allow_floor_worker: orders.allow_floor_worker };
  record(state, "orders", before, state.config.orders, actor);
}
