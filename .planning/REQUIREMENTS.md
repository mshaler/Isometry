# Requirements: Isometry

**Defined:** 2026-02-10
**Core Value:** Polymorphic data projection platform where the same LATCH-filtered, GRAPH-connected dataset renders through PAFV spatial projection as grid, kanban, network, or timeline.

---

## v6.9 Requirements — Polymorphic Views & Foundation

**Created:** 2026-02-16
**Research Source:** `.planning/research/SUMMARY.md`

This milestone enables the full Grid Continuum (Gallery/List/Kanban/Grid/SuperGrid) with CSS primitives, cleans up technical debt, polishes Network/Timeline views, and completes Three-Canvas notebook integration.

**Parallelization:**
- Tracks A+B run in parallel (independent concerns)
- Track C depends on Track A (views need CSS primitives wired)
- Track D depends on Track C (canvas integration needs working views)

### Track A: View Continuum Integration

Build the polymorphic view system where Gallery → List → Kanban → Grid → SuperGrid render the same data with different PAFV axis allocations.

#### REQ-A-01: Gallery View Renderer

**Description:** Create GalleryView component that renders cards in CSS Grid masonry layout with TanStack Virtual for performance.

**Acceptance Criteria:**
- [ ] GalleryView.tsx renders cards in responsive masonry grid
- [ ] Uses CSS Grid `auto-fit` for column count adaptation
- [ ] Integrates with useSQLiteQuery for data fetching
- [ ] Supports TanStack Virtual for 500+ item performance
- [ ] Responds to LATCH filter changes via FilterContext
- [ ] Click card → updates SelectionContext
- [ ] 60 FPS scroll at 500+ items

**Priority:** P0 (MVP foundation)
**Dependencies:** useSQLiteQuery hook, SelectionContext, FilterContext

---

#### REQ-A-02: List View Renderer

**Description:** Create ListView component that renders cards in hierarchical tree with expand/collapse and keyboard navigation.

**Acceptance Criteria:**
- [ ] ListView.tsx renders cards in indented tree structure
- [ ] Supports expand/collapse at each hierarchy level
- [ ] Keyboard navigation: Arrow keys move selection, Enter expands/collapses
- [ ] Integrates with useSQLiteQuery for data fetching
- [ ] Hierarchy determined by PAFV axis allocation (e.g., folder → subfolder)
- [ ] Click card → updates SelectionContext
- [ ] ARIA roles for accessibility (tree, treeitem)

**Priority:** P0 (MVP foundation)
**Dependencies:** useSQLiteQuery hook, SelectionContext, GridContinuumController

---

#### REQ-A-03: Kanban View Renderer

**Description:** Create KanbanView component that renders cards in columns grouped by a single facet, with drag-and-drop between columns.

**Acceptance Criteria:**
- [ ] KanbanView.tsx renders columns based on facet values (e.g., status)
- [ ] Uses CSS Grid for column layout
- [ ] Drag-and-drop cards between columns via dnd-kit
- [ ] Drop → SQL UPDATE to persist facet value change
- [ ] Column headers show facet value + count badge
- [ ] Integrates with useSQLiteQuery for data fetching
- [ ] Click card → updates SelectionContext

**Priority:** P0 (MVP foundation)
**Dependencies:** useSQLiteQuery hook, SelectionContext, dnd-kit (existing)

---

#### REQ-A-04: Grid Continuum Mode Switcher

**Description:** Create ViewDispatcher and GridContinuumSwitcher components to route between view modes and provide UI for switching.

**Acceptance Criteria:**
- [ ] ViewDispatcher.tsx routes to correct view based on activeView state
- [ ] GridContinuumSwitcher.tsx provides button group for Gallery/List/Kanban/Grid/SuperGrid
- [ ] Mode switch preserves current LATCH filters
- [ ] Mode switch preserves card selection (via SelectionContext)
- [ ] Visual indicator shows active mode
- [ ] Keyboard shortcut support (Cmd+1-5 for modes)

**Priority:** P0 (MVP foundation)
**Dependencies:** REQ-A-01, REQ-A-02, REQ-A-03, SelectionContext

---

#### REQ-A-05: PAFV Axis Allocation per View Mode

**Description:** Wire GridContinuumController to allocate axes differently for each view mode.

**Acceptance Criteria:**
- [ ] GridContinuumController.allocateAxes(mode) returns correct axis config:
  - Gallery: 0 explicit axes (position only)
  - List: 1 axis (hierarchy facet)
  - Kanban: 1 facet (column grouping)
  - Grid: 2 axes (x, y)
  - SuperGrid: n axes (stacked headers)
- [ ] Axis allocation drives SQL GROUP BY generation
- [ ] Axis allocation drives renderer configuration
- [ ] Single source of truth (no duplicate axis logic in renderers)

**Priority:** P0 (MVP foundation)
**Dependencies:** GridContinuumController (existing), ViewQueryBuilder

---

#### REQ-A-06: Cross-View Selection Synchronization

**Description:** Ensure SelectionContext syncs selection state across all view modes during transitions.

**Acceptance Criteria:**
- [ ] Select card in Gallery → switch to List → same card selected
- [ ] Select card in Kanban → switch to SuperGrid → same card selected
- [ ] Multi-select persists across view transitions
- [ ] Selection persists in sessionStorage for page refresh
- [ ] Selection drives CSS `.selected` class in all renderers

**Priority:** P1 (polish)
**Dependencies:** REQ-A-04, SelectionContext

---

### Track B: Technical Debt Sprint

Clean up unused exports, refactor oversized directories, and establish TipTap test infrastructure.

#### REQ-B-01: Knip Unused Exports Cleanup

**Description:** Reduce unused export count from 275 to <100 using knip analysis.

**Acceptance Criteria:**
- [ ] Run knip audit on full codebase
- [ ] Review each unused export for false positives (check internal usage)
- [ ] Delete truly unused exports with characterization tests as safety net
- [ ] Create barrel exports (index.ts) for public API clarity
- [ ] Final knip count < 100 unused exports
- [ ] All existing tests pass before and after each batch

**Priority:** P1 (health)
**Dependencies:** None

---

#### REQ-B-02: src/services Directory Refactoring

**Description:** Reduce src/services from 22 files to ≤15 by reorganizing into focused subdirectories.

**Acceptance Criteria:**
- [ ] Audit src/services for groupable concerns
- [ ] Create subdirectories by domain (e.g., services/supergrid/, services/data/)
- [ ] Move files into appropriate subdirectories
- [ ] Update import paths (use TypeScript path aliases)
- [ ] Validate imports: `tsc --noEmit` passes
- [ ] Final file count ≤ 15 at top level of src/services/

**Priority:** P2 (health)
**Dependencies:** REQ-B-01 (clean exports first)

---

#### REQ-B-03: TipTap Automated Test Infrastructure

**Description:** Establish automated testing infrastructure for TipTap editor functionality.

**Acceptance Criteria:**
- [ ] Create TipTap test utilities (render helper, mock extensions)
- [ ] Write unit tests for custom TipTap extensions
- [ ] Write integration tests for slash commands
- [ ] Write tests for LATCH property binding
- [ ] All TipTap tests run in Vitest
- [ ] Add to CI pipeline

**Priority:** P2 (health)
**Dependencies:** None

---

### Track C: Network/Timeline Polish

Wire existing D3 renderers to SQL-driven data hooks and add to Preview tab.

#### REQ-C-01: Network Graph SQL Integration

**Description:** Refactor ForceGraphRenderer to use useSQLiteQuery for data fetching.

**Acceptance Criteria:**
- [ ] NetworkView.tsx wraps ForceGraphRenderer with SQL data fetching
- [ ] Uses useSQLiteQuery hook for nodes and edges
- [ ] LATCH filter changes → network re-renders filtered subgraph
- [ ] Force simulation lifecycle managed (stop on unmount, restart on data change)
- [ ] No memory leaks on 10 consecutive view switches (verify via DevTools)
- [ ] 60 FPS at 500 nodes

**Priority:** P1 (breadth)
**Dependencies:** Track A complete (ViewDispatcher working)

---

#### REQ-C-02: Timeline View SQL Integration

**Description:** Refactor TimelineRenderer to use useSQLiteQuery for data fetching.

**Acceptance Criteria:**
- [ ] TimelineView.tsx wraps TimelineRenderer with SQL data fetching
- [ ] Uses useSQLiteQuery hook for time-based events
- [ ] LATCH filter changes → timeline re-renders filtered events
- [ ] Zoom levels with adaptive tick labels (day/week/month/year)
- [ ] Overlapping event layout (swimlanes)
- [ ] 60 FPS zoom/pan at 500 events

**Priority:** P1 (breadth)
**Dependencies:** Track A complete (ViewDispatcher working)

---

#### REQ-C-03: Preview Tab Integration

**Description:** Add Network and Timeline as selectable tabs in the Preview pane.

**Acceptance Criteria:**
- [ ] Preview pane has tab bar: SuperGrid | Network | Timeline
- [ ] Tab selection updates activeView state
- [ ] View-specific PAFV controls appear per tab
- [ ] Tab state persists across sessions

**Priority:** P1 (UX)
**Dependencies:** REQ-C-01, REQ-C-02

---

#### REQ-C-04: Force Simulation Lifecycle Management

**Description:** Create ForceSimulationManager to prevent memory leaks from D3 force simulations.

**Acceptance Criteria:**
- [ ] ForceSimulationManager class wraps D3 forceSimulation
- [ ] Exposes start(), stop(), reheat() methods
- [ ] Automatic stop on component unmount
- [ ] useForceSimulation hook integrates with React lifecycle
- [ ] No detached DOM nodes after 10 view switches (verify via DevTools Memory)

**Priority:** P0 (prevents leaks)
**Dependencies:** None (implement before REQ-C-01)

---

### Track D: Three-Canvas Notebook

Complete Capture + Shell + Preview integration with cross-pane selection sync.

#### REQ-D-01: Three-Canvas Layout

**Description:** Implement resizable three-pane layout with react-resizable-panels.

**Acceptance Criteria:**
- [ ] ThreeCanvasLayout.tsx with Capture | Shell | Preview panes
- [ ] Resizable dividers between panes
- [ ] Pane sizes persist to localStorage
- [ ] Minimum pane widths enforced (prevent collapse to 0)
- [ ] Focus mode toggle (double-click divider → pane expands)
- [ ] Keyboard shortcuts: Cmd+1/2/3 to focus pane

**Priority:** P0 (MVP)
**Dependencies:** None

---

#### REQ-D-02: Cross-Pane Selection Sync

**Description:** Wire SelectionContext to highlight selections across all three panes.

**Acceptance Criteria:**
- [ ] Click card in Preview Grid → highlight corresponding block in Capture
- [ ] Click block in Capture → highlight corresponding card in Preview
- [ ] Selection highlight visible in both panes simultaneously
- [ ] Shell pane receives selection context for AI queries
- [ ] Selection sync works across all view modes (Gallery, List, Kanban, Grid, Network, Timeline)

**Priority:** P0 (differentiator)
**Dependencies:** REQ-D-01, Track A complete

---

#### REQ-D-03: View State Preservation

**Description:** Create ViewStateManager to persist scroll position, zoom level, and selection per view.

**Acceptance Criteria:**
- [ ] ViewStateManager class tracks state per view mode
- [ ] Scroll position saved/restored on view switch
- [ ] Zoom level saved/restored (Network, Timeline)
- [ ] Selection saved/restored (via SelectionContext)
- [ ] State persists to sessionStorage
- [ ] Switch modes 5x → state preserved each time

**Priority:** P1 (UX polish)
**Dependencies:** REQ-D-02

---

#### REQ-D-04: Pane Resize Coordination

**Description:** Create PaneLayoutContext to coordinate resize events without desync.

**Acceptance Criteria:**
- [ ] Single ResizeObserver at container level
- [ ] PaneLayoutContext provides current dimensions to children
- [ ] Debounced resize events (500ms threshold)
- [ ] No content overflow during resize animation
- [ ] SuperGrid column widths adapt to available space

**Priority:** P1 (UX polish)
**Dependencies:** REQ-D-01

---

### Non-Functional Requirements (v6.9)

#### REQ-NF-01: Performance Targets

**Description:** All views meet performance baselines.

**Acceptance Criteria:**
- [ ] Gallery: 60 FPS scroll at 500+ items
- [ ] List: 60 FPS scroll at 500+ items
- [ ] Kanban: 60 FPS drag-drop at 100+ cards
- [ ] SuperGrid: 60 FPS scroll at 500+ cells
- [ ] Network: 60 FPS zoom/pan at 500 nodes
- [ ] Timeline: 60 FPS zoom/pan at 500 events
- [ ] Memory < 100MB at 5000 items (any view)
- [ ] SQL query execution < 100ms for 10K nodes

**Priority:** P0
**Dependencies:** All Track A, C requirements

---

#### REQ-NF-02: CSS Primitives Consumption

**Description:** All views consume existing CSS primitives from v6.8.

**Acceptance Criteria:**
- [ ] Gallery uses primitives-gallery.css
- [ ] List uses primitives-supergrid.css (list mode)
- [ ] Kanban uses primitives-kanban.css
- [ ] Timeline uses primitives-timeline.css
- [ ] No inline styles for layout (CSS Grid/Flex classes only)
- [ ] CSS specificity validated during view transitions

**Priority:** P1
**Dependencies:** CSS primitives from v6.8

---

#### REQ-NF-03: Test Coverage

**Description:** New components have comprehensive test coverage.

**Acceptance Criteria:**
- [ ] Unit tests for all view renderers (Gallery, List, Kanban, Network, Timeline)
- [ ] Unit tests for ViewDispatcher routing
- [ ] Unit tests for GridContinuumController axis allocation
- [ ] Integration tests for cross-view selection sync
- [ ] Integration tests for SQL data flow to renderers
- [ ] All tests pass in CI

**Priority:** P1
**Dependencies:** All implementation requirements

---

### v6.9 Out of Scope

The following are explicitly deferred:
- Real-time collaboration (Yjs integration)
- CloudKit sync
- Canvas-based rendering for 10K+ nodes (Phase 7.0)
- Web Worker force simulation optimization (Phase 7.0)
- Multi-monitor support
- D3 visualization blocks in Capture editor
- GSD GUI wrapper

---

### v6.9 Requirement Summary

| Track | REQ Count | Priority Breakdown |
|-------|-----------|-------------------|
| Track A (View Continuum) | 6 | 5 P0, 1 P1 |
| Track B (Tech Debt) | 3 | 0 P0, 1 P1, 2 P2 |
| Track C (Network/Timeline) | 4 | 1 P0, 3 P1 |
| Track D (Three-Canvas) | 4 | 2 P0, 2 P1 |
| Non-Functional | 3 | 1 P0, 2 P1 |
| **Total** | **20** | **9 P0, 9 P1, 2 P2** |

---

## v6.5 Requirements — Console Cleanup

Eliminate console errors and excessive debug logging to provide a clean developer experience.

### Bug Fixes (Phase 103)

- [ ] **BUG-01**: TipTap editor initializes without duplicate 'link' extension warning
- [ ] **BUG-02**: Favicon.ico exists and loads without 404 error
- [ ] **BUG-03**: Browser console shows no errors on initial page load

### Log Level Controls (Phase 103)

- [ ] **LOG-01**: `dev-logger.ts` supports configurable log levels (error, warn, info, debug)
- [ ] **LOG-02**: Default log level is 'warn' in production, 'debug' in development
- [ ] **LOG-03**: SQLiteProvider lifecycle logs gated behind 'debug' level
- [ ] **LOG-04**: HeaderDiscoveryService logs gated behind 'debug' level
- [ ] **LOG-05**: PropertyClassifier logs gated behind 'debug' level
- [ ] **LOG-06**: SuperStack rendering logs gated behind 'debug' level
- [ ] **LOG-07**: GridRenderingEngine logs gated behind 'debug' level

### Warning Resolution (Phase 103)

- [ ] **WARN-01**: Axis facet fallback logic fixed (status → tags fallback eliminated or intentional)
- [ ] **WARN-02**: NestedHeaderRenderer truncation warning only shows in debug mode
- [ ] **WARN-03**: YAML parse fallback warning only shows when actually recovering from malformed data
- [ ] **WARN-04**: SuperStack header count warning only shows in debug mode

## v6.4 Requirements — Hardcoded Values Cleanup

Eliminate or externalize hardcoded LATCH filter values (priority, status, folder options, etc.) to support true schema-on-read architecture.

### Settings Registry (Phase 100)

- [ ] **SETTINGS-01**: `settings` table created with `key TEXT PRIMARY KEY`, `value TEXT` (JSON), timestamps
- [ ] **SETTINGS-02**: `getSetting(key)` returns parsed JSON value or null
- [ ] **SETTINGS-03**: `setSetting(key, value)` upserts with timestamp update
- [ ] **SETTINGS-04**: Settings seeded on first database initialization (empty defaults)

### Discovery Queries (Phase 100)

- [ ] **DISCOVER-01**: `discoverFolderValues()` returns `SELECT DISTINCT folder FROM cards WHERE folder IS NOT NULL`
- [ ] **DISCOVER-02**: `discoverStatusValues()` returns `SELECT DISTINCT status FROM cards WHERE status IS NOT NULL`
- [ ] **DISCOVER-03**: `discoverFacetValues(column)` generic query for any facet column
- [ ] **DISCOVER-04**: Results cached via TanStack Query with 5-minute stale time

### UI Integration (Phase 101)

- [ ] **UI-01**: CardDetailModal folder dropdown populated from discovery query
- [ ] **UI-02**: CardDetailModal status dropdown populated from discovery query
- [ ] **UI-03**: Status colors derived from settings or use neutral default
- [ ] **UI-04**: LATCHFilter priority range discovered from data or settings
- [ ] **UI-05**: Empty states shown when no values discovered

### Property Classifier Updates (Phase 101)

- [ ] **CLASSIFY-01**: `columnHasData()` handles all numeric columns without hardcoded defaults
- [ ] **CLASSIFY-02**: Remove hardcoded `numericColumnsWithDefaults` object
- [ ] **CLASSIFY-03**: Missing columns return false gracefully (no assumptions)

### Sample Data Cleanup (Phase 102)

- [ ] **SAMPLE-01**: Remove FACETS_SEED_SQL status/priority facets (seed only universal facets)
- [ ] **SAMPLE-02**: SAMPLE_NOTES use null or dynamic priority (not hardcoded 0-5)
- [ ] **SAMPLE-03**: Sample data reflects realistic schema-on-read imports

### Test Fixtures Cleanup (Phase 102)

- [ ] **TEST-01**: TEST_FACETS avoid status options hardcoding (use placeholder or remove)
- [ ] **TEST-02**: TEST_NODES status/priority values optional or removed
- [ ] **TEST-03**: loadTestFixtures handles missing columns gracefully

## v6.3 Requirements — SuperStack SQL Integration (COMPLETE)

Connect SuperStack headers to live SQLite data via sql.js with query builders, React hooks, and integration tests.

### SQL Query Builders

- [ ] **QUERY-01**: `buildHeaderDiscoveryQuery` builds valid SQL for row + column facets with GROUP BY
- [ ] **QUERY-02**: Multi-select facets (tags) handled via `json_each()` CROSS JOIN
- [ ] **QUERY-03**: Time facets extracted via `strftime()` with proper format (%Y, %m, etc.)
- [ ] **QUERY-04**: Query filters apply correctly with parameterized queries
- [ ] **QUERY-05**: Card counts returned per facet combination
- [ ] **QUERY-06**: Deleted nodes excluded by default (optional `includeDeleted` flag)

### Query Utilities

- [ ] **QUTIL-01**: `createTimeFacetChain` generates year/quarter/month/week/day configs
- [ ] **QUTIL-02**: `createCategoryFacetChain` generates folder/status/tags configs
- [ ] **QUTIL-03**: `validateFacetConfigs` detects missing/invalid facet settings
- [ ] **QUTIL-04**: `estimateQueryComplexity` returns 1-10 complexity score

### React Hook

- [ ] **HOOK-01**: `useSuperStackData` returns `{ rowTree, colTree, isLoading, error, refetch }`
- [ ] **HOOK-02**: Hook builds query from facet configurations automatically
- [ ] **HOOK-03**: Hook transforms query results into HeaderTree via `buildHeaderTree`
- [ ] **HOOK-04**: Hook tracks query execution time (`queryTime` metric)
- [ ] **HOOK-05**: `useRowHeaders` and `useColHeaders` lightweight variants available

### Integration Tests

- [ ] **TEST-01**: Tests execute against real sql.js database (not mocks)
- [ ] **TEST-02**: Multi-select facet explosion verified (tags appear as separate rows)
- [ ] **TEST-03**: Time facet extraction verified (year/month correctly parsed)
- [ ] **TEST-04**: Tree building from SQL results produces correct spans and counts
- [ ] **TEST-05**: Query completes in <100ms for test dataset

### Demo Component

- [ ] **DEMO-01**: `SuperStackDemo` renders live data using `useSuperStackData` hook
- [ ] **DEMO-02**: Collapse/expand interactions functional with tree recalculation
- [ ] **DEMO-03**: Click-to-filter logs path and count to console

## v6.2 Requirements — Capture Writing Surface (COMPLETE)

All 43 requirements delivered across Phases 94-98. See `.planning/phases/` for details.

## v6.1 Requirements — SuperStack Enhancement (COMPLETE)

Dramatically enhance SuperGrid via SuperStack—the nested hierarchical header system that transforms SuperGrid from a flat grid into a true dimensional pivot table.

### Static Headers Foundation

- [ ] **SSTACK-01**: System defines HeaderNode, HeaderTree, FacetConfig, SuperStackState types
- [ ] **SSTACK-02**: System builds header tree from flat query row data (tree builder)
- [ ] **SSTACK-03**: System renders column headers with correct hierarchical spans (Year spans 12 months)
- [ ] **SSTACK-04**: System renders row headers with correct hierarchical spans (Folder spans all tags)
- [ ] **SSTACK-05**: System provides default dimensions and common facet configurations
- [ ] **SSTACK-06**: Static headers render with CSS styling matching ASCII mockups

### SQL Integration

- [ ] **SQL-01**: System builds header discovery query (GROUP BY with COUNT)
- [ ] **SQL-02**: System handles time facets via strftime (year, quarter, month, week)
- [ ] **SQL-03**: System handles multi_select facets via json_each (tags)
- [ ] **SQL-04**: System shows loading state during header discovery
- [ ] **SQL-05**: System handles empty datasets gracefully

### Interactions

- [x] **INT-01**: User can collapse/expand headers (toggle collapsed state)
- [ ] **INT-02**: System recalculates spans when headers collapse (collapsed parent = span 1)
- [ ] **INT-03**: User can click header to filter data to that subset (path-based filtering)
- [ ] **INT-04**: System highlights selected header visually
- [ ] **INT-05**: User can navigate headers via keyboard (arrow keys)

### Data Cell Integration

- [ ] **CELL-01**: Data cells render in correct positions relative to leaf headers
- [ ] **CELL-02**: System coordinates scroll between headers and data area
- [ ] **CELL-03**: Density level affects cell rendering (counts vs card chips)
- [ ] **CELL-04**: Selection syncs between headers and data cells

### Polish & Performance

- [ ] **PERF-01**: Virtual scrolling for >1000 cells maintains 30+ fps
- [ ] **PERF-02**: Headers remain sticky while scrolling data area
- [ ] **A11Y-01**: ARIA labels present for screen reader accessibility
- [ ] **UX-01**: Empty state displays informative message
- [ ] **UX-02**: Collapse/expand transitions animate smoothly

## v6.0 Requirements — Interactive Shell (DEFERRED)

Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.

### Terminal Execution

- [ ] **TERM-01**: User can execute shell commands via subprocess (node-pty backend)
- [ ] **TERM-02**: User sees stdout/stderr streamed to terminal in real-time
- [ ] **TERM-03**: User can toggle between Claude Code and native shell modes
- [ ] **TERM-04**: System handles process lifecycle (spawn, signal, terminate)
- [ ] **TERM-05**: Terminal reconnects automatically with output buffer replay

### Claude AI Chat

- [ ] **CLAI-01**: User can send messages and see chat history
- [ ] **CLAI-02**: System connects to MCP server via Streamable HTTP transport
- [ ] **CLAI-03**: User sees streaming responses with typing indicator
- [ ] **CLAI-04**: User must approve tool calls before execution (modal)
- [ ] **CLAI-05**: AI can access resources (file system, database) via MCP
- [ ] **CLAI-06**: System manages context lifecycle (create/use/release)

### GSD GUI Sync

- [ ] **GSD-01**: System reads `.planning/` files (STATE.md, ROADMAP.md, phase plans)
- [ ] **GSD-02**: File watcher detects changes with debounced updates
- [ ] **GSD-03**: User sees phase progress display from files
- [ ] **GSD-04**: User can update task status, changes write back to files
- [ ] **GSD-05**: System shows conflict resolution UI for concurrent edits
- [ ] **GSD-06**: User can toggle task status (pending/in_progress/complete)

### Backend Infrastructure

- [ ] **BACK-01**: WebSocket server routes messages by type (terminal/mcp/file)
- [ ] **BACK-02**: Backend integrates node-pty for terminal subprocess
- [ ] **BACK-03**: Backend runs chokidar file watcher for `.planning/` directory
- [ ] **BACK-04**: MCP client service handles Claude API communication
- [ ] **BACK-05**: Security: use argument arrays, never string command interpolation

## v5.1 Requirements — Notebook Integration (COMPLETE)

Integrate NotebookLayout into IntegratedLayout as a collapsible panel below Command Bar.

### Layout Integration

- [x] **LAYOUT-01**: User can see a collapsed Notebook panel below Command Bar
- [x] **LAYOUT-02**: User can expand/collapse the Notebook panel via toggle button
- [x] **LAYOUT-03**: User can see all three Notebook panes (Capture, Shell, Preview) when expanded

### Context Wiring

- [x] **CTX-01**: NotebookContext available in IntegratedLayout tree
- [x] **CTX-02**: Notebook state persists across expand/collapse cycles

### Visual Polish

- [x] **VIS-01**: Collapsed state shows minimal header with expand indicator
- [x] **VIS-02**: Expanded state respects theme (NeXTSTEP/Modern)
- [x] **VIS-03**: Smooth expand/collapse animation

## v4.7 Requirements — Schema-on-Read

Dynamic YAML property discovery and storage for true schema-on-read semantics.

### Schema Storage

- [ ] **SCHEMA-01**: System stores arbitrary YAML frontmatter keys in `node_properties` table
- [ ] **SCHEMA-02**: Properties linked to nodes via foreign key with cascade delete

### Query Safety

- [ ] **QUERY-01**: SQL queries use `stmt.bind(params)` instead of string interpolation

### ETL Pipeline

- [ ] **ETL-01**: YAML parser handles full YAML spec (replace custom parser with `yaml` package)
- [ ] **ETL-02**: Unknown frontmatter keys preserved into `node_properties` table
- [ ] **ETL-03**: `source_id` generation is deterministic with collision-free fallback (filePath + frontmatter hash)

### Facet Discovery

- [ ] **FACET-01**: Property classifier queries `node_properties` for distinct keys
- [ ] **FACET-02**: Dynamic properties appear as available facets in Navigator

## v4.4 Requirements — SuperGrid PAFV Projection

Wire SuperGrid to consume PAFV axis mappings for 2D card positioning with dynamic headers and smooth transitions.

### Projection Core (Shipped v4.4)

- [x] **PROJ-01**: SuperGrid reads current axis mappings from PAFVContext and uses them to determine grid layout — v4.4
- [x] **PROJ-02**: X-axis mapping determines column headers — unique facet values become columns — v4.4
- [x] **PROJ-03**: Y-axis mapping determines row headers — unique facet values become rows — v4.4
- [x] **PROJ-04**: Cards position at the intersection of their X and Y facet values (same X+Y → same cell) — v4.4
- [x] **PROJ-05**: Cards with null/undefined facet values appear in an "Unassigned" bucket row or column — v4.4

### Header Generation (Shipped v4.4)

- [x] **HDR-01**: Column headers are dynamically generated from unique X-axis facet values in the dataset — v4.4
- [x] **HDR-02**: Row headers are dynamically generated from unique Y-axis facet values in the dataset — v4.4
- [x] **HDR-03**: Headers respect facet type formatting (dates formatted, categories labeled) — v4.4

### Stacked/Nested Headers (Shipped v4.5)

- [x] **STACK-01**: Multi-level header hierarchy renders when multiple facets assigned to same plane (stacked axes) — v4.5
- [x] **STACK-02**: Parent header cells visually span across their child headers (Excel pivot table style) — v4.5
- [x] **STACK-03**: Header clicks allow sorting by that level of the hierarchy — v4.5

## v4.6 Requirements — SuperGrid Polish

Complete SuperGrid projection system with animated view transitions and sparse/dense cell filtering.

### View Transitions (Shipped Phase 61)

- [x] **TRANS-01**: Changing axis mapping triggers animated card repositioning (300ms D3 transitions) — v4.6
- [x] **TRANS-02**: Header elements animate when plane assignment changes — v4.6
- [x] **TRANS-03**: Selection state is preserved during view transitions (selected cards stay selected) — v4.6

### Density Filtering (Deferred to v4.8)

- [ ] **DENS-01**: Sparse mode (DensityLevel 1) renders full Cartesian grid including empty cells
- [ ] **DENS-02**: Dense mode (DensityLevel 2) hides empty cells, shows only populated intersections
- [ ] **DENS-03**: Janus pan control triggers sparse/dense filtering in GridRenderingEngine

## Validated Requirements (Shipped)

### v5.0 Type Safety Restoration (shipped 2026-02-10)

- [x] **TSFIX-01 through TSFIX-12**: All 1,347 TypeScript compilation errors eliminated — v5.0

### v4.2 Three-Canvas Notebook (shipped 2026-02-10)

- [x] **SHELL-01 through SHELL-06**: Shell integration complete — v4.2
- [x] **PREV-01 through PREV-07**: Preview visualization complete — v4.2
- [x] **EDIT-01 through EDIT-04**: TipTap editor migration complete — v4.2
- [x] **SYNC-01 through SYNC-03**: Live data synchronization complete — v4.2

### v4.3 Navigator Integration (shipped 2026-02-10)

- [x] **FOUND-01 through FOUND-05**: Property classification foundation complete — v4.3
- [x] **NAV-01 through NAV-05**: Navigator UI integration complete — v4.3

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Advanced Editor

- **AEDT-01**: User can embed D3 visualizations inline in editor
- **AEDT-02**: User can see version history per block
- **AEDT-03**: User can use formula bar with PAFV-aware functions

### Advanced Projection

- **APROJ-01**: Color plane projection (cards colored by facet value)
- **APROJ-02**: Size plane projection (cards sized by facet value)
- **APROJ-03**: GRAPH bucket axis support (position by graph metrics)
- **APROJ-04**: SuperStack nested headers (multi-level hierarchy)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Color/Size/Shape plane projections | Shipped in Phase 57-03 |
| GRAPH bucket axis support | Needs research on how to position by graph metrics |
| SuperDensity Janus controls integration | Shipped in Phase 57-01 |
| Real-time collaboration | Single-user local-first app |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROJ-01 | Phase 56 | Complete |
| PROJ-02 | Phase 56 | Complete |
| PROJ-03 | Phase 56 | Complete |
| PROJ-04 | Phase 56 | Complete |
| PROJ-05 | Phase 56 | Complete |
| HDR-01 | Phase 57 | Complete |
| HDR-02 | Phase 57 | Complete |
| HDR-03 | Phase 57 | Complete |
| STACK-01 | Phase 60 | Complete |
| STACK-02 | Phase 60 | Complete |
| STACK-03 | Phase 60 | Complete |
| TRANS-01 | Phase 61 | Complete |
| TRANS-02 | Phase 61 | Complete |
| TRANS-03 | Phase 61 | Complete |
| DENS-01 | Phase 62 | Deferred (v4.8) |
| DENS-02 | Phase 62 | Deferred (v4.8) |
| DENS-03 | Phase 62 | Deferred (v4.8) |
| SCHEMA-01 | Phase 63 | Pending |
| SCHEMA-02 | Phase 63 | Pending |
| QUERY-01 | Phase 63 | Pending |
| ETL-01 | Phase 64 | Pending |
| ETL-02 | Phase 64 | Pending |
| ETL-03 | Phase 64 | Pending |
| FACET-01 | Phase 65 | Pending |
| FACET-02 | Phase 65 | Pending |

**Coverage:**
- v4.4/v4.5 shipped: 11 requirements
- v4.6 requirements: 6 total (3 shipped Phase 61, 3 deferred Phase 62)
- v4.7 requirements: 8 total (mapped to phases 63-65)
- v5.1 requirements: 8 total (mapped to phase 80) — COMPLETE
- v6.0 requirements: 22 total (pending phase mapping)
- Mapped to phases: 22/22 active v6.0 requirements (pending roadmap)

### v5.1 Traceability (COMPLETE)

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 80 | Complete |
| LAYOUT-02 | Phase 80 | Complete |
| LAYOUT-03 | Phase 80 | Complete |
| CTX-01 | Phase 80 | Complete |
| CTX-02 | Phase 80 | Complete |
| VIS-01 | Phase 80 | Complete |
| VIS-02 | Phase 80 | Complete |
| VIS-03 | Phase 80 | Complete |


### v6.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TERM-01 | Phase 85 | Pending |
| TERM-02 | Phase 85 | Pending |
| TERM-03 | Phase 85 | Pending |
| TERM-04 | Phase 85 | Pending |
| TERM-05 | Phase 85 | Pending |
| BACK-01 | Phase 85 | Pending |
| BACK-02 | Phase 85 | Pending |
| BACK-05 | Phase 85 | Pending |
| CLAI-01 | Phase 86 | Pending |
| CLAI-02 | Phase 86 | Pending |
| CLAI-03 | Phase 86 | Pending |
| CLAI-04 | Phase 86 | Pending |
| CLAI-05 | Phase 86 | Pending |
| CLAI-06 | Phase 86 | Pending |
| BACK-04 | Phase 86 | Pending |
| GSD-01 | Phase 87 | Pending |
| GSD-02 | Phase 87 | Pending |
| GSD-03 | Phase 87 | Pending |
| GSD-04 | Phase 87 | Pending |
| GSD-05 | Phase 87 | Pending |
| GSD-06 | Phase 87 | Pending |
| BACK-03 | Phase 87 | Pending |

**Coverage:** 22/22 requirements mapped (100%)

### v6.3 Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| QUERY-01 | Phase 99 | 99-01 | Pending |
| QUERY-02 | Phase 99 | 99-01 | Pending |
| QUERY-03 | Phase 99 | 99-01 | Pending |
| QUERY-04 | Phase 99 | 99-01 | Pending |
| QUERY-05 | Phase 99 | 99-01 | Pending |
| QUERY-06 | Phase 99 | 99-01 | Pending |
| QUTIL-01 | Phase 99 | 99-02 | Pending |
| QUTIL-02 | Phase 99 | 99-02 | Pending |
| QUTIL-03 | Phase 99 | 99-02 | Pending |
| QUTIL-04 | Phase 99 | 99-02 | Pending |
| TEST-01 | Phase 99 | 99-03 | Pending |
| TEST-02 | Phase 99 | 99-03 | Pending |
| TEST-03 | Phase 99 | 99-03 | Pending |
| TEST-04 | Phase 99 | 99-03 | Pending |
| TEST-05 | Phase 99 | 99-03 | Pending |
| HOOK-01 | Phase 99 | 99-04 | Pending |
| HOOK-02 | Phase 99 | 99-04 | Pending |
| HOOK-03 | Phase 99 | 99-04 | Pending |
| HOOK-04 | Phase 99 | 99-04 | Pending |
| HOOK-05 | Phase 99 | 99-04 | Pending |
| DEMO-01 | Phase 99 | 99-05 | Pending |
| DEMO-02 | Phase 99 | 99-05 | Pending |
| DEMO-03 | Phase 99 | 99-05 | Pending |

**Coverage:** 23/23 requirements mapped (100%)

### v6.1 Traceability (COMPLETE)

| Requirement | Phase | Status |
|-------------|-------|--------|
| SSTACK-01 | Phase 89 | Pending |
| SSTACK-02 | Phase 89 | Pending |
| SSTACK-03 | Phase 89 | Pending |
| SSTACK-04 | Phase 89 | Pending |
| SSTACK-05 | Phase 89 | Pending |
| SSTACK-06 | Phase 89 | Pending |
| SQL-01 | Phase 90 | Pending |
| SQL-02 | Phase 90 | Pending |
| SQL-03 | Phase 90 | Pending |
| SQL-04 | Phase 90 | Pending |
| SQL-05 | Phase 90 | Pending |
| INT-01 | Phase 91 | Complete |
| INT-02 | Phase 91 | Pending |
| INT-03 | Phase 91 | Pending |
| INT-04 | Phase 91 | Pending |
| INT-05 | Phase 91 | Pending |
| CELL-01 | Phase 92 | Pending |
| CELL-02 | Phase 92 | Pending |
| CELL-03 | Phase 92 | Pending |
| CELL-04 | Phase 92 | Pending |
| PERF-01 | Phase 93 | Pending |
| PERF-02 | Phase 93 | Pending |
| A11Y-01 | Phase 93 | Pending |
| UX-01 | Phase 93 | Pending |
| UX-02 | Phase 93 | Pending |

**Coverage:** 25/25 requirements mapped (100%)

### v6.5 Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| BUG-01 | Phase 103 | 103-01 | Pending |
| BUG-02 | Phase 103 | 103-01 | Pending |
| BUG-03 | Phase 103 | 103-01 | Pending |
| LOG-01 | Phase 103 | 103-02 | Pending |
| LOG-02 | Phase 103 | 103-02 | Pending |
| LOG-03 | Phase 103 | 103-02 | Pending |
| LOG-04 | Phase 103 | 103-02 | Pending |
| LOG-05 | Phase 103 | 103-02 | Pending |
| LOG-06 | Phase 103 | 103-02 | Pending |
| LOG-07 | Phase 103 | 103-02 | Pending |
| WARN-01 | Phase 103 | 103-03 | Pending |
| WARN-02 | Phase 103 | 103-03 | Pending |
| WARN-03 | Phase 103 | 103-03 | Pending |
| WARN-04 | Phase 103 | 103-03 | Pending |

**Coverage:** 14/14 requirements mapped (100%)

### v6.9 Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| REQ-A-01 | Phase 110 | 110-01 | Pending |
| REQ-A-02 | Phase 110 | 110-02 | Pending |
| REQ-A-03 | Phase 111 | 111-01 | Pending |
| REQ-A-04 | Phase 111 | 111-02 | Pending |
| REQ-A-05 | Phase 111 | 111-03 | Pending |
| REQ-A-06 | Phase 111 | 111-03 | Pending |
| REQ-B-01 | Phase 112 | 112-01 | Pending |
| REQ-B-02 | Phase 112 | 112-02 | Pending |
| REQ-B-03 | Phase 112 | 112-03 | Pending |
| REQ-C-04 | Phase 113 | 113-01 | Pending |
| REQ-C-01 | Phase 113 | 113-02 | Pending |
| REQ-C-02 | Phase 114 | 114-01 | Pending |
| REQ-C-03 | Phase 114 | 114-02 | Pending |
| REQ-D-01 | Phase 115 | 115-01 | Pending |
| REQ-D-02 | Phase 115 | 115-02 | Pending |
| REQ-D-03 | Phase 116 | 116-01 | Pending |
| REQ-D-04 | Phase 116 | 116-02 | Pending |
| REQ-NF-01 | Phase 116 | 116-03 | Pending |
| REQ-NF-02 | Phase 116 | 116-03 | Pending |
| REQ-NF-03 | Phase 116 | 116-03 | Pending |

**Coverage:** 20/20 requirements mapped (100%)

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-16 (v6.9 Polymorphic Views & Foundation requirements added)*
