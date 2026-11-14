/**
 * Parses the AP results published on the New York Times 2026 New Jersey
 * congressional district pages. The NYT pages are used as a consistent,
 * current mirror of AP's county-by-county results.
 *
 * Usage: node scripts/fetch-federal-results.mjs
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "scripts", ".cache");
const htmlDir = path.join(cacheDir, "nyt");
const outPath = path.join(cacheDir, "federal-results.json");

const BASE =
  "https://www.nytimes.com/interactive/2026/11/03/us/elections/results-new-jersey-us-house-";

function clean(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function getHtml(district) {
  const cached = path.join(htmlDir, `d${district}.html`);
  if (await exists(cached)) return readFile(cached, "utf8");
  const legacy = path.join(root, `.tmp-nyt-d${district}.html`);
  if (await exists(legacy)) return readFile(legacy, "utf8");
  const res = await fetch(`${BASE}${district}.html`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`D${district}: HTTP ${res.status}`);
  const html = await res.text();
  await mkdir(htmlDir, { recursive: true });
  await writeFile(cached, html);
  return html;
}

const districts = [];
for (let district = 1; district <= 12; district++) {
  const html = await getHtml(district);
  const rows = [...html.matchAll(/<tr id="candidate-results-row-([^"]*)"[\s\S]*?<\/tr>/g)];
  const seen = new Set();
  const candidates = [];
  for (const match of rows) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const row = match[0];
    const name = clean(row.match(/class="full-name[^"]*">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const party = clean(row.match(/class="eln-if7ia7 full">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const numbers = [...row.matchAll(/class="eln-17i7zw9">([\d,.]+)<\/span>/g)].map((m) =>
      m[1].replace(/,/g, ""),
    );
    if (!name || !party || !numbers.length) continue;
    candidates.push({
      id,
      name,
      party,
      votes: Number(numbers[0]),
      pct: numbers[1] ? Number(numbers[1]) : null,
      winner: /<title>Winner<\/title>/.test(row),
      incumbent: /is-incumbent|>\s*incumbent\s*</.test(row),
    });
  }

  const totalBlock = html.match(
    /totals-row-votes[\s\S]{0,1600}?(\d{1,3}(?:,\d{3})+)/
  );
  const total = totalBlock ? Number(totalBlock[1].replace(/,/g, "")) : null;
  const reporting = html.match(/est-pct-bar[\s\S]{0,500}?width:\s*([\d.]+)%/);
  const reportingLabel = html.match(/([\d.]+% of votes in)/);
  const updated = html.match(/datetime="([^"]+)"/);
  const headline = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");

  districts.push({
    district,
    headline,
    total,
    reportingPct: reporting ? Number(reporting[1]) : null,
    reportingLabel: reportingLabel ? clean(reportingLabel[1]) : null,
    updatedAt: updated ? updated[1] : null,
    candidates,
  });
  console.log(
    `D${district}: ${candidates.length} candidates, ${candidates
      .map((c) => `${c.name} ${c.votes}`)
      .join(" | ")} | total ${total} | ${reporting?.[1] ?? "?"}%`,
  );
}

await mkdir(cacheDir, { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: {
        name: "Associated Press results published by The New York Times",
        url: "https://www.nytimes.com/interactive/2026/11/03/us/elections/results-new-jersey.html",
        note: "Preliminary AP results retrieved from each New Jersey congressional district page. Totals may include candidates not listed individually in the table.",
      },
      districts,
    },
    null,
    1,
  ),
);
console.log(`Saved ${path.relative(root, outPath)}`);
