# Watchdogs Media · Civic Lab — Audit & Future Roadmap

This document records the comprehensive v2.0 platform audit (data completeness, language purity, visual/typographic redesign, and analytical depth) alongside the concrete technical & data roadmap for `v2.1` and `v3.0`.

---

## Part I — v2.0 Platform Audit (Completed)

### 1. Data Completeness & Integrity Repairs
| Area | Pre-v2.0 Gap Found | v2.0 Resolution | Verified Outcome |
| :--- | :--- | :--- | :--- |
| **NJ Spotlight Voter Guides** | `2025 LD4` redirected to `LD40`; strict heading regex missed special Senate race (`LD35`). | Added explicit `2025 LD4` URL override and generalized chamber heading matching (`scripts/scrape-njspotlight-guides.mjs`). | `404` candidate entries (`173` answered), `0` errors. |
| **Campaign Promise Matching** | Surname parsing & spelling edge cases dropped 6 legislator links (`Hutchison`, `Amato`, `McCoy`, cross-chamber `Wimberly`). | Added pre-split name normalization, alias map, and same-district cross-chamber fallback (`fetch-campaign-bills.mjs`, `build-campaign-data.mjs`). | `184` profiles, `237` promises (`8` fulfilled, `117` underway, `112` pending). |
| **NJ ELEC Donor Coverage** | Incomplete cross-chamber special election and nickname mapping left missing legislator donor profiles. | Added `Senate` 2025 special election entity lookup, nickname expansion, and same-district cross-chamber matching (`fetch-elec-entities.mjs`). | **120 / 120** legislators covered (`187` profiles, `45,467` records, `34,841` donor-year groups, `$58,416,809.51`). |
| **Standing Committees (`0` committees)** | Minority/Majority Floor Leaders (`John DiMaio`, `Louis D. Greenwald`) looked empty without explanation. | Added bilingual explanatory note (`profile.leaderNoCommittees`) clarifying NJ Legislature Floor Leader rules. | Accurate governance context on profiles. |
| **Public Socioeconomic Data** | App lacked official socioeconomic indicators to benchmark legislative districts. | Added `scripts/fetch-census-acs.mjs` querying 10 Census ACS tables (`B01003`–`B08301`) via Census Reporter (`ACS 2024 5-year`). | `40` districts + statewide NJ baseline (`9,343,809` pop, `$103,556` median income) live in UI & workbench. |

### 2. Language Parity & Anti-Bleed Audit
- Eliminated English-only promise status pills in Spanish mode (`src/lib/promiseStatus.ts`) and removed stale English-only notices in `VoteTrackerPage.tsx` and `ReportPage.tsx`.
- Fixed 5 Spanish strings leaked into `en` and 1 English title leaked into `es` (`src/lib/i18n.tsx`), plus localized office address types, source names, candidate parties, promise questions, and bill actions (`src/lib/labels.ts`).
- Removed 60 obsolete unused translation keys and verified `707` EN / `707` ES parity with `node scripts/check-i18n.mjs` (`0` errors, `0` warnings) and `0` unexpected Spanish diacritics in `en`.

### 3. Visual Architecture, Brand & Typography Audit
- Replaced plain brand block with custom SVG Civic Participation Crest (shield + Capitol dome + citizen radar beacon) and `Civic Lab` / `Lab Cívico` identity pill.
- Replaced generic font stack with `Newsreader` (editorial serif), `Plus Jakarta Sans` (clean analytical UI sans), and `JetBrains Mono` (`tabular-nums`) for aligned financial/legislative tables.
- Elevated `/super-tools` from a passive overview card list into a sticky-navigated **6-Lens Civic Intelligence Workbench** with interactive CSV exports, donor cross-search, 6-metric Census choropleth map, bipartisan network dyads, and head-to-head legislator comparison.

---

## Part II — Next Version Roadmap (v2.1 & v3.0)

### 1. New Official Public Data Sources
- **Recorded Roll-Call Floor & Committee Votes (`njleg.state.nj.us`):** Scrape third-reading & concurrence vote tallies per legislator to compute authentic *Party Unity %*, *Absence / Abstention Rate*, and *Floor Alignment Index* across D/R votes.
- **NJ Treasury YourMoney State Contracts & Grants (`yourmoney.nj.gov`):** Cross-reference top ELEC corporate/PAC contributors against state procurement awards, tax incentives (`NJEDA`), and county grant disbursements.
- **NJ ELEC Quarterly Lobbying Disclosures:** Ingest registered Governmental Affairs Agents (GAAs), client spend by policy domain, and bill-specific lobbying targets (`support`/`oppose`) to show who lobbies on top Super Tools bills.
- **Municipal Property Tax, Aid & Budget Overlay (NJ DCA):** Join `564` municipalities' annual average residential property tax bill, equalized tax rate, and state municipal/school aid (`NJDOE`) onto `/district/:district` and `/buscar-representante`.
- **Official Legislative Calendar & Committee Hearing Watchlist:** Track upcoming committee agendas and witness slips so residents can participate before bills reach floor votes.

### 2. Analytical Workbench Enhancements
- **Bill Lifecycle Funnel & Enactment Rate:** Separate bills stalled in committee from bills passing one chamber, passing both houses, or signed/vetoed by the Governor (`P.L.` chapter law conversion rate per sponsor).
- **Co-Sponsorship Graph Explorer (120-Node Network):** Interactive force/chord adjacency view extending Top 40 D–R dyads to reveal full legislative coalitions and bipartisan bill clusters.
- **PAC Industry Sector Taxonomy:** Classify raw NJ ELEC contributor names into standardized industry sectors (*Healthcare/Pharma*, *Real Estate & Construction*, *Public Unions*, *Energy & Utilities*, *Finance & Insurance*, *Legal*).
- **Inflation-Adjusted Multi-Cycle Finance Trends:** Compare `2021`, `2023`, and `2025` NJ ELEC fundraising cycles side-by-side in constant dollars.

### 3. Technical, Performance & Delivery Improvements
- **Route & Data Chunk Code-Splitting:** Move heavy donor/bill/demographics JSON payloads cleanly into lazy async chunks under `vite` (`build.chunkSizeWarningLimit` optimization) for multi-file hosting while keeping `build:single` intact for `file:///` distribution.
- **Automated GitHub Actions Data Pipeline:** Weekly scheduled workflow running `refresh-data`, `refresh-census`, `validate-data`, and `check-i18n`, opening a verified PR only when NJLeg/Census/ELEC records change.
- **Automated Test Suite (Vitest + Playwright):** Add unit tests for `analytics.ts`, `csv.ts`, `promiseStatus.ts`, and automated E2E route + EN/ES toggle smoke checks in CI.
- **Client-Side Fuzzy Geocoding / Street Lookup:** Enhance `/buscar-representante` with NJ Zip-to-Town / census block matching so voters entering a street ZIP code resolving across split municipalities see exact NJ Legislative District disambiguation.
