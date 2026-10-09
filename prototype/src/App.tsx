import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  Bell,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Eye,
  EyeOff,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Moon,
  Package,
  PanelLeftClose,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Store,
  Tag,
  Tags,
  Truck,
} from "lucide-react";
import logo from "../../assets/arzon-logo.png?inline";
import { branchLabel, demoUserLabel, LtrText } from "./presentation";
import "./shell-catalog-polish.css";
import PricingSettings from "./screens/Settings";
import { Lookup, Products, ProductPage } from "./screens/Catalog";
import Invoices from "./screens/Invoices";
import Approvals from "./screens/Approvals";
import Alerts from "./screens/Alerts";
import Offers from "./screens/Offers";
import { Labels } from "./screens/Labels";
import Returns from "./screens/Returns";
import Expiry from "./screens/Expiry";
import Notes from "./screens/Notes";
import Payables from "./screens/Payables";
import Dashboard from "./screens/Dashboard";
import Suppliers from "./screens/Suppliers";
import "./a2-shared.css";
import { branches, demoUsers, useDemo } from "./store";
import type { AuthError } from "./auth";
import type { Branch, Role } from "./types";
import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  Menu,
  MenuItem,
  Select,
} from "./ui";

export const pages: {
  key: string;
  en: string;
  fa: string;
  icon: typeof Search;
  group: string;
  roles: Role[];
  disabled?: boolean;
}[] = [
  {
    key: "lookup",
    en: "Lookup",
    fa: "جست‌وجو",
    icon: Search,
    group: "Daily",
    roles: ["cashier", "floor_worker", "supervisor"],
  },
  {
    key: "invoices",
    en: "Invoices",
    fa: "فاکتورها",
    icon: Truck,
    group: "Daily",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "returns",
    en: "Returns",
    fa: "مرجوعی‌ها",
    icon: RotateCcw,
    group: "Daily",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "labels",
    en: "Labels",
    fa: "برچسب‌ها",
    icon: Tag,
    group: "Daily",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "expiry",
    en: "Date tracking",
    fa: "پیگیری تاریخ",
    icon: Archive,
    group: "Daily",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "notes",
    en: "Notes",
    fa: "یادداشت‌ها",
    icon: MessageSquare,
    group: "Daily",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "products",
    en: "Products",
    fa: "محصولات",
    icon: Package,
    group: "Catalog",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "offers",
    en: "Offers",
    fa: "پیشنهادهای فروش",
    icon: Tags,
    group: "Catalog",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "suppliers",
    en: "Suppliers",
    fa: "تأمین‌کنندگان",
    icon: Store,
    group: "Catalog",
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "dashboard",
    en: "Dashboard",
    fa: "داشبورد",
    icon: LayoutDashboard,
    group: "Supervisor",
    roles: ["supervisor"],
  },
  {
    key: "approvals",
    en: "Approvals",
    fa: "تأییدها",
    icon: ClipboardList,
    group: "Supervisor",
    roles: ["supervisor"],
  },
  {
    key: "alerts",
    en: "Alerts",
    fa: "هشدارها",
    icon: Bell,
    group: "Supervisor",
    roles: ["supervisor"],
  },
  {
    key: "payables",
    en: "Payables",
    fa: "حساب‌های پرداختنی",
    icon: CreditCard,
    group: "Supervisor",
    roles: ["supervisor"],
  },
  {
    key: "settings",
    en: "Settings",
    fa: "تنظیمات",
    icon: Settings,
    group: "Admin",
    roles: ["supervisor"],
  },
  {
    key: "history",
    en: "History",
    fa: "تاریخچه",
    icon: History,
    group: "Admin",
    roles: ["supervisor"],
    disabled: true,
  },
];
const roleNames: Record<Role, [string, string]> = {
  supervisor: ["Supervisor", "سرپرست"],
  floor_worker: ["Floor Worker", "کارمند فروشگاه"],
  cashier: ["Cashier", "صندوق‌دار"],
};
export function RoleName({ role }: { role: Role }) {
  const { t } = useDemo();
  return t(...roleNames[role]);
}
function LanguageToggle() {
  const { lang, setLang, t } = useDemo();
  return (
    <div className="pills language-toggle" aria-label={t("Language", "زبان")}>
      <button
        type="button"
        aria-label="English"
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <button
        type="button"
        lang="fa"
        aria-label="فارسی"
        aria-pressed={lang === "fa"}
        onClick={() => setLang("fa")}
      >
        فا
      </button>
    </div>
  );
}
function Initials({ name }: { name: string }) {
  return (
    <span className="user-avatar" aria-hidden="true">
      {name
        .split(" ")
        .filter((part) => !["Demo", "دمو"].includes(part))
        .map((part) => part[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete = "current-password",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const { t } = useDemo();
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={
            visible
              ? t("Hide password", "پنهان کردن گذرواژه")
              : t("Show password", "نمایش گذرواژه")
          }
          aria-pressed={visible}
          onClick={() => setVisible((previous) => !previous)}
        >
          {visible ? (
            <EyeOff size={20} aria-hidden="true" />
          ) : (
            <Eye size={20} aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function authErrorCopy(
  error: AuthError | null,
  t: (en: string, fa: string) => string,
  minLength = 8,
): string {
  switch (error) {
    case "invalid":
      return t(
        "The username or password is incorrect. Try again.",
        "نام کاربری یا گذرواژه درست نیست. دوباره تلاش کنید.",
      );
    case "locked":
      return t(
        "Too many attempts. Try again in 15 minutes or ask your Supervisor.",
        "تلاش‌های ناموفق بیش از حد است. 15 دقیقه دیگر دوباره تلاش کنید یا از سرپرست کمک بخواهید.",
      );
    case "too_short":
      return t(
        `Use at least ${minLength} characters.`,
        `حداقل ${minLength} نویسه وارد کنید.`,
      );
    case "common":
      return t(
        "This password is too common. Choose a different password.",
        "این گذرواژه بسیار رایج است. گذرواژهٔ دیگری انتخاب کنید.",
      );
    case "same_password":
      return t(
        "Choose a password different from your temporary password.",
        "گذرواژه‌ای متفاوت با گذرواژهٔ موقت انتخاب کنید.",
      );
    default:
      return "";
  }
}
function SignIn() {
  const { signIn, t, state, recentUsers, lang } = useDemo();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <AuthLayout>
      <h1>{t("Sign in", "ورود")}</h1>
      {state.config.session.registered_device_shows_recent_users &&
        recentUsers.length > 0 && (
          <div className="recent-users">
            <p className="helper">
              {t("Recent users on this computer", "کاربران اخیر این رایانه")}
            </p>
            <div className="recent-user-list">
              {recentUsers.map((user) => (
                <button
                  type="button"
                  className="recent-user"
                  key={user.username}
                  onClick={() => {
                    setUsername(user.username);
                    setPassword("");
                    setError("");
                  }}
                >
                  <Initials
                    name={demoUserLabel(user.name, lang)
                      .replace(/^Demo /, "")
                      .replace(/ نمایشی$/, "")}
                  />
                  <span>
                    {demoUserLabel(user.name, lang)
                      .replace(/^Demo /, "")
                      .replace(/ نمایشی$/, "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const result = signIn(username, password);
          if (result) {
            setError(authErrorCopy(result, t));
            return;
          }
          const user = demoUsers.find(
            (candidate) => candidate.username === username.trim().toLowerCase(),
          )!;
          window.location.hash =
            user.role === "supervisor"
              ? "dashboard"
              : user.role === "floor_worker"
                ? "invoices"
                : "lookup";
        }}
      >
        <Field label={t("Username", "نام کاربری")}>
          <input
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError("");
            }}
            autoComplete="username"
            dir="ltr"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
          />
        </Field>
        <PasswordField
          label={t("Password", "گذرواژه")}
          value={password}
          onChange={(value) => {
            setPassword(value);
            setError("");
          }}
          error={error}
        />
        <Button type="submit" className="signin-submit">
          {t("Sign in", "ورود")}
        </Button>
      </form>
      <p className="helper signin-help">
        {t(
          "Forgot your password? Ask your Supervisor to reset it.",
          "گذرواژه را فراموش کرده‌اید؟ از سرپرست بخواهید آن را بازنشانی کند.",
        )}
      </p>
      <p className="helper demo-account-hint">
        {t("Demo accounts:", "حساب‌های دمو:")}{" "}
        <LtrText>supervisor, floorworker, cashier</LtrText>
        {" / "}
        {t("password", "گذرواژه")} <LtrText>demo1234</LtrText>
        {". "}
        {t("New employee:", "کارمند جدید:")} <LtrText>newemployee</LtrText>
        {" / "}
        {t("temporary password", "گذرواژهٔ موقت")} <LtrText>temp1234</LtrText>.
      </p>
    </AuthLayout>
  );
}
function AuthLayout({ children }: { children: ReactNode }) {
  const { state, t } = useDemo();
  return (
    <div className="signin-page">
      <div className="signin-language">
        <LanguageToggle />
      </div>
      <Card className="signin-card">
        <span className="signin-logo-tile">
          <span className="brand-logo-window signin-logo-window">
            <img
              className="signin-logo"
              src={logo}
              alt={t(
                state.config.company.name_en,
                state.config.company.name_fa,
              )}
            />
          </span>
        </span>
        {children}
      </Card>
    </div>
  );
}
function ChoosePassword() {
  const { choosePassword, signOut, state, t } = useDemo();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  return (
    <AuthLayout>
      <h1>{t("Choose a new password", "انتخاب گذرواژهٔ جدید")}</h1>
      <p className="helper">
        {t(
          `Use at least ${state.config.session.password_min_length} characters. Avoid common passwords.`,
          `حداقل ${state.config.session.password_min_length} نویسه وارد کنید. از گذرواژه‌های رایج استفاده نکنید.`,
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (password !== confirmation) {
            setError(
              t(
                "The passwords do not match. Enter the same password in both fields.",
                "گذرواژه‌ها یکسان نیستند. در هر دو فیلد گذرواژهٔ یکسان وارد کنید.",
              ),
            );
            return;
          }
          const result = choosePassword(password);
          setError(
            authErrorCopy(result, t, state.config.session.password_min_length),
          );
        }}
      >
        <PasswordField
          label={t("New password", "گذرواژهٔ جدید")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          autoFocus
          error={error}
        />
        <PasswordField
          label={t("Confirm password", "تأیید گذرواژه")}
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
        />
        <Button type="submit" className="signin-submit">
          {t("Save password", "ذخیرهٔ گذرواژه")}
        </Button>
      </form>
      <Button variant="ghost" onClick={signOut}>
        {t("Sign out", "خروج")}
      </Button>
    </AuthLayout>
  );
}
function LockScreen() {
  const { user, unlock, signOut, t, lang } = useDemo();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <AuthLayout>
      <Initials name={demoUserLabel(user!.name, lang)} />
      <h1>{t("Screen locked", "صفحه قفل شده است")}</h1>
      <p>{demoUserLabel(user!.name, lang)}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(authErrorCopy(unlock(password), t));
        }}
      >
        <PasswordField
          label={t("Password", "گذرواژه")}
          value={password}
          onChange={setPassword}
          error={error}
          autoFocus
        />
        <Button type="submit" className="signin-submit">
          {t("Unlock", "باز کردن قفل")}
        </Button>
      </form>
      <Button variant="ghost" onClick={signOut}>
        {t("Sign in as someone else", "ورود به‌عنوان کاربر دیگر")}
      </Button>
    </AuthLayout>
  );
}
function Reauthenticate() {
  const { reauthenticate, navigate, t } = useDemo();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={() => navigate("dashboard")}
      title={t("Confirm your password", "تأیید گذرواژه")}
      description={t(
        "Enter your password to continue.",
        "برای ادامه گذرواژهٔ خود را وارد کنید.",
      )}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(authErrorCopy(reauthenticate(password), t));
        }}
      >
        <PasswordField
          label={t("Password", "گذرواژه")}
          value={password}
          onChange={setPassword}
          error={error}
          autoFocus
        />
        <div className="actions">
          <Button variant="secondary" onClick={() => navigate("dashboard")}>
            {t("Cancel", "انصراف")}
          </Button>
          <Button type="submit">{t("Continue", "ادامه")}</Button>
        </div>
      </form>
    </Dialog>
  );
}
const screenRegistry: Record<string, ReactNode> = {
  suppliers: <Suppliers />,
  lookup: <Lookup />,
  products: <Products />,
  product: <ProductPage />,
  invoices: <Invoices />,
  approvals: <Approvals />,
  alerts: <Alerts />,
  offers: <Offers />,
  labels: <Labels />,
  returns: <Returns />,
  return: <Returns />,
  expiry: <Expiry />,
  notes: <Notes />,
  payables: <Payables />,
  dashboard: <Dashboard />,
  settings: <PricingSettings />,
};
export default function App() {
  const {
    state,
    role,
    user,
    locked,
    authenticatedAt,
    mustChangePassword,
    branch,
    lang,
    theme,
    setTheme,
    comfortableText,
    setComfortableText,
    setBranch,
    signOut,
    lock,
    switchDemoUser,
    reset,
    resetGeneration,
    needsReauthentication,
    t,
  } = useDemo();
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.("(max-width: 760px)").matches ?? false,
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, setReauthenticationClock] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 760px)");
    if (!media) return;
    const resize = () => setIsMobile(media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash.slice(1));
      setMenuOpen(false);
    };
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key === "/" &&
        !target?.matches("input, textarea, [contenteditable=true]") &&
        searchRef.current
      ) {
        event.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", onShortcut);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onShortcut);
    };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const focusable = Array.from(
      document
        .getElementById("app-sidebar")
        ?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])") ?? [],
    );
    focusable[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.getElementById("menu-toggle")?.focus();
      }
      if (event.key === "Tab" && focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [menuOpen]);
  useEffect(() => {
    if (role !== "supervisor" || locked || mustChangePassword) return;
    const wait =
      authenticatedAt +
      state.config.session.reprompt_password_after_minutes * 60_000 -
      Date.now() +
      1;
    if (wait <= 0) return;
    const timer = window.setTimeout(
      () => setReauthenticationClock((current) => current + 1),
      wait,
    );
    return () => window.clearTimeout(timer);
  }, [
    role,
    locked,
    mustChangePassword,
    authenticatedAt,
    state.config.session.reprompt_password_after_minutes,
  ]);
  if (!role || !user) return <SignIn />;
  if (mustChangePassword) return <ChoosePassword />;
  if (locked) return <LockScreen />;
  const allowed = pages.filter((page) => page.roles.includes(role));
  const defaultKey =
    role === "supervisor"
      ? "dashboard"
      : role === "floor_worker"
        ? "invoices"
        : "lookup";
  const routeKey = hash.split("?")[0];
  const parentKey =
    routeKey === "product"
      ? "products"
      : routeKey === "return"
        ? "returns"
        : routeKey;
  const routeParams = new URLSearchParams(hash.split("?")[1]);
  const currentProduct =
    routeKey === "product"
      ? state.products.find(
          (item) =>
            item.company_id === state.config.company.seed_key &&
            item.code === routeParams.get("code"),
        )
      : undefined;
  const currentReturn =
    routeKey === "return"
      ? state.returns.find(
          (item) =>
            item.company_id === state.config.company.seed_key &&
            item.id === routeParams.get("id"),
        )
      : undefined;
  const returnBreadcrumb = currentReturn
    ? `${t("Return", "مرجوعی")} #${state.returns.filter((item) => item.company_id === state.config.company.seed_key).findIndex((item) => item.id === currentReturn.id) + 1}`
    : undefined;
  const supplierDetail =
    routeKey === "suppliers" ? routeParams.get("name") : null;
  const page =
    allowed.find(
      (candidate) => !candidate.disabled && candidate.key === parentKey,
    ) ?? allowed.find((candidate) => candidate.key === defaultKey)!;
  const inBranch = (record: { company_id: string; branch: Branch }) =>
    record.company_id === state.config.company.seed_key &&
    (branch === "all" || record.branch === branch || record.branch === "all");
  const unread = state.notes.filter(
    (note) =>
      inBranch(note) &&
      note.type === "note_to_supervisor" &&
      note.status === "open",
  ).length;
  const approvalCount = state.approvals.filter(
    (record) => inBranch(record) && record.status === "pending",
  ).length;
  const alertCount = state.alerts.filter(
    (record) => inBranch(record) && record.status === "pending",
  ).length;
  const notifications =
    role === "supervisor" ? unread + approvalCount + alertCount : 0;
  const groupNames: Record<string, [string, string]> = {
    Daily: ["Daily", "روزانه"],
    Catalog: ["Catalog", "کاتالوگ"],
    Supervisor: ["Supervisor", "سرپرست"],
    Admin: ["Admin", "مدیریت"],
  };

  return (
    <div
      className={`app-shell ${collapsed ? "is-collapsed" : ""}`}
      dir={lang === "fa" ? "rtl" : "ltr"}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        {t("Skip to content", "رفتن به محتوا")}
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label={t("Close menu", "بستن منو")}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="app-sidebar"
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label={t("Main menu", "منوی اصلی")}
      >
        <div className="sidebar-brand">
          <span className="brand-logo-tile">
            <span className="brand-logo-window">
              <img
                className="brand-logo"
                src={logo}
                alt={t(
                  state.config.company.name_en,
                  state.config.company.name_fa,
                )}
              />
            </span>
          </span>
          <span className="store-name">
            {t(state.config.company.name_en, state.config.company.name_fa)}
          </span>
        </div>
        <nav aria-label={t("Pages", "صفحه‌ها")}>
          {Object.entries(groupNames).map(([group, names]) => {
            const items = allowed.filter((item) => item.group === group);
            return items.length > 0 ? (
              <div className="nav-section" key={group}>
                <p className="nav-section-label">{t(...names)}</p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const count =
                    item.key === "notes" && role === "supervisor"
                      ? unread
                      : item.key === "approvals"
                        ? approvalCount
                        : item.key === "alerts"
                          ? alertCount
                          : 0;
                  return (
                    <a
                      key={item.key}
                      href={item.disabled ? undefined : `#${item.key}`}
                      role={item.disabled ? "link" : undefined}
                      aria-disabled={item.disabled || undefined}
                      tabIndex={item.disabled ? -1 : undefined}
                      aria-label={t(item.en, item.fa)}
                      title={
                        collapsed || item.disabled
                          ? t(item.en, item.fa)
                          : undefined
                      }
                      aria-current={page.key === item.key ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                      <span className="nav-item-label">
                        {t(item.en, item.fa)}
                      </span>
                      {count > 0 && (
                        <>
                          <span className="nav-count">{count}</span>
                          <span className="nav-count-dot" aria-hidden="true" />
                        </>
                      )}
                    </a>
                  );
                })}
              </div>
            ) : null;
          })}
        </nav>
        <div className="sidebar-user">
          <Menu
            className="user-menu"
            showChevron={false}
            aria-label={t("User menu", "منوی کاربر")}
            label={
              <span className="user-chip">
                <Initials name={demoUserLabel(user.name, lang)} />
                <span className="user-chip-copy">
                  <strong>{demoUserLabel(user.name, lang)}</strong>
                  <small>
                    <RoleName role={role} />
                  </small>
                </span>
              </span>
            }
          >
            <MenuItem onClick={lock}>
              <LockKeyhole size={20} strokeWidth={1.5} aria-hidden="true" />
              {t("Lock", "قفل")}
            </MenuItem>
            <MenuItem onClick={signOut}>
              <LogOut size={20} strokeWidth={1.5} aria-hidden="true" />
              {t("Sign out", "خروج")}
            </MenuItem>
          </Menu>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <IconButton
            id="menu-toggle"
            className="sidebar-toggle"
            aria-controls="app-sidebar"
            aria-expanded={isMobile ? menuOpen : !collapsed}
            aria-label={
              isMobile
                ? t(
                    menuOpen ? "Close menu" : "Open menu",
                    menuOpen ? "بستن منو" : "باز کردن منو",
                  )
                : t(
                    collapsed ? "Expand sidebar" : "Collapse sidebar",
                    collapsed ? "باز کردن نوار کناری" : "جمع کردن نوار کناری",
                  )
            }
            onClick={() => {
              if (isMobile) setMenuOpen((previous) => !previous);
              else setCollapsed((previous) => !previous);
            }}
          >
            <PanelLeftClose size={20} strokeWidth={1.5} />
          </IconButton>
          <nav
            className="breadcrumbs"
            aria-label={t("Breadcrumbs", "مسیر صفحه")}
          >
            <span>{branchLabel(branch, lang)}</span>
            <ChevronRight size={14} aria-hidden="true" />
            {currentProduct || currentReturn || supplierDetail ? (
              <>
                <a href={`#${page.key}`}>{t(page.en, page.fa)}</a>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">
                  {currentProduct ? (
                    <bdi dir="auto">
                      {lang === "fa"
                        ? currentProduct.name_fa
                        : currentProduct.name_en}
                    </bdi>
                  ) : supplierDetail ? (
                    <LtrText>{supplierDetail}</LtrText>
                  ) : (
                    <bdi dir="auto">{returnBreadcrumb}</bdi>
                  )}
                </span>
              </>
            ) : (
              <span aria-current="page">{t(page.en, page.fa)}</span>
            )}
            {page.key === "invoices" && state.invoice.status !== "empty" && (
              <>
                <ChevronRight size={14} aria-hidden="true" />
                <LtrText>{state.invoice.supplier_invoice_number}</LtrText>
              </>
            )}
          </nav>
          <form
            className="topbar-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              window.location.hash = `lookup?search=${encodeURIComponent(search.trim())}`;
            }}
          >
            <Search size={18} strokeWidth={1.5} aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("Search all products", "جست‌وجوی همهٔ محصولات")}
              placeholder={t("Search products", "جست‌وجوی محصولات")}
            />
            <kbd aria-hidden="true">/</kbd>
          </form>
          {role === "supervisor" ? (
            <Select
              className="branch-pill"
              aria-label={t("Branch", "شعبه")}
              value={branch}
              onChange={(value) => setBranch(value as Branch)}
              options={[...branches, "all" as const].map((value) => ({
                value,
                label: branchLabel(value, lang),
              }))}
            />
          ) : (
            <span className="branch-pill static">
              {branchLabel(branch, lang)}
            </span>
          )}
          <LanguageToggle />
          <IconButton
            aria-label={
              theme === "light"
                ? t("Switch to dark theme", "تغییر به تم تیره")
                : t("Switch to light theme", "تغییر به تم روشن")
            }
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? (
              <Moon size={20} strokeWidth={1.5} />
            ) : (
              <Sun size={20} strokeWidth={1.5} />
            )}
          </IconButton>
          <IconButton
            className="text-size-toggle"
            title={t("Comfortable text size", "اندازهٔ متن راحت")}
            aria-label={t("Comfortable text size", "اندازهٔ متن راحت")}
            aria-pressed={comfortableText}
            onClick={() => setComfortableText(!comfortableText)}
          >
            <span className="text-size-glyph" aria-hidden="true">
              Aa
            </span>
          </IconButton>
          <Menu
            className="notifications-menu"
            showChevron={false}
            aria-label={t(
              `Notifications, ${notifications} unread`,
              `اعلان‌ها، ${notifications} خوانده‌نشده`,
            )}
            label={
              <span className="notification-button">
                <Bell size={20} strokeWidth={1.5} aria-hidden="true" />
                {notifications > 0 && (
                  <span className="notification-count">{notifications}</span>
                )}
              </span>
            }
          >
            {role === "supervisor" ? (
              <>
                <MenuItem
                  onClick={() => {
                    window.location.hash = "approvals";
                  }}
                >
                  {t("Approvals", "تأییدها")} · {approvalCount}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    window.location.hash = "alerts";
                  }}
                >
                  {t("Alerts", "هشدارها")} · {alertCount}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    window.location.hash = "notes";
                  }}
                >
                  {t("Notes for Supervisor", "یادداشت‌های سرپرست")} · {unread}
                </MenuItem>
              </>
            ) : (
              <p className="helper">
                {t("No new notifications.", "اعلان جدیدی وجود ندارد.")}
              </p>
            )}
          </Menu>
          <Menu className="demo-menu" label={t("Demo", "دمو")}>
            {demoUsers.map((candidate) => (
              <MenuItem
                key={candidate.username}
                onClick={() => switchDemoUser(candidate.username)}
              >
                {t("Switch to", "تغییر به")}{" "}
                {demoUserLabel(candidate.name, lang)}
              </MenuItem>
            ))}
            {page.key === "invoices" &&
              state.invoice.status !== "empty" &&
              state.invoice.status !== "posted" && (
                <MenuItem
                  onClick={() =>
                    window.dispatchEvent(new Event("arzon:demo-invoice-answer"))
                  }
                >
                  {t(
                    "Use fictional demo answer",
                    "استفاده از پاسخ نمونهٔ خیالی",
                  )}
                </MenuItem>
              )}
            <MenuItem onClick={() => setResetOpen(true)}>
              <RotateCcw size={18} strokeWidth={1.5} aria-hidden="true" />
              {t("Reset demo", "بازنشانی دمو")}
            </MenuItem>
          </Menu>
        </header>
        <main
          id="main-content"
          className="main-content"
          key={resetGeneration}
          tabIndex={-1}
        >
          {needsReauthentication(page.key) ? (
            <Reauthenticate />
          ) : (
            (screenRegistry[
              allowed.some(
                (candidate) =>
                  candidate.key === parentKey && !candidate.disabled,
              )
                ? routeKey
                : page.key
            ] ?? screenRegistry[page.key])
          )}
        </main>
      </div>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("Reset demo", "بازنشانی دمو")}
        description={t(
          "Restore the fictional seed data and clear business changes made in this browser. Your account, preferences, and language stay the same.",
          "داده‌های خیالی اولیه بازیابی و تغییرات این مرورگر پاک می‌شوند. حساب، تنظیمات شخصی و زبان شما حفظ می‌شوند.",
        )}
        confirmLabel={t("Reset demo", "بازنشانی دمو")}
        onConfirm={reset}
      />
    </div>
  );
}
