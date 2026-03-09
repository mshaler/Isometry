# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management -- no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync. v4.2 cleans up build pipeline, fills UX gaps (empty states, keyboard shortcuts, visual polish), hardens stability, and validates end-to-end ETL across all sources and views. v4.3 fixes runtime correctness bugs identified by Codex code review. v4.4 makes the app fully accessible, discoverable, and theme-aware -- command palette as universal entry point, full WCAG 2.1 AA compliance, light/dark/system theming, and guided empty states with sample data. v5.0 replaces the flat view layout with a Figma-designed Workbench shell -- a vertical stack of collapsible explorer panels (Properties, Projection, Visual, LATCH, Notebook) that drive SuperGrid through existing providers with zero new dependencies. v5.1 makes SuperGrid's spreadsheet mode perceptually read as a genuine spreadsheet through CSS visual baseline tokens, value-first cell rendering, row index gutter, and active cell focus model. v5.2 adds SQL-driven aggregate calculations to SuperGrid footer rows, completes the Workbench notebook with formatting toolbar + embedded D3 charts + database persistence, and ships LATCH Phase B subpanes (histogram scrubbers + category chips).

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
- **v5.2 SuperCalc + Workbench Phase B** -- Phases 62-67 (in progress)

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

### v5.2 SuperCalc + Workbench Phase B (Phases 62-67)

- [x] **Phase 62: SuperCalc Footer Rows** - SQL aggregate footer rows (SUM/AVG/COUNT/MIN/MAX) per group in SuperGrid with Workbench configuration panel (completed 2026-03-09)
- [x] **Phase 63: Notebook Formatting Toolbar** - Undo-safe Markdown formatting buttons (bold/italic/heading/list/link) above textarea (completed 2026-03-09)
- [x] **Phase 64: Notebook Persistence** - Per-card notebook scoping with ui_state save/load and checkpoint inclusion (completed 2026-03-09)
- [ ] **Phase 65: D3 Chart Blocks** - Embedded D3 mini-visualizations in notebook preview reflecting current filtered data
- [ ] **Phase 66: LATCH Histogram Scrubbers** - D3 histogram bins with d3.brushX drag-to-filter range selection in LATCH explorer
- [ ] **Phase 67: Category Chips** - Clickable chip pills with count badges for categorical multi-select filtering

## Phase Details

### Phase 62: SuperCalc Footer Rows
**Goal**: Users see live aggregate calculations (SUM, AVG, COUNT, MIN, MAX) at the bottom of each row group in SuperGrid, configurable per column via the Workbench panel
**Depends on**: Nothing (independent of other v5.2 features; builds on existing SuperGrid, PAFVProvider, and Worker infrastructure)
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04, CALC-05, CALC-06
**Success Criteria** (what must be TRUE):
  1. User sees a footer row at the bottom of each row group displaying aggregate values for numeric columns
  2. User can change the aggregate function (SUM/AVG/COUNT/MIN/MAX) for any column via a Workbench panel section, with text columns defaulting to COUNT
  3. Footer rows are visually distinct from data rows (different background, bold text) and remain visible during virtual scrolling
  4. Footer row values update automatically when filters, density settings, or axis assignments change -- no manual refresh needed
  5. Aggregate computation runs as a separate Worker query (supergrid:calc) using SQL GROUP BY, parallel with the cell data query
**Plans**: 3 plans

Plans:
- [ ] 62-01-PLAN.md — Worker protocol + calc handler + SQL aggregation query builder
- [ ] 62-02-PLAN.md — CalcExplorer panel + WorkbenchShell wiring + persistence
- [ ] 62-03-PLAN.md — SuperGrid footer rendering + CSS styling + live updates

### Phase 63: Notebook Formatting Toolbar
**Goal**: Users can format notebook Markdown content using toolbar buttons without losing undo history
**Depends on**: Nothing (independent; builds on existing NotebookExplorer)
**Requirements**: NOTE-01, NOTE-02
**Success Criteria** (what must be TRUE):
  1. User sees a toolbar row above the notebook textarea with buttons for bold, italic, heading, list, and link formatting
  2. Clicking a toolbar button wraps the selected text (or inserts at cursor) with the correct Markdown syntax and the result appears in the live preview
  3. User can Cmd+Z after any toolbar action to undo the formatting insertion -- the browser undo stack is preserved across all toolbar operations
**Plans**: 1 plan

Plans:
- [ ] 63-01-PLAN.md — Undo-safe formatting engine + toolbar DOM + CSS styling + tests

### Phase 64: Notebook Persistence
**Goal**: Users have per-card notebook content that persists across reloads and syncs via the existing CloudKit checkpoint flow
**Depends on**: Phase 63 (content editing must exist before persistence matters)
**Requirements**: NOTE-03, NOTE-04, NOTE-05
**Success Criteria** (what must be TRUE):
  1. User can select different cards and see each card's own notebook content load automatically -- switching cards swaps the notebook text
  2. Notebook Markdown is persisted to the ui_state table (notebook:{cardId} key convention) with debounced auto-save
  3. Notebook content survives a full app reload -- opening the app restores the last-saved notebook for the selected card
  4. Notebook content is included in the database checkpoint, meaning it flows through the existing CloudKit sync without any new sync infrastructure
**Plans**: TBD

Plans:
- [ ] 64-01: TBD

### Phase 65: D3 Chart Blocks
**Goal**: Users can embed live D3 mini-visualizations in notebook preview that reflect the current SuperGrid filtered data
**Depends on**: Phase 63 (toolbar provides chart block insertion button), Phase 64 (chart content must persist across reloads)
**Requirements**: NOTE-06, NOTE-07, NOTE-08
**Success Criteria** (what must be TRUE):
  1. User can insert a chart block using fenced syntax in the notebook textarea and see a rendered D3 SVG chart in the preview panel
  2. Chart blocks reflect the current filtered SuperGrid data -- applying a filter updates the chart visualization
  3. Chart SVG is rendered safely via two-pass approach: DOMPurify sanitizes placeholder divs first, then D3 mounts SVG programmatically into the placeholders -- no XSS vectors from user-authored chart syntax
  4. Custom marked renderer extension handles chart fenced code blocks without breaking standard code block rendering for other languages
**Plans**: TBD

Plans:
- [ ] 65-01: TBD
- [ ] 65-02: TBD

### Phase 66: LATCH Histogram Scrubbers
**Goal**: Users can see value distributions and drag-to-filter numeric/date ranges directly in the LATCH explorer panel
**Depends on**: Nothing (independent; builds on existing LatchExplorers and FilterProvider)
**Requirements**: LTPB-01, LTPB-02
**Success Criteria** (what must be TRUE):
  1. User sees a mini histogram (D3 SVG bar chart) in the LATCH explorer for numeric and date fields, showing the distribution of values across bins
  2. User can drag a brush selection over histogram bars to filter the SuperGrid to that range, with the grid updating live as the brush moves
  3. Brush selection integrates with FilterProvider as an atomic range filter replacement (not compounding with existing range filters on the same field)
**Plans**: TBD

Plans:
- [ ] 66-01: TBD

### Phase 67: Category Chips
**Goal**: Users can quickly multi-select categorical filter values using clickable chip pills instead of checkboxes
**Depends on**: Nothing (independent; builds on existing LatchExplorers and FilterProvider)
**Requirements**: LTPB-03, LTPB-04
**Success Criteria** (what must be TRUE):
  1. User sees clickable chip pills (instead of checkboxes) for categorical fields with cardinality under 20 in the LATCH explorer
  2. Each chip displays a count badge showing how many cards match that category value
  3. User can click chips to toggle multi-select filtering, with the SuperGrid updating live through the existing FilterProvider
**Plans**: TBD

Plans:
- [ ] 67-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-61 complete across 15 milestones. Phase 53 is reserved. Phases 62-67 are v5.2. Note: Phases 62, 63, 66, 67 have zero interdependencies and can parallelize. Phase 64 depends on 63. Phase 65 depends on 63 and 64.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-48 | v0.1-v4.3 | 145/145 | Complete | 2026-02-28 to 2026-03-07 |
| 49-52 | v4.4 | 10/10 | Complete | 2026-03-08 |
| 54-57 | v5.0 | 11/11 | Complete | 2026-03-08 |
| 58-61 | v5.1 | 7/7 | Complete | 2026-03-08 |
| 62. SuperCalc Footer Rows | 3/3 | Complete    | 2026-03-09 | - |
| 63. Notebook Formatting Toolbar | 1/1 | Complete    | 2026-03-09 | - |
| 64. Notebook Persistence | 1/1 | Complete   | 2026-03-09 | - |
| 65. D3 Chart Blocks | v5.2 | 0/TBD | Not started | - |
| 66. LATCH Histogram Scrubbers | v5.2 | 0/TBD | Not started | - |
| 67. Category Chips | v5.2 | 0/TBD | Not started | - |

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
*v5.2 SuperCalc + Workbench Phase B roadmap created: 2026-03-09*
