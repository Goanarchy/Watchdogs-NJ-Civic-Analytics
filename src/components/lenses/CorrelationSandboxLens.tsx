import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PartyBadge } from "../PartyBadge";
import { Portrait } from "../Portrait";
import type { Analytics } from "../../lib/analytics";
import { downloadCsv } from "../../lib/csv";
import { type CopyKey, type Lang, useI18n } from "../../lib/i18n";
import { chamberLabel, padDistrict, partyLabel } from "../../lib/labels";
import {
  SANDBOX_DIMENSIONS,
  buildSandboxScatter,
  type SandboxMetricKey,
  type SandboxScatterPoint,
} from "../../lib/sandbox";

const DIMENSION_LABEL_KEYS: Record<SandboxMetricKey, CopyKey> = {
  totalRaised: "superTools.sandboxDim.totalRaised",
  grassrootsPct: "superTools.sandboxDim.grassrootsPct",
  lesScore: "superTools.sandboxDim.lesScore",
  bipartisanRate: "superTools.sandboxDim.bipartisanRate",
  attendancePct: "superTools.sandboxDim.attendancePct",
  partyUnityPct: "superTools.sandboxDim.partyUnityPct",
  primaryBills: "superTools.sandboxDim.primaryBills",
  enactedBills: "superTools.sandboxDim.enactedBills",
  medianIncome: "superTools.sandboxDim.medianIncome",
  medianRent: "superTools.sandboxDim.medianRent",
  transitCommuteRate: "superTools.sandboxDim.transitCommuteRate",
  homeownershipRate: "superTools.sandboxDim.homeownershipRate",
};

const QUADRANT_LABEL_KEYS: Record<SandboxScatterPoint["quadrant"], CopyKey> = {
  topRight: "superTools.sandboxQuad.topRight",
  topLeft: "superTools.sandboxQuad.topLeft",
  bottomRight: "superTools.sandboxQuad.bottomRight",
  bottomLeft: "superTools.sandboxQuad.bottomLeft",
};

interface PresetDef {
  key: string;
  labelKey: CopyKey;
  xKey: SandboxMetricKey;
  yKey: SandboxMetricKey;
}

const PRESETS: PresetDef[] = [
  {
    key: "money_les",
    labelKey: "superTools.sandboxPresetMoneyLes",
    xKey: "totalRaised",
    yKey: "lesScore",
  },
  {
    key: "income_grassroots",
    labelKey: "superTools.sandboxPresetIncomeGrassroots",
    xKey: "medianIncome",
    yKey: "grassrootsPct",
  },
  {
    key: "unity_bipartisan",
    labelKey: "superTools.sandboxPresetUnityBipartisan",
    xKey: "partyUnityPct",
    yKey: "bipartisanRate",
  },
  {
    key: "transit_bills",
    labelKey: "superTools.sandboxPresetTransitBills",
    xKey: "transitCommuteRate",
    yKey: "primaryBills",
  },
];

function formatSandboxValue(
  value: number,
  format: "currency" | "percent" | "score" | "count",
  lang: Lang,
  formatNumber: (n: number) => string,
): string {
  switch (format) {
    case "currency":
      if (Math.abs(value) >= 1_000_000) {
        return `${lang === "es" ? "US$" : "$"}${(value / 1_000_000).toFixed(2)}M`;
      }
      if (Math.abs(value) >= 1_000) {
        return `${lang === "es" ? "US$" : "$"}${(value / 1_000).toFixed(0)}K`;
      }
      return `${lang === "es" ? "US$" : "$"}${Math.round(value)}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "score":
      return `${Math.round(value)}`;
    case "count":
      return formatNumber(Math.round(value));
  }
}

export function CorrelationSandboxLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();

  const [xKey, setXKey] = useState<SandboxMetricKey>("totalRaised");
  const [yKey, setYKey] = useState<SandboxMetricKey>("lesScore");
  const [chamber, setChamber] = useState<"All" | "Senate" | "Assembly">("All");
  const [party, setParty] = useState<"All" | "D" | "R">("All");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const xDim = useMemo(
    () => SANDBOX_DIMENSIONS.find((d) => d.key === xKey) ?? SANDBOX_DIMENSIONS[0],
    [xKey],
  );
  const yDim = useMemo(
    () => SANDBOX_DIMENSIONS.find((d) => d.key === yKey) ?? SANDBOX_DIMENSIONS[2],
    [yKey],
  );

  const scatter = useMemo(() => {
    return buildSandboxScatter(analytics.legislatorMatrix, xKey, yKey, {
      chamber,
      party,
    });
  }, [analytics.legislatorMatrix, xKey, yKey, chamber, party]);

  const activePoint = useMemo<SandboxScatterPoint | null>(() => {
    const targetId = hoveredId ?? selectedId;
    if (targetId != null) {
      const found = scatter.points.find((p) => p.legislatorId === targetId);
      if (found) return found;
    }
    return scatter.points[0] ?? null;
  }, [hoveredId, selectedId, scatter.points]);

  const absR = Math.abs(scatter.pearsonR);
  const strengthKey: CopyKey =
    absR >= 0.5
      ? "superTools.sandboxStrengthStrong"
      : absR >= 0.25
        ? "superTools.sandboxStrengthModerate"
        : "superTools.sandboxStrengthWeak";

  const handleExportCsv = () => {
    const headers = [
      "Legislator ID",
      "Full Name",
      "Party",
      "Chamber",
      "District",
      t(DIMENSION_LABEL_KEYS[xKey]),
      t(DIMENSION_LABEL_KEYS[yKey]),
      "Quadrant",
    ];

    const rows = scatter.points.map((p) => [
      p.legislatorId,
      p.name,
      p.party,
      p.chamber,
      p.district,
      p.x,
      p.y,
      p.quadrant,
    ]);

    downloadCsv(`watchdogs-correlation-${xKey}-vs-${yKey}.csv`, headers, rows);
  };

  // SVG Geometry Calculation
  const svgWidth = 760;
  const svgHeight = 400;
  const padLeft = 68;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 48;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const rawXs = useMemo(() => scatter.points.map((p) => p.x), [scatter.points]);
  const rawYs = useMemo(() => scatter.points.map((p) => p.y), [scatter.points]);

  const bounds = useMemo(() => {
    let minX = rawXs.length ? Math.min(...rawXs) : 0;
    let maxX = rawXs.length ? Math.max(...rawXs) : 100;
    let minY = rawYs.length ? Math.min(...rawYs) : 0;
    let maxY = rawYs.length ? Math.max(...rawYs) : 100;

    if (minX === maxX) {
      minX = 0;
      maxX = maxX > 0 ? maxX * 1.2 : 10;
    }
    if (minY === maxY) {
      minY = 0;
      maxY = maxY > 0 ? maxY * 1.2 : 10;
    }

    const padFactorX = (maxX - minX) * 0.06;
    const plotMinX = Math.max(0, minX - padFactorX);
    const plotMaxX = maxX + padFactorX;

    const padFactorY = (maxY - minY) * 0.06;
    const plotMinY = Math.max(0, minY - padFactorY);
    const plotMaxY = maxY + padFactorY;

    return { plotMinX, plotMaxX, plotMinY, plotMaxY };
  }, [rawXs, rawYs]);

  const scaleX = (val: number): number => {
    const { plotMinX, plotMaxX } = bounds;
    if (plotMaxX <= plotMinX) return padLeft + plotWidth / 2;
    return padLeft + ((val - plotMinX) / (plotMaxX - plotMinX)) * plotWidth;
  };

  const scaleY = (val: number): number => {
    const { plotMinY, plotMaxY } = bounds;
    if (plotMaxY <= plotMinY) return padTop + plotHeight / 2;
    return padTop + plotHeight - ((val - plotMinY) / (plotMaxY - plotMinY)) * plotHeight;
  };

  const xTicks = useMemo(() => {
    const { plotMinX, plotMaxX } = bounds;
    const step = (plotMaxX - plotMinX) / 4;
    return [0, 1, 2, 3, 4].map((i) => plotMinX + i * step);
  }, [bounds]);

  const yTicks = useMemo(() => {
    const { plotMinY, plotMaxY } = bounds;
    const step = (plotMaxY - plotMinY) / 4;
    return [0, 1, 2, 3, 4].map((i) => plotMinY + i * step);
  }, [bounds]);

  const quadrantCounts = useMemo(() => {
    return {
      topRight: scatter.points.filter((p) => p.quadrant === "topRight").length,
      topLeft: scatter.points.filter((p) => p.quadrant === "topLeft").length,
      bottomRight: scatter.points.filter((p) => p.quadrant === "bottomRight").length,
      bottomLeft: scatter.points.filter((p) => p.quadrant === "bottomLeft").length,
    };
  }, [scatter.points]);

  return (
    <div className="st-scatter-shell">
      <div className="panel-head super-panel-head">
        <div>
          <p className="panel-kicker">{t("superTools.sandboxKicker")}</p>
          <h2>{t("superTools.sandboxTitle")}</h2>
        </div>
        <div className="st-pearson-pill">
          <strong>{t("superTools.sandboxPearsonLabel")}</strong>
          <span className="num">
            {scatter.pearsonR >= 0 ? "+" : ""}
            {scatter.pearsonR.toFixed(3)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t(strengthKey)}</span>
        </div>
      </div>
      <p className="panel-intro">{t("superTools.sandboxIntro")}</p>

      {/* Quick Investigation Presets */}
      <div className="st-preset-row" aria-label={t("superTools.sandboxPresets")}>
        <span className="st-cell-sub font-semibold">{t("superTools.sandboxPresets")}:</span>
        {PRESETS.map((p) => {
          const active = xKey === p.xKey && yKey === p.yKey;
          return (
            <button
              key={p.key}
              type="button"
              className={`st-preset-btn${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => {
                setXKey(p.xKey);
                setYKey(p.yKey);
              }}
            >
              {t(p.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Axis & Filter Controls */}
      <div className="st-scatter-controls">
        <div className="st-scatter-selects">
          <label className="st-select-label">
            <span>{t("superTools.sandboxXAxis")}</span>
            <select
              value={xKey}
              onChange={(e) => setXKey(e.target.value as SandboxMetricKey)}
            >
              {SANDBOX_DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {t(DIMENSION_LABEL_KEYS[d.key])}
                </option>
              ))}
            </select>
          </label>

          <label className="st-select-label">
            <span>{t("superTools.sandboxYAxis")}</span>
            <select
              value={yKey}
              onChange={(e) => setYKey(e.target.value as SandboxMetricKey)}
            >
              {SANDBOX_DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {t(DIMENSION_LABEL_KEYS[d.key])}
                </option>
              ))}
            </select>
          </label>

          <label className="st-select-label">
            <span>{t("home.chamber")}</span>
            <select
              value={chamber}
              onChange={(e) => setChamber(e.target.value as "All" | "Senate" | "Assembly")}
            >
              <option value="All">{t("common.allChambers")}</option>
              <option value="Senate">{chamberLabel("Senate", lang)}</option>
              <option value="Assembly">{chamberLabel("Assembly", lang)}</option>
            </select>
          </label>

          <label className="st-select-label">
            <span>{t("home.party")}</span>
            <select
              value={party}
              onChange={(e) => setParty(e.target.value as "All" | "D" | "R")}
            >
              <option value="All">{t("common.allParties")}</option>
              <option value="D">{partyLabel("D", lang)}</option>
              <option value="R">{partyLabel("R", lang)}</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="chip num">
            {t("superTools.sandboxPointsShown", { count: scatter.points.length })}
          </span>
          <button
            type="button"
            className="button button-small button-outline"
            onClick={handleExportCsv}
          >
            ↓ {t("superTools.wbExportCsv")}
          </button>
        </div>
      </div>

      {/* Responsive Inline SVG Scatter Plot */}
      <div className="st-scatter-wrap">
        <svg
          className="st-scatter-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`${t("superTools.sandboxTitle")}: ${t(DIMENSION_LABEL_KEYS[xKey])} vs ${t(DIMENSION_LABEL_KEYS[yKey])}`}
        >
          <title>
            {`${t(DIMENSION_LABEL_KEYS[xKey])} vs ${t(DIMENSION_LABEL_KEYS[yKey])} (r = ${scatter.pearsonR})`}
          </title>

          {/* Gridlines */}
          {xTicks.map((val, idx) => (
            <line
              key={`x-grid-${idx}`}
              x1={scaleX(val)}
              y1={padTop}
              x2={scaleX(val)}
              y2={padTop + plotHeight}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity={0.5}
            />
          ))}
          {yTicks.map((val, idx) => (
            <line
              key={`y-grid-${idx}`}
              x1={padLeft}
              y1={scaleY(val)}
              x2={padLeft + plotWidth}
              y2={scaleY(val)}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity={0.5}
            />
          ))}

          {/* Median Crosshair Lines */}
          <line
            x1={scaleX(scatter.medianX)}
            y1={padTop}
            x2={scaleX(scatter.medianX)}
            y2={padTop + plotHeight}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity={0.85}
          />
          <text
            x={scaleX(scatter.medianX) + 4}
            y={padTop + 14}
            fontSize="10"
            fill="#d97706"
            fontWeight="700"
          >
            {t("superTools.sandboxMedianLine")}:{" "}
            {formatSandboxValue(scatter.medianX, xDim.format, lang, formatNumber)}
          </text>

          <line
            x1={padLeft}
            y1={scaleY(scatter.medianY)}
            x2={padLeft + plotWidth}
            y2={scaleY(scatter.medianY)}
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity={0.85}
          />
          <text
            x={padLeft + plotWidth - 4}
            y={scaleY(scatter.medianY) - 5}
            textAnchor="end"
            fontSize="10"
            fill="#d97706"
            fontWeight="700"
          >
            {t("superTools.sandboxMedianLine")}:{" "}
            {formatSandboxValue(scatter.medianY, yDim.format, lang, formatNumber)}
          </text>

          {/* Ticks & Values */}
          {xTicks.map((val, idx) => (
            <text
              key={`x-tick-${idx}`}
              x={scaleX(val)}
              y={padTop + plotHeight + 18}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink-soft)"
            >
              {formatSandboxValue(val, xDim.format, lang, formatNumber)}
            </text>
          ))}
          {yTicks.map((val, idx) => (
            <text
              key={`y-tick-${idx}`}
              x={padLeft - 8}
              y={scaleY(val) + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--ink-soft)"
            >
              {formatSandboxValue(val, yDim.format, lang, formatNumber)}
            </text>
          ))}

          {/* Axis Labels */}
          <text
            x={padLeft + plotWidth / 2}
            y={svgHeight - 12}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill="var(--ink)"
          >
            {t(DIMENSION_LABEL_KEYS[xKey])}
          </text>
          <text
            x={16}
            y={padTop + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${padTop + plotHeight / 2})`}
            fontSize="12"
            fontWeight="700"
            fill="var(--ink)"
          >
            {t(DIMENSION_LABEL_KEYS[yKey])}
          </text>

          {/* Interactive Scatter Dots */}
          {scatter.points.map((p) => {
            const isSelected = selectedId === p.legislatorId;
            const isHovered = hoveredId === p.legislatorId;
            // Deterministic jitter (±1.5px) if dots overlap coordinates
            const jitter = (((p.legislatorId * 13) % 7) - 3) * 0.5;
            const cx = scaleX(p.x) + jitter;
            const cy = scaleY(p.y) + jitter;
            const dotFill =
              p.party === "D" ? "#2563eb" : p.party === "R" ? "#dc2626" : "#64748b";
            const r = isSelected ? 8.5 : isHovered ? 7.5 : 5.5;

            return (
              <g key={p.legislatorId}>
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={13}
                    fill="none"
                    stroke={dotFill}
                    strokeWidth="2"
                    opacity={0.4}
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={dotFill}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.name} (${p.party}-LD${p.district}): ${t(DIMENSION_LABEL_KEYS[xKey])} ${formatSandboxValue(p.x, xDim.format, lang, formatNumber)}, ${t(DIMENSION_LABEL_KEYS[yKey])} ${formatSandboxValue(p.y, yDim.format, lang, formatNumber)}`}
                  aria-pressed={isSelected}
                  style={{ cursor: "pointer", transition: "r 0.15s ease" }}
                  onClick={() => setSelectedId(p.legislatorId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(p.legislatorId);
                    }
                  }}
                  onMouseEnter={() => setHoveredId(p.legislatorId)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <title>
                    {`${p.name} (${p.party} · LD${padDistrict(p.district)})\n${t(DIMENSION_LABEL_KEYS[xKey])}: ${formatSandboxValue(p.x, xDim.format, lang, formatNumber)}\n${t(DIMENSION_LABEL_KEYS[yKey])}: ${formatSandboxValue(p.y, yDim.format, lang, formatNumber)}`}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Quadrant Strip & Inspector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 4 Quadrants Summary */}
        <div className="st-scatter-inspector">
          <span className="st-eyebrow">{t("superTools.sandboxKicker")}</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="panel p-3">
              <span className="text-xs text-muted block">
                {t(QUADRANT_LABEL_KEYS.topRight)}
              </span>
              <strong className="num text-lg">{quadrantCounts.topRight}</strong>
            </div>
            <div className="panel p-3">
              <span className="text-xs text-muted block">
                {t(QUADRANT_LABEL_KEYS.topLeft)}
              </span>
              <strong className="num text-lg">{quadrantCounts.topLeft}</strong>
            </div>
            <div className="panel p-3">
              <span className="text-xs text-muted block">
                {t(QUADRANT_LABEL_KEYS.bottomRight)}
              </span>
              <strong className="num text-lg">{quadrantCounts.bottomRight}</strong>
            </div>
            <div className="panel p-3">
              <span className="text-xs text-muted block">
                {t(QUADRANT_LABEL_KEYS.bottomLeft)}
              </span>
              <strong className="num text-lg">{quadrantCounts.bottomLeft}</strong>
            </div>
          </div>
          <p className="st-cell-sub">
            {t("superTools.sandboxHoverHint")}
          </p>
        </div>

        {/* Selected Legislator Inspector Card */}
        <div className="st-scatter-inspector">
          <span className="st-eyebrow">{t("superTools.sandboxSelectedTitle")}</span>
          {activePoint ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Portrait
                  src={activePoint.photo}
                  name={activePoint.name}
                  className="st-mini-avatar"
                />
                <div>
                  <div className="chip-row">
                    <PartyBadge party={activePoint.party} />
                    <Link
                      className="chip chip-link"
                      to={`/district/${activePoint.district}`}
                    >
                      LD {padDistrict(activePoint.district)}
                    </Link>
                    <span className="chip">
                      {chamberLabel(activePoint.chamber, lang)}
                    </span>
                  </div>
                  <h3 className="font-bold text-base mt-1">
                    <Link to={`/legislador/${activePoint.legislatorId}`}>
                      {activePoint.name}
                    </Link>
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 panel p-3">
                <div>
                  <span className="text-xs text-muted block">
                    {t(DIMENSION_LABEL_KEYS[xKey])}
                  </span>
                  <strong className="num text-base">
                    {formatSandboxValue(
                      activePoint.x,
                      xDim.format,
                      lang,
                      formatNumber,
                    )}
                  </strong>
                </div>
                <div>
                  <span className="text-xs text-muted block">
                    {t(DIMENSION_LABEL_KEYS[yKey])}
                  </span>
                  <strong className="num text-base">
                    {formatSandboxValue(
                      activePoint.y,
                      yDim.format,
                      lang,
                      formatNumber,
                    )}
                  </strong>
                </div>
              </div>

              <div className="flex justify-between items-center mt-1">
                <span className="chip text-xs">
                  {t("superTools.sandboxQuadrantLabel")}:{" "}
                  <strong>{t(QUADRANT_LABEL_KEYS[activePoint.quadrant])}</strong>
                </span>
                <Link
                  to={`/legislador/${activePoint.legislatorId}`}
                  className="button button-small button-outline"
                >
                  {t("superTools.sandboxOpenProfile")} →
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {t("superTools.sandboxHoverHint")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
