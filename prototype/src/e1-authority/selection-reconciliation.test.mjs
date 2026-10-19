/* global structuredClone */
// @vitest-environment node
import { test } from "vitest";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { IDBFactory } from "fake-indexeddb";
import configuredSeed from "../../../seed/demo-data.json";
import { initialState } from "../notes-dates-fixture.e1";
import { BrowserAuthorityRepository } from "../authority-repository";
import { initializeAuthority } from "../authority-initialization";
import { createAuthenticationService } from "../authentication-service";
import { createPeopleService } from "../people";
import { actorAtLocation, freshActor } from "../authority";
import {
  allowedLocationIds,
  can,
  requireConcreteLocation,
} from "../permissions";
import {
  saveBranchRequestDraft,
  sendBranchRequest,
  markBranchRequestSent,
  markBranchRequestReceived,
  closeBranchRequest,
  listBranchRequests,
  branchRequestCount,
} from "../branch-requests";

async function fixture() {
  const state = initialState();
  state.branch_requests = [];
  state.request_transfer_events = [];
  const company = state.config.company.seed_key;
  const repository = new BrowserAuthorityRepository(new IDBFactory());
  await initializeAuthority(repository, {
    state,
    demo_users: configuredSeed.demo_users,
    registered_computers: configuredSeed.registered_computers,
  });
  const auth = createAuthenticationService({
    repository,
    currentDeviceId: () => "demo-computer-north-york",
  });
  const manager = (await auth.switchDemoUser(company, "manager")).identity;
  const query = (identity, project) =>
    repository.queryBusiness(identity, project);
  const settings = (operation) =>
    repository.runBusinessCommand(manager, operation, {
      capability: "settings.manage",
      resource: { company_id: company, kind: "company_shared", mutation: true },
    });
  return { company, repository, auth, manager, query, settings };
}
const choose = (auth, identity, location_id) =>
  auth.setLocation(identity, { kind: "location", location_id });
async function deactivate(f, ids) {
  return f.settings((draft) => {
    for (const location of draft.config.branches)
      if (ids.includes(location.id)) location.active = false;
  });
}
async function assign(f, username, locations) {
  const snapshot = await f.repository.load(f.company);
  const person = snapshot.people.find((item) => item.username === username);
  const service = createPeopleService({
    repository: f.repository,
    state: () => {
      throw new Error("Repository canonical state is required");
    },
    prepareSetupCode: async () => {
      throw new Error("No new person is created");
    },
    createId: (prefix) => `${prefix}-${randomUUID()}`,
  });
  return service.editPerson({
    identity: f.manager,
    request_id: randomUUID(),
    input: {
      ...person,
      person_id: person.id,
      expected_version: person.version,
      location_scope: { kind: "assigned", location_ids: locations },
      reason: "Actual assignment for retained-location regression",
    },
  });
}

test("ordinary cached actors follow genuine persisted selection changes without changing business", async () => {
  const f = await fixture();
  try {
    await choose(f.auth, f.manager, "Branch 1");
    let cached;
    const before = await f.query(f.manager, (state, actor) => {
      cached = actor;
      return JSON.stringify(state);
    });
    await choose(f.auth, f.manager, "Branch 2");
    const result = await f.query(f.manager, (state, actor) => {
      assert.equal(actor.branch, "Branch 2");
      assert.equal(cached.branch, "Branch 1");
      assert.equal(freshActor(state, cached).branch, "Branch 2");
      assert.equal(requireConcreteLocation(state, cached), "Branch 2");
      return JSON.stringify(state);
    });
    assert.equal(result.value, before.value);
    assert.equal(result.business_revision, before.business_revision);
  } finally {
    f.repository.dispose();
  }
});

test("only genuine actorAtLocation views retain an explicit runtime override across repeated refreshes", async () => {
  const f = await fixture();
  try {
    await choose(f.auth, f.manager, "Branch 1");
    let ordinary, scoped;
    const before = await f.query(f.manager, (state, actor) => {
      ordinary = actor;
      scoped = actorAtLocation(state, actor, "Branch 2");
      return JSON.stringify(state);
    });
    await choose(f.auth, f.manager, "Branch 3");
    const result = await f.query(f.manager, (state, actor) => {
      assert.equal(actor.branch, "Branch 3");
      assert.equal(freshActor(state, ordinary).branch, "Branch 3");
      assert.equal(freshActor(state, scoped).branch, "Branch 2");
      assert.equal(
        freshActor(state, freshActor(state, scoped)).branch,
        "Branch 2",
      );
      assert.equal(requireConcreteLocation(state, scoped), "Branch 2");
      for (const copied of [
        { ...scoped },
        structuredClone(scoped),
        { ...ordinary, selection: scoped.selection, branch: "Branch 2" },
      ])
        assert.throws(() => freshActor(state, copied), {
          code: "authentication",
        });
      assert.throws(() => actorAtLocation(state, actor, "unknown-store"), {
        code: "location",
      });
      return JSON.stringify(state);
    });
    assert.equal(result.value, before.value);
    assert.equal(result.business_revision, before.business_revision);
  } finally {
    f.repository.dispose();
  }
});

test("runtime views cannot bypass actual assignments, Cashier warehouse exclusion or session revocation", async () => {
  const f = await fixture();
  try {
    const worker = (await f.auth.switchDemoUser(f.company, "ny-floor"))
      .identity;
    let scoped;
    await f.query(worker, (state, actor) => {
      scoped = actorAtLocation(state, actor, "Branch 1");
      assert.throws(() => actorAtLocation(state, actor, "Branch 2"), {
        code: "location",
      });
    });
    const cashier = (await f.auth.switchDemoUser(f.company, "cashier"))
      .identity;
    await f.query(cashier, (state, actor) => {
      assert.throws(() => actorAtLocation(state, actor, "Warehouse"), {
        code: "location",
      });
    });
    await f.auth.signOut(worker);
    await f.query(f.manager, (state) => {
      assert.throws(() => freshActor(state, scoped), { code: "revoked" });
    });
  } finally {
    f.repository.dispose();
  }
});

test("actual IDB deactivation retains completed endpoint history but rejects physical writes and new picker choices", async () => {
  const f = await fixture();
  try {
    const source = (await f.auth.switchDemoUser(f.company, "ny-floor"))
      .identity;
    // The real seeded supervisor has two stores and initially selects an
    // aggregate. Assign this physical endpoint explicitly through People.
    await assign(f, "rh-supervisor", ["Branch 2"]);
    const target = (await f.auth.switchDemoUser(f.company, "rh-supervisor"))
      .identity;
    await choose(f.auth, target, "Branch 2");
    const draftInput = {
      from_branch: "Branch 1",
      to_branch: "Branch 2",
      items: [
        {
          kind: "free_text",
          free_text: "Real requested bags",
          quantity: "2",
          quantity_unit: "units",
        },
      ],
    };
    const completed = await f.repository.runBusinessCommand(
      source,
      (state, actor) => {
        const request = saveBranchRequestDraft(state, actor, draftInput);
        sendBranchRequest(state, actor, request.id, request.revision);
        return request;
      },
    );
    await f.repository.runBusinessCommand(target, (state, actor) => {
      const request = state.branch_requests.find(
        (item) => item.id === completed.value.id,
      );
      markBranchRequestSent(state, actor, request.id, request.revision, [
        { item_id: request.items[0].id, decision: "sent" },
      ]);
    });
    await f.repository.runBusinessCommand(source, (state, actor) => {
      const request = state.branch_requests.find(
        (item) => item.id === completed.value.id,
      );
      markBranchRequestReceived(state, actor, request.id, request.revision, [
        { item_id: request.items[0].id, decision: "received" },
      ]);
      closeBranchRequest(state, actor, request.id, request.revision);
    });
    const waiting = await f.repository.runBusinessCommand(
      source,
      (state, actor) => {
        const request = saveBranchRequestDraft(state, actor, draftInput);
        sendBranchRequest(state, actor, request.id, request.revision);
        return request;
      },
    );
    await deactivate(f, ["Branch 1", "Branch 2"]);
    const directory = await f.repository.load(f.company);
    for (const [identity, location] of [
      [source, "Branch 1"],
      [target, "Branch 2"],
    ]) {
      const session = directory.sessions.find(
        (item) => item.id === identity.session_id,
      );
      assert.equal(session.state, "active");
      assert.deepEqual(session.selected_location, {
        kind: "location",
        location_id: location,
      });
      const read = await f.query(identity, (state, actor) => {
        assert.equal(actor.branch, location);
        assert.deepEqual(allowedLocationIds(state, actor), []);
        assert.deepEqual(
          allowedLocationIds(state, actor, { includeInactive: true }),
          [location],
        );
        assert.equal(
          listBranchRequests(state, actor).some(
            (item) =>
              item.id === completed.value.id && item.status === "closed",
          ),
          true,
        );
        assert.equal(branchRequestCount(state, actor), 0);
        assert.throws(() => requireConcreteLocation(state, actor, location), {
          code: "location",
        });
        return JSON.stringify(state);
      });
      await assert.rejects(choose(f.auth, identity, location), {
        code: "location",
      });
      await assert.rejects(choose(f.auth, identity, "Branch 3"), {
        code: "location",
      });
      assert.equal(
        (await f.query(identity, (state) => JSON.stringify(state))).value,
        read.value,
      );
    }
    const before = await f.repository.loadBusiness(f.company);
    await assert.rejects(
      f.repository.runBusinessCommand(target, (state, actor) => {
        markBranchRequestSent(
          state,
          actor,
          waiting.value.id,
          waiting.value.revision,
          [{ item_id: waiting.value.items[0].id, decision: "sent" }],
        );
      }),
      { code: "location" },
    );
    let posted = false;
    await assert.rejects(
      f.repository.runBusinessCommand(
        target,
        () => {
          posted = true;
        },
        {
          capability: "invoices.post",
          resource: {
            company_id: f.company,
            kind: "location_record",
            location_ids: ["Branch 2"],
            mutation: true,
          },
        },
      ),
      { code: "inactive_location" },
    );
    assert.equal(posted, false);
    assert.deepEqual(await f.repository.loadBusiness(f.company), before);
  } finally {
    f.repository.dispose();
  }
});

test("an existing assigned aggregate remains retained-only when all its real locations deactivate", async () => {
  const f = await fixture();
  try {
    await assign(f, "ny-floor", ["Branch 1", "Branch 2"]);
    const worker = (await f.auth.switchDemoUser(f.company, "ny-floor"))
      .identity;
    await f.auth.setLocation(worker, { kind: "all_my_locations" });
    await deactivate(f, ["Branch 1", "Branch 2"]);
    const session = (await f.repository.load(f.company)).sessions.find(
      (item) => item.id === worker.session_id,
    );
    assert.equal(session.state, "active");
    assert.deepEqual(session.selected_location, { kind: "all_my_locations" });
    await f.query(worker, (state, actor) => {
      assert.equal(actor.branch, "all");
      assert.deepEqual(
        allowedLocationIds(state, actor, { includeInactive: true }),
        ["Branch 1", "Branch 2"],
      );
      assert.deepEqual(allowedLocationIds(state, actor), []);
      assert.equal(
        can(state, actor, "branch_requests.read", {
          company_id: f.company,
          kind: "request_endpoints",
          location_ids: ["Branch 1", "Branch 2"],
          location_policy: "retained_read",
        }).allowed,
        true,
      );
      for (const id of ["Branch 1", "Branch 2", "Branch 3"])
        assert.throws(() => requireConcreteLocation(state, actor, id), {
          code: "location",
        });
    });
    await assert.rejects(
      f.auth.setLocation(worker, { kind: "all_my_locations" }),
      { code: "location" },
    );
  } finally {
    f.repository.dispose();
  }
});

test("deactivation keeps existing active reassignment behavior and never picks an inactive first location", async () => {
  const f = await fixture();
  try {
    await assign(f, "ny-floor", ["Branch 1", "Branch 2"]);
    const worker = (await f.auth.switchDemoUser(f.company, "ny-floor"))
      .identity;
    await choose(f.auth, worker, "Branch 1");
    await deactivate(f, ["Branch 1"]);
    await f.query(worker, (state, actor) => {
      assert.equal(actor.branch, "Branch 2");
      assert.deepEqual(allowedLocationIds(state, actor), ["Branch 2"]);
      assert.equal(
        can(state, actor, "branch_requests.send", {
          company_id: f.company,
          kind: "location_record",
          location_ids: ["Branch 2"],
          mutation: true,
        }).allowed,
        true,
      );
    });
  } finally {
    f.repository.dispose();
  }
});

for (const state of [
  "setup",
  "second_step_challenge",
  "revoked",
  "location_required",
])
  test(`repository reconciliation cannot revive a ${state} session when assigned locations deactivate`, async () => {
    const f = await fixture();
    try {
      const worker = (await f.auth.switchDemoUser(f.company, "ny-floor"))
        .identity;
      // Corrupt/blocked persisted-state negative fixture; no actor is minted here.
      await f.repository.transaction(f.company, (document) => {
        const session = document.sessions.find(
          (item) => item.id === worker.session_id,
        );
        session.state = state;
        if (state === "location_required") session.selected_location = null;
      });
      await deactivate(f, ["Branch 1"]);
      const session = (await f.repository.load(f.company)).sessions.find(
        (item) => item.id === worker.session_id,
      );
      assert.equal(session.state, state);
      if (state === "location_required")
        assert.equal(session.selected_location, null);
      await assert.rejects(f.query(worker, () => true));
    } finally {
      f.repository.dispose();
    }
  });

test("unknown or removed assignment scopes cannot be resurrected as retained locations", async () => {
  const f = await fixture();
  try {
    const worker = (await f.auth.switchDemoUser(f.company, "ny-floor"))
      .identity;
    await f.repository.transaction(f.company, (document) => {
      document.sessions.find(
        (item) => item.id === worker.session_id,
      ).selected_location = { kind: "location", location_id: "unknown-store" };
    });
    await deactivate(f, ["Branch 1"]);
    const session = (await f.repository.load(f.company)).sessions.find(
      (item) => item.id === worker.session_id,
    );
    assert.equal(session.state, "location_required");
    assert.equal(session.selected_location, null);
    await assert.rejects(f.query(worker, () => true));
    await assert.rejects(
      f.settings((draft) => {
        draft.config.branches = draft.config.branches.filter(
          (item) => item.id !== "Branch 1",
        );
      }),
      { code: "location" },
    );
  } finally {
    f.repository.dispose();
  }
});
