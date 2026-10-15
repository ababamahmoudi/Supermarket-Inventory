/** Proposed E1 facade. Preparation only; no tracked C8 files are changed. */
export type RoleId =
  "owner" | "manager" | "branch_supervisor" | "floor_worker" | "cashier";

export type LocationScope =
  { kind: "company" } | { kind: "assigned"; location_ids: readonly string[] };
export type LocationSelection =
  | { kind: "location"; location_id: string }
  | { kind: "all_my_locations" }
  | { kind: "all_locations" };

/** Callers supply a session identity, never their own role or scope claims. */
export interface CommandIdentity {
  company_id: string;
  session_id: string;
}

declare const resolvedByAuthority: unique symbol;
/** Only authority.ts constructs this object. A runtime WeakSet also brands it. */
export interface AuthenticatedActor {
  readonly [resolvedByAuthority]: true;
  readonly company_id: string;
  readonly user_id: string;
  readonly session_id: string;
  readonly device_id?: string;
  readonly username: string;
  readonly role: RoleId;
  /** Retained History-compatible display snapshot, never the identity key. */
  readonly actor: string;
  readonly name_en: string;
  readonly name_fa?: string;
  readonly authority_epoch: number;
  readonly person_version: number;
  readonly authenticated_at: string;
  readonly second_step_verified_at?: string;
  readonly location_scope: LocationScope;
  readonly selection: LocationSelection;
  /** Aggregate is display-only. Concrete writes must choose an allowed branch. */
  readonly branch: string;
  readonly allowed_branches: readonly string[];
}

export interface ResourceScope {
  company_id: string;
  /** A shared catalog object has no location IDs; its action targets still do. */
  kind: "company_shared" | "location_record" | "request_endpoints";
  location_ids?: readonly string[];
  owner_user_id?: string;
  handling_user_ids?: readonly string[];
  /** Canonical unposted invoice reviewer-origin exception for Floor Worker only. */
  invoice_reviewer_origin_location_id?: string;
  entity_id?: string;
  status?: string;
  version?: number;
  /** A concrete write must never resolve an aggregate to the first location. */
  mutation?: boolean;
  /** Derived by the domain from retained records, never trusted from form input. */
  location_policy?: "active_only" | "retained_read" | "retained_correction";
}
export interface PermissionDecision {
  allowed: boolean;
  reason?:
    | "authentication"
    | "setup"
    | "revoked"
    | "company"
    | "location"
    | "capability"
    | "inactive_location"
    | "ownership"
    | "state"
    | "freshness";
}

export type Capability =
  | "lookup.read"
  | "catalog.read"
  | "catalog.edit"
  | "catalog.create_active"
  | "catalog.cost_read"
  | "catalog.tracking_preference_edit"
  | "pricing.margin_read"
  | "pricing.propose_manual"
  | "pricing.regular_manage"
  | "dashboard.company"
  | "dashboard.location"
  | "invoices.read"
  | "invoices.enter"
  | "invoices.enter_manual"
  | "invoices.edit"
  | "invoices.post"
  | "invoices.cost_read"
  | "invoices.attach_posted_original"
  | "invoices.short_resolve"
  | "invoices.short_close"
  | "invoices.assign_receiving_location"
  | "invoices.assign_reviewer"
  | "invoices.product_propose"
  | "invoices.supplier_propose"
  | "invoices.correct"
  | "invoices.relocate"
  | "received.read"
  | "lookup.receipt_hint"
  | "supplier_items.read"
  | "supplier_items.cost_read"
  | "supplier_items.manage"
  | "suppliers.read"
  | "suppliers.manage"
  | "suppliers.confirm"
  | "supplier_balances.read"
  | "payables.read"
  | "payables.write"
  | "payables.opening_balance_write"
  | "orders.read"
  | "orders.write"
  | "orders.cost_read"
  | "returns.read"
  | "returns.create"
  | "returns.pickup_record"
  | "returns.pickup_correct"
  | "returns.credit_post"
  | "returns.financial_cancel_review"
  | "returns.operational_resolve"
  | "returns.amount_read"
  | "labels.read"
  | "labels.queue_write"
  | "labels.print"
  | "labels.templates_create"
  | "labels.templates_edit"
  | "labels.templates_archive"
  | "labels.calibrate"
  | "labels.settings_manage"
  | "dates.read"
  | "dates.add"
  | "dates.remove"
  | "dates.reuse_safe_hint"
  | "lots.read"
  | "lots.cost_read"
  | "notebooks.read"
  | "notebooks.entry_add"
  | "notebooks.entry_edit_own"
  | "notebooks.entry_edit_any"
  | "notebooks.definition_manage"
  | "notes.status_manage"
  | "notes.read"
  | "notes.entry_add"
  | "notes.operational_status"
  | "branch_requests.read"
  | "branch_requests.send"
  | "branch_requests.receive"
  | "approvals.read"
  | "approvals.decide"
  | "sales.read"
  | "sales.manage"
  | "sales.request"
  | "sales.request_edit_own"
  | "sales.request_withdraw_own"
  | "sales.delivery_hold"
  | "sales.cost_alert_decide"
  | "alerts.read"
  | "alerts.decide"
  | "offers.read"
  | "offers.multibuy_manage"
  | "offers.clearance_create"
  | "history.read_all"
  | "history.read_own"
  | "history.undo_own"
  | "history.revert"
  | "settings.manage"
  | "people.read"
  | "people.manage"
  | "devices.manage"
  | "notifications.read"
  | "notifications.mark_read"
  | "notifications.settings_manage"
  | "price_updates.read"
  | "price_updates.register_confirm"
  | "price_updates.label_confirm"
  | "price_updates.complete"
  | "demo.reset";

export interface PersonRecord {
  id: string;
  company_id: string;
  name_en: string;
  name_fa?: string;
  username: string;
  aliases: string[];
  phone?: string;
  email?: string;
  role: RoleId;
  location_scope: LocationScope;
  status: "invited" | "active" | "deactivated";
  setup: {
    password_complete: boolean;
    second_step_complete: boolean;
    second_step_method?: "passkey" | "authenticator";
    simulated: boolean;
  };
  authority_epoch: number;
  version: number;
  last_sign_in_at?: string;
  created_at: string;
  created_by_user_id: string;
  /** Fixture shortcut is allowed only for these six configured complete users. */
  demo_fixture?: boolean;
}
export interface SessionRecord {
  id: string;
  company_id: string;
  user_id: string;
  authority_epoch: number;
  state:
    | "setup"
    | "second_step_challenge"
    | "location_required"
    | "active"
    | "locked"
    | "revoked";
  authenticated_at: string;
  second_step_verified_at?: string;
  selected_location: LocationSelection | null;
  device_id?: string;
  revoked_at?: string;
}
/** Credentials/challenges/sessions are not exported in business backups/History. */
export interface AuthoritySnapshot {
  version: 1;
  company_id: string;
  directory_version: number;
  people: readonly PersonRecord[];
  sessions: readonly SessionRecord[];
  devices: readonly RegisteredDevice[];
}
export interface RegisteredDevice {
  id: string;
  company_id: string;
  name: string;
  location_id: string;
  active: boolean;
  version: number;
  registered_at: string;
  registered_by_user_id: string;
}
export interface BusinessState {
  config: {
    company: { seed_key: string };
    branches: readonly {
      id?: string;
      name_en?: string;
      code: string;
      active?: boolean;
      type?: "store" | "warehouse";
      sells_to_customers?: boolean;
    }[];
    orders?: { allow_floor_worker: boolean };
    price_updates?: { allow_floor_worker_complete: boolean };
    session?: { reprompt_password_after_minutes: number };
  };
}

/** Bind snapshots through a module-private WeakMap; never embed sessions in DemoState. */
export declare function bindAuthoritySnapshot<T extends BusinessState>(
  state: T,
  snapshot: AuthoritySnapshot,
): T;
/** Fail closed when source has no binding; preserve private binding for clones. */
export declare function cloneWithAuthority<T extends BusinessState>(
  state: T,
): T;
export declare function inheritAuthoritySnapshot<T extends BusinessState>(
  source: BusinessState,
  target: T,
): T;
export declare function resolveActor(
  state: BusinessState,
  identity: CommandIdentity,
  now?: Date,
): AuthenticatedActor;
/** Re-scope an actual current actor; never spread-copy a branded context. */
export declare function actorAtLocation(
  state: BusinessState,
  actor: AuthenticatedActor,
  location_id: string,
): AuthenticatedActor;
export interface DirectoryRecipient {
  user_id: string;
  company_id: string;
  username: string;
  name_en: string;
  name_fa?: string;
  role: RoleId;
  allowed_branches: readonly string[];
}
/** Active assigned people can receive events without having a signed-in session. */
export declare function directoryRecipients(
  state: BusinessState,
  filter?: {
    capability?: Capability;
    roles?: readonly RoleId[];
    location_ids?: readonly string[];
  },
): readonly DirectoryRecipient[];
export interface DecisionAttribution {
  user_id: string;
  company_id: string;
  username: string;
  name_snapshot: string;
  role_snapshot: RoleId;
  device_id?: string;
  at: string;
}
export declare function decisionAttribution(
  state: BusinessState,
  actor: AuthenticatedActor,
  now?: Date,
): DecisionAttribution;
export interface SystemAttribution {
  kind: "system";
  source_event_id: string;
  source_decision?: DecisionAttribution;
  applied_at: string;
}
export type SystemReconciliationSource =
  | "sales_clock"
  | "date_reminders"
  | "return_credit_reminders"
  | "price_updates";
/** Requires an active repository-minted witness bound to this exact canonical draft. */
export declare function requireSystemReconciliation(
  state: BusinessState,
  attribution: SystemAttribution,
  source: SystemReconciliationSource,
): void;
/** Re-resolves the branded actor from the bound current directory/session. */
export declare function can(
  state: BusinessState,
  actor: AuthenticatedActor | null,
  capability: Capability,
  resource?: ResourceScope,
  now?: Date,
): PermissionDecision;
export declare function requireCapability(
  state: BusinessState,
  actor: AuthenticatedActor,
  capability: Capability,
  resource?: ResourceScope,
  now?: Date,
): void;
export declare function allowedLocationIds(
  state: BusinessState,
  actor: AuthenticatedActor,
  options?: { includeInactive?: boolean; sellingOnly?: boolean },
): readonly string[];
export declare function resolveLocationSelection(
  state: BusinessState,
  actor: AuthenticatedActor,
  selection: LocationSelection,
  options?: { includeInactive?: boolean; sellingOnly?: boolean },
): readonly string[];
export declare function requireConcreteLocation(
  state: BusinessState,
  actor: AuthenticatedActor,
  location_id?: string,
): string;

export interface CommandRequest<TInput> {
  identity: CommandIdentity;
  input: TInput;
  request_id: string;
  expected_version?: number;
}
export interface CommandResult<T> {
  value: T;
  actor: AuthenticatedActor;
  authority_snapshot: AuthoritySnapshot;
}
export interface AuthorityRepository {
  /** Close runtime-owned resources; accepted operations finish, new calls fail closed. */
  dispose(): void;
  load(company_id: string): Promise<AuthoritySnapshot>;
  /** Protected projection from private authority audit, never credentials/setup/session data. */
  authorityHistory(
    identity: CommandIdentity,
    now?: Date,
  ): Promise<readonly AuthorityHistoryEntry[]>;
  /** Callback is synchronous: IDB cannot stay active across arbitrary await. */
  withActor<T>(
    state: BusinessState,
    identity: CommandIdentity,
    operation: (actor: AuthenticatedActor, snapshot: AuthoritySnapshot) => T,
    now?: Date,
  ): Promise<CommandResult<T>>;
  subscribeInvalidation(
    listener: (event: AuthorityInvalidation) => void,
  ): () => void;
}
export interface AuthorityHistoryEntry {
  id: string;
  company_id: string;
  actor_user_id: string;
  actor_role_snapshot: RoleId;
  actor_name_snapshot: string;
  device_id?: string;
  entity_type: "person" | "device";
  entity_id: string;
  action: string;
  reason: string;
  at: string;
  /** Only public business-relevant identity/status/assignment fields, never private setup. */
  before: AuthorityHistorySummary | null;
  after: AuthorityHistorySummary;
  reversible: false;
}
export type AuthorityHistorySummary =
  | {
      kind: "person";
      id: string;
      name_en: string;
      name_fa?: string;
      username: string;
      role: RoleId;
      location_scope: LocationScope;
      status: PersonRecord["status"];
    }
  | {
      kind: "device";
      id: string;
      name: string;
      location_id: string;
      active: boolean;
    };
export interface BusinessSnapshot<TState extends BusinessState> {
  company_id: string;
  revision: number;
  state: TState;
}
export interface BusinessCommandResult<TState extends BusinessState, TValue> {
  value: TValue;
  business: BusinessSnapshot<TState>;
  authority_snapshot: AuthoritySnapshot;
}
export interface TransactionalBusinessRepository extends AuthorityRepository {
  /** Idempotent first migration only; never replace an existing newer snapshot. */
  initializeBusiness<TState extends BusinessState>(
    state: TState,
  ): Promise<BusinessSnapshot<TState>>;
  loadBusiness<TState extends BusinessState>(
    company_id: string,
  ): Promise<BusinessSnapshot<TState>>;
  /** Authority + latest business draft + successful new revision share one IDB lock. */
  runBusinessCommand<TState extends BusinessState, TValue>(
    identity: CommandIdentity,
    operation: (draft: TState, actor: AuthenticatedActor) => TValue,
    precheck?: { capability: Capability; resource: ResourceScope },
    now?: Date,
  ): Promise<BusinessCommandResult<TState, TValue>>;
  queryBusiness<TState extends BusinessState, TValue>(
    identity: CommandIdentity,
    project: (state: TState, actor: AuthenticatedActor) => TValue,
    precheck?: { capability: Capability; resource: ResourceScope },
    now?: Date,
  ): Promise<{
    value: TValue;
    business_revision: number;
    authority_snapshot: AuthoritySnapshot;
  }>;
  /** Internal clock-derived work; not an endpoint accepting a fabricated user. */
  runSystemReconciliation<TState extends BusinessState, TValue>(
    company_id: string,
    source:
      | "sales_clock"
      | "date_reminders"
      | "return_credit_reminders"
      | "price_updates",
    reconcile: (state: TState, attribution: SystemAttribution) => TValue,
    now?: Date,
  ): Promise<BusinessCommandResult<TState, TValue>>;
}
export interface AuthorityInvalidation {
  company_id: string;
  user_id: string;
  authority_epoch: number;
  directory_version: number;
  reason:
    | "role_changed"
    | "locations_changed"
    | "deactivated"
    | "password_reset"
    | "demo_reset"
    | "session_locked"
    | "session_signed_out"
    | "device_changed";
  session_id?: string;
}

export interface PersonInput {
  name_en: string;
  name_fa?: string;
  username: string;
  phone?: string;
  email?: string;
  role: RoleId;
  location_scope: LocationScope;
}
export interface PersonEditInput extends PersonInput {
  person_id: string;
  expected_version: number;
  reason: string;
}
export interface PersonStatusInput {
  person_id: string;
  expected_version: number;
  reason: string;
}
export interface PeopleService {
  /** Fresh guarded directory projection; excludes aliases, epoch and private setup details. */
  listPeople(
    request: CommandRequest<Record<string, never>>,
  ): Promise<readonly PeopleDirectoryRow[]>;
  /** Raw setup code appears in this successful result only, never list/history. */
  addPerson(request: CommandRequest<PersonInput>): Promise<{
    person: PersonRecord;
    one_time_setup_code: string;
  }>;
  editPerson(request: CommandRequest<PersonEditInput>): Promise<PersonRecord>;
  deactivatePerson(
    request: CommandRequest<PersonStatusInput>,
  ): Promise<PersonRecord>;
  reactivatePerson(
    request: CommandRequest<PersonStatusInput>,
  ): Promise<PersonRecord>;
  resetSetup(request: CommandRequest<PersonStatusInput>): Promise<{
    person: PersonRecord;
    one_time_setup_code: string;
  }>;
}
export interface PeopleDirectoryRow {
  id: string;
  company_id: string;
  name_en: string;
  name_fa?: string;
  username: string;
  phone?: string;
  email?: string;
  role: RoleId;
  location_scope: LocationScope;
  status: PersonRecord["status"];
  version: number;
  last_sign_in_at?: string;
}

export interface SignInInput {
  company_id: string;
  username: string;
  password_or_setup_code: string;
  device_id?: string;
}
export interface SignInResult {
  identity: CommandIdentity;
  person: PersonRecord;
  next:
    | "password"
    | "second_step_setup"
    | "second_step_challenge"
    | "location"
    | "locked"
    | "complete";
}
export interface AuthenticationService {
  signIn(input: SignInInput): Promise<SignInResult>;
  resume(identity: CommandIdentity): Promise<SignInResult | null>;
  choosePassword(
    identity: CommandIdentity,
    password: string,
  ): Promise<SignInResult>;
  setupSecondStep(
    identity: CommandIdentity,
    method: "passkey" | "authenticator",
  ): Promise<SignInResult>;
  completeSecondStep(
    identity: CommandIdentity,
    simulated_response: string,
  ): Promise<SignInResult>;
  unlock(identity: CommandIdentity, password: string): Promise<SignInResult>;
  reauthenticate(
    identity: CommandIdentity,
    password: string,
  ): Promise<SignInResult>;
  lock(identity: CommandIdentity): Promise<void>;
  signOut(identity: CommandIdentity): Promise<void>;
  switchDemoUser(company_id: string, username: string): Promise<SignInResult>;
  setLocation(
    identity: CommandIdentity,
    selection: LocationSelection,
  ): Promise<AuthoritySnapshot>;
}

export interface DeviceInput {
  device_id?: string;
  name: string;
  location_id: string;
  expected_version?: number;
  reason?: string;
}
export interface DevicesService {
  listDevices(
    request: CommandRequest<Record<string, never>>,
  ): Promise<readonly RegisteredDevice[]>;
  registerDevice(
    request: CommandRequest<DeviceInput>,
  ): Promise<RegisteredDevice>;
  editDevice(
    request: CommandRequest<DeviceInput & { device_id: string }>,
  ): Promise<RegisteredDevice>;
  deactivateDevice(
    request: CommandRequest<{
      device_id: string;
      expected_version: number;
      reason: string;
    }>,
  ): Promise<RegisteredDevice>;
  /** Sign-in reads this same-company active hint; it never grants authority. */
  currentDevice(
    company_id: string,
    device_id: string,
  ): Promise<RegisteredDevice | null>;
}

/** React store queues commands; callbacks receive a fresh actor and fresh business draft. */
export interface StoreCommand<TState extends BusinessState> {
  command<T>(
    capability: Capability,
    resource: ResourceScope,
    mutate: (draft: TState, actor: AuthenticatedActor) => T,
  ): Promise<T>;
  /** Protected queries/downloads also refresh IDB if invalidation was missed. */
  query<T>(
    capability: Capability,
    resource: ResourceScope,
    project: (state: TState, actor: AuthenticatedActor) => T,
  ): Promise<T>;
}
