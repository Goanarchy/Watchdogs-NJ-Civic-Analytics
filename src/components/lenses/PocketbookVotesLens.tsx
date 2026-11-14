import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PartyBadge } from "../PartyBadge";
import { Portrait } from "../Portrait";
import type { Analytics, LegislatorMatrixRow } from "../../lib/analytics";
import { downloadCsv } from "../../lib/csv";
import { type CopyKey, useI18n } from "../../lib/i18n";
import { chamberLabel, padDistrict, partyLabel, translateBillAction } from "../../lib/labels";
import {
  POCKETBOOK_DOMAINS,
  classifyPocketbookDomains,
  type PocketbookDomainKey,
} from "../../lib/pocketbook";
import type { VoteChoice } from "../../types";

const DOMAIN_LABEL_KEYS: Record<PocketbookDomainKey, CopyKey> = {
  property_tax: "superTools.pocketbook.property_tax",
  housing: "superTools.pocketbook.housing",
  transit: "superTools.pocketbook.transit",
};

const VOTE_CHOICE_KEYS: Record<VoteChoice, CopyKey> = {
  Y: "superTools.pocketbookChoice.Y",
  N: "superTools.pocketbookChoice.N",
  A: "superTools.pocketbookChoice.A",
  NV: "superTools.pocketbookChoice.NV",
};

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
    <th
      className={align === "right" ? "text-right" : undefined}
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
    >
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

export function PocketbookVotesLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber, formatDate } = useI18n();

  const [activeDomain, setActiveDomain] = useState<PocketbookDomainKey>("property_tax");
  const [chamberFilter, setChamberFilter] = useState<"all" | "Senate" | "Assembly">("all");
  const [partyFilter, setPartyFilter] = useState<"all" | "D" | "R">("all");
  const [query, setQuery] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);
  const [sortBy, setSortBy] = useState<
    "score" | "overall" | "name" | "district" | "primary" | "enacted" | "votes"
  >("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Roll Calls Explorer state
  const [rollCallSearch, setRollCallSearch] = useState("");
  const [rollCallChamberFilter, setRollCallChamberFilter] = useState<
    "all" | "Senate" | "Assembly"
  >("all");
  const [expandedRollCallId, setExpandedRollCallId] = useState<string | null>(null);
  const [rollCallChoiceFilter, setRollCallChoiceFilter] = useState<"all" | VoteChoice>("all");

  const legislatorLookup = useMemo(() => {
    const map = new Map<number, LegislatorMatrixRow["legislator"]>();
    for (const row of analytics.legislatorMatrix) {
      map.set(row.legislator.id, row.legislator);
    }
    return map;
  }, [analytics.legislatorMatrix]);

  const filteredRows = useMemo(() => {
    return analytics.legislatorMatrix.filter((row) => {
      if (chamberFilter !== "all" && row.legislator.chamber !== chamberFilter) {
        return false;
      }
      if (partyFilter !== "all" && row.legislator.party !== partyFilter) {
        return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const matchName = row.legislator.fullName.toLowerCase().includes(q);
        const matchDist = `d${padDistrict(row.legislator.district)}`.includes(q) ||
          String(row.legislator.district) === q;
        if (!matchName && !matchDist) return false;
      }
      return true;
    });
  }, [analytics.legislatorMatrix, chamberFilter, partyFilter, query]);

  const sortedRows = useMemo(() => {
    return filteredRows.slice().sort((a, b) => {
      const aDomain = a.pocketbookSummary.domains[activeDomain];
      const bDomain = b.pocketbookSummary.domains[activeDomain];
      let cmp = 0;

      switch (sortBy) {
        case "score":
          cmp =
            aDomain.score - bDomain.score ||
            aDomain.primaryBills - bDomain.primaryBills ||
            aDomain.enactedBills - bDomain.enactedBills;
          break;
        case "overall":
          cmp = a.pocketbookSummary.overallScore - b.pocketbookSummary.overallScore;
          break;
        case "name":
          cmp = a.legislator.sortName.localeCompare(b.legislator.sortName, "en");
          break;
        case "district":
          cmp = a.legislator.district - b.legislator.district;
          break;
        case "primary":
          cmp = aDomain.primaryBills - bDomain.primaryBills;
          break;
        case "enacted":
          cmp = aDomain.enactedBills - bDomain.enactedBills;
          break;
        case "votes":
          cmp = aDomain.floorVotesCast - bDomain.floorVotesCast;
          break;
      }

      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredRows, activeDomain, sortBy, sortDir]);

  const visibleRows = showAllRows ? sortedRows : sortedRows.slice(0, 25);

  const handleSort = (
    key: "score" | "overall" | "name" | "district" | "primary" | "enacted" | "votes",
  ) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const domainRollCalls = useMemo(() => {
    return analytics.votesData.rollCalls
      .filter((rc) => {
        const matched = classifyPocketbookDomains(
          (rc.abstract ?? "") + " " + (rc.action ?? ""),
        );
        if (!matched.includes(activeDomain)) return false;

        if (
          rollCallChamberFilter !== "all" &&
          rc.chamber !== rollCallChamberFilter
        ) {
          return false;
        }

        if (rollCallSearch.trim()) {
          const q = rollCallSearch.toLowerCase().trim();
          const matchBill = rc.bill.toLowerCase().includes(q);
          const matchAbstract = rc.abstract.toLowerCase().includes(q);
          if (!matchBill && !matchAbstract) return false;
        }

        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [
    analytics.votesData.rollCalls,
    activeDomain,
    rollCallChamberFilter,
    rollCallSearch,
  ]);

  const expandedRollCall = useMemo(() => {
    if (!expandedRollCallId) return null;
    return (
      analytics.votesData.rollCalls.find((rc) => rc.id === expandedRollCallId) ??
      null
    );
  }, [analytics.votesData.rollCalls, expandedRollCallId]);

  const rollCallMembers = useMemo(() => {
    if (!expandedRollCall) return [];
    const entries = Object.entries(expandedRollCall.votesByLegislatorId ?? {});
    return entries
      .map(([idStr, choice]) => {
        const id = Number(idStr);
        const leg = legislatorLookup.get(id);
        return {
          id,
          choice: choice as VoteChoice,
          name: leg?.fullName ?? `Legislator #${id}`,
          party: leg?.party ?? "",
          chamber: leg?.chamber ?? expandedRollCall.chamber,
          district: leg?.district ?? 0,
          photo: leg?.photo ?? null,
        };
      })
      .filter((m) => {
        if (
          rollCallChoiceFilter !== "all" &&
          m.choice !== rollCallChoiceFilter
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [expandedRollCall, legislatorLookup, rollCallChoiceFilter]);

  const handleExportCsv = () => {
    const headers = [
      "Legislator ID",
      "Full Name",
      "Party",
      "Chamber",
      "District",
      "Domain",
      "Domain Score (0-100)",
      "Overall Pocketbook Score",
      "Primary Bills",
      "Advanced Bills",
      "Enacted Bills",
      "Floor Votes Cast",
      "Yea Votes",
      "Nay Votes",
    ];

    const rows = sortedRows.map((r) => {
      const dScore = r.pocketbookSummary.domains[activeDomain];
      return [
        r.legislator.id,
        r.legislator.fullName,
        r.legislator.party,
        r.legislator.chamber,
        r.legislator.district,
        activeDomain,
        dScore.score,
        r.pocketbookSummary.overallScore,
        dScore.primaryBills,
        dScore.advancedBills,
        dScore.enactedBills,
        dScore.floorVotesCast,
        dScore.yeaVotes,
        dScore.nayVotes,
      ];
    });

    downloadCsv(`watchdogs-pocketbook-${activeDomain}.csv`, headers, rows);
  };

  const senateChamberAvg =
    analytics.pocketbook.chamberAverages.Senate[activeDomain] ?? 0;
  const assemblyChamberAvg =
    analytics.pocketbook.chamberAverages.Assembly[activeDomain] ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Lens Header */}
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.pocketbookKicker")}</p>
            <h2>{t("superTools.pocketbookTitle")}</h2>
          </div>
          <span className="chip">
            {t("superTools.pocketbookMethodologyNote")}
          </span>
        </div>
        <p className="panel-intro">{t("superTools.pocketbookIntro")}</p>

        {/* 3 Objective Pocketbook Domain Cards */}
        <div className="st-pocket-grid mt-4">
          {POCKETBOOK_DOMAINS.map((domain) => {
            const isSelected = activeDomain === domain;
            const rollCallsCount =
              analytics.pocketbook.domainRollCallCounts[domain] ?? 0;
            const senAvg =
              analytics.pocketbook.chamberAverages.Senate[domain] ?? 0;
            const asmAvg =
              analytics.pocketbook.chamberAverages.Assembly[domain] ?? 0;

            return (
              <button
                key={domain}
                type="button"
                className={`st-pocket-card text-left cursor-pointer${isSelected ? " is-active" : ""}`}
                aria-pressed={isSelected}
                onClick={() => setActiveDomain(domain)}
              >
                <div className="st-pocket-card-head">
                  <h3 className="font-bold text-base m-0">
                    {t(DOMAIN_LABEL_KEYS[domain])}
                  </h3>
                  <span className="chip num text-xs">
                    {t("superTools.pocketbookVotesRecorded", {
                      count: rollCallsCount,
                    })}
                  </span>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">
                      {chamberLabel("Senate", lang)} {t("superTools.pocketbookChamberAvg")}
                    </span>
                    <strong className="num">{senAvg} / 100</strong>
                  </div>
                  <div className="st-bar-track">
                    <div
                      className="st-bar-fill"
                      style={{ width: `${senAvg}%` }}
                    />
                    <div
                      className="st-bar-bench-marker"
                      style={{ left: `${senAvg}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs mt-1">
                    <span className="text-muted">
                      {chamberLabel("Assembly", lang)} {t("superTools.pocketbookChamberAvg")}
                    </span>
                    <strong className="num">{asmAvg} / 100</strong>
                  </div>
                  <div className="st-bar-track">
                    <div
                      className="st-bar-fill"
                      style={{ width: `${asmAvg}%` }}
                    />
                    <div
                      className="st-bar-bench-marker"
                      style={{ left: `${asmAvg}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Leaderboard & Breakdown Table */}
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.pocketbookMethodologyNote")}</p>
            <h2>
              {t(DOMAIN_LABEL_KEYS[activeDomain])} — {t("superTools.pocketbookChamberAvg")}
            </h2>
          </div>
          <button
            type="button"
            className="button button-small button-outline"
            onClick={handleExportCsv}
          >
            ↓ {t("superTools.wbExportCsv")}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="st-filter-bar">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("superTools.wbMatrixSearch")}
            aria-label={t("superTools.wbMatrixSearch")}
            className="st-search-input"
          />

          <div className="st-filter-group">
            <label className="st-filter-label">
              <span>{t("home.chamber")}</span>
              <select
                value={chamberFilter}
                onChange={(e) =>
                  setChamberFilter(e.target.value as "all" | "Senate" | "Assembly")
                }
              >
                <option value="all">{t("common.allChambers")}</option>
                <option value="Senate">{chamberLabel("Senate", lang)}</option>
                <option value="Assembly">{chamberLabel("Assembly", lang)}</option>
              </select>
            </label>

            <label className="st-filter-label">
              <span>{t("home.party")}</span>
              <select
                value={partyFilter}
                onChange={(e) =>
                  setPartyFilter(e.target.value as "all" | "D" | "R")
                }
              >
                <option value="all">{t("common.allParties")}</option>
                <option value="D">{partyLabel("D", lang)}</option>
                <option value="R">{partyLabel("R", lang)}</option>
              </select>
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <SortTh
                  label={t("superTools.wbColLegislator")}
                  active={sortBy === "name"}
                  dir={sortDir}
                  onClick={() => handleSort("name")}
                />
                <SortTh
                  label={t("common.district")}
                  active={sortBy === "district"}
                  dir={sortDir}
                  onClick={() => handleSort("district")}
                />
                <SortTh
                  label={`${t(DOMAIN_LABEL_KEYS[activeDomain])} (0–100)`}
                  active={sortBy === "score"}
                  dir={sortDir}
                  onClick={() => handleSort("score")}
                />
                <SortTh
                  label={t("superTools.pocketbookOverall")}
                  active={sortBy === "overall"}
                  dir={sortDir}
                  align="right"
                  onClick={() => handleSort("overall")}
                />
                <SortTh
                  label={t("superTools.effColAdvance")}
                  active={sortBy === "primary"}
                  dir={sortDir}
                  align="right"
                  onClick={() => handleSort("primary")}
                />
                <SortTh
                  label={t("superTools.effEnactedCol")}
                  active={sortBy === "enacted"}
                  dir={sortDir}
                  align="right"
                  onClick={() => handleSort("enacted")}
                />
                <SortTh
                  label={t("superTools.effAttendanceCol")}
                  active={sortBy === "votes"}
                  dir={sortDir}
                  align="right"
                  onClick={() => handleSort("votes")}
                />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const dScore = row.pocketbookSummary.domains[activeDomain];
                const chamberAvg =
                  row.legislator.chamber === "Senate"
                    ? senateChamberAvg
                    : assemblyChamberAvg;

                return (
                  <tr key={row.legislator.id}>
                    <td>
                      <div className="st-member-cell">
                        <Portrait
                          src={row.legislator.photo}
                          name={row.legislator.fullName}
                          className="st-mini-avatar"
                        />
                        <div>
                          <div className="chip-row">
                            <PartyBadge party={row.legislator.party} />
                            <Link
                              className="st-member-link"
                              to={`/legislador/${row.legislator.id}`}
                            >
                              {row.legislator.fullName}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Link
                        className="chip chip-link"
                        to={`/district/${row.legislator.district}`}
                      >
                        LD {padDistrict(row.legislator.district)}
                      </Link>{" "}
                      <span className="text-muted text-xs">
                        · {chamberLabel(row.legislator.chamber, lang)}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="num font-bold w-7 text-right">
                          {dScore.score}
                        </span>
                        <div className="st-bar-track" style={{ width: 130 }}>
                          <div
                            className="st-bar-fill"
                            style={{ width: `${dScore.score}%` }}
                          />
                          <div
                            className="st-bar-bench-marker"
                            style={{ left: `${chamberAvg}%` }}
                            title={`${t("superTools.pocketbookChamberAvg")}: ${chamberAvg}`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="num text-right font-semibold">
                      {row.pocketbookSummary.overallScore}
                    </td>
                    <td className="text-right">
                      <span className="st-cell-sub">
                        {t("superTools.pocketbookBillsVotesMeta", {
                          bills: formatNumber(dScore.primaryBills),
                          votes: formatNumber(dScore.floorVotesCast),
                        })}
                      </span>
                    </td>
                    <td className="num text-right font-semibold">
                      {dScore.enactedBills}
                    </td>
                    <td className="num text-right text-xs">
                      <span className="text-emerald-600 font-bold">
                        {dScore.yeaVotes} {t("superTools.pocketbookChoice.Y")}
                      </span>
                      {" · "}
                      <span className="text-rose-600 font-bold">
                        {dScore.nayVotes} {t("superTools.pocketbookChoice.N")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Toggle Show All / Top 25 */}
        {sortedRows.length > 25 && (
          <div className="flex justify-center mt-4">
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => setShowAllRows((prev) => !prev)}
            >
              {showAllRows
                ? t("superTools.influenceShowTop25")
                : t("superTools.wbShowAllRows", { count: sortedRows.length })}
            </button>
          </div>
        )}
      </section>

      {/* Official NJLeg Floor Roll Calls Explorer */}
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.pocketbookKicker")}</p>
            <h2>{t("superTools.pocketbookRecentVotes")}</h2>
          </div>
          <span className="chip num">
            {t("superTools.pocketbookVotesRecorded", {
              count: domainRollCalls.length,
            })}
          </span>
        </div>

        <div className="st-filter-bar mb-4">
          <input
            type="search"
            value={rollCallSearch}
            onChange={(e) => setRollCallSearch(e.target.value)}
            placeholder={`${t("superTools.wbMatrixSearch")} (e.g. S3000, A4000)…`}
            className="st-search-input"
          />

          <div className="st-filter-group">
            <label className="st-filter-label">
              <span>{t("home.chamber")}</span>
              <select
                value={rollCallChamberFilter}
                onChange={(e) =>
                  setRollCallChamberFilter(
                    e.target.value as "all" | "Senate" | "Assembly",
                  )
                }
              >
                <option value="all">{t("common.allChambers")}</option>
                <option value="Senate">{chamberLabel("Senate", lang)}</option>
                <option value="Assembly">{chamberLabel("Assembly", lang)}</option>
              </select>
            </label>
          </div>
        </div>

        {/* Roll Calls List */}
        <div className="st-vote-list">
          {domainRollCalls.length === 0 ? (
            <p className="text-muted p-4 text-center">
              {t("profile.v3NoRollCalls")}
            </p>
          ) : (
            domainRollCalls.slice(0, 30).map((rc) => {
              const isPassed = rc.yeas > rc.nays;
              const isExpanded = expandedRollCallId === rc.id;

              return (
                <div key={rc.id} className="st-vote-row flex-col items-stretch gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-base font-bold">{rc.bill}</strong>
                      <span className="chip text-xs">
                        {chamberLabel(rc.chamber, lang)}
                      </span>
                      <span className="text-xs text-muted">
                        {formatDate(rc.date)}
                      </span>
                      <span
                        className={`st-outcome-badge ${isPassed ? "is-passed" : "is-failed"}`}
                        data-outcome={isPassed ? "passed" : "rejected"}
                      >
                        {isPassed
                          ? t("superTools.pocketbookOutcomePassed")
                          : t("superTools.pocketbookOutcomeRejected")}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold">
                        <span className="text-emerald-600 font-bold">
                          {rc.yeas} {t("superTools.pocketbookChoice.Y")}
                        </span>
                        {" · "}
                        <span className="text-rose-600 font-bold">
                          {rc.nays} {t("superTools.pocketbookChoice.N")}
                        </span>
                        {" · "}
                        <span className="text-amber-600 font-bold">
                          {rc.abstains} {t("superTools.pocketbookChoice.A")}
                        </span>
                      </span>

                      <button
                        type="button"
                        className="button button-small button-outline"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedRollCallId((prev) =>
                            prev === rc.id ? null : rc.id,
                          )
                        }
                      >
                        {isExpanded ? "▲" : "▼"}{" "}
                        {isExpanded
                          ? t("superTools.pocketbookHideRollCall")
                          : t("superTools.pocketbookViewRollCall")}
                      </button>
                    </div>
                  </div>

                  <p className="text-sm m-0 text-muted">
                    <strong className="text-ink">
                      {translateBillAction(rc.action, lang)}:
                    </strong>{" "}
                    {rc.abstract}
                  </p>

                  {/* Expanded Member Roll-Call Matrix */}
                  {isExpanded && (
                    <div className="panel p-3 mt-2 border-t border-line">
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <span className="text-xs font-semibold">
                          {t("superTools.pocketbookMemberVotes")}:
                        </span>
                        <div className="flex gap-1">
                          {(["all", "Y", "N", "A", "NV"] as const).map(
                            (choice) => (
                              <button
                                key={choice}
                                type="button"
                                className={`st-preset-btn text-xs py-1 px-2 min-h-0${rollCallChoiceFilter === choice ? " is-active" : ""}`}
                                aria-pressed={rollCallChoiceFilter === choice}
                                onClick={() => setRollCallChoiceFilter(choice)}
                              >
                                {choice === "all"
                                  ? t("common.all")
                                  : t(VOTE_CHOICE_KEYS[choice])}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1">
                        {rollCallMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-2 rounded border border-line bg-card gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Portrait
                                src={m.photo}
                                name={m.name}
                                className="st-mini-avatar"
                              />
                              <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                                <Link
                                  to={`/legislador/${m.id}`}
                                  className="text-xs font-semibold hover:underline block truncate"
                                >
                                  {m.name}
                                </Link>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <PartyBadge party={m.party} />
                                  <span className="text-muted text-xs">
                                    {t("superTools.ldShort")} {padDistrict(m.district)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span
                              className={`st-vote-badge is-${m.choice.toLowerCase()}`}
                              data-choice={m.choice}
                            >
                              {t(VOTE_CHOICE_KEYS[m.choice])}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
