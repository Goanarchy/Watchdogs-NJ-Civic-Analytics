import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LegislatorCard } from "../components/LegislatorCard";
import { counties, districts, legislators, meta } from "../data";
import { useI18n } from "../lib/i18n";
import { padDistrict, translateSourceName } from "../lib/labels";
import { rememberDirectory } from "../lib/lastDirectory";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type SortKey = "name" | "district" | "bills" | "primary";

function isValidSort(value: string | null): value is SortKey {
  return (
    value === "name" ||
    value === "district" ||
    value === "bills" ||
    value === "primary"
  );
}

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const { t, lang, formatNumber } = useI18n();
  useDocumentTitle(t("home.docTitle"));

  useEffect(() => {
    const search = params.toString();
    rememberDirectory(search ? `/?${search}` : "/");
  }, [params]);

  const rawParty = params.get("party");
  const party = rawParty === "D" || rawParty === "R" ? rawParty : "all";

  const rawChamber = params.get("chamber");
  const chamber =
    rawChamber === "Senate" || rawChamber === "Assembly" ? rawChamber : "all";

  const rawDistrict = Number(params.get("district") ?? "all");
  const district =
    Number.isInteger(rawDistrict) && rawDistrict >= 1 && rawDistrict <= 40
      ? rawDistrict
      : null;

  const county = params.get("county") ?? "all";
  const sortParam = params.get("sort");
  const sort: SortKey = isValidSort(sortParam) ? sortParam : "name";
  const query = params.get("q") ?? "";

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  function resetFilters() {
    setParams(new URLSearchParams(), { replace: true });
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const result = legislators.filter((legislator) => {
      if (party !== "all" && legislator.party !== party) return false;
      if (chamber !== "all" && legislator.chamber !== chamber) return false;
      if (district !== null && legislator.district !== district) return false;
      if (
        county !== "all" &&
        !(legislator.districtInfo?.counties ?? []).includes(county)
      ) {
        return false;
      }
      if (!needle) return true;

      const haystack = [
        legislator.fullName,
        legislator.firstName,
        legislator.lastName,
        `${lang === "es" ? "distrito" : "district"} ${legislator.district}`,
        ...(legislator.districtInfo?.towns ?? []),
        ...legislator.committees.map((committee) => committee.name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });

    return result.sort((a, b) => {
      if (sort === "district") {
        return (
          a.district - b.district ||
          a.sortName.localeCompare(b.sortName, "en")
        );
      }
      if (sort === "bills") {
        return b.bills.length - a.bills.length;
      }
      if (sort === "primary") {
        const ap = a.bills.filter(([, type]) => type === "P").length;
        const bp = b.bills.filter(([, type]) => type === "P").length;
        return bp - ap || b.bills.length - a.bills.length;
      }
      return a.sortName.localeCompare(b.sortName, "en");
    });
  }, [party, chamber, district, county, query, sort, lang]);

  const democrats = meta.partyCounts.D ?? 0;
  const republicans = meta.partyCounts.R ?? 0;
  const total = meta.legislatorCount;
  const hasFilters =
    party !== "all" ||
    chamber !== "all" ||
    district !== null ||
    county !== "all" ||
    query.trim() !== "";

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              {t("home.eyebrow", { session: meta.sessionLabel })}
            </p>
            <h1 className="hero-title">{t("home.title")}</h1>
            <p className="hero-sub">
              {t("home.sub", { count: meta.legislatorCount })}
            </p>
            <div className="hero-actions">
              <Link to="/super-tools" className="button-super">
                <span className="button-super-shine" aria-hidden="true" />
                <SparkIcon />
                <span className="button-super-copy">
                  <strong>{t("home.superTools")}</strong>
                  <small>{t("home.superToolsHint")}</small>
                </span>
                <span className="button-super-arrow" aria-hidden="true">
                  →
                </span>
              </Link>

              <a className="button button-light" href="#directorio">
                {t("home.explore")}
              </a>
              <Link className="button button-ghost" to="/acerca">
                {t("home.methodology")}
              </Link>
            </div>
          </div>

          <aside
            className="hero-panel"
            aria-label={t("home.compositionAria")}
          >
            <p className="hero-panel-label">{t("home.panelLabel")}</p>
            <div className="stat-grid">
              <div>
                <span className="stat-value">{meta.legislatorCount}</span>
                <span className="stat-label">{t("home.legislators")}</span>
              </div>
              <div>
                <span className="stat-value">{meta.districtCount}</span>
                <span className="stat-label">{t("home.districts")}</span>
              </div>
              <div>
                <span className="stat-value">
                  {meta.chamberCounts.Senate ?? 0}
                </span>
                <span className="stat-label">{t("common.senate")}</span>
              </div>
              <div>
                <span className="stat-value">
                  {meta.chamberCounts.Assembly ?? 0}
                </span>
                <span className="stat-label">{t("common.assembly")}</span>
              </div>
            </div>

            <div className="party-bar" aria-hidden="true">
              <span
                className="party-bar-d"
                style={{ width: `${(democrats / total) * 100}%` }}
              />
              <span
                className="party-bar-r"
                style={{ width: `${(republicans / total) * 100}%` }}
              />
            </div>
            <div className="party-legend">
              <span>
                <i className="dot dot-d" /> {t("common.democrats")}{" "}
                <b>{democrats}</b>
              </span>
              <span>
                <i className="dot dot-r" /> {t("common.republicans")}{" "}
                <b>{republicans}</b>
              </span>
            </div>

            <p className="hero-panel-foot">
              {t("home.billsNote", { count: formatNumber(meta.billCount) })}
            </p>
          </aside>
        </div>
      </section>

      <main className="page" id="directorio">
        <div className="toolbar">
          <div className="filters">
            <div className="search-field">
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="search-icon"
              >
                <path d="M9 3a6 6 0 1 0 3.9 10.5L17 17.6 18.4 16.2l-4.1-4.1A6 6 0 0 0 9 3Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setParam("q", event.target.value)}
                placeholder={t("home.searchPlaceholder")}
                aria-label={t("home.searchAria")}
              />
            </div>

            <div
              className="segmented"
              role="group"
              aria-label={t("home.filterParty")}
            >
              <button
                type="button"
                className={party === "all" ? "active" : ""}
                onClick={() => setParam("party", null)}
                aria-pressed={party === "all"}
              >
                {t("common.all")}
              </button>
              <button
                type="button"
                className={party === "D" ? "active" : ""}
                onClick={() => setParam("party", "D")}
                aria-pressed={party === "D"}
              >
                {t("common.democrats")}
              </button>
              <button
                type="button"
                className={party === "R" ? "active" : ""}
                onClick={() => setParam("party", "R")}
                aria-pressed={party === "R"}
              >
                {t("common.republicans")}
              </button>
            </div>

            <div
              className="segmented"
              role="group"
              aria-label={t("home.filterChamber")}
            >
              <button
                type="button"
                className={chamber === "all" ? "active" : ""}
                onClick={() => setParam("chamber", null)}
                aria-pressed={chamber === "all"}
              >
                {t("common.bothChambers")}
              </button>
              <button
                type="button"
                className={chamber === "Senate" ? "active" : ""}
                onClick={() => setParam("chamber", "Senate")}
                aria-pressed={chamber === "Senate"}
              >
                {t("common.senate")}
              </button>
              <button
                type="button"
                className={chamber === "Assembly" ? "active" : ""}
                onClick={() => setParam("chamber", "Assembly")}
                aria-pressed={chamber === "Assembly"}
              >
                {t("common.assembly")}
              </button>
            </div>
          </div>

          <div className="filters filters-secondary">
            <label className="select-field">
              <span>{t("common.district")}</span>
              <select
                value={district === null ? "all" : String(district)}
                onChange={(event) => setParam("district", event.target.value)}
              >
                <option value="all">{t("common.all")}</option>
                {districts.map((item) => (
                  <option key={item.number} value={item.number}>
                    {t("common.district")}{" "}
                    {padDistrict(item.number)}
                  </option>
                ))}
              </select>
            </label>

            <label className="select-field">
              <span>{t("common.county")}</span>
              <select
                value={county}
                onChange={(event) => setParam("county", event.target.value)}
              >
                <option value="all">{t("common.all")}</option>
                {counties.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="select-field">
              <span>{t("common.sortBy")}</span>
              <select
                value={sort}
                onChange={(event) => setParam("sort", event.target.value)}
              >
                <option value="name">{t("common.nameAZ")}</option>
                <option value="district">{t("common.districtSort")}</option>
                <option value="bills">{t("common.billsSort")}</option>
                <option value="primary">{t("common.primarySort")}</option>
              </select>
            </label>

            <div className="results-meta">
              <span role="status" aria-live="polite">
                {t("home.results", {
                  shown: filtered.length,
                  total,
                })}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  className="link-button"
                  onClick={resetFilters}
                >
                  {t("common.clearFilters")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="results-head">
          <div>
            <h2>{t("home.directoryTitle")}</h2>
            <p>{t("home.directorySub")}</p>
          </div>
          <span className="updated-note">
            {t("home.updatedNote", {
              source: translateSourceName(meta.sourceName, lang),
              session: meta.sessionLabel,
            })}
          </span>
        </div>

        {filtered.length > 0 ? (
          <div className="legislator-grid">
            {filtered.map((legislator) => (
              <LegislatorCard key={legislator.id} legislator={legislator} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>{t("home.emptyTitle")}</h3>
            <p>{t("home.emptyText")}</p>
            <button
              type="button"
              className="button button-outline"
              onClick={resetFilters}
            >
              {t("common.clearAllFilters")}
            </button>
          </div>
        )}

        <p className="page-note">
          {t("home.pageNote")}{" "}
          <Link to="/acerca">{t("common.methodology")}</Link>.
        </p>
      </main>
    </>
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
