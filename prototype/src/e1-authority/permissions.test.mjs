/* global structuredClone */
// @vitest-environment node
// Retained SDK assertion bodies; imports resolve the actual integrated source.
// Official fake-indexeddb is used only by the lifecycle repository cases.
import { test } from "vitest";
import assert from "node:assert/strict";
import * as authority from "../authority";
import * as permissions from "../permissions";
import { ALL_CAPABILITIES } from "../capability-names";

const NOW = new Date("2026-10-12T16:00:00Z");
function fixture(role = "owner", ids = ["ny"]) {
  const company = role === "owner" || role === "manager";
  const person = {
    id: "person-1",
    company_id: "company-1",
    name_en: "Fictional person",
    username: "test-person",
    aliases: [],
    role,
    location_scope: company
      ? { kind: "company" }
      : { kind: "assigned", location_ids: ids },
    status: "active",
    setup: {
      password_complete: true,
      second_step_complete: true,
      simulated: true,
    },
    authority_epoch: 1,
    version: 1,
    created_at: NOW.toISOString(),
    created_by_user_id: "person-1",
  };
  const session = {
    id: "session-1",
    company_id: "company-1",
    user_id: person.id,
    authority_epoch: 1,
    state: "active",
    authenticated_at: NOW.toISOString(),
    second_step_verified_at: NOW.toISOString(),
    selected_location: { kind: "location", location_id: ids[0] },
  };
  const state = {
    config: {
      company: { seed_key: "company-1" },
      branches: [
        { id: "ny", code: "NY", type: "store" },
        { id: "rh", code: "RH", type: "store" },
        { id: "nm", code: "NM", type: "store" },
        { id: "wh", code: "WH", type: "warehouse" },
      ],
      orders: { allow_floor_worker: false },
      price_updates: { allow_floor_worker_complete: false },
      session: { reprompt_password_after_minutes: 15 },
    },
  };
  const snapshot = {
    version: 1,
    company_id: "company-1",
    directory_version: 1,
    people: [person],
    sessions: [session],
    devices: [],
  };
  authority.bindAuthoritySnapshot(state, snapshot);
  const actor = authority.resolveActor(
    state,
    { company_id: "company-1", session_id: session.id },
    NOW,
  );
  return { state, snapshot, person, session, actor };
}
const scope = (ids = ["ny"], extra = {}) => ({
  company_id: "company-1",
  kind: "location_record",
  location_ids: ids,
  ...extra,
});
const allowed = (f, cap, target = scope()) =>
  permissions.can(f.state, f.actor, cap, target, NOW).allowed;

test("Owner and Manager have exactly equal grants for every defined capability", () => {
  const owner = fixture("owner"),
    manager = fixture("manager");
  for (const cap of ALL_CAPABILITIES) {
    assert.equal(allowed(owner, cap), cap !== "demo.reset", cap);
    assert.equal(allowed(manager, cap), allowed(owner, cap), cap);
  }
});
test("Branch Supervisor has independent allowed operational and purchase-cost grants", () => {
  const f = fixture("branch_supervisor", ["ny", "rh"]);
  for (const cap of [
    "invoices.enter_manual",
    "invoices.post",
    "invoices.cost_read",
    "supplier_items.cost_read",
    "orders.cost_read",
    "returns.pickup_record",
    "labels.templates_create",
    "labels.calibrate",
    "dates.add",
    "sales.delivery_hold",
    "approvals.read",
    "pricing.propose_manual",
  ]) {
    assert.equal(allowed(f, cap), true, cap);
    assert.equal(allowed(f, cap, scope(["nm"])), false, cap);
  }
});
test("Branch Supervisor does not inherit money, replacement, sale, catalogue or Settings authority", () => {
  const f = fixture("branch_supervisor");
  for (const cap of [
    "catalog.cost_read",
    "pricing.margin_read",
    "catalog.edit",
    "catalog.tracking_preference_edit",
    "supplier_balances.read",
    "payables.read",
    "approvals.decide",
    "pricing.regular_manage",
    "sales.manage",
    "sales.cost_alert_decide",
    "returns.pickup_correct",
    "returns.credit_post",
    "returns.operational_resolve",
    "offers.multibuy_manage",
    "settings.manage",
    "people.manage",
  ]) {
    assert.equal(allowed(f, cap), false, cap);
  }
});
test("Floor Worker retained template/calibration/ordinary offers/replacement remain independent", () => {
  const f = fixture("floor_worker");
  for (const cap of [
    "labels.templates_create",
    "labels.templates_edit",
    "labels.templates_archive",
    "labels.calibrate",
    "offers.multibuy_manage",
    "returns.operational_resolve",
    "sales.request",
  ])
    assert.equal(allowed(f, cap), true, cap);
  for (const cap of [
    "invoices.enter_manual",
    "catalog.tracking_preference_edit",
    "supplier_items.cost_read",
    "pricing.propose_manual",
    "pricing.margin_read",
    "people.manage",
    "payables.read",
  ])
    assert.equal(allowed(f, cap), false, cap);
});
test("Floor Worker Orders opt-in does not grant Supplier Items cost or catalog cost", () => {
  const f = fixture("floor_worker");
  assert.equal(allowed(f, "orders.cost_read"), false);
  f.state.config.orders.allow_floor_worker = true;
  assert.equal(allowed(f, "orders.cost_read"), true);
  assert.equal(allowed(f, "supplier_items.cost_read"), false);
  assert.equal(allowed(f, "catalog.cost_read"), false);
});
test("Floor Worker E2 completion opt-in never grants cash-register confirmation", () => {
  const f = fixture("floor_worker");
  assert.equal(allowed(f, "price_updates.complete"), false);
  f.state.config.price_updates.allow_floor_worker_complete = true;
  assert.equal(allowed(f, "price_updates.complete"), true);
  assert.equal(allowed(f, "price_updates.register_confirm"), false);
});
test("Cashier reads and creates returns at assigned stores without receiving, money or settlement grants", () => {
  const f = fixture("cashier", ["ny", "rh"]);
  assert.equal(allowed(f, "lookup.read", scope(["rh"])), true);
  assert.equal(allowed(f, "lookup.read", scope(["nm"])), false);
  assert.equal(allowed(f, "lookup.read", scope(["wh"])), false);
  for (const cap of ["returns.read", "returns.create"]) {
    assert.equal(allowed(f, cap, scope(["ny"])), true, cap);
    assert.equal(allowed(f, cap, scope(["nm"])), false, cap);
    assert.equal(allowed(f, cap, scope(["wh"])), false, cap);
  }
  for (const cap of [
    "returns.pickup_record",
    "returns.pickup_correct",
    "returns.operational_resolve",
    "returns.credit_post",
    "returns.amount_read",
    "suppliers.read",
    "supplier_items.cost_read",
  ])
    assert.equal(allowed(f, cap), false, cap);
  for (const cap of [
    "invoices.read",
    "received.read",
    "sales.request",
    "payables.read",
    "catalog.cost_read",
    "labels.print",
  ])
    assert.equal(allowed(f, cap), false, cap);
});
test("builtin Notes grants exclude Cashier without revoking custom Notebook ACL paths", () => {
  for (const role of [
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
  ]) {
    const f = fixture(role);
    assert.equal(allowed(f, "notes.read"), true, role);
    assert.equal(allowed(f, "notes.entry_add"), true, role);
    assert.equal(allowed(f, "notes.operational_status"), true, role);
    if (role === "branch_supervisor" || role === "floor_worker")
      assert.equal(allowed(f, "notes.read", scope(["rh"])), false, role);
  }
  const f = fixture("cashier");
  assert.equal(allowed(f, "notes.read"), false);
  assert.equal(allowed(f, "notes.entry_add"), false);
  assert.equal(allowed(f, "notes.operational_status"), false);
  assert.equal(allowed(fixture("floor_worker"), "notes.status_manage"), false);
  assert.equal(allowed(f, "notebooks.read"), true);
  assert.equal(allowed(f, "notebooks.entry_add"), true);
});
test("Demo Reset grants only fresh complete configured fixture people without adding business capabilities", () => {
  const configured = [
    "demo-person-owner",
    "demo-person-manager",
    "demo-person-rh-supervisor",
    "demo-person-ny-floor",
    "demo-person-wh-floor",
    "demo-person-cashier",
  ];
  const roles = [
    "owner",
    "manager",
    "branch_supervisor",
    "floor_worker",
    "floor_worker",
    "cashier",
  ];
  for (let index = 0; index < configured.length; index++) {
    const f = fixture(roles[index]);
    f.person.id = configured[index];
    f.person.demo_fixture = true;
    f.session.user_id = f.person.id;
    authority.bindAuthoritySnapshot(f.state, f.snapshot);
    f.actor = authority.resolveActor(
      f.state,
      { company_id: "company-1", session_id: "session-1" },
      NOW,
    );
    assert.equal(allowed(f, "demo.reset"), true, roles[index]);
    f.person.demo_fixture = false;
    authority.bindAuthoritySnapshot(f.state, f.snapshot);
    assert.equal(allowed(f, "demo.reset"), false);
  }
  const custom = fixture("owner");
  custom.person.demo_fixture = true;
  authority.bindAuthoritySnapshot(custom.state, custom.snapshot);
  assert.equal(allowed(custom, "demo.reset"), false);
});
test("company-wide role scope includes locations added after session issue", () => {
  const f = fixture("manager");
  f.state.config.branches.push({ id: "future", code: "FUTURE", type: "store" });
  assert.equal(allowed(f, "invoices.post", scope(["future"])), true);
  assert.equal(
    permissions.allowedLocationIds(f.state, f.actor).includes("future"),
    true,
  );
});
test("other company records and identities fail closed", () => {
  const f = fixture();
  assert.equal(
    allowed(f, "payables.read", { ...scope(), company_id: "other" }),
    false,
  );
  assert.throws(
    () =>
      authority.resolveActor(f.state, {
        company_id: "other",
        session_id: "session-1",
      }),
    { code: "company" },
  );
});
test("role-shaped objects and spread copies are not authenticated actors", () => {
  const f = fixture();
  assert.equal(
    permissions.can(f.state, { ...f.actor }, "people.manage", scope(), NOW)
      .allowed,
    false,
  );
  assert.equal(
    permissions.can(f.state, { role: "owner" }, "people.manage", scope(), NOW)
      .allowed,
    false,
  );
});
test("explicit state clones preserve authority binding; raw clones cannot authorize", () => {
  const f = fixture();
  assert.equal(
    permissions.can(
      authority.cloneWithAuthority(f.state),
      f.actor,
      "invoices.post",
      scope(),
      NOW,
    ).allowed,
    true,
  );
  assert.equal(
    permissions.can(
      structuredClone(f.state),
      f.actor,
      "invoices.post",
      scope(),
      NOW,
    ).allowed,
    false,
  );
});
test("explicit actor location rescope stays within current assignment", () => {
  const f = fixture("branch_supervisor", ["ny", "rh"]);
  const rh = authority.actorAtLocation(f.state, f.actor, "rh");
  assert.equal(rh.branch, "rh");
  assert.equal(rh.user_id, f.actor.user_id);
  assert.throws(() => authority.actorAtLocation(f.state, f.actor, "nm"), {
    code: "location",
  });
});
test("role/location epoch change invalidates a previously resolved actor", () => {
  const f = fixture("branch_supervisor");
  f.person.authority_epoch++;
  f.person.role = "floor_worker";
  authority.bindAuthoritySnapshot(f.state, f.snapshot);
  assert.equal(allowed(f, "invoices.post"), false);
});
test("deactivation and revoked or locked sessions cannot authorize work", () => {
  for (const kind of ["deactivated", "revoked", "locked"]) {
    const f = fixture("floor_worker");
    if (kind === "deactivated") f.person.status = kind;
    else f.session.state = kind;
    authority.bindAuthoritySnapshot(f.state, f.snapshot);
    assert.equal(allowed(f, "invoices.post"), false, kind);
  }
});
test("mandatory password/second-step setup blocks business sessions", () => {
  for (const role of ["owner", "manager", "branch_supervisor"]) {
    const f = fixture(role);
    f.person.setup.second_step_complete = false;
    authority.bindAuthoritySnapshot(f.state, f.snapshot);
    assert.equal(allowed(f, "lookup.read"), false, role);
  }
  const f = fixture("floor_worker");
  f.person.setup.password_complete = false;
  authority.bindAuthoritySnapshot(f.state, f.snapshot);
  assert.equal(allowed(f, "lookup.read"), false);
});
test("aggregate selections are views, never concrete mutation locations", () => {
  const f = fixture("branch_supervisor", ["ny", "rh"]);
  f.session.selected_location = { kind: "all_my_locations" };
  authority.bindAuthoritySnapshot(f.state, f.snapshot);
  const actor = authority.resolveActor(f.state, {
    company_id: "company-1",
    session_id: "session-1",
  });
  assert.deepEqual(
    permissions.resolveLocationSelection(f.state, actor, {
      kind: "all_my_locations",
    }),
    ["ny", "rh"],
  );
  assert.throws(() => permissions.requireConcreteLocation(f.state, actor), {
    code: "location",
  });
  assert.throws(
    () =>
      permissions.resolveLocationSelection(f.state, actor, {
        kind: "all_locations",
      }),
    { code: "location" },
  );
});
test("inactive ordinary targets denied; Owner/Manager retained corrections explicitly preserved", () => {
  const f = fixture("manager");
  f.state.config.branches.find((b) => b.id === "rh").active = false;
  assert.equal(
    allowed(f, "invoices.enter", scope(["rh"], { mutation: true })),
    false,
  );
  assert.equal(
    allowed(
      f,
      "invoices.correct",
      scope(["rh"], { mutation: true, location_policy: "retained_correction" }),
    ),
    true,
  );
  assert.equal(
    allowed(
      f,
      "invoices.enter",
      scope(["rh"], { mutation: true, location_policy: "retained_correction" }),
    ),
    false,
  );
  assert.equal(
    allowed(
      f,
      "invoices.read",
      scope(["rh"], { location_policy: "retained_read" }),
    ),
    true,
  );
});
test("FW canonical handling origin permits own active receiving and posting without destination access", () => {
  const fw = fixture("floor_worker"),
    bs = fixture("branch_supervisor");
  const draft = scope(["wh"], {
    entity_id: "invoice-1",
    status: "draft",
    owner_user_id: fw.person.id,
    handling_user_ids: [],
    invoice_reviewer_origin_location_id: "ny",
    mutation: true,
  });
  const retainedCapabilities = [
    "invoices.read",
    "invoices.edit",
    "invoices.cost_read",
    "invoices.assign_receiving_location",
    "invoices.post",
  ];
  for (const capability of retainedCapabilities) {
    const target = {
      ...draft,
      mutation: !["invoices.read", "invoices.cost_read"].includes(capability),
    };
    assert.equal(allowed(fw, capability, target), true, capability);
    assert.equal(
      allowed(fw, capability, {
        ...target,
        owner_user_id: "another-person",
        handling_user_ids: [fw.person.id],
      }),
      true,
      `canonical handler: ${capability}`,
    );
    assert.equal(allowed(bs, capability, target), false, capability);
    for (const denied of [
      { owner_user_id: undefined, handling_user_ids: [] },
      { owner_user_id: "another-person", handling_user_ids: ["someone-else"] },
      { entity_id: undefined },
      { company_id: "other-company" },
      { location_ids: ["unknown-location"] },
      { status: "posted" },
      { status: "voided" },
      { invoice_reviewer_origin_location_id: "rh" },
    ])
      assert.equal(
        allowed(fw, capability, { ...target, ...denied }),
        false,
        `unrelated, invalid or no longer unposted: ${capability} ${JSON.stringify(denied)}`,
      );
  }
  for (const capability of [
    "invoices.assign_reviewer",
    "invoices.short_resolve",
    "received.read",
  ]) {
    assert.equal(allowed(fw, capability, draft), false, capability);
    assert.equal(allowed(bs, capability, draft), false, capability);
    assert.equal(
      allowed(fw, capability, { ...draft, location_ids: ["ny"] }),
      true,
      `unchanged assigned physical target: ${capability}`,
    );
  }
  fw.state.config.orders.allow_floor_worker = true;
  for (const capability of ["orders.read", "orders.cost_read", "orders.write"])
    assert.equal(allowed(fw, capability, draft), false, capability);
  for (const locationId of ["ny", "wh"]) {
    const location = fw.state.config.branches.find(
      (item) => item.id === locationId,
    );
    location.active = false;
    for (const capability of retainedCapabilities)
      assert.equal(
        allowed(fw, capability, draft),
        false,
        `inactive origin or destination ${locationId}: ${capability}`,
      );
    location.active = true;
  }
});
test("branch request endpoint read does not authorize acting at foreign endpoint", () => {
  const f = fixture("floor_worker");
  assert.equal(
    allowed(
      f,
      "branch_requests.read",
      scope(["ny", "rh"], { kind: "request_endpoints" }),
    ),
    true,
  );
  assert.equal(
    allowed(
      f,
      "branch_requests.receive",
      scope(["rh"], { kind: "request_endpoints", mutation: true }),
    ),
    false,
  );
});
test("sensitive operations require recent password without changing role claims", () => {
  const f = fixture("manager");
  f.session.authenticated_at = "2026-10-12T15:44:59Z";
  authority.bindAuthoritySnapshot(f.state, f.snapshot);
  assert.equal(allowed(f, "people.manage"), false);
  assert.equal(allowed(f, "invoices.post"), true);
});
test("notification recipient routing includes active setup-complete people without sessions", () => {
  const f = fixture();
  f.snapshot.people.push({
    ...structuredClone(f.person),
    id: "branch-person",
    username: "branch-person",
    role: "branch_supervisor",
    location_scope: { kind: "assigned", location_ids: ["rh"] },
  });
  f.snapshot.people.push({
    ...structuredClone(f.person),
    id: "inactive-person",
    username: "inactive-person",
    status: "deactivated",
  });
  authority.bindAuthoritySnapshot(f.state, f.snapshot);
  const recipients = permissions.directoryRecipients(f.state, {
    capability: "price_updates.register_confirm",
    location_ids: ["rh"],
  });
  assert.deepEqual(
    recipients.map((p) => p.user_id),
    ["person-1", "branch-person"],
  );
  assert.equal(
    recipients.find((p) => p.user_id === "branch-person").role,
    "branch_supervisor",
  );
});
