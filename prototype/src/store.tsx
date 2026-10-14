import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DemoState, Language } from "./types";
import type {
  AuthenticatedActor,
  Capability,
  ResourceScope,
  LocationSelection,
} from "./authority-types";
import type { ScopedReadView } from "./e1-read-model";
import {
  createE1ShellRuntime,
  type ShellRuntimeOptions,
} from "./e1-shell-runtime";
import type { ShellSnapshot } from "./e1-store-controller";
import type { E1DemoContextValue } from "./e1-demo-context";
import {
  emptyPreferences,
  preferencesFor,
  readPreferences,
  rememberRecentPerson,
  writePreferences,
  readLanguage,
  LANGUAGE_KEY,
  PreferenceStorageError,
  type AuthPreferences,
  type Theme,
} from "./auth-preferences.e1";
import i18n, { translate, translateCount } from "./i18n";
import { formatMoney } from "./formatters";
import { attachReversals, ownUndoResource, reverseActivity } from "./history";
import {
  addUndoToast,
  pauseUndoToast,
  expireUndoToasts,
  type UndoToast,
} from "./undo-queue";
import { shouldShowUndoNotification } from "./undo-notification-policy";
import { configSeed } from "./config";
import { HistoryStorageError } from "./history-storage";
import { FileStorageError } from "./file-database";
import { AuthorityStorageError } from "./authority-repository";
import { configuredLocations } from "./authority";

export { demoUsers } from "./auth";
export {
  initialState,
  relativeDate,
  STORAGE_KEY,
  branches,
} from "./e1-bootstrap";
export type ProviderOptions = Omit<
  ShellRuntimeOptions<DemoState, ScopedReadView>,
  | "publish"
  | "publishPreferences"
  | "publishError"
  | "publishRecoveryStatus"
  | "onCommitted"
>;
type Runtime = Awaited<
  ReturnType<typeof createE1ShellRuntime<DemoState, ScopedReadView>>
>;
interface ProviderValue extends E1DemoContextValue {
  storageError: boolean;
  historyLoadError: boolean;
  resetGeneration: number;
  undoToasts: UndoToast[];
  pauseUndo(id: string, paused: boolean): void;
  dismissUndo(id: string): void;
  undoActivity(id: string): Promise<void>;
  revertActivity(id: string): Promise<void>;
}
const DemoContext = createContext<ProviderValue | null>(null);
const errorCode = (error: unknown) =>
  error instanceof HistoryStorageError
    ? "history"
    : error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "storage";

/** `options` is assembled from all guarded domain projectors at the application entry. */
export function DemoProvider({
  children,
  options,
}: {
  children: ReactNode;
  options: ProviderOptions;
}) {
  const [snapshot, setSnapshot] = useState<ShellSnapshot<ScopedReadView>>(
    () => ({
      view: options.signedOutView(),
      actor: null,
      person: null,
      secondStepMethod: null,
      stage: "loading",
      generation: 0,
      revision: 0,
      directoryVersion: 0,
    }),
  );
  const snapshotRef = useRef(snapshot);
  useLayoutEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  const [preferences, setPreferences] = useState<AuthPreferences>(() => {
    try {
      return readPreferences();
    } catch {
      return emptyPreferences();
    }
  });
  const preferencesRef = useRef(preferences);
  useLayoutEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);
  const [languageChoice, setLangState] = useState<Language>(() => {
    try {
      return readLanguage();
    } catch {
      return "en";
    }
  });
  const languages = snapshot.view.config.company.ui_languages;
  const supportedLanguage = languages.find(
    (value): value is Language => value === "en" || value === "fa",
  );
  const lang =
    languages.includes(languageChoice) || !supportedLanguage
      ? languageChoice
      : supportedLanguage;
  if (lang !== languageChoice) setLangState(lang);
  const [recentUsers, setRecentUsers] = useState<
    E1DemoContextValue["recentUsers"]
  >([]);
  const [demoUsers, setDemoUsers] = useState<E1DemoContextValue["demoUsers"]>(
    [],
  );
  const [storageError, setStorageError] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [historyQuarantineActive, setHistoryQuarantineActive] = useState(false);
  const [historyResetPending, setHistoryResetPending] = useState(false);
  const [currentComputerId, setCurrentComputerId] = useState<string | null>(
    null,
  );
  const [resetGeneration, setResetGeneration] = useState(0);
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const runtimeRef = useRef<Runtime | null>(null);
  const optionsRef = useRef(options);
  const requireRuntime = useCallback(() => {
    if (!runtimeRef.current) throw new Error("storage");
    return runtimeRef.current;
  }, []);
  const savePreferences = useCallback((next: AuthPreferences) => {
    writePreferences(next);
    preferencesRef.current = next;
    setPreferences(next);
  }, []);
  const reportStorageFailure = useCallback((error: unknown) => {
    if (
      error instanceof AuthorityStorageError ||
      error instanceof HistoryStorageError ||
      error instanceof FileStorageError ||
      error instanceof PreferenceStorageError ||
      (error instanceof Error && error.message === "storage") ||
      error instanceof DOMException
    ) {
      setStorageError(true);
      if (error instanceof HistoryStorageError) setHistoryLoadError(true);
    }
  }, []);
  useEffect(() => {
    let active = true;
    let clockTimer: number | undefined;
    let clockPending: Promise<void> | null = null;
    const reconcileClock = () => {
      if (!active || !runtimeRef.current || clockPending) return;
      clockPending = runtimeRef.current
        .reconcileClock()
        .catch((error: unknown) => {
          if (active) reportStorageFailure(error);
        })
        .finally(() => {
          clockPending = null;
        });
    };
    void createE1ShellRuntime({
      ...optionsRef.current,
      publish: (next) => {
        if (!active) return;
        snapshotRef.current = next;
        setSnapshot(next);
        if (
          next.actor &&
          preferencesRef.current.recent_user_ids[0] !== next.actor.user_id
        ) {
          const remembered = rememberRecentPerson(
            preferencesRef.current,
            next.actor.user_id,
          );
          try {
            savePreferences(remembered);
          } catch {
            setStorageError(true);
          }
        }
      },
      publishRecoveryStatus: (status) => {
        if (active) {
          setHistoryLoadError(status.active);
          setHistoryQuarantineActive(status.active);
          setHistoryResetPending(status.retirementPending);
        }
      },
      publishPreferences: (next) => {
        if (active) {
          preferencesRef.current = next;
          setPreferences(next);
        }
      },
      publishError: (error) => {
        if (active) reportStorageFailure(error);
      },
      prepareCommit: (draft, before, actor) => {
        optionsRef.current.prepareCommit?.(draft, before, actor);
        attachReversals(before, draft, actor);
      },
      onCommitted: (before, after, actor) => {
        if (!active) return;
        const prior = new Set(before.activity.map((entry) => entry.id));
        const entry = after.activity.find(
          (value) =>
            !prior.has(value.id) &&
            value.reversible &&
            shouldShowUndoNotification(value.action),
        );
        if (entry)
          setUndoToasts((queue) =>
            addUndoToast(
              queue,
              {
                id: entry.id,
                action: entry.action,
                actor_username: actor.username,
              },
              Date.now(),
            ),
          );
      },
    })
      .then((runtime) => {
        if (!active) {
          runtime.dispose();
          return;
        }
        runtimeRef.current = runtime;
        setCurrentComputerId(runtime.currentComputerId());
        setStorageError(false);
        clockTimer = window.setInterval(reconcileClock, 60_000);
        window.addEventListener("focus", reconcileClock);
      })
      .catch((error) => {
        if (active) {
          setStorageError(true);
          setHistoryLoadError(errorCode(error) === "history");
          setSnapshot((current) => ({
            ...current,
            stage: "signed_out",
            actor: null,
          }));
        }
      });
    return () => {
      active = false;
      if (clockTimer !== undefined) window.clearInterval(clockTimer);
      window.removeEventListener("focus", reconcileClock);
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [savePreferences, reportStorageFailure]);
  useEffect(() => {
    let active = true;
    const runtime = runtimeRef.current;
    if (runtime)
      void runtime
        .recentPeople(preferences.recent_user_ids)
        .then((users) => {
          if (active) setRecentUsers(users);
        })
        .catch(() => {
          if (active) setRecentUsers([]);
        });
    return () => {
      active = false;
    };
  }, [preferences.recent_user_ids, snapshot.generation, currentComputerId]);
  useEffect(() => {
    let active = true;
    const runtime = runtimeRef.current;
    if (runtime)
      void runtime.demoPeople().then(
        (rows) => {
          if (active) setDemoUsers(rows);
        },
        (error: unknown) => {
          if (active) {
            setDemoUsers([]);
            reportStorageFailure(error);
          }
        },
      );
    return () => {
      active = false;
    };
  }, [
    snapshot.generation,
    snapshot.directoryVersion,
    currentComputerId,
    reportStorageFailure,
  ]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setUndoToasts((queue) => expireUndoToasts(queue, Date.now())),
      250,
    );
    return () => window.clearInterval(timer);
  }, []);
  const activePreferences = useMemo(() => {
    const saved = preferencesFor(preferences, snapshot.person?.id ?? null);
    return {
      ...saved,
      comfortableText: saved.comfortableTextExplicit
        ? saved.comfortableText
        : snapshot.view.config.company.text_size === "large" ||
          saved.comfortableText,
    };
  }, [
    preferences,
    snapshot.person?.id,
    snapshot.view.config.company.text_size,
  ]);
  const t = useCallback(
    (en: string, fa: string) => translate(en, fa, lang),
    [lang],
  );
  const tCount = useCallback(
    (
      one: string,
      other: string,
      faOne: string,
      faOther: string,
      count: number,
    ) => translateCount(one, other, faOne, faOther, count, lang),
    [lang],
  );
  const money = useCallback(
    (amount: string) =>
      formatMoney(amount, { currency: snapshot.view.config.company.currency }),
    [snapshot.view.config.company.currency],
  );
  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Report a failed external Storage write; this effect depends only on lang.
      setStorageError(true);
    }
  }, [lang]);
  useEffect(() => {
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = activePreferences.theme;
    document.documentElement.dataset.textSize =
      activePreferences.comfortableText ? "comfortable" : "default";
    const company = snapshot.view.config.company;
    document.title = `${lang === "fa" ? company.name_fa : company.name_en} · ${translate("Demo", "دمو", lang)}`;
  }, [
    lang,
    activePreferences.theme,
    activePreferences.comfortableText,
    snapshot.view.config.company,
  ]);
  useEffect(() => {
    const style = document.documentElement.style,
      defaults = configSeed.company.branding,
      branding = snapshot.view.config.company.branding ?? defaults;
    const tokens: [string, keyof typeof defaults][] = [
      ["--company-primary", "primary_color"],
      ["--company-primary-hover", "primary_hover_color"],
      ["--company-primary-soft", "primary_soft_color"],
      ["--company-dark-primary", "dark_primary_color"],
      ["--company-dark-primary-hover", "dark_primary_hover_color"],
      ["--company-dark-primary-soft", "dark_primary_soft_color"],
      ["--company-kpi-accent-end", "kpi_accent_end_color"],
    ];
    for (const [token, key] of tokens)
      style.setProperty(token, branding[key] ?? defaults[key]);
    return () => {
      for (const [token] of tokens) style.removeProperty(token);
    };
  }, [snapshot.view.config.company.branding]);
  useEffect(() => {
    if (snapshot.stage !== "complete") return;
    const delay = snapshot.view.config.session.idle_lock_minutes * 60_000;
    if (delay <= 0) return;
    const lock = () => {
      void requireRuntime().controller.lock().catch(reportStorageFailure);
    };
    let timer = window.setTimeout(lock, delay);
    const activity = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, delay);
    };
    const events = ["pointerdown", "keydown", "pointermove", "touchstart"];
    for (const event of events) window.addEventListener(event, activity);
    return () => {
      window.clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, activity);
    };
  }, [
    snapshot.stage,
    snapshot.view.config.session.idle_lock_minutes,
    requireRuntime,
    reportStorageFailure,
  ]);
  const command = useCallback(
    <T,>(
      capability: Capability,
      scope: ResourceScope,
      mutate: (draft: DemoState, actor: AuthenticatedActor) => T,
    ) =>
      requireRuntime()
        .controller.command(capability, scope, mutate)
        .catch((error: unknown) => {
          reportStorageFailure(error);
          throw error;
        }),
    [requireRuntime, reportStorageFailure],
  );
  const query = useCallback(
    <T,>(
      capability: Capability,
      scope: ResourceScope,
      project: (state: DemoState, actor: AuthenticatedActor) => T,
    ) =>
      requireRuntime()
        .controller.query(capability, scope, project)
        .catch((error: unknown) => {
          reportStorageFailure(error);
          throw error;
        }),
    [requireRuntime, reportStorageFailure],
  );
  const permission = useCallback(
    (capability: Capability, scope?: ResourceScope) =>
      runtimeRef.current?.controller.permission(capability, scope) ?? {
        allowed: false,
        reason: "authentication" as const,
      },
    [],
  );
  const can = useCallback(
    (capability: Capability, scope?: ResourceScope) =>
      permission(capability, scope).allowed,
    [permission],
  );
  const setLocation = useCallback(
    async (selection: LocationSelection) => {
      await requireRuntime().controller.setLocation(selection);
    },
    [requireRuntime],
  );
  const setBranch = useCallback(
    async (branch: string) => {
      const actor = snapshotRef.current.actor;
      if (!actor) throw new Error("authentication");
      await setLocation(
        branch === "all"
          ? actor.location_scope.kind === "company"
            ? { kind: "all_locations" }
            : { kind: "all_my_locations" }
          : { kind: "location", location_id: branch },
      );
    },
    [setLocation],
  );
  const authAction = useCallback(
    async (
      operation: (runtime: Runtime) => Promise<void>,
    ): Promise<string | null> => {
      try {
        await operation(requireRuntime());
        await requireRuntime().retryHistoryRetirement();
        return null;
      } catch (error) {
        reportStorageFailure(error);
        return errorCode(error);
      }
    },
    [requireRuntime, reportStorageFailure],
  );
  const people = useMemo<E1DemoContextValue["people"]>(
    () => ({
      list: () => requireRuntime().people.list(),
      add: (input) => requireRuntime().people.add(input),
      edit: (input) => requireRuntime().people.edit(input),
      deactivate: (input) => requireRuntime().people.deactivate(input),
      reactivate: (input) => requireRuntime().people.reactivate(input),
      resetSetup: (input) => requireRuntime().people.resetSetup(input),
    }),
    [requireRuntime],
  );
  const registeredComputers = useMemo<
    E1DemoContextValue["registeredComputers"]
  >(
    () => ({
      list: () => requireRuntime().registeredComputers.list(),
      register: (input) => requireRuntime().registeredComputers.register(input),
      edit: (input) => requireRuntime().registeredComputers.edit(input),
      deactivate: (input) =>
        requireRuntime().registeredComputers.deactivate(input),
      selectCurrent: async (id) => {
        await requireRuntime().registeredComputers.selectCurrent(id);
        setCurrentComputerId(id);
      },
    }),
    [requireRuntime],
  );
  const changePreference = useCallback(
    (patch: Partial<ReturnType<typeof preferencesFor>>) => {
      const personId = snapshotRef.current.person?.id ?? null,
        current = preferencesRef.current;
      const nextValue = { ...preferencesFor(current, personId), ...patch };
      try {
        savePreferences({
          ...current,
          device_preferences: nextValue,
          by_user_id: personId
            ? { ...current.by_user_id, [personId]: nextValue }
            : current.by_user_id,
        });
      } catch (error) {
        reportStorageFailure(error);
      }
    },
    [savePreferences, reportStorageFailure],
  );
  const pauseUndo = useCallback((id: string, paused: boolean) => {
    setUndoToasts((queue) => pauseUndoToast(queue, id, paused, Date.now()));
  }, []);
  const dismissUndo = useCallback((id: string) => {
    setUndoToasts((queue) => queue.filter((item) => item.id !== id));
  }, []);
  const value = useMemo<ProviderValue>(() => {
    const actor = snapshot.actor,
      person = snapshot.person;
    return {
      demoUsers,
      state: snapshot.view,
      actor,
      historyContext: actor,
      role: actor?.role ?? null,
      branch: actor?.branch ?? "all",
      user: person
        ? {
            name: person.name_en,
            name_en: person.name_en,
            name_fa: person.name_fa,
            username: person.username,
            role: person.role,
          }
        : null,
      locked: snapshot.stage === "locked",
      mustChangePassword: snapshot.stage === "password",
      authenticatedAt: actor ? Date.parse(actor.authenticated_at) : 0,
      authStage: snapshot.stage,
      authorityGeneration: snapshot.generation,
      businessRevision: snapshot.revision,
      authorityDirectoryVersion: snapshot.directoryVersion,
      secondStepMethod: snapshot.secondStepMethod,
      locationSelection: actor?.selection ?? null,
      locationIds: actor
        ? configuredLocations(snapshot.view)
            .filter(
              (location) =>
                location.active !== false &&
                actor.allowed_branches.includes(location.id) &&
                (actor.selection.kind !== "location" ||
                  actor.selection.location_id === location.id),
            )
            .map((location) => location.id)
        : [],
      setLocation,
      setBranch,
      permission,
      can,
      command,
      query,
      people,
      registeredComputers,
      currentComputerId,
      authorityHistory: () => requireRuntime().authorityHistory(),
      signIn: (username, password) =>
        authAction((runtime) =>
          runtime.controller.signIn(
            username,
            password,
            currentComputerId ?? undefined,
          ),
        ),
      choosePassword: (password) =>
        authAction((runtime) => runtime.controller.choosePassword(password)),
      setupSecondStep: (method) =>
        authAction((runtime) => runtime.controller.setupSecondStep(method)),
      completeSecondStep: (response) =>
        authAction((runtime) =>
          runtime.controller.completeSecondStep(response),
        ),
      unlock: (password) =>
        authAction((runtime) => runtime.controller.unlock(password)),
      reauthenticate: (password) =>
        authAction((runtime) => runtime.controller.reauthenticate(password)),
      switchDemoUser: (username) =>
        authAction((runtime) => runtime.controller.switchDemoUser(username)),
      signOut: async () => {
        await authAction(async (runtime) => {
          await runtime.controller.signOut();
          // Retire the prior route after genuine sign-out, independently of
          // the later damaged-History retirement retry inside authAction.
          window.location.hash = "";
        });
      },
      lock: async () => {
        await authAction((runtime) => runtime.controller.lock());
      },
      reset: async () => {
        try {
          const result = await requireRuntime().resetDemo();
          if (result.clean) setStorageError(false);
        } catch (error) {
          reportStorageFailure(error);
          throw error;
        }
        setCurrentComputerId(requireRuntime().currentComputerId());
        setUndoToasts([]);
        setResetGeneration((current) => current + 1);
      },
      needsReauthentication: (page) =>
        Boolean(
          actor &&
          snapshot.view.config.session.reprompt_password_for.includes(page) &&
          Date.now() - Date.parse(actor.authenticated_at) >=
            snapshot.view.config.session.reprompt_password_after_minutes *
              60_000,
        ),
      recentUsers,
      preferences,
      ...activePreferences,
      setTheme: (theme: Theme) => changePreference({ theme }),
      setComfortableText: (comfortableText) =>
        changePreference({ comfortableText, comfortableTextExplicit: true }),
      lang,
      setLang: (language) => {
        setLangState(language);
        try {
          localStorage.setItem(LANGUAGE_KEY, language);
        } catch {
          setStorageError(true);
        }
      },
      t,
      tCount,
      money,
      navigate: (route) => {
        window.location.hash = route;
      },
      storageError,
      historyLoadError,
      resetGeneration,
      undoToasts,
      pauseUndo,
      dismissUndo,
      undoActivity: async (id) => {
        if (!actor) throw new Error("authentication");
        // Resolve the actual source without exposing History. Cashier's narrow
        // custom-notebook Undo status comes only from its canonical own action
        // and current source ACL, then reverseActivity checks again at commit.
        const resource = await query(
          "notebooks.read",
          { company_id: actor.company_id, kind: "company_shared" },
          (draft, current) => ownUndoResource(draft, current, id),
        );
        await command("history.undo_own", resource, (draft, current) =>
          reverseActivity(draft, current, id, "undo"),
        );
        setUndoToasts((queue) => queue.filter((item) => item.id !== id));
      },
      revertActivity: async (id) => {
        if (!actor) throw new Error("authentication");
        await command(
          "history.revert",
          { company_id: actor.company_id, kind: "company_shared" },
          (draft, current) => reverseActivity(draft, current, id, "revert"),
        );
      },
    };
  }, [
    snapshot,
    lang,
    preferences,
    recentUsers,
    demoUsers,
    activePreferences,
    storageError,
    historyLoadError,
    resetGeneration,
    undoToasts,
    pauseUndo,
    dismissUndo,
    command,
    query,
    permission,
    can,
    t,
    tCount,
    money,
    setLocation,
    setBranch,
    authAction,
    people,
    registeredComputers,
    currentComputerId,
    requireRuntime,
    changePreference,
    reportStorageFailure,
  ]);
  return (
    <DemoContext.Provider value={value}>
      {(storageError || historyLoadError) && (
        <div className="banner danger" role="status">
          {t(
            historyResetPending
              ? "Demo reset is complete. Your original history is backed up, but its old browser copy could not be retired. Allow browser storage, then reload."
              : historyQuarantineActive
                ? "Saved history could not be read. Your original data is retained. You are using a separate fictional demo. Allow browser storage, then reload, or choose Reset demo."
                : historyLoadError
                  ? "Saved history could not be read. Your original data is retained. Allow browser storage, then reload."
                  : "Browser storage could not be read or updated. Your original data is retained. Allow browser storage, then reload.",
            historyResetPending
              ? "بازنشانی دمو کامل شده است. از سابقهٔ اصلی شما نسخهٔ پشتیبان گرفته شده، اما نسخهٔ قدیمی آن در مرورگر پاک‌سازی نشد. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید."
              : historyQuarantineActive
                ? "سابقهٔ ذخیره‌شده خوانده نشد. اطلاعات اصلی شما نگه داشته شده است. اکنون از یک دموی ساختگی جداگانه استفاده می‌کنید. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید، یا بازنشانی دمو را انتخاب کنید."
                : historyLoadError
                  ? "سابقهٔ ذخیره‌شده خوانده نشد. اطلاعات اصلی شما نگه داشته شده است. دسترسی به حافظهٔ مرورگر را فعال کنید و سپس صفحه را دوباره بارگذاری کنید."
                  : "فضای ذخیره‌سازی مرورگر قابل خواندن یا به‌روزرسانی نیست. داده‌های اصلی شما حفظ شده‌اند. ذخیره‌سازی مرورگر را مجاز کنید، سپس صفحه را دوباره بارگذاری کنید.",
          )}
        </div>
      )}
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo(): ProviderValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider is missing");
  return context;
}
export function useConfiguredTimeZone() {
  const context = useContext(DemoContext);
  return context?.state.config.company.timezone ?? configSeed.company.timezone;
}
