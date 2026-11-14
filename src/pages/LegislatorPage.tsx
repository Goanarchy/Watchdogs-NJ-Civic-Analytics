import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BillExplorer } from "../components/BillExplorer";
import { CampaignPromisesPanel } from "../components/CampaignPromisesPanel";
import { PartyBadge } from "../components/PartyBadge";
import { Portrait } from "../components/Portrait";
import { legislatorsById, loadDonorProfilesByLegislator, meta } from "../data";
import { useI18n, type CopyKey } from "../lib/i18n";
import {
  chamberLabel,
  padDistrict,
  roleLabel,
  translateAddressType,
  translateCommittee,
  translateCommitteePosition,
  translateLeadership,
} from "../lib/labels";
import { getLastDirectory } from "../lib/lastDirectory";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { DonorProfile, Legislator } from "../types";

export function LegislatorPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const legislator = id ? legislatorsById.get(Number(id)) : undefined;
  const backTo = getLastDirectory();

  useDocumentTitle(
    legislator
      ? `${legislator.fullName} · Watchdogs Media`
      : t("profile.notFoundDoc"),
  );

  if (!legislator) {
    return (
      <main className="page narrow-page">
        <div className="empty-state">
          <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
          <h1>{t("profile.notFoundTitle")}</h1>
          <p>{t("profile.notFoundText")}</p>
          <Link className="button button-dark" to="/">
            {t("common.backDirectory")}
          </Link>
        </div>
      </main>
    );
  }

  const primaryCount = legislator.bills.filter(
    ([, type]) => type === "P",
  ).length;
  const hasBio =
    legislator.education.length +
      legislator.occupation.length +
      legislator.publicService.length +
      legislator.militaryService.length +
      legislator.legislativeService.length >
    0;

  return (
    <main className="page profile-page">
      <nav className="breadcrumb" aria-label={t("profile.breadcrumb")}>
        <Link to={backTo}>{t("nav.directory")}</Link>
        <span aria-hidden="true">/</span>
        <span>{legislator.fullName}</span>
      </nav>

      <header className="profile-card">
        <Portrait
          src={legislator.photo}
          name={legislator.fullName}
          className="profile-photo"
          eager
        />

        <div className="profile-main-info">
          <div className="chip-row">
            <PartyBadge party={legislator.party} />
            <span className="chip">
              {t("profile.districtN", {
                district: padDistrict(legislator.district),
              })}
            </span>
            <span className="chip">
              {chamberLabel(legislator.chamber, lang)}
            </span>
          </div>

          {legislator.leadership && (
            <p className="profile-leadership">
              {translateLeadership(legislator.leadership, lang)}
            </p>
          )}

          <h1 className="profile-name">{legislator.fullName}</h1>

          <p className="profile-role">
            {t("profile.roleLine", {
              role: roleLabel(legislator.chamber, lang),
              chamber: chamberLabel(legislator.chamber, lang),
            })}
          </p>

          {legislator.districtInfo && (
            <p className="profile-district">
              {t("profile.representing", {
                district: padDistrict(legislator.district),
                counties: legislator.districtInfo.countiesLabel,
              })}
            </p>
          )}

          <div className="profile-actions">
            <a
              className="button button-dark button-small"
              href={legislator.officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("profile.official")}
              <ExternalIcon />
            </a>
            {legislator.email && (
              <a
                className="button button-outline button-small"
                href={`mailto:${legislator.email}`}
              >
                {t("profile.email")}
              </a>
            )}
            {legislator.contactUrl && (
              <a
                className="button button-outline button-small"
                href={legislator.contactUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("profile.contactForm")}
                <ExternalIcon />
              </a>
            )}
            <Link
              className="button button-outline button-small"
              to={`/legislador/${legislator.id}/reporte`}
            >
              {t("report.open")}
            </Link>
          </div>
        </div>

        <div
          className="profile-stats"
          aria-label={t("profile.activitySummary")}
        >
          <div>
            <span className="profile-stat-value">{legislator.bills.length}</span>
            <span className="profile-stat-label">
              {t("profile.billsStat")}
            </span>
          </div>
          <div>
            <span className="profile-stat-value">{primaryCount}</span>
            <span className="profile-stat-label">
              {t("profile.primaryStat")}
            </span>
          </div>
          <div>
            <span className="profile-stat-value">
              {legislator.committees.length}
            </span>
            <span className="profile-stat-label">
              {t("profile.committeesStat")}
            </span>
          </div>
        </div>
      </header>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="panel" id="perfil">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">
                  {t("profile.kickerBackground")}
                </p>
                <h2>{t("profile.publicProfile")}</h2>
              </div>
              <span className="panel-source">
                {t("profile.originalText")}
              </span>
            </div>

            {hasBio ? (
              <div className="bio-grid">
                <BioBlock
                  title={t("profile.bioLegislative")}
                  items={legislator.legislativeService}
                />
                <BioBlock
                  title={t("profile.bioPublic")}
                  items={legislator.publicService}
                />
                <BioBlock
                  title={t("profile.bioEducation")}
                  items={legislator.education}
                />
                <BioBlock
                  title={t("profile.bioOccupation")}
                  items={legislator.occupation}
                />
                <BioBlock
                  title={t("profile.bioMilitary")}
                  items={legislator.militaryService}
                />
              </div>
            ) : (
              <p className="empty-note">
                {t("profile.noBio")}{" "}
                <a
                  href={legislator.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("profile.noBioLink")}
                </a>
                .
              </p>
            )}
          </section>

          <section className="panel" id="comisiones">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">{t("profile.kickerWork")}</p>
                <h2>{t("profile.committees")}</h2>
              </div>
              <span className="panel-source">
                {t("profile.assigned", {
                  count: legislator.committees.length,
                })}
              </span>
            </div>

            {legislator.committees.length > 0 ? (
              <ul className="committee-list">
                {legislator.committees.map((committee) => (
                  <li key={`${committee.code}-${committee.name}`}>
                    <div>
                      <span className="committee-name">
                        {translateCommittee(committee.name, lang)}
                      </span>
                      {committee.name !==
                        translateCommittee(committee.name, lang) && (
                        <span className="committee-original">
                          {committee.name}
                        </span>
                      )}
                    </div>
                    <div className="committee-meta">
                      {committee.position && (
                        <span className="position-tag">
                          {translateCommitteePosition(
                            committee.position,
                            lang,
                          )}
                        </span>
                      )}
                      {committee.url && (
                        <a
                          href={committee.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t("profile.viewCommitteeAria", {
                            committee: committee.name,
                          })}
                        >
                          <ExternalIcon />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-note">
                {legislator.leadership.toLowerCase().includes("leader")
                  ? t("profile.leaderNoCommittees")
                  : t("profile.noCommittees")}
              </p>
            )}
          </section>

          <section className="panel" id="proyectos">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">
                  {t("profile.kickerActivity")}
                </p>
                <h2>{t("profile.sponsoredBills")}</h2>
              </div>
            </div>
            <p className="panel-intro">
              {t("profile.billsIntro", { session: meta.sessionLabel })}
            </p>
            <BillExplorer legislator={legislator} />
          </section>
        </div>

        <aside className="profile-aside">
          <DistrictPanel legislator={legislator} />

          <section className="panel aside-panel">
            <h2>{t("profile.contact")}</h2>
            {legislator.email && (
              <div className="contact-row">
                <span className="contact-label">
                  {t("profile.officialEmail")}
                </span>
                <a href={`mailto:${legislator.email}`}>{legislator.email}</a>
              </div>
            )}

            {legislator.addresses.length > 0 ? (
              legislator.addresses.map((address) => (
                <div
                  className="address-card"
                  key={`${address.type}-${address.street}-${address.zip}`}
                >
                  <span className="contact-label">
                    {translateAddressType(address.type, lang) || t("profile.office")}
                  </span>
                  <p>
                    {address.street}
                    <br />
                    {address.city}, {address.state} {address.zip}
                  </p>
                  {address.phone && (
                    <a href={`tel:${address.phone.replace(/[^\d+]/g, "")}`}>
                      {address.phone}
                    </a>
                  )}
                  {address.fax && (
                    <span className="address-fax">
                      {t("profile.fax", { fax: address.fax })}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="empty-note">{t("profile.noAddresses")}</p>
            )}

            <a
              className="aside-link"
              href={legislator.officialUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("profile.sourceLink")}
              <ExternalIcon />
            </a>
          </section>

          <p className="aside-disclaimer">{t("profile.disclaimer")}</p>
        </aside>
      </div>

      <CampaignPromisesPanel legislatorId={legislator.id} />
      <CampaignDonorsPanel key={legislator.id} legislator={legislator} />
    </main>
  );
}

const DONOR_PAGE_SIZE = 25;

function formatMoney(value: number, lang: string): string {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function donorTypeLabel(
  type: string | null,
  t: (key: CopyKey) => string,
): string | null {
  if (!type) return null;
  const value = type.toUpperCase();
  if (value.includes("INDIVIDUAL")) return t("donorType.individual");
  if (value.includes("BUSINESS")) return t("donorType.business");
  if (value.includes("UNION")) return t("donorType.union");
  if (value.includes("POLITICAL PARTY")) return t("donorType.politicalParty");
  if (value.includes("CANDIDATE COMMITTEE"))
    return t("donorType.candidateCommittee");
  if (
    value.includes("POLITICAL CMTE") ||
    value.includes("POLITICAL CLUB") ||
    value.includes("LEGISLATIVE LEADERSHIP") ||
    value.includes("PAC")
  )
    return t("donorType.politicalCommittee");
  if (value.includes("IDEOLOGICAL") || value.includes("INTEREST"))
    return t("donorType.ideological");
  return t("donorType.other");
}

function CampaignDonorsPanel({ legislator }: { legislator: Legislator }) {
  const { t, lang } = useI18n();
  const [profiles, setProfiles] = useState<DonorProfile[] | null>(null);
  const [cycle, setCycle] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "individual" | "organization">("all");
  const [sort, setSort] = useState<"amountDesc" | "amountAsc" | "name" | "year">(
    "amountDesc",
  );
  const [limit, setLimit] = useState(DONOR_PAGE_SIZE);

  useEffect(() => {
    let active = true;
    loadDonorProfilesByLegislator()
      .then((map) => {
        if (!active) return;
        setProfiles(
          (map.get(legislator.id) ?? [])
            .slice()
            .sort((a, b) => a.electionYear - b.electionYear),
        );
      })
      .catch(() => {
        if (active) setProfiles([]);
      });
    return () => {
      active = false;
    };
  }, [legislator.id]);

  const sortedProfiles = profiles ?? [];
  const activeCycle =
    sortedProfiles.find((profile) => profile.electionYear === cycle)
      ?.electionYear ??
    sortedProfiles[sortedProfiles.length - 1]?.electionYear ??
    null;
  const profile = sortedProfiles.find(
    (item) => item.electionYear === activeCycle,
  );

  function selectCycle(year: number) {
    setCycle(year);
    setQuery("");
    setKind("all");
    setLimit(DONOR_PAGE_SIZE);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setLimit(DONOR_PAGE_SIZE);
  }

  function updateKind(value: "all" | "individual" | "organization") {
    setKind(value);
    setLimit(DONOR_PAGE_SIZE);
  }

  function updateSort(value: "amountDesc" | "amountAsc" | "name" | "year") {
    setSort(value);
    setLimit(DONOR_PAGE_SIZE);
  }

  function clearFilters() {
    setQuery("");
    setKind("all");
    setSort("amountDesc");
    setLimit(DONOR_PAGE_SIZE);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredDonors = (profile?.donors ?? [])
    .filter((donor) => {
      if (kind === "individual" && !donor.isIndividual) return false;
      if (kind === "organization" && donor.isIndividual) return false;
      if (!normalizedQuery) return true;
      return (
        donor.name.toLowerCase().includes(normalizedQuery) ||
        (donor.employer ?? "").toLowerCase().includes(normalizedQuery) ||
        (donor.occupation ?? "").toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      if (sort === "amountAsc") return a.amount - b.amount;
      if (sort === "name") return a.name.localeCompare(b.name, lang);
      if (sort === "year") return String(b.year).localeCompare(String(a.year));
      return b.amount - a.amount;
    });

  const shownDonors = filteredDonors.slice(0, limit);
  const remaining = filteredDonors.length - shownDonors.length;
  const hasFilters =
    query.trim() !== "" || kind !== "all" || sort !== "amountDesc";

  const individualDonors = profile?.donors.filter((donor) => donor.isIndividual) ?? [];
  const organizationDonors = profile?.donors.filter((donor) => !donor.isIndividual) ?? [];
  const sumAmount = (rows: typeof filteredDonors) =>
    rows.reduce((total, donor) => total + donor.amount, 0);
  const largest = profile?.donors.reduce(
    (top, donor) => (donor.amount > (top?.amount ?? -Infinity) ? donor : top),
    profile.donors[0],
  );

  return (
    <section className="panel campaign-donors-panel" id="donantes">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">{t("profile.campaignDonorsKicker")}</p>
          <h2>{t("profile.campaignDonors")}</h2>
        </div>
        {activeCycle !== null && (
          <span className="panel-source">
            {t("profile.electionCycle", { year: activeCycle })}
          </span>
        )}
      </div>
      <p className="panel-intro">{t("profile.donorIntro")}</p>

      {profiles === null ? (
        <p className="empty-note" role="status">
          {t("profile.donorLoading")}
        </p>
      ) : !profile ? (
        <p className="empty-note">{t("profile.donorNoRecords")}</p>
      ) : (
        <>
          {sortedProfiles.length > 1 && (
            <div
              className="donor-cycle-tabs"
              role="tablist"
              aria-label={t("profile.donorCycle")}
            >
              {sortedProfiles.map((item) => (
                <button
                  key={item.electionYear}
                  type="button"
                  role="tab"
                  aria-selected={item.electionYear === activeCycle}
                  className={`donor-cycle-tab${
                    item.electionYear === activeCycle ? " is-active" : ""
                  }`}
                  onClick={() => selectCycle(item.electionYear)}
                >
                  {t("profile.electionCycle", { year: item.electionYear })}
                </button>
              ))}
            </div>
          )}

          <div className="donor-summary">
            <div>
              <span className="donor-summary-label">
                {t("profile.donorTotal")}
              </span>
              <strong>{formatMoney(profile.totalAmount, lang)}</strong>
            </div>
            <div>
              <span className="donor-summary-label">
                {t("profile.donorContributors")}
              </span>
              <strong>
                {profile.donorCount.toLocaleString(lang === "es" ? "es-US" : "en-US")}
              </strong>
            </div>
            <div>
              <span className="donor-summary-label">
                {t("profile.donorCount")}
              </span>
              <strong>
                {profile.contributionCount.toLocaleString(lang === "es" ? "es-US" : "en-US")}
              </strong>
            </div>
            {largest && (
              <div>
                <span className="donor-summary-label">
                  {t("profile.donorTop")}
                </span>
                <strong title={largest.name}>
                  {formatMoney(largest.amount, lang)}
                </strong>
              </div>
            )}
          </div>

          <div className="donor-split" aria-label={t("profile.donorSplit")}>
            <div>
              <span>{t("profile.donorIndividuals")}</span>
              <strong>
                {individualDonors.length.toLocaleString(
                  lang === "es" ? "es-US" : "en-US",
                )}{" "}
                · {formatMoney(sumAmount(individualDonors), lang)}
              </strong>
            </div>
            <div>
              <span>{t("profile.donorOrganizations")}</span>
              <strong>
                {organizationDonors.length.toLocaleString(
                  lang === "es" ? "es-US" : "en-US",
                )}{" "}
                · {formatMoney(sumAmount(organizationDonors), lang)}
              </strong>
            </div>
          </div>

          <div className="donor-toolbar donor-toolbar-rich">
            <label className="donor-search">
              <span className="sr-only">{t("profile.donorSearch")}</span>
              <input
                type="search"
                value={query}
                placeholder={t("profile.donorSearch")}
                onChange={(event) => updateQuery(event.target.value)}
              />
            </label>
            <label className="donor-select">
              <span>{t("profile.donorFilter")}</span>
              <select
                value={kind}
                onChange={(event) =>
                  updateKind(
                    event.target.value as "all" | "individual" | "organization",
                  )
                }
              >
                <option value="all">{t("profile.donorAll")}</option>
                <option value="individual">{t("profile.donorIndividuals")}</option>
                <option value="organization">
                  {t("profile.donorOrganizations")}
                </option>
              </select>
            </label>
            <label className="donor-select">
              <span>{t("profile.donorSort")}</span>
              <select
                value={sort}
                onChange={(event) =>
                  updateSort(
                    event.target.value as
                      | "amountDesc"
                      | "amountAsc"
                      | "name"
                      | "year",
                  )
                }
              >
                <option value="amountDesc">{t("profile.donorSortAmountDesc")}</option>
                <option value="amountAsc">{t("profile.donorSortAmountAsc")}</option>
                <option value="name">{t("profile.donorSortName")}</option>
                <option value="year">{t("profile.donorSortYear")}</option>
              </select>
            </label>
            {hasFilters && (
              <button
                type="button"
                className="button button-outline button-small donor-clear"
                onClick={clearFilters}
              >
                {t("profile.donorClear")}
              </button>
            )}
          </div>

          <p className="donor-shown" role="status" aria-live="polite">
            {t("profile.donorResults", {
              shown: shownDonors.length,
              total: filteredDonors.length,
            })}
          </p>

          {shownDonors.length === 0 ? (
            <p className="empty-note">{t("profile.donorNoMatch")}</p>
          ) : (
            <div className="donor-table-wrap">
              <table className="donor-table" aria-label={t("profile.donorAria")}>
                <thead>
                  <tr>
                    <th scope="col">{t("profile.donorName")}</th>
                    <th scope="col">{t("profile.donorType")}</th>
                    <th scope="col">{t("profile.donorYear")}</th>
                    <th scope="col" className="donor-amount-col">
                      {t("profile.donorAmount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shownDonors.map((donor, index) => {
                    const type = donorTypeLabel(donor.contributorType, t);
                    return (
                      <tr key={`${donor.name}-${donor.year}-${index}`}>
                        <td>
                          <span className="donor-name">{donor.name}</span>
                          {(donor.employer || donor.occupation) && (
                            <span className="donor-detail">
                              {[donor.employer, donor.occupation]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </td>
                        <td data-label={t("profile.donorType")}>
                          <span className="donor-type">
                            {type ??
                              (donor.isIndividual
                                ? t("profile.donorIndividual")
                                : t("profile.donorOrganization"))}
                          </span>
                          {donor.count > 1 && (
                            <span className="donor-detail">
                              {donor.count} {t("profile.donorCount").toLowerCase()}
                            </span>
                          )}
                        </td>
                        <td data-label={t("profile.donorYear")}>{donor.year}</td>
                        <td className="donor-amount-col" data-label={t("profile.donorAmount")}>
                          {formatMoney(donor.amount, lang)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {remaining > 0 && (
            <button
              type="button"
              className="button button-outline button-small donor-more"
              onClick={() => setLimit((current) => current + DONOR_PAGE_SIZE)}
            >
              {t("profile.showMoreDonors", {
                count: Math.min(DONOR_PAGE_SIZE, remaining),
              })}
            </button>
          )}

          <p className="donor-methodology">{t("profile.donorMethodology")}</p>
          <p className="donor-note">{t("profile.donorNote")}</p>
          <a
            className="aside-link"
            href={profile.source.portalUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t("profile.donorSource")}
            <ExternalIcon />
          </a>
        </>
      )}
    </section>
  );
}

function BioBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="bio-block">
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DistrictPanel({ legislator }: { legislator: Legislator }) {
  const { t } = useI18n();
  const info = legislator.districtInfo;
  const townCount = info?.towns.length ?? 0;

  return (
    <section className="panel aside-panel">
      <div className="aside-district-head">
        <div>
          <p className="panel-kicker">
            {t("profile.kickerRepresentation")}
          </p>
          <h2>
            {t("profile.districtN", {
              district: padDistrict(legislator.district),
            })}
          </h2>
        </div>
        <span className="district-number" aria-hidden="true">
          {padDistrict(legislator.district)}
        </span>
      </div>

      {info ? (
        <>
          <span className="contact-label">{t("profile.counties")}</span>
          <div className="tag-row">
            {info.counties.map((county) => (
              <span className="tag" key={county}>
                {county}
              </span>
            ))}
          </div>

          <details className="towns-details">
            <summary>
              {t("profile.towns", { count: townCount })}
            </summary>
            <p>{info.townsLabel}</p>
          </details>
        </>
      ) : (
        <p className="empty-note">{t("profile.noDistrict")}</p>
      )}

      <a
        className="aside-link"
        href="https://www.njleg.state.nj.us/district-map"
        target="_blank"
        rel="noreferrer"
      >
        {t("profile.mapLink")}
        <ExternalIcon />
      </a>
    </section>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="inline-icon">
      <path d="M6 2h8v8h-2V5.4L4.7 12.7l-1.4-1.4L10.6 4H6V2Z" />
    </svg>
  );
}
