import { Link } from "react-router-dom";
import { campaignProfilesByLegislator } from "../data";
import { useI18n } from "../lib/i18n";
import {
  PROMISE_STATUS_ORDER,
  getPromiseStatusMeta,
  hasEvidence,
  promiseEvidenceLabel,
  promiseStatusSummary,
} from "../lib/promiseStatus";

/**
 * Compromisos de campaña dentro del perfil del legislador.
 */
export function CampaignPromisesPanel({ legislatorId }: { legislatorId: number }) {
  const { t, lang } = useI18n();
  const profiles = (campaignProfilesByLegislator.get(legislatorId) ?? [])
    .slice()
    .sort((a, b) => b.electionYear - a.electionYear);

  const totalPromises = profiles.reduce(
    (total, profile) => total + profile.promises.length,
    0,
  );

  return (
    <section className="panel campaign-promises-panel" id="compromisos">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">
            {t("profile.campaignCommitmentsKicker")}
          </p>
          <h2>{t("profile.campaignCommitments")}</h2>
        </div>
        <span className="panel-source">
          {t("topic.commitmentCountLabel", { count: totalPromises })}
        </span>
      </div>
      <p className="panel-intro">{t("profile.campaignCommitmentsIntro")}</p>

      {profiles.length === 0 || totalPromises === 0 ? (
        <p className="empty-note">{t("profile.noCampaignProfile")}</p>
      ) : (
        <div className="campaign-profile-list">
          {profiles.map((profile) => {
            const counts = promiseStatusSummary(profile.promises);
            return (
              <article key={profile.key} className="campaign-profile">
                <header className="campaign-profile-head">
                  <div>
                    <h3>
                      {t("profile.electionCycle", { year: profile.electionYear })}
                    </h3>
                    <p className="campaign-profile-meta">
                      {t("profile.districtN", { district: profile.district })} ·{" "}
                      {profile.promises.length}{" "}
                      {t("voteTracker.commitmentsShort")}
                    </p>
                  </div>
                  <div className="campaign-status-summary">
                    {PROMISE_STATUS_ORDER.map((status) => {
                      const statusMeta = getPromiseStatusMeta(status, lang);
                      return (
                        <span
                          key={status}
                          className="campaign-status-count"
                          style={{
                            color: statusMeta.color,
                            background: statusMeta.bg,
                          }}
                        >
                          <span aria-hidden="true">{statusMeta.icon}</span>{" "}
                          {counts[status]} {statusMeta.shortLabel}
                        </span>
                      );
                    })}
                  </div>
                </header>

                <ul className="promise-list promise-list-compact">
                  {profile.promises.map((promise) => {
                    const meta = getPromiseStatusMeta(promise.status, lang);
                    const evidenceLabel = promiseEvidenceLabel(promise, lang);
                    return (
                      <li key={promise.id} className="promise-item">
                        <div
                          className="promise-status"
                          style={{
                            background: meta.bg,
                            color: meta.color,
                            borderColor: meta.border,
                          }}
                        >
                          <span aria-hidden="true">{meta.icon}</span>
                          <span>{meta.label}</span>
                          {meta.check && (
                            <span
                              className="promise-check"
                              aria-label="Verified check"
                            >
                              ✓
                            </span>
                          )}
                        </div>
                        {evidenceLabel && (
                          <span className="promise-evidence-tag">
                            {evidenceLabel}
                          </span>
                        )}
                        <div className="promise-body">
                          <p className="promise-text">{promise.text}</p>
                          <div className="promise-links">
                            {hasEvidence(promise) ? (
                              <span>
                                {promise.evidence.length}{" "}
                                {t("voteTracker.evidenceCount", {
                                  count: promise.evidence.length,
                                })}
                              </span>
                            ) : (
                              <span>{t("voteTracker.noEvidenceYet")}</span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  className="button button-outline button-small"
                  to={`/super-tools/por-quien-voto/${profile.key}`}
                >
                  {t("profile.viewTracker")}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
