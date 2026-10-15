/* global structuredClone, TextEncoder */
// @vitest-environment node
// Retained SDK assertion bodies; imports resolve the actual integrated source.
// Official fake-indexeddb is used only by the lifecycle repository cases.
import { can } from "../permissions";
import { test } from "vitest";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import configuredSeed from "../../../seed/demo-data.json";
const seed = {
  demo_users: configuredSeed.demo_users,
  registered_computers: configuredSeed.registered_computers,
};
import {
  BrowserAuthorityRepository,
  requireSystemReconciliation,
} from "../authority-repository";
import { initializeAuthority } from "../authority-initialization";
import { createAuthenticationService } from "../authentication-service";
import { sha256Bytes } from "../sha256";
const makeState = () => ({
  config: {
    company: { seed_key: "lifecycle-company" },
    branches: [
      { id: "Branch 1", code: "NY", type: "store" },
      { id: "Branch 2", code: "RH", type: "store" },
      { id: "Branch 3", code: "NM", type: "store" },
      { id: "Warehouse", code: "WH", type: "warehouse" },
    ],
  },
  changes: [],
});
async function fixture() {
  const factory = new IDBFactory(),
    repository = new BrowserAuthorityRepository(factory);
  await initializeAuthority(repository, { state: makeState(), ...seed });
  const auth = createAuthenticationService({
    repository,
    currentDeviceId: () => "demo-computer-north-york",
  });
  const signed = await auth.switchDemoUser("lifecycle-company", "manager");
  return {
    factory,
    repository,
    identity: signed.identity,
    scope: {
      company_id: "lifecycle-company",
      kind: "company_shared",
      mutation: true,
    },
  };
}

test("dispose drains a command accepted before database open, rejects new calls and preserves resumable SID", async () => {
  const f = await fixture();
  const accepted = new BrowserAuthorityRepository(f.factory),
    observer = new BrowserAuthorityRepository(f.factory);
  try {
    const promise = accepted.runBusinessCommand(
      f.identity,
      (draft, actor) => {
        draft.changes.push(actor.user_id);
        return "durable";
      },
      { capability: "catalog.edit", resource: f.scope },
    );
    accepted.dispose();
    accepted.dispose();
    const result = await promise;
    assert.equal(result.value, "durable");
    assert.equal(result.business.revision, 2);
    assert.deepEqual(
      (await observer.loadBusiness("lifecycle-company")).state.changes,
      ["demo-person-manager"],
    );
    await assert.rejects(accepted.loadBusiness("lifecycle-company"), {
      code: "unavailable",
    });
    let called = false;
    await assert.rejects(
      accepted.runBusinessCommand(f.identity, () => {
        called = true;
      }),
      { code: "unavailable" },
    );
    assert.equal(called, false);
    const auth = createAuthenticationService({ repository: observer });
    const resumed = await auth.resume(f.identity);
    assert.equal(resumed.identity.session_id, f.identity.session_id);
    assert.equal(resumed.next, "complete");
  } finally {
    accepted.dispose();
    observer.dispose();
    f.repository.dispose();
  }
});

test("closed BroadcastChannel and throwing hint listeners cannot reject an already committed command", async () => {
  const f = await fixture();
  try {
    f.repository.channel.close(); // Test-only real channel failure; no app escape is exported.
    f.repository.subscribeBusiness(() => {
      throw new Error("optional hint failed");
    });
    const result = await f.repository.runBusinessCommand(
      f.identity,
      (draft) => {
        draft.changes.push("committed");
        return true;
      },
      { capability: "catalog.edit", resource: f.scope },
    );
    assert.equal(result.value, true);
    assert.equal(result.business.revision, 2);
    assert.deepEqual(
      (await f.repository.loadBusiness("lifecycle-company")).state.changes,
      ["committed"],
    );
  } finally {
    f.repository.dispose();
  }
});

test("dispose drains exact private backup write and readback together before closing the connection", async () => {
  const factory = new IDBFactory(),
    repository = new BrowserAuthorityRepository(factory);
  const raw = "exact retained private raw JSON",
    hash = (value) => sha256Bytes(new TextEncoder().encode(value));
  const record = {
    id: "retained-backup",
    company_id: "lifecycle-company",
    source_key: "legacy",
    raw,
    sha256: hash(raw),
    created_at: new Date().toISOString(),
  };
  const accepted = repository.archivePrivateBackup(record, hash);
  repository.dispose();
  await accepted;
  const database = await new Promise((resolve, reject) => {
    const request = factory.open("supermarket-prototype-authority-v1", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const retained = await new Promise((resolve, reject) => {
      const request = database
        .transaction("private_backups", "readonly")
        .objectStore("private_backups")
        .get(record.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    assert.equal(retained.raw, raw);
    assert.equal(retained.sha256, hash(raw));
    await assert.rejects(repository.archivePrivateBackup(record, hash), {
      code: "unavailable",
    });
  } finally {
    database.close();
    repository.dispose();
  }
});

test("system witness belongs only to the active exact canonical draft and source, never forged or retained copies", async () => {
  const f = await fixture();
  let retained;
  try {
    const result = await f.repository.runSystemReconciliation(
      "lifecycle-company",
      "sales_clock",
      (draft, attribution) => {
        requireSystemReconciliation(draft, attribution, "sales_clock");
        retained = attribution;
        for (const [state, actor, source] of [
          [draft, { ...attribution }, "sales_clock"],
          [structuredClone(draft), attribution, "sales_clock"],
          [draft, attribution, "date_reminders"],
        ])
          assert.throws(
            () => requireSystemReconciliation(state, actor, source),
            { code: "authentication" },
          );
        draft.changes.push("trusted clock");
        return true;
      },
    );
    assert.equal(result.business.revision, 2);
    assert.deepEqual(result.business.state.changes, ["trusted clock"]);
    assert.throws(
      () =>
        requireSystemReconciliation(
          result.business.state,
          retained,
          "sales_clock",
        ),
      { code: "authentication" },
    );
    await f.repository.runSystemReconciliation(
      "lifecycle-company",
      "sales_clock",
      (draft) => {
        assert.throws(
          () => requireSystemReconciliation(draft, retained, "sales_clock"),
          { code: "authentication" },
        );
        return false;
      },
    );
  } finally {
    f.repository.dispose();
  }
});

test("actual Floor Workers retain receiving access without the Branch Supervisor dashboard; BS and company roles keep their own dashboards", async () => {
  const f = await fixture();
  const auth = createAuthenticationService({
    repository: f.repository,
    currentDeviceId: () => "demo-computer-north-york",
  });
  try {
    for (const [username, location, allowed] of [
      ["owner", "Branch 1", true],
      ["manager", "Branch 1", true],
      ["rh-supervisor", "Branch 2", true],
      ["rh-supervisor", "Branch 1", false],
      ["ny-floor", "Branch 1", false],
      ["wh-floor", "Warehouse", false],
      ["cashier", "Branch 1", false],
    ]) {
      const signed = await auth.switchDemoUser("lifecycle-company", username);
      const result = await f.repository.queryBusiness(
        signed.identity,
        (state, actor) => {
          const resource = {
            company_id: "lifecycle-company",
            kind: "location_record",
            location_ids: [location],
          };
          return {
            dashboard: can(state, actor, "dashboard.location", resource)
              .allowed,
            receiving: can(state, actor, "invoices.read", resource).allowed,
            companyDashboard: can(state, actor, "dashboard.company", {
              company_id: "lifecycle-company",
              kind: "company_shared",
            }).allowed,
            user_id: actor.user_id,
          };
        },
      );
      assert.equal(
        result.value.dashboard,
        allowed,
        `${username} at ${location}`,
      );
      if (username === "ny-floor" || username === "wh-floor") {
        assert.equal(
          result.value.receiving,
          true,
          `${username} retained receiving`,
        );
        assert.equal(
          result.value.companyDashboard,
          false,
          `${username} no new company dashboard`,
        );
      }
      if (username === "owner" || username === "manager")
        assert.equal(result.value.companyDashboard, true);
      assert.equal(result.value.user_id, `demo-person-${username}`);
    }
  } finally {
    f.repository.dispose();
  }
});
