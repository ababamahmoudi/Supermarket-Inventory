import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  Archive,
  Bell,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  RotateCcw,
  Search,
  Settings,
  Tag,
  Tags,
  Truck,
  X,
} from "lucide-react";
import logo from "../../assets/arzon-logo.png";
import PricingSettings from "./screens/Settings";
import { branches, demoUsers, useDemo } from "./store";
import type { Branch, Role } from "./types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
} from "./ui";

export const pages = [
  {
    key: "lookup",
    en: "Cashier lookup",
    fa: "جست‌وجوی صندوق‌دار",
    icon: Search,
    roles: ["cashier", "floor_worker", "supervisor"],
  },
  {
    key: "invoices",
    en: "Invoices",
    fa: "فاکتورها",
    icon: Truck,
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "approvals",
    en: "Approvals",
    fa: "تأییدها",
    icon: ClipboardList,
    roles: ["supervisor"],
  },
  {
    key: "alerts",
    en: "Alerts",
    fa: "هشدارها",
    icon: Bell,
    roles: ["supervisor"],
  },
  {
    key: "offers",
    en: "Offers",
    fa: "پیشنهادهای فروش",
    icon: Tags,
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "labels",
    en: "Labels",
    fa: "برچسب‌ها",
    icon: Tag,
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "returns",
    en: "Returns",
    fa: "مرجوعی‌ها",
    icon: RotateCcw,
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "expiry",
    en: "Date tracking",
    fa: "پیگیری تاریخ",
    icon: Archive,
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "notes",
    en: "Notes",
    fa: "یادداشت‌ها",
    icon: MessageSquare,
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "payables",
    en: "Payables",
    fa: "حساب‌های پرداختنی",
    icon: CreditCard,
    roles: ["supervisor"],
  },
  {
    key: "dashboard",
    en: "Dashboard",
    fa: "داشبورد",
    icon: LayoutDashboard,
    roles: ["supervisor"],
  },
  {
    key: "products",
    en: "Products",
    fa: "محصولات",
    icon: Package,
    roles: ["floor_worker", "supervisor"],
  },
  {
    key: "settings",
    en: "Settings",
    fa: "تنظیمات",
    icon: Settings,
    roles: ["supervisor"],
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
        aria-pressed={lang === "en"}
        onClick={() => setLang("en")}
      >
        English
      </button>
      <button
        type="button"
        lang="fa"
        aria-pressed={lang === "fa"}
        onClick={() => setLang("fa")}
      >
        فارسی
      </button>
    </div>
  );
}
function SignIn({
  selectedRole,
  setSelectedRole,
}: {
  selectedRole: Role;
  setSelectedRole: (role: Role) => void;
}) {
  const { signIn, t, state } = useDemo();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const user = demoUsers.find((candidate) => candidate.role === selectedRole)!;
  function submit() {
    if (!signIn(selectedRole, pin)) {
      setError(
        t(
          "Use the demo PIN shown below for the selected role.",
          "برای نقش انتخاب‌شده از رمز نمایشی زیر استفاده کنید.",
        ),
      );
      return;
    }
    window.location.hash =
      selectedRole === "supervisor"
        ? "dashboard"
        : selectedRole === "floor_worker"
          ? "invoices"
          : "lookup";
  }
  return (
    <div className="signin-page">
      <div className="signin-language">
        <LanguageToggle />
      </div>
      <Card className="signin-card">
        <div className="logo-tile">
          <img
            src={logo}
            alt={t(state.config.company.name_en, state.config.company.name_fa)}
          />
        </div>
        <PageHeader
          title={t("Sign in as", "ورود با نقش")}
          description={t(
            "Choose a fictional demo user. No real account is needed.",
            "یک کاربر نمایشی را انتخاب کنید. نیازی به حساب واقعی نیست.",
          )}
        />
        <div
          className="role-options"
          role="radiogroup"
          aria-label={t("Demo role", "نقش نمایشی")}
        >
          {(["supervisor", "floor_worker", "cashier"] as Role[]).map((role) => (
            <button
              type="button"
              role="radio"
              aria-checked={selectedRole === role}
              key={role}
              className={
                selectedRole === role ? "role-option selected" : "role-option"
              }
              onClick={() => {
                setSelectedRole(role);
                setPin("");
                setError("");
              }}
            >
              <RoleName role={role} />
            </button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Field
            label={t("Demo PIN", "رمز نمایشی")}
            error={error}
            hint={t(
              `For this demo, use ${user.pin}.`,
              `برای این دمو از ${user.pin} استفاده کنید.`,
            )}
          >
            <input
              autoComplete="off"
              inputMode="numeric"
              type="password"
              value={pin}
              maxLength={4}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, ""));
                setError("");
              }}
            />
          </Field>
          <div className="pin-pad" aria-label={t("PIN pad", "صفحهٔ رمز")}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <Button
                key={digit}
                variant="secondary"
                onClick={() =>
                  setPin((previous) => (previous + digit).slice(0, 4))
                }
              >
                {digit}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setPin("")}>
              {t("Clear", "پاک کردن")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPin((previous) => (previous + "0").slice(0, 4))}
            >
              0
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPin((previous) => previous.slice(0, -1))}
              aria-label={t("Remove last digit", "حذف آخرین رقم")}
            >
              ⌫
            </Button>
          </div>
          <Button type="submit" className="signin-submit">
            {t("Sign in", "ورود")}
          </Button>
        </form>
        <p className="helper">
          {t(
            "Browser demo · Fictional data · No real authentication",
            "دموی مرورگر · داده‌های خیالی · بدون احراز هویت واقعی",
          )}
        </p>
      </Card>
    </div>
  );
}

/** Business screens are added in the next small pull requests. */
const screenRegistry: Record<string, ReactNode> = {
  settings: <PricingSettings />,
};
function Placeholder({ page }: { page: (typeof pages)[number] }) {
  const { t } = useDemo();
  return (
    <>
      <PageHeader
        title={t(page.en, page.fa)}
        description={t(
          "Phase 0 browser prototype",
          "نمونهٔ اولیهٔ مرورگر در فاز 0",
        )}
      />
      <Card>
        <EmptyState>
          {t(
            "The demo shell is ready. This workflow is added in the next prototype steps.",
            "پوستهٔ دمو آماده است. این بخش در مراحل بعدی نمونهٔ اولیه اضافه می‌شود.",
          )}
        </EmptyState>
      </Card>
      {page.key === "invoices" && (
        <p className="helper">
          {t(
            "Demo: AI invoice reading is simulated",
            "دمو: خواندن فاکتور با هوش مصنوعی شبیه‌سازی شده است",
          )}
        </p>
      )}
    </>
  );
}
export default function App() {
  const {
    state,
    role,
    branch,
    lang,
    setBranch,
    signOut,
    lock,
    reset,
    resetGeneration,
    t,
  } = useDemo();
  const [selectedRole, setSelectedRole] = useState<Role>("cashier");
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash.slice(1));
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = document.getElementById("app-sidebar");
    const focusable = Array.from(
      sidebar?.querySelectorAll<HTMLElement>(
        "a[href],button:not([disabled])",
      ) ?? [],
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
  if (!role)
    return (
      <SignIn selectedRole={selectedRole} setSelectedRole={setSelectedRole} />
    );
  const allowed = pages.filter((page) => page.roles.includes(role));
  const defaultKey =
    role === "supervisor"
      ? "dashboard"
      : role === "floor_worker"
        ? "invoices"
        : "lookup";
  const page =
    allowed.find((candidate) => candidate.key === hash) ??
    allowed.find((candidate) => candidate.key === defaultKey)!;
  const user = demoUsers.find((candidate) => candidate.role === role)!;
  const unread = state.notes.filter(
    (note) =>
      note.company_id === state.config.company.seed_key &&
      note.type === "note_to_supervisor" &&
      note.status === "open" &&
      (branch === "all" || note.branch === branch),
  ).length;
  const configuredBranches = state.config.branches;
  const branchLabel = (name: Branch) => {
    const index = branches.indexOf(name as Exclude<Branch, "all">);
    return name === "all"
      ? t("All branches", "همهٔ شعبه‌ها")
      : t(
          configuredBranches[index]?.name_en.replace(
            / \(PLACEHOLDER.*\)/,
            "",
          ) ?? name,
          configuredBranches[index]?.name_fa ?? name,
        );
  };
  const brandStyle = {
    "--brand": state.config.company.branding.primary_color,
    "--brand-hover": state.config.company.branding.primary_hover_color,
  } as CSSProperties;
  return (
    <div
      className="app-shell"
      style={brandStyle}
      dir={lang === "fa" ? "rtl" : "ltr"}
    >
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
          <div className="logo-tile">
            <img
              src={logo}
              alt={t(
                state.config.company.name_en,
                state.config.company.name_fa,
              )}
            />
          </div>
          <p className="store-name">
            {t(state.config.company.name_en, state.config.company.name_fa)}
          </p>
          <span className="sidebar-helper">
            {t("Operations demo", "دموی مدیریت فروشگاه")}
          </span>
        </div>
        <nav aria-label={t("Pages", "صفحه‌ها")}>
          {allowed.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.key}
                href={`#${item.key}`}
                aria-current={page.key === item.key ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{t(item.en, item.fa)}</span>
                {item.key === "notes" &&
                  role === "supervisor" &&
                  unread > 0 && (
                    <span
                      className="nav-count"
                      aria-label={t(
                        `${unread} unread notes`,
                        `${unread} یادداشت خوانده‌نشده`,
                      )}
                    >
                      {unread}
                    </span>
                  )}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <span className="user-avatar" aria-hidden="true">
            {role === "supervisor" ? "S" : role === "floor_worker" ? "F" : "C"}
          </span>
          <div>
            <strong>
              {t(
                user.name,
                role === "supervisor"
                  ? "سرپرست نمایشی"
                  : role === "floor_worker"
                    ? "کارمند نمایشی"
                    : "صندوق‌دار نمایشی",
              )}
            </strong>
            <small>
              <RoleName role={role} />
            </small>
          </div>
        </div>
        <div className="sidebar-session">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedRole(role);
              lock();
            }}
          >
            <LockKeyhole size={17} aria-hidden="true" />
            {t("Lock", "قفل")}
          </Button>
          <Button variant="ghost" onClick={signOut}>
            <LogOut size={17} aria-hidden="true" />
            {t("Sign out", "خروج")}
          </Button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Button
            id="menu-toggle"
            className="mobile-menu"
            variant="secondary"
            aria-controls="app-sidebar"
            aria-expanded={menuOpen}
            aria-label={t(
              menuOpen ? "Close menu" : "Open menu",
              menuOpen ? "بستن منو" : "باز کردن منو",
            )}
            onClick={() => setMenuOpen((previous) => !previous)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          {role === "supervisor" ? (
            <Field label={t("Branch", "شعبه")}>
              <select
                value={branch}
                onChange={(event) => setBranch(event.target.value as Branch)}
              >
                {[...branches, "all" as const].map((item) => (
                  <option key={item} value={item}>
                    {branchLabel(item)}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Badge tone="neutral">{branchLabel(branch)}</Badge>
          )}
          <Field label={t("Role switcher", "تغییر نقش")}>
            <select
              value={role}
              onChange={(event) => {
                setSelectedRole(event.target.value as Role);
                signOut();
              }}
            >
              {(["supervisor", "floor_worker", "cashier"] as Role[]).map(
                (item) => (
                  <option key={item} value={item}>
                    {t(...roleNames[item])}
                  </option>
                ),
              )}
            </select>
          </Field>
          <div className="topbar-end">
            <LanguageToggle />
            <time className="topbar-date" dateTime={new Date().toISOString()}>
              {new Intl.DateTimeFormat("en-CA", {
                timeZone: state.config.company.timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date())}
            </time>
            <Button variant="secondary" onClick={() => setResetOpen(true)}>
              <RotateCcw size={16} aria-hidden="true" />
              {t("Reset demo", "بازنشانی دمو")}
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          className="main-content"
          key={resetGeneration}
          tabIndex={-1}
        >
          {screenRegistry[page.key] ?? <Placeholder page={page} />}
        </main>
      </div>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("Reset demo", "بازنشانی دمو")}
        description={t(
          "Restore the fictional seed data and clear changes made in this browser. Your selected role and language stay the same.",
          "داده‌های خیالی اولیه بازیابی می‌شوند و تغییرات این مرورگر پاک می‌شوند. نقش و زبان شما حفظ می‌شود.",
        )}
        confirmLabel={t("Reset demo", "بازنشانی دمو")}
        onConfirm={reset}
      />
    </div>
  );
}
