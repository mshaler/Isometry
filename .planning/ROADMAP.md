# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads.

## Milestones

- ✅ **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** — Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** — Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** — Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** — Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** — Phases 15-27 (shipped 2026-03-05)
- ✅ **v4.0 Native ETL** — Phases 33-36 (shipped 2026-03-06)
- 🚧 **v3.1 SuperStack** — Phases 28-32 (Phases 28-30 complete, 31-32 remaining)

## Phases

<details>
<summary>✅ v0.1 Data Foundation (Phases 1-2) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) — completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) — completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.5 Providers + Views (Phases 4-6) — SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) — completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) — completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) — completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.0 Web Runtime (Phases 3, 7) — SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) — completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) — completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 ETL Importers (Phases 8-10) — SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) — completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) — completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) — completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.0 Native Shell (Phases 11-14) — SHIPPED 2026-03-03</summary>

- [x] Phase 11: Xcode Shell + WKURLSchemeHandler (2/2 plans) — completed 2026-03-02
- [x] Phase 12: Bridge + Data Persistence (3/3 plans) — completed 2026-03-03
- [x] Phase 13: Native Chrome + File Import (3/3 plans) — completed 2026-03-03
- [x] Phase 14: iCloud + StoreKit Tiers (3/3 plans) — completed 2026-03-03

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.0 SuperGrid Complete (Phases 15-27) — SHIPPED 2026-03-05</summary>

- [x] Phase 15: PAFVProvider Stacked Axes (2/2 plans) — completed 2026-03-04
- [x] Phase 16: SuperGridQuery Worker Wiring (2/2 plans) — completed 2026-03-04
- [x] Phase 17: SuperGrid Dynamic Axis Reads (2/2 plans) — completed 2026-03-04
- [x] Phase 18: SuperDynamic (2/2 plans) — completed 2026-03-04
- [x] Phase 19: SuperPosition + SuperZoom (3/3 plans) — completed 2026-03-04
- [x] Phase 20: SuperSize (2/2 plans) — completed 2026-03-05
- [x] Phase 21: SuperSelect (4/4 plans) — completed 2026-03-05
- [x] Phase 22: SuperDensity (3/3 plans) — completed 2026-03-05
- [x] Phase 23: SuperSort (3/3 plans) — completed 2026-03-05
- [x] Phase 24: SuperFilter (3/3 plans) — completed 2026-03-05
- [x] Phase 25: SuperSearch (3/3 plans) — completed 2026-03-05
- [x] Phase 26: SuperTime (3/3 plans) — completed 2026-03-05
- [x] Phase 27: SuperCards + Polish (3/3 plans) — completed 2026-03-05

See: `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v4.0 Native ETL (Phases 33-36) — SHIPPED 2026-03-06</summary>

- [x] Phase 33: Native ETL Foundation (3/3 plans) — completed 2026-03-06
- [x] Phase 34: Reminders + Calendar Adapters (3/3 plans) — completed 2026-03-06
- [x] Phase 35: Notes Adapter — Title + Metadata (1/1 plan) — completed 2026-03-06
- [x] Phase 36: Notes Content Extraction (2/2 plans) — completed 2026-03-06

See: `.planning/milestones/v4.0-ROADMAP.md` for full details.

</details>

### 🚧 v3.1 SuperStack (Phases 28-32)

**Milestone Goal:** Extend SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder within dimensions, and full compound D3 keying — removing all remaining depth limitations.

- [x] **Phase 28: N-Level Foundation** - Remove axis depth limit, compound D3 keys, multi-level cell placement, asymmetric depth validation (completed 2026-03-05)
- [x] **Phase 29: Multi-Level Row Headers** - Nested row header rendering at all levels with CSS Grid spanning and collision-free keys (completed 2026-03-05)
- [x] **Phase 30: Collapse System** - Independent expand/collapse at any level with aggregate and hide modes, recursive child hiding, Tier 2 persistence (completed 2026-03-06)
- [ ] **Phase 31: Drag Reorder** - Within-dimension level reorder, N-level cross-dimension transpose, animated transitions, Tier 2 persistence
  **Plans:** 2 plans
  Plans:
  - [ ] 31-01-PLAN.md — PAFVProvider reorder methods + collapse key remapping + persistence round-trip tests
  - [ ] 31-02-PLAN.md — SuperGrid visual DnD UX (insertion line, source dimming, midpoint calculation, FLIP animation)
- [ ] **Phase 32: Polish and Performance** - Persistence round-trip validation, compound key selection, render benchmarks, aggregation at all depths

## Progress

**Execution Order:**
Phases execute in numeric order. v3.1 paused at Phase 30 for v4.0; v4.0 shipped. v3.1 resumes at Phase 31.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v0.1 | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | v0.1 | 6/6 | Complete | 2026-02-28 |
| 3. Worker Bridge | v1.0 | 3/3 | Complete | 2026-03-01 |
| 4. Providers + MutationManager | v0.5 | 7/7 | Complete | 2026-02-28 |
| 5. Core D3 Views + Transitions | v0.5 | 4/4 | Complete | 2026-02-28 |
| 6. Time + Visual Views | v0.5 | 3/3 | Complete | 2026-02-28 |
| 7. Graph Views + SuperGrid | v1.0 | 4/4 | Complete | 2026-03-01 |
| 8. ETL Foundation + Apple Notes Parser | v1.1 | 5/5 | Complete | 2026-03-01 |
| 9. Remaining Parsers + Export Pipeline | v1.1 | 5/5 | Complete | 2026-03-02 |
| 10. Progress Reporting + Polish | v1.1 | 2/2 | Complete | 2026-03-02 |
| 11. Xcode Shell + WKURLSchemeHandler | v2.0 | 2/2 | Complete | 2026-03-02 |
| 12. Bridge + Data Persistence | v2.0 | 3/3 | Complete | 2026-03-03 |
| 13. Native Chrome + File Import | v2.0 | 3/3 | Complete | 2026-03-03 |
| 14. iCloud + StoreKit Tiers | v2.0 | 3/3 | Complete | 2026-03-03 |
| 15. PAFVProvider Stacked Axes | v3.0 | 2/2 | Complete | 2026-03-04 |
| 16. SuperGridQuery Worker Wiring | v3.0 | 2/2 | Complete | 2026-03-04 |
| 17. SuperGrid Dynamic Axis Reads | v3.0 | 2/2 | Complete | 2026-03-04 |
| 18. SuperDynamic | v3.0 | 2/2 | Complete | 2026-03-04 |
| 19. SuperPosition + SuperZoom | v3.0 | 3/3 | Complete | 2026-03-04 |
| 20. SuperSize | v3.0 | 2/2 | Complete | 2026-03-05 |
| 21. SuperSelect | v3.0 | 4/4 | Complete | 2026-03-05 |
| 22. SuperDensity | v3.0 | 3/3 | Complete | 2026-03-05 |
| 23. SuperSort | v3.0 | 3/3 | Complete | 2026-03-05 |
| 24. SuperFilter | v3.0 | 3/3 | Complete | 2026-03-05 |
| 25. SuperSearch | v3.0 | 3/3 | Complete | 2026-03-05 |
| 26. SuperTime | v3.0 | 3/3 | Complete | 2026-03-05 |
| 27. SuperCards + Polish | v3.0 | 3/3 | Complete | 2026-03-05 |
| 28. N-Level Foundation | v3.1 | 3/3 | Complete | 2026-03-05 |
| 29. Multi-Level Row Headers | v3.1 | 2/2 | Complete | 2026-03-05 |
| 30. Collapse System | v3.1 | 3/3 | Complete | 2026-03-06 |
| 31. Drag Reorder | 1/2 | In Progress|  | - |
| 32. Polish and Performance | v3.1 | 0/2 | Not started | - |
| 33. Native ETL Foundation | v4.0 | 3/3 | Complete | 2026-03-06 |
| 34. Reminders + Calendar Adapters | v4.0 | 3/3 | Complete | 2026-03-06 |
| 35. Notes Adapter — Title + Metadata | v4.0 | 1/1 | Complete | 2026-03-06 |
| 36. Notes Content Extraction | v4.0 | 2/2 | Complete | 2026-03-06 |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell shipped: 2026-03-03*
*v3.0 SuperGrid Complete shipped: 2026-03-05*
*v4.0 Native ETL shipped: 2026-03-06*
*v3.1 SuperStack resumed: Phases 28-30 complete, 31-32 remaining*
