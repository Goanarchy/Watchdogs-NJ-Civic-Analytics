/**
 * Fetches official U.S. Census Bureau American Community Survey (ACS) 5-Year
 * socioeconomic estimates for New Jersey statewide (04000US34) and all 40 NJ
 * State Legislative Districts (61000US34001 - 61000US34040) via Census Reporter.
 *
 * Usage: node scripts/fetch-census-acs.mjs
 * Writes src/data/demographics.json.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "src", "data", "demographics.json");

const TABLES = [
  "B01003", // Total population
  "B01002", // Median age
  "B19013", // Median household income
  "B25077", // Median home value
  "B25064", // Median gross rent
  "B17001", // Poverty status in the past 12 months
  "B15003", // Educational attainment for the population 25 years and over
  "B23025", // Employment status for the population 16 years and over
  "B25003", // Housing tenure (owner vs renter occupied)
  "B08301", // Means of transportation to work (public transit share)
];

const UA = "WatchdogsNJ/2.0 (civic-open-data)";

async function fetchBatch(geoIds) {
  const url = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=${TABLES.join(",")}&geo_ids=${geoIds.join(",")}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Census Reporter HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const pct = (part, total) =>
  total > 0 && Number.isFinite(part) && Number.isFinite(total)
    ? Math.round((part / total) * 1000) / 10
    : 0;

function extractMetrics(entry) {
  const est = (table, col) => Number(entry?.[table]?.estimate?.[col] ?? 0);

  const population = Math.round(est("B01003", "B01003001"));
  const medianAge = Math.round(est("B01002", "B01002001") * 10) / 10;
  const medianIncome = Math.round(est("B19013", "B19013001"));
  const medianHomeValue = Math.round(est("B25077", "B25077001"));
  const medianRent = Math.round(est("B25064", "B25064001"));

  const povUniverse = est("B17001", "B17001001");
  const povBelow = est("B17001", "B17001002");

  const eduUniverse = est("B15003", "B15003001");
  const bachelorsPlus =
    est("B15003", "B15003022") +
    est("B15003", "B15003023") +
    est("B15003", "B15003024") +
    est("B15003", "B15003025");

  const laborForce = est("B23025", "B23025003");
  const unemployed = est("B23025", "B23025005");

  const housingUnits = est("B25003", "B25003001");
  const ownerOccupied = est("B25003", "B25003002");

  const workers = est("B08301", "B08301001");
  const transitCommuters = est("B08301", "B08301010");

  return {
    population,
    medianAge,
    medianIncome,
    medianHomeValue,
    medianRent,
    povertyRate: pct(povBelow, povUniverse),
    bachelorsPlusRate: pct(bachelorsPlus, eduUniverse),
    unemploymentRate: pct(unemployed, laborForce),
    homeownershipRate: pct(ownerOccupied, housingUnits),
    transitCommuteRate: pct(transitCommuters, workers),
  };
}

const batch1Ids = [
  "04000US34",
  ...Array.from({ length: 20 }, (_, i) => `61000US34${String(i + 1).padStart(3, "0")}`),
];
const batch2Ids = Array.from(
  { length: 20 },
  (_, i) => `61000US34${String(i + 21).padStart(3, "0")}`,
);

console.log("Fetching official Census ACS 5-Year estimates for NJ & 40 Legislative Districts...");
const [b1, b2] = await Promise.all([fetchBatch(batch1Ids), fetchBatch(batch2Ids)]);

const allData = { ...b1.data, ...b2.data };
const allGeo = { ...b1.geography, ...b2.geography };
const release = b1.release ?? b2.release ?? { id: "acs_5yr", name: "ACS 5-Year" };

const statewideRaw = allData["04000US34"];
if (!statewideRaw) throw new Error("Missing NJ statewide baseline 04000US34");

const districts = [];
for (let d = 1; d <= 40; d += 1) {
  const geoId = `61000US34${String(d).padStart(3, "0")}`;
  const entry = allData[geoId];
  if (!entry) throw new Error(`Missing NJ Legislative District ${d} (${geoId})`);
  districts.push({
    district: d,
    geoId,
    name: allGeo[geoId]?.name ?? `State Senate District ${d}, NJ`,
    ...extractMetrics(entry),
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  release: {
    id: release.id,
    name: release.name,
    years: release.years ?? "",
  },
  source: {
    name: "U.S. Census Bureau · American Community Survey (ACS) 5-Year Estimates",
    url: "https://data.census.gov/",
    apiProvider: "Census Reporter (official ACS 5-year table extracts)",
    tables: TABLES,
  },
  statewide: {
    geoId: "04000US34",
    name: allGeo["04000US34"]?.name ?? "New Jersey",
    ...extractMetrics(statewideRaw),
  },
  districts,
};

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(output, null, 2));
console.log(
  `Saved ${districts.length} NJ district ACS profiles (${release.name}) to ${path.relative(root, outPath)}`,
);
