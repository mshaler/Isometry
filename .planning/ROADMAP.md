# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management -- no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync. v4.2 cleans up build pipeline, fills UX gaps (empty states, keyboard shortcuts, visual polish), hardens stability, and validates end-to-end ETL across all sources and views.

## Milestones

- ✅ **v0.1 Data Foundation** -- Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** -- Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** -- Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** -- Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** -- Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** -- Phases 15-27 (shipped 2026-03-05)
- ✅ **v4.0 Native ETL** -- Phases 33-36 (shipped 2026-03-06)
- ✅ **v3.1 SuperStack** -- Phases 28-32 (shipped 2026-03-06)
- ✅ **v4.1 Sync + Audit** -- Phases 37-41 (shipped 2026-03-07)
- 🚧 **v4.2 Polish + QoL** -- Phases 42-47 (in progress)

## Phases

<details>
<summary>✅ v0.1 Data Foundation (Phases 1-2) -- SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) -- completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.5 Providers + Views (Phases 4-6) -- SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) -- completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) -- completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.0 Web Runtime (Phases 3, 7) -- SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) -- completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) -- completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 ETL Importers (Phases 8-10) -- SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) -- completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) -- completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) -- completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.0 Native Shell (Phases 11-14) -- SHIPPED 2026-03-03</summary>

- [x] Phase 11: Xcode Shell + WKURLSchemeHandler (2/2 plans) -- completed 2026-03-02
- [x] Phase 12: Bridge + Data Persistence (3/3 plans) -- completed 2026-03-03
- [x] Phase 13: Native Chrome + File Import (3/3 plans) -- completed 2026-03-03
- [x] Phase 14: iCloud + StoreKit Tiers (3/3 plans) -- completed 2026-03-03

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.0 SuperGrid Complete (Phases 15-27) -- SHIPPED 2026-03-05</summary>

- [x] Phase 15: PAFVProvider Stacked Axes (2/2 plans) -- completed 2026-03-04
- [x] Phase 16: SuperGridQuery Worker Wiring (2/2 plans) -- completed 2026-03-04
- [x] Phase 17: SuperGrid Dynamic Axis Reads (2/2 plans) -- completed 2026-03-04
- [x] Phase 18: SuperDynamic (2/2 plans) -- completed 2026-03-04
- [x] Phase 19: SuperPosition + SuperZoom (3/3 plans) -- completed 2026-03-04
- [x] Phase 20: SuperSize (2/2 plans) -- completed 2026-03-05
- [x] Phase 21: SuperSelect (4/4 plans) -- completed 2026-03-05
- [x] Phase 22: SuperDensity (3/3 plans) -- completed 2026-03-05
- [x] Phase 23: SuperSort (3/3 plans) -- completed 2026-03-05
- [x] Phase 24: SuperFilter (3/3 plans) -- completed 2026-03-05
- [x] Phase 25: SuperSearch (3/3 plans) -- completed 2026-03-05
- [x] Phase 26: SuperTime (3/3 plans) -- completed 2026-03-05
- [x] Phase 27: SuperCards + Polish (3/3 plans) -- completed 2026-03-05

See: `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v4.0 Native ETL (Phases 33-36) -- SHIPPED 2026-03-06</summary>

- [x] Phase 33: Native ETL Foundation (3/3 plans) -- completed 2026-03-06
- [x] Phase 34: Reminders + Calendar Adapters (3/3 plans) -- completed 2026-03-06
- [x] Phase 35: Notes Adapter -- Title + Metadata (1/1 plan) -- completed 2026-03-06
- [x] Phase 36: Notes Content Extraction (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v3.1 SuperStack (Phases 28-32) -- SHIPPED 2026-03-06</summary>

- [x] Phase 28: N-Level Foundation (3/3 plans) -- completed 2026-03-05
- [x] Phase 29: Multi-Level Row Headers (2/2 plans) -- completed 2026-03-05
- [x] Phase 30: Collapse System (3/3 plans) -- completed 2026-03-06
- [x] Phase 31: Drag Reorder (2/2 plans) -- completed 2026-03-06
- [x] Phase 32: Polish and Performance (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v3.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v4.1 Sync + Audit (Phases 37-41) -- SHIPPED 2026-03-07</summary>

- [x] Phase 37: SuperAudit (3/3 plans) -- completed 2026-03-07
- [x] Phase 38: Virtual Scrolling (2/2 plans) -- completed 2026-03-07
- [x] Phase 39: CloudKit Architecture (3/3 plans) -- completed 2026-03-07
- [x] Phase 40: CloudKit Card Sync (2/2 plans) -- completed 2026-03-07
- [x] Phase 41: CloudKit Connection Sync + Polish (2/2 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.1-ROADMAP.md` for full details.

</details>

### 🚧 v4.2 Polish + QoL (In Progress)

**Milestone Goal:** Clean up build pipeline, fill UX gaps (empty states, keyboard shortcuts, visual polish), harden stability, and validate end-to-end ETL across all sources and views -- dev-ready foundation for next feature milestone.

- [ ] **Phase 42: Build Health** - Fix pre-existing test failures, TS strict mode, Biome linting, Xcode build phase, provisioning profile, CI pipeline
- [ ] **Phase 43: Empty States + First Launch** - Contextual empty states for all 9 views, welcome panel, filter-cleared messaging, density-aware
- [ ] **Phase 44: Keyboard Shortcuts + Navigation** - ShortcutRegistry, Cmd+1-9 view switching, macOS View menu, help overlay
- [ ] **Phase 45: Visual Polish** - Design tokens, typography scale, toolbar consistency, focus-visible keyboard navigation
- [ ] **Phase 46: Stability + Error Handling** - Error categorization with recovery actions, JSON parser fix, undo/redo toast
- [ ] **Phase 47: ETL Validation** - End-to-end testing across all 9 sources and 9 views, error messaging, dedup verification

## Phase Details

### Phase 42: Build Health
**Goal**: Developer can trust the build pipeline -- zero test failures, zero type errors, automated linting, working native build, and CI prevents regressions
**Depends on**: Nothing (first phase of v4.2)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, STAB-02
**Success Criteria** (what must be TRUE):
  1. `npx tsc --noEmit` exits with zero errors across all source and test files
  2. `npx biome check` exits with zero errors on all TypeScript source files
  3. `npx vitest --run` passes with zero pre-existing failures (SuperGridSizer + handler tests fixed)
  4. Xcode builds the native app without npm Run Script build phase errors
  5. GitHub Actions CI workflow runs typecheck, lint, and tests on every push
**Plans:** 1/3 plans executed
Plans:
- [ ] 42-01-PLAN.md -- Install Biome, configure lint/format, bulk reformat, verify tsc + vitest
- [ ] 42-02-PLAN.md -- Fix Xcode Run Script input path, provisioning profile checkpoint
- [ ] 42-03-PLAN.md -- Create GitHub Actions CI workflow, branch protection

### Phase 43: Empty States + First Launch
**Goal**: Users always see helpful context when no data is visible -- whether they just launched for the first time, filtered everything out, or hit a view-specific edge case
**Depends on**: Phase 42
**Requirements**: EMPTY-01, EMPTY-02, EMPTY-03, EMPTY-04
**Success Criteria** (what must be TRUE):
  1. User sees a welcome panel with Import File and Import from Mac CTAs when the database has zero cards
  2. User sees "No cards match filters" with a Clear Filters action when filters hide all results
  3. Each of the 9 views shows a view-specific empty message relevant to that view type (e.g., Network says "No connections found", Calendar says "No dated cards")
  4. SuperGrid explains when density settings hide all visible rows
**Plans**: TBD

### Phase 44: Keyboard Shortcuts + Navigation
**Goal**: Power users can navigate the entire app from the keyboard -- switch views instantly, discover all shortcuts, and never fight conflicting key bindings
**Depends on**: Phase 42
**Requirements**: KEYS-01, KEYS-02, KEYS-03, KEYS-04
**Success Criteria** (what must be TRUE):
  1. User can press Cmd+1 through Cmd+9 to switch between the 9 views (both in web dev mode and native app)
  2. macOS menu bar has a View menu listing all 9 views with keyboard shortcut indicators
  3. User can press ? to open a global keyboard shortcut reference overlay listing all bindings
  4. All keyboard shortcut handlers are centralized through ShortcutRegistry with consistent input field guards (no firing when typing in filter/search inputs)
**Plans**: TBD

### Phase 45: Visual Polish
**Goal**: The app looks visually consistent -- no hardcoded colors or font sizes, toolbar layout is predictable, and keyboard users can see where focus is
**Depends on**: Phase 42
**Requirements**: VISU-01, VISU-02, VISU-03, VISU-04
**Success Criteria** (what must be TRUE):
  1. All hardcoded rgba/hex color values in JavaScript inline styles are replaced with CSS custom property (design token) references
  2. All hardcoded font-size values are replaced with semantic typography scale tokens (--text-xs through --text-lg)
  3. Toolbar shows consistent global items (search, density, audit) across all views, with per-view items appearing contextually
  4. All interactive elements (buttons, inputs, tabs, cells) show visible focus rings when navigated via keyboard (CSS :focus-visible)
**Plans**: TBD

### Phase 46: Stability + Error Handling
**Goal**: Users see clear, actionable error messages instead of raw exceptions, and get confirmation feedback on undo/redo actions
**Depends on**: Phase 42
**Requirements**: STAB-01, STAB-03, STAB-04
**Success Criteria** (what must be TRUE):
  1. Error banner shows categorized user-friendly messages (import error, parse error, database error) with specific recovery actions instead of raw error strings
  2. JSON parser surfaces a clear warning when input format is unrecognized (lists actual top-level keys found instead of silently returning 0 cards)
  3. Undo/redo shows a brief toast with the action description (e.g., "Undid: Move card to Done")
**Plans**: TBD

### Phase 47: ETL Validation
**Goal**: Every import source produces correct data that renders correctly in every view -- no silent data loss, no rendering failures, no dedup regressions
**Depends on**: Phase 42, Phase 43, Phase 45, Phase 46
**Requirements**: ETLV-01, ETLV-02, ETLV-03, ETLV-04, ETLV-05
**Success Criteria** (what must be TRUE):
  1. All 6 file-based sources (Apple Notes JSON, Markdown, Excel, CSV, JSON, HTML) import successfully with correct card and connection output
  2. All 3 native macOS sources (Apple Notes, Reminders, Calendar) import successfully with correct card output
  3. Imported data renders correctly in all 9 views across high-value source/view combinations (no blank views, no missing fields, no layout breaks)
  4. Import errors surface clear, actionable messages specific to each source type (not generic "import failed")
  5. Re-importing the same source via DedupEngine correctly classifies cards as existing (no duplicates created)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-41 complete across 9 milestones. Phases 42-47 are v4.2 Polish + QoL.

Note: Phases 43, 44, 45, 46 can execute in parallel after Phase 42. Phase 47 depends on all preceding phases.

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
| 31. Drag Reorder | v3.1 | 2/2 | Complete | 2026-03-06 |
| 32. Polish and Performance | v3.1 | 2/2 | Complete | 2026-03-06 |
| 33. Native ETL Foundation | v4.0 | 3/3 | Complete | 2026-03-06 |
| 34. Reminders + Calendar Adapters | v4.0 | 3/3 | Complete | 2026-03-06 |
| 35. Notes Adapter -- Title + Metadata | v4.0 | 1/1 | Complete | 2026-03-06 |
| 36. Notes Content Extraction | v4.0 | 2/2 | Complete | 2026-03-06 |
| 37. SuperAudit | v4.1 | 3/3 | Complete | 2026-03-07 |
| 38. Virtual Scrolling | v4.1 | 2/2 | Complete | 2026-03-07 |
| 39. CloudKit Architecture | v4.1 | 3/3 | Complete | 2026-03-07 |
| 40. CloudKit Card Sync | v4.1 | 2/2 | Complete | 2026-03-07 |
| 41. CloudKit Connection Sync + Polish | v4.1 | 2/2 | Complete | 2026-03-07 |
| 42. Build Health | 1/3 | In Progress|  | - |
| 43. Empty States + First Launch | v4.2 | 0/0 | Not started | - |
| 44. Keyboard Shortcuts + Navigation | v4.2 | 0/0 | Not started | - |
| 45. Visual Polish | v4.2 | 0/0 | Not started | - |
| 46. Stability + Error Handling | v4.2 | 0/0 | Not started | - |
| 47. ETL Validation | v4.2 | 0/0 | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell shipped: 2026-03-03*
*v3.0 SuperGrid Complete shipped: 2026-03-05*
*v4.0 Native ETL shipped: 2026-03-06*
*v3.1 SuperStack shipped: 2026-03-06*
*v4.1 Sync + Audit shipped: 2026-03-07*
*v4.2 Polish + QoL roadmap created: 2026-03-07*
