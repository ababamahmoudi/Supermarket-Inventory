import { configuredDemoPeople } from "./e1-seed-fixtures";
import type { RoleId } from "./authority-types";
export type {
  Theme,
  Preferences,
  AuthPreferences,
} from "./auth-preferences.e1";
export type { AuthenticationErrorCode as AuthError } from "./authentication-service";
/** Fictional account chooser labels only; credentials remain inside AuthenticationService. */
export interface DemoUser {
  id: string;
  name: string;
  name_en: string;
  name_fa?: string;
  username: string;
  role: RoleId;
}
export const demoUsers: readonly DemoUser[] = configuredDemoPeople().map(
  (person) => ({
    id: person.id,
    name: person.name_en,
    name_en: person.name_en,
    name_fa: person.name_fa,
    username: person.username,
    role: person.role,
  }),
);
