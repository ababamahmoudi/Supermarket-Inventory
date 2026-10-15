import { beginAppWork, trackAppWork } from "./app-work";
import type {
  AuthenticatedActor,
  BusinessState,
  PersonRecord,
  PeopleDirectoryRow,
  PersonInput,
  PersonEditInput,
  PersonStatusInput,
  DeviceInput,
  RegisteredDevice,
  AuthorityHistoryEntry,
  SystemAttribution,
  SystemReconciliationSource,
} from "./authority-types";
import {
  BrowserAuthorityRepository,
  AuthorityStorageError,
} from "./authority-repository";
import { createAuthenticationService } from "./authentication-service";
import { createPeopleService } from "./people";
import { createDevicesService } from "./devices";
import {
  initializeAuthority,
  prepareAuthorityDocument,
  LEGACY_AUTH_STORAGE_KEY,
  type ConfiguredDemoPerson,
  type ConfiguredDemoDevice,
  type LegacyPersonMetadata,
} from "./authority-initialization";
import { newAuthorityId, prepareSetupCode } from "./credentials";
import {
  adoptMigratedPreferences,
  readComputerId,
  readIdentity,
  writeIdentity,
  writeComputerId,
  type AuthPreferences,
} from "./auth-preferences.e1";
import {
  createE1StoreController,
  type ShellSnapshot,
} from "./e1-store-controller";

class NoSystemChange extends Error {}
export interface ShellRuntimeOptions<
  State extends BusinessState,
  View extends BusinessState,
> {
  companyId: string;
  /** Existing lossless business/file migrations finish before first IDB import. */
  loadInitialBusiness(): Promise<State>;
  freshDemoBusiness(): Promise<State>;
  migrateInitialAttribution?(
    state: State,
    people: readonly PersonRecord[],
  ): void;
  demoUsers: readonly ConfiguredDemoPerson[];
  configuredComputers: readonly ConfiguredDemoDevice[];
  defaultComputerId: string | null;
  legacyPeople?: readonly LegacyPersonMetadata[];
  projectView(state: State, actor: AuthenticatedActor): View;
  signedOutView(state?: State): View;
  publish(snapshot: ShellSnapshot<View>): void;
  publishPreferences(preferences: AuthPreferences): void;
  publishError(error: unknown): void;
  publishRecoveryStatus?(status: {
    active: boolean;
    retirementPending: boolean;
  }): void;
  historyRecovery?: {
    status(state: State): { active: boolean; retirementPending: boolean };
    prepareReset(before: State, replacement: State): Promise<void>;
    finishReset(
      controller: ReturnType<typeof createE1StoreController<State, View>>,
    ): Promise<void>;
  };
  prepareInitialBusiness?(
    repository: BrowserAuthorityRepository,
    companyId: string,
  ): Promise<void>;
  prepareCommit?(draft: State, before: State, actor: AuthenticatedActor): void;
  onCommitted?(before: State, after: State, actor: AuthenticatedActor): void;
  systemJobs?: readonly {
    source: SystemReconciliationSource;
    apply(state: State, attribution: SystemAttribution): void;
  }[];
  repository?: BrowserAuthorityRepository;
  localStorage?: Storage;
  sessionStorage?: Storage;
}
const publicPerson = (person: PersonRecord): PeopleDirectoryRow => ({
  id: person.id,
  company_id: person.company_id,
  name_en: person.name_en,
  name_fa: person.name_fa,
  username: person.username,
  phone: person.phone,
  email: person.email,
  role: person.role,
  location_scope: structuredClone(person.location_scope),
  status: person.status,
  version: person.version,
  last_sign_in_at: person.last_sign_in_at,
});

/** The repository, canonical bootstrap, authority snapshots and identities stay private. */
export async function createE1ShellRuntime<
  State extends BusinessState,
  View extends BusinessState,
>(options: ShellRuntimeOptions<State, View>) {
  const releaseStartup = beginAppWork();
  try {
    const local = options.localStorage ?? globalThis.localStorage;
    const session = options.sessionStorage ?? globalThis.sessionStorage;
    const repository = options.repository ?? new BrowserAuthorityRepository();
    const ownsRepository = !options.repository;
    let bootstrapCleanup: (() => void) | null = null;
    try {
      let initial: State;
      let imported = false;
      try {
        initial = (await repository.loadBusiness<State>(options.companyId))
          .state;
      } catch (error) {
        if (
          !(error instanceof AuthorityStorageError) ||
          error.code !== "missing"
        )
          throw error;
        initial = await options.loadInitialBusiness();
        imported = true;
      }
      if (initial.config.company.seed_key !== options.companyId)
        throw new Error("company");
      const publishRecovery = () =>
        options.publishRecoveryStatus?.(
          options.historyRecovery?.status(initial) ?? {
            active: false,
            retirementPending: false,
          },
        );
      const initialized = await initializeAuthority(repository, {
        state: initial,
        demo_users: options.demoUsers,
        registered_computers: options.configuredComputers,
        legacy_auth_raw: local.getItem(LEGACY_AUTH_STORAGE_KEY),
        legacy_people: options.legacyPeople,
      });
      // This verified write precedes removing the backed-up old credential directory.
      const preferences = adoptMigratedPreferences(
        initialized.preferences,
        local,
      );
      options.publishPreferences(preferences);
      if (initialized.may_remove_legacy_credentials)
        local.removeItem(LEGACY_AUTH_STORAGE_KEY);
      if (imported)
        options.migrateInitialAttribution?.(
          initial,
          initialized.snapshot.people,
        );
      initial = (await repository.initializeBusiness(initial)).state;
      // Announce quarantine only from the actual committed business record.
      // A concurrent healthy initialization takes precedence over a prepared import.
      publishRecovery();
      const runSystemJob = async (
        source: SystemReconciliationSource,
        apply: (draft: State, attribution: SystemAttribution) => void,
      ) => {
        const release = beginAppWork();
        try {
          await repository.runSystemReconciliation<State, void>(
            options.companyId,
            source,
            (draft, attribution) => {
              const before = JSON.stringify(draft);
              apply(draft, attribution);
              if (JSON.stringify(draft) === before) throw new NoSystemChange();
            },
          );
        } catch (error) {
          if (!(error instanceof NoSystemChange)) throw error;
        } finally {
          release();
        }
      };
      await options.prepareInitialBusiness?.(repository, options.companyId);
      // Clock effects run only against the persisted state with a real repository witness.
      for (const job of options.systemJobs ?? [])
        await runSystemJob(job.source, job.apply);
      const configuredDefault = options.configuredComputers.some(
        (computer) =>
          computer.id === options.defaultComputerId && computer.active,
      )
        ? options.defaultComputerId
        : null;
      let currentComputerId = readComputerId(
        options.companyId,
        configuredDefault,
        local,
      );
      const authentication = createAuthenticationService({
        repository,
        currentDeviceId: () => currentComputerId ?? undefined,
      });
      const peopleService = createPeopleService({
        repository,
        state: () => initial,
        prepareSetupCode,
        createId: newAuthorityId,
      });
      const devicesService = createDevicesService({
        repository,
        createId: newAuthorityId,
      });
      let last: ShellSnapshot<View> | null = null;
      const controller = createE1StoreController<State, View>({
        companyId: options.companyId,
        repository,
        authentication,
        projectView: (state, actor) => {
          initial = state;
          publishRecovery();
          return actor
            ? options.projectView(state, actor)
            : options.signedOutView(initial);
        },
        // The same existing public whitelist uses actual loaded company metadata;
        // canonical state remains private and is never the returned view.
        signedOutView: () => options.signedOutView(initial),
        persistIdentity: (identity) => writeIdentity(identity, session),
        publish: (snapshot) => {
          last = snapshot;
          options.publish(snapshot);
        },
        prepareCommit: options.prepareCommit,
        onCommitted: options.onCommitted,
        reconcileAfterCommit: async () => {
          if (disposed) return;
          // Date removal, stopping tracking and Undo must publish the updated
          // derived reminder before the action resolves. The separate transaction
          // receives a date_reminders witness minted by the actual repository.
          const job = options.systemJobs?.find(
            (item) => item.source === "date_reminders",
          );
          if (job) await runSystemJob(job.source, job.apply);
        },
        reportReconciliationError: (error) => {
          if (!disposed) options.publishError(error);
        },
      });
      let disposed = false,
        refreshPending: Promise<void> | null = null;
      const refresh = () => {
        if (disposed || refreshPending) return;
        refreshPending = controller
          .refresh()
          .catch(options.publishError)
          .finally(() => {
            refreshPending = null;
          });
      };
      const unsubscribeAuthority = repository.subscribeInvalidation((event) => {
        if (event.company_id !== options.companyId || disposed) return;
        const actor = last?.actor;
        const invalidatesSession =
          event.reason !== "device_changed" ||
          event.authority_epoch !== actor?.authority_epoch;
        if (
          actor &&
          invalidatesSession &&
          event.user_id === actor.user_id &&
          (!event.session_id || event.session_id === actor.session_id)
        ) {
          void controller.invalidate().catch(options.publishError);
        } else refresh();
      });
      const unsubscribeBusiness = repository.subscribeBusiness((event) => {
        if (
          event.company_id === options.companyId &&
          event.revision > (last?.revision ?? -1)
        )
          refresh();
      });
      bootstrapCleanup = () => {
        if (disposed) return;
        disposed = true;
        unsubscribeAuthority();
        unsubscribeBusiness();
        controller.dispose();
        if (ownsRepository) repository.dispose();
      };
      const request = <T>(
        identity: { company_id: string; session_id: string },
        input: T,
      ) => ({ identity, input, request_id: newAuthorityId("request") });
      const people = {
        list: () =>
          controller.authorityRead(
            "people.read",
            { company_id: options.companyId, kind: "company_shared" },
            (identity) => peopleService.listPeople(request(identity, {})),
          ),
        add: (input: PersonInput) =>
          controller.authorityAction(async (identity) => {
            const result = await peopleService.addPerson(
              request(identity, input),
            );
            return {
              person: publicPerson(result.person),
              one_time_setup_code: result.one_time_setup_code,
            };
          }),
        edit: (input: PersonEditInput) =>
          controller.authorityAction(async (identity) =>
            publicPerson(
              await peopleService.editPerson(request(identity, input)),
            ),
          ),
        deactivate: (input: PersonStatusInput) =>
          controller.authorityAction(async (identity) =>
            publicPerson(
              await peopleService.deactivatePerson(request(identity, input)),
            ),
          ),
        reactivate: (input: PersonStatusInput) =>
          controller.authorityAction(async (identity) =>
            publicPerson(
              await peopleService.reactivatePerson(request(identity, input)),
            ),
          ),
        resetSetup: async (input: PersonStatusInput) => {
          if (input.person_id === last?.actor?.user_id) {
            const person = await controller.restartOwnSetup(
              (identity) => peopleService.resetSetup(request(identity, input)),
              currentComputerId ?? undefined,
            );
            return { person, one_time_setup_code: null };
          }
          return controller.authorityAction(async (identity) => {
            const result = await peopleService.resetSetup(
              request(identity, input),
            );
            return {
              person: publicPerson(result.person),
              one_time_setup_code: result.one_time_setup_code,
            };
          });
        },
      };
      const registeredComputers = {
        list: () =>
          controller.authorityRead(
            "devices.manage",
            { company_id: options.companyId, kind: "company_shared" },
            (identity) => devicesService.listDevices(request(identity, {})),
          ),
        register: (input: DeviceInput) =>
          controller.authorityAction((identity) =>
            devicesService.registerDevice(request(identity, input)),
          ),
        edit: (input: DeviceInput & { device_id: string }) =>
          controller.authorityAction((identity) =>
            devicesService.editDevice(request(identity, input)),
          ),
        deactivate: (input: {
          device_id: string;
          expected_version: number;
          reason: string;
        }) =>
          controller.authorityAction((identity) =>
            devicesService.deactivateDevice(request(identity, input)),
          ),
        selectCurrent: async (deviceId: string) => {
          await controller.authorityAction(async (identity) => {
            const rows = await devicesService.listDevices(
              request(identity, {}),
            );
            const selected = rows.find(
              (row) =>
                row.id === deviceId &&
                row.active &&
                row.company_id === options.companyId,
            );
            if (!selected) throw new Error("location");
            writeComputerId(options.companyId, selected.id, local);
            currentComputerId = selected.id;
          });
        },
      };
      let retirementPending: Promise<void> | null = null;
      const retryHistoryRetirement = async () => {
        if (
          last?.stage !== "complete" ||
          !options.historyRecovery?.status(initial).retirementPending
        )
          return;
        retirementPending ??= options.historyRecovery
          .finishReset(controller)
          .catch(options.publishError)
          .finally(() => {
            retirementPending = null;
          });
        await retirementPending;
      };
      await controller.resume(readIdentity(session));
      await retryHistoryRetirement();
      const runtime = {
        controller,
        people,
        registeredComputers,
        retryHistoryRetirement,
        resetDemo: async () => {
          let committed = false;
          let followUpFailed = false;
          try {
            await controller.resetDemo(async (identity) => {
              const fixture = options.demoUsers.find(
                (person) => person.id === last?.actor?.user_id,
              );
              if (!fixture) throw new Error("capability");
              const state = await options.freshDemoBusiness();
              const replacement = prepareAuthorityDocument({
                state,
                demo_users: options.demoUsers,
                registered_computers: options.configuredComputers,
              }).document;
              options.migrateInitialAttribution?.(state, replacement.people);
              if (options.historyRecovery) {
                const before = await repository.queryBusiness<State, State>(
                  identity,
                  (draft) => structuredClone(draft),
                  {
                    capability: "demo.reset",
                    resource: {
                      company_id: options.companyId,
                      kind: "company_shared",
                      mutation: true,
                    },
                  },
                );
                await options.historyRecovery.prepareReset(before.value, state);
              }
              const accepted = await repository.resetDemo(
                identity,
                state,
                replacement,
              );
              committed = true;
              initial = accepted.business.state;
              publishRecovery();
              // The newly issued real session uses the reset computer default.
              // A failed preference write cannot reject an already committed Reset.
              currentComputerId = configuredDefault;
              try {
                writeComputerId(options.companyId, configuredDefault, local);
              } catch (error) {
                followUpFailed = true;
                options.publishError(error);
              }
              return fixture.username;
            });
          } catch (error) {
            if (!committed) throw error;
            // Reset is already committed; a failed later sign-in cannot make the
            // old directory/business reappear or pretend the reset was rejected.
            options.publishError(error);
            await controller.resume(null);
            return { clean: false };
          }
          try {
            for (const job of options.systemJobs ?? [])
              await runSystemJob(job.source, job.apply);
          } catch (error) {
            followUpFailed = true;
            options.publishError(error);
          }
          await retryHistoryRetirement();
          return {
            clean:
              !followUpFailed &&
              !(options.historyRecovery?.status(initial).active ?? false),
          };
        },
        async reconcile(
          source: SystemReconciliationSource,
          apply: (draft: State, attribution: SystemAttribution) => void,
        ) {
          await runSystemJob(source, apply);
          await controller.refresh();
        },
        async reconcileClock() {
          for (const job of options.systemJobs ?? [])
            await runSystemJob(job.source, job.apply);
          await controller.refresh();
        },
        currentComputer: async (): Promise<RegisteredDevice | null> =>
          currentComputerId
            ? devicesService.currentDevice(options.companyId, currentComputerId)
            : null,
        currentComputerId: () => currentComputerId,
        async demoPeople() {
          const snapshot = await repository.load(options.companyId);
          const configuredIds = new Set(
            options.demoUsers.map((person) => person.id),
          );
          return snapshot.people
            .filter(
              (person) =>
                person.company_id === options.companyId &&
                configuredIds.has(person.id) &&
                person.demo_fixture &&
                person.status === "active" &&
                person.setup.password_complete &&
                (!["owner", "manager", "branch_supervisor"].includes(
                  person.role,
                ) ||
                  person.setup.second_step_complete),
            )
            .map((person) => ({
              id: person.id,
              name: person.name_en,
              name_en: person.name_en,
              name_fa: person.name_fa,
              username: person.username,
              role: person.role,
            }));
        },
        recentPeople: async (recentIds: readonly string[]) => {
          if (
            !currentComputerId ||
            !(await devicesService.currentDevice(
              options.companyId,
              currentComputerId,
            ))
          )
            return [];
          const snapshot = await repository.load(options.companyId);
          return recentIds
            .map((id) =>
              snapshot.people.find(
                (person) =>
                  person.id === id &&
                  person.company_id === options.companyId &&
                  person.status !== "deactivated",
              ),
            )
            .filter((person): person is PersonRecord => Boolean(person))
            .map((person) => ({
              id: person.id,
              username: person.username,
              name_en: person.name_en,
              name_fa: person.name_fa,
            }));
        },
        authorityHistory: (): Promise<readonly AuthorityHistoryEntry[]> =>
          controller.authorityRead(
            "history.read_all",
            { company_id: options.companyId, kind: "company_shared" },
            (identity) => repository.authorityHistory(identity),
          ),
        dispose() {
          bootstrapCleanup?.();
        },
      };
      return trackAppWork(runtime, [
        "resetDemo",
        "reconcile",
        "reconcileClock",
        "retryHistoryRetirement",
      ]);
    } catch (error) {
      if (bootstrapCleanup) bootstrapCleanup();
      else if (ownsRepository) repository.dispose();
      throw error;
    }
  } finally {
    releaseStartup();
  }
}
