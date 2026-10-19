/** Test-only repository fixtures. Never import this module from application code. */
import { IDBFactory } from "fake-indexeddb";
import { BrowserAuthorityRepository } from "./authority-repository";
import { authoritySnapshot, bindAuthoritySnapshot } from "./authority";
import type {
  SystemAttribution,
  SystemReconciliationSource,
} from "./authority-types";
import type { DemoState } from "./types";

/** Calls the real private-witness repository path with complete IDB transaction semantics. */
export async function reconcileFixture<T>(
  state: DemoState,
  source: SystemReconciliationSource,
  operation: (canonical: DemoState, attribution: SystemAttribution) => T,
  now = new Date(),
): Promise<T> {
  const repository = new BrowserAuthorityRepository(new IDBFactory());
  const snapshot = authoritySnapshot(state);
  await repository.initialize({
    ...structuredClone(snapshot),
    people: [...structuredClone(snapshot.people)],
    sessions: [...structuredClone(snapshot.sessions)],
    devices: [...structuredClone(snapshot.devices)],
    credentials: [],
    setup_challenges: [],
    audit: [],
  });
  await repository.initializeBusiness(state);
  const result = await repository.runSystemReconciliation<DemoState, T>(
    snapshot.company_id,
    source,
    operation,
    now,
  );
  Object.assign(state, result.business.state);
  bindAuthoritySnapshot(state, result.authority_snapshot);
  return result.value;
}
