import {
  campaignProfilesByLegislator,
  demographicsByDistrict,
  districts as allDistrictInfos,
  legislators,
  loadBills,
  loadDonorsData,
} from "../data";
import type {
  Bill,
  DistrictDemographics,
  DonorProfile,
  DonorsData,
  InfluenceAnalytics,
  Legislator,
  LegislatorInfluenceSummary,
  SectorTotal,
} from "../types";
import {
  SECTOR_DEFINITIONS,
  computeLegislatorInfluence,
} from "./sectors";
import {
  TOPICS,
  classifyTopic,
  topicBySlug,
  type TopicDefinition,
  type TopicSlug,
} from "./topics";

type SponsorType = "P" | "C";

export interface BillSponsor {
  legislator: Legislator;
  type: SponsorType;
}

export interface AnalyticsParticipant {
  legislator: Legislator;
  total: number;
  primary: number;
  cosponsored: number;
}

export interface TopicBillEntry {
  code: string;
  synopsis: string;
  session: number;
  sponsors: BillSponsor[];
}

export interface TopicStat {
  topic: TopicDefinition;
  bills: TopicBillEntry[];
  billCount: number;
  sponsorshipCount: number;
  primarySponsorships: number;
  participants: AnalyticsParticipant[];
  partyBills: Record<"D" | "R", number>;
  bipartisanBills: number;
  chamberBills: Record<"Assembly" | "Senate", number>;
  committees: Array<{ name: string; members: number }>;
  topBills: TopicBillEntry[];
}

export interface CommitteeStat {
  name: string;
  members: number;
  bills: number;
}

export interface DistrictStat {
  district: number;
  bills: number;
  legislators: number;
  counties: string;
}

export interface LegislatorMatrixRow {
  legislator: Legislator;
  totalBills: number;
  primaryBills: number;
  cosponsoredBills: number;
  primaryRatio: number;
  bipartisanBills: number;
  bipartisanRate: number;
  committeesCount: number;
  promisesTotal: number;
  promisesFulfilled: number;
  promisesUnderway: number;
  promisesWithEvidence: number;
  totalRaised: number;
  donorCount: number;
  contributionCount: number;
  topTopic: TopicDefinition;
  medianIncome: number;
  influenceSummary: LegislatorInfluenceSummary;
}

export interface CrossPartyPair {
  dem: Legislator;
  rep: Legislator;
  sharedBills: number;
  focusedBills: number;
  primaryCollaborations: number;
}

export type DonorBucketKey =
  | "individual"
  | "pacUnion"
  | "corporateBusiness"
  | "partyCommittee"
  | "otherOrg";

export interface StatewideDonorRecipient {
  legislatorId: number;
  name: string;
  party: string;
  district: number;
  chamber: Legislator["chamber"];
  amount: number;
  count: number;
  years: number[];
}

export interface StatewideDonorSummary {
  key: string;
  name: string;
  isIndividual: boolean;
  bucket: DonorBucketKey;
  totalAmount: number;
  contributionCount: number;
  legislatorCount: number;
  dAmount: number;
  rAmount: number;
  recipients: StatewideDonorRecipient[];
}

export interface FinanceAnalytics {
  totalRaised: number;
  totalContributions: number;
  totalDonorRecords: number;
  profilesCount: number;
  coveredLegislators: number;
  medianRaisedPerLegislator: number;
  byParty: Array<{
    party: "D" | "R";
    legislators: number;
    totalRaised: number;
    avgRaised: number;
  }>;
  byChamber: Array<{
    chamber: "Senate" | "Assembly";
    legislators: number;
    totalRaised: number;
    avgRaised: number;
  }>;
  byCycle: Array<{
    year: number;
    profiles: number;
    totalRaised: number;
    contributionCount: number;
  }>;
  byBucket: Array<{
    bucket: DonorBucketKey;
    totalAmount: number;
    contributionCount: number;
    donorEntities: number;
  }>;
  topRecipients: LegislatorMatrixRow[];
  topDonors: StatewideDonorSummary[];
  allDonors: StatewideDonorSummary[];
}

export interface DistrictComposite {
  district: number;
  counties: string;
  townCount: number;
  bills: number;
  primaryBills: number;
  bipartisanBills: number;
  legislators: number;
  totalRaised: number;
  promisesTotal: number;
  promisesWithEvidence: number;
  demographics: DistrictDemographics | null;
}

export interface Analytics {
  totalBills: number;
  totalSponsorships: number;
  billsByChamber: Record<"Assembly" | "Senate", number>;
  partyBills: Record<"D" | "R", number>;
  partySponsorships: Record<"D" | "R", number>;
  bipartisanBills: number;
  singlePartyBills: number;
  singleSponsorBills: number;
  topSponsors: AnalyticsParticipant[];
  medianSponsorships: number;
  meanSponsorships: number;
  topTenShare: number;
  districts: DistrictStat[];
  topDistrict: DistrictStat;
  committees: CommitteeStat[];
  topicStats: TopicStat[];
  featuredTopic: TopicStat;
  sponsorsByBill: Map<string, BillSponsor[]>;
  legislatorMatrix: LegislatorMatrixRow[];
  bipartisanLeaders: LegislatorMatrixRow[];
  crossPartyPairs: CrossPartyPair[];
  finance: FinanceAnalytics;
  districtComposites: DistrictComposite[];
  influence: InfluenceAnalytics;
}

function chamberOfBill(code: string): "Assembly" | "Senate" {
  return code.startsWith("A") ? "Assembly" : "Senate";
}

function sponsorTotal(legislator: Legislator): AnalyticsParticipant {
  let primary = 0;
  for (const [, type] of legislator.bills) {
    if (type === "P") primary += 1;
  }
  return {
    legislator,
    total: legislator.bills.length,
    primary,
    cosponsored: legislator.bills.length - primary,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function classifyDonorBucket(
  isIndividual: boolean,
  contributorType?: string,
): DonorBucketKey {
  if (isIndividual) return "individual";
  const upper = String(contributorType ?? "").toUpperCase();
  if (upper.includes("POLITICAL PARTY")) return "partyCommittee";
  if (
    upper.includes("PAC") ||
    upper.includes("UNION") ||
    upper.includes("POLITICAL COMMITTEE") ||
    upper.includes("LABOR")
  ) {
    return "pacUnion";
  }
  if (upper.includes("CORP") || upper.includes("BUSINESS")) {
    return "corporateBusiness";
  }
  return "otherOrg";
}

function normalizeDonorKey(name: string, isIndividual: boolean): string {
  const clean = name
    .toUpperCase()
    .replace(/[.,'"/]/g, " ")
    .replace(/\b(INC|LLC|LLP|PAC|PA|PC|CORP|CO|LTD|THE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${isIndividual ? "I" : "O"}|${clean || name.toUpperCase()}`;
}

export function buildAnalytics(
  billData: Record<string, Bill>,
  donorsData?: DonorsData,
): Analytics {
  const sponsorsByBill = new Map<string, BillSponsor[]>();
  const legislatorById = new Map<number, Legislator>();

  for (const legislator of legislators) {
    legislatorById.set(legislator.id, legislator);
    for (const [code, type] of legislator.bills) {
      const current = sponsorsByBill.get(code);
      if (current) current.push({ legislator, type });
      else sponsorsByBill.set(code, [{ legislator, type }]);
    }
  }

  const billsByChamber: Record<"Assembly" | "Senate", number> = {
    Assembly: 0,
    Senate: 0,
  };
  const partyBills: Record<"D" | "R", number> = { D: 0, R: 0 };
  const partySponsorships: Record<"D" | "R", number> = { D: 0, R: 0 };
  let bipartisanBills = 0;
  let singlePartyBills = 0;
  let singleSponsorBills = 0;
  let totalSponsorships = 0;

  const bipartisanCountByLegislator = new Map<number, number>();
  const topTopicCounterByLeg = new Map<number, Map<TopicSlug, number>>();
  const pairAccumulator = new Map<
    string,
    {
      dem: Legislator;
      rep: Legislator;
      sharedBills: number;
      focusedBills: number;
      primaryCollaborations: number;
    }
  >();

  const districtPrimarySets = new Map<number, Set<string>>();
  const districtBipartisanSets = new Map<number, Set<string>>();

  const topicAccumulator = new Map<
    TopicSlug,
    {
      bills: TopicBillEntry[];
      sponsorshipCount: number;
      primarySponsorships: number;
      participants: Map<
        number,
        { legislator: Legislator; total: number; primary: number }
      >;
      partyBills: Record<"D" | "R", number>;
      bipartisanBills: number;
      chamberBills: Record<"Assembly" | "Senate", number>;
      committees: Map<string, Set<number>>;
    }
  >();

  for (const topic of TOPICS) {
    topicAccumulator.set(topic.slug, {
      bills: [],
      sponsorshipCount: 0,
      primarySponsorships: 0,
      participants: new Map(),
      partyBills: { D: 0, R: 0 },
      bipartisanBills: 0,
      chamberBills: { Assembly: 0, Senate: 0 },
      committees: new Map(),
    });
  }

  for (const [code, bill] of Object.entries(billData)) {
    const chamber = chamberOfBill(code);
    const sponsors = (sponsorsByBill.get(code) ?? []).slice().sort((a, b) => {
      if (a.type !== b.type) return a.type === "P" ? -1 : 1;
      return a.legislator.sortName.localeCompare(b.legislator.sortName, "en");
    });

    billsByChamber[chamber] += 1;

    const dems = sponsors.filter((sponsor) => sponsor.legislator.party === "D");
    const reps = sponsors.filter((sponsor) => sponsor.legislator.party === "R");
    const hasDemocrat = dems.length > 0;
    const hasRepublican = reps.length > 0;
    const isBipartisan = hasDemocrat && hasRepublican;

    if (hasDemocrat) partyBills.D += 1;
    if (hasRepublican) partyBills.R += 1;

    if (isBipartisan) bipartisanBills += 1;
    else if (hasDemocrat || hasRepublican) singlePartyBills += 1;

    if (sponsors.length === 1) singleSponsorBills += 1;

    const slug = classifyTopic(bill.synopsis);
    const accumulator = topicAccumulator.get(slug)!;
    const entry: TopicBillEntry = {
      code,
      synopsis: bill.synopsis,
      session: bill.session,
      sponsors,
    };

    accumulator.bills.push(entry);
    accumulator.sponsorshipCount += sponsors.length;
    accumulator.chamberBills[chamber] += 1;

    if (hasDemocrat) accumulator.partyBills.D += 1;
    if (hasRepublican) accumulator.partyBills.R += 1;
    if (isBipartisan) accumulator.bipartisanBills += 1;

    for (const sponsor of sponsors) {
      totalSponsorships += 1;
      const leg = sponsor.legislator;
      if (leg.party === "D") partySponsorships.D += 1;
      else if (leg.party === "R") partySponsorships.R += 1;

      if (isBipartisan) {
        bipartisanCountByLegislator.set(
          leg.id,
          (bipartisanCountByLegislator.get(leg.id) ?? 0) + 1,
        );
        let dBip = districtBipartisanSets.get(leg.district);
        if (!dBip) {
          dBip = new Set();
          districtBipartisanSets.set(leg.district, dBip);
        }
        dBip.add(code);
      }

      if (sponsor.type === "P") {
        let dPrim = districtPrimarySets.get(leg.district);
        if (!dPrim) {
          dPrim = new Set();
          districtPrimarySets.set(leg.district, dPrim);
        }
        dPrim.add(code);
      }

      if (slug !== "other") {
        let topicMap = topTopicCounterByLeg.get(leg.id);
        if (!topicMap) {
          topicMap = new Map();
          topTopicCounterByLeg.set(leg.id, topicMap);
        }
        topicMap.set(slug, (topicMap.get(slug) ?? 0) + 1);
      }

      const participant = accumulator.participants.get(leg.id);
      if (participant) {
        participant.total += 1;
        if (sponsor.type === "P") participant.primary += 1;
      } else {
        accumulator.participants.set(leg.id, {
          legislator: leg,
          total: 1,
          primary: sponsor.type === "P" ? 1 : 0,
        });
      }

      if (sponsor.type === "P") accumulator.primarySponsorships += 1;

      for (const committee of leg.committees) {
        const members = accumulator.committees.get(committee.name);
        if (members) members.add(leg.id);
        else accumulator.committees.set(committee.name, new Set([leg.id]));
      }
    }

    // Track meaningful D-R co-sponsorship pairs (exclude massive omnibus resolutions)
    if (isBipartisan && sponsors.length <= 24) {
      const focused = sponsors.length <= 10;
      for (const d of dems) {
        for (const r of reps) {
          const pairKey = `${d.legislator.id}|${r.legislator.id}`;
          let pair = pairAccumulator.get(pairKey);
          if (!pair) {
            pair = {
              dem: d.legislator,
              rep: r.legislator,
              sharedBills: 0,
              focusedBills: 0,
              primaryCollaborations: 0,
            };
            pairAccumulator.set(pairKey, pair);
          }
          pair.sharedBills += 1;
          if (focused) pair.focusedBills += 1;
          if (d.type === "P" || r.type === "P") {
            pair.primaryCollaborations += 1;
          }
        }
      }
    }
  }

  const topicStats: TopicStat[] = TOPICS.map((topic) => {
    const accumulator = topicAccumulator.get(topic.slug)!;
    const participants = Array.from(accumulator.participants.values())
      .map((participant) => ({
        legislator: participant.legislator,
        total: participant.total,
        primary: participant.primary,
        cosponsored: participant.total - participant.primary,
      }))
      .sort(
        (a, b) =>
          b.total - a.total ||
          b.primary - a.primary ||
          a.legislator.sortName.localeCompare(b.legislator.sortName, "en"),
      );

    return {
      topic,
      bills: accumulator.bills,
      billCount: accumulator.bills.length,
      sponsorshipCount: accumulator.sponsorshipCount,
      primarySponsorships: accumulator.primarySponsorships,
      participants,
      partyBills: accumulator.partyBills,
      bipartisanBills: accumulator.bipartisanBills,
      chamberBills: accumulator.chamberBills,
      committees: Array.from(accumulator.committees.entries())
        .map(([name, members]) => ({ name, members: members.size }))
        .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name, "en")),
      topBills: accumulator.bills
        .slice()
        .sort(
          (a, b) =>
            b.sponsors.length - a.sponsors.length ||
            a.code.localeCompare(b.code, "en", { numeric: true }),
        ),
    };
  }).sort((a, b) => {
    if (a.topic.slug === "other") return 1;
    if (b.topic.slug === "other") return -1;
    return b.billCount - a.billCount;
  });

  const featuredTopic =
    topicStats.find((stat) => stat.topic.slug !== "other" && stat.billCount > 0) ??
    topicStats[0];

  const topSponsors = legislators
    .map(sponsorTotal)
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.primary - a.primary ||
        a.legislator.sortName.localeCompare(b.legislator.sortName, "en"),
    );

  const topTenShare =
    totalSponsorships > 0
      ? topSponsors
          .slice(0, 10)
          .reduce((sum, entry) => sum + entry.total, 0) / totalSponsorships
      : 0;

  const districtBillSets = new Map<number, Set<string>>();
  const districtLegislators = new Map<number, Legislator[]>();

  for (const legislator of legislators) {
    let bills = districtBillSets.get(legislator.district);
    if (!bills) {
      bills = new Set();
      districtBillSets.set(legislator.district, bills);
    }
    for (const [code] of legislator.bills) bills.add(code);

    const members = districtLegislators.get(legislator.district);
    if (members) members.push(legislator);
    else districtLegislators.set(legislator.district, [legislator]);
  }

  const districts: DistrictStat[] = Array.from(districtBillSets.entries())
    .map(([district, bills]) => {
      const members = districtLegislators.get(district) ?? [];
      const counties = members
        .map((member) => member.districtInfo?.countiesLabel)
        .find((label) => Boolean(label)) as string | undefined;

      return {
        district,
        bills: bills.size,
        legislators: members.length,
        counties: counties ?? "",
      };
    })
    .sort((a, b) => b.bills - a.bills || a.district - b.district);

  const committeeBills = new Map<string, Set<string>>();
  const committeeMembers = new Map<string, Set<number>>();

  for (const legislator of legislators) {
    for (const committee of legislator.committees) {
      let bills = committeeBills.get(committee.name);
      if (!bills) {
        bills = new Set();
        committeeBills.set(committee.name, bills);
      }
      for (const [code] of legislator.bills) bills.add(code);

      let members = committeeMembers.get(committee.name);
      if (!members) {
        members = new Set();
        committeeMembers.set(committee.name, members);
      }
      members.add(legislator.id);
    }
  }

  const committees: CommitteeStat[] = Array.from(committeeBills.entries())
    .map(([name, bills]) => ({
      name,
      bills: bills.size,
      members: committeeMembers.get(name)?.size ?? 0,
    }))
    .sort((a, b) => b.bills - a.bills || b.members - a.members);

  /* --------------------------------------------------- Finance / ELEC Lab */
  const raisedByLeg = new Map<
    number,
    { total: number; donorCount: number; contributionCount: number }
  >();
  const cycleMap = new Map<
    number,
    { profiles: number; totalRaised: number; contributionCount: number }
  >();
  const bucketMap = new Map<
    DonorBucketKey,
    { totalAmount: number; contributionCount: number; entities: Set<string> }
  >();
  const statewideDonors = new Map<
    string,
    {
      key: string;
      name: string;
      isIndividual: boolean;
      bucket: DonorBucketKey;
      totalAmount: number;
      contributionCount: number;
      dAmount: number;
      rAmount: number;
      recipients: Map<number, StatewideDonorRecipient>;
    }
  >();

  let totalRaised = 0;
  let totalContributions = 0;
  let totalDonorRecords = 0;
  const donorProfilesByLeg = new Map<number, DonorProfile[]>();

  for (const profile of donorsData?.profiles ?? []) {
    totalRaised += profile.totalAmount;
    totalContributions += profile.contributionCount;
    totalDonorRecords += profile.donorCount;

    const legProfiles = donorProfilesByLeg.get(profile.legislatorId) ?? [];
    legProfiles.push(profile);
    donorProfilesByLeg.set(profile.legislatorId, legProfiles);

    const legMoney = raisedByLeg.get(profile.legislatorId) ?? {
      total: 0,
      donorCount: 0,
      contributionCount: 0,
    };
    legMoney.total += profile.totalAmount;
    legMoney.donorCount += profile.donorCount;
    legMoney.contributionCount += profile.contributionCount;
    raisedByLeg.set(profile.legislatorId, legMoney);

    const cycle = cycleMap.get(profile.electionYear) ?? {
      profiles: 0,
      totalRaised: 0,
      contributionCount: 0,
    };
    cycle.profiles += 1;
    cycle.totalRaised += profile.totalAmount;
    cycle.contributionCount += profile.contributionCount;
    cycleMap.set(profile.electionYear, cycle);

    for (const donor of profile.donors) {
      const bucket = classifyDonorBucket(
        donor.isIndividual,
        donor.contributorType ?? undefined,
      );
      const normKey = normalizeDonorKey(donor.name, donor.isIndividual);

      const bEntry = bucketMap.get(bucket) ?? {
        totalAmount: 0,
        contributionCount: 0,
        entities: new Set<string>(),
      };
      bEntry.totalAmount += donor.amount;
      bEntry.contributionCount += donor.count;
      bEntry.entities.add(normKey);
      bucketMap.set(bucket, bEntry);

      let sw = statewideDonors.get(normKey);
      if (!sw) {
        sw = {
          key: normKey,
          name: donor.name,
          isIndividual: donor.isIndividual,
          bucket,
          totalAmount: 0,
          contributionCount: 0,
          dAmount: 0,
          rAmount: 0,
          recipients: new Map(),
        };
        statewideDonors.set(normKey, sw);
      }
      sw.totalAmount += donor.amount;
      sw.contributionCount += donor.count;
      if (profile.party === "D") sw.dAmount += donor.amount;
      else if (profile.party === "R") sw.rAmount += donor.amount;

      const rec = sw.recipients.get(profile.legislatorId);
      if (rec) {
        rec.amount += donor.amount;
        rec.count += donor.count;
        if (!rec.years.includes(profile.electionYear)) {
          rec.years.push(profile.electionYear);
        }
      } else {
        sw.recipients.set(profile.legislatorId, {
          legislatorId: profile.legislatorId,
          name: profile.name,
          party: profile.party,
          district: profile.district,
          chamber: profile.chamber,
          amount: donor.amount,
          count: donor.count,
          years: [profile.electionYear],
        });
      }
    }
  }

  /* ---------------------------------------------- 120-Legislator Matrix */
  const legislatorMatrix: LegislatorMatrixRow[] = legislators.map((leg) => {
    let primaryBills = 0;
    for (const [, type] of leg.bills) {
      if (type === "P") primaryBills += 1;
    }
    const totalBills = leg.bills.length;
    const cosponsoredBills = totalBills - primaryBills;
    const primaryRatio =
      totalBills > 0 ? Math.round((primaryBills / totalBills) * 100) : 0;
    const bipBills = bipartisanCountByLegislator.get(leg.id) ?? 0;
    const bipartisanRate =
      totalBills > 0 ? Math.round((bipBills / totalBills) * 100) : 0;

    const camProfiles = campaignProfilesByLegislator.get(leg.id) ?? [];
    let promisesTotal = 0;
    let promisesFulfilled = 0;
    let promisesUnderway = 0;
    let promisesWithEvidence = 0;
    for (const p of camProfiles) {
      for (const pr of p.promises) {
        promisesTotal += 1;
        if (pr.status === "fulfilled") promisesFulfilled += 1;
        if (pr.status === "underway") promisesUnderway += 1;
        if (pr.evidence.length > 0) promisesWithEvidence += 1;
      }
    }

    const topicCounts = topTopicCounterByLeg.get(leg.id);
    let bestSlug: TopicSlug = "other";
    let bestTopicCount = -1;
    if (topicCounts) {
      for (const [slug, count] of topicCounts.entries()) {
        if (count > bestTopicCount) {
          bestSlug = slug;
          bestTopicCount = count;
        }
      }
    }

    const money = raisedByLeg.get(leg.id) ?? {
      total: 0,
      donorCount: 0,
      contributionCount: 0,
    };

    const demo = demographicsByDistrict.get(leg.district);
    const legDonorProfiles = donorProfilesByLeg.get(leg.id);
    const influenceSummary = computeLegislatorInfluence(leg, legDonorProfiles);

    return {
      legislator: leg,
      totalBills,
      primaryBills,
      cosponsoredBills,
      primaryRatio,
      bipartisanBills: bipBills,
      bipartisanRate,
      committeesCount: leg.committees.length,
      promisesTotal,
      promisesFulfilled,
      promisesUnderway,
      promisesWithEvidence,
      totalRaised: Math.round(money.total * 100) / 100,
      donorCount: money.donorCount,
      contributionCount: money.contributionCount,
      topTopic: topicBySlug.get(bestSlug) ?? topicBySlug.get("other")!,
      medianIncome: demo?.medianIncome ?? 0,
      influenceSummary,
    };
  });

  const bipartisanLeaders = legislatorMatrix
    .slice()
    .sort(
      (a, b) =>
        b.bipartisanBills - a.bipartisanBills ||
        b.bipartisanRate - a.bipartisanRate ||
        b.totalBills - a.totalBills,
    );

  const crossPartyPairs: CrossPartyPair[] = Array.from(pairAccumulator.values())
    .sort(
      (a, b) =>
        b.focusedBills - a.focusedBills ||
        b.sharedBills - a.sharedBills ||
        b.primaryCollaborations - a.primaryCollaborations,
    )
    .slice(0, 40);

  const byParty: FinanceAnalytics["byParty"] = (["D", "R"] as const).map(
    (party) => {
      const members = legislatorMatrix.filter(
        (row) => row.legislator.party === party,
      );
      const sum = members.reduce((acc, row) => acc + row.totalRaised, 0);
      return {
        party,
        legislators: members.length,
        totalRaised: sum,
        avgRaised: members.length ? Math.round(sum / members.length) : 0,
      };
    },
  );

  const byChamber: FinanceAnalytics["byChamber"] = (
    ["Senate", "Assembly"] as const
  ).map((chamber) => {
    const members = legislatorMatrix.filter(
      (row) => row.legislator.chamber === chamber,
    );
    const sum = members.reduce((acc, row) => acc + row.totalRaised, 0);
    return {
      chamber,
      legislators: members.length,
      totalRaised: sum,
      avgRaised: members.length ? Math.round(sum / members.length) : 0,
    };
  });

  const byCycle = Array.from(cycleMap.entries())
    .map(([year, stats]) => ({ year, ...stats }))
    .sort((a, b) => a.year - b.year);

  const byBucket = (
    [
      "individual",
      "pacUnion",
      "corporateBusiness",
      "partyCommittee",
      "otherOrg",
    ] as DonorBucketKey[]
  )
    .map((bucket) => {
      const entry = bucketMap.get(bucket);
      return {
        bucket,
        totalAmount: entry?.totalAmount ?? 0,
        contributionCount: entry?.contributionCount ?? 0,
        donorEntities: entry?.entities.size ?? 0,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const allDonors: StatewideDonorSummary[] = Array.from(
    statewideDonors.values(),
  )
    .map((entry) => {
      const recipients = Array.from(entry.recipients.values()).sort(
        (a, b) => b.amount - a.amount,
      );
      return {
        key: entry.key,
        name: entry.name,
        isIndividual: entry.isIndividual,
        bucket: entry.bucket,
        totalAmount: entry.totalAmount,
        contributionCount: entry.contributionCount,
        legislatorCount: recipients.length,
        dAmount: entry.dAmount,
        rAmount: entry.rAmount,
        recipients,
      };
    })
    .filter((entry) => entry.totalAmount > 0)
    .sort(
      (a, b) =>
        b.totalAmount - a.totalAmount || b.legislatorCount - a.legislatorCount,
    );

  const topRecipients = legislatorMatrix
    .slice()
    .sort((a, b) => b.totalRaised - a.totalRaised);

  const finance: FinanceAnalytics = {
    totalRaised,
    totalContributions,
    totalDonorRecords,
    profilesCount: donorsData?.profiles.length ?? 0,
    coveredLegislators: raisedByLeg.size,
    medianRaisedPerLegislator: median(
      legislatorMatrix.map((row) => Math.round(row.totalRaised)),
    ),
    byParty,
    byChamber,
    byCycle,
    byBucket,
    topRecipients,
    topDonors: allDonors.slice(0, 60),
    allDonors,
  };

  /* ----------------------------------------- 40-District Composite Matrix */
  const districtInfoMap = new Map(
    allDistrictInfos.map((info) => [info.number, info]),
  );

  const districtComposites: DistrictComposite[] = Array.from(
    { length: 40 },
    (_, i) => {
      const d = i + 1;
      const info = districtInfoMap.get(d);
      const demo = demographicsByDistrict.get(d) ?? null;
      const members = legislatorMatrix.filter(
        (row) => row.legislator.district === d,
      );
      const billCount = districtBillSets.get(d)?.size ?? 0;
      const primaryBills = districtPrimarySets.get(d)?.size ?? 0;
      const bipCount = districtBipartisanSets.get(d)?.size ?? 0;
      const totalMoney = members.reduce((sum, m) => sum + m.totalRaised, 0);
      const promisesTotal = members.reduce(
        (sum, m) => sum + m.promisesTotal,
        0,
      );
      const promisesWithEvidence = members.reduce(
        (sum, m) => sum + m.promisesWithEvidence,
        0,
      );
      return {
        district: d,
        counties: info?.countiesLabel ?? "",
        townCount: info?.towns?.length ?? 0,
        bills: billCount,
        primaryBills,
        bipartisanBills: bipCount,
        legislators: members.length,
        totalRaised: Math.round(totalMoney * 100) / 100,
        promisesTotal,
        promisesWithEvidence,
        demographics: demo,
      };
    },
  );

  /* ------------------------------------------------ Influence Radar Lab */
  const allSectorsTotal = legislatorMatrix.reduce(
    (sum, row) => sum + row.influenceSummary.totalRaised,
    0,
  );

  const statewideSectors: SectorTotal[] = SECTOR_DEFINITIONS.map((sec) => {
    const amount =
      Math.round(
        legislatorMatrix.reduce(
          (sum, row) => sum + (row.influenceSummary.sectorTotals[sec.key] ?? 0),
          0,
        ) * 100,
      ) / 100;
    const legislatorCount = legislatorMatrix.filter(
      (row) => (row.influenceSummary.sectorTotals[sec.key] ?? 0) > 0,
    ).length;
    const pct =
      allSectorsTotal > 0
        ? Math.round((amount / allSectorsTotal) * 100)
        : 0;
    return {
      sector: sec.key,
      amount,
      pct,
      legislatorCount,
    };
  }).sort((a, b) => b.amount - a.amount);

  const topAlignedPairs: LegislatorMatrixRow[] = legislatorMatrix
    .filter((row) => row.influenceSummary.committeeAlignments.length > 0)
    .sort((a, b) => {
      const sumA = a.influenceSummary.committeeAlignments.reduce(
        (acc, item) => acc + item.sectorAmount,
        0,
      );
      const sumB = b.influenceSummary.committeeAlignments.reduce(
        (acc, item) => acc + item.sectorAmount,
        0,
      );
      return sumB - sumA || b.totalRaised - a.totalRaised;
    });

  const coveredLegislators = legislatorMatrix.filter(
    (row) => row.totalRaised > 0,
  );
  const avgGrassrootsPct =
    coveredLegislators.length > 0
      ? Math.round(
          coveredLegislators.reduce(
            (sum, row) => sum + row.influenceSummary.grassrootsPct,
            0,
          ) / coveredLegislators.length,
        )
      : 0;

  const influence: InfluenceAnalytics = {
    statewideSectors,
    topAlignedPairs,
    avgGrassrootsPct,
  };

  return {
    totalBills: Object.keys(billData).length,
    totalSponsorships,
    billsByChamber,
    partyBills,
    partySponsorships,
    bipartisanBills,
    singlePartyBills,
    singleSponsorBills,
    topSponsors,
    medianSponsorships: median(
      legislators.map((legislator) => legislator.bills.length),
    ),
    meanSponsorships:
      legislators.length > 0
        ? Math.round(totalSponsorships / legislators.length)
        : 0,
    topTenShare,
    districts,
    topDistrict: districts[0] ?? {
      district: 0,
      bills: 0,
      legislators: 0,
      counties: "",
    },
    committees,
    topicStats,
    featuredTopic,
    sponsorsByBill,
    legislatorMatrix,
    bipartisanLeaders,
    crossPartyPairs,
    finance,
    districtComposites,
    influence,
  };
}

let analyticsPromise: Promise<Analytics> | null = null;

export function loadAnalytics(): Promise<Analytics> {
  if (!analyticsPromise) {
    analyticsPromise = Promise.all([loadBills(), loadDonorsData()])
      .then(([billData, donorsData]) => buildAnalytics(billData, donorsData))
      .catch((error) => {
        analyticsPromise = null;
        throw error;
      });
  }
  return analyticsPromise;
}

export function getTopicStat(
  analytics: Analytics,
  slug: string,
): TopicStat | undefined {
  return analytics.topicStats.find((stat) => stat.topic.slug === slug);
}

export function topicFromSlug(slug: string): TopicDefinition {
  return topicBySlug.get(slug as TopicSlug) ?? topicBySlug.get("other")!;
}
