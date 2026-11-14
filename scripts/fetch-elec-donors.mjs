/**
 * Downloads official campaign-contribution records from the New Jersey
 * Election Law Enforcement Commission (ELEC) for the current Legislature.
 *
 * Source portal: https://www.njelecefilesearch.com/
 *
 * For every matched State Senate / State Assembly entity, the ELEC portal's
 * own CSV export endpoint is used. Raw downloads are cached so reruns are
 * cheap. The script only reads official records; it never invents a donor,
 * amount, or date.
 *
 * Usage: node scripts/fetch-elec-donors.mjs
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "scripts", ".cache");
const csvDir = path.join(cacheDir, "elec-csv");
const entitiesPath = path.join(cacheDir, "elec-entities.json");
const outPath = path.join(cacheDir, "elec-contributions.json");
const BASE = "https://www.njelecefilesearch.com";

const entities = JSON.parse(await readFile(entitiesPath, "utf8"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0].map((name) => name.trim());
  return rows
    .slice(1)
    .filter((values) => values.some((value) => value.trim().length))
    .map((values) => {
      const record = {};
      for (let i = 0; i < header.length; i += 1) record[header[i]] = values[i] ?? "";
      return record;
    });
}

async function downloadCsv(entity) {
  const file = path.join(csvDir, `${entity.entityId}.csv`);
  if (await exists(file)) return parseCsv(await readFile(file, "utf8"));

  const payload = {
    ENTITY_S: entity.entityId,
    NONPACOnly: "true",
    FirstName: "",
    LastName: "",
    NonIndName: "",
    OfficeCodes: "",
    PartyCodes: "",
    LocationCodes: "",
    ElectionTypeCodes: "",
    ElectionYears: "",
    ContributorFirstName: "",
    ContributorLastName: "",
    ContributorMI: "",
    ContributorSuffix: "",
    ContributorNonIndName: "",
    ContributorTypeCodes: "",
    EMP_NAME: "",
    OccupationCodes: "",
    DateFrom: "",
    DateTo: "",
    AmountFrom: "",
    AmountTo: "",
  };

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/api/VWContributionDetail/DownlodDataCSV`, {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "*/*",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${BASE}/SearchContributionToEntity`,
        },
        body: new URLSearchParams(payload).toString(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const url = await res.json();
      if (typeof url !== "string") throw new Error("Unexpected export response");
      const csvRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!csvRes.ok) throw new Error(`CSV HTTP ${csvRes.status}`);
      const text = await csvRes.text();
      await writeFile(file, text);
      return parseCsv(text);
    } catch (error) {
      lastError = error;
      await sleep(500 * attempt);
    }
  }
  throw lastError;
}

const tasks = [];
for (const race of Object.values(entities)) {
  for (const entity of race.entities) {
    tasks.push({ race, entity });
  }
}

const pending = [...tasks];
const contributions = [];
let failures = 0;
let done = 0;

async function run(task) {
  try {
    const rows = await downloadCsv(task.entity);
    for (const row of rows) {
      contributions.push({
        legislatorId: task.race.legislatorId,
        year: task.race.year,
        entityId: task.entity.entityId,
        entityName: task.entity.entityName,
        electionType: task.entity.electionType,
        isIndividual: row.IsIndividual,
        firstName: row.FirstName,
        middleInitial: row.MI,
        lastName: row.LastName,
        suffix: row.Suffix,
        nonIndName: row.NonIndName,
        employer: row.EmpName,
        occupation: row.OccupationName,
        contributorType: row.ContributorType,
        contributionType: row.ContributionType,
        date: row.ContributionDate,
        amount: row.ContributionAmount,
      });
    }
  } catch (error) {
    failures += 1;
    console.warn(`Could not download entity ${task.entity.entityId} (${task.race.name}): ${error.message}`);
  } finally {
    done += 1;
    if (done % 25 === 0 || done === tasks.length) {
      console.log(`Downloaded ${done}/${tasks.length} ELEC entities (${failures} failures)`);
    }
  }
}

await mkdir(csvDir, { recursive: true });
await mkdir(cacheDir, { recursive: true });

const queue = [...pending];
const workers = Array.from({ length: 5 }, async () => {
  while (queue.length) {
    const task = queue.shift();
    if (!task) return;
    await run(task);
    await sleep(100);
  }
});
await Promise.all(workers);

await writeFile(outPath, JSON.stringify(contributions));

const years = new Set(contributions.map((row) => row.year));
const races = new Set(contributions.map((row) => `${row.legislatorId}|${row.year}`));
console.log(
  `Saved ${contributions.length.toLocaleString("en-US")} contribution records across ${races.size} legislator-election races and ${years.size} election years.`,
);
console.log(`Output: ${outPath}`);
