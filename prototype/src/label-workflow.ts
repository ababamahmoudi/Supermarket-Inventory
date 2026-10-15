import Decimal from "decimal.js";
import type { AuthenticatedActor, Capability } from "./authority-types";
import { freshActor } from "./authority";
import { can, requireCapability, requireConcreteLocation } from "./permissions";
import { actorAudit } from "./domain-authority";
import {
  projectProductReadDTO,
  type ProductReadDTO,
} from "./catalog-read-model";
import {
  projectOfferReadDTO,
  projectSaleReadDTO,
  type SaleReadDTO,
  type OfferReadDTO,
} from "./offers-read-model";
import {
  effectiveOffer,
  effectivePrice,
  regularPrice,
  searchProducts,
} from "./catalog";
import { activeSaleAt } from "./sales";
import { effectiveClearanceOffers } from "./receipt-lots";
import { createId } from "./ids";
import { labelLayout, labelPages } from "./labels";
import { configuredBranches } from "./settings";
import type {
  Branch,
  DemoState,
  LabelTemplate,
  LabelWaitlistItem,
  Product,
} from "./types";

export class LabelWorkflowError extends Error {
  constructor(
    readonly code:
      | "branch"
      | "permission"
      | "price"
      | "copies"
      | "template"
      | "logo"
      | "lot",
  ) {
    super(code);
  }
}

export type LabelActor = AuthenticatedActor;
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

export function configuredLabelBranches(state: {
  readonly config: Pick<DemoState["config"], "branches">;
}): Branch[] {
  return configuredBranches(state.config);
}
function permittedBranch(
  state: DemoState,
  branch: Branch,
  actor: LabelActor,
  capability: Capability = "labels.queue_write",
) {
  const current = freshActor(state, actor);
  requireConcreteLocation(state, current, branch);
  requireCapability(state, current, capability, {
    company_id: state.config.company.seed_key,
    kind: "location_record",
    location_ids: [branch],
    mutation: true,
    location_policy: "active_only",
  });
  return current;
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
    by: freshActor(state, actor).actor,
    ...actorAudit(state, actor),
    at: new Date().toISOString(),
    reversible,
    before,
    after,
  });
}

export function branchLabelWaitlist<W extends LabelWaitlistItem>(
  state: {
    readonly config: { readonly company: { readonly seed_key: string } };
    readonly label_waitlist?: readonly W[];
  },
  branch: Branch,
): W[] {
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
        (item) => item.product_code === code && !item.lot_id,
      )?.copies ?? 0) + copies,
    );
  for (const code of unique) {
    const item = branchLabelWaitlist(state, branch).find(
      (entry) => entry.product_code === code && !entry.lot_id,
    );
    if (item) item.copies += copies;
    else
      state.label_waitlist.push({
        id: createId("label-waitlist"),
        company_id: state.config.company.seed_key,
        branch,
        product_code: code,
        copies,
        added_by: freshActor(state, actor).actor,
        ...actorAudit(state, actor),
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

/** An explicit clearance label keeps its location/lot, separate from regular copies. */
export function addClearanceLabelToWaitlist(
  state: DemoState,
  productCode: string,
  lotId: string,
  copies: number,
  branch: Branch,
  actor: LabelActor,
): void {
  permittedBranch(state, branch, actor);
  copiesValue(copies);
  approvedProduct(state, productCode, branch);
  const offer = effectiveClearanceOffers(state, productCode, branch).find(
    (item) => item.lot_id === lotId,
  );
  if (!offer) throw new LabelWorkflowError("lot");
  const existing = branchLabelWaitlist(state, branch).find(
    (item) => item.product_code === productCode && item.lot_id === lotId,
  );
  const total = copiesValue((existing?.copies ?? 0) + copies);
  const before = structuredClone(branchLabelWaitlist(state, branch));
  state.label_waitlist ??= [];
  if (existing) existing.copies = total;
  else
    state.label_waitlist.push({
      id: createId("clearance-label"),
      company_id: state.config.company.seed_key,
      branch,
      branch_id: branch,
      product_code: productCode,
      lot_id: lotId,
      copies: total,
      added_by: freshActor(state, actor).actor,
      ...actorAudit(state, actor),
      added_at: new Date().toISOString(),
    });
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

export function setLabelWaitlistLot(
  state: DemoState,
  id: string,
  lotId: string | undefined,
  branch: Branch,
  actor: LabelActor,
): void {
  permittedBranch(state, branch, actor);
  const item = branchLabelWaitlist(state, branch).find(
    (entry) => entry.id === id,
  );
  if (!item) throw new LabelWorkflowError("lot");
  if (
    lotId &&
    !effectiveClearanceOffers(state, item.product_code, branch).some(
      (offer) => offer.lot_id === lotId,
    )
  )
    throw new LabelWorkflowError("lot");
  if (item.lot_id === lotId) return;
  const duplicate = branchLabelWaitlist(state, branch).find(
    (entry) =>
      entry.id !== id &&
      entry.product_code === item.product_code &&
      entry.lot_id === lotId,
  );
  const copies = duplicate
    ? copiesValue(duplicate.copies + item.copies)
    : item.copies;
  const before = structuredClone(branchLabelWaitlist(state, branch));
  if (duplicate) {
    duplicate.copies = copies;
    state.label_waitlist = state.label_waitlist!.filter(
      (entry) => entry.id !== id,
    );
  } else item.lot_id = lotId;
  record(
    state,
    actor,
    branch,
    "Change label lot",
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

export type LabelPrintProduct = ProductReadDTO & {
  label_lot_id?: string;
  label_clearance_offer?: OfferReadDTO;
  /** Present-null means the prepared terms contain no ordinary offer. */
  label_offer?: OfferReadDTO | null;
  label_sale?: SaleReadDTO | null;
  label_regular_price?: string | null;
  label_effective_price?: string | null;
};
export interface LabelPrintSnapshot {
  id: string;
  company_id: string;
  branch: Branch;
  template: LabelTemplate;
  startSlot: number;
  entries: LabelWaitlistItem[];
  products: LabelPrintProduct[];
  pages: (LabelPrintProduct | null)[][];
}
export function prepareLabelPrint(
  state: DemoState,
  branch: Branch,
  template: LabelTemplate,
  startSlot: number,
  actor: LabelActor,
  entryIds?: string[],
): LabelPrintSnapshot {
  actor = permittedBranch(state, branch, actor, "labels.print");
  if (
    template.company_id !== state.config.company.seed_key ||
    template.archived
  )
    throw new LabelWorkflowError("template");
  validateLabelTemplate(template, state.label_settings?.fields?.logo !== false);
  const branchEntries = branchLabelWaitlist(state, branch);
  if (entryIds?.some((id) => !branchEntries.some((entry) => entry.id === id)))
    throw new LabelWorkflowError("permission");
  const entries = structuredClone(
    entryIds
      ? branchEntries.filter((entry) => entryIds.includes(entry.id))
      : branchEntries,
  );
  const products = entries.flatMap((entry) => {
    const canonicalProduct = approvedProduct(state, entry.product_code, branch);
    const sale = activeSaleAt(state, canonicalProduct, branch);
    const offer = effectiveOffer(state, canonicalProduct, branch);
    const intent =
      entry.source_reason === "price_update"
        ? state.price_update_tasks?.find(
            (task) =>
              task.company_id === entry.company_id &&
              task.branch === branch &&
              task.product_code === entry.product_code &&
              task.status === "pending" &&
              entry.source_event_id === `price-task:${task.id}:${task.version}`,
          )
        : undefined;
    if (entry.source_reason === "price_update" && !intent)
      throw new LabelWorkflowError("price");
    const intentSale =
      intent?.new_price.sale_id &&
      state.sales?.find(
        (row) =>
          row.company_id === intent.company_id &&
          row.id === intent.new_price.sale_id,
      );
    const intentOffer =
      intent?.new_price.offer_id &&
      state.offers.find(
        (row) =>
          row.company_id === intent.company_id &&
          row.id === intent.new_price.offer_id,
      );
    const product: LabelPrintProduct = {
      ...projectProductReadDTO(state, actor, canonicalProduct),
      label_sale: intent
        ? intentSale
          ? projectSaleReadDTO(intentSale)
          : null
        : sale
          ? projectSaleReadDTO(sale)
          : null,
      label_offer: intent
        ? intentOffer
          ? projectOfferReadDTO(intentOffer)
          : null
        : offer
          ? projectOfferReadDTO(offer)
          : null,
      label_regular_price: intent
        ? (intent.new_price.canonical_regular_price ??
          intent.new_price.regular_price)
        : regularPrice(state, canonicalProduct, branch),
      label_effective_price: intent
        ? (intent.new_price.canonical_price ?? intent.new_price.price)
        : effectivePrice(state, canonicalProduct, branch),
    };
    if (entry.lot_id) {
      const offer = effectiveClearanceOffers(
        state,
        canonicalProduct,
        branch,
      ).find((item) => item.lot_id === entry.lot_id);
      if (!offer || template.style !== "promo")
        throw new LabelWorkflowError("lot");
      product.label_lot_id = entry.lot_id;
      product.label_clearance_offer = projectOfferReadDTO(offer);
    }
    return Array<LabelPrintProduct>(copiesValue(entry.copies)).fill(product);
  });
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
  actor = permittedBranch(state, snapshot.branch, actor, "labels.print");
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
    // A newer sale transition may reuse this ID for a different label intent.
    // Confirming the older sheet must not mark the newer label as printed.
    if (
      current.preferred_template !== printed.preferred_template ||
      current.source_event_id !== printed.source_event_id
    )
      continue;
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
      preferred_template: item.preferred_template,
      source_event_id: item.source_event_id,
      source_reason: item.source_reason,
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
  actor = freshActor(state, actor);
  if (template.company_id !== state.config.company.seed_key)
    throw new LabelWorkflowError("permission");
  validateLabelTemplate(template, state.label_settings?.fields?.logo !== false);
  const existing = state.templates.find(
    (item) =>
      item.id === template.id && item.company_id === template.company_id,
  );
  requireCapability(
    state,
    actor,
    existing ? "labels.templates_edit" : "labels.templates_create",
    {
      company_id: template.company_id,
      kind: "company_shared",
      entity_id: template.id,
      mutation: true,
    },
  );
  if (existing?.archived || template.archived)
    throw new LabelWorkflowError("template");
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

function managedTemplate(state: DemoState, id: string, actor: LabelActor) {
  freshActor(state, actor);
  const template = state.templates.find(
    (item) =>
      item.company_id === state.config.company.seed_key && item.id === id,
  );
  if (!template) throw new LabelWorkflowError("template");
  return template;
}

export function duplicateLabelTemplate(
  state: DemoState,
  id: string,
  actor: LabelActor,
  name: string,
): LabelTemplate {
  const original = managedTemplate(state, id, actor);
  requireCapability(state, actor, "labels.templates_create", {
    company_id: original.company_id,
    kind: "company_shared",
    entity_id: original.id,
    mutation: true,
  });
  if (original.archived || !name.trim())
    throw new LabelWorkflowError("template");
  const copy = structuredClone(original);
  copy.id = createId("label-template");
  copy.name = name.trim();
  delete copy.built_in;
  delete copy.archived;
  validateLabelTemplate(copy, state.label_settings?.fields?.logo !== false);
  state.templates.push(copy);
  record(
    state,
    actor,
    "all",
    "Duplicate template",
    true,
    null,
    structuredClone(copy),
  );
  return copy;
}

export function setLabelTemplateArchived(
  state: DemoState,
  id: string,
  archived: boolean,
  actor: LabelActor,
) {
  const template = managedTemplate(state, id, actor);
  requireCapability(state, actor, "labels.templates_archive", {
    company_id: template.company_id,
    kind: "company_shared",
    entity_id: template.id,
    mutation: true,
  });
  if (Boolean(template.archived) === archived) return;
  const before = structuredClone(template);
  template.archived = archived;
  record(
    state,
    actor,
    "all",
    archived ? "Archive template" : "Restore template",
    true,
    before,
    structuredClone(template),
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
      (!filters.onOffer ||
        Boolean(effectiveOffer(state, product, branch)) ||
        Boolean(activeSaleAt(state, product, branch, now)) ||
        effectiveClearanceOffers(state, product, branch).length > 0) &&
      (!filters.pricing || product.pricing_category === filters.pricing) &&
      (!filters.category || product.ai_category === filters.category) &&
      (!filters.supplier || product.main_supplier === filters.supplier)
    );
  });
}

export function autoAddApprovedLabelChanges(
  before: DemoState,
  next: DemoState,
  actor: AuthenticatedActor,
) {
  actor = freshActor(next, actor);
  if (!next.label_settings?.auto_add_approved) return;
  next.label_waitlist ??= [];
  for (const branch of configuredLabelBranches(next)) {
    if (
      !can(next, actor, "labels.queue_write", {
        company_id: next.config.company.seed_key,
        kind: "location_record",
        location_ids: [branch],
        mutation: true,
      }).allowed
    )
      continue;
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
        added_by: actor.actor,
        added_by_user_id: actor.user_id,
        added_at: new Date().toISOString(),
      });
    }
  }
}
