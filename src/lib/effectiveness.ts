import type {
  BillStage,
  BillStagesMap,
  CommitteeBottleneck,
  EffectivenessArchetype,
  Legislator,
  LegislatorEffectivenessSummary,
  PipelineStageMetric,
} from "../types";

export type {
  CommitteeBottleneck,
  EffectivenessArchetype,
  LegislatorEffectivenessSummary,
  PipelineStageMetric,
};

const STAGE_ORDER: Record<BillStage, number> = {
  introduced: 0,
  committee: 1,
  reported: 2,
  floor: 3,
  enacted: 4,
};

export const PIPELINE_STAGES: BillStage[] = [
  "introduced",
  "committee",
  "reported",
  "floor",
  "enacted",
];

/**
 * Distinguishes substantive Senate/Assembly bills from legislative resolutions.
 * Substantive: A123, S456. Non-substantive: AR, SR, ACR, SCR, AJR, SJR.
 */
export function isSubstantiveBillCode(billCode: string | null | undefined): boolean {
  if (!billCode || typeof billCode !== "string") return false;
  return /^(A|S)\d+$/i.test(billCode.trim());
}

/**
 * Returns ordinal index for pipeline stages (0 = introduced ... 4 = enacted).
 */
export function stageOrderIndex(stage: BillStage): number {
  return STAGE_ORDER[stage] ?? 0;
}

/**
 * Builds the cumulative pipeline funnel for substantive bills statewide or by chamber.
 */
export function buildPipelineFunnel(
  billStages: BillStagesMap,
  chamberFilter?: "Senate" | "Assembly",
): { total: number; stages: PipelineStageMetric[] } {
  const entries = Object.values(billStages ?? {}).filter((entry) => {
    if (!entry) return false;
    const isSub = entry.isSubstantive ?? isSubstantiveBillCode(entry.bill);
    if (!isSub) return false;
    if (chamberFilter === "Senate") {
      return entry.bill.toUpperCase().startsWith("S");
    }
    if (chamberFilter === "Assembly") {
      return entry.bill.toUpperCase().startsWith("A");
    }
    return true;
  });

  const total = entries.length;

  const stages: PipelineStageMetric[] = PIPELINE_STAGES.map((stage) => {
    const targetIndex = stageOrderIndex(stage);
    let currentCount = 0;
    let reachedCount = 0;

    for (const entry of entries) {
      const entryIndex = stageOrderIndex(entry.stage);
      if (entry.stage === stage) {
        currentCount++;
      }
      if (entryIndex >= targetIndex) {
        reachedCount++;
      }
    }

    const reachedPct =
      total > 0 ? Math.round((reachedCount / total) * 1000) / 10 : 0;

    return {
      stage,
      currentCount,
      reachedCount,
      reachedPct,
    };
  });

  return { total, stages };
}

/**
 * Identifies committee-level legislative bottlenecks by tracking substantive bills
 * held in committee vs advanced past committee.
 */
export function buildCommitteeBottlenecks(
  billStages: BillStagesMap,
  legislators: Legislator[],
): CommitteeBottleneck[] {
  const committeeMap = new Map<
    string,
    { name: string; chamber: "Senate" | "Assembly" | "Other" }
  >();

  for (const leg of legislators ?? []) {
    for (const comm of leg.committees ?? []) {
      if (comm.code && !committeeMap.has(comm.code)) {
        let chamber: "Senate" | "Assembly" | "Other" = "Other";
        if (comm.code.startsWith("S")) chamber = "Senate";
        else if (comm.code.startsWith("A")) chamber = "Assembly";
        committeeMap.set(comm.code, {
          name: comm.name || comm.code,
          chamber,
        });
      }
    }
  }

  const statsMap = new Map<
    string,
    {
      held: number;
      advanced: number;
      name: string;
      chamber: "Senate" | "Assembly" | "Other";
    }
  >();

  for (const entry of Object.values(billStages ?? {})) {
    if (!entry) continue;
    const isSub = entry.isSubstantive ?? isSubstantiveBillCode(entry.bill);
    if (!isSub) continue;
    const code = entry.committeeCode?.trim();
    if (!code) continue;

    let record = statsMap.get(code);
    if (!record) {
      const info = committeeMap.get(code);
      let chamber: "Senate" | "Assembly" | "Other" = info?.chamber ?? "Other";
      if (chamber === "Other") {
        if (code.startsWith("S")) chamber = "Senate";
        else if (code.startsWith("A")) chamber = "Assembly";
      }
      record = {
        held: 0,
        advanced: 0,
        name: info?.name || code,
        chamber,
      };
      statsMap.set(code, record);
    }

    const stageIdx = stageOrderIndex(entry.stage);
    if (entry.stage === "committee") {
      record.held++;
    } else if (stageIdx >= 2) {
      record.advanced++;
    }
  }

  const bottlenecks: CommitteeBottleneck[] = [];
  for (const [code, stat] of statsMap.entries()) {
    const totalSeenCount = stat.held + stat.advanced;
    if (totalSeenCount === 0) continue;
    const advancementRatePct =
      totalSeenCount > 0
        ? Math.round((stat.advanced / totalSeenCount) * 1000) / 10
        : 0;

    bottlenecks.push({
      committeeCode: code,
      committeeName: stat.name,
      chamber: stat.chamber,
      heldInCommitteeCount: stat.held,
      advancedCount: stat.advanced,
      totalSeenCount,
      advancementRatePct,
    });
  }

  bottlenecks.sort(
    (a, b) =>
      b.heldInCommitteeCount - a.heldInCommitteeCount ||
      b.totalSeenCount - a.totalSeenCount,
  );

  return bottlenecks;
}

/**
 * Classifies legislator into nonpartisan descriptive archetypes based on
 * empirical floor progression, substantive breadth, and bipartisan sponsorship.
 */
export function classifyEffectivenessArchetype(input: {
  lesScore: number;
  primarySubstantive: number;
  primaryReportedPlus: number;
  primaryFloorPlus: number;
  primaryEnacted: number;
  cosponsoredSubstantive: number;
  advancementRatePct: number;
  bipartisanRatePct: number;
  topTwoTopicSharePct: number;
}): EffectivenessArchetype {
  const {
    lesScore,
    primarySubstantive,
    primaryReportedPlus,
    primaryFloorPlus,
    primaryEnacted,
    cosponsoredSubstantive,
    advancementRatePct,
    bipartisanRatePct,
    topTwoTopicSharePct,
  } = input;

  // 1. High Throughput
  if (
    lesScore >= 55 &&
    (primaryEnacted >= 1 || primaryFloorPlus >= 3 || primaryReportedPlus >= 5)
  ) {
    return "high_throughput";
  }

  // 2. Policy Specialist
  if (
    primarySubstantive >= 5 &&
    (advancementRatePct >= 12 || topTwoTopicSharePct >= 55)
  ) {
    return "policy_specialist";
  }

  // 3. Coalition Builder
  if (bipartisanRatePct >= 25 || cosponsoredSubstantive >= 25) {
    return "coalition_builder";
  }

  // 4. Developing (fallback)
  return "developing";
}

/**
 * Computes raw effectiveness points and bill progression milestones for a single legislator.
 */
export function computeRawLegislatorPoints(
  legislator: Legislator,
  billStages: BillStagesMap,
): {
  rawPoints: number;
  primarySubstantive: number;
  cosponsoredSubstantive: number;
  primaryCommitteePlus: number;
  primaryReportedPlus: number;
  primaryFloorPlus: number;
  primaryEnacted: number;
  cosponsoredEnacted: number;
  advancementRatePct: number;
} {
  let primarySubstantive = 0;
  let cosponsoredSubstantive = 0;
  let primaryCommitteePlus = 0;
  let primaryReportedPlus = 0;
  let primaryFloorPlus = 0;
  let primaryEnacted = 0;
  let cosponsoredEnacted = 0;

  let primaryPoints = 0;
  let cosponsoredPoints = 0;

  for (const [billCode, type] of legislator.bills ?? []) {
    if (!isSubstantiveBillCode(billCode)) continue;
    const stageEntry = billStages?.[billCode];
    const stage = stageEntry?.stage ?? "introduced";
    const stageIdx = stageOrderIndex(stage);

    if (type === "P") {
      primarySubstantive++;
      if (stageIdx >= 1) primaryCommitteePlus++;
      if (stageIdx >= 2) primaryReportedPlus++;
      if (stageIdx >= 3) primaryFloorPlus++;
      if (stageIdx >= 4) primaryEnacted++;

      // Primary bill weights: introduced=0.5, committee=1, reported=3, floor=6, enacted=12
      if (stage === "introduced") {
        primaryPoints += 0.5;
      } else if (stage === "committee") {
        primaryPoints += 1.0;
      } else if (stage === "reported") {
        primaryPoints += 3.0;
      } else if (stage === "floor") {
        primaryPoints += 6.0;
      } else if (stage === "enacted") {
        primaryPoints += 12.0;
      }
    } else if (type === "C") {
      cosponsoredSubstantive++;
      if (stageIdx >= 4) cosponsoredEnacted++;

      // Co-sponsored bill weights: reported=0.15, floor=0.3, enacted=0.6
      if (stage === "reported") {
        cosponsoredPoints += 0.15;
      } else if (stage === "floor") {
        cosponsoredPoints += 0.3;
      } else if (stage === "enacted") {
        cosponsoredPoints += 0.6;
      }
    }
  }

  // Cosponsor points cap at 15 points
  const cappedCosponsorPoints = Math.min(cosponsoredPoints, 15);
  const rawPoints =
    Math.round((primaryPoints + cappedCosponsorPoints) * 100) / 100;

  const advancementRatePct =
    primarySubstantive > 0
      ? Math.round((primaryReportedPlus / primarySubstantive) * 1000) / 10
      : 0;

  return {
    rawPoints,
    primarySubstantive,
    cosponsoredSubstantive,
    primaryCommitteePlus,
    primaryReportedPlus,
    primaryFloorPlus,
    primaryEnacted,
    cosponsoredEnacted,
    advancementRatePct,
  };
}

/**
 * Computes chamber-normalized Legislative Effectiveness Scores (LES: 0-100)
 * and classifies nonpartisan archetypes for all legislators.
 */
export function computeChamberNormalizedEffectiveness(
  legislators: Legislator[],
  billStages: BillStagesMap,
  extrasById?: Map<
    number,
    { bipartisanRatePct: number; topTwoTopicSharePct: number }
  >,
): Map<number, LegislatorEffectivenessSummary> {
  const rawMap = new Map<
    number,
    ReturnType<typeof computeRawLegislatorPoints>
  >();

  let maxSenateRaw = 0;
  let maxAssemblyRaw = 0;

  for (const leg of legislators) {
    const pts = computeRawLegislatorPoints(leg, billStages);
    rawMap.set(leg.id, pts);

    if (leg.chamber === "Senate") {
      if (pts.rawPoints > maxSenateRaw) maxSenateRaw = pts.rawPoints;
    } else if (leg.chamber === "Assembly") {
      if (pts.rawPoints > maxAssemblyRaw) maxAssemblyRaw = pts.rawPoints;
    }
  }

  const result = new Map<number, LegislatorEffectivenessSummary>();

  for (const leg of legislators) {
    const pts = rawMap.get(leg.id)!;
    const chamberMax = leg.chamber === "Senate" ? maxSenateRaw : maxAssemblyRaw;

    const lesScore =
      chamberMax > 0
        ? Math.min(100, Math.max(0, Math.round((pts.rawPoints / chamberMax) * 100)))
        : 0;

    const extras = extrasById?.get(leg.id) ?? {
      bipartisanRatePct: 0,
      topTwoTopicSharePct: 0,
    };

    const archetype = classifyEffectivenessArchetype({
      lesScore,
      primarySubstantive: pts.primarySubstantive,
      primaryReportedPlus: pts.primaryReportedPlus,
      primaryFloorPlus: pts.primaryFloorPlus,
      primaryEnacted: pts.primaryEnacted,
      cosponsoredSubstantive: pts.cosponsoredSubstantive,
      advancementRatePct: pts.advancementRatePct,
      bipartisanRatePct: extras.bipartisanRatePct,
      topTwoTopicSharePct: extras.topTwoTopicSharePct,
    });

    result.set(leg.id, {
      legislatorId: leg.id,
      primarySubstantive: pts.primarySubstantive,
      cosponsoredSubstantive: pts.cosponsoredSubstantive,
      primaryCommitteePlus: pts.primaryCommitteePlus,
      primaryReportedPlus: pts.primaryReportedPlus,
      primaryFloorPlus: pts.primaryFloorPlus,
      primaryEnacted: pts.primaryEnacted,
      cosponsoredEnacted: pts.cosponsoredEnacted,
      advancementRatePct: pts.advancementRatePct,
      rawPoints: pts.rawPoints,
      lesScore,
      archetype,
    });
  }

  return result;
}
