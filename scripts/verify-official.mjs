/**
 * Verifica los datos locales contra la fuente oficial del Legislativo de
 * Nueva Jersey.
 *
 * Uso: npm run verify-official
 *
 * Comprueba:
 *   1. Los 120 legisladores (nombre, partido, cámara y distrito) contra el
 *      roster oficial.
 *   2. El número total y primario de proyectos patrocinados de cada
 *      legislador contra la API oficial billsBySponsor.
 *   3. Los municipios y condados de cada distrito contra el roster oficial.
 *
 * Hace 120 peticiones a la API oficial con concurrencia limitada.
 */
const BASE = "https://www.njleg.state.nj.us";
const SESSION = 2026;
const CONCURRENCY = 6;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/html;q=0.9,*/*;q=0.8",
};

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (name) =>
  JSON.parse(await readFile(path.join(root, "src", "data", name), "utf8"));

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const norm = (value) => clean(value).toLowerCase();
const namePart = (value) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const problems = [];
const notes = [];
const fail = (message) => problems.push(message);
const note = (message) => notes.push(message);

/* ------------------------------------------------------------ roster oficial */
const rosterResponse = await fetch(`${BASE}/legislative-roster`, { headers: HEADERS });
if (!rosterResponse.ok) throw new Error(`Roster oficial: HTTP ${rosterResponse.status}`);
const rosterHtml = await rosterResponse.text();
const nextData = rosterHtml.match(
  /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
);
if (!nextData) throw new Error("No se encontró __NEXT_DATA__ en el roster oficial.");
const roster = JSON.parse(nextData[1]);
const [members, , districtRows] = roster.props.pageProps.legrosterData;

console.log(`Roster oficial: ${members.length} legisladores, ${districtRows.length} distritos.`);

/* ---------------------------------------------------------------- legisladores */
const legislators = await read("legislators.json");
const localById = new Map(legislators.map((l) => [l.id, l]));
const localByName = new Map(legislators.map((l) => [norm(l.fullName), l]));

const officialIds = new Set();
for (const member of members) {
  const idMatch = String(member.BioLink ?? "").match(/\/legislative-roster\/(\d+)\//);
  const id = idMatch ? Number(idMatch[1]) : null;
  if (id) officialIds.add(id);

  const local = (id && localById.get(id)) ?? localByName.get(norm(member.Full_Name));
  if (!local) {
    fail(`Legislador oficial sin dato local: ${member.Full_Name} (id ${id ?? "?"})`);
    continue;
  }

  if (namePart(local.firstName) !== namePart(member.First_Name))
    fail(`Nombre distinto: ${local.fullName}: local "${local.firstName}" vs oficial "${member.First_Name}"`);
  if (namePart(local.lastName) !== namePart(member.Last_Name))
    fail(`Apellido distinto: ${local.fullName}: local "${local.lastName}" vs oficial "${member.Last_Name}"`);
  if (local.party !== member.Party)
    fail(`Partido distinto: ${local.fullName}: local ${local.party} vs oficial ${member.Party}`);
  if (local.chamber !== member.Roster_House)
    fail(`Cámara distinta: ${local.fullName}: local ${local.chamber} vs oficial ${member.Roster_House}`);
  if (Number(local.district) !== Number(member.Roster_District))
    fail(`Distrito distinto: ${local.fullName}: local ${local.district} vs oficial ${member.Roster_District}`);
}

for (const local of legislators) {
  if (!officialIds.has(local.id))
    fail(`Legislador local sin coincidencia oficial: ${local.fullName} (id ${local.id})`);
}

/* ------------------------------------------------------------------- distritos */
const localDistricts = await read("districts.json");
const localDistrictByNumber = new Map(localDistricts.map((d) => [d.number, d]));

for (const row of districtRows) {
  const number = Number(row.District);
  const local = localDistrictByNumber.get(number);
  if (!local) {
    fail(`Distrito oficial sin dato local: ${number}`);
    continue;
  }

  const officialCounties = new Set(
    String(row.Counties ?? "")
      .split(",")
      .map(norm)
      .filter(Boolean),
  );
  const localCounties = new Set(local.counties.map(norm));
  for (const county of officialCounties) {
    if (!localCounties.has(county))
      fail(`Distrito ${number}: falta el condado oficial "${county}"`);
  }

  const officialTowns = new Set(
    String(row.Towns ?? "")
      .split(",")
      .map(norm)
      .filter(Boolean),
  );
  const localTowns = new Set(local.towns.map(norm));
  for (const town of officialTowns) {
    if (!localTowns.has(town))
      fail(`Distrito ${number}: falta el municipio oficial "${town}"`);
  }
  for (const town of localTowns) {
    if (!officialTowns.has(town))
      fail(`Distrito ${number}: municipio local que no está en el roster "${town}"`);
  }
}

/* --------------------------------------------------------- proyectos por autor */
console.log(`Consultando proyectos oficiales de ${legislators.length} legisladores…`);
let checkedBills = 0;

const billResults = await mapLimit(legislators, CONCURRENCY, async (legislator) => {
  const url = `${BASE}/api/billSearch/billsBySponsor/${legislator.id}/${SESSION}`;
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) return { legislator, error: `HTTP ${response.status}` };
    const payload = await response.json();
    const rows = payload?.[0] ?? [];
    const primary = rows.filter((row) => row.Type_of_Sponsor === "P").length;
    const localPrimary = legislator.bills.filter(([, type]) => type === "P").length;
    return {
      legislator,
      total: rows.length,
      primary,
      localTotal: legislator.bills.length,
      localPrimary,
    };
  } catch (error) {
    return { legislator, error: error.message };
  }
});

for (const result of billResults) {
  if (result.error) {
    fail(`Proyectos de ${result.legislator.fullName}: ${result.error}`);
    continue;
  }
  checkedBills += 1;
  if (result.total !== result.localTotal)
    fail(
      `Proyectos de ${result.legislator.fullName}: local ${result.localTotal} vs oficial ${result.total}`,
    );
  if (result.primary !== result.localPrimary)
    fail(
      `Patrocinios primarios de ${result.legislator.fullName}: local ${result.localPrimary} vs oficial ${result.primary}`,
    );
}

/* ------------------------------------------------------------------ resultado */
console.log("");
console.log("=== Verificación contra la fuente oficial ===");
console.log(`Legisladores comparados: ${members.length}`);
console.log(`Distritos comparados: ${districtRows.length}`);
console.log(`Legisladores con proyectos consultados: ${checkedBills}`);

if (problems.length) {
  console.log(`\n✗ ${problems.length} discrepancias`);
  for (const problem of problems.slice(0, 60)) console.log(`  · ${problem}`);
  if (problems.length > 60) console.log(`  … y ${problems.length - 60} más`);
} else {
  console.log("\n✓ Todos los datos locales coinciden con la fuente oficial.");
}

if (notes.length) {
  console.log(`\nNotas (${notes.length})`);
  for (const item of notes) console.log(`  · ${item}`);
}

process.exitCode = problems.length ? 1 : 0;
