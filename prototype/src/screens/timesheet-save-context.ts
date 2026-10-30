import { createContext } from "react";
import type { AuthenticatedActor } from "../authority-types";

export const TimesheetSaveContext = createContext<{
  register: (id: string, flush: () => Promise<boolean>) => () => void;
} | null>(null);

/** The callback belongs to its original editing identity and location intent. */
export function requireTimesheetSaveActor(
  expected: AuthenticatedActor,
  current: AuthenticatedActor,
) {
  if (
    expected.company_id !== current.company_id ||
    expected.user_id !== current.user_id ||
    expected.session_id !== current.session_id ||
    expected.authority_epoch !== current.authority_epoch ||
    expected.person_version !== current.person_version ||
    JSON.stringify(expected.selection) !== JSON.stringify(current.selection)
  )
    throw new Error("timesheet_save_changed");
}

type NavigationGuard = (event: HashChangeEvent) => boolean;
let navigationGuard: NavigationGuard | null = null;

/** The route owner calls this before accepting a hash; listener order is not authority. */
export function deferTimesheetNavigation(event: HashChangeEvent): boolean {
  return navigationGuard?.(event) ?? false;
}
export function registerTimesheetNavigationGuard(guard: NavigationGuard) {
  navigationGuard = guard;
  return () => {
    if (navigationGuard === guard) navigationGuard = null;
  };
}
