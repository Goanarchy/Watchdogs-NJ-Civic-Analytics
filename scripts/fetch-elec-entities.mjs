/**
 * Discovers official ELEC campaign entities for the current New Jersey
 * Legislature roster.
 *
 * ELEC stores a separate committee entity for each candidate, election year,
 * election type (primary/general), office, and district. This script matches
 * the current roster to State Senate / State Assembly entities for the 2023
 * and 2025 elections, the same cycles covered by the voter-guide promises.
 *
 * Usage: node scripts/fetch-elec-entities.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const cacheDir = path.join(root, "scripts", ".cache");
const OUT = path.join(cacheDir, "elec-entities.json");
const BASE = "https://www.njelecefilesearch.com";

const OFFICE_CODES = { Senate: "1", Assembly: "2" };
const ELECTIONS = [
  { year: 2023, chambers: ["Senate", "Assembly"] },
  // Include Senate in 2025 so special Senate elections (e.g. LD35) are captured.
  { year: 2025, chambers: ["Senate", "Assembly"] },
];

const legislators = JSON.parse(await readFile(path.join(dataDir, "legislators.json"), "utf8"));

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|md|m\.d\.)\b/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      await sleep(400 * attempt);
    }
  }
  throw lastError;
}

const lastNameForQuery = (member) => {
  const raw = String(member.lastName ?? "").trim();
  const base = raw.replace(/\s+(Jr|Sr|II|III|IV|M\.D\.)\.?$/i, "").trim();
  return base || raw;
};

const NICKNAMES = {
  al: "al",
  alan: "alan",
  albert: "albert",
  alfred: "alfred",
  anthony: "anthony",
  ben: "benjamin",
  benjamin: "benjamin",
  bill: "william",
  billy: "william",
  bob: "robert",
  bobby: "robert",
  alex: "alexander",
  alexander: "alexander",
  gerard: "gerard",
  gerry: "gerard",
  larry: "lawrence",
  lawrence: "lawrence",
  vincent: "vincent",
  vince: "vincent",
  parker: "parker",
  chris: "christopher",
  christopher: "christopher",
  dan: "daniel",
  daniel: "daniel",
  danny: "daniel",
  dave: "david",
  david: "david",
  don: "donald",
  donald: "donald",
  ed: "edward",
  eddie: "edward",
  eduardo: "edward",
  edward: "edward",
  greg: "gregory",
  gregory: "gregory",
  jeff: "jeffrey",
  jeffrey: "jeffrey",
  jim: "james",
  james: "james",
  jimmy: "james",
  joe: "joseph",
  joseph: "joseph",
  ken: "kenneth",
  kenneth: "kenneth",
  matt: "matthew",
  matthew: "matthew",
  mike: "michael",
  michael: "michael",
  nick: "nicholas",
  nicholas: "nicholas",
  pat: "patrick",
  patrick: "patrick",
  rich: "richard",
  richard: "richard",
  rick: "richard",
  rob: "robert",
  robert: "robert",
  ron: "ronald",
  ronald: "ronald",
  sam: "samuel",
  samuel: "samuel",
  steve: "stephen",
  stephen: "stephen",
  steven: "stephen",
  tom: "thomas",
  thomas: "thomas",
  tommy: "thomas",
  tony: "anthony",
  will: "william",
  william: "william",
};

const canonicalFirstName = (value) => {
  const first = norm(value).split(" ").filter(Boolean)[0] ?? "";
  return NICKNAMES[first] ?? first;
};

const firstNames = (member) =>
  new Set(
    String(member.firstName ?? "")
      .split(/\s+/)
      .map((part) => norm(part))
      .filter(Boolean),
  );

function scoreName(entity, member) {
  const parts = norm(entity.FIRST_NAME).split(" ").filter(Boolean);
  const wanted = firstNames(member);
  if (!parts.length) return 0;
  const canonical = canonicalFirstName(entity.FIRST_NAME);
  let score = 0;
  if (wanted.has(parts[0])) score += 5;
  if (wanted.has(canonical)) score += 4;
  for (const part of wanted) {
    if (parts.some((candidate) => candidate.startsWith(part) || part.startsWith(candidate))) {
      score += 2;
    }
  }
  return score;
}

/**
 * Picks the candidate group that matches the roster first name and keeps
 * nickname variants of the same person (e.g. Joe / Joseph Danielsen). This
 * prevents merging a same-surname running mate on the same ballot.
 */
function selectEntities(rows, member, minScore = 0) {
  const groups = new Map();
  for (const row of rows) {
    const key = canonicalFirstName(row.FIRST_NAME) || norm(row.FIRST_NAME);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let bestGroup = null;
  let bestScore = -1;
  for (const [key, group] of groups) {
    const score = Math.max(...group.map((row) => scoreName(row, member)));
    if (score > bestScore) {
      bestGroup = { key, group, score };
      bestScore = score;
    }
  }

  if (!bestGroup || bestScore < minScore) return [];

  return [...groups.entries()]
    .filter(([key]) => key === bestGroup.key)
    .flatMap(([, group]) => group)
    .map((row) => ({ ...row, nameScore: scoreName(row, member), lastNameQuery: lastNameForQuery(member) }))
    .sort((a, b) => b.nameScore - a.nameScore);
}

async function discover(member, year) {
  const url = `${BASE}/api/VWEntity/GetEntityList?NONPACOnly=true&LastName=${encodeURIComponent(
    lastNameForQuery(member),
  )}&FirstName=`;
  const rows = await getJson(url);
  if (!Array.isArray(rows)) return [];

  const inCycle = rows.filter(
    (row) =>
      Number(row.ELECTIONYEAR) === year &&
      String(row.LOCATION_CODE) === String(member.district) &&
      row.ENTITY_TYPE === "C" &&
      (row.OFFICECODE === "1" || row.OFFICECODE === "2"),
  );

  // Prefer the member's current chamber first; fall back to the other legislative
  // chamber in the same district (e.g. an Assembly member elected to Senate in 2025).
  const preferred = inCycle.filter((row) => row.OFFICECODE === OFFICE_CODES[member.chamber]);
  const selected = selectEntities(preferred, member, 0);
  if (selected.length) return selected;

  return selectEntities(inCycle, member, 2);
}

const tasks = [];
for (const member of legislators) {
  for (const election of ELECTIONS) {
    if (!election.chambers.includes(member.chamber)) continue;
    tasks.push({ member, year: election.year });
  }
}

const results = {};
let done = 0;
let failures = 0;

async function run(task) {
  try {
    const entities = await discover(task.member, task.year);
    const key = `${task.member.id}|${task.year}`;
    results[key] = {
      legislatorId: task.member.id,
      name: task.member.fullName,
      chamber: task.member.chamber,
      district: task.member.district,
      year: task.year,
      entities: entities.map((entity) => ({
        entityId: String(entity.ENTITY_S),
        entityName: entity.ENTITYNAME,
        firstName: entity.FIRST_NAME,
        lastName: entity.LAST_NAME,
        middleInitial: entity.MIDDLE_INITIAL,
        officeCode: entity.OFFICECODE,
        office: entity.OFFICE,
        locationCode: String(entity.LOCATION_CODE),
        location: entity.LOCATION,
        party: entity.PARTY,
        electionType: entity.ELECTIONTYPE,
        nameScore: entity.nameScore,
        entityType: entity.ENTITY_TYPE,
      })),
    };
  } catch (error) {
    failures += 1;
    const key = `${task.member.id}|${task.year}`;
    results[key] = {
      legislatorId: task.member.id,
      name: task.member.fullName,
      chamber: task.member.chamber,
      district: task.member.district,
      year: task.year,
      entities: [],
      error: error.message,
    };
  } finally {
    done += 1;
    if (done % 20 === 0 || done === tasks.length) {
      console.log(`Discovered ${done}/${tasks.length} member-year races (${failures} errors)`);
    }
  }
}

const queue = [...tasks];
const workers = Array.from({ length: 5 }, async () => {
  while (queue.length) {
    const task = queue.shift();
    if (!task) return;
    await run(task);
    await sleep(120);
  }
});
await Promise.all(workers);

await mkdir(cacheDir, { recursive: true });
await writeFile(OUT, JSON.stringify(results, null, 2));

const matched = Object.values(results).filter((row) => row.entities.length);
const withGeneral = Object.values(results).filter((row) =>
  row.entities.some((entity) => entity.electionType === "GENERAL"),
);
console.log(
  `Saved ${matched.length}/${Object.keys(results).length} member-year races with ELEC entities; ${withGeneral.length} include a general-election committee.`,
);
console.log(`Output: ${OUT}`);
