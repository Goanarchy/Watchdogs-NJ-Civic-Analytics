/**
 * Builds src/data/donors.json from cached official ELEC contribution exports.
 *
 * Input: scripts/.cache/elec-contributions.json (raw records) and
 * scripts/.cache/elec-entities.json (entity discovery metadata).
 *
 * The output groups official contribution records by legislator and election
 * cycle. Donor totals are aggregated by contributor identity and year so the
 * UI can show "each donor, the year, and the amount donated" without
 * inventing any information not present in the ELEC export.
 *
 * Usage: node scripts/build-donors-data.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const cacheDir = path.join(root, "scripts", ".cache");

const contributions = JSON.parse(
  await readFile(path.join(cacheDir, "elec-contributions.json"), "utf8"),
);
const entities = JSON.parse(await readFile(path.join(cacheDir, "elec-entities.json"), "utf8"));
const legislators = JSON.parse(await readFile(path.join(dataDir, "legislators.json"), "utf8"));

const ELECTIONS = [2023, 2025];
const PORTAL = "https://www.njelecefilesearch.com/SearchContributionToEntity";

const parseDate = (value) => {
  const match = String(value ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, m, d, y] = match;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const donorKey = (row) => {
  if (row.isIndividual === "Y") {
    return [
      "I",
      clean(row.lastName).toUpperCase(),
      clean(row.firstName).toUpperCase(),
      clean(row.middleInitial).toUpperCase(),
      clean(row.suffix).toUpperCase(),
      clean(row.nonIndName).toUpperCase(),
    ].join("|");
  }
  return ["N", clean(row.nonIndName || row.lastName || row.firstName).toUpperCase()].join("|");
};

const donorName = (row) => {
  if (row.isIndividual === "Y") {
    const parts = [clean(row.firstName), clean(row.middleInitial), clean(row.lastName), clean(row.suffix)].filter(
      Boolean,
    );
    if (parts.length) return parts.join(" ");
  }
  return clean(row.nonIndName) || clean([row.firstName, row.lastName].filter(Boolean).join(" ")) || "Unknown donor";
};

const profiles = new Map();

for (const member of legislators) {
  for (const year of ELECTIONS) {
    const entityInfo = entities[`${member.id}|${year}`];
    if (!entityInfo || !entityInfo.entities?.length) continue;

    const relevantEntities = entityInfo.entities.filter(
      (entity) => entity.electionType === "PRIMARY" || entity.electionType === "GENERAL",
    );
    if (!relevantEntities.length) continue;

    const key = `${member.id}|${year}`;
    profiles.set(key, {
      key,
      legislatorId: member.id,
      name: member.fullName,
      district: member.district,
      chamber: member.chamber,
      party: member.party,
      electionYear: year,
      entities: relevantEntities.map((entity) => ({
        entityId: entity.entityId,
        entityName: entity.entityName,
        electionType: entity.electionType,
        office: entity.office,
        location: entity.location,
      })),
      source: {
        label: "NJ Election Law Enforcement Commission (ELEC) Reports and Data Search",
        portalUrl: PORTAL,
        note: "Aggregated from official ELEC contribution export records for the candidate's state legislative campaign entities in this election cycle.",
      },
      donors: new Map(),
      totalAmount: 0,
      contributionCount: 0,
    });
  }
}

for (const row of contributions) {
  const key = `${row.legislatorId}|${row.year}`;
  const profile = profiles.get(key);
  if (!profile) continue;

  const amount = Number.parseFloat(String(row.amount ?? "0").replace(/[$,]/g, ""));
  if (!Number.isFinite(amount)) continue;

  const parsedYear = Number.parseInt(parseDate(row.date).slice(0, 4), 10);
  // Algunos registros de ELEC traen fechas con el año mal capturado (2033,
  // 1975, 2005…). Si el año de la fecha no cae dentro del ciclo electoral
  // (dos años antes y uno después), se usa el año del ciclo.
  const year =
    Number.isFinite(parsedYear) &&
    parsedYear >= profile.electionYear - 2 &&
    parsedYear <= profile.electionYear + 1
      ? String(parsedYear)
      : String(profile.electionYear);
  const dk = `${donorKey(row)}|${year}`;
  let donor = profile.donors.get(dk);
  if (!donor) {
    donor = {
      donorKey: dk,
      name: donorName(row),
      isIndividual: row.isIndividual === "Y",
      contributorType: clean(row.contributorType),
      year,
      amount: 0,
      count: 0,
      employer: clean(row.employer),
      occupation: clean(row.occupation),
      lastDate: "",
    };
    profile.donors.set(dk, donor);
  }

  donor.amount += amount;
  donor.count += 1;
  if (!donor.employer && clean(row.employer)) donor.employer = clean(row.employer);
  if (!donor.occupation && clean(row.occupation)) donor.occupation = clean(row.occupation);
  const date = parseDate(row.date);
  if (date && date > donor.lastDate) donor.lastDate = date;

  profile.totalAmount += amount;
  profile.contributionCount += 1;
}

const roundMoney = (value) => Math.round(value * 100) / 100;

const outputProfiles = [...profiles.values()]
  .map((profile) => ({
    key: profile.key,
    legislatorId: profile.legislatorId,
    name: profile.name,
    district: profile.district,
    chamber: profile.chamber,
    party: profile.party,
    electionYear: profile.electionYear,
    entities: profile.entities,
    source: profile.source,
    totalAmount: roundMoney(profile.totalAmount),
    contributionCount: profile.contributionCount,
    donorCount: profile.donors.size,
    donors: [...profile.donors.values()]
      .map((donor) => ({
        name: donor.name,
        isIndividual: donor.isIndividual,
        contributorType: donor.contributorType || null,
        year: donor.year,
        amount: roundMoney(donor.amount),
        count: donor.count,
        employer: donor.employer || null,
        occupation: donor.occupation || null,
        lastDate: donor.lastDate || null,
      }))
      .sort((a, b) => b.amount - a.amount || b.year.localeCompare(a.year) || a.name.localeCompare(b.name)),
  }))
  .sort(
    (a, b) =>
      a.electionYear - b.electionYear ||
      a.district - b.district ||
      a.chamber.localeCompare(b.chamber) ||
      a.name.localeCompare(b.name),
  );

const output = {
  generatedAt: new Date().toISOString(),
  source: {
    name: "New Jersey Election Law Enforcement Commission (ELEC)",
    portalUrl: PORTAL,
    note:
      "Official campaign contribution records for state legislative candidate committees in the 2023 and 2025 election cycles. Donors are grouped by contributor identity and contribution year as reported by ELEC.",
  },
  profiles: outputProfiles,
};

await writeFile(path.join(dataDir, "donors.json"), JSON.stringify(output));

const totalDonors = outputProfiles.reduce((sum, profile) => sum + profile.donors.length, 0);
const totalAmount = outputProfiles.reduce((sum, profile) => sum + profile.totalAmount, 0);
console.log(
  `Saved ${outputProfiles.length} legislator-election donor profiles, ${totalDonors} donor-year groups, $${roundMoney(totalAmount).toLocaleString("en-US")} total.`,
);
