import { useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { PartyFlag } from "../components/PartyFlag";
import { Portrait } from "../components/Portrait";
import { meta } from "../data";
import type {
  Analytics,
  TopicBillEntry,
  TopicStat,
} from "../lib/analytics";
import { getTopicStat, topicFromSlug } from "../lib/analytics";
import { useAnalytics } from "../lib/useAnalytics";
import { useI18n } from "../lib/i18n";
import {
  billTypeLabel,
  billUrl,
  chamberLabel,
  padDistrict,
  roleLabel,
  translateCommittee,
} from "../lib/labels";
import { TOPICS } from "../lib/topics";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const PAGE_SIZE = 20;

export function TopicPage() {
  const { slug } = useParams();
  const { t, lang, formatNumber } = useI18n();
  const { analytics, loading, error } = useAnalytics();
  const topic = topicFromSlug(slug ?? "");
  const known = TOPICS.some((item) => item.slug === slug);
  const stat = analytics ? getTopicStat(analytics, topic.slug) : undefined;

  useDocumentTitle(
    known
      ? t("topic.docTitle", { topic: topic.label[lang] })
      : t("common.noResults"),
  );

  if (!known) {
    return (
      <main className="page narrow-page">
        <div className="empty-state">
          <p className="eyebrow eyebrow-dark">{t("common.error404")}</p>
          <h1>{t("topic.notFoundTitle")}</h1>
          <p>{t("topic.notFoundText")}</p>
          <Link className="button button-dark" to="/super-tools">
            {t("topic.backToTools")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page topic-page">
      <nav className="breadcrumb" aria-label={t("topic.breadcrumb")}>
        <Link to="/super-tools">{t("topic.back")}</Link>
        <span aria-hidden="true">/</span>
        <span>{topic.label[lang]}</span>
      </nav>

      <header
        className="topic-hero"
        style={{ "--topic-color": topic.color } as CSSProperties}
      >
        <div className="topic-hero-glow" aria-hidden="true" />
        <div className="topic-hero-copy">
          <p className="eyebrow eyebrow-dark">{t("topic.kicker")}</p>
          <h1>{topic.label[lang]}</h1>
          <p className="topic-description">{topic.description[lang]}</p>
        </div>

        {stat && (
          <div className="topic-stat-grid">
            <div>
              <span className="topic-stat-value">
                {formatNumber(stat.billCount)}
              </span>
              <span className="topic-stat-label">{t("topic.billsFiled")}</span>
            </div>
            <div>
              <span className="topic-stat-value">
                {formatNumber(stat.participants.length)}
              </span>
              <span className="topic-stat-label">
                {t("topic.legislatorsInvolved")}
              </span>
            </div>
            <div>
              <span className="topic-stat-value">
                {pct(stat.bipartisanBills, stat.billCount)}%
              </span>
              <span className="topic-stat-label">
                {t("topic.bipartisanBills")}
              </span>
            </div>
            <div>
              <span className="topic-stat-value">
                {formatNumber(stat.primarySponsorships)}
              </span>
              <span className="topic-stat-label">
                {t("topic.primarySponsorships")}
              </span>
            </div>
          </div>
        )}

        {stat && analytics && (
          <div className="topic-share">
            <span>
              {t("topic.shareOfBills", {
                pct: pct(stat.billCount, analytics.totalBills),
              })}
            </span>
            <span className="topic-share-track" aria-hidden="true">
              <span
                style={{
                  width: `${(stat.billCount / analytics.totalBills) * 100}%`,
                  background: topic.color,
                }}
              />
            </span>
          </div>
        )}
      </header>

      {loading && (
        <div className="super-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>{t("superTools.loading")}</p>
        </div>
      )}

      {error && !loading && (
        <div className="empty-state">
          <h3>{t("common.noResults")}</h3>
          <p>{t("superTools.error")}</p>
        </div>
      )}

      {analytics && stat && !loading && (
        <div className="topic-grid">
          <div className="topic-main">
            <ParticipantPanel stat={stat} />
            <TopBillsPanel stat={stat} />
            <section className="panel topic-bills-panel" id="bills">
              <div className="panel-head super-panel-head">
                <div>
                  <p className="panel-kicker">{t("topic.exploreBills")}</p>
                  <h2>{t("topic.billsInTopic")}</h2>
                </div>
                <span className="panel-source">
                  {formatNumber(stat.billCount)}
                </span>
              </div>
              <p className="panel-intro">
                {t("topic.methodologyText")}
              </p>
              <TopicBillExplorer bills={stat.bills} />
            </section>
          </div>

          <aside className="topic-aside">
            <PartySupport stat={stat} />
            <ChamberSplit stat={stat} />
            <CommitteeList stat={stat} />
            <OtherTopics analytics={analytics} current={stat.topic.slug} />
            <section className="panel topic-method">
              <p className="panel-kicker">{t("common.methodology")}</p>
              <h2>{t("topic.methodology")}</h2>
              <p>{t("topic.methodologyText")}</p>
              <Link className="aside-link" to="/acerca">
                {t("common.methodology")} →
              </Link>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function ParticipantPanel({ stat }: { stat: TopicStat }) {
  const { t, lang, formatNumber } = useI18n();
  const participants = stat.participants.slice(0, 10);
  const max = participants[0]?.total ?? 1;

  return (
    <section className="panel participants-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("topic.topMembers")}</p>
          <h2>{t("topic.participantsTitle")}</h2>
        </div>
        <span className="panel-source">
          {formatNumber(stat.participants.length)} {t("common.members")}
        </span>
      </div>
      <p className="panel-intro">{t("topic.participantsSub")}</p>

      <div className="participant-grid">
        {participants.map((participant, index) => (
          <Link
            key={participant.legislator.id}
            to={`/legislador/${participant.legislator.id}`}
            className="participant-card"
          >
            <span className="participant-card-rank">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="participant-card-photo">
              <Portrait
                src={participant.legislator.photo}
                name={participant.legislator.fullName}
              />
              <PartyFlag
                party={participant.legislator.party}
                className="participant-flag"
              />
            </span>
            <span className="participant-card-info">
              <strong>{participant.legislator.fullName}</strong>
              <small>
                {roleLabel(participant.legislator.chamber, lang)} ·{" "}
                {chamberLabel(participant.legislator.chamber, lang)}
              </small>
              <small>
                {t("common.district")}{" "}
                {padDistrict(participant.legislator.district)}
              </small>
              <span className="participant-bar" aria-hidden="true">
                <span
                  style={{ width: `${(participant.total / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="participant-card-count">
              <strong>{formatNumber(participant.total)}</strong>
              <small>{t("superTools.billsShort")}</small>
              <span>
                {t("topic.participantPrimary", {
                  count: participant.primary,
                })}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TopBillsPanel({ stat }: { stat: TopicStat }) {
  const { t, formatNumber } = useI18n();
  const bills = stat.topBills.filter((bill) => bill.sponsors.length > 0).slice(0, 5);

  if (bills.length === 0) return null;

  return (
    <section className="panel top-bills-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("topic.billsFiled")}</p>
          <h2>{t("topic.topBillsTitle")}</h2>
        </div>
      </div>
      <p className="panel-intro">{t("topic.topBillsSub")}</p>

      <ul className="top-bills-list">
        {bills.map((bill) => (
          <li key={bill.code}>
            <a
              href={billUrl(bill.code, bill.session || meta.session)}
              target="_blank"
              rel="noreferrer"
              aria-label={t("topic.viewBill", { bill: bill.code })}
            >
              <span className="bill-number">{bill.code}</span>
              <span className="top-bill-body">
                <span className="top-bill-synopsis">{bill.synopsis}</span>
                <span className="top-bill-sponsors">
                  {bill.sponsors.slice(0, 5).map((sponsor) => (
                    <PartyFlag
                      key={`${bill.code}-${sponsor.legislator.id}`}
                      party={sponsor.legislator.party}
                      className="party-flag-xs"
                    />
                  ))}
                  <span>
                    {t("topic.sponsorCount", {
                      count: bill.sponsors.length,
                    })}
                  </span>
                </span>
              </span>
              <span className="top-bill-count">
                <strong>{formatNumber(bill.sponsors.length)}</strong>
                <small>{t("topic.sponsors")}</small>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopicBillExplorer({ bills }: { bills: TopicBillEntry[] }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"bills" | "sponsors">("bills");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bills
      .filter((bill) => {
        if (!needle) return true;
        return (
          bill.code.toLowerCase().includes(needle) ||
          bill.synopsis.toLowerCase().includes(needle) ||
          bill.sponsors.some((sponsor) =>
            sponsor.legislator.fullName.toLowerCase().includes(needle),
          )
        );
      })
      .sort((a, b) => {
        if (sort === "sponsors") {
          return (
            b.sponsors.length - a.sponsors.length ||
            a.code.localeCompare(b.code, "en", { numeric: true })
          );
        }
        return a.code.localeCompare(b.code, "en", { numeric: true });
      });
  }, [bills, query, sort]);

  const visible = filtered.slice(0, limit);

  function changeQuery(value: string) {
    setQuery(value);
    setLimit(PAGE_SIZE);
  }

  return (
    <div className="topic-bill-explorer">
      <div className="bill-toolbar">
        <div className="search-field search-field-small">
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
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={t("topic.searchPlaceholder")}
            aria-label={t("topic.searchPlaceholder")}
          />
        </div>

        <label className="select-field topic-sort">
          <span>{t("topic.sortBy")}</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "bills" | "sponsors");
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="bills">{t("topic.sortBills")}</option>
            <option value="sponsors">{t("topic.sortSponsors")}</option>
          </select>
        </label>
      </div>

      <p className="bill-count-note">
        {t("topic.billListNote", {
          shown: visible.length,
          total: filtered.length,
        })}
      </p>

      {visible.length > 0 ? (
        <div className="topic-bill-list">
          {visible.map((bill) => (
            <a
              key={bill.code}
              className="topic-bill-row"
              href={billUrl(bill.code, bill.session || meta.session)}
              target="_blank"
              rel="noreferrer"
              aria-label={t("topic.viewBill", { bill: bill.code })}
            >
              <span className="bill-number">{bill.code}</span>
              <span className="topic-bill-main">
                <span className="topic-bill-synopsis">{bill.synopsis}</span>
                <span className="topic-bill-sponsors">
                  {bill.sponsors.slice(0, 4).map((sponsor) => (
                    <PartyFlag
                      key={`${bill.code}-${sponsor.legislator.id}`}
                      party={sponsor.legislator.party}
                      className="party-flag-xs"
                    />
                  ))}
                  <span>
                    {bill.sponsors
                      .slice(0, 3)
                      .map((sponsor) => sponsor.legislator.fullName)
                      .join(", ")}
                    {bill.sponsors.length > 3 &&
                      ` +${bill.sponsors.length - 3}`}
                  </span>
                  {bill.sponsors.some((sponsor) => sponsor.type === "P") && (
                    <span className="topic-primary-note">
                      {billTypeLabel("P", lang)}
                    </span>
                  )}
                </span>
              </span>
              <span className="topic-bill-count">
                <strong>{bill.sponsors.length}</strong>
                <small>{t("topic.sponsors")}</small>
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="bill-external"
                >
                  <path d="M6 2h8v8h-2V5.4L4.7 12.7l-1.4-1.4L10.6 4H6V2Z" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state-small">
          <p>{t("topic.noBills")}</p>
          <button
            type="button"
            className="link-button"
            onClick={() => changeQuery("")}
          >
            {t("bills.clear")}
          </button>
        </div>
      )}

      {limit < filtered.length && (
        <div className="bill-more">
          <button
            type="button"
            className="button button-outline"
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
          >
            {t("bills.showMore", {
              count: Math.min(PAGE_SIZE, filtered.length - limit),
            })}
          </button>
        </div>
      )}
    </div>
  );
}

function PartySupport({ stat }: { stat: TopicStat }) {
  const { t, formatNumber } = useI18n();
  const total = stat.billCount || 1;

  return (
    <section className="panel topic-aside-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("topic.bipartisan")}</p>
          <h2>{t("topic.partySupport")}</h2>
        </div>
      </div>
      <p className="panel-intro">{t("topic.partySupportSub")}</p>

      <ul className="support-list">
        <li>
          <span className="support-label">
            <i className="legend-dot legend-d" />
            {t("topic.democraticSponsor")}
          </span>
          <span className="support-track">
            <span
              className="support-fill support-d"
              style={{ width: `${(stat.partyBills.D / total) * 100}%` }}
            />
          </span>
          <strong>{formatNumber(stat.partyBills.D)}</strong>
        </li>
        <li>
          <span className="support-label">
            <i className="legend-dot legend-r" />
            {t("topic.republicanSponsor")}
          </span>
          <span className="support-track">
            <span
              className="support-fill support-r"
              style={{ width: `${(stat.partyBills.R / total) * 100}%` }}
            />
          </span>
          <strong>{formatNumber(stat.partyBills.R)}</strong>
        </li>
        <li>
          <span className="support-label">
            <i className="legend-dot legend-bipartisan" />
            {t("topic.bipartisan")}
          </span>
          <span className="support-track">
            <span
              className="support-fill support-bipartisan"
              style={{
                width: `${(stat.bipartisanBills / total) * 100}%`,
              }}
            />
          </span>
          <strong>{formatNumber(stat.bipartisanBills)}</strong>
        </li>
      </ul>
    </section>
  );
}

function ChamberSplit({ stat }: { stat: TopicStat }) {
  const { t, formatNumber } = useI18n();
  const total = stat.billCount || 1;

  return (
    <section className="panel topic-aside-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("common.bothChambers")}</p>
          <h2>{t("topic.chamberSplit")}</h2>
        </div>
      </div>

      <ul className="support-list">
        <li>
          <span className="support-label">{t("common.assembly")}</span>
          <span className="support-track">
            <span
              className="support-fill support-assembly"
              style={{
                width: `${(stat.chamberBills.Assembly / total) * 100}%`,
              }}
            />
          </span>
          <strong>{formatNumber(stat.chamberBills.Assembly)}</strong>
        </li>
        <li>
          <span className="support-label">{t("common.senate")}</span>
          <span className="support-track">
            <span
              className="support-fill support-senate"
              style={{
                width: `${(stat.chamberBills.Senate / total) * 100}%`,
              }}
            />
          </span>
          <strong>{formatNumber(stat.chamberBills.Senate)}</strong>
        </li>
      </ul>
    </section>
  );
}

function CommitteeList({ stat }: { stat: TopicStat }) {
  const { t, lang, formatNumber } = useI18n();

  return (
    <section className="panel topic-aside-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("common.members")}</p>
          <h2>{t("topic.committeesTitle")}</h2>
        </div>
      </div>
      <p className="panel-intro">{t("topic.committeesSub")}</p>

      <ul className="topic-committee-list">
        {stat.committees.slice(0, 6).map((committee) => (
          <li key={committee.name}>
            <Link to={`/?q=${encodeURIComponent(committee.name)}`}>
              <span>{translateCommittee(committee.name, lang)}</span>
              <small>
                {t("topic.committeeMembers", {
                  count: formatNumber(committee.members),
                })}
              </small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OtherTopics({
  analytics,
  current,
}: {
  analytics: Analytics;
  current: string;
}) {
  const { t, lang, formatNumber } = useI18n();
  const topics = analytics.topicStats
    .filter((stat) => stat.topic.slug !== current)
    .slice(0, 7);

  return (
    <section className="panel topic-aside-panel">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("superTools.allTopics")}</p>
          <h2>{t("topic.otherTopics")}</h2>
        </div>
      </div>
      <p className="panel-intro">{t("topic.otherTopicsSub")}</p>

      <ul className="other-topics-list">
        {topics.map((stat) => (
          <li key={stat.topic.slug}>
            <Link to={`/super-tools/topics/${stat.topic.slug}`}>
              <span
                className="topic-index-dot"
                style={{ background: stat.topic.color }}
                aria-hidden="true"
              />
              <span>{stat.topic.label[lang]}</span>
              <strong>{formatNumber(stat.billCount)}</strong>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="aside-link" to="/super-tools">
        {t("topic.backToTools")} →
      </Link>
    </section>
  );
}
