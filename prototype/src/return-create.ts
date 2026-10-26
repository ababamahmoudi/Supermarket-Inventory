import Decimal from "decimal.js";
import { actorAudit } from "./domain-authority";
import { createId } from "./ids";
import { businessFingerprint } from "./business-fingerprint";
import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import type { OperationalReturn } from "./operations";
import {
  resolveReturnCreateSource,
  ReturnCreateError,
  type ReturnCreateSourceInput,
} from "./return-create-source";
import {
  returnCreationPhotoReferences,
  type ReturnCreationPhoto,
} from "./return-create-files";
export {
  returnCreateChoices,
  returnCreateScope,
  ReturnCreateError,
} from "./return-create-source";
export type {
  ReturnCreateChoices,
  ReturnCreateProductChoice,
  ReturnCreateSourceInput,
} from "./return-create-source";
export const returnReasons = [
  "damaged",
  "expired",
  "wrong_item",
  "short_dated",
  "other",
] as const;
export type ReturnReason = (typeof returnReasons)[number];
export interface CreateReturnInput extends ReturnCreateSourceInput {
  quantity: string;
  quantity_unit: "units" | "lb";
  reason: ReturnReason;
  note: string;
  photos: readonly ReturnCreationPhoto[];
}
/** One current-authority transaction; no stock, price, pickup or legal credit effect. */
export function createReturn(
  state: DemoState,
  actor: AuthenticatedActor,
  input: CreateReturnInput,
  now = new Date(),
): string {
  const actual = resolveReturnCreateSource(state, actor, input);
  actor = actual.actor;
  const source = actual.source;
  if (input.quantity_unit !== source.quantity_unit)
    throw new ReturnCreateError("unit");
  if (
    typeof input.quantity !== "string" ||
    !/^\d+(?:\.\d{1,4})?$/.test(input.quantity)
  )
    throw new ReturnCreateError("quantity");
  const quantity = new Decimal(input.quantity);
  if (
    !quantity.isFinite() ||
    quantity.lte(0) ||
    (input.quantity_unit === "units" && !quantity.isInteger()) ||
    quantity.gt(Number.MAX_SAFE_INTEGER)
  )
    throw new ReturnCreateError("quantity");
  if (!new Decimal(quantity.toNumber()).eq(quantity))
    throw new ReturnCreateError("quantity");
  if (!returnReasons.includes(input.reason))
    throw new ReturnCreateError("reason");
  if (typeof input.note !== "string" || input.note.length > 5000)
    throw new ReturnCreateError("note");
  if (input.reason === "other" && !input.note.trim())
    throw new ReturnCreateError("note");
  if (!Array.isArray(input.photos)) throw new ReturnCreateError("photos");
  const references = returnCreationPhotoReferences(
    state,
    actor,
    input,
    input.photos,
  );
  if (["damaged", "expired"].includes(input.reason) && references.length === 0)
    throw new ReturnCreateError("photos");
  const fingerprint = businessFingerprint({
    branch: input.branch,
    supplier_id: input.supplier_id,
    product_code: input.product_code,
    source: input.source_fingerprint,
    quantity: quantity.toString(),
    unit: input.quantity_unit,
    reason: input.reason,
    note: input.note.trim(),
    photos: references,
  });
  const previous = state.returns.find(
    (record) =>
      record.company_id === actor.company_id &&
      record.creation_request_id === input.request_id,
  );
  if (previous) {
    if (
      previous.created_by_user_id !== actor.user_id ||
      previous.creation_fingerprint !== fingerprint
    )
      throw new ReturnCreateError("request");
    return previous.id;
  }
  const at = now.toISOString(),
    attribution = actorAudit(state, actor, now);
  const record: OperationalReturn = {
    id: createId("return"),
    company_id: actor.company_id,
    branch: input.branch,
    branch_id: input.branch,
    supplier: source.supplier.name,
    supplier_id: source.supplier.id,
    currency: source.currency,
    status: "open",
    original_units_recovered: 0,
    created_at: at,
    created_by: actor.actor,
    created_by_user_id: actor.user_id,
    created_by_role_snapshot: actor.role,
    creation_request_id: input.request_id,
    creation_fingerprint: fingerprint,
    lines: [
      {
        product_code: source.product.code,
        qty: quantity.toNumber(),
        quantity_unit: source.quantity_unit,
        unit_cost: source.cost!,
        reason: input.reason,
        location: input.branch,
        source_receipt: {
          invoice_id: source.invoice_id,
          line_index: source.line_index,
          received_at: source.received_at,
          source_fingerprint: source.fingerprint,
        },
      },
    ],
    note: input.note.trim() || undefined,
    evidence: [
      {
        id: createId("return-created"),
        kind: "created",
        at,
        by: actor.actor,
        ...attribution,
        note: input.note.trim() || undefined,
        product_code: source.product.code,
        quantities: { [source.product.code]: quantity.toNumber() },
      },
      ...references.map((photo) => ({
        id: createId("return-photo"),
        kind: "creation_photo",
        at,
        by: actor.actor,
        ...attribution,
        photo,
        product_code: source.product.code,
      })),
    ],
  };
  state.returns.push(record);
  // Operational audit deliberately excludes costs, private receipt IDs and file references.
  state.activity.push({
    id: createId("return-create-activity"),
    company_id: actor.company_id,
    branch: input.branch,
    scope: "branch",
    action: "Created return",
    by: actor.actor,
    at,
    ...attribution,
    entity_type: "return",
    entity_id: record.id,
    product_code: source.product.code,
    reversible: false,
    after: {
      supplier: record.supplier,
      product_code: source.product.code,
      qty: quantity.toNumber(),
      quantity_unit: source.quantity_unit,
      reason: input.reason,
      note: input.note.trim(),
      photo_count: references.length,
      status: "open",
    },
  });
  return record.id;
}
