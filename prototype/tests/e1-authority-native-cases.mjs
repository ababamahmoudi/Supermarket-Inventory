/* global window, localStorage, indexedDB, crypto, fetch, structuredClone */
import assert from "node:assert/strict";

export const nativeAuthorityCaseNames = [
  "Two tabs preserve both business changes and acknowledgements under one IDB command lock",
  "Concurrent last-Owner removal is serialized across real browser tabs",
  "Protected authority History returns real transactional before/after without private setup, contacts or credentials; Floor Worker denied",
  "Deactivation broadcasts to another tab and fresh command denies even a deliberately stale cached UI actor",
  "Fresh protected queries reject revoked identity before constructing private DTO fields",
  "Reactivation never revives old sessions; fresh password sign-in creates a working session",
  "Actual IDB initialization verifies exact private raw backup, preserves alias passwords/preferences and interrupted setup, never enables unknown credential account or resets on reload",
  "Latest shared config commit rejects Cashier store-to-Warehouse conversion atomically without publishing business revision",
  "Configured Cashier Demo Reset atomically restores exactly six, revokes all previous sessions and immediately broadcasts to removed custom person",
  "Native IDB authority persists across failed verified UI preference write; retry uses actual current aliases, preserves entire private directory and cleans raw credentials only after verified preference persistence",
  "Native IDB accepted commit drains after dispose; closed BroadcastChannel and listener errors cannot reject durable commit; new calls fail and genuine SID remains resumable",
  "Native IDB clock reconciliation witness authorizes only its active exact canonical draft/source; spread, cloned-draft, wrong-source and retained witnesses fail closed",
];

export async function runNativeAuthorityCase(
  browser,
  server,
  index,
  contextOptions = {},
) {
  const context = await browser.newContext(contextOptions);
  const first = await context.newPage(),
    second = await context.newPage();
  let setup, manager, worker, companyScope, deactivated, migration;
  try {
    await Promise.all([first.goto(server.url), second.goto(server.url)]);
    setup = await first.evaluate(async () => {
      const { BrowserAuthorityRepository } =
        await import("/sdk/authority-repository.js");
      const { credentialVerifier } = await import("/sdk/credentials.js");
      const repo = (window.repo = new BrowserAuthorityRepository());
      const now = new Date().toISOString();
      const specs = [
        ["owner-1", "owner"],
        ["owner-2", "owner"],
        ["manager", "manager"],
        ["worker", "floor_worker"],
      ];
      const people = specs.map(([id, role]) => ({
        id,
        company_id: "repository-test-company",
        name_en: `Fictional ${id}`,
        username: id,
        aliases: [],
        email: `${id}@example.invalid`,
        role,
        location_scope:
          role === "floor_worker"
            ? { kind: "assigned", location_ids: ["ny"] }
            : { kind: "company" },
        status: "active",
        setup: {
          password_complete: true,
          second_step_complete: true,
          second_step_method: role === "floor_worker" ? undefined : "passkey",
          simulated: true,
        },
        authority_epoch: 1,
        version: 1,
        created_at: now,
        created_by_user_id: "owner-1",
      }));
      const sessions = people.map((person) => ({
        id: `session-${person.id}`,
        company_id: person.company_id,
        user_id: person.id,
        authority_epoch: 1,
        state: "active",
        authenticated_at: now,
        second_step_verified_at:
          person.role === "floor_worker" ? undefined : now,
        selected_location: { kind: "location", location_id: "ny" },
      }));
      const document = {
        version: 1,
        company_id: "repository-test-company",
        directory_version: 1,
        people,
        sessions,
        credentials: people.map((person) => ({
          company_id: person.company_id,
          user_id: person.id,
          password_verifier: credentialVerifier("demo1234", person.id),
          password_salt: person.id,
          failed_attempts: 0,
          version: 1,
        })),
        setup_challenges: [],
        devices: [],
        audit: [],
      };
      const business = (window.initialBusiness = {
        config: {
          company: { seed_key: "repository-test-company" },
          branches: [
            { id: "ny", code: "NY", type: "store" },
            { id: "rh", code: "RH", type: "store" },
          ],
          session: { reprompt_password_after_minutes: 15 },
        },
        changes: [],
        register_ack: false,
        label_ack: false,
      });
      await repo.initialize(document);
      await repo.initializeBusiness(business);
      return { company_id: document.company_id };
    });
    await second.evaluate(async () => {
      const { BrowserAuthorityRepository } =
        await import("/sdk/authority-repository.js");
      window.repo = new BrowserAuthorityRepository();
      window.invalidations = [];
      window.repo.subscribeInvalidation((event) =>
        window.invalidations.push(event),
      );
    });
    manager = { company_id: setup.company_id, session_id: "session-manager" };
    worker = { company_id: setup.company_id, session_id: "session-worker" };
    companyScope = {
      company_id: setup.company_id,
      kind: "location_record",
      location_ids: ["ny"],
      mutation: true,
    };

    const stages = [
      async () => {
        await Promise.all([
          first.evaluate(
            async ({ identity, scope }) =>
              window.repo.runBusinessCommand(
                identity,
                (draft, actor) => {
                  draft.changes.push(`first:${actor.user_id}`);
                  draft.register_ack = true;
                  return true;
                },
                { capability: "invoices.post", resource: scope },
              ),
            { identity: manager, scope: companyScope },
          ),
          second.evaluate(
            async ({ identity, scope }) =>
              window.repo.runBusinessCommand(
                identity,
                (draft, actor) => {
                  draft.changes.push(`second:${actor.user_id}`);
                  draft.label_ack = true;
                  return true;
                },
                { capability: "invoices.post", resource: scope },
              ),
            { identity: manager, scope: companyScope },
          ),
        ]);
        const concurrent = await first.evaluate(
          (company) => window.repo.loadBusiness(company),
          setup.company_id,
        );
        assert.equal(concurrent.revision, 3);
        assert.equal(concurrent.state.changes.length, 2);
        assert.equal(concurrent.state.register_ack, true);
        assert.equal(concurrent.state.label_ack, true);
      },
      async () => {
        const ownerSafety = await Promise.allSettled([
          first.evaluate(async (identity) => {
            const { createPeopleService } = await import("/sdk/people.js");
            const service = createPeopleService({
              repository: window.repo,
              state: () => window.initialBusiness,
              prepareSetupCode: async () => ({
                code: "never-used",
                verifier: "unused",
                salt: "unused",
              }),
              createId: (prefix) => `${prefix}-${crypto.randomUUID()}`,
            });
            return service.deactivatePerson({
              identity,
              request_id: "owner-remove-one",
              input: {
                person_id: "owner-1",
                expected_version: 1,
                reason: "Fictional staffing change",
              },
            });
          }, manager),
          second.evaluate(async (identity) => {
            const { createPeopleService } = await import("/sdk/people.js");
            const service = createPeopleService({
              repository: window.repo,
              state: () => ({
                config: {
                  company: { seed_key: identity.company_id },
                  branches: [],
                },
              }),
              prepareSetupCode: async () => ({
                code: "never-used",
                verifier: "unused",
                salt: "unused",
              }),
              createId: (prefix) => `${prefix}-${crypto.randomUUID()}`,
            });
            return service.deactivatePerson({
              identity,
              request_id: "owner-remove-two",
              input: {
                person_id: "owner-2",
                expected_version: 1,
                reason: "Fictional staffing change",
              },
            });
          }, manager),
        ]);
        assert.equal(
          ownerSafety.filter((result) => result.status === "fulfilled").length,
          1,
        );
        assert.equal(
          ownerSafety.filter(
            (result) =>
              result.status === "rejected" &&
              result.reason.message.includes("last_owner"),
          ).length,
          1,
        );
        const ownerDirectory = await first.evaluate(
          (company) => window.repo.load(company),
          setup.company_id,
        );
        assert.equal(
          ownerDirectory.people.filter(
            (person) =>
              person.role === "owner" &&
              person.status === "active" &&
              person.setup.password_complete &&
              person.setup.second_step_complete,
          ).length,
          1,
        );
      },
      async () => {
        const directoryHistory = await first.evaluate(
          (identity) => window.repo.authorityHistory(identity),
          manager,
        );
        assert.equal(directoryHistory.length, 1);
        assert.equal(directoryHistory[0].action, "Deactivate person");
        assert.equal(directoryHistory[0].actor_user_id, "manager");
        assert.equal(directoryHistory[0].before.status, "active");
        assert.equal(directoryHistory[0].after.status, "deactivated");
        assert.equal(directoryHistory[0].reversible, false);
        const auditRaw = JSON.stringify(directoryHistory);
        for (const privateField of [
          "password_verifier",
          "password_salt",
          "setup",
          "aliases",
          "sessions",
          "authority_epoch",
          "second_step",
          "@example.invalid",
        ])
          assert.equal(auditRaw.includes(privateField), false, privateField);
        const historyDenied = await second.evaluate(async (identity) => {
          try {
            await window.repo.authorityHistory(identity);
            return false;
          } catch (error) {
            return error.code === "capability";
          }
        }, worker);
        assert.equal(historyDenied, true);
      },
      async () => {
        await second.evaluate(async (identity) => {
          const { bindAuthoritySnapshot, resolveActor } =
            await import("/sdk/authority.js");
          const loaded = await window.repo.loadBusiness(identity.company_id);
          window.cachedState = loaded.state;
          bindAuthoritySnapshot(
            window.cachedState,
            await window.repo.load(identity.company_id),
          );
          window.cachedActor = resolveActor(window.cachedState, identity);
          window.callbackExecuted = false;
        }, worker);
        deactivated = await first.evaluate(async (identity) => {
          const { createPeopleService } = await import("/sdk/people.js");
          window.peopleService = createPeopleService({
            repository: window.repo,
            state: () => window.initialBusiness,
            prepareSetupCode: async () => ({
              code: "never-used",
              verifier: "unused",
              salt: "unused",
            }),
            createId: (prefix) => `${prefix}-${crypto.randomUUID()}`,
          });
          return window.peopleService.deactivatePerson({
            identity,
            request_id: "deactivate-worker",
            input: {
              person_id: "worker",
              expected_version: 1,
              reason: "Fictional employee departure",
            },
          });
        }, manager);
        await second.waitForFunction(() =>
          window.invalidations.some(
            (event) =>
              event.user_id === "worker" && event.reason === "deactivated",
          ),
        );
        const denied = await second.evaluate(
          async ({ identity, scope }) => {
            const { can } = await import("/sdk/permissions.js");
            const staleAffordance = can(
              window.cachedState,
              window.cachedActor,
              "invoices.post",
              scope,
            ).allowed;
            try {
              await window.repo.runBusinessCommand(
                identity,
                () => {
                  window.callbackExecuted = true;
                  return true;
                },
                { capability: "invoices.post", resource: scope },
              );
              return { denied: false, staleAffordance };
            } catch (error) {
              return {
                denied: true,
                code: error.code,
                callbackExecuted: window.callbackExecuted,
                staleAffordance,
              };
            }
          },
          { identity: worker, scope: companyScope },
        );
        assert.equal(denied.staleAffordance, true);
        assert.equal(denied.denied, true);
        assert.equal(denied.code, "revoked");
        assert.equal(denied.callbackExecuted, false);
        const afterDenied = await first.evaluate(
          (company) => window.repo.loadBusiness(company),
          setup.company_id,
        );
        assert.equal(afterDenied.revision, 3);
        const revokedHistoryDenied = await second.evaluate(async (identity) => {
          try {
            await window.repo.authorityHistory(identity);
            return false;
          } catch (error) {
            return error.code === "revoked";
          }
        }, worker);
        assert.equal(revokedHistoryDenied, true);
      },
      async () => {
        const queryDenied = await second.evaluate(
          async ({ identity, scope }) => {
            window.projectionExecuted = false;
            try {
              await window.repo.queryBusiness(
                identity,
                () => {
                  window.projectionExecuted = true;
                  return { private_cost: "1.5525" };
                },
                {
                  capability: "invoices.cost_read",
                  resource: { ...scope, mutation: false },
                },
              );
              return { denied: false };
            } catch (error) {
              return {
                denied: true,
                code: error.code,
                projectionExecuted: window.projectionExecuted,
              };
            }
          },
          { identity: worker, scope: companyScope },
        );
        assert.equal(queryDenied.denied, true);
        assert.equal(queryDenied.code, "revoked");
        assert.equal(queryDenied.projectionExecuted, false);
      },
      async () => {
        const reactivated = await first.evaluate(
          async ({ identity, version }) =>
            window.peopleService.reactivatePerson({
              identity,
              request_id: "reactivate-worker",
              input: {
                person_id: "worker",
                expected_version: version,
                reason: "Fictional return to work",
              },
            }),
          { identity: manager, version: deactivated.version },
        );
        assert.equal(reactivated.status, "active");
        const oldSessionDenied = await second.evaluate(
          async ({ identity, scope }) => {
            try {
              await window.repo.runBusinessCommand(identity, () => true, {
                capability: "invoices.post",
                resource: scope,
              });
              return false;
            } catch (error) {
              return error.code === "revoked";
            }
          },
          { identity: worker, scope: companyScope },
        );
        assert.equal(oldSessionDenied, true);
        const signedIn = await second.evaluate(async () => {
          const { createAuthenticationService } =
            await import("/sdk/authentication-service.js");
          const service = createAuthenticationService({
            repository: window.repo,
          });
          return service.signIn({
            company_id: "repository-test-company",
            username: "worker",
            password_or_setup_code: "demo1234",
          });
        });
        const restored = await second.evaluate(
          async ({ identity, scope }) =>
            window.repo.runBusinessCommand(
              identity,
              (draft, actor) => {
                draft.changes.push(`new-session:${actor.user_id}`);
                return true;
              },
              { capability: "invoices.post", resource: scope },
            ),
          { identity: signedIn.identity, scope: companyScope },
        );
        assert.equal(restored.business.revision, 4);
      },
      async () => {
        migration = await first.evaluate(async () => {
          const { initializeAuthority, prepareAuthorityDocument } =
            await import("/sdk/authority-initialization.js");
          const { createAuthenticationService } =
            await import("/sdk/authentication-service.js");
          const seed = await fetch("/demo-users.json").then((response) =>
            response.json(),
          );
          const state = {
            config: {
              company: { seed_key: "migration-company" },
              branches: [
                { id: "Branch 1", code: "NY", type: "store" },
                { id: "Branch 2", code: "RH", type: "store" },
                { id: "Branch 3", code: "NM", type: "store" },
                { id: "Warehouse", code: "WH", type: "warehouse" },
              ],
            },
            changes: [],
          };
          const account = (password, mustChangePassword = false) => ({
            password,
            mustChangePassword,
            failedAttempts: 0,
            lockedUntil: 0,
          });
          const raw = JSON.stringify({
            version: 2,
            accounts: {
              supervisor: account("Kept-manager-password-2026"),
              floorworker: account("Kept-worker-password-2026"),
              newemployee: account("temp1234", true),
              "unmapped-user": account("Retained-unmapped"),
            },
            preferences: { supervisor: { theme: "dark" } },
            recentUsers: ["supervisor", "floorworker"],
          });
          localStorage.setItem("preparation-only-original-auth", raw);
          const initialized = await initializeAuthority(window.repo, {
            state,
            ...seed,
            legacy_auth_raw: raw,
          });
          const untouched =
            localStorage.getItem("preparation-only-original-auth") === raw;
          const second = await initializeAuthority(window.repo, {
            state,
            ...seed,
            legacy_auth_raw: JSON.stringify({ version: 2, accounts: {} }),
          });
          const service = (window.migrationAuth = createAuthenticationService({
            repository: window.repo,
            currentDeviceId: () => "demo-computer-north-york",
          }));
          const alias = await service.signIn({
            company_id: "migration-company",
            username: "supervisor",
            password_or_setup_code: "Kept-manager-password-2026",
            device_id: "demo-computer-north-york",
          });
          const custom = await service.signIn({
            company_id: "migration-company",
            username: "newemployee",
            password_or_setup_code: "temp1234",
            device_id: "demo-computer-north-york",
          });
          const complete = await service.choosePassword(
            custom.identity,
            "New-employee-secret-2026",
          );
          const resetActor = await service.switchDemoUser(
            "migration-company",
            "cashier",
          );
          window.resetDocument = prepareAuthorityDocument({
            state,
            ...seed,
          }).document;
          window.resetState = state;
          return {
            initialized,
            untouched,
            second,
            alias,
            custom,
            complete,
            resetActor,
          };
        });
        assert.equal(migration.initialized.snapshot.people.length, 7);
        assert.equal(migration.initialized.may_remove_legacy_credentials, true);
        assert.equal(migration.untouched, true);
        assert.equal(migration.second.migrated, false);
        assert.equal(migration.second.snapshot.people.length, 7);
        assert.equal(migration.alias.person.id, "demo-person-manager");
        assert.equal(migration.alias.next, "second_step_challenge");
        assert.equal(migration.custom.next, "password");
        assert.equal(migration.complete.next, "complete");
        assert.deepEqual(
          migration.initialized.preferences.by_user_id["demo-person-manager"],
          { theme: "dark" },
        );
        const rawBackupVerified = await first.evaluate(async () => {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(
              "supermarket-prototype-authority-v1",
              1,
            );
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const backups = await new Promise((resolve, reject) => {
            const request = db
              .transaction("private_backups", "readonly")
              .objectStore("private_backups")
              .getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          db.close();
          return backups.some(
            (backup) =>
              backup.company_id === "migration-company" &&
              backup.raw ===
                localStorage.getItem("preparation-only-original-auth") &&
              backup.raw.includes("Retained-unmapped"),
          );
        });
        assert.equal(rawBackupVerified, true);
      },
      async () => {
        const badLocation = await first.evaluate(async (identity) => {
          try {
            await window.repo.runBusinessCommand(
              identity,
              (draft) => {
                draft.config.branches[0].type = "warehouse";
                return true;
              },
              {
                capability: "demo.reset",
                resource: {
                  company_id: identity.company_id,
                  kind: "company_shared",
                },
              },
            );
            return false;
          } catch (error) {
            return error.code === "location";
          }
        }, migration.resetActor.identity);
        assert.equal(badLocation, true);
        const unchangedType = await first.evaluate(
          (company) => window.repo.loadBusiness(company),
          "migration-company",
        );
        assert.equal(unchangedType.revision, 1);
        assert.equal(unchangedType.state.config.branches[0].type, "store");
      },
      async () => {
        await second.evaluate(() => {
          window.resetInvalidations = [];
          window.repo.subscribeInvalidation((event) =>
            window.resetInvalidations.push(event),
          );
        });
        const reset = await first.evaluate(
          async (identity) =>
            window.repo.resetDemo(
              identity,
              window.resetState,
              window.resetDocument,
            ),
          migration.resetActor.identity,
        );
        await second.waitForFunction(() =>
          window.resetInvalidations.some(
            (event) =>
              event.user_id === "legacy-person-newemployee" &&
              event.reason === "demo_reset",
          ),
        );
        assert.equal(reset.authority_snapshot.people.length, 6);
        assert.equal(reset.authority_snapshot.sessions.length, 0);
        assert.equal(reset.business.revision, 2);
        assert.equal(
          reset.authority_snapshot.people.every(
            (person) =>
              person.authority_epoch >= 2 ||
              person.id === "demo-person-rh-supervisor" ||
              person.id === "demo-person-wh-floor",
          ),
          true,
        );
        const resetRevoked = await second.evaluate(async (identity) => {
          try {
            await window.repo.queryBusiness(identity, () => true);
            return false;
          } catch (error) {
            return error.code === "authentication" || error.code === "revoked";
          }
        }, migration.complete.identity);
        assert.equal(resetRevoked, true);
      },
      async () => {
        const retryProof = await first.evaluate(async () => {
          const { BrowserAuthorityRepository } =
            await import("/sdk/authority-repository.js");
          const { initializeAuthority } =
            await import("/sdk/authority-initialization.js");
          const { adoptMigratedPreferences, AUTH_PREFERENCES_KEY } =
            await import("/sdk/auth-preferences.e1.js");
          const seed = await fetch("/demo-users.json").then((r) => r.json());
          const repository = new BrowserAuthorityRepository();
          const company = "native-lifecycle-company";
          const state = {
            config: {
              company: { seed_key: company },
              branches: [
                { id: "Branch 1", code: "NY", type: "store" },
                { id: "Branch 2", code: "RH", type: "store" },
                { id: "Branch 3", code: "NM", type: "store" },
                { id: "Warehouse", code: "WH", type: "warehouse" },
              ],
            },
            changes: [],
          };
          const raw = JSON.stringify({
            version: 2,
            accounts: {
              supervisor: {
                password: "Retained-lifecycle-password",
                mustChangePassword: false,
                failedAttempts: 0,
                lockedUntil: 0,
              },
            },
            preferences: {
              supervisor: { theme: "dark", comfortableText: true },
            },
            recentUsers: ["supervisor"],
            devicePreferences: { theme: "dark", comfortableText: false },
          });
          localStorage.setItem("native-preference-legacy-raw", raw);
          localStorage.removeItem(AUTH_PREFERENCES_KEY);
          try {
            const initialized = await initializeAuthority(repository, {
              state,
              ...seed,
              legacy_auth_raw: raw,
            });
            const before = await repository.transaction(company, (document) =>
              JSON.stringify(document),
            );
            const failingStorage = {
              getItem: (key) => localStorage.getItem(key),
              setItem: () => {},
            };
            let failed = false;
            try {
              adoptMigratedPreferences(initialized.preferences, failingStorage);
            } catch (error) {
              failed = error.code === "preferences_storage";
            }
            const retainedAfterFailedWrite =
              localStorage.getItem("native-preference-legacy-raw") === raw;
            const retry = await initializeAuthority(repository, {
              state,
              demo_users: [],
              registered_computers: [],
              legacy_auth_raw: raw,
            });
            const adopted = adoptMigratedPreferences(
              retry.preferences,
              localStorage,
            );
            if (retry.may_remove_legacy_credentials)
              localStorage.removeItem("native-preference-legacy-raw");
            const after = await repository.transaction(company, (document) =>
              JSON.stringify(document),
            );
            window.nativeLifecycleCompany = company;
            return {
              failed,
              retainedAfterFailedWrite,
              currentDirectoryUnchanged: before.value === after.value,
              firstMigrated: initialized.migrated,
              retryMigrated: retry.migrated,
              cleanupAllowed: retry.may_remove_legacy_credentials,
              removedAfterVerifiedWrite:
                localStorage.getItem("native-preference-legacy-raw") === null,
              adopted,
            };
          } finally {
            repository.dispose();
          }
        });
        assert.equal(retryProof.failed, true);
        assert.equal(retryProof.retainedAfterFailedWrite, true);
        assert.equal(retryProof.currentDirectoryUnchanged, true);
        assert.equal(retryProof.firstMigrated, true);
        assert.equal(retryProof.retryMigrated, false);
        assert.equal(retryProof.cleanupAllowed, true);
        assert.equal(retryProof.removedAfterVerifiedWrite, true);
        assert.deepEqual(retryProof.adopted.by_user_id["demo-person-manager"], {
          theme: "dark",
          comfortableText: true,
        });
      },
      async () => {
        const lifecycleProof = await first.evaluate(async () => {
          const { BrowserAuthorityRepository } =
            await import("/sdk/authority-repository.js");
          const { createAuthenticationService } =
            await import("/sdk/authentication-service.js");
          const company = window.nativeLifecycleCompany,
            observer = new BrowserAuthorityRepository();
          const service = createAuthenticationService({
            repository: observer,
            currentDeviceId: () => "demo-computer-north-york",
          });
          const signed = await service.switchDemoUser(company, "manager");
          const scope = {
            company_id: company,
            kind: "company_shared",
            mutation: true,
          };
          const closed = new BrowserAuthorityRepository(),
            pending = new BrowserAuthorityRepository();
          try {
            await closed.loadBusiness(company);
            closed.channel.close();
            closed.subscribeBusiness(() => {
              throw new Error("optional hint error");
            });
            const committed = await closed.runBusinessCommand(
              signed.identity,
              (draft) => {
                draft.changes.push("closed-channel-commit");
                return true;
              },
              { capability: "catalog.edit", resource: scope },
            );
            let delivered = 0;
            pending.subscribeBusiness(() => delivered++);
            const accepted = pending.runBusinessCommand(
              signed.identity,
              (draft) => {
                draft.changes.push("accepted-before-dispose");
                return true;
              },
              { capability: "catalog.edit", resource: scope },
            );
            pending.dispose();
            pending.dispose();
            const retained = await accepted;
            let called = false,
              newCallDenied = false;
            try {
              await pending.runBusinessCommand(signed.identity, () => {
                called = true;
                return true;
              });
            } catch (error) {
              newCallDenied = error.code === "unavailable";
            }
            const loaded = await observer.loadBusiness(company);
            const resumed = await service.resume(signed.identity);
            return {
              committed: committed.value,
              accepted: retained.value,
              revision: loaded.revision,
              changes: loaded.state.changes,
              delivered,
              newCallDenied,
              called,
              sidPreserved:
                resumed.identity.session_id === signed.identity.session_id,
              next: resumed.next,
            };
          } finally {
            closed.dispose();
            pending.dispose();
            observer.dispose();
          }
        });
        assert.equal(lifecycleProof.committed, true);
        assert.equal(lifecycleProof.accepted, true);
        assert.equal(lifecycleProof.revision, 3);
        assert.deepEqual(lifecycleProof.changes, [
          "closed-channel-commit",
          "accepted-before-dispose",
        ]);
        assert.equal(lifecycleProof.delivered, 0);
        assert.equal(lifecycleProof.newCallDenied, true);
        assert.equal(lifecycleProof.called, false);
        assert.equal(lifecycleProof.sidPreserved, true);
        assert.equal(lifecycleProof.next, "complete");
      },
      async () => {
        const systemProof = await first.evaluate(async () => {
          const { BrowserAuthorityRepository, requireSystemReconciliation } =
            await import("/sdk/authority-repository.js");
          const repository = new BrowserAuthorityRepository();
          let retained;
          const company = window.nativeLifecycleCompany;
          try {
            const result = await repository.runSystemReconciliation(
              company,
              "sales_clock",
              (draft, attribution) => {
                requireSystemReconciliation(draft, attribution, "sales_clock");
                retained = attribution;
                const denied = [];
                for (const [state, actor, source] of [
                  [draft, { ...attribution }, "sales_clock"],
                  [structuredClone(draft), attribution, "sales_clock"],
                  [draft, attribution, "date_reminders"],
                ]) {
                  try {
                    requireSystemReconciliation(state, actor, source);
                    denied.push(false);
                  } catch (error) {
                    denied.push(error.code === "authentication");
                  }
                }
                draft.changes.push("actual-clock");
                return denied;
              },
            );
            let retainedDenied = false;
            try {
              requireSystemReconciliation(
                result.business.state,
                retained,
                "sales_clock",
              );
            } catch (error) {
              retainedDenied = error.code === "authentication";
            }
            return {
              denied: result.value,
              retainedDenied,
              revision: result.business.revision,
              changes: result.business.state.changes,
            };
          } finally {
            repository.dispose();
          }
        });
        assert.deepEqual(systemProof.denied, [true, true, true]);
        assert.equal(systemProof.retainedDenied, true);
        assert.equal(systemProof.revision, 4);
        assert.deepEqual(systemProof.changes, [
          "closed-channel-commit",
          "accepted-before-dispose",
          "actual-clock",
        ]);
      },
    ];
    for (let step = 0; step <= index; step++) await stages[step]();
    await server.assertSourceUnchanged();
  } finally {
    await context.close();
  }
}
