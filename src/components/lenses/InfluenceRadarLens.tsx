import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PartyBadge } from "../PartyBadge";
import { Portrait } from "../Portrait";
import type { Analytics, LegislatorMatrixRow } from "../../lib/analytics";
import { downloadCsv } from "../../lib/csv";
import { type CopyKey, type Lang, useI18n } from "../../lib/i18n";
import { chamberLabel, padDistrict, translateCommittee } from "../../lib/labels";
import {
  SECTOR_BY_KEY,
  SECTOR_DEFINITIONS,
  type CommitteeAlignment,
  type DonorSectorKey,
} from "../../lib/sectors";

const SECTOR_LABEL_KEYS: Record<DonorSectorKey, CopyKey> = {
  real_estate: "superTools.sector.real_estate",
  healthcare_pharma: "superTools.sector.healthcare_pharma",
  energy_utilities: "superTools.sector.energy_utilities",
  finance_insurance: "superTools.sector.finance_insurance",
  labor_unions: "superTools.sector.labor_unions",
  law_lobbying: "superTools.sector.law_lobbying",
  tech_telecom: "superTools.sector.tech_telecom",
  civic_grassroots: "superTools.sector.civic_grassroots",
};

function money(value: number, lang: Lang, decimals = 0): string {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function compactMoney(value: number, lang: Lang): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${lang === "es" ? "US$" : "$"}${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${lang === "es" ? "US$" : "$"}${(value / 1_000).toFixed(1)}K`;
  }
  return money(value, lang);
}

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

const DONUT_RADIUS = 70;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export function InfluenceRadarLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();

  const [selectedSector, setSelectedSector] = useState<DonorSectorKey | "all">("all");
  const [hoveredSector, setHoveredSector] = useState<DonorSectorKey | null>(null);
  const [chamberFilter, setChamberFilter] = useState<"all" | "Senate" | "Assembly">("all");
  const [query, setQuery] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "district" | "overlapAmount" | "topSector" | "grassroots" | "totalRaised">("overlapAmount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const totalSectorDollars = useMemo(() => {
    return analytics.influence.statewideSectors.reduce((sum, s) => sum + s.amount, 0);
  }, [analytics.influence.statewideSectors]);

  const activeSectorKey = hoveredSector ?? (selectedSector !== "all" ? selectedSector : null);
  const activeSectorData = activeSectorKey
    ? analytics.influence.statewideSectors.find((s) => s.sector === activeSectorKey) ?? null
    : null;

  const donutSegments = useMemo(() => {
    let accumulatedOffset = 0;
    return analytics.influence.statewideSectors.map((sector) => {
      const fraction = totalSectorDollars > 0 ? sector.amount / totalSectorDollars : 0;
      const strokeDash = fraction * DONUT_CIRCUMFERENCE;
      const strokeGap = Math.max(0, DONUT_CIRCUMFERENCE - strokeDash);
      const offset = accumulatedOffset;
      accumulatedOffset += strokeDash;
      const def = SECTOR_BY_KEY.get(sector.sector);
      const color = def?.color ?? "#94a3b8";

      return {
        sector: sector.sector,
        amount: sector.amount,
        pct: sector.pct,
        color,
        strokeDash,
        strokeGap,
        offset,
      };
    });
  }, [analytics.influence.statewideSectors, totalSectorDollars]);

  const grassrootsPct = analytics.influence.avgGrassrootsPct;
  const institutionalPct = Math.max(0, 100 - grassrootsPct);
  const senateAvgGrassroots = analytics.effectiveness.chamberAverages.Senate.avgGrassrootsPct;
  const assemblyAvgGrassroots = analytics.effectiveness.chamberAverages.Assembly.avgGrassrootsPct;

  const filteredPairs = useMemo(() => {
    return analytics.influence.topAlignedPairs.filter((row: LegislatorMatrixRow) => {
      if (chamberFilter !== "all" && row.legislator.chamber !== chamberFilter) {
        return false;
      }

      if (selectedSector !== "all") {
        const hasAlignment = row.influenceSummary.committeeAlignments.some(
          (a) => a.sector === selectedSector,
        );
        const isTopSector =
          row.influenceSummary.topSectors[0]?.sector === selectedSector;
        if (!hasAlignment && !isTopSector) {
          return false;
        }
      }

      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const nameMatch = row.legislator.fullName.toLowerCase().includes(q);
        const distMatch = `d${padDistrict(row.legislator.district)}`.includes(q) ||
          String(row.legislator.district) === q;
        const committeeMatch = row.influenceSummary.committeeAlignments.some((a) =>
          a.committeeName.toLowerCase().includes(q) ||
          translateCommittee(a.committeeName, lang).toLowerCase().includes(q),
        );
        const sectorMatch = row.influenceSummary.topSectors.some((s) =>
          s.sector.toLowerCase().includes(q) ||
          t(SECTOR_LABEL_KEYS[s.sector]).toLowerCase().includes(q),
        );
        if (!nameMatch && !distMatch && !committeeMatch && !sectorMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    analytics.influence.topAlignedPairs,
    chamberFilter,
    selectedSector,
    query,
    lang,
    t,
  ]);

  const sortedPairs = useMemo(() => {
    return filteredPairs.slice().sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.legislator.sortName.localeCompare(b.legislator.sortName, "en");
          break;
        case "district":
          cmp = a.legislator.district - b.legislator.district;
          break;
        case "overlapAmount": {
          const sumA = a.influenceSummary.committeeAlignments.reduce(
            (acc: number, item: CommitteeAlignment) => acc + item.sectorAmount,
            0,
          );
          const sumB = b.influenceSummary.committeeAlignments.reduce(
            (acc: number, item: CommitteeAlignment) => acc + item.sectorAmount,
            0,
          );
          cmp = sumA - sumB;
          break;
        }
        case "topSector": {
          const topA = a.influenceSummary.topSectors[0]?.amount ?? 0;
          const topB = b.influenceSummary.topSectors[0]?.amount ?? 0;
          cmp = topA - topB;
          break;
        }
        case "grassroots":
          cmp = a.influenceSummary.grassrootsPct - b.influenceSummary.grassrootsPct;
          break;
        case "totalRaised":
          cmp = a.totalRaised - b.totalRaised;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredPairs, sortBy, sortDir]);

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
      "ELEC_Influence_Committee_Overlap.csv",
      [
        "LegislatorID",
        "FullName",
        "Party",
        "Chamber",
        "District",
        "TotalRaised_USD",
        "GrassrootsPct",
        "InstitutionalPct",
        "TopSector1",
        "TopSector1_USD",
        "TopSector1_Pct",
        "CommitteeOverlapCount",
        "OverlappingCommittees",
        "OverlappingSectors",
      ],
      sortedPairs.map((r) => [
        r.legislator.id,
        r.legislator.fullName,
        r.legislator.party,
        r.legislator.chamber,
        r.legislator.district,
        r.totalRaised,
        r.influenceSummary.grassrootsPct,
        r.influenceSummary.institutionalPct,
        r.influenceSummary.topSectors[0]?.sector ?? "",
        r.influenceSummary.topSectors[0]?.amount ?? 0,
        r.influenceSummary.topSectors[0]?.pct ?? 0,
        r.influenceSummary.committeeAlignments.length,
        r.influenceSummary.committeeAlignments.map((a: CommitteeAlignment) => a.committeeName).join("; "),
        r.influenceSummary.committeeAlignments.map((a: CommitteeAlignment) => a.sector).join("; "),
      ]),
    );
  }

  const visiblePairs = showAllRows ? sortedPairs : sortedPairs.slice(0, 25);

  return (
    <div className="st-lens-stack">
      {/* 1. Header & Context Intro */}
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.influenceKicker")}</p>
            <h2>{t("superTools.influenceTitle")}</h2>
          </div>
          <span className="badge badge-navy num">
            {compactMoney(analytics.finance.totalRaised, lang)}
          </span>
        </div>
        <p className="panel-intro">
          {t("superTools.influenceIntro", {
            records: formatNumber(analytics.finance.totalDonorRecords),
          })}
        </p>
      </section>

      {/* 2. 2-Column Split: Donut + Grassroots Mix vs 8-Sector Volume Breakdown */}
      <div className="st-v3-split">
        {/* Card A: Donut Chart & Funding Provenance */}
        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.influenceGrassrootsKicker")}</p>
              <h2>{t("superTools.influenceGrassrootsTitle")}</h2>
            </div>
            {selectedSector !== "all" && (
              <button
                type="button"
                className="button button-small button-outline"
                onClick={() => setSelectedSector("all")}
              >
                ✕ {t("superTools.influenceAllSectors")}
              </button>
            )}
          </div>

          <div className="st-donut-wrap">
            <svg
              viewBox="0 0 220 220"
              width="220"
              height="220"
              style={{ display: "block", overflow: "visible" }}
              aria-label={t("superTools.influenceTitle")}
              role="img"
            >
              <title>{t("superTools.influenceTitle")}</title>
              {/* Neutral background track circle */}
              <circle
                cx="110"
                cy="110"
                r={DONUT_RADIUS}
                fill="none"
                stroke="var(--track-bg)"
                strokeWidth={24}
              />

              {/* Arc segments */}
              <g transform="rotate(-90 110 110)">
                {donutSegments.map((seg) => {
                  const isSelected = selectedSector === seg.sector;
                  const isHovered = hoveredSector === seg.sector;
                  const strokeWidth = isSelected || isHovered ? 32 : 24;

                  return (
                    <circle
                      key={seg.sector}
                      cx="110"
                      cy="110"
                      r={DONUT_RADIUS}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${seg.strokeDash} ${seg.strokeGap}`}
                      strokeDashoffset={-seg.offset}
                      style={{
                        cursor: "pointer",
                        transition: "stroke-width 0.18s ease, opacity 0.18s ease",
                        opacity: activeSectorKey && !isSelected && !isHovered ? 0.45 : 1,
                      }}
                      onMouseEnter={() => setHoveredSector(seg.sector)}
                      onMouseLeave={() => setHoveredSector(null)}
                      onClick={() =>
                        setSelectedSector(selectedSector === seg.sector ? "all" : seg.sector)
                      }
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`${t(SECTOR_LABEL_KEYS[seg.sector])}: ${compactMoney(seg.amount, lang)} (${seg.pct}%)`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedSector(selectedSector === seg.sector ? "all" : seg.sector);
                        }
                      }}
                    >
                      <title>{`${t(SECTOR_LABEL_KEYS[seg.sector])}: ${compactMoney(seg.amount, lang)} (${seg.pct}%)`}</title>
                    </circle>
                  );
                })}
              </g>

              {/* Center total/active sector text */}
              <text
                x="110"
                y="100"
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--navy-ink)"
                className="num"
                style={{ fontSize: activeSectorData ? 18 : 21, fontWeight: 800, fontFamily: "inherit" }}
              >
                {activeSectorData
                  ? compactMoney(activeSectorData.amount, lang)
                  : compactMoney(analytics.finance.totalRaised, lang)}
              </text>
              <text
                x="110"
                y="122"
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--muted)"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {activeSectorData
                  ? t("superTools.influenceSectorShare", {
                      pct: activeSectorData.pct,
                    })
                  : t("superTools.influenceElecTotal")}
              </text>
            </svg>

            {activeSectorData && (
              <div className="st-donut-active-pill">
                <span
                  className="st-legend-dot"
                  style={{
                    background:
                      SECTOR_BY_KEY.get(activeSectorData.sector)?.color ??
                      "#94a3b8",
                  }}
                />
                <span>
                  {t(SECTOR_LABEL_KEYS[activeSectorData.sector])} (
                  {activeSectorData.pct}%)
                </span>
                {selectedSector !== "all" && (
                  <button
                    type="button"
                    className="st-donut-clear-btn"
                    onClick={() => setSelectedSector("all")}
                  >
                    {t("superTools.influenceClearFilter")}
                  </button>
                )}
              </div>
            )}

            {/* Grassroots vs Institutional Provenance Bar */}
            <div style={{ width: "100%", marginTop: 8 }}>
              <div className="party-split">
                <div className="party-split-bar" aria-hidden="true" style={{ height: 14, borderRadius: 7 }}>
                  <span
                    style={{
                      width: `${grassrootsPct}%`,
                      background: "#0d9488",
                      transition: "width 0.3s ease",
                    }}
                  />
                  <span
                    style={{
                      width: `${institutionalPct}%`,
                      background: "#6366f1",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div className="party-split-labels">
                  <span>
                    <strong className="dot" style={{ background: "#0d9488" }} />
                    {t("superTools.influenceGrassrootsLabel")}:{" "}
                    <strong className="num">{grassrootsPct}%</strong>
                  </span>
                  <span>
                    <strong className="dot" style={{ background: "#6366f1" }} />
                    {t("superTools.influenceInstitutionalLabel")}:{" "}
                    <strong className="num">{institutionalPct}%</strong>
                  </span>
                </div>
              </div>

              {/* Chamber Benchmarks Indicator */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}>
                  <span>{t("superTools.influenceAvgGrassroots")}</span>
                  <span className="num">
                    {t("common.senate")}: <strong>{senateAvgGrassroots}%</strong> · {t("common.assembly")}: <strong>{assemblyAvgGrassroots}%</strong>
                  </span>
                </div>
                <div
                  className="st-bar-track"
                  title={t("superTools.influenceTrackTitle", {
                    senate: senateAvgGrassroots,
                    assembly: assemblyAvgGrassroots,
                  })}
                >
                  <div
                    className="st-bar-fill"
                    style={{ width: `${grassrootsPct}%`, background: "#0d9488" }}
                  />
                  <div
                    className="st-bar-bench-marker"
                    style={{ left: `${Math.min(100, Math.max(0, senateAvgGrassroots))}%` }}
                    title={t("superTools.influenceChamberBenchTitle", {
                      chamber: chamberLabel("Senate", lang),
                      pct: senateAvgGrassroots,
                    })}
                  />
                  <div
                    className="st-bar-bench-marker"
                    style={{
                      left: `${Math.min(100, Math.max(0, assemblyAvgGrassroots))}%`,
                      background: "var(--blue)",
                    }}
                    title={t("superTools.influenceChamberBenchTitle", {
                      chamber: chamberLabel("Assembly", lang),
                      pct: assemblyAvgGrassroots,
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Card B: 8-Sector Statewide Volume Breakdown */}
        <article className="panel super-panel">
          <div className="panel-head super-panel-head">
            <div>
              <p className="panel-kicker">{t("superTools.influenceGrassrootsKicker")}</p>
              <h2>{t("superTools.influenceSectorBreakdown")}</h2>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            {analytics.influence.statewideSectors.map((s) => {
              const def = SECTOR_BY_KEY.get(s.sector);
              const color = def?.color ?? "#94a3b8";
              const isSelected = selectedSector === s.sector;

              return (
                <button
                  key={s.sector}
                  type="button"
                  className={`st-bottleneck-card${isSelected ? " is-active" : ""}`}
                  onClick={() => setSelectedSector(isSelected ? "all" : s.sector)}
                  style={{ padding: "10px 14px", cursor: "pointer", textAlign: "left" }}
                  aria-pressed={isSelected}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="st-legend-dot" style={{ background: color }} />
                      <strong style={{ fontSize: 13.5 }}>{t(SECTOR_LABEL_KEYS[s.sector])}</strong>
                    </div>
                    <div className="num" style={{ fontWeight: 700, fontSize: 13.5 }}>
                      {compactMoney(s.amount, lang)} ({s.pct}%)
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--muted)" }}>
                    <span>{t("superTools.influenceLegislatorsCount", { count: s.legislatorCount ?? 0 })}</span>
                  </div>
                  <div className="st-bar-track" style={{ height: 6 }}>
                    <div className="st-bar-fill" style={{ width: `${s.pct}%`, background: color }} />
                  </div>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      {/* 3. Committee-Sector Jurisdiction Overlap Section */}
      <section className="panel super-panel">
        <div className="panel-head super-panel-head">
          <div>
            <p className="panel-kicker">{t("superTools.influenceCommitteeKicker")}</p>
            <h2>{t("superTools.influenceCommitteeTitle")}</h2>
          </div>
          <div className="st-head-actions">
            <span className="panel-source num">
              {t("superTools.influenceAlignedMembers")}:{" "}
              {t("superTools.wbShowingCount", {
                shown: formatNumber(sortedPairs.length),
                total: formatNumber(analytics.influence.topAlignedPairs.length),
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

        <p className="panel-intro" style={{ marginBottom: 16 }}>
          {t("superTools.influenceCommitteeNote")}
        </p>

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
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value as DonorSectorKey | "all")}
            aria-label={t("superTools.influenceFilterSector")}
          >
            <option value="all">{t("superTools.influenceAllSectors")}</option>
            {SECTOR_DEFINITIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {t(SECTOR_LABEL_KEYS[s.key])}
              </option>
            ))}
          </select>

          <select
            value={chamberFilter}
            onChange={(e) => setChamberFilter(e.target.value as "all" | "Senate" | "Assembly")}
            aria-label={t("common.allChambers")}
          >
            <option value="all">{t("common.allChambers")}</option>
            <option value="Senate">{t("common.senate")}</option>
            <option value="Assembly">{t("common.assembly")}</option>
          </select>
        </div>

        {/* Aligned Pairs Table */}
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
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
                  label={t("superTools.influenceCommitteeCol")}
                  active={sortBy === "overlapAmount"}
                  dir={sortDir}
                  onClick={() => toggleSort("overlapAmount")}
                />
                <SortTh
                  label={t("superTools.influenceTopSectorCol")}
                  active={sortBy === "topSector"}
                  dir={sortDir}
                  onClick={() => toggleSort("topSector")}
                />
                <SortTh
                  label={t("superTools.influenceGrassrootsCol")}
                  active={sortBy === "grassroots"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("grassroots")}
                />
                <SortTh
                  label={t("superTools.wbColElec")}
                  active={sortBy === "totalRaised"}
                  dir={sortDir}
                  align="right"
                  onClick={() => toggleSort("totalRaised")}
                />
              </tr>
            </thead>
            <tbody>
              {visiblePairs.map((row) => {
                const chamberBench =
                  analytics.effectiveness.chamberAverages[
                    row.legislator.chamber as "Senate" | "Assembly"
                  ]?.avgGrassrootsPct ?? 0;
                const topSector = row.influenceSummary.topSectors[0];
                const topSectorDef = topSector ? SECTOR_BY_KEY.get(topSector.sector) : null;

                return (
                  <tr key={row.legislator.id}>
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

                    <td data-label={t("superTools.influenceCommitteeCol")}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {row.influenceSummary.committeeAlignments.map((a: CommitteeAlignment, idx: number) => {
                          const sDef = SECTOR_BY_KEY.get(a.sector);
                          const sColor = sDef?.color ?? "#94a3b8";
                          const isSectorMatched =
                            selectedSector !== "all" && a.sector === selectedSector;

                          return (
                            <div
                              key={`${a.committeeCode}-${idx}`}
                              style={{
                                display: "inline-flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 8px",
                                borderRadius: "var(--radius)",
                                background: isSectorMatched
                                  ? "color-mix(in srgb, var(--track-bg) 60%, var(--card))"
                                  : "var(--paper-soft)",
                                border: `1px solid ${isSectorMatched ? sColor : "var(--line)"}`,
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: 13 }}>
                                {translateCommittee(a.committeeName, lang)}
                              </span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 12,
                                  color: "var(--muted)",
                                }}
                              >
                                <strong
                                  className="st-legend-dot"
                                  style={{ background: sColor, width: 7, height: 7 }}
                                />
                                {t(SECTOR_LABEL_KEYS[a.sector])}
                              </span>
                              <span className="num" style={{ fontSize: 12, fontWeight: 700 }}>
                                {compactMoney(a.sectorAmount, lang)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td data-label={t("superTools.influenceTopSectorCol")}>
                      {topSector ? (
                        <div
                          className={
                            selectedSector !== "all" &&
                            topSector.sector === selectedSector
                              ? "st-sector-match-pill"
                              : undefined
                          }
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <span
                            className="st-legend-dot"
                            style={{ background: topSectorDef?.color ?? "#94a3b8" }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {t(SECTOR_LABEL_KEYS[topSector.sector])}
                            </div>
                            <span className="num" style={{ fontSize: 12, color: "var(--muted)" }}>
                              {compactMoney(topSector.amount, lang)} ({topSector.pct}%)
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>

                    <td className="num text-right" data-label={t("superTools.influenceGrassrootsCol")}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontWeight: 700 }}>
                          {row.influenceSummary.grassrootsPct}%
                        </span>
                        <div
                          className="st-bar-track"
                          style={{ width: 80, height: 8 }}
                          title={t("superTools.influenceMemberBenchTitle", {
                            pct: chamberBench,
                          })}
                        >
                          <div
                            className="st-bar-fill"
                            style={{ width: `${row.influenceSummary.grassrootsPct}%`, background: "#0d9488" }}
                          />
                          <div
                            className="st-bar-bench-marker"
                            style={{ left: `${Math.min(100, Math.max(0, chamberBench))}%` }}
                            title={t("superTools.influenceMemberBenchTitle", {
                              pct: chamberBench,
                            })}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="num text-right" data-label={t("superTools.wbColElec")}>
                      <strong>{money(row.totalRaised, lang)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expand / Collapse toggle */}
        {sortedPairs.length > 25 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => setShowAllRows((v) => !v)}
            >
              {showAllRows
                ? t("superTools.influenceShowTop25")
                : t("superTools.wbShowAllRows", {
                    count: formatNumber(sortedPairs.length),
                  })}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
