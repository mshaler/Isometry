# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Polymorphic data projection platform with PAFV spatial projection system
**Current focus:** v5.1 Notebook Integration — Collapsible NotebookLayout panel in IntegratedLayout

## Current Position

Phase: 84 (Cards & Connections)
Plan: 04 of 4 complete
Status: PHASE COMPLETE
Last activity: 2026-02-14 — Completed 84-04-PLAN.md (Verification and cleanup documentation)

Progress (v5.2 Cards & Connections): [##############################] 100% (4/4 plans)

## Current Milestone: v5.1 Notebook Integration

**Goal:** Integrate NotebookLayout into IntegratedLayout as a collapsible panel below Command Bar.

**Requirements:**
| ID | Description | Phase | Status |
|----|-------------|-------|--------|
| LAYOUT-01 | Collapsed Notebook panel below Command Bar | 80 | Done (80-01) |
| LAYOUT-02 | Expand/collapse toggle button | 80 | Done (80-01) |
| LAYOUT-03 | All three panes when expanded | 80 | Pending (80-02) |
| CTX-01 | NotebookContext in IntegratedLayout tree | 80 | Done (80-01) |
| CTX-02 | State persists across toggle | 80 | Done (80-01) |
| VIS-01 | Minimal collapsed header | 80 | Done (80-01) |
| VIS-02 | Theme respect (NeXTSTEP/Modern) | 80 | Done (80-01) |
| VIS-03 | Smooth expand/collapse animation | 80 | Done (80-01) |

**Phase 80 Plans:**
- [x] 80-01-PLAN.md — Context wiring + collapsible panel skeleton (COMPLETE - ~4 min)
- [ ] 80-02-PLAN.md — Full NotebookLayout embedding with polish

## Previous Milestones

### v4.9 Data Layer (COMPLETE)

**Milestone:** `.planning/milestones/v4.9-data-layer-completion.md`

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 77 | Versioning | 77-01 | COMPLETE |
| 78 | URL Deep Linking | 78-01, 78-02 | COMPLETE |
| 79 | Catalog Browser | 79-01, 79-02, 79-03 | COMPLETE |

### v5.0 SuperGrid MVP (COMPLETE)

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 73 | Phase A | 73-01 to 73-04 | COMPLETE |
| 74 | Phase B | 74-01 to 74-04 | COMPLETE |
| 75 | Phase C | 75-01 to 75-04 | COMPLETE |
| 76 | Polish | 76-01 to 76-03 | COMPLETE |

## Performance Metrics

**Previous Milestones:**
- v3.1: 18 plans, 7 phases, 3 days
- v4.1: 27 plans, 9 phases, 5 days
- v4.2: 12 plans, 4 phases, same day
- v4.3: 4 plans, 2 phases, same day
- v5.0: 3-wave parallel (bypassed phased plan), same day
- v4.4: 9 plans, 4 phases (56-59), same day
- v4.5: 3 plans, 1 phase (60), ~25 minutes
- v4.6: 1 plan, 1 phase (61), ~6 minutes (Phase 62 deferred)

**Recent completions (Phase 84 - Cards & Connections) — PHASE COMPLETE:**
- Phase 84-04: COMPLETE (~8m) — Verification: 51 integration tests, full test suite (1441 passing), cleanup docs
- Phase 84-03: COMPLETE (~7m) — Data layer migration: hooks, filters, ETL use cards table
- Phase 84-02: COMPLETE (prior session) — TypeScript Card/Connection interfaces with type guards
- Phase 84-01: COMPLETE (~5m) — Schema foundation with cards/connections tables, migration script, 24 tests

**Recent completions (Phase 79 - Catalog Browser) — PHASE COMPLETE:**
- Phase 79-03: COMPLETE (~6m) — FilterBreadcrumb component with LATCH filter segments, navigation/removal, clear all
- Phase 79-02: COMPLETE (~4m) — CatalogBrowser UI with FolderTree, TagCloud, StatusChips wired to FilterContext
- Phase 79-01: COMPLETE (~4m) — Facet aggregate queries (getFolderCounts, getTagCounts, getStatusCounts) + useFacetAggregates hook

**Recent completions (Phase 78 - URL Deep Linking) — PHASE COMPLETE:**
- Phase 78-02: COMPLETE (~3m) — Filter URL persistence (pre-existing implementation verified)
- Phase 78-01: COMPLETE (~6m) — Node deep links via ?nodeId= with useNodeDeepLink hook

**Recent completions (Phase 76 - v5.0 SuperGrid Polish) — PHASE COMPLETE:**
- Phase 76-03: COMPLETE (~12m) — NestedHeaderRenderer data-driven .join() pattern with deep nesting/performance handling
- Phase 76-02: COMPLETE (~8m) — Performance benchmark suite (14 tests, all spec targets exceeded)
- Phase 76-01: COMPLETE (~5m) — SuperSearch FTS5 integration with in-grid highlighting

**Recent completions (Phase 75 - v5.0 SuperGrid Phase C) — PHASE COMPLETE:**
- Phase 75-04: COMPLETE (~8m) — SuperAudit computed value highlighting with CRUD flash
- Phase 75-03: COMPLETE (~5m) — SuperCards header/aggregation row distinction with search exclusion
- Phase 75-02: COMPLETE (~5m) — SuperSort multi-level sorting with priority badges
- Phase 75-01: COMPLETE (~8m) — SuperFilter header dropdown filters

**Recent completions (Phase 74 - v5.0 SuperGrid Phase B) — PHASE COMPLETE:**
- Phase 74-04: COMPLETE (~5m) — SuperPosition PAFV coordinate tracking for view transitions
- Phase 74-03: COMPLETE (~5m) — SuperSelect multi-selection with lasso and range
- Phase 74-02: COMPLETE (~15m) — SuperSize column/row resize with drag handles and auto-fit
- Phase 74-01: COMPLETE (~8m) — SuperDynamic axis repositioning with D3 drag-and-drop

**Recent completions (Phase 73 - v5.0 SuperGrid Phase A) — PHASE COMPLETE:**
- Phase 73-04: COMPLETE (~5m) — Header Click Zones with zone-based hit testing & hover highlighting
- Phase 73-03: COMPLETE (~4m) — SuperZoom pinned upper-left anchor with boundary constraints
- Phase 73-02: COMPLETE (~6m) — SuperDensity controls with Janus value/extent model
- Phase 73-01: COMPLETE (~6m) — SuperStack multi-level headers with hierarchy building

**Recent completions (Phase 72 - v4.8 Quality & Docs) — MILESTONE COMPLETE:**
- Phase 72-01: COMPLETE (~10m) — ETL quality audit (179 tests, schema validation, error handling)

**Recent completions (Phase 71 - v4.8 Swift Bridge) — PHASE COMPLETE:**
- Phase 71-04: COMPLETE (~15m) — BridgeCoordinator unified interface + integration tests
- Phase 71-03: COMPLETE (~7m) — ContactsAdapter + NotesAdapter actors with unit tests
- Phase 71-02: COMPLETE (~11m) — EventKitAdapter actor with calendar/reminder conversion
- Phase 71-01: COMPLETE (~12m) — ETLBridge actor + CanonicalNode + ETLBridgeError + unit tests

**Previous completions (Phase 70 - v4.8 Integration):**
- Phase 70-02: COMPLETE (~5m) — AltoImporter extends BaseImporter, CanonicalNode[] output
- Phase 70-01: COMPLETE (~5m) — insertCanonicalNodes() + window.isometryETL bridge

**Recent completions (Phase 69 - v4.8 File Importers):**
- Phase 69-06: COMPLETE (~5m) — ExcelImporter with SheetJS multi-sheet support
- Phase 69-05: COMPLETE (~6m) — WordImporter with mammoth.js for DOCX to HTML
- Phase 69-04: COMPLETE (~6m) — HtmlImporter with native DOMParser
- Phase 69-03: COMPLETE (~7m) — CsvImporter with PapaParse RFC 4180 compliance
- Phase 69-02: COMPLETE (~4m) — JsonImporter with flexible LATCH mapping
- Phase 69-01: COMPLETE (~7m) — MarkdownImporter with gray-matter + marked HTML

**Recent completions (Phase 68 - v4.8 ETL Consolidation):**
- Phase 68-01: COMPLETE (~5m) — Import Coordinator with extension-based routing
- Phase 67-01: COMPLETE (~10m) — Canonical Node Schema with Zod validation

**Recent completions (Phase 65 - v4.7 Schema-on-Read - MILESTONE COMPLETE):**
- Phase 65-02: COMPLETE (~3m) — Dynamic property Navigator UI with visual distinction
- Phase 65-01: COMPLETE (~4m) — Dynamic property discovery with LATCH inference

**Recent completions (Phase 66 - parallel):**
- Phase 66-01: COMPLETE (~15m) — SuperGrid spreadsheet-like scroll behavior

**Recent completions (Phase 64):**
- Phase 64-02: COMPLETE (4m 26s) — Property storage + importer integration
- Phase 64-01: COMPLETE (2m 34s) — gray-matter + yaml + SHA-256 source_id

**Previous (Phase 63):**
- Phase 63-01: COMPLETE (2m 27s) — EAV table + SQL injection fix

**Phase 62 (parallel execution):**
- Phase 62-01: COMPLETE (7m) — Density filtering in GridRenderingEngine

**Previous (Phase 61):**
- Phase 61-01: COMPLETE (6m 4s) — View Transitions with selection persistence

## Accumulated Context

### Decisions

**Phase 84-01 decisions (Cards & Connections - Schema Foundation):**
- SCHEMA-01: 12 node_types consolidated to 4 card_types (note, person, event, resource)
- SCHEMA-02: edge_type enum removed - connections use lowercase labels (schema-on-read)
- SCHEMA-03: via_card_id enables bridge cards (e.g., "met at" an event)
- SCHEMA-04: Deprecated columns removed (location_address, importance, grid_x/y, source_url)
- SCHEMA-05: New columns added (url, mime_type, is_collective, sync_status)
- MIGRATION-01: Backup tables (nodes_backup, edges_backup) for rollback safety
- MIGRATION-02: Type mapping: LINK->link, NEST->parent, SEQUENCE->precedes, AFFINITY->related

**Phase 84-03 decisions (Cards & Connections - Data Layer Migration):**
- QUERY-DEC-01: useLiveNodes deprecated, useLiveCards added as replacement
- QUERY-DEC-02: insertCanonicalNodes name unchanged but inserts into cards table
- QUERY-DEC-03: Legacy insertCanonicalNodesLegacy added for explicit nodes table insertion
- QUERY-DEC-04: Test schema includes parallel tables (nodes/edges + cards/connections) for gradual migration
- QUERY-DEC-05: Hierarchy CTE uses connections.label='parent' instead of edges.edge_type='NEST'

**Phase 84-02 decisions (Cards & Connections - TypeScript Types):**
- CARD-TYPE-01: CardType constrained to 4 types (note/person/event/resource) - no expansion
- CARD-TYPE-02: Connection uses label (string) instead of edge_type enum - schema-on-read
- CARD-TYPE-03: SyncStatus field added for offline-first support (pending/synced/conflict/error)
- CARD-TYPE-04: isCollective boolean only meaningful for PersonCard (groups vs individuals)

**Phase 80-01 decisions (Notebook Integration - Context Wiring):**
- PANEL-DEC-01: Use inline styles for max-height animation instead of Tailwind arbitrary values (Tailwind JIT can't detect dynamic classes)
- PANEL-DEC-02: Default to collapsed state to preserve existing UI layout
- PANEL-DEC-03: Position Notebook panel between Command Bar and Dataset Switcher

**Phase 78 decisions (URL Deep Linking):**
- DEEPLINK-DEC-01: Keep URL param for shareability (users can copy/paste URLs)
- DEEPLINK-DEC-02: ProcessedRef prevents re-triggering (useRef tracks processed nodeId)
- DEEPLINK-DEC-03: requestAnimationFrame for scroll timing (ensures view rendered before scroll)
- DEEPLINK-DEC-04: scrollToNode registration pattern (views register scroll function via context)
- URL-DEC-01: Filter serialization implemented in prior phases (b29351de, 21b815e8)
- URL-DEC-02: Semicolon-delimited LATCH encoding format for URL-safe human-readable filters
- URL-DEC-03: Debounced URL updates (300ms) to prevent URL thrashing

**Phase 76-03 decisions (Visual Polish - Data-Driven Nested Headers):**
- POLISH-DEC-01: Lazy initialization of NestedHeaderRenderer in GridRenderingEngine
- POLISH-DEC-02: MAX_NESTING_DEPTH=5 with collapsed placeholder for deep hierarchies
- POLISH-DEC-03: MAX_VISIBLE_HEADERS=100 with warning log and truncation
- POLISH-DEC-04: Clear + re-render for test assertions (JSDOM transition limitation)

**Phase 76-02 decisions (Performance Verification):**
- PERF-DEC-01: Seeded random generator (seed: 12345) for reproducible test data
- PERF-DEC-02: Grid processing simulation groups by folder then status
- PERF-DEC-03: FTS5 tests include various query patterns (simple, phrase, prefix, AND/OR)

**Phase 76-01 decisions (SuperSearch Integration):**
- SEARCH-DEC-01: Yellow tint (#facc15, rgba(250, 204, 21, 0.15)) for search highlights
- SEARCH-DEC-02: Selection styling priority over search highlight
- SEARCH-DEC-03: Dual rendering path support (React and D3-based)

**Phase 75-04 decisions (SuperAudit - Computed Value Highlighting):**
- AUDIT-DEC-01: Blue tint rgba(59, 130, 246, 0.1) for computed cells
- AUDIT-DEC-02: Green tint rgba(16, 185, 129, 0.1) for enriched cells
- AUDIT-DEC-03: Purple tint rgba(139, 92, 246, 0.1) for formula cells
- AUDIT-DEC-04: CRUD flash 500ms animation with opacity fade
- AUDIT-DEC-05: Recent changes auto-cleanup after 2000ms
- AUDIT-DEC-06: Indicator dot positioned at (8, 8) with radius 3px

**Phase 75-03 decisions (SuperCards - Header/Aggregation Distinction):**
- CARD-DEC-01: CardType enum with 'data' | 'header' | 'aggregation'
- CARD-DEC-02: Chrome gradient #f8f8f8 -> #e8e8e8 vertical
- CARD-DEC-03: Aggregation row fixed 32px height
- CARD-DEC-04: Total cell fixed 80px width in rightmost column
- CARD-DEC-05: ID prefix convention: 'header-' and 'agg-' for SuperCards
- CARD-DEC-06: isSuperCardId() for search exclusion without full card object

**Phase 74-04 decisions (SuperPosition - Coordinate Tracking):**
- POS-DEC-01: Position reuse preserves lastUpdated timestamp (existing positions not recomputed)
- POS-DEC-02: Filter removal does not clear positions (enables filter restoration)
- POS-DEC-03: Custom sort orders stored by groupKey (e.g., "Work-Q1")
- POS-DEC-04: SerializedPositionState uses arrays for JSON compatibility

**Phase 74-03 decisions (SuperSelect - Multi-Selection):**
- SEL-DEC-01: Lasso uses min 5px movement threshold to distinguish from click
- SEL-DEC-02: Range selection includes both start and end cells
- SEL-DEC-03: Toggle mode uses Cmd/Ctrl modifier key
- SEL-DEC-04: calculateRangeSelection exported for testing without DOM

**Phase 74-02 decisions (SuperSize - Column/Row Resize):**
- SIZE-DEC-01: Minimum 40px enforced in constrainSize() for usability
- SIZE-DEC-02: Bulk resize uses proportional ratio (maintains header proportions)
- SIZE-DEC-03: Auto-fit adds 16px padding to measured text width
- SIZE-DEC-04: Text measurer created/destroyed per auto-fit (no persistent DOM elements)

**Phase 74-01 decisions (SuperDynamic - Axis Repositioning):**
- DRAG-DEC-01: Ghost element 50% opacity for clear drag feedback
- DRAG-DEC-02: Drop zone highlight uses blue (#3B82F6) with 0.2 opacity
- DRAG-DEC-03: Escape key cancels drag via document keydown listener
- DRAG-DEC-04: swapPlaneMapping delegates to transpose (x/y swap = row/column swap)

**Phase 71-04 decisions (BridgeCoordinator & Integration Tests):**
- BRIDGE-DEC-05: Named BridgePermissionStatus instead of PermissionStatus to avoid conflict with NotesAccessManager.PermissionStatus
- BRIDGE-DEC-06: Integration tests use mock window.isometryETL HTML for isolated testing
- BRIDGE-DEC-07: Sequential file import in importFiles() for predictable error handling

**Phase 71-02 decisions (EventKitAdapter):**
- EK-DEC-01: Use iOS 17+ requestFullAccessToEvents() async API (cleaner concurrency)
- EK-DEC-02: Calendar title becomes folder for LATCH organization
- EK-DEC-03: Priority mapping from 0-9 (EK) to 0-5 (Canonical)
- EK-DEC-04: MockEventData/MockReminderData for testable conversion without entitlements
- EK-DEC-05: Continuation wrapper for fetchReminders callback API

**Phase 71-03 decisions (ContactsAdapter & NotesAdapter):**
- CT-DEC-01: Use iOS 17+ CNContactStore.requestAccess(for:) async API for clean concurrency
- CT-DEC-02: Build display name from givenName + familyName, fallback to organizationName then "Unknown Contact"
- CT-DEC-03: Store emails/phones in properties dictionary as AnyCodable arrays
- NT-DEC-01: NotesAdapter delegates ALL markdown parsing to ETLBridge (no gray-matter in Swift)
- NT-DEC-02: Use directory enumeration with FileManager for recursive .md discovery
- NT-DEC-03: ImportSummary struct with totalFiles, imported, failed, errors for batch reporting

**Phase 71-01 decisions (Swift Bridge ETL Foundation):**
- BRIDGE-DEC-01: Renamed ImportResult to ETLImportResult to avoid conflict with existing ImportResult in AltoIndexImporter
- BRIDGE-DEC-02: Removed duplicate CanonicalNode from EventKitAdapter.swift - consolidated in Bridge/CanonicalNode.swift
- BRIDGE-DEC-03: Removed Equatable conformance from CanonicalNode because existing AnyCodable doesn't conform to Equatable
- BRIDGE-DEC-04: Used @MainActor helper function instead of MainActor.run closure (Swift 5.9 compatibility)

**Phase 73-04 decisions (Header Click Zones):**
- ZONE-DEC-01: Parent label zone 32px height (matches typical header text height)
- ZONE-DEC-02: Resize edge 4px width (standard resize handle size)
- ZONE-DEC-03: Resize handled by drag, not click (future feature, consistent with spreadsheet UX)
- ZONE-DEC-04: Factory pattern for click handler (single handler routes to multiple callbacks)
- ZONE-DEC-05: Blue/green highlight colors (visual distinction between expand and select)

**Phase 73-03 decisions (SuperZoom Upper-Left Anchor):**
- ZOOM-DEC-01: Pure functions exported for testing without DOM/D3 setup
- ZOOM-DEC-02: Scale ratio approach for pinned zoom (simpler than matrix transforms)
- ZOOM-DEC-03: Double-click zoom disabled to avoid confusion with cell selection
- ZOOM-DEC-04: D3 state sync after constraint to prevent D3 from fighting our constraints

**Phase 73-02 decisions (SuperDensity Controls):**
- DENS-DEC-01: ExtentMode type exported from DataManager for shared use
- DENS-DEC-02: Neighbor calculation includes all 8 directions (cardinal + diagonal)
- DENS-DEC-03: Filter applied in useMemo to avoid re-filtering on every render
- DENS-DEC-04: DensityControls uses native HTML slider for maximum accessibility

**Phase 73-01 decisions (SuperStack Multi-Level Headers):**
- STACK-DEC-01: Pipe-delimited format for multi-level values (e.g., "Q1|Jan|Week 1")
- STACK-DEC-02: HeaderNode type with span calculated from leaf descendants
- STACK-DEC-03: Visual differentiation: parent headers #e8e8e8, leaf headers #f5f5f5
- STACK-DEC-04: Header click selects all cells within header's span range

**Phase 70-02 decisions (Integration - AltoImporter Migration):**
- ALTO-DEC-01: Keep legacy mapToNodeRecord() for batch import compatibility
- ALTO-DEC-02: Use frontmatterAliases set for alto-specific field name variations
- ALTO-DEC-03: sourceUrl validated with URL constructor to filter invalid URLs

**Phase 70-01 decisions (Integration - Database Insertion):**
- INT-DEC-01: Direct db.run() for properties instead of storeNodeProperties (already-filtered node.properties)
- INT-DEC-02: Transaction default true with atomic rollback on any failure
- INT-DEC-03: Format validation via detectFormat but routing via filename in coordinator

**Phase 69-01 decisions (MarkdownImporter):**
- MD-DEC-01: Tests use toMatch() for ISO dates due to gray-matter Date object parsing
- MD-DEC-02: Flexible key detection supports created/createdAt/created_at variations
- MD-DEC-03: Unknown frontmatter keys stored in properties with originalFormat marker

**Phase 69-06 decisions (ExcelImporter):**
- EXCEL-DEC-01: Sheet name used as folder for organizational hierarchy
- EXCEL-DEC-02: No fallback to arbitrary column values for name - use sheet+row number format

**Phase 69-03 decisions (CsvImporter):**
- CSV-DEC-01: Use PapaParse for RFC 4180 compliance (handles quoted fields, commas in values)
- CSV-DEC-02: Store raw row as JSON in content field for debugging
- CSV-DEC-03: Case-insensitive column header matching for flexibility
- CSV-DEC-04: Priority string mapping (high=5, medium=3, low=1)


**Phase 69-04 decisions (HtmlImporter):**
- HTML-DEC-01: Use native DOMParser (zero dependencies, jsdom in tests)
- HTML-DEC-02: Title fallback: <title> -> <h1> -> filename
- HTML-DEC-03: Meta tag mapping: description->summary, keywords->tags, author->properties
- HTML-DEC-04: Semantic content priority: <main> > <article> > <body>
- HTML-DEC-05: Preserve HTML formatting in content field (not strip tags)

**Phase 69-05 decisions (WordImporter):**
- WORD-DEC-01: Mock mammoth for unit tests (simpler than creating real DOCX)
- WORD-DEC-02: Extract title from first H1/H2/H3 heading with regex
- WORD-DEC-03: Store conversion warnings in properties.conversionWarnings
- WORD-DEC-04: Support both base64 and UTF-8 encoding via toBuffer()

**Phase 69-02 decisions (JsonImporter):**
- JSON-DEC-01: Use native JSON.parse (no dependencies)
- JSON-DEC-02: Array items map to multiple nodes with index-based sourceId
- JSON-DEC-03: Flexible key detection for LATCH (name/title/subject, created/createdAt/date, etc.)
- JSON-DEC-04: Priority string mapping (high=5, medium=3, low=1)

**Phase 68-01 decisions (Import Coordinator):**
- DEC-68-01: Extension-based format detection with path.extname() and lowercase normalization
- DEC-68-02: Sequential batch import (for-of loop) for simpler error handling vs parallelization
- DEC-68-03: Mandatory validation of all nodes with CanonicalNodeSchema.parse() in importFile()
- DEC-68-04: Template Method pattern for importers (parse → validate → transform pipeline)

**Phase 65-02 decisions (Dynamic Property Navigator UI):**
- UI-DEC-01: Sparkles icon for dynamic properties (visual distinction from schema-defined)
- UI-DEC-02: Dashed border styling for subtle differentiation
- UI-DEC-03: Node count badge shows data coverage (only when isDynamic && nodeCount > 0)
- UI-DEC-04: Theme-specific yellow tones (NeXTSTEP yellow-400, Modern yellow-500)

**Phase 65-01 decisions (Dynamic Property Discovery):**
- FACET-DEC-01: Node count threshold = 3 (properties in <3 nodes filtered out to reduce UI noise)
- FACET-DEC-02: LATCH inference priority: Time (date patterns) -> Location (address patterns) -> default Alphabet
- FACET-DEC-03: Collision handling adds "(custom)" suffix rather than skip/override schema facets
- FACET-DEC-04: sourceColumn format "node_properties.{key}" signals query builders to JOIN EAV table

**v4.8 ETL Consolidation (Phases 67-72):**
- Canonical schema + Zod validation + multi-format importers
- TypeScript-based file ETL, Swift for native frameworks
- 6 phases: Schema -> Coordinator -> Importers -> Integration -> Bridge -> Quality

**Phase 67-01 decisions (Canonical Schema):**
- SCHEMA-DEC-01: Used Zod 3.x (stable) for schema validation
- SCHEMA-DEC-02: Included gridX/gridY for SuperGrid positioning compatibility
- SCHEMA-DEC-03: Properties stored in EAV table (node_properties), not JSON column
- SCHEMA-DEC-04: Tags array converted to JSON string for SQL storage

**v4.7 Roadmap Structure:**
- ROADMAP-01: 3 phases derived from 8 requirements (SCHEMA, QUERY, ETL, FACET)
- ROADMAP-02: Phase 63 foundation (schema+query), Phase 64 ETL, Phase 65 UI surface
- ROADMAP-03: Dependency chain: 63 -> 64 -> 65 (table -> parser -> discovery)
- ROADMAP-04: v4.6 Phase 62 deferred to v4.8 (density filtering deprioritized)

**Phase 66-01 decisions (parallel - scroll fix):**
- SCROLL-01: CSS sticky positioning for headers (single scroll container)
- SCROLL-02: D3 zoom scale-only mode (translateExtent locked to 0,0)
- SCROLL-03: CSS native scroll handles all panning (panTo deprecated)
- SCROLL-04: Corner cell sticky at top+left with z-index: 3 for header intersection

**Phase 64-02 decisions:**
- STORE-01: Use KNOWN_KEYS set to distinguish schema-mapped vs unknown frontmatter keys
- STORE-02: JSON.stringify for complex values (arrays, objects) in node_properties
- STORE-03: Deterministic property ID format: prop-{nodeId}-{key}

**Phase 64-01 decisions:**
- YAML-01: Use yaml package as gray-matter engine for full YAML 1.2 spec support
- ID-01: SHA-256 truncated to 16 chars for human-readable collision-resistant IDs
- ID-02: Sort frontmatter keys before JSON stringification for key-order independence

**Phase 63-01 decisions:**
- SCHEMA-01: Use EAV table (node_properties) per roadmap spec rather than JSON column
- QUERY-01: Parameter binding via stmt.bind() before stmt.step() loop

**Phase 62-01 decisions:**
- DENS-IMPL-01: Level 1 = sparse (full Cartesian), Level 2+ = dense (populated-only)
- DENS-IMPL-02: Cartesian grid generates empty placeholders in sparse mode before filtering
- DENS-IMPL-03: Selection persistence inherits Phase 61 pattern (no changes needed)

**Phase 61-01 decisions:**
- TRANS-IMPL-01: Use transition interruption at render start to prevent animation buildup
- TRANS-IMPL-02: Nested headers use opacity fade-in only; repositioning deferred
- TRANS-IMPL-03: Selection styling applied in transition .on('end') callback

**Phase 60-03 decisions:**
- SORT-01: Sort state stored in PAFVContext for global access (not just D3)
- SORT-02: Three-state toggle cycle: asc -> desc -> null (clear)
- SORT-03: Sort not persisted to URL (sortConfig: null in serialization)

### What's Wired (Phase 64-02 COMPLETE)

```
Navigator -> PAFVContext -> SuperGrid -> GridRenderingEngine -> 2D render
    |           |            |              |
LATCH+Planes  mappings   projection    headers + positions
   +           +             +              +
Transpose   densityLevel  setDensityLevel  Janus zoom/pan
   +           +             +              +
Encoding   colorEncoding setColorEncoding  color scale -> card fill
Dropdowns  sizeEncoding  setSizeEncoding   size multiplier
   +           +
Sort       sortConfig    setSortBy
   +
LATCHSliders -> LATCHFilterService -> SuperGrid.query() -> filtered results
   +
Within-well -> getMappingsForPlane -> stacked axis support -> reorderMappingsInPlane
reorder       addMappingToPlane

Phase 60 Stacked Headers:
 AxisProjection.facets? -> StackedAxisConfig -> generateStackedHierarchy() -> HeaderHierarchy
  -> GridRenderingEngine.renderProjectionHeaders()
  -> renderStackedProjectionHeaders()
  -> SuperGridHeaders.renderStackedHeaders()
  -> HeaderProgressiveRenderer.renderMultiLevel()
  -> handleHeaderSortClick() with toggle cycle
  -> HeaderAnimationController.animateSortIndicator()

Phase 61 View Transitions:
GridRenderingEngine.render()
  -> interrupt() existing transitions
  -> renderProjectionHeaders() with .join() enter/update/exit
  -> renderNestedAxisHeaders() with opacity fade-in
  -> renderCards() with 300ms transitions
  -> .on('end') selection styling

SelectionContext -> SuperGrid.handleSelectionChange()
  -> renderingEngine.setSelectedIds()
  -> transitions preserve selection state

Phase 62 Density Filtering:
PAFVContext.densityLevel -> SuperGrid.setDensityLevel()
  -> constructDensityState(level)
  -> GridRenderingEngine.mapDensityLevelToExtent(level)
  -> renderingEngine.setDensityState(state)
  -> render() pipeline:
    -> prepareCardsForDensity() - generates Cartesian grid in sparse mode
    -> filterCardsByDensity() - removes empty cells in dense mode
    -> renderProjectionHeaders() - expands/contracts headers based on density
    -> renderCards() - filters visible cards with transitions

Phase 64 ETL Pipeline:
File.content -> parseAltoFile() -> parseFrontmatter() [gray-matter]
  -> mapToNodeRecord(parsed, filePath, rawFrontmatter)
  -> generateDeterministicSourceId(filePath, frontmatter, 'alto-index') [SHA-256]
  -> db.run(INSERT nodes)
  -> storeNodeProperties(db, nodeId, rawFrontmatter) [unknown keys -> EAV]

Phase 65 Schema-on-Read (COMPLETE):
node_properties table (EAV)
  -> discoverDynamicProperties() [nodeCount >= 3 threshold]
  -> inferLATCHBucket() [smart type routing]
  -> ClassifiedProperty[] with isDynamic=true & nodeCount
  -> usePropertyClassification()
  -> PafvNavigator.getAllLatchProperties()
  -> DraggablePropertyChip renders:
    - Sparkles icon (yellow-400/500)
    - Dashed border
    - Node count badge
```

### v4.7 Requirements Coverage

**Total requirements:** 8
- SCHEMA-01: Store arbitrary YAML keys in node_properties -> Phase 63
- SCHEMA-02: Foreign key with cascade delete -> Phase 63
- QUERY-01: Use stmt.bind(params) instead of interpolation -> Phase 63
- ETL-01: Replace custom parser with yaml package -> Phase 64
- ETL-02: Preserve unknown keys to node_properties -> Phase 64
- ETL-03: Deterministic source_id generation -> Phase 64
- FACET-01: Query node_properties for dynamic facets -> Phase 65
- FACET-02: Dynamic properties in Navigator UI -> Phase 65

**Coverage:** 8/8 mapped (100%), 8/8 implemented (100%) ✅ MILESTONE COMPLETE
- [x] SCHEMA-01: node_properties table (Phase 63-01)
- [x] SCHEMA-02: Foreign key with cascade delete (Phase 63-01)
- [x] QUERY-01: stmt.bind(params) in execute() (Phase 63-01)
- [x] ETL-01: yaml package parser (Phase 64-01 - parseFrontmatter with gray-matter)
- [x] ETL-02: Unknown keys to node_properties (Phase 64-02 - storeNodeProperties)
- [x] ETL-03: Deterministic source_id (Phase 64-01/02 - generateDeterministicSourceId wired)
- [x] FACET-01: Query node_properties for facets (Phase 65-01 - discoverDynamicProperties + inferLATCHBucket)
- [x] FACET-02: Dynamic properties in Navigator (Phase 65-02 - DraggablePropertyChip with sparkle icon, dashed border, node count badge)

### v4.8 Requirements Coverage

**Total phases:** 6 (Phases 67-72)
- Phase 67: Canonical Schema (SCHEMA-01, SCHEMA-02, SCHEMA-03)
- Phase 68: Import Coordinator (COORD-01, COORD-02, COORD-03)
- Phase 69: File Importers (IMP-01 through IMP-06)
- Phase 70: Integration (INT-01, INT-02, INT-03)
- Phase 71: Swift Bridge (BRIDGE-01, BRIDGE-02)
- Phase 72: Quality & Docs (QUAL-01, QUAL-02, QUAL-03)

**Coverage:** 5/6 phases in progress (83%)
- [x] Phase 67: Canonical Schema — Zod validation, JSON Schema, SQL mapping
- [x] Phase 68: Import Coordinator — Extension-based routing, Template Method pattern, validation infrastructure
- [x] Phase 69: File Importers — 6 importers (MD, JSON, CSV, HTML, Word, Excel) with TDD
- [~] Phase 70: Integration — Plan 01 complete (insertCanonicalNodes + window bridge)

### Pending Todos

**v4.7 (Schema-on-Read): ✅ COMPLETE**
- [x] Phase 62: Density Filtering (COMPLETE - executed in parallel with 63)
- [x] Phase 63: Schema & Query Safety (COMPLETE)
- [x] Phase 64: YAML ETL Parser (COMPLETE - 2 plans, ~7 minutes)
- [x] Phase 65: Facet Discovery (COMPLETE - 2 plans, ~7 minutes total)

**v4.8 (ETL Consolidation): ✅ MILESTONE COMPLETE**
- [x] Phase 67: Canonical Schema (COMPLETE - ~10 minutes)
- [x] Phase 68: Import Coordinator (COMPLETE - ~5 minutes)
- [x] Phase 69: File Importers (COMPLETE - ~8 minutes parallel, 6 importers)
- [x] Phase 70: Integration (COMPLETE - Plans 01-02)
- [x] Phase 71: Swift Bridge (COMPLETE - ~45 minutes, all 4 plans)
- [x] Phase 72: Quality & Docs (COMPLETE - ~10 minutes, audit passed)

**v5.0 (SuperGrid MVP) — PHASE A COMPLETE:**
- [x] Phase 73-01: SuperStack Multi-Level Headers (COMPLETE - ~6 minutes)
- [x] Phase 73-02: SuperDensity Controls (COMPLETE - ~6 minutes)
- [x] Phase 73-03: SuperZoom Upper-Left Anchor (COMPLETE - ~4 minutes)
- [x] Phase 73-04: Header Click Zones (COMPLETE - ~5 minutes)

**v5.0 (SuperGrid MVP) — PHASE B COMPLETE:**
- [x] Phase 74-01: SuperDynamic Axis Repositioning (COMPLETE - ~8 minutes)
- [x] Phase 74-02: SuperSize Column/Row Resizing (COMPLETE - ~15 minutes)
- [x] Phase 74-03: SuperSelect Multi-Selection (COMPLETE - ~5 minutes)
- [x] Phase 74-04: SuperPosition Coordinate Tracking (COMPLETE - ~5 minutes)

**v5.0 (SuperGrid MVP) — PHASE C COMPLETE:**
- [x] Phase 75-01: SuperFilter header dropdown filters (COMPLETE - ~8 minutes)
- [x] Phase 75-02: SuperSort multi-level sorting (COMPLETE - ~5 minutes)
- [x] Phase 75-03: SuperCards header/aggregation distinction (COMPLETE - ~5 minutes)
- [x] Phase 75-04: SuperAudit computed value highlighting (COMPLETE - ~8 minutes)

**v4.9 (Data Layer Completion) — MILESTONE COMPLETE:**
- [x] Phase 77-01: Version increment trigger (COMPLETE - ~5 minutes)
- [x] Phase 78-01: Node deep links (?nodeId=) (COMPLETE - ~6 minutes)
- [x] Phase 78-02: Filter state in URL (COMPLETE - ~3 minutes, pre-existing implementation)
- [x] Phase 79-01: Facet aggregate queries (COMPLETE - ~4 minutes)
- [x] Phase 79-02: Catalog browser UI (COMPLETE - ~4 minutes)
- [x] Phase 79-03: Breadcrumb navigation (COMPLETE - ~6 minutes)

**Technical debt:**
- [ ] Knip unused exports cleanup (ratchet from 1000 down over time)
- [ ] Directory health: src/services (22/15 files)
- [ ] Nested header repositioning animation (deferred from 61-01)

### Blockers/Concerns

None — v4.9 Data Layer (Phases 77-79) complete. All current milestones done.

**v4.9 Data Layer Achievement:**
Data layer completion milestone finished. Versioning with auto-increment trigger (Phase 77), URL deep linking with ?nodeId= parameter and filter serialization (Phase 78), and Catalog Browser with facet aggregates, FolderTree/TagCloud/StatusChips components, and FilterBreadcrumb navigation (Phase 79). All 7 plans complete.

**v5.0 Phase C Achievement:**
SuperGrid Phase C delivers visual polish and data features: SuperFilter header dropdown filters with SQL compilation, SuperSort multi-level sorting with priority badges, SuperCards header/aggregation distinction with chrome gradient and search exclusion, and SuperAudit computed value highlighting with CRUD flash animations. All four plans complete with comprehensive tests.

**v5.0 Phase B Achievement:**
SuperGrid Phase B delivers interaction capabilities: SuperDynamic axis repositioning with D3 drag-and-drop, SuperSize column/row resize with bulk and auto-fit, SuperSelect multi-selection with lasso and range modes, and SuperPosition PAFV coordinate tracking for view transitions. All four plans complete with comprehensive tests.

**v5.0 Phase A Achievement:**
SuperGrid Phase A delivers the core SuperStack, SuperDensity, SuperZoom, and Header Click Zones features. Multi-level headers with visual spanning, Janus density model controls, pinned zoom with boundary constraints, and zone-based hit testing with hover highlighting are all operational.

**v4.8 Milestone Achievement:**
ETL Consolidation complete. Unified canonical schema with Zod validation, six format importers (MD, JSON, CSV, HTML, Word, Excel), Swift bridge for native framework access (EventKit, Contacts, Notes), and quality audit confirming 179 tests passing with >80% coverage. All import paths validate against CanonicalNodeSchema with detailed error messages.

**v4.7 Milestone Achievement:**
Schema-on-read capability fully functional. Users can add arbitrary YAML frontmatter keys to markdown files, which are stored in node_properties EAV table and automatically discovered/classified into LATCH buckets with smart type inference. Dynamic properties surface in Navigator UI with sparkle icons, dashed borders, and node count badges for complete visual feedback loop.

## Session Continuity

Last session: 2026-02-13
Stopped at: Plan 84-02 complete — Card/Connection TypeScript types with type guards and row converters
Resume file: .planning/phases/84-cards-and-connections/84-03-PLAN.md
Next action: Execute 84-03-PLAN.md (Data layer integration - useCards hook and CardManager)
