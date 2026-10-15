import { trackAppWork } from "./app-work";
import type {
  AuthenticatedActor,
  BusinessState,
  Capability,
  CommandIdentity,
  ResourceScope,
  SignInResult,
  LocationSelection,
  AuthenticationService,
  TransactionalBusinessRepository,
  PeopleDirectoryRow,
  PersonRecord,
} from "./authority-types";
import {
  bindAuthoritySnapshot,
  resolveActor,
  cloneWithAuthority,
} from "./authority";
import { can as permission } from "./permissions";

function immutableView<T>(value: T): T {
  const copied = structuredClone(value);
  const freeze = (item: unknown) => {
    if (item === null || typeof item !== "object" || Object.isFrozen(item))
      return;
    for (const child of Object.values(item)) freeze(child);
    Object.freeze(item);
  };
  freeze(copied);
  return copied;
}
export class DiscardedSessionResult extends Error {
  readonly code = "session_changed";
  constructor() {
    super("session_changed");
  }
}
export interface ShellSnapshot<View> {
  view: View;
  actor: AuthenticatedActor | null;
  person: PeopleDirectoryRow | null;
  secondStepMethod: "passkey" | "authenticator" | null;
  stage: SignInResult["next"] | "signed_out" | "loading";
  revision: number;
  directoryVersion: number;
  generation: number;
}
interface Dependencies<State extends BusinessState, View> {
  companyId: string;
  repository: TransactionalBusinessRepository;
  authentication: AuthenticationService;
  /** Central projection only: never return or spread the entire canonical state. */
  projectView: (state: State, actor: AuthenticatedActor | null) => View;
  signedOutView: () => View;
  persistIdentity: (identity: CommandIdentity | null) => void;
  publish: (snapshot: ShellSnapshot<View>) => void;
  /** Existing reversal/notification preparation remains inside the command txn. */
  prepareCommit?: (
    draft: State,
    before: State,
    actor: AuthenticatedActor,
  ) => void;
  onCommitted?: (
    before: State,
    after: State,
    actor: AuthenticatedActor,
  ) => void;
  /** Derived work uses a separate real repository witness after the user txn commits. */
  reconcileAfterCommit?: () => Promise<void>;
  reportReconciliationError?: (error: unknown) => void;
}

/** Canonical snapshots and session identity are closure-private, never React props. */
export function createE1StoreController<State extends BusinessState, View>(
  deps: Dependencies<State, View>,
) {
  let identity: CommandIdentity | null = null;
  let actor: AuthenticatedActor | null = null;
  let person: PeopleDirectoryRow | null = null;
  let secondStepMethod: "passkey" | "authenticator" | null = null;
  let canonical: State | null = null;
  let generation = 0;
  let revision = 0;
  let directoryVersion = 0;
  let stage: ShellSnapshot<View>["stage"] = "signed_out";
  let queue: Promise<unknown> = Promise.resolve();
  let authIntent = 0;
  let disposed = false;
  const isThenable = (value: unknown) =>
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value;
  const current = (captured: CommandIdentity, version: number) =>
    identity?.company_id === captured.company_id &&
    identity.session_id === captured.session_id &&
    generation === version;
  const requireIdentity = () => {
    if (disposed || !identity || stage !== "complete" || !actor)
      throw new DiscardedSessionResult();
    return { ...identity };
  };
  const publishSignedOut = () =>
    deps.publish({
      view: immutableView(deps.signedOutView()),
      actor: null,
      person,
      secondStepMethod,
      stage,
      revision,
      directoryVersion,
      generation,
    });
  const safePerson = (raw: PersonRecord): PeopleDirectoryRow => ({
    id: raw.id,
    company_id: raw.company_id,
    name_en: raw.name_en,
    name_fa: raw.name_fa,
    username: raw.username,
    phone: raw.phone,
    email: raw.email,
    role: raw.role,
    location_scope: raw.location_scope,
    status: raw.status,
    version: raw.version,
    last_sign_in_at: raw.last_sign_in_at,
  });
  async function refresh(captured = identity, version = generation) {
    if (!captured || stage !== "complete") {
      publishSignedOut();
      return;
    }
    const result = await deps.repository.queryBusiness<
      State,
      { view: View; actor: AuthenticatedActor; canonical: State }
    >(captured, (state, freshActor) => ({
      view: immutableView(deps.projectView(state, freshActor)),
      actor: freshActor,
      canonical: state,
    }));
    if (!current(captured, version)) throw new DiscardedSessionResult();
    if (result.business_revision < revision) return;
    actor = result.value.actor;
    canonical = result.value.canonical;
    const currentPerson = result.authority_snapshot.people.find(
      (value) => value.id === actor?.user_id,
    );
    person = currentPerson ? safePerson(currentPerson) : null;
    bindAuthoritySnapshot(canonical, result.authority_snapshot);
    revision = result.business_revision;
    directoryVersion = result.authority_snapshot.directory_version;
    deps.publish({
      view: result.value.view,
      actor,
      person,
      secondStepMethod,
      stage,
      revision,
      directoryVersion,
      generation,
    });
  }
  async function adopt(result: SignInResult | null) {
    generation++;
    canonical = null;
    actor = null;
    identity = result?.identity ?? null;
    person = result ? safePerson(result.person) : null;
    secondStepMethod = result?.person.setup.second_step_method ?? null;
    stage = result?.next ?? "signed_out";
    deps.persistIdentity(identity);
    if (!result || stage !== "complete") {
      publishSignedOut();
      return;
    }
    const version = generation,
      captured = { ...result.identity };
    try {
      await refresh(captured, version);
    } catch (error) {
      if (current(captured, version)) {
        identity = null;
        person = null;
        actor = null;
        canonical = null;
        secondStepMethod = null;
        stage = "signed_out";
        generation++;
        deps.persistIdentity(null);
        publishSignedOut();
      }
      throw error;
    }
  }
  async function recoverInvalidSession(
    error: unknown,
    captured: CommandIdentity,
    version: number,
  ) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (
      !current(captured, version) ||
      !["authentication", "revoked", "setup"].includes(code)
    )
      return;
    actor = null;
    canonical = null;
    generation++;
    publishSignedOut();
    await adopt(await deps.authentication.resume(captured));
  }
  async function authenticatedTransition(
    operation: (captured: CommandIdentity) => Promise<SignInResult>,
  ) {
    if (!identity) throw new DiscardedSessionResult();
    const captured = { ...identity },
      version = generation;
    let result;
    try {
      result = await operation(captured);
    } catch (error) {
      if (current(captured, version)) {
        const resumed = await deps.authentication.resume(captured);
        if (current(captured, version) && (!resumed || resumed.next !== stage))
          await adopt(resumed);
      }
      throw error;
    }
    if (!current(captured, version)) throw new DiscardedSessionResult();
    await adopt(result);
  }

  const scoped = (resource?: ResourceScope): ResourceScope =>
    resource ?? { company_id: deps.companyId, kind: "company_shared" };
  async function revokeSession(endedIdentity: CommandIdentity) {
    try {
      await deps.authentication.signOut(endedIdentity);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      // Local sign-out is complete even when another authority action already
      // revoked this exact SID. Persistence failures remain visible failures.
      if (!["invalid", "revoked", "authentication"].includes(code)) throw error;
    }
  }
  const controller = {
    async resume(saved: CommandIdentity | null) {
      if (disposed) throw new DiscardedSessionResult();
      const intent = ++authIntent;
      const result = saved ? await deps.authentication.resume(saved) : null;
      if (intent === authIntent) await adopt(result);
    },
    async signIn(username: string, password: string, device_id?: string) {
      if (disposed) throw new DiscardedSessionResult();
      const intent = ++authIntent;
      identity = null;
      actor = null;
      canonical = null;
      person = null;
      generation++;
      // Keep the interactive SignIn instance mounted so it owns its input/error
      // state. Initial bootstrap loading is still owned by the Provider.
      stage = "signed_out";
      deps.persistIdentity(null);
      publishSignedOut();
      try {
        const result = await deps.authentication.signIn({
          company_id: deps.companyId,
          username,
          password_or_setup_code: password,
          device_id,
        });
        if (intent !== authIntent) {
          await revokeSession(result.identity);
          throw new DiscardedSessionResult();
        }
        await adopt(result);
      } catch (error) {
        if (intent === authIntent) {
          stage = "signed_out";
          publishSignedOut();
        }
        throw error;
      }
    },
    async switchDemoUser(username: string) {
      if (disposed) throw new DiscardedSessionResult();
      const intent = ++authIntent,
        old = identity;
      identity = null;
      actor = null;
      canonical = null;
      person = null;
      generation++;
      stage = "loading";
      publishSignedOut();
      try {
        let failure: unknown;
        try {
          deps.persistIdentity(null);
        } catch (error) {
          failure = error;
        }
        // A failed local write cannot retain the previous visible records or
        // skip ending the old genuine SID, and must not issue a new session.
        try {
          if (old) await revokeSession(old);
        } catch (error) {
          failure ??= error;
        }
        if (failure) throw failure;
        const result = await deps.authentication.switchDemoUser(
          deps.companyId,
          username,
        );
        if (intent !== authIntent) {
          await revokeSession(result.identity);
          throw new DiscardedSessionResult();
        }
        await adopt(result);
      } catch (error) {
        if (intent === authIntent) {
          stage = "signed_out";
          publishSignedOut();
        }
        throw error;
      }
    },
    async choosePassword(password: string) {
      await authenticatedTransition((captured) =>
        deps.authentication.choosePassword(captured, password),
      );
    },
    async setupSecondStep(method: "passkey" | "authenticator") {
      await authenticatedTransition((captured) =>
        deps.authentication.setupSecondStep(captured, method),
      );
    },
    async completeSecondStep(response: string) {
      await authenticatedTransition((captured) =>
        deps.authentication.completeSecondStep(captured, response),
      );
    },
    async unlock(password: string) {
      await authenticatedTransition((captured) =>
        deps.authentication.unlock(captured, password),
      );
    },
    async reauthenticate(password: string) {
      await authenticatedTransition((captured) =>
        deps.authentication.reauthenticate(captured, password),
      );
    },
    async lock() {
      if (disposed) return;
      authIntent++;
      if (!identity) return;
      const captured = { ...identity };
      // A privacy lock clears this computer's visible records immediately,
      // even when durable storage later reports a failure.
      actor = null;
      canonical = null;
      stage = "locked";
      generation++;
      publishSignedOut();
      const version = generation;
      try {
        await deps.authentication.lock(captured);
      } catch (error) {
        await recoverInvalidSession(error, captured, version);
        throw error;
      }
    },
    async signOut() {
      if (disposed) return;
      authIntent++;
      const old = identity;
      identity = null;
      actor = null;
      person = null;
      canonical = null;
      stage = "signed_out";
      generation++;
      publishSignedOut();
      let failure: unknown;
      try {
        deps.persistIdentity(null);
      } catch (error) {
        failure = error;
      }
      // Clearing the presentation and ending the actual SID are independent
      // obligations; a failed sessionStorage write must not skip revocation.
      try {
        if (old) await revokeSession(old);
      } catch (error) {
        failure ??= error;
      }
      if (failure) throw failure;
    },
    async setLocation(selection: LocationSelection) {
      authIntent++;
      if (!identity) throw new DiscardedSessionResult();
      const captured = { ...identity },
        version = generation;
      await deps.authentication.setLocation(captured, selection);
      if (!current(captured, version)) throw new DiscardedSessionResult();
      const result = await deps.authentication.resume(captured);
      if (!current(captured, version)) throw new DiscardedSessionResult();
      await adopt(result);
    },
    permission(capability: Capability, resource?: ResourceScope) {
      return canonical && actor && stage === "complete"
        ? permission(canonical, actor, capability, scoped(resource))
        : { allowed: false, reason: "authentication" as const };
    },
    async command<T>(
      capability: Capability,
      resource: ResourceScope,
      mutate: (draft: State, actor: AuthenticatedActor) => T,
    ): Promise<T> {
      const captured = requireIdentity(),
        version = generation;
      const run = async () => {
        if (!current(captured, version)) throw new DiscardedSessionResult();
        let beforeCommitted: State | null = null;
        const result = await deps.repository.runBusinessCommand<State, T>(
          captured,
          (draft, freshActor) => {
            const before = cloneWithAuthority(draft);
            beforeCommitted = before;
            const value = mutate(draft, freshActor);
            if (isThenable(value))
              throw new Error("async_transaction_callback");
            deps.prepareCommit?.(draft, before, freshActor);
            return value;
          },
          { capability, resource },
        );
        if (!current(captured, version)) throw new DiscardedSessionResult();
        canonical = result.business.state;
        bindAuthoritySnapshot(canonical, result.authority_snapshot);
        actor = resolveActor(canonical, captured);
        if (beforeCommitted)
          deps.onCommitted?.(beforeCommitted, canonical, actor);
        try {
          await deps.reconcileAfterCommit?.();
        } catch (error) {
          // The accepted user transaction remains committed. Surface the
          // separate derived-job failure without rejecting its saved result.
          try {
            deps.reportReconciliationError?.(error);
          } catch {
            // An observer failure cannot undo or reject the accepted commit.
          }
        }
        await refresh(captured, version);
        return result.value;
      };
      const next = queue.then(run, run).catch(async (error) => {
        await recoverInvalidSession(error, captured, version);
        throw error;
      });
      queue = next.catch(() => undefined);
      return next;
    },
    async query<T>(
      capability: Capability,
      resource: ResourceScope,
      project: (state: State, actor: AuthenticatedActor) => T,
    ): Promise<T> {
      const captured = requireIdentity(),
        version = generation;
      let result;
      try {
        result = await deps.repository.queryBusiness<State, T>(
          captured,
          (state, freshActor) => {
            const value = project(state, freshActor);
            if (isThenable(value))
              throw new Error("async_transaction_callback");
            return value;
          },
          { capability, resource },
        );
      } catch (error) {
        await recoverInvalidSession(error, captured, version);
        throw error;
      }
      if (!current(captured, version)) throw new DiscardedSessionResult();
      return result.value;
    },
    /** Read-only service results never republish a snapshot or trigger a read loop. */
    async authorityRead<T>(
      capability: Capability,
      resource: ResourceScope,
      operation: (currentIdentity: CommandIdentity) => Promise<T>,
    ): Promise<T> {
      const captured = requireIdentity(),
        version = generation;
      try {
        // The service performs its actual scoped read against the repository.
        const value = await operation(captured);
        if (!current(captured, version)) throw new DiscardedSessionResult();
        // Recheck current persisted authority after the asynchronous read, even
        // if a cross-tab notification was missed. Keep the returned DTO private
        // until its capability and the captured local intent still match.
        await deps.repository.queryBusiness<State, undefined>(
          captured,
          () => undefined,
          { capability, resource },
        );
        if (!current(captured, version)) throw new DiscardedSessionResult();
        return value;
      } catch (error) {
        await recoverInvalidSession(error, captured, version);
        throw error;
      }
    },
    /** Private mutation service seam; identity never enters React Context. */
    async authorityAction<T>(
      operation: (currentIdentity: CommandIdentity) => Promise<T>,
    ): Promise<T> {
      const captured = requireIdentity(),
        version = generation;
      try {
        const value = await operation(captured);
        if (!current(captured, version)) throw new DiscardedSessionResult();
        await refresh(captured, version);
        return value;
      } catch (error) {
        await recoverInvalidSession(error, captured, version);
        throw error;
      }
    },
    async restartOwnSetup(
      operation: (currentIdentity: CommandIdentity) => Promise<{
        person: PersonRecord;
        one_time_setup_code: string;
      }>,
      device_id?: string,
    ): Promise<PeopleDirectoryRow> {
      const captured = requireIdentity(),
        userId = actor!.user_id,
        intent = ++authIntent;
      // The reset transaction intentionally revokes this SID. Only a later
      // explicit user intent cancels the private credential relay.
      const reset = await operation(captured);
      if (intent !== authIntent) throw new DiscardedSessionResult();
      if (
        reset.person.id !== userId ||
        reset.person.company_id !== captured.company_id
      )
        throw new DiscardedSessionResult();
      let result: SignInResult;
      try {
        result = await deps.authentication.signIn({
          company_id: captured.company_id,
          username: reset.person.username,
          password_or_setup_code: reset.one_time_setup_code,
          device_id,
        });
      } catch (error) {
        if (intent === authIntent) {
          identity = null;
          actor = null;
          canonical = null;
          person = null;
          secondStepMethod = null;
          stage = "signed_out";
          generation++;
          deps.persistIdentity(null);
          publishSignedOut();
        }
        throw error;
      }
      if (intent !== authIntent) {
        await revokeSession(result.identity);
        throw new DiscardedSessionResult();
      }
      if (result.person.id !== userId || result.next !== "password") {
        await revokeSession(result.identity);
        throw new DiscardedSessionResult();
      }
      await adopt(result);
      return safePerson(result.person);
    },
    async resetDemo(
      operation: (currentIdentity: CommandIdentity) => Promise<string | void>,
    ) {
      const captured = requireIdentity(),
        username = actor!.username,
        intent = ++authIntent;
      const resetUsername = await operation(captured);
      if (intent !== authIntent) throw new DiscardedSessionResult();
      await adopt(
        await deps.authentication.switchDemoUser(
          deps.companyId,
          resetUsername ?? username,
        ),
      );
    },
    async invalidate() {
      if (disposed) return;
      const captured = identity;
      generation++;
      actor = null;
      canonical = null;
      publishSignedOut();
      const version = generation;
      if (captured) {
        const result = await deps.authentication.resume(captured);
        if (current(captured, version)) await adopt(result);
      }
    },
    async refresh() {
      if (disposed) throw new DiscardedSessionResult();
      const captured = identity,
        version = generation;
      try {
        await refresh(captured, version);
      } catch (error) {
        if (captured) await recoverInvalidSession(error, captured, version);
        throw error;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      authIntent++;
      generation++;
      identity = null;
      actor = null;
      canonical = null;
      person = null;
      secondStepMethod = null;
      stage = "signed_out";
      // Keep the persisted genuine SID for the replacement provider/remount.
    },
  };
  return trackAppWork(controller, [
    "resume",
    "signIn",
    "switchDemoUser",
    "choosePassword",
    "setupSecondStep",
    "completeSecondStep",
    "unlock",
    "reauthenticate",
    "lock",
    "signOut",
    "setLocation",
    "command",
    "query",
    "authorityRead",
    "authorityAction",
    "restartOwnSetup",
    "resetDemo",
    "invalidate",
    "refresh",
  ]);
}
