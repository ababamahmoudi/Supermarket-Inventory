import type { DemoState, Language } from "./types";
import type { ScopedReadView } from "./e1-read-model";
import type { DemoUser } from "./auth";
import type { AuthPreferences, Theme } from "./auth-preferences.e1";
import type {
  AuthorityHistoryEntry,
  AuthenticatedActor,
  Capability,
  ResourceScope,
  PermissionDecision,
  LocationSelection,
  PeopleDirectoryRow,
  PersonInput,
  PersonEditInput,
  PersonStatusInput,
  RegisteredDevice,
  DeviceInput,
  SignInResult,
} from "./authority-types";

/** A runtime-redacted read view. It is never a canonical command draft. */
export type DemoReadState = Readonly<ScopedReadView>;
export interface PeopleActions {
  list(): Promise<readonly PeopleDirectoryRow[]>;
  add(
    input: PersonInput,
  ): Promise<{ person: PeopleDirectoryRow; one_time_setup_code: string }>;
  edit(input: PersonEditInput): Promise<PeopleDirectoryRow>;
  deactivate(input: PersonStatusInput): Promise<PeopleDirectoryRow>;
  reactivate(input: PersonStatusInput): Promise<PeopleDirectoryRow>;
  resetSetup(input: PersonStatusInput): Promise<{
    person: PeopleDirectoryRow;
    one_time_setup_code: string | null;
  }>;
}
export interface RegisteredComputerActions {
  list(): Promise<readonly RegisteredDevice[]>;
  register(input: DeviceInput): Promise<RegisteredDevice>;
  edit(input: DeviceInput & { device_id: string }): Promise<RegisteredDevice>;
  deactivate(input: {
    device_id: string;
    expected_version: number;
    reason: string;
  }): Promise<RegisteredDevice>;
  selectCurrent(device_id: string): Promise<void>;
}
export interface E1DemoContextValue {
  demoUsers: readonly DemoUser[];
  state: DemoReadState;
  role: AuthenticatedActor["role"] | null;
  branch: string;
  user: {
    name: string;
    name_en: string;
    name_fa?: string;
    username: string;
    role: AuthenticatedActor["role"];
  } | null;
  locked: boolean;
  mustChangePassword: boolean;
  authenticatedAt: number;
  recentUsers: readonly {
    id: string;
    username: string;
    name_en: string;
    name_fa?: string;
  }[];
  preferences: AuthPreferences;
  theme: Theme;
  comfortableText: boolean;
  setTheme(theme: Theme): void;
  setComfortableText(value: boolean): void;
  setLang(language: Language): void;
  setBranch(branch: string): Promise<void>;
  switchDemoUser(username: string): Promise<string | null>;
  reset(): Promise<void>;
  needsReauthentication(page: string): boolean;
  actor: AuthenticatedActor | null;
  historyContext: AuthenticatedActor | null;
  can(capability: Capability, scope?: ResourceScope): boolean;
  permission(capability: Capability, scope?: ResourceScope): PermissionDecision;
  command<T>(
    capability: Capability,
    scope: ResourceScope,
    mutate: (freshDraft: DemoState, freshActor: AuthenticatedActor) => T,
  ): Promise<T>;
  query<T>(
    capability: Capability,
    scope: ResourceScope,
    project: (freshState: DemoState, freshActor: AuthenticatedActor) => T,
  ): Promise<T>;
  people: PeopleActions;
  authorityHistory(): Promise<readonly AuthorityHistoryEntry[]>;
  registeredComputers: RegisteredComputerActions;
  currentComputerId: string | null;
  locationSelection: LocationSelection | null;
  locationIds: readonly string[];
  setLocation(selection: LocationSelection): Promise<void>;
  authorityGeneration: number;
  businessRevision: number;
  authorityDirectoryVersion: number;
  secondStepMethod: "passkey" | "authenticator" | null;
  reauthenticate(password: string): Promise<string | null>;
  authStage: SignInResult["next"] | "signed_out" | "loading";
  signIn(username: string, password: string): Promise<string | null>;
  choosePassword(password: string): Promise<string | null>;
  setupSecondStep(method: "passkey" | "authenticator"): Promise<string | null>;
  completeSecondStep(response: string): Promise<string | null>;
  unlock(password: string): Promise<string | null>;
  lock(): Promise<void>;
  signOut(): Promise<void>;
  lang: Language;
  t(en: string, fa: string): string;
  tCount(
    one: string,
    other: string,
    faOne: string,
    faOther: string,
    count: number,
  ): string;
  money(value: string): string;
  navigate(route: string): void;
}
