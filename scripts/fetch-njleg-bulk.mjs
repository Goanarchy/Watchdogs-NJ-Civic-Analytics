/**
 * NJLeg Bulk Data Ingestion & Parser
 *
 * Ingests official bulk datasets from the New Jersey Legislature (NJLeg):
 * - DB2026_TEXT.zip: MAINBILL.TXT, BILLHIST.TXT, COMMITTEE.TXT
 * - A2026.zip: Assembly roll-call voting records
 * - S2026.zip: Senate roll-call voting records
 *
 * Generates:
 * - src/data/bill-stages.json (BillStagesMap)
 * - src/data/votes.json (VotesData)
 *
 * Usage:
 *   node scripts/fetch-njleg-bulk.mjs            # Ingests from cache (or downloads if cache missing)
 *   node scripts/fetch-njleg-bulk.mjs --cached   # Force offline cache mode
 *   node scripts/fetch-njleg-bulk.mjs --refresh  # Force re-download and re-extract
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "scripts", ".cache");
const dataDir = path.join(root, "src", "data");

export const KNOWN_COMMITTEES = new Set([
  "AAN", "AAP", "ABD", "ABPL", "ABU", "ACE", "ACF", "ACO", "ACW", "AED", "AEN",
  "AFI", "AHE", "AHI", "AHN", "AHO", "AHS", "AHU", "AJU", "ALA", "AMV", "ANR",
  "AOF", "APS", "ARP", "ASE", "ASI", "ASL", "AST", "ATG", "ATR", "ATU",
  "SBA", "SCEB", "SCM", "SCU", "SED", "SEG", "SEGS", "SEN", "SFF", "SHH",
  "SHI", "SJU", "SLA", "SLO", "SLP", "SMV", "SNJT", "SPDC", "SRC", "SRUL",
  "SSC", "SSG", "SSI", "SSOC", "STR"
]);

/**
 * Checks if a bill identifier represents a substantive bill (S or A followed by digits)
 * rather than a ceremonial or legislative resolution (SR, AR, SCR, ACR, SJR, AJR).
 */
export function isSubstantiveBill(billCode) {
  if (!billCode || typeof billCode !== "string") return false;
  return /^[SA]\d+$/i.test(billCode.trim());
}

/**
 * Parses a single CSV line respecting quotes and escaped quotes.
 */
export function parseCsvLine(line) {
  if (typeof line !== "string") return [];
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parses full CSV content handling multi-line records and quotes.
 */
export function parseCsv(content) {
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = "";
    } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      currentRow.push(currentVal);
      currentVal = "";
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += ch;
    }
  }
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }
  return rows;
}

/**
 * Extracts committee code from status code or history actions.
 */
export function extractCommitteeCode(status, historyActions = []) {
  const s = (status || "").trim().toUpperCase();
  if (s && KNOWN_COMMITTEES.has(s)) {
    return s;
  }
  if (Array.isArray(historyActions)) {
    for (let i = historyActions.length - 1; i >= 0; i--) {
      const match = historyActions[i].match(/\b(?:REF|RCM|TRANS)\s+([A-Z]{3,4})\b/);
      if (match && KNOWN_COMMITTEES.has(match[1])) {
        return match[1];
      }
    }
  }
  return null;
}

/**
 * Normalizes bill stage into one of: "introduced" | "committee" | "reported" | "floor" | "enacted".
 */
export function normalizeBillStage(row = {}) {
  const status = (row.currentStatus || "").trim().toUpperCase();
  const chapterLaw = (row.chapterLaw || "").trim();
  const govAction = (row.governorAction || "").trim().toUpperCase();
  const history = Array.isArray(row.historyActions) ? row.historyActions : [];

  const commCode = extractCommitteeCode(status, history);

  // 1. Enacted: chapterLaw present or Governor Approved
  if (
    chapterLaw.length > 0 ||
    govAction === "APP" ||
    govAction === "APP W/CH" ||
    status === "APP"
  ) {
    return { stage: "enacted", committeeCode: commCode };
  }

  // 2. Floor: passed either/both houses, 2nd reading calendar, or 3rd reading vote
  const floorStatuses = new Set([
    "PBH", "PA", "PS", "2RA", "2RS", "2RAC", "2RSC", "2RSG",
    "SENATE_PASSED", "ASSEMBLY_PASSED"
  ]);
  const hasFloorStatus = floorStatuses.has(status);
  const hasFloorHistory = history.some((a) => /\b(3RDG|PA|PS)\b/.test(a));
  if (hasFloorStatus || hasFloorHistory) {
    return { stage: "floor", committeeCode: commCode };
  }

  // 3. Reported: reported out of committee
  const isReportedStatus = status.startsWith("REP") || status === "R/S" || status === "R/A";
  const hasReportedHistory = history.some((a) => /\b(REP|R\/S|R\/A)\b/.test(a));
  if (isReportedStatus || hasReportedHistory) {
    return { stage: "reported", committeeCode: commCode };
  }

  // 4. Committee: actively in committee or referred
  const hasRefHistory = history.some((a) => /\b(?:REF|RCM|TRANS)\b/.test(a));
  if (commCode || hasRefHistory) {
    return { stage: "committee", committeeCode: commCode };
  }

  // 5. Fallback -> introduced
  return { stage: "introduced", committeeCode: null };
}

/**
 * Converts date string (e.g. "10/29/2026" or "1/13/2026 0:00:00") to ISO "YYYY-MM-DD".
 */
export function toIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const datePart = trimmed.split(" ")[0];
  const parts = datePart.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    const year = y.length === 2 ? `20${y}` : y.padStart(4, "20");
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return trimmed;
}

/**
 * Calculates safe legislator attendance and party unity percentages.
 */
export function calculateLegislatorVoteStats({
  eligible = 0,
  cast = 0,
  yeas = 0,
  nays = 0,
  abstains = 0,
  contestedEligible = 0,
  contestedUnityMatches = 0,
} = {}) {
  const attendancePct = eligible > 0 ? Math.round((cast / eligible) * 100) : 0;
  const partyUnityPct =
    contestedEligible > 0 && cast > 0
      ? Math.round((contestedUnityMatches / contestedEligible) * 100)
      : 0;

  return {
    eligible,
    cast,
    yeas,
    nays,
    abstains,
    attendancePct: Number.isFinite(attendancePct) ? attendancePct : 0,
    partyUnityPct: Number.isFinite(partyUnityPct) ? partyUnityPct : 0,
  };
}

/**
 * Parses roll-call CSV rows into normalized roll-call objects.
 * Splits consecutive/duplicate (bill, date, action) blocks whenever a legislator
 * ID already appears in the active roll-call sequence for that base key.
 */
export function parseRollCallsFromCsvRows(rows, chamber, matchLegislator) {
  const rollCallsMap = new Map();
  const activeSeqByBaseKey = new Map();
  const prefix = chamber === "Assembly" ? "a" : "s";

  for (let i = 1; i < rows.length; i++) {
    const [bill, fullName, date, , abstract, action, voteRaw] = rows[i];
    const billCode = (bill || "").trim();
    const dateRaw = (date || "").trim();
    const dateIso = toIsoDate(dateRaw) || dateRaw;
    const actionStr = (action || "").trim();
    if (!billCode || !actionStr) continue;

    const legId = matchLegislator(fullName);
    if (!legId) continue;

    const baseKey = `${billCode}|${dateIso}|${actionStr}`;
    let seq = activeSeqByBaseKey.get(baseKey) ?? 1;
    let key = `${baseKey}#${seq}`;

    while (
      rollCallsMap.has(key) &&
      Object.prototype.hasOwnProperty.call(
        rollCallsMap.get(key).votesByLegislatorId,
        String(legId),
      )
    ) {
      seq += 1;
      key = `${baseKey}#${seq}`;
    }
    activeSeqByBaseKey.set(baseKey, seq);

    if (!rollCallsMap.has(key)) {
      rollCallsMap.set(key, {
        id: `${prefix}-${billCode.toLowerCase()}-${dateIso.replace(/-/g, "")}-${rollCallsMap.size + 1}`,
        bill: billCode,
        chamber,
        date: dateIso,
        action: actionStr,
        abstract: (abstract || "").trim(),
        yeas: 0,
        nays: 0,
        abstains: 0,
        notVoting: 0,
        votesByLegislatorId: {},
      });
    }

    const rc = rollCallsMap.get(key);
    let choice = "NV";
    const v = (voteRaw || "").trim().toUpperCase();
    if (v === "Y" || v === "YES") {
      choice = "Y";
      rc.yeas++;
    } else if (v === "N" || v === "NO") {
      choice = "N";
      rc.nays++;
    } else if (v === "A" || v === "ABSTAIN") {
      choice = "A";
      rc.abstains++;
    } else {
      choice = "NV";
      rc.notVoting++;
    }

    rc.votesByLegislatorId[String(legId)] = choice;
  }

  return Array.from(rollCallsMap.values());
}

/**
 * Validates integrity invariants before overwriting src/data files.
 */
export function assertBulkOutputsValid(billStages, votesData) {
  if (!billStages || typeof billStages !== "object") {
    throw new Error("Validation error: billStages must be a non-null object");
  }
  const stagesCount = Object.keys(billStages).length;
  if (stagesCount < 1000) {
    throw new Error(`Validation error: expected >= 1000 bill stage records, got ${stagesCount}`);
  }

  if (!votesData || typeof votesData !== "object") {
    throw new Error("Validation error: votesData must be a non-null object");
  }
  if (!Array.isArray(votesData.rollCalls) || votesData.rollCalls.length === 0) {
    throw new Error("Validation error: votesData.rollCalls must be a non-empty array");
  }
  for (const rc of votesData.rollCalls) {
    const capacity = rc.chamber === "Senate" ? 40 : 80;
    const totalVotes = (rc.yeas || 0) + (rc.nays || 0) + (rc.abstains || 0) + (rc.notVoting || 0);
    if (totalVotes > capacity) {
      throw new Error(
        `Validation error: roll call ${rc.id} (${rc.chamber}) has ${totalVotes} votes, exceeding chamber capacity (${capacity})`
      );
    }
  }
  if (!votesData.legislatorStats || typeof votesData.legislatorStats !== "object") {
    throw new Error("Validation error: votesData.legislatorStats must be an object");
  }
  const statsCount = Object.keys(votesData.legislatorStats).length;
  if (statsCount === 0) {
    throw new Error("Validation error: votesData.legislatorStats cannot be empty");
  }
}

/**
 * Normalizes legislator name for matching against legislators.json.
 */
function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds legislator name lookup map from legislators.json.
 */
function buildLegislatorLookup(legislators) {
  const lookup = new Map();
  for (const leg of legislators) {
    lookup.set(normalizeName(leg.sortName), leg.id);
    lookup.set(normalizeName(`${leg.lastName} ${leg.firstName}`), leg.id);
    lookup.set(normalizeName(`${leg.lastName} ${leg.firstName} ${leg.suffix || ""}`), leg.id);
    lookup.set(normalizeName(leg.fullName), leg.id);
  }

  return function matchName(name) {
    const norm = normalizeName(name);
    if (lookup.has(norm)) return lookup.get(norm);
    const tokens = norm.split(" ");
    const withoutInitials = tokens.filter((t) => t.length > 1).join(" ");
    if (lookup.has(withoutInitials)) return lookup.get(withoutInitials);
    for (const leg of legislators) {
      const lTokens = normalizeName(`${leg.lastName} ${leg.firstName}`).split(" ");
      if (lTokens.every((t) => tokens.includes(t))) {
        return leg.id;
      }
    }
    return null;
  };
}

/**
 * Downloads a URL to a local destination using fetch, or platform curl fallback.
 */
async function downloadFile(url, destPath) {
  console.log(`    Downloading: ${url}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
    return true;
  } catch (err) {
    console.warn(`    fetch failed (${err.message}), trying curl...`);
    const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
    const curl = spawnSync(curlBin, ["-sSL", url, "-o", destPath], { stdio: "inherit" });
    if (curl.status === 0 && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      return true;
    }
    throw err;
  }
}

/**
 * Extracts a ZIP file into target directory across Windows, Linux, and macOS.
 */
function extractZip(zipPath, targetDir) {
  console.log(`    Extracting: ${path.basename(zipPath)} -> ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });
  if (process.platform === "win32") {
    const psCmd = `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`;
    const res = spawnSync("powershell", ["-Command", psCmd], { stdio: "inherit" });
    if (res.status !== 0) {
      throw new Error(`Failed to extract ${zipPath} (exit code ${res.status ?? "unknown"})`);
    }
    return;
  }

  const unzipRes = spawnSync("unzip", ["-o", "-q", zipPath, "-d", targetDir], { stdio: "inherit" });
  if (unzipRes.status === 0) return;

  const pyRes = spawnSync("python3", ["-m", "zipfile", "-e", zipPath, targetDir], { stdio: "inherit" });
  if (pyRes.status !== 0) {
    throw new Error(
      `Failed to extract ${zipPath} (unzip exit ${unzipRes.status ?? "missing"}, python3 exit ${pyRes.status ?? "missing"})`,
    );
  }
}

/**
 * Resolves a file inside dir case-insensitively (needed for Linux runners where ZIP entry casing varies).
 */
function resolveFileCaseInsensitive(dir, expectedName) {
  const direct = path.join(dir, expectedName);
  if (fs.existsSync(direct) || !fs.existsSync(dir)) return direct;
  const target = expectedName.toLowerCase();
  const match = fs.readdirSync(dir).find((name) => name.toLowerCase() === target);
  if (match) return path.join(dir, match);
  return direct;
}

/**
 * Ensures cache folders exist, downloading and extracting if needed.
 */
async function ensureDatasets(forceRefresh = false) {
  const dbDir = path.join(cacheDir, "db2026");
  const aDir = path.join(cacheDir, "votes_a2026");
  const sDir = path.join(cacheDir, "votes_s2026");

  const dbMain = resolveFileCaseInsensitive(dbDir, "MAINBILL.TXT");
  const aVotes = resolveFileCaseInsensitive(aDir, "A2026.txt");
  const sVotes = resolveFileCaseInsensitive(sDir, "S2026.txt");

  const hasCache = fs.existsSync(dbMain) && fs.existsSync(aVotes) && fs.existsSync(sVotes);

  if (hasCache && !forceRefresh) {
    console.log("==> Using cached NJLeg bulk datasets in scripts/.cache/...");
    return { dbDir, aDir, sDir };
  }

  console.log("==> Fetching upstream official NJLeg bulk datasets...");
  const dbZip = path.join(cacheDir, "DB2026_TEXT.zip");
  const aZip = path.join(cacheDir, "A2026.zip");
  const sZip = path.join(cacheDir, "S2026.zip");

  try {
    await downloadFile("https://pub.njleg.state.nj.us/leg-databases/2026data/DB2026_TEXT.zip", dbZip);
    extractZip(dbZip, dbDir);

    await downloadFile("https://pub.njleg.state.nj.us/votes/A2026.zip", aZip);
    extractZip(aZip, aDir);

    await downloadFile("https://pub.njleg.state.nj.us/votes/S2026.zip", sZip);
    extractZip(sZip, sDir);
  } catch (err) {
    if (hasCache) {
      console.warn(`==> Network download failed (${err.message}). Falling back to cached datasets.`);
    } else {
      throw err;
    }
  }

  return { dbDir, aDir, sDir };
}

/**
 * Main ingestion & pipeline executor.
 */
export async function runIngestion(options = {}) {
  const forceRefresh = options.refresh || process.argv.includes("--refresh");
  const { dbDir, aDir, sDir } = await ensureDatasets(forceRefresh);

  const legislators = JSON.parse(
    fs.readFileSync(path.join(dataDir, "legislators.json"), "utf8")
  );
  const bills = JSON.parse(
    fs.readFileSync(path.join(dataDir, "bills.json"), "utf8")
  );
  const matchLegislator = buildLegislatorLookup(legislators);
  const legById = new Map(legislators.map((l) => [l.id, l]));

  // -------------------------------------------------------------------------
  // 1. Process BILLHIST.TXT -> Action history by bill
  // -------------------------------------------------------------------------
  console.log("==> Parsing BILLHIST.TXT...");
  const bhFile = resolveFileCaseInsensitive(dbDir, "BILLHIST.TXT");
  const bhRows = parseCsv(fs.readFileSync(bhFile, "utf8"));
  const historyByBill = new Map();
  const lastActionByBill = new Map();

  for (let i = 1; i < bhRows.length; i++) {
    const [bType, bNum, , dateAction, action] = bhRows[i];
    const billKey = `${(bType || "").trim()}${(bNum || "").trim()}`;
    if (!billKey) continue;

    if (!historyByBill.has(billKey)) {
      historyByBill.set(billKey, []);
    }
    const actionText = (action || "").trim();
    if (actionText) historyByBill.get(billKey).push(actionText);

    // Keep latest action
    lastActionByBill.set(billKey, {
      action: actionText,
      date: toIsoDate(dateAction),
    });
  }

  // -------------------------------------------------------------------------
  // 2. Process MAINBILL.TXT -> bill-stages.json
  // -------------------------------------------------------------------------
  console.log("==> Parsing MAINBILL.TXT & computing bill stages...");
  const mbFile = resolveFileCaseInsensitive(dbDir, "MAINBILL.TXT");
  const mbRows = parseCsv(fs.readFileSync(mbFile, "utf8"));

  const billStages = {};
  const stageCounts = { introduced: 0, committee: 0, reported: 0, floor: 0, enacted: 0 };

  for (let i = 1; i < mbRows.length; i++) {
    const cols = mbRows[i];
    const billType = (cols[0] || "").trim();
    const billNum = (cols[1] || "").trim();
    const billKey = `${billType}${billNum}`;
    if (!billKey) continue;

    const currentStatus = (cols[2] || "").trim();
    const governorAction = (cols[9] || "").trim();
    const chapterLaw = (cols[12] || "").trim();
    const historyActions = historyByBill.get(billKey) || [];

    const { stage, committeeCode } = normalizeBillStage({
      currentStatus,
      governorAction,
      chapterLaw,
      historyActions,
    });

    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    const lastActionInfo = lastActionByBill.get(billKey) || {
      action: "",
      date: toIsoDate(cols[3] || cols[4]),
    };

    billStages[billKey] = {
      bill: billKey,
      stage,
      statusCode: currentStatus,
      committeeCode,
      lastAction: lastActionInfo.action,
      lastActionDate: lastActionInfo.date,
      isSubstantive: isSubstantiveBill(billKey),
    };
  }

  // Ensure all 11,475 bills in bills.json have an entry in bill-stages.json
  for (const billKey of Object.keys(bills)) {
    if (!billStages[billKey]) {
      const historyActions = historyByBill.get(billKey) || [];
      const lastActionInfo = lastActionByBill.get(billKey) || { action: "", date: null };
      const { stage, committeeCode } = normalizeBillStage({ historyActions });
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;

      billStages[billKey] = {
        bill: billKey,
        stage,
        statusCode: "",
        committeeCode,
        lastAction: lastActionInfo.action,
        lastActionDate: lastActionInfo.date,
        isSubstantive: isSubstantiveBill(billKey),
      };
    }
  }

  console.log("    Bill stages count:", Object.keys(billStages).length);
  console.log("    Stages distribution:", stageCounts);

  // -------------------------------------------------------------------------
  // 3. Process Roll-Call Votes -> A2026.txt & S2026.txt
  // -------------------------------------------------------------------------
  console.log("==> Parsing roll calls (A2026.txt & S2026.txt)...");

  function processVotesFile(filePath, chamber) {
    const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
    return parseRollCallsFromCsvRows(rows, chamber, matchLegislator);
  }

  const assemblyRollCalls = processVotesFile(resolveFileCaseInsensitive(aDir, "A2026.txt"), "Assembly");
  const senateRollCalls = processVotesFile(resolveFileCaseInsensitive(sDir, "S2026.txt"), "Senate");
  const rollCalls = [...assemblyRollCalls, ...senateRollCalls];
  console.log(`    Total roll calls: ${rollCalls.length} (${assemblyRollCalls.length} Assembly, ${senateRollCalls.length} Senate)`);

  // -------------------------------------------------------------------------
  // 4. Compute Legislator Attendance & Party Unity Stats
  // -------------------------------------------------------------------------
  console.log("==> Computing legislator attendance & party unity stats...");

  // Precompute party majority on each roll call
  const rcMajorities = rollCalls.map((rc) => {
    const counts = { D: { Y: 0, N: 0 }, R: { Y: 0, N: 0 } };
    for (const [legIdStr, vote] of Object.entries(rc.votesByLegislatorId)) {
      const leg = legById.get(Number(legIdStr));
      if (!leg) continue;
      const p = leg.party === "D" ? "D" : "R";
      if (vote === "Y") counts[p].Y++;
      else if (vote === "N") counts[p].N++;
    }

    const dMaj = counts.D.Y > counts.D.N ? "Y" : counts.D.N > counts.D.Y ? "N" : null;
    const rMaj = counts.R.Y > counts.R.N ? "Y" : counts.R.N > counts.R.Y ? "N" : null;
    const isContested = Boolean((dMaj && rMaj && dMaj !== rMaj) || rc.nays > 0);

    return {
      isContested,
      majorities: { D: dMaj, R: rMaj },
    };
  });

  const legislatorStats = {};
  for (const leg of legislators) {
    const legIdStr = String(leg.id);
    let eligible = 0;
    let cast = 0;
    let yeas = 0;
    let nays = 0;
    let abstains = 0;
    let contestedEligible = 0;
    let contestedUnityMatches = 0;

    const party = leg.party === "D" ? "D" : "R";

    for (let i = 0; i < rollCalls.length; i++) {
      const rc = rollCalls[i];
      if (rc.chamber !== leg.chamber) continue; // Chamber-specific eligibility
      const vote = rc.votesByLegislatorId[legIdStr];
      if (vote === undefined) continue;

      eligible++;
      if (vote === "Y") {
        cast++;
        yeas++;
      } else if (vote === "N") {
        cast++;
        nays++;
      } else if (vote === "A") {
        cast++;
        abstains++;
      }

      const { isContested, majorities } = rcMajorities[i];
      const partyMaj = majorities[party];
      if (isContested && partyMaj && (vote === "Y" || vote === "N")) {
        contestedEligible++;
        if (vote === partyMaj) {
          contestedUnityMatches++;
        }
      }
    }

    legislatorStats[leg.id] = calculateLegislatorVoteStats({
      eligible,
      cast,
      yeas,
      nays,
      abstains,
      contestedEligible,
      contestedUnityMatches,
    });
  }

  const votesData = {
    generatedAt: new Date().toISOString(),
    source: {
      name: "New Jersey Office of Legislative Services (NJLeg)",
      portalUrl: "https://pub.njleg.state.nj.us",
    },
    rollCalls,
    legislatorStats,
  };

  // -------------------------------------------------------------------------
  // 5. Invariant Validation & Atomic Persistence
  // -------------------------------------------------------------------------
  console.log("==> Validating output invariants...");
  assertBulkOutputsValid(billStages, votesData);

  const stagesOutFile = path.join(dataDir, "bill-stages.json");
  const votesOutFile = path.join(dataDir, "votes.json");

  console.log(`==> Writing ${stagesOutFile}...`);
  fs.writeFileSync(stagesOutFile, JSON.stringify(billStages, null, 2), "utf8");

  console.log(`==> Writing ${votesOutFile}...`);
  fs.writeFileSync(votesOutFile, JSON.stringify(votesData, null, 2), "utf8");

  console.log("✓ Bulk NJLeg datasets ingested, normalized, and saved successfully.");
  return { billStages, votesData };
}

// CLI runner
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runIngestion().catch((err) => {
    console.error(`✗ Fatal error during bulk ingestion: ${err.message}`);
    process.exit(1);
  });
}
