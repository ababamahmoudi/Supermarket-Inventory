import Decimal from "decimal.js";
import { createId } from "./ids";
import { companyDate } from "./invoice";
import { effectiveInvoiceVersion } from "./invoice-version";
import {
  effectiveInvoiceLocation,
  projectExpiryLocation,
  lastReceivedByLocation,
} from "./received";
import { configuredBranches, branchSellsToCustomers } from "./settings";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import {
  regularPrice,
  isOfferScheduledNow,
  lookupBranch,
  normalizeSearch,
} from "./catalog";
import { validTrackedDate } from "./date-tracking";
import type { HistoryContext } from "./history";
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
    const unitCost = new Decimal(line.unit_cost_before_tax).toFixed(4);
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

export function receiptLotsForProduct(
  state: DemoState,
  context: HistoryContext,
  productCode: string,
): ReceiptLot[] {
  if (
    context.role !== "supervisor" ||
    context.company_id !== state.config.company.seed_key
  )
    return [];
  return receiptLots(state).filter(
    (lot) =>
      lot.product_code === productCode &&
      context.allowed_branches.includes(lot.branch) &&
      (context.branch === "all" || context.branch === lot.branch),
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
  context: HistoryContext,
  input: {
    product_code: string;
    supplier: string;
    supplier_id?: string;
    branch: Branch;
  },
  now = new Date(),
): SafeDateSuggestion[] {
  if (
    context.company_id !== state.config.company.seed_key ||
    !["supervisor", "floor_worker"].includes(context.role) ||
    !configuredBranches(state.config).includes(input.branch)
  )
    return [];
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
  context: HistoryContext,
  productCode: string,
): { date: string; supplier?: string; invoice_number?: string } | undefined {
  const location = lookupBranch(context.branch);
  if (
    context.company_id !== state.config.company.seed_key ||
    !context.allowed_branches.includes(location)
  )
    return undefined;
  const latest = lastReceivedByLocation(
    state,
    {
      company_id: context.company_id,
      branch: location,
      role: context.role === "cashier" ? "floor_worker" : context.role,
      actor: context.actor,
    },
    productCode,
  ).find((entry) => entry.branch === location);
  if (!latest) return undefined;
  return context.role === "cashier"
    ? { date: latest.date }
    : {
        date: latest.date,
        supplier: latest.supplier,
        invoice_number: latest.invoice_number,
      };
}

/** Explicit branch input is the cashier's current allowed location, never all stores. */
export function effectiveClearanceOffers(
  state: DemoState,
  productOrCode: Product | string,
  branch: Branch,
  now = new Date(),
): Offer[] {
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
    !branchSellsToCustomers(state.config, location)
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
    receiptLots(state)
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
        offer.expiry_date! >= companyDate(state.config, now),
    )
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 1);
}

export class ClearanceError extends Error {
  constructor(readonly code: "permission" | "scope" | "lot" | "price") {
    super(code);
  }
}

export function scopedClearanceOffers(
  state: DemoState,
  context: HistoryContext,
  productCode: string,
  now = new Date(),
): Offer[] {
  if (
    context.company_id !== state.config.company.seed_key ||
    (context.role !== "supervisor" && context.branch === "all") ||
    !context.allowed_branches.includes(lookupBranch(context.branch))
  )
    return [];
  return effectiveClearanceOffers(state, productCode, context.branch, now);
}

export function setLotClearance(
  state: DemoState,
  context: HistoryContext,
  lotId: string,
  price: string,
  now = new Date(),
): Offer {
  if (context.role !== "supervisor") throw new ClearanceError("permission");
  if (context.company_id !== state.config.company.seed_key)
    throw new ClearanceError("scope");
  const lot = receiptLotsForProduct(
    state,
    context,
    receiptLots(state).find((item) => item.id === lotId)?.product_code ?? "",
  ).find((item) => item.id === lotId);
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
