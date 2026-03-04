# Progress Snapshot — 2026-03-03

*Comprehensive gap analysis: shipped roadmap vs full product vision. Created after v2.0 milestone to inform next milestone planning.*

---

## 1. Roadmap Execution Summary

**Status: 100% of defined roadmap shipped.**

| Milestone | Phases | Plans | Requirements | Tests | LOC | Timeline | Shipped |
|-----------|--------|-------|--------------|-------|-----|----------|---------|
| v0.1 Data Foundation | 1-2 | 10 | 25/25 | 151 | 3,378 TS | 1 day | 2026-02-28 |
| v0.5 Providers + Views | 4-6 | 14 | 31/31 | 774 | 20,468 TS | 1 day | 2026-02-28 |
| v1.0 Web Runtime | 3, 7 | 7 | ~14 | 897 | 24,298 TS | 2 days | 2026-03-01 |
| v1.1 ETL Importers | 8-10 | 12 | 19/19 | ~1,433 | 70,123 TS | 1 day | 2026-03-02 |
| v2.0 Native Shell | 11-14 | 11 | 28/28 | ~1,447 | 34,211 TS + 2,573 Swift | 2 days | 2026-03-03 |
| **Totals** | **14** | **54** | **~131** | **~1,447** | **34,211 TS + 2,573 Swift** | **5 days** | |

---

## 2. Original Spec Requirements vs Shipped

### v1 Requirements (REQUIREMENTS-v5-CORRECTED.md — 67 defined)

| Req Group | Count | Shipped In | Status |
|-----------|-------|------------|--------|
| DB-01..06 (Database Foundation) | 6 | v0.1 | ✅ All validated |
| CARD-01..06 (Card CRUD) | 6 | v0.1 | ✅ All validated |
| CONN-01..05 (Connections) | 5 | v0.1 | ✅ All validated |
| SRCH-01..04 (Core Search) | 4 | v0.1 | ✅ All validated |
| PERF-01..04 (Core Performance) | 4 | v0.1 | ✅ All validated |
| SAFE-01..06 (SQL Safety) | 6 | v0.5 | ✅ All validated |
| PROV-01..07 (Providers) | 7 | v0.5 | ✅ All validated |
| WKBR-01..07 (Worker Bridge) | 7 | v0.5/v1.0 | ✅ All validated |
| VIEW-01..13 (Views) | 13 | v0.5/v1.0 | ⚠️ Gaps below |
| SRCH-05..07 (Search UX) | 3 | v0.5 | ⚠️ Gaps below |
| PERF-05 (SuperGrid render) | 1 | v1.0 | ⚠️ Bench exists, unverified |
| ETL-01..06 (Original ETL) | 6 | v1.1 | ✅ Expanded to ETL-01..19 |
| NSAFE-01..10 (Native Safety) | 10 | — | ⚠️ Superseded (see below) |

### Specific Gaps in v1 Requirements

| Requirement | Spec Says | What Shipped | Gap |
|-------------|-----------|--------------|-----|
| VIEW-01 | SuperGrid with nested PAFV projection | SuperStack algorithm + hardcoded 2-axis grid | Partial — no dynamic PAFV axis wiring |
| VIEW-10 | Table view renders raw data in columns | Not shipped | ❌ Missing view type |
| SRCH-06 | Keyboard navigation (arrows, Enter, Esc) | Not explicitly verified | ⚠️ Unknown |
| SRCH-07 | Faceted search chips (card_type, folder, status, source) | Not implemented | ❌ Missing |
| PERF-05 | SuperGrid render <16ms p95 | Bench file exists, not manually run | ⚠️ Unverified |
| NSAFE-01..10 | CloudKit zones, actor reentrancy, Keychain, WAL, push | v2.0 chose iCloud Documents (not CloudKit zones) | ⚠️ Superseded by different architecture |

### v2 Requirements (Deferred Section)

| Requirement | Status |
|-------------|--------|
| EETL-01: Slack ETL | ❌ Not started |
| EETL-02: Apple Reminders ETL | ❌ Not started |
| EETL-03: Markdown with frontmatter | ✅ Shipped in v1.1 (promoted) |
| EETL-04: Excel/CSV ETL | ✅ Shipped in v1.1 (promoted) |
| SEXT-01: EAV card_properties table | ❌ Deferred per D-008 |
| SEXT-02: Formula fields DSL → AST → SQL | ❌ Not started |
| ADVF-01: Semantic/vector search | ❌ Not started |
| ADVF-02: Block-level editor (Notebook) | ❌ Not started |
| ADVF-03: Search history | ❌ Not started |

---

## 3. Spec Modules vs Implementation

The `v5/Modules/` directory defines **13 modular components**:

| # | Module | Spec | Status | Notes |
|---|--------|------|--------|-------|
| 1 | Cards | Cards.md | ✅ Full | CRUD, soft delete, connections, via_card_id |
| 2 | Views | Views.md | ✅ 9 of 9 views | list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid |
| 3 | Data Explorer | DataExplorer.md | ✅ ETL core | 6 parsers, 3 exporters, dedup, catalog. Missing: CAS, MCP server, browser extensions, share sheets |
| 4 | Properties Explorer | PropertiesExplorer.md | ⚠️ Partial | FilterProvider + PAFVProvider exist, no dedicated FilterNav UI chrome |
| 5 | Projection Explorer | ProjectionExplorer.md | ⚠️ Partial | PAFVProvider exists, no Audit View, no axis picker UI |
| 6 | Time Explorer | TimeExplorer.md | ⚠️ Partial | CalendarView + TimelineView exist, no histogram/slider/zoom/replay controls |
| 7 | Map Explorer | MapExplorer.md | ❌ Not started | No geospatial features |
| 8 | Search Explorer | SearchExplorer.md | ⚠️ Partial | FTS5 search works, no faceted UI, no search history |
| 9 | Graph Explorer | GraphExplorer.md | ⚠️ Partial | BFS/DFS/shortest path. No PageRank, Louvain, Jaccard, Node2Vec |
| 10 | Formula Explorer | FormulaExplorer.md | ❌ Not started | No DSL, no computed fields |
| 11 | Notebook | Notebook.md | ❌ Not started | No card editor, no preview |
| 12 | Interface Builder | InterfaceBuilder.md | ❌ Not started | No app builder, no layout engine |
| 13 | Native Shell | NativeShell.md | ✅ Full | SwiftUI multiplatform, bridge, persistence, iCloud, StoreKit |

**Summary:** 3 fully implemented, 5 partially implemented, 4 not started, 1 N/A (Native Shell is full but took different approach than spec).

---

## 4. SuperGrid Deep Dive

### What's Built (v1.0 Phase 7)

| Component | File | Status |
|-----------|------|--------|
| SuperStackHeader | `src/views/supergrid/SuperStackHeader.ts` (264 LOC) | ✅ Complete algorithm — 1–3 levels, run-length spanning, cardinality guard (max 50), collapsible |
| SuperGrid view | `src/views/SuperGrid.ts` (341 LOC) | ✅ IView lifecycle, D3 data join with key function, count badges, click-to-collapse |
| SuperGridQuery | `src/views/supergrid/SuperGridQuery.ts` (110 LOC) | ✅ Written, 🔌 NOT wired — parameterized GROUP BY SQL builder, dead code path |
| Tests | 3 test files | ✅ 35 tests passing (16 + 14 + 5) + 1 benchmark |

### Current Limitations

- **Hardcoded axes** — columns = `card_type`, rows = `folder` (not PAFVProvider-driven)
- **In-memory filtering** — grid counts from coordinator array, not Worker GROUP BY SQL
- **Single-level defaults** — algorithm handles 3 levels, PAFVProvider doesn't expose stacked axes
- **No interactive controls** — no density sliders, axis pickers, resize handles, filter dropdowns

### SuperGrid Spec Feature Catalog (v5/Modules/SuperGrid.md)

14 features defined. 1 shipped:

| # | Feature | Spec Section | Status | Description |
|---|---------|-------------|--------|-------------|
| 1 | **SuperStack** | 2.1 | ✅ Shipped (v1.0) | Nested PAFV headers with hierarchical spanning |
| 2 | **SuperDynamic** | 2.2 | ❌ Not started | Drag-and-drop axis repositioning across planes |
| 3 | **SuperSize** | 2.3 | ❌ Not started | Direct manipulation cell/header sizing (drag handles) |
| 4 | **SuperZoom** | 2.4 | ❌ Not started | Cartographic navigation (pinned upper-left zoom) |
| 5 | **SuperDensity** | 2.5 | ❌ Not started | Janus 4-level density model (Value/Extent/View/Region) |
| 6 | **SuperSelect** | 2.6 | ❌ Not started | Z-axis aware selection (lasso, cmd+click, header group) |
| 7 | **SuperPosition** | 2.7 | ❌ Not started | Coordinate tracking for polymorphic view transitions |
| 8 | **SuperCards** | 2.8 | ❌ Not started | Generated cards (header cards, aggregation rows) |
| 9 | **SuperCalc** | 2.9 | ❌ Not started | HyperFormula PAFV-scoped spreadsheet calculations |
| 10 | **SuperAudit** | 2.10 | ❌ Not started | Visual distinction of computed vs raw values |
| 11 | **SuperTime** | 2.11 | ❌ Not started | Smart time hierarchy parsing, non-contiguous selection |
| 12 | **SuperSort** | 2.12 | ❌ Not started | PAFV-aware per-group sorting |
| 13 | **SuperFilter** | 2.13 | ❌ Not started | Excel-style auto-filter dropdowns → SQL WHERE |
| 14 | **SuperSearch** | 2.14 | ❌ Not started | FTS5-powered faceted full-text search in-situ |

### Spec's Own Phasing (Internal, Not Mapped to GSD Milestones)

| Spec Phase | Features | Priority |
|-----------|----------|----------|
| Phase 35: PAFV Grid Core | SuperPosition, SuperDensity, SuperDynamic, SuperSize, SuperSelect | Foundation |
| Phase 36: SuperGrid Headers | SuperStack ✅, SuperZoom, Header Click Zones | Core UX |
| Phase 37: Grid Continuum | SuperCards, SuperSort, SuperFilter, SuperSearch, View Transitions | Interactive |
| Post-MVP | SuperCalc + SuperAudit, SuperTime + SuperReplay, SuperVersion | Advanced |

### Prerequisites (Foundation Wiring)

Before any Super* features can be built, 4 foundation items must land:

1. **Extend PAFVProvider** — add `stackedRowAxes[]` / `stackedColAxes[]` fields
2. **Wire SuperGrid to PAFVProvider** — read live axis state instead of hardcoded defaults
3. **Wire SuperGridQuery to Worker** — GROUP BY SQL through bridge, not in-memory counting
4. **SuperPosition coordinates** — enable cross-view state persistence for LATCH family transitions

### Spec's MVP Acceptance Criteria (Section 11)

From `SuperGrid.md` — a SuperGrid MVP is shippable when:

- [ ] 2D grid renders with correct PAFV axis mapping from sql.js data
- [ ] At least 2-level SuperStack headers render with correct visual spanning
- [ ] Density slider collapses/expands one axis level (Value Density level 1)
- [ ] Extent slider hides/shows empty intersections (Extent Density level 2)
- [ ] Axis drag-and-drop transposes rows ↔ columns
- [ ] Cell selection works with single-click and Cmd+click multi-select
- [ ] Header click zones follow geometric rule (parent label vs child vs data)
- [ ] Cursor changes correctly across all zone boundaries
- [ ] Column resize with drag handle persists
- [ ] Zoom pins upper-left corner
- [ ] FTS5 search highlights matching cells in-grid

**Current coverage: ~1 of 11 MVP criteria met** (2-level SuperStack spanning works; rest not implemented).

---

## 5. Known Technical Debt

| Item | Source | Impact |
|------|--------|--------|
| Schema loading conditional dynamic import (node:fs vs ?raw) | v1.1 | Complexity — two code paths |
| GalleryView pure HTML (no D3 data join) | v1.0 | No incremental update |
| TypeScript strict mode violations in ETL test files | v1.1 | tsc --noEmit blocked |
| build:native skips tsc | v2.0 | TypeScript errors hidden |
| Provisioning profile needs iCloud entitlement regeneration | v2.0 | Blocks App Store submission |
| StoreKit 2 products need App Store Connect setup | v2.0 | Sandbox-only currently |
| Graph algorithms (PageRank, Louvain) deferred | v1.0 | NetworkView has layout but no analytics |
| D3 .transition() on SVG transform crashes jsdom | v0.5 | .attr() workaround in place |
| @vitest/web-worker shares module state | v1.0 | Constrains test isolation |

---

## 6. Out of Scope (Explicitly Deferred)

From PROJECT.md — not candidates for near-term milestones:

| Feature | Deferred To |
|---------|-------------|
| CloudKit subscription sync (custom zones + change tokens) | v2.1+ |
| Conflict resolution for concurrent edits | v2.1+ |
| Push notifications for remote changes | v2.1+ |
| Deep links (`isometry://view/network`) | v2.1+ |
| Share extension (share-to-Isometry) | v2.1+ |
| WidgetKit (card count, recent imports) | v2.1+ |
| Haptic feedback (drag-drop, import success) | v2.1+ |
| Schema-on-read extras (EAV table) | D-008 |
| Designer Workbench / App Builder | Future tier |
| Android/Windows native shells | Future |
| DuckDB swap | Future optimization |
| Collaborative features | Future |

---

## 7. Next Milestone Direction

**Focus: SuperGrid + Super* Features**

The next milestone should transform SuperGrid from a static 2-axis demo into the dynamic n-axis PAFV projection engine the spec envisions. This means:

1. **Foundation wiring** — PAFVProvider stacking, SuperGridQuery → Worker, SuperPosition
2. **Core interactivity** — SuperDynamic (axis drag), SuperSelect (cell/header selection), SuperSize (resize)
3. **Density controls** — SuperDensity (Value/Extent levels), SuperZoom (cartographic nav)
4. **Data operations** — SuperSort, SuperFilter, SuperSearch (FTS5 in-grid)
5. **Stretch** — SuperCards (generated cards), Header Click Zones (geometric disambiguation)

The spec's own MVP acceptance criteria (Section 11) provide a natural definition of done.

**Prerequisite:** Run `/gsd:new-milestone` to enter the full GSD cycle (questioning → research → requirements → roadmap).

---

*Snapshot created: 2026-03-03*
*Supersedes: GAP-ANALYSIS-v5.md, GAP-ANALYSIS-v6.md (both pre-v0.5, stale)*
