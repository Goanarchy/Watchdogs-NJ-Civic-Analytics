/**
 * Builds src/data/federal.json, the single data file behind the
 * "Elecciones de medio término 2026" module.
 *
 * Inputs:
 *   scripts/.cache/federal-guides.json            NJ Spotlight candidate Q&As
 *   scripts/.cache/federal-results.json           AP results via NYT district pages
 *   scripts/.cache/fec/federal-candidates.json    FEC candidate + committee match
 *   scripts/.cache/fec/federal-committee-donors.json
 *   scripts/.cache/fec/federal-individual-donors.json
 *
 * Nothing is inferred: every promise is the candidate's own questionnaire
 * answer, every result comes from AP, and every finance figure comes from the
 * FEC bulk files. Missing data is left missing and labelled in the UI.
 *
 * Usage: node scripts/build-federal-data.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "scripts", ".cache");
const fecDir = path.join(cacheDir, "fec");
const dataDir = path.join(root, "src", "data");

const guides = JSON.parse(await readFile(path.join(cacheDir, "federal-guides.json"), "utf8"));
const results = JSON.parse(await readFile(path.join(cacheDir, "federal-results.json"), "utf8"));
const matched = JSON.parse(await readFile(path.join(fecDir, "federal-candidates.json"), "utf8"));
const committeeDonors = JSON.parse(
  await readFile(path.join(fecDir, "federal-committee-donors.json"), "utf8"),
);
const individualDonors = JSON.parse(
  await readFile(path.join(fecDir, "federal-individual-donors.json"), "utf8"),
);

const ISSUE_QUESTIONS = [
  ["topIssue", /\btop issue\b/i],
  ["economy", /econom|cost of living|high costs/i],
  ["healthcare", /health ?care/i],
  ["defense", /iran|defense spending|defense policy/i],
  ["immigration", /immigration/i],
  ["elections", /elections?\b|voting\b/i],
];

function issueCategory(question) {
  for (const [category, pattern] of ISSUE_QUESTIONS) {
    if (pattern.test(question)) return category;
  }
  return null;
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "mr", "mrs", "ms", "dr", "phd", "esq"]);

function surname(value) {
  const parts = normalizeName(value)
    .replace(/[.']/g, "")
    .split(" ")
    .filter((part) => part && !SUFFIXES.has(part));
  return parts.at(-1) ?? "";
}

function partyCode(value) {
  const text = String(value ?? "").trim();
  if (/^(D|DEM|DEMOCRAT|DEMOCRATIC)$/i.test(text)) return "D";
  if (/^(R|REP|REPUBLICAN)$/i.test(text)) return "R";
  if (/^(G|GRE|GREEN)$/i.test(text)) return "G";
  if (/^(SW|SOCIALIST WORKERS)$/i.test(text)) return "SW";
  if (/^(I|IND|INDEPENDENT)$/i.test(text)) return "I";
  return "O";
}

const matchedByKey = new Map();
for (const item of matched.matched) {
  matchedByKey.set(`${item.district}|${item.guideName}`, item);
}

const committeeDonorsByCommittee = new Map(
  committeeDonors.committees.map((item) => [item.committeeId, item]),
);
const individualDonorsByCommittee = new Map(
  individualDonors.committees.map((item) => [item.committeeId, item]),
);

const districts = [];
let candidateCount = 0;

for (const page of guides.pages.sort((a, b) => a.district - b.district)) {
  const result = results.districts.find((item) => item.district === page.district);
  const resultCandidates = result?.candidates ?? [];
  const usedResultIds = new Set();

  const candidates = page.candidates.map((candidate) => {
    const match = matchedByKey.get(`${page.district}|${candidate.name}`) ?? null;
    const candidateSurname = surname(candidate.name);
    const candidateParty = partyCode(candidate.party);

    const resultCandidate =
      resultCandidates.find(
        (row) =>
          !usedResultIds.has(row.id) &&
          surname(row.name) === candidateSurname &&
          partyCode(row.party) === candidateParty,
      ) ?? null;
    if (resultCandidate) usedResultIds.add(resultCandidate.id);

    const promises = candidate.answers
      .map((answer) => {
        const category = issueCategory(answer.question);
        return category
          ? { category, question: answer.question, answer: answer.answer }
          : null;
      })
      .filter(Boolean);

    const committeeId = match?.fec.principalCommitteeId ?? null;
    const individual = committeeId ? individualDonorsByCommittee.get(committeeId) : null;
    const committees = committeeId ? committeeDonorsByCommittee.get(committeeId) : null;

    const finance = match?.fec.principalCommitteeId
      ? {
          candidateId: match.fec.candidateId,
          committeeId,
          committeeName: match.fec.principalCommitteeName,
          coverageEnd: match.fec.coverageEnd,
          totals: match.fec.totals,
          itemizedIndividuals: individual
            ? {
                total: individual.itemizedTotal,
                donorCount: individual.donorCount,
                transactionCount: individual.transactionCount,
                donors: individual.donors,
              }
            : null,
          committeeDonors: committees
            ? {
                total: committees.total,
                donorCount: committees.donorCount,
                donors: committees.donors,
              }
            : null,
        }
      : null;

    candidateCount += 1;
    return {
      id: `federal-${page.district}-${slug(candidate.name)}`,
      name: candidate.name,
      party: candidate.party,
      partyLabel: candidate.partyLabel,
      incumbent: candidate.incumbent,
      photo: candidate.photo,
      hometown: candidate.hometown,
      occupation: candidate.occupation,
      age: candidate.age,
      background: candidate.background,
      website: candidate.website,
      didNotRespond: candidate.answers.length === 0,
      promises,
      result: resultCandidate
        ? {
            votes: resultCandidate.votes,
            pct: resultCandidate.pct,
            winner: resultCandidate.winner,
            incumbent: resultCandidate.incumbent,
          }
        : null,
      finance,
    };
  });

  const listedVotes = resultCandidates.reduce((sum, row) => sum + row.votes, 0);
  const residualVotes = result?.total ? Math.max(0, result.total - listedVotes) : 0;

  districts.push({
    district: page.district,
    intro: page.intro,
    guideUrl: page.url,
    guidePublished: page.published,
    guideModified: page.modified,
    results: result
      ? {
          totalVotes: result.total,
          reportingPct: result.reportingPct,
          updatedAt: result.updatedAt,
          residualVotes,
          listedCandidates: resultCandidates.map((row) => ({
            name: row.name,
            party: partyCode(row.party),
            partyLabel: row.party,
            votes: row.votes,
            pct: row.pct,
            winner: row.winner,
          })),
        }
      : null,
    candidates,
  });
}

const partyVotes = { D: 0, R: 0, O: 0 };
let totalVotes = 0;
let totalReceipts = 0;
let totalItemizedIndividual = 0;
let totalCommitteeMoney = 0;
const seats = { D: 0, R: 0, O: 0 };

for (const district of districts) {
  for (const row of district.results?.listedCandidates ?? []) {
    const bucket = row.party === "D" ? "D" : row.party === "R" ? "R" : "O";
    partyVotes[bucket] += row.votes;
    if (row.winner) seats[bucket] += 1;
  }
  totalVotes += district.results?.totalVotes ?? 0;
  for (const candidate of district.candidates) {
    if (candidate.finance?.totals) {
      totalReceipts += candidate.finance.totals.receipts;
      totalItemizedIndividual += candidate.finance.itemizedIndividuals?.total ?? 0;
      totalCommitteeMoney += candidate.finance.committeeDonors?.total ?? 0;
    }
  }
}

const attributedVotes = partyVotes.D + partyVotes.R + partyVotes.O;

const payload = {
  generatedAt: new Date().toISOString(),
  election: {
    date: "2026-11-03",
    year: 2026,
    type: "general",
    scope: "federal",
    office: "U.S. House of Representatives",
    state: "New Jersey",
    districtCount: districts.length,
    candidateCount,
    note:
      "Federal midterm elections held November 3, 2026. New Jersey's State Senate and General Assembly are not on this ballot; their elections are held in odd-numbered years.",
  },
  summary: {
    seats,
    partyVotes,
    attributedVotes,
    unattributedVotes: totalVotes - attributedVotes,
    totalVotes,
    totalReceipts: Math.round(totalReceipts * 100) / 100,
    totalItemizedIndividual: Math.round(totalItemizedIndividual * 100) / 100,
    totalCommitteeMoney: Math.round(totalCommitteeMoney * 100) / 100,
  },
  sources: {
    results: {
      ...results.source,
      retrievedAt: results.generatedAt,
    },
    guides: {
      name: "NJ Spotlight News · 2026 congressional district election guides",
      url: "https://www.njspotlightnews.org/special-report/2026-primary-3rd-congressional-district/",
      note:
        "Candidate biographies and issue answers are the candidates' own published questionnaire responses. Answers are reproduced verbatim in English.",
      retrievedAt: guides.generatedAt,
    },
    finance: {
      name: "Federal Election Commission · 2026 bulk data",
      url: "https://www.fec.gov/data/browse-data/?tab=bulk-data",
      note:
        "Totals from weball26, committee contributions from pas226, itemized individual contributions from indiv26. Coverage ends at each committee's most recent 2026 report.",
      retrievedAt: individualDonors.generatedAt,
    },
  },
  methodology: {
    promises:
      "Only the six issue questions in the NJ Spotlight questionnaire are treated as campaign commitments. They are shown as declared positions, not evaluated as fulfilled or broken, because this app does not score federal legislative outcomes.",
    results:
      "Preliminary Associated Press results published by The New York Times. Percentages and reporting levels are those shown by AP at retrieval time. Candidates omitted from the published table are not assigned individual vote totals; their combined votes appear as an unattributed residual.",
    finance:
      "Itemized individual contributions include only donations that campaigns must itemize (generally $200 or more). Unitemized small-dollar donations are part of the FEC total but cannot be listed donor by donor. Conduit-processed earmarked donations are counted once.",
  },
  districts,
};

const outPath = path.join(dataDir, "federal.json");
await mkdir(dataDir, { recursive: true });
await writeFile(outPath, JSON.stringify(payload, null, 1));

console.log(`Saved ${path.relative(root, outPath)}`);
console.log(
  `Districts ${districts.length} · candidates ${candidateCount} · seats D${seats.D}/R${seats.R} · votes ${totalVotes.toLocaleString()} (attributed ${attributedVotes.toLocaleString()})`,
);
console.log(
  `Receipts $${totalReceipts.toLocaleString(undefined, { maximumFractionDigits: 0 })} · itemized individual $${totalItemizedIndividual.toLocaleString(undefined, { maximumFractionDigits: 0 })} · committee $${totalCommitteeMoney.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
);
for (const district of districts) {
  const winners = district.candidates.filter((c) => c.result?.winner).map((c) => `${c.name} (${c.party})`);
  const promises = district.candidates.reduce((sum, c) => sum + c.promises.length, 0);
  const finance = district.candidates.filter((c) => c.finance?.totals).length;
  console.log(
    `D${String(district.district).padStart(2, "0")} winner=${winners.join(", ") || "?"} promises=${promises} finance=${finance}/${district.candidates.length} residual=${district.results?.residualVotes ?? "?"}`,
  );
}
