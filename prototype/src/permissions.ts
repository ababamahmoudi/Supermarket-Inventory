import type {
  AuthenticatedActor,
  BusinessState,
  Capability,
  DirectoryRecipient,
  LocationSelection,
  PermissionDecision,
  ResourceScope,
  RoleId,
} from "./authority-types";
import {
  AuthorityError,
  authoritySnapshot,
  configuredLocations,
  freshActor,
  isCompanyRole,
  needsSecondStep,
} from "./authority";
import { ALL_CAPABILITIES } from "./capability-names";

const knownCapabilities = new Set<string>(ALL_CAPABILITIES);
const common = [
  "lookup.read",
  "catalog.read",
  "sales.read",
  "offers.read",
  "lookup.receipt_hint",
  "lots.read",
  "notebooks.read",
  "notebooks.mark_seen",
  "notebooks.entry_add",
  "notebooks.entry_edit_own",
  "notifications.read",
  "notifications.mark_read",
  "demo.reset",
] satisfies Capability[];
const operational = [
  ...common,
  "invoices.read",
  "invoices.enter",
  "invoices.edit",
  "invoices.post",
  "invoices.cost_read",
  "invoices.short_resolve",
  "invoices.assign_receiving_location",
  "invoices.assign_reviewer",
  "invoices.product_propose",
  "invoices.supplier_propose",
  "received.read",
  "supplier_items.read",
  "suppliers.read",
  "returns.read",
  "returns.create",
  "returns.pickup_record",
  "labels.read",
  "labels.queue_write",
  "labels.print",
  "labels.templates_create",
  "labels.templates_edit",
  "labels.templates_archive",
  "labels.calibrate",
  "dates.read",
  "dates.add",
  "dates.remove",
  "dates.reuse_safe_hint",
  "notes.read",
  "notes.mark_seen",
  "notes.entry_add",
  "notes.operational_status",
  "branch_requests.read",
  "branch_requests.send",
  "branch_requests.receive",
  "sales.request",
  "sales.request_edit_own",
  "sales.request_withdraw_own",
  "alerts.read",
  "history.read_own",
  "history.undo_own",
  "price_updates.read",
  "price_updates.label_confirm",
] satisfies Capability[];
const branchSupervisor = new Set<Capability>([
  ...operational,
  "timesheets.read",
  "timesheets.edit",
  "dashboard.location",
  "catalog.package_edit",
  "invoices.enter_manual",
  "supplier_items.cost_read",
  "orders.read",
  "orders.write",
  "orders.cost_read",
  "approvals.read",
  "pricing.propose_manual",
  "sales.delivery_hold",
  "notes.status_manage",
  "price_updates.register_confirm",
  "price_updates.complete",
]);
const floorWorker = new Set<Capability>([
  ...operational,
  "returns.operational_resolve",
  "offers.multibuy_manage",
  "orders.read",
  "orders.write",
  "orders.cost_read",
  "price_updates.complete",
]);
// Ali's rule: everyone adds dates; the record keeps who added each one.
// Cashiers add dates but still receive only the public date hint, never
// other people's quantities, lots, notes or supplier invoice evidence.
const cashier = new Set<Capability>([
  ...common,
  "timesheets.read",
  "timesheets.edit",
  "returns.read",
  "returns.create",
  "history.undo_own",
  "dates.add",
]);
const orderCapabilities = new Set<Capability>([
  "orders.read",
  "orders.write",
  "orders.cost_read",
]);
const ownCapabilities = new Set<Capability>([
  "sales.request_edit_own",
  "sales.request_withdraw_own",
  "notebooks.entry_edit_own",
  "history.undo_own",
  "notifications.read",
  "notifications.mark_read",
]);
const invoiceOriginCapabilities = new Set<Capability>([
  "invoices.read",
  "invoices.edit",
  "invoices.cost_read",
  "invoices.product_propose",
  "invoices.supplier_propose",
  "invoices.assign_receiving_location",
  "invoices.post",
]);
const retainedCorrections = new Set<Capability>([
  "dates.remove",
  "notebooks.entry_edit_any",
  "invoices.correct",
  "invoices.relocate",
  "invoices.attach_posted_original",
  "returns.pickup_correct",
  "returns.credit_post",
  "returns.financial_cancel_review",
  "payables.write",
]);

function roleHasCapability(
  state: BusinessState,
  role: RoleId,
  capability: Capability,
): boolean {
  if (!knownCapabilities.has(capability)) return false;
  if (
    (capability.startsWith("timesheets.") &&
      (state.config.modules?.timesheets === false ||
        role === "floor_worker")) ||
    ((capability === "returns.read" || capability === "returns.create") &&
      state.config.modules?.returns === false)
  )
    return false;
  if (isCompanyRole(role)) return true;
  const grants =
    role === "branch_supervisor"
      ? branchSupervisor
      : role === "floor_worker"
        ? floorWorker
        : role === "cashier"
          ? cashier
          : null;
  if (!grants?.has(capability)) return false;
  if (
    role === "floor_worker" &&
    orderCapabilities.has(capability) &&
    !state.config.orders?.allow_floor_worker
  )
    return false;
  if (
    role === "floor_worker" &&
    capability === "price_updates.complete" &&
    !state.config.price_updates?.allow_floor_worker_complete
  )
    return false;
  return true;
}

export function directoryRecipients(
  state: BusinessState,
  filter: {
    capability?: Capability;
    roles?: readonly RoleId[];
    location_ids?: readonly string[];
  } = {},
): readonly DirectoryRecipient[] {
  const snapshot = authoritySnapshot(state);
  const locations = configuredLocations(state).filter(
    (location) => location.active !== false,
  );
  return snapshot.people.flatMap((person) => {
    if (
      person.company_id !== snapshot.company_id ||
      person.status !== "active" ||
      !person.setup.password_complete ||
      (needsSecondStep(person.role) && !person.setup.second_step_complete) ||
      (filter.roles && !filter.roles.includes(person.role)) ||
      (filter.capability &&
        !roleHasCapability(state, person.role, filter.capability))
    )
      return [];
    const assigned =
      person.location_scope.kind === "assigned"
        ? new Set(person.location_scope.location_ids)
        : null;
    const allowed_branches = locations
      .filter(
        (location) =>
          (!assigned || assigned.has(location.id)) &&
          (person.role !== "cashier" || location.type !== "warehouse"),
      )
      .map((location) => location.id);
    if (
      filter.location_ids?.length &&
      !filter.location_ids.some((id) => allowed_branches.includes(id))
    )
      return [];
    return [
      {
        user_id: person.id,
        company_id: person.company_id,
        username: person.username,
        name_en: person.name_en,
        name_fa: person.name_fa,
        role: person.role,
        allowed_branches,
      },
    ];
  });
}

export function allowedLocationIds(
  state: BusinessState,
  actor: AuthenticatedActor,
  options: { includeInactive?: boolean; sellingOnly?: boolean } = {},
): readonly string[] {
  const current = freshActor(state, actor);
  const allowed = new Set(current.allowed_branches);
  return configuredLocations(state)
    .filter(
      (location) =>
        allowed.has(location.id) &&
        (options.includeInactive || location.active !== false) &&
        (!options.sellingOnly ||
          (location.type !== "warehouse" &&
            location.sells_to_customers !== false)),
    )
    .map((location) => location.id);
}

export function resolveLocationSelection(
  state: BusinessState,
  actor: AuthenticatedActor,
  selection: LocationSelection,
  options: { includeInactive?: boolean; sellingOnly?: boolean } = {},
): readonly string[] {
  const current = freshActor(state, actor);
  const locations = allowedLocationIds(state, current, options);
  if (selection.kind === "all_locations" && !isCompanyRole(current.role))
    throw new AuthorityError("location");
  if (selection.kind === "all_my_locations" && locations.length < 2)
    throw new AuthorityError("location");
  if (selection.kind !== "location") return locations;
  if (!locations.includes(selection.location_id))
    throw new AuthorityError("location");
  return [selection.location_id];
}

export function requireConcreteLocation(
  state: BusinessState,
  actor: AuthenticatedActor,
  location_id?: string,
): string {
  const current = freshActor(state, actor);
  const location = location_id ?? current.branch;
  if (location === "all") throw new AuthorityError("location");
  if (!allowedLocationIds(state, current).includes(location))
    throw new AuthorityError("location");
  return location;
}

export function can(
  state: BusinessState,
  actor: AuthenticatedActor | null,
  capability: Capability,
  resource?: ResourceScope,
  now = new Date(),
): PermissionDecision {
  try {
    if (!actor || !knownCapabilities.has(capability))
      throw new AuthorityError("authentication");
    const current = freshActor(state, actor);
    if (!roleHasCapability(state, current.role, capability))
      throw new AuthorityError("capability");
    if (capability === "demo.reset") {
      const person = authoritySnapshot(state).people.find(
        (person) =>
          person.id === current.user_id &&
          person.company_id === current.company_id,
      );
      const configuredIds = new Set([
        "demo-person-owner",
        "demo-person-manager",
        "demo-person-rh-supervisor",
        "demo-person-ny-floor",
        "demo-person-wh-floor",
        "demo-person-cashier",
      ]);
      if (!person?.demo_fixture || !configuredIds.has(person.id))
        throw new AuthorityError("capability");
    }
    if (
      current.role === "floor_worker" &&
      orderCapabilities.has(capability) &&
      !state.config.orders?.allow_floor_worker
    )
      throw new AuthorityError("capability");
    const sensitive =
      capability.startsWith("people.") ||
      capability.startsWith("devices.") ||
      capability.startsWith("payables.") ||
      capability === "settings.manage" ||
      capability === "approvals.decide";
    const reprompt =
      state.config.session?.reprompt_password_after_minutes ?? 15;
    if (
      sensitive &&
      (!Number.isFinite(Date.parse(current.authenticated_at)) ||
        now.getTime() - Date.parse(current.authenticated_at) >
          reprompt * 60_000)
    )
      throw new AuthorityError("freshness");
    if (
      current.role === "cashier" &&
      capability === "history.undo_own" &&
      resource?.status !== "custom_notebook_entry"
    )
      throw new AuthorityError("capability");
    if (!resource) return { allowed: true };
    if (resource.company_id !== current.company_id)
      throw new AuthorityError("company");
    if (
      ownCapabilities.has(capability) &&
      resource.owner_user_id &&
      resource.owner_user_id !== current.user_id
    )
      throw new AuthorityError("ownership");
    const targets = resource.location_ids ?? [];
    if (
      resource.kind !== "company_shared" &&
      resource.mutation &&
      targets.length === 0
    )
      throw new AuthorityError("location");
    const assigned = new Set(current.allowed_branches);
    const locations = configuredLocations(state);
    const invoiceOriginException =
      current.role === "floor_worker" &&
      invoiceOriginCapabilities.has(capability) &&
      Boolean(resource.entity_id) &&
      resource.status !== "posted" &&
      resource.status !== "voided" &&
      Boolean(resource.invoice_reviewer_origin_location_id) &&
      assigned.has(resource.invoice_reviewer_origin_location_id!) &&
      locations.some(
        (location) =>
          location.id === resource.invoice_reviewer_origin_location_id &&
          location.active !== false,
      ) &&
      (resource.owner_user_id === current.user_id ||
        Boolean(resource.handling_user_ids?.includes(current.user_id)));
    const endpointRead =
      resource.kind === "request_endpoints" &&
      !resource.mutation &&
      capability === "branch_requests.read" &&
      targets.some((target) => assigned.has(target));
    for (const target of targets) {
      const location = locations.find((item) => item.id === target);
      if (!location || target === "all") throw new AuthorityError("location");
      if (!assigned.has(target) && !invoiceOriginException && !endpointRead)
        throw new AuthorityError("location");
      if (current.role === "cashier" && location.type === "warehouse")
        throw new AuthorityError("location");
      if (location.active === false) {
        const retained =
          (!resource.mutation &&
            resource.location_policy === "retained_read") ||
          (isCompanyRole(current.role) &&
            resource.location_policy === "retained_correction" &&
            retainedCorrections.has(capability));
        if (!retained) throw new AuthorityError("inactive_location");
      }
    }
    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: error instanceof AuthorityError ? error.code : "authentication",
    };
  }
}

export function requireCapability(
  state: BusinessState,
  actor: AuthenticatedActor,
  capability: Capability,
  resource?: ResourceScope,
  now = new Date(),
): void {
  const decision = can(state, actor, capability, resource, now);
  if (!decision.allowed)
    throw new AuthorityError(decision.reason ?? "capability");
}
