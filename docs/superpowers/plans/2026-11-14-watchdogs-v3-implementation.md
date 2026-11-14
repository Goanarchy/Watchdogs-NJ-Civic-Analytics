# Watchdogs Media · Civic Lab v3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Watchdogs Media · Civic Lab into a visual-first, comparative civic analytics suite featuring official NJLeg bulk bill-stage & roll-call vote data, 4 new graphical Super Tools lenses (`07–10`), profile benchmark bars, and downloadable viral dossier cards.

**Architecture:** Extend `scripts/` with an official NJLeg bulk parser (`DB2026_TEXT.zip` + `votes/`) generating compact JSON snapshots (`bill-stages.json`, `votes.json`). Build pure TypeScript analytical engines (`sectors.ts`, `sandbox.ts`, `pocketbook.ts`, `analytics.ts`), render modular SVG-first React lens components (`src/components/lenses/`) styled strictly via semantic CSS tokens in `src/index.css` (no Tailwind or icon library dependencies), and provide offline-safe SVG-to-Canvas PNG export on legislator profiles.

**Tech Stack:** React 19, TypeScript 5, Vite 7 (`HashRouter`), Semantic CSS Custom Properties (`src/index.css`), Bespoke Inline SVG Charts & Canvas Export, Node ESM Scripts.

**Spec:** [2026-11-14-watchdogs-v3-design.md](../../specs/2026-11-14-watchdogs-v3-design.md)

---

## Global Constraints

- **Zero horizontal overflow:** Strictly no horizontal scrollbars (`overflow-x: hidden`, adaptive flex/grid wrapping across `375px`–`412px` mobile, tablet, and desktop).
- **Styling & Icons:** Use existing semantic CSS variables (`var(--paper)`, `var(--card)`, `var(--ink)`, `var(--navy)`, `var(--gold)`, `html[data-theme="dark"]`) and inline SVGs. Do NOT introduce Tailwind CSS or external icon packages.
- **Strict dark/light contrast:** Every chart, tooltip, card, badge, and Canvas export must have high contrast in both light and dark modes (zero unstyled white surfaces in dark mode).
- **100% bilingual parity (`EN / ES`):** Every UI key must exist in both dictionaries in `src/lib/i18n.tsx` with identical placeholders and pass `node scripts/check-i18n.mjs`.
- **Nonpartisan mathematical neutrality:** Zero editorial `A–F` grades or subjective terms like "Backbencher". Every score (`0–100`), correlation, and archetype uses transparent formulas from official records.
- **Static & standalone compatibility:** Both standard `dist/` build and `build:single` standalone HTML (`index.html`) must pass cleanly.

## Review Focus

1. **Missing/zero data for mid-term replacement legislators:** A member with 0 ELEC donors or 0 floor votes must return clean `0` / `null` fallbacks without `NaN` or division-by-zero across all charts, LES, and Pocketbook indices.
2. **Mobile label & SVG chart clipping (`375px` viewport):** Long Spanish labels in the 10-lens selector, scatter plot axes, and funnel bars must wrap or condense gracefully without overflowing containers.
3. **CORS canvas taint on remote legislator portraits:** `pub.njleg.gov` images drawn to `<canvas>` during PNG Dossier Card export may throw `SecurityError` if cross-origin headers are restricted; export must draw with `crossOrigin="anonymous"` and cleanly fallback to a vector party-colored monogram avatar on image error.
4. **Zero-variance correlation in Sandbox:** Selecting an axis subset where all legislators share identical values (variance = 0) must return Pearson `r = 0` cleanly instead of `NaN`.
5. **Corrupt or empty upstream NJLeg zip archives:** `fetch-njleg-bulk.mjs` must verify zip extraction and non-empty bill/vote record counts before overwriting existing `src/data/` JSON files.

---

## File Structure Map

- **Modify:** `NJ Civic App/package.json` — add `refresh-bulk`, `test:v3` scripts.
- **Modify:** `NJ Civic App/scripts/safe-update.mjs` — validate new `bill-stages.json` and `votes.json` during integrity checks.
- **Create:** `NJ Civic App/scripts/fetch-njleg-bulk.mjs` — download and parse `DB2026_TEXT.zip` (bill stages/committees) and `pub.njleg.state.nj.us/votes/` (`A2026.zip`, `S2026.zip`).
- **Create:** `NJ Civic App/scripts/test-v3-analytics.mjs` — Node unit test runner for parser, sector classification, LES, Sandbox Pearson correlation, and Pocketbook index (including all 5 Review Focus edge cases).
- **Create/Populate:** `NJ Civic App/src/data/bill-stages.json` & `NJ Civic App/src/data/votes.json` — compact structured snapshots exported in `src/data/index.ts`.
- **Modify:** `NJ Civic App/src/types.ts` — add `BillStageInfo`, `RollCallVoteRecord`, `VotesData`, `DonorSectorKey`, `LesArchetype`, `SandboxDimension`, `PocketbookScore` types.
- **Create:** `NJ Civic App/src/lib/sectors.ts` — 8-sector ELEC classifier & committee alignment mapper.
- **Create:** `NJ Civic App/src/lib/sandbox.ts` — 12-dimension registry, Pearson `r`, median quadrant classifier.
- **Create:** `NJ Civic App/src/lib/pocketbook.ts` — Property Tax / Housing / Transit bill filter, objective `0–100` score, and real floor-vote extractor.
- **Modify:** `NJ Civic App/src/lib/analytics.ts` — integrate sector profiles, bill pipeline funnel, committee bottlenecks, `LES` score & archetypes, and attendance/unity metrics.
- **Modify:** `NJ Civic App/src/lib/i18n.tsx` — add synchronized `en` / `es` keys for all v3 features.
- **Modify:** `NJ Civic App/src/index.css` — add semantic CSS for 10-lens grid, funnel bars, donut charts, scatter sandbox, pocketbook gauges, profile benchmark bars, and dossier card.
- **Create:** `NJ Civic App/src/components/lenses/InfluenceRadarLens.tsx` — Lens 07 UI (SVG sector donut/bars, committee-sector alignment, grassroots leaderboard with portraits).
- **Create:** `NJ Civic App/src/components/lenses/EffectivenessFunnelLens.tsx` — Lens 08 UI (pipeline funnel SVG, committee bottleneck ranking, LES portrait leaderboard & archetypes).
- **Create:** `NJ Civic App/src/components/lenses/CorrelationSandboxLens.tsx` — Lens 09 UI (interactive 2D scatter plot, X/Y selectors, quadrant cards, portrait tooltip, CSV export).
- **Create:** `NJ Civic App/src/components/lenses/PocketbookVotesLens.tsx` — Lens 10 UI (3 cost-of-living pillar scorecards, top pocketbook roll-call bills with `Yes/No/Abstain` breakdown, portrait rankings).
- **Modify:** `NJ Civic App/src/pages/DashboardPage.tsx` & `NJ Civic App/src/pages/HomePage.tsx` — wire symmetrical `01–10` lens navigation and new lenses.
- **Create:** `NJ Civic App/src/components/DossierCardGenerator.tsx` — interactive preview + 1-click SVG-to-Canvas PNG download + clipboard formatted summary.
- **Modify:** `NJ Civic App/src/pages/LegislatorPage.tsx` & `NJ Civic App/src/pages/ReportPage.tsx` — add visual chamber comparison bars, donor sector bar, pocketbook/roll-call panel, and `DossierCardGenerator`.

---

### Task 1: NJLeg Bulk Data Ingestion & Parser (`bill-stages.json` + `votes.json`)

**Files:**
- Create: `NJ Civic App/scripts/fetch-njleg-bulk.mjs`
- Create: `NJ Civic App/scripts/test-v3-analytics.mjs`
- Modify: `NJ Civic App/package.json`
- Modify: `NJ Civic App/scripts/safe-update.mjs`
- Create: `NJ Civic App/src/types.ts` (append bulk types), `NJ Civic App/src/data/index.ts`

**Interfaces:**
- Produces: `BillStageEntry` (`bill`, `stage`: `"introduced" | "committee" | "reported" | "floor" | "enacted"`, `committeeCode`, `lastAction`, `lastActionDate`, `isSubstantive`: boolean) in `src/data/bill-stages.json`.
- Produces: `VotesData` (`generatedAt`, `rollCalls`: summary list of notable floor votes with `bill`, `date`, `chamber`, `yeas`, `nays`, `abstains`, `votesByLegislatorId`: `Record<string, "Y" | "N" | "A" | "NV">`, `legislatorStats`: `Record<number, { eligible: number; cast: number; attendancePct: number; partyUnityPct: number }>`) in `src/data/votes.json`.

- [ ] **Step 1: Write parser unit test in `NJ Civic App/scripts/test-v3-analytics.mjs`**

Test `normalizeBillStage(rawStatus, isChapterLaw)` (mapping `"INT"` -> `"introduced"`, `"REF"` -> `"committee"`, `"REP"` -> `"reported"`, `"PA"`/`"PS"` -> `"floor"`, chapter law -> `"enacted"`) and `parseVoteLine(...)` + validation guard rejecting empty record sets (`assertBillStagesValid([])` throws).

- [ ] **Step 2: Run test to verify it fails**

Run: `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: FAIL because helper module/functions do not exist yet.

- [ ] **Step 3: Implement `NJ Civic App/scripts/fetch-njleg-bulk.mjs` & `src/types.ts` updates**

Fetch `https://pub.njleg.state.nj.us/leg-databases/2026data/DB2026_TEXT.zip` and `https://pub.njleg.state.nj.us/votes/` (`A2026.zip`, `S2026.zip`) using Node built-in `zlib`/zip reader (or PowerShell `Expand-Archive` / `unzipper` fallback on Windows without extra runtime deps), normalize bill stages for all `bills.json` keys, match roll-call legislator names/districts cleanly against `legislators.json`, validate `Object.keys(stages).length >= 5000` before writing `bill-stages.json` and `votes.json`, and update `safe-update.mjs` + `src/data/index.ts`.

- [ ] **Step 4: Execute bulk fetch & run parser tests**

Run: `node "NJ Civic App/scripts/fetch-njleg-bulk.mjs"` and `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: Writes valid `bill-stages.json` and `votes.json`; parser unit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "NJ Civic App/scripts" "NJ Civic App/src/data" "NJ Civic App/src/types.ts" "NJ Civic App/package.json"
git commit -m "feat(data): ingest NJLeg bulk bill stages and official floor roll-call votes"
```

---

### Task 2: Economic Sector Classifier & Influence Analytics (`src/lib/sectors.ts`)

**Files:**
- Create: `NJ Civic App/src/lib/sectors.ts`
- Modify: `NJ Civic App/src/lib/analytics.ts`, `NJ Civic App/src/types.ts`
- Modify: `NJ Civic App/scripts/test-v3-analytics.mjs`

**Interfaces:**
- Consumes: `DonorRecord`, `Committee` from `src/types.ts`.
- Produces: `SECTOR_DEFINITIONS: SectorDefinition[]`, `classifyDonorSector(donor: DonorRecord): DonorSectorKey`, `computeLegislatorInfluence(legislator, donorProfile): LegislatorInfluenceSummary` (returns `totalRaised`, `grassrootsPct`, `institutionalPct`, `sectorTotals`, `topSectors`, `committeeAlignments`).

- [ ] **Step 1: Add failing unit tests to `scripts/test-v3-analytics.mjs`**

Assert `classifyDonorSector` maps `"NJEA PAC"` -> `"labor_unions"`, `"Hackensack Meridian Health"` -> `"healthcare_pharma"`, `"NJ Realtors PAC"` -> `"real_estate"`, `"PSEG"` -> `"energy_utilities"`, and a `$250` uncategorized individual -> `"civic_grassroots"`. Assert `computeLegislatorInfluence(leg, undefined)` returns `{ totalRaised: 0, grassrootsPct: 0, institutionalPct: 0, topSectors: [], committeeAlignments: [] }` with zero `NaN`s.

- [ ] **Step 2: Run test to verify failure**

Run: `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: FAIL on missing `src/lib/sectors.ts`.

- [ ] **Step 3: Implement `src/lib/sectors.ts` & wire `InfluenceAnalytics` into `src/lib/analytics.ts`**

Classify all 8 industrial sectors cleanly via deterministic keyword/contributorType rules, calculate per-legislator grassroots ratio and institutional reliance %, and detect when a legislator's standing committee overlaps with a top-3 funding sector (e.g., Health committee + `healthcare_pharma`).

- [ ] **Step 4: Run test verification**

Run: `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: PASS on all sector classification and empty-donor assertions.

- [ ] **Step 5: Commit**

```bash
git add "NJ Civic App/src/lib/sectors.ts" "NJ Civic App/src/lib/analytics.ts" "NJ Civic App/src/types.ts" "NJ Civic App/scripts/test-v3-analytics.mjs"
git commit -m "feat(analytics): add 8-sector donor classification and committee influence alignment"
```

---

### Task 3: Legislative Pipeline Funnel, LES & Neutral Archetypes (`src/lib/analytics.ts`)

**Files:**
- Modify: `NJ Civic App/src/lib/analytics.ts`, `NJ Civic App/src/types.ts`
- Modify: `NJ Civic App/scripts/test-v3-analytics.mjs`

**Interfaces:**
- Consumes: `bill-stages.json`, `votes.json`, `legislators.json`.
- Produces: `PipelineAnalytics` (`funnelStages`: `{ stage, count, pct }[]`, `committeeBottlenecks`: `{ code, name, referred, reported, advanceRatePct }[]`, `substantiveCount`, `ceremonialCount`) and per-row `lesScore` (`0–100`), `lesArchetype` (`"high_throughput" | "policy_specialist" | "coalition_builder" | "developing"`), `attendancePct`, `partyUnityPct`.

- [ ] **Step 1: Add failing tests to `scripts/test-v3-analytics.mjs`**

Assert substantive vs ceremonial detection (`"S100"` -> `isSubstantive: true`, `"SR45"` / `"AJR12"` -> `isSubstantive: false`), committee advance rate returns `0` cleanly when `referred === 0`, and archetype classifier returns `"policy_specialist"` when ≥50% of substantive primary bills sit in 1–2 topics and `"high_throughput"` for top-quartile LES.

- [ ] **Step 2: Run test to verify failure**

Run: `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: FAIL on missing pipeline/LES functions.

- [ ] **Step 3: Implement pipeline aggregation, committee bottlenecks, and LES scoring in `src/lib/analytics.ts`**

Normalize LES cleanly via min-max scaling over weighted components (`primarySubstantiveBills * 1.0 + reportedBills * 2.5 + enactedBills * 5.0 + voteAttendancePct * 0.1`), strictly capped `[0, 100]`, plus statewide & chamber averages (`chamberAverages.Senate`, `chamberAverages.Assembly`) for visual benchmarks.

- [ ] **Step 4: Run test verification**

Run: `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: PASS on pipeline, committee zero-division safety, and neutral archetypes.

- [ ] **Step 5: Commit**

```bash
git add "NJ Civic App/src/lib/analytics.ts" "NJ Civic App/src/types.ts" "NJ Civic App/scripts/test-v3-analytics.mjs"
git commit -m "feat(analytics): add bill pipeline funnel, committee bottlenecks, and neutral LES"
```

---

### Task 4: Civic Correlation Sandbox & Objective Pocketbook Index (`src/lib/sandbox.ts`, `src/lib/pocketbook.ts`)

**Files:**
- Create: `NJ Civic App/src/lib/sandbox.ts`
- Create: `NJ Civic App/src/lib/pocketbook.ts`
- Modify: `NJ Civic App/src/lib/analytics.ts`
- Modify: `NJ Civic App/scripts/test-v3-analytics.mjs`

**Interfaces:**
- Produces (`sandbox.ts`): `SANDBOX_DIMENSIONS: SandboxDimension[]` (12 metrics), `computePearsonR(xs: number[], ys: number[]): number`, `computeMedianQuadrants(points, xMedian, yMedian)`.
- Produces (`pocketbook.ts`): `POCKETBOOK_PILLARS` (`property_tax`, `housing_rent`, `transit_infra`), `computeLegislatorPocketbook(legislator, bills, stages, votes): PocketbookSummary` (returns `overallScore` `0–100`, per-pillar scores, sponsored pocketbook bills, and verified roll-call votes `Y/N/A/NV`).

- [ ] **Step 1: Add failing tests to `scripts/test-v3-analytics.mjs`**

Assert `computePearsonR([1,2,3], [2,4,6]) === 1`, `computePearsonR([5,5,5], [1,2,3]) === 0` (no `NaN`), and `computeLegislatorPocketbook` classifies `"property tax relief"` bill under `property_tax` and calculates an objective `0–100` score + roll-call entries without assigning editorial grades.

- [ ] **Step 2: Run test to verify failure**

Run: `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: FAIL because `sandbox.ts` and `pocketbook.ts` do not exist.

- [ ] **Step 3: Implement `src/lib/sandbox.ts` & `src/lib/pocketbook.ts` and attach to `Analytics`**

Populate 12 quantitative dimensions in `sandbox.ts`, implement median split quadrant computation, and implement the 3-pillar keyword + topic classifier and objective score in `pocketbook.ts` linked with real `votes.json` floor roll-calls.

- [ ] **Step 4: Run test verification**

Run: `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
Expected: PASS on Pearson edge cases, quadrant assignment, and Pocketbook computation.

- [ ] **Step 5: Commit**

```bash
git add "NJ Civic App/src/lib/sandbox.ts" "NJ Civic App/src/lib/pocketbook.ts" "NJ Civic App/src/lib/analytics.ts" "NJ Civic App/scripts/test-v3-analytics.mjs"
git commit -m "feat(analytics): add 12-dimension correlation sandbox and objective pocketbook engine"
```

---

### Task 5: Synchronized Bilingual Copy (`i18n.tsx`) & Semantic CSS Design Tokens (`index.css`)

**Files:**
- Modify: `NJ Civic App/src/lib/i18n.tsx`
- Modify: `NJ Civic App/src/index.css`

**Interfaces:**
- Produces: Synchronized `CopyKey` strings in `en` and `es` for Lenses `07–10`, all 8 sectors, funnel stages, 4 neutral archetypes, 12 sandbox metrics, 3 pocketbook pillars, roll-call statuses (`Y/N/A/NV`), profile chamber benchmarks, and dossier card actions.
- Produces: Semantic CSS rules (`.st-lens-nav` wrapping cleanly to 5-col desktop / 2-col mobile, `.wd-donut-wrap`, `.wd-funnel-stage`, `.wd-scatter-svg`, `.wd-benchmark-bar`, `.wd-pocket-card`, `.wd-dossier-preview`) using CSS variables for dark/light theme integrity and `overflow-x: hidden`.

- [ ] **Step 1: Add all English & Spanish dictionary keys to `src/lib/i18n.tsx`**

Verify identical parameter tokens (`{count}`, `{pct}`, `{chamber}`, etc.) between `en` and `es`.

- [ ] **Step 2: Add semantic CSS classes for all new v3 charts, cards, and responsive layouts in `src/index.css`**

Ensure explicit dark-mode contrast rules under `html[data-theme="dark"]`, clean responsive breakpoints at `@media (max-width: 760px)` and `@media (max-width: 480px)`, and strict `min-width: 0` on flex/grid containers.

- [ ] **Step 3: Run i18n parity check**

Run: `npm run check-i18n -- --allow-unused` (since UI components in Tasks 6–8 will consume the keys next)
Expected: Exit code `0` — zero mismatched placeholders or missing translations between `en` and `es`.

- [ ] **Step 4: Commit**

```bash
git add "NJ Civic App/src/lib/i18n.tsx" "NJ Civic App/src/index.css"
git commit -m "feat(ui): add synchronized EN/ES copy and dark-mode safe CSS tokens for v3.0"
```

---

### Task 6: Graphical Lens 07 (`InfluenceRadarLens`) & Lens 08 (`EffectivenessFunnelLens`)

**Files:**
- Create: `NJ Civic App/src/components/lenses/InfluenceRadarLens.tsx`
- Create: `NJ Civic App/src/components/lenses/EffectivenessFunnelLens.tsx`

**Interfaces:**
- Consumes: `Analytics`, `useI18n`, `Portrait`, `PartyBadge`, `downloadCsv`.
- Produces: `<InfluenceRadarLens analytics={analytics} />` and `<EffectivenessFunnelLens analytics={analytics} />`.

- [ ] **Step 1: Build `InfluenceRadarLens.tsx`**

Render:
- Visual SVG Donut + Horizontal Stacked Sector Breakdown across all $58.4M+ ELEC contributions.
- Interactive sector filter pill bar updating the **Grassroots vs. Institutional Reliance** legislator ranking (with portraits, party badges, and dual comparative meters).
- Visual **Committee-Donor Alignment Explorer** highlighting legislators whose assigned committee jurisdiction matches a top donor sector, plus CSV export.

- [ ] **Step 2: Build `EffectivenessFunnelLens.tsx`**

Render:
- Full-width visual SVG **Legislative Pipeline Funnel** (`Introduced` → `Referred` → `Reported` → `Floor Vote` → `Enacted`) comparing Substantive vs. Ceremonial bills.
- **Committee Bottleneck Bar Chart** ranking committees by referral volume vs. advancement %.
- Interactive **LES & Archetype Explorer** (filterable by chamber and archetype tier) with portraits, LES meter bars vs. chamber average, vote attendance gauge, and CSV export.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit` in `NJ Civic App`
Expected: `0` TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add "NJ Civic App/src/components/lenses/InfluenceRadarLens.tsx" "NJ Civic App/src/components/lenses/EffectivenessFunnelLens.tsx"
git commit -m "feat(ui): implement visual Influence Radar (07) and Pipeline/LES Funnel (08) lenses"
```

---

### Task 7: Graphical Lens 09 (`CorrelationSandboxLens`), Lens 10 (`PocketbookVotesLens`) & `01–10` Navigation

**Files:**
- Create: `NJ Civic App/src/components/lenses/CorrelationSandboxLens.tsx`
- Create: `NJ Civic App/src/components/lenses/PocketbookVotesLens.tsx`
- Modify: `NJ Civic App/src/pages/DashboardPage.tsx`, `NJ Civic App/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `SANDBOX_DIMENSIONS`, `computePearsonR`, `computeLegislatorPocketbook`, `Analytics`, `Portrait`, `PartyBadge`.
- Produces: `<CorrelationSandboxLens analytics={analytics} />`, `<PocketbookVotesLens analytics={analytics} />`, and updated `LensTab` (`"overview" | "topics" | "bipartisan" | "finance" | "districts" | "compare" | "influence" | "effectiveness" | "sandbox" | "pocketbook"`) across `DashboardPage.tsx` and `HomePage.tsx`.

- [ ] **Step 1: Build `CorrelationSandboxLens.tsx`**

Render interactive X-axis and Y-axis selectors across 12 metrics, Party/Chamber filter toggles, responsive interactive SVG Scatter Plot (with median quadrant crosshairs, Pearson $r$ correlation callout, clickable/hoverable data dots displaying floating Legislator **Portrait + stats tooltip card**), 4 Quadrant breakdown cards, and sortable data table + CSV export.

- [ ] **Step 2: Build `PocketbookVotesLens.tsx`**

Render 3 visual hero scorecards (**Property Taxes**, **Housing & Rent**, **Transit & Infrastructure**) with bill counts & enactment meters, a **Key Roll-Call Floor Votes Matrix** showing exact `Yes / No / Abstain` visual split bars and expandable vote rosters by legislator portrait, plus the `0–100` Objective Pocketbook Activity leaderboard.

- [ ] **Step 3: Wire Lenses `07–10` into `DashboardPage.tsx` & `HomePage.tsx` Super Tools command strip**

Ensure symmetrical 10-card strip wraps smoothly across viewports with zero horizontal overflow.

- [ ] **Step 4: Verify TypeScript & i18n checks**

Run: `npx tsc --noEmit` and `npm run check-i18n -- --allow-unused`
Expected: `0` TypeScript errors and `0` i18n parity issues.

- [ ] **Step 5: Commit**

```bash
git add "NJ Civic App/src/components/lenses" "NJ Civic App/src/pages/DashboardPage.tsx" "NJ Civic App/src/pages/HomePage.tsx"
git commit -m "feat(ui): add Correlation Sandbox (09), Pocketbook & Votes (10), and 10-lens navigation"
```

---

### Task 8: Visual Profile Benchmarks & Viral Dossier Card Generator (`DossierCardGenerator.tsx`)

**Files:**
- Create: `NJ Civic App/src/components/DossierCardGenerator.tsx`
- Modify: `NJ Civic App/src/pages/LegislatorPage.tsx`, `NJ Civic App/src/pages/ReportPage.tsx`

**Interfaces:**
- Consumes: `Legislator`, `LegislatorMatrixRow` (from `Analytics`), `useI18n`.
- Produces: `<DossierCardGenerator legislator={legislator} row={matrixRow} chamberAvg={chamberAvg} />` + embedded chamber comparison bars & Pocketbook roll-call panel on `LegislatorPage.tsx`.

- [ ] **Step 1: Build `DossierCardGenerator.tsx`**

Render an interactive, visual, high-contrast **Accountability Snapshot Card** preview (portrait, party badge, district, LES score, Grassroots %, Top Donor Sector, Pocketbook Index, Attendance %, and Watchdogs verified link), plus:
- `Download PNG Card`: renders clean 1200×675 offscreen Canvas card (CORS-safe portrait load with instant party-monogram fallback on error so it never throws) and triggers `.png` download.
- `Copy Share Summary`: copies clean bilingual verified facts text + direct Watchdogs URL to clipboard with visual confirmation badge.

- [ ] **Step 2: Enhance `LegislatorPage.tsx` & `ReportPage.tsx` with Visual Benchmarks & Roll-Call Panel**

Add visual horizontal bar gauges comparing the legislator's **Bills, Bipartisanship, Grassroots %, LES Score, Attendance %, and Pocketbook Index** directly against their chamber average (`Senate Avg` / `Assembly Avg`), embed top Donor Sector bar chart, Key Pocketbook Roll-Call Votes (`Y/N/A`), and render `<DossierCardGenerator />`.

- [ ] **Step 3: Run strict i18n check (without `--allow-unused`) and TypeScript build**

Run: `npm run check-i18n` and `npx tsc --noEmit`
Expected: `0` unused keys, `0` missing translations, `0` TS errors.

- [ ] **Step 4: Commit**

```bash
git add "NJ Civic App/src/components/DossierCardGenerator.tsx" "NJ Civic App/src/pages/LegislatorPage.tsx" "NJ Civic App/src/pages/ReportPage.tsx"
git commit -m "feat(profiles): add visual chamber benchmark gauges and PNG viral dossier card generator"
```

---

### Task 9: Full Integrity Verification, Device/Dark-Mode Audits & Production Deployment

**Files:**
- Modify (if fixes needed from audit): `NJ Civic App/src/index.css` or component markup.

- [ ] **Step 1: Run all automated unit, i18n, and data integrity tests**

Run:
- `node "NJ Civic App/scripts/test-v3-analytics.mjs"`
- `npm run check-i18n`
- `npm run verify-integrity`
Expected: All pass cleanly with exit code `0`.

- [ ] **Step 2: Build production web bundle and standalone single-file HTML**

Run: `npm run build:all` in `NJ Civic App`
Expected: Clean `dist/` bundle and `index.html` single-file artifact built without errors or broken chunks.

- [ ] **Step 3: Execute Automated Visual, Box-Fit & Dark/Light Multi-Device Audits**

Verify via headless Chromium/Edge CDP across Desktop (`1440px`), Tablet (`768px`), and Mobile (`375px`, `412px`) in both Light and Dark mode across Home, Super Tools Lenses `07–10`, and Legislator Profile:
- Zero console errors, zero JS exceptions.
- Zero horizontal scrollbars (`scrollWidth <= innerWidth`).
- Zero clipped text, zero unstyled white containers in dark mode, SVG charts legible, and PNG Dossier download succeeds without errors.

- [ ] **Step 4: Commit final verified state & deploy to GitHub Pages**

Run:
- `git status` -> clean commit if any CSS/audit polish occurred.
- `npm run publish-web`
- Verify live URL (`https://goanarchy.github.io/Watchdogs-NJ-Civic-Analytics/`).
