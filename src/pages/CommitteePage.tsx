import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { legislators } from "../data";
import { useAnalytics } from "../lib/useAnalytics";
import { useI18n } from "../lib/i18n";
import {
  padDistrict,
  chamberLabel,
  partyLabel,
  translateCommittee,
} from "../lib/labels";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function CommitteePage() {
  const { name } = useParams();
  const committeeName = name ? decodeURIComponent(name) : "";
  const { t, lang } = useI18n();
  const { loading, error } = useAnalytics();
  useDocumentTitle(
    committeeName ? t("committee.title", { name: committeeName }) : t("common.noResults"),
  );

  const members = useMemo(() => {
    if (!committeeName) return [];
    return legislators.filter((l) =>
      l.committees.some((c) => c.name === committeeName),
    );
  }, [committeeName]);

  const uniqueBills = useMemo(() => {
    const billCodes = new Set<string>();
    for (const member of members) {
      for (const [code] of member.bills) {
        billCodes.add(code);
      }
    }
    return billCodes.size;
  }, [members]);

  const byParty = useMemo(() => {
    const d = members.filter((m) => m.party === "D").length;
    const r = members.filter((m) => m.party === "R").length;
    return { d, r };
  }, [members]);

  if (!committeeName) {
    return (
      <main className="page narrow-page">
        <div className="empty-state">
          <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
          <h1>{t("topic.notFoundTitle")}</h1>
          <p>{t("topic.notFoundText")}</p>
          <Link className="button button-dark" to="/">
            {t("committee.backToDirectory")}
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

  if (error || members.length === 0) {
    return (
      <main className="page narrow-page">
        <div className="empty-state">
          <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
          <h1>{t("committee.noMembers")}</h1>
          <p>{t("topic.notFoundText")}</p>
          <Link className="button button-dark" to="/">
            {t("committee.backToDirectory")}
          </Link>
        </div>
      </main>
    );
  }

  const translatedName = translateCommittee(committeeName, lang);

  return (
    <main className="page narrow-page committee-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/super-tools">{t("superTools.back")}</Link>
        <span aria-hidden="true">/</span>
        <span>{translatedName}</span>
      </nav>

      <header className="page-header">
        <p className="eyebrow eyebrow-dark">{t("committee.title", { name: translatedName })}</p>
        <h1>{translatedName}</h1>
        <p className="page-header-sub">
          {t("committee.sub", { name: translatedName })}
        </p>
      </header>

      <section className="panel committee-overview-panel">
        <div className="committee-stats">
          <div className="committee-stat">
            <span className="committee-stat-value">{members.length}</span>
            <span className="committee-stat-label">
              {t("committee.members")}
            </span>
          </div>
          <div className="committee-stat">
            <span className="committee-stat-value">{uniqueBills}</span>
            <span className="committee-stat-label">
              {t("committee.uniqueBills")}
            </span>
          </div>
          <div className="committee-stat">
            <span className="committee-stat-value">
              {byParty.d} · {byParty.r}
            </span>
            <span className="committee-stat-label">
              {t("committee.byParty")}
            </span>
          </div>
        </div>
      </section>

      <section className="panel committee-members-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("committee.members")}</p>
            <h2>{t("committee.members")}</h2>
          </div>
        </div>

        <div className="committee-members-grid">
          {members.map((member) => (
            <article key={member.id} className="committee-member-card">
              <div className="committee-member-photo-wrap">
                <img
                  className="committee-member-photo"
                  src={member.photo ?? ""}
                  alt={member.fullName}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {!member.photo && (
                  <div className="committee-member-photo-fallback">
                    {member.fullName[0]}
                  </div>
                )}
              </div>
              <div className="committee-member-info">
                <span className="committee-member-role">
                  {chamberLabel(member.chamber, lang)}
                </span>
                <h3 className="committee-member-name">{member.fullName}</h3>
                <p className="committee-member-party">
                  {partyLabel(member.party, lang)} · {t("common.district")}{" "}
                  {padDistrict(member.district)}
                </p>
                <Link
                  className="committee-member-link"
                  to={`/legislador/${member.id}`}
                >
                  {t("common.viewProfile")}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
