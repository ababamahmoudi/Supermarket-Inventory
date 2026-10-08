import Decimal from "decimal.js";
import { effectiveOffer, effectivePrice, searchProducts } from "./catalog";
import { createId } from "./ids";
import { labelLayout, labelPages } from "./labels";
import { configuredBranches } from "./settings";
import type {
  Branch,
  DemoState,
  LabelTemplate,
  LabelWaitlistItem,
  Product,
  Role,
} from "./types";

export class LabelWorkflowError extends Error {
  constructor(
    readonly code:
      "branch" | "permission" | "price" | "copies" | "template" | "logo",
  ) {
    super(code);
  }
}

export interface LabelActor {
  name: string;
  role: Role;
  branch: Branch;
}
export interface LabelFilters {
  query: string;
  arrived: boolean;
  changed: boolean;
  onOffer: boolean;
  pricing: string;
  category: string;
  supplier: string;
}
export const emptyLabelFilters: LabelFilters = {
  query: "",
  arrived: false,
  changed: false,
  onOffer: false,
  pricing: "",
  category: "",
  supplier: "",
};

export function configuredLabelBranches(state: DemoState): Branch[] {
  return configuredBranches(state.config);
}
function permittedBranch(state: DemoState, branch: Branch, actor: LabelActor) {
  if (actor.role === "cashier") throw new LabelWorkflowError("permission");
  if (
    branch === "all" ||
    !configuredLabelBranches(state).includes(branch) ||
    (actor.role !== "supervisor" && actor.branch !== branch)
  )
    throw new LabelWorkflowError("branch");
}
function approvedProduct(
  state: DemoState,
  code: string,
  branch: Branch,
): Product {
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key && item.code === code,
  );
  const price = product && effectivePrice(state, product, branch);
  if (
    !product ||
    product.status !== "active" ||
    !price ||
    !new Decimal(price).isFinite() ||
    new Decimal(price).isNegative()
  )
    throw new LabelWorkflowError("price");
  return product;
}
function copiesValue(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 1000)
    throw new LabelWorkflowError("copies");
  return value;
}
function record(
  state: DemoState,
  actor: LabelActor,
  branch: Branch,
  action: string,
  reversible: boolean,
  before?: unknown,
  after?: unknown,
) {
  state.activity.push({
    id: createId("label-activity"),
    company_id: state.config.company.seed_key,
    branch,
    action,
    by: actor.name,
    at: new Date().toISOString(),
    reversible,
    before,
    after,
  });
}

export function branchLabelWaitlist(
  state: DemoState,
  branch: Branch,
): LabelWaitlistItem[] {
  return (state.label_waitlist ?? []).filter(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      item.branch === branch,
  );
}

export function addLabelsToWaitlist(
  state: DemoState,
  codes: string[],
  copies: number,
  branch: Branch,
  actor: LabelActor,
) {
  permittedBranch(state, branch, actor);
  copiesValue(copies);
  const unique = [...new Set(codes)];
  for (const code of unique) approvedProduct(state, code, branch);
  const before = structuredClone(branchLabelWaitlist(state, branch));
  state.label_waitlist ??= [];
  // Validate the whole operation before mutating any item.
  for (const code of unique)
    copiesValue(
      (branchLabelWaitlist(state, branch).find(
        (item) => item.product_code === code,
      )?.copies ?? 0) + copies,
    );
  for (const code of unique) {
    const item = branchLabelWaitlist(state, branch).find(
      (entry) => entry.product_code === code,
    );
    if (item) item.copies += copies;
    else
      state.label_waitlist.push({
        id: createId("label-waitlist"),
        company_id: state.config.company.seed_key,
        branch,
        product_code: code,
        copies,
        added_by: actor.name,
        added_at: new Date().toISOString(),
      });
  }
  if (unique.length)
    record(
      state,
      actor,
      branch,
      "Add to waitlist",
      true,
      before,
      structuredClone(branchLabelWaitlist(state, branch)),
    );
}

export function editLabelWaitlist(
  state: DemoState,
  id: string,
  copies: number | null,
  branch: Branch,
  actor: LabelActor,
) {
  permittedBranch(state, branch, actor);
  const item = branchLabelWaitlist(state, branch).find(
    (entry) => entry.id === id,
  );
  if (!item) throw new LabelWorkflowError("branch");
  if (copies !== null) copiesValue(copies);
  const before = structuredClone(item);
  if (copies === null)
    state.label_waitlist = state.label_waitlist!.filter(
      (entry) => entry.id !== id,
    );
  else item.copies = copies;
  record(
    state,
    actor,
    branch,
    copies === null ? "Remove from waitlist" : "Change copies",
    true,
    before,
    copies === null ? null : structuredClone(item),
  );
}

export function clearLabelWaitlist(
  state: DemoState,
  branch: Branch,
  actor: LabelActor,
) {
  permittedBranch(state, branch, actor);
  const before = structuredClone(branchLabelWaitlist(state, branch));
  state.label_waitlist = (state.label_waitlist ?? []).filter(
    (item) =>
      item.company_id !== state.config.company.seed_key ||
      item.branch !== branch,
  );
  if (before.length)
    record(state, actor, branch, "Clear waitlist", true, before, []);
}

export interface LabelPrintSnapshot {
  id: string;
  company_id: string;
  branch: Branch;
  template: LabelTemplate;
  startSlot: number;
  entries: LabelWaitlistItem[];
  products: Product[];
  pages: (Product | null)[][];
}
export function prepareLabelPrint(
  state: DemoState,
  branch: Branch,
  template: LabelTemplate,
  startSlot: number,
  actor: LabelActor,
): LabelPrintSnapshot {
  permittedBranch(state, branch, actor);
  if (
    template.company_id !== state.config.company.seed_key ||
    template.archived
  )
    throw new LabelWorkflowError("template");
  validateLabelTemplate(template, state.label_settings?.fields?.logo !== false);
  const entries = structuredClone(branchLabelWaitlist(state, branch));
  const products = entries.flatMap((entry) =>
    Array<Product>(copiesValue(entry.copies)).fill(
      structuredClone(approvedProduct(state, entry.product_code, branch)),
    ),
  );
  return {
    id: createId("label-print"),
    company_id: state.config.company.seed_key,
    branch,
    template: structuredClone(template),
    startSlot,
    entries,
    products,
    pages: labelPages(products, template, startSlot),
  };
}

/** Only confirmed copies leave the queue; another worker's additions remain. */
export function confirmLabelsPrinted(
  state: DemoState,
  snapshot: LabelPrintSnapshot,
  actor: LabelActor,
) {
  permittedBranch(state, snapshot.branch, actor);
  if (snapshot.company_id !== state.config.company.seed_key)
    throw new LabelWorkflowError("permission");
  if (
    state.activity.some(
      (entry) =>
        entry.action === "Print labels" &&
        entry.after &&
        typeof entry.after === "object" &&
        "print_id" in entry.after &&
        entry.after.print_id === snapshot.id,
    )
  )
    return;
  for (const printed of snapshot.entries) {
    const current = branchLabelWaitlist(state, snapshot.branch).find(
      (entry) => entry.id === printed.id,
    );
    if (!current) continue;
    current.copies = Math.max(0, current.copies - printed.copies);
  }
  state.label_waitlist = (state.label_waitlist ?? []).filter(
    (entry) => entry.copies > 0,
  );
  record(state, actor, snapshot.branch, "Print labels", false, undefined, {
    print_id: snapshot.id,
    template_id: snapshot.template.id,
    template_name: snapshot.template.name,
    start_slot: snapshot.startSlot,
    copies: snapshot.products.length,
    sheets: snapshot.pages.length,
    items: snapshot.entries.map((item) => ({
      product_code: item.product_code,
      copies: item.copies,
    })),
  });
}

export function validateLabelTemplate(
  template: LabelTemplate,
  includeLogo = true,
) {
  labelLayout(template);
  if (!template.name.trim()) throw new LabelWorkflowError("template");
  if (includeLogo && template.width >= 50 && template.height < 10)
    throw new LabelWorkflowError("logo");
}
export function saveLabelTemplate(
  state: DemoState,
  template: LabelTemplate,
  actor: LabelActor,
) {
  if (
    actor.role === "cashier" ||
    template.company_id !== state.config.company.seed_key
  )
    throw new LabelWorkflowError("permission");
  validateLabelTemplate(template, state.label_settings?.fields?.logo !== false);
  const existing = state.templates.find(
    (item) =>
      item.id === template.id &&
      item.company_id === template.company_id &&
      !item.archived,
  );
  const before = existing ? structuredClone(existing) : null;
  if (existing)
    Object.assign(existing, structuredClone(template), {
      name: template.name.trim(),
    });
  else
    state.templates.push({
      ...structuredClone(template),
      name: template.name.trim(),
    });
  record(
    state,
    actor,
    "all",
    existing ? "Save template" : "Create template",
    true,
    before,
    template,
  );
}

function localDate(state: DemoState, value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: state.config.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function filterLabelProducts(
  state: DemoState,
  branch: Branch,
  filters: LabelFilters,
  now = new Date(),
): Product[] {
  const today = localDate(state, now);
  const recentDays = state.label_settings?.recent_price_days ?? 3;
  const earliest = new Date(now.getTime() - recentDays * 86400000);
  const invoices = [...(state.invoices ?? []), state.invoice].filter(
    (invoice) =>
      invoice.company_id === state.config.company.seed_key &&
      invoice.branch === branch &&
      invoice.status === "posted" &&
      invoice.posted_at &&
      localDate(state, new Date(invoice.posted_at)) === today,
  );
  return searchProducts(
    state.products.filter(
      (item) =>
        item.company_id === state.config.company.seed_key &&
        item.status !== "archived",
    ),
    filters.query,
  ).filter((product) => {
    const arrived =
      invoices.some((invoice) =>
        invoice.lines.some(
          (line) =>
            line.product_code === product.code &&
            line.qty_received_at_posting > 0,
        ),
      ) ||
      (product.last_received_relative_days?.[branch] === 0 &&
        (!state.demo_fixture_anchor_date ||
          state.demo_fixture_anchor_date === today));
    const recent =
      state.activity.some(
        (event) =>
          event.company_id === product.company_id &&
          event.product_code === product.code &&
          (event.branch === branch || event.branch === "all") &&
          /price|approve/i.test(event.action) &&
          new Date(event.at) >= earliest &&
          new Date(event.at) <= now,
      ) ||
      (product.price_approved_relative_days !== undefined &&
        product.price_approved_relative_days >= -recentDays &&
        product.price_approved_relative_days <= 0 &&
        (!state.demo_fixture_anchor_date ||
          state.demo_fixture_anchor_date === today));
    return (
      (!filters.arrived || arrived) &&
      (!filters.changed || recent) &&
      (!filters.onOffer || Boolean(effectiveOffer(state, product, branch))) &&
      (!filters.pricing || product.pricing_category === filters.pricing) &&
      (!filters.category || product.ai_category === filters.category) &&
      (!filters.supplier || product.main_supplier === filters.supplier)
    );
  });
}

export function autoAddApprovedLabelChanges(
  before: DemoState,
  next: DemoState,
  actor: string,
) {
  if (!next.label_settings?.auto_add_approved) return;
  next.label_waitlist ??= [];
  for (const branch of configuredLabelBranches(next)) {
    for (const product of next.products.filter(
      (item) =>
        item.company_id === next.config.company.seed_key &&
        item.status === "active",
    )) {
      const price = effectivePrice(next, product, branch);
      const previous = effectivePrice(before, product.code, branch);
      if (
        !price ||
        (previous && new Decimal(price).eq(previous)) ||
        branchLabelWaitlist(next, branch).some(
          (item) => item.product_code === product.code,
        )
      )
        continue;
      next.label_waitlist.push({
        id: createId("label-waitlist"),
        company_id: product.company_id,
        branch,
        product_code: product.code,
        copies: 1,
        added_by: actor,
        added_at: new Date().toISOString(),
      });
    }
  }
}
