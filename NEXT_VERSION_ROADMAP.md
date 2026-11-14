# Watchdogs Media · Civic Lab — Next Version Roadmap (v2.1 & v3.0)

This roadmap summarizes the highest-impact data, analytics, UX, and infrastructure upgrades prioritized after v2.0.0. For the full v2.0 platform audit, see [AUDIT_AND_ROADMAP.md](./AUDIT_AND_ROADMAP.md).

---

## v2.1 — Legislative Execution, Lobbying & Cost Efficiency

- **Bill Enactment Funnel & Pass Rates:** Track each bill's stage (*Introduced*, *Passed Assembly/Senate*, *Concurrence*, *Signed P.L.* / *Vetoed*) so Super Tools measures real legislative effectiveness alongside bill volume.
- **Recorded Floor Roll-Call Votes (`njleg.state.nj.us`):** Add individual *Yes / No / Not Voting / Abstain* records, *Party-Line Unity %*, and floor divergence scores.
- **PAC Industry Classification:** Group `34,841+` NJ ELEC donor records into policy sectors (*Labor/Unions*, *Healthcare*, *Real Estate*, *Energy*, *Finance*, *Telecom/Tech*) to connect donor sectors directly to committee assignments and sponsored topics.
- **Searchable Municipal Zip-Code Resolver:** Let residents enter ZIP code or town in `/buscar-representante` with clear multi-district disambiguation where NJ municipalities split across legislative districts.

---

## v3.0 — Fiscal Transparency, Automation & Interactive Networks

- **NJ ELEC Lobbying Expenditure Disclosures:** Map registered lobbying firms and client expenditures directly alongside topic hubs (`02 Policy & Topics Lab`).
- **NJ Treasury Contracts & NJ DCA Property Tax Overlays:** Integrate state vendor awards (`yourmoney.nj.gov`) and municipal property tax / school aid tables per legislative district.
- **Interactive D–R Coalition Network Graph:** Upgrade the Top 40 cross-party dyad matrix into an interactive bipartite co-sponsorship & funding constellation.
- **Scheduled CI Data Pipeline & E2E Tests:** GitHub Actions cron workflow running `validate-data.mjs`, `check-i18n.mjs`, `tsc -b`, and Playwright route checks before automated snapshot updates.
