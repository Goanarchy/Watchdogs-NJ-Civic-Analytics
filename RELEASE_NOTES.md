# Release Notes — Watchdogs Media · Civic Lab (v2.0.0)

**Release Date:** November 2026  
**Developer:** [Goanarchy (@goanarchy1)](https://x.com/goanarchy1)

---

## Highlights in v2.0.0

### 1. Super Tools Transformed into a 6-Lens Civic Intelligence Workbench (`/super-tools`)
- Added unified client-side analytical join engine (`src/lib/analytics.ts`) combining **NJLeg legislation**, **NJ ELEC campaign finance**, **Campaign Promises**, and **U.S. Census Bureau ACS 2024 5-Year demographics**:
  - **01 Overview & Matrix:** Telemetry ribbon + sortable/filterable 120-legislator performance & finance matrix with RFC-4180 CSV download (`src/lib/csv.ts`).
  - **02 Policy & Topics Lab:** 19 policy areas with partisan split bars, bipartisan rates, chamber breakdown, and standing committees.
  - **03 Bipartisanship & Alliances:** Cross-party bill decomposition, chamber-filterable bipartisan bridge-builders, and Top 40 Democrat–Republican co-sponsorship dyads.
  - **04 Money in Politics:** `$58,416,809.51` NJ ELEC analysis across `34,841` donor-year groups, donor bucket segmentation, cross-legislator donor search with expandable recipient lists, and Top 12 funded legislators.
  - **05 Districts & Census:** Interactive 6-metric choropleth map (`Bills`, `Median Income`, `Poverty Rate`, `Home Value`, `Transit Commuters`, `ELEC Funding`) + sortable 40-district composite matrix with CSV export.
  - **06 Compare Legislators:** Head-to-head legislator benchmark comparing output, primary authorship rate, bipartisanship, ELEC funding, promises, district median income, and top policy topic.

### 2. Official Public Data Completeness & New Census Integration
- **U.S. Census Bureau ACS 2024 5-Year (`src/data/demographics.json`):** New `scripts/fetch-census-acs.mjs` querying 10 ACS tables (`B01003, B01002, B19013, B25077, B25064, B17001, B15003, B23025, B25003, B08301`) across all 40 NJ Legislative Districts + statewide NJ baseline (`9,343,809` population, `$103,556` median household income).
- **100% (`120/120`) NJ ELEC Donor Coverage:** Resolved cross-chamber special election matching (LD35 Benjie E. Wimberly) and expanded nickname normalization (`scripts/fetch-elec-entities.mjs`), yielding `187` race profiles and `45,467` donor contribution records.
- **NJ Spotlight & Campaign Promises Recovery:** Fixed the `2025-voter-guide-ld4/` redirect collision and widened chamber heading capture for special Senate elections (`scripts/scrape-njspotlight-guides.mjs`), plus normalized surname matching (`scripts/fetch-campaign-bills.mjs`, `scripts/build-campaign-data.mjs`), expanding verified coverage to `404` scraped candidate entries, `184` profiles, and `237` tracked promises.

### 3. Complete EN/ES Localization (Zero Language Bleed)
- Added full bilingual translation parity across `707` EN/ES keys (`src/lib/i18n.tsx`) with `scripts/check-i18n.mjs` passing at 0 errors and 0 unused warnings.
- Localized campaign promise status badges (`src/lib/promiseStatus.ts`) and added entity/source/question/action translators (`src/lib/labels.ts`) across `VoteTrackerPage.tsx`, `ReportPage.tsx`, `LegislatorPage.tsx`, `HomePage.tsx`, and `CampaignPromisesPanel.tsx`.
- Added explicit contextual explanation (`profile.leaderNoCommittees`) for Floor Leaders (`John DiMaio`, `Louis D. Greenwald`) who do not hold standing committee seats under NJ legislative rules.

### 4. Brand Crest, Editorial Typography & Visual Hierarchy
- Redesigned custom civic shield + Capitol dome + citizen radar beacon crest (`SiteHeader.tsx`, `public/watchdogs-logo.svg`, `public/favicon.svg`) paired with `Watchdogs Media · Civic Lab` branding.
- Upgraded fonts to `Newsreader`, `Plus Jakarta Sans`, and `JetBrains Mono` (`dev.html`, `src/index.css`) with tabular numeric formatting (`.num`), analytical Home Command Strip, Card Primary/Cosponsor ratio bars, and high-contrast responsive workbench layouts.
