/** Server-internal transaction evidence. Never import from screens or expose as a query DTO.
 * Purpose-specific factories require the canonical resource capability. Handles contain
 * no readable money, cannot be forged/spread, and are bound to one canonical transaction
 * state and freshly authenticated actor. Public purchase projections never use the
 * catalog fallback; only these trusted mutation calculations preserve that C8 fallback.
 */
import Decimal from "decimal.js";
import type { AuthenticatedActor, ResourceScope } from "./authority-types";
import { freshActor } from "./authority";
import { can, requireCapability } from "./permissions";
import {
  invoiceAuthorityScope,
  requireInvoiceAuthority,
} from "./invoice-authority";
import { effectiveInvoiceVersion } from "./invoice-version";
import { effectiveInvoiceLocation } from "./received";
import { supplierMatches, supplierRecords } from "./supplier-editor";
import type { ProductCostEntry } from "./product-costs";
import type { DemoState, Product, ReturnRecord } from "./types";

declare const transactionEvidence: unique symbol;
export interface InternalPurchaseEvidence {
  readonly [transactionEvidence]: true;
}
export type PurchaseEvidencePurpose =
  | "invoice_read"
  | "invoice_review"
  | "invoice_post"
  | "invoice_correct"
  | "invoice_short_resolve"
  | "return_pickup"
  | "return_pickup_correct";
type Purpose = PurchaseEvidencePurpose;
interface Evidence {
  state: DemoState;
  actor: AuthenticatedActor;
  purpose: Purpose;
  resource_id: string;
  scope: ResourceScope;
  return_record?: ReturnRecord;
}
const evidence = new WeakMap<object, Evidence>();
const capabilityFor = {
  invoice_read: "invoices.cost_read",
  invoice_review: "invoices.edit",
  invoice_post: "invoices.post",
  invoice_correct: "invoices.correct",
  invoice_short_resolve: "invoices.short_resolve",
  return_pickup: "returns.pickup_record",
  return_pickup_correct: "returns.pickup_correct",
} as const;
function retain(
  state: DemoState,
  actor: AuthenticatedActor,
  purpose: Purpose,
  resource_id: string,
  scope: ResourceScope,
  return_record?: ReturnRecord,
): InternalPurchaseEvidence {
  requireCapability(state, actor, capabilityFor[purpose], scope);
  const handle = Object.freeze({}) as InternalPurchaseEvidence;
  evidence.set(handle, {
    state,
    actor: freshActor(state, actor),
    purpose,
    resource_id,
    scope,
    return_record,
  });
  return handle;
}
export function invoicePurchaseEvidence(
  state: DemoState,
  actor: AuthenticatedActor,
  invoiceId: string,
  purpose: Extract<Purpose, `invoice_${string}`>,
): InternalPurchaseEvidence {
  actor = requireInvoiceAuthority(
    state,
    actor,
    capabilityFor[purpose],
    invoiceId,
    purpose !== "invoice_read",
  );
  const correction = purpose === "invoice_correct";
  return retain(
    state,
    actor,
    purpose,
    invoiceId,
    invoiceAuthorityScope(
      state,
      invoiceId,
      purpose !== "invoice_read",
      correction,
    ),
  );
}
function returnEvidenceScope(
  record: ReturnRecord,
  purpose: Extract<Purpose, `return_${string}`>,
): ResourceScope {
  return {
    company_id: record.company_id,
    kind: "location_record",
    location_ids: [record.branch],
    entity_id: record.id,
    status: record.status,
    mutation: true,
    location_policy:
      purpose === "return_pickup_correct"
        ? "retained_correction"
        : "active_only",
  };
}
export function returnPickupValuationEvidence(
  state: DemoState,
  actor: AuthenticatedActor,
  input: string | ReturnRecord,
  purpose: Extract<Purpose, `return_${string}`> = "return_pickup",
): InternalPurchaseEvidence {
  actor = freshActor(state, actor);
  const candidates =
    typeof input === "string"
      ? state.returns.filter((item) => item.id === input)
      : state.returns.includes(input)
        ? [input]
        : [];
  const permitted = candidates.filter(
    (record) =>
      record.company_id === actor.company_id &&
      (actor.selection.kind !== "location" ||
        record.branch === actor.selection.location_id) &&
      can(
        state,
        actor,
        capabilityFor[purpose],
        returnEvidenceScope(record, purpose),
      ).allowed,
  );
  // An aggregate ID collision is not a canonical identity. Exact guarded callers
  // retain their real object; no later valuation repeats an ID-only lookup.
  if (permitted.length !== 1) throw new Error("Return was not found.");
  const record = permitted[0];
  return retain(
    state,
    actor,
    purpose,
    record.id,
    returnEvidenceScope(record, purpose),
    record,
  );
}
function currentEvidence(
  state: DemoState,
  handle: InternalPurchaseEvidence,
  kind: "invoice" | "return",
): Evidence {
  const saved = evidence.get(handle);
  if (!saved || saved.state !== state || !saved.purpose.startsWith(kind + "_"))
    throw new Error("Invalid private purchase evidence.");
  // The captured scope is a private pre-mutation witness for internal effects in
  // this same transaction. A posted transition must not fabricate a foreign actor.
  requireCapability(
    state,
    saved.actor,
    capabilityFor[saved.purpose],
    saved.scope,
  );
  freshActor(state, saved.actor);
  const record =
    kind === "return"
      ? saved.return_record && state.returns.includes(saved.return_record)
        ? saved.return_record
        : undefined
      : saved.resource_id === state.invoice.id
        ? state.invoice
        : (state.invoices ?? []).find((item) => item.id === saved.resource_id);
  if (
    !record ||
    record.id !== saved.resource_id ||
    record.company_id !== saved.scope.company_id
  )
    throw new Error("Purchase source changed.");
  const location =
    kind === "invoice" && "lines" in record && record.status === "posted"
      ? effectiveInvoiceLocation(state, record as DemoState["invoice"])
      : record.branch;
  if (!saved.scope.location_ids?.includes(location))
    throw new Error("Purchase source location changed.");
  return saved;
}
/** Same canonical transaction actor for nested posting effects; no role/assignment upgrade. */
export function invoiceEvidenceActor(
  state: DemoState,
  handle: InternalPurchaseEvidence,
  invoiceId: string,
  expectedPurpose: Extract<PurchaseEvidencePurpose, `invoice_${string}`>,
): AuthenticatedActor {
  const saved = currentEvidence(state, handle, "invoice");
  if (saved.resource_id !== invoiceId || saved.purpose !== expectedPurpose)
    throw new Error("Invalid invoice posting evidence.");
  return freshActor(state, saved.actor);
}
/** Both pickup and pickup-correction memo effects keep this exact source and same real actor. */
export function returnEvidenceActor(
  state: DemoState,
  handle: InternalPurchaseEvidence,
  record: ReturnRecord,
): AuthenticatedActor {
  const saved = currentEvidence(state, handle, "return");
  if (saved.return_record !== record)
    throw new Error("Invalid return pickup evidence.");
  return freshActor(state, saved.actor);
}
export function closePurchaseEvidence(handle: InternalPurchaseEvidence): void {
  evidence.delete(handle);
}

/** Pure canonical selector used only below a valid private transaction witness. */
function receiptCosts(
  state: DemoState,
  company: string,
  location: string,
  product: Product,
): ProductCostEntry[] {
  const invoices = new Map(
    [...(state.invoices ?? []), state.invoice]
      .filter(
        (invoice) =>
          invoice.company_id === company && invoice.status === "posted",
      )
      .map((invoice) => [invoice.id, invoice]),
  );
  return [...invoices.values()]
    .flatMap((original) => {
      const invoice = effectiveInvoiceVersion(state, original),
        branch = effectiveInvoiceLocation(state, original);
      if (branch !== location) return [];
      return invoice.lines.flatMap((line, index): ProductCostEntry[] => {
        if (
          line.company_id !== company ||
          line.product_code !== product.code ||
          new Decimal(line.qty_received_at_posting)
            .minus(line.refused_units ?? 0)
            .plus(line.qty_later_received ?? 0)
            .lte(0)
        )
          return [];
        const later = line.short_dated
          ? undefined
          : (state.stock_movements ?? [])
              .filter(
                (movement) =>
                  movement.company_id === company &&
                  movement.invoice_id === original.id &&
                  movement.line_index === index &&
                  movement.product_code === product.code &&
                  movement.type === "short_resolved_received" &&
                  new Decimal(movement.qty).gt(0) &&
                  (original.short_receipt_keys ?? []).some(
                    (key) =>
                      movement.id === `${original.id}:delivery:${key}:stock`,
                  ) &&
                  Number.isFinite(Date.parse(movement.at)),
              )
              .sort(
                (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
              )[0];
        return [
          {
            id: `${invoice.id}:cost:${index}`,
            invoice_id: invoice.id,
            invoice_number: invoice.supplier_invoice_number,
            supplier: invoice.supplier,
            branch,
            date:
              original.invoice_date ?? original.posted_at?.slice(0, 10) ?? "",
            posted_at:
              later?.at ??
              original.posted_at ??
              original.received_at ??
              original.invoice_date ??
              "",
            receipt_id: later?.id,
            received_at: later?.at,
            unit_cost_before_tax: new Decimal(
              line.unit_cost_before_tax,
            ).toFixed(4),
            short_dated: line.short_dated === true,
            sold_by: line.sold_by ?? "each",
          },
        ];
      });
    })
    .sort(
      (a, b) =>
        b.posted_at.localeCompare(a.posted_at) || b.id.localeCompare(a.id),
    );
}
/** Trusted invoice calculation only. This is never a purchase-cost projection. */
export function invoicePriorRegularCost(
  state: DemoState,
  handle: InternalPurchaseEvidence,
  productCode: string,
): string | null {
  const saved = currentEvidence(state, handle, "invoice");
  const product = state.products.find(
    (item) =>
      item.company_id === saved.scope.company_id && item.code === productCode,
  );
  if (!product) return null;
  return (
    receiptCosts(
      state,
      saved.scope.company_id,
      saved.scope.location_ids![0],
      product,
    ).find((entry) => !entry.short_dated)?.unit_cost_before_tax ??
    product.last_cost_before_tax
  );
}
export interface InternalPickupLineValuation {
  product_code: string;
  unit_cost: string;
  cost_source: string;
}
/** Trusted createReturnMemo calculation only; its public DTO must omit these fields for BS/FW. */
export function pickupLineValuations(
  state: DemoState,
  handle: InternalPurchaseEvidence,
): InternalPickupLineValuation[] {
  const saved = currentEvidence(state, handle, "return");
  const record = saved.return_record;
  if (!record) throw new Error("Invalid private purchase evidence.");
  const supplier = supplierRecords(state).find(
    (item) =>
      item.company_id === record.company_id &&
      supplierMatches(item, record.supplier),
  );
  const matches = (name: string) =>
    supplier ? supplierMatches(supplier, name) : name === record.supplier;
  return record.lines.map((line) => {
    const product = state.products.find(
      (item) =>
        item.company_id === record.company_id &&
        item.code === line.product_code,
    );
    if (!product) throw new Error("product");
    const purchases = receiptCosts(
      state,
      record.company_id,
      record.branch,
      product,
    ).filter(
      (item) =>
        matches(item.supplier) &&
        (!record.linked_invoice || item.invoice_id === record.linked_invoice),
    );
    const purchase = purchases[0];
    const stored = line.unit_cost;
    // New returns retain the exact receipt snapshot; later unrelated purchases
    // cannot substitute their price or invalidate that already selected cost.
    const frozenReceipt = Boolean(
      record.creation_request_id && line.source_receipt && stored !== undefined,
    );
    if (
      !frozenReceipt &&
      purchases
        .filter((item) => item.posted_at === purchase?.posted_at)
        .some(
          (item) =>
            item.unit_cost_before_tax !== purchase?.unit_cost_before_tax,
        )
    )
      throw new Error("return_cost");
    const source =
      stored ??
      purchase?.unit_cost_before_tax ??
      (matches(product.main_supplier)
        ? product.last_cost_before_tax
        : undefined);
    if (source === undefined) throw new Error("return_cost");
    let cost: Decimal;
    try {
      cost = new Decimal(source).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    } catch {
      throw new Error("return_cost");
    }
    if (!cost.isFinite() || cost.lt(0)) throw new Error("return_cost");
    // Exact line index is retained by the canonical cost source ID.
    const index = purchase?.id.slice(purchase.id.lastIndexOf(":") + 1);
    return {
      product_code: line.product_code,
      unit_cost: cost.toFixed(4),
      cost_source: stored
        ? `return-line:${record.id}:${line.product_code}`
        : purchase
          ? `invoice:${purchase.invoice_id}:${index}`
          : `catalog-last-cost:${product.code}`,
    };
  });
}
