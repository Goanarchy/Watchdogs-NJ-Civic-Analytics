import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { demographicsByDistrict, districts, legislators } from "../data";
import { useI18n } from "../lib/i18n";
import { padDistrict, chamberLabel, partyLabel } from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";

/** Normaliza nombres de municipio: minúsculas, espacios simples y sin sufijo legal. */
function normalizeTown(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+(borough|township|city|town|village)$/, "")
    .trim();
}

interface TownEntry {
  district: (typeof districts)[number];
  normalized: string;
}

const townIndex: TownEntry[] = districts.flatMap((district) =>
  (district.towns ?? []).map((town) => ({
    district,
    normalized: normalizeTown(town),
  })),
);

function findDistrict(query: string) {
  const cleaned = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const needle = normalizeTown(cleaned);

  // 1. Coincidencia exacta: evita que "Orange" devuelva "West Orange".
  const exact = townIndex.find((entry) => entry.normalized === needle);
  if (exact) return exact.district;

  // 2. El municipio empieza con lo escrito.
  const startsWith = townIndex.find((entry) =>
    entry.normalized.startsWith(needle),
  );
  if (startsWith) return startsWith.district;

  // 3. Coincidencia parcial como último recurso.
  const partial = townIndex.find((entry) =>
    entry.normalized.includes(needle),
  );
  if (partial) return partial.district;

  // 4. Número de distrito legislativo (ej. "12" o "distrito 12").
  const numberMatch = cleaned.match(/\b(\d{1,2})\b/);
  if (numberMatch) {
    const districtNumber = Number(numberMatch[1]);
    if (districtNumber >= 1 && districtNumber <= 40) {
      return districts.find((d) => d.number === districtNumber) ?? null;
    }
  }

  return null;
}

export function FindRepresentativePage() {
  const [params, setParams] = useSearchParams();
  const { t, lang, formatNumber } = useI18n();
  useDocumentTitle(t("findRep.title"));

  const query = params.get("q") ?? "";

  const match = useMemo(() => findDistrict(query), [query]);
  const matchAcs = match ? demographicsByDistrict.get(match.number) : undefined;

  const legislatorsInDistrict = useMemo(() => {
    if (!match)
      return { senator: null, assembly: [] as (typeof legislators)[number][] };
    const senator = legislators.find(
      (l) => l.district === match.number && l.chamber === "Senate",
    );
    const assembly = legislators.filter(
      (l) => l.district === match.number && l.chamber === "Assembly",
    );
    return { senator, assembly };
  }, [match]);

  return (
    <main className="page narrow-page find-rep-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/">{t("nav.directory")}</Link>
        <span aria-hidden="true">/</span>
        <span>{t("findRep.title")}</span>
      </nav>

      <header className="page-header">
        <p className="eyebrow eyebrow-dark">{t("findRep.title")}</p>
        <h1>{t("findRep.title")}</h1>
        <p className="page-header-sub">{t("findRep.sub")}</p>
      </header>

      <section className="panel find-rep-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("findRep.title")}</p>
            <h2>{t("findRep.label")}</h2>
          </div>
        </div>

        <div className="find-rep-search">
          <label className="select-field">
            <span>{t("findRep.label")}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                next.set("q", event.target.value);
                setParams(next, { replace: true });
              }}
              placeholder={t("findRep.placeholder")}
            />
          </label>
          {query.trim() !== "" && (
            <button
              type="button"
              className="button button-light find-rep-clear"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("q");
                setParams(next, { replace: true });
              }}
            >
              {t("common.clearFilters")}
            </button>
          )}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {match
            ? t("findRep.resultsStatus", {
                count: (legislatorsInDistrict.senator ? 1 : 0) +
                  legislatorsInDistrict.assembly.length,
                district: padDistrict(match.number),
              })
            : query.trim() !== ""
              ? t("findRep.noMatchStatus")
              : ""}
        </p>

        {query.trim() !== "" && !match && (
          <div className="empty-state empty-state-small find-rep-empty">
            <p>{t("findRep.noMatch")}</p>
          </div>
        )}

        {match && (
          <div className="find-rep-results">
            <h2>
              {t("findRep.results")}
              <span className="find-rep-district">
                {t("common.district")} {padDistrict(match.number)}
              </span>
            </h2>
            <p className="find-rep-county">
              {(match.countiesLabel ?? match.counties.join(", ")) || ""}
            </p>
            {matchAcs && (
              <div className="find-rep-acs num">
                <span>
                  {t("census.population")}: <strong>{formatNumber(matchAcs.population)}</strong>
                </span>
                <span>
                  {t("census.medianIncome")}:{" "}
                  <strong>
                    {new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(matchAcs.medianIncome)}
                  </strong>
                </span>
                <span>
                  {t("census.povertyRate")}: <strong>{matchAcs.povertyRate}%</strong>
                </span>
              </div>
            )}

            <div className="find-rep-delegation">
              {legislatorsInDistrict.senator && (
                <RepCard
                  legislator={legislatorsInDistrict.senator}
                  role={t("findRep.senator", {
                    district: padDistrict(match.number),
                  })}
                />
              )}
              {legislatorsInDistrict.assembly.map((member) => (
                <RepCard
                  key={member.id}
                  legislator={member}
                  role={t("findRep.assembly", {
                    district: padDistrict(match.number),
                  })}
                />
              ))}
            </div>

            <Link
              className="find-rep-district-link"
              to={`/district/${match.number}`}
            >
              {t("district.delegation")}
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function RepCard({
  legislator,
  role,
}: {
  legislator: (typeof legislators)[number];
  role: string;
}) {
  const { t, lang } = useI18n();

  return (
    <article className="rep-card">
      <div className="rep-card-photo-wrap">
        <img
          className="rep-card-photo"
          src={legislator.photo ?? ""}
          alt={legislator.fullName}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {!legislator.photo && (
          <div className="rep-card-photo-fallback">{legislator.fullName[0]}</div>
        )}
      </div>
      <div className="rep-card-info">
        <span className="rep-card-role">{role}</span>
        <h3 className="rep-card-name">{legislator.fullName}</h3>
        <p className="rep-card-party">
          {partyLabel(legislator.party, lang)} ·{" "}
          {chamberLabel(legislator.chamber, lang)}
        </p>
        <Link className="rep-card-link" to={`/legislador/${legislator.id}`}>
          {t("findRep.viewProfile")}
          <span aria-hidden="true"> →</span>
        </Link>
        {legislator.email && (
          <a className="rep-card-email" href={`mailto:${legislator.email}`}>
            ✉ {legislator.email}
          </a>
        )}
      </div>
    </article>
  );
}
