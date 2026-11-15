export type BillType = "P" | "C";

export type BillRelation = [bill: string, type: BillType];

export interface Address {
  type: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax: string;
}

export interface Committee {
  name: string;
  code: string;
  position: string;
  url: string | null;
}

export interface DistrictInfo {
  counties: string[];
  countiesLabel: string;
  towns: string[];
  townsLabel: string;
}

export interface Legislator {
  id: number;
  fullName: string;
  sortName: string;
  firstName: string;
  lastName: string;
  suffix: string;
  party: string;
  partyName: string;
  chamber: "Senate" | "Assembly" | string;
  district: number;
  title: string;
  leadership: string;
  email: string;
  photo: string | null;
  officialUrl: string;
  contactUrl: string;
  education: string[];
  occupation: string[];
  publicService: string[];
  militaryService: string[];
  legislativeService: string[];
  addresses: Address[];
  committees: Committee[];
  districtInfo: DistrictInfo | null;
  bills: BillRelation[];
}

export interface Bill {
  bill: string;
  synopsis: string;
  session: number;
}

export interface District {
  number: number;
  counties: string[];
  countiesLabel: string;
  towns: string[];
  townsLabel: string;
}

export interface Meta {
  generatedAt: string;
  session: number;
  sessionLabel: string;
  sourceName: string;
  sourceUrl: string;
  sourceBillsUrl: string;
  legislatorCount: number;
  districtCount: number;
  billCount: number;
  partyCounts: Record<string, number>;
  chamberCounts: Record<string, number>;
  recordsWithBills: number;
}

export type PromiseStatus = "fulfilled" | "underway" | "failed" | "pending";

export interface CampaignEvidence {
  bill: string;
  session: number;
  url: string;
  synopsis: string;
  date: string;
  action: string;
}

export interface CampaignPromise {
  id: string;
  kind: string;
  category: string;
  text: string;
  source: {
    label: string;
    url: string;
    date?: string;
    question?: string;
  };
  status: PromiseStatus;
  statusNote: string;
  evidence: CampaignEvidence[];
  session: number;
}

export interface CampaignBallotCandidate {
  name: string;
  party: string;
  incumbent: boolean;
  responded: boolean;
  currentLegislatorId: number | null;
  profileKey: string | null;
  won: boolean | null;
}

export interface CampaignRace {
  chamber: "Senate" | "Assembly" | string;
  candidates: CampaignBallotCandidate[];
}

export interface CampaignDistrict {
  district: number;
  source: { label: string; url: string; date?: string };
  races: CampaignRace[];
}

export interface CampaignElectionYear {
  year: number;
  label: string;
  chambers: string[];
  districts: CampaignDistrict[];
}

export interface CampaignProfile {
  key: string;
  legislatorId: number;
  name: string;
  district: number;
  chamber: "Senate" | "Assembly" | string;
  party: string;
  photo: string | null;
  electionYear: number;
  won: boolean;
  responded: boolean;
  source: { label: string; url: string; date?: string };
  promises: CampaignPromise[];
}

export interface CampaignData {
  generatedAt: string;
  source: { name: string; url: string; note?: string };
  methodology: { statuses: PromiseStatus[]; sessions: Record<string, number> };
  years: CampaignElectionYear[];
  profiles: CampaignProfile[];
}

export interface DonorRecord {
  name: string;
  isIndividual: boolean;
  contributorType: string | null;
  year: string;
  amount: number;
  count: number;
  employer: string | null;
  occupation: string | null;
  lastDate: string | null;
}

export interface DonorEntity {
  entityId: string;
  entityName: string;
  electionType: string;
  office: string;
  location: string;
}

export interface DonorProfile {
  key: string;
  legislatorId: number;
  name: string;
  district: number;
  chamber: "Senate" | "Assembly" | string;
  party: string;
  electionYear: number;
  entities: DonorEntity[];
  source: { label: string; portalUrl: string; note?: string };
  totalAmount: number;
  contributionCount: number;
  donorCount: number;
  donors: DonorRecord[];
}

export interface DonorsData {
  generatedAt: string;
  source: { name: string; portalUrl: string; note?: string };
  profiles: DonorProfile[];
}

/* ------------------------------------------------ official district map */

export interface DistrictMapShape {
  district: number;
  path: string;
  label: [number, number] | null;
}

export interface DistrictMapData {
  source: {
    name: string;
    url: string;
    layer: string;
    retrievedAt: string;
  };
  viewBox: string;
  districts: DistrictMapShape[];
}

/* ------------------------------------------------ federal midterms 2026 */

export interface FederalPromise {
  category: string;
  question: string;
  answer: string;
}

export interface FederalCandidateResult {
  votes: number;
  pct: number | null;
  winner: boolean;
  incumbent: boolean;
}

export interface FederalListedCandidate {
  name: string;
  party: string;
  partyLabel: string;
  votes: number;
  pct: number | null;
  winner: boolean;
}

export interface FederalDistrictResults {
  totalVotes: number | null;
  reportingPct: number | null;
  updatedAt: string | null;
  residualVotes: number;
  listedCandidates: FederalListedCandidate[];
}

export interface FederalIndividualDonor {
  name: string;
  city: string;
  state: string;
  zip: string;
  employer: string | null;
  occupation: string | null;
  amount: number;
  count: number;
  lastDate: string | null;
}

export interface FederalCommitteeDonor {
  committeeId: string;
  name: string;
  amount: number;
  count: number;
  lastDate: string;
}

export interface FederalFinanceTotals {
  receipts: number;
  disbursements: number;
  cashOnHand: number;
  individualContributions: number;
  otherCommitteeContributions: number;
  partyContributions: number;
  refunds: number;
}

export interface FederalFinance {
  candidateId: string;
  committeeId: string;
  committeeName: string | null;
  coverageEnd: string | null;
  totals: FederalFinanceTotals | null;
  itemizedIndividuals: {
    total: number;
    donorCount: number;
    transactionCount: number;
    donors: FederalIndividualDonor[];
  } | null;
  committeeDonors: {
    total: number;
    donorCount: number;
    donors: FederalCommitteeDonor[];
  } | null;
}

export interface FederalCandidate {
  id: string;
  name: string;
  party: string;
  partyLabel: string;
  incumbent: boolean;
  photo: string | null;
  hometown: string;
  occupation: string;
  age: number | null;
  background: string;
  website: string | null;
  didNotRespond: boolean;
  promises: FederalPromise[];
  result: FederalCandidateResult | null;
  finance: FederalFinance | null;
}

export interface FederalDistrict {
  district: number;
  intro: string;
  guideUrl: string;
  guidePublished: string;
  guideModified: string;
  results: FederalDistrictResults | null;
  candidates: FederalCandidate[];
}

export interface FederalData {
  generatedAt: string;
  election: {
    date: string;
    year: number;
    type: string;
    scope: string;
    office: string;
    state: string;
    districtCount: number;
    candidateCount: number;
    note: string;
  };
  summary: {
    seats: Record<string, number>;
    partyVotes: Record<string, number>;
    attributedVotes: number;
    unattributedVotes: number;
    totalVotes: number;
    totalReceipts: number;
    totalItemizedIndividual: number;
    totalCommitteeMoney: number;
  };
  sources: {
    results: { name: string; url: string; note?: string; retrievedAt?: string };
    guides: { name: string; url: string; note?: string; retrievedAt?: string };
    finance: { name: string; url: string; note?: string; retrievedAt?: string };
  };
  methodology: {
    promises: string;
    results: string;
    finance: string;
  };
  districts: FederalDistrict[];
}

export interface AcsMetrics {
  geoId: string;
  name: string;
  population: number;
  medianAge: number;
  medianIncome: number;
  medianHomeValue: number;
  medianRent: number;
  povertyRate: number;
  bachelorsPlusRate: number;
  unemploymentRate: number;
  homeownershipRate: number;
  transitCommuteRate: number;
}

export interface DistrictDemographics extends AcsMetrics {
  district: number;
}

export interface DemographicsData {
  generatedAt: string;
  release: {
    id: string;
    name: string;
    years: string;
  };
  source: {
    name: string;
    url: string;
    apiProvider: string;
    tables: string[];
  };
  statewide: AcsMetrics;
  districts: DistrictDemographics[];
}

export type BillStage = "introduced" | "committee" | "reported" | "floor" | "enacted";

export interface BillStageEntry {
  bill: string;
  stage: BillStage;
  statusCode: string;
  committeeCode: string | null;
  lastAction: string;
  lastActionDate: string | null;
  isSubstantive: boolean;
}

export type BillStagesMap = Record<string, BillStageEntry>;

export type VoteChoice = "Y" | "N" | "A" | "NV";

export interface RollCallEvent {
  id: string;
  bill: string;
  chamber: "Senate" | "Assembly";
  date: string;
  action: string;
  abstract: string;
  yeas: number;
  nays: number;
  abstains: number;
  notVoting: number;
  votesByLegislatorId: Record<string, VoteChoice>;
}

export interface LegislatorVoteStats {
  eligible: number;
  cast: number;
  yeas: number;
  nays: number;
  abstains: number;
  attendancePct: number;
  partyUnityPct: number;
}

export interface VotesData {
  generatedAt: string;
  source: { name: string; portalUrl: string };
  rollCalls: RollCallEvent[];
  legislatorStats: Record<string, LegislatorVoteStats>;
}

/* ------------------------------------------------ economic sectors & influence */

export type DonorSectorKey =
  | "real_estate"
  | "healthcare_pharma"
  | "energy_utilities"
  | "finance_insurance"
  | "labor_unions"
  | "law_lobbying"
  | "tech_telecom"
  | "civic_grassroots";

export interface SectorDefinition {
  key: DonorSectorKey;
  color: string;
  committeeCodes: string[];
}

export interface SectorTotal {
  sector: DonorSectorKey;
  amount: number;
  pct: number;
  legislatorCount?: number;
}

export interface CommitteeAlignment {
  committeeCode: string;
  committeeName: string;
  sector: DonorSectorKey;
  sectorAmount: number;
}

export interface LegislatorInfluenceSummary {
  legislatorId: number;
  totalRaised: number;
  grassrootsAmount: number;
  institutionalAmount: number;
  grassrootsPct: number;
  institutionalPct: number;
  sectorTotals: Record<DonorSectorKey, number>;
  topSectors: SectorTotal[];
  committeeAlignments: CommitteeAlignment[];
}

export interface InfluenceAnalytics<TRow = any> {
  statewideSectors: SectorTotal[];
  topAlignedPairs: TRow[];
  avgGrassrootsPct: number;
}

/* ------------------------------------------------ legislative effectiveness & benchmarks */

export type EffectivenessArchetype =
  | "high_throughput"
  | "policy_specialist"
  | "coalition_builder"
  | "developing";

export interface PipelineStageMetric {
  stage: BillStage;
  currentCount: number;     // bills currently resting at this terminal stage
  reachedCount: number;     // cumulative bills that reached at least this stage
  reachedPct: number;       // 0-100 share of substantive bills reaching this stage
}

export interface CommitteeBottleneck {
  committeeCode: string;
  committeeName: string;
  chamber: "Senate" | "Assembly" | "Other";
  heldInCommitteeCount: number;
  advancedCount: number;    // reported + floor + enacted (when tagged to this committeeCode)
  totalSeenCount: number;
  advancementRatePct: number;
}

export interface LegislatorEffectivenessSummary {
  legislatorId: number;
  primarySubstantive: number;
  cosponsoredSubstantive: number;
  primaryCommitteePlus: number;
  primaryReportedPlus: number;
  primaryFloorPlus: number;
  primaryEnacted: number;
  cosponsoredEnacted: number;
  advancementRatePct: number; // % of primarySubstantive reaching reported/floor/enacted
  rawPoints: number;
  lesScore: number;           // 0-100 objective chamber-normalized score
  archetype: EffectivenessArchetype;
}

export interface ChamberBenchmark {
  chamber: "Senate" | "Assembly";
  legislatorCount: number;
  avgLes: number;
  avgAdvancementRatePct: number;
  avgAttendancePct: number;
  avgPartyUnityPct: number;
  avgBipartisanRatePct: number;
  avgGrassrootsPct: number;
  avgTotalRaised: number;
  avgPrimaryBills: number;
  avgPocketbookOverall: number;
}

export interface EffectivenessAnalytics<TRow = any> {
  substantiveBillCount: number;
  funnel: PipelineStageMetric[];
  funnelByChamber: {
    Senate: PipelineStageMetric[];
    Assembly: PipelineStageMetric[];
  };
  committeeBottlenecks: CommitteeBottleneck[];
  topEffective: TRow[];
  chamberAverages: {
    Senate: ChamberBenchmark;
    Assembly: ChamberBenchmark;
  };
}

/* ------------------------------------------------ multi-variable correlation sandbox */

export type SandboxMetricKey =
  | "totalRaised"
  | "grassrootsPct"
  | "lesScore"
  | "bipartisanRate"
  | "attendancePct"
  | "partyUnityPct"
  | "primaryBills"
  | "enactedBills"
  | "medianIncome"
  | "medianRent"
  | "transitCommuteRate"
  | "homeownershipRate";

export interface SandboxDimensionDef {
  key: SandboxMetricKey;
  format: "currency" | "percent" | "score" | "count";
}

export interface SandboxScatterPoint {
  legislatorId: number;
  name: string;
  party: string;
  chamber: "Senate" | "Assembly" | string;
  district: number;
  photo: string | null;
  x: number;
  y: number;
  quadrant: "topRight" | "topLeft" | "bottomRight" | "bottomLeft";
}

export interface SandboxScatterResult {
  xKey: SandboxMetricKey;
  yKey: SandboxMetricKey;
  points: SandboxScatterPoint[];
  medianX: number;
  medianY: number;
  pearsonR: number;
}

/* ------------------------------------------------ pocketbook impact & floor roll-calls */

export type PocketbookDomainKey = "property_tax" | "housing" | "transit";

export interface PocketbookVoteRecord {
  rollCallId: string;
  bill: string;
  date: string;
  chamber: "Senate" | "Assembly";
  abstract: string;
  action: string;
  choice: VoteChoice;
  yeas: number;
  nays: number;
}

export interface PocketbookDomainScore {
  domain: PocketbookDomainKey;
  score: number;             // 0-100 objective activity & advancement index
  primaryBills: number;
  cosponsoredBills: number;
  advancedBills: number;     // reported / floor / enacted
  enactedBills: number;
  floorVotesCast: number;
  yeaVotes: number;
  nayVotes: number;
}

export interface LegislatorPocketbookSummary {
  legislatorId: number;
  overallScore: number;      // weighted/mean 0-100 across the 3 domains
  domains: Record<PocketbookDomainKey, PocketbookDomainScore>;
  notableVotes: PocketbookVoteRecord[]; // top recent real floor roll calls across the 3 domains
}

export interface PocketbookAnalytics<TRow = any> {
  domainRollCallCounts: Record<PocketbookDomainKey, number>;
  chamberAverages: {
    Senate: Record<PocketbookDomainKey | "overall", number>;
    Assembly: Record<PocketbookDomainKey | "overall", number>;
  };
  topByDomain: Record<PocketbookDomainKey, TRow[]>;
}




