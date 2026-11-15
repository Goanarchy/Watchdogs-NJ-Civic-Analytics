import { useCallback, useEffect, useRef, useState } from "react";
import { meta } from "../data";
import type { LegislatorMatrixRow } from "../lib/analytics";
import { useI18n, type CopyKey } from "../lib/i18n";
import { chamberLabel, padDistrict, partyLabel, roleLabel } from "../lib/labels";
import type { ChamberBenchmark, DonorSectorKey } from "../types";

export interface DossierCardGeneratorProps {
  row: LegislatorMatrixRow;
  benchmarks: ChamberBenchmark;
}

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

function initials(name: string): string {
  return name
    .replace(/["“”]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatCompactMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${Math.round(value)}`;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function loadSafeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => {
      reject(new Error("Image timeout"));
    }, 2000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Image load error"));
    };
    img.src = url;
  });
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.03 8.22a.75.75 0 0 0-1.06 1.06l4.25 4.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0-1.06-1.06l-3.22 3.22V2.75Z" />
      <path d="M3.5 14.75a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H4.25a.75.75 0 0 1-.75-.75Z" />
      <path d="M3.5 17.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H4.25a.75.75 0 0 1-.75-.75Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
    </svg>
  );
}

export function DossierCardGenerator({ row, benchmarks }: DossierCardGeneratorProps) {
  const { t, lang } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
    };
  }, []);

  const renderCard = useCallback(
    (
      canvas: HTMLCanvasElement,
      forceMonogram: boolean = false,
      preloadedImage: HTMLImageElement | null = null,
    ) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = 1200;
      const H = 630;

      // 1. Clear & Fill Background
      ctx.clearRect(0, 0, W, H);
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, "#080e1b");
      bgGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Outer border
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);

      // 2. Top Branding Bar
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("WATCHDOGS MEDIA · CIVIC LAB", 50, 36);

      ctx.fillStyle = "#64748b";
      ctx.font = "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`·  ${meta.sessionLabel}`, 280, 36);

      // Nonpartisan Badge Pill
      const nonpartisanText =
        lang === "es"
          ? "EXPEDIENTE CÍVICO OBJETIVO Y NO PARTIDISTA"
          : "NONPARTISAN OBJECTIVE CIVIC DOSSIER";
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const pillWidth = ctx.measureText(nonpartisanText).width + 28;
      const pillX = 1150 - pillWidth;

      ctx.beginPath();
      drawRoundRect(ctx, pillX, 23, pillWidth, 26, 13);
      ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pillX + 13, 36, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#34d399";
      ctx.fill();

      ctx.fillStyle = "#6ee7b7";
      ctx.textAlign = "left";
      ctx.fillText(nonpartisanText, pillX + 22, 36);

      // 3. Legislator Identity
      const isDem = row.legislator.party === "D";
      const isRep = row.legislator.party === "R";
      const partyColor = isDem ? "#2563eb" : isRep ? "#dc2626" : "#64748b";
      const partyBg = isDem ? "#1e3a8a" : isRep ? "#7f1d1d" : "#334155";

      const portraitCx = 100;
      const portraitCy = 126;
      const portraitR = 44;

      if (preloadedImage && !forceMonogram) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(portraitCx, portraitCy, portraitR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          preloadedImage,
          portraitCx - portraitR,
          portraitCy - portraitR,
          portraitR * 2,
          portraitR * 2,
        );
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(portraitCx, portraitCy, portraitR, 0, Math.PI * 2);
        ctx.fillStyle = partyBg;
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials(row.legislator.fullName), portraitCx, portraitCy);
      }

      // Portrait ring
      ctx.beginPath();
      ctx.arc(portraitCx, portraitCy, portraitR, 0, Math.PI * 2);
      ctx.strokeStyle = partyColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Info Column
      const textLeft = 168;

      // Party Tag Pill
      const partyText = partyLabel(row.legislator.party, lang).toUpperCase();
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const partyPillW = ctx.measureText(partyText).width + 16;
      ctx.beginPath();
      drawRoundRect(ctx, textLeft, 90, partyPillW, 20, 10);
      ctx.fillStyle = isDem ? "#1d4ed8" : isRep ? "#b91c1c" : "#475569";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(partyText, textLeft + 8, 100);

      // Chamber Tag Pill
      const chamberText = chamberLabel(row.legislator.chamber, lang).toUpperCase();
      const chamberPillW = ctx.measureText(chamberText).width + 16;
      const chamberPillX = textLeft + partyPillW + 8;
      ctx.beginPath();
      drawRoundRect(ctx, chamberPillX, 90, chamberPillW, 20, 10);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(chamberText, chamberPillX + 8, 100);

      // District Tag Pill
      const distText = `LD ${padDistrict(row.legislator.district)}`;
      const distPillW = ctx.measureText(distText).width + 16;
      const distPillX = chamberPillX + chamberPillW + 8;
      ctx.beginPath();
      drawRoundRect(ctx, distPillX, 90, distPillW, 20, 10);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(distText, distPillX + 8, 100);

      // Full Name
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(row.legislator.fullName, textLeft, 142);

      // Sub-line
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 13.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const counties = row.legislator.districtInfo?.countiesLabel
        ? ` · ${row.legislator.districtInfo.countiesLabel}`
        : "";
      const role = roleLabel(row.legislator.chamber, lang);
      const districtLabel = `${t("common.district")} ${padDistrict(row.legislator.district)}`;
      ctx.fillText(
        `${role} · ${districtLabel}${counties}`,
        textLeft,
        165,
      );

      // 4. Divider
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 195);
      ctx.lineTo(1150, 195);
      ctx.stroke();

      // 5. 6 Objective KPI Stat Tiles
      const tileW = 348;
      const tileH = 134;
      const colX = [50, 426, 802];
      const rowY = [215, 368];

      const renderTile = (
        col: number,
        rIdx: number,
        title: string,
        value: string,
        valColor: string,
        benchText: string,
        barVal?: number,
        benchMarker?: number,
      ) => {
        const x = colX[col];
        const y = rowY[rIdx];

        ctx.beginPath();
        drawRoundRect(ctx, x, y, tileW, tileH, 8);
        ctx.fillStyle = "#0c1424";
        ctx.fill();
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Title
        ctx.fillStyle = "#94a3b8";
        ctx.font = "700 11.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(title, x + 18, y + 15);

        // Value
        ctx.fillStyle = valColor;
        ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(value, x + 18, y + 36);

        // Comparison text
        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(benchText, x + 18, y + 74);

        // Progress bar
        if (typeof barVal === "number") {
          const trackX = x + 18;
          const trackY = y + 102;
          const trackW = tileW - 36;
          const trackH = 8;

          ctx.beginPath();
          drawRoundRect(ctx, trackX, trackY, trackW, trackH, 4);
          ctx.fillStyle = "#1e293b";
          ctx.fill();

          const clampedVal = Math.min(100, Math.max(0, barVal));
          const fillW = Math.max(clampedVal > 0 ? 5 : 0, (clampedVal / 100) * trackW);
          if (fillW > 0) {
            ctx.beginPath();
            drawRoundRect(ctx, trackX, trackY, fillW, trackH, 4);
            ctx.fillStyle = valColor;
            ctx.fill();
          }

          if (typeof benchMarker === "number") {
            const clampedBench = Math.min(100, Math.max(0, benchMarker));
            const markerX = trackX + (clampedBench / 100) * trackW;
            ctx.fillStyle = "#fbbf24";
            ctx.fillRect(markerX - 1.25, trackY - 3, 2.5, trackH + 6);
          }
        }
      };

      // Tile 1: LES
      renderTile(
        0,
        0,
        lang === "es" ? "EFECTIVIDAD LEGISLATIVA (LES)" : "LEGISLATIVE EFFECTIVENESS (LES)",
        `${row.effectivenessSummary.lesScore} / 100`,
        "#38bdf8",
        lang === "es"
          ? `Promedio cámara: ${benchmarks.avgLes} / 100`
          : `Chamber avg: ${benchmarks.avgLes} / 100`,
        row.effectivenessSummary.lesScore,
        benchmarks.avgLes,
      );

      // Tile 2: Attendance
      renderTile(
        1,
        0,
        lang === "es" ? "ASISTENCIA A VOTACIONES" : "FLOOR VOTE ATTENDANCE",
        `${row.voteStats.attendancePct}%`,
        "#4ade80",
        lang === "es"
          ? `Promedio cámara: ${benchmarks.avgAttendancePct}%`
          : `Chamber avg: ${benchmarks.avgAttendancePct}%`,
        row.voteStats.attendancePct,
        benchmarks.avgAttendancePct,
      );

      // Tile 3: Bipartisan Rate
      renderTile(
        2,
        0,
        lang === "es" ? "PATROCINIO BIPARTIDISTA" : "BIPARTISAN SPONSORSHIP",
        `${row.bipartisanRate}%`,
        "#a78bfa",
        lang === "es"
          ? `Promedio cámara: ${benchmarks.avgBipartisanRatePct}%`
          : `Chamber avg: ${benchmarks.avgBipartisanRatePct}%`,
        row.bipartisanRate,
        benchmarks.avgBipartisanRatePct,
      );

      // Tile 4: Grassroots
      renderTile(
        0,
        1,
        lang === "es" ? "DONACIONES DE BASE (GRASSROOTS)" : "INDIVIDUAL GRASSROOTS SHARE",
        `${row.influenceSummary.grassrootsPct}%`,
        "#38bdf8",
        lang === "es"
          ? `Promedio cámara: ${benchmarks.avgGrassrootsPct}%`
          : `Chamber avg: ${benchmarks.avgGrassrootsPct}%`,
        row.influenceSummary.grassrootsPct,
        benchmarks.avgGrassrootsPct,
      );

      // Tile 5: Pocketbook Overall
      renderTile(
        1,
        1,
        lang === "es" ? "ÍNDICE DE COSTO DE VIDA" : "POCKETBOOK IMPACT INDEX",
        `${row.pocketbookSummary.overallScore} / 100`,
        "#fbbf24",
        lang === "es" ? "Impuestos · Vivienda · Tránsito" : "Property Tax · Housing · Transit",
        row.pocketbookSummary.overallScore,
      );

      // Tile 6: Campaign Raised
      renderTile(
        2,
        1,
        lang === "es" ? "FONDOS DE CAMPAÑA (ELEC)" : "ELEC CAMPAIGN FUNDS RAISED",
        formatCompactMoney(row.totalRaised),
        "#f8fafc",
        lang === "es"
          ? `Promedio: ${formatCompactMoney(benchmarks.avgTotalRaised)} · ${row.donorCount} donantes`
          : `Chamber avg: ${formatCompactMoney(benchmarks.avgTotalRaised)} · ${row.donorCount} donors`,
      );

      // 6. Footer
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 524);
      ctx.lineTo(1150, 524);
      ctx.stroke();

      // Top Sector Pill
      const topSector = row.influenceSummary.topSectors[0];
      const sectorKey = topSector?.sector ? SECTOR_LABEL_KEYS[topSector.sector] : undefined;
      const sectorName = sectorKey ? t(sectorKey) : t("superTools.sector.civic_grassroots");
      const sectorPct = topSector?.pct ?? 0;
      const sectorLabel = `${lang === "es" ? "Sector líder" : "Top Donor Sector"}: ${sectorName} (${sectorPct}%)`;

      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const sPillW = ctx.measureText(sectorLabel).width + 22;
      ctx.beginPath();
      drawRoundRect(ctx, 50, 545, sPillW, 26, 6);
      ctx.fillStyle = "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.textBaseline = "middle";
      ctx.fillText(sectorLabel, 61, 558);

      // Data Sources
      ctx.fillStyle = "#64748b";
      ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "right";
      const srcText =
        lang === "es"
          ? "Fuentes: NJLeg (Oficial) · NJ ELEC · Censo EE.UU. ACS · Registro Cívico Objetivo"
          : "Data: NJLeg (Official) · NJ ELEC · U.S. Census ACS · 100% Nonpartisan Record";
      ctx.fillText(srcText, 1150, 558);
    },
    [benchmarks, lang, row, t],
  );

  // Preview renderer with async cleanup token and scratch pre-flight CORS safety check
  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderPreview = async () => {
      let imageToDraw: HTMLImageElement | null = null;

      if (row.legislator.photo) {
        try {
          const img = await loadSafeImage(row.legislator.photo);
          if (!active) return;

          // Test drawing onto a scratch 1x1 canvas to detect origin taint safely
          const scratch = document.createElement("canvas");
          scratch.width = 1;
          scratch.height = 1;
          const sCtx = scratch.getContext("2d");
          if (sCtx) {
            sCtx.drawImage(img, 0, 0, 1, 1);
            scratch.toDataURL(); // Throws SecurityError if tainted
            imageToDraw = img;
          }
        } catch {
          imageToDraw = null; // CORS failed or image load error -> fallback to clean monogram
        }
      }

      if (!active) return;
      renderCard(canvas, imageToDraw === null, imageToDraw);
    };

    renderPreview();

    return () => {
      active = false;
    };
  }, [renderCard, row.legislator.photo]);

  const handleDownloadPng = useCallback(() => {
    setDownloading(true);

    const safeLastName = (
      row.legislator.lastName ||
      row.legislator.fullName.split(" ").pop() ||
      "Legislator"
    ).replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `NJ_Dossier_${safeLastName}_LD${row.legislator.district}.png`;

    const triggerDownload = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setDownloading(false);
      setExportReady(true);
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      exportTimerRef.current = setTimeout(() => setExportReady(false), 2500);
    };

    // Fallback export function that creates a fresh untainted offscreen canvas
    const fallbackExport = () => {
      const fallbackCanvas = document.createElement("canvas");
      fallbackCanvas.width = 1200;
      fallbackCanvas.height = 630;
      renderCard(fallbackCanvas, true, null);
      try {
        fallbackCanvas.toBlob((blob) => {
          if (blob) {
            triggerDownload(blob);
          } else {
            setDownloading(false);
          }
        }, "image/png");
      } catch {
        setDownloading(false);
      }
    };

    // Primary export attempt on a dedicated fresh offscreen canvas
    const primaryCanvas = document.createElement("canvas");
    primaryCanvas.width = 1200;
    primaryCanvas.height = 630;

    if (row.legislator.photo) {
      loadSafeImage(row.legislator.photo)
        .then((img) => {
          renderCard(primaryCanvas, false, img);
          try {
            // Preflight to detect taint
            primaryCanvas.toDataURL();
            primaryCanvas.toBlob((blob) => {
              if (blob) triggerDownload(blob);
              else fallbackExport();
            }, "image/png");
          } catch {
            fallbackExport();
          }
        })
        .catch(() => {
          fallbackExport();
        });
    } else {
      fallbackExport();
    }
  }, [renderCard, row]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2500);
    }
  }, []);

  return (
    <div className="st-dossier-panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">{t("profile.v3BenchKicker")}</p>
          <h2>{t("profile.v3DossierTitle")}</h2>
        </div>
      </div>
      <p className="panel-intro">{t("profile.v3DossierSub")}</p>

      <div className="st-dossier-preview">
        <canvas
          ref={canvasRef}
          width={1200}
          height={630}
          className="st-dossier-card"
          style={{
            maxWidth: "100%",
            height: "auto",
            borderRadius: "var(--radius)",
            display: "block",
          }}
          aria-label={`${row.legislator.fullName} · ${t("profile.v3DossierTitle")}`}
        />
      </div>

      <div className="st-dossier-actions">
        <button
          type="button"
          className="st-dossier-btn btn-primary"
          onClick={handleDownloadPng}
          disabled={downloading}
          aria-label={t("profile.v3DownloadPng")}
        >
          <DownloadIcon />
          <span>
            {downloading
              ? t("profile.v3Downloading")
              : exportReady
                ? t("profile.v3ExportReady")
                : t("profile.v3DownloadPng")}
          </span>
        </button>

        <button
          type="button"
          className="st-dossier-btn btn-secondary"
          onClick={handleCopyLink}
          aria-label={t("profile.v3CopyLink")}
        >
          <LinkIcon />
          <span>{copied ? t("profile.v3Copied") : t("profile.v3CopyLink")}</span>
        </button>
      </div>
    </div>
  );
}
