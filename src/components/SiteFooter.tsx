import { demographics, meta } from "../data";
import { useI18n } from "../lib/i18n";
import { translateCensusRelease } from "../lib/labels";

export function SiteFooter() {
  const { t, lang } = useI18n();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-wordmark">{t("brand.name")}</span>
          <p>{t("footer.tagline")}</p>
        </div>

        <div className="footer-col">
          <h3>{t("footer.dataSources")}</h3>
          <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
            {t("footer.sourceRoster")}
          </a>
          <a href={meta.sourceBillsUrl} target="_blank" rel="noreferrer">
            {t("footer.sourceBills")}
          </a>
          <a
            href="https://www.njelecefilesearch.com/"
            target="_blank"
            rel="noreferrer"
          >
            NJ ELEC · {t("footer.sourceElec")}
          </a>
          <a
            href={demographics.source.url}
            target="_blank"
            rel="noreferrer"
          >
            U.S. Census Bureau ({translateCensusRelease(demographics.release.name, lang)})
          </a>
          <a href="https://www.fec.gov/data/" target="_blank" rel="noreferrer">
            FEC · {t("footer.sourceFec")}
          </a>
          <a
            href="https://www.njleg.state.nj.us/district-map"
            target="_blank"
            rel="noreferrer"
          >
            {t("footer.sourceDistricts")}
          </a>
        </div>

        <div className="footer-col">
          <h3>{t("footer.notice")}</h3>
          <p>{t("footer.noticeText")}</p>
          <p className="footer-dev">
            {t("footer.developer")}:{" "}
            <a href="https://x.com/goanarchy1" target="_blank" rel="noreferrer">
              Goanarchy (@goanarchy1)
            </a>
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <button
          type="button"
          className="footer-live-badge"
          onClick={() => window.dispatchEvent(new CustomEvent("watchdogs:open-sync"))}
          aria-label={t("sync.open")}
        >
          <span className="sync-live-dot" aria-hidden="true" />
          <span>
            © {new Date().getFullYear()} {t("brand.name")} · {t("footer.liveSync")}
          </span>
        </button>
        <span className="num">
          {t("common.session", { session: meta.sessionLabel })} ·{" "}
          {meta.billCount.toLocaleString(lang === "es" ? "es-US" : "en-US")}{" "}
          {t("common.billsLower")}
        </span>
      </div>
    </footer>
  );
}
