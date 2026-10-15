import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  ArrowLeftRight,
  Bell,
  ChevronRight,
  BadgeCheck,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Moon,
  Package,
  PanelLeftClose,
  RotateCcw,
  Receipt,
  Search,
  Settings,
  Sun,
  Store,
  ShoppingCart,
  Tag,
  Tags,
  Truck,
} from "lucide-react";
import logo from "../../assets/arzon-logo.png?inline";
import { LtrText } from "./presentation";
import { branchLabel, moduleEnabled } from "./settings";
import UndoToasts from "./UndoToasts";
import { demoSeed } from "./config";
import { PersonalNotifications } from "./PersonalNotifications";
import { StoredFileImage } from "./stored-file";
import HistoryScreen from "./screens/History";
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
import Received from "./screens/Received";
import Orders from "./screens/Orders";
import BranchRequests from "./screens/BranchRequests";
import "./a2-shared.css";
import { useDemo } from "./store";
import type { Capability, RoleId } from "./authority-types";
import { configuredRoleLabel } from "./people-presentation.e1";
import LocationPicker from "./LocationPicker.e1";
import SecondSignInStep from "./AuthSteps.e1";
import LocationDashboard from "./screens/LocationDashboard";
import { useNavigationRestoration } from "./navigation";
import type { Branch } from "./types";
import {
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  Menu,
  MenuItem,
  MenuSubmenu,
} from "./ui";
import "./c5-shell-controls.css";
import "./klead-tokens.css";
import "./c6-shared.css";
import "./c7-shared.css";
import "./c8-catalog.css";

function CashierPublicProductLookup({ code }: { code: string }) {
  useEffect(() => {
    window.location.replace(`#lookup?search=${encodeURIComponent(code)}`);
  }, [code]);
  return null;
}

export const pages: {
  key: string;
  en: string;
  fa: string;
  icon: typeof Search;
  group: string;
  capabilities: Capability[];
  disabled?: boolean;
}[] = [
  {
    key: "lookup",
    en: "Lookup",
    fa: "جست‌وجو",
    icon: Search,
    group: "Daily",
    capabilities: ["lookup.read"],
  },
  {
    key: "invoices",
    en: "Invoices",
    fa: "فاکتورها",
    icon: Receipt,
    group: "Daily",
    capabilities: ["invoices.read"],
  },
  {
    key: "received",
    en: "Received",
    fa: "دریافت‌شده",
    icon: Truck,
    group: "Daily",
    capabilities: ["received.read"],
  },
  {
    key: "returns",
    en: "Returns",
    fa: "مرجوعی‌ها",
    icon: RotateCcw,
    group: "Daily",
    capabilities: ["returns.read"],
  },
  {
    key: "labels",
    en: "Labels",
    fa: "برچسب‌ها",
    icon: Tag,
    group: "Daily",
    capabilities: ["labels.read"],
  },
  {
    key: "expiry",
    en: "Date tracking",
    fa: "پیگیری تاریخ",
    icon: Archive,
    group: "Daily",
    capabilities: ["dates.read"],
  },
  {
    key: "notes",
    en: "Notes",
    fa: "یادداشت‌ها",
    icon: MessageSquare,
    group: "Daily",
    capabilities: ["notes.read", "notebooks.read"],
  },
  {
    key: "requests",
    en: "Branch requests",
    fa: "درخواست‌های شعب",
    icon: ArrowLeftRight,
    group: "Daily",
    capabilities: ["branch_requests.read"],
  },
  {
    key: "products",
    en: "Products",
    fa: "محصولات",
    icon: Package,
    group: "Catalog",
    capabilities: ["catalog.read"],
  },
  {
    key: "offers",
    en: "Offers",
    fa: "پیشنهادهای فروش",
    icon: Tags,
    group: "Catalog",
    capabilities: ["offers.read"],
  },
  {
    key: "suppliers",
    en: "Suppliers",
    fa: "تأمین‌کنندگان",
    icon: Store,
    group: "Catalog",
    capabilities: ["suppliers.read"],
  },
  {
    key: "dashboard",
    en: "Dashboard",
    fa: "داشبورد",
    icon: LayoutDashboard,
    group: "Management",
    capabilities: ["dashboard.company", "dashboard.location"],
  },
  {
    key: "approvals",
    en: "Approvals",
    fa: "تأییدها",
    icon: BadgeCheck,
    group: "Management",
    capabilities: ["approvals.read"],
  },
  {
    key: "alerts",
    en: "Alerts",
    fa: "هشدارها",
    icon: Bell,
    group: "Management",
    capabilities: ["alerts.read"],
  },
  {
    key: "payables",
    en: "Payables",
    fa: "حساب‌های پرداختنی",
    icon: CreditCard,
    group: "Management",
    capabilities: ["payables.read"],
  },
  {
    key: "orders",
    en: "Orders",
    fa: "سفارش‌ها",
    icon: ShoppingCart,
    group: "Management",
    capabilities: ["orders.read"],
  },
  {
    key: "settings",
    en: "Settings",
    fa: "تنظیمات",
    icon: Settings,
    group: "Admin",
    capabilities: ["settings.manage"],
  },
  {
    key: "history",
    en: "History",
    fa: "تاریخچه",
    icon: History,
    group: "Admin",
    capabilities: ["history.read_all", "history.read_own"],
  },
];
export function RoleName({ role }: { role: RoleId }) {
  const { state, lang } = useDemo();
  return configuredRoleLabel(state.config, role, lang);
}
function personName(
  person: { name_en: string; name_fa?: string },
  lang: "en" | "fa",
) {
  return lang === "fa" ? person.name_fa || person.name_en : person.name_en;
}
function LanguageToggle() {
  const { lang, setLang, t, state } = useDemo();
  const nextLanguage = lang === "en" ? "fa" : "en";
  if (!state.config.company.ui_languages.includes(nextLanguage)) return null;
  return (
    <IconButton
      className="language-toggle"
      lang={nextLanguage}
      aria-label={
        nextLanguage === "fa"
          ? t("Switch to Persian", "تغییر به فارسی")
          : t("Switch to English", "تغییر به انگلیسی")
      }
      onClick={() => setLang(nextLanguage)}
    >
      {nextLanguage === "fa" ? "فا" : "EN"}
    </IconButton>
  );
}
function Initials({ name }: { name: string }) {
  return (
    <span className="user-avatar" aria-hidden="true">
      {name
        .split(" ")
        .filter(Boolean)
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
        <IconButton
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
        </IconButton>
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
  error: string | null,
  t: (en: string, fa: string) => string,
  policy: { password_min_length: number; lockout_minutes: number },
  managerLabel: { en: string; fa: string },
): string {
  switch (error) {
    case "invalid":
      return t(
        "The username or password is incorrect. Try again.",
        "نام کاربری یا گذرواژه درست نیست. دوباره تلاش کنید.",
      );
    case "locked":
      return t(
        `Too many attempts. Try again in ${policy.lockout_minutes} minutes or ask your ${managerLabel.en}.`,
        `تلاش‌های ناموفق بیش از حد است. ${policy.lockout_minutes} دقیقه دیگر دوباره تلاش کنید یا از ${managerLabel.fa} کمک بخواهید.`,
      );
    case "location":
      return t(
        `This location is unavailable for your role. Ask your ${managerLabel.en} to check your location assignment.`,
        `این مکان برای نقش شما در دسترس نیست. از ${managerLabel.fa} بخواهید محل تعیین‌شدهٔ شما را بررسی کند.`,
      );
    case "too_short":
      return t(
        `Use at least ${policy.password_min_length} characters.`,
        `حداقل ${policy.password_min_length} نویسه وارد کنید.`,
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
      return error
        ? t(
            "Sign-in could not be completed. Try again.",
            "ورود کامل نشد. دوباره تلاش کنید.",
          )
        : "";
  }
}
function useAuthErrorCopy() {
  const { state, t } = useDemo();
  const managerLabel = {
    en: configuredRoleLabel(state.config, "manager", "en"),
    fa: configuredRoleLabel(state.config, "manager", "fa"),
  };
  return (error: string | null) =>
    authErrorCopy(error, t, state.config.session, managerLabel);
}
function SignIn() {
  const authError = useAuthErrorCopy();
  const { signIn, t, state, recentUsers, demoUsers, lang } = useDemo();
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
                <Button
                  variant="secondary"
                  className="recent-user"
                  key={user.username}
                  onClick={() => {
                    setUsername(user.username);
                    setPassword("");
                    setError("");
                  }}
                >
                  <Initials
                    name={personName(user, lang)
                      .replace(/^Demo /, "")
                      .replace(/ نمایشی$/, "")}
                  />
                  <span>
                    {personName(user, lang)
                      .replace(/^Demo /, "")
                      .replace(/ نمایشی$/, "")}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void signIn(username, password).then((result) => {
            if (result) setError(authError(result));
          });
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
          "Forgot your password? Ask a person who manages accounts to reset it.",
          "گذرواژه را فراموش کرده‌اید؟ از مسئول حساب‌ها بخواهید آن را بازنشانی کند.",
        )}
      </p>
      {demoUsers.length > 0 && (
        <p className="helper demo-account-hint">
          {t("Demo accounts:", "حساب‌های دمو:")}{" "}
          <LtrText>{demoUsers.map((user) => user.username).join(", ")}</LtrText>
          {" / "}
          {t("Fresh demo password", "گذرواژهٔ دموی تازه")}{" "}
          <LtrText>demo1234</LtrText>
        </p>
      )}
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
            <StoredFileImage
              className="signin-logo"
              value={state.config.company.logo_data ?? logo}
              companyId={state.config.company.seed_key}
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
  const authError = useAuthErrorCopy();
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
        noValidate
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
          void result.then((error) => setError(authError(error)));
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
      <Button variant="secondary" onClick={signOut}>
        {t("Sign out", "خروج")}
      </Button>
    </AuthLayout>
  );
}
function LockScreen() {
  const authError = useAuthErrorCopy();
  const { user, unlock, signOut, t, lang } = useDemo();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <AuthLayout>
      <Initials name={personName(user!, lang)} />
      <h1>{t("Screen locked", "صفحه قفل شده است")}</h1>
      <p>{personName(user!, lang)}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void unlock(password).then((error) => setError(authError(error)));
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
      <Button variant="secondary" onClick={signOut}>
        {t("Sign in as someone else", "ورود به‌عنوان کاربر دیگر")}
      </Button>
    </AuthLayout>
  );
}
function Reauthenticate() {
  const authError = useAuthErrorCopy();
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
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void reauthenticate(password).then((error) =>
            setError(authError(error)),
          );
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
function LocationUnavailable() {
  const { signOut, t } = useDemo();
  const authError = useAuthErrorCopy();
  return (
    <AuthLayout>
      <p className="form-error" role="alert">
        {authError("location")}
      </p>
      <Button variant="neutral" onClick={() => void signOut()}>
        {t("Sign out", "خروج")}
      </Button>
    </AuthLayout>
  );
}
const screenRegistry: Record<string, ReactNode> = {
  suppliers: <Suppliers />,
  history: <HistoryScreen />,
  lookup: <Lookup />,
  products: <Products />,
  product: <ProductPage />,
  invoices: <Invoices />,
  received: <Received />,
  orders: <Orders />,
  requests: <BranchRequests />,
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
    demoUsers,
    state,
    actor,
    can,
    permission,
    authStage,
    locationIds,
    locationSelection,
    role,
    user,
    locked,
    authenticatedAt,
    mustChangePassword,
    branch,
    lang,
    setLang,
    theme,
    setTheme,
    comfortableText,
    setComfortableText,
    signOut,
    lock,
    switchDemoUser,
    reset,
    resetGeneration,
    needsReauthentication,
    t,
  } = useDemo();
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  useNavigationRestoration();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [compactWidth, setCompactWidth] = useState(
    () => window.innerWidth >= 760 && window.innerWidth < 1280,
  );
  const effectiveCollapsed = collapsed || compactWidth;
  const [compactGroups, setCompactGroups] = useState(
    () => window.matchMedia?.("(max-height: 1020px)").matches ?? false,
  );
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(
    () =>
      window.matchMedia?.("(max-width: 759px)").matches ??
      window.innerWidth < 760,
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [, setReauthenticationClock] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const resize = () =>
      setCompactWidth(window.innerWidth >= 760 && window.innerWidth < 1280);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.("(max-height: 1020px)");
    if (!media) return;
    const resize = () => setCompactGroups(media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 759px)");
    if (!media) return;
    const resize = () => setIsMobile(media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash.slice(1));
      setMenuOpen(false);
      setExpandedGroup(null);
      setSearchOpen(false);
    };
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key === "/" &&
        !target?.matches("input, textarea, [contenteditable=true]") &&
        !target?.closest("dialog[open]")
      ) {
        event.preventDefault();
        if (window.innerWidth < 1280) setSearchOpen(true);
        else searchRef.current?.focus();
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
    if (!actor || locked || mustChangePassword) return;
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
    actor,
    locked,
    mustChangePassword,
    authenticatedAt,
    state.config.session.reprompt_password_after_minutes,
  ]);
  if (authStage === "loading")
    return (
      <AuthLayout>
        <p role="status">{t("Loading…", "در حال بارگذاری…")}</p>
      </AuthLayout>
    );
  if (authStage === "password") return <ChoosePassword />;
  if (
    authStage === "second_step_setup" ||
    authStage === "second_step_challenge"
  )
    return (
      <AuthLayout>
        <SecondSignInStep />
      </AuthLayout>
    );
  if (authStage === "locked") return <LockScreen />;
  if (authStage === "location") return <LocationUnavailable />;
  if (!actor || !role || !user) return <SignIn />;
  const allowed = pages.filter(
    (page) =>
      moduleEnabled(state.config, page.key) &&
      (role !== "cashier" || page.key === "lookup") &&
      page.capabilities.some((capability) => {
        const decision = permission(capability);
        // A recent-password requirement keeps the permitted route visible.
        // Its data remains protected; the route renders Reauthenticate below.
        return decision.allowed || decision.reason === "freshness";
      }) &&
      (page.key !== "dashboard" ||
        can("dashboard.company") ||
        role === "branch_supervisor") &&
      (page.key !== "notes" || state.notebooks?.length || can("notes.read")),
  );
  const defaultKey =
    can("dashboard.company") || role === "branch_supervisor"
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
    ) ??
    allowed.find((candidate) => candidate.key === defaultKey) ??
    allowed[0];
  if (!page)
    return (
      <Card>
        <p>
          {t(
            "You do not have permission for this action.",
            "اجازهٔ انجام این کار را ندارید.",
          )}
        </p>
        <Button onClick={() => void signOut()}>{t("Sign out", "خروج")}</Button>
      </Card>
    );
  const requestedKnownRouteDenied = Boolean(
    parentKey &&
    pages.some((candidate) => candidate.key === parentKey) &&
    !allowed.some((candidate) => candidate.key === parentKey),
  );
  // Preserve the Cashier's safe home for plain unsupported destinations. Any
  // entity/location query or detail route still uses the existing denial path.
  const cashierSafeTopLevelFallback =
    requestedKnownRouteDenied &&
    role === "cashier" &&
    routeKey === parentKey &&
    !hash.includes("?") &&
    page.key === "lookup" &&
    !page.disabled &&
    allowed.some(
      (candidate) => candidate.key === "lookup" && !candidate.disabled,
    );
  const cashierPublicProductLookup =
    requestedKnownRouteDenied &&
    role === "cashier" &&
    routeKey === "product" &&
    Array.from(routeParams.keys()).length === 1 &&
    routeParams.has("code") &&
    Boolean(routeParams.get("code")) &&
    currentProduct?.status !== "archived" &&
    Boolean(currentProduct) &&
    page.key === "lookup" &&
    !page.disabled &&
    can("lookup.read", {
      company_id: actor.company_id,
      kind: "company_shared",
    });
  const routeDetailId = routeParams.get("id");
  const detailInvoice =
    page.key === "invoices" && routeDetailId
      ? [
          ...(state.invoice ? [state.invoice] : []),
          ...(state.invoices ?? []),
        ].find(
          (item) =>
            item.id === routeDetailId &&
            item.company_id === actor.company_id &&
            locationIds.includes(item.branch),
        )
      : undefined;
  const detailOrder =
    page.key === "orders" && routeDetailId
      ? state.orders?.find(
          (item) =>
            item.id === routeDetailId &&
            item.company_id === actor.company_id &&
            locationIds.includes(item.branch),
        )
      : undefined;
  const detailRequest =
    page.key === "requests" && routeDetailId
      ? state.branch_requests?.find(
          (item) =>
            item.id === routeDetailId &&
            item.company_id === actor.company_id &&
            (locationIds.includes(item.from_branch) ||
              locationIds.includes(item.to_branch)),
        )
      : undefined;
  const detailBreadcrumb = currentProduct
    ? lang === "fa"
      ? currentProduct.name_fa
      : currentProduct.name_en
    : currentReturn
      ? returnBreadcrumb
      : (supplierDetail ??
        detailInvoice?.supplier_invoice_number ??
        detailOrder?.reference ??
        detailRequest?.reference);
  const inBranch = (record: { company_id: string; branch: Branch }) =>
    record.company_id === state.config.company.seed_key &&
    (record.branch === "all" || locationIds.includes(record.branch));
  const customUnread = (state.notebook_entries ?? []).filter(
    (entry) => entry.notify_supervisor && entry.status === "open",
  ).length;
  const unread =
    state.notes.filter(
      (note) =>
        inBranch(note) &&
        !note.archived &&
        note.type === "note_to_supervisor" &&
        note.status === "open",
    ).length + customUnread;
  const approvalCount =
    state.approvals.filter(
      (record) => inBranch(record) && record.status === "pending",
    ).length +
    (state.sale_requests ?? []).filter(
      (record) => inBranch(record) && record.status === "pending",
    ).length;
  const alertCount = state.alerts.filter(
    (record) => inBranch(record) && record.status === "pending",
  ).length;
  const personalNotifications = state.notifications ?? [];
  const personalUnread = personalNotifications.filter(
    (record) => !record.read_at,
  ).length;
  const notifications =
    personalUnread +
    (can("dashboard.company") ? unread + approvalCount + alertCount : 0);
  const groupNames: Record<string, [string, string]> = {
    Daily: ["Daily", "روزانه"],
    Catalog: ["Catalog", "کاتالوگ"],
    Management: [
      configuredRoleLabel(state.config, "manager", "en"),
      configuredRoleLabel(state.config, "manager", "fa"),
    ],
    Admin: ["Admin", "مدیریت"],
  };

  const accountLabel = (
    <span className="user-chip">
      <Initials name={personName(user, lang)} />
      <span className="user-chip-copy">
        <strong>{personName(user, lang)}</strong>
        <small>
          <RoleName role={role} />
        </small>
      </span>
    </span>
  );
  const accountItems = (
    <>
      <MenuItem onClick={lock}>
        <LockKeyhole size={20} strokeWidth={1.5} aria-hidden="true" />
        {t("Lock", "قفل")}
      </MenuItem>
      <MenuItem onClick={signOut}>
        <LogOut size={20} strokeWidth={1.5} aria-hidden="true" />
        {t("Sign out", "خروج")}
      </MenuItem>
    </>
  );
  const demoItems = (
    <>
      <p className="helper">
        {t("Demo with fictional data", "دمو با داده‌های ساختگی")}
      </p>
      {demoUsers.map((candidate) => (
        <MenuItem
          key={candidate.username}
          onClick={() => switchDemoUser(candidate.username)}
        >
          {t("Switch to", "تغییر به")} {personName(candidate, lang)}
        </MenuItem>
      ))}
      {page.key === "invoices" &&
        state.invoice !== null &&
        state.invoice.status !== "empty" &&
        state.invoice.status !== "posted" && (
          <MenuItem
            onClick={() =>
              window.dispatchEvent(new Event("arzon:demo-invoice-answer"))
            }
          >
            {t("Use fictional demo answer", "استفاده از پاسخ نمونهٔ خیالی")}
          </MenuItem>
        )}
      <MenuItem
        onClick={() => {
          const original = document.createElement("a");
          original.href = "/demo-originals/fictional-hw-5012.svg";
          original.download =
            demoSeed.sales_demo.cost_increase_invoice.original_file_name;
          original.click();
        }}
      >
        <Download size={18} strokeWidth={1.5} aria-hidden="true" />
        {t("Download demo original", "دانلود اصل فاکتور نمونه")} ·{" "}
        <LtrText>
          {demoSeed.sales_demo.cost_increase_invoice.supplier_invoice_number}
        </LtrText>
      </MenuItem>
      {can("demo.reset") && (
        <MenuItem onClick={() => setResetOpen(true)}>
          <RotateCcw size={18} strokeWidth={1.5} aria-hidden="true" />
          {t("Reset demo", "بازنشانی دمو")}
        </MenuItem>
      )}
    </>
  );

  return (
    <div
      className={`app-shell ${effectiveCollapsed ? "is-collapsed" : ""} ${menuOpen ? "menu-open" : ""}`}
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
        className={`sidebar ${menuOpen ? "is-open" : ""} ${compactGroups ? "has-compact-groups" : ""}`}
        aria-label={t("Main menu", "منوی اصلی")}
      >
        <div className="sidebar-brand">
          <span className="brand-logo-tile">
            <span className="brand-logo-window">
              <StoredFileImage
                className="brand-logo"
                value={state.config.company.logo_data ?? logo}
                companyId={state.config.company.seed_key}
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
            const open =
              effectiveCollapsed ||
              !compactGroups ||
              (expandedGroup ?? page.group) === group;
            return items.length > 0 ? (
              <div className="nav-section" key={group}>
                {compactGroups ? (
                  <Button
                    variant="ghost"
                    data-control-kind="widget"
                    className="nav-group-toggle"
                    aria-expanded={open}
                    aria-controls={`nav-group-${group}`}
                    title={effectiveCollapsed ? t(...names) : undefined}
                    onClick={() => setExpandedGroup(open ? "" : group)}
                  >
                    <span className="nav-section-label">{t(...names)}</span>
                    <ChevronRight
                      size={16}
                      className={open ? "nav-group-expanded" : "directional"}
                      aria-hidden="true"
                    />
                  </Button>
                ) : (
                  <p className="nav-section-label">{t(...names)}</p>
                )}
                <div id={`nav-group-${group}`} hidden={!open}>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const count =
                      item.key === "notes" && can("notes.status_manage")
                        ? unread
                        : item.key === "requests"
                          ? (state.branch_requests ?? []).filter(
                              (request) =>
                                request.status !== "closed" &&
                                request.status !== "cancelled",
                            ).length
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
                          item.disabled && !effectiveCollapsed
                            ? t(item.en, item.fa)
                            : undefined
                        }
                        aria-current={
                          page.key === item.key ? "page" : undefined
                        }
                        onClick={() => setMenuOpen(false)}
                      >
                        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                        <span className="nav-item-label">
                          {t(item.en, item.fa)}
                        </span>
                        {count > 0 && (
                          <>
                            <span
                              className={`nav-count ${["approvals", "alerts"].includes(item.key) ? "nav-count-attention" : ""}`}
                            >
                              {count}
                            </span>
                            <span
                              className="nav-count-dot"
                              aria-hidden="true"
                            />
                          </>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : null;
          })}
        </nav>
        {!isMobile && (
          <>
            <div className="sidebar-user">
              <Menu
                className="user-menu"
                showChevron={false}
                aria-label={t("User menu", "منوی کاربر")}
                label={accountLabel}
              >
                {accountItems}
              </Menu>
            </div>
          </>
        )}
      </aside>
      <div className="workspace">
        <header className="topbar">
          <IconButton
            id="menu-toggle"
            className="sidebar-toggle"
            aria-controls="app-sidebar"
            aria-expanded={isMobile || compactWidth ? menuOpen : !collapsed}
            aria-label={
              isMobile || compactWidth
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
              if (isMobile || compactWidth)
                setMenuOpen((previous) => !previous);
              else setCollapsed((previous) => !previous);
            }}
          >
            <PanelLeftClose size={20} strokeWidth={1.5} />
          </IconButton>
          <nav
            className="breadcrumbs"
            aria-label={t("Breadcrumbs", "مسیر صفحه")}
          >
            <a className="breadcrumb-location" href={`#${defaultKey}`}>
              {locationSelection?.kind === "all_my_locations"
                ? t("All my locations", "همه مکان‌های من")
                : locationSelection?.kind === "all_locations"
                  ? t("All locations", "همه مکان‌ها")
                  : branchLabel(state.config, branch, lang)}
            </a>
            <ChevronRight size={14} aria-hidden="true" />
            <a
              className="breadcrumb-page"
              href={`#${page.key}`}
              aria-current={detailBreadcrumb ? undefined : "page"}
            >
              {t(page.en, page.fa)}
            </a>
            {detailBreadcrumb && (
              <>
                <ChevronRight size={14} aria-hidden="true" />
                <a href={`#${hash}`} aria-current="page">
                  <bdi dir="auto">{detailBreadcrumb}</bdi>
                </a>
              </>
            )}
          </nav>
          {!isMobile && !compactWidth && (
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
          )}
          {!isMobile && compactWidth && (
            <IconButton
              className="topbar-search-icon"
              aria-label={t("Search all products", "جست‌وجوی همهٔ محصولات")}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={20} strokeWidth={1.5} />
            </IconButton>
          )}
          <LocationPicker />
          {!isMobile && (
            <>
              <LanguageToggle />
              <IconButton
                className="theme-toggle"
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
            </>
          )}
          <Menu
            className="notifications-menu"
            iconOnly
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
            <PersonalNotifications />
            {can("dashboard.company") ? (
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
            ) : personalNotifications.length === 0 ? (
              <p className="helper">
                {t("No new notifications.", "اعلان جدیدی وجود ندارد.")}
              </p>
            ) : null}
          </Menu>
          {!isMobile && (
            <Menu className="demo-menu" label={t("Demo", "دمو")}>
              {demoItems}
            </Menu>
          )}
          {isMobile && (
            <>
              <Menu
                className="mobile-account-menu"
                iconOnly
                showChevron={false}
                aria-label={t("User menu", "منوی کاربر")}
                label={accountLabel}
              >
                {accountItems}
              </Menu>
              <Menu
                className="mobile-more-menu"
                minWidth={296}
                iconOnly
                showChevron={false}
                label={t("More", "بیشتر")}
                icon={
                  <MoreHorizontal
                    size={20}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                }
              >
                <MenuItem
                  className="mobile-search-action"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search size={20} aria-hidden="true" />
                  {t("Search all products", "جست‌وجوی همهٔ محصولات")}
                </MenuItem>
                {state.config.company.ui_languages.includes(
                  lang === "en" ? "fa" : "en",
                ) && (
                  <MenuItem
                    onClick={() => setLang(lang === "en" ? "fa" : "en")}
                  >
                    {lang === "en"
                      ? t("Switch to Persian", "تغییر به فارسی")
                      : t("Switch to English", "تغییر به انگلیسی")}
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                >
                  {theme === "light"
                    ? t("Switch to dark theme", "تغییر به تم تیره")
                    : t("Switch to light theme", "تغییر به تم روشن")}
                </MenuItem>
                <MenuItem
                  aria-pressed={comfortableText}
                  onClick={() => setComfortableText(!comfortableText)}
                >
                  {t("Comfortable text size", "اندازهٔ متن راحت")}
                </MenuItem>
                <MenuSubmenu label={t("Demo", "دمو")}>{demoItems}</MenuSubmenu>
              </Menu>
            </>
          )}
        </header>
        <main
          id="main-content"
          className="main-content"
          key={resetGeneration}
          tabIndex={-1}
        >
          {cashierPublicProductLookup && currentProduct ? (
            <CashierPublicProductLookup code={currentProduct.code} />
          ) : requestedKnownRouteDenied && !cashierSafeTopLevelFallback ? (
            <Card>
              <p>
                {parentKey === "settings"
                  ? t(
                      "Only an Owner or Manager can change Settings.",
                      "فقط مالک یا مدیر می‌تواند تنظیمات را تغییر دهد.",
                    )
                  : t(
                      "You do not have permission for this action.",
                      "اجازهٔ انجام این کار را ندارید.",
                    )}
              </p>
            </Card>
          ) : needsReauthentication(page.key) ? (
            <Reauthenticate />
          ) : page.key === "dashboard" && !can("dashboard.company") ? (
            <LocationDashboard />
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
      <Dialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title={t("Search products", "جست‌وجوی محصولات")}
        className="topbar-search-dialog"
      >
        {searchOpen && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              window.location.hash = `lookup?search=${encodeURIComponent(search.trim())}`;
              setSearchOpen(false);
            }}
          >
            <Field label={t("Search all products", "جست‌وجوی همهٔ محصولات")}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
            <div className="actions">
              <Button variant="neutral" onClick={() => setSearchOpen(false)}>
                {t("Cancel", "لغو")}
              </Button>
              <Button type="submit">{t("Search", "جست‌وجو")}</Button>
            </div>
          </form>
        )}
      </Dialog>
      <UndoToasts />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("Reset demo", "بازنشانی دمو")}
        description={t(
          "Restore the fictional business data and the six demo people. People changes and business changes made in this browser are cleared. Your preferences and language stay the same.",
          "داده‌های کسب‌وکار خیالی و شش کاربر دمو بازیابی می‌شوند. تغییرات کاربران و کسب‌وکار این مرورگر پاک می‌شوند. تنظیمات شخصی و زبان شما حفظ می‌شوند.",
        )}
        confirmLabel={t("Reset demo", "بازنشانی دمو")}
        onConfirm={reset}
      />
    </div>
  );
}
