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

