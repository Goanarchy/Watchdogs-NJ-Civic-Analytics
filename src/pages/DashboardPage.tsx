import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DistrictMap } from "../components/DistrictMap";
import { PartyBadge } from "../components/PartyBadge";
import { Portrait } from "../components/Portrait";
import {
  CorrelationSandboxLens,
  EffectivenessFunnelLens,
  InfluenceRadarLens,
  PocketbookVotesLens,
} from "../components/lenses";
import { campaign, demographics, demographicsByDistrict, districts, federal } from "../data";
import type {
  Analytics,
  DonorBucketKey,
  LegislatorMatrixRow,
  StatewideDonorSummary,
} from "../lib/analytics";
import { downloadCsv } from "../lib/csv";
import { useI18n, type CopyKey, type Lang } from "../lib/i18n";
import {
  chamberLabel,
  padDistrict,
  partyLabel,
  translateCensusRelease,
  translateCommittee,
  translateLeadership,
} from "../lib/labels";
import { useAnalytics } from "../lib/useAnalytics";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type LensTab =
  | "overview"
  | "topics"
  | "bipartisan"
  | "finance"
  | "districts"
  | "compare"
  | "influence"
  | "effectiveness"
  | "sandbox"
  | "pocketbook";

type MatrixSortKey =
  | "totalBills"
  | "primaryBills"
  | "primaryRatio"
  | "bipartisanBills"
  | "totalRaised"
  | "promisesWithEvidence"
  | "district"
  | "name";

type MapMetricKey =
  | "bills"
  | "medianIncome"
  | "povertyRate"
  | "medianHomeValue"
  | "transitCommuteRate"
  | "totalRaised";

type DistrictSortKey =
  | "district"
  | "bills"
  | "bipartisanBills"
  | "totalRaised"
  | "population"
  | "medianIncome"
  | "medianHomeValue"
  | "povertyRate"
  | "bachelorsPlusRate";

const VALID_TABS: LensTab[] = [
  "overview",
  "topics",
  "bipartisan",
  "finance",
  "districts",
  "compare",
  "influence",
  "effectiveness",
  "sandbox",
  "pocketbook",
];

function isValidTab(value: string | null): value is LensTab {
  return value !== null && (VALID_TABS as string[]).includes(value);
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function money(value: number, lang: Lang, decimals = 0): string {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function compactMoney(value: number, lang: Lang): string {
  if (Math.abs(value) >= 999_500) {
    return `${lang === "es" ? "US$" : "$"}${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${lang === "es" ? "US$" : "$"}${(value / 1_000).toFixed(1)}K`;
  }
  return money(value, lang);
}

function ratioPct(part: number, total: number): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function renderLensIcon(tab: LensTab) {
  switch (tab) {
    case "overview":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="2.5" y="2.5" width="6" height="6" rx="1.4" />
          <rect x="11.5" y="2.5" width="6" height="6" rx="1.4" />
          <rect x="2.5" y="11.5" width="6" height="6" rx="1.4" />
          <rect x="11.5" y="11.5" width="6" height="6" rx="1.4" />
        </svg>
      );
    case "topics":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 3.5h8.5L16 7v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
          <path d="M6.5 10h7M6.5 13.5h4.5" />
        </svg>
      );
    case "bipartisan":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="5" cy="6" r="2.2" />
          <circle cx="15" cy="6" r="2.2" />
          <circle cx="10" cy="14.5" r="2.2" />
          <path d="M7 7l6 0M6.4 8l2.5 4.5M13.6 8l-2.5 4.5" />
        </svg>
      );
    case "finance":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 16.5h14" />
          <path d="M5.5 13.5v-4M10 13.5v-7M14.5 13.5v-9" />
        </svg>
      );
    case "districts":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 17.2s5.2-4.6 5.2-8.7a5.2 5.2 0 1 0-10.4 0c0 4.1 5.2 8.7 5.2 8.7Z" />
          <circle cx="10" cy="8.5" r="1.8" />
        </svg>
      );
    case "compare":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.5h11.5m0 0L12.5 3.5m3 3-3 3" />
          <path d="M16 13.5H4.5m0 0 3-3m-3 3 3 3" />
        </svg>
      );
    case "influence":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="7.5" />
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 2.5v4M10 13.5v4M2.5 10h4M13.5 10h4" />
        </svg>
      );
    case "effectiveness":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h14l-5.5 6.5v5.5l-3-1.8v-3.7L3 4Z" />
        </svg>
      );
    case "sandbox":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 3.5v13h13" />
          <circle cx="7" cy="12.5" r="1.3" fill="currentColor" />
          <circle cx="10" cy="9" r="1.3" fill="currentColor" />
          <circle cx="13" cy="11.5" r="1.3" fill="currentColor" />
          <circle cx="15" cy="6.5" r="1.3" fill="currentColor" />
          <path d="M6 13.5l3.5-4 3 2.5 3-5" strokeDasharray="1.5 1.5" />
        </svg>
      );
    case "pocketbook":
      return (
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="14" height="11" rx="2" />
          <path d="M3 8.5h14" />
          <circle cx="13.5" cy="11.5" r="1" fill="currentColor" />
        </svg>
      );
  }
}

export function DashboardPage() {
  const { analytics, loading, error } = useAnalytics();
  const { t, lang, formatNumber } = useI18n();
  const [params, setParams] = useSearchParams();
  useDocumentTitle(t("superTools.docTitle"));

  const rawTab = params.get("lens") ?? params.get("tab");
  const activeTab: LensTab = isValidTab(rawTab) ? rawTab : "overview";

  function selectTab(next: LensTab) {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("lens");
    if (next === "overview") nextParams.delete("tab");
    else nextParams.set("tab", next);
    if (next !== "compare") {
      nextParams.delete("mode");
      nextParams.delete("district");
    }
    setParams(nextParams, { replace: true });
  }

  const totalPromisesCount = campaign.profiles.reduce(
    (sum, p) => sum + p.promises.length,
    0,
  );

  return (
    <>
      <header className="st-hero">
        <div className="st-hero-inner">
          <div className="st-hero-top">
            <div>
              <span className="st-eyebrow">{t("superTools.eyebrow")}</span>
              <h1>{t("superTools.title")}</h1>
              <p className="st-hero-sub">{t("superTools.sub")}</p>
            </div>
            <div className="st-module-rail" aria-label={t("superTools.modulesAria")}>
              <Link className="st-module-pill is-federal" to="/super-tools/federal">
                <span className="st-module-kicker">{t("superTools.federalKicker")}</span>
                <strong>{t("superTools.federalTitle")}</strong>
                <span className="st-module-stat">
                  {t("superTools.federalStat", {
                    districts: federal.districts.length,
                    candidates: federal.election.candidateCount,
                  })}
                </span>
              </Link>
              <Link className="st-module-pill" to="/super-tools/por-quien-voto">
                <span className="st-module-kicker">{t("superTools.voteKicker")}</span>
                <strong>{t("superTools.voteTitle")}</strong>
                <span className="st-module-stat">
                  {t("superTools.wbPromiseStat", {
                    profiles: formatNumber(campaign.profiles.length),
                    promises: formatNumber(totalPromisesCount),
                  })}
                </span>
              </Link>
              <Link className="st-module-pill" to="/buscar-representante">
                <span className="st-module-kicker">{t("superTools.findKicker")}</span>
                <strong>{t("superTools.findTitle")}</strong>
                <span className="st-module-stat">564 · 40 {t("superTools.districtsShort")}</span>
              </Link>
            </div>
          </div>

          {analytics && !loading && (
            <div className="st-telemetry-ribbon" aria-label={t("superTools.kpiAria")}>
              <div className="st-telemetry-cell">
                <span className="st-telemetry-label">{t("superTools.kpiBills")}</span>
                <strong className="st-telemetry-val num">
                  {formatNumber(analytics.totalBills)}
                </strong>
                <span className="st-telemetry-meta">
                  {t("superTools.kpiBillsSub", {
                    assembly: formatNumber(analytics.billsByChamber.Assembly),
                    senate: formatNumber(analytics.billsByChamber.Senate),
                  })}
                </span>
              </div>
              <div className="st-telemetry-cell">
                <span className="st-telemetry-label">{t("superTools.wbKpiMoney")}</span>
                <strong className="st-telemetry-val num">
                  {compactMoney(analytics.finance.totalRaised, lang)}
                </strong>
                <span className="st-telemetry-meta">
                  {t("superTools.wbKpiMoneySub", {
                    covered: analytics.finance.coveredLegislators,
                    records: formatNumber(analytics.finance.totalDonorRecords),
                  })}
                </span>
              </div>
              <div className="st-telemetry-cell">
                <span className="st-telemetry-label">{t("superTools.kpiBipartisan")}</span>
                <strong className="st-telemetry-val num">
                  {pct(analytics.bipartisanBills, analytics.totalBills)}%
                </strong>
                <span className="st-telemetry-meta">
                  {t("superTools.wbKpiBipartisanSub", {
                    count: formatNumber(analytics.bipartisanBills),
                  })}
                </span>
              </div>
              <div className="st-telemetry-cell">
                <span className="st-telemetry-label">{t("superTools.wbKpiCensus")}</span>
                <strong className="st-telemetry-val num">
                  {(demographics.statewide.population / 1_000_000).toFixed(2)}M
                </strong>
                <span className="st-telemetry-meta">
                  {translateCensusRelease(demographics.release.name, lang)} · {money(demographics.statewide.medianIncome, lang)}
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="st-lens-bar">
        <nav className="st-lens-nav" aria-label={t("superTools.wbLensNav")}>
          {(
            [
              [
                "overview",
                "01",
                "superTools.wbTabOverview",
                analytics
                  ? `120 · ${formatNumber(analytics.totalBills)}`
                  : "120 · 11.4K",
              ],
              [
                "topics",
                "02",
                "superTools.wbTabTopics",
                `${analytics?.topicStats.length ?? 18} ${lang === "es" ? "Temas" : "Topics"}`,
              ],
              [
                "bipartisan",
                "03",
                "superTools.wbTabBipartisan",
                `${analytics ? pct(analytics.bipartisanBills, analytics.totalBills) : 23}% ${lang === "es" ? "Bipart." : "Bipart."}`,
              ],
              [
                "finance",
                "04",
                "superTools.wbTabFinance",
                analytics ? compactMoney(analytics.finance.totalRaised, lang) : "$58.4M",
              ],
              [
                "districts",
                "05",
                "superTools.wbTabDistricts",
                "40 LDs · ACS",
              ],
              [
                "compare",
                "06",
                "superTools.wbTabCompare",
                "1v1 · 1v1v1",
              ],
              [
                "influence",
                "07",
                "superTools.tabInfluence",
                `${compactMoney(analytics?.finance.totalRaised ?? 0, lang)} · ${t("superTools.metricInfluence")}`,
              ],
              [
                "effectiveness",
                "08",
                "superTools.tabEffectiveness",
                `${formatNumber(analytics?.effectiveness.substantiveBillCount ?? 0)} · ${t("superTools.metricEffectiveness")}`,
              ],
              [
                "sandbox",
                "09",
                "superTools.tabSandbox",
                `${t("superTools.metricSandbox")} · r`,
              ],
              [
                "pocketbook",
                "10",
                "superTools.tabPocketbook",
                t("superTools.metricPocketbook", {
                  count: Object.values(
                    analytics?.pocketbook.domainRollCallCounts ?? {},
                  ).reduce((a, b) => a + b, 0),
                }),
              ],
            ] as Array<[LensTab, string, CopyKey, string]>
          ).map(([id, code, key, metric]) => (
            <button
              key={id}
              type="button"
              className={`st-lens-btn st-lens-card-${code}${activeTab === id ? " is-active" : ""}`}
              aria-pressed={activeTab === id}
              onClick={() => selectTab(id)}
            >
              <span className="st-lens-card-top">
                <span className="st-lens-num-wrap">
                  <span className="st-lens-num num">{code}</span>
                  <span className="st-lens-icon" aria-hidden="true">
                    {renderLensIcon(id)}
                  </span>
                </span>
                <span className="st-lens-live-pill num">{metric}</span>
              </span>
              <span className="st-lens-card-body">
                <strong className="st-lens-title">{t(key)}</strong>
                <span className="st-lens-arrow" aria-hidden="true">→</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <main className="page-shell st-main">
        {loading && (
          <div className="status-panel">
            <strong>{t("superTools.loadingTitle")}</strong>
            <span>{t("superTools.loadingSub")}</span>
          </div>
        )}

        {error && (
          <div className="status-panel error">
            <strong>{t("superTools.errorTitle")}</strong>
            <span>{t("superTools.errorSub")}</span>
          </div>
        )}

        {analytics && !loading && (
          <>
            {activeTab === "overview" && (
              <OverviewLens analytics={analytics} onSwitchTab={selectTab} />
            )}
            {activeTab === "topics" && <TopicsLens analytics={analytics} />}
            {activeTab === "bipartisan" && (
              <BipartisanshipLens analytics={analytics} />
            )}
            {activeTab === "finance" && <FinanceLens analytics={analytics} />}
            {activeTab === "districts" && <DistrictsLens analytics={analytics} />}
            {activeTab === "compare" && <CompareLens analytics={analytics} />}
            {activeTab === "influence" && (
              <InfluenceRadarLens analytics={analytics} />
            )}
            {activeTab === "effectiveness" && (
              <EffectivenessFunnelLens analytics={analytics} />
            )}
            {activeTab === "sandbox" && (
              <CorrelationSandboxLens analytics={analytics} />
            )}
            {activeTab === "pocketbook" && (
              <PocketbookVotesLens analytics={analytics} />
            )}
          </>
        )}
      </main>
    </>
  );
}

/* ========================================================================== */
/* LENS 01: OVERVIEW & 120-LEGISLATOR ANALYTICAL MATRIX                       */
/* ========================================================================== */

function OverviewLens({
  analytics,
  onSwitchTab,
}: {
  analytics: Analytics;
  onSwitchTab: (tab: LensTab) => void;
}) {
  const { t, lang, formatNumber } = useI18n();
  const [query, setQuery] = useState("");
  const [chamber, setChamber] = useState<"all" | "Senate" | "Assembly">("all");
  const [party, setParty] = useState<"all" | "D" | "R">("all");
  const [sortBy, setSortBy] = useState<MatrixSortKey>("totalBills");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showAllRows, setShowAllRows] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analytics.legislatorMatrix
      .filter((row) => {
        if (chamber !== "all" && row.legislator.chamber !== chamber) return false;
        if (party !== "all" && row.legislator.party !== party) return false;
        if (!q) return true;
        return (
          row.legislator.fullName.toLowerCase().includes(q) ||
          String(row.legislator.district).includes(q) ||
          (row.legislator.districtInfo?.counties ?? []).some((c) =>
            c.toLowerCase().includes(q),
          )
        );
      })
      .sort((a, b) => {
        const dir = sortDir === "desc" ? -1 : 1;
        if (sortBy === "name") {
          return dir * -1 * a.legislator.sortName.localeCompare(b.legislator.sortName, lang);
        }
        if (sortBy === "district") {
          return (a.legislator.district - b.legislator.district) * (sortDir === "asc" ? 1 : -1);
        }
        const av = a[sortBy];
        const bv = b[sortBy];
        if (av !== bv) return (av - bv) * dir;
        return b.totalBills - a.totalBills;
      });
  }, [analytics.legislatorMatrix, chamber, party, query, sortBy, sortDir, lang]);

  function toggleSort(key: MatrixSortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir(key === "district" || key === "name" ? "asc" : "desc");
    }
  }

  function handleExportCsv() {
    downloadCsv(
      "watchdogs-nj-legislators-matrix.csv",
      [
        "ID",
        "Name",
        "Party",
        "Chamber",
        "District",
        "TotalBills",
        "PrimaryBills",
        "CosponsoredBills",
        "PrimaryPct",
        "BipartisanBills",
        "BipartisanPct",
        "Committees",
        "PromisesTracked",
        "PromisesWithEvidence",
        "ELEC_TotalRaised_USD",
        "ELEC_DonorGroups",
        "DistrictMedianIncome_USD",
      ],
      filtered.map((r) => [
        r.legislator.id,
        r.legislator.fullName,
        r.legislator.party,
        r.legislator.chamber,
        r.legislator.district,
        r.totalBills,
        r.primaryBills,
        r.cosponsoredBills,
        r.primaryRatio,
        r.bipartisanBills,
        r.bipartisanRate,
        r.committeesCount,
        r.promisesTotal,
        r.promisesWithEvidence,
        r.totalRaised,
        r.donorCount,
        r.medianIncome,
      ]),
    );
  }

  const visibleRows = showAllRows ? filtered : filtered.slice(0, 30);
  const topSharePct = Math.round(analytics.topTenShare * 100);
  const totalPartySponsorships =
    analytics.partySponsorships.D + analytics.partySponsorships.R;
  const demSponPct = pct(analytics.partySponsorships.D, totalPartySponsorships);

  return (
    <div className="st-lens-stack">
      <div className="st-summary-grid">
        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.concentrationKicker")}</p>
              <h2>{t("superTools.wbPowerTitle")}</h2>
            </div>
            <span className="badge badge-navy num">{topSharePct}% {t("superTools.wbTop10Tag")}</span>
          </div>
          <p className="panel-intro">
            {t("superTools.concentrationText", { pct: topSharePct })}
          </p>
          <div className="st-stat-pair">
            <div>
              <span className="st-stat-mini-label">{t("superTools.medianMember")}</span>
              <strong className="num">{formatNumber(analytics.medianSponsorships)}</strong>
            </div>
            <div>
              <span className="st-stat-mini-label">{t("superTools.meanMember")}</span>
              <strong className="num">{formatNumber(analytics.meanSponsorships)}</strong>
            </div>
            <div>
              <span className="st-stat-mini-label">{t("superTools.totalSponsorships")}</span>
              <strong className="num">{formatNumber(analytics.totalSponsorships)}</strong>
            </div>
          </div>
        </article>

        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.partyKicker")}</p>
              <h2>{t("superTools.partyTitle")}</h2>
            </div>
            <button
              type="button"
              className="link-button"
              onClick={() => onSwitchTab("bipartisan")}
            >
              {t("superTools.wbOpenBipartisan")} →
            </button>
          </div>
          <p className="panel-intro">{t("superTools.partyIntro")}</p>
          <div className="party-split" style={{ marginTop: 14 }}>
            <div className="party-split-bar" aria-hidden="true">
              <span className="split-dem" style={{ width: `${demSponPct}%` }} />
              <span className="split-rep" style={{ width: `${100 - demSponPct}%` }} />
            </div>
            <div className="party-split-labels">
              <span>
                <strong className="dot dot-d" /> {partyLabel("D", lang)}:{" "}
                <span className="num">{formatNumber(analytics.partySponsorships.D)}</span> (
                {demSponPct}%)
              </span>
              <span>
                <strong className="dot dot-r" /> {partyLabel("R", lang)}:{" "}
                <span className="num">{formatNumber(analytics.partySponsorships.R)}</span> (
                {100 - demSponPct}%)
              </span>
            </div>
          </div>
        </article>
      </div>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.wbMatrixKicker")}</p>
            <h2>{t("superTools.wbMatrixTitle")}</h2>
          </div>
          <div className="st-head-actions">
            <span className="panel-source num">
              {t("superTools.wbShowingCount", {
                shown: formatNumber(filtered.length),
                total: formatNumber(analytics.legislatorMatrix.length),
              })}
            </span>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={handleExportCsv}
            >
              {t("superTools.wbExportCsv")}
            </button>
          </div>
        </div>

        <div className="st-toolbar">
          <input
            type="search"
            className="st-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("superTools.wbMatrixSearch")}
            aria-label={t("superTools.wbMatrixSearch")}
          />
          <select
            value={chamber}
            onChange={(e) =>
              setChamber(e.target.value as "all" | "Senate" | "Assembly")
            }
            aria-label={t("home.chamber")}
          >
            <option value="all">{t("common.allChambers")}</option>
            <option value="Senate">{t("common.senate")}</option>
            <option value="Assembly">{t("common.assembly")}</option>
          </select>
          <select
            value={party}
            onChange={(e) => setParty(e.target.value as "all" | "D" | "R")}
            aria-label={t("home.party")}
          >
            <option value="all">{t("common.allParties")}</option>
            <option value="D">{t("common.democratPlural")}</option>
            <option value="R">{t("common.republicanPlural")}</option>
          </select>
        </div>

        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <SortTh
                  label={t("superTools.wbColLegislator")}
                  active={sortBy === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
                <SortTh
                  label={t("home.district")}
                  active={sortBy === "district"}
                  dir={sortDir}
                  onClick={() => toggleSort("district")}
                />
                <SortTh
                  label={t("superTools.wbColBills")}
                  active={sortBy === "totalBills"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("totalBills")}
                />
                <SortTh
                  label={t("superTools.wbColPrimaryPct")}
                  active={sortBy === "primaryRatio"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("primaryRatio")}
                />
                <SortTh
                  label={t("superTools.wbColBipartisan")}
                  active={sortBy === "bipartisanBills"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("bipartisanBills")}
                />
                <SortTh
                  label={t("superTools.wbColElec")}
                  active={sortBy === "totalRaised"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("totalRaised")}
                />
                <SortTh
                  label={t("superTools.wbColPromises")}
                  active={sortBy === "promisesWithEvidence"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("promisesWithEvidence")}
                />
                <th>{t("superTools.wbColFocusTopic")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.legislator.id}>
                  <td>
                    <div className="st-person-cell">
                      <Portrait
                        src={row.legislator.photo}
                        name={row.legislator.fullName}
                        className="st-mini-avatar"
                      />
                      <div>
                        <Link
                          className="st-person-link"
                          to={`/legislador/${row.legislator.id}`}
                        >
                          {row.legislator.fullName}
                        </Link>
                        <div className="st-person-sub">
                          <PartyBadge party={row.legislator.party} />
                          <span>{chamberLabel(row.legislator.chamber, lang)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="num" data-label={t("home.district")}>
                    <Link
                      className="st-dist-pill"
                      to={`/district/${row.legislator.district}`}
                    >
                      D{padDistrict(row.legislator.district)}
                    </Link>
                  </td>
                  <td className="num text-right" data-label={t("superTools.wbColBills")}>
                    <strong>{formatNumber(row.totalBills)}</strong>
                    <span className="st-cell-sub">
                      {row.primaryBills}P · {row.cosponsoredBills}C
                    </span>
                  </td>
                  <td className="num text-right" data-label={t("superTools.wbColPrimaryPct")}>
                    <div className="st-ratio-cell">
                      <span>{row.primaryRatio}%</span>
                      <span className="st-ratio-track" aria-hidden="true">
                        <span
                          className="st-ratio-fill"
                          style={{ width: `${row.primaryRatio}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="num text-right" data-label={t("superTools.wbColBipartisan")}>
                    <strong>{formatNumber(row.bipartisanBills)}</strong>
                    <span className="st-cell-sub">{row.bipartisanRate}%</span>
                  </td>
                  <td className="num text-right" data-label={t("superTools.wbColElec")}>
                    <strong>{compactMoney(row.totalRaised, lang)}</strong>
                    <span className="st-cell-sub">
                      {formatNumber(row.donorCount)} {t("superTools.wbDonorsShort")}
                    </span>
                  </td>
                  <td className="num text-right" data-label={t("superTools.wbColPromises")}>
                    {row.promisesTotal > 0 ? (
                      <>
                        <strong>
                          {row.promisesWithEvidence}/{row.promisesTotal}
                        </strong>
                        <span className="st-cell-sub">{t("superTools.wbWithEvidence")}</span>
                      </>
                    ) : (
                      <span className="st-muted-dash">—</span>
                    )}
                  </td>
                  <td data-label={t("superTools.wbColFocusTopic")}>
                    <Link
                      className="st-topic-chip"
                      to={`/super-tools/topics/${row.topTopic.slug}`}
                    >
                      {row.topTopic.label[lang]}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 30 && (
          <div className="st-table-footer">
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => setShowAllRows((v) => !v)}
            >
              {showAllRows
                ? t("superTools.wbShowTop30")
                : t("superTools.wbShowAllRows", {
                    count: formatNumber(filtered.length),
                  })}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ========================================================================== */
/* LENS 02: POLICY & TOPICS LAB                                               */
/* ========================================================================== */

function TopicsLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();
  const stat = analytics.featuredTopic;
  const maxBills = Math.max(
    ...analytics.topicStats.map((item) => item.billCount),
    1,
  );
  const topTopicShare = ratioPct(stat.billCount, analytics.totalBills);

  return (
    <div className="st-lens-stack">
      <section className="featured-topic-band">
        <div className="featured-topic-head">
          <div>
            <span className="featured-badge">
              {t("superTools.featuredBadge")} · {topTopicShare}
            </span>
            <h2>
              <Link to={`/super-tools/topics/${stat.topic.slug}`}>
                {stat.topic.label[lang]}
              </Link>
            </h2>
            <p className="featured-lead">
              {stat.topic.description[lang]}
            </p>
          </div>
          <Link
            className="button button-primary button-small"
            to={`/super-tools/topics/${stat.topic.slug}`}
          >
            {t("superTools.openFullAnalysis")}
          </Link>
        </div>

        <div className="featured-metrics">
          <div>
            <strong className="num">{formatNumber(stat.billCount)}</strong>
            <span>{t("superTools.billsInAgenda")}</span>
          </div>
          <div>
            <strong className="num">{formatNumber(stat.participants.length)}</strong>
            <span>{t("superTools.participatingMembers")}</span>
          </div>
          <div>
            <strong className="num">{formatNumber(stat.bipartisanBills)}</strong>
            <span>{t("superTools.bipartisanBillsShort")}</span>
          </div>
          <div>
            <strong className="num">{formatNumber(stat.primarySponsorships)}</strong>
            <span>{t("superTools.primaryAuthors")}</span>
          </div>
        </div>
      </section>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.topicKicker")}</p>
            <h2>{t("superTools.topicTitle")}</h2>
          </div>
          <span className="panel-source num">
            {formatNumber(analytics.topicStats.length)} {t("superTools.wbPolicyAreas")}
          </span>
        </div>
        <p className="panel-intro">{t("superTools.wbTopicsMatrixIntro")}</p>

        <div className="st-table-wrap" style={{ marginTop: 14 }}>
          <table className="st-table">
            <thead>
              <tr>
                <th>{t("superTools.wbColTopic")}</th>
                <th className="text-right">{t("superTools.wbColBills")}</th>
                <th>{t("superTools.wbColPartisanSplit")}</th>
                <th className="text-right">{t("superTools.wbColBipartisan")}</th>
                <th className="text-right">{t("superTools.wbColMembers")}</th>
                <th className="text-right">{t("superTools.wbColChambers")}</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topicStats.map((topicStat) => {
                const name = topicStat.topic.label[lang];
                const dCount = topicStat.partyBills.D;
                const rCount = topicStat.partyBills.R;
                const totalParty = dCount + rCount || 1;
                const demW = Math.round((dCount / totalParty) * 100);
                const bipPct = pct(topicStat.bipartisanBills, topicStat.billCount);
                return (
                  <tr key={topicStat.topic.slug}>
                    <td>
                      <Link
                        className="st-person-link"
                        to={`/super-tools/topics/${topicStat.topic.slug}`}
                      >
                        {name}
                      </Link>
                      <div className="st-topic-bar-track" aria-hidden="true">
                        <span
                          className="st-topic-bar-fill"
                          style={{
                            width: `${(topicStat.billCount / maxBills) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColBills")}>
                      <strong>{formatNumber(topicStat.billCount)}</strong>
                      <span className="st-cell-sub">
                        {ratioPct(topicStat.billCount, analytics.totalBills)}
                      </span>
                    </td>
                    <td data-label={t("superTools.wbColPartisanSplit")}>
                      <div className="st-split-mini">
                        <span className="st-split-track" aria-hidden="true">
                          <span className="split-dem" style={{ width: `${demW}%` }} />
                          <span
                            className="split-rep"
                            style={{ width: `${100 - demW}%` }}
                          />
                        </span>
                        <span className="st-cell-sub num">
                          D {formatNumber(dCount)} · R {formatNumber(rCount)}
                        </span>
                      </div>
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColBipartisan")}>
                      <strong>{formatNumber(topicStat.bipartisanBills)}</strong>
                      <span className="st-cell-sub">{bipPct}%</span>
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColMembers")}>
                      {formatNumber(topicStat.participants.length)}
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColChambers")}>
                      A {formatNumber(topicStat.chamberBills.Assembly)} · S{" "}
                      {formatNumber(topicStat.chamberBills.Senate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.committeesKicker")}</p>
            <h2>{t("superTools.committeesTitle")}</h2>
          </div>
          <span className="panel-source num">
            {formatNumber(analytics.committees.length)} {t("superTools.committeesShort")}
          </span>
        </div>
        <div className="st-committee-grid">
          {analytics.committees.slice(0, 10).map((committee) => (
            <Link
              className="committee-row"
              key={committee.name}
              to={`/committee/${encodeURIComponent(committee.name)}`}
            >
              <div>
                <strong>{translateCommittee(committee.name, lang)}</strong>
                <span>
                  {t("superTools.membersOnCommittee", {
                    count: committee.members,
                  })}
                </span>
              </div>
              <span className="committee-bills num">
                {formatNumber(committee.bills)} {t("superTools.billsShort")}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ========================================================================== */
/* LENS 03: BIPARTISANSHIP & CROSS-PARTY ALLIANCES                            */
/* ========================================================================== */

function BipartisanshipLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();
  const [chamberFilter, setChamberFilter] = useState<"all" | "Senate" | "Assembly">("all");
  const singlePartyMulti = Math.max(
    0,
    analytics.singlePartyBills - analytics.singleSponsorBills,
  );

  const leaders = analytics.bipartisanLeaders
    .filter((row) =>
      chamberFilter === "all" ? true : row.legislator.chamber === chamberFilter,
    )
    .slice(0, 20);

  return (
    <div className="st-lens-stack">
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.wbBipKicker")}</p>
            <h2>{t("superTools.wbBipTitle")}</h2>
          </div>
          <span className="badge badge-navy num">
            {formatNumber(analytics.bipartisanBills)} {t("superTools.bipartisanBillsShort")} (
            {pct(analytics.bipartisanBills, analytics.totalBills)}%)
          </span>
        </div>
        <p className="panel-intro">{t("superTools.wbBipIntro")}</p>

        <div className="composition-bar" style={{ marginTop: 14 }} aria-hidden="true">
          <span
            className="comp-bip"
            style={{ width: `${(analytics.bipartisanBills / analytics.totalBills) * 100}%` }}
          />
          <span
            className="comp-party"
            style={{ width: `${(singlePartyMulti / analytics.totalBills) * 100}%` }}
          />
          <span
            className="comp-single"
            style={{ width: `${(analytics.singleSponsorBills / analytics.totalBills) * 100}%` }}
          />
        </div>
        <ul className="composition-legend">
          <li>
            <span className="comp-swatch comp-bip" />
            <span>{t("superTools.jointBipartisan")}</span>
            <strong className="num">{formatNumber(analytics.bipartisanBills)}</strong>
          </li>
          <li>
            <span className="comp-swatch comp-party" />
            <span>{t("superTools.singlePartyMulti")}</span>
            <strong className="num">{formatNumber(singlePartyMulti)}</strong>
          </li>
          <li>
            <span className="comp-swatch comp-single" />
            <span>{t("superTools.soleAuthor")}</span>
            <strong className="num">{formatNumber(analytics.singleSponsorBills)}</strong>
          </li>
        </ul>
      </section>

      <div className="st-lens-stack">
        <section className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.wbBridgeKicker")}</p>
              <h2>{t("superTools.wbBridgeTitle")}</h2>
            </div>
            <select
              value={chamberFilter}
              onChange={(e) =>
                setChamberFilter(e.target.value as "all" | "Senate" | "Assembly")
              }
              aria-label={t("home.chamber")}
            >
              <option value="all">{t("common.allChambers")}</option>
              <option value="Senate">{t("common.senate")}</option>
              <option value="Assembly">{t("common.assembly")}</option>
            </select>
          </div>
          <p className="panel-intro">{t("superTools.wbBridgeIntro")}</p>

          <div className="st-table-wrap" style={{ marginTop: 12 }}>
            <table className="st-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("superTools.wbColLegislator")}</th>
                  <th className="text-right">{t("superTools.wbColBipartisan")}</th>
                  <th className="text-right">{t("superTools.wbColRate")}</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row, idx) => (
                  <tr key={row.legislator.id}>
                    <td className="num" data-label="#">{idx + 1}</td>
                    <td data-label={t("superTools.wbColLegislator")}>
                      <Link
                        className="st-person-link"
                        to={`/legislador/${row.legislator.id}`}
                      >
                        {row.legislator.fullName}
                      </Link>
                      <div className="st-person-sub">
                        <PartyBadge party={row.legislator.party} />
                        <span>
                          D{padDistrict(row.legislator.district)} ·{" "}
                          {chamberLabel(row.legislator.chamber, lang)}
                        </span>
                      </div>
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColBipartisan")}>
                      <strong>{formatNumber(row.bipartisanBills)}</strong>
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColRate")}>{row.bipartisanRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.wbPairsKicker")}</p>
              <h2>{t("superTools.wbPairsTitle")}</h2>
            </div>
            <span className="panel-source num">Top {analytics.crossPartyPairs.length}</span>
          </div>
          <p className="panel-intro">{t("superTools.wbPairsIntro")}</p>

          <div className="st-table-wrap" style={{ marginTop: 12 }}>
            <table className="st-table">
              <thead>
                <tr>
                  <th>{t("superTools.wbColDemPartner")}</th>
                  <th>{t("superTools.wbColRepPartner")}</th>
                  <th className="text-right">{t("superTools.wbColFocusedBills")}</th>
                  <th className="text-right">{t("superTools.wbColSharedAll")}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.crossPartyPairs.slice(0, 20).map((pair) => (
                  <tr key={`${pair.dem.id}-${pair.rep.id}`}>
                    <td data-label={t("superTools.wbColDemPartner")}>
                      <Link
                        className="st-person-link"
                        to={`/legislador/${pair.dem.id}`}
                      >
                        {pair.dem.fullName}
                      </Link>
                      <span className="st-cell-sub">
                        D · D{padDistrict(pair.dem.district)}
                      </span>
                    </td>
                    <td data-label={t("superTools.wbColRepPartner")}>
                      <Link
                        className="st-person-link"
                        to={`/legislador/${pair.rep.id}`}
                      >
                        {pair.rep.fullName}
                      </Link>
                      <span className="st-cell-sub">
                        R · D{padDistrict(pair.rep.district)}
                      </span>
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColFocusedBills")}>
                      <strong>{formatNumber(pair.focusedBills)}</strong>
                    </td>
                    <td className="num text-right" data-label={t("superTools.wbColSharedAll")}>
                      {formatNumber(pair.sharedBills)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* LENS 04: MONEY IN POLITICS (ELEC CAMPAIGN FINANCE LAB)                     */
/* ========================================================================== */

function FinanceLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();
  const [donorQuery, setDonorQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | DonorBucketKey>("all");
  const [expandedDonorKey, setExpandedDonorKey] = useState<string | null>(null);

  const f = analytics.finance;
  const demFin = f.byParty.find((p) => p.party === "D") ?? {
    legislators: 0,
    totalRaised: 0,
    avgRaised: 0,
  };
  const repFin = f.byParty.find((p) => p.party === "R") ?? {
    legislators: 0,
    totalRaised: 0,
    avgRaised: 0,
  };
  const partySum = demFin.totalRaised + repFin.totalRaised || 1;
  const demSharePct = Math.round((demFin.totalRaised / partySum) * 100);

  const matchingDonors = useMemo(() => {
    const q = donorQuery.trim().toLowerCase();
    const pool = f.allDonors.filter((donor) => {
      if (bucketFilter !== "all" && donor.bucket !== bucketFilter) return false;
      if (!q) return true;
      return donor.name.toLowerCase().includes(q);
    });
    return pool.slice(0, q ? 40 : 25);
  }, [f.allDonors, donorQuery, bucketFilter]);

  function bucketLabel(bucket: DonorBucketKey): string {
    const map: Record<DonorBucketKey, CopyKey> = {
      individual: "superTools.wbBucketIndividual",
      pacUnion: "superTools.wbBucketPacUnion",
      corporateBusiness: "superTools.wbBucketCorporate",
      partyCommittee: "superTools.wbBucketParty",
      otherOrg: "superTools.wbBucketOther",
    };
    return t(map[bucket]);
  }

  function exportDonorsCsv() {
    downloadCsv(
      "watchdogs-nj-elec-top-donors.csv",
      [
        "DonorName",
        "Category",
        "TotalAmount_USD",
        "Democratic_USD",
        "Republican_USD",
        "LegislatorsFunded",
        "ContributionCount",
      ],
      matchingDonors.map((d) => [
        d.name,
        bucketLabel(d.bucket),
        Math.round(d.totalAmount * 100) / 100,
        Math.round(d.dAmount * 100) / 100,
        Math.round(d.rAmount * 100) / 100,
        d.legislatorCount,
        d.contributionCount,
      ]),
    );
  }

  return (
    <div className="st-lens-stack">
      <div className="st-kpi-four">
        <div className="st-kpi-box">
          <span>{t("superTools.wbElecTotal")}</span>
          <strong className="num">{money(f.totalRaised, lang)}</strong>
          <small>{t("superTools.wbElecTotalSub", { profiles: f.profilesCount })}</small>
        </div>
        <div className="st-kpi-box">
          <span>{t("superTools.wbElecMedian")}</span>
          <strong className="num">{money(f.medianRaisedPerLegislator, lang)}</strong>
          <small>
            {f.coveredLegislators}/120 {t("superTools.wbLegislatorsCovered")}
          </small>
        </div>
        <div className="st-kpi-box">
          <span>{t("superTools.wbElecContributions")}</span>
          <strong className="num">{formatNumber(f.totalContributions)}</strong>
          <small>
            {formatNumber(f.allDonors.length)} {t("superTools.wbUniqueDonors")}
          </small>
        </div>
        <div className="st-kpi-box">
          <span>{t("superTools.wbElecCycles")}</span>
          <strong className="num">
            {f.byCycle.map((c) => `${c.year}: ${compactMoney(c.totalRaised, lang)}`).join(" · ")}
          </strong>
          <small>NJ ELEC {t("superTools.wbOfficialFilings")}</small>
        </div>
      </div>

      <div className="st-summary-grid">
        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.wbMoneyPartyKicker")}</p>
              <h2>{t("superTools.wbMoneyPartyTitle")}</h2>
            </div>
          </div>
          <div className="party-split" style={{ marginTop: 10 }}>
            <div className="party-split-bar" aria-hidden="true">
              <span className="split-dem" style={{ width: `${demSharePct}%` }} />
              <span className="split-rep" style={{ width: `${100 - demSharePct}%` }} />
            </div>
            <div className="party-split-labels">
              <span>
                <strong className="dot dot-d" /> {partyLabel("D", lang)} ({demFin.legislators}):{" "}
                <strong className="num">{compactMoney(demFin.totalRaised, lang)}</strong> ·{" "}
                {t("superTools.wbAvgPerMember")} {compactMoney(demFin.avgRaised, lang)}
              </span>
              <span>
                <strong className="dot dot-r" /> {partyLabel("R", lang)} ({repFin.legislators}):{" "}
                <strong className="num">{compactMoney(repFin.totalRaised, lang)}</strong> ·{" "}
                {t("superTools.wbAvgPerMember")} {compactMoney(repFin.avgRaised, lang)}
              </span>
            </div>
          </div>

          <div className="st-chamber-bars" style={{ marginTop: 18 }}>
            {f.byChamber.map((c) => (
              <div key={c.chamber} className="st-chamber-row">
                <div>
                  <strong>{chamberLabel(c.chamber, lang)}</strong> ({c.legislators})
                </div>
                <div className="num">
                  <strong>{money(c.totalRaised, lang)}</strong> · {t("superTools.wbAvgPerMember")}{" "}
                  {compactMoney(c.avgRaised, lang)}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.wbDonorSourceKicker")}</p>
              <h2>{t("superTools.wbDonorSourceTitle")}</h2>
            </div>
          </div>
          <div className="st-bucket-list">
            {f.byBucket.map((b) => {
              const share = Math.round((b.totalAmount / (f.totalRaised || 1)) * 100);
              return (
                <div key={b.bucket} className="st-bucket-row">
                  <div className="st-bucket-meta">
                    <strong>{bucketLabel(b.bucket)}</strong>
                    <span className="num">
                      {compactMoney(b.totalAmount, lang)} ({share}%) ·{" "}
                      {formatNumber(b.donorEntities)} {t("superTools.wbEntities")}
                    </span>
                  </div>
                  <div className="st-topic-bar-track" aria-hidden="true">
                    <span
                      className="st-topic-bar-fill is-gold"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.wbDonorSearchKicker")}</p>
            <h2>{t("superTools.wbDonorSearchTitle")}</h2>
          </div>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={exportDonorsCsv}
          >
            {t("superTools.wbExportCsv")}
          </button>
        </div>
        <p className="panel-intro">{t("superTools.wbDonorSearchIntro")}</p>

        <div className="st-toolbar">
          <input
            type="search"
            className="st-search-input"
            value={donorQuery}
            onChange={(e) => setDonorQuery(e.target.value)}
            placeholder={t("superTools.wbDonorSearchPlaceholder")}
            aria-label={t("superTools.wbDonorSearchPlaceholder")}
          />
          <select
            value={bucketFilter}
            onChange={(e) =>
              setBucketFilter(e.target.value as "all" | DonorBucketKey)
            }
            aria-label={t("superTools.wbDonorSourceTitle")}
          >
            <option value="all">{t("superTools.wbAllCategories")}</option>
            <option value="pacUnion">{t("superTools.wbBucketPacUnion")}</option>
            <option value="individual">{t("superTools.wbBucketIndividual")}</option>
            <option value="corporateBusiness">{t("superTools.wbBucketCorporate")}</option>
            <option value="partyCommittee">{t("superTools.wbBucketParty")}</option>
            <option value="otherOrg">{t("superTools.wbBucketOther")}</option>
          </select>
        </div>

        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("profile.donorName")}</th>
                <th>{t("profile.donorType")}</th>
                <th className="text-right">{t("superTools.wbColTotalDonated")}</th>
                <th>{t("superTools.wbColPartisanSplit")}</th>
                <th className="text-right">{t("superTools.wbColLegislatorsFunded")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {matchingDonors.map((donor, idx) => (
                <DonorAccordionRow
                  key={donor.key}
                  rank={idx + 1}
                  donor={donor}
                  categoryLabel={bucketLabel(donor.bucket)}
                  expanded={expandedDonorKey === donor.key}
                  onToggle={() =>
                    setExpandedDonorKey((curr) =>
                      curr === donor.key ? null : donor.key,
                    )
                  }
                />
              ))}
              {matchingDonors.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-note">
                    {t("superTools.wbNoDonorMatches")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.wbTopFundedKicker")}</p>
            <h2>{t("superTools.wbTopFundedTitle")}</h2>
          </div>
          <span className="panel-source">NJ ELEC 2023 + 2025</span>
        </div>
        <div className="st-top-recipients-grid">
          {f.topRecipients.slice(0, 12).map((row, idx) => (
            <Link
              key={row.legislator.id}
              to={`/legislador/${row.legislator.id}`}
              className="st-recipient-card"
            >
              <span className="st-rec-rank num">#{idx + 1}</span>
              <Portrait
                src={row.legislator.photo}
                name={row.legislator.fullName}
                className="st-mini-avatar"
              />
              <div className="st-rec-info">
                <strong>{row.legislator.fullName}</strong>
                <span>
                  {row.legislator.party} · D{padDistrict(row.legislator.district)} ·{" "}
                  {chamberLabel(row.legislator.chamber, lang)}
                </span>
              </div>
              <div className="st-rec-amount num">
                <strong>{compactMoney(row.totalRaised, lang)}</strong>
                <span>
                  {formatNumber(row.totalBills)} {t("superTools.billsShort")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function DonorAccordionRow({
  rank,
  donor,
  categoryLabel,
  expanded,
  onToggle,
}: {
  rank: number;
  donor: StatewideDonorSummary;
  categoryLabel: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t, lang, formatNumber } = useI18n();
  const splitDenom = donor.dAmount + donor.rAmount || 1;
  const demW = Math.round((donor.dAmount / splitDenom) * 100);

  return (
    <>
      <tr>
        <td className="num" data-label="#">{rank}</td>
        <td data-label={t("profile.donorName")}>
          <strong>{donor.name}</strong>
          <span className="st-cell-sub num">
            {formatNumber(donor.contributionCount)} {t("profile.donorContributionsCount")}
          </span>
        </td>
        <td data-label={t("profile.donorType")}>
          <span className="chip">{categoryLabel}</span>
        </td>
        <td className="num text-right" data-label={t("superTools.wbColTotalDonated")}>
          <strong>{money(donor.totalAmount, lang)}</strong>
        </td>
        <td data-label={t("superTools.wbColPartisanSplit")}>
          <div className="st-split-mini">
            <span className="st-split-track" aria-hidden="true">
              <span className="split-dem" style={{ width: `${demW}%` }} />
              <span className="split-rep" style={{ width: `${100 - demW}%` }} />
            </span>
            <span className="st-cell-sub num">
              D {compactMoney(donor.dAmount, lang)} · R {compactMoney(donor.rAmount, lang)}
            </span>
          </div>
        </td>
        <td className="num text-right" data-label={t("superTools.wbColLegislatorsFunded")}>
          <strong>{donor.legislatorCount}</strong>
        </td>
        <td className="text-right">
          <button type="button" className="link-button" onClick={onToggle}>
            {expanded ? t("superTools.wbHideRecipients") : t("superTools.wbViewRecipients")}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="st-expanded-row">
          <td colSpan={7}>
            <div className="st-recipient-chips">
              {donor.recipients.map((rec) => (
                <Link
                  key={rec.legislatorId}
                  to={`/legislador/${rec.legislatorId}`}
                  className="st-rec-pill"
                >
                  <PartyBadge party={rec.party} />
                  <span>{rec.name}</span>
                  <span className="num">
                    (D{padDistrict(rec.district)}) · <strong>{money(rec.amount, lang)}</strong>
                  </span>
                </Link>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ========================================================================== */
/* LENS 05: DISTRICT & U.S. CENSUS ACS LAB                                    */
/* ========================================================================== */

function DistrictsLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();
  const [mapMetric, setMapMetric] = useState<MapMetricKey>("bills");
  const [sortBy, setSortBy] = useState<DistrictSortKey>("bills");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const mapConfig = useMemo(() => {
    const entries = new Map<number, number>();
    for (const d of analytics.districtComposites) {
      if (mapMetric === "bills") entries.set(d.district, d.bills);
      else if (mapMetric === "totalRaised") entries.set(d.district, d.totalRaised);
      else if (d.demographics) {
        entries.set(d.district, d.demographics[mapMetric]);
      }
    }

    const palette: "navy" | "gold" | "emerald" =
      mapMetric === "medianIncome" || mapMetric === "transitCommuteRate"
        ? "emerald"
        : mapMetric === "povertyRate" || mapMetric === "totalRaised"
          ? "gold"
          : "navy";

    const formatValue = (val: number) => {
      if (mapMetric === "bills") return `${formatNumber(val)} ${t("superTools.billsShort")}`;
      if (mapMetric === "povertyRate" || mapMetric === "transitCommuteRate") return `${val.toFixed(1)}%`;
      return money(val, lang);
    };

    return { entries, palette, formatValue };
  }, [analytics.districtComposites, mapMetric, lang, formatNumber, t]);

  const sortedDistricts = useMemo(() => {
    return analytics.districtComposites.slice().sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      if (sortBy === "district" || sortBy === "bills" || sortBy === "bipartisanBills" || sortBy === "totalRaised") {
        return (a[sortBy] - b[sortBy]) * dir;
      }
      const av = a.demographics?.[sortBy] ?? 0;
      const bv = b.demographics?.[sortBy] ?? 0;
      return (av - bv) * dir;
    });
  }, [analytics.districtComposites, sortBy, sortDir]);

  function toggleSort(key: DistrictSortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortDir(key === "district" ? "asc" : "desc");
    }
  }

  function handleExportDistrictsCsv() {
    downloadCsv(
      "watchdogs-nj-40-districts-acs-analytics.csv",
      [
        "District",
        "Counties",
        "BillsSponsored",
        "PrimaryBills",
        "BipartisanBills",
        "ELEC_DelegationRaised_USD",
        "ACS_Population",
        "ACS_MedianIncome_USD",
        "ACS_MedianHomeValue_USD",
        "ACS_MedianRent_USD",
        "ACS_PovertyRate_Pct",
        "ACS_BachelorsPlus_Pct",
        "ACS_Unemployment_Pct",
        "ACS_Homeownership_Pct",
        "ACS_TransitCommute_Pct",
      ],
      sortedDistricts.map((d) => [
        d.district,
        d.counties,
        d.bills,
        d.primaryBills,
        d.bipartisanBills,
        d.totalRaised,
        d.demographics?.population ?? "",
        d.demographics?.medianIncome ?? "",
        d.demographics?.medianHomeValue ?? "",
        d.demographics?.medianRent ?? "",
        d.demographics?.povertyRate ?? "",
        d.demographics?.bachelorsPlusRate ?? "",
        d.demographics?.unemploymentRate ?? "",
        d.demographics?.homeownershipRate ?? "",
        d.demographics?.transitCommuteRate ?? "",
      ]),
    );
  }

  const stw = demographics.statewide;

  return (
    <div className="st-lens-stack">
      <div className="st-census-baseline">
        <span className="st-baseline-tag">
          {t("superTools.wbCensusBaseline")} · {translateCensusRelease(demographics.release.name, lang)}
        </span>
        <div className="st-baseline-metrics num">
          <span>
            {t("census.population")}: <strong>{formatNumber(stw.population)}</strong>
          </span>
          <span>
            {t("census.medianIncome")}: <strong>{money(stw.medianIncome, lang)}</strong>
          </span>
          <span>
            {t("census.homeValue")}: <strong>{money(stw.medianHomeValue, lang)}</strong>
          </span>
          <span>
            {t("census.povertyRate")}: <strong>{stw.povertyRate}%</strong>
          </span>
          <span>
            {t("census.bachelorsPlus")}: <strong>{stw.bachelorsPlusRate}%</strong>
          </span>
          <span>
            {t("census.transitShare")}: <strong>{stw.transitCommuteRate}%</strong>
          </span>
        </div>
      </div>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.districtKicker")}</p>
            <h2>{t("superTools.wbMapLabTitle")}</h2>
          </div>
          <div className="st-map-switcher" role="group" aria-label={t("superTools.wbMapMetricAria")}>
            {(
              [
                ["bills", "superTools.wbMetricBills"],
                ["medianIncome", "census.medianIncome"],
                ["povertyRate", "census.povertyRate"],
                ["medianHomeValue", "census.homeValue"],
                ["transitCommuteRate", "census.transitShare"],
                ["totalRaised", "superTools.wbMetricElec"],
              ] as Array<[MapMetricKey, CopyKey]>
            ).map(([key, labelKey]) => (
              <button
                key={key}
                type="button"
                className={`st-chip-btn${mapMetric === key ? " is-active" : ""}`}
                onClick={() => setMapMetric(key)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="district-explorer">
          <div className="district-map-panel">
            <DistrictMap
              values={mapConfig.entries}
              formatValue={mapConfig.formatValue}
              palette={mapConfig.palette}
              ariaLabel={t("superTools.districtTitle")}
            />
          </div>
          <div className="district-map-aside">
            <p className="district-note">{t("superTools.wbMapClickHint")}</p>
            <div className="st-rank-top-bottom">
              <h3>{t("superTools.wbHighestMetric")}</h3>
              {analytics.districtComposites
                .slice()
                .sort((a, b) => {
                  const av = mapConfig.entries.get(a.district) ?? 0;
                  const bv = mapConfig.entries.get(b.district) ?? 0;
                  return bv - av;
                })
                .slice(0, 5)
                .map((d) => (
                  <Link
                    key={d.district}
                    to={`/district/${d.district}`}
                    className="st-rank-mini-row"
                  >
                    <span>
                      <strong>{t("superTools.districtLabel", { district: d.district })}</strong>
                      <small>{d.counties}</small>
                    </span>
                    <strong className="num">
                      {mapConfig.formatValue(mapConfig.entries.get(d.district) ?? 0)}
                    </strong>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.wbCensusTableKicker")}</p>
            <h2>{t("superTools.wbCensusTableTitle")}</h2>
          </div>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={handleExportDistrictsCsv}
          >
            {t("superTools.wbExportCsv")}
          </button>
        </div>

        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <SortTh
                  label={t("home.district")}
                  active={sortBy === "district"}
                  dir={sortDir}
                  onClick={() => toggleSort("district")}
                />
                <th>{t("report.counties")}</th>
                <SortTh
                  label={t("superTools.wbColBills")}
                  active={sortBy === "bills"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("bills")}
                />
                <SortTh
                  label={t("superTools.wbColElec")}
                  active={sortBy === "totalRaised"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("totalRaised")}
                />
                <SortTh
                  label={t("census.population")}
                  active={sortBy === "population"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("population")}
                />
                <SortTh
                  label={t("census.medianIncome")}
                  active={sortBy === "medianIncome"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("medianIncome")}
                />
                <SortTh
                  label={t("census.homeValue")}
                  active={sortBy === "medianHomeValue"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("medianHomeValue")}
                />
                <SortTh
                  label={t("census.povertyRate")}
                  active={sortBy === "povertyRate"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("povertyRate")}
                />
                <SortTh
                  label={t("census.bachelorsPlus")}
                  active={sortBy === "bachelorsPlusRate"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("bachelorsPlusRate")}
                />
              </tr>
            </thead>
            <tbody>
              {sortedDistricts.map((d) => (
                <tr key={d.district}>
                  <td className="num">
                    <Link className="st-dist-pill" to={`/district/${d.district}`}>
                      LD {padDistrict(d.district)}
                    </Link>
                  </td>
                  <td data-label={t("report.counties")}>{d.counties}</td>
                  <td className="num text-right" data-label={t("superTools.wbColBills")}>
                    <strong>{formatNumber(d.bills)}</strong>
                    <span className="st-cell-sub">{d.bipartisanBills} bip.</span>
                  </td>
                  <td className="num text-right" data-label={t("superTools.wbColElec")}>
                    <strong>{compactMoney(d.totalRaised, lang)}</strong>
                  </td>
                  <td className="num text-right" data-label={t("census.population")}>
                    {d.demographics ? formatNumber(d.demographics.population) : "—"}
                  </td>
                  <td className="num text-right" data-label={t("census.medianIncome")}>
                    <strong>
                      {d.demographics ? money(d.demographics.medianIncome, lang) : "—"}
                    </strong>
                  </td>
                  <td className="num text-right" data-label={t("census.homeValue")}>
                    {d.demographics ? money(d.demographics.medianHomeValue, lang) : "—"}
                  </td>
                  <td className="num text-right" data-label={t("census.povertyRate")}>
                    {d.demographics ? `${d.demographics.povertyRate}%` : "—"}
                  </td>
                  <td className="num text-right" data-label={t("census.bachelorsPlus")}>
                    {d.demographics ? `${d.demographics.bachelorsPlusRate}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ========================================================================== */
/* LENS 06: COMPARE LEGISLATORS (SIDE-BY-SIDE BENCHMARK)                      */
/* ========================================================================== */

function CompareLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();
  const [params, setParams] = useSearchParams();
  const mode: "1v1" | "delegation" =
    params.get("mode") === "delegation" ? "delegation" : "1v1";

  const sortedByName = useMemo(
    () =>
      analytics.legislatorMatrix
        .slice()
        .sort((a, b) => a.legislator.sortName.localeCompare(b.legislator.sortName, lang)),
    [analytics.legislatorMatrix, lang],
  );

  const defaultA =
    analytics.topSponsors[0]?.legislator.id ?? sortedByName[0]?.legislator.id;
  const defaultB =
    analytics.topSponsors.find(
      (s) => s.legislator.party !== analytics.topSponsors[0]?.legislator.party,
    )?.legislator.id ??
    sortedByName[1]?.legislator.id ??
    defaultA;

  const [idA, setIdA] = useState<number>(defaultA);
  const [idB, setIdB] = useState<number>(defaultB);

  const rowA =
    analytics.legislatorMatrix.find((r) => r.legislator.id === idA) ??
    sortedByName[0];
  const rowB =
    analytics.legislatorMatrix.find((r) => r.legislator.id === idB) ??
    sortedByName[1] ??
    sortedByName[0];

  const rawDistrictParam = Number(params.get("district"));
  const selectedDistrict =
    Number.isInteger(rawDistrictParam) && rawDistrictParam >= 1 && rawDistrictParam <= 40
      ? rawDistrictParam
      : (rowA?.legislator.district ?? 1);

  function setCompareMode(nextMode: "1v1" | "delegation") {
    const nextParams = new URLSearchParams(params);
    if (nextMode === "delegation") {
      nextParams.set("mode", "delegation");
      if (!nextParams.get("district")) {
        nextParams.set("district", String(selectedDistrict));
      }
    } else {
      nextParams.delete("mode");
      nextParams.delete("district");
    }
    setParams(nextParams, { replace: true });
  }

  function setDelegationDistrict(nextDistrict: number) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("mode", "delegation");
    nextParams.set("district", String(nextDistrict));
    setParams(nextParams, { replace: true });
  }

  const districtOptions = useMemo(
    () =>
      districts
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((d) => ({
          number: d.number,
          countiesLabel: d.countiesLabel || d.counties.join(", "),
        })),
    [],
  );

  const delegationRows = useMemo(() => {
    const members = analytics.legislatorMatrix
      .filter((r) => r.legislator.district === selectedDistrict)
      .slice()
      .sort((a, b) => {
        if (a.legislator.chamber !== b.legislator.chamber) {
          return a.legislator.chamber === "Senate" ? -1 : 1;
        }
        return a.legislator.sortName.localeCompare(b.legislator.sortName, lang);
      });
    return members;
  }, [analytics.legislatorMatrix, selectedDistrict, lang]);

  const delegationAcs = demographicsByDistrict.get(selectedDistrict) ?? null;
  const delegationDistrictMeta =
    districtOptions.find((d) => d.number === selectedDistrict) ?? null;

  const delegationMetrics = useMemo(() => {
    const rows = delegationRows;
    if (rows.length === 0) return [];
    const defs: Array<{
      label: string;
      getNum: (r: LegislatorMatrixRow) => number;
      formatVal: (r: LegislatorMatrixRow) => string;
    }> = [
      {
        label: t("superTools.wbColBills"),
        getNum: (r) => r.totalBills,
        formatVal: (r) => formatNumber(r.totalBills),
      },
      {
        label: t("profile.primaryBills"),
        getNum: (r) => r.primaryBills,
        formatVal: (r) => `${formatNumber(r.primaryBills)} (${r.primaryRatio}%)`,
      },
      {
        label: t("superTools.comparePrimaryEnacted"),
        getNum: (r) => r.effectivenessSummary?.primaryEnacted ?? 0,
        formatVal: (r) => formatNumber(r.effectivenessSummary?.primaryEnacted ?? 0),
      },
      {
        label: t("superTools.wbColBipartisan"),
        getNum: (r) => r.bipartisanRate,
        formatVal: (r) => `${r.bipartisanRate}% (${formatNumber(r.bipartisanBills)})`,
      },
      {
        label: t("superTools.effLesCol"),
        getNum: (r) => r.effectivenessSummary?.lesScore ?? 0,
        formatVal: (r) => (r.effectivenessSummary?.lesScore ?? 0).toFixed(1),
      },
      {
        label: t("superTools.compareAttendance"),
        getNum: (r) => r.voteStats?.attendancePct ?? 0,
        formatVal: (r) => `${r.voteStats?.attendancePct ?? 0}%`,
      },
      {
        label: t("superTools.comparePartyUnity"),
        getNum: (r) => r.voteStats?.partyUnityPct ?? 0,
        formatVal: (r) => `${r.voteStats?.partyUnityPct ?? 0}%`,
      },
      {
        label: t("superTools.wbColElec"),
        getNum: (r) => r.totalRaised,
        formatVal: (r) => money(r.totalRaised, lang),
      },
      {
        label: t("superTools.compareGrassroots"),
        getNum: (r) => r.influenceSummary?.grassrootsPct ?? 0,
        formatVal: (r) => `${(r.influenceSummary?.grassrootsPct ?? 0).toFixed(1)}%`,
      },
      {
        label: t("superTools.pocketbookOverall"),
        getNum: (r) => r.pocketbookSummary?.overallScore ?? 0,
        formatVal: (r) => `${Math.round(r.pocketbookSummary?.overallScore ?? 0)}`,
      },
      {
        label: t("superTools.wbColPromises"),
        getNum: (r) => r.promisesWithEvidence,
        formatVal: (r) =>
          r.promisesTotal > 0 ? `${r.promisesWithEvidence}/${r.promisesTotal}` : "—",
      },
    ];
    return defs.map((def) => {
      const values = rows.map((r) => def.getNum(r));
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const scaleMax = Math.max(maxVal, 1);
      return {
        label: def.label,
        cells: rows.map((r, idx) => ({
          id: r.legislator.id,
          name: r.legislator.fullName,
          num: values[idx],
          val: def.formatVal(r),
          pctWidth: (values[idx] / scaleMax) * 100,
          isLeader: maxVal > minVal && values[idx] === maxVal,
        })),
      };
    });
  }, [delegationRows, formatNumber, lang, t]);

  function renderProfileHead(
    row: LegislatorMatrixRow,
    selectedId: number,
    onChange: (id: number) => void,
    slotLabel: string,
  ) {
    return (
      <div className="st-compare-card">
        <label className="st-compare-select-label">
          <span>{slotLabel}</span>
          <select
            value={selectedId}
            onChange={(e) => onChange(Number(e.target.value))}
          >
            {sortedByName.map((item) => (
              <option key={item.legislator.id} value={item.legislator.id}>
                {item.legislator.fullName} ({item.legislator.party} · LD
                {padDistrict(item.legislator.district)}{" "}
                {item.legislator.chamber === "Senate" ? "Sen." : "Asm."})
              </option>
            ))}
          </select>
        </label>
        <div className="st-compare-hero">
          <Portrait
            src={row.legislator.photo}
            name={row.legislator.fullName}
            className="st-compare-avatar"
          />
          <div>
            <div className="chip-row">
              <PartyBadge party={row.legislator.party} />
              <Link className="chip chip-link" to={`/district/${row.legislator.district}`}>
                LD {padDistrict(row.legislator.district)}
              </Link>
            </div>
            <h3>
              <Link to={`/legislador/${row.legislator.id}`}>
                {row.legislator.fullName}
              </Link>
            </h3>
            <p className="st-cell-sub">
              {chamberLabel(row.legislator.chamber, lang)}
              {row.legislator.leadership
                ? ` · ${translateLeadership(row.legislator.leadership, lang)}`
                : ""}
            </p>
            <div className="st-compare-links">
              <Link to={`/legislador/${row.legislator.id}`}>
                {t("common.viewProfile")}
              </Link>
              <span>·</span>
              <Link to={`/legislador/${row.legislator.id}/reporte`}>
                {t("report.open")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const metrics: Array<{
    label: string;
    aVal: string;
    bVal: string;
    aNum: number;
    bNum: number;
  }> = [
    {
      label: t("superTools.wbColBills"),
      aVal: formatNumber(rowA.totalBills),
      bVal: formatNumber(rowB.totalBills),
      aNum: rowA.totalBills,
      bNum: rowB.totalBills,
    },
    {
      label: t("profile.primaryBills"),
      aVal: `${formatNumber(rowA.primaryBills)} (${rowA.primaryRatio}%)`,
      bVal: `${formatNumber(rowB.primaryBills)} (${rowB.primaryRatio}%)`,
      aNum: rowA.primaryBills,
      bNum: rowB.primaryBills,
    },
    {
      label: t("superTools.wbColBipartisan"),
      aVal: `${formatNumber(rowA.bipartisanBills)} (${rowA.bipartisanRate}%)`,
      bVal: `${formatNumber(rowB.bipartisanBills)} (${rowB.bipartisanRate}%)`,
      aNum: rowA.bipartisanBills,
      bNum: rowB.bipartisanBills,
    },
    {
      label: t("profile.committees"),
      aVal: formatNumber(rowA.committeesCount),
      bVal: formatNumber(rowB.committeesCount),
      aNum: rowA.committeesCount,
      bNum: rowB.committeesCount,
    },
    {
      label: t("superTools.wbColElec"),
      aVal: `${money(rowA.totalRaised, lang)} (${formatNumber(rowA.donorCount)})`,
      bVal: `${money(rowB.totalRaised, lang)} (${formatNumber(rowB.donorCount)})`,
      aNum: rowA.totalRaised,
      bNum: rowB.totalRaised,
    },
    {
      label: t("superTools.wbColPromises"),
      aVal:
        rowA.promisesTotal > 0
          ? `${rowA.promisesWithEvidence}/${rowA.promisesTotal}`
          : "—",
      bVal:
        rowB.promisesTotal > 0
          ? `${rowB.promisesWithEvidence}/${rowB.promisesTotal}`
          : "—",
      aNum: rowA.promisesWithEvidence,
      bNum: rowB.promisesWithEvidence,
    },
    {
      label: t("census.medianIncome"),
      aVal: money(rowA.medianIncome, lang),
      bVal: money(rowB.medianIncome, lang),
      aNum: rowA.medianIncome,
      bNum: rowB.medianIncome,
    },
  ];

  return (
    <section className="panel super-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("superTools.wbCompareKicker")}</p>
          <h2>
            {mode === "delegation"
              ? t("superTools.compareDelegationTitle")
              : t("superTools.wbCompareTitle")}
          </h2>
        </div>
        <div className="st-compare-head-actions">
          <div className="st-segmented" role="tablist" aria-label={t("superTools.wbCompareKicker")}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "1v1"}
              className={`st-segmented-btn${mode === "1v1" ? " is-active" : ""}`}
              onClick={() => setCompareMode("1v1")}
            >
              {t("superTools.compareMode1v1")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "delegation"}
              className={`st-segmented-btn${mode === "delegation" ? " is-active" : ""}`}
              onClick={() => setCompareMode("delegation")}
            >
              {t("superTools.compareModeDelegation")}
            </button>
          </div>
          {mode === "1v1" && (
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => {
                setIdA(idB);
                setIdB(idA);
              }}
            >
              ⇄ {t("superTools.wbSwap")}
            </button>
          )}
        </div>
      </div>
      <p className="panel-intro">
        {mode === "delegation"
          ? t("superTools.compareDelegationIntro")
          : t("superTools.wbCompareIntro")}
      </p>

      {mode === "1v1" ? (
        <>
          <div className="st-compare-grid">
            {renderProfileHead(rowA, idA, setIdA, t("superTools.wbLegislatorA"))}
            {renderProfileHead(rowB, idB, setIdB, t("superTools.wbLegislatorB"))}
          </div>

          <div className="st-table-wrap" style={{ marginTop: 18 }}>
            <table className="st-table st-compare-table">
              <thead>
                <tr>
                  <th>{t("superTools.wbMetric")}</th>
                  <th className="text-right">{rowA.legislator.fullName}</th>
                  <th className="text-right">{rowB.legislator.fullName}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const max = Math.max(m.aNum, m.bNum, 1);
                  const aLeads = m.aNum > m.bNum;
                  const bLeads = m.bNum > m.aNum;
                  return (
                    <tr key={m.label}>
                      <td>
                        <strong>{m.label}</strong>
                      </td>
                      <td
                        className={`num text-right${aLeads ? " is-leader" : ""}`}
                        data-label={rowA.legislator.fullName}
                      >
                        <div className="st-compare-val-wrap">
                          <strong>{m.aVal}</strong>
                          <span className="st-compare-bar" aria-hidden="true">
                            <span style={{ width: `${(m.aNum / max) * 100}%` }} />
                          </span>
                        </div>
                      </td>
                      <td
                        className={`num text-right${bLeads ? " is-leader" : ""}`}
                        data-label={rowB.legislator.fullName}
                      >
                        <div className="st-compare-val-wrap">
                          <strong>{m.bVal}</strong>
                          <span className="st-compare-bar is-b" aria-hidden="true">
                            <span style={{ width: `${(m.bNum / max) * 100}%` }} />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td>
                    <strong>{t("superTools.wbColFocusTopic")}</strong>
                  </td>
                  <td className="text-right" data-label={rowA.legislator.fullName}>
                    <Link
                      className="st-topic-chip"
                      to={`/super-tools/topics/${rowA.topTopic.slug}`}
                    >
                      {rowA.topTopic.label[lang]}
                    </Link>
                  </td>
                  <td className="text-right" data-label={rowB.legislator.fullName}>
                    <Link
                      className="st-topic-chip"
                      to={`/super-tools/topics/${rowB.topTopic.slug}`}
                    >
                      {rowB.topTopic.label[lang]}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="st-delegation-controls">
            <label className="st-compare-select-label st-delegation-district-select">
              <span>{t("superTools.compareSelectDistrict")}</span>
              <select
                value={selectedDistrict}
                onChange={(e) => setDelegationDistrict(Number(e.target.value))}
              >
                {districtOptions.map((d) => (
                  <option key={d.number} value={d.number}>
                    LD {padDistrict(d.number)} · {d.countiesLabel}
                  </option>
                ))}
              </select>
            </label>
            <Link
              className="button button-outline button-small"
              to={`/district/${selectedDistrict}`}
            >
              {t("common.district")} {padDistrict(selectedDistrict)} →
            </Link>
          </div>

          {delegationAcs && (
            <div className="st-delegation-acs-ribbon" aria-label={t("district.censusTitle")}>
              {delegationDistrictMeta?.countiesLabel && (
                <div className="st-delegation-acs-item is-counties">
                  <span>{t("report.counties")}</span>
                  <strong>{delegationDistrictMeta.countiesLabel}</strong>
                </div>
              )}
              <div className="st-delegation-acs-item">
                <span>{t("census.population")}</span>
                <strong className="num">{formatNumber(delegationAcs.population)}</strong>
              </div>
              <div className="st-delegation-acs-item">
                <span>{t("census.medianIncome")}</span>
                <strong className="num">{money(delegationAcs.medianIncome, lang)}</strong>
              </div>
              <div className="st-delegation-acs-item">
                <span>{t("census.povertyRate")}</span>
                <strong className="num">{delegationAcs.povertyRate}%</strong>
              </div>
              <div className="st-delegation-acs-item">
                <span>{t("census.transitShare")}</span>
                <strong className="num">{delegationAcs.transitCommuteRate}%</strong>
              </div>
            </div>
          )}

          <div className="st-delegation-cards">
            {delegationRows.map((row) => (
              <article key={row.legislator.id} className="st-compare-card st-delegation-card">
                <div className="st-compare-hero">
                  <Portrait
                    src={row.legislator.photo}
                    name={row.legislator.fullName}
                    className="st-compare-avatar"
                  />
                  <div>
                    <div className="chip-row">
                      <PartyBadge party={row.legislator.party} />
                      <span className="chip">
                        {row.legislator.chamber === "Senate"
                          ? t("district.senator")
                          : t("district.assembly")}
                      </span>
                      <Link
                        className="chip chip-link"
                        to={`/district/${row.legislator.district}`}
                      >
                        LD {padDistrict(row.legislator.district)}
                      </Link>
                    </div>
                    <h3>
                      <Link to={`/legislador/${row.legislator.id}`}>
                        {row.legislator.fullName}
                      </Link>
                    </h3>
                    <p className="st-cell-sub">
                      {chamberLabel(row.legislator.chamber, lang)}
                      {row.legislator.leadership
                        ? ` · ${translateLeadership(row.legislator.leadership, lang)}`
                        : ""}
                    </p>
                    <div className="st-compare-links">
                      <Link to={`/legislador/${row.legislator.id}`}>
                        {t("common.viewProfile")}
                      </Link>
                      <span>·</span>
                      <Link to={`/legislador/${row.legislator.id}/reporte`}>
                        {t("report.open")}
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="st-table-wrap" style={{ marginTop: 18 }}>
            <table className="st-table st-compare-table st-delegation-table">
              <thead>
                <tr>
                  <th>{t("superTools.wbMetric")}</th>
                  {delegationRows.map((row) => (
                    <th key={row.legislator.id} className="text-right">
                      {row.legislator.fullName}
                      <span className="st-th-sub">
                        {row.legislator.chamber === "Senate"
                          ? t("district.senator")
                          : t("district.assembly")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {delegationMetrics.map((m) => (
                  <tr key={m.label}>
                    <td>
                      <strong>{m.label}</strong>
                    </td>
                    {m.cells.map((cell, cellIdx) => (
                      <td
                        key={cell.id}
                        className={`num text-right${cell.isLeader ? " is-leader" : ""}`}
                        data-label={cell.name}
                      >
                        <div className="st-compare-val-wrap">
                          <strong>{cell.val}</strong>
                          <span
                            className={`st-compare-bar${cellIdx === 1 ? " is-b" : cellIdx === 2 ? " is-c" : ""}`}
                            aria-hidden="true"
                          >
                            <span style={{ width: `${cell.pctWidth}%` }} />
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SortTh({
  label,
  active,
  dir,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        className={`st-sort-btn${active ? " is-active" : ""}`}
        onClick={onClick}
      >
        <span>{label}</span>
        <span aria-hidden="true">
          {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}
