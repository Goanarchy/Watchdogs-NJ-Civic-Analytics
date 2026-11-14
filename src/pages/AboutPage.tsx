import { Link } from "react-router-dom";
import { meta } from "../data";
import { useI18n } from "../lib/i18n";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function AboutPage() {
  const { t } = useI18n();
  useDocumentTitle(t("about.docTitle"));

  return (
    <main className="page narrow-page about-page">
      <header className="page-header">
        <p className="eyebrow eyebrow-dark">{t("about.eyebrow")}</p>
        <h1>{t("about.title")}</h1>
        <p className="page-header-sub">{t("about.sub")}</p>
      </header>

      <section className="panel about-panel">
        <h2>{t("about.sourceTitle")}</h2>
        <div className="method-grid">
          <div className="method-item">
            <span className="method-number">01</span>
            <h3>{t("about.source1Title")}</h3>
            <p>{t("about.source1Text", { count: meta.legislatorCount })}</p>
          </div>
          <div className="method-item">
            <span className="method-number">02</span>
            <h3>{t("about.source2Title")}</h3>
            <p>{t("about.source2Text")}</p>
          </div>
          <div className="method-item">
            <span className="method-number">03</span>
            <h3>{t("about.source3Title")}</h3>
            <p>{t("about.source3Text", { session: meta.sessionLabel })}</p>
          </div>
        </div>
      </section>

      <section className="panel about-panel">
        <h2>{t("about.updatedTitle")}</h2>
        <p>
          {t("about.updatedText", {
            session: meta.sessionLabel,
          })}
        </p>
        <div className="about-sync-callout">
          <span className="sync-live-dot" aria-hidden="true" />
          <span>{t("about.syncCallout")}</span>
        </div>
        <pre className="code-block">
          <code>npm run refresh-data</code>
        </pre>
        <p>{t("about.noTracking")}</p>
      </section>

      <section className="panel about-panel">
        <h2>{t("about.scopeTitle")}</h2>
        <ul className="about-list">
          <li>
            <strong>{t("about.coverageLabel")}</strong>{" "}
            {t("about.coverageText", { count: meta.legislatorCount })}
          </li>
          <li>
            <strong>{t("about.languageLabel")}</strong>{" "}
            {t("about.languageText")}
          </li>
          <li>
            <strong>{t("about.sponsorshipLabel")}</strong>{" "}
            {t("about.sponsorshipText")}
          </li>
          <li>
            <strong>{t("about.incompleteLabel")}</strong>{" "}
            {t("about.incompleteText")}
          </li>
          <li>
            <strong>{t("about.snapshotLabel")}</strong>{" "}
            {t("about.snapshotText")}
          </li>
        </ul>
      </section>

      <section className="panel about-panel">
        <h2>{t("about.campaignTitle")}</h2>
        <p>{t("about.campaignText")}</p>
        <h3>{t("about.promiseStatusTitle")}</h3>
        <p>{t("about.promiseStatusText")}</p>
        <Link className="button button-outline button-small" to="/super-tools/por-quien-voto">
          {t("superTools.voteTrackerCta")}
        </Link>
      </section>

      <section className="panel about-panel">
        <h2>{t("about.federalTitle")}</h2>
        <p>{t("about.federalText")}</p>
        <Link className="button button-outline button-small" to="/super-tools/federal">
          {t("superTools.federalCta")}
        </Link>
      </section>

      <section className="panel about-panel">
        <h2>{t("about.donorsTitle")}</h2>
        <p>{t("about.donorsText")}</p>
      </section>

      <section className="panel about-panel">
        <h2>{t("about.sourcesTitle")}</h2>
        <ul className="source-list">
          <li>
            <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
              {t("about.sourceRoster")}
            </a>
          </li>
          <li>
            <a href={meta.sourceBillsUrl} target="_blank" rel="noreferrer">
              {t("about.sourceBills")}
            </a>
          </li>
          <li>
            <a
              href="https://www.njleg.state.nj.us/district-map"
              target="_blank"
              rel="noreferrer"
            >
              {t("about.sourceDistricts")}
            </a>
          </li>
          <li>
            <a
              href="https://www.njspotlightnews.org/"
              target="_blank"
              rel="noreferrer"
            >
              {t("about.sourceCampaign")}
            </a>
          </li>
          <li>
            <a
              href="https://www.njelecefilesearch.com/"
              target="_blank"
              rel="noreferrer"
            >
              {t("about.donorSource")}
            </a>
          </li>
          <li>
            <a
              href="https://www.nytimes.com/interactive/2026/11/03/us/elections/results-new-jersey.html"
              target="_blank"
              rel="noreferrer"
            >
              {t("federal.sourceResults")}
            </a>
          </li>
          <li>
            <a
              href="https://www.fec.gov/data/browse-data/?tab=bulk-data"
              target="_blank"
              rel="noreferrer"
            >
              {t("federal.sourceFinance")}
            </a>
          </li>
        </ul>
      </section>

      <div className="about-callout">
        <h2>{t("about.calloutTitle")}</h2>
        <p>{t("about.calloutText")}</p>
        <Link className="button button-dark" to="/">
          {t("common.backDirectory")}
        </Link>
      </div>
    </main>
  );
}
