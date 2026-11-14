/**
 * Scrapes the NJ Spotlight News 2026 congressional district election guides.
 *
 * The guides are public, nonpartisan candidate questionnaires. Every answer in
 * the output is the candidate's own published response; nothing is inferred.
 *
 * Usage: node scripts/fetch-federal-guides.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, "scripts", ".cache");
const outPath = path.join(cacheDir, "federal-guides.json");

const URLS = {
  1: "https://www.njspotlightnews.org/special-report/2026-primary-election-profile-1st-congressional-district/",
  2: "https://www.njspotlightnews.org/special-report/2026-primary-election-profile-2nd-congressional-district/",
  3: "https://www.njspotlightnews.org/special-report/2026-primary-3rd-congressional-district/",
  4: "https://www.njspotlightnews.org/special-report/2026-primary-4th-congressional-district/",
  5: "https://www.njspotlightnews.org/special-report/primary-election-profile-5th-congressional-district/",
  6: "https://www.njspotlightnews.org/special-report/2026-primary-6th-congressional-district/",
  7: "https://www.njspotlightnews.org/special-report/2026-primary-7th-congressional-district/",
  8: "https://www.njspotlightnews.org/special-report/2026-primary-8th-congressional-district/",
  9: "https://www.njspotlightnews.org/special-report/2026-primary-9th-congressional-district/",
  10: "https://www.njspotlightnews.org/special-report/2026-primary-10th-congressional-district/",
  11: "https://www.njspotlightnews.org/special-report/2026-primary-11th-congressional-district/",
  12: "https://www.njspotlightnews.org/special-report/2026-primary-12th-congressional-district/",
};

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

function partyCode(value) {
  if (/republican/i.test(value)) return "R";
  if (/democrat/i.test(value)) return "D";
  if (/green/i.test(value)) return "G";
  if (/socialist workers/i.test(value)) return "SW";
  if (/independent/i.test(value)) return "I";
  return "O";
}

function parseAnswers(content) {
  const answers = [];
  const paragraphRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = paragraphRegex.exec(content))) {
    const paragraph = match[1];
    const bold = paragraph.match(/<(?:b|strong)\b[^>]*>([\s\S]*?)<\/(?:b|strong)>/i);
    if (!bold) continue;
    const question = clean(bold[1]).replace(/:\s*$/, "").trim();
    const answer = clean(paragraph.replace(bold[0], ""));
    if (!question || !answer) continue;
    answers.push({ question, answer });
  }
  return answers;
}

function parseDistrictIntro(html) {
  const h1 = html.search(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  if (h1 < 0) return "";
  const rest = html.slice(h1);
  const p = rest.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return p ? clean(p[1]) : "";
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

const pages = await mapLimit(Object.entries(URLS), 4, async ([district, url]) => {
  try {
    const html = await fetchText(url);
    const intro = parseDistrictIntro(html);
    const blocks = [...html.matchAll(/<details\b[\s\S]*?<\/details>/gi)].map((m) => m[0]);
    const candidates = blocks.map((block) => {
      const summary = block.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? "";
      const content = block.match(/<div class=['"]details-content['"]>([\s\S]*?)<\/div>/i)?.[1] ?? "";
      const image = summary.match(/<img\b[^>]*src=['"]([^'"]+)['"]/i)?.[1] ?? "";
      const name = clean(summary.match(/<div class=['"]title['"]>([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const sub = clean(summary.match(/<div class=['"]sub['"]>([\s\S]*?)<\/div>/i)?.[1] ?? "");
      const answers = parseAnswers(content);
      const website = content.match(/<a\b[^>]*href=['"]([^'"]+)['"][^>]*>\s*Find more information/i)?.[1] ?? "";
      const find = (label) =>
        clean(
          content.match(
            new RegExp(
              `<p\\b[^>]*>\\s*<(?:b|strong)\\b[^>]*>\\s*${label}\\s*:?\\s*</(?:b|strong)>([\\s\\S]*?)</p>`,
              "i",
            ),
          )?.[1] ?? "",
        );
      return {
        name,
        party: partyCode(sub),
        partyLabel: sub,
        incumbent: /incumbent/i.test(sub),
        photo: /default-user\.png/i.test(image) ? null : image,
        hometown: find("Hometown"),
        occupation: find("Occupation"),
        age: Number(find("Age")) || null,
        background: find("Personal and/or professional background"),
        website: website || null,
        didNotRespond: /did not (?:answer|respond to) the questionnaire/i.test(clean(content)),
        answers,
      };
    });
    const published =
      html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] ??
      html.match(/property="article:published_time"\s+content="([^"]+)"/)?.[1] ??
      "";
    const modified =
      html.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1] ??
      html.match(/property="article:modified_time"\s+content="([^"]+)"/)?.[1] ??
      "";
    console.log(
      `D${district}: ${candidates.length} candidates, ${candidates.filter((c) => c.answers.length).length} with answers`,
    );
    return {
      district: Number(district),
      url,
      intro,
      published: published.slice(0, 10),
      modified: modified.slice(0, 10),
      error: null,
      candidates,
    };
  } catch (error) {
    console.log(`D${district}: ERROR ${error.message}`);
    return {
      district: Number(district),
      url,
      intro: "",
      published: "",
      modified: "",
      error: error.message,
      candidates: [],
    };
  }
});

await mkdir(cacheDir, { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "NJ Spotlight News · 2026 congressional district election guides",
      pages,
    },
    null,
    1,
  ),
);
console.log(`Saved ${path.relative(root, outPath)}`);
