/**
 * Valida la consistencia interna de los JSON de la app.
 *
 * Uso: npm run validate-data
 *
 * Salida agregada: cada regla rota se reporta una vez, con su conteo y
 * hasta cinco ejemplos, para que el informe sea legible aunque haya miles
 * de registros.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const read = (name) => JSON.parse(readFileSync(path.join(dataDir, name), "utf8"));

const errors = new Map();
const warnings = new Map();

function report(bucket, area, rule, detail) {
  const key = `${area} · ${rule}`;
  const entry = bucket.get(key) ?? { area, rule, count: 0, examples: [] };
  entry.count += 1;
  if (entry.examples.length < 5) entry.examples.push(detail);
  bucket.set(key, entry);
}

const error = (area, rule, detail) => report(errors, area, rule, detail);
const warn = (area, rule, detail) => report(warnings, area, rule, detail);

const legislators = read("legislators.json");
const bills = read("bills.json");
const districts = read("districts.json");
const meta = read("meta.json");
const campaign = read("campaign.json");
const donors = read("donors.json");
const federal = read("federal.json");
const demographics = read("demographics.json");

/* ------------------------------------------------------------- legislators */
const ids = new Set();
const byDistrict = new Map();

for (const l of legislators) {
  if (ids.has(l.id)) error("legislators", "id duplicado", `id ${l.id}`);
  ids.add(l.id);

  if (!l.fullName) error("legislators", "sin nombre", `id ${l.id}`);
  if (!["D", "R", "G", "SW", "I"].includes(l.party))
    error("legislators", "partido no reconocido", `${l.fullName}: ${l.party}`);
  if (!["Senate", "Assembly"].includes(l.chamber))
    error("legislators", "cámara no reconocida", `${l.fullName}: ${l.chamber}`);
  if (!(l.district >= 1 && l.district <= 40))
    error("legislators", "distrito fuera de rango", `${l.fullName}: ${l.district}`);
  if (!l.photo || !/^https?:\/\//.test(l.photo))
    error("legislators", "foto inválida", l.fullName);
  if (!l.email || !l.email.includes("@"))
    error("legislators", "email inválido", `${l.fullName}: ${l.email}`);
  if (!l.officialUrl?.startsWith("https://www.njleg.state.nj.us/legislative-roster/"))
    error("legislators", "URL oficial inválida", `${l.fullName}: ${l.officialUrl}`);
  if (!l.districtInfo) error("legislators", "sin datos de distrito", l.fullName);
  if (!l.committees.length) warn("legislators", "sin comisiones", l.fullName);

  const codes = new Set();
  for (const [code, type] of l.bills) {
    if (codes.has(code))
      error("legislators", "proyecto duplicado", `${l.fullName}: ${code}`);
    codes.add(code);
    if (!["P", "C"].includes(type))
      error("legislators", "tipo de patrocinio inválido", `${l.fullName}: ${code}=${type}`);
    if (!bills[code])
      error("legislators", "proyecto referenciado inexistente", `${l.fullName}: ${code}`);
  }

  const list = byDistrict.get(l.district) ?? [];
  list.push(l);
  byDistrict.set(l.district, list);
}

for (let d = 1; d <= 40; d += 1) {
  const members = byDistrict.get(d) ?? [];
  if (members.length !== 3)
    error("legislators", "distrito sin 3 miembros", `distrito ${d}: ${members.length}`);
  if (members.filter((m) => m.chamber === "Senate").length !== 1)
    error("legislators", "distrito sin 1 senador", `distrito ${d}`);
  if (members.filter((m) => m.chamber === "Assembly").length !== 2)
    error("legislators", "distrito sin 2 asambleístas", `distrito ${d}`);
}

/* ------------------------------------------------------------------- bills */
for (const [code, bill] of Object.entries(bills)) {
  if (bill.bill !== code) error("bills", "clave != bill", `${code} -> ${bill.bill}`);
  if (bill.session !== meta.session) error("bills", "sesión distinta", `${code}: ${bill.session}`);
  if (!bill.synopsis) warn("bills", "sin resumen", code);
  if (!/^[A-Z]+\d+$/.test(code)) error("bills", "código con formato raro", code);
}

/* --------------------------------------------------------------- districts */
const districtNumbers = new Set(districts.map((d) => d.number));
for (let d = 1; d <= 40; d += 1) {
  if (!districtNumbers.has(d)) error("districts", "distrito faltante", String(d));
}

const townOwners = new Map();
for (const d of districts) {
  if (!d.counties.length) error("districts", "sin condados", `distrito ${d.number}`);
  if (!d.towns.length) error("districts", "sin municipios", `distrito ${d.number}`);
  for (const town of d.towns) {
    if (town !== town.replace(/\s+/g, " "))
      warn("districts", "espacios dobles", `distrito ${d.number}: "${town}"`);
    const key = town.toLowerCase().replace(/\s+/g, " ").trim();
    const owners = townOwners.get(key) ?? [];
    owners.push(d.number);
    townOwners.set(key, owners);
  }
}
for (const [town, owners] of townOwners) {
  // Las ciudades grandes (Newark, Jersey City) se reparten entre varios
  // distritos legislativos, así que esto no es un error.
  if (owners.length > 4)
    warn("districts", "municipio en más de 4 distritos", `${town}: ${owners.join(", ")}`);
}

/* ---------------------------------------------------------------- campaign */
const profileKeys = new Set();
const statuses = new Set(["fulfilled", "underway", "failed", "pending"]);
const campaignYears = new Set(campaign.years.map((y) => y.year));
const statusCount = {};

for (const p of campaign.profiles) {
  if (profileKeys.has(p.key)) error("campaign", "perfil duplicado", p.key);
  profileKeys.add(p.key);
  if (!ids.has(p.legislatorId))
    error("campaign", "legislatorId inexistente", `${p.name}: ${p.legislatorId}`);
  if (!campaignYears.has(p.electionYear))
    error("campaign", "año fuera de years", `${p.name}: ${p.electionYear}`);

  const promiseIds = new Set();
  for (const promise of p.promises) {
    if (promiseIds.has(promise.id))
      error("campaign", "promesa duplicada", `${p.name}: ${promise.id}`);
    promiseIds.add(promise.id);
    if (!statuses.has(promise.status))
      error("campaign", "estado inválido", `${p.name}: ${promise.status}`);
    statusCount[promise.status] = (statusCount[promise.status] ?? 0) + 1;
    if (!promise.source?.url) error("campaign", "promesa sin fuente", p.name);
    if (promise.status === "fulfilled" && !promise.evidence.length)
      error("campaign", "cumplida sin evidencia", `${p.name}: ${promise.id}`);
    for (const ev of promise.evidence) {
      if (ev.session === meta.session && !bills[ev.bill])
        error("campaign", "evidencia inexistente en la sesión", `${p.name}: ${ev.bill}`);
      if (ev.session !== meta.session)
        warn("campaign", "evidencia de otra sesión", `${p.name}: ${ev.bill} (${ev.session})`);
    }
  }
}

for (const year of campaign.years) {
  if (year.districts.length !== 40)
    error("campaign", "año sin 40 distritos", `${year.year}: ${year.districts.length}`);
  const numbered = new Set(year.districts.map((d) => d.district));
  for (let d = 1; d <= 40; d += 1) {
    if (!numbered.has(d)) error("campaign", "distrito faltante", `${year.year}: ${d}`);
  }
}

/* ------------------------------------------------------------------ donors */
const donorProfiles = new Set();
for (const p of donors.profiles) {
  if (donorProfiles.has(p.key)) error("donors", "perfil duplicado", p.key);
  donorProfiles.add(p.key);
  if (!ids.has(p.legislatorId))
    error("donors", "legislatorId inexistente", `${p.name}: ${p.legislatorId}`);

  const sum = p.donors.reduce((acc, d) => acc + d.amount, 0);
  const count = p.donors.reduce((acc, d) => acc + d.count, 0);
  if (Math.abs(sum - p.totalAmount) > 0.01)
    error("donors", "totalAmount != suma", `${p.name}: ${p.totalAmount} vs ${sum}`);
  if (count !== p.contributionCount)
    error("donors", "contributionCount != suma", `${p.name}: ${p.contributionCount} vs ${count}`);
  if (p.donorCount !== p.donors.length)
    error("donors", "donorCount != lista", `${p.name}: ${p.donorCount} vs ${p.donors.length}`);

  for (const d of p.donors) {
    const year = Number(d.year);
    if (!(year >= p.electionYear - 2 && year <= p.electionYear + 1))
      error("donors", "año fuera del ciclo electoral", `${p.name}: ${d.name} (${d.year})`);
    if (!Number.isFinite(d.amount))
      error("donors", "monto no numérico", `${p.name}: ${d.name}`);
    if (d.count < 1) error("donors", "count inválido", `${p.name}: ${d.name}`);
    // Los montos negativos son reembolsos oficiales de ELEC y son válidos.
  }
}

/* ----------------------------------------------------------------- federal */
const federalNumbers = new Set(federal.districts.map((d) => d.district));
for (let d = 1; d <= 12; d += 1) {
  if (!federalNumbers.has(d)) error("federal", "distrito faltante", String(d));
}
if (federal.election.districtCount !== federal.districts.length)
  error("federal", "districtCount no coincide", String(federal.election.districtCount));

const candidateCount = federal.districts.reduce((s, d) => s + d.candidates.length, 0);
if (candidateCount !== federal.election.candidateCount)
  error("federal", "candidateCount no coincide", `${federal.election.candidateCount} vs ${candidateCount}`);

const winners = { D: 0, R: 0, O: 0 };
const candidateIds = new Set();
let voteSum = 0;

for (const d of federal.districts) {
  const rows = d.results?.listedCandidates ?? [];
  const residual = d.results?.residualVotes ?? 0;
  const rowVotes = rows.reduce((s, r) => s + r.votes, 0) + residual;
  voteSum += d.results?.totalVotes ?? 0;

  if (d.results?.totalVotes && Math.abs(rowVotes - d.results.totalVotes) > 1)
    error(
      "federal",
      "votos listados + residual != total",
      `distrito ${d.district}: ${rowVotes} vs ${d.results.totalVotes}`,
    );

  for (const row of rows) if (row.winner) winners[row.party] = (winners[row.party] ?? 0) + 1;
  const winnerCount = rows.filter((r) => r.winner).length;
  if (winnerCount !== 1)
    warn("federal", "distrito sin exactamente 1 ganador", `distrito ${d.district}: ${winnerCount}`);

  for (const c of d.candidates) {
    if (candidateIds.has(c.id)) error("federal", "candidato duplicado", c.id);
    candidateIds.add(c.id);
    if (!c.name) error("federal", "candidato sin nombre", `distrito ${d.district}`);

    const finance = c.finance;
    if (!finance) continue;
    const t = finance.totals;
    if (!t) continue;

    if (
      t.individualContributions + t.otherCommitteeContributions + t.partyContributions >
      t.receipts + Math.abs(t.refunds) + 1
    )
      warn("federal", "aportes > recibos", `${c.name} (distrito ${d.district})`);

    const ind = finance.itemizedIndividuals;
    if (ind) {
      const listed = ind.donors.reduce((s, x) => s + x.amount, 0);
      // La lista es un top-100: solo se compara cuando está completa.
      if (ind.donors.length >= ind.donorCount && Math.abs(listed - ind.total) > 1)
        error("federal", "donantes individuales no suman", `${c.name}: ${listed} vs ${ind.total}`);
      if (ind.donors.length < ind.donorCount)
        warn(
          "federal",
          "lista de donantes truncada (top 100)",
          `${c.name}: ${ind.donors.length} de ${ind.donorCount}`,
        );
    }

    const com = finance.committeeDonors;
    if (com) {
      const listed = com.donors.reduce((s, x) => s + x.amount, 0);
      if (com.donors.length >= com.donorCount && Math.abs(listed - com.total) > 1)
        error("federal", "donantes de comités no suman", `${c.name}: ${listed} vs ${com.total}`);
    }
  }
}

for (const party of ["D", "R", "O"]) {
  if ((federal.summary.seats[party] ?? 0) !== (winners[party] ?? 0))
    error(
      "federal",
      `seats.${party} != ganadores`,
      `${federal.summary.seats[party] ?? 0} vs ${winners[party] ?? 0}`,
    );
}

if (Math.abs(voteSum - federal.summary.totalVotes) > 1)
  error("federal", "totalVotes != suma por distrito", `${federal.summary.totalVotes} vs ${voteSum}`);

const partyVoteSum =
  (federal.summary.partyVotes.D ?? 0) +
  (federal.summary.partyVotes.R ?? 0) +
  (federal.summary.partyVotes.O ?? 0) +
  federal.summary.unattributedVotes;
if (Math.abs(partyVoteSum - federal.summary.totalVotes) > 1)
  error("federal", "partyVotes + unattributed != totalVotes", `${partyVoteSum} vs ${federal.summary.totalVotes}`);

/* -------------------------------------------------------------------- meta */
if (meta.legislatorCount !== legislators.length)
  error("meta", "legislatorCount", `${meta.legislatorCount} vs ${legislators.length}`);
if (meta.districtCount !== districts.length)
  error("meta", "districtCount", `${meta.districtCount} vs ${districts.length}`);
if (meta.billCount !== Object.keys(bills).length)
  error("meta", "billCount", `${meta.billCount} vs ${Object.keys(bills).length}`);
const recordsWithBills = legislators.filter((l) => l.bills.length > 0).length;
if (meta.recordsWithBills !== recordsWithBills)
  error("meta", "recordsWithBills", `${meta.recordsWithBills} vs ${recordsWithBills}`);

/* ------------------------------------------------------------ demographics */
if (!demographics?.statewide?.population || demographics.statewide.population <= 0)
  error("demographics", "estado sin población ACS", String(demographics?.statewide?.population));
if (!Array.isArray(demographics?.districts) || demographics.districts.length !== 40)
  error("demographics", "distritos != 40", String(demographics?.districts?.length));
const acsNums = new Set();
for (const entry of demographics.districts ?? []) {
  if (acsNums.has(entry.district))
    error("demographics", "distrito duplicado", String(entry.district));
  acsNums.add(entry.district);
  if (!(entry.population > 0 && entry.medianIncome > 0))
    error("demographics", "métricas ACS inválidas", `D${entry.district}`);
}
for (let d = 1; d <= 40; d += 1) {
  if (!acsNums.has(d)) error("demographics", "distrito ACS faltante", String(d));
}

/* ---------------------------------------------------------------- summary */
const totalPromises = Object.values(statusCount).reduce((a, b) => a + b, 0);
console.log("=== Resumen de datos ===");
console.log(
  `Legisladores: ${legislators.length} | Proyectos: ${Object.keys(bills).length} | ` +
    `Distritos: ${districts.length} | Municipios: ${townOwners.size}`,
);
console.log(
  `Campaña: ${campaign.profiles.length} perfiles | ${totalPromises} promesas ` +
    `(${Object.entries(statusCount).map(([k, v]) => `${k} ${v}`).join(", ")})`,
);
console.log(
  `Donantes: ${donors.profiles.length} perfiles | ` +
    `${donors.profiles.reduce((s, p) => s + p.donors.length, 0)} grupos donante-año`,
);
console.log(
  `Federal: ${federal.districts.length} distritos | ${candidateCount} candidatos | ` +
    `escaños ${JSON.stringify(federal.summary.seats)}`,
);
console.log(
  `Censo ACS: ${demographics.release?.name ?? "ACS"} · ${demographics.districts.length} distritos · población estatal ${demographics.statewide.population.toLocaleString("en-US")}`,
);

function printBucket(title, bucket) {
  const rows = [...bucket.values()];
  const total = rows.reduce((s, r) => s + r.count, 0);
  console.log(`\n${title}: ${total} en ${rows.length} reglas`);
  for (const row of rows.sort((a, b) => b.count - a.count)) {
    console.log(`  ${row.count}× [${row.area}] ${row.rule}`);
    for (const example of row.examples) console.log(`      · ${example}`);
    if (row.count > row.examples.length)
      console.log(`      … y ${row.count - row.examples.length} más`);
  }
}

if (errors.size) printBucket("✗ ERRORES", errors);
else console.log("\n✓ Sin errores de consistencia");

if (warnings.size) printBucket("⚠ AVISOS", warnings);

process.exitCode = errors.size ? 1 : 0;
