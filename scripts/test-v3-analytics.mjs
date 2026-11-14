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

console.log(`\n========================================`);
console.log(`✓ All ${passed}/${total} test assertions passed cleanly.`);
console.log(`========================================\n`);
