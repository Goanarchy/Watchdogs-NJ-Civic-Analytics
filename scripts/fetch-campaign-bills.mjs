/**
 * Fetches sponsored bills for current legislators in the sessions that
 * follow the 2023 and 2025 elections, so campaign promises can be checked
 * against official legislative action.
 *
 * Usage: node scripts/fetch-campaign-bills.mjs
 * Writes src/data/campaign-bills.json (build-time evidence cache).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.njleg.state.nj.us";
const SESSIONS = [2024, 2026];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const cacheDir = path.join(root, "scripts", ".cache");
const cachePath = path.join(cacheDir, "campaign-bills.json");
const rawPath = path.join(dataDir, "campaign-raw.json");

const legislators = JSON.parse(await readFile(path.join(dataDir, "legislators.json"), "utf8"));
const raw = JSON.parse(await readFile(rawPath, "utf8"));

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ALIASES = {
  "dan hutchinson": "dan hutchison",
  "carmen armato": "carmen f amato",
  "tennille mccoy": "tennille r mccoy",
};

// Match guide candidates to current legislators by district, chamber and name,
// with a same-district fallback for members who changed chambers (e.g. Wimberly).
const byKey = new Map();
const byDist = new Map();
for (const member of legislators) {
  const ln = norm(member.lastName);
  byKey.set(`${member.district}|${member.chamber}|${ln}`, member);
  byKey.set(`${member.district}|${member.chamber}|${norm(member.fullName)}`, member);
  byDist.set(`${member.district}|${ln}`, [...(byDist.get(`${member.district}|${ln}`) ?? []), member]);
}

const ids = new Set();
for (const page of raw.pages) {
  for (const candidate of page.candidates) {
    if (!candidate.responded) continue;
    const rawNorm = norm(candidate.name);
    const aliased = ALIASES[rawNorm] ?? rawNorm;
    const parts = aliased.split(" ").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    const first = parts[0] ?? "";
    const member =
      byKey.get(`${candidate.district}|${candidate.chamber}|${last}`) ??
      byKey.get(`${candidate.district}|${candidate.chamber}|${aliased}`) ??
      (byDist.get(`${candidate.district}|${last}`) ?? []).find((m) =>
        norm(m.firstName).startsWith(first.slice(0, 3)),
      );
    if (member) ids.add(member.id);
  }
}

let cache = {};
try {
  cache = JSON.parse(await readFile(cachePath, "utf8"));
} catch {
  cache = {};
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

const jobs = [];
for (const id of ids) {
  for (const session of SESSIONS) {
    if (!cache[id]?.[session]) jobs.push({ id, session });
  }
}

console.log(`Fetching sponsored bills for ${ids.size} legislators (${jobs.length} requests)…`);
let done = 0;
await mapLimit(jobs, 4, async (job) => {
  const url = `${BASE}/api/billSearch/billsBySponsor/${job.id}/${job.session}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rows = Array.isArray(json?.[0]) ? json[0] : [];
    const bills = rows
      .map((row) => ({
        bill: String(row.Bill ?? "").trim(),
        type: row.Type_of_Sponsor === "P" ? "P" : "C",
        synopsis: String(row.Synopsis ?? "")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((row) => row.bill);
    cache[job.id] ??= {};
    cache[job.id][job.session] = bills;
    done++;
    process.stdout.write(`\r  ${done}/${jobs.length} member ${job.id} ${job.session}`);
  } catch (error) {
    process.stdout.write(`\r  ERR member ${job.id} ${job.session}: ${error.message}\n`);
  }
});
process.stdout.write("\n");

await mkdir(cacheDir, { recursive: true });
await writeFile(cachePath, JSON.stringify(cache));
const count = Object.values(cache).reduce(
  (sum, sessions) => sum + Object.values(sessions).reduce((n, bills) => n + bills.length, 0),
  0,
);
console.log(`Saved ${count} sponsored bill records to ${path.relative(root, cachePath)}`);
