import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PartyBadge } from "../PartyBadge";
import { Portrait } from "../Portrait";
import type { Analytics, LegislatorMatrixRow } from "../../lib/analytics";
import { downloadCsv } from "../../lib/csv";
import { type CopyKey, useI18n } from "../../lib/i18n";
import { chamberLabel, padDistrict, translateCommittee } from "../../lib/labels";
import type { BillStage, EffectivenessArchetype } from "../../types";

const STAGE_LABEL_KEYS: Record<BillStage, CopyKey> = {
  introduced: "superTools.effStage.introduced",
  committee: "superTools.effStage.committee",
  reported: "superTools.effStage.reported",
  floor: "superTools.effStage.floor",
  enacted: "superTools.effStage.enacted",
};

const ARCHETYPE_LABEL_KEYS: Record<EffectivenessArchetype, CopyKey> = {
  high_throughput: "superTools.effArchetype.high_throughput",
  policy_specialist: "superTools.effArchetype.policy_specialist",
  coalition_builder: "superTools.effArchetype.coalition_builder",
  developing: "superTools.effArchetype.developing",
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

export function EffectivenessFunnelLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();

  const [funnelChamber, setFunnelChamber] = useState<"all" | "Senate" | "Assembly">("all");
  const [selectedCommittee, setSelectedCommittee] = useState<string | null>(null);
  const [archetypeFilter, setArchetypeFilter] = useState<"all" | EffectivenessArchetype>("all");
  const [chamberFilter, setChamberFilter] = useState<"all" | "Senate" | "Assembly">("all");
  const [query, setQuery] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);
  const [sortBy, setSortBy] = useState<
    "les" | "name" | "district" | "primary" | "enacted" | "advancement" | "attendance"
  >("les");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const activeFunnel = useMemo(() => {
    if (funnelChamber === "Senate") {
      return analytics.effectiveness.funnelByChamber.Senate;
    }
    if (funnelChamber === "Assembly") {
      return analytics.effectiveness.funnelByChamber.Assembly;
    }
    return analytics.effectiveness.funnel;
  }, [analytics.effectiveness, funnelChamber]);

  const senateAvgLes = analytics.effectiveness.chamberAverages.Senate.avgLes;
  const assemblyAvgLes = analytics.effectiveness.chamberAverages.Assembly.avgLes;
  const senateAttendance = analytics.effectiveness.chamberAverages.Senate.avgAttendancePct;
  const assemblyAttendance = analytics.effectiveness.chamberAverages.Assembly.avgAttendancePct;
  const enactedTotal =
    analytics.effectiveness.funnel.find((s) => s.stage === "enacted")?.reachedCount ?? 0;

  const topBottlenecks = useMemo(() => {
    return analytics.effectiveness.committeeBottlenecks.slice(0, 8);
  }, [analytics.effectiveness.committeeBottlenecks]);

  const filteredRows = useMemo(() => {
    return analytics.effectiveness.topEffective.filter((row: LegislatorMatrixRow) => {
      if (chamberFilter !== "all" && row.legislator.chamber !== chamberFilter) {
        return false;
      }

      if (archetypeFilter !== "all" && row.effectivenessSummary.archetype !== archetypeFilter) {
        return false;
      }

      if (selectedCommittee) {
        const sitsOnCommittee = row.legislator.committees.some(
          (c) => c.code === selectedCommittee,
        );
        if (!sitsOnCommittee) {
          return false;
        }
      }

      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const nameMatch = row.legislator.fullName.toLowerCase().includes(q);
        const distMatch = `d${padDistrict(row.legislator.district)}`.includes(q) ||
          String(row.legislator.district) === q;
        const committeeMatch = row.legislator.committees.some(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            translateCommittee(c.name, lang).toLowerCase().includes(q),
        );
        if (!nameMatch && !distMatch && !committeeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    analytics.effectiveness.topEffective,
    chamberFilter,
    archetypeFilter,
    selectedCommittee,
    query,
    lang,
  ]);

  const sortedRows = useMemo(() => {
    return filteredRows.slice().sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "les":
          cmp =
            a.effectivenessSummary.lesScore - b.effectivenessSummary.lesScore ||
            a.effectivenessSummary.rawPoints - b.effectivenessSummary.rawPoints;
          break;
        case "name":
          cmp = a.legislator.sortName.localeCompare(b.legislator.sortName, "en");
          break;
        case "district":
          cmp = a.legislator.district - b.legislator.district;
          break;
        case "primary":
          cmp =
            a.effectivenessSummary.primarySubstantive -
            b.effectivenessSummary.primarySubstantive;
          break;
        case "enacted":
          cmp =
            a.effectivenessSummary.primaryEnacted -
            b.effectivenessSummary.primaryEnacted;
          break;
        case "advancement":
          cmp =
            a.effectivenessSummary.advancementRatePct -
            b.effectivenessSummary.advancementRatePct;
          break;
        case "attendance":
          cmp = a.voteStats.attendancePct - b.voteStats.attendancePct;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredRows, sortBy, sortDir]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir(col === "name" || col === "district" ? "asc" : "desc");
    }
  }

  function handleExportCsv() {
    downloadCsv(
      "Legislative_Effectiveness_LES_Ranking.csv",
      [
        "Rank",
        "LegislatorID",
        "FullName",
        "Party",
        "Chamber",
        "District",
        "LES_Score",
        "Archetype",
        "PrimarySubstantiveBills",
        "PrimaryEnactedLaws",
        "AdvancementRatePct",
        "FloorAttendancePct",
        "PartyUnityPct",
        "RawPoints",
      ],
      sortedRows.map((r, idx) => [
        idx + 1,
        r.legislator.id,
        r.legislator.fullName,
        r.legislator.party,
        r.legislator.chamber,
        r.legislator.district,
        r.effectivenessSummary.lesScore,
        r.effectivenessSummary.archetype,
        r.effectivenessSummary.primarySubstantive,
        r.effectivenessSummary.primaryEnacted,
        r.effectivenessSummary.advancementRatePct,
        r.voteStats.attendancePct,
        r.voteStats.partyUnityPct,
        r.effectivenessSummary.rawPoints,
      ]),
    );
  }

  const visibleRows = showAllRows ? sortedRows : sortedRows.slice(0, 30);

  return (
    <div className="st-lens-stack">
      {/* 1. Header & Context Intro */}
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.effKicker")}</p>
            <h2>{t("superTools.effTitle")}</h2>
          </div>
          <span className="badge badge-navy num">
            {t("superTools.effSubstantiveBillsBadge", {
              count: formatNumber(analytics.effectiveness.substantiveBillCount),
            })}
          </span>
        </div>
        <p className="panel-intro">
          {t("superTools.effIntro", {
            count: formatNumber(analytics.effectiveness.substantiveBillCount),
          })}
        </p>
      </section>

      {/* 2. Chamber Benchmark Summary Ribbon */}
      <div className="st-summary-grid">
        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("common.senate")}</p>
              <h3>{chamberLabel("Senate", lang)}</h3>
            </div>
            <span className="badge badge-navy num">{senateAvgLes} / 100</span>
          </div>
          <div className="st-stat-pair" style={{ marginTop: 10 }}>
            <div>
              <span className="st-stat-mini-label">{t("superTools.effAttendanceCol")}</span>
              <strong className="num">{senateAttendance}%</strong>
            </div>
            <div>
              <span className="st-stat-mini-label">{t("superTools.effColAdvance")}</span>
              <strong className="num">
                {analytics.effectiveness.chamberAverages.Senate.avgAdvancementRatePct}%
              </strong>
            </div>
          </div>
        </article>

        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("common.assembly")}</p>
              <h3>{chamberLabel("Assembly", lang)}</h3>
            </div>
            <span className="badge badge-navy num">{assemblyAvgLes} / 100</span>
          </div>
          <div className="st-stat-pair" style={{ marginTop: 10 }}>
            <div>
              <span className="st-stat-mini-label">{t("superTools.effAttendanceCol")}</span>
              <strong className="num">{assemblyAttendance}%</strong>
            </div>
            <div>
              <span className="st-stat-mini-label">{t("superTools.effColAdvance")}</span>
              <strong className="num">
                {analytics.effectiveness.chamberAverages.Assembly.avgAdvancementRatePct}%
              </strong>
            </div>
          </div>
        </article>

        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.effSignedLawsTitle")}</p>
              <h3>{t("superTools.effStage.enacted")}</h3>
            </div>
            <span className="badge badge-navy num">{formatNumber(enactedTotal)}</span>
          </div>
          <p className="panel-intro" style={{ marginTop: 8 }}>
            {t("superTools.effSignedLawsDesc")}
          </p>
        </article>
      </div>

      {/* 3. 2-Column Split: 5-Stage Funnel vs Top Committee Bottlenecks */}
      <div className="st-v3-split">
        {/* Card A: 5-Stage Legislative Pipeline Funnel */}
        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.effKicker")}</p>
              <h2>{t("superTools.effTitle")}</h2>
            </div>
          </div>

          {/* Chamber Toggle Tabs */}
          <div
            className="st-toolbar"
            style={{ margin: "10px 0 16px" }}
            role="toolbar"
            aria-label={t("superTools.effChamberToggle")}
          >
            <button
              type="button"
              className={`button button-small ${funnelChamber === "all" ? "button-primary" : "button-outline"}`}
              onClick={() => setFunnelChamber("all")}
              aria-pressed={funnelChamber === "all"}
            >
              {t("superTools.effAllChambers")}
            </button>
            <button
              type="button"
              className={`button button-small ${funnelChamber === "Senate" ? "button-primary" : "button-outline"}`}
              onClick={() => setFunnelChamber("Senate")}
              aria-pressed={funnelChamber === "Senate"}
            >
              {t("superTools.effSenateOnly")}
            </button>
            <button
              type="button"
              className={`button button-small ${funnelChamber === "Assembly" ? "button-primary" : "button-outline"}`}
              onClick={() => setFunnelChamber("Assembly")}
              aria-pressed={funnelChamber === "Assembly"}
            >
              {t("superTools.effAssemblyOnly")}
            </button>
          </div>

          {/* Funnel Stack */}
          <div className="st-funnel-stack">
            {activeFunnel.map((step) => {
              return (
                <div key={step.stage} className="st-funnel-step">
                  <div className="st-funnel-step-head">
                    <span>{t(STAGE_LABEL_KEYS[step.stage])}</span>
                    <span className="num">
                      {t("superTools.effReachedLabel", {
                        count: formatNumber(step.reachedCount),
                        pct: step.reachedPct,
                      })}
                    </span>
                  </div>
                  <div className="st-funnel-bar-bg" aria-hidden="true">
                    <div
                      className="st-funnel-bar"
                      style={{ width: `${Math.max(2, step.reachedPct)}%` }}
                    />
                  </div>
                  <div className="st-funnel-step-meta">
                    {t("superTools.effTerminalLabel", {
                      count: formatNumber(step.currentCount),
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        {/* Card B: Top Standing Committee Bottlenecks */}
        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.effBottleneckKicker")}</p>
              <h2>{t("superTools.effBottleneckTitle")}</h2>
            </div>
            {selectedCommittee && (
              <button
                type="button"
                className="button button-small button-outline"
                onClick={() => setSelectedCommittee(null)}
              >
                ✕ {selectedCommittee}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, width: "100%" }}>
            {topBottlenecks.map((c) => {
              const isActive = selectedCommittee === c.committeeCode;

              return (
                <button
                  key={c.committeeCode}
                  type="button"
                  className={`st-bottleneck-card${isActive ? " is-active" : ""}`}
                  onClick={() =>
                    setSelectedCommittee(isActive ? null : c.committeeCode)
                  }
                  aria-pressed={isActive}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <span className="badge badge-navy num" style={{ fontSize: 11.5 }}>
                      {c.committeeCode} · {chamberLabel(c.chamber, lang)}
                    </span>
                    <span
                      className="num"
                      style={{
                        fontWeight: 700,
                        fontSize: 12.5,
                        color: c.advancementRatePct < 15 ? "#f59e0b" : "var(--navy-ink)",
                      }}
                    >
                      {t("superTools.effAdvanceRate", { pct: c.advancementRatePct })}
                    </span>
                  </div>

                  <strong style={{ fontSize: 13.5, lineHeight: 1.3 }}>
                    {translateCommittee(c.committeeName, lang)}
                  </strong>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                      color: "var(--muted)",
                      width: "100%",
                    }}
                  >
                    <span>
                      {t("superTools.effHeldLabel")}:{" "}
                      <strong className="num" style={{ color: "var(--ink)" }}>
                        {formatNumber(c.heldInCommitteeCount)}
                      </strong>
                    </span>
                    <span>
                      {t("superTools.effAdvancedLabel")}:{" "}
                      <strong className="num" style={{ color: "var(--ink)" }}>
                        {formatNumber(c.advancedCount)}
                      </strong>
                    </span>
                  </div>

                  <div className="st-bar-track" style={{ height: 6 }}>
                    <div
                      className="st-bar-fill"
                      style={{
                        width: `${c.advancementRatePct}%`,
                        background: c.advancementRatePct < 15 ? "#f59e0b" : "#0d9488",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      {/* 4. Chamber-Normalized Legislative Effectiveness Leaderboard */}
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.effLeaderboardKicker")}</p>
            <h2>{t("superTools.effLeaderboardTitle")}</h2>
          </div>
          <div className="st-head-actions">
            <span className="panel-source num">
              {t("superTools.wbShowingCount", {
                shown: formatNumber(sortedRows.length),
                total: formatNumber(analytics.effectiveness.topEffective.length),
              })}
            </span>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={handleExportCsv}
            >
              {t("superTools.wbExportCsv")}
            </button>
          </div>
        </div>

        <p className="panel-intro" style={{ marginBottom: 12 }}>
          {t("superTools.effChamberBenchmark", {
            senate: senateAvgLes,
            assembly: assemblyAvgLes,
          })}
        </p>

        {/* Selected Committee Filter Chip */}
        {selectedCommittee && (
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              className="button button-small button-outline"
              onClick={() => setSelectedCommittee(null)}
            >
              {t("superTools.effClearCommittee", { code: selectedCommittee })} ✕
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="st-toolbar">
          <input
            type="search"
            className="st-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("superTools.wbMatrixSearch")}
            aria-label={t("superTools.wbMatrixSearch")}
          />

          <select
            value={chamberFilter}
            onChange={(e) =>
              setChamberFilter(e.target.value as "all" | "Senate" | "Assembly")
            }
            aria-label={t("common.allChambers")}
          >
            <option value="all">{t("common.allChambers")}</option>
            <option value="Senate">{t("common.senate")}</option>
            <option value="Assembly">{t("common.assembly")}</option>
          </select>

          <select
            value={archetypeFilter}
            onChange={(e) =>
              setArchetypeFilter(e.target.value as "all" | EffectivenessArchetype)
            }
            aria-label={t("superTools.effArchetypeFilter")}
          >
            <option value="all">{t("superTools.effAllArchetypes")}</option>
            <option value="high_throughput">
              {t(ARCHETYPE_LABEL_KEYS.high_throughput)}
            </option>
            <option value="policy_specialist">
              {t(ARCHETYPE_LABEL_KEYS.policy_specialist)}
            </option>
            <option value="coalition_builder">
              {t(ARCHETYPE_LABEL_KEYS.coalition_builder)}
            </option>
            <option value="developing">
              {t(ARCHETYPE_LABEL_KEYS.developing)}
            </option>
          </select>
        </div>

        {/* Table */}
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>#</th>
                <SortTh
                  label={t("superTools.wbColLegislator")}
                  active={sortBy === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
                <SortTh
                  label={t("home.district")}
                  active={sortBy === "district"}
                  dir={sortDir}
                  onClick={() => toggleSort("district")}
                />
                <SortTh
                  label={t("superTools.effLesCol")}
                  active={sortBy === "les"}
                  dir={sortDir}
                  onClick={() => toggleSort("les")}
                />
                <th>{t("superTools.effProfileCol")}</th>
                <SortTh
                  label={t("superTools.effEnactedCol")}
                  active={sortBy === "enacted"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("enacted")}
                />
                <SortTh
                  label={t("superTools.effColAdvance")}
                  active={sortBy === "advancement"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("advancement")}
                />
                <SortTh
                  label={t("superTools.effAttendanceCol")}
                  active={sortBy === "attendance"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("attendance")}
                />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => {
                const chamberAvg =
                  row.legislator.chamber === "Senate" ? senateAvgLes : assemblyAvgLes;

                return (
                  <tr key={row.legislator.id}>
                    <td className="num" style={{ color: "var(--muted)", width: 40 }}>
                      #{idx + 1}
                    </td>

                    <td>
                      <div className="st-person-cell">
                        <Portrait
                          src={row.legislator.photo}
                          name={row.legislator.fullName}
                          className="st-mini-avatar"
                        />
                        <div>
                          <Link
                            className="st-person-link"
                            to={`/legislador/${row.legislator.id}`}
                          >
                            {row.legislator.fullName}
                          </Link>
                          <div className="st-person-sub">
                            <PartyBadge party={row.legislator.party} />
                            <span>{chamberLabel(row.legislator.chamber, lang)}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="num" data-label={t("home.district")}>
                      <Link
                        className="st-dist-pill"
                        to={`/district/${row.legislator.district}`}
                      >
                        D{padDistrict(row.legislator.district)}
                      </Link>
                    </td>

                    <td data-label={t("superTools.effLesCol")}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 100 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <strong className="num" style={{ fontSize: 16 }}>
                            {row.effectivenessSummary.lesScore}
                          </strong>
                          <span className="num" style={{ fontSize: 11, color: "var(--muted)" }}>
                            {t("superTools.effAvgAbbr", { score: chamberAvg })}
                          </span>
                        </div>
                        <div
                          className="st-bar-track"
                          style={{ height: 8 }}
                          title={t("superTools.effChamberAvgTitle", {
                            score: chamberAvg,
                          })}
                        >
                          <div
                            className="st-bar-fill"
                            style={{
                              width: `${row.effectivenessSummary.lesScore}%`,
                            }}
                          />
                          <div
                            className="st-bar-bench-marker"
                            style={{ left: `${chamberAvg}%` }}
                            title={t("superTools.effChamberAvgTitle", {
                              score: chamberAvg,
                            })}
                          />
                        </div>
                      </div>
                    </td>

                    <td data-label={t("superTools.effProfileCol")}>
                      <span
                        className="st-archetype-pill"
                        data-archetype={row.effectivenessSummary.archetype}
                      >
                        {t(ARCHETYPE_LABEL_KEYS[row.effectivenessSummary.archetype])}
                      </span>
                    </td>

                    <td className="num text-right" data-label={t("superTools.effEnactedCol")}>
                      <span>{row.effectivenessSummary.primarySubstantive}</span>
                      {" · "}
                      <strong
                        style={{
                          color:
                            row.effectivenessSummary.primaryEnacted > 0
                              ? "var(--green, #10b981)"
                              : "inherit",
                        }}
                      >
                        {row.effectivenessSummary.primaryEnacted}
                      </strong>
                    </td>

                    <td className="num text-right" data-label={t("superTools.effColAdvance")}>
                      <strong>{row.effectivenessSummary.advancementRatePct}%</strong>
                    </td>

                    <td className="num text-right" data-label={t("superTools.effAttendanceCol")}>
                      <span>{row.voteStats.attendancePct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expand / Collapse toggle */}
        {sortedRows.length > 30 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => setShowAllRows((v) => !v)}
            >
              {showAllRows
                ? t("superTools.wbShowTop30")
                : t("superTools.wbShowAllRows", {
                    count: formatNumber(sortedRows.length),
                  })}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
