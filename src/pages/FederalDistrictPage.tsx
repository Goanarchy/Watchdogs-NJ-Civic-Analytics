import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Portrait } from "../components/Portrait";
import { federal, federalDistrictsByNumber } from "../data";
import type { CopyKey, Lang } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { partyClass, partyLabel } from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { FederalCandidate, FederalDistrict } from "../types";

const CATEGORY_KEYS: Record<string, CopyKey> = {
  topIssue: "federal.category.topIssue",
  economy: "federal.category.economy",
  healthcare: "federal.category.healthcare",
  defense: "federal.category.defense",
  immigration: "federal.category.immigration",
  elections: "federal.category.elections",
};

function money(value: number, lang: string, digits = 0): string {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function donorMoney(value: number, lang: string): string {
  return money(value, lang, Number.isInteger(value) ? 0 : 2);
}

function shortDate(value: string | null | undefined, lang: string): string {
  if (!value) return "—";
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  const iso = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}`
    : /^\d{2}\/\d{2}\/\d{4}$/.test(value)
      ? value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, "$3-$1-$2")
      : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function DonorTable({
  kind,
  donors,
  lang,
  t,
}: {
  kind: "individual" | "committee";
  donors: {
    name: string;
    amount: number;
    count: number;
    lastDate?: string | null;
    city?: string;
    state?: string;
    zip?: string;
    employer?: string | null;
    occupation?: string | null;
  }[];
  lang: string;
  t: (key: CopyKey, vars?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? donors : donors.slice(0, 10);

  return (
    <>
      <div className="federal-table-wrap">
        <table className="donor-table federal-donor-table">
          <thead>
            <tr>
              <th scope="col">
                {kind === "individual" ? t("federal.donorName") : t("federal.committeeName")}
              </th>
              {kind === "individual" && <th scope="col">{t("federal.donorLocation")}</th>}
              {kind === "individual" && <th scope="col">{t("federal.donorEmployer")}</th>}
              <th scope="col" className="donor-amount-col">
                {t("federal.donorAmount")}
              </th>
              <th scope="col" className="donor-amount-col">
                {t("federal.donorGifts")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((donor, index) => (
              <tr key={`${donor.name}-${index}`}>
                <td>
                  <span className="donor-name">{donor.name}</span>
                  {kind === "committee" && donor.lastDate && (
                    <span className="donor-detail">{shortDate(donor.lastDate, lang)}</span>
                  )}
                </td>
                {kind === "individual" && (
                  <td>
                    <span className="donor-detail">
                      {[donor.city, donor.state].filter(Boolean).join(", ")}
                      {donor.zip ? ` ${donor.zip}` : ""}
                    </span>
                  </td>
                )}
                {kind === "individual" && (
                  <td>
                    <span className="donor-detail">
                      {[donor.employer, donor.occupation].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </td>
                )}
                <td className="donor-amount-col">{donorMoney(donor.amount, lang)}</td>
                <td className="donor-amount-col">{donor.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {donors.length > 10 && (
        <div className="federal-table-foot">
          <span>{t("federal.showingTop", { count: visible.length })}</span>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded
              ? t("federal.showLess")
              : t("federal.showAll", { count: donors.length })}
          </button>
        </div>
      )}
    </>
  );
}

function TruncationNote({ text }: { text: string }) {
  return (
    <p className="federal-donor-note" role="note">
      <span aria-hidden="true">ℹ</span> {text}
    </p>
  );
}

export function FederalDistrictPage() {
  const { district: districtParam } = useParams();
  const { t, lang, formatNumber, formatDate } = useI18n();
  const districtNumber = Number(districtParam);
  const district = federalDistrictsByNumber.get(districtNumber);
  const initialCandidate =
    district?.candidates.find((candidate) => candidate.result?.winner) ??
    district?.candidates[0] ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(initialCandidate?.id ?? null);

  const selected = useMemo(
    () => district?.candidates.find((candidate) => candidate.id === selectedId) ?? initialCandidate,
    [district, selectedId, initialCandidate],
  );

  useDocumentTitle(
    district
      ? t("federal.districtDocTitle", { district: district.district })
      : t("federal.notFoundTitle"),
  );

  if (!district) {
    return (
      <main className="page narrow-page">
        <div className="empty-state">
          <h1>{t("federal.notFoundTitle")}</h1>
          <p>{t("federal.notFoundText")}</p>
          <Link className="button button-dark" to="/super-tools/federal">
            {t("federal.backToFederal")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page topic-page federal-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/super-tools">{t("federal.back")}</Link>
        <span aria-hidden="true">/</span>
        <Link to="/super-tools/federal">{t("federal.title")}</Link>
        <span aria-hidden="true">/</span>
        <span>{t("federal.districtTitle", { district: district.district })}</span>
      </nav>

      <header className="topic-hero federal-hero federal-district-hero">
        <div className="topic-hero-glow" aria-hidden="true" />
        <div className="topic-hero-copy">
          <p className="eyebrow eyebrow-dark">
            {t("federal.districtKicker", { district: district.district })}
          </p>
          <h1>{t("federal.districtTitle", { district: district.district })}</h1>
          <p className="topic-description">
            {t("federal.districtSub", { district: district.district })}
          </p>
          <div className="federal-hero-meta">
            <span className="federal-preliminary">
              <i aria-hidden="true" />
              {t("federal.preliminary")}
            </span>
            {district.results?.reportingPct !== null && district.results?.reportingPct !== undefined && (
              <span className="federal-reporting">
                {t("federal.reporting", { pct: district.results.reportingPct })}
              </span>
            )}
            {district.results?.updatedAt && (
              <span className="federal-reporting">
                {t("federal.updated", { date: shortDate(district.results.updatedAt, lang) })}
              </span>
            )}
          </div>
        </div>
        <Link className="button button-light federal-district-back" to="/super-tools/federal">
          {t("federal.allDistricts")}
        </Link>
      </header>

      <DistrictResults district={district} />

      <section className="federal-candidate-section">
        <div className="federal-section-head">
          <div>
            <p className="panel-kicker">{t("federal.profilesTitle")}</p>
            <h2>{t("federal.profilesTitle")}</h2>
          </div>
          <p>{t("federal.profilesSub")}</p>
        </div>

        <div className="federal-candidate-tabs" role="tablist" aria-label={t("federal.tablist")}>
          {district.candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={selected?.id === candidate.id}
              className={`federal-candidate-tab${selected?.id === candidate.id ? " is-active" : ""}`}
              onClick={() => setSelectedId(candidate.id)}
            >
              <span className={`federal-tab-dot ${partyClass(candidate.party)}`} aria-hidden="true" />
              <span className="federal-tab-name">{candidate.name}</span>
              <span className="federal-tab-meta">
                {partyLabel(candidate.party, lang)}
                {candidate.result?.winner ? ` · ${t("federal.statusWinner")}` : ""}
                {candidate.result?.votes ? ` · ${formatNumber(candidate.result.votes)}` : ""}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <CandidateDetail
            key={selected.id}
            candidate={selected}
            district={district}
            lang={lang}
            t={t}
            formatNumber={formatNumber}
            formatDate={formatDate}
          />
        )}
      </section>
    </main>
  );
}

function DistrictResults({ district }: { district: FederalDistrict }) {
  const { t, lang, formatNumber } = useI18n();
  const results = district.results;

  return (
    <section className="panel super-panel federal-results-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("federal.resultsTitle")}</p>
          <h2>{t("federal.resultsTitle")}</h2>
        </div>
        <a
          className="panel-source"
          href={federal.sources.results.url}
          target="_blank"
          rel="noreferrer"
        >
          {t("federal.resultsSource")}
        </a>
      </div>
      <p className="panel-intro">{t("federal.resultsSub")}</p>

      {!results || results.listedCandidates.length === 0 ? (
        <p className="empty-note">{t("federal.noResults")}</p>
      ) : (
        <>
          <div className="federal-table-wrap">
            <table className="federal-results-table">
              <thead>
                <tr>
                  <th scope="col">{t("federal.tableCandidate")}</th>
                  <th scope="col">{t("federal.tableParty")}</th>
                  <th scope="col" className="donor-amount-col">
                    {t("federal.tableVotes")}
                  </th>
                  <th scope="col" className="donor-amount-col">
                    {t("federal.tablePct")}
                  </th>
                  <th scope="col">{t("federal.statusWinner")}</th>
                </tr>
              </thead>
              <tbody>
                {results.listedCandidates.map((row) => (
                  <tr key={row.name} className={row.winner ? "is-winner" : undefined}>
                    <td>
                      <span className="donor-name">{row.name}</span>
                    </td>
                    <td>
                      <span className={`party ${partyClass(row.party)}`}>
                        {partyLabel(row.party, lang)}
                      </span>
                    </td>
                    <td className="donor-amount-col">{formatNumber(row.votes)}</td>
                    <td className="donor-amount-col">
                      {row.pct === null ? "—" : `${row.pct}%`}
                    </td>
                    <td>
                      {row.winner ? (
                        <span className="federal-winner-badge">
                          <span aria-hidden="true">✓</span>
                          {t("federal.statusWinner")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {results.residualVotes > 0 && (
                  <tr className="is-residual">
                    <td>
                      <span className="donor-name">{t("federal.residualLabel")}</span>
                      <span className="donor-detail">{t("federal.notListed")}</span>
                    </td>
                    <td>—</td>
                    <td className="donor-amount-col">
                      {formatNumber(results.residualVotes)}
                    </td>
                    <td className="donor-amount-col">
                      {results.totalVotes
                        ? `${((results.residualVotes / results.totalVotes) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td>—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {results.residualVotes > 0 && (
            <p className="federal-residual-note">
              {t("federal.residualNote", {
                count: formatNumber(results.residualVotes),
              })}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function CandidateDetail({
  candidate,
  district,
  lang,
  t,
  formatNumber,
  formatDate,
}: {
  candidate: FederalCandidate;
  district: FederalDistrict;
  lang: Lang;
  t: (key: CopyKey, vars?: Record<string, string | number>) => string;
  formatNumber: (value: number) => string;
  formatDate: (iso: string) => string;
}) {
  const finance = candidate.finance;

  return (
    <div className="federal-candidate-detail">
      <section className="federal-profile">
        <Portrait
          src={candidate.photo}
          name={candidate.name}
          className="federal-profile-photo"
          eager
        />
        <div className="federal-profile-copy">
          <div className="chip-row">
            <span className={`party ${partyClass(candidate.party)}`}>
              {partyLabel(candidate.party, lang)}
            </span>
            {candidate.incumbent && <span className="chip">{t("federal.incumbent")}</span>}
            {candidate.result?.winner && (
              <span className="chip federal-chip-win">{t("federal.statusWinner")}</span>
            )}
            {candidate.didNotRespond && (
              <span className="chip">{t("federal.didNotRespond")}</span>
            )}
          </div>
          <h3 className="federal-profile-name">{candidate.name}</h3>
          <dl className="federal-profile-facts">
            {candidate.hometown && (
              <div>
                <dt>{t("federal.hometown")}</dt>
                <dd>{candidate.hometown}</dd>
              </div>
            )}
            {candidate.occupation && (
              <div>
                <dt>{t("federal.occupation")}</dt>
                <dd>{candidate.occupation}</dd>
              </div>
            )}
            {candidate.age !== null && (
              <div>
                <dt>{t("federal.age")}</dt>
                <dd>{candidate.age}</dd>
              </div>
            )}
            <div>
              <dt>{t("federal.tableVotes")}</dt>
              <dd>
                {candidate.result
                  ? `${formatNumber(candidate.result.votes)} · ${candidate.result.pct ?? "—"}%`
                  : t("federal.notListed")}
              </dd>
            </div>
          </dl>
          {candidate.background && (
            <div className="federal-profile-bio">
              <p className="federal-block-label">{t("federal.background")}</p>
              <p>{candidate.background}</p>
            </div>
          )}
          <div className="federal-profile-links">
            {candidate.website && (
              <a
                className="button button-outline button-small"
                href={candidate.website}
                target="_blank"
                rel="noreferrer"
              >
                {t("federal.website")}
              </a>
            )}
            <a
              className="button button-ghost button-small"
              href={district.guideUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("federal.openGuide")}
            </a>
            {finance && (
              <a
                className="button button-ghost button-small"
                href={`https://www.fec.gov/data/candidate/${finance.candidateId}/`}
                target="_blank"
                rel="noreferrer"
              >
                {t("federal.fecProfile")}
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="panel super-panel federal-block">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("federal.commitmentsTitle")}</p>
            <h2>{t("federal.commitmentsTitle")}</h2>
          </div>
          <span className="panel-source">
            {t("topic.commitmentCountLabel", { count: candidate.promises.length })}
          </span>
        </div>
        <p className="panel-intro">{t("federal.commitmentsSub")}</p>

        {candidate.promises.length === 0 ? (
          <div className="federal-empty">
            <strong>{t("federal.noCommitments")}</strong>
            <p>{t("federal.noCommitmentsText")}</p>
          </div>
        ) : (
          <>
            <div className="federal-promise-grid">
              {candidate.promises.map((promise) => (
                <article key={promise.question} className="federal-promise">
                  <p className="federal-promise-category">
                    {CATEGORY_KEYS[promise.category]
                      ? t(CATEGORY_KEYS[promise.category])
                      : promise.category}
                  </p>
                  <h3>{promise.question}</h3>
                  <p>{promise.answer}</p>
                  <span className="federal-promise-note">{t("federal.answerOriginal")}</span>
                </article>
              ))}
            </div>
            <p className="federal-not-evaluated">{t("federal.commitmentsNote")}</p>
          </>
        )}
      </section>

      <section className="panel super-panel federal-block">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("federal.financeTitle")}</p>
            <h2>{t("federal.financeTitle")}</h2>
          </div>
          {finance?.coverageEnd && (
            <span className="panel-source">
              {t("federal.coverageEnd", { date: shortDate(finance.coverageEnd, lang) })}
            </span>
          )}
        </div>
        <p className="panel-intro">{t("federal.financeSub")}</p>
        {finance?.committeeName && (
          <p className="federal-committee-line">
            {finance.committeeName}
            {finance.committeeId ? ` · ${finance.committeeId}` : ""}
          </p>
        )}

        {!finance || !finance.totals ? (
          <div className="federal-empty">
            <strong>{t("federal.noFinance")}</strong>
            <p>{t("federal.noFinanceText")}</p>
          </div>
        ) : (
          <>
            <div className="federal-finance-grid">
              <div>
                <span>{t("federal.totalReceipts")}</span>
                <strong>{money(finance.totals.receipts, lang)}</strong>
              </div>
              <div>
                <span>{t("federal.totalDisbursements")}</span>
                <strong>{money(finance.totals.disbursements, lang)}</strong>
              </div>
              <div>
                <span>{t("federal.cashOnHand")}</span>
                <strong>{money(finance.totals.cashOnHand, lang)}</strong>
              </div>
              <div>
                <span>{t("federal.individualContributions")}</span>
                <strong>{money(finance.totals.individualContributions, lang)}</strong>
              </div>
              <div>
                <span>{t("federal.committeeContributions")}</span>
                <strong>{money(finance.totals.otherCommitteeContributions, lang)}</strong>
              </div>
              <div>
                <span>{t("federal.partyContributions")}</span>
                <strong>{money(finance.totals.partyContributions, lang)}</strong>
              </div>
            </div>

            <div className="federal-donor-block">
              <div className="federal-donor-head">
                <div>
                  <h3>{t("federal.itemizedTitle")}</h3>
                  <p>{t("federal.itemizedSub")}</p>
                </div>
                {finance.itemizedIndividuals && (
                  <span className="federal-donor-total">
                    {t("federal.itemizedTotal", {
                      amount: money(finance.itemizedIndividuals.total, lang),
                      count: formatNumber(finance.itemizedIndividuals.donorCount),
                    })}
                  </span>
                )}
              </div>
              {finance.itemizedIndividuals && finance.itemizedIndividuals.donors.length > 0 ? (
                <>
                  <DonorTable
                    kind="individual"
                    donors={finance.itemizedIndividuals.donors}
                    lang={lang}
                    t={t}
                  />
                  {finance.itemizedIndividuals.donorCount >
                    finance.itemizedIndividuals.donors.length && (
                    <TruncationNote
                      text={t("federal.donorTruncated", {
                        shown: formatNumber(finance.itemizedIndividuals.donors.length),
                        total: formatNumber(finance.itemizedIndividuals.donorCount),
                      })}
                    />
                  )}
                </>
              ) : (
                <p className="empty-note">{t("federal.noItemized")}</p>
              )}
            </div>

            <div className="federal-donor-block">
              <div className="federal-donor-head">
                <div>
                  <h3>{t("federal.committeeDonorsTitle")}</h3>
                  <p>{t("federal.committeeDonorsSub")}</p>
                </div>
                {finance.committeeDonors && (
                  <span className="federal-donor-total">
                    {t("federal.committeeTotal", {
                      amount: money(finance.committeeDonors.total, lang),
                      count: formatNumber(finance.committeeDonors.donorCount),
                    })}
                  </span>
                )}
              </div>
              {finance.committeeDonors && finance.committeeDonors.donors.length > 0 ? (
                <>
                  <DonorTable
                    kind="committee"
                    donors={finance.committeeDonors.donors}
                    lang={lang}
                    t={t}
                  />
                  {finance.committeeDonors.donorCount >
                    finance.committeeDonors.donors.length && (
                    <TruncationNote
                      text={t("federal.committeeTruncated", {
                        shown: formatNumber(finance.committeeDonors.donors.length),
                        total: formatNumber(finance.committeeDonors.donorCount),
                      })}
                    />
                  )}
                </>
              ) : (
                <p className="empty-note">{t("federal.noCommitteeDonors")}</p>
              )}
            </div>

            <p className="federal-source-line">
              {t("federal.sourceFinance")} ·{" "}
              {t("federal.retrieved", {
                date: formatDate(federal.sources.finance.retrievedAt ?? federal.generatedAt),
              })}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
