import type { AuthenticatedActor } from "./authority-types";
import type { DemoState } from "./types";
import type { ProtectedReturnQuery } from "./return-file-access";
import { readStoredFile, storeUploadedFile } from "./file-database";
import {
  resolveReturnCreateSource,
  returnCreateScope,
  ReturnCreateError,
  type ReturnCreateSourceInput,
} from "./return-create-source";

declare const creationPhotoBrand: unique symbol;
export interface ReturnCreationPhoto {
  readonly name: string;
  readonly [creationPhotoBrand]: true;
}
interface PhotoWitness {
  company_id: string;
  user_id: string;
  session_id: string;
  authority_epoch: number;
  person_version: number;
  selection: string;
  request: ReturnCreateSourceInput;
  reference: string;
}
const attachments = new WeakMap<ReturnCreationPhoto, PhotoWitness>();
const preparations = new WeakMap<object, Omit<PhotoWitness, "reference">>();
function witness(
  state: DemoState,
  actor: AuthenticatedActor,
  input: ReturnCreateSourceInput,
): Omit<PhotoWitness, "reference"> {
  const actual = resolveReturnCreateSource(state, actor, input);
  return {
    company_id: actual.actor.company_id,
    user_id: actual.actor.user_id,
    session_id: actual.actor.session_id,
    authority_epoch: actual.actor.authority_epoch,
    person_version: actual.actor.person_version,
    selection: JSON.stringify(actual.actor.selection),
    request: {
      request_id: input.request_id,
      branch: input.branch,
      supplier_id: input.supplier_id,
      product_code: input.product_code,
      source_fingerprint: input.source_fingerprint,
    },
  };
}
export async function uploadReturnCreationPhoto(
  query: ProtectedReturnQuery,
  input: ReturnCreateSourceInput & { company_id: string; file: File },
): Promise<ReturnCreationPhoto> {
  const scope = returnCreateScope(input.company_id, input.branch);
  const preparation = await query("returns.create", scope, (state, actor) => {
    const handle = Object.freeze({ available: true });
    preparations.set(handle, witness(state, actor, input));
    return handle;
  });
  const before = preparations.get(preparation);
  if (!before) throw new ReturnCreateError("photos");
  try {
    const saved = await storeUploadedFile(input.file, before.company_id, {
      purpose: "photo",
    });
    await readStoredFile(saved.reference, before.company_id);
    await query("returns.create", scope, (state, actor) => {
      if (
        JSON.stringify(before) !== JSON.stringify(witness(state, actor, input))
      )
        throw new ReturnCreateError("changed");
    });
    const handle = Object.freeze({ name: saved.name }) as ReturnCreationPhoto;
    attachments.set(handle, { ...before, reference: saved.reference });
    return handle;
  } finally {
    preparations.delete(preparation);
  }
}
export function returnCreationPhotoReferences(
  state: DemoState,
  actor: AuthenticatedActor,
  input: ReturnCreateSourceInput,
  photos: readonly ReturnCreationPhoto[],
): string[] {
  const actual = witness(state, actor, input);
  return [
    ...new Set(
      photos.map((photo) => {
        const source = attachments.get(photo);
        if (!source) throw new ReturnCreateError("photos");
        const { reference, ...bound } = source;
        if (JSON.stringify(bound) !== JSON.stringify(actual))
          throw new ReturnCreateError("changed");
        return reference;
      }),
    ),
  ];
}
