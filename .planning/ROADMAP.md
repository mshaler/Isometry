# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management -- no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync. v4.2 cleans up build pipeline, fills UX gaps (empty states, keyboard shortcuts, visual polish), hardens stability, and validates end-to-end ETL across all sources and views. v4.3 fixes runtime correctness bugs identified by Codex code review. v4.4 makes the app fully accessible, discoverable, and theme-aware -- command palette as universal entry point, full WCAG 2.1 AA compliance, light/dark/system theming, and guided empty states with sample data. v5.0 replaces the flat view layout with a Figma-designed Workbench shell -- a vertical stack of collapsible explorer panels (Properties, Projection, Visual, LATCH, Notebook) that drive SuperGrid through existing providers with zero new dependencies. v5.1 makes SuperGrid's spreadsheet mode perceptually read as a genuine spreadsheet through CSS visual baseline tokens, value-first cell rendering, row index gutter, and active cell focus model. v5.2 adds SQL-driven aggregate calculations to SuperGrid footer rows, completes the Workbench notebook with formatting toolbar + embedded D3 charts + database persistence, and ships LATCH Phase B subpanes (histogram scrubbers + category chips). v5.3 replaces all hardcoded schema assumptions with runtime PRAGMA introspection, fixes SVG and deleted_at bugs, migrates persisted state to handle dynamic fields, and enables user-configurable LATCH family mappings.

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
- ✅ **v4.2 Polish + QoL** -- Phases 42-47 (shipped 2026-03-07)
- ✅ **v4.3 Review Fixes** -- Phase 48 (shipped 2026-03-07)
- ✅ **v4.4 UX Complete** -- Phases 49-52 (shipped 2026-03-08)
- ✅ **v5.0 Designer Workbench** -- Phases 54-57 (shipped 2026-03-08)
- ✅ **v5.1 SuperGrid Spreadsheet UX** -- Phases 58-61 (shipped 2026-03-08)
- ✅ **v5.2 SuperCalc + Workbench Phase B** -- Phases 62-68 (shipped 2026-03-10)
- 🚧 **v5.3 Dynamic Schema** -- Phases 69-73 (in progress)

## Phases

<details>
<summary>v0.1 Data Foundation (Phases 1-2) -- SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) -- completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.5 Providers + Views (Phases 4-6) -- SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) -- completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) -- completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.0 Web Runtime (Phases 3, 7) -- SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) -- completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) -- completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 ETL Importers (Phases 8-10) -- SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) -- completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) -- completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) -- completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v2.0 Native Shell (Phases 11-14) -- SHIPPED 2026-03-03</summary>

- [x] Phase 11: Xcode Shell + WKURLSchemeHandler (2/2 plans) -- completed 2026-03-02
- [x] Phase 12: Bridge + Data Persistence (3/3 plans) -- completed 2026-03-03
- [x] Phase 13: Native Chrome + File Import (3/3 plans) -- completed 2026-03-03
- [x] Phase 14: iCloud + StoreKit Tiers (3/3 plans) -- completed 2026-03-03

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v3.0 SuperGrid Complete (Phases 15-27) -- SHIPPED 2026-03-05</summary>

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
<summary>v4.0 Native ETL (Phases 33-36) -- SHIPPED 2026-03-06</summary>

- [x] Phase 33: Native ETL Foundation (3/3 plans) -- completed 2026-03-06
- [x] Phase 34: Reminders + Calendar Adapters (3/3 plans) -- completed 2026-03-06
- [x] Phase 35: Notes Adapter -- Title + Metadata (1/1 plan) -- completed 2026-03-06
- [x] Phase 36: Notes Content Extraction (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v3.1 SuperStack (Phases 28-32) -- SHIPPED 2026-03-06</summary>

- [x] Phase 28: N-Level Foundation (3/3 plans) -- completed 2026-03-05
- [x] Phase 29: Multi-Level Row Headers (2/2 plans) -- completed 2026-03-05
- [x] Phase 30: Collapse System (3/3 plans) -- completed 2026-03-06
- [x] Phase 31: Drag Reorder (2/2 plans) -- completed 2026-03-06
- [x] Phase 32: Polish and Performance (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v3.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.1 Sync + Audit (Phases 37-41) -- SHIPPED 2026-03-07</summary>

- [x] Phase 37: SuperAudit (3/3 plans) -- completed 2026-03-07
- [x] Phase 38: Virtual Scrolling (2/2 plans) -- completed 2026-03-07
- [x] Phase 39: CloudKit Architecture (3/3 plans) -- completed 2026-03-07
- [x] Phase 40: CloudKit Card Sync (2/2 plans) -- completed 2026-03-07
- [x] Phase 41: CloudKit Connection Sync + Polish (2/2 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.2 Polish + QoL (Phases 42-47) -- SHIPPED 2026-03-07</summary>

- [x] Phase 42: Build Health (3/3 plans) -- completed 2026-03-07
- [x] Phase 43: Empty States + First Launch (2/2 plans) -- completed 2026-03-07
- [x] Phase 44: Keyboard Shortcuts + Navigation (2/2 plans) -- completed 2026-03-07
- [x] Phase 45: Visual Polish (3/3 plans) -- completed 2026-03-07
- [x] Phase 46: Stability + Error Handling (2/2 plans) -- completed 2026-03-07
- [x] Phase 47: ETL Validation (3/3 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.3 Review Fixes (Phase 48) -- SHIPPED 2026-03-07</summary>

- [x] Phase 48: Review Fixes (2/2 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.3-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.4 UX Complete (Phases 49-52) -- SHIPPED 2026-03-08</summary>

- [x] Phase 49: Theme System (3/3 plans) -- completed 2026-03-08
- [x] Phase 50: Accessibility (3/3 plans) -- completed 2026-03-08
- [x] Phase 51: Command Palette (2/2 plans) -- completed 2026-03-08
- [x] Phase 52: Sample Data + Empty States (2/2 plans) -- completed 2026-03-08

See: `.planning/milestones/v4.4-ROADMAP.md` for full details.

</details>

<details>
<summary>v5.0 Designer Workbench (Phases 54-57) -- SHIPPED 2026-03-08</summary>

- [x] Phase 54: Shell Scaffolding (3/3 plans) -- completed 2026-03-08
- [x] Phase 55: Properties + Projection Explorers (4/4 plans) -- completed 2026-03-08
- [x] Phase 56: Visual + LATCH Explorers (2/2 plans) -- completed 2026-03-08
- [x] Phase 57: Notebook Explorer + Polish (2/2 plans) -- completed 2026-03-08

See: `.planning/milestones/v5.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v5.1 SuperGrid Spreadsheet UX (Phases 58-61) -- SHIPPED 2026-03-08</summary>

- [x] Phase 58: CSS Visual Baseline (2/2 plans) -- completed 2026-03-08
- [x] Phase 59: Value-First Rendering (2/2 plans) -- completed 2026-03-08
- [x] Phase 60: Row Index Gutter (1/1 plan) -- completed 2026-03-08
- [x] Phase 61: Active Cell Focus (2/2 plans) -- completed 2026-03-09

See: `.planning/milestones/v5.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v5.2 SuperCalc + Workbench Phase B (Phases 62-68) -- SHIPPED 2026-03-10</summary>

- [x] Phase 62: SuperCalc Footer Rows (3/3 plans) -- completed 2026-03-09
- [x] Phase 63: Notebook Formatting Toolbar (1/1 plan) -- completed 2026-03-09
- [x] Phase 64: Notebook Persistence (1/1 plan) -- completed 2026-03-09
- [x] Phase 65: D3 Chart Blocks (2/2 plans) -- completed 2026-03-10
- [x] Phase 66: LATCH Histogram Scrubbers (3/3 plans) -- completed 2026-03-10
- [x] Phase 67: Category Chips (1/1 plan) -- completed 2026-03-10
- [x] Phase 68: E2E Critical-Path Tests Tier 3 (2/2 plans) -- completed 2026-03-10

See: `.planning/milestones/v5.2-ROADMAP.md` for full details.

</details>

### v5.3 Dynamic Schema (In Progress)

**Milestone Goal:** Replace all hardcoded schema assumptions with runtime PRAGMA introspection, fix immediate bugs, and enable user-configurable LATCH mappings.

- [x] **Phase 69: Bug Fixes** - Fix SVG letter-spacing inheritance and deleted_at null safety (completed 2026-03-11)
- [x] **Phase 70: SchemaProvider Core + Worker Integration** - Runtime schema introspection via PRAGMA table_info with LATCH classification
- [x] **Phase 71: Dynamic Schema Integration** - Replace 15 hardcoded field lists across 8 files with SchemaProvider reads (completed 2026-03-11)
- [x] **Phase 72: State Persistence Migration** - Graceful degradation for persisted state referencing unknown fields (completed 2026-03-11)
- [x] **Phase 73: User-Configurable LATCH Mappings** - User overrides for LATCH family assignment and axis-enabled state (completed 2026-03-11)

## Phase Details

### Phase 69: Bug Fixes
**Goal**: SVG text renders correctly and deleted_at is null-safe across all code paths
**Depends on**: Nothing (independent fixes)
**Requirements**: BUGF-01, BUGF-02, BUGF-03, BUGF-04
**Success Criteria** (what must be TRUE):
  1. SVG text elements in chart blocks and histogram scrubbers render without letter-spacing artifacts in Safari, Chrome, and Firefox
  2. Cards with null deleted_at can be accessed in all non-SQL code paths without null dereference errors
  3. Soft-delete filtering (deleted_at IS NULL) continues to correctly exclude deleted cards from active queries
**Plans**: 2 plans (Wave 1 parallel)
- [x] 69-01-PLAN.md — Global SVG text CSS reset + E2E assertions (BUGF-01, BUGF-02)
- [x] 69-02-PLAN.md — Fix deleted_at connection queries + regression tests (BUGF-03, BUGF-04)

### Phase 70: SchemaProvider Core + Worker Integration
**Goal**: Runtime schema metadata is available synchronously before any provider restore or query validation
**Depends on**: Phase 69
**Requirements**: SCHM-01, SCHM-02, SCHM-03, SCHM-04, SCHM-05, SCHM-06, SCHM-07
**Success Criteria** (what must be TRUE):
  1. SchemaProvider exposes typed column metadata (name, type, nullability, LATCH family) derived from PRAGMA table_info(cards) at Worker init
  2. Schema metadata arrives in the Worker ready message -- available before StateManager.restore() runs
  3. SchemaProvider classifies columns into LATCH families (Location/Alphabet/Time/Category/Hierarchy) via name pattern and type affinity heuristics
  4. Worker-side and main-thread validation sets are independently populated from the same PRAGMA source -- neither depends on the other
  5. Column names containing characters outside [a-zA-Z0-9_] are rejected at introspection time (SQL injection prevention at source)
**Plans**: 1 plan
Plans:
- [ ] 70-01-PLAN.md — Types + classifier + Worker PRAGMA + SchemaProvider + allowlist delegation

### Phase 71: Dynamic Schema Integration
**Goal**: Every field list, allowlist, and type constraint in the codebase reads from SchemaProvider instead of hardcoded constants
**Depends on**: Phase 70
**Requirements**: DYNM-01, DYNM-02, DYNM-03, DYNM-04, DYNM-05, DYNM-06, DYNM-07, DYNM-08, DYNM-09, DYNM-10, DYNM-11, DYNM-12, DYNM-13
**Success Criteria** (what must be TRUE):
  1. allowlist.ts validation functions (validateAxisField, validateFilterField) delegate to SchemaProvider with hardcoded fallback during bootstrap -- D-003 security boundary preserved
  2. PropertiesExplorer, ProjectionExplorer, CalcExplorer, and LatchExplorers all render field lists from SchemaProvider -- adding a column to the cards table causes it to appear in these panels without code changes
  3. CalcExplorer offers SUM/AVG/MIN/MAX for numeric columns and COUNT only for text columns, determined by SchemaProvider type classification
  4. Zero frozen field-list literals remain in source code outside of test fixtures -- verified by grep audit (DYNM-13)
  5. AxisField/FilterField TypeScript types accept dynamic fields at flow-through boundaries while preserving literal unions for known fields
**Plans**: 4 plans (Wave 1: 01+02 parallel, Wave 2: 03+04 parallel)
Plans:
- [ ] 71-01-PLAN.md — Core type widening + LatchFamily mapping bridge (DYNM-01, DYNM-02, DYNM-03, DYNM-04)
- [ ] 71-02-PLAN.md — PAFVProvider + SuperDensityProvider SchemaProvider integration (DYNM-11, DYNM-12)
- [ ] 71-03-PLAN.md — UI Explorer migrations: Properties, Projection, Calc, Latch, ChartRenderer (DYNM-05, DYNM-06, DYNM-07, DYNM-08, DYNM-09)
- [ ] 71-04-PLAN.md — SuperGrid + SuperGridQuery migration + DYNM-13 grep audit (DYNM-10, DYNM-13)

### Phase 72: State Persistence Migration
**Goal**: Persisted state from prior sessions degrades gracefully when the schema has changed
**Depends on**: Phase 71
**Requirements**: PRST-01, PRST-02, PRST-03, PRST-04
**Success Criteria** (what must be TRUE):
  1. StateManager.restore() filters out unknown fields from persisted state before passing to provider setState() -- no provider receives field names that do not exist in the current schema
  2. FilterProvider and PAFVProvider remove invalid individual filters/axes instead of resetting all state when encountering unknown fields
  3. AliasProvider preserves aliases for fields not in the current schema -- aliases are never deleted by schema changes
**Plans**: 2 plans (Wave 1 parallel)
Plans:
- [ ] 72-01-PLAN.md -- StateManager schema migration + integration tests (PRST-01, PRST-02, PRST-03)
- [ ] 72-02-PLAN.md -- AliasProvider orphan preservation (PRST-04)

### Phase 73: User-Configurable LATCH Mappings
**Goal**: Users can override LATCH family assignments and field visibility, with overrides persisted across sessions
**Depends on**: Phase 72
**Requirements**: UCFG-01, UCFG-02, UCFG-03, UCFG-04, UCFG-05
**Success Criteria** (what must be TRUE):
  1. User can reassign any column to a different LATCH family (e.g., move "priority" from Hierarchy to Category) and the change takes effect immediately in LatchExplorers
  2. User can disable individual fields from appearing in PropertiesExplorer and ProjectionExplorer available pools
  3. LATCH family overrides persist across session restarts via ui_state (Tier 2) and survive app relaunch
  4. User overrides always win over heuristic classification -- SchemaProvider merges both with explicit priority
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-68 complete across 16 milestones. Phase 53 is reserved. v5.3 adds Phases 69-73.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-48 | v0.1-v4.3 | 145/145 | Complete | 2026-02-28 to 2026-03-07 |
| 49-52 | v4.4 | 10/10 | Complete | 2026-03-08 |
| 54-57 | v5.0 | 11/11 | Complete | 2026-03-08 |
| 58-61 | v5.1 | 7/7 | Complete | 2026-03-08 |
| 62-68 | v5.2 | 13/13 | Complete | 2026-03-10 |
| 69. Bug Fixes | v5.3 | Complete    | 2026-03-11 | 2026-03-11 |
| 70. SchemaProvider Core | v5.3 | Complete    | 2026-03-11 | 2026-03-11 |
| 71. Dynamic Integration | 4/4 | Complete    | 2026-03-11 | - |
| 72. Persistence Migration | 2/2 | Complete    | 2026-03-11 | - |
| 73. LATCH Config | 3/3 | Complete    | 2026-03-11 | - |

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
*v4.2 Polish + QoL shipped: 2026-03-07*
*v4.3 Review Fixes shipped: 2026-03-07*
*v4.4 UX Complete shipped: 2026-03-08*
*v5.0 Designer Workbench shipped: 2026-03-08*
*v5.1 SuperGrid Spreadsheet UX shipped: 2026-03-08*
*v5.2 SuperCalc + Workbench Phase B shipped: 2026-03-10*
*v5.3 Dynamic Schema roadmap created: 2026-03-10*
