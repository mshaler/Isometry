# Requirements: Isometry

**Defined:** 2026-02-10
**Core Value:** Polymorphic data projection platform where the same LATCH-filtered, GRAPH-connected dataset renders through PAFV spatial projection as grid, kanban, network, or timeline.

## v6.0 Requirements — Interactive Shell

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

### v6.0 Traceability (Pending Roadmap)

| Requirement | Phase | Status |
|-------------|-------|--------|
| TERM-01 | TBD | Pending |
| TERM-02 | TBD | Pending |
| TERM-03 | TBD | Pending |
| TERM-04 | TBD | Pending |
| TERM-05 | TBD | Pending |
| CLAI-01 | TBD | Pending |
| CLAI-02 | TBD | Pending |
| CLAI-03 | TBD | Pending |
| CLAI-04 | TBD | Pending |
| CLAI-05 | TBD | Pending |
| CLAI-06 | TBD | Pending |
| GSD-01 | TBD | Pending |
| GSD-02 | TBD | Pending |
| GSD-03 | TBD | Pending |
| GSD-04 | TBD | Pending |
| GSD-05 | TBD | Pending |
| GSD-06 | TBD | Pending |
| BACK-01 | TBD | Pending |
| BACK-02 | TBD | Pending |
| BACK-03 | TBD | Pending |
| BACK-04 | TBD | Pending |
| BACK-05 | TBD | Pending |

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-14 (v6.0 Interactive Shell requirements added)*
