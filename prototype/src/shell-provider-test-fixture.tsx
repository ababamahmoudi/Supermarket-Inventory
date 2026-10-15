/** Test-only storage seam. Actor, services, Provider and projections stay real. */
import { Blob as NodeBlob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { vi } from "vitest";
import { BrowserAuthorityRepository } from "./authority-repository";
import { createBrowserProviderOptions } from "./e1-application-options";
import { createAuthenticationService } from "./authentication-service";
import { initializeAuthority } from "./authority-initialization";
import { initialState } from "./store";
import type { DemoState } from "./types";
import type { ProviderOptions } from "./store";

export const legacySessionKey = "supermarket-prototype-session-v2";
export const legacyEmployee = JSON.stringify({
  version: 2,
  accounts: {
    newemployee: {
      password: "temp1234",
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: 0,
    },
  },
});
export function shellProviderFixture(state?: DemoState) {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Blob", NodeBlob);
  const production = createBrowserProviderOptions();
  const repository = new BrowserAuthorityRepository(indexedDB);
  const options: ProviderOptions = {
    ...production,
    repository,
    localStorage,
    sessionStorage,
    ...(state
      ? {
          companyId: state.config.company.seed_key,
          loadInitialBusiness: async () => structuredClone(state),
        }
      : {}),
  };
  return { options, repository, dispose: () => repository.dispose() };
}
export async function authenticationFixture(
  input: { state?: DemoState; legacy?: string; now?: () => Date } = {},
) {
  const state = input.state ?? initialState();
  const fixture = shellProviderFixture(state);
  const production = createBrowserProviderOptions();
  await initializeAuthority(fixture.repository, {
    state,
    demo_users: production.demoUsers,
    registered_computers: production.configuredComputers,
    legacy_auth_raw: input.legacy,
    now: input.now?.(),
  });
  await fixture.repository.initializeBusiness(state);
  const service = createAuthenticationService({
    repository: fixture.repository,
    now: input.now,
  });
  return {
    ...fixture,
    state,
    companyId: state.config.company.seed_key,
    service,
    readPrivate: () =>
      fixture.repository
        .transaction(state.config.company.seed_key, (document) =>
          structuredClone(document),
        )
        .then((result) => result.value),
  };
}

/** Reproduce a saved pre-E1 location-type change. The SID/person/credential rows
 * are actual SDK fixture records, not a forged session or a live permission bypass. */
export async function retainedCashierLocationFixture() {
  const { authenticatedProviderFixture } =
    await import("./authority-provider-test-fixture");
  const original = await authenticatedProviderFixture({
    state: initialState(),
    role: "cashier",
    actorOptions: { locations: ["Branch 1"] },
  });
  const retainedDocument = (
    await original.repository.transaction(
      original.actor.company_id,
      (document) => structuredClone(document),
    )
  ).value;
  const retainedBusiness = await original.readCanonical();
  retainedBusiness.config.branches[0].type = "warehouse";
  original.dispose();
  const factory = new IDBFactory();
  vi.stubGlobal("indexedDB", factory);
  const repository = new BrowserAuthorityRepository(factory);
  await repository.initialize(retainedDocument);
  await repository.initializeBusiness(retainedBusiness);
  return {
    options: { ...original.options, repository },
    repository,
    identity: original.identity,
    readCanonical: async () =>
      (await repository.loadBusiness<DemoState>(original.actor.company_id))
        .state,
    dispose: () => repository.dispose(),
  };
}
