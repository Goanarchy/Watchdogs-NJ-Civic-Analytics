/**
 * Matches the candidates listed in the NJ Spotlight News 2026 congressional
 * district guides to their Federal Election Commission (FEC) candidate records
 * and principal campaign committees.
 *
 * The match is explicit rather than fuzzy: every guide candidate is mapped to
 * the FEC candidate ID that belongs to the same person and district. Aliases
 * such as "Nellie Pou" -> "POU, NELIDA" are listed below with the reason.
 *
 * Inputs (official FEC bulk files, cached by the fetch step):
 *   scripts/.cache/fec/cn26/cn.txt       candidate master
 *   scripts/.cache/fec/ccl26/ccl.txt     candidate-committee linkages
 *   scripts/.cache/fec/cm26/cm.txt       committee master
 *   scripts/.cache/fec/weball26/...      candidate financial totals
 *
 * Output: scripts/.cache/fec/federal-candidates.json
 *
 * Usage: node scripts/match-federal-candidates.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "scripts", ".cache");
const fecDir = path.join(cacheDir, "fec");

const guides = JSON.parse(await readFile(path.join(cacheDir, "federal-guides.json"), "utf8"));

const readTable = async (file) =>
  (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("|"));

const candidatesTable = await readTable(path.join(fecDir, "cn26", "cn.txt"));
const linkageTable = await readTable(path.join(fecDir, "ccl26", "ccl.txt"));
const committeesTable = await readTable(path.join(fecDir, "cm26", "cm.txt"));
const totalsTable = await readTable(path.join(fecDir, "weball26", "weball26.txt"));

/**
 * Guide name (district + exact guide spelling) -> FEC candidate ID.
 *
 * Every entry was verified against cn.txt: same surname, same district, and a
 * party code consistent with the guide. Where the FEC file carries more than
 * one record for the same person (Menendez, Herzig) the record with an active
 * principal committee and a financial report is used.
 */
const FEC_IDS = {
  "1|Donald Norcross": "H4NJ01084",
  "1|Damon M. Galdo": "H2NJ01187",

  "2|Jeff Van Drew": "H8NJ02166",
  "2|Zack Mullock": "H6NJ02251",
  "2|Ramon Mora Jr.": "H6NJ02269",

  "3|Herb Conaway": "H4NJ03080",
  "3|Michael McGuire": "H6NJ03184",
  "3|Steven Welzer": "H4NJ03247",
  "3|Ryan Michael Kelly": "H6NJ03192",

  "4|Christopher H. Smith": "H8NJ04014",
  "4|Rachel Peace": "H6NJ04257",

  "5|Josh Gottheimer": "H6NJ05171",
  "5|Sean Kirrane": "H6NJ05221",
  "5|Adam Rueda": "H6NJ05247",

  "6|Frank Pallone Jr.": "H8NJ03073",
  "6|Hillary Herzig": "H6NJ06286",

  "7|Thomas H. Kean Jr.": "H0NJ07261",
  "7|Rebecca Bennett": "H6NJ07201",

  "8|Rob Menendez": "H2NJ08232",
  "8|Da’Shone Hughey": "H6NJ08217",

  "9|Nellie Pou": "H4NJ09194",
  "9|Rosie Pino": "H6NJ09264",
  "9|Terrisa Bukovinac": "H6NJ09306",

  "10|LaMonica McIver": "H4NJ10176",
  "10|Carmen Bucco": "H4NJ10135",

  "11|Analilia Mejia": "H6NJ11286",
  "11|Joe Hathaway": "H6NJ11211",
  "11|Alan Bond": "H6NJ11328",

  "12|Adam Hamawy": "H6NJ12417",
  "12|Gregg Mele": "H2NJ06210",
};

/** Documented spelling differences between the guide and the FEC master file. */
const ALIAS_NOTES = {
  "1|Donald Norcross": "FEC: NORCROSS, DONALD W",
  "1|Damon M. Galdo": "FEC: GALDO, DAMON",
  "2|Jeff Van Drew": "FEC: VAN DREW, JEFF MR",
  "2|Ramon Mora Jr.": "FEC: MORA, RAMON JR",
  "3|Herb Conaway": "FEC: CONAWAY, HERB MD",
  "3|Michael McGuire": "FEC: MCGUIRE, MICHAEL PATRICK",
  "4|Christopher H. Smith": "FEC: SMITH, CHRISTOPHER H",
  "6|Frank Pallone Jr.": "FEC: PALLONE, FRANK JR",
  "7|Thomas H. Kean Jr.": "FEC: KEAN, THOMAS H. JR.",
  "8|Rob Menendez": "FEC: MENENDEZ, ROBERT J. (duplicate H2NJ13075 record excluded)",
  "8|Da’Shone Hughey": "FEC: HUGHEY, DA'SHONE",
  "9|Nellie Pou": "FEC: POU, NELIDA",
  "9|Rosie Pino": "FEC: PINO, ROSEMARY",
  "10|LaMonica McIver": "FEC: MCIVER, LAMONICA",
  "12|Gregg Mele": "FEC: MELE, GREGG",
};

const candidateById = new Map(candidatesTable.map((row) => [row[0], row]));
const committeeById = new Map(committeesTable.map((row) => [row[0], row]));
const totalsById = new Map(totalsTable.map((row) => [row[0], row]));

function principalCommittee(candidateId) {
  const links = linkageTable
    .filter((row) => row[0] === candidateId)
    .map((row) => ({ committeeId: row[3], designation: row[5] }));
  return links.find((link) => link.designation === "P") ?? null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const matched = [];
const unmatched = [];
const seen = new Set();

for (const page of guides.pages.sort((a, b) => a.district - b.district)) {
  for (const candidate of page.candidates) {
    const key = `${page.district}|${candidate.name}`;
    const fecId = FEC_IDS[key];
    if (!fecId) {
      unmatched.push({ district: page.district, name: candidate.name, reason: "No FEC candidate record for this district" });
      continue;
    }
    if (seen.has(fecId)) {
      unmatched.push({ district: page.district, name: candidate.name, reason: `Duplicate FEC ID ${fecId}` });
      continue;
    }
    seen.add(fecId);

    const row = candidateById.get(fecId);
    if (!row) {
      unmatched.push({ district: page.district, name: candidate.name, reason: `FEC ID ${fecId} not in cn.txt` });
      continue;
    }

    const principal = principalCommittee(fecId);
    const committee = principal ? committeeById.get(principal.committeeId) : null;
    const totals = totalsById.get(fecId);

    matched.push({
      district: page.district,
      guideName: candidate.name,
      aliasNote: ALIAS_NOTES[key] ?? null,
      party: candidate.party,
      partyLabel: candidate.partyLabel,
      incumbent: candidate.incumbent,
      photo: candidate.photo,
      hometown: candidate.hometown,
      occupation: candidate.occupation,
      age: candidate.age,
      background: candidate.background,
      website: candidate.website,
      didNotRespond: candidate.didNotRespond,
      answers: candidate.answers,
      guide: {
        url: page.url,
        intro: page.intro,
        published: page.published,
        modified: page.modified,
      },
      fec: {
        candidateId: fecId,
        name: row[1],
        party: row[2],
        incumbentChallenge: row[7],
        candidateStatus: row[8],
        principalCommitteeId: principal?.committeeId ?? null,
        principalCommitteeName: committee?.[1] ?? null,
        coverageEnd: totals?.[27] ?? null,
        totals: totals
          ? {
              receipts: number(totals[5]),
              disbursements: number(totals[7]),
              cashOnHand: number(totals[10]),
              individualContributions: number(totals[17]),
              otherCommitteeContributions: number(totals[25]),
              partyContributions: number(totals[26]),
              refunds: number(totals[28]),
            }
          : null,
      },
    });
  }
}

const outPath = path.join(fecDir, "federal-candidates.json");
await mkdir(fecDir, { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: {
        name: "Federal Election Commission bulk data",
        candidates: "https://www.fec.gov/files/bulk-downloads/2026/cn26.zip",
        linkages: "https://www.fec.gov/files/bulk-downloads/2026/ccl26.zip",
        committees: "https://www.fec.gov/files/bulk-downloads/2026/cm26.zip",
        totals: "https://www.fec.gov/files/bulk-downloads/2026/weball26.zip",
      },
      matched,
      unmatched,
      notes: [
        "Financial totals are the candidate committee's most recent report in the 2026 cycle, as published in weball26.",
        "Candidates with no FEC committee (O'Toole, Eliopoulos, Honts, Jinete, Jordan) have no federal finance totals.",
      ],
    },
    null,
    1,
  ),
);

console.log(`Matched ${matched.length} guide candidates to FEC records`);
for (const item of matched) {
  const t = item.fec.totals;
  console.log(
    `D${String(item.district).padStart(2, "0")} ${item.guideName.padEnd(24)} ${item.fec.candidateId} ${item.fec.principalCommitteeId ?? "-"} receipts=${t ? t.receipts.toFixed(2) : "-"} coverage=${item.fec.coverageEnd ?? "-"}`,
  );
}
if (unmatched.length) {
  console.log(`\nUnmatched (${unmatched.length}):`);
  for (const item of unmatched) console.log(`  D${item.district} ${item.name}: ${item.reason}`);
}
console.log(`Saved ${path.relative(root, outPath)}`);
