import type {
  AuthenticatedActor,
  AuthorityInvalidation,
  AuthoritySnapshot,
  BusinessCommandResult,
  BusinessSnapshot,
  BusinessState,
  Capability,
  CommandIdentity,
  ResourceScope,
  SystemAttribution,
} from "./authority-types";
import {
  AuthorityError,
  authoritySnapshot,
  bindAuthoritySnapshot,
  resolveActor,
} from "./authority";
import {
  snapshotOf,
  type AuthorityDocument,
  type TransactionResult,
} from "./authority-document";
import { requireCapability } from "./permissions";
import { projectAuthorityHistory } from "./authority-history";
import {
  assertDirectoryLocationSafety,
  reconcileSessionLocationSelections,
} from "./authority-location-invariants";

export const AUTHORITY_DATABASE_NAME = "supermarket-prototype-authority-v1";
const AUTHORITY_STORE = "companies";
const BUSINESS_STORE = "business";
const BACKUP_STORE = "private_backups";
const INVALIDATION_CHANNEL = "supermarket-prototype-authority-events-v1";
const INVALIDATION_STORAGE_KEY = "supermarket-prototype-authority-event-v1";

export type SystemReconciliationSource =
  | "sales_clock"
  | "date_reminders"
  | "return_credit_reminders"
  | "price_updates"
  | "timesheets_migration"
  | "packages_migration";
// Only this repository can mint a system witness, while its synchronous,
// company-scoped transaction callback is active. Plain/spread/retained objects
// never authorize clock or derived-notification writes.
const activeSystemWitnesses = new WeakMap<
  object,
  {
    state: BusinessState;
    source: SystemReconciliationSource;
    directoryVersion: number;
  }
>();
export function requireSystemReconciliation(
  state: BusinessState,
  attribution: SystemAttribution,
  source: SystemReconciliationSource,
): void {
  const witness = activeSystemWitnesses.get(attribution);
  if (
    !witness ||
    witness.state !== state ||
    witness.source !== source ||
    authoritySnapshot(state).directory_version !== witness.directoryVersion
  )
    throw new AuthorityError("authentication");
}

export class AuthorityStorageError extends Error {
  constructor(
    readonly code: "unavailable" | "missing" | "transaction" | "backup",
  ) {
    super(code);
    this.name = "AuthorityStorageError";
  }
}
interface Precheck {
  capability: Capability;
  resource: ResourceScope;
}
interface PrivateBackup {
  id: string;
  company_id: string;
  source_key: string;
  raw: string;
  sha256: string;
  created_at: string;
}
interface BusinessInvalidation {
  company_id: string;
  revision: number;
}

export class BrowserAuthorityRepository {
  private databasePromise?: Promise<IDBDatabase>;
  private database?: IDBDatabase;
  private disposed = false;
  private acceptedOperations = 0;
  private storageTarget?: Window;
  private readonly channelListener = (event: MessageEvent) =>
    this.receive(event.data);
  private readonly storageListener = (event: StorageEvent) => {
    if (event.key !== INVALIDATION_STORAGE_KEY || !event.newValue) return;
    try {
      this.receive(JSON.parse(event.newValue));
    } catch {
      /* Ignore unrelated malformed hints; command still rechecks IDB. */
    }
  };
  private authorityListeners = new Set<
    (event: AuthorityInvalidation) => void
  >();
  private businessListeners = new Set<(event: BusinessInvalidation) => void>();
  private channel?: BroadcastChannel;

  constructor(
    private readonly factory: IDBFactory | undefined = globalThis.indexedDB,
  ) {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(INVALIDATION_CHANNEL);
        this.channel.addEventListener("message", this.channelListener);
      } catch {
        /* Delivery hints are optional; fresh IDB checks remain authoritative. */
      }
    }
    if (typeof window !== "undefined") {
      this.storageTarget = window;
      window.addEventListener("storage", this.storageListener);
    }
  }

  /** Runtime-owned resources only; an injected repository remains caller-owned. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.storageTarget?.removeEventListener("storage", this.storageListener);
    this.storageTarget = undefined;
    this.authorityListeners.clear();
    this.businessListeners.clear();
    if (this.channel) {
      try {
        this.channel.removeEventListener("message", this.channelListener);
        this.channel.close();
      } catch {
        /* A previously closed hint channel cannot invalidate a committed write. */
      }
      this.channel = undefined;
    }
    this.closeDatabaseWhenIdle();
  }

  private closeDatabaseWhenIdle() {
    if (!this.disposed || this.acceptedOperations || !this.database) return;
    this.database.close();
    this.database = undefined;
    this.databasePromise = undefined;
  }

  /** Accept synchronously; disposal drains these operations before closing IDB. */
  private async withDatabase<T>(
    operation: (database: IDBDatabase) => Promise<T>,
  ): Promise<T> {
    if (this.disposed) throw new AuthorityStorageError("unavailable");
    this.acceptedOperations++;
    try {
      return await operation(await this.open());
    } finally {
      this.acceptedOperations--;
      this.closeDatabaseWhenIdle();
    }
  }

  private receive(value: unknown) {
    if (this.disposed || !value || typeof value !== "object") return;
    const message = value as { kind?: string; event?: unknown };
    if (
      message.kind === "authority" &&
      message.event &&
      typeof message.event === "object"
    ) {
      const event = message.event as AuthorityInvalidation;
      if (
        typeof event.company_id !== "string" ||
        typeof event.user_id !== "string" ||
        !Number.isSafeInteger(event.authority_epoch)
      )
        return;
      for (const listener of this.authorityListeners) {
        try {
          listener(event);
        } catch {
          /* Optional notification only. */
        }
      }
    }
    if (
      message.kind === "business" &&
      message.event &&
      typeof message.event === "object"
    ) {
      const event = message.event as BusinessInvalidation;
      if (
        typeof event.company_id !== "string" ||
        !Number.isSafeInteger(event.revision)
      )
        return;
      for (const listener of this.businessListeners) {
        try {
          listener(event);
        } catch {
          /* Optional notification only. */
        }
      }
    }
  }

  private publish(
    kind: "authority" | "business",
    event: AuthorityInvalidation | BusinessInvalidation,
  ) {
    if (this.disposed) return;
    const message = { kind, event };
    this.receive(message);
    try {
      this.channel?.postMessage(message);
    } catch {
      /* Closed/unavailable hints cannot turn a durable commit into a failure. */
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(
          INVALIDATION_STORAGE_KEY,
          JSON.stringify({ ...message, nonce: Math.random() }),
        );
      } catch {
        /* Delivery hint is optional; IDB command checks are authoritative. */
      }
    }
  }
  publishInvalidation(event: AuthorityInvalidation) {
    this.publish("authority", event);
  }
  subscribeInvalidation(listener: (event: AuthorityInvalidation) => void) {
    if (this.disposed) return () => {};
    this.authorityListeners.add(listener);
    return () => {
      this.authorityListeners.delete(listener);
    };
  }
  subscribeBusiness(listener: (event: BusinessInvalidation) => void) {
    if (this.disposed) return () => {};
    this.businessListeners.add(listener);
    return () => {
      this.businessListeners.delete(listener);
    };
  }

  private open(): Promise<IDBDatabase> {
    if (!this.factory)
      return Promise.reject(new AuthorityStorageError("unavailable"));
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = this.factory!.open(AUTHORITY_DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(AUTHORITY_STORE))
          database.createObjectStore(AUTHORITY_STORE, {
            keyPath: "company_id",
          });
        if (!database.objectStoreNames.contains(BUSINESS_STORE))
          database.createObjectStore(BUSINESS_STORE, { keyPath: "company_id" });
        if (!database.objectStoreNames.contains(BACKUP_STORE))
          database.createObjectStore(BACKUP_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => {
        this.database = request.result;
        request.result.onversionchange = () => {
          request.result.close();
          if (this.database === request.result) {
            this.database = undefined;
            this.databasePromise = undefined;
          }
        };
        resolve(request.result);
        this.closeDatabaseWhenIdle();
      };
      request.onerror = () => reject(new AuthorityStorageError("unavailable"));
      request.onblocked = () =>
        reject(new AuthorityStorageError("unavailable"));
    });
    return this.databasePromise;
  }

  async initialize(document: AuthorityDocument): Promise<AuthoritySnapshot> {
    return this.withDatabase(async (database) => {
      return new Promise<AuthoritySnapshot>((resolve, reject) => {
        const transaction = database.transaction(AUTHORITY_STORE, "readwrite");
        const store = transaction.objectStore(AUTHORITY_STORE);
        let actual: AuthorityDocument;
        const request = store.get(document.company_id);
        request.onsuccess = () => {
          actual = request.result ?? structuredClone(document);
          if (!request.result) store.put(actual);
        };
        transaction.oncomplete = () => resolve(snapshotOf(actual));
        transaction.onabort = transaction.onerror = () =>
          reject(new AuthorityStorageError("transaction"));
      });
    });
  }

  async initializeBusiness<TState extends BusinessState>(
    state: TState,
  ): Promise<BusinessSnapshot<TState>> {
    return this.withDatabase(async (database) => {
      const company_id = state.config.company.seed_key;
      return new Promise<BusinessSnapshot<TState>>((resolve, reject) => {
        const transaction = database.transaction(BUSINESS_STORE, "readwrite");
        const store = transaction.objectStore(BUSINESS_STORE);
        let actual: BusinessSnapshot<TState>;
        const request = store.get(company_id);
        request.onsuccess = () => {
          actual = request.result ?? {
            company_id,
            revision: 1,
            state: structuredClone(state),
          };
          if (!request.result) store.put(actual);
        };
        transaction.oncomplete = () => resolve(structuredClone(actual));
        transaction.onabort = transaction.onerror = () =>
          reject(new AuthorityStorageError("transaction"));
      });
    });
  }

  async load(company_id: string): Promise<AuthoritySnapshot> {
    return this.withDatabase(async (database) => {
      return new Promise<AuthoritySnapshot>((resolve, reject) => {
        const transaction = database.transaction(AUTHORITY_STORE, "readonly");
        const request = transaction
          .objectStore(AUTHORITY_STORE)
          .get(company_id);
        request.onsuccess = () =>
          request.result
            ? resolve(snapshotOf(request.result))
            : reject(new AuthorityStorageError("missing"));
        request.onerror = () =>
          reject(new AuthorityStorageError("transaction"));
      });
    });
  }
  async loadBusiness<TState extends BusinessState>(
    company_id: string,
  ): Promise<BusinessSnapshot<TState>> {
    return this.withDatabase(async (database) => {
      return new Promise<BusinessSnapshot<TState>>((resolve, reject) => {
        const transaction = database.transaction(BUSINESS_STORE, "readonly");
        const request = transaction.objectStore(BUSINESS_STORE).get(company_id);
        request.onsuccess = () =>
          request.result
            ? resolve(structuredClone(request.result))
            : reject(new AuthorityStorageError("missing"));
        request.onerror = () =>
          reject(new AuthorityStorageError("transaction"));
      });
    });
  }

  private async locked<T>(
    company_id: string,
    mode: IDBTransactionMode,
    operation: (
      document: AuthorityDocument,
      business: BusinessSnapshot<BusinessState>,
    ) => T,
    writeBusiness: boolean,
  ): Promise<{
    value: T;
    document: AuthorityDocument;
    business: BusinessSnapshot<BusinessState>;
  }> {
    return this.withDatabase(async (database) => {
      return new Promise<{
        value: T;
        document: AuthorityDocument;
        business: BusinessSnapshot<BusinessState>;
      }>((resolve, reject) => {
        const transaction = database.transaction(
          [AUTHORITY_STORE, BUSINESS_STORE],
          mode,
        );
        const authorityStore = transaction.objectStore(AUTHORITY_STORE);
        const businessStore = transaction.objectStore(BUSINESS_STORE);
        const authorityRequest = authorityStore.get(company_id);
        const businessRequest = businessStore.get(company_id);
        let gotAuthority = false,
          gotBusiness = false;
        let document: AuthorityDocument,
          business: BusinessSnapshot<BusinessState>,
          value: T;
        let failure: unknown;
        const operate = () => {
          if (!gotAuthority || !gotBusiness) return;
          try {
            if (
              !document ||
              !business ||
              document.company_id !== company_id ||
              business.state.config.company.seed_key !== company_id
            )
              throw new AuthorityStorageError("missing");
            value = operation(document, business);
            if (value && typeof value === "object" && "then" in value)
              throw new AuthorityStorageError("transaction");
            if (writeBusiness) {
              assertDirectoryLocationSafety(business.state, document);
              reconcileSessionLocationSelections(business.state, document);
            }
            if (mode === "readwrite") authorityStore.put(document);
            if (writeBusiness) businessStore.put(business);
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        };
        authorityRequest.onsuccess = () => {
          document = authorityRequest.result;
          gotAuthority = true;
          operate();
        };
        businessRequest.onsuccess = () => {
          business = businessRequest.result;
          gotBusiness = true;
          operate();
        };
        transaction.oncomplete = () => resolve({ value, document, business });
        transaction.onabort = transaction.onerror = () =>
          reject(failure ?? new AuthorityStorageError("transaction"));
      });
    });
  }

  async transaction<T>(
    company_id: string,
    operation: (
      document: AuthorityDocument,
      currentBusiness: BusinessState,
    ) => T,
  ): Promise<TransactionResult<T>> {
    const result = await this.locked(
      company_id,
      "readwrite",
      (document, business) => operation(document, business.state),
      false,
    );
    return { value: result.value, snapshot: snapshotOf(result.document) };
  }

  async authorityHistory(identity: CommandIdentity, now = new Date()) {
    const result = await this.locked(
      identity.company_id,
      "readonly",
      (document, business) => {
        bindAuthoritySnapshot(business.state, snapshotOf(document));
        const actor = resolveActor(business.state, identity, now);
        requireCapability(
          business.state,
          actor,
          "history.read_all",
          { company_id: identity.company_id, kind: "company_shared" },
          now,
        );
        return projectAuthorityHistory(
          document.audit.filter(
            (event) => event.company_id === identity.company_id,
          ),
        );
      },
      false,
    );
    return result.value;
  }

  async withActor<T>(
    _state: BusinessState,
    identity: CommandIdentity,
    operation: (actor: AuthenticatedActor, snapshot: AuthoritySnapshot) => T,
    now = new Date(),
  ) {
    const result = await this.locked(
      identity.company_id,
      "readwrite",
      (document, business) => {
        const snapshot = snapshotOf(document);
        bindAuthoritySnapshot(business.state, snapshot);
        const actor = resolveActor(business.state, identity, now);
        return { value: operation(actor, snapshot), actor };
      },
      false,
    );
    return {
      value: result.value.value,
      actor: result.value.actor,
      authority_snapshot: snapshotOf(result.document),
    };
  }

  async runBusinessCommand<TState extends BusinessState, TValue>(
    identity: CommandIdentity,
    operation: (draft: TState, actor: AuthenticatedActor) => TValue,
    precheck?: Precheck,
    now = new Date(),
  ): Promise<BusinessCommandResult<TState, TValue>> {
    const result = await this.locked(
      identity.company_id,
      "readwrite",
      (document, business) => {
        const snapshot = snapshotOf(document);
        bindAuthoritySnapshot(business.state, snapshot);
        const actor = resolveActor(business.state, identity, now);
        if (precheck)
          requireCapability(
            business.state,
            actor,
            precheck.capability,
            precheck.resource,
            now,
          );
        const value = operation(business.state as TState, actor);
        business.revision++;
        return value;
      },
      true,
    );
    const business = result.business as BusinessSnapshot<TState>;
    const authority_snapshot = snapshotOf(result.document);
    bindAuthoritySnapshot(business.state, authority_snapshot);
    this.publish("business", {
      company_id: identity.company_id,
      revision: business.revision,
    });
    return { value: result.value, business, authority_snapshot };
  }

  async queryBusiness<TState extends BusinessState, TValue>(
    identity: CommandIdentity,
    project: (state: TState, actor: AuthenticatedActor) => TValue,
    precheck?: Precheck,
    now = new Date(),
  ) {
    const result = await this.locked(
      identity.company_id,
      "readonly",
      (document, business) => {
        bindAuthoritySnapshot(business.state, snapshotOf(document));
        const actor = resolveActor(business.state, identity, now);
        if (precheck)
          requireCapability(
            business.state,
            actor,
            precheck.capability,
            precheck.resource,
            now,
          );
        return project(business.state as TState, actor);
      },
      false,
    );
    return {
      value: result.value,
      business_revision: result.business.revision,
      authority_snapshot: snapshotOf(result.document),
    };
  }

  async runSystemReconciliation<TState extends BusinessState, TValue>(
    company_id: string,
    source: SystemReconciliationSource,
    reconcile: (state: TState, attribution: SystemAttribution) => TValue,
    now = new Date(),
  ): Promise<BusinessCommandResult<TState, TValue>> {
    const sources = new Set([
      "sales_clock",
      "date_reminders",
      "return_credit_reminders",
      "price_updates",
      "timesheets_migration",
      "packages_migration",
    ]);
    if (!sources.has(source)) throw new AuthorityStorageError("transaction");
    const result = await this.locked(
      company_id,
      "readwrite",
      (document, business) => {
        bindAuthoritySnapshot(business.state, snapshotOf(document));
        const attribution: SystemAttribution = Object.freeze({
          kind: "system",
          source_event_id: `${source}:${now.toISOString()}`,
          applied_at: now.toISOString(),
        });
        activeSystemWitnesses.set(attribution, {
          state: business.state,
          source,
          directoryVersion: document.directory_version,
        });
        try {
          const value = reconcile(business.state as TState, attribution);
          business.revision++;
          return value;
        } finally {
          activeSystemWitnesses.delete(attribution);
        }
      },
      true,
    );
    const business = result.business as BusinessSnapshot<TState>;
    const authority_snapshot = snapshotOf(result.document);
    bindAuthoritySnapshot(business.state, authority_snapshot);
    this.publish("business", { company_id, revision: business.revision });
    return { value: result.value, business, authority_snapshot };
  }

  async archivePrivateBackup(
    backup: PrivateBackup,
    hash: (raw: string) => string,
  ): Promise<void> {
    if (hash(backup.raw) !== backup.sha256)
      throw new AuthorityStorageError("backup");
    return this.withDatabase(async (database) => {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(BACKUP_STORE, "readwrite");
        transaction.objectStore(BACKUP_STORE).put(structuredClone(backup));
        transaction.oncomplete = () => resolve();
        transaction.onabort = transaction.onerror = () =>
          reject(new AuthorityStorageError("backup"));
      });
      const retained = await new Promise<PrivateBackup>((resolve, reject) => {
        const request = database
          .transaction(BACKUP_STORE, "readonly")
          .objectStore(BACKUP_STORE)
          .get(backup.id);
        request.onsuccess = () =>
          request.result
            ? resolve(request.result)
            : reject(new AuthorityStorageError("backup"));
        request.onerror = () => reject(new AuthorityStorageError("backup"));
      });
      if (retained.raw !== backup.raw || hash(retained.raw) !== backup.sha256)
        throw new AuthorityStorageError("backup");
    });
  }

  /** Explicit Demo Reset only; same lock checks current authority and replaces business+six fixtures. */
  async resetDemo<TState extends BusinessState>(
    identity: CommandIdentity,
    state: TState,
    replacement: AuthorityDocument,
    now = new Date(),
  ): Promise<BusinessCommandResult<TState, void>> {
    const resetUserEpochs = new Map<string, number>();
    const expectedIds = new Set([
      "demo-person-owner",
      "demo-person-manager",
      "demo-person-rh-supervisor",
      "demo-person-ny-floor",
      "demo-person-wh-floor",
      "demo-person-cashier",
    ]);
    if (
      replacement.company_id !== identity.company_id ||
      state.config.company.seed_key !== identity.company_id ||
      replacement.people.length !== 6 ||
      replacement.people.some(
        (person) =>
          !expectedIds.has(person.id) ||
          !person.demo_fixture ||
          person.status !== "active" ||
          !person.setup.password_complete ||
          !person.setup.second_step_complete,
      ) ||
      new Set(replacement.people.map((person) => person.id)).size !== 6 ||
      replacement.sessions.length ||
      replacement.setup_challenges.length
    )
      throw new AuthorityStorageError("transaction");
    const result = await this.locked(
      identity.company_id,
      "readwrite",
      (document, business) => {
        bindAuthoritySnapshot(business.state, snapshotOf(document));
        const actor = resolveActor(business.state, identity, now);
        requireCapability(
          business.state,
          actor,
          "demo.reset",
          {
            company_id: identity.company_id,
            kind: "company_shared",
            mutation: true,
          },
          now,
        );
        const next = structuredClone(replacement);
        for (const previous of document.people)
          resetUserEpochs.set(previous.id, previous.authority_epoch + 1);
        next.directory_version = document.directory_version + 1;
        for (const person of next.people)
          person.authority_epoch = Math.max(
            person.authority_epoch,
            (document.people.find((previous) => previous.id === person.id)
              ?.authority_epoch ?? 0) + 1,
          );
        next.authentication_audit = [
          {
            id: `demo-reset:${now.toISOString()}`,
            company_id: identity.company_id,
            user_id: actor.user_id,
            action: "Reset demo",
            at: now.toISOString(),
            device_id: actor.device_id,
          },
        ];
        Object.assign(document, next);
        business.state = structuredClone(state);
        business.revision++;
      },
      true,
    );
    const authority_snapshot = snapshotOf(result.document);
    const business = result.business as BusinessSnapshot<TState>;
    bindAuthoritySnapshot(business.state, authority_snapshot);
    for (const person of authority_snapshot.people)
      resetUserEpochs.set(person.id, person.authority_epoch);
    for (const [user_id, authority_epoch] of resetUserEpochs)
      this.publishInvalidation({
        company_id: identity.company_id,
        user_id,
        authority_epoch,
        directory_version: authority_snapshot.directory_version,
        reason: "demo_reset",
      });
    this.publish("business", {
      company_id: identity.company_id,
      revision: business.revision,
    });
    return { value: result.value, business, authority_snapshot };
  }
}
