import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { configSeed, demoSeed } from "./config";
import retainedConfig from "./compat/configuration.json";
import { formatMoney } from "./formatters";
import {
  AUTH_STORAGE_KEY,
  SESSION_KEY,
  authenticate,
  auditAuth,
  demoUsers,
  preferencesFor,
  readAuth,
  readAuthSession,
  replacePassword,
  type AuthError,
  type AuthSession,
  type AuthState,
  type DemoUser,
  type Theme,
} from "./auth";
export { demoUsers } from "./auth";
import i18n, { translate } from "./i18n";
import type { Branch, DemoState, Language, Role } from "./types";

export const STORAGE_KEY = "supermarket-prototype-v1";
export const branches = demoSeed.branches as Exclude<Branch, "all">[];

export function relativeDate(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: configSeed.company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function initialState(): DemoState {
  const company_id = configSeed.company.seed_key;
  const products: DemoState["products"] = demoSeed.products.map((product) => ({
    ...product,
    status: "active",
    company_id,
    branch_prices:
      product.code === demoSeed.cross_branch_price_conflict.product_code
        ? {
            "Branch 1": demoSeed.cross_branch_price_conflict.branch_1_price,
            "Branch 2": demoSeed.cross_branch_price_conflict.branch_2_price,
          }
        : ({} as Record<string, string>),
    pending_price:
      product.code === "0006"
        ? demoSeed.demo_invoice.lines.find(
            (line) => line.product_code === product.code,
          )?.calculated_selling_price
        : null,
    pending_branch: "Branch 1",
  }));
  const newLine = demoSeed.demo_invoice.lines.find(
    (line) => line.product_code === "NEW",
  )!;
  products.push({
    company_id,
    code: "0015",
    name_en: newLine.description,
    name_fa: "زرشک خشک 100 گرمی",
    pricing_category: configSeed.pricing_categories.find(
      (category) => category.key === "grocery",
    )!.key,
    unit_size: "100 g",
    last_cost_before_tax: newLine.unit_cost_before_tax,
    selling_price: "",
    pending_price: newLine.calculated_selling_price,
    pending_branch: "Branch 1",
    branch_prices: {},
    offer: null,
    taxable: newLine.taxable,
    date_tracking: true,
    main_supplier: demoSeed.demo_invoice.supplier,
    ai_category: "Dried fruits & spices",
    barcode: "DEMO-NEW-0015",
    status: "pending_approval",
    tax_profile: newLine.tax_profile,
  });
  return structuredClone({
    version: 1,
    supplier_balance_snapshot_date: relativeDate(0),
    supplier_balance_snapshot_currency: configSeed.company.currency,
    pricing_minimum_margin_schema: 2,
    config: configSeed,
    products,
    approvals: [
      {
        id: "demo-lavash-price",
        company_id,
        branch: "Branch 1",
        type: "price_change",
        product_code: "0006",
        status: "pending",
        proposed_price: "2.99",
        current_price: "1.99",
      },
      {
        id: "demo-barberries-product",
        company_id,
        branch: "Branch 1",
        type: "new_product",
        product_code: "0015",
        status: "pending",
        proposed_price: newLine.calculated_selling_price,
        current_price: null,
      },
    ],
    alerts: [
      {
        id: "demo-tea-conflict",
        company_id,
        branch: "all",
        type: "price_conflict",
        product_code: demoSeed.cross_branch_price_conflict.product_code,
        status: "pending",
        branch_prices: {
          "Branch 1": demoSeed.cross_branch_price_conflict.branch_1_price,
          "Branch 2": demoSeed.cross_branch_price_conflict.branch_2_price,
        },
      },
    ],
    invoice: {
      ...demoSeed.demo_invoice,
      id: "demo-fv-20417",
      company_id,
      branch: "Branch 1",
      status: "empty",
      lines: demoSeed.demo_invoice.lines.map((line) => ({
        ...line,
        company_id,
      })),
      invoice_date: relativeDate(0),
      received_at: new Date().toISOString(),
      receiving_employee: demoSeed.demo_users.find(
        (user) => user.role === "floor_worker",
      )!.name,
      due_date: relativeDate(14),
      supplier_confirmed: true,
    },
    invoices: [],
    offers: products
      .filter((product) => product.offer)
      .map((product) => {
        const mapping = configSeed.promotions.price_to_offer.find(
          (offer) => offer.price === product.selling_price,
        )!;
        return {
          id: `demo-offer-${product.code}`,
          company_id,
          branch: "all",
          product_code: product.code,
          label: product.offer!,
          price: product.selling_price,
          pool: mapping.mix_and_match_pool,
          mix_and_match: true,
          status: "active",
          scope: "all",
          currency: configSeed.company.currency,
        };
      }),
    templates: [],
    returns: demoSeed.open_returns.map((record, index) => ({
      ...record,
      company_id,
      branch: record.branch as Branch,
      id: `demo-return-${index + 1}`,
      status: record.status as "open" | "partially_resolved",
    })),
    expiry: demoSeed.expiring_soon_examples.map((record, index) => ({
      ...record,
      company_id,
      branch: record.branch as Branch,
      id: `demo-expiry-${index + 1}`,
      date: relativeDate(record.expires_in_days),
      status: "active",
    })),
    notes: demoSeed.notes.map((record, index) => ({
      ...record,
      company_id,
      branch: "Branch 1",
      id: `demo-note-${index + 1}`,
      type: record.type as "to_order" | "store_use" | "note_to_supervisor",
      status: "open",
      created_at: new Date().toISOString(),
    })),
    ledger: [],
    stock: Object.fromEntries(
      products.flatMap((product) =>
        branches.map((branch) => [
          `${branch}:${product.code}`,
          demoSeed.open_returns.reduce(
            (count, record) =>
              count +
              (record.branch === branch &&
              record.replacement_received?.product_code === product.code
                ? record.replacement_received.qty
                : 0),
            0,
          ),
        ]),
      ),
    ),
    activity: [],
  } satisfies DemoState);
}

function readState(): DemoState {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (
      saved &&
      typeof saved === "object" &&
      "version" in saved &&
      saved.version === 1 &&
      "config" in saved &&
      "products" in saved &&
      Array.isArray(saved.products)
    ) {
      const candidate = saved as DemoState;
      if (
        candidate.config?.company?.seed_key === configSeed.company.seed_key &&
        Array.isArray(candidate.approvals) &&
        Array.isArray(candidate.ledger) &&
        candidate.invoice &&
        Array.isArray(candidate.returns)
      ) {
        // Keep business edits from v1 while replacing the old PIN session policy.
        candidate.config.session = {
          ...configSeed.session,
          ...candidate.config.session,
          sign_in: configSeed.session.sign_in,
          pins: configSeed.session.pins,
        };
        candidate.supplier_balance_snapshot_date ??= relativeDate(0);
        candidate.supplier_balance_snapshot_currency ??=
          configSeed.company.currency;
        if (candidate.pricing_minimum_margin_schema !== 2) {
          // Earlier screens could edit divisors, but not minimum margins. Only
          // replace an unchanged retained default;
          // preserve explicit custom values and all other saved business data.
          for (const category of candidate.config.pricing_categories) {
            const previous = retainedConfig.pricing_categories.find(
              (item) => item.key === category.key,
            );
            const current = configSeed.pricing_categories.find(
              (item) => item.key === category.key,
            );
            if (
              previous &&
              current &&
              category.minimum_margin === previous.minimum_margin
            )
              category.minimum_margin = current.minimum_margin;
          }
          candidate.pricing_minimum_margin_schema = 2;
        }
        return candidate;
      }
    }
  } catch {
    /* Invalid or unavailable browser storage falls back to the fictional seed. */
  }
  return initialState();
}
interface DemoContextValue {
  state: DemoState;
  update: (mutator: (draft: DemoState) => void) => void;
  role: Role | null;
  branch: Branch;
  lang: Language;
  t: (en: string, fa: string) => string;
  money: (value: string) => string;
  setBranch: (branch: Branch) => void;
  setLang: (lang: Language) => void;
  user: DemoUser | null;
  locked: boolean;
  authenticatedAt: number;
  mustChangePassword: boolean;
  recentUsers: DemoUser[];
  theme: Theme;
  comfortableText: boolean;
  setTheme: (theme: Theme) => void;
  setComfortableText: (comfortable: boolean) => void;
  signIn: (username: string, password: string) => AuthError | null;
  unlock: (password: string) => AuthError | null;
  choosePassword: (password: string) => AuthError | null;
  switchDemoUser: (username: string) => void;
  needsReauthentication: (page: string) => boolean;
  reauthenticate: (password: string) => AuthError | null;
  lock: () => void;
  signOut: () => void;
  reset: () => void;
  navigate: (page: string) => void;
  resetGeneration: number;
}
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readState);
  const stateRef = useRef(state);
  const [session, setSession] = useState(readAuthSession);
  const sessionRef = useRef(session);
  const [auth, setAuth] = useState(readAuth);
  const authRef = useRef(auth);
  const commitSession = useCallback((next: AuthSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);
  const commitAuth = useCallback((next: AuthState) => {
    authRef.current = next;
    setAuth(next);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* Browser-only demo remains usable in memory. */
    }
  }, []);
  const user =
    demoUsers.find((candidate) => candidate.username === session.username) ??
    null;
  const role = user?.role ?? null;
  const mustChangePassword = Boolean(
    user && auth.accounts[user.username]?.mustChangePassword,
  );
  const preferences = useMemo(
    () => preferencesFor(auth, session.username),
    [auth, session.username],
  );
  const [storageError, setStorageError] = useState(false);
  const [resetGeneration, setResetGeneration] = useState(0);
  const update = useCallback((mutator: (draft: DemoState) => void) => {
    // Validate synchronously so the screen can catch a failed business action.
    // Publish only successful drafts; the ref also preserves same-event updates.
    if (
      sessionRef.current.locked ||
      (sessionRef.current.username &&
        authRef.current.accounts[sessionRef.current.username]
          ?.mustChangePassword)
    )
      throw new Error("Sign in and choose your password before continuing.");
    const draft = structuredClone(stateRef.current);
    mutator(draft);
    const actor = demoUsers.find(
      (candidate) => candidate.username === sessionRef.current.username,
    );
    if (actor) {
      const previousIds = new Set(
        stateRef.current.activity.map((entry) => entry.id),
      );
      for (const entry of draft.activity)
        if (!previousIds.has(entry.id)) entry.by = actor.name;
    }
    stateRef.current = draft;
    setState(draft);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      queueMicrotask(() => setStorageError(false));
    } catch {
      queueMicrotask(() => setStorageError(true));
    }
  }, [state]);
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* The session remains usable in memory. */
    }
    void i18n.changeLanguage(session.lang);
    document.documentElement.lang = session.lang;
    document.documentElement.dir = session.lang === "fa" ? "rtl" : "ltr";
    document.title = `${session.lang === "fa" ? state.config.company.name_fa : state.config.company.name_en} · ${translate("Demo", "دمو")}`;
  }, [session, state.config.company]);
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.dataset.textSize = preferences.comfortableText
      ? "comfortable"
      : "default";
  }, [preferences.theme, preferences.comfortableText]);
  useEffect(() => {
    const style = document.documentElement.style;
    const defaults = configSeed.company.branding;
    const branding = state.config.company.branding ?? defaults;
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
  }, [state.config.company.branding]);
  const lockSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current.username || current.locked) return;
    const next = structuredClone(authRef.current);
    auditAuth(next, "Locked screen", current.username);
    commitAuth(next);
    commitSession({ ...current, locked: true });
  }, [commitAuth, commitSession]);
  useEffect(() => {
    if (!user || session.locked || mustChangePassword) return;
    const delay = state.config.session.idle_lock_minutes * 60_000;
    if (delay <= 0) return;
    let timer = window.setTimeout(lockSession, delay);
    const activity = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lockSession, delay);
    };
    for (const event of ["pointerdown", "keydown", "pointermove", "touchstart"])
      window.addEventListener(event, activity);
    return () => {
      window.clearTimeout(timer);
      for (const event of [
        "pointerdown",
        "keydown",
        "pointermove",
        "touchstart",
      ])
        window.removeEventListener(event, activity);
    };
  }, [
    user,
    session.locked,
    mustChangePassword,
    state.config.session.idle_lock_minutes,
    lockSession,
  ]);
  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      update,
      ...session,
      role,
      user,
      mustChangePassword,
      recentUsers: auth.recentUsers
        .map((username) =>
          demoUsers.find((candidate) => candidate.username === username)!,
        )
        .filter(Boolean),
      ...preferences,
      setTheme: (theme) => {
        const next = structuredClone(authRef.current);
        const preference = {
          ...preferencesFor(next, sessionRef.current.username),
          theme,
        };
        next.devicePreferences = preference;
        if (sessionRef.current.username)
          next.preferences[sessionRef.current.username] = preference;
        commitAuth(next);
      },
      setComfortableText: (comfortableText) => {
        const next = structuredClone(authRef.current);
        const preference = {
          ...preferencesFor(next, sessionRef.current.username),
          comfortableText,
        };
        next.devicePreferences = preference;
        if (sessionRef.current.username)
          next.preferences[sessionRef.current.username] = preference;
        commitAuth(next);
      },
      resetGeneration,
      t: (en, fa) => translate(en, fa, session.lang),
      money: (amount) => {
        try {
          return formatMoney(amount || "0", {
            currency: state.config.company.currency,
          });
        } catch {
          return "—";
        }
      },
      setBranch: (branch) => {
        if (
          role === "supervisor" &&
          (branch === "all" ||
            branches.includes(branch as Exclude<Branch, "all">))
        )
          commitSession({ ...sessionRef.current, branch });
      },
      setLang: (lang) => {
        void i18n.changeLanguage(lang);
        commitSession({ ...sessionRef.current, lang });
      },
      signIn: (username, password) => {
        const result = authenticate(
          authRef.current,
          username,
          password,
          stateRef.current.config.session,
        );
        commitAuth(result.state);
        if (!result.user) return result.error ?? "invalid";
        commitSession({
          ...sessionRef.current,
          username: result.user.username,
          branch:
            result.user.branch === "all" ? "Branch 1" : result.user.branch,
          locked: false,
          authenticatedAt: Date.now(),
        });
        return null;
      },
      unlock: (password) => {
        const result = authenticate(
          authRef.current,
          sessionRef.current.username ?? "",
          password,
          stateRef.current.config.session,
        );
        commitAuth(result.state);
        if (!result.user) return result.error ?? "invalid";
        commitSession({
          ...sessionRef.current,
          locked: false,
          authenticatedAt: Date.now(),
        });
        return null;
      },
      choosePassword: (password) => {
        if (!sessionRef.current.username) return "invalid";
        const result = replacePassword(
          authRef.current,
          sessionRef.current.username,
          password,
          stateRef.current.config.session,
        );
        if (result.error) return result.error;
        commitAuth(result.state);
        commitSession({ ...sessionRef.current, authenticatedAt: Date.now() });
        return null;
      },
      switchDemoUser: (username) => {
        const demoUser = demoUsers.find(
          (candidate) => candidate.username === username,
        );
        if (!demoUser) return;
        const next = structuredClone(authRef.current);
        auditAuth(next, "Switched demo user", username);
        next.recentUsers = [
          username,
          ...next.recentUsers.filter((recent) => recent !== username),
        ].slice(0, 4);
        commitAuth(next);
        commitSession({
          ...sessionRef.current,
          username,
          branch: demoUser.branch === "all" ? "Branch 1" : demoUser.branch,
          locked: false,
          authenticatedAt: Date.now(),
        });
        window.location.hash =
          demoUser.role === "supervisor"
            ? "dashboard"
            : demoUser.role === "cashier"
              ? "lookup"
              : "invoices";
      },
      needsReauthentication: (page) =>
        state.config.session.reprompt_password_for.includes(page) &&
        Date.now() - session.authenticatedAt >
          state.config.session.reprompt_password_after_minutes * 60_000,
      reauthenticate: (password) => {
        const result = authenticate(
          authRef.current,
          sessionRef.current.username ?? "",
          password,
          stateRef.current.config.session,
        );
        commitAuth(result.state);
        if (!result.user) {
          if (result.error === "locked")
            commitSession({ ...sessionRef.current, locked: true });
          return result.error ?? "invalid";
        }
        commitSession({ ...sessionRef.current, authenticatedAt: Date.now() });
        return null;
      },
      lock: lockSession,
      signOut: () => {
        const current = sessionRef.current;
        const next = structuredClone(authRef.current);
        if (current.username) auditAuth(next, "Signed out", current.username);
        commitAuth(next);
        window.location.hash = "";
        commitSession({
          ...current,
          username: null,
          branch: "Branch 1",
          locked: false,
          authenticatedAt: 0,
        });
      },
      reset: () => {
        const seed = initialState();
        stateRef.current = seed;
        setState(seed);
        setResetGeneration((previous) => previous + 1);
      },
      navigate: (page) => {
        window.location.hash = page;
      },
    }),
    [
      session,
      state,
      update,
      resetGeneration,
      role,
      user,
      auth,
      preferences,
      mustChangePassword,
      commitAuth,
      commitSession,
      lockSession,
    ],
  );
  return (
    <DemoContext.Provider value={value}>
      {storageError && (
        <div className="banner danger" role="status">
          {translate(
            "Browser storage is full or disabled. Your changes last until this page closes. Reset the demo or allow browser storage.",
            "حافظهٔ مرورگر پر یا غیرفعال است. تغییرات تا بسته شدن صفحه باقی می‌مانند. دمو را بازنشانی کنید یا حافظهٔ مرورگر را فعال کنید.",
            session.lang,
          )}
        </div>
      )}
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}
