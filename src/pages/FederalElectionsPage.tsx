import { Link } from "react-router-dom";
import { federal } from "../data";
import { useI18n } from "../lib/i18n";
import { padDistrict, partyClass, partyLabel } from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { FederalDistrict } from "../types";

function money(value: number, lang: string, digits = 0): string {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function outcome(district: FederalDistrict) {
  const rows = district.results?.listedCandidates ?? [];
  const winner = rows.find((row) => row.winner) ?? null;
  const runnerUp =
    [...rows]
      .filter((row) => row !== winner)
      .sort((a, b) => b.votes - a.votes)[0] ?? null;
  const margin = winner && runnerUp ? winner.votes - runnerUp.votes : null;
  return { winner, runnerUp, margin };
}

export function FederalElectionsPage() {
  const { t, lang, formatNumber, formatDate } = useI18n();
  useDocumentTitle(t("federal.docTitle"));

  const { summary, election } = federal;
  const seatsD = summary.seats.D ?? 0;
  const seatsR = summary.seats.R ?? 0;
  const totalVotes = summary.totalVotes;
  const shares = [
    { key: "D", label: t("federal.democratic"), votes: summary.partyVotes.D ?? 0, cls: "is-d" },
    { key: "R", label: t("federal.republican"), votes: summary.partyVotes.R ?? 0, cls: "is-r" },
    { key: "O", label: t("federal.other"), votes: summary.partyVotes.O ?? 0, cls: "is-o" },
    { key: "U", label: t("federal.unattributed"), votes: summary.unattributedVotes, cls: "is-u" },
  ];
  const sharePct = (votes: number) => (totalVotes > 0 ? (votes / totalVotes) * 100 : 0);

  return (
    <main className="page topic-page federal-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/super-tools">{t("federal.back")}</Link>
        <span aria-hidden="true">/</span>
        <span>{t("federal.title")}</span>
      </nav>

      <header className="topic-hero federal-hero">
        <div className="topic-hero-glow" aria-hidden="true" />
        <div className="topic-hero-copy">
          <p className="eyebrow eyebrow-dark">{t("federal.eyebrow")}</p>
          <h1>{t("federal.title")}</h1>
          <p className="topic-description">{t("federal.sub")}</p>
          <div className="federal-hero-meta">
            <span className="federal-preliminary">
              <i aria-hidden="true" />
              {t("federal.preliminary")}
            </span>
            <p>{t("federal.preliminaryNote", { date: formatDate(federal.sources.results.retrievedAt ?? federal.generatedAt) })}</p>
          </div>
        </div>
      </header>

      <section className="federal-kpis">
        <article className="federal-kpi">
          <span className="federal-kpi-label">{t("federal.kpiDistricts")}</span>
          <strong>{formatNumber(election.districtCount)}</strong>
          <small>{t("federal.kpiDistrictsSub")}</small>
        </article>
        <article className="federal-kpi">
          <span className="federal-kpi-label">{t("federal.kpiCandidates")}</span>
          <strong>{formatNumber(election.candidateCount)}</strong>
          <small>{t("federal.kpiCandidatesSub")}</small>
        </article>
        <article className="federal-kpi federal-kpi-seats">
          <span className="federal-kpi-label">{t("federal.kpiSeats")}</span>
          <strong>
            <span className="is-d">{seatsD}</span>
            <span className="federal-kpi-sep">·</span>
            <span className="is-r">{seatsR}</span>
          </strong>
          <small>{t("federal.kpiSeatsSub", { d: seatsD, r: seatsR })}</small>
        </article>
        <article className="federal-kpi">
          <span className="federal-kpi-label">{t("federal.kpiVotes")}</span>
          <strong>{formatNumber(totalVotes)}</strong>
          <small>{t("federal.kpiVotesSub")}</small>
        </article>
        <article className="federal-kpi">
          <span className="federal-kpi-label">{t("federal.kpiRaised")}</span>
          <strong>{money(summary.totalReceipts, lang)}</strong>
          <small>{t("federal.kpiRaisedSub")}</small>
        </article>
      </section>

      <section className="panel super-panel federal-share-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("federal.voteShare")}</p>
            <h2>{t("federal.voteShare")}</h2>
          </div>
          <span className="panel-source">{formatNumber(totalVotes)}</span>
        </div>
        <div className="federal-share-bar" aria-hidden="true">
          {shares.map((share) => (
            <span
              key={share.key}
              className={`federal-share-seg ${share.cls}`}
              style={{ width: `${sharePct(share.votes)}%` }}
            />
          ))}
        </div>
        <ul className="federal-share-legend">
          {shares.map((share) => (
            <li key={share.key}>
              <span className={`federal-dot ${share.cls}`} aria-hidden="true" />
              <span className="federal-share-name">{share.label}</span>
              <strong>{sharePct(share.votes).toFixed(1)}%</strong>
              <small>{formatNumber(share.votes)}</small>
            </li>
          ))}
        </ul>
        <p className="panel-intro federal-share-note">{t("federal.voteShareSub")}</p>
      </section>

      <section className="federal-districts">
        <div className="federal-section-head">
          <div>
            <p className="panel-kicker">{t("federal.districtsTitle")}</p>
            <h2>{t("federal.districtsTitle")}</h2>
          </div>
          <p>{t("federal.districtsSub")}</p>
        </div>

        <div className="federal-district-grid">
          {federal.districts.map((district) => {
            const { winner, margin } = outcome(district);
            const promises = district.candidates.reduce(
              (sum, candidate) => sum + candidate.promises.length,
              0,
            );
            return (
              <Link
                key={district.district}
                className="federal-district-card"
                to={`/super-tools/federal/${district.district}`}
              >
                <div className="federal-district-top">
                  <span className="federal-district-number">
                    {padDistrict(district.district)}
                  </span>
                  <span className="federal-district-tag">
                    {t("federal.votesCount", {
                      count: formatNumber(district.results?.totalVotes ?? 0),
                    })}
                  </span>
                </div>

                {winner ? (
                  <>
                    <p className="federal-district-label">{t("federal.winner")}</p>
                    <p className="federal-district-winner">{winner.name}</p>
                    <div className="federal-district-party">
                      <span className={`party ${partyClass(winner.party)}`}>
                        {partyLabel(winner.party, lang)}
                      </span>
                      {margin !== null && (
                        <span className="federal-district-margin">
                          {t("federal.margin")} +{formatNumber(margin)}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="federal-district-label">{t("federal.noResults")}</p>
                )}

                <div className="federal-district-foot">
                  <span>
                    {t("federal.districtCardMeta", {
                      count: district.candidates.length,
                      promises,
                    })}
                  </span>
                  <span className="federal-district-arrow" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="panel super-panel federal-method">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("common.methodology")}</p>
            <h2>{t("federal.methodTitle")}</h2>
          </div>
        </div>
        <div className="federal-method-grid">
          <div>
            <h3>{t("federal.resultsSource")}</h3>
            <p>{t("federal.methodResults")}</p>
          </div>
          <div>
            <h3>{t("federal.sourceGuides")}</h3>
            <p>{t("federal.methodPromises")}</p>
          </div>
          <div>
            <h3>{t("federal.sourceFinance")}</h3>
            <p>{t("federal.methodFinance")}</p>
          </div>
        </div>
        <div className="federal-source-list">
          <span>{t("federal.sourcesTitle")}</span>
          <a href={federal.sources.results.url} target="_blank" rel="noreferrer">
            {t("federal.sourceResults")}
          </a>
          <a href={federal.sources.guides.url} target="_blank" rel="noreferrer">
            {t("federal.sourceGuides")}
          </a>
          <a href={federal.sources.finance.url} target="_blank" rel="noreferrer">
            {t("federal.sourceFinance")}
          </a>
        </div>
      </section>
    </main>
  );
}
