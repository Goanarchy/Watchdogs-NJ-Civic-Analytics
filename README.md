# Watchdogs Media · Civic Lab — NJ Civic Intelligence & Legislative Analytics (v3.0.0)

[![Live Web App](https://img.shields.io/badge/Live%20Web%20App-Open%20Platform-0F2C59?style=for-the-badge)](https://goanarchy.github.io/Watchdogs-NJ-Civic-Analytics/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Data Coverage](https://img.shields.io/badge/NJ%20ELEC%20Coverage-120%2F120%20Legislators-10B981)](#official-public-data-sources)
[![Census ACS](https://img.shields.io/badge/US%20Census-ACS%202024%205--Year-a9854c)](#official-public-data-sources)

> **Public Live Link (Free Forever on GitHub Pages):** https://goanarchy.github.io/Watchdogs-NJ-Civic-Analytics/

**Watchdogs Media · Civic Lab** (`v3.0.0`) is an independent, bilingual (**EN / ES**) civic intelligence and legislative analytics platform tracking all **120 members of the New Jersey Legislature** (40 Senators + 80 Assembly members), **40 legislative districts**, **11,475 session bills** (**11,504 NJLeg bulk bill stages**), **543 official floor roll calls**, **100% (120/120) NJ ELEC campaign finance filings**, **184 candidate promise accountability profiles**, **12 federal congressional races**, and **U.S. Census Bureau ACS 2024 5-Year socioeconomic benchmarks**.

It compiles into both a standard static bundle (`dist/`) and a single self-contained HTML file (`index.html`) that runs directly via `file:///` with zero backend dependencies.

> Independent informational civic tool. Not affiliated with the State of New Jersey, any government agency, or any political party. Developed by [Goanarchy (@goanarchy1)](https://x.com/goanarchy1).

---

## Key Capabilities (v3.0)

- **10-Lens Super Tools Analytics Workbench (`/super-tools`):**
  - `01 Overview & Matrix`: Session telemetry ribbon, legislative output concentration, partisan balance, and a sortable/searchable 120-legislator matrix joining bills, `% Primary`, bipartisanship, ELEC funding, campaign promises, and top focus topic with CSV export.
  - `02 Policy & Topics Lab`: Featured top policy area, 19-topic cross-party matrix, and standing committee pipeline.
  - `03 Bipartisanship & Alliances`: Cross-party composition breakdown, top bipartisan bridge-builders filterable by chamber, and top 40 Democrat–Republican legislative dyads.
  - `04 Money in Politics`: `$58.4M+` NJ ELEC analysis (`2023 + 2025`), donor category buckets (`PACs & Unions`, `Individuals`, `Corporations & Business`, `Party Committees`, `Other Organizations`), statewide searchable donor index with expandable recipient chips + CSV export, and Top 12 funded legislators.
  - `05 Districts & Census`: New Jersey statewide Census ACS baseline, interactive 6-metric choropleth map (`Bills`, `Median Income`, `Poverty Rate`, `Home Value`, `Transit Commuters`, `ELEC Funding`), and sortable 40-district composite matrix with CSV export.
  - `06 Compare Legislators`: Dual-mode benchmark supporting **1v1 Legislator Comparison** and **District Delegation (1v1v1) Scorecard** (1 Senator + 2 Assemblymembers side-by-side with ACS ribbon, 11 legislative/finance/voting/pocketbook metrics, and direct deep-linking via `?lens=compare&mode=delegation&district=N`).
  - `07 Influence Radar`: Classifies ELEC campaign disclosures across **8 economic sectors**, contrasts individual grassroots vs. institutional shares with chamber benchmark markers, and surfaces standing committee–sector jurisdiction overlap.
  - `08 Effectiveness & Funnel`: Tracks substantive bills across all **5 NJLeg pipeline stages** (`Introduced` → `Committee` → `Reported` → `Floor` → `Enacted`) with stage-to-stage retention badges, interactive committee bottleneck cards, and chamber-normalized Legislative Effectiveness Scores (`LES 0–100`).
  - `09 Correlation Sandbox`: Interactive statistical scatter explorer across **12 civic, finance, voting, effectiveness, and Census variables**, featuring live **Pearson r**, **OLS linear regression trendline (`R²` + slope)**, median split quadrants, and **quadrant focus zoom** (`All | Q1..Q4 | Reset`).
  - `10 Pocketbook & Votes`: Nonpartisan `0–100` cost-of-living index (`Property Taxes`, `Housing & Rent`, `Transit & Roads`) paired directly with **543 official NJLeg floor roll-call votes** (`Yes` / `No` / `Abstain`) and searchable member vote rosters.
- **Zero-Bleed Bilingual Interface (`EN / ES`):** Full English and Spanish localization across `909` synchronized dictionary keys (`scripts/check-i18n.mjs`), including promise statuses, donor buckets, office types, leadership titles, committees, analytics lenses, and printable PDF legislator reports.
- **Shareable 1200×630 Civic Dossier PNG Card & Printable PDF Reports (`/legislador/:id`, `/legislador/:id/reporte`):** Export high-contrast `1200×630` social dossier PNG cards or print/PDF dossiers combining official NJLeg activity, committees, roll-call votes, NJ Spotlight promise checks, and NJ ELEC donor totals.
- **Analytical Command Strip & District Context:** Quick-launch lens strip, 1v1v1 delegation scorecard on District pages (`/district/:id`), and Census ACS comparisons directly on the Home directory, District pages, and Representative Finder.

---

## Official Public Data Sources

| Module | Official Source | Current Verified Snapshot |
| :--- | :--- | :--- |
| **Legislators, Bills, Stages & Roll Calls** | [New Jersey Legislature (`njleg.state.nj.us`)](https://www.njleg.state.nj.us/) | 120 legislators · 11,475 bills (11,504 stages) · 543 floor roll calls · 40 districts · 564 municipalities |
| **Campaign Finance (State)** | [NJ ELEC (`elec.state.nj.us`)](https://www.elec.state.nj.us/) | 120/120 legislators covered (187 filings, 34,841 donor-year groups, `$58,416,809.51`) |
| **Socioeconomic Benchmarks** | U.S. Census Bureau (`ACS 2024 5-year` via Census Reporter) | 40 State Legislative Districts (SLDU) + NJ statewide baseline (`9,343,809` pop · `$103,556` median income) |
| **Campaign Promises & Voter Guides** | [NJ Spotlight News](https://www.njspotlightnews.org/) + NJLeg cross-check | 404 candidate entries · 184 profiles · 237 promises (`8` fulfilled, `117` underway, `112` pending) |
| **2026 Federal Midterms** | [FEC](https://www.fec.gov/) · AP / *NYT* | 12 Congressional Districts · 35 candidates · itemized donor records |
| **District Map Geometry** | U.S. Census Bureau · TIGERweb | Official 40 NJ legislative district boundaries |

---

## Quick Start

### Option A: Public Live Web App (Shareable Link)
Open **https://goanarchy.github.io/Watchdogs-NJ-Civic-Analytics/** directly in any desktop or mobile browser. Hosted free forever on GitHub Pages with code-split bundle caching (`dist/` + `.nojekyll`).

### Option B: Standalone Single-File HTML (Offline / Double-Click)
Double-click **`index.html`** in the project root. Everything (all 120 legislator dossiers, 11,475 bills, ELEC donor indexes, Census ACS benchmarks, and SVG district map) runs offline in Chrome, Edge, Firefox, or Safari via `HashRouter`.

### Option C: Developer Mode (Vite 7)

```bash
npm install
npm start        # Starts Vite dev server on dev.html
```

### Build Production Deliverables

```bash
npm run build        # Multi-file static hosting output in dist/
npm run build:single # Standalone self-contained index.html (~11.4 MB)
npm run build:all    # Builds both dist/ and standalone index.html
```

---

## Data Refresh, Integrity Guard & Deployment Pipeline

```bash
npm run safe-update       # Atomic snapshot backup -> refresh NJLeg/Census/Campaign -> validate invariants & i18n -> rollback on error -> rebuild dist/ + index.html
npm run verify-integrity  # Verify existing datasets + hard invariants + 909 EN/ES i18n parity + rebuild dist/ + index.html
npm run test:v3           # Run 45 analytical, OLS, bulk roll-call & pocketbook unit/integration assertions
npm run refresh-bulk      # Refresh NJLeg bulk bill-stages & roll-call vote datasets
npm run publish-web       # Validate data & i18n -> build code-split dist/ -> deploy verified bundle to gh-pages branch
npm run refresh-data      # Fetch latest NJLeg roster, bios, committees & bills
npm run refresh-census    # Fetch latest Census Bureau ACS 5-Year 40-district data
npm run validate-data     # Validate integrity across all JSON datasets
node scripts/check-i18n.mjs # Verify 100% EN/ES key & variable parity
npm run verify-official   # Compare local roster/bill counts against live NJLeg API
```

For donor & campaign promise refreshes:

```bash
node scripts/scrape-njspotlight-guides.mjs
node scripts/fetch-campaign-bills.mjs
node scripts/build-campaign-data.mjs
node scripts/fetch-elec-entities.mjs
node scripts/fetch-elec-donors.mjs
node scripts/build-donors-data.mjs
```

---

## Project Architecture

```text
NJ Civic App/
├── .github/workflows/          # Weekly automated safe refresh & GitHub Pages deployment
├── dev.html                    # Vite HTML entry (loads Newsreader, Plus Jakarta Sans, JetBrains Mono)
├── index.html                  # Generated self-contained standalone HTML deliverable
├── public/                     # Custom Watchdogs Media shield crest & favicon SVGs
├── scripts/                    # safe-update.mjs, publish-web.mjs, Census/ELEC/NJLeg scrapers & validators
├── src/
│   ├── components/             # SiteHeader, SiteFooter, LegislatorCard, DistrictMap, DossierCardGenerator, lenses/
│   ├── data/                   # Verified JSON datasets (legislators, bills, bill-stages, votes, donors, campaign, demographics, federal)
│   ├── lib/                    # analytics.ts, sectors.ts, effectiveness.ts, sandbox.ts, pocketbook.ts, i18n.tsx (909 EN/ES keys), csv.ts, labels.ts
│   └── pages/                  # HomePage, DashboardPage (10-lens workbench), LegislatorPage, DistrictPage, ReportPage, VoteTrackerPage, FederalPage
├── AUDIT_AND_ROADMAP.md        # Full v2.0 platform audit & v2.1–v3.0 technical/data roadmap
├── NEXT_VERSION_ROADMAP.md     # Prioritized feature & data roadmap
├── PROJECT_CONTEXT.md          # Architectural reference & schema notes
├── RELEASE_NOTES.md            # v2.0.0 changelog
└── LICENSE                     # MIT License · Goanarchy
```

---

## License & Developer

Released under the [MIT License](./LICENSE).  
Developed by **Goanarchy** — [@goanarchy1 on X](https://x.com/goanarchy1).
