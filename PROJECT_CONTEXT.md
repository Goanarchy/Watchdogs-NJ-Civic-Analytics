# Project Technical Context — Watchdogs Media · Civic Lab (v2.0.0)

## Runtime & Build Architecture

- **Frontend Stack:** React 19, TypeScript 5 (`strict`), React Router (`HashRouter`), pure CSS (`src/index.css` using custom tokens `--paper`, `--navy`, `--gold`, `--blue`, `--red`, plus `Newsreader`, `Plus Jakarta Sans`, `JetBrains Mono` with `.num` tabular numerals).
- **Dual Distribution Targets:**
  - `npm run build` (`vite.config.ts`) outputs code-split static files into `dist/` for standard web hosting.
  - `npm run build:single` (`vite.config.standalone.ts` with `vite-plugin-singlefile`) produces a single self-contained `index.html` (~11.4 MB) that operates directly over `file:///` with zero backend requirements.
  - Note: Sibling `../Money tracker NJ/index.html` consumes `src/data/federal.json` — keep `federal.json`'s schema backward-compatible.

## Client Analytics Engine (`src/lib/analytics.ts`)

`loadAnalytics()` loads `bills.json` (`loadBills()`) and `donors.json` (`loadDonorsData()`) dynamically alongside bundled `legislators.json`, `districts.json`, `campaign.json`, and `demographics.json`, producing:

- `legislatorMatrix`: All `120` active legislators joined with primary/cosponsor counts & ratio, bipartisan bills & rate, committees, NJ ELEC totals & donor count, verified promise metrics, primary topic focus, and Census district median household income.
- `bipartisanLeaders` & `crossPartyPairs`: Legislators ranked by cross-party collaboration and top `40` Democrat–Republican co-sponsorship dyads.
- `finance`: Statewide ELEC metrics (`$58,416,809.51`, `120/120` members covered, `187` filings, `34,841` donor-year groups), cycle/party/chamber summaries, donor classification buckets, and full searchable cross-legislator donor index (`allDonors`).
- `districtComposites`: All `40` NJ Legislative Districts uniting legislative bills, bipartisan bills, delegation NJ ELEC receipts, and Census ACS metrics.

## Data Pipeline & Integrity Controls

- `scripts/fetch-njleg-data.mjs`: Official NJLeg API ingestion for legislators, committees, bills, and municipalities.
- `scripts/fetch-census-acs.mjs`: Official U.S. Census Bureau ACS 2024 5-Year estimates across 10 tables (`B01003, B01002, B19013, B25077, B25064, B17001, B15003, B23025, B25003, B08301`) for all 40 NJ SLDU districts + statewide baseline.
- `scripts/fetch-elec-entities.mjs`, `fetch-elec-donors.mjs`, `build-donors-data.mjs`: NJ ELEC entity resolution & donor aggregation (100% 120/120 member coverage).
- `scripts/scrape-njspotlight-guides.mjs`, `fetch-campaign-bills.mjs`, `build-campaign-data.mjs`: NJ Spotlight candidate questionnaire extraction (`404` entries) and legislative evidence cross-checking (`184` profiles, `237` promises).
- `scripts/validate-data.mjs`: Verifies schema and referential consistency across all datasets (`0` errors).
- `scripts/check-i18n.mjs`: Verifies `707` EN / `707` ES key parity, placeholder matching, and zero dead translation keys.
