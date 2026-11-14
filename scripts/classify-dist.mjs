import fs from "node:fs";
import { classifyTopic, TOPICS } from "./topics-test-bundle.mjs";

const bills = JSON.parse(fs.readFileSync("./src/data/bills.json", "utf8"));
const stats = {};
const samples = {};

for (const [code, bill] of Object.entries(bills)) {
  const slug = classifyTopic(bill.synopsis);
  stats[slug] = (stats[slug] ?? 0) + 1;
  (samples[slug] ??= []).push(`${code}: ${bill.synopsis}`);
}

console.log("total", Object.keys(bills).length);
for (const [slug, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(String(count).padStart(5), slug, "·", ((count / 11475) * 100).toFixed(1) + "%");
}
for (const slug of ["other", "education", "taxes-budget", "health", "environment-energy"]) {
  console.log(`\n### ${slug}`);
  for (const s of (samples[slug] ?? []).slice(0, 12)) console.log(" -", s.slice(0, 190));
}

const defined = new Set(TOPICS.map((t) => t.slug));
const unknown = Object.keys(stats).filter((slug) => !defined.has(slug));
console.log("\nunknown slugs:", unknown);
