import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { DistrictMap } from "../components/DistrictMap";
import { demographics, demographicsByDistrict, legislators } from "../data";
import { useAnalytics } from "../lib/useAnalytics";
import { useI18n } from "../lib/i18n";
import {
  padDistrict,
  chamberLabel,
  partyLabel,
  translateCensusRelease,
  translateCommittee,
} from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { DistrictStat } from "../lib/analytics";

export function DistrictPage() {
  const { district } = useParams();
  const districtNumber = district ? Number(district) : null;
  const { t, lang, formatNumber } = useI18n();
  const { analytics, loading, error } = useAnalytics();
  useDocumentTitle(
    districtNumber
      ? t("district.title", { district: padDistrict(districtNumber) })
      : t("common.noResults"),
  );

  const districtStat = useMemo<DistrictStat | null>(() => {
    if (!analytics || !districtNumber) return null;
    return (
      analytics.districts.find((d) => d.district === districtNumber) ?? null
    );
  }, [analytics, districtNumber]);

  const districtComposite = useMemo(() => {
    if (!analytics || !districtNumber) return null;
    return (
      analytics.districtComposites.find((d) => d.district === districtNumber) ??
      null
    );
  }, [analytics, districtNumber]);

  const districtAcs = districtNumber
    ? (demographicsByDistrict.get(districtNumber) ?? null)
    : null;

  const delegation = useMemo(() => {
    if (!districtNumber) return { senator: null, assembly: [] as typeof legislators };
    const senator = legislators.find(
      (l) => l.district === districtNumber && l.chamber === "Senate",
    );
    const assembly = legislators.filter(
      (l) => l.district === districtNumber && l.chamber === "Assembly",
    );
    return { senator, assembly };
  }, [districtNumber]);

  if (!districtNumber) {
    return (
      <main className="page narrow-page">
        <div className="empty-state">
          <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
          <h1>{t("topic.notFoundTitle")}</h1>
          <p>{t("topic.notFoundText")}</p>
          <Link className="button button-dark" to="/">
            {t("district.backToDirectory")}
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page narrow-page">
        <div className="super-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>{t("superTools.loading")}</p>
        </div>
      </main>
    );
  }

  if (error || !districtStat || !delegation.senator) {
    return (
      <main className="page narrow-page">
        <div className="empty-state">
          <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
          <h1>{t("topic.notFoundTitle")}</h1>
          <p>{t("topic.notFoundText")}</p>
          <Link className="button button-dark" to="/">
            {t("district.backToDirectory")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page narrow-page district-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/">{t("nav.directory")}</Link>
        <span aria-hidden="true">/</span>
        <span>
          {t("district.title", { district: padDistrict(districtNumber) })}
        </span>
      </nav>

      <header className="page-header">
        <p className="eyebrow eyebrow-dark">
          {t("district.title", { district: padDistrict(districtNumber) })}
        </p>
        <h1>
          {t("common.district")} {padDistrict(districtNumber)}
        </h1>
        <p className="page-header-sub">
          {t("district.sub", { district: padDistrict(districtNumber) })}
        </p>
      </header>

      <section className="panel district-delegation-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("district.delegation")}</p>
            <h2>
              {t("common.district")} {padDistrict(districtNumber)}
            </h2>
          </div>
          <span className="panel-source">
            {formatNumber(districtStat.bills)} {t("district.uniqueBills")}
          </span>
        </div>

        <p className="panel-intro">
          {(delegation.senator?.districtInfo?.counties ??
            delegation.senator?.districtInfo?.countiesLabel ?? "") ||
            ""}
        </p>

        <div className="district-delegation-grid">
          <article className="district-member-card senator">
            <div className="district-member-photo-wrap">
              <img
                className="district-member-photo"
                src={delegation.senator.photo ?? ""}
                alt={delegation.senator.fullName}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              {!delegation.senator.photo && (
                <div className="district-member-photo-fallback">
                  {delegation.senator.fullName[0]}
                </div>
              )}
            </div>
            <div className="district-member-info">
              <span className="district-member-role">
                {t("district.senator")}
              </span>
              <h3 className="district-member-name">
                {delegation.senator.fullName}
              </h3>
              <p className="district-member-party">
                {partyLabel(delegation.senator.party, lang)} ·{" "}
                {chamberLabel(delegation.senator.chamber, lang)}
              </p>
              <Link
                className="district-member-link"
                to={`/legislador/${delegation.senator.id}`}
              >
                {t("common.viewProfile")}
              </Link>
            </div>
          </article>

          {delegation.assembly.map((member) => (
            <article
              key={member.id}
              className="district-member-card assembly"
            >
              <div className="district-member-photo-wrap">
                <img
                  className="district-member-photo"
                  src={member.photo ?? ""}
                  alt={member.fullName}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {!member.photo && (
                  <div className="district-member-photo-fallback">
                    {member.fullName[0]}
                  </div>
                )}
              </div>
              <div className="district-member-info">
                <span className="district-member-role">
                  {t("district.assembly")}
                </span>
                <h3 className="district-member-name">{member.fullName}</h3>
                <p className="district-member-party">
                  {partyLabel(member.party, lang)} ·{" "}
                  {chamberLabel(member.chamber, lang)}
                </p>
                <Link className="district-member-link" to={`/legislador/${member.id}`}>
                  {t("common.viewProfile")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel district-activity-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.districtActivity")}</p>
            <h2>{t("district.uniqueBills")}</h2>
          </div>
        </div>

        <div className="district-stats-grid">
          <div className="district-stat">
            <span className="district-stat-value num">
              {formatNumber(districtStat.bills)}
            </span>
            <span className="district-stat-label">
              {t("district.uniqueBills")}
            </span>
          </div>
          <div className="district-stat">
            <span className="district-stat-value num">
              {formatNumber(districtComposite?.bipartisanBills ?? 0)}
            </span>
            <span className="district-stat-label">
              {t("superTools.bipartisanBillsShort")}
            </span>
          </div>
          <div className="district-stat">
            <span className="district-stat-value num">
              {new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(districtComposite?.totalRaised ?? 0)}
            </span>
            <span className="district-stat-label">
              {t("superTools.wbColElec")}
            </span>
          </div>
          <div className="district-stat">
            <span className="district-stat-value num">
              {formatNumber(districtStat.legislators)}
            </span>
            <span className="district-stat-label">
              {t("common.members")}
            </span>
          </div>
        </div>

        <div className="district-map-mini">
          <DistrictMap
            compact
            staticMap
            highlight={districtNumber}
            values={new Map(
              (analytics?.districts ?? []).map((item) => [item.district, item.bills]),
            )}
            ariaLabel={t("district.mapAria", {
              district: padDistrict(districtNumber),
            })}
          />
        </div>
      </section>

      {districtAcs && (
        <section className="panel district-acs-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">
                U.S. Census Bureau · {translateCensusRelease(demographics.release.name, lang)}
              </p>
              <h2>{t("district.censusTitle")}</h2>
            </div>
            <a
              className="panel-source"
              href={demographics.source.url}
              target="_blank"
              rel="noreferrer"
            >
              {t("common.officialSource")}
            </a>
          </div>
          <p className="panel-intro">
            {t("district.censusIntro", {
              statePop: formatNumber(demographics.statewide.population),
            })}
          </p>

          <div className="district-acs-grid">
            {[
              {
                label: t("census.population"),
                val: formatNumber(districtAcs.population),
                state: `${t("district.njAvg")}: ${formatNumber(
                  Math.round(demographics.statewide.population / 40),
                )} / dist.`,
              },
              {
                label: t("census.medianIncome"),
                val: new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(districtAcs.medianIncome),
                state: `NJ: ${new Intl.NumberFormat(
                  lang === "es" ? "es-US" : "en-US",
                  { style: "currency", currency: "USD", maximumFractionDigits: 0 },
                ).format(demographics.statewide.medianIncome)}`,
              },
              {
                label: t("census.homeValue"),
                val: new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(districtAcs.medianHomeValue),
                state: `NJ: ${new Intl.NumberFormat(
                  lang === "es" ? "es-US" : "en-US",
                  { style: "currency", currency: "USD", maximumFractionDigits: 0 },
                ).format(demographics.statewide.medianHomeValue)}`,
              },
              {
                label: t("census.povertyRate"),
                val: `${districtAcs.povertyRate}%`,
                state: `NJ: ${demographics.statewide.povertyRate}%`,
              },
              {
                label: t("census.bachelorsPlus"),
                val: `${districtAcs.bachelorsPlusRate}%`,
                state: `NJ: ${demographics.statewide.bachelorsPlusRate}%`,
              },
              {
                label: t("census.transitShare"),
                val: `${districtAcs.transitCommuteRate}%`,
                state: `NJ: ${demographics.statewide.transitCommuteRate}%`,
              },
            ].map((item) => (
              <div key={item.label} className="district-acs-card">
                <span className="district-acs-label">{item.label}</span>
                <strong className="district-acs-val num">{item.val}</strong>
                <span className="district-acs-state num">{item.state}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel district-committees-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("district.committees")}</p>
            <h2>{t("district.committees")}</h2>
          </div>
        </div>
        <p className="panel-intro">{t("district.committeesSub")}</p>

        <ul className="district-committee-list">
          {delegation.senator.committees
            .concat(delegation.assembly.flatMap((m) => m.committees))
            .reduce((acc: string[], c) => {
              if (!acc.includes(c.name)) acc.push(c.name);
              return acc;
            }, [])
            .map((committeeName) => {
              const members = [
                delegation.senator,
                ...delegation.assembly,
              ].filter((m) =>
                m?.committees.some((c) => c.name === committeeName),
              );
              return (
                <li key={committeeName}>
                  <Link to={`/committee/${encodeURIComponent(committeeName)}`}>
                    {translateCommittee(committeeName, lang)}
                    <span className="district-committee-count">
                      ({members.length})
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
      </section>
    </main>
  );
}
