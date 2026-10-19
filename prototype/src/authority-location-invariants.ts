import type { BusinessState } from "./authority-types";
import {
  AuthorityError,
  configuredLocations,
  isCompanyRole,
} from "./authority";
import type { AuthorityDocument } from "./authority-document";

/** Called inside the shared authority/business commit, using the newly changed config. */
export function assertDirectoryLocationSafety(
  state: BusinessState,
  document: AuthorityDocument,
) {
  const configured = configuredLocations(state);
  const ids = new Set<string>();
  for (const location of configured) {
    if (!location.id || location.id === "all" || ids.has(location.id))
      throw new AuthorityError("location");
    ids.add(location.id);
  }
  for (const person of document.people) {
    if (person.company_id !== document.company_id)
      throw new AuthorityError("company");
    if (person.location_scope.kind !== "assigned") continue;
    for (const id of person.location_scope.location_ids) {
      const location = configured.find((item) => item.id === id);
      // Inactive assignments remain historical facts, but locations may not disappear.
      if (
        !location ||
        (person.role === "cashier" && location.type === "warehouse")
      )
        throw new AuthorityError("location");
    }
  }
  for (const device of document.devices) {
    if (device.company_id !== document.company_id)
      throw new AuthorityError("company");
    if (!ids.has(device.location_id)) throw new AuthorityError("location");
  }
}

/** Config deactivation never silently picks a first store or grants a device's location. */
export function reconcileSessionLocationSelections(
  state: BusinessState,
  document: AuthorityDocument,
) {
  const locations = configuredLocations(state);
  for (const session of document.sessions) {
    if (session.state !== "active" && session.state !== "location_required")
      continue;
    const person = document.people.find(
      (person) =>
        person.id === session.user_id &&
        person.company_id === document.company_id,
    );
    if (
      !person ||
      person.status !== "active" ||
      session.authority_epoch !== person.authority_epoch
    )
      continue;
    const assigned =
      person.location_scope.kind === "assigned"
        ? new Set(person.location_scope.location_ids)
        : null;
    const assignedLocations = locations.filter(
      (location) =>
        (!assigned || assigned.has(location.id)) &&
        (person.role !== "cashier" || location.type !== "warehouse"),
    );
    const allowed = assignedLocations.filter(
      (location) => location.active !== false,
    );
    const selection = session.selected_location;
    // Preserve an already active, valid assigned historical scope when every
    // assigned location becomes inactive. Never pick an inactive default or
    // revive a session waiting for a location, setup, or authentication.
    if (
      session.state === "active" &&
      assigned &&
      allowed.length === 0 &&
      ((selection?.kind === "location" &&
        assignedLocations.some(
          (location) => location.id === selection.location_id,
        )) ||
        (selection?.kind === "all_my_locations" &&
          assignedLocations.length > 1))
    )
      continue;
    if (
      selection?.kind === "location" &&
      allowed.some((location) => location.id === selection.location_id)
    )
      continue;
    if (selection?.kind === "all_locations" && isCompanyRole(person.role))
      continue;
    if (selection?.kind === "all_my_locations" && allowed.length > 1) continue;
    const device = document.devices.find(
      (device) =>
        device.id === session.device_id &&
        device.active &&
        device.company_id === document.company_id,
    );
    const defaultLocation =
      device && allowed.find((location) => location.id === device.location_id);
    session.selected_location = defaultLocation
      ? { kind: "location", location_id: defaultLocation.id }
      : allowed.length === 1
        ? { kind: "location", location_id: allowed[0].id }
        : isCompanyRole(person.role)
          ? { kind: "all_locations" }
          : allowed.length > 1
            ? { kind: "all_my_locations" }
            : null;
    session.state = session.selected_location ? "active" : "location_required";
  }
}
