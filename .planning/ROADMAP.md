# Roadmap: Isometry

## Milestones

- **v3.1 Live Database Integration** - Phases 18-27 (shipped 2026-02-01)
- **v4.1 SuperGrid Foundation** - Phases 34-42 (shipped 2026-02-10)
- **v4.2 Three-Canvas Notebook** - Phases 43-46 (shipped 2026-02-10)
- **v4.3 Navigator Integration** - Phases 50-51 (shipped 2026-02-10)
- **v5.0 Type Safety Restoration** - Phases 52-55 (shipped 2026-02-10)
- **v4.4 SuperGrid PAFV Projection** - Phases 56-59 (shipped 2026-02-11)
- **v4.5 Stacked/Nested Headers** - Phase 60 (shipped 2026-02-11)
- **v4.6 SuperGrid Polish** - Phases 61-62 (partial: 61 complete, 62 deferred)
- 🚧 **v4.7 Schema-on-Read** - Phases 63-65 (in progress)
- 📋 **v4.8 ETL Consolidation** - Phases 67-72 (planned)

## Phases

<details>
<summary>v3.1 Live Database Integration (Phases 18-27) - SHIPPED 2026-02-01</summary>

**Milestone Goal:** Connected React frontend to native SQLite backend with real-time data synchronization and performance monitoring

**Key Accomplishments:**
- High-performance bridge infrastructure with MessagePack binary serialization achieving <16ms latency for 60fps UI responsiveness
- Real-time database synchronization using GRDB ValueObservation providing <100ms change notifications with event sequencing
- ACID transaction safety across React-native bridge boundaries with correlation IDs and automatic rollback capability
- Virtual scrolling optimization with TanStack Virtual integration and intelligent caching for large datasets
- Live query integration connecting useLiveQuery React hook to real-time database changes
- End-to-end application access with LiveDataProvider installed in main app providing full user access to live database features

**Stats:** 173 files created/modified (48,306 insertions, 890 deletions), 84,694 lines of TypeScript + Swift + Python, 7 phases, 18 plans, ~150 tasks, 3 days from start to completion

</details>

<details>
<summary>v4.1 SuperGrid Foundation (Phases 34-42) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Core SuperGrid polymorphic data projection system with bridge elimination, Janus density controls, and unified ViewEngine architecture

**Key Accomplishments:**
- Bridge Elimination Architecture achieving sql.js direct D3.js data binding with zero serialization overhead (eliminated 40KB MessageBridge)
- Janus Density Controls with orthogonal zoom (value density) and pan (extent density) and 300ms smooth animations
- Grid Continuum Views enabling seamless transitions between Grid, List, and Kanban projections with preserved selection state
- ViewEngine Architecture unifying "D3 renders, React controls" pattern with GridRenderer, ListRenderer, KanbanRenderer
- IndexedDB Persistence supporting large datasets (50MB+) with auto-save, quota monitoring, and pre-save checks
- PAFV Axis Switching enabling dynamic axis-to-plane remapping with real-time grid reorganization

**Stats:** 859 files modified (172,092 insertions, 36,956 deletions), 156,240 lines of TypeScript, 9 phases, 27 plans, 5 days from start to ship

</details>

<details>
<summary>v4.2 Three-Canvas Notebook (Phases 43-46) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Build a unified capture-shell-preview workspace where notebook cards participate fully in PAFV projections

#### Phase 43: Shell Integration Completion
**Goal**: Complete Shell pane from 35% to functional with real Claude Code integration and interactive terminal
**Depends on**: Phase 42 (v4.1 complete)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06
**Success Criteria** (what must be TRUE):
  1. User can execute Claude Code commands via WebSocket connection and see real-time output
  2. User can copy/paste text in terminal with standard keyboard shortcuts (Cmd+C/Cmd+V)
  3. User can navigate command history with up/down arrows and see current working directory
  4. User can execute GSD commands from Command Builder and see execution progress in GSD GUI
**Plans**: 3 plans in 2 waves

Plans:
- [x] 43-01-PLAN.md — WebSocket connection with heartbeat, reconnection, and working directory display
- [x] 43-02-PLAN.md — Terminal copy/paste and command history with reverse search
- [x] 43-03-PLAN.md — GSD command execution with live progress and completion notifications

#### Phase 44: Preview Visualization Expansion
**Goal**: Complete Preview pane from 50% to fully functional with all visualization tabs operational
**Depends on**: Phase 43
**Requirements**: PREV-01, PREV-02, PREV-03, PREV-04, PREV-05, PREV-06, PREV-07
**Success Criteria** (what must be TRUE):
  1. User can view GRAPH relationships as D3 force-directed network with interactive node selection
  2. User can interact with network nodes (click to select, drag to rearrange) and see connections
  3. User can query SQLite via Data Inspector with SQL input and view results in sortable table
  4. User can export query results as JSON/CSV and view cards on Timeline by temporal LATCH facets
  5. User can filter timeline by date range and see smooth transitions between visualization types
**Plans**: 3 plans in 2 waves

Plans:
- [x] 44-01-PLAN.md — Network graph with force-directed layout, drag/click interactions
- [x] 44-02-PLAN.md — Data Inspector with SQL input, sortable table, CSV/JSON export
- [x] 44-03-PLAN.md — Timeline visualization with temporal facets and date filtering

#### Phase 45: TipTap Editor Migration
**Goal**: Migrate from MDEditor to TipTap for improved editing experience with slash commands and bidirectional links
**Depends on**: Phase 43
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04
**Success Criteria** (what must be TRUE):
  1. User edits content via TipTap editor with smooth performance on 10,000+ character documents
  2. User can invoke slash commands for card operations (/save-card, /send-to-shell, /insert-viz)
  3. User can create bidirectional links with [[page]] syntax and see autocomplete suggestions
  4. User experiences no lag during typing with shouldRerenderOnTransaction optimization applied
**Plans**: 3 plans in 2 waves

Plans:
- [x] 45-01-PLAN.md — TipTap foundation with performance config and Markdown persistence
- [x] 45-02-PLAN.md — Slash commands extension with @tiptap/suggestion
- [x] 45-03-PLAN.md — Wiki links extension with [[page]] syntax and sql.js autocomplete

#### Phase 46: Live Data Synchronization
**Goal**: Enable cross-canvas data synchronization without manual refresh using React's dataVersion reactivity
**Depends on**: Phases 44, 45
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. User sees Preview auto-refresh when Capture saves a card (no manual refresh required)
  2. User clicks card in Preview and Capture scrolls to show it (bidirectional navigation)
  3. User sees selection highlighted across all three canvases simultaneously
**Plans**: 3 plans in 2 waves

Plans:
- [x] 46-01-PLAN.md — Verify dataVersion propagation chain for auto-refresh (SYNC-01)
- [x] 46-02-PLAN.md — Connect Preview tabs to SelectionContext for cross-canvas selection (SYNC-03)
- [x] 46-03-PLAN.md — Bidirectional navigation from Preview to Capture (SYNC-02)

</details>

<details>
<summary>v4.3 Navigator Integration (Phases 50-51) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Connect property classification to Navigator UI for dynamic LATCH+GRAPH axis selection with SuperGrid

#### Phase 50: Foundation (Schema-on-Read Classification)
**Goal**: Build property classification service that reads facets table and produces LATCH+GRAPH bucketed property list
**Depends on**: Phase 42 (v4.1 complete)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Success Criteria** (what must be TRUE):
  1. classifyProperties(db) returns PropertyClassification with correct LATCH+GRAPH buckets
  2. GRAPH bucket contains 4 edge types (LINK, NEST, SEQUENCE, AFFINITY) + 2 metrics (degree, weight)
  3. Disabled facets are excluded from classification
  4. Sort order is respected within each bucket
  5. usePropertyClassification hook provides cached, refreshable access
**Gate**: Property classifier returns correct LATCH-bucketed results from live database.
**Plans**: 2 plans in 1 wave

Plans:
- [x] 50-01-PLAN.md — Property classification service validation with tests
- [x] 50-02-PLAN.md — usePropertyClassification hook caching validation

#### Phase 51: Navigator UI Integration
**Goal**: Connect usePropertyClassification hook to Navigator UI, replacing hardcoded axes with dynamic LATCH+GRAPH buckets
**Depends on**: Phase 50 (property classification complete)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. Navigator displays LATCH buckets from usePropertyClassification() instead of hardcoded axes
  2. User can expand each LATCH bucket to see individual facets (e.g., Time -> created, modified, due)
  3. GRAPH bucket appears in Navigator with 4 edge types and 2 metrics
  4. Dragging a facet to a well updates SuperGrid axis mapping
  5. Facet changes in database reflect in Navigator after refresh
**Plans**: 2 plans in 2 waves

Plans:
- [x] 51-01-PLAN.md — DraggableFacet and PlaneDropZone components with type mappings
- [x] 51-02-PLAN.md — SimplePAFVNavigator refactor with classification buckets

</details>

<details>
<summary>v5.0 Type Safety Restoration (Phases 52-55) - SHIPPED 2026-02-10</summary>

**Milestone Goal:** Eliminate all TypeScript compilation errors to restore pre-commit hooks and CI quality gates

**Approach:** Instead of executing the planned 4-phase sequential approach (Phases 52-55, 12 plans), used a 3-wave parallel agent strategy that eliminated all 1,347 errors in a single session:
- Wave 1 (8 agents by directory): 1,347 → 853 errors (37% reduction)
- Wave 2 (6 agents targeting clusters): 853 → 339 errors (60% of remaining)
- Wave 3 (4 agents final cleanup): 339 → 0 errors

**Key accomplishments:**
- Zero TypeScript compilation errors (`tsc --noEmit` passes clean)
- Pre-commit hook fully restored (all 5 checks passing)
- knip baseline ratchet set at `--max-issues 1000` for pre-existing unused exports
- Local interface extension pattern established for competing type definitions

**Stats:** 140 files changed (2,938 insertions, 1,544 deletions), single commit `23de1fa5`

</details>

<details>
<summary>v4.4 SuperGrid PAFV Projection (Phases 56-59) - SHIPPED 2026-02-11</summary>

**Milestone Goal:** Wire SuperGrid to consume PAFV axis mappings from PAFVContext for 2D card positioning with dynamic headers and smooth transitions.

**Key Accomplishments:**
- PAFV Projection Core connecting Navigator axis mappings to GridRenderingEngine for 2D card positioning
- Dynamic header generation from dataset values with date/category formatting
- Infinite render loop fix with comprehensive context memoization
- useRenderLoopGuard development safeguard

**Stats:** 4 phases (56-59), 9 plans, ~20 minutes execution time

</details>

<details>
<summary>v4.5 Stacked/Nested Headers (Phase 60) - SHIPPED 2026-02-11</summary>

**Milestone Goal:** Implement spreadsheet-style hierarchical headers with visual spanning for multi-axis projections

**Key Accomplishments:**
- Stacked/nested hierarchical headers with d3.stratify for multi-facet axes (Excel pivot table style)
- Parent header cells visually spanning across children with bottom-up span calculation
- Header click sorting with visual indicators (asc/desc/none toggle cycle)

**Stats:** 1 phase (60), 3 plans, ~25 minutes execution time

#### Phase 60: SuperGrid Stacked/Nested Headers
**Goal**: Implement spreadsheet-style hierarchical headers with visual spanning for multi-axis projections
**Depends on**: Phase 59
**Requirements**: STACK-01, STACK-02, STACK-03
**Success Criteria** (what must be TRUE):
  1. Multi-level header hierarchy renders when multiple facets assigned to same plane (stacked axes)
  2. Parent header cells span across their child headers (like Excel pivot table headers)
  3. Headers integrate with existing HeaderLayoutService span calculation algorithm
  4. Header clicks allow sorting by that level of the hierarchy
**Plans**: 3 plans in 3 waves

Plans:
- [x] 60-01-PLAN.md — Extend types and generate multi-facet hierarchies
- [x] 60-02-PLAN.md — Render stacked headers with visual spanning
- [x] 60-03-PLAN.md — Header click sorting at hierarchy levels

</details>

<details>
<summary>v4.6 SuperGrid Polish (Phases 61-62) - SHIPPED 2026-02-12</summary>

**Milestone Goal:** Complete SuperGrid projection system with animated view transitions and sparse/dense cell filtering.

### Phase 61: View Transitions
**Goal**: Cards and headers animate smoothly when axis mappings change
**Depends on**: Phase 60 (Stacked/Nested Headers complete)
**Requirements**: TRANS-01, TRANS-02, TRANS-03
**Success Criteria** (what must be TRUE):
  1. User changes axis mapping in Navigator and sees cards smoothly transition to new positions (300ms animation)
  2. User changes axis mapping and sees header elements smoothly transition with cards
  3. User has cards selected, changes axis mapping, and selected cards remain selected after transition
**Plans**: 1 plan in 1 wave

Plans:
- [x] 61-01-PLAN.md — Card/header transitions with selection preservation

### Phase 62: Density Filtering
**Goal**: User controls whether empty cells display via density controls
**Depends on**: Phase 61 (View Transitions complete)
**Requirements**: DENS-01, DENS-02, DENS-03
**Success Criteria** (what must be TRUE):
  1. User sets pan level to sparse and sees full Cartesian grid including empty cells
  2. User sets pan level to dense and sees only populated cells (empty cells hidden)
  3. User adjusts pan slider and sees cell filtering respond immediately
  4. Density changes preserve existing card positions and selection state
**Plans**: 1 plan in 1 wave

Plans:
- [x] 62-01-PLAN.md — Wire Janus extent density controls to GridRenderingEngine for sparse/dense cell filtering

</details>

## 🚧 v4.7 Schema-on-Read (In Progress)

**Milestone Goal:** Dynamic YAML property discovery and storage for true schema-on-read semantics.

### Phase 63: Schema & Query Safety
**Goal**: Add node_properties table and fix query parameter binding for arbitrary YAML frontmatter storage
**Depends on**: Phase 61 (View Transitions complete)
**Requirements**: SCHEMA-01, SCHEMA-02, QUERY-01
**Success Criteria** (what must be TRUE):
  1. Database contains node_properties table with foreign key to nodes and cascade delete
  2. Arbitrary YAML keys can be stored as key-value pairs linked to node_id
  3. All SQL queries use stmt.bind(params) instead of string interpolation for injection safety
  4. execute() function in db/operations.ts correctly passes params to sql.js stmt.bind()
**Plans**: 1 plan in 1 wave

Plans:
- [x] 63-01-PLAN.md — Add node_properties table to schema and fix execute() parameter binding

### Phase 64: ETL Pipeline Upgrade
**Goal**: Replace custom YAML parser with full-spec parser and harden source_id generation
**Depends on**: Phase 63 (Schema & Query Safety complete)
**Requirements**: ETL-01, ETL-02, ETL-03
**Success Criteria** (what must be TRUE):
  1. YAML parser uses npm yaml package instead of custom regex-based parser
  2. Unknown frontmatter keys flow into node_properties table without schema changes
  3. source_id generation is deterministic (filePath + frontmatter hash) with collision detection
  4. ETL pipeline preserves all YAML frontmatter regardless of whether keys are recognized
**Plans**: 2 plans in 2 waves

Plans:
- [x] 64-01-PLAN.md — Install gray-matter/yaml dependencies, create frontmatter parser and deterministic ID modules
- [x] 64-02-PLAN.md — Wire modules into alto-parser and alto-importer with property storage integration

### Phase 65: Facet Discovery
**Goal**: Surface dynamic properties from node_properties as available Navigator facets
**Depends on**: Phase 64 (ETL Pipeline Upgrade complete)
**Requirements**: FACET-01, FACET-02
**Success Criteria** (what must be TRUE):
  1. Property classifier queries node_properties for distinct keys and includes them in classification
  2. Dynamic properties appear as draggable facets in Navigator alongside schema-defined facets
  3. Navigator UI distinguishes dynamic vs schema facets (different styling or section)
  4. Dragging dynamic property to plane updates axis mapping and SuperGrid renders it
**Plans**: 2 plans in 2 waves

Plans:
- [ ] 65-01-PLAN.md — Extend property classifier with dynamic property discovery from node_properties
- [ ] 65-02-PLAN.md — Add visual distinction for dynamic properties in Navigator UI

## 📋 v4.8 ETL Consolidation (Planned)

**Milestone Goal:** Consolidate file-based ETL in TypeScript with canonical schema validation and multi-format importers.

**Source:** etl-consolidation-plan.md

### Phase 67: Canonical Schema
**Goal**: Create Zod-validated canonical Node schema with JSON Schema export
**Depends on**: v4.7 complete (Phase 65)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03
**Success Criteria** (what must be TRUE):
  1. CanonicalNodeSchema validates all LATCH dimensions and provenance fields
  2. JSON Schema exports for Swift interop
  3. SQL_COLUMN_MAP maps camelCase to snake_case for database insertion
**Plans**: 1 plan in 1 wave

Plans:
- [x] 67-01-PLAN.md — Canonical Node Schema with Zod validation

### Phase 68: Import Coordinator
**Goal**: Create central router for file imports with format detection
**Depends on**: Phase 67 (Canonical Schema complete)
**Requirements**: COORD-01, COORD-02, COORD-03
**Success Criteria** (what must be TRUE):
  1. ImportCoordinator routes files to appropriate importers by extension
  2. BaseImporter interface defines import/parse/validate/transform contract
  3. Format detection works for all supported extensions
**Plans**: 1 plan in 1 wave

Plans:
- [ ] 68-01-PLAN.md — BaseImporter abstract class and ImportCoordinator router

### Phase 69: File Importers
**Goal**: Implement importers for MD, XLSX, DOCX, JSON, HTML, CSV
**Depends on**: Phase 68
**Requirements**: IMP-01 through IMP-06
**Success Criteria** (what must be TRUE):
  1. Each importer produces valid CanonicalNode[] from input files
  2. All importers handle edge cases and malformed input gracefully
  3. Test coverage >80% for each importer
**Plans**: TBD

### Phase 70: Integration
**Goal**: Wire importers to sql.js and migrate alto-importer
**Depends on**: Phase 69
**Requirements**: INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. window.isometryETL.importFile() exposes ETL API for Swift bridge
  2. Alto-importer uses CanonicalNode pipeline
  3. Database insertion handles all CanonicalNode fields correctly
**Plans**: TBD

### Phase 71: Swift Bridge
**Goal**: Enable Swift to delegate file processing to JS
**Depends on**: Phase 70
**Requirements**: BRIDGE-01, BRIDGE-02
**Success Criteria** (what must be TRUE):
  1. ETLBridge.swift delegates file parsing to JS via WKWebView
  2. Round-trip Swift -> JS -> sql.js -> Swift works correctly
  3. Native adapters exist for EventKit, Contacts, Notes
**Plans**: TBD

### Phase 72: Quality & Documentation
**Goal**: Achieve test coverage targets and document architecture
**Depends on**: Phase 71
**Requirements**: QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. ETL module has >80% test coverage
  2. Schema validation at every import
  3. CLAUDE.md updated with ETL architecture
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 18-27 | v3.1 | All | Complete | 2026-02-01 |
| 34-42 | v4.1 | All | Complete | 2026-02-10 |
| 43. Shell Integration Completion | v4.2 | 3/3 | Complete | 2026-02-10 |
| 44. Preview Visualization Expansion | v4.2 | 3/3 | Complete | 2026-02-10 |
| 45. TipTap Editor Migration | v4.2 | 3/3 | Complete | 2026-02-10 |
| 46. Live Data Synchronization | v4.2 | 3/3 | Complete | 2026-02-10 |
| 50. Foundation (Schema-on-Read) | v4.3 | 2/2 | Complete | 2026-02-10 |
| 51. Navigator UI Integration | v4.3 | 2/2 | Complete | 2026-02-10 |
| 52-55. Type Safety Restoration | v5.0 | N/A (wave strategy) | Complete | 2026-02-10 |
| 56. PAFV Projection Core | v4.4 | 3/3 | Complete | 2026-02-11 |
| 57. Header Generation | v4.4 | 3/3 | Complete | 2026-02-11 |
| 58. Transitions & Polish | v4.4 | 2/2 | Complete | 2026-02-11 |
| 59. Stability & Memoization | v4.4 | 1/1 | Complete | 2026-02-11 |
| 60. Stacked/Nested Headers | v4.5 | 3/3 | Complete | 2026-02-11 |
| 61. View Transitions | v4.6 | 1/1 | Complete | 2026-02-12 |
| 62. Density Filtering | v4.6 | 1/1 | Complete | 2026-02-12 |
| 63. Schema & Query Safety | v4.7 | 1/1 | Complete | 2026-02-12 |
| 64. ETL Pipeline Upgrade | v4.7 | 2/2 | Complete | 2026-02-12 |
| 65. Facet Discovery | v4.7 | 0/2 | Not started | - |
| 67. Canonical Schema | v4.8 | 1/1 | Complete | 2026-02-12 |
| 68. Import Coordinator | v4.8 | 0/1 | Planned | - |
| 69. File Importers | v4.8 | 0/TBD | Planned | - |
| 70. Integration | v4.8 | 0/TBD | Planned | - |
| 71. Swift Bridge | v4.8 | 0/TBD | Planned | - |
| 72. Quality & Docs | v4.8 | 0/TBD | Planned | - |

---
*Roadmap created: 2026-02-10*
*Last updated: 2026-02-12 (Phase 68 planned)*
