/* global structuredClone */
// @vitest-environment node
// Retained SDK assertion bodies; imports resolve the actual integrated source.
// Official fake-indexeddb is used only by the lifecycle repository cases.
import { test } from "vitest";
import assert from "node:assert/strict";
import configuredSeed from "../../../seed/demo-data.json";
const seed = {
  demo_users: configuredSeed.demo_users,
  registered_computers: configuredSeed.registered_computers,
};
import { prepareAuthorityDocument } from "../authority-initialization";
import { credentialVerifier } from "../credentials";
import {
  assertDirectoryLocationSafety,
  reconcileSessionLocationSelections,
} from "../authority-location-invariants";
import * as authority from "../authority";
import * as permissions from "../permissions";
const NOW = new Date("2026-10-12T16:00:00Z");
const makeState = () => ({
  config: {
    company: { seed_key: "other-configured-company" },
    branches: [
      { id: "Branch 1", code: "NY", type: "store" },
      { id: "Branch 2", code: "RH", type: "store" },
      { id: "Branch 3", code: "NM", type: "store" },
      { id: "Warehouse", code: "WH", type: "warehouse" },
    ],
  },
});
const options = (extra = {}) => ({
  state: makeState(),
  ...seed,
  now: NOW,
  ...extra,
});
const account = (password, mustChangePassword = false) => ({
  password,
  mustChangePassword,
  failedAttempts: 2,
  lockedUntil: 0,
});
test("fresh/reset authority has exactly six explicit IDs in current configured company and fictional registered computer", () => {
  const { document } = prepareAuthorityDocument(options());
  assert.equal(document.people.length, 6);
  assert.equal(document.sessions.length, 0);
  assert.equal(
    document.people.every(
      (person) =>
        person.company_id === "other-configured-company" && person.demo_fixture,
    ),
    true,
  );
  assert.equal(document.devices[0].company_id, "other-configured-company");
  assert.equal(document.devices[0].location_id, "Branch 1");
  assert.equal(JSON.stringify(document).includes("demo1234"), false);
});
test("normal migration maps approved aliases onto stable people and preserves actual passwords and preference IDs", () => {
  const legacy = {
    version: 2,
    accounts: {
      supervisor: account("Saved-manager-password"),
      floorworker: account("Saved-worker-password"),
      cashier: account("Saved-cashier-password"),
    },
    preferences: {
      supervisor: { theme: "dark" },
      floorworker: { comfortableText: true },
    },
    recentUsers: ["floorworker", "supervisor", "unknown"],
    devicePreferences: { theme: "dark" },
  };
  const { document, preferences } = prepareAuthorityDocument(
    options({ legacy_auth_raw: JSON.stringify(legacy) }),
  );
  for (const [username, id] of [
    ["supervisor", "demo-person-manager"],
    ["floorworker", "demo-person-ny-floor"],
    ["cashier", "demo-person-cashier"],
  ]) {
    const row = document.credentials.find((record) => record.user_id === id);
    assert.equal(
      row.password_verifier,
      credentialVerifier(legacy.accounts[username].password, row.password_salt),
    );
    assert.equal(row.failed_attempts, 2);
  }
  assert.deepEqual(preferences.by_user_id["demo-person-manager"], {
    theme: "dark",
  });
  assert.deepEqual(preferences.recent_user_ids, [
    "demo-person-ny-floor",
    "demo-person-manager",
  ]);
  assert.equal(
    document.people.some((person) => person.username === "supervisor"),
    false,
  );
});
test("interrupted legacy newemployee setup remains forced while completed saved setup remains completed, neither becomes a demo shortcut", () => {
  for (const mustChangePassword of [true, false]) {
    const { document } = prepareAuthorityDocument(
      options({
        legacy_auth_raw: JSON.stringify({
          version: 2,
          accounts: {
            newemployee: account(
              "Retained-worker-password",
              mustChangePassword,
            ),
          },
        }),
      }),
    );
    const person = document.people.find(
      (person) => person.username === "newemployee",
    );
    assert.equal(person.id, "legacy-person-newemployee");
    assert.equal(person.setup.password_complete, !mustChangePassword);
    assert.equal(person.status, mustChangePassword ? "invited" : "active");
    assert.equal(person.demo_fixture, false);
    assert.equal(person.role, "floor_worker");
  }
});
test("unknown raw credential account cannot invent a privileged or active person", () => {
  const { document, mappedLegacyUsernames } = prepareAuthorityDocument(
    options({
      legacy_auth_raw: JSON.stringify({
        version: 2,
        accounts: {
          "made-up-owner": account("Raw-secret"),
          supervisor: account("Known-password"),
        },
      }),
    }),
  );
  assert.equal(document.people.length, 6);
  assert.equal(
    document.people.some((person) => person.username === "made-up-owner"),
    false,
  );
  assert.deepEqual(mappedLegacyUsernames, ["supervisor"]);
});
test("invalid legacy auth, overlapping metadata and invalid fixture list fail instead of silently resetting", () => {
  assert.throws(() =>
    prepareAuthorityDocument(options({ legacy_auth_raw: "{incomplete" })),
  );
  assert.throws(() =>
    prepareAuthorityDocument(options({ demo_users: seed.demo_users.slice(1) })),
  );
  const { document } = prepareAuthorityDocument(options());
  const custom = {
    ...document.people[0],
    id: "retained-custom",
    username: "custom",
    aliases: ["supervisor"],
  };
  delete custom.company_id;
  assert.throws(
    () => prepareAuthorityDocument(options({ legacy_people: [custom] })),
    /overlap/,
  );
});
test("latest config invariant rejects Cashier Warehouse conversion and deletion of retained assignments, allows soft deactivation", () => {
  const spec = options(),
    { document } = prepareAuthorityDocument(spec);
  spec.state.config.branches[0].type = "warehouse";
  assert.throws(() => assertDirectoryLocationSafety(spec.state, document), {
    code: "location",
  });
  spec.state.config.branches[0].type = "store";
  spec.state.config.branches[0].active = false;
  assert.doesNotThrow(() =>
    assertDirectoryLocationSafety(spec.state, document),
  );
  spec.state.config.branches.shift();
  assert.throws(() => assertDirectoryLocationSafety(spec.state, document), {
    code: "location",
  });
});
test("config changes repair selections with permitted defaults, never first store; empty active company remains administrable", () => {
  const spec = options(),
    { document } = prepareAuthorityDocument(spec);
  const session = (person) => ({
    id: `session-${person.id}`,
    company_id: document.company_id,
    user_id: person.id,
    authority_epoch: person.authority_epoch,
    state: "active",
    authenticated_at: NOW.toISOString(),
    second_step_verified_at: NOW.toISOString(),
    selected_location: {
      kind: "location",
      location_id:
        person.username === "rh-supervisor" ? "Branch 1" : "Branch 1",
    },
    device_id: "demo-computer-north-york",
  });
  document.sessions = document.people.map(session);
  reconcileSessionLocationSelections(spec.state, document);
  const rh = document.sessions.find(
    (session) => session.user_id === "demo-person-rh-supervisor",
  );
  assert.deepEqual(rh.selected_location, { kind: "all_my_locations" });
  spec.state.config.branches.forEach((location) => (location.active = false));
  reconcileSessionLocationSelections(spec.state, document);
  const owner = document.sessions.find(
    (session) => session.user_id === "demo-person-owner",
  );
  assert.deepEqual(owner.selected_location, { kind: "all_locations" });
  assert.equal(owner.state, "active");
  // An already active assigned aggregate remains a retained historical view.
  // It does not become an active picker choice or physical-write scope.
  assert.deepEqual(rh.selected_location, { kind: "all_my_locations" });
  assert.equal(rh.state, "active");
  authority.bindAuthoritySnapshot(spec.state, {
    version: 1,
    company_id: document.company_id,
    directory_version: 1,
    people: document.people,
    sessions: document.sessions,
    devices: document.devices,
  });
  const actor = authority.resolveActor(
    spec.state,
    { company_id: document.company_id, session_id: owner.id },
    NOW,
  );
  const retained = authority.resolveActor(
    spec.state,
    { company_id: document.company_id, session_id: rh.id },
    NOW,
  );
  assert.deepEqual(permissions.allowedLocationIds(spec.state, retained), []);
  assert.deepEqual(
    permissions.allowedLocationIds(spec.state, retained, {
      includeInactive: true,
    }),
    ["Branch 2", "Branch 3"],
  );
  assert.equal(
    permissions.can(spec.state, retained, "branch_requests.read", {
      company_id: document.company_id,
      kind: "request_endpoints",
      location_ids: ["Branch 2", "Branch 3"],
      location_policy: "retained_read",
    }).allowed,
    true,
  );
  for (const capability of ["branch_requests.send", "invoices.post"])
    assert.equal(
      permissions.can(spec.state, retained, capability, {
        company_id: document.company_id,
        kind: "location_record",
        location_ids: ["Branch 2"],
        mutation: true,
      }).allowed,
      false,
    );
  assert.throws(
    () => permissions.requireConcreteLocation(spec.state, retained, "Branch 2"),
    { code: "location" },
  );
  assert.throws(
    () =>
      permissions.resolveLocationSelection(spec.state, retained, {
        kind: "all_my_locations",
      }),
    { code: "location" },
  );
  assert.equal(
    permissions.can(
      spec.state,
      actor,
      "settings.manage",
      { company_id: document.company_id, kind: "company_shared" },
      NOW,
    ).allowed,
    true,
  );
  assert.throws(() => permissions.requireConcreteLocation(spec.state, actor), {
    code: "location",
  });
});

import { initializeAuthority } from "../authority-initialization";
import { snapshotOf } from "../authority-document";
import { AuthorityStorageError } from "../authority-repository";
class InitializationRepository {
  constructor(document = null) {
    this.document = document && structuredClone(document);
    this.backups = [];
    this.initializeCalls = 0;
    this.failBackup = false;
  }
  async initializeBusiness(state) {
    this.business ??= structuredClone(state);
    return {
      company_id: state.config.company.seed_key,
      revision: 1,
      state: this.business,
    };
  }
  async load() {
    if (!this.document) throw new AuthorityStorageError("missing");
    return snapshotOf(this.document);
  }
  async initialize(document) {
    this.initializeCalls++;
    this.document ??= structuredClone(document);
    return snapshotOf(this.document);
  }
  async archivePrivateBackup(backup, hash) {
    if (this.failBackup) throw new AuthorityStorageError("backup");
    assert.equal(hash(backup.raw), backup.sha256);
    this.backups.push(structuredClone(backup));
    assert.equal(hash(this.backups.at(-1).raw), backup.sha256);
  }
  async transaction(company, operation) {
    assert.equal(company, this.document.company_id);
    const draft = structuredClone(this.document);
    const value = operation(draft, this.business);
    this.document = draft;
    return { value, snapshot: snapshotOf(draft) };
  }
}
test("verified UI preference write failure retries from existing authority without replacing people, credentials or sessions", async () => {
  const raw = JSON.stringify({
    version: 2,
    accounts: { supervisor: account("Kept-password") },
    preferences: { supervisor: { theme: "dark", comfortableText: true } },
    recentUsers: ["supervisor"],
    devicePreferences: { theme: "dark", comfortableText: false },
  });
  const repository = new InitializationRepository();
  let first;
  await assert.rejects(async () => {
    first = await initializeAuthority(
      repository,
      options({ legacy_auth_raw: raw }),
    );
    throw new Error("verified UI storage write failed");
  }, /UI storage/);
  const before = JSON.stringify(repository.document);
  const retry = await initializeAuthority(
    repository,
    options({ legacy_auth_raw: raw, demo_users: [] }),
  );
  assert.equal(retry.migrated, false);
  assert.deepEqual(retry.preferences, first.preferences);
  assert.equal(retry.may_remove_legacy_credentials, true);
  assert.equal(JSON.stringify(repository.document), before);
  assert.equal(repository.initializeCalls, 1);
  assert.equal(repository.backups.length, 2);
  assert.equal(repository.backups[1].raw, raw);
});
test("retry maps only unique current same-company names and aliases, never seed IDs, ambiguous names or resurrected users", async () => {
  const document = prepareAuthorityDocument(options()).document;
  const manager = document.people.find((p) => p.id === "demo-person-manager");
  manager.username = "renamed-manager";
  manager.aliases = ["current-manager"];
  manager.role = "floor_worker";
  manager.location_scope = { kind: "assigned", location_ids: ["Branch 1"] };
  manager.authority_epoch = 7;
  manager.version = 8;
  const current = {
    ...structuredClone(manager),
    id: "current-custom",
    username: "supervisor",
    aliases: ["ambiguous"],
    status: "deactivated",
    demo_fixture: false,
  };
  document.people.push(current, {
    ...structuredClone(current),
    id: "ambiguous-second",
    username: "second",
    aliases: ["ambiguous"],
  });
  const raw = JSON.stringify({
    version: 2,
    accounts: { supervisor: account("Old-secret") },
    preferences: {
      supervisor: { theme: "dark" },
      "current-manager": { comfortableText: true },
      ambiguous: { theme: "dark" },
      unknown: { theme: "dark" },
    },
    recentUsers: ["supervisor", "current-manager", "ambiguous", "unknown"],
  });
  const repository = new InitializationRepository(document);
  const before = JSON.stringify(repository.document);
  const retry = await initializeAuthority(
    repository,
    options({ legacy_auth_raw: raw, demo_users: [] }),
  );
  assert.deepEqual(retry.preferences.by_user_id, {
    "current-custom": { theme: "dark" },
    "demo-person-manager": { comfortableText: true },
  });
  assert.deepEqual(retry.preferences.recent_user_ids, [
    "current-custom",
    "demo-person-manager",
  ]);
  assert.equal(retry.may_remove_legacy_credentials, false);
  assert.equal(repository.initializeCalls, 0);
  assert.equal(JSON.stringify(repository.document), before);
  assert.equal(
    repository.document.people.find((p) => p.id === "current-custom").status,
    "deactivated",
  );
});
test("failed private backup/readback blocks retry cleanup and leaves current authority unchanged", async () => {
  const document = prepareAuthorityDocument(options()).document,
    repository = new InitializationRepository(document);
  repository.failBackup = true;
  const before = JSON.stringify(repository.document);
  await assert.rejects(
    initializeAuthority(
      repository,
      options({
        legacy_auth_raw: JSON.stringify({
          version: 2,
          accounts: { supervisor: account("Old-secret") },
          preferences: { supervisor: { theme: "dark" } },
        }),
      }),
    ),
    { code: "backup" },
  );
  assert.equal(JSON.stringify(repository.document), before);
  assert.equal(repository.initializeCalls, 0);
});
test("concurrent initializer maps the winning real directory and cannot recreate a removed seed identity", async () => {
  const repository = new InitializationRepository();
  const winner = prepareAuthorityDocument(options()).document;
  winner.people = winner.people.filter((p) => p.id !== "demo-person-manager");
  winner.credentials = winner.credentials.filter(
    (p) => p.user_id !== "demo-person-manager",
  );
  repository.initialize = async () => {
    repository.initializeCalls++;
    repository.document = structuredClone(winner);
    return snapshotOf(winner);
  };
  const raw = JSON.stringify({
    version: 2,
    accounts: { supervisor: account("Old-secret") },
    preferences: { supervisor: { theme: "dark" } },
    recentUsers: ["supervisor"],
  });
  const result = await initializeAuthority(
    repository,
    options({ legacy_auth_raw: raw }),
  );
  assert.deepEqual(result.preferences.by_user_id, {});
  assert.deepEqual(result.preferences.recent_user_ids, []);
  assert.equal(
    result.snapshot.people.some((p) => p.id === "demo-person-manager"),
    false,
  );
  assert.deepEqual(repository.document, winner);
});
