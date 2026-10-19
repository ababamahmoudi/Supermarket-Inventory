/* global structuredClone */
// @vitest-environment node
// Retained SDK assertion bodies; imports resolve the actual integrated source.
// Official fake-indexeddb is used only by the lifecycle repository cases.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createPeopleService } from "../people";
import { snapshotOf } from "../authority-document";
import * as authority from "../authority";
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
      assert.equal(
        Boolean(value && typeof value === "object" && "then" in value),
        false,
      );
      this.document = draft;
      return { value, snapshot: snapshotOf(draft) };
    });
    this.queue = task.catch(() => {});
    return task;
  }
  load() {
    return Promise.resolve(snapshotOf(this.document));
  }
  publishInvalidation(event) {
    this.events.push(structuredClone(event));
  }
  subscribeInvalidation() {
    return () => {};
  }
}
function fixture() {
  const person = (id, role) => ({
    id,
    company_id: "company-1",
    name_en: id,
    username: id,
    aliases: [],
    email: `${id}@example.invalid`,
    role,
    location_scope: { kind: "company" },
    status: "active",
    setup: {
      password_complete: true,
      second_step_complete: true,
      simulated: true,
    },
    authority_epoch: 1,
    version: 1,
    created_at: NOW.toISOString(),
    created_by_user_id: "owner-1",
  });
  const people = [person("owner-1", "owner"), person("manager-1", "manager")];
  const sessions = people.map((p) => ({
    id: `session-${p.id}`,
    company_id: p.company_id,
    user_id: p.id,
    authority_epoch: 1,
    state: "active",
    authenticated_at: NOW.toISOString(),
    second_step_verified_at: NOW.toISOString(),
    selected_location: { kind: "location", location_id: "ny" },
  }));
  const state = {
    config: {
      company: { seed_key: "company-1" },
      branches: [
        { id: "ny", code: "NY", type: "store" },
        { id: "rh", code: "RH", type: "store" },
        { id: "wh", code: "WH", type: "warehouse" },
      ],
      session: { reprompt_password_after_minutes: 15 },
    },
  };
  const document = {
    version: 1,
    company_id: "company-1",
    directory_version: 1,
    people,
    sessions,
    credentials: [],
    setup_challenges: [],
    devices: [],
    audit: [],
  };
  const repository = new MemoryRepository(document, state);
  let counter = 0;
  const service = createPeopleService({
    repository,
    state: () => state,
    prepareSetupCode: async () => ({
      code: "ONE-TIME-SECRET",
      verifier: "verifier-only",
      salt: "random-salt",
    }),
    createId: (prefix) => `${prefix}-${++counter}`,
    now: () => NOW,
  });
  const request = (input, user = "manager-1") => ({
    identity: { company_id: "company-1", session_id: `session-${user}` },
    request_id: `request-${++counter}`,
    input,
  });
  return { state, repository, service, request };
}
const input = (extra = {}) => ({
  name_en: "Fictional employee",
  username: "new-user",
  email: "employee@example.invalid",
  role: "floor_worker",
  location_scope: { kind: "assigned", location_ids: ["ny"] },
  ...extra,
});

test("People add returns setup code once and stores only verifier, never audit secrets", async () => {
  const f = fixture();
  const result = await f.service.addPerson(f.request(input()));
  assert.equal(result.one_time_setup_code, "ONE-TIME-SECRET");
  assert.equal(result.person.status, "invited");
  assert.equal(result.person.setup.password_complete, false);
  assert.equal(
    JSON.stringify(f.repository.document).includes("ONE-TIME-SECRET"),
    false,
  );
  assert.equal(
    f.repository.document.setup_challenges[0].code_verifier,
    "verifier-only",
  );
  assert.equal(f.repository.document.audit[0].actor_user_id, "manager-1");
});
test("People input requires name, username, phone-or-email, valid role and assignment", async () => {
  for (const [patch, code] of [
    [{ name_en: "" }, "name"],
    [{ username: "" }, "username"],
    [{ phone: undefined, email: undefined }, "contact"],
    [{ role: "supervisor" }, "role"],
    [{ location_scope: { kind: "assigned", location_ids: [] } }, "locations"],
    [
      {
        role: "cashier",
        location_scope: { kind: "assigned", location_ids: ["wh"] },
      },
      "cashier_warehouse",
    ],
  ]) {
    const f = fixture();
    await assert.rejects(f.service.addPerson(f.request(input(patch))), {
      code,
    });
    assert.equal(f.repository.document.people.length, 2);
    assert.equal(f.repository.document.audit.length, 0);
  }
});
test("canonical username and aliases are unique even for inactive people", async () => {
  const f = fixture();
  f.repository.document.people[0].aliases = ["supervisor"];
  await assert.rejects(
    f.service.addPerson(f.request(input({ username: " Supervisor " }))),
    { code: "duplicate_username" },
  );
});
test("unrequested input authority/session fields cannot be persisted", async () => {
  const f = fixture();
  const result = await f.service.addPerson(
    f.request(
      input({
        id: "forged",
        authority_epoch: 99,
        session_id: "forged-session",
        setup: { password_complete: true },
      }),
    ),
  );
  assert.notEqual(result.person.id, "forged");
  assert.equal(result.person.authority_epoch, 1);
  assert.equal(result.person.setup.password_complete, false);
  assert.equal(Object.hasOwn(result.person, "session_id"), false);
});
test("nobody may change their own role or deactivate themselves", async () => {
  const f = fixture(),
    manager = f.repository.document.people[1];
  await assert.rejects(
    f.service.editPerson(
      f.request({
        ...manager,
        role: "owner",
        person_id: manager.id,
        expected_version: 1,
        reason: "Promotion",
      }),
    ),
    { code: "self_role" },
  );
  await assert.rejects(
    f.service.deactivatePerson(
      f.request({
        person_id: manager.id,
        expected_version: 1,
        reason: "Off shift",
      }),
    ),
    { code: "self_deactivate" },
  );
});
test("Manager cannot deactivate or demote the last active Owner", async () => {
  const f = fixture(),
    owner = f.repository.document.people[0];
  await assert.rejects(
    f.service.deactivatePerson(
      f.request({
        person_id: owner.id,
        expected_version: 1,
        reason: "Leaving",
      }),
    ),
    { code: "last_owner" },
  );
  await assert.rejects(
    f.service.editPerson(
      f.request({
        ...owner,
        role: "manager",
        person_id: owner.id,
        expected_version: 1,
        reason: "New responsibilities",
      }),
    ),
    { code: "last_owner" },
  );
  assert.equal(f.repository.document.people[0].role, "owner");
});
test("invited or deactivated Owners do not satisfy last-active-Owner safety", async () => {
  for (const status of ["invited", "deactivated"]) {
    const f = fixture();
    f.repository.document.people.push({
      ...structuredClone(f.repository.document.people[0]),
      id: "owner-2",
      username: "owner-2",
      status,
    });
    await assert.rejects(
      f.service.deactivatePerson(
        f.request({
          person_id: "owner-1",
          expected_version: 1,
          reason: "Leaving",
        }),
      ),
      { code: "last_owner" },
    );
  }
});
test("setup-incomplete active Owner is not a usable replacement for the last Owner", async () => {
  const f = fixture();
  f.repository.document.people.push({
    ...structuredClone(f.repository.document.people[0]),
    id: "owner-2",
    username: "owner-2",
    setup: {
      password_complete: true,
      second_step_complete: false,
      simulated: true,
    },
  });
  await assert.rejects(
    f.service.deactivatePerson(
      f.request({
        person_id: "owner-1",
        expected_version: 1,
        reason: "Leaving",
      }),
    ),
    { code: "last_owner" },
  );
});
test("FW promotion to Owner waits for mandatory setup before last-Owner removal", async () => {
  const f = fixture();
  const added = await f.service.addPerson(f.request(input()));
  const worker = f.repository.document.people.find(
    (p) => p.id === added.person.id,
  );
  worker.status = "active";
  worker.setup.password_complete = true;
  const promoted = await f.service.editPerson(
    f.request({
      ...worker,
      role: "owner",
      location_scope: { kind: "company" },
      person_id: worker.id,
      expected_version: 1,
      reason: "Will be company owner",
    }),
  );
  assert.equal(promoted.status, "invited");
  assert.equal(promoted.setup.second_step_complete, false);
  await assert.rejects(
    f.service.deactivatePerson(
      f.request({
        person_id: "owner-1",
        expected_version: 1,
        reason: "Hand over ownership",
      }),
    ),
    { code: "last_owner" },
  );
});
test("concurrent demotions serialize and preserve one active Owner", async () => {
  const f = fixture();
  f.repository.document.people.push({
    ...structuredClone(f.repository.document.people[0]),
    id: "owner-2",
    username: "owner-2",
  });
  const outcomes = await Promise.allSettled(
    ["owner-1", "owner-2"].map((id) =>
      f.service.deactivatePerson(
        f.request({ person_id: id, expected_version: 1, reason: "Leaving" }),
      ),
    ),
  );
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  assert.equal(
    outcomes.filter(
      (o) => o.status === "rejected" && o.reason.code === "last_owner",
    ).length,
    1,
  );
  assert.equal(
    f.repository.document.people.filter(
      (p) => p.role === "owner" && p.status === "active",
    ).length,
    1,
  );
});
test("role/location edits require reason and target version and retain real before→after", async () => {
  const f = fixture();
  const added = await f.service.addPerson(f.request(input()));
  await assert.rejects(
    f.service.editPerson(
      f.request({
        ...added.person,
        person_id: added.person.id,
        expected_version: 1,
        reason: "",
        location_scope: { kind: "assigned", location_ids: ["rh"] },
      }),
    ),
    { code: "reason" },
  );
  await assert.rejects(
    f.service.editPerson(
      f.request({
        ...added.person,
        person_id: added.person.id,
        expected_version: 0,
        reason: "Move",
      }),
    ),
    { code: "conflict" },
  );
  const result = await f.service.editPerson(
    f.request({
      ...added.person,
      person_id: added.person.id,
      expected_version: 1,
      reason: "Move to Richmond Hill",
      location_scope: { kind: "assigned", location_ids: ["rh"] },
    }),
  );
  assert.equal(result.authority_epoch, 2);
  const audit = f.repository.document.audit.at(-1);
  assert.deepEqual(audit.before.location_scope.location_ids, ["ny"]);
  assert.deepEqual(audit.after.location_scope.location_ids, ["rh"]);
});
test("deactivation revokes every session; reactivation does not revive old sessions", async () => {
  const f = fixture();
  const added = await f.service.addPerson(f.request(input()));
  const person = f.repository.document.people.find(
    (p) => p.id === added.person.id,
  );
  person.status = "active";
  person.setup.password_complete = true;
  f.repository.document.sessions.push(
    ...["first", "second"].map((id) => ({
      id,
      company_id: "company-1",
      user_id: person.id,
      authority_epoch: 1,
      state: "active",
      authenticated_at: NOW.toISOString(),
      selected_location: { kind: "location", location_id: "ny" },
    })),
  );
  const deactivated = await f.service.deactivatePerson(
    f.request({
      person_id: person.id,
      expected_version: 1,
      reason: "No longer works here",
    }),
  );
  assert.equal(
    f.repository.document.sessions
      .filter((s) => s.user_id === person.id)
      .every((s) => s.state === "revoked"),
    true,
  );
  assert.equal(f.repository.events.at(-1).reason, "deactivated");
  await f.service.reactivatePerson(
    f.request({
      person_id: person.id,
      expected_version: deactivated.version,
      reason: "Returned to work",
    }),
  );
  authority.bindAuthoritySnapshot(f.state, snapshotOf(f.repository.document));
  assert.throws(
    () =>
      authority.resolveActor(f.state, {
        company_id: "company-1",
        session_id: "first",
      }),
    { code: "revoked" },
  );
});
test("a stale or revoked editing session cannot perform a later People command", async () => {
  const f = fixture();
  f.repository.document.sessions.find((s) => s.user_id === "manager-1").state =
    "revoked";
  await assert.rejects(f.service.addPerson(f.request(input())), {
    code: "revoked",
  });
  assert.equal(f.repository.document.people.length, 2);
});
test("FW or BS cannot promote anyone by calling People API directly", async () => {
  for (const role of ["floor_worker", "branch_supervisor"]) {
    const f = fixture();
    const manager = f.repository.document.people[1];
    manager.role = role;
    manager.location_scope = { kind: "assigned", location_ids: ["ny"] };
    await assert.rejects(
      f.service.addPerson(
        f.request(
          input({ role: "owner", location_scope: { kind: "company" } }),
        ),
      ),
      { code: "capability" },
    );
  }
});
