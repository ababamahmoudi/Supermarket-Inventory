/* global structuredClone */
// @vitest-environment node
// Retained SDK assertion bodies; imports resolve the actual integrated source.
// Official fake-indexeddb is used only by the lifecycle repository cases.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createAuthenticationService } from "../authentication-service";
import { createPeopleService } from "../people";
import { credentialVerifier } from "../credentials";
import { snapshotOf } from "../authority-document";
import * as authority from "../authority";
import * as permissions from "../permissions";
const NOW = new Date("2026-10-12T16:00:00Z");
class MemoryRepository {
  constructor(document, state) {
    this.document = structuredClone(document);
    this.state = state;
    this.queue = Promise.resolve();
    this.events = [];
  }
  transaction(company, operation) {
    const task = this.queue.then(() => {
      assert.equal(company, this.document.company_id);
      const draft = structuredClone(this.document);
      const value = operation(draft, this.state);
      this.document = draft;
      return { value, snapshot: snapshotOf(draft) };
    });
    this.queue = task.catch(() => {});
    return task;
  }
  publishInvalidation(event) {
    this.events.push(event);
  }
  subscribeInvalidation() {
    return () => {};
  }
}
function fixture() {
  let now = NOW,
    counter = 0;
  const specs = [
    ["owner", "owner", [], []],
    ["manager", "manager", [], ["supervisor"]],
    ["rh-supervisor", "branch_supervisor", ["rh", "nm"], []],
    ["ny-floor", "floor_worker", ["ny"], ["floorworker"]],
    ["wh-floor", "floor_worker", ["wh"], []],
    ["cashier", "cashier", ["ny", "rh"], []],
  ];
  const people = specs.map(([username, role, locations, aliases]) => ({
    id: `demo-person-${username}`,
    company_id: "company-1",
    name_en: `Fictional ${username}`,
    username,
    aliases,
    email: `${username}@example.invalid`,
    role,
    location_scope:
      role === "owner" || role === "manager"
        ? { kind: "company" }
        : { kind: "assigned", location_ids: locations },
    status: "active",
    setup: {
      password_complete: true,
      second_step_complete: true,
      second_step_method: ["owner", "manager", "branch_supervisor"].includes(
        role,
      )
        ? "passkey"
        : undefined,
      simulated: true,
    },
    authority_epoch: 1,
    version: 1,
    created_at: NOW.toISOString(),
    created_by_user_id: "demo-person-owner",
    demo_fixture: true,
  }));
  const credentials = people.map((person) => ({
    company_id: person.company_id,
    user_id: person.id,
    password_verifier: credentialVerifier("demo1234", person.id),
    password_salt: person.id,
    failed_attempts: 0,
    version: 1,
  }));
  const state = {
    config: {
      company: { seed_key: "company-1" },
      branches: [
        { id: "ny", code: "NY", type: "store" },
        { id: "rh", code: "RH", type: "store" },
        { id: "nm", code: "NM", type: "store" },
        { id: "wh", code: "WH", type: "warehouse" },
      ],
      session: {
        password_min_length: 8,
        block_common_passwords: true,
        lockout_after_failed_attempts: 5,
        lockout_minutes: 15,
        reprompt_password_after_minutes: 15,
      },
    },
  };
  const document = {
    version: 1,
    company_id: "company-1",
    directory_version: 1,
    people,
    sessions: [],
    credentials,
    setup_challenges: [],
    devices: [
      {
        id: "demo-computer-ny",
        company_id: "company-1",
        name: "Fictional North York computer",
        location_id: "ny",
        active: true,
        version: 1,
        registered_at: NOW.toISOString(),
        registered_by_user_id: "demo-person-owner",
      },
    ],
    audit: [],
  };
  const repository = new MemoryRepository(document, state);
  const service = createAuthenticationService({
    repository,
    now: () => now,
    createId: (prefix) => `${prefix}-${++counter}`,
    currentDeviceId: () => "demo-computer-ny",
  });
  const peopleService = createPeopleService({
    repository,
    state: () => state,
    now: () => now,
    createId: (prefix) => `${prefix}-${++counter}`,
    prepareSetupCode: async () => ({
      code: "SINGLE-SETUP-CODE",
      salt: "setup-salt",
      verifier: credentialVerifier("SINGLE-SETUP-CODE", "setup-salt"),
    }),
  });
  const signIn = (username, password = "demo1234") =>
    service.signIn({
      company_id: "company-1",
      username,
      password_or_setup_code: password,
      device_id: "demo-computer-ny",
    });
  const actor = (identity) => {
    authority.bindAuthoritySnapshot(state, snapshotOf(repository.document));
    return authority.resolveActor(state, identity, now);
  };
  const request = (identity, input) => ({
    identity,
    input,
    request_id: `request-${++counter}`,
  });
  return {
    state,
    repository,
    service,
    peopleService,
    signIn,
    actor,
    request,
    setNow: (value) => (now = value),
  };
}

test("supervisor alias resolves durable Manager and requires simulated second-step challenge", async () => {
  const f = fixture();
  const result = await f.signIn("supervisor");
  assert.equal(result.person.id, "demo-person-manager");
  assert.equal(result.person.username, "manager");
  assert.equal(result.next, "second_step_challenge");
  assert.throws(() => f.actor(result.identity), { code: "setup" });
  const completed = await f.service.completeSecondStep(
    result.identity,
    "simulated-passkey",
  );
  assert.equal(completed.next, "complete");
  assert.equal(f.actor(completed.identity).role, "manager");
});
test("legacy floorworker alias preserves the same NY person and uses allowed registered default", async () => {
  const f = fixture();
  const result = await f.signIn("floorworker");
  assert.equal(result.person.id, "demo-person-ny-floor");
  assert.equal(result.next, "complete");
  assert.equal(f.actor(result.identity).branch, "ny");
});
test("BS on unassigned NY computer defaults to All my RH/NM, never first store or NY", async () => {
  const f = fixture();
  const initial = await f.signIn("rh-supervisor");
  const result = await f.service.completeSecondStep(
    initial.identity,
    "simulated-passkey",
  );
  const actor = f.actor(result.identity);
  assert.deepEqual(actor.selection, { kind: "all_my_locations" });
  assert.deepEqual(actor.allowed_branches, ["rh", "nm"]);
  assert.equal(actor.branch, "all");
  assert.throws(() => permissions.requireConcreteLocation(f.state, actor), {
    code: "location",
  });
});
test("Cashier cannot set Warehouse/all-company selection by calling auth API", async () => {
  const f = fixture();
  const result = await f.signIn("cashier");
  await assert.rejects(
    f.service.setLocation(result.identity, {
      kind: "location",
      location_id: "wh",
    }),
    { code: "location" },
  );
  await assert.rejects(
    f.service.setLocation(result.identity, { kind: "all_locations" }),
    { code: "location" },
  );
  assert.equal(f.actor(result.identity).branch, "ny");
});
test("invited one-time code consumes once, resumes setup, and cannot authorize early work", async () => {
  const f = fixture();
  const manager = await f.service.switchDemoUser("company-1", "manager");
  const added = await f.peopleService.addPerson(
    f.request(manager.identity, {
      name_en: "Fictional invited person",
      username: "invited",
      email: "invited@example.invalid",
      role: "floor_worker",
      location_scope: { kind: "assigned", location_ids: ["ny"] },
    }),
  );
  const setup = await f.signIn("invited", added.one_time_setup_code);
  assert.equal(setup.next, "password");
  assert.throws(() => f.actor(setup.identity), { code: "setup" });
  await assert.rejects(f.signIn("invited", added.one_time_setup_code), {
    code: "invalid",
  });
  const resumed = await f.service.resume(setup.identity);
  assert.equal(resumed.next, "password");
  const complete = await f.service.choosePassword(
    setup.identity,
    "Fictional-secret-2026",
  );
  assert.equal(complete.next, "complete");
  assert.equal(f.actor(complete.identity).role, "floor_worker");
  const stored = JSON.stringify(f.repository.document);
  assert.equal(stored.includes(added.one_time_setup_code), false);
  assert.equal(stored.includes("Fictional-secret-2026"), false);
});
test("privileged invited account cannot skip choosing second-step setup and challenge", async () => {
  const f = fixture();
  const manager = await f.service.switchDemoUser("company-1", "manager");
  const added = await f.peopleService.addPerson(
    f.request(manager.identity, {
      name_en: "Fictional supervisor",
      username: "invited-supervisor",
      phone: "555-0100",
      role: "branch_supervisor",
      location_scope: { kind: "assigned", location_ids: ["ny"] },
    }),
  );
  const setup = await f.signIn("invited-supervisor", added.one_time_setup_code);
  const password = await f.service.choosePassword(
    setup.identity,
    "New-secret-2026",
  );
  assert.equal(password.next, "second_step_setup");
  await assert.rejects(
    f.service.completeSecondStep(password.identity, "simulated-passkey"),
    { code: "second_step" },
  );
  assert.throws(() => f.actor(password.identity), { code: "setup" });
  const selected = await f.service.setupSecondStep(
    password.identity,
    "authenticator",
  );
  assert.equal(selected.next, "second_step_challenge");
  await assert.rejects(
    f.service.completeSecondStep(selected.identity, "000000"),
    { code: "second_step" },
  );
  const complete = await f.service.completeSecondStep(
    selected.identity,
    "123456",
  );
  assert.equal(complete.next, "complete");
  assert.equal(f.actor(complete.identity).role, "branch_supervisor");
});
test("demo shortcut resolves real session, cannot activate invited/custom or deactivated user", async () => {
  const f = fixture();
  const manager = await f.service.switchDemoUser("company-1", "supervisor");
  assert.equal(f.actor(manager.identity).role, "manager");
  f.repository.document.people.find((p) => p.username === "ny-floor").status =
    "deactivated";
  await assert.rejects(f.service.switchDemoUser("company-1", "ny-floor"), {
    code: "invalid",
  });
  f.repository.document.people.push({
    ...structuredClone(f.repository.document.people[0]),
    id: "custom-owner",
    username: "custom-owner",
    demo_fixture: false,
  });
  await assert.rejects(f.service.switchDemoUser("company-1", "custom-owner"), {
    code: "invalid",
  });
});
test("failed attempts persist through errors and lock for configured duration", async () => {
  const f = fixture();
  for (let i = 0; i < 4; i++)
    await assert.rejects(f.signIn("ny-floor", "wrong"), { code: "invalid" });
  await assert.rejects(f.signIn("ny-floor", "wrong"), { code: "locked" });
  await assert.rejects(f.signIn("ny-floor", "demo1234"), { code: "locked" });
  f.setNow(new Date(NOW.getTime() + 15 * 60_000 + 1));
  const result = await f.signIn("ny-floor");
  assert.equal(result.next, "complete");
  assert.equal(
    f.repository.document.credentials.find(
      (c) => c.user_id === "demo-person-ny-floor",
    ).failed_attempts,
    0,
  );
});
test("idle lock/signout invalidates actual session; password unlock restores same user safely", async () => {
  const f = fixture();
  const signin = await f.signIn("ny-floor");
  await f.service.lock(signin.identity);
  assert.throws(() => f.actor(signin.identity), { code: "authentication" });
  assert.equal((await f.service.resume(signin.identity)).next, "locked");
  await assert.rejects(f.service.unlock(signin.identity, "wrong"), {
    code: "invalid",
  });
  await f.service.unlock(signin.identity, "demo1234");
  assert.equal(f.actor(signin.identity).user_id, "demo-person-ny-floor");
  await f.service.signOut(signin.identity);
  assert.equal(await f.service.resume(signin.identity), null);
  assert.throws(() => f.actor(signin.identity), { code: "revoked" });
});
test("sensitive-page password reauthentication refreshes the same current session and cannot bypass setup/revocation", async () => {
  const f = fixture();
  const signed = await f.service.switchDemoUser("company-1", "manager");
  const original = f.repository.document.sessions.find(
    (session) => session.id === signed.identity.session_id,
  ).authenticated_at;
  f.setNow(new Date(NOW.getTime() + 16 * 60_000));
  assert.equal(
    permissions.can(
      f.state,
      f.actor(signed.identity),
      "people.manage",
      { company_id: "company-1", kind: "company_shared" },
      new Date(NOW.getTime() + 16 * 60_000),
    ).reason,
    "freshness",
  );
  await assert.rejects(f.service.reauthenticate(signed.identity, "wrong"), {
    code: "invalid",
  });
  assert.equal(
    f.repository.document.sessions.find(
      (session) => session.id === signed.identity.session_id,
    ).authenticated_at,
    original,
  );
  const refreshed = await f.service.reauthenticate(signed.identity, "demo1234");
  assert.equal(refreshed.identity.session_id, signed.identity.session_id);
  assert.equal(f.repository.document.sessions.length, 1);
  assert.equal(
    permissions.can(
      f.state,
      f.actor(refreshed.identity),
      "people.manage",
      { company_id: "company-1", kind: "company_shared" },
      new Date(NOW.getTime() + 16 * 60_000),
    ).allowed,
    true,
  );
  await f.service.signOut(signed.identity);
  await assert.rejects(f.service.reauthenticate(signed.identity, "demo1234"), {
    code: "invalid",
  });
});
test("password policy and same password are enforced during retained legacy first sign-in", async () => {
  const f = fixture();
  const worker = f.repository.document.people.find(
    (p) => p.username === "ny-floor",
  );
  worker.status = "invited";
  worker.setup.password_complete = false;
  const signin = await f.signIn("ny-floor");
  assert.equal(signin.next, "password");
  await assert.rejects(f.service.choosePassword(signin.identity, "short"), {
    code: "too_short",
  });
  await assert.rejects(
    f.service.choosePassword(signin.identity, "password123"),
    { code: "common" },
  );
  await f.service.choosePassword(signin.identity, "Retained-new-password-2026");
  await assert.rejects(f.signIn("ny-floor", "demo1234"), { code: "invalid" });
  assert.equal(
    (await f.signIn("ny-floor", "Retained-new-password-2026")).next,
    "complete",
  );
});
