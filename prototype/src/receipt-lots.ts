import Decimal from "decimal.js";
import type { CatalogPriceReadState, PriceProduct } from "./catalog";
import { sellingSaleBranches } from "./sales";
import { createId } from "./ids";
import { companyDate } from "./invoice";
import { effectiveInvoiceVersion } from "./invoice-version";
import { effectiveInvoiceLocation, projectExpiryLocation } from "./received";
import { configuredBranches, branchSellsToCustomers } from "./settings";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import {
  regularPrice,
  isOfferScheduledNow,
  lookupBranch,
  normalizeSearch,
} from "./catalog";
import { validTrackedDate } from "./date-tracking";
import { invoiceFreeAcquisition } from "./invoice-free-acquisition";
import type { AuthenticatedActor } from "./authority-types";
import { freshActor } from "./authority";
import { can, requireCapability, requireConcreteLocation } from "./permissions";
import { purchaseLocationScope } from "./purchase-authority";
import { canInvoiceAuthority } from "./invoice-authority";
import {
  projectPurchaseOperational,
  type ReceiptLotReadDTO,
} from "./purchase-projections";
import type {
  Branch,
  DemoInvoice,
  DemoState,
  Offer,
  Product,
  ScopedRecord,
} from "./types";

/** Receipt evidence, never a remaining/on-hand stock projection. */
export interface ReceiptLot extends ScopedRecord {
  id: string;
  product_code: string;
  supplier_id?: string;
  supplier: string;
  date_type: "expiry" | "best_before";
  expiry_date: string;
  received_quantity: string;
  unit_cost: string;
  quantity_unit: "units" | "lb";
  source_receipts: {
    invoice_id: string;
    line_index: number;
    quantity: string;
    unit_cost: string;
    acquisition_amount?: string;
    received_at: string;
    short_dated: boolean;
  }[];
}

function supplierIdentity(state: DemoState, name: string, id?: string): string {
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === state.config.company.seed_key &&
      (id ? item.id === id : supplierMatches(item, name)),
  );
  return supplier ? `id:${supplier.id}` : `name:${normalizeSearch(name)}`;
}

function invoiceLots(state: DemoState, original: DemoInvoice): ReceiptLot[] {
  if (
    original.company_id !== state.config.company.seed_key ||
    original.status !== "posted"
  )
    return [];
  const invoice = effectiveInvoiceVersion(state, original);
  const branch = effectiveInvoiceLocation(state, original);
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === invoice.company_id &&
      supplierMatches(item, invoice.supplier),
  );
  return invoice.lines.flatMap((line, lineIndex) => {
    if (
      line.company_id !== invoice.company_id ||
      !line.product_code ||
      !validTrackedDate(line.date_value ?? "")
    )
      return [];
    const product = state.products.find(
      (item) =>
        item.company_id === invoice.company_id &&
        item.code === line.product_code,
    );
    if (!product) return [];
    const quantity = Decimal.max(
      0,
      new Decimal(line.qty_received_at_posting).minus(line.refused_units ?? 0),
    ).plus(line.qty_later_received ?? 0);
    if (!quantity.gt(0)) return [];
    const identity = [
      invoice.company_id,
      product.code,
      supplierIdentity(state, invoice.supplier),
      branch,
      line.date_value!,
    ];
    const acquisition = invoiceFreeAcquisition(line);
    const unitCost =
      acquisition?.unit_cost ??
      new Decimal(line.unit_cost_before_tax).toFixed(4);
    return [
      {
        id: `receipt-lot:${encodeURIComponent(JSON.stringify(identity))}`,
        company_id: invoice.company_id,
        branch,
        branch_id: branch,
        product_code: product.code,
        supplier_id: supplier?.id,
        supplier: invoice.supplier,
        date_type: line.date_type ?? "expiry",
        expiry_date: line.date_value!,
        received_quantity: quantity.toFixed(),
        unit_cost: unitCost,
        quantity_unit:
          line.sold_by === "weight" ? ("lb" as const) : ("units" as const),
        source_receipts: [
          {
            invoice_id: invoice.id,
            line_index: lineIndex,
            quantity: quantity.toFixed(),
            unit_cost: unitCost,
            ...(acquisition ? { acquisition_amount: acquisition.amount } : {}),
            received_at:
              invoice.received_at ??
              invoice.posted_at ??
              `${invoice.invoice_date}T12:00:00Z`,
            short_dated: line.short_dated === true,
          },
        ],
      },
    ];
  });
}

function groupLots(lots: ReceiptLot[]): ReceiptLot[] {
  const grouped = new Map<string, ReceiptLot>();
  for (const lot of lots) {
    const existing = grouped.get(lot.id);
    if (!existing) {
      grouped.set(lot.id, structuredClone(lot));
      continue;
    }
    for (const source of lot.source_receipts) {
      if (
        existing.source_receipts.some(
          (item) =>
            item.invoice_id === source.invoice_id &&
            item.line_index === source.line_index,
        )
      )
        continue;
      existing.source_receipts.push(structuredClone(source));
      existing.received_quantity = new Decimal(existing.received_quantity)
        .plus(source.quantity)
        .toFixed();
    }
    existing.source_receipts.sort(
      (a, b) =>
        a.received_at.localeCompare(b.received_at) ||
        a.invoice_id.localeCompare(b.invoice_id) ||
        a.line_index - b.line_index,
    );
    existing.unit_cost = existing.source_receipts.at(-1)!.unit_cost;
  }
  return [...grouped.values()];
}

/** Current lots follow effective corrections; original posted receipts remain addressable. */
export function receiptLots(state: DemoState): ReceiptLot[] {
  const invoices = new Map(
    [...(state.invoices ?? []), state.invoice]
      .filter(
        (invoice) =>
          invoice.company_id === state.config.company.seed_key &&
          invoice.status === "posted",
      )
      .map((invoice) => [invoice.id, invoice]),
  );
  return groupLots(
    [...invoices.values()].flatMap((invoice) => invoiceLots(state, invoice)),
  );
}

/** Called by successful posting only. It appends original evidence, never stock/money. */
export function recordInvoiceReceiptLots(
  state: DemoState,
  invoice: DemoInvoice,
): void {
  if (
    invoice.company_id !== state.config.company.seed_key ||
    invoice.status !== "posted"
  )
    return;
  const lots = invoiceLots(state, invoice);
  state.receipt_lots ??= [];
  for (const lot of lots) {
    const existing = state.receipt_lots.find(
      (item) => item.company_id === lot.company_id && item.id === lot.id,
    );
    if (!existing) state.receipt_lots.push(structuredClone(lot));
    else {
      const merged = groupLots([existing, lot])[0];
      Object.assign(existing, merged);
    }
  }
}

/** Scoped operational lot metadata; purchase money is an independent capability. */
export function receiptLotsForProduct(
  state: DemoState,
  context: AuthenticatedActor,
  productCode: string,
): ReceiptLotReadDTO[] {
  context = freshActor(state, context);
  requireCapability(state, context, "lots.read", {
    company_id: state.config.company.seed_key,
    kind: "company_shared",
  });
  if (
    !can(state, context, "received.read", {
      company_id: state.config.company.seed_key,
      kind: "company_shared",
    }).allowed
  )
    return [];
  return projectPurchaseOperational(state, context).receipt_lots.filter(
    (lot) => lot.product_code === productCode,
  );
}

export interface SafeDateSuggestion {
  id: string;
  branch: Branch;
  date_type: "expiry" | "best_before";
  date: string;
  lot_number?: string;
  entered_date: string;
}

/** Narrow receiving hint; never returns another location's quantity, cost or invoice. */
export function reusableOtherLocationDates(
  state: DemoState,
  context: AuthenticatedActor,
  input: {
    product_code: string;
    supplier: string;
    supplier_id?: string;
    branch: Branch;
  },
  now = new Date(),
): SafeDateSuggestion[] {
  context = freshActor(state, context);
  requireCapability(
    state,
    context,
    "dates.reuse_safe_hint",
    purchaseLocationScope(state.config.company.seed_key, input.branch),
  );
  if (!configuredBranches(state.config).includes(input.branch)) return [];
  const product = state.products.find(
    (item) =>
      item.company_id === context.company_id &&
      item.code === input.product_code &&
      item.status !== "archived",
  );
  if (!product) return [];
  const expectedSupplier = supplierIdentity(
    state,
    input.supplier,
    input.supplier_id,
  );
  const posted = new Map(
    [...(state.invoices ?? []), state.invoice]
      .filter(
        (invoice) =>
          invoice.company_id === context.company_id &&
          invoice.status === "posted",
      )
      .map((invoice) => [invoice.id, invoice]),
  );
  const today = companyDate(state.config, now);
  const results = state.expiry
    .filter(
      (entry) =>
        entry.company_id === context.company_id &&
        entry.product_code === product.code &&
        entry.status === "active" &&
        validTrackedDate(entry.date),
    )
    .map((entry) => projectExpiryLocation(state, entry))
    .filter(
      (entry) =>
        entry.branch !== input.branch &&
        configuredBranches(state.config).includes(entry.branch),
    )
    .flatMap((entry): SafeDateSuggestion[] => {
      const invoice = entry.invoice_id
        ? posted.get(entry.invoice_id)
        : undefined;
      const supplier = entry.supplier ?? invoice?.supplier;
      if (
        !supplier ||
        supplierIdentity(state, supplier, entry.supplier_id) !==
          expectedSupplier
      )
        return [];
      const timestamp =
        entry.created_at ?? invoice?.received_at ?? entry.received_date;
      if (!timestamp) return [];
      let enteredDate: string;
      if (timestamp.length === 10) {
        if (!validTrackedDate(timestamp)) return [];
        const days =
          (Date.parse(`${today}T12:00:00Z`) -
            Date.parse(`${timestamp}T12:00:00Z`)) /
          86_400_000;
        if (days < 0 || days >= 7) return [];
        enteredDate = timestamp;
      } else {
        const entered = new Date(timestamp);
        if (
          !Number.isFinite(entered.getTime()) ||
          entered.getTime() > now.getTime() ||
          entered.getTime() < now.getTime() - 7 * 86_400_000
        )
          return [];
        enteredDate = companyDate(state.config, entered);
      }
      return [
        {
          id: entry.id,
          branch: entry.branch,
          date_type: entry.date_type ?? "expiry",
          date: entry.date,
          lot_number: entry.lot_number,
          entered_date: enteredDate,
        },
      ];
    });
  const unique = new Map(
    results
      .sort((a, b) => b.entered_date.localeCompare(a.entered_date))
      .map((entry) => [
        `${entry.branch}:${entry.date_type}:${entry.date}:${entry.lot_number ?? ""}`,
        entry,
      ]),
  );
  return [...unique.values()];
}

export function firstAddedLocation(
  state: DemoState,
  product: Product,
): Branch | undefined {
  if (product.company_id !== state.config.company.seed_key) return undefined;
  if (product.first_added_branch) return product.first_added_branch;
  const invoice = [...(state.invoices ?? []), state.invoice]
    .filter(
      (item) =>
        item.company_id === product.company_id &&
        item.status === "posted" &&
        item.lines.some(
          (line) =>
            line.product_code === product.code &&
            line.company_id === product.company_id,
        ),
    )
    .sort((a, b) =>
      (a.received_at ?? a.posted_at ?? a.invoice_date ?? "").localeCompare(
        b.received_at ?? b.posted_at ?? b.invoice_date ?? "",
      ),
    )[0];
  return invoice?.branch;
}

/** Catalog metadata only: cashiers never receive receipt quantities or money. */
export function lookupLastReceipt(
  state: DemoState,
  context: AuthenticatedActor,
  productCode: string,
): { date: string; supplier?: string; invoice_number?: string } | undefined {
  context = freshActor(state, context);
  const location = requireConcreteLocation(state, context);
  requireCapability(
    state,
    context,
    "lookup.receipt_hint",
    purchaseLocationScope(context.company_id, location),
  );
  if (
    !state.products.some(
      (product) =>
        product.company_id === context.company_id &&
        product.code === productCode,
    )
  )
    return undefined;
  const candidates: {
    at: string;
    date: string;
    supplier?: string;
    invoice_number?: string;
  }[] = [];
  const displayDate = (at: string) =>
    at.length === 10 ? at : companyDate(state.config, new Date(at));
  const invoices = new Map(
    [...(state.invoices ?? []), state.invoice].map((invoice) => [
      invoice.id,
      invoice,
    ]),
  );
  for (const original of invoices.values()) {
    if (
      original.company_id !== context.company_id ||
      original.status !== "posted" ||
      effectiveInvoiceLocation(state, original) !== location
    )
      continue;
    const invoice = effectiveInvoiceVersion(state, original);
    const lines = invoice.lines.filter(
      (line) =>
        line.company_id === context.company_id &&
        line.product_code === productCode &&
        new Decimal(line.qty_received_at_posting)
          .minus(line.refused_units ?? 0)
          .plus(line.qty_later_received ?? 0)
          .gt(0),
    );
    if (!lines.length) continue;
    const at = invoice.received_at ?? invoice.posted_at ?? invoice.invoice_date;
    if (!at) continue;
    const readable = canInvoiceAuthority(
      state,
      context,
      "invoices.read",
      original.id,
    );
    const metadata = readable
      ? {
          supplier: invoice.supplier,
          invoice_number: invoice.supplier_invoice_number,
        }
      : {};
    candidates.push({ at, date: displayDate(at), ...metadata });
    for (const movement of state.stock_movements ?? []) {
      if (
        movement.company_id !== context.company_id ||
        movement.invoice_id !== original.id ||
        movement.branch !== location ||
        movement.product_code !== productCode ||
        movement.type !== "short_resolved_received" ||
        new Decimal(movement.qty).lte(0) ||
        !(original.short_receipt_keys ?? []).some(
          (key) => movement.id === `${original.id}:delivery:${key}:stock`,
        )
      )
        continue;
      candidates.push({
        at: movement.at,
        date: displayDate(movement.at),
        ...metadata,
      });
    }
  }
  for (const movement of state.stock_movements ?? []) {
    if (
      movement.company_id !== context.company_id ||
      movement.branch !== location ||
      movement.product_code !== productCode ||
      movement.type !== "replacement_received" ||
      new Decimal(movement.qty).lte(0)
    )
      continue;
    candidates.push({ at: movement.at, date: displayDate(movement.at) });
  }
  const latest = candidates.sort((first, second) =>
    second.at.localeCompare(first.at),
  )[0];
  if (!latest) return undefined;
  return {
    date: latest.date,
    ...(latest.supplier ? { supplier: latest.supplier } : {}),
    ...(latest.invoice_number ? { invoice_number: latest.invoice_number } : {}),
  };
}

/** Explicit branch input is the cashier's current allowed location, never all stores. */
/** Pure public selector. Only already-projected receipt evidence is read; absent lots grant no clearance. */
export function effectiveProjectedClearanceOffers<
  P extends PriceProduct,
  O extends Offer,
>(
  state: Omit<CatalogPriceReadState<P>, "offers"> & {
    offers: readonly O[];
    clearance_lots?: readonly Pick<
      ReceiptLot,
      "id" | "company_id" | "product_code" | "branch"
    >[];
    receipt_lots?: readonly Pick<
      ReceiptLot,
      "id" | "company_id" | "product_code" | "branch"
    >[];
  },
  productOrCode: P | string,
  branch: Branch,
  now = new Date(),
): O[] {
  const code =
    typeof productOrCode === "string" ? productOrCode : productOrCode.code;
  const product = state.products.find(
    (item) =>
      item.company_id === state.config.company.seed_key && item.code === code,
  );
  const location = lookupBranch(branch);
  if (
    !product ||
    product.status !== "active" ||
    !sellingSaleBranches(state).includes(location)
  )
    return [];
  let regularAmount: Decimal;
  try {
    regularAmount = new Decimal(regularPrice(state, product, location) ?? "0");
    if (!regularAmount.isFinite() || !regularAmount.gt(0)) return [];
  } catch {
    return [];
  }
  const eligibleLots = new Set(
    (state.clearance_lots ?? state.receipt_lots ?? [])
      .filter(
        (lot) =>
          lot.company_id === product.company_id &&
          lot.product_code === code &&
          lot.branch === location,
      )
      .map((lot) => lot.id),
  );
  return state.offers
    .filter((offer) => {
      try {
        const price = new Decimal(offer.price);
        return price.isFinite() && price.gt(0) && price.lt(regularAmount);
      } catch {
        return false;
      }
    })
    .filter(
      (offer) =>
        offer.company_id === product.company_id &&
        offer.product_code === code &&
        offer.clearance === true &&
        offer.lot_id &&
        eligibleLots.has(offer.lot_id) &&
        offer.branch === location &&
        offer.scope === "branch" &&
        offer.status === "active" &&
        offer.currency === state.config.company.currency &&
        isOfferScheduledNow(offer, state.config.company.timezone, now) &&
        validTrackedDate(offer.expiry_date ?? "") &&
        offer.expiry_date! >=
          new Intl.DateTimeFormat("en-CA", {
            timeZone: state.config.company.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now),
    )
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 1);
}

/** Canonical receipt-derived fallback remains private to the guarded business domain. */
export function effectiveClearanceOffers(
  state: DemoState,
  productOrCode: Product | string,
  branch: Branch,
  now = new Date(),
): Offer[] {
  return effectiveProjectedClearanceOffers(
    { ...state, receipt_lots: receiptLots(state) },
    productOrCode,
    branch,
    now,
  );
}

export class ClearanceError extends Error {
  constructor(readonly code: "permission" | "scope" | "lot" | "price") {
    super(code);
  }
}

export function scopedClearanceOffers(
  state: DemoState,
  context: AuthenticatedActor,
  productCode: string,
  now = new Date(),
): Offer[] {
  context = freshActor(state, context);
  const location = requireConcreteLocation(state, context);
  requireCapability(
    state,
    context,
    "offers.read",
    purchaseLocationScope(context.company_id, location),
  );
  return effectiveClearanceOffers(state, productCode, location, now);
}

export function setLotClearance(
  state: DemoState,
  context: AuthenticatedActor,
  lotId: string,
  price: string,
  now = new Date(),
): Offer {
  context = freshActor(state, context);
  const lot = receiptLots(state).find(
    (item) => item.id === lotId && item.company_id === context.company_id,
  );
  if (!lot) throw new ClearanceError("lot");
  requireCapability(
    state,
    context,
    "offers.clearance_create",
    purchaseLocationScope(lot.company_id, lot.branch, true),
  );
  if (
    !lot ||
    !branchSellsToCustomers(state.config, lot.branch) ||
    lot.expiry_date < companyDate(state.config, now)
  )
    throw new ClearanceError("lot");
  const regular = regularPrice(state, lot.product_code, lot.branch);
  if (
    !/^\d+(\.\d{1,2})?$/.test(price) ||
    !regular ||
    new Decimal(price).lte(0) ||
    new Decimal(price).gte(regular)
  )
    throw new ClearanceError("price");
  const amount = new Decimal(price).toFixed(2);
  const duplicate = state.offers.find(
    (offer) =>
      offer.company_id === context.company_id &&
      offer.product_code === lot.product_code &&
      offer.branch === lot.branch &&
      offer.clearance === true &&
      offer.status === "active" &&
      offer.lot_id === lot.id &&
      offer.price === amount &&
      offer.expiry_date === lot.expiry_date,
  );
  if (duplicate) return duplicate;
  const before = structuredClone(
    state.offers.filter(
      (offer) =>
        offer.company_id === context.company_id &&
        offer.product_code === lot.product_code &&
        offer.branch === lot.branch &&
        offer.clearance === true,
    ),
  );
  for (const offer of state.offers)
    if (
      offer.company_id === context.company_id &&
      offer.product_code === lot.product_code &&
      offer.branch === lot.branch &&
      offer.clearance === true &&
      offer.status !== "stopped"
    ) {
      offer.status = "stopped";
      offer.stopped_at = now.toISOString();
      offer.stopped_by_user_id = context.user_id;
    }
  const offer: Offer = {
    id: createId("lot-clearance"),
    company_id: context.company_id,
    branch: lot.branch,
    branch_id: lot.branch,
    product_code: lot.product_code,
    scope: "branch",
    currency: state.config.company.currency,
    lot_id: lot.id,
    expiry_date: lot.expiry_date,
    clearance: true,
    label: amount,
    price: amount,
    pool: `clearance:${lot.id}`,
    mix_and_match: false,
    status: "active",
    created_at: now.toISOString(),
    created_by_user_id: context.user_id,
    version: 1,
    end_date: lot.expiry_date,
  };
  state.offers.push(offer);
  state.activity.push({
    id: createId("clearance-activity"),
    company_id: context.company_id,
    branch: lot.branch,
    product_code: lot.product_code,
    action: "Create clearance offer",
    by: context.actor,
    actor_username: context.username,
    actor_user_id: context.user_id,
    actor_role_snapshot: context.role,
    device_id: context.device_id,
    at: now.toISOString(),
    scope: "branch",
    entity_type: "offer",
    entity_id: offer.id,
    reversible: true,
    before,
    after: structuredClone(
      state.offers.filter(
        (item) =>
          item.company_id === context.company_id &&
          item.product_code === lot.product_code &&
          item.branch === lot.branch &&
          item.clearance === true,
      ),
    ),
  });
  return offer;
}
