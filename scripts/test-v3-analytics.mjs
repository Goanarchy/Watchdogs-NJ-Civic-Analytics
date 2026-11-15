/**
 * Test suite for Watchdogs v3.0 analytics, bulk ingestion, and data models.
 *
 * Usage:
 *   node scripts/test-v3-analytics.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Task 1 imports from fetch-njleg-bulk.mjs
import {
  parseCsvLine,
  parseRollCallsFromCsvRows,
  isSubstantiveBill,
  normalizeBillStage,
  assertBulkOutputsValid,
  calculateLegislatorVoteStats,
} from "./fetch-njleg-bulk.mjs";

// Task 2 imports from src/lib/sectors.ts
import {
  SECTOR_DEFINITIONS,
  classifyDonorSector,
  computeLegislatorInfluence,
} from "../src/lib/sectors.ts";

// Task 3 imports from src/lib/effectiveness.ts
import {
  isSubstantiveBillCode,
  stageOrderIndex,
  buildPipelineFunnel,
  buildCommitteeBottlenecks,
  classifyEffectivenessArchetype,
  computeRawLegislatorPoints,
  computeChamberNormalizedEffectiveness,
} from "../src/lib/effectiveness.ts";

// Task 4 imports from src/lib/sandbox.ts & src/lib/pocketbook.ts
import {
  SANDBOX_DIMENSIONS,
  extractSandboxMetric,
  computeMedian,
  computePearsonCorrelation,
  computeLinearRegression,
  buildSandboxScatter,
} from "../src/lib/sandbox.ts";

import {
  classifyPocketbookDomains,
  primaryPocketbookDomain,
  computePocketbookSummaries,
} from "../src/lib/pocketbook.ts";

console.log("==> Running Watchdogs v3 Analytics & Bulk Parser Tests...\n");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. isSubstantiveBill
// ---------------------------------------------------------------------------
console.log("--- 1. Substantive Bill Classification ---");

test("identifies substantive Senate bills", () => {
  assert.strictEqual(isSubstantiveBill("S696"), true);
  assert.strictEqual(isSubstantiveBill("S1"), true);
  assert.strictEqual(isSubstantiveBill("S4500"), true);
});

test("identifies substantive Assembly bills", () => {
  assert.strictEqual(isSubstantiveBill("A101"), true);
  assert.strictEqual(isSubstantiveBill("A5999"), true);
});

test("rejects resolutions as non-substantive", () => {
  assert.strictEqual(isSubstantiveBill("SR45"), false);
  assert.strictEqual(isSubstantiveBill("AR12"), false);
  assert.strictEqual(isSubstantiveBill("SCR1"), false);
  assert.strictEqual(isSubstantiveBill("ACR2"), false);
  assert.strictEqual(isSubstantiveBill("SJR10"), false);
  assert.strictEqual(isSubstantiveBill("AJR12"), false);
});

// ---------------------------------------------------------------------------
// 2. parseCsvLine
// ---------------------------------------------------------------------------
console.log("\n--- 2. CSV Line Parser ---");

test("parses standard unquoted and quoted CSV columns", () => {
  const line = '"A101","Barlas, Al","1/13/2026","ATR","Synopsis here"';
  const cols = parseCsvLine(line);
  assert.deepStrictEqual(cols, [
    "A101",
    "Barlas, Al",
    "1/13/2026",
    "ATR",
    "Synopsis here",
  ]);
});

test("handles escaped quotes inside quoted fields", () => {
  const line = '"A258","Protects ""whistleblower"" employees","Y"';
  const cols = parseCsvLine(line);
  assert.deepStrictEqual(cols, [
    "A258",
    'Protects "whistleblower" employees',
    "Y",
  ]);
});

test("handles empty trailing or intermediate columns", () => {
  const line = '"A101",,"","N"';
  const cols = parseCsvLine(line);
  assert.deepStrictEqual(cols, ["A101", "", "", "N"]);
});

// ---------------------------------------------------------------------------
// 3. normalizeBillStage
// ---------------------------------------------------------------------------
console.log("\n--- 3. Bill Stage Normalization ---");

test("normalizes enacted stage via chapterLaw or governorAction", () => {
  assert.deepStrictEqual(
    normalizeBillStage({ chapterLaw: "2026, c.14" }),
    { stage: "enacted", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ governorAction: "APP" }),
    { stage: "enacted", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ governorAction: "APP W/CH" }),
    { stage: "enacted", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "APP" }),
    { stage: "enacted", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({
      governorAction: "APP",
      historyActions: ["INT 1RA REF ATR", "REP 2RA", "PA PBH"],
    }),
    { stage: "enacted", committeeCode: "ATR" }
  );
});

test("normalizes floor stage from floor status or 3RDG/PA/PS history", () => {
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "PA" }),
    { stage: "floor", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "PBH" }),
    { stage: "floor", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "2RA" }),
    { stage: "floor", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "2RS" }),
    { stage: "floor", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({
      currentStatus: "",
      historyActions: ["INT 1RA REF ATR", "3RDG FINAL PASSAGE"],
    }),
    { stage: "floor", committeeCode: "ATR" }
  );
});

test("normalizes reported stage from REP status or history", () => {
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "REP" }),
    { stage: "reported", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "R/S" }),
    { stage: "reported", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({
      currentStatus: "",
      historyActions: ["INT 1RA REF ATR", "REP"],
    }),
    { stage: "reported", committeeCode: "ATR" }
  );
});

test("normalizes committee stage and extracts committee code", () => {
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "ATR" }),
    { stage: "committee", committeeCode: "ATR" }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "ASL" }),
    { stage: "committee", committeeCode: "ASL" }
  );
  assert.deepStrictEqual(
    normalizeBillStage({
      currentStatus: "",
      historyActions: ["INT 1RA REF AJU"],
    }),
    { stage: "committee", committeeCode: "AJU" }
  );
});

test("normalizes introduced stage as fallback", () => {
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "" }),
    { stage: "introduced", committeeCode: null }
  );
  assert.deepStrictEqual(
    normalizeBillStage({ currentStatus: "INTRO" }),
    { stage: "introduced", committeeCode: null }
  );
});

// ---------------------------------------------------------------------------
// 4. assertBulkOutputsValid
// ---------------------------------------------------------------------------
console.log("\n--- 4. Bulk Output Integrity Invariants ---");

test("rejects empty or corrupt billStages", () => {
  assert.throws(
    () => assertBulkOutputsValid({}, { rollCalls: [{ id: "1" }], legislatorStats: { 1: {} } }),
    /validation error|expected >= 1000/i
  );
  assert.throws(
    () => assertBulkOutputsValid(null, { rollCalls: [{ id: "1" }], legislatorStats: { 1: {} } }),
    /validation error/i
  );
});

test("rejects empty or corrupt votesData", () => {
  const mockStages = {};
  for (let i = 0; i < 1005; i++) mockStages[`A${i}`] = { bill: `A${i}`, stage: "introduced" };

  assert.throws(
    () => assertBulkOutputsValid(mockStages, { rollCalls: [] }),
    /validation error|rollCalls/i
  );
  assert.throws(
    () => assertBulkOutputsValid(mockStages, null),
    /validation error/i
  );
});

test("accepts valid bulk outputs", () => {
  const mockStages = {};
  for (let i = 0; i < 1005; i++) {
    mockStages[`A${i}`] = {
      bill: `A${i}`,
      stage: "introduced",
      statusCode: "",
      committeeCode: null,
      lastAction: "",
      lastActionDate: null,
      isSubstantive: true,
    };
  }
  const mockVotes = {
    generatedAt: new Date().toISOString(),
    source: { name: "NJLeg", portalUrl: "https://pub.njleg.state.nj.us" },
    rollCalls: [
      {
        id: "a-a101-1",
        bill: "A101",
        chamber: "Assembly",
        date: "2026-01-13",
        action: "3RDG FINAL PASSAGE",
        abstract: "Test",
        yeas: 80,
        nays: 0,
        abstains: 0,
        notVoting: 0,
        votesByLegislatorId: {},
      },
    ],
    legislatorStats: {
      1: {
        eligible: 1,
        cast: 1,
        yeas: 1,
        nays: 0,
        abstains: 0,
        attendancePct: 100,
        partyUnityPct: 100,
      },
    },
  };

  assert.doesNotThrow(() => assertBulkOutputsValid(mockStages, mockVotes));

  const overCapacityAssembly = {
    ...mockVotes,
    rollCalls: [{ ...mockVotes.rollCalls[0], yeas: 81 }],
  };
  assert.throws(
    () => assertBulkOutputsValid(mockStages, overCapacityAssembly),
    /exceeding chamber capacity/i
  );

  const overCapacitySenate = {
    ...mockVotes,
    rollCalls: [{ ...mockVotes.rollCalls[0], id: "s-s420-1", chamber: "Senate", yeas: 41 }],
  };
  assert.throws(
    () => assertBulkOutputsValid(mockStages, overCapacitySenate),
    /exceeding chamber capacity/i
  );
});

test("parseRollCallsFromCsvRows splits two consecutive (bill, date, action) blocks into 2 roll calls", () => {
  const rows = [
    ["Bill", "FullName", "Date", "Seq", "Abstract", "Action", "Vote"],
    ["A4071", "Doe, Jane", "06/29/2026", "1", "First vote", "3RDG FINAL PASSAGE", "Y"],
    ["A4071", "Smith, John", "06/29/2026", "2", "First vote", "3RDG FINAL PASSAGE", "N"],
    ["A4071", "Doe, Jane", "06/29/2026", "1", "Second vote", "3RDG FINAL PASSAGE", "N"],
    ["A4071", "Smith, John", "06/29/2026", "2", "Second vote", "3RDG FINAL PASSAGE", "Y"],
  ];
  const matcher = (name) => (name === "Doe, Jane" ? 1 : name === "Smith, John" ? 2 : null);
  const parsed = parseRollCallsFromCsvRows(rows, "Assembly", matcher);

  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].yeas, 1);
  assert.strictEqual(parsed[0].nays, 1);
  assert.strictEqual(parsed[0].votesByLegislatorId["1"], "Y");
  assert.strictEqual(parsed[0].votesByLegislatorId["2"], "N");

  assert.strictEqual(parsed[1].yeas, 1);
  assert.strictEqual(parsed[1].nays, 1);
  assert.strictEqual(parsed[1].votesByLegislatorId["1"], "N");
  assert.strictEqual(parsed[1].votesByLegislatorId["2"], "Y");
  assert.notStrictEqual(parsed[0].id, parsed[1].id);
});

// ---------------------------------------------------------------------------
// 5. calculateLegislatorVoteStats
// ---------------------------------------------------------------------------
console.log("\n--- 5. Safe Legislator Vote Stats Calculation ---");

test("returns 0% without NaN when eligible === 0", () => {
  const stats = calculateLegislatorVoteStats({
    eligible: 0,
    cast: 0,
    yeas: 0,
    nays: 0,
    abstains: 0,
    contestedEligible: 0,
    contestedUnityMatches: 0,
  });

  assert.strictEqual(stats.attendancePct, 0);
  assert.strictEqual(stats.partyUnityPct, 0);
  assert.strictEqual(Number.isNaN(stats.attendancePct), false);
  assert.strictEqual(Number.isNaN(stats.partyUnityPct), false);
});

test("calculates attendance and party unity correctly", () => {
  const stats = calculateLegislatorVoteStats({
    eligible: 100,
    cast: 95,
    yeas: 90,
    nays: 5,
    abstains: 0,
    contestedEligible: 50,
    contestedUnityMatches: 45,
  });

  assert.strictEqual(stats.attendancePct, 95);
  assert.strictEqual(stats.partyUnityPct, 90);
});

// ---------------------------------------------------------------------------
// 6. Generated Data Files Invariants (if files exist on disk)
// ---------------------------------------------------------------------------
const billStagesPath = path.join(root, "src/data/bill-stages.json");
const votesPath = path.join(root, "src/data/votes.json");

if (fs.existsSync(billStagesPath) && fs.existsSync(votesPath)) {
  console.log("\n--- 6. Disk Invariants Verification ---");

  test("bill-stages.json contains all 11,475 bills from bills.json", () => {
    const bills = JSON.parse(fs.readFileSync(path.join(root, "src/data/bills.json"), "utf8"));
    const billStages = JSON.parse(fs.readFileSync(billStagesPath, "utf8"));

    const billsKeys = Object.keys(bills);
    assert.strictEqual(billsKeys.length, 11475);

    for (const key of billsKeys) {
      assert.ok(billStages[key], `Missing bill stage entry for bill ${key}`);
      assert.ok(
        ["introduced", "committee", "reported", "floor", "enacted"].includes(billStages[key].stage),
        `Invalid stage ${billStages[key].stage} for bill ${key}`
      );
    }
  });

  test("votes.json contains valid rollCalls and 120 legislatorStats", () => {
    const votes = JSON.parse(fs.readFileSync(votesPath, "utf8"));
    assert.ok(Array.isArray(votes.rollCalls));
    assert.strictEqual(votes.rollCalls.length, 543);
    for (const rc of votes.rollCalls) {
      const cap = rc.chamber === "Senate" ? 40 : 80;
      const totalVotes = (rc.yeas || 0) + (rc.nays || 0) + (rc.abstains || 0) + (rc.notVoting || 0);
      assert.ok(
        totalVotes <= cap,
        `Roll call ${rc.id} (${rc.chamber}) has ${totalVotes} votes > capacity ${cap}`
      );
    }
    assert.ok(votes.legislatorStats && typeof votes.legislatorStats === "object");

    const statKeys = Object.keys(votes.legislatorStats);
    assert.strictEqual(statKeys.length, 120);

    for (const key of statKeys) {
      const s = votes.legislatorStats[key];
      assert.strictEqual(typeof s.eligible, "number");
      assert.strictEqual(typeof s.cast, "number");
      assert.strictEqual(typeof s.attendancePct, "number");
      assert.strictEqual(typeof s.partyUnityPct, "number");
      assert.strictEqual(Number.isNaN(s.attendancePct), false);
      assert.strictEqual(Number.isNaN(s.partyUnityPct), false);
    }
  });
}

// ---------------------------------------------------------------------------
// 7. Sector Definitions & Committee Jurisdictions
// ---------------------------------------------------------------------------
console.log("\n--- 7. Sector Definitions & Committee Jurisdictions ---");

test("defines 8 distinct economic sectors with color and committee mappings", () => {
  assert.strictEqual(Array.isArray(SECTOR_DEFINITIONS), true);
  assert.strictEqual(SECTOR_DEFINITIONS.length, 8);

  const expectedKeys = [
    "real_estate",
    "healthcare_pharma",
    "energy_utilities",
    "finance_insurance",
    "labor_unions",
    "law_lobbying",
    "tech_telecom",
    "civic_grassroots",
  ];

  const actualKeys = SECTOR_DEFINITIONS.map((s) => s.key);
  assert.deepStrictEqual(actualKeys, expectedKeys);

  for (const s of SECTOR_DEFINITIONS) {
    assert.strictEqual(typeof s.color, "string");
    assert.ok(s.color.startsWith("#"), `Sector ${s.key} color must be a hex code`);
    assert.strictEqual(Array.isArray(s.committeeCodes), true);
  }

  const sectorMap = new Map(SECTOR_DEFINITIONS.map((s) => [s.key, s]));
  assert.deepStrictEqual(sectorMap.get("real_estate").committeeCodes, ["AHO", "SCU", "ACE", "SEG"]);
  assert.deepStrictEqual(sectorMap.get("healthcare_pharma").committeeCodes, ["AHE", "AHN", "SHH"]);
  assert.deepStrictEqual(sectorMap.get("energy_utilities").committeeCodes, ["AEN", "SEN", "ATU"]);
  assert.deepStrictEqual(sectorMap.get("finance_insurance").committeeCodes, ["AFI", "AAP", "ABU", "SBA", "SCM"]);
  assert.deepStrictEqual(sectorMap.get("labor_unions").committeeCodes, ["ALA", "SLA"]);
  assert.deepStrictEqual(sectorMap.get("law_lobbying").committeeCodes, ["AJU", "SJU", "SLP", "APS"]);
  assert.deepStrictEqual(sectorMap.get("tech_telecom").committeeCodes, ["AST", "ATU"]);
  assert.deepStrictEqual(sectorMap.get("civic_grassroots").committeeCodes, []);
});

// ---------------------------------------------------------------------------
// 8. Donor Sector Classification
// ---------------------------------------------------------------------------
console.log("\n--- 8. Donor Sector Classification ---");

test("classifies key NJ PACs and organizations into sectors", () => {
  assert.strictEqual(classifyDonorSector({ name: "NJEA PAC" }), "labor_unions");
  assert.strictEqual(classifyDonorSector({ name: "IBEW LOCAL 400 PAC" }), "labor_unions");
  assert.strictEqual(classifyDonorSector({ name: "Hackensack Meridian Health" }), "healthcare_pharma");
  assert.strictEqual(classifyDonorSector({ name: "RWJ Barnabas Health PAC" }), "healthcare_pharma");
  assert.strictEqual(classifyDonorSector({ name: "NJ Realtors PAC" }), "real_estate");
  assert.strictEqual(classifyDonorSector({ name: "PSEG" }), "energy_utilities");
  assert.strictEqual(classifyDonorSector({ name: "Prudential Financial" }), "finance_insurance");
  assert.strictEqual(classifyDonorSector({ name: "Verizon New Jersey" }), "tech_telecom");
  assert.strictEqual(classifyDonorSector({ name: "Gibbons P.C." }), "law_lobbying");
});

test("classifies grassroots individual contributions cleanly", () => {
  const indDonor = {
    name: "Jane Smith",
    amount: 250,
    isIndividual: true,
    contributorType: "INDIVIDUAL",
    employer: "Public School Teacher",
    occupation: "Teacher",
  };
  assert.strictEqual(classifyDonorSector(indDonor), "civic_grassroots");

  const uncatInd = {
    name: "John Doe",
    amount: 250,
    isIndividual: true,
    contributorType: null,
  };
  assert.strictEqual(classifyDonorSector(uncatInd), "civic_grassroots");
});

test("classifies generic non-individual contributor types as fallback", () => {
  assert.strictEqual(
    classifyDonorSector({ name: "ABC LLC", isIndividual: false, contributorType: "BUSINESS/CORP" }),
    "finance_insurance"
  );
  assert.strictEqual(
    classifyDonorSector({ name: "DEF Committee", isIndividual: false, contributorType: "PROFESSIONAL PAC" }),
    "law_lobbying"
  );
  assert.strictEqual(
    classifyDonorSector({ name: "GHI Association", isIndividual: false, contributorType: "UNION" }),
    "labor_unions"
  );
});

// ---------------------------------------------------------------------------
// 9. Legislator Influence Analytics & Committee Alignment
// ---------------------------------------------------------------------------
console.log("\n--- 9. Legislator Influence Analytics & Committee Alignment ---");

const mockLegislator = {
  id: 1,
  fullName: "John Doe",
  sortName: "Doe, John",
  firstName: "John",
  lastName: "Doe",
  suffix: "",
  party: "D",
  partyName: "Democrat",
  chamber: "Assembly",
  district: 1,
  title: "Assemblyman",
  leadership: "",
  email: "asmdoe@njleg.org",
  photo: null,
  officialUrl: "https://www.njleg.state.nj.us/",
  contactUrl: "https://www.njleg.state.nj.us/",
  education: [],
  occupation: [],
  publicService: [],
  militaryService: [],
  legislativeService: [],
  addresses: [],
  committees: [
    {
      name: "Health",
      code: "AHE",
      position: "Member",
      url: null,
    },
    {
      name: "Environment and Solid Waste",
      code: "AEN",
      position: "Member",
      url: null,
    },
  ],
  districtInfo: null,
  bills: [],
};

test("safely handles undefined or empty donorProfiles returning zero values without NaN", () => {
  const summaryUndefined = computeLegislatorInfluence(mockLegislator, undefined);
  assert.strictEqual(summaryUndefined.legislatorId, 1);
  assert.strictEqual(summaryUndefined.totalRaised, 0);
  assert.strictEqual(summaryUndefined.grassrootsAmount, 0);
  assert.strictEqual(summaryUndefined.institutionalAmount, 0);
  assert.strictEqual(summaryUndefined.grassrootsPct, 0);
  assert.strictEqual(summaryUndefined.institutionalPct, 0);
  assert.deepStrictEqual(summaryUndefined.topSectors, []);
  assert.deepStrictEqual(summaryUndefined.committeeAlignments, []);
  assert.strictEqual(Number.isNaN(summaryUndefined.grassrootsPct), false);
  assert.strictEqual(Number.isNaN(summaryUndefined.institutionalPct), false);
  assert.strictEqual(Number.isNaN(summaryUndefined.totalRaised), false);

  for (const s of SECTOR_DEFINITIONS) {
    assert.strictEqual(summaryUndefined.sectorTotals[s.key], 0);
  }

  const summaryEmpty = computeLegislatorInfluence(mockLegislator, []);
  assert.strictEqual(summaryEmpty.totalRaised, 0);
  assert.strictEqual(summaryEmpty.grassrootsPct, 0);
  assert.strictEqual(summaryEmpty.institutionalPct, 0);
});

test("detects committee overlap and calculates grassroots vs institutional percentage", () => {
  const donorProfile = {
    key: "doe-1",
    legislatorId: 1,
    name: "John Doe",
    district: 1,
    chamber: "Assembly",
    party: "D",
    electionYear: 2023,
    entities: [],
    source: { label: "ELEC", portalUrl: "" },
    totalAmount: 20000,
    contributionCount: 2,
    donorCount: 2,
    donors: [
      {
        name: "Hackensack Meridian Health",
        isIndividual: false,
        contributorType: "BUSINESS/CORP",
        year: "2023",
        amount: 10000,
        count: 1,
        employer: null,
        occupation: null,
        lastDate: "2023-10-01",
      },
      {
        name: "Jane Grassroots",
        isIndividual: true,
        contributorType: "INDIVIDUAL",
        year: "2023",
        amount: 10000,
        count: 1,
        employer: "Public School",
        occupation: "Teacher",
        lastDate: "2023-10-05",
      },
    ],
  };

  const summary = computeLegislatorInfluence(mockLegislator, [donorProfile]);

  assert.strictEqual(summary.totalRaised, 20000);
  assert.strictEqual(summary.grassrootsAmount, 10000);
  assert.strictEqual(summary.institutionalAmount, 10000);
  assert.strictEqual(summary.grassrootsPct, 50);
  assert.strictEqual(summary.institutionalPct, 50);

  // Committee alignment hit: mockLegislator is on AHE ("Health"), which matches healthcare_pharma
  assert.strictEqual(summary.committeeAlignments.length, 1);
  assert.strictEqual(summary.committeeAlignments[0].committeeCode, "AHE");
  assert.strictEqual(summary.committeeAlignments[0].committeeName, "Health");
  assert.strictEqual(summary.committeeAlignments[0].sector, "healthcare_pharma");
  assert.strictEqual(summary.committeeAlignments[0].sectorAmount, 10000);
});

test("computes valid influence summaries for all 120 legislators against official ELEC donors", () => {
  const legs = JSON.parse(fs.readFileSync(path.join(root, "src/data/legislators.json"), "utf8"));
  const donors = JSON.parse(fs.readFileSync(path.join(root, "src/data/donors.json"), "utf8"));

  const profilesByLeg = new Map();
  for (const p of donors.profiles) {
    const list = profilesByLeg.get(p.legislatorId) || [];
    list.push(p);
    profilesByLeg.set(p.legislatorId, list);
  }

  assert.strictEqual(legs.length, 120);

  let totalAlignedCount = 0;
  for (const leg of legs) {
    const profiles = profilesByLeg.get(leg.id);
    const summary = computeLegislatorInfluence(leg, profiles);

    assert.strictEqual(summary.legislatorId, leg.id);
    assert.strictEqual(typeof summary.totalRaised, "number");
    assert.strictEqual(typeof summary.grassrootsPct, "number");
    assert.strictEqual(typeof summary.institutionalPct, "number");
    assert.strictEqual(Number.isNaN(summary.totalRaised), false);
    assert.strictEqual(Number.isNaN(summary.grassrootsPct), false);
    assert.strictEqual(Number.isNaN(summary.institutionalPct), false);

    if (summary.totalRaised > 0) {
      assert.strictEqual(summary.grassrootsPct + summary.institutionalPct, 100);
    } else {
      assert.strictEqual(summary.grassrootsPct, 0);
      assert.strictEqual(summary.institutionalPct, 0);
    }

    for (const align of summary.committeeAlignments) {
      assert.ok(align.sectorAmount > 0);
      assert.ok(SECTOR_DEFINITIONS.some((s) => s.key === align.sector));
      assert.ok(leg.committees.some((c) => c.code === align.committeeCode));
      totalAlignedCount++;
    }
  }

  // Real data contains numerous standing committee members receiving funds from aligned sectors
  assert.ok(totalAlignedCount > 0, "Expected at least one real committee-donor alignment in ELEC data");
});

// ---------------------------------------------------------------------------
// 10. Legislative Pipeline Funnel & Stage Invariants
// ---------------------------------------------------------------------------
console.log("\n--- 10. Legislative Pipeline Funnel & Stage Invariants ---");

test("isSubstantiveBillCode distinguishes substantive bills from resolutions", () => {
  assert.strictEqual(isSubstantiveBillCode("S100"), true);
  assert.strictEqual(isSubstantiveBillCode("s4500"), true);
  assert.strictEqual(isSubstantiveBillCode("A1"), true);
  assert.strictEqual(isSubstantiveBillCode("a5999"), true);
  assert.strictEqual(isSubstantiveBillCode("SR10"), false);
  assert.strictEqual(isSubstantiveBillCode("AR20"), false);
  assert.strictEqual(isSubstantiveBillCode("SCR100"), false);
  assert.strictEqual(isSubstantiveBillCode("ACR50"), false);
  assert.strictEqual(isSubstantiveBillCode("SJR1"), false);
  assert.strictEqual(isSubstantiveBillCode("AJR2"), false);
  assert.strictEqual(isSubstantiveBillCode(""), false);
  assert.strictEqual(isSubstantiveBillCode(null), false);
});

test("stageOrderIndex enforces monotonically advancing pipeline stages", () => {
  assert.strictEqual(stageOrderIndex("introduced"), 0);
  assert.strictEqual(stageOrderIndex("committee"), 1);
  assert.strictEqual(stageOrderIndex("reported"), 2);
  assert.strictEqual(stageOrderIndex("floor"), 3);
  assert.strictEqual(stageOrderIndex("enacted"), 4);
});

test("buildPipelineFunnel satisfies cumulative and percentage invariants", () => {
  const mockStages = {
    A1: { bill: "A1", stage: "introduced", isSubstantive: true, statusCode: "", committeeCode: null, lastAction: "", lastActionDate: null },
    A2: { bill: "A2", stage: "committee", isSubstantive: true, statusCode: "", committeeCode: "AHE", lastAction: "", lastActionDate: null },
    A3: { bill: "A3", stage: "reported", isSubstantive: true, statusCode: "", committeeCode: "AHE", lastAction: "", lastActionDate: null },
    A4: { bill: "A4", stage: "floor", isSubstantive: true, statusCode: "", committeeCode: null, lastAction: "", lastActionDate: null },
    A5: { bill: "A5", stage: "enacted", isSubstantive: true, statusCode: "", committeeCode: null, lastAction: "", lastActionDate: null },
    AR1: { bill: "AR1", stage: "floor", isSubstantive: false, statusCode: "", committeeCode: null, lastAction: "", lastActionDate: null },
    S1: { bill: "S1", stage: "enacted", isSubstantive: true, statusCode: "", committeeCode: null, lastAction: "", lastActionDate: null },
  };

  const funnel = buildPipelineFunnel(mockStages);
  assert.strictEqual(funnel.total, 6); // 5 A bills + 1 S bill (AR1 excluded)
  assert.strictEqual(funnel.stages.length, 5);

  // Invariant 1: Introduced cumulative count matches total
  assert.strictEqual(funnel.stages[0].stage, "introduced");
  assert.strictEqual(funnel.stages[0].reachedCount, 6);
  assert.strictEqual(funnel.stages[0].reachedPct, 100);

  // Invariant 2: Monotonic decrease of cumulative reachedCount and reachedPct
  for (let i = 0; i < funnel.stages.length - 1; i++) {
    assert.ok(
      funnel.stages[i].reachedCount >= funnel.stages[i + 1].reachedCount,
      `reachedCount not monotonically decreasing: ${funnel.stages[i].stage} (${funnel.stages[i].reachedCount}) vs ${funnel.stages[i + 1].stage} (${funnel.stages[i + 1].reachedCount})`
    );
    assert.ok(
      funnel.stages[i].reachedPct >= funnel.stages[i + 1].reachedPct,
      `reachedPct not monotonically decreasing: ${funnel.stages[i].stage} vs ${funnel.stages[i + 1].stage}`
    );
  }

  // Invariant 3: Sum of currentCount across all stages equals total
  const sumCurrent = funnel.stages.reduce((acc, s) => acc + s.currentCount, 0);
  assert.strictEqual(sumCurrent, funnel.total);

  // Chamber filter test
  const senateFunnel = buildPipelineFunnel(mockStages, "Senate");
  assert.strictEqual(senateFunnel.total, 1);
  assert.strictEqual(senateFunnel.stages[4].currentCount, 1);

  const assemblyFunnel = buildPipelineFunnel(mockStages, "Assembly");
  assert.strictEqual(assemblyFunnel.total, 5);

  // Empty data safety - no NaN
  const emptyFunnel = buildPipelineFunnel({});
  assert.strictEqual(emptyFunnel.total, 0);
  for (const s of emptyFunnel.stages) {
    assert.strictEqual(s.reachedCount, 0);
    assert.strictEqual(s.reachedPct, 0);
    assert.strictEqual(Number.isNaN(s.reachedPct), false);
  }
});

// ---------------------------------------------------------------------------
// 11. Committee Bottlenecks Detector
// ---------------------------------------------------------------------------
console.log("\n--- 11. Committee Bottlenecks Detector ---");

test("buildCommitteeBottlenecks detects held bills and advancement rates", () => {
  const mockLegs = [
    {
      id: 1,
      committees: [
        { name: "Assembly Health", code: "AHE", position: "Member", url: null },
        { name: "Senate Judiciary", code: "SJU", position: "Chair", url: null },
      ],
    },
  ];

  const mockStages = {
    A10: { bill: "A10", stage: "committee", committeeCode: "AHE", isSubstantive: true },
    A11: { bill: "A11", stage: "committee", committeeCode: "AHE", isSubstantive: true },
    A12: { bill: "A12", stage: "reported", committeeCode: "AHE", isSubstantive: true },
    A13: { bill: "A13", stage: "floor", committeeCode: "AHE", isSubstantive: true },
    S20: { bill: "S20", stage: "committee", committeeCode: "SJU", isSubstantive: true },
    S21: { bill: "S21", stage: "enacted", committeeCode: "SJU", isSubstantive: true },
    AR1: { bill: "AR1", stage: "committee", committeeCode: "AHE", isSubstantive: false }, // Ignored non-substantive
  };

  const bottlenecks = buildCommitteeBottlenecks(mockStages, mockLegs);
  assert.strictEqual(bottlenecks.length, 2);

  // Sorted by heldInCommitteeCount desc: AHE (2 held) then SJU (1 held)
  assert.strictEqual(bottlenecks[0].committeeCode, "AHE");
  assert.strictEqual(bottlenecks[0].committeeName, "Assembly Health");
  assert.strictEqual(bottlenecks[0].chamber, "Assembly");
  assert.strictEqual(bottlenecks[0].heldInCommitteeCount, 2);
  assert.strictEqual(bottlenecks[0].advancedCount, 2);
  assert.strictEqual(bottlenecks[0].totalSeenCount, 4);
  assert.strictEqual(bottlenecks[0].advancementRatePct, 50);

  assert.strictEqual(bottlenecks[1].committeeCode, "SJU");
  assert.strictEqual(bottlenecks[1].committeeName, "Senate Judiciary");
  assert.strictEqual(bottlenecks[1].chamber, "Senate");
  assert.strictEqual(bottlenecks[1].heldInCommitteeCount, 1);
  assert.strictEqual(bottlenecks[1].advancedCount, 1);
  assert.strictEqual(bottlenecks[1].totalSeenCount, 2);
  assert.strictEqual(bottlenecks[1].advancementRatePct, 50);

  // Empty data returns empty array
  assert.deepStrictEqual(buildCommitteeBottlenecks({}, []), []);
});

// ---------------------------------------------------------------------------
// 12. Nonpartisan LES & Neutral Archetypes
// ---------------------------------------------------------------------------
console.log("\n--- 12. Nonpartisan LES & Neutral Archetypes ---");

test("computeRawLegislatorPoints calculates weighted points and handles zero-bill safety", () => {
  const zeroLeg = { id: 99, bills: [] };
  const zeroPoints = computeRawLegislatorPoints(zeroLeg, {});
  assert.strictEqual(zeroPoints.rawPoints, 0);
  assert.strictEqual(zeroPoints.primarySubstantive, 0);
  assert.strictEqual(zeroPoints.cosponsoredSubstantive, 0);
  assert.strictEqual(zeroPoints.advancementRatePct, 0);
  assert.strictEqual(Number.isNaN(zeroPoints.advancementRatePct), false);
  assert.strictEqual(Number.isNaN(zeroPoints.rawPoints), false);

  const activeLeg = {
    id: 1,
    bills: [
      ["A1", "P"], // introduced -> +0.5
      ["A2", "P"], // committee -> +1
      ["A3", "P"], // reported -> +3
      ["A4", "P"], // floor -> +6
      ["A5", "P"], // enacted -> +12
      ["A6", "C"], // reported -> +0.15
      ["A7", "C"], // floor -> +0.3
      ["A8", "C"], // enacted -> +0.6
      ["AR1", "P"], // non-substantive -> ignored
    ],
  };

  const mockStages = {
    A1: { bill: "A1", stage: "introduced", isSubstantive: true },
    A2: { bill: "A2", stage: "committee", isSubstantive: true },
    A3: { bill: "A3", stage: "reported", isSubstantive: true },
    A4: { bill: "A4", stage: "floor", isSubstantive: true },
    A5: { bill: "A5", stage: "enacted", isSubstantive: true },
    A6: { bill: "A6", stage: "reported", isSubstantive: true },
    A7: { bill: "A7", stage: "floor", isSubstantive: true },
    A8: { bill: "A8", stage: "enacted", isSubstantive: true },
    AR1: { bill: "AR1", stage: "enacted", isSubstantive: false },
  };

  const pts = computeRawLegislatorPoints(activeLeg, mockStages);
  assert.strictEqual(pts.primarySubstantive, 5);
  assert.strictEqual(pts.primaryCommitteePlus, 4);
  assert.strictEqual(pts.primaryReportedPlus, 3);
  assert.strictEqual(pts.primaryFloorPlus, 2);
  assert.strictEqual(pts.primaryEnacted, 1);
  assert.strictEqual(pts.cosponsoredSubstantive, 3);
  assert.strictEqual(pts.cosponsoredEnacted, 1);
  // primary = 0.5 + 1 + 3 + 6 + 12 = 22.5
  // cosponsored = 0.15 + 0.3 + 0.6 = 1.05
  // total = 23.55
  assert.strictEqual(pts.rawPoints, 23.55);
  // advancement rate: 3 reported+ / 5 primary = 60%
  assert.strictEqual(pts.advancementRatePct, 60);
});

test("classifyEffectivenessArchetype applies deterministic nonpartisan rules", () => {
  // high_throughput: lesScore >= 55 && (primaryEnacted >= 1 || primaryFloorPlus >= 3 || primaryReportedPlus >= 5)
  assert.strictEqual(
    classifyEffectivenessArchetype({
      lesScore: 70,
      primarySubstantive: 10,
      primaryReportedPlus: 4,
      primaryFloorPlus: 2,
      primaryEnacted: 1,
      cosponsoredSubstantive: 5,
      advancementRatePct: 40,
      bipartisanRatePct: 10,
      topTwoTopicSharePct: 30,
    }),
    "high_throughput"
  );

  // policy_specialist: primarySubstantive >= 5 && (advancementRatePct >= 12 || topTwoTopicSharePct >= 55)
  assert.strictEqual(
    classifyEffectivenessArchetype({
      lesScore: 40,
      primarySubstantive: 6,
      primaryReportedPlus: 1,
      primaryFloorPlus: 0,
      primaryEnacted: 0,
      cosponsoredSubstantive: 2,
      advancementRatePct: 16.7,
      bipartisanRatePct: 5,
      topTwoTopicSharePct: 40,
    }),
    "policy_specialist"
  );

  // coalition_builder: bipartisanRatePct >= 25 || cosponsoredSubstantive >= 25
  assert.strictEqual(
    classifyEffectivenessArchetype({
      lesScore: 30,
      primarySubstantive: 2,
      primaryReportedPlus: 0,
      primaryFloorPlus: 0,
      primaryEnacted: 0,
      cosponsoredSubstantive: 30,
      advancementRatePct: 0,
      bipartisanRatePct: 10,
      topTwoTopicSharePct: 20,
    }),
    "coalition_builder"
  );

  // developing: fallback
  assert.strictEqual(
    classifyEffectivenessArchetype({
      lesScore: 10,
      primarySubstantive: 1,
      primaryReportedPlus: 0,
      primaryFloorPlus: 0,
      primaryEnacted: 0,
      cosponsoredSubstantive: 2,
      advancementRatePct: 0,
      bipartisanRatePct: 0,
      topTwoTopicSharePct: 10,
    }),
    "developing"
  );
});

// ---------------------------------------------------------------------------
// 13. Full Effectiveness Integration on Disk Datasets
// ---------------------------------------------------------------------------
console.log("\n--- 13. Full Effectiveness Integration on Disk Datasets ---");

if (fs.existsSync(billStagesPath) && fs.existsSync(votesPath)) {
  test("computes valid effectiveness metrics across all 120 NJ legislators", () => {
    const legs = JSON.parse(fs.readFileSync(path.join(root, "src/data/legislators.json"), "utf8"));
    const billStages = JSON.parse(fs.readFileSync(billStagesPath, "utf8"));
    const votes = JSON.parse(fs.readFileSync(votesPath, "utf8"));

    const funnel = buildPipelineFunnel(billStages);
    assert.ok(funnel.total > 8000, `Expected > 8000 substantive bills, got ${funnel.total}`);
    assert.strictEqual(funnel.stages[0].reachedCount, funnel.total);
    assert.strictEqual(funnel.stages[0].reachedPct, 100);

    const enactedStage = funnel.stages.find((s) => s.stage === "enacted");
    assert.ok(enactedStage.reachedCount > 0, "Expected at least 1 enacted substantive bill");

    const bottlenecks = buildCommitteeBottlenecks(billStages, legs);
    assert.ok(bottlenecks.length > 0, "Expected committee bottlenecks");
    for (const b of bottlenecks) {
      assert.ok(b.committeeCode.length > 0);
      assert.ok(["Senate", "Assembly", "Other"].includes(b.chamber));
      assert.strictEqual(b.totalSeenCount, b.heldInCommitteeCount + b.advancedCount);
      assert.strictEqual(Number.isNaN(b.advancementRatePct), false);
    }
    assert.ok(
      bottlenecks.some((c) => c.advancedCount > 0 && c.advancementRatePct > 0),
      "Expected committee bottlenecks to have non-zero advancement rates in real NJ data"
    );

    const effectivenessMap = computeChamberNormalizedEffectiveness(legs, billStages);
    assert.strictEqual(effectivenessMap.size, 120);

    let maxSenateLes = 0;
    let maxAssemblyLes = 0;
    const archetypesFound = new Set();

    for (const leg of legs) {
      const eff = effectivenessMap.get(leg.id);
      assert.ok(eff, `Missing effectiveness entry for legislator ${leg.id}`);
      assert.strictEqual(eff.legislatorId, leg.id);
      assert.strictEqual(typeof eff.rawPoints, "number");
      assert.strictEqual(typeof eff.lesScore, "number");
      assert.strictEqual(Number.isNaN(eff.rawPoints), false);
      assert.strictEqual(Number.isNaN(eff.lesScore), false);
      assert.strictEqual(Number.isNaN(eff.advancementRatePct), false);
      assert.ok(eff.lesScore >= 0 && eff.lesScore <= 100);

      if (leg.chamber === "Senate") {
        if (eff.lesScore > maxSenateLes) maxSenateLes = eff.lesScore;
      } else if (leg.chamber === "Assembly") {
        if (eff.lesScore > maxAssemblyLes) maxAssemblyLes = eff.lesScore;
      }

      archetypesFound.add(eff.archetype);
      assert.ok(
        ["high_throughput", "policy_specialist", "coalition_builder", "developing"].includes(eff.archetype),
        `Unexpected archetype ${eff.archetype}`
      );
    }

    assert.strictEqual(maxSenateLes, 100, "Expected max Senate LES score to normalize to 100");
    assert.strictEqual(maxAssemblyLes, 100, "Expected max Assembly LES score to normalize to 100");
    assert.ok(archetypesFound.size >= 3, "Expected diverse archetypes in real legislature");
  });
}

// ---------------------------------------------------------------------------
// 14. Task 2 Polish Checks
// ---------------------------------------------------------------------------
console.log("\n--- 14. Task 2 Polish Checks ---");

test("classifyDonorSector handles empty arguments cleanly without throwing", () => {
  assert.strictEqual(classifyDonorSector(), "civic_grassroots");
  assert.strictEqual(classifyDonorSector({}), "civic_grassroots");
});

test("classifyDonorSector matches labor union local prefixes with punctuation/numbers", () => {
  assert.strictEqual(classifyDonorSector({ name: "Local-825 PAC" }), "labor_unions");
  assert.strictEqual(classifyDonorSector({ name: "Local#400 PAC" }), "labor_unions");
  assert.strictEqual(classifyDonorSector({ name: "Local 100" }), "labor_unions");
  assert.strictEqual(classifyDonorSector({ name: "IBEW Local 102" }), "labor_unions");
});

// ---------------------------------------------------------------------------
// 15. Correlation Sandbox: Pearson R & Median Split Engine
// ---------------------------------------------------------------------------
console.log("\n--- 15. Correlation Sandbox: Pearson R & Median Split Engine ---");

test("computePearsonCorrelation handles boundary, perfect, and inverse correlations", () => {
  // Empty or insufficient points (< 2) returns 0 without NaN
  assert.strictEqual(computePearsonCorrelation([]), 0);
  assert.strictEqual(computePearsonCorrelation([{ x: 10, y: 20 }]), 0);

  // Perfect positive (+1.0)
  assert.strictEqual(
    computePearsonCorrelation([
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]),
    1
  );

  // Perfect negative (-1.0)
  assert.strictEqual(
    computePearsonCorrelation([
      { x: 1, y: 6 },
      { x: 2, y: 4 },
      { x: 3, y: 2 },
    ]),
    -1
  );

  // Sample with known moderate correlation
  const r = computePearsonCorrelation([
    { x: 1, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 5 },
    { x: 4, y: 4 },
    { x: 5, y: 6 },
  ]);
  assert.ok(r > 0.8 && r < 1.0, `Expected moderate positive correlation, got ${r}`);
});

test("computePearsonCorrelation enforces zero-variance and non-finite safety", () => {
  // Vertical line (zero variance in X) -> MUST return 0, NEVER NaN
  assert.strictEqual(
    computePearsonCorrelation([
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ]),
    0
  );

  // Horizontal line (zero variance in Y) -> MUST return 0, NEVER NaN
  assert.strictEqual(
    computePearsonCorrelation([
      { x: 1, y: 7 },
      { x: 2, y: 7 },
      { x: 3, y: 7 },
    ]),
    0
  );

  // All identical points -> MUST return 0
  assert.strictEqual(
    computePearsonCorrelation([
      { x: 4, y: 4 },
      { x: 4, y: 4 },
    ]),
    0
  );

  // Clamped strictly to [-1, 1]
  const pts = [
    { x: 100, y: 100 },
    { x: 200, y: 200 },
  ];
  const r = computePearsonCorrelation(pts);
  assert.ok(r >= -1 && r <= 1);
});

test("computeMedian computes deterministic sorted median across odd/even sizes", () => {
  assert.strictEqual(computeMedian([]), 0);
  assert.strictEqual(computeMedian([42]), 42);
  assert.strictEqual(computeMedian([3, 1, 2]), 2);
  assert.strictEqual(computeMedian([1, 2, 3, 4]), 2.5);
  assert.strictEqual(computeMedian([10, 20, 30, 40, 50]), 30);
});

test("computeLinearRegression calculates exact OLS slope, intercept, and R² safely", () => {
  // Exact positive fit: y = 2x + 10
  const pos = computeLinearRegression([1, 2, 3, 4], [12, 14, 16, 18]);
  assert.strictEqual(pos.slope, 2);
  assert.strictEqual(pos.intercept, 10);
  assert.strictEqual(pos.rSquared, 1);

  // Exact negative fit: y = -3x + 20
  const neg = computeLinearRegression([0, 2, 4], [20, 14, 8]);
  assert.strictEqual(neg.slope, -3);
  assert.strictEqual(neg.intercept, 20);
  assert.strictEqual(neg.rSquared, 1);

  // Zero variance in X -> slope 0, intercept = meanY, rSquared 0
  const vert = computeLinearRegression([5, 5, 5], [10, 20, 30]);
  assert.strictEqual(vert.slope, 0);
  assert.strictEqual(vert.intercept, 20);
  assert.strictEqual(vert.rSquared, 0);

  // Zero variance in Y -> slope 0, intercept = 7, rSquared 0
  const horiz = computeLinearRegression([1, 2, 3], [7, 7, 7]);
  assert.strictEqual(horiz.slope, 0);
  assert.strictEqual(horiz.intercept, 7);
  assert.strictEqual(horiz.rSquared, 0);

  // n < 2 & non-finite safety
  assert.deepStrictEqual(computeLinearRegression([], []), { slope: 0, intercept: 0, rSquared: 0 });
  assert.deepStrictEqual(computeLinearRegression([3], [15]), { slope: 0, intercept: 15, rSquared: 0 });
  assert.deepStrictEqual(computeLinearRegression([NaN, 1], [5, Infinity]), { slope: 0, intercept: 0, rSquared: 0 });
});

// ---------------------------------------------------------------------------
// 16. Sandbox Scatter & 12 Dimensions Extraction
// ---------------------------------------------------------------------------
console.log("\n--- 16. Sandbox Scatter & 12 Dimensions Extraction ---");

test("SANDBOX_DIMENSIONS defines all 12 civic, demographic, finance, and voting dimensions", () => {
  assert.strictEqual(SANDBOX_DIMENSIONS.length, 12);
  const keys = new Set(SANDBOX_DIMENSIONS.map((d) => d.key));
  const expectedKeys = [
    "totalRaised",
    "grassrootsPct",
    "lesScore",
    "bipartisanRate",
    "attendancePct",
    "partyUnityPct",
    "primaryBills",
    "enactedBills",
    "medianIncome",
    "medianRent",
    "transitCommuteRate",
    "homeownershipRate",
  ];
  for (const ek of expectedKeys) {
    assert.ok(keys.has(ek), `Missing dimension key ${ek}`);
  }
});

test("extractSandboxMetric safely extracts numeric metrics with fallback to 0", () => {
  const mockRow = {
    legislator: {
      id: 1,
      fullName: "Jane Doe",
      party: "D",
      chamber: "Senate",
      district: 1,
      photo: null,
    },
    totalBills: 10,
    primaryBills: 4,
    bipartisanRate: 25,
    totalRaised: 50000,
    medianIncome: 85000,
    demographics: {
      geoId: "0400000US34",
      name: "District 1",
      population: 230000,
      medianAge: 40,
      district: 1,
      medianIncome: 85000,
      medianHomeValue: 350000,
      medianRent: 1600,
      povertyRate: 8.5,
      bachelorsPlusRate: 42,
      unemploymentRate: 4.1,
      homeownershipRate: 68.5,
      transitCommuteRate: 11.2,
    },
    influenceSummary: {
      legislatorId: 1,
      totalRaised: 50000,
      grassrootsAmount: 15000,
      institutionalAmount: 35000,
      grassrootsPct: 30,
      institutionalPct: 70,
      sectorTotals: {},
      topSectors: [],
      committeeAlignments: [],
    },
    effectivenessSummary: {
      legislatorId: 1,
      primarySubstantive: 4,
      cosponsoredSubstantive: 6,
      primaryCommitteePlus: 3,
      primaryReportedPlus: 2,
      primaryFloorPlus: 1,
      primaryEnacted: 1,
      cosponsoredEnacted: 0,
      advancementRatePct: 50,
      rawPoints: 18,
      lesScore: 72,
      archetype: "high_throughput",
    },
    voteStats: {
      eligible: 100,
      cast: 95,
      yeas: 80,
      nays: 12,
      abstains: 3,
      attendancePct: 95,
      partyUnityPct: 88,
    },
  };

  assert.strictEqual(extractSandboxMetric(mockRow, "totalRaised"), 50000);
  assert.strictEqual(extractSandboxMetric(mockRow, "grassrootsPct"), 30);
  assert.strictEqual(extractSandboxMetric(mockRow, "lesScore"), 72);
  assert.strictEqual(extractSandboxMetric(mockRow, "bipartisanRate"), 25);
  assert.strictEqual(extractSandboxMetric(mockRow, "attendancePct"), 95);
  assert.strictEqual(extractSandboxMetric(mockRow, "partyUnityPct"), 88);
  assert.strictEqual(extractSandboxMetric(mockRow, "primaryBills"), 4);
  assert.strictEqual(extractSandboxMetric(mockRow, "enactedBills"), 1);
  assert.strictEqual(extractSandboxMetric(mockRow, "medianIncome"), 85000);
  assert.strictEqual(extractSandboxMetric(mockRow, "medianRent"), 1600);
  assert.strictEqual(extractSandboxMetric(mockRow, "transitCommuteRate"), 11.2);
  assert.strictEqual(extractSandboxMetric(mockRow, "homeownershipRate"), 68.5);

  // Missing properties fallback cleanly to 0
  const emptyRow = {
    legislator: {
      id: 99,
      fullName: "Empty Member",
      party: "R",
      chamber: "Assembly",
      district: 2,
      photo: null,
    },
  };
  for (const dim of SANDBOX_DIMENSIONS) {
    const val = extractSandboxMetric(emptyRow, dim.key);
    assert.strictEqual(typeof val, "number");
    assert.strictEqual(Number.isNaN(val), false);
    assert.strictEqual(val, 0);
  }
});

test("buildSandboxScatter filters points and computes median split quadrants cleanly", () => {
  const rows = [
    {
      legislator: { id: 1, fullName: "A", party: "D", chamber: "Senate", district: 1, photo: null },
      totalRaised: 10,
      voteStats: { attendancePct: 10 },
    },
    {
      legislator: { id: 2, fullName: "B", party: "D", chamber: "Senate", district: 2, photo: null },
      totalRaised: 20,
      voteStats: { attendancePct: 30 },
    },
    {
      legislator: { id: 3, fullName: "C", party: "R", chamber: "Assembly", district: 3, photo: null },
      totalRaised: 30,
      voteStats: { attendancePct: 20 },
    },
    {
      legislator: { id: 4, fullName: "D", party: "R", chamber: "Assembly", district: 4, photo: null },
      totalRaised: 40,
      voteStats: { attendancePct: 40 },
    },
  ];

  const resAll = buildSandboxScatter(rows, "totalRaised", "attendancePct");
  assert.strictEqual(resAll.points.length, 4);
  assert.strictEqual(resAll.medianX, 25);
  assert.strictEqual(resAll.medianY, 25);
  assert.ok(Number.isFinite(resAll.slope));
  assert.ok(Number.isFinite(resAll.intercept));
  assert.ok(resAll.rSquared >= 0 && resAll.rSquared <= 1);

  // Check quadrant assignments
  // Leg 1: (10, 10) -> bottomLeft
  // Leg 2: (20, 30) -> topLeft
  // Leg 3: (30, 20) -> bottomRight
  // Leg 4: (40, 40) -> topRight
  const p1 = resAll.points.find((p) => p.legislatorId === 1);
  const p2 = resAll.points.find((p) => p.legislatorId === 2);
  const p3 = resAll.points.find((p) => p.legislatorId === 3);
  const p4 = resAll.points.find((p) => p.legislatorId === 4);

  assert.strictEqual(p1.quadrant, "bottomLeft");
  assert.strictEqual(p2.quadrant, "topLeft");
  assert.strictEqual(p3.quadrant, "bottomRight");
  assert.strictEqual(p4.quadrant, "topRight");

  // Filtering by chamber
  const resSenate = buildSandboxScatter(rows, "totalRaised", "attendancePct", {
    chamber: "Senate",
  });
  assert.strictEqual(resSenate.points.length, 2);
  assert.ok(resSenate.points.every((p) => p.chamber === "Senate"));

  // Filtering by party
  const resR = buildSandboxScatter(rows, "totalRaised", "attendancePct", {
    party: "R",
  });
  assert.strictEqual(resR.points.length, 2);
  assert.ok(resR.points.every((p) => p.party === "R"));
});

// ---------------------------------------------------------------------------
// 17. Pocketbook Domain Classification & Scoring Unit Rules
// ---------------------------------------------------------------------------
console.log("\n--- 17. Pocketbook Domain Classification & Scoring Unit Rules ---");

test("classifyPocketbookDomains classifies NJ resident pocketbook pillars accurately", () => {
  const taxText = "Requires annual property tax relief under stay nj and homestead assessment rebate";
  assert.deepStrictEqual(classifyPocketbookDomains(taxText), ["property_tax"]);
  assert.strictEqual(primaryPocketbookDomain(taxText), "property_tax");

  const housingText = "Affordable housing fair share reforms and tenant eviction protection procedures";
  assert.deepStrictEqual(classifyPocketbookDomains(housingText), ["housing"]);
  assert.strictEqual(primaryPocketbookDomain(housingText), "housing");

  const transitText = "Modernizes NJ Transit rail infrastructure, commuter bus service, and highway repairs";
  assert.deepStrictEqual(classifyPocketbookDomains(transitText), ["transit"]);
  assert.strictEqual(primaryPocketbookDomain(transitText), "transit");

  // Multi-domain match (e.g. transit-oriented housing)
  const multiText = "Transit-oriented affordable housing development near commuter train stations";
  const multiDomains = classifyPocketbookDomains(multiText);
  assert.ok(multiDomains.includes("housing"));
  assert.ok(multiDomains.includes("transit"));

  // Neutral text
  assert.deepStrictEqual(classifyPocketbookDomains("Designates official state insect as the honeybee"), []);
  assert.strictEqual(primaryPocketbookDomain("Designates official state insect"), null);
});

test("computePocketbookSummaries degrades safely with 0 bills and 0 votes", () => {
  const mockLegs = [
    {
      id: 101,
      fullName: "Active Senator",
      party: "D",
      chamber: "Senate",
      district: 10,
      bills: [
        ["S100", "P"],
        ["S200", "C"],
      ],
    },
    {
      id: 102,
      fullName: "Zero Bill Senator",
      party: "R",
      chamber: "Senate",
      district: 11,
      bills: [],
    },
  ];

  const mockBills = {
    S100: { bill: "S100", synopsis: "Provides property tax relief for senior freeze homeowners", session: 2026 },
    S200: { bill: "S200", synopsis: "Expands NJ Transit commuter bus service frequency", session: 2026 },
  };

  const mockStages = {
    S100: { bill: "S100", stage: "enacted", isSubstantive: true },
    S200: { bill: "S200", stage: "reported", isSubstantive: true },
  };

  const mockRollCalls = [
    {
      id: "rc-1",
      bill: "S100",
      chamber: "Senate",
      date: "2026-06-15",
      action: "2RS 2RAG",
      abstract: "Provides property tax relief for senior freeze homeowners",
      yeas: 38,
      nays: 0,
      abstains: 0,
      notVoting: 2,
      votesByLegislatorId: {
        "101": "Y",
        "102": "NV",
      },
    },
  ];

  const { summariesById, domainRollCallCounts } = computePocketbookSummaries(
    mockLegs,
    mockBills,
    mockStages,
    mockRollCalls
  );

  assert.strictEqual(summariesById.size, 2);
  assert.strictEqual(domainRollCallCounts.property_tax, 1);
  assert.strictEqual(domainRollCallCounts.housing, 0);
  assert.strictEqual(domainRollCallCounts.transit, 0);

  const activeSum = summariesById.get(101);
  assert.strictEqual(activeSum.domains.property_tax.primaryBills, 1);
  assert.strictEqual(activeSum.domains.property_tax.enactedBills, 1);
  assert.strictEqual(activeSum.domains.property_tax.floorVotesCast, 1);
  assert.strictEqual(activeSum.domains.property_tax.yeaVotes, 1);
  assert.strictEqual(activeSum.domains.property_tax.score, 100); // normalized chamber leader

  const zeroSum = summariesById.get(102);
  assert.strictEqual(zeroSum.overallScore, 0);
  for (const dom of ["property_tax", "housing", "transit"]) {
    assert.strictEqual(zeroSum.domains[dom].score, 0);
    assert.strictEqual(zeroSum.domains[dom].primaryBills, 0);
    assert.strictEqual(zeroSum.domains[dom].enactedBills, 0);
    assert.strictEqual(zeroSum.domains[dom].floorVotesCast, 0);
    assert.strictEqual(Number.isNaN(zeroSum.domains[dom].score), false);
  }
});

// ---------------------------------------------------------------------------
// 18. Full Sandbox & Pocketbook Integration on Real Disk Datasets
// ---------------------------------------------------------------------------
console.log("\n--- 18. Full Sandbox & Pocketbook Integration on Real Disk Datasets ---");

if (fs.existsSync(billStagesPath) && fs.existsSync(votesPath)) {
  test("computes valid sandbox correlations & pocketbook indices across all 120 NJ legislators", () => {
    const legs = JSON.parse(fs.readFileSync(path.join(root, "src/data/legislators.json"), "utf8"));
    const bills = JSON.parse(fs.readFileSync(path.join(root, "src/data/bills.json"), "utf8"));
    const billStages = JSON.parse(fs.readFileSync(billStagesPath, "utf8"));
    const votes = JSON.parse(fs.readFileSync(votesPath, "utf8"));
    const demographics = JSON.parse(fs.readFileSync(path.join(root, "src/data/demographics.json"), "utf8"));
    const donors = JSON.parse(fs.readFileSync(path.join(root, "src/data/donors.json"), "utf8"));

    // 1. Pocketbook Invariants on real data
    const { summariesById, domainRollCallCounts } = computePocketbookSummaries(
      legs,
      bills,
      billStages,
      votes.rollCalls
    );

    assert.strictEqual(summariesById.size, 120);
    assert.ok(domainRollCallCounts.property_tax > 0, `Expected property tax roll calls, got ${domainRollCallCounts.property_tax}`);
    assert.ok(domainRollCallCounts.housing > 0, `Expected housing roll calls, got ${domainRollCallCounts.housing}`);
    assert.ok(domainRollCallCounts.transit > 0, `Expected transit roll calls, got ${domainRollCallCounts.transit}`);

    for (const leg of legs) {
      const summary = summariesById.get(leg.id);
      assert.ok(summary, `Missing pocketbook summary for legislator ${leg.id}`);
      assert.strictEqual(summary.legislatorId, leg.id);
      assert.strictEqual(typeof summary.overallScore, "number");
      assert.strictEqual(Number.isNaN(summary.overallScore), false);
      assert.ok(summary.overallScore >= 0 && summary.overallScore <= 100);

      for (const dom of ["property_tax", "housing", "transit"]) {
        const dScore = summary.domains[dom];
        assert.ok(dScore, `Missing domain score for ${dom}`);
        assert.strictEqual(dScore.domain, dom);
        assert.strictEqual(typeof dScore.score, "number");
        assert.strictEqual(Number.isNaN(dScore.score), false);
        assert.ok(dScore.score >= 0 && dScore.score <= 100);
        assert.strictEqual(Number.isNaN(dScore.primaryBills), false);
        assert.strictEqual(Number.isNaN(dScore.cosponsoredBills), false);
        assert.strictEqual(Number.isNaN(dScore.advancedBills), false);
        assert.strictEqual(Number.isNaN(dScore.enactedBills), false);
        assert.strictEqual(Number.isNaN(dScore.floorVotesCast), false);
      }

      // Check notableVotes
      assert.ok(summary.notableVotes.length <= 15);
      let seenNV = false;
      for (const nv of summary.notableVotes) {
        assert.ok(["Y", "N", "A", "NV"].includes(nv.choice));
        assert.ok(nv.bill.length > 0);
        assert.ok(nv.date.length > 0);
        if (nv.choice === "NV") {
          seenNV = true;
        } else if (seenNV) {
          // If we've already seen an NV vote, this vote must also be NV (voted comes first)
          assert.strictEqual(nv.choice, "NV", "Expected active votes to precede NV votes");
        }
      }
    }

    // 2. Correlation Sandbox Invariants across real legislators
    const demoByDistrict = new Map(demographics.districts.map((d) => [d.district, d]));
    const donorsByLeg = new Map(donors.profiles.map((p) => [p.legislatorId, p]));
    const effMap = computeChamberNormalizedEffectiveness(legs, billStages);

    const mockRows = legs.map((leg) => {
      const legDonor = donorsByLeg.get(leg.id);
      const influence = computeLegislatorInfluence(leg, legDonor ? [legDonor] : []);
      const eff = effMap.get(leg.id);
      const vStats = votes.legislatorStats?.[String(leg.id)];
      const pSum = summariesById.get(leg.id);
      return {
        legislator: leg,
        totalBills: leg.bills?.length ?? 0,
        primaryBills: leg.bills?.filter((b) => b[1] === "P").length ?? 0,
        bipartisanRate: 20,
        totalRaised: influence.totalRaised,
        medianIncome: demoByDistrict.get(leg.district)?.medianIncome ?? 0,
        demographics: demoByDistrict.get(leg.district) ?? null,
        influenceSummary: influence,
        effectivenessSummary: eff,
        voteStats: vStats,
        pocketbookSummary: pSum,
      };
    });

    const scatterIncomeRaised = buildSandboxScatter(mockRows, "medianIncome", "totalRaised");
    assert.strictEqual(scatterIncomeRaised.points.length, 120);
    assert.ok(Number.isFinite(scatterIncomeRaised.pearsonR));
    assert.ok(scatterIncomeRaised.pearsonR >= -1 && scatterIncomeRaised.pearsonR <= 1);
    assert.ok(scatterIncomeRaised.medianX > 0);
    assert.ok(scatterIncomeRaised.medianY >= 0);

    const scatterAttendanceUnity = buildSandboxScatter(mockRows, "attendancePct", "partyUnityPct");
    assert.strictEqual(scatterAttendanceUnity.points.length, 120);
    assert.ok(Number.isFinite(scatterAttendanceUnity.pearsonR));
    assert.ok(scatterAttendanceUnity.pearsonR >= -1 && scatterAttendanceUnity.pearsonR <= 1);
  });
}

console.log(`\n========================================`);
console.log(`✓ All ${passed}/${total} test assertions passed cleanly.`);
console.log(`========================================\n`);
