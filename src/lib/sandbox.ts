import type {
  DistrictDemographics,
  Legislator,
  LegislatorEffectivenessSummary,
  LegislatorInfluenceSummary,
  LegislatorVoteStats,
  SandboxDimensionDef,
  SandboxMetricKey,
  SandboxScatterPoint,
  SandboxScatterResult,
} from "../types";

export type {
  SandboxDimensionDef,
  SandboxMetricKey,
  SandboxScatterPoint,
  SandboxScatterResult,
};

/**
 * Registry of 12 quantitative dimensions for civic, demographic, finance, and voting analysis.
 */
export const SANDBOX_DIMENSIONS: SandboxDimensionDef[] = [
  { key: "totalRaised", format: "currency" },
  { key: "grassrootsPct", format: "percent" },
  { key: "lesScore", format: "score" },
  { key: "bipartisanRate", format: "percent" },
  { key: "attendancePct", format: "percent" },
  { key: "partyUnityPct", format: "percent" },
  { key: "primaryBills", format: "count" },
  { key: "enactedBills", format: "count" },
  { key: "medianIncome", format: "currency" },
  { key: "medianRent", format: "currency" },
  { key: "transitCommuteRate", format: "percent" },
  { key: "homeownershipRate", format: "percent" },
];

/**
 * Minimal structurally-typed row interface compatible with LegislatorMatrixRow
 * without circular runtime imports.
 */
export interface SandboxRowInput {
  legislator:
    | Legislator
    | {
        id: number;
        fullName?: string;
        name?: string;
        party: string;
        chamber: "Senate" | "Assembly" | string;
        district: number;
        photo?: string | null;
      };
  totalBills?: number;
  primaryBills?: number;
  enactedBills?: number;
  bipartisanRate?: number;
  totalRaised?: number;
  medianIncome?: number;
  demographics?: DistrictDemographics | null;
  influenceSummary?:
    | LegislatorInfluenceSummary
    | {
        totalRaised?: number;
        grassrootsPct?: number;
      }
    | null;
  effectivenessSummary?:
    | LegislatorEffectivenessSummary
    | {
        lesScore?: number;
        primarySubstantive?: number;
        primaryEnacted?: number;
        cosponsoredEnacted?: number;
      }
    | null;
  voteStats?:
    | LegislatorVoteStats
    | {
        attendancePct?: number;
        partyUnityPct?: number;
      }
    | null;
}

/**
 * Safely extracts numeric value for any sandbox metric key, falling back to 0 without NaN.
 */
export function extractSandboxMetric(
  row: SandboxRowInput,
  key: SandboxMetricKey,
): number {
  if (!row) return 0;
  let val = 0;
  switch (key) {
    case "totalRaised":
      val = row.totalRaised ?? row.influenceSummary?.totalRaised ?? 0;
      break;
    case "grassrootsPct":
      val = row.influenceSummary?.grassrootsPct ?? 0;
      break;
    case "lesScore":
      val = row.effectivenessSummary?.lesScore ?? 0;
      break;
    case "bipartisanRate":
      val = row.bipartisanRate ?? 0;
      break;
    case "attendancePct":
      val = row.voteStats?.attendancePct ?? 0;
      break;
    case "partyUnityPct":
      val = row.voteStats?.partyUnityPct ?? 0;
      break;
    case "primaryBills":
      val = row.primaryBills ?? row.effectivenessSummary?.primarySubstantive ?? 0;
      break;
    case "enactedBills":
      val =
        row.enactedBills ??
        row.effectivenessSummary?.primaryEnacted ??
        0;
      break;
    case "medianIncome":
      val = row.demographics?.medianIncome ?? row.medianIncome ?? 0;
      break;
    case "medianRent":
      val = row.demographics?.medianRent ?? 0;
      break;
    case "transitCommuteRate":
      val = row.demographics?.transitCommuteRate ?? 0;
      break;
    case "homeownershipRate":
      val = row.demographics?.homeownershipRate ?? 0;
      break;
  }
  return Number.isFinite(val) ? val : 0;
}

/**
 * Computes deterministic sorted median (returns 0 if empty).
 */
export function computeMedian(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return 0;
  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Computes sample Pearson correlation coefficient r, clamped to [-1, 1], rounded to 3 decimal places.
 * Returns 0 cleanly on zero-variance, n < 2, or non-finite inputs (never NaN or Infinity).
 */
export function computePearsonCorrelation(
  points: Array<{ x: number; y: number }>,
): number {
  if (!points || points.length < 2) return 0;

  const cleanPoints = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  const n = cleanPoints.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  for (const p of cleanPoints) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let sumSqX = 0;
  let sumSqY = 0;
  let sumProd = 0;

  for (const p of cleanPoints) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
    sumProd += dx * dy;
  }

  if (sumSqX === 0 || sumSqY === 0) return 0;

  const denom = Math.sqrt(sumSqX * sumSqY);
  if (denom <= 0 || !Number.isFinite(denom)) return 0;

  const r = sumProd / denom;
  if (!Number.isFinite(r)) return 0;

  const clamped = Math.max(-1, Math.min(1, r));
  const rounded = Math.round(clamped * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export interface SandboxScatterFilters {
  chamber?: "All" | "Senate" | "Assembly" | string;
  party?: "All" | "D" | "R" | string;
  district?: number | null;
}

/**
 * Builds filtered 2D scatter plot result with median split quadrants and Pearson correlation.
 */
export function buildSandboxScatter(
  rows: SandboxRowInput[],
  xKey: SandboxMetricKey,
  yKey: SandboxMetricKey,
  filters?: SandboxScatterFilters,
): SandboxScatterResult {
  const filteredRows = (rows ?? []).filter((row) => {
    if (!row || !row.legislator) return false;
    if (filters?.chamber && filters.chamber !== "All") {
      if (row.legislator.chamber !== filters.chamber) return false;
    }
    if (filters?.party && filters.party !== "All") {
      if (row.legislator.party !== filters.party) return false;
    }
    if (filters?.district != null && filters.district !== undefined) {
      if (row.legislator.district !== filters.district) return false;
    }
    return true;
  });

  const rawPoints = filteredRows.map((row) => {
    const x = extractSandboxMetric(row, xKey);
    const y = extractSandboxMetric(row, yKey);
    return {
      row,
      x,
      y,
    };
  });

  const medianX = computeMedian(rawPoints.map((p) => p.x));
  const medianY = computeMedian(rawPoints.map((p) => p.y));

  const points: SandboxScatterPoint[] = rawPoints.map(({ row, x, y }) => {
    const isRight = x >= medianX;
    const isTop = y >= medianY;
    let quadrant: SandboxScatterPoint["quadrant"];
    if (isTop && isRight) {
      quadrant = "topRight";
    } else if (isTop && !isRight) {
      quadrant = "topLeft";
    } else if (!isTop && isRight) {
      quadrant = "bottomRight";
    } else {
      quadrant = "bottomLeft";
    }

    const leg = row.legislator;
    const name = (leg as any).fullName || (leg as any).name || "";

    return {
      legislatorId: leg.id,
      name,
      party: leg.party,
      chamber: leg.chamber,
      district: leg.district,
      photo: leg.photo ?? null,
      x,
      y,
      quadrant,
    };
  });

  const pearsonR = computePearsonCorrelation(points);

  return {
    xKey,
    yKey,
    points,
    medianX,
    medianY,
    pearsonR,
  };
}
