# Roadmap: Isometry

## Milestones

- **v3.1 Live Database Integration** - Phases 18-27 (shipped 2026-02-01)
- **v4.1 SuperGrid Foundation** - Phases 34-42 (shipped 2026-02-10)
- **v4.2 Three-Canvas Notebook** - Phases 43-46 (in progress)
- **v4.3 Navigator Integration** - Phases 50-51 (in progress)

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

### v4.2 Three-Canvas Notebook (In Progress)

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
**Goal**: Enable cross-canvas data synchronization without manual refresh using sql.js triggers
**Depends on**: Phases 44, 45
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. User sees Preview auto-refresh when Capture saves a card (no manual refresh required)
  2. User clicks card in Preview and Capture scrolls to show it (bidirectional navigation)
  3. User sees selection highlighted across all three canvases simultaneously
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 46-01-PLAN.md — Event bus infrastructure and sql.js change tracking
- [ ] 46-02-PLAN.md — useDataChangeListener hook and Preview tab auto-refresh integration
- [ ] 46-03-PLAN.md — Selection sync and bidirectional navigation (Capture scroll-to-card)

### v4.3 Navigator Integration (In Progress)

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
- [ ] 51-01-PLAN.md — DraggableFacet and PlaneDropZone components with type mappings
- [ ] 51-02-PLAN.md — SimplePAFVNavigator refactor with classification buckets

## Progress

**Execution Order:**
v4.2 phases execute: 43 -> 44 -> 45 -> 46
Phase 45 can begin after Phase 43 completes (parallel with Phase 44).
Phase 46 requires both Phases 44 and 45 complete.

v4.3 Phase 50 can execute in parallel with v4.2 (no dependencies on 43-46).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 18-27 | v3.1 | All | Complete | 2026-02-01 |
| 34-42 | v4.1 | All | Complete | 2026-02-10 |
| 43. Shell Integration Completion | v4.2 | 3/3 | Complete | 2026-02-10 |
| 44. Preview Visualization Expansion | v4.2 | 3/3 | Complete | 2026-02-10 |
| 45. TipTap Editor Migration | v4.2 | 3/3 | Complete | 2026-02-10 |
| 46. Live Data Synchronization | v4.2 | 0/3 | Planned | - |
| 50. Foundation (Schema-on-Read) | v4.3 | 2/2 | Complete | 2026-02-10 |
| 51. Navigator UI Integration | v4.3 | 0/2 | Planned | - |

---
*Roadmap created: 2026-02-10*
*Last updated: 2026-02-10 (Phase 46 planned)*
