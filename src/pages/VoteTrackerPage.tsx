import { type CSSProperties } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PartyBadge } from "../components/PartyBadge";
import { Portrait } from "../components/Portrait";
import { campaign, campaignProfilesByKey } from "../data";
import { useI18n, type Lang } from "../lib/i18n";
import {
  chamberLabel,
  padDistrict,
  partyLabel,
  translateBillAction,
  translatePromiseQuestion,
  translateSourceLabel,
} from "../lib/labels";
import {
  PROMISE_STATUS_ORDER,
  getPromiseStatusMeta,
  hasEvidence,
  promiseEvidenceLabel,
  promiseStatusSummary,
} from "../lib/promiseStatus";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type {
  CampaignBallotCandidate,
  CampaignDistrict,
  CampaignElectionYear,
  CampaignProfile,
} from "../types";

const NOTE_COPY: Record<string, { en: string; es: string }> = {
  enacted: { en: "Signed into law.", es: "Aprobada y convertida en ley." },
  advanced: {
    en: "Advanced in the legislative process during the tracked session.",
    es: "Avanzó en el proceso legislativo durante la sesión evaluada.",
  },
  introduced: {
    en: "A related bill was introduced by this legislator in the tracked session.",
    es: "Este legislador presentó un proyecto relacionado en la sesión evaluada.",
  },
  sessionEnded: {
    en: "No enacted related bill by this legislator was found in the tracked session. This is not a determination of intent or effort.",
    es: "No se encontró un proyecto relacionado de este legislador aprobado en la sesión evaluada. Esto no determina intención ni esfuerzo.",
  },
  noAction: {
    en: "No clearly related primary-sponsored bill was identified in the tracked session.",
    es: "No se identificó un proyecto claramente relacionado presentado como patrocinador principal en la sesión evaluada.",
  },
  notElected: {
    en: "Not in office for the tracked session.",
    es: "No ocupó el cargo durante la sesión evaluada.",
  },
};

export function VoteTrackerPage() {
  const { profileKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, lang } = useI18n();

  const yearParam = Number(searchParams.get("year")) || campaign.years[1]?.year || 2025;
  const districtParam = Number(searchParams.get("district")) || 1;

  const yearData = campaign.years.find((item) => item.year === yearParam) ?? campaign.years[0];
  const districtData = yearData.districts.find((item) => item.district === districtParam) ?? yearData.districts[0];

  const selectedProfile = profileKey ? campaignProfilesByKey.get(profileKey) : undefined;

  useDocumentTitle(
    selectedProfile
      ? `${selectedProfile.name} · ${t("voteTracker.title")} · Watchdogs Media`
      : `${t("voteTracker.title")} · Super Tools · Watchdogs Media`,
  );

  function setYear(year: number) {
    setSearchParams({ year: String(year), district: String(districtParam) });
  }
  function setDistrict(district: number) {
    setSearchParams({ year: String(yearParam), district: String(district) });
  }

  if (selectedProfile) {
    return <ProfileView profile={selectedProfile} />;
  }

  return (
    <main className="page topic-page vote-tracker-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/super-tools">{t("topic.back")}</Link>
        <span aria-hidden="true">/</span>
        <span>{t("voteTracker.title")}</span>
      </nav>

      <header className="topic-hero vote-tracker-hero">
        <div className="topic-hero-glow" aria-hidden="true" />
        <div className="topic-hero-copy">
          <p className="eyebrow eyebrow-dark">{t("nav.superTools")}</p>
          <h1>{t("voteTracker.title")}</h1>
          <p className="topic-description">{t("voteTracker.sub")}</p>
          <p className="topic-description" style={{ marginTop: 8, fontSize: 14 }}>
            {t("voteTracker.privacy")}
          </p>
        </div>
      </header>

      <section className="panel super-panel" style={{ marginBottom: 20 }}>
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("voteTracker.select")}</p>
            <h2>{t("voteTracker.ballotFinder")}</h2>
          </div>
        </div>
        <div className="vote-controls">
          <label className="select-field">
            <span>{t("voteTracker.year")}</span>
            <select value={yearData.year} onChange={(e) => setYear(Number(e.target.value))}>
              {campaign.years.map((item) => (
                <option key={item.year} value={item.year}>
                  {t("voteTracker.yearOption", { year: item.year })}
                </option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span>{t("common.district")}</span>
            <select value={districtData.district} onChange={(e) => setDistrict(Number(e.target.value))}>
              {yearData.districts.map((item) => (
                <option key={item.district} value={item.district}>
                  {t("profile.districtN", { district: padDistrict(item.district) })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="panel-intro" style={{ marginTop: 12 }}>
          {t("voteTracker.ballotNote", {
            chambers:
              yearData.chambers.length === 2
                ? `${t("common.senate")} + ${t("common.assembly")}`
                : t("common.assembly"),
          })}
        </p>
      </section>

      <DistrictBallot year={yearData} district={districtData} />

      <section className="panel super-panel" style={{ marginTop: 20 }}>
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("common.methodology")}</p>
            <h2>{t("voteTracker.methodologyTitle")}</h2>
          </div>
        </div>
        <p className="panel-intro">{t("voteTracker.methodologyText")}</p>
        <StatusLegend lang={lang} />
        <p className="panel-intro" style={{ marginTop: 12, fontSize: 13 }}>
          {t("voteTracker.sourceNote")}{" "}
          <a href={campaign.source.url} target="_blank" rel="noreferrer">
            {campaign.source.name}
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function DistrictBallot({
  year,
  district,
}: {
  year: CampaignElectionYear;
  district: CampaignDistrict;
}) {
  const { t, lang } = useI18n();
  return (
    <section className="panel super-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("voteTracker.ballot")}</p>
          <h2>
            {t("profile.districtN", { district: padDistrict(district.district) })} · {year.year}
          </h2>
        </div>
        <a className="panel-source" href={district.source.url} target="_blank" rel="noreferrer">
          {t("common.officialSource")}
        </a>
      </div>
      <div className="vote-races">
        {district.races.map((race) => (
          <div key={race.chamber} className="vote-race">
            <h3>{chamberLabel(race.chamber, lang)}</h3>
            <ul className="vote-candidates">
              {race.candidates.map((candidate) => (
                <CandidateRow key={`${race.chamber}-${candidate.name}`} candidate={candidate} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function CandidateRow({ candidate }: { candidate: CampaignBallotCandidate }) {
  const { t, lang } = useI18n();
  const profile = candidate.profileKey ? campaignProfilesByKey.get(candidate.profileKey) : undefined;
  const counts = profile ? statusCounts(profile) : null;
  const rawParty = candidate.party.trim();
  const normalizedParty =
    rawParty === "D" || /^dem/i.test(rawParty)
      ? "D"
      : rawParty === "R" || /^rep/i.test(rawParty)
        ? "R"
        : rawParty;

  return (
    <li className="vote-candidate">
      <div className="vote-candidate-main">
        <strong>{candidate.name}</strong>
        <div className="chip-row" style={{ marginTop: 4 }}>
          {normalizedParty && (
            <span className="chip">{partyLabel(normalizedParty, lang)}</span>
          )}
          {candidate.incumbent && <span className="chip">{t("voteTracker.incumbent")}</span>}
          {candidate.won && <span className="chip">{t("voteTracker.currentMember")}</span>}
          <span className="chip">
            {candidate.responded ? t("voteTracker.responded") : t("voteTracker.noResponse")}
          </span>
        </div>
        {counts && (
          <div className="vote-mini-status">
            {PROMISE_STATUS_ORDER.map((status) => {
              const statusMeta = getPromiseStatusMeta(status, lang);
              return (
                <span key={status} style={{ color: statusMeta.color, fontWeight: 600 }}>
                  {statusMeta.icon} {counts[status]}
                  <span className="vote-mini-label">{statusMeta.shortLabel}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="vote-candidate-action">
        {profile && profile.promises.length > 0 ? (
          <Link className="button button-outline button-small" to={`/super-tools/por-quien-voto/${profile.key}`}>
            {t("voteTracker.viewProfile")}
          </Link>
        ) : (
          <span className="empty-note">
            {profile
              ? t("voteTracker.noSourcedCommitments")
              : t("voteTracker.noTrackedProfile")}
          </span>
        )}
      </div>
    </li>
  );
}

function statusCounts(profile: CampaignProfile) {
  return promiseStatusSummary(profile.promises);
}

function ProfileView({ profile }: { profile: CampaignProfile }) {
  const { t, lang } = useI18n();
  const counts = statusCounts(profile);

  return (
    <main className="page topic-page vote-tracker-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/super-tools">{t("topic.back")}</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/super-tools/por-quien-voto?year=${profile.electionYear}&district=${profile.district}`}>
          {t("voteTracker.title")}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{profile.name}</span>
      </nav>

      <header className="profile-card" style={{ marginBottom: 20 }}>
        <Portrait src={profile.photo} name={profile.name} className="profile-photo" eager />
        <div className="profile-main-info">
          <div className="chip-row">
            <PartyBadge party={profile.party} />
            <span className="chip">{t("profile.districtN", { district: padDistrict(profile.district) })}</span>
            <span className="chip">{chamberLabel(profile.chamber, lang)}</span>
            <span className="chip">{profile.electionYear}</span>
          </div>
          <h1 className="profile-name">{profile.name}</h1>
          <p className="profile-role">{t("voteTracker.profileSub")}</p>
          <div className="profile-actions">
            <Link className="button button-dark button-small" to={`/legislador/${profile.legislatorId}`}>
              {t("common.viewProfile")}
            </Link>
            <a className="button button-outline button-small" href={profile.source.url} target="_blank" rel="noreferrer">
              {t("voteTracker.viewAnswers")}
            </a>
          </div>
        </div>
        <div className="profile-stats" aria-label={t("voteTracker.checklistSummary")}>
          {PROMISE_STATUS_ORDER.map((status) => {
            const statusMeta = getPromiseStatusMeta(status, lang);
            return (
              <div key={status}>
                <span className="profile-stat-value" style={{ color: statusMeta.color }}>{counts[status]}</span>
                <span className="profile-stat-label">{statusMeta.shortLabel}</span>
              </div>
            );
          })}
        </div>
      </header>

      <section className="panel super-panel" style={{ marginBottom: 20 }}>
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("voteTracker.checklist")}</p>
            <h2>{t("voteTracker.promisesTitle")}</h2>
          </div>
          <span className="panel-source">{t("topic.commitmentCountLabel", { count: profile.promises.length })}</span>
        </div>
        <p className="panel-intro">{t("voteTracker.promisesIntro")}</p>
        <StatusLegend lang={lang} />

        {profile.promises.length === 0 ? (
          <p className="empty-note" style={{ marginTop: 16 }}>{t("voteTracker.noPromises")}</p>
        ) : (
          <ul className="promise-list">
            {profile.promises.map((promise) => {
              const meta = getPromiseStatusMeta(promise.status, lang);
              const evidenceLabel = promiseEvidenceLabel(promise, lang);
              return (
                <li key={promise.id} className="promise-item">
                  <div className="promise-status" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                    <span aria-hidden="true">{meta.icon}</span>
                    <span>{meta.label}</span>
                    {meta.check && (
                      <span className="promise-check" aria-label="Verified check">✓</span>
                    )}
                  </div>
                  {evidenceLabel && (
                    <span className="promise-evidence-tag">{evidenceLabel}</span>
                  )}
                  <div className="promise-body">
                    <p className="promise-question"><strong>{translatePromiseQuestion(promise.source.question, lang) ?? t("voteTracker.commitment")}</strong></p>
                    <p className="promise-text">{promise.text}</p>
                    <p className="promise-note">{NOTE_COPY[promise.statusNote]?.[lang] ?? promise.statusNote}</p>
                    <div className="promise-links">
                      <a href={promise.source.url} target="_blank" rel="noreferrer">{t("voteTracker.answerSource")}</a>
                      {promise.source.date && <span>· {promise.source.date}</span>}
                    </div>
                    {hasEvidence(promise) && (
                      <div className="promise-evidence">
                        <p className="promise-evidence-label">{t("voteTracker.evidence")}</p>
                        <ul>
                          {promise.evidence.map((ev) => (
                            <li key={`${promise.id}-${ev.bill}`}>
                              <a href={ev.url} target="_blank" rel="noreferrer"><strong>{ev.bill}</strong></a> ({ev.session}) — {ev.synopsis}
                              <div className="promise-evidence-meta">{translateBillAction(ev.action, lang)}{ev.date ? ` · ${ev.date}` : ""}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("common.methodology")}</p>
            <h2>{t("voteTracker.methodologyTitle")}</h2>
          </div>
        </div>
        <p className="panel-intro">{t("voteTracker.methodologyText")}</p>
        <p className="panel-intro" style={{ marginTop: 8, fontSize: 13 }}>
          {t("voteTracker.sourceLabel")}: <a href={profile.source.url} target="_blank" rel="noreferrer">{translateSourceLabel(profile.source.label, lang)}</a>
        </p>
      </section>
    </main>
  );
}

function StatusLegend({ lang }: { lang: Lang }) {
  return (
    <ul className="status-legend">
      {PROMISE_STATUS_ORDER.map((status) => {
        const meta = getPromiseStatusMeta(status, lang);
        return (
          <li key={status} className="status-legend-item">
            <span
              className="status-pill"
              style={{
                background: meta.bg,
                color: meta.color,
                border: `1px solid ${meta.border}`,
              } as CSSProperties}
            >
              <strong aria-hidden="true">{meta.icon}</strong>{" "}
              {meta.shortLabel}
              {meta.check && <span aria-hidden="true"> ✓</span>}
            </span>
            <span className="status-legend-desc">{meta.description}</span>
          </li>
        );
      })}
    </ul>
  );
}
