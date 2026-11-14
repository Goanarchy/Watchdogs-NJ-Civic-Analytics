/**
 * Atomic data refresh, integrity verification, and dual-target rebuild script.
 *
 * Usage:
 *   node scripts/safe-update.mjs --refresh   # Fetch upstream public data + verify + rebuild all
 *   node scripts/safe-update.mjs             # Verify existing datasets + i18n + rebuild all
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const doRefresh = process.argv.includes("--refresh");

function runNode(scriptRelPath) {
  const fullPath = path.join(root, scriptRelPath);
  const res = spawnSync(process.execPath, [fullPath], {
    cwd: root,
    stdio: "inherit",
  });
  if (res.status !== 0) {
    throw new Error(`${scriptRelPath} failed with exit code ${res.status ?? "unknown"}`);
  }
}

function runNpm(args) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const res = spawnSync(npmCmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    throw new Error(`npm ${args.join(" ")} failed with exit code ${res.status ?? "unknown"}`);
  }
}

function readJson(fileName) {
  return JSON.parse(readFileSync(path.join(dataDir, fileName), "utf8"));
}

function assertInvariants() {
  const legislators = readJson("legislators.json");
  const districts = readJson("districts.json");
  const bills = readJson("bills.json");
  const donors = readJson("donors.json");
  const demographics = readJson("demographics.json");
  const billStages = readJson("bill-stages.json");
  const votes = readJson("votes.json");

  const checks = [
    [Array.isArray(legislators) && legislators.length === 120, `Expected 120 legislators, got ${legislators?.length}`],
    [Array.isArray(districts) && districts.length === 40, `Expected 40 districts, got ${districts?.length}`],
    [bills && typeof bills === "object" && Object.keys(bills).length >= 10000, `Expected >= 10,000 bills, got ${bills ? Object.keys(bills).length : 0}`],
    [Array.isArray(donors?.profiles) && donors.profiles.length >= 120, `Expected >= 120 donor profiles, got ${donors?.profiles?.length}`],
    [Array.isArray(demographics?.districts) && demographics.districts.length === 40, `Expected 40 Census ACS districts, got ${demographics?.districts?.length}`],
    [billStages && typeof billStages === "object" && Object.keys(billStages).length >= 1000, `Expected >= 1,000 bill stage records, got ${billStages ? Object.keys(billStages).length : 0}`],
    [votes && Array.isArray(votes?.rollCalls) && votes.rollCalls.length > 0, `Expected >= 1 roll calls, got ${votes?.rollCalls?.length}`],
    [votes && typeof votes?.legislatorStats === "object" && Object.keys(votes.legislatorStats).length === 120, `Expected 120 legislator vote stats, got ${votes?.legislatorStats ? Object.keys(votes.legislatorStats).length : 0}`],
  ];

  for (const [ok, message] of checks) {
    if (!ok) {
      throw new Error(`Integrity invariant failed: ${message}`);
    }
  }
}

const backupDir = mkdtempSync(path.join(os.tmpdir(), "nj-civic-backup-"));
const snapshotFiles = readdirSync(dataDir).filter((name) => name.endsWith(".json"));
for (const fileName of snapshotFiles) {
  copyFileSync(path.join(dataDir, fileName), path.join(backupDir, fileName));
}

function restoreSnapshot() {
  for (const fileName of snapshotFiles) {
    copyFileSync(path.join(backupDir, fileName), path.join(dataDir, fileName));
  }
}

try {
  if (doRefresh) {
    console.log("==> Refreshing official NJLeg, U.S. Census ACS, and Campaign Promise datasets...");
    runNode("scripts/fetch-njleg-data.mjs");
    runNode("scripts/fetch-census-acs.mjs");
    runNode("scripts/build-campaign-data.mjs");
    runNode("scripts/fetch-njleg-bulk.mjs");
  } else {
    console.log("==> Verifying current datasets (use --refresh to fetch upstream updates)...");
  }

  runNode("scripts/validate-data.mjs");
  assertInvariants();
  runNode("scripts/check-i18n.mjs");

  console.log("==> Building web bundle (dist/) and standalone file (index.html)...");
  runNpm(["run", "build:all"]);
  console.log("✓ Safe update & integrity verification succeeded.");
} catch (error) {
  console.error(`✗ ${error.message}`);
  console.error("==> Restoring src/data/*.json from backup snapshot...");
  restoreSnapshot();
  console.error("✓ Snapshot restored. No corrupted data was kept.");
  process.exitCode = 1;
} finally {
  rmSync(backupDir, { recursive: true, force: true });
}
