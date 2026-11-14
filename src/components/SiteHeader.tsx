import { useState } from "react";
import { NavLink } from "react-router-dom";
import { DataSyncPanel } from "./DataSyncPanel";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

export function SiteHeader() {
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [syncOpen, setSyncOpen] = useState(false);

  return (
    <>
      <header className="site-header">
      <div className="header-inner">
        <NavLink
          to="/"
          className="brand"
          aria-label={`${t("brand.name")} · ${t("nav.home")}`}
        >
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M32 3L8 12v18c0 15.6 10.2 26.9 24 31.2C45.8 56.9 56 45.6 56 30V12L32 3Z"
                fill="#102a3c"
                stroke="#c99c52"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path
                d="M19 17.5C22.4 13.8 27 11.8 32 11.8s9.6 2 13 5.7"
                stroke="#06b6d4"
                strokeWidth="2.4"
                strokeLinecap="round"
                opacity="0.75"
              />
              <path
                d="M23.5 21C25.8 18.6 28.8 17.4 32 17.4s6.2 1.2 8.5 3.6"
                stroke="#22d3ee"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="32" cy="14" r="3" fill="#22d3ee" />
              <path d="M24 29a8 8 0 0 1 16 0Z" fill="#f5f2ea" />
              <rect x="21" y="30.5" width="22" height="2.2" rx="1" fill="#c99c52" />
              <rect x="23" y="34" width="3" height="9" rx="0.8" fill="#f5f2ea" />
              <rect x="30.5" y="34" width="3" height="9" rx="0.8" fill="#f5f2ea" />
              <rect x="38" y="34" width="3" height="9" rx="0.8" fill="#f5f2ea" />
              <rect x="19" y="45" width="26" height="3" rx="1.2" fill="#c99c52" />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-name-row">
              <span className="brand-name">{t("brand.name")}</span>
              <span className="brand-civic-tag">{t("brand.civicBadge")}</span>
            </span>
            <span className="brand-sub">{t("brand.sub")}</span>
          </span>
        </NavLink>

        <div className="header-actions">
          <nav className="site-nav" aria-label={t("nav.directory")}>
            <NavLink to="/" end>
              {t("nav.directory")}
            </NavLink>
            <NavLink to="/buscar-representante">{t("nav.findRep")}</NavLink>
            <NavLink to="/super-tools" className="nav-super">
              <SparkIcon />
              {t("nav.superTools")}
            </NavLink>
            <NavLink to="/acerca">{t("nav.methodology")}</NavLink>
            <a
              href="https://www.njleg.state.nj.us/legislative-roster"
              target="_blank"
              rel="noreferrer"
              className="nav-external"
            >
              {t("nav.officialSource")}
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 2h8v8h-2V5.4L4.7 12.7l-1.4-1.4L10.6 4H6V2Z" />
              </svg>
            </a>
          </nav>

          <div className="header-controls">
            <button
              type="button"
              className={`theme-trigger${theme === "dark" ? " is-dark" : ""}`}
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
              aria-label={t("nav.themeAria")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              <span>{theme === "dark" ? t("nav.themeLight") : t("nav.themeDark")}</span>
            </button>

            <button
              type="button"
              className="sync-trigger"
              onClick={() => setSyncOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={syncOpen}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="sync-icon">
                <path d="M10 3.2a6.8 6.8 0 0 1 6.3 4.3l.9-2.1 1.6.7-1.7 4.1-4.2-1.1.4-1.7 1.8.5A5.1 5.1 0 1 0 10 15.1v1.7a6.8 6.8 0 1 1 0-13.6Z" />
              </svg>
              <span>{t("sync.open")}</span>
            </button>

            <div
              className="lang-switch"
              role="group"
              aria-label={t("nav.language")}
            >
              <button
                type="button"
                className={lang === "en" ? "active" : ""}
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                aria-label={t("nav.switchToEnglish")}
              >
                EN
              </button>
              <button
                type="button"
                className={lang === "es" ? "active" : ""}
                onClick={() => setLang("es")}
                aria-pressed={lang === "es"}
                aria-label={t("nav.switchToSpanish")}
              >
                ES
              </button>
            </div>
          </div>
          </div>
        </div>
      </header>
      <DataSyncPanel open={syncOpen} onClose={() => setSyncOpen(false)} />
    </>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="theme-icon">
      <path d="M16.4 13.1A6.8 6.8 0 0 1 7.9 3.6a7.2 7.2 0 1 0 9.5 9.5Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="theme-icon">
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 1.8v2.1M10 16.1v2.1M3.9 3.9l1.5 1.5M14.6 14.6l1.5 1.5M1.8 10h2.1M16.1 10h2.1M3.9 16.1l1.5-1.5M14.6 5.4l1.5-1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="spark-icon">
      <path d="M10 1.6l1.7 5.2 5.2 1.7-5.2 1.7L10 15.4l-1.7-5.2-5.2-1.7 5.2-1.7L10 1.6Z" />
      <path d="M16.1 13.4l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Z" />
    </svg>
  );
}
