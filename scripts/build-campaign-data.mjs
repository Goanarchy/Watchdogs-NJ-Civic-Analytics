/**
 * Builds src/data/campaign.json from the NJ Spotlight News voter-guide
 * scrape, the current legislative roster, and official sponsored-bill data.
 *
 * Usage: node scripts/build-campaign-data.mjs
 *
 * Promise text is the candidate's own questionnaire answer. Status is never
 * inferred from party or ideology: it is based on a related bill the member
 * personally sponsored in the legislative session that followed the election.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.njleg.state.nj.us";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const cacheDir = path.join(root, "scripts", ".cache");

const raw = JSON.parse(await readFile(path.join(dataDir, "campaign-raw.json"), "utf8"));
const legislators = JSON.parse(await readFile(path.join(dataDir, "legislators.json"), "utf8"));
const sponsoredPath = path.join(cacheDir, "campaign-bills.json");
let sponsored;
try {
  sponsored = JSON.parse(await readFile(sponsoredPath, "utf8"));
} catch (err) {
  if (err?.code === "ENOENT") {
    throw new Error(
      `Missing ${path.relative(root, sponsoredPath)}. Run "node scripts/fetch-campaign-bills.mjs" first.`,
    );
  }
  throw err;
}

let statusCache = {};
try {
  statusCache = JSON.parse(await readFile(path.join(cacheDir, "bill-status.json"), "utf8"));
} catch {
  statusCache = {};
}

const norm = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanText = (value) =>
  String(value ?? "")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const firstServiceYear = (member) => {
  const text = (member.legislativeService ?? []).join(" ");
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
  return years.length ? Math.min(...years) : null;
};

const CANDIDATE_ALIASES = {
  "dan hutchinson": "dan hutchison",
  "carmen armato": "carmen f amato",
  "tennille mccoy": "tennille r mccoy",
};

const memberByKey = new Map();
const memberByDistrictLast = new Map();
for (const member of legislators) {
  const ln = norm(member.lastName);
  memberByKey.set(`${member.district}|${member.chamber}|${ln}`, member);
  memberByKey.set(`${member.district}|${member.chamber}|${norm(member.fullName)}`, member);
  const key = `${member.district}|${ln}`;
  memberByDistrictLast.set(key, [...(memberByDistrictLast.get(key) ?? []), member]);
}

function findMember(candidate) {
  const rawNorm = norm(candidate.name);
  const aliased = CANDIDATE_ALIASES[rawNorm] ?? rawNorm;
  const parts = aliased.split(" ").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  const first = parts[0] ?? "";
  return (
    memberByKey.get(`${candidate.district}|${candidate.chamber}|${last}`) ??
    memberByKey.get(`${candidate.district}|${candidate.chamber}|${aliased}`) ??
    (memberByDistrictLast.get(`${candidate.district}|${last}`) ?? []).find((m) =>
      norm(m.firstName).startsWith(first.slice(0, 3)),
    ) ??
    null
  );
}

/* -------------------------------------------------------------------------- */
/* Questions we treat as campaign commitments                                 */
/* -------------------------------------------------------------------------- */

function questionKind(question) {
  const q = question.toLowerCase();
  if (q.includes("top issue")) return "top";
  if (q.includes("specific proposals") && q.includes("affordable")) return "affordability";
  if (q.includes("affordable housing") && q.includes("support")) return "housing";
  if (q.includes("funding cuts")) return "federal";
  if (q.includes("key election issue")) return "key";
  if (q.includes("housing affordability") && q.includes("property taxes")) return "housingTaxes";
  return null;
}

const KIND_ORDER = ["top", "key", "affordability", "housing", "housingTaxes", "federal"];

/* -------------------------------------------------------------------------- */
/* Categories and strict bill matching                                        */
/* -------------------------------------------------------------------------- */

const CATEGORIES = {
  affordability: [
    ["property tax", 5],
    ["tax relief", 5],
    ["income tax credit", 5],
    ["minimum wage", 5],
    ["prescription drug", 5],
    ["child care", 5],
    ["cost of living", 5],
    ["tax rebate", 5],
    ["tax credit", 4],
    ["anchors", 4],
    ["anchor", 4],
    ["senior freeze", 5],
    ["staynj", 5],
  ],
  housing: [
    ["affordable housing", 5],
    ["housing production", 5],
    ["rent control", 5],
    ["tenant protection", 5],
    ["first-time homebuyer", 5],
    ["first time homebuyer", 5],
    ["down payment", 5],
    ["housing", 3],
    ["rent", 3],
    ["tenant", 4],
    ["landlord", 4],
    ["zoning", 4],
    ["eviction", 4],
    ["homeless", 4],
    ["homeownership", 4],
  ],
  utilities: [
    ["utility rate", 5],
    ["rate increase", 5],
    ["rate hike", 5],
    ["electric", 3],
    ["gas", 2],
    ["water", 2],
    ["bpu", 5],
    ["energy bill", 5],
  ],
  education: [
    ["school funding", 5],
    ["school aid", 5],
    ["public school", 4],
    ["higher education", 5],
    ["tuition", 4],
    ["pre-k", 5],
    ["preschool", 4],
    ["teacher", 4],
    ["education", 3],
    ["student", 3],
  ],
  healthcare: [
    ["health care", 5],
    ["medicaid", 5],
    ["prescription drug", 5],
    ["mental health", 5],
    ["reproductive", 5],
    ["hospital", 4],
    ["patient", 4],
    ["insurance", 4],
    ["health", 2],
  ],
  climate: [
    ["climate", 5],
    ["clean energy", 5],
    ["renewable energy", 5],
    ["offshore wind", 5],
    ["environmental justice", 5],
    ["emission", 4],
    ["solar", 4],
    ["flood", 4],
    ["energy", 3],
  ],
  transit: [
    ["nj transit", 5],
    ["public transit", 5],
    ["public transportation", 5],
    ["transportation", 4],
    ["infrastructure", 4],
    ["rail", 3],
    ["bus", 2],
  ],
  publicSafety: [
    ["firearm", 5],
    ["gun", 5],
    ["public safety", 5],
    ["law enforcement", 5],
    ["crime", 4],
    ["violence", 4],
    ["police", 4],
  ],
  economy: [
    ["small business", 5],
    ["minimum wage", 5],
    ["workforce", 5],
    ["economic development", 5],
    ["agriculture", 4],
    ["job", 3],
    ["business", 3],
    ["wage", 3],
  ],
  democracy: [
    ["campaign finance", 5],
    ["government transparency", 5],
    ["ethics", 4],
    ["voting", 4],
    ["election", 3],
  ],
  federal: [
    ["federal funds", 5],
    ["federal funding", 5],
    ["federal cut", 5],
    ["social services", 5],
    ["safety net", 5],
    ["medicaid", 5],
    ["federal", 3],
    ["budget", 2],
  ],
};

function guessCategory(text) {
  const lower = text.toLowerCase();
  let best = { key: "general", score: 0 };
  for (const [key, phrases] of Object.entries(CATEGORIES)) {
    let score = 0;
    for (const [phrase, weight] of phrases) {
      if (lower.includes(phrase)) score += weight;
    }
    if (score > best.score) best = { key, score };
  }
  return best.key;
}

function billScore(category, bill) {
  if (bill.type !== "P") return 0;
  const synopsis = bill.synopsis.toLowerCase();
  const phrases = CATEGORIES[category];
  if (!phrases) return 0;
  let score = 0;
  for (const [phrase, weight] of phrases) {
    if (synopsis.includes(phrase)) score += weight;
  }
  return score;
}

/* -------------------------------------------------------------------------- */
/* Official bill status                                                       */
/* -------------------------------------------------------------------------- */

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseActionDate(value) {
  const match = String(value ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  const [, month, day, year] = match;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function getBillStatus(session, bill) {
  const key = `${session}|${bill}`;
  if (statusCache[key]) return statusCache[key];
  const prefix = session === 2026 ? "billDetail" : "billDetailHist";
  try {
    const [description, history] = await Promise.all([
      fetchJson(`${BASE}/api/${prefix}/billDescription/${bill}/${session}`),
      fetchJson(`${BASE}/api/${prefix}/billHistory/${bill}/${session}`),
    ]);
    const rows = Array.isArray(history) ? history : [];
    const last = rows[rows.length - 1] ?? {};
    const enactedRow = rows.find((row) => /approved\s+p\.?l\.?/i.test(row.HistoryAction ?? ""));
    const advanced = rows.some((row) =>
      /reported out|passed|received in|substituted|second reading|third reading|approved/i.test(
        row.HistoryAction ?? "",
      ),
    );
    const result = {
      currentStatus: description?.[0]?.CurrentStatus ?? "",
      synopsis: description?.[0]?.Synopsis ?? "",
      lastAction: last.HistoryAction ?? "",
      lastActionDate: parseActionDate(last.ActionDate),
      enacted: Boolean(enactedRow),
      enactedAction: enactedRow?.HistoryAction ?? "",
      enactedDate: parseActionDate(enactedRow?.ActionDate),
      advanced,
    };
    statusCache[key] = result;
    return result;
  } catch (error) {
    const result = {
      currentStatus: "",
      synopsis: "",
      lastAction: "",
      lastActionDate: "",
      enacted: false,
      enactedAction: "",
      enactedDate: "",
      advanced: false,
      error: error.message,
    };
    statusCache[key] = result;
    return result;
  }
}

/* -------------------------------------------------------------------------- */
/* Promise extraction: one commitment per substantive question                */
/* -------------------------------------------------------------------------- */

const MAX_PROMISE_TEXT = 1200;

function extractPromises(candidate, source, legislatorId) {
  const byKind = new Map();
  for (const [question, answer] of Object.entries(candidate.answers ?? {})) {
    const kind = questionKind(question);
    if (!kind) continue;
    const text = cleanText(answer);
    if (text.length < 60 || /^did not answer/i.test(text)) continue;
    const existing = byKind.get(kind);
    if (!existing || text.length > existing.text.length) {
      byKind.set(kind, { text, question });
    }
  }

  return KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind, index) => {
    const item = byKind.get(kind);
    const category =
      kind === "affordability"
        ? "affordability"
        : kind === "housing" || kind === "housingTaxes"
          ? "housing"
          : kind === "federal"
            ? "federal"
            : guessCategory(item.text);
    return {
      id: `${legislatorId}-${candidate.year}-${index + 1}`,
      kind,
      category,
      text: item.text.slice(0, MAX_PROMISE_TEXT),
      source: { ...source, question: item.question },
      status: "pending",
      statusNote: "noAction",
      evidence: [],
      session: candidate.year === 2023 ? 2024 : 2026,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Manual, sourced status overrides                                           */
/* -------------------------------------------------------------------------- */

// Only add entries here when the official bill record directly supports the
// label. Keys can be `legislatorId|year|kind` or
// `legislatorId|year|promiseId`.
const PROMISE_OVERRIDES = {
  // Chris Tully made renewable-energy expansion a central commitment. The
  // 2024-2025 renewable-energy incentives bill was signed into law.
  "412|2023|key": {
    status: "fulfilled",
    statusNote: "enacted",
    evidence: [
      {
        bill: "A3974",
        session: 2024,
        url: `${BASE}/bill-search/2024/A3974`,
        synopsis:
          "Modifies various provisions of State's renewable energy incentive programs; requires electric public utilities to consider interconnection applications.",
        date: "2025-08-11",
        action: "Approved P.L.2025, c.122.",
      },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Build ballots and profiles                                                 */
/* -------------------------------------------------------------------------- */

function sourceFor(page) {
  return {
    label:
      page.year === 2023
        ? "NJ Spotlight News · NJ Decides 2023 voter guide"
        : "NJ Spotlight News · NJ Decides 2025 voter guide",
    url: page.url,
    date: page.date,
  };
}

function wonElection(member, year) {
  if (!member) return null;
  if (year === 2025) return true;
  const first = firstServiceYear(member);
  return first != null ? first <= 2024 : null;
}

const years = [2023, 2025].map((year) => {
  const pages = raw.pages
    .filter((page) => page.year === year)
    .sort((a, b) => a.district - b.district);
  return {
    year,
    label: year === 2023 ? "NJ 2023 general election" : "NJ 2025 general election",
    chambers: year === 2023 ? ["Senate", "Assembly"] : ["Assembly"],
    districts: pages
      .map((page) => {
        const source = sourceFor(page);
        const chambers = year === 2023 ? ["Senate", "Assembly"] : ["Assembly"];
        const races = chambers
          .map((chamber) => {
            const candidates = page.candidates
              .filter((candidate) => candidate.chamber === chamber)
              .map((candidate) => {
                const member = findMember(candidate);
                return {
                  name: candidate.name,
                  party: candidate.party || "",
                  incumbent: candidate.incumbent,
                  responded: candidate.responded,
                  currentLegislatorId: member?.id ?? null,
                  profileKey: member ? `${member.id}-${year}` : null,
                  won: wonElection(member, year),
                };
              });
            return { chamber, candidates };
          })
          .filter((race) => race.candidates.length);
        return { district: page.district, source, races };
      })
      .filter((district) => district.races.length),
  };
});

const profileMap = new Map();
for (const page of raw.pages) {
  const source = sourceFor(page);
  for (const candidate of page.candidates) {
    const member = findMember(candidate);
    if (!member) continue;
    const key = `${member.id}-${page.year}`;
    if (profileMap.has(key)) continue;
    profileMap.set(key, {
      key,
      legislatorId: member.id,
      name: member.fullName,
      district: member.district,
      chamber: member.chamber,
      party: member.party,
      photo: member.photo,
      electionYear: page.year,
      won: wonElection(member, page.year) === true,
      responded: candidate.responded,
      source,
      promises: extractPromises(candidate, source, member.id),
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Apply evidence and status                                                  */
/* -------------------------------------------------------------------------- */

for (const profile of profileMap.values()) {
  if (profile.promises.length === 0) continue;
  const session = profile.electionYear === 2023 ? 2024 : 2026;
  const bills = (sponsored[profile.legislatorId]?.[session] ?? []).filter(
    (bill) => bill.type === "P",
  );

  for (const promise of profile.promises) {
    const override =
      PROMISE_OVERRIDES[`${profile.legislatorId}|${profile.electionYear}|${promise.kind}`] ??
      PROMISE_OVERRIDES[`${profile.legislatorId}|${profile.electionYear}|${promise.id}`];
    if (override) {
      promise.status = override.status;
      promise.statusNote = override.statusNote;
      promise.evidence = override.evidence ?? [];
      continue;
    }

    if (!profile.won) {
      promise.status = "pending";
      promise.statusNote = "notElected";
      continue;
    }

    const matches = bills
      .map((bill) => ({ ...bill, score: billScore(promise.category, bill) }))
      .filter((bill) => bill.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    if (!matches.length) {
      promise.status = "pending";
      promise.statusNote = "noAction";
      continue;
    }

    const checked = [];
    for (const bill of matches) {
      const status = await getBillStatus(session, bill.bill);
      checked.push({ bill, status });
    }
    const enacted = checked.find((item) => item.status.enacted);
    const best = enacted ?? checked[0];

    promise.evidence = checked.map((item) => ({
      bill: item.bill.bill,
      session,
      url: `${BASE}/bill-search/${session}/${item.bill.bill}`,
      synopsis: item.bill.synopsis || item.status.synopsis,
      date: item.status.enactedDate || item.status.lastActionDate || `${session}`,
      action: item.status.enactedAction || item.status.lastAction || "Introduced",
    }));

    if (enacted) {
      promise.status = "fulfilled";
      promise.statusNote = "enacted";
    } else if (session === 2026) {
      promise.status = "underway";
      promise.statusNote = checked.some((item) => item.status.advanced) ? "advanced" : "introduced";
    } else {
      // The 2024-2025 session ended in January 2026 without enacting this bill.
      // Keep the neutral "pending" label rather than claiming failure.
      promise.status = "pending";
      promise.statusNote = "sessionEnded";
    }
  }
}

await mkdir(cacheDir, { recursive: true });
await writeFile(path.join(cacheDir, "bill-status.json"), JSON.stringify(statusCache));

const output = {
  generatedAt: new Date().toISOString(),
  source: {
    name: "NJ Spotlight News voter guides",
    url: "https://www.njspotlightnews.org/special-report/nj-2025-voter-guide-nj-governor-nj-assembly-races/",
    note: "Answers from candidate questionnaires published in the 2023 and 2025 NJ Spotlight News voter guides.",
  },
  methodology: {
    statuses: ["fulfilled", "underway", "failed", "pending"],
    sessions: { 2023: 2024, 2025: 2026 },
  },
  years,
  profiles: [...profileMap.values()].sort(
    (a, b) =>
      a.electionYear - b.electionYear ||
      a.district - b.district ||
      a.chamber.localeCompare(b.chamber) ||
      a.name.localeCompare(b.name),
  ),
};

await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, "campaign.json"), JSON.stringify(output));

const totalPromises = output.profiles.reduce((sum, profile) => sum + profile.promises.length, 0);
const statusCounts = {};
const categoryCounts = {};
for (const profile of output.profiles) {
  for (const promise of profile.promises) {
    statusCounts[promise.status] = (statusCounts[promise.status] ?? 0) + 1;
    categoryCounts[promise.category] = (categoryCounts[promise.category] ?? 0) + 1;
  }
}

console.log(
  `Saved ${output.years.length} election years, ${output.profiles.length} profiles, ${totalPromises} promises.`,
);
console.log(`Statuses: ${JSON.stringify(statusCounts)}`);
console.log(`Categories: ${JSON.stringify(categoryCounts)}`);
console.log(`Bill status cache: ${Object.keys(statusCache).length}`);
