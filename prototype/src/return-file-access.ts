import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
} from "./authority-types";
import { freshActor } from "./authority";
import { can, requireCapability } from "./permissions";
import { domainScope, selectedLocations } from "./domain-authority";
import { readStoredFile, storeUploadedFile } from "./file-database";
import type { OperationalReturn } from "./operations";
import type { DemoState } from "./types";

export type ProtectedReturnQuery = <T>(
  capability: Capability,
  scope: ResourceScope,
  project: (state: DemoState, actor: AuthenticatedActor) => T,
) => Promise<T>;
interface UploadSource {
  company_id: string;
  user_id: string;
  session_id: string;
  authority_epoch: number;
  fingerprint: string;
}
declare const returnPhotoBrand: unique symbol;
export interface ReturnPhotoAttachment {
  readonly name: string;
  readonly [returnPhotoBrand]: true;
}
interface AttachmentSource extends UploadSource {
  return_id: string;
  capability: PhotoCapability;
  reference: string;
}
const attachments = new WeakMap<ReturnPhotoAttachment, AttachmentSource>();
const uploadSources = new WeakMap<object, UploadSource>();
interface ReadSource {
  reference: string;
  company_id: string;
  user_id: string;
  session_id: string;
  authority_epoch: number;
  event_snapshot: string;
}
const photoReads = new WeakMap<object, ReadSource>();
type PhotoCapability =
  | "returns.pickup_record"
  | "returns.pickup_correct"
  | "returns.operational_resolve";
function photoScope(
  state: DemoState,
  record: DemoState["returns"][number],
  capability: Capability,
): ResourceScope {
  const scope = domainScope(state, record, capability !== "returns.read");
  return capability === "returns.pickup_correct" ||
    capability === "returns.operational_resolve"
    ? { ...scope, location_policy: "retained_correction" }
    : scope;
}
function canonicalReturn(
  state: DemoState,
  actor: AuthenticatedActor,
  id: string,
  capability: Capability,
) {
  const current = freshActor(state, actor);
  const selected = new Set(selectedLocations(state, current, true));
  const candidates = state.returns.filter(
    (item) =>
      item.id === id &&
      item.company_id === current.company_id &&
      item.company_id === state.config.company.seed_key &&
      selected.has(item.branch) &&
      can(state, current, capability, photoScope(state, item, capability))
        .allowed,
  );
  // An ID is never authority: resolve one actual permitted source before file IO.
  if (candidates.length !== 1)
    throw new Error("Return evidence is unavailable.");
  const record = candidates[0];
  requireCapability(
    state,
    current,
    capability,
    photoScope(state, record, capability),
  );
  return { record: record as OperationalReturn, actor: current };
}
/** Storage may await outside a transaction; both sides resolve the actual canonical return. */
export async function uploadReturnPhoto(
  query: ProtectedReturnQuery,
  input: {
    company_id: string;
    return_id: string;
    capability: PhotoCapability;
    file: File;
  },
) {
  if (
    ![
      "returns.pickup_record",
      "returns.pickup_correct",
      "returns.operational_resolve",
    ].includes(input.capability)
  )
    throw new Error("Return evidence is unavailable.");
  const scope: ResourceScope = {
    company_id: input.company_id,
    kind: "company_shared",
    entity_id: input.return_id,
  };
  const handle = await query(input.capability, scope, (state, actor) => {
    const actual = canonicalReturn(
      state,
      actor,
      input.return_id,
      input.capability,
    );
    const handle = Object.freeze({ available: true });
    uploadSources.set(handle, {
      company_id: actual.record.company_id,
      user_id: actual.actor.user_id,
      session_id: actual.actor.session_id,
      authority_epoch: actual.actor.authority_epoch,
      fingerprint: JSON.stringify(actual.record),
    });
    return handle;
  });
  const source = uploadSources.get(handle);
  if (!source) throw new Error("Return evidence is unavailable.");
  try {
    const saved = await storeUploadedFile(input.file, source.company_id, {
      purpose: "photo",
    });
    await query(input.capability, scope, (state, actor) => {
      const actual = canonicalReturn(
        state,
        actor,
        input.return_id,
        input.capability,
      );
      if (
        actual.actor.user_id !== source.user_id ||
        actual.actor.session_id !== source.session_id ||
        actual.actor.authority_epoch !== source.authority_epoch ||
        JSON.stringify(actual.record) !== source.fingerprint
      )
        throw new Error("Return evidence changed.");
    });
    const attachment = Object.freeze({
      name: saved.name,
    }) as ReturnPhotoAttachment;
    attachments.set(attachment, {
      ...source,
      return_id: input.return_id,
      capability: input.capability,
      reference: saved.reference,
    });
    return attachment;
  } finally {
    uploadSources.delete(handle);
  }
}
/** Fresh writes accept only an uploaded attachment bound to this source and real session. */
export function returnPhotoReference(
  state: DemoState,
  actor: AuthenticatedActor,
  returnId: string,
  capability: PhotoCapability,
  attachment: ReturnPhotoAttachment,
): string {
  const source = attachments.get(attachment);
  const actual = canonicalReturn(state, actor, returnId, capability);
  if (
    !source ||
    source.company_id !== actual.record.company_id ||
    source.return_id !== actual.record.id ||
    source.capability !== capability ||
    source.user_id !== actual.actor.user_id ||
    source.session_id !== actual.actor.session_id ||
    source.authority_epoch !== actual.actor.authority_epoch ||
    source.fingerprint !== JSON.stringify(actual.record)
  )
    throw new Error("Return evidence changed.");
  return source.reference;
}
/** Exact accepted retries resolve the genuine retained attachment, not a changed source fingerprint. */
export function acceptedPickupPhotoReference(
  state: DemoState,
  actor: AuthenticatedActor,
  returnId: string,
  eventId: string,
  attachment?: ReturnPhotoAttachment,
): string | undefined {
  const actual = canonicalReturn(
    state,
    actor,
    returnId,
    "returns.pickup_record",
  );
  const event = actual.record.evidence?.find(
    (item) => item.id === eventId && item.kind === "pickup",
  );
  if (!event) throw new Error("Return evidence changed.");
  if (!event.photo && !attachment) return undefined;
  const source = attachment && attachments.get(attachment);
  if (
    !source ||
    !event.photo ||
    source.reference !== event.photo ||
    source.company_id !== actual.record.company_id ||
    source.return_id !== actual.record.id ||
    source.capability !== "returns.pickup_record" ||
    source.user_id !== actual.actor.user_id ||
    source.session_id !== actual.actor.session_id ||
    source.authority_epoch !== actual.actor.authority_epoch
  )
    throw new Error("Return evidence changed.");
  return source.reference;
}
/** A photo is authorised by the real return evidence event, never an arbitrary file reference. */
export async function loadReturnPhoto(
  query: ProtectedReturnQuery,
  input: {
    company_id: string;
    return_id: string;
    event_id: string;
  },
) {
  const scope: ResourceScope = {
    company_id: input.company_id,
    kind: "company_shared",
    entity_id: input.return_id,
  };
  const resolve = (state: DemoState, actor: AuthenticatedActor) => {
    const actual = canonicalReturn(
      state,
      actor,
      input.return_id,
      "returns.read",
    );
    const event = actual.record.evidence?.find(
      (item) => item.id === input.event_id,
    );
    if (!event?.photo) throw new Error("Return evidence is unavailable.");
    return {
      reference: event.photo,
      company_id: actual.record.company_id,
      user_id: actual.actor.user_id,
      session_id: actual.actor.session_id,
      authority_epoch: actual.actor.authority_epoch,
      event_snapshot: JSON.stringify(event),
    };
  };
  const handle = await query("returns.read", scope, (state, actor) => {
    const handle = Object.freeze({ available: true });
    photoReads.set(handle, resolve(state, actor));
    return handle;
  });
  const source = photoReads.get(handle);
  if (!source) throw new Error("Return evidence is unavailable.");
  try {
    const stored = await readStoredFile(source.reference, source.company_id);
    await query("returns.read", scope, (state, actor) => {
      const current = resolve(state, actor);
      if (
        current.user_id !== source.user_id ||
        current.session_id !== source.session_id ||
        current.authority_epoch !== source.authority_epoch ||
        current.reference !== source.reference ||
        current.company_id !== source.company_id ||
        current.event_snapshot !== source.event_snapshot
      )
        throw new Error("Return evidence changed.");
    });
    return stored;
  } finally {
    photoReads.delete(handle);
  }
}
