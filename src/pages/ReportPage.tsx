import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { PartyBadge } from "../components/PartyBadge";
import {
  campaignProfilesByLegislator,
  legislatorsById,
  loadBills,
  loadDonorProfilesByLegislator,
  meta,
} from "../data";
import { useI18n } from "../lib/i18n";
import {
  chamberLabel,
  padDistrict,
  partyLabel,
  roleLabel,
  translateBillAction,
  translateCommittee,
  translateCommitteePosition,
  translateLeadership,
  translateSourceLabel,
  translateSourceName,
} from "../lib/labels";
import {
  getPromiseStatusMeta,
  hasEvidence,
  promiseEvidenceLabel,
} from "../lib/promiseStatus";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { Bill, CampaignProfile, DonorProfile } from "../types";

function money(value: number, lang: string): string {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function ReportShell({ children }: { children: ReactNode }) {
  return <div className="report-document">{children}</div>;
}

export function ReportPage() {
  const { id } = useParams();
  const { t, lang, formatDate, formatNumber } = useI18n();
  const legislatorId = Number(id);
  const legislator = Number.isFinite(legislatorId)
    ? legislatorsById.get(legislatorId)
    : undefined;

  useDocumentTitle(
    legislator
      ? t("report.docTitle", { name: legislator.fullName })
      : t("report.notFoundTitle"),
  );

  const [bills, setBills] = useState<Record<string, Bill> | null>(null);
  const [billsFailed, setBillsFailed] = useState(false);
  const [donorProfiles, setDonorProfiles] = useState<DonorProfile[] | null>(null);
  const [donorsFailed, setDonorsFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setBills(null);
    setBillsFailed(false);
    loadBills()
      .then((data) => {
        if (active) setBills(data);
      })
      .catch(() => {
        if (active) setBillsFailed(true);
      });
    return () => {
      active = false;
    };
  }, [legislatorId]);

  useEffect(() => {
    let active = true;
    setDonorProfiles(null);
    setDonorsFailed(false);
    loadDonorProfilesByLegislator()
      .then((map) => {
        if (!active) return;
        setDonorProfiles(
          (map.get(legislatorId) ?? [])
            .slice()
            .sort((a, b) => b.electionYear - a.electionYear),
        );
      })
      .catch(() => {
        if (active) setDonorsFailed(true);
      });
    return () => {
      active = false;
    };
  }, [legislatorId]);

  if (!legislator) {
    return (
      <main className="page narrow-page report-page">
        <div className="empty-state">
          <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
          <h1>{t("report.notFoundTitle")}</h1>
          <p>{t("report.notFoundText")}</p>
          <Link className="button button-dark" to="/">
            {t("common.backDirectory")}
          </Link>
        </div>
      </main>
    );
  }

  const campaignProfiles = (campaignProfilesByLegislator.get(legislator.id) ?? [])
    .slice()
    .sort((a, b) => b.electionYear - a.electionYear);
  const latestCampaign: CampaignProfile | undefined = campaignProfiles[0];
  const donor: DonorProfile | undefined = donorProfiles?.[0];

  const primaryBills = legislator.bills.filter(([, type]) => type === "P");
  const sampleBills = primaryBills.slice(0, 20);
  const generatedAt = new Date();

  return (
    <main className="page report-page">
      <div className="report-actions no-print">
        <Link
          className="button button-outline button-small"
          to={`/legislador/${legislator.id}`}
        >
          {t("report.back")}
        </Link>
        <button
          type="button"
          className="button button-dark button-small"
          onClick={() => window.print()}
        >
          {t("report.print")}
        </button>
      </div>

      <ReportShell>
        <header className="report-header">
          <div>
            <p className="report-brand">{t("brand.name")}</p>
            <p className="report-brand-sub">{t("report.title")}</p>
          </div>
          <div className="report-header-meta">
            <p>
              {t("report.generated", {
                date: formatDate(generatedAt.toISOString()),
              })}
            </p>
            <p>
              {t("report.sessionLine", { session: meta.sessionLabel })}
            </p>
          </div>
        </header>

        <section className="report-section report-hero">
          <div className="report-identity">
            <h1>{legislator.fullName}</h1>
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
              {legislator.leadership && (
                <span className="chip">
                  {translateLeadership(legislator.leadership, lang)}
                </span>
              )}
            </div>
            <p className="report-role">
              {t("profile.roleLine", {
                role: roleLabel(legislator.chamber, lang),
                chamber: chamberLabel(legislator.chamber, lang),
              })}
            </p>
          </div>
          <dl className="report-facts">
            <div>
              <dt>{t("report.party")}</dt>
              <dd>{partyLabel(legislator.party, lang)}</dd>
            </div>
            <div>
              <dt>{t("report.chamber")}</dt>
              <dd>{chamberLabel(legislator.chamber, lang)}</dd>
            </div>
            <div>
              <dt>{t("report.district")}</dt>
              <dd>{padDistrict(legislator.district)}</dd>
            </div>
            <div>
              <dt>{t("report.sessionLabel")}</dt>
              <dd>{meta.sessionLabel}</dd>
            </div>
            {legislator.email && (
              <div>
                <dt>{t("report.email")}</dt>
                <dd>{legislator.email}</dd>
              </div>
            )}
            <div>
              <dt>{t("report.website")}</dt>
              <dd className="report-url">{legislator.officialUrl}</dd>
            </div>
          </dl>
        </section>

        {legislator.districtInfo && (
          <section className="report-section">
            <h2>{t("report.districtSection")}</h2>
            <div className="report-two-col">
              <div>
                <h3>{t("report.counties")}</h3>
                <p>{legislator.districtInfo.countiesLabel}</p>
              </div>
              <div>
                <h3>{t("report.towns")}</h3>
                <p>{legislator.districtInfo.townsLabel}</p>
              </div>
            </div>
          </section>
        )}

        <section className="report-section">
          <h2>{t("report.activity")}</h2>
          <div className="report-stat-row">
            <div>
              <strong>{formatNumber(legislator.bills.length)}</strong>
              <span>{t("report.totalBills")}</span>
            </div>
            <div>
              <strong>{formatNumber(primaryBills.length)}</strong>
              <span>{t("report.primaryBills")}</span>
            </div>
            <div>
              <strong>{formatNumber(legislator.committees.length)}</strong>
              <span>{t("report.committeeCount")}</span>
            </div>
          </div>

          <h3>{t("report.bills")}</h3>
          {billsFailed ? (
            <p className="report-note">{t("report.billsUnavailable")}</p>
          ) : sampleBills.length === 0 ? (
            <p className="report-note">{t("report.noBills")}</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col">{t("report.bill")}</th>
                  <th scope="col">{t("report.synopsis")}</th>
                </tr>
              </thead>
              <tbody>
                {sampleBills.map(([billId]) => {
                  const bill = bills?.[billId];
                  return (
                    <tr key={billId}>
                      <td className="report-bill-id">{billId}</td>
                      <td>
                        {bill?.synopsis ?? (
                          <span className="report-muted">
                            {t("report.loadingSynopsis")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {primaryBills.length > sampleBills.length && (
            <p className="report-note">
              {t("report.shown", {
                shown: sampleBills.length,
                total: primaryBills.length,
              })}
            </p>
          )}
        </section>

        <section className="report-section">
          <h2>{t("report.committees")}</h2>
          {legislator.committees.length === 0 ? (
            <p className="report-note">{t("report.noCommittees")}</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col">{t("report.committee")}</th>
                  <th scope="col">{t("report.position")}</th>
                </tr>
              </thead>
              <tbody>
                {legislator.committees.map((committee) => (
                  <tr key={`${committee.code}-${committee.name}`}>
                    <td>{translateCommittee(committee.name, lang)}</td>
                    <td>
                      {committee.position
                        ? translateCommitteePosition(committee.position, lang)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="report-section">
          <h2>{t("report.promises")}</h2>
          {!latestCampaign || latestCampaign.promises.length === 0 ? (
            <p className="report-note">{t("report.promisesEmpty")}</p>
          ) : (
            <>
              <p className="report-note">
                {t("report.promisesIntro", {
                  year: latestCampaign.electionYear,
                  url: latestCampaign.source.url,
                })}
              </p>
              <ul className="report-promise-list">
                {latestCampaign.promises.map((promise) => {
                  const status = getPromiseStatusMeta(promise.status, lang);
                  const evidenceLabel = promiseEvidenceLabel(promise, lang);
                  return (
                    <li key={promise.id}>
                      <div className="report-promise-head">
                        <span
                          className="report-status"
                          style={{ color: status.color, background: status.bg }}
                        >
                          <span aria-hidden="true">{status.icon}</span>{" "}
                          {status.label}
                          {status.check && <span aria-hidden="true"> ✓</span>}
                        </span>
                        {evidenceLabel && (
                          <span className="report-evidence-tag">
                            {evidenceLabel}
                          </span>
                        )}
                      </div>
                      <p className="report-promise-text">{promise.text}</p>
                      {hasEvidence(promise) && (
                        <ul className="report-evidence-list">
                          {promise.evidence.slice(0, 3).map((ev) => (
                            <li key={`${promise.id}-${ev.bill}`}>
                              <strong>{ev.bill}</strong> ({ev.session}) — {translateBillAction(ev.action, lang)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className="report-section">
          <h2>{t("report.donors")}</h2>
          {donorsFailed ? (
            <p className="report-note">{t("report.donorsUnavailable")}</p>
          ) : donorProfiles === null ? (
            <p className="report-note">{t("common.loading")}</p>
          ) : !donor ? (
            <p className="report-note">{t("report.donorsEmpty")}</p>
          ) : (
            <>
              <div className="report-stat-row">
                <div>
                  <strong>{money(donor.totalAmount, lang)}</strong>
                  <span>{t("report.donorTotal")}</span>
                </div>
                <div>
                  <strong>{formatNumber(donor.donorCount)}</strong>
                  <span>{t("report.donorContributors")}</span>
                </div>
                <div>
                  <strong>{formatNumber(donor.contributionCount)}</strong>
                  <span>{t("report.donorContributions")}</span>
                </div>
              </div>
              <h3>
                {t("report.topDonors", { year: donor.electionYear })}
              </h3>
              <table className="report-table">
                <thead>
                  <tr>
                    <th scope="col">{t("profile.donorName")}</th>
                    <th scope="col">{t("profile.donorYear")}</th>
                    <th scope="col" className="report-amount">
                      {t("profile.donorAmount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {donor.donors
                    .slice()
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10)
                    .map((record, index) => (
                      <tr key={`${record.name}-${record.year}-${index}`}>
                        <td>{record.name}</td>
                        <td>{record.year}</td>
                        <td className="report-amount">
                          {money(record.amount, lang)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="report-note">{t("profile.donorNote")}</p>
            </>
          )}
        </section>

        <section className="report-section report-sources">
          <h2>{t("report.sources")}</h2>
          <p>{t("report.sourcesText")}</p>
          <ul>
            <li>
              <a href={meta.sourceUrl} target="_blank" rel="noreferrer">
                {translateSourceName(meta.sourceName, lang)} · {t("report.sourceRoster")}
              </a>
            </li>
            <li>
              <a href={meta.sourceBillsUrl} target="_blank" rel="noreferrer">
                {translateSourceName(meta.sourceName, lang)} · {t("report.sourceBills")}
              </a>
            </li>
            {latestCampaign && (
              <li>
                <a
                  href={latestCampaign.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {translateSourceLabel(latestCampaign.source.label, lang)}
                </a>
              </li>
            )}
            {donor && (
              <li>
                <a href={donor.source.portalUrl} target="_blank" rel="noreferrer">
                  ELEC · {t("profile.donorSource")}
                </a>
              </li>
            )}
          </ul>
        </section>

        <footer className="report-footer">
          <p>{t("report.disclaimer")}</p>
          <p>
            {t("report.footerLine", {
              date: formatDate(generatedAt.toISOString()),
            })}
          </p>
        </footer>
      </ReportShell>
    </main>
  );
}
