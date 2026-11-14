"""
Aggregates itemized individual contributions to the principal campaign
committees of the 2026 New Jersey congressional candidates.

Source: FEC bulk file indiv26.zip (contributions from individuals, itcont.txt),
streamed directly from the archive so the 6.8 GB text file is never expanded to
disk.

Only records reported by the candidate committee itself (CMTE_ID = committee)
are used. Contributions that arrive through an intermediary such as ActBlue are
reported twice: once by the intermediary and once by the campaign as an
earmarked transaction (type 15E). Counting the campaign's own record captures
the donor's name and avoids counting the same money twice.

Memo entries (MEMO_CD = X) are skipped, and records dated after the committee's
most recent FEC report are ignored so the itemized list stays inside the
reporting period shown in the totals.

Output: scripts/.cache/fec/federal-individual-donors.json

Usage: python scripts/extract-fec-individual-donors.py
"""
import io
import json
import os
import re
import time
import zipfile
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEC_DIR = os.path.join(ROOT, "scripts", ".cache", "fec")
ZIP_PATH = os.path.join(FEC_DIR, "indiv26.zip")
CANDIDATES_PATH = os.path.join(FEC_DIR, "federal-candidates.json")
OUT_PATH = os.path.join(FEC_DIR, "federal-individual-donors.json")

with open(CANDIDATES_PATH, encoding="utf-8") as handle:
    candidates = json.load(handle)


def report_cutoff(value):
    """MM/DD/YYYY -> YYYYMMDD, the sortable form used for itcont dates."""
    match = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", value or "")
    return f"{match.group(3)}{match.group(1)}{match.group(2)}" if match else None


by_committee = {}
for item in candidates["matched"]:
    committee = item["fec"]["principalCommitteeId"]
    if not committee:
        continue
    by_committee[committee] = {
        "committeeId": committee,
        "candidateId": item["fec"]["candidateId"],
        "guideName": item["guideName"],
        "district": item["district"],
        "cutoff": report_cutoff(item["fec"]["coverageEnd"]),
        "reportedIndividualTotal": (item["fec"]["totals"] or {}).get("individualContributions"),
    }

print(f"Target committees: {len(by_committee)}")

NAME_SUFFIXES = re.compile(r"\s+(MR|MRS|MS|DR|PHD|ESQ)\.?$")


def name_key(value):
    text = re.sub(r"[^A-Z0-9 ,.'-]", "", value.upper())
    text = re.sub(r"\s+", " ", text).strip()
    return NAME_SUFFIXES.sub("", text)


def zip5(value):
    return re.sub(r"[^0-9]", "", value or "")[:5]


aggregates = {committee: {} for committee in by_committee}
stats = defaultdict(lambda: {"kept": 0, "memo": 0, "entity": 0, "late": 0})
entity_types = defaultdict(int)
transaction_types = defaultdict(int)

started = time.time()
lines = 0
last_report = 0

with zipfile.ZipFile(ZIP_PATH) as archive:
    with archive.open("itcont.txt") as raw:
        text = io.TextIOWrapper(raw, encoding="latin-1", errors="replace", newline="")
        for line in text:
            lines += 1
            if lines - last_report >= 4_000_000:
                elapsed = time.time() - started
                print(f"  {lines:,} lines · {elapsed:,.0f}s", flush=True)
                last_report = lines
            if "|" not in line:
                continue
            fields = line.rstrip("\n").split("|")
            if len(fields) < 19:
                continue
            committee = fields[0]
            if committee not in by_committee:
                continue
            if fields[18] == "X":
                stats[committee]["memo"] += 1
                continue
            entity = fields[6]
            entity_types[entity] += 1
            if entity != "IND":
                stats[committee]["entity"] += 1
                continue
            try:
                amount = float(fields[14])
            except ValueError:
                continue
            if amount == 0:
                continue

            raw_date = fields[13].strip()
            date = raw_date[4:8] + raw_date[0:4] if len(raw_date) == 8 else raw_date
            cutoff = by_committee[committee]["cutoff"]
            if cutoff and date > cutoff:
                stats[committee]["late"] += 1
                continue

            transaction_types[fields[5]] += 1
            name = fields[7].strip()
            zip_code = zip5(fields[10])
            key = (name_key(name), zip_code)
            entry = aggregates[committee].get(key)
            if entry is None:
                entry = {
                    "name": name,
                    "city": fields[8].strip(),
                    "state": fields[9].strip(),
                    "zip": zip_code,
                    "employer": fields[11].strip(),
                    "occupation": fields[12].strip(),
                    "amount": 0.0,
                    "count": 0,
                    "lastDate": "",
                }
                aggregates[committee][key] = entry
            entry["amount"] += amount
            if amount > 0:
                entry["count"] += 1
            if date > entry["lastDate"]:
                entry["lastDate"] = date
            stats[committee]["kept"] += 1

print(f"Pass complete in {time.time() - started:,.0f}s · {lines:,} lines")

output = []
for committee, meta in by_committee.items():
    entries = [value for value in aggregates[committee].values() if value["amount"] > 0]
    entries.sort(key=lambda value: value["amount"], reverse=True)
    donors = [
        {
            "name": entry["name"],
            "city": entry["city"],
            "state": entry["state"],
            "zip": entry["zip"],
            "employer": entry["employer"] or None,
            "occupation": entry["occupation"] or None,
            "amount": round(entry["amount"], 2),
            "count": entry["count"],
            "lastDate": entry["lastDate"] or None,
        }
        for entry in entries[:100]
    ]
    itemized_total = round(sum(value["amount"] for value in aggregates[committee].values()), 2)
    output.append(
        {
            "committeeId": committee,
            "candidateId": meta["candidateId"],
            "guideName": meta["guideName"],
            "district": meta["district"],
            "itemizedTotal": itemized_total,
            "reportedIndividualTotal": meta["reportedIndividualTotal"],
            "donorCount": len(entries),
            "transactionCount": stats[committee]["kept"],
            "skipped": {
                "memo": stats[committee]["memo"],
                "nonIndividual": stats[committee]["entity"],
                "afterReport": stats[committee]["late"],
            },
            "donors": donors,
        }
    )

output.sort(key=lambda item: (item["district"], -item["itemizedTotal"]))

with open(OUT_PATH, "w", encoding="utf-8") as handle:
    json.dump(
        {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": {
                "name": "Federal Election Commission · Contributions from individuals (indiv26)",
                "url": "https://www.fec.gov/files/bulk-downloads/2026/indiv26.zip",
                "note": "Itemized individual contributions reported by each candidate committee through its most recent 2026 report. Donations under $200 are reported to the FEC as unitemized totals and are not listed here. Earmarked donations processed by conduits appear once, as reported by the campaign.",
            },
            "linesScanned": lines,
            "entityTypes": dict(sorted(entity_types.items(), key=lambda item: -item[1])),
            "transactionTypes": dict(sorted(transaction_types.items(), key=lambda item: -item[1])),
            "committees": output,
        },
        handle,
        indent=1,
    )

print(f"Saved {os.path.relpath(OUT_PATH, ROOT)}")
for item in output:
    reported = item["reportedIndividualTotal"] or 0
    flag = "OK" if item["itemizedTotal"] <= reported + 0.01 else "CHECK"
    print(
        f"D{item['district']:02d} {item['guideName']:<24} itemized={item['itemizedTotal']:>13,.2f} "
        f"reported={reported:>13,.2f} {flag} donors={item['donorCount']:>5} tx={item['transactionCount']:>6}"
    )
