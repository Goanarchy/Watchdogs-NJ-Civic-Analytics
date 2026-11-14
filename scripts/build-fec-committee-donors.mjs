/**
 * Builds committee-to-candidate contribution totals from the FEC pas2 bulk
 * file (contributions to candidates from other committees).
 *
 * Only contributions reported to a matched candidate's principal campaign
 * committee are used, and memo entries are skipped so each transfer is counted
 * once. Donor committees are resolved to their official names in cm.txt.
 *
 * Output: scripts/.cache/fec/federal-committee-donors.json
 *
 * Usage: node scripts/build-fec-committee-donors.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fecDir = path.join(root, "scripts", ".cache", "fec");

const candidates = JSON.parse(await readFile(path.join(fecDir, "federal-candidates.json"), "utf8"));
const committees = (await readFile(path.join(fecDir, "cm26", "cm.txt"), "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.split("|"));
const committeeName = new Map(committees.map((row) => [row[0], row[1]]));

const targets = new Map();
for (const item of candidates.matched) {
  if (item.fec.principalCommitteeId) {
    targets.set(item.fec.principalCommitteeId, item);
  }
}

const byCommittee = new Map();
let scanned = 0;
let kept = 0;

const lines = (await readFile(path.join(fecDir, "pas226", "itpas2.txt"), "utf8")).split(/\r?\n/);
for (const line of lines) {
  if (!line) continue;
  scanned += 1;
  // Fast reject before splitting: the recipient committee ID must appear.
  const recipient = line.split("|", 16)[15];
  const target = targets.get(recipient);
  if (!target) continue;
  const fields = line.split("|");
  if (fields[19] === "X") continue;
  const amount = Number(fields[14]);
  if (!Number.isFinite(amount) || amount <= 0) continue;

  const donorId = fields[0];
  const donorName = committeeName.get(donorId) ?? fields[7] ?? donorId;
  const date = fields[13] ?? "";

  let entry = byCommittee.get(recipient);
  if (!entry) {
    entry = {
      candidateId: target.fec.candidateId,
      guideName: target.guideName,
      district: target.district,
      committeeId: recipient,
      committeeName: target.fec.principalCommitteeName,
      total: 0,
      count: 0,
      donors: new Map(),
    };
    byCommittee.set(recipient, entry);
  }

  entry.total += amount;
  entry.count += 1;
  const donor = entry.donors.get(donorId) ?? {
    committeeId: donorId,
    name: donorName,
    amount: 0,
    count: 0,
    lastDate: "",
  };
  donor.amount += amount;
  donor.count += 1;
  if (date > donor.lastDate) donor.lastDate = date;
  entry.donors.set(donorId, donor);
  kept += 1;
}

const output = [];
for (const entry of byCommittee.values()) {
  const donors = [...entry.donors.values()]
    .filter((donor) => donor.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 60)
    .map((donor) => ({
      ...donor,
      amount: Math.round(donor.amount * 100) / 100,
    }));
  output.push({
    candidateId: entry.candidateId,
    guideName: entry.guideName,
    district: entry.district,
    committeeId: entry.committeeId,
    committeeName: entry.committeeName,
    total: Math.round(entry.total * 100) / 100,
    count: entry.count,
    donorCount: entry.donors.size,
    donors,
  });
}

output.sort((a, b) => a.district - b.district || b.total - a.total);

const outPath = path.join(fecDir, "federal-committee-donors.json");
await mkdir(fecDir, { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: {
        name: "Federal Election Commission · Contributions to candidates from committees (pas2)",
        url: "https://www.fec.gov/files/bulk-downloads/2026/pas226.zip",
        note: "Memo entries and negative amounts (refunds) excluded. Amounts are itemized committee contributions reported to each candidate's principal campaign committee in the 2026 cycle.",
      },
      scanned,
      kept,
      committees: output,
    },
    null,
    1,
  ),
);

console.log(`Scanned ${scanned.toLocaleString()} rows, kept ${kept.toLocaleString()} committee contributions`);
for (const item of output) {
  console.log(
    `D${String(item.district).padStart(2, "0")} ${item.guideName.padEnd(24)} ${item.committeeId} total=${item.total.toFixed(2)} donors=${item.donorCount}`,
  );
}
console.log(`Saved ${path.relative(root, outPath)}`);
