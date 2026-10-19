/** Test-only real-IDB Provider harness. Production never imports this module. */
import { Blob as NodeBlob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import { vi } from "vitest";
import {
  authenticatedTestFixture,
  type AuthenticatedFixtureOptions,
} from "./authority-test-fixture";
import { authoritySnapshot, bindAuthoritySnapshot } from "./authority";
import { prepareAuthorityDocument } from "./authority-initialization";
import { snapshotOf } from "./authority-document";
import { BrowserAuthorityRepository } from "./authority-repository";
import { writeIdentity } from "./auth-preferences.e1";
import { createBrowserProviderOptions } from "./e1-application-options";
import { migrateInlineFiles } from "./file-database";
import type { DemoState } from "./types";
import type { RoleId } from "./authority-types";
import type { ProviderOptions } from "./store";

export async function authenticatedProviderFixture(input: {
  state: DemoState | (() => DemoState | Promise<DemoState>);
  role: RoleId;
  actorOptions?: AuthenticatedFixtureOptions;
  factory?: IDBFactory;
  /** Exercise the production legacy loader and quarantine startup instead of preloading business. */
  initializeBusiness?: boolean;
}) {
  const factory = input.factory ?? new IDBFactory();
  // These are genuine storage/crypto implementations; no actor, permission,
  // Context, command or projector is replaced.
  vi.stubGlobal("indexedDB", factory);
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Blob", NodeBlob);
  const prepared =
    typeof input.state === "function" ? await input.state() : input.state;
  const files = await migrateInlineFiles(
    prepared,
    prepared.config.company.seed_key,
  );
  const state = files.state,
    production = createBrowserProviderOptions();
  const { document } = prepareAuthorityDocument({
    state,
    demo_users: production.demoUsers,
    registered_computers: production.configuredComputers,
    now: input.actorOptions?.now,
  });
  // Keep any genuinely prepared domain-fixture sessions and author identities.
  // The six configured Demo people retain their official aliases/fixture flag;
  // Demo switches then go through the actual authentication service.
  try {
    const retained = authoritySnapshot(prepared);
    document.people = document.people.map(
      (person) => retained.people.find((row) => row.id === person.id) ?? person,
    );
    document.people.push(
      ...retained.people.filter(
        (person) => !document.people.some((row) => row.id === person.id),
      ),
    );
    document.sessions = [...retained.sessions];
    document.directory_version = retained.directory_version;
  } catch {
    // An unbound initial business fixture has no earlier authenticated identities.
  }
  bindAuthoritySnapshot(state, snapshotOf(document));
  const officialActor = production.demoUsers.find(
    (person) =>
      person.role === input.role &&
      (input.actorOptions?.user_id
        ? person.id === input.actorOptions.user_id
        : input.actorOptions?.locations?.includes("Warehouse") &&
            input.role === "floor_worker"
          ? person.id === "demo-person-wh-floor"
          : true),
  );
  const fixture = authenticatedTestFixture(state, input.role, {
    user_id: officialActor?.id,
    username: officialActor?.username,
    name_en: officialActor?.name_en,
    name_fa: officialActor?.name_fa,
    ...input.actorOptions,
  });
  const snapshot = structuredClone(authoritySnapshot(state));
  for (const person of snapshot.people) {
    const official = production.demoUsers.find((row) => row.id === person.id);
    if (official) {
      person.demo_fixture = official.demo_fixture;
      person.setup = {
        ...person.setup,
        second_step_method: official.setup.second_step_method,
      };
      person.aliases = [
        ...new Set([official.username, ...official.aliases]),
      ].filter((name) => name !== person.username);
    }
  }
  bindAuthoritySnapshot(state, snapshot);
  document.people = snapshot.people.map((person) => structuredClone(person));
  document.sessions = snapshot.sessions.map((session) =>
    structuredClone(session),
  );
  document.devices = snapshot.devices.map((device) => structuredClone(device));
  document.directory_version = snapshot.directory_version;
  const repository = new BrowserAuthorityRepository(factory);
  await repository.initialize(document);
  if (input.initializeBusiness !== false)
    await repository.initializeBusiness(state);
  writeIdentity(fixture.identity, sessionStorage);
  const options: ProviderOptions = {
    ...production,
    companyId: state.config.company.seed_key,
    repository,
    localStorage,
    sessionStorage,
    loadInitialBusiness:
      input.initializeBusiness === false
        ? production.loadInitialBusiness
        : async () => structuredClone(state),
    freshDemoBusiness: production.freshDemoBusiness,
  };
  return {
    options,
    repository,
    identity: fixture.identity,
    actor: fixture.actor,
    async readCanonical() {
      return (
        await repository.loadBusiness<DemoState>(state.config.company.seed_key)
      ).state;
    },
    async readSnapshot() {
      return repository.loadBusiness<DemoState>(state.config.company.seed_key);
    },
    dispose() {
      repository.dispose();
    },
  };
}
