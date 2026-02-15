# Requirements: Isometry

**Defined:** 2026-02-10
**Core Value:** Polymorphic data projection platform where the same LATCH-filtered, GRAPH-connected dataset renders through PAFV spatial projection as grid, kanban, network, or timeline.

## v6.3 Requirements — SuperStack SQL Integration

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

- [ ] **INT-01**: User can collapse/expand headers (toggle collapsed state)
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
| INT-01 | Phase 91 | Pending |
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

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-13 (v6.1 SuperStack Enhancement requirements added)*
