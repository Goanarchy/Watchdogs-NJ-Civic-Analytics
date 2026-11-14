import type {
  Bill,
  BillStagesMap,
  Legislator,
  LegislatorPocketbookSummary,
  PocketbookDomainKey,
  PocketbookDomainScore,
  PocketbookVoteRecord,
  RollCallEvent,
  VoteChoice,
} from "../types";

export type {
  PocketbookDomainKey,
  PocketbookDomainScore,
  PocketbookVoteRecord,
  LegislatorPocketbookSummary,
};

export const POCKETBOOK_DOMAINS: PocketbookDomainKey[] = [
  "property_tax",
  "housing",
  "transit",
];

export const POCKETBOOK_PATTERNS: Record<PocketbookDomainKey, RegExp> = {
  property_tax:
    /property tax|tax relief|anchor|homestead|stay nj|senior freeze|tax credit|taxation|levy|assessment|budget|appropriat/i,
  housing:
    /housing|rent|tenant|landlord|evict|mortgage|foreclos|afforda|zoning|fair share|shelter/i,
  transit:
    /transit|rail|bus\b|highway|bridge|roadway|motor vehicle|mvc|tunnel|port authority|nj transit|commut|transportation|infrastructure/i,
};

/**
 * Classifies input text (bill synopsis or roll-call abstract) against the 3 Pocketbook domains.
 * Returns array of matched domains in canonical order (can match multiple).
 */
export function classifyPocketbookDomains(
  text: string | null | undefined,
): PocketbookDomainKey[] {
  if (!text || typeof text !== "string") return [];
  const matched: PocketbookDomainKey[] = [];
  for (const domain of POCKETBOOK_DOMAINS) {
    if (POCKETBOOK_PATTERNS[domain].test(text)) {
      matched.push(domain);
    }
  }
  return matched;
}

/**
 * Returns primary matched domain or null.
 */
export function primaryPocketbookDomain(
  text: string | null | undefined,
): PocketbookDomainKey | null {
  const matched = classifyPocketbookDomains(text);
  return matched[0] ?? null;
}

interface RawDomainAccumulator {
  domain: PocketbookDomainKey;
  primaryBills: number;
  cosponsoredBills: number;
  advancedBills: number;
  enactedBills: number;
  floorVotesCast: number;
  yeaVotes: number;
  nayVotes: number;
  primaryPoints: number;
  cosponsoredPoints: number;
  votePoints: number;
  rawTotal: number;
}

function emptyAccumulator(domain: PocketbookDomainKey): RawDomainAccumulator {
  return {
    domain,
    primaryBills: 0,
    cosponsoredBills: 0,
    advancedBills: 0,
    enactedBills: 0,
    floorVotesCast: 0,
    yeaVotes: 0,
    nayVotes: 0,
    primaryPoints: 0,
    cosponsoredPoints: 0,
    votePoints: 0,
    rawTotal: 0,
  };
}

/**
 * Computes 100% objective Pocketbook Impact Summaries across all legislators
 * paired with official floor roll-call voting records. Zero editorial grades.
 */
export function computePocketbookSummaries(
  legislators: Legislator[],
  billsByCode: Record<string, Bill>,
  billStages: BillStagesMap,
  rollCalls: RollCallEvent[],
): {
  summariesById: Map<number, LegislatorPocketbookSummary>;
  domainRollCallCounts: Record<PocketbookDomainKey, number>;
} {
  // 1. Pre-classify bills
  const billDomainsMap = new Map<string, PocketbookDomainKey[]>();
  for (const [code, bill] of Object.entries(billsByCode ?? {})) {
    if (!bill?.synopsis) continue;
    const domains = classifyPocketbookDomains(bill.synopsis);
    if (domains.length > 0) {
      billDomainsMap.set(code, domains);
    }
  }

  // 2. Pre-classify roll calls
  const rollCallDomainsMap = new Map<string, PocketbookDomainKey[]>();
  const domainRollCallsMap: Record<PocketbookDomainKey, RollCallEvent[]> = {
    property_tax: [],
    housing: [],
    transit: [],
  };

  const notableRollCallCandidates: RollCallEvent[] = [];

  for (const rc of rollCalls ?? []) {
    if (!rc) continue;
    const text = [rc.abstract, billsByCode?.[rc.bill]?.synopsis]
      .filter(Boolean)
      .join(" ");
    const domains = classifyPocketbookDomains(text);
    if (domains.length > 0) {
      rollCallDomainsMap.set(rc.id, domains);
      for (const d of domains) {
        domainRollCallsMap[d].push(rc);
      }
      notableRollCallCandidates.push(rc);
    }
  }

  const domainRollCallCounts: Record<PocketbookDomainKey, number> = {
    property_tax: domainRollCallsMap.property_tax.length,
    housing: domainRollCallsMap.housing.length,
    transit: domainRollCallsMap.transit.length,
  };

  // 3. For each legislator, accumulate raw metrics and points
  const rawMap = new Map<number, Record<PocketbookDomainKey, RawDomainAccumulator>>();

  for (const leg of legislators ?? []) {
    const legAcc: Record<PocketbookDomainKey, RawDomainAccumulator> = {
      property_tax: emptyAccumulator("property_tax"),
      housing: emptyAccumulator("housing"),
      transit: emptyAccumulator("transit"),
    };

    // A. Legislative bill sponsorship activity
    for (const [billCode, type] of leg.bills ?? []) {
      let domains = billDomainsMap.get(billCode);
      if (!domains || domains.length === 0) {
        const syn = billsByCode?.[billCode]?.synopsis;
        if (syn) {
          domains = classifyPocketbookDomains(syn);
          if (domains.length > 0) {
            billDomainsMap.set(billCode, domains);
          }
        }
      }
      if (!domains || domains.length === 0) continue;

      const stageEntry = billStages?.[billCode];
      const stage = stageEntry?.stage ?? "introduced";
      const isAdvanced =
        stage === "reported" || stage === "floor" || stage === "enacted";
      const isEnacted = stage === "enacted";

      for (const d of domains) {
        const acc = legAcc[d];
        if (type === "P") {
          acc.primaryBills++;
          // primary bill weights: +2 base + 3 reported/floor + 6 enacted
          if (isEnacted) {
            acc.primaryPoints += 8; // 2 base + 6 enacted
          } else if (stage === "reported" || stage === "floor") {
            acc.primaryPoints += 5; // 2 base + 3 advanced
          } else {
            acc.primaryPoints += 2; // base
          }
        } else if (type === "C") {
          acc.cosponsoredBills++;
          // cosponsored bill weights: +0.5 base + 1 advanced + 2 enacted
          let pts = 0.5;
          if (isAdvanced) pts += 1.0;
          if (isEnacted) pts += 2.0;
          acc.cosponsoredPoints += pts;
        }

        if (isAdvanced) acc.advancedBills++;
        if (isEnacted) acc.enactedBills++;
      }
    }

    // B. Floor roll-call vote participation per domain
    for (const d of POCKETBOOK_DOMAINS) {
      const acc = legAcc[d];
      for (const rc of domainRollCallsMap[d]) {
        const choice = rc.votesByLegislatorId?.[String(leg.id)];
        if (!choice) continue;

        if (choice === "Y" || choice === "N" || choice === "A") {
          acc.floorVotesCast++;
        }
        if (choice === "Y") {
          acc.yeaVotes++;
        }
        if (choice === "N") {
          acc.nayVotes++;
        }
        // Floor vote participation: +0.5 per Y or N
        if (choice === "Y" || choice === "N") {
          acc.votePoints += 0.5;
        }
      }

      // Cap cosponsor points at <= 12 and vote points at <= 10
      const cappedCosponsor = Math.min(acc.cosponsoredPoints, 12);
      const cappedVote = Math.min(acc.votePoints, 10);
      acc.rawTotal =
        Math.round((acc.primaryPoints + cappedCosponsor + cappedVote) * 100) /
        100;
    }

    rawMap.set(leg.id, legAcc);
  }

  // 4. Chamber max normalization for 0..100 objective score
  const chamberMax: Record<
    "Senate" | "Assembly",
    Record<PocketbookDomainKey, number>
  > = {
    Senate: { property_tax: 0, housing: 0, transit: 0 },
    Assembly: { property_tax: 0, housing: 0, transit: 0 },
  };

  for (const leg of legislators ?? []) {
    const chamber = leg.chamber === "Senate" ? "Senate" : "Assembly";
    const acc = rawMap.get(leg.id);
    if (!acc) continue;
    for (const d of POCKETBOOK_DOMAINS) {
      if (acc[d].rawTotal > chamberMax[chamber][d]) {
        chamberMax[chamber][d] = acc[d].rawTotal;
      }
    }
  }

  // 5. Build final summaries
  const summariesById = new Map<number, LegislatorPocketbookSummary>();

  for (const leg of legislators ?? []) {
    const chamber = leg.chamber === "Senate" ? "Senate" : "Assembly";
    const acc = rawMap.get(leg.id);

    const domainsScore: Record<PocketbookDomainKey, PocketbookDomainScore> = {
      property_tax: {
        domain: "property_tax",
        score: 0,
        primaryBills: acc?.property_tax.primaryBills ?? 0,
        cosponsoredBills: acc?.property_tax.cosponsoredBills ?? 0,
        advancedBills: acc?.property_tax.advancedBills ?? 0,
        enactedBills: acc?.property_tax.enactedBills ?? 0,
        floorVotesCast: acc?.property_tax.floorVotesCast ?? 0,
        yeaVotes: acc?.property_tax.yeaVotes ?? 0,
        nayVotes: acc?.property_tax.nayVotes ?? 0,
      },
      housing: {
        domain: "housing",
        score: 0,
        primaryBills: acc?.housing.primaryBills ?? 0,
        cosponsoredBills: acc?.housing.cosponsoredBills ?? 0,
        advancedBills: acc?.housing.advancedBills ?? 0,
        enactedBills: acc?.housing.enactedBills ?? 0,
        floorVotesCast: acc?.housing.floorVotesCast ?? 0,
        yeaVotes: acc?.housing.yeaVotes ?? 0,
        nayVotes: acc?.housing.nayVotes ?? 0,
      },
      transit: {
        domain: "transit",
        score: 0,
        primaryBills: acc?.transit.primaryBills ?? 0,
        cosponsoredBills: acc?.transit.cosponsoredBills ?? 0,
        advancedBills: acc?.transit.advancedBills ?? 0,
        enactedBills: acc?.transit.enactedBills ?? 0,
        floorVotesCast: acc?.transit.floorVotesCast ?? 0,
        yeaVotes: acc?.transit.yeaVotes ?? 0,
        nayVotes: acc?.transit.nayVotes ?? 0,
      },
    };

    for (const d of POCKETBOOK_DOMAINS) {
      const maxRaw = chamberMax[chamber][d];
      const raw = acc?.[d].rawTotal ?? 0;
      let score = 0;
      if (maxRaw > 0 && raw > 0) {
        score = Math.round((raw / maxRaw) * 100);
      }
      domainsScore[d].score = Math.max(0, Math.min(100, score));
    }

    const overallScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (domainsScore.property_tax.score +
            domainsScore.housing.score +
            domainsScore.transit.score) /
            3,
        ),
      ),
    );

    // Build notableVotes for this legislator:
    // real roll calls across all 3 domains where legislator has a recorded choice.
    // Sorted with active votes (Y, N, A) first, then NV; then by date descending.
    const legVotes: PocketbookVoteRecord[] = [];
    for (const rc of notableRollCallCandidates) {
      const choice = rc.votesByLegislatorId?.[String(leg.id)] as
        | VoteChoice
        | undefined;
      if (!choice) continue;

      legVotes.push({
        rollCallId: rc.id,
        bill: rc.bill,
        date: rc.date,
        chamber: rc.chamber,
        abstract: rc.abstract,
        action: rc.action,
        choice,
        yeas: rc.yeas,
        nays: rc.nays,
      });
    }

    legVotes.sort((a, b) => {
      // 1. Active votes (Y, N, A) precede NV (Not Voting)
      const aIsNV = a.choice === "NV" ? 1 : 0;
      const bIsNV = b.choice === "NV" ? 1 : 0;
      if (aIsNV !== bIsNV) return aIsNV - bIsNV;

      // 2. Date descending
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;

      // 3. Roll call ID descending
      return b.rollCallId.localeCompare(a.rollCallId);
    });

    const notableVotes = legVotes.slice(0, 15);

    summariesById.set(leg.id, {
      legislatorId: leg.id,
      overallScore,
      domains: domainsScore,
      notableVotes,
    });
  }

  return {
    summariesById,
    domainRollCallCounts,
  };
}
