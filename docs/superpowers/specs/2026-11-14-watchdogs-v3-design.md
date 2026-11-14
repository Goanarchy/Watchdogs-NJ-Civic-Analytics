# Design Specification: Watchdogs Media · Civic Lab (v3.0) — Gold Standard Civic Intelligence & Analytics Suite

- **Date:** 2026-11-14
- **Author:** Antigravity Engineering & User
- **Status:** Finalized for User Approval (Post-Architect Review)
- **Repository:** `NJ Civic App`

---

## 1. Intent & Purpose

Transform **Watchdogs Media · Civic Lab** into the undisputed premier civic intelligence and legislative analytics platform at the state level.

Building upon the robust foundation of v2.0 (120 state legislators, 11,475 bills, 100% NJ ELEC donor records ($58.4M+), 184 campaign promises, Census ACS 2024 benchmarks, 12 federal races, full EN/ES localization, and dark/light themes), **v3.0** evolves the platform into a **visual-first, graphical, comparison-driven analytical suite**. Every dataset will be presented through interactive SVG charts, direct chamber/statewide benchmarks, legislator portraits, and visual cards — maximizing insight clarity while maintaining strict, verifiable nonpartisan objectivity.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **Expand Super Tools into a Symmetrical `01–10` Command Center:**
   - Existing `01–06` lenses remain preserved and enhanced.
   - **07 | Influence & Interest Radar (`influence`):** Sector-level campaign finance mapping (Real Estate, Healthcare, Energy, Labor, Finance, Legal, etc.) cross-referenced with sponsored bill topics and committee seats, visualized via sector distribution charts, alignment matrices, and a *Grassroots vs. PAC/Corporate Reliance Index*.
   - **08 | Legislative Pipeline & Effectiveness (`effectiveness`):** Graphical funnel visualization of all session bills (`Introduced → Committee Referred → Committee Reported → Floor Vote → Enacted`) sourced directly from NJ Legislature bulk archives (`DB2026_TEXT.zip`), highlighting committee bottlenecks and computing an objective *Legislative Effectiveness Score (LES)* with portrait leaderboards.
   - **09 | Civic Correlation Sandbox (`sandbox`):** Free-form interactive 2D scatter studio allowing users to correlate any X-axis variable against any Y-axis variable across financial, legislative, voting, and Census ACS dimensions, featuring dynamic quadrant labels, Pearson correlation $r$, lawmaker portrait pins/tooltips, and ranked comparison tables.
   - **10 | Pocketbook Impact & Roll-Call Votes (`pocketbook`):** Objective citizen cost-of-living hub tracking **Property Taxes**, **Housing & Rent**, and **Public Transit & Infrastructure**. Displays a `0–100` objective Activity & Advancement Index alongside actual official floor roll-call votes (`Yes / No / Abstain / Not Voting`) sourced from `pub.njleg.state.nj.us/votes/`.
2. **Visual-First, Charted & Portrait-Rich Presentation:**
   - Every analytical view prioritizes charts, visual progress meters, side-by-side comparison bars against statewide/chamber averages, and high-resolution legislator portraits alongside stats.
3. **Viral Social & Press Dossier Cards (`DossierCardGenerator`):**
   - One-click shareable visual snapshot card generator integrated into `LegislatorPage.tsx` and `ReportPage.tsx`, featuring photo, district, party, LES score, top donor sector, Pocketbook index, and key votes, with client-side PNG/SVG export and formatted share text.
4. **Preserve Architectural & UX Excellence:**
   - Zero horizontal scrollbars (`overflow-x: hidden`), crisp responsive mobile-first layouts (`375px–412px` up to desktop), flawless dark/light mode contrast, 100% bilingual parity (`EN / ES`), dynamic live-sync telemetry, and standalone static/offline compatibility.

### Non-Goals
- Server-side backend, dynamic user database, or paid external APIs.
- Editorial policy grading (`A–F` letter grades) or subjective ideological scoring.

### Anti-Goals
- Partisan bias, derogatory labels (e.g., "backbenchers"), or ungrounded claims. Every index, archetype, and chart is mathematically transparent, derived strictly from official public archives (NJLeg bulk databases & vote zips, NJ ELEC, US Census Bureau, NJ Spotlight News).

---

## 3. Constraints

- **Technology Stack:** React 19, TypeScript 5, Vite 7, Tailwind CSS, Lucide React icons, React Router (`HashRouter`).
- **Bulk Data Ingestion:** Extend `scripts/` to parse NJ Legislature official bulk archives (`DB2026_TEXT.zip` for full bill statuses/committees/stages and `pub.njleg.state.nj.us/votes/` `A2026.zip`/`S2026.zip` for roll-call floor votes) so `npm run refresh-data` remains fast, clean, and never triggers rate limits.
- **Verification:** Must pass `node scripts/check-i18n.mjs`, `npm run verify-integrity`, `npm run build`, and visual device audits across mobile and desktop viewports in dark and light modes.

---

## 4. Approaches Considered & Selected

- **Approach 1 ("The Civic Bloomberg"):** Super Tools 07–09 expansion only. Strong for analysts, misses citizen pocketbook focus and shareable social cards.
- **Approach 2 ("Ethics & Contracts Scanner"):** Parsing scanned NJ state ethics PDFs and treasury contracts. Brittle due to unstructured source documents and update lag.
- **Approach 3 ("The Total Dominance Suite" — Selected):** Combines Lenses 07–09, the objective Pocketbook Impact + Roll-Call module (Lens 10 + profile integration), visual-first charts/portraits across all data, and viral Dossier Cards backed by official NJLeg bulk data.

---

## 5. Architectural & Implementation Specifications

### A. Official Bulk Data Ingestion (`scripts/`)
1. **`scripts/fetch-njleg-bulk.mjs`:**
   - Downloads and extracts `DB2026_TEXT.zip` (and `2024data` if multi-session needed) from `pub.njleg.state.nj.us/leg-databases/` to enrich `bills.json` (or generate `bill-stages.json` / `committees-pipeline.json`) with exact bill status, assigned committee code, last action date, and enactment/chapter status across all ~11,475 bills.
   - Downloads and parses official roll-call floor vote archives (`A2026.zip`, `S2026.zip`) from `pub.njleg.state.nj.us/votes/` into a compact structured dataset (`src/data/votes.json`) mapping key floor votes to legislator IDs (`Y`, `N`, `A`, `NV`) and calculating attendance/participation and party-unity metrics.
2. **Data Size & Bundle Hygiene:**
   - Keep `votes.json` and bill stage summaries compact (key-indexed arrays/codes) so the single-file offline `index.html` and GitHub Pages chunks remain fast.

### B. Analytical Engine (`src/lib/analytics.ts` & modular helpers)
1. **Sector Classification (`src/lib/sectors.ts`):**
   - Maps all 34,841 ELEC donor entries into 8 transparent economic sectors (`Real Estate & Construction`, `Healthcare & Pharma`, `Energy & Utilities`, `Finance & Insurance`, `Labor & Public Unions`, `Legal & Lobbying`, `Tech & Telecom`, `Civic & Individual Grassroots`).
   - Calculates per-legislator sector distribution, Grassroots vs. Institutional Reliance %, and flags objective **Committee-Donor Sector Alignment** (when top donor sector overlaps with standing committee jurisdiction).
2. **Legislative Pipeline & Effectiveness Score (LES):**
   - Distinguishes *Substantive Bills* (S/A numbered statutes) from *Commemorative/Ceremonial Resolutions* (SR/AR/SCR/ACR/SJR/AJR).
   - Computes committee advancement conversion rates (Pipeline Funnel) and ranks committee bottlenecks.
   - Computes `0–100` objective **LES** combining: Substantive Primary Bills Introduced, Committee Reports Achieved, Enacted Bills, and Floor Vote Participation.
   - **Builder Decision (Neutral Archetypes):** Classifies legislators strictly by mathematical thresholds into neutral tiers:
     - *High-Throughput Sponsor* (Top quartile LES + substantive advancement)
     - *Policy Specialist* (≥50% of primary bills concentrated within 1–2 policy topics matching committee seats)
     - *Coalition Builder* (High cross-party co-sponsorship & bipartisan activity)
     - *Freshman / Developing* (Early-stage or lower cumulative bill throughput)
3. **Civic Correlation Sandbox Registry:**
   - Exposes 12 quantitative dimensions (`totalBills`, `primaryPct`, `bipartisanPct`, `totalRaised`, `grassrootsPct`, `lesScore`, `voteAttendancePct`, `partyUnityPct`, `promisesEvidencePct`, `pocketbookIndex`, `districtIncome`, `districtPoverty`).
   - Supports dynamic X vs. Y plotting, median-split 4-quadrant classification, and Pearson correlation $r$.
4. **Pocketbook Impact & Roll-Call Index (Option 1 — Objective & Verifiable):**
   - Filters legislation across **Property Taxes**, **Housing & Rent**, and **Public Transit & Infrastructure**.
   - Computes an objective `0–100` **Pocketbook Activity & Advancement Index** per legislator (weighted by primary sponsorship, bill advancement/enactment in those 3 sectors, and participation in key pocketbook floor votes), paired with their **actual verified `Yes / No / Abstain` floor votes** on top cost-of-living bills — zero subjective editorial grading.

### C. Visual-First UI & Graphical Presentation (`src/pages/` & `src/components/`)
1. **Rich SVG Visualizations & Comparison Benchmarks:**
   - Replace dense text-only blocks with visual SVGs: multi-stage horizontal/vertical Funnel bars, stacked sector bar/donut rings, interactive 2D X/Y scatter plots with zoom/hover legislator portrait cards, attendance/unity gauge meters, and side-by-side "vs. Chamber Average" comparison bars on every profile and lens.
   - Display legislator portraits (`Portrait` component with `PartyBadge`) prominently in all leaderboards, top-donor lists, sandbox tooltips, and pocketbook highlights.
2. **Symmetrical `01–10` Super Tools Bar (`src/pages/DashboardPage.tsx` & `HomePage.tsx`):**
   - `01 Overview & Matrix` | `02 Policy & Topics Lab` | `03 Bipartisanship` | `04 Money in Politics` | `05 Districts & Census` | `06 Compare` | `07 Influence Radar` | `08 Effectiveness & Funnel` | `09 Correlation Sandbox` | `10 Pocketbook & Votes`.
   - Responsive wrap/grid layout guaranteeing zero horizontal scrollbars on mobile and desktop.
3. **Profile Integration (`src/pages/LegislatorPage.tsx`):**
   - Add visual comparison gauges ("Compared to NJ Senate/Assembly Average"), Donor Sector breakdown chart, Pocketbook Activity & Key Roll-Call Votes table, and the embedded **Dossier Card Generator**.
4. **Viral Dossier Card Generator (`src/components/DossierCardGenerator.tsx`):**
   - Renders a high-contrast branded SVG/Canvas accountability card featuring the legislator's portrait, party badge, district, LES score, Grassroots %, Top Donor Sector, Pocketbook Index, and Watchdogs branding.
   - Provides 1-click **"Download PNG Card"** and **"Copy Verified Summary"** buttons (rendered cleanly in both dark and light themes).

---

## 6. Architectural Decisions Made (For Stakeholder Review)

1. **Official NJLeg Bulk Feeds over Live REST Scraping:** We use `DB2026_TEXT.zip` and `pub.njleg.state.nj.us/votes/` (`A2026.zip` / `S2026.zip`) so all 11,475 bill statuses and actual floor roll-call votes load offline/statically with 0 rate-limit risk.
2. **Symmetrical `01–10` Super Tools Grid:** Pocketbook Impact becomes Lens `10` alongside Lenses `07–09` in Super Tools (keeping Home & Header navigation clean and uncluttered) and is also embedded inside every Legislator profile.
3. **Neutral Quantitative LES Tiers:** Replaced informal/pejorative labels with transparent data-driven archetypes (*High-Throughput Sponsor*, *Policy Specialist*, *Coalition Builder*, *Developing*).
4. **Canvas/SVG Image Export for Viral Cards:** Built natively using browser SVG-to-Canvas rasterization (zero external bloat/dependencies, guaranteed crisp output offline and online).
5. **100% Bilingual Dictionary Sync:** All new chart titles, sector names, funnel stage labels, roll-call statuses, and Pocketbook metrics will be authored simultaneously in English and Spanish inside `src/lib/i18n.tsx`.
