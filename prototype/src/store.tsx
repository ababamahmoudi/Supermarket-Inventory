import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Decimal from "decimal.js";
import configSeed from "../../seed/arzon-config.json";
import demoSeed from "../../seed/demo-data.json";
import i18n, { translate } from "./i18n";
import type { Branch, DemoState, Language, Role } from "./types";

export const STORAGE_KEY = "supermarket-prototype-v1";
const SESSION_KEY = "supermarket-prototype-session-v1";
export const branches = demoSeed.branches as Exclude<Branch, "all">[];
export const demoUsers = demoSeed.demo_users;

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
      )
        return candidate;
    }
  } catch {
    /* Invalid or unavailable browser storage falls back to the fictional seed. */
  }
  return initialState();
}
function readSession(): { role: Role | null; branch: Branch; lang: Language } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null") as {
      role?: Role;
      branch?: Branch;
      lang?: Language;
    } | null;
    const role = demoUsers.some((user) => user.role === saved?.role)
      ? saved!.role!
      : null;
    const lang = saved?.lang === "fa" ? "fa" : "en";
    const branch =
      role === "supervisor" &&
      (saved?.branch === "all" ||
        branches.includes(saved?.branch as Exclude<Branch, "all">))
        ? saved!.branch!
        : "Branch 1";
    return { role, branch, lang };
  } catch {
    return { role: null, branch: "Branch 1", lang: "en" };
  }
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
  signIn: (role: Role, pin: string) => boolean;
  lock: () => void;
  signOut: () => void;
  reset: () => void;
  navigate: (page: string) => void;
  resetGeneration: number;
}
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readState);
  const [session, setSession] = useState(readSession);
  const [storageError, setStorageError] = useState(false);
  const [resetGeneration, setResetGeneration] = useState(0);
  const update = useCallback((mutator: (draft: DemoState) => void) => {
    setState((previous) => {
      const draft = structuredClone(previous);
      mutator(draft);
      return draft;
    });
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
  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      update,
      ...session,
      resetGeneration,
      t: translate,
      money: (amount) => {
        try {
          const fixed = new Decimal(amount || "0").toFixed(
            2,
            Decimal.ROUND_HALF_UP,
          );
          const [whole, fraction] = fixed.split(".");
          return `${state.config.company.currency === "CAD" ? "$" : state.config.company.currency + " "}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
        } catch {
          return "—";
        }
      },
      setBranch: (branch) =>
        setSession((current) =>
          current.role === "supervisor" &&
          (branch === "all" ||
            branches.includes(branch as Exclude<Branch, "all">))
            ? { ...current, branch }
            : current,
        ),
      setLang: (lang) => {
        void i18n.changeLanguage(lang);
        setSession((current) => ({ ...current, lang }));
      },
      signIn: (role, pin) => {
        const user = demoUsers.find(
          (candidate) => candidate.role === role && candidate.pin === pin,
        );
        if (!user) return false;
        setSession((current) => ({
          ...current,
          role,
          branch: user.branch === "all" ? "Branch 1" : (user.branch as Branch),
        }));
        return true;
      },
      lock: () => setSession((current) => ({ ...current, role: null })),
      signOut: () => {
        window.location.hash = "";
        setSession((current) => ({
          ...current,
          role: null,
          branch: "Branch 1",
        }));
      },
      reset: () => {
        setState(initialState());
        setResetGeneration((previous) => previous + 1);
      },
      navigate: (page) => {
        window.location.hash = page;
      },
    }),
    [session, state, update, resetGeneration],
  );
  return (
    <DemoContext.Provider value={value}>
      {storageError && (
        <div className="banner danger" role="status">
          {translate(
            "Browser storage is full or disabled. Your changes last until this page closes. Reset the demo or allow browser storage.",
            "حافظهٔ مرورگر پر یا غیرفعال است. تغییرات تا بسته شدن صفحه باقی می‌مانند. دمو را بازنشانی کنید یا حافظهٔ مرورگر را فعال کنید.",
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
