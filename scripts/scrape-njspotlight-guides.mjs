/**
 * Scrapes the NJ Spotlight News 2023 and 2025 election guides into a
 * structured JSON file. The guides are public, nonpartisan candidate Q&As.
 *
 * Usage: node scripts/scrape-njspotlight-guides.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "src", "data", "campaign-raw.json");

const YEARS = [
  {
    year: 2025,
    url: (d) => `https://www.njspotlightnews.org/special-report/2025-election-guide-ld${d}/`,
    overrides: {
      4: "https://www.njspotlightnews.org/special-report/2025-voter-guide-ld4/",
      5: "https://www.njspotlightnews.org/special-report/2025-voter-guide-ld5/",
      6: "https://www.njspotlightnews.org/special-report/2025-voter-guide-ld6/",
      9: "https://www.njspotlightnews.org/special-report/2025-election-gide-ld9/",
      17: "https://www.njspotlightnews.org/special-report/nj-election-guide-ld17/",
      39: "https://www.njspotlightnews.org/special-report/2025-election-guideld38/",
    },
    label: "NJ Spotlight News · NJ Decides 2025 voter guide",
    date: "2025-10",
  },
  {
    year: 2023,
    url: (d) => `https://www.njspotlightnews.org/special-report/nj-elections-legislature-district-${d}-senate-assembly/`,
    overrides: {
      26: "https://www.njspotlightnews.org/special-report/nj-elections-whos-running-in-legislative-district-26/",
      28: "https://www.njspotlightnews.org/special-report/nj-elections-whos-running-in-legislative-district-28/",
      29: "https://www.njspotlightnews.org/special-report/nj-elections-whos-running-in-legislative-district-29/",
    },
    label: "NJ Spotlight News · NJ Decides 2023 voter guide",
    date: "2023-10",
  },
];

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, " ");
}

function clean(value) {
  return decodeEntities(String(value ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    return fetchText(url, attempt + 1);
  }
}

function partyCode(sub) {
  if (/republican/i.test(sub)) return "R";
  if (/democrat/i.test(sub)) return "D";
  return "";
}

function parseDetails(html, district, year) {
  const blocks = [];
  const detailRegex = /<details\b[\s\S]*?<\/details>/gi;
  let match;
  while ((match = detailRegex.exec(html))) {
    const before = html.slice(0, match.index);
    const chamberMatches = [
      ...before.matchAll(/<h[23][^>]*>\s*(SENATE|ASSEMBLY)(?:\s+candidates)?\s*<\/h[23]>/gi),
    ];
    const chamber = chamberMatches.length
      ? chamberMatches[chamberMatches.length - 1][1].toUpperCase()
      : year === 2025
        ? "ASSEMBLY"
        : "";
    const block = match[0];
    const title = block.match(/<div class=['"]title['"]>([\s\S]*?)<\/div>/i);
    const sub = block.match(/<div class=['"]sub['"]>([\s\S]*?)<\/div>/i);
    const name = clean(title?.[1] ?? "");
    if (!name) continue;
    const subText = clean(sub?.[1] ?? "");
    const content = block.slice(block.indexOf("</summary>"));
    const didNotRespond = /did not respond to the questionnaire/i.test(clean(content));
    const answers = {};
    const answerRegex =
      /<p>\s*<b>([\s\S]*?)<\/b>\s*(?:<span[^>]*>([\s\S]*?)<\/span>)?\s*<\/p>/gi;
    let answer;
    while ((answer = answerRegex.exec(content))) {
      const question = clean(answer[1]).replace(/\s*[�•]\s*$/, "").replace(/:$/, "").trim();
      const text = clean(answer[2] ?? "");
      if (question && text) answers[question] = text;
    }
    // Fallback for blocks where the answer is plain text, not wrapped in span.
    if (Object.keys(answers).length === 0 && !didNotRespond) {
      const plain = clean(content);
      if (plain && plain.length > 80) answers.Plain = plain;
    }
    blocks.push({
      district,
      year,
      chamber: chamber === "SENATE" ? "Senate" : "Assembly",
      name,
      sub: subText,
      party: partyCode(subText),
      incumbent: /incumbent/i.test(subText),
      responded: !didNotRespond && Object.keys(answers).length > 0,
      answers,
    });
  }
  return blocks;
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
for (const year of YEARS) {
  for (let district = 1; district <= 40; district++) {
    jobs.push({
      ...year,
      district,
      url: year.overrides?.[district] ?? year.url(district),
    });
  }
}

console.log(`Fetching ${jobs.length} guide pages…`);
let done = 0;
const pages = await mapLimit(jobs, 5, async (job) => {
  try {
    const html = await fetchText(job.url);
    const candidates = parseDetails(html, job.district, job.year);
    const published =
      html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ??
      html.match(/property="article:published_time"\s+content="([^"]+)"/)?.[1] ??
      "";
    done++;
    process.stdout.write(`\r  ${done}/${jobs.length} LD${job.district} ${job.year}`);
    return { ...job, candidates, published: published.slice(0, 10), error: null };
  } catch (error) {
    done++;
    process.stdout.write(`\r  ${done}/${jobs.length} LD${job.district} ${job.year} ERR`);
    return { ...job, candidates: [], published: "", error: error.message };
  }
});
process.stdout.write("\n");

const data = {
  generatedAt: new Date().toISOString(),
  source: "NJ Spotlight News election guides (public candidate Q&As)",
  years: YEARS.map((y) => ({ year: y.year, label: y.label, date: y.date })),
  pages: pages.map((page) => ({
    district: page.district,
    year: page.year,
    url: page.url,
    label: page.label,
    date: page.published || page.date,
    error: page.error,
    candidates: page.candidates,
  })),
};

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(data));

const totalCandidates = data.pages.reduce((sum, page) => sum + page.candidates.length, 0);
const responded = data.pages.reduce(
  (sum, page) => sum + page.candidates.filter((c) => c.responded).length,
  0,
);
const errors = data.pages.filter((p) => p.error).length;
console.log(
  `Saved ${totalCandidates} candidate entries (${responded} with answers) to ${path.relative(root, outPath)}`,
);
if (errors) console.log(`Errors: ${errors} pages`);
