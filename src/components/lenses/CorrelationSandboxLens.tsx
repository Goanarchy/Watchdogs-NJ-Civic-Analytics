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

type ZoomQuad = "all" | SandboxScatterPoint["quadrant"];

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
      if (Math.abs(value) >= 999_950) {
        return `${lang === "es" ? "US$" : "$"}${(value / 1_000_000).toFixed(2)}M`;
      }
      if (Math.abs(value) >= 10_000) {
        return `${lang === "es" ? "US$" : "$"}${(value / 1_000).toFixed(0)}K`;
      }
      return `${lang === "es" ? "US$" : "$"}${formatNumber(Math.round(value))}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "score":
      return `${Math.round(value)}`;
    case "count":
      return formatNumber(Math.round(value));
  }
}

function formatSlopeReadout(
  slope: number,
  xFormat: "currency" | "percent" | "score" | "count",
  yFormat: "currency" | "percent" | "score" | "count",
): string {
  if (!Number.isFinite(slope)) return "0";
  if (xFormat === "currency" && yFormat !== "currency") {
    // Express per $100K when X is large dollar figures and Y is score/count/%
    const per100k = slope * 100_000;
    const sign = per100k >= 0 ? "+" : "";
    return `${sign}${per100k.toFixed(2)} / $100K`;
  }
  const sign = slope >= 0 ? "+" : "";
  if (Math.abs(slope) >= 100) return `${sign}${Math.round(slope)}`;
  if (Math.abs(slope) >= 1) return `${sign}${slope.toFixed(2)}`;
  return `${sign}${slope.toFixed(3)}`;
}

function computeAxisBounds(
  values: number[],
  format: "currency" | "percent" | "score" | "count",
  key: SandboxMetricKey,
): { plotMin: number; plotMax: number } {
  let minVal = values.length ? Math.min(...values) : 0;
  let maxVal = values.length ? Math.max(...values) : 100;

  const isZeroToHundred = format === "percent" || key === "lesScore";

  if (minVal === maxVal) {
    minVal = Math.max(0, minVal - (isZeroToHundred ? 5 : 1));
    maxVal = isZeroToHundred
      ? Math.min(100, maxVal + 5)
      : maxVal > 0
        ? maxVal * 1.2
        : 10;
    if (minVal === maxVal) {
      minVal = 0;
      maxVal = isZeroToHundred ? 100 : 10;
    }
  }

  const span = maxVal - minVal;
  const pad = span * 0.06;
  const plotMin = Math.max(0, minVal - pad);
  const rawMax = maxVal + pad;
  const plotMax =
    isZeroToHundred && maxVal <= 100 ? Math.min(100, rawMax) : rawMax;

  return { plotMin, plotMax };
}

function computeAxisTicks(
  plotMin: number,
  plotMax: number,
  format: "currency" | "percent" | "score" | "count",
): number[] {
  if (format === "count") {
    const intMin = Math.max(0, Math.floor(plotMin));
    const intMax = Math.max(intMin, Math.ceil(plotMax));
    const span = intMax - intMin;
    if (span === 0) return [intMin];
    if (span <= 4) {
      const ticks: number[] = [];
      for (let v = intMin; v <= intMax; v++) ticks.push(v);
      return ticks;
    }
    const raw = [0, 1, 2, 3, 4].map((i) =>
      Math.round(intMin + (i * span) / 4),
    );
    return Array.from(new Set(raw));
  }

  const step = (plotMax - plotMin) / 4;
  return [0, 1, 2, 3, 4].map((i) => plotMin + i * step);
}

export function CorrelationSandboxLens({ analytics }: { analytics: Analytics }) {
  const { t, lang, formatNumber } = useI18n();

  const [xKey, setXKey] = useState<SandboxMetricKey>("totalRaised");
  const [yKey, setYKey] = useState<SandboxMetricKey>("lesScore");
  const [chamber, setChamber] = useState<"All" | "Senate" | "Assembly">("All");
  const [party, setParty] = useState<"All" | "D" | "R">("All");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showRegression, setShowRegression] = useState<boolean>(true);
  const [zoomQuad, setZoomQuad] = useState<ZoomQuad>("all");

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

  const visiblePoints = useMemo(() => {
    if (zoomQuad === "all") return scatter.points;
    return scatter.points.filter((p) => p.quadrant === zoomQuad);
  }, [scatter.points, zoomQuad]);

  const activePoint = useMemo<SandboxScatterPoint | null>(() => {
    const targetId = hoveredId ?? selectedId;
    if (targetId != null) {
      const found = scatter.points.find((p) => p.legislatorId === targetId);
      if (found) return found;
    }
    return visiblePoints[0] ?? scatter.points[0] ?? null;
  }, [hoveredId, selectedId, scatter.points, visiblePoints]);

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

    const rows = visiblePoints.map((p) => [
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

  // SVG Geometry Calculation with inner padding so 0/100 points never clip border
  const svgWidth = 760;
  const svgHeight = 400;
  const padLeft = 70;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 48;
  const innerPad = 12;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const usableWidth = plotWidth - innerPad * 2;
  const usableHeight = plotHeight - innerPad * 2;

  const zoomSourcePoints = visiblePoints.length > 0 ? visiblePoints : scatter.points;

  const bounds = useMemo(() => {
    const xs = zoomSourcePoints.map((p) => p.x);
    const ys = zoomSourcePoints.map((p) => p.y);
    const xB = computeAxisBounds(xs, xDim.format, xKey);
    const yB = computeAxisBounds(ys, yDim.format, yKey);
    return {
      plotMinX: xB.plotMin,
      plotMaxX: xB.plotMax,
      plotMinY: yB.plotMin,
      plotMaxY: yB.plotMax,
    };
  }, [zoomSourcePoints, xDim.format, yDim.format, xKey, yKey]);

  const scaleX = (val: number): number => {
    const { plotMinX, plotMaxX } = bounds;
    if (plotMaxX <= plotMinX) return padLeft + plotWidth / 2;
    return (
      padLeft +
      innerPad +
      ((val - plotMinX) / (plotMaxX - plotMinX)) * usableWidth
    );
  };

  const scaleY = (val: number): number => {
    const { plotMinY, plotMaxY } = bounds;
    if (plotMaxY <= plotMinY) return padTop + plotHeight / 2;
    return (
      padTop +
      plotHeight -
      innerPad -
      ((val - plotMinY) / (plotMaxY - plotMinY)) * usableHeight
    );
  };

  const xTicks = useMemo(
    () => computeAxisTicks(bounds.plotMinX, bounds.plotMaxX, xDim.format),
    [bounds.plotMinX, bounds.plotMaxX, xDim.format],
  );

  const yTicks = useMemo(
    () => computeAxisTicks(bounds.plotMinY, bounds.plotMaxY, yDim.format),
    [bounds.plotMinY, bounds.plotMaxY, yDim.format],
  );

  const quadrantCounts = useMemo(() => {
    return {
      topRight: scatter.points.filter((p) => p.quadrant === "topRight").length,
      topLeft: scatter.points.filter((p) => p.quadrant === "topLeft").length,
      bottomRight: scatter.points.filter((p) => p.quadrant === "bottomRight").length,
      bottomLeft: scatter.points.filter((p) => p.quadrant === "bottomLeft").length,
    };
  }, [scatter.points]);

  // Median label placement & pill sizing
  const medXCoord = scaleX(scatter.medianX);
  const medYCoord = scaleY(scatter.medianY);
  const medXInView =
    medXCoord >= padLeft && medXCoord <= padLeft + plotWidth;
  const medYInView =
    medYCoord >= padTop && medYCoord <= padTop + plotHeight;
  const flipMedXAnchor = medXCoord > padLeft + plotWidth * 0.72;
  const medXLabelText = `${t("superTools.sandboxMedianLine")}: ${formatSandboxValue(
    scatter.medianX,
    xDim.format,
    lang,
    formatNumber,
  )}`;
  const medXBoxW = Math.max(76, medXLabelText.length * 6.1 + 12);
  const medXTextX = flipMedXAnchor ? medXCoord - 6 : medXCoord + 6;
  const medXBoxX = flipMedXAnchor ? medXTextX - medXBoxW + 4 : medXTextX - 4;

  const medYLabelText = `${t("superTools.sandboxMedianLine")}: ${formatSandboxValue(
    scatter.medianY,
    yDim.format,
    lang,
    formatNumber,
  )}`;
  const medYBoxW = Math.max(76, medYLabelText.length * 6.1 + 12);
  const placeMedYBelow = medYCoord < padTop + 26;
  const medYTextY = placeMedYBelow ? medYCoord + 15 : medYCoord - 7;
  const medYBoxY = medYTextY - 11;

  // OLS Regression line endpoints across visible plot X range
  const olsX1 = bounds.plotMinX;
  const olsX2 = bounds.plotMaxX;
  const olsY1 = scatter.slope * olsX1 + scatter.intercept;
  const olsY2 = scatter.slope * olsX2 + scatter.intercept;

  const minDotX = padLeft + innerPad;
  const maxDotX = padLeft + plotWidth - innerPad;
  const minDotY = padTop + innerPad;
  const maxDotY = padTop + plotHeight - innerPad;

  const zoomOptions: Array<{ id: ZoomQuad; labelKey: CopyKey }> = [
    { id: "all", labelKey: "superTools.sandboxZoomAll" },
    { id: "topRight", labelKey: "superTools.sandboxZoomQ1" },
    { id: "topLeft", labelKey: "superTools.sandboxZoomQ2" },
    { id: "bottomLeft", labelKey: "superTools.sandboxZoomQ3" },
    { id: "bottomRight", labelKey: "superTools.sandboxZoomQ4" },
  ];

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
          <strong>{t("superTools.sandboxRSquared")}</strong>
          <span className="num">{scatter.rSquared.toFixed(3)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {t("superTools.sandboxSlope")}:{" "}
            <span className="num">
              {formatSlopeReadout(scatter.slope, xDim.format, yDim.format)}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span>{t(strengthKey)}</span>
        </div>
      </div>
      <p className="panel-intro">{t("superTools.sandboxIntro")}</p>

      {/* Quick Investigation Presets */}
      <div className="st-preset-row" aria-label={t("superTools.sandboxPresets")}>
        <span className="st-preset-label">{t("superTools.sandboxPresets")}:</span>
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
                setZoomQuad("all");
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
          <label className="st-sandbox-field">
            <span className="st-sandbox-field-label">{t("superTools.sandboxXAxis")}</span>
            <select
              value={xKey}
              onChange={(e) => {
                setXKey(e.target.value as SandboxMetricKey);
                setZoomQuad("all");
              }}
            >
              {SANDBOX_DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {t(DIMENSION_LABEL_KEYS[d.key])}
                </option>
              ))}
            </select>
          </label>

          <label className="st-sandbox-field">
            <span className="st-sandbox-field-label">{t("superTools.sandboxYAxis")}</span>
            <select
              value={yKey}
              onChange={(e) => {
                setYKey(e.target.value as SandboxMetricKey);
                setZoomQuad("all");
              }}
            >
              {SANDBOX_DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {t(DIMENSION_LABEL_KEYS[d.key])}
                </option>
              ))}
            </select>
          </label>

          <label className="st-sandbox-field">
            <span className="st-sandbox-field-label">{t("home.chamber")}</span>
            <select
              value={chamber}
              onChange={(e) => setChamber(e.target.value as "All" | "Senate" | "Assembly")}
            >
              <option value="All">{t("common.allChambers")}</option>
              <option value="Senate">{chamberLabel("Senate", lang)}</option>
              <option value="Assembly">{chamberLabel("Assembly", lang)}</option>
            </select>
          </label>

          <label className="st-sandbox-field">
            <span className="st-sandbox-field-label">{t("home.party")}</span>
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

        <div className="st-sandbox-actions">
          <button
            type="button"
            className={`st-preset-btn${showRegression ? " is-active" : ""}`}
            aria-pressed={showRegression}
            onClick={() => setShowRegression((v) => !v)}
          >
            📈 {t("superTools.sandboxToggleTrendline")}
          </button>
          <span className="chip num">
            {t("superTools.sandboxPointsShown", { count: visiblePoints.length })}
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

      {/* Quadrant Focus / Zoom Bar + Legend */}
      <div className="st-scatter-toolbar-sub">
        <div className="st-zoom-pills" role="group" aria-label={t("superTools.sandboxZoomLabel")}>
          <span className="st-preset-label">{t("superTools.sandboxZoomLabel")}:</span>
          {zoomOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`st-zoom-pill${zoomQuad === opt.id ? " is-active" : ""}`}
              aria-pressed={zoomQuad === opt.id}
              onClick={() => setZoomQuad(opt.id)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
          {zoomQuad !== "all" && (
            <button
              type="button"
              className="st-zoom-pill is-reset"
              onClick={() => setZoomQuad("all")}
            >
              ↺ {t("superTools.sandboxZoomReset")}
            </button>
          )}
        </div>

        <div className="st-scatter-legend" aria-hidden="true">
          <span className="st-scatter-legend-item">
            <span className="st-legend-dot" style={{ background: "var(--blue)" }} />
            {partyLabel("D", lang)}
          </span>
          <span className="st-scatter-legend-item">
            <span className="st-legend-dot" style={{ background: "var(--red)" }} />
            {partyLabel("R", lang)}
          </span>
          {showRegression && (
            <span className="st-scatter-legend-item">
              <span className="st-legend-line is-ols" />
              {t("superTools.sandboxTrendline")}
            </span>
          )}
          <span className="st-scatter-legend-item">
            <span className="st-legend-line is-median" />
            {t("superTools.sandboxMediansLegend")}
          </span>
        </div>
      </div>

      {zoomQuad !== "all" && (
        <p className="st-zoom-active-note">
          {t("superTools.sandboxZoomActiveHint", {
            quadrant: t(QUADRANT_LABEL_KEYS[zoomQuad]),
            count: visiblePoints.length,
          })}
        </p>
      )}

      {/* Responsive Inline SVG Scatter Plot */}
      <div className="st-scatter-wrap">
        <svg
          className="st-scatter-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          role="img"
          aria-label={`${t("superTools.sandboxTitle")}: ${t(DIMENSION_LABEL_KEYS[xKey])} vs ${t(DIMENSION_LABEL_KEYS[yKey])}`}
        >
          <title>
            {`${t(DIMENSION_LABEL_KEYS[xKey])} vs ${t(DIMENSION_LABEL_KEYS[yKey])} (r = ${scatter.pearsonR}, R² = ${scatter.rSquared.toFixed(3)})`}
          </title>

          <defs>
            <clipPath id="st-scatter-plot-clip">
              <rect
                x={padLeft}
                y={padTop}
                width={plotWidth}
                height={plotHeight}
                rx={4}
              />
            </clipPath>
          </defs>

          {/* Plot Border & Subtle Quadrant Shading */}
          <g clipPath="url(#st-scatter-plot-clip)">
            {zoomQuad === "all" && medXInView && medYInView && (
              <>
                <rect
                  x={medXCoord}
                  y={padTop}
                  width={Math.max(0, padLeft + plotWidth - medXCoord)}
                  height={Math.max(0, medYCoord - padTop)}
                  fill="var(--ok)"
                  opacity={0.04}
                />
                <rect
                  x={padLeft}
                  y={padTop}
                  width={Math.max(0, medXCoord - padLeft)}
                  height={Math.max(0, medYCoord - padTop)}
                  fill="var(--blue)"
                  opacity={0.03}
                />
                <rect
                  x={medXCoord}
                  y={medYCoord}
                  width={Math.max(0, padLeft + plotWidth - medXCoord)}
                  height={Math.max(0, padTop + plotHeight - medYCoord)}
                  fill="var(--gold)"
                  opacity={0.035}
                />
              </>
            )}

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
                opacity={0.65}
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
                opacity={0.65}
              />
            ))}

            {/* Q1-Q4 Watermark Labels when viewing all */}
            {zoomQuad === "all" && (
              <>
                <text
                  x={padLeft + plotWidth - 10}
                  y={padTop + 16}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--muted)"
                  opacity={0.55}
                >
                  Q1 ↗
                </text>
                <text
                  x={padLeft + 10}
                  y={padTop + 16}
                  textAnchor="start"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--muted)"
                  opacity={0.55}
                >
                  Q2 ↖
                </text>
                <text
                  x={padLeft + 10}
                  y={padTop + plotHeight - 10}
                  textAnchor="start"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--muted)"
                  opacity={0.55}
                >
                  Q3 ↙
                </text>
                <text
                  x={padLeft + plotWidth - 10}
                  y={padTop + plotHeight - 10}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--muted)"
                  opacity={0.55}
                >
                  Q4 ↘
                </text>
              </>
            )}

            {/* OLS Linear Regression Trendline */}
            {showRegression && scatter.points.length >= 2 && (
              <line
                x1={scaleX(olsX1)}
                y1={scaleY(olsY1)}
                x2={scaleX(olsX2)}
                y2={scaleY(olsY2)}
                stroke="var(--navy-ink)"
                strokeWidth="2"
                strokeDasharray="6 3"
                opacity={0.78}
              />
            )}

            {/* Median Crosshair Lines */}
            {medXInView && (
              <line
                x1={medXCoord}
                y1={padTop}
                x2={medXCoord}
                y2={padTop + plotHeight}
                stroke="var(--gold)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity={0.9}
              />
            )}
            {medYInView && (
              <line
                x1={padLeft}
                y1={medYCoord}
                x2={padLeft + plotWidth}
                y2={medYCoord}
                stroke="var(--gold)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity={0.9}
              />
            )}

            {/* Interactive Scatter Dots (clipped cleanly) */}
            {visiblePoints.map((p) => {
              const isSelected = selectedId === p.legislatorId;
              const isHovered = hoveredId === p.legislatorId;

              // Deterministic 2D golden-angle offset clamped inside plot inner bounds
              const angle = (p.legislatorId * 137.508 * Math.PI) / 180;
              const mag = ((p.legislatorId % 4) + 0.5) * 1.1;
              const cx = Math.min(
                maxDotX,
                Math.max(minDotX, scaleX(p.x) + Math.cos(angle) * mag),
              );
              const cy = Math.min(
                maxDotY,
                Math.max(minDotY, scaleY(p.y) + Math.sin(angle) * mag),
              );

              const dotFill =
                p.party === "D"
                  ? "var(--blue)"
                  : p.party === "R"
                    ? "var(--red)"
                    : "var(--muted)";
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
                      opacity={0.45}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={dotFill}
                    stroke="var(--card)"
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    pointerEvents="none"
                    style={{ transition: "r 0.15s ease" }}
                  />
                  {/* Generous invisible touch/click target (r=16) */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={16}
                    fill="transparent"
                    role="button"
                    tabIndex={0}
                    aria-label={`${p.name} (${p.party}-LD${p.district}): ${t(DIMENSION_LABEL_KEYS[xKey])} ${formatSandboxValue(p.x, xDim.format, lang, formatNumber)}, ${t(DIMENSION_LABEL_KEYS[yKey])} ${formatSandboxValue(p.y, yDim.format, lang, formatNumber)}`}
                    aria-pressed={isSelected}
                    style={{ cursor: "pointer" }}
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

            {/* Median Pill Badges rendered above dots & lines */}
            {medXInView && (
              <g pointerEvents="none">
                <rect
                  x={Math.max(
                    padLeft + 2,
                    Math.min(padLeft + plotWidth - medXBoxW - 2, medXBoxX),
                  )}
                  y={padTop + 4}
                  width={medXBoxW}
                  height={16}
                  rx={4}
                  fill="var(--card)"
                  fillOpacity={0.92}
                  stroke="var(--gold)"
                  strokeOpacity={0.55}
                  strokeWidth={1}
                />
                <text
                  x={
                    flipMedXAnchor
                      ? Math.min(padLeft + plotWidth - 8, medXTextX)
                      : Math.max(padLeft + 8, medXTextX)
                  }
                  y={padTop + 15}
                  textAnchor={flipMedXAnchor ? "end" : "start"}
                  fontSize="10"
                  fill="var(--gold-ink)"
                  fontWeight="700"
                >
                  {medXLabelText}
                </text>
              </g>
            )}

            {medYInView && (
              <g pointerEvents="none">
                <rect
                  x={padLeft + plotWidth - medYBoxW - 4}
                  y={medYBoxY}
                  width={medYBoxW}
                  height={16}
                  rx={4}
                  fill="var(--card)"
                  fillOpacity={0.92}
                  stroke="var(--gold)"
                  strokeOpacity={0.55}
                  strokeWidth={1}
                />
                <text
                  x={padLeft + plotWidth - 8}
                  y={medYTextY}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--gold-ink)"
                  fontWeight="700"
                >
                  {medYLabelText}
                </text>
              </g>
            )}
          </g>

          {/* Plot frame border */}
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            rx={4}
            pointerEvents="none"
          />

          {/* Ticks & Values */}
          {xTicks.map((val, idx) => (
            <text
              key={`x-tick-${idx}`}
              x={scaleX(val)}
              y={padTop + plotHeight + 18}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink-soft)"
              style={{ fontVariantNumeric: "tabular-nums" }}
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
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatSandboxValue(val, yDim.format, lang, formatNumber)}
            </text>
          ))}

          {/* Axis Labels */}
          <text
            x={padLeft + plotWidth / 2}
            y={svgHeight - 10}
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
        </svg>
      </div>

      {/* Quadrant Strip & Inspector */}
      <div className="st-sandbox-bottom-grid">
        {/* 4 Quadrants Summary */}
        <div className="st-sandbox-inspector">
          <span className="st-eyebrow">{t("superTools.sandboxKicker")}</span>
          <div className="st-sandbox-quad-grid">
            <button
              type="button"
              className={`st-sandbox-quad-card${zoomQuad === "topRight" ? " is-active" : ""}`}
              onClick={() =>
                setZoomQuad((q) => (q === "topRight" ? "all" : "topRight"))
              }
            >
              <span className="st-sandbox-quad-label">
                {t(QUADRANT_LABEL_KEYS.topRight)}
              </span>
              <strong className="st-sandbox-quad-count">{quadrantCounts.topRight}</strong>
            </button>
            <button
              type="button"
              className={`st-sandbox-quad-card${zoomQuad === "topLeft" ? " is-active" : ""}`}
              onClick={() =>
                setZoomQuad((q) => (q === "topLeft" ? "all" : "topLeft"))
              }
            >
              <span className="st-sandbox-quad-label">
                {t(QUADRANT_LABEL_KEYS.topLeft)}
              </span>
              <strong className="st-sandbox-quad-count">{quadrantCounts.topLeft}</strong>
            </button>
            <button
              type="button"
              className={`st-sandbox-quad-card${zoomQuad === "bottomRight" ? " is-active" : ""}`}
              onClick={() =>
                setZoomQuad((q) => (q === "bottomRight" ? "all" : "bottomRight"))
              }
            >
              <span className="st-sandbox-quad-label">
                {t(QUADRANT_LABEL_KEYS.bottomRight)}
              </span>
              <strong className="st-sandbox-quad-count">{quadrantCounts.bottomRight}</strong>
            </button>
            <button
              type="button"
              className={`st-sandbox-quad-card${zoomQuad === "bottomLeft" ? " is-active" : ""}`}
              onClick={() =>
                setZoomQuad((q) => (q === "bottomLeft" ? "all" : "bottomLeft"))
              }
            >
              <span className="st-sandbox-quad-label">
                {t(QUADRANT_LABEL_KEYS.bottomLeft)}
              </span>
              <strong className="st-sandbox-quad-count">{quadrantCounts.bottomLeft}</strong>
            </button>
          </div>
          <p className="st-cell-sub">{t("superTools.sandboxHoverHint")}</p>
        </div>

        {/* Selected Legislator Inspector Card */}
        <div className="st-sandbox-inspector">
          <span className="st-eyebrow">{t("superTools.sandboxSelectedTitle")}</span>
          {activePoint ? (
            <div className="st-sandbox-profile">
              <div className="st-sandbox-profile-head">
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
                      {t("superTools.ldShort")} {padDistrict(activePoint.district)}
                    </Link>
                    <span className="chip">
                      {chamberLabel(activePoint.chamber, lang)}
                    </span>
                  </div>
                  <h3 className="st-sandbox-profile-name">
                    <Link to={`/legislador/${activePoint.legislatorId}`}>
                      {activePoint.name}
                    </Link>
                  </h3>
                </div>
              </div>

              <div className="st-sandbox-metrics-grid">
                <div className="st-sandbox-metric-item">
                  <span className="st-sandbox-metric-label">
                    {t(DIMENSION_LABEL_KEYS[xKey])}
                  </span>
                  <strong className="st-sandbox-metric-val">
                    {formatSandboxValue(
                      activePoint.x,
                      xDim.format,
                      lang,
                      formatNumber,
                    )}
                  </strong>
                </div>
                <div className="st-sandbox-metric-item">
                  <span className="st-sandbox-metric-label">
                    {t(DIMENSION_LABEL_KEYS[yKey])}
                  </span>
                  <strong className="st-sandbox-metric-val">
                    {formatSandboxValue(
                      activePoint.y,
                      yDim.format,
                      lang,
                      formatNumber,
                    )}
                  </strong>
                </div>
              </div>

              <div className="st-sandbox-profile-foot">
                <span className="chip st-sandbox-quad-chip">
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
            <p className="st-sandbox-empty-hint">
              {t("superTools.sandboxHoverHint")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
