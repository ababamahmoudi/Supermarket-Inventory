import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Server,
  X,
} from "lucide-react";
import { getHealth } from "./api/health";
import { Button } from "./components/ui/button";
import { company, companyLogo } from "./config";

export default function App() {
  const { t, i18n } = useTranslation();
  const companyName =
    i18n.resolvedLanguage === "fa"
      ? (company.name_fa ?? company.name)
      : (company.name_en ?? company.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuCloseButton = useRef<HTMLButtonElement>(null);
  const health = useQuery({
    queryKey: ["api-health"],
    queryFn: ({ signal }) => getHealth(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const checking = health.isFetching || health.isPending;
  const status = checking
    ? "checking"
    : health.isError
      ? "unavailable"
      : "connected";
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  useEffect(() => {
    document.title = t("pageTitle", { company: companyName });
  }, [t, companyName]);

  useEffect(() => {
    if (!menuOpen) return;
    menuCloseButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("skipToContent")}
      </a>
      <aside
        id="app-navigation"
        className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}
        aria-label={t("navigation")}
      >
        <div className="sidebar-heading">
          <div className="logo-tile">
            {companyLogo ? <img src={companyLogo} alt={companyName} /> : null}
          </div>
          <Button
            ref={menuCloseButton}
            variant="sidebar"
            className="mobile-only"
            aria-label={t("closeMenu")}
            onClick={closeMenu}
          >
            <X aria-hidden="true" size={20} />
          </Button>
        </div>
        <p className="company-name">{companyName}</p>
        <nav aria-label={t("navigation")}>
          <a
            href="#main-content"
            className="nav-item"
            aria-current="page"
            onClick={closeMenu}
          >
            <LayoutDashboard size={20} aria-hidden="true" />
            {t("workspace")}
          </a>
        </nav>
        <div className="sidebar-footer">
          <FlaskConical size={18} aria-hidden="true" />
          <span>{t("development")}</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <Button
              ref={menuButton}
              variant="secondary"
              className="mobile-only"
              aria-label={t("openMenu")}
              aria-expanded={menuOpen}
              aria-controls="app-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Menu size={20} aria-hidden="true" />
            </Button>
            <span className="topbar-company">{companyName}</span>
          </div>
          <div className="topbar-end">
            <time
              className="local-date"
              dateTime={localDate}
              aria-label={t("localTime")}
              dir="ltr"
            >
              {localDate}
            </time>
            <div
              className="language-switch"
              role="group"
              aria-label={t("language")}
            >
              <Button
                variant="secondary"
                lang="en"
                aria-pressed={i18n.resolvedLanguage === "en"}
                onClick={() => void i18n.changeLanguage("en")}
              >
                {t("english")}
              </Button>
              <Button
                variant="secondary"
                lang="fa"
                aria-pressed={i18n.resolvedLanguage === "fa"}
                onClick={() => void i18n.changeLanguage("fa")}
              >
                {t("persian")}
              </Button>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <span className="phase-badge">{t("phase")}</span>
            <h1>{t("foundation")}</h1>
            <p>{t("description")}</p>
          </div>
          <div className="card-grid">
            <section className="card" aria-labelledby="placeholder-heading">
              <div className="card-icon" aria-hidden="true">
                <LayoutDashboard size={22} />
              </div>
              <h2 id="placeholder-heading">{t("placeholderTitle")}</h2>
              <p>{t("placeholderBody")}</p>
              <p className="notice">{t("placeholderNotice")}</p>
            </section>
            <section className="card" aria-labelledby="connection-heading">
              <div className="card-icon" aria-hidden="true">
                <Server size={22} />
              </div>
              <h2 id="connection-heading">{t("connectionTitle")}</h2>
              <p>{t("connectionDescription")}</p>
              <div
                className="connection-status"
                role="status"
                aria-live="polite"
              >
                <span className={`status-badge status-${status}`}>
                  {status === "connected" ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  ) : status === "unavailable" ? (
                    <CircleAlert size={16} aria-hidden="true" />
                  ) : (
                    <Server size={16} aria-hidden="true" />
                  )}
                  {t(status)}
                </span>
                <p>{t(`${status}Description`)}</p>
              </div>
              <Button onClick={() => void health.refetch()} disabled={checking}>
                {status === "unavailable"
                  ? t("checkAgain")
                  : t("checkConnection")}
              </Button>
            </section>
          </div>
          <p className="scope-note">{t("scopeNote")}</p>
        </main>
      </div>
    </div>
  );
}
