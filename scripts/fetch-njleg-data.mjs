/**
 * Descarga los datos públicos del Legislativo de Nueva Jersey desde
 * el sitio oficial (njleg.state.nj.us) y genera los archivos JSON
 * que consume la aplicación.
 *
 * Uso: npm run refresh-data
 * Variables opcionales:
 *   NJ_SESSION=2026   Sesión legislativa a consultar.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.njleg.state.nj.us";
const PUBLIC_FILES = "https://pub.njleg.gov";
// Las legislaturas de NJ duran dos años y comienzan en año par.
const currentYear = new Date().getFullYear();
const defaultSession = currentYear % 2 === 0 ? currentYear : currentYear - 1;
const SESSION = Number(process.env.NJ_SESSION ?? defaultSession);
const CONCURRENCY = 6;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src", "data");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/html;q=0.9,*/*;q=0.8",
};

async function request(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 800));
    return request(url, attempt + 1);
  }
}

async function requestJson(url) {
  const text = await request(url);
  return JSON.parse(text);
}

function extractNextData(html) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error("No se encontró __NEXT_DATA__ en la página");
  return JSON.parse(match[1]);
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, " ");
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Los campos biográficos vienen como un string con JSON adentro. */
function parseBioList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) =>
        cleanText(
          typeof item === "string"
            ? item
            : (item?.item ?? item?.Item ?? item?.value ?? ""),
        ),
      )
      .filter(Boolean);
  } catch {
    return cleanText(raw)
      .split(/\r?\n|•/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
}

function extractId(bioLink) {
  const match = bioLink?.match(/\/legislative-roster\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

function photoUrl(picture) {
  if (!picture) return null;
  if (/^https?:\/\//.test(picture)) return picture;
  return `${PUBLIC_FILES}${picture.startsWith("/") ? "" : "/"}${picture}`;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
      done += 1;
      if (done % 10 === 0 || done === items.length) {
        process.stdout.write(`\r  ${done}/${items.length} legisladores`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  process.stdout.write("\n");
  return results;
}

function normalizeDistrict(district) {
  return {
    number: district.District,
    counties: String(district.Counties ?? "")
      .split(",")
      .map((county) => county.trim())
      .filter(Boolean),
    countiesLabel: cleanText(district.Counties),
    towns: String(district.Towns ?? "")
      .split(",")
      .map((town) => town.trim())
      .filter(Boolean),
    townsLabel: cleanText(district.Towns),
  };
}

async function main() {
  console.log("→ Leyendo el roster oficial…");
  const rosterHtml = await request(`${BASE}/legislative-roster`);
  const nextData = extractNextData(rosterHtml);
  const [members, , districtRows] = nextData.props.pageProps.legrosterData;

  console.log(`  ${members.length} legisladores · ${districtRows.length} distritos`);

  const districts = districtRows.map(normalizeDistrict);
  const districtByNumber = new Map(districts.map((d) => [d.number, d]));

  const bills = {};
  const billRelations = new Map();

  const legislators = await mapLimit(members, CONCURRENCY, async (member) => {
    const id = extractId(member.BioLink);
    if (!id) throw new Error(`Sin id para ${member.Full_Name}`);

    const [bioRaw, billsRaw] = await Promise.all([
      request(`${BASE}/api/legislatorData/legislatorBio/${id}`).then(JSON.parse),
      requestJson(`${BASE}/api/billSearch/billsBySponsor/${id}/${SESSION}`),
    ]);

    const bioMember = bioRaw?.[0]?.[0] ?? {};
    const addresses = Array.isArray(bioRaw?.[1]) ? bioRaw[1] : [];
    const committees = Array.isArray(bioRaw?.[2]) ? bioRaw[2] : [];

    const relations = [];
    for (const row of Array.isArray(billsRaw?.[0]) ? billsRaw[0] : []) {
      const bill = cleanText(row.Bill);
      if (!bill) continue;
      const type = row.Type_of_Sponsor === "P" ? "P" : "C";
      if (!bills[bill]) {
        bills[bill] = {
          bill,
          synopsis: cleanText(row.Synopsis),
          session: SESSION,
        };
      }
      const existing = relations.find((item) => item[0] === bill);
      if (existing) {
        if (type === "P") existing[1] = "P";
      } else {
        relations.push([bill, type]);
      }
    }
    billRelations.set(id, relations);

    const district = districtByNumber.get(member.Roster_District);

    return {
      id,
      fullName: cleanText(bioMember.Full_Name || member.Full_Name),
      sortName: cleanText(
        `${member.Last_Name} ${member.First_Name} ${member.Middle_Name ?? ""}`,
      ),
      firstName: cleanText(member.First_Name),
      lastName: cleanText(member.Last_Name),
      suffix: cleanText(member.Suffix ?? ""),
      party: member.Party,
      partyName: member.PartyDescription,
      chamber: member.Roster_House,
      district: member.Roster_District,
      title: cleanText(bioMember.Legislative_Position || member.LegTitle),
      leadership: cleanText(bioMember.Legislative_Position ?? ""),
      email: cleanText(bioMember.ccMailName ?? ""),
      photo: photoUrl(bioMember.Picture),
      officialUrl: `${BASE}${member.BioLink}`,
      contactUrl: cleanText(member.ContactLink ?? ""),
      education: parseBioList(bioMember.Education),
      occupation: parseBioList(bioMember.Occupation),
      publicService: parseBioList(bioMember.PublicService),
      militaryService: parseBioList(bioMember.MilitaryService),
      legislativeService: parseBioList(bioMember.LegService),
      addresses: addresses.map((address) => ({
        type: cleanText(address.Address_Type),
        street: cleanText(address.Street_Address),
        city: cleanText(address.City),
        state: cleanText(address.State),
        zip: cleanText(address.Zipcode),
        phone: cleanText(address.Phone_Number),
        fax: cleanText(address.Fax_Number),
      })),
      committees: committees.map((committee) => ({
        name: cleanText(committee.Comm_Desc),
        code: cleanText(committee.Comm_Code),
        position: cleanText(committee.Comm_Position ?? ""),
        url: committee.CommitteeLink
          ? `${BASE}${committee.CommitteeLink}`
          : null,
      })),
      districtInfo: district
        ? {
            counties: district.counties,
            countiesLabel: district.countiesLabel,
            towns: district.towns,
            townsLabel: district.townsLabel,
          }
        : null,
      bills: relations,
    };
  });

  // Estadísticas y orden estable
  legislators.sort((a, b) => a.sortName.localeCompare(b.sortName, "en"));
  for (const legislator of legislators) {
    const relations = billRelations.get(legislator.id) ?? [];
    legislator.bills = relations.sort((a, b) =>
      a[0].localeCompare(b[0], "en", { numeric: true }),
    );
  }

  const partyCounts = legislators.reduce((acc, legislator) => {
    acc[legislator.party] = (acc[legislator.party] ?? 0) + 1;
    return acc;
  }, {});

  const chamberCounts = legislators.reduce((acc, legislator) => {
    acc[legislator.chamber] = (acc[legislator.chamber] ?? 0) + 1;
    return acc;
  }, {});

  const meta = {
    generatedAt: new Date().toISOString(),
    session: SESSION,
    sessionLabel: `${SESSION}–${SESSION + 1}`,
    sourceName: "New Jersey Legislature",
    sourceUrl: `${BASE}/legislative-roster`,
    sourceBillsUrl: `${BASE}/bill-search`,
    legislatorCount: legislators.length,
    districtCount: districts.length,
    billCount: Object.keys(bills).length,
    partyCounts,
    chamberCounts,
    recordsWithBills: legislators.filter((item) => item.bills.length > 0).length,
  };

  await mkdir(outDir, { recursive: true });
  await Promise.all([
    // Los archivos grandes se guardan compactos para reducir el peso de la app.
    writeFile(path.join(outDir, "legislators.json"), JSON.stringify(legislators)),
    writeFile(path.join(outDir, "bills.json"), JSON.stringify(bills)),
    writeFile(
      path.join(outDir, "districts.json"),
      JSON.stringify(districts, null, 2),
    ),
    writeFile(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2)),
  ]);

  console.log(
    `✓ Listo: ${legislators.length} legisladores, ${meta.billCount} proyectos, ${districts.length} distritos.`,
  );
  console.log(`  Archivos en ${path.relative(root, outDir)}`);
}

main().catch((error) => {
  console.error("\n✗ Error al actualizar los datos:", error.message);
  process.exitCode = 1;
});
