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
    { stage: "floor", committeeCode: null }
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
    { stage: "reported", committeeCode: null }
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
    assert.ok(votes.rollCalls.length > 0);
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

console.log(`\n========================================`);
console.log(`✓ All ${passed}/${total} test assertions passed cleanly.`);
console.log(`========================================\n`);
