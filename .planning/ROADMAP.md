# Roadmap: Isometry

## Milestones

- **v3.1 Live Database Integration** - Phases 18-27 (shipped 2026-02-01)
- **v4.1 SuperGrid Foundation** - Phases 34-42 (shipped 2026-02-10)
- **v4.2 Three-Canvas Notebook** - Phases 43-46 (paused, Phase 46 pending)
- **v4.3 Navigator Integration** - Phases 50-51 (paused, Phase 51 pending)
- **v5.0 Type Safety Restoration** - Phases 52-55 (active)

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
**Goal**: Enable cross-canvas data synchronization without manual refresh using React's dataVersion reactivity
**Depends on**: Phases 44, 45
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. User sees Preview auto-refresh when Capture saves a card (no manual refresh required)
  2. User clicks card in Preview and Capture scrolls to show it (bidirectional navigation)
  3. User sees selection highlighted across all three canvases simultaneously
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 46-01-PLAN.md — Verify dataVersion propagation chain for auto-refresh (SYNC-01)
- [ ] 46-02-PLAN.md — Connect Preview tabs to SelectionContext for cross-canvas selection (SYNC-03)
- [ ] 46-03-PLAN.md — Bidirectional navigation from Preview to Capture (SYNC-02)

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

### v5.0 Type Safety Restoration (Active)

**Milestone Goal:** Eliminate all 1,254 TypeScript compilation errors to restore pre-commit hooks and CI quality gates

#### Phase 52: Dead Code & Stale Imports
**Goal**: Remove unused variables/declarations, fix stale exports, and resolve module path errors (~251 errors)
**Depends on**: None (can start immediately)
**Requirements**: TSFIX-01, TSFIX-02, TSFIX-03
**Success Criteria** (what must be TRUE):
  1. Zero TS6133/TS6196 (unused) errors remain
  2. Zero TS2305 (no exported member) errors remain
  3. Zero TS2307 (cannot find module) errors remain
  4. No behavioral changes — only dead code removal and import fixes
**Plans**: 3 plans in 1 wave

Plans:
- [ ] 52-01-PLAN.md — Remove unused variables and declarations (TS6133, TS6196)
- [ ] 52-02-PLAN.md — Fix stale exports and re-export paths (TS2305)
- [ ] 52-03-PLAN.md — Fix module resolution errors (TS2307)

#### Phase 53: Type Assertions & Annotations
**Goal**: Add proper type annotations where TypeScript infers 'unknown' or implicit 'any' (~404 errors)
**Depends on**: Phase 52
**Requirements**: TSFIX-04, TSFIX-05
**Success Criteria** (what must be TRUE):
  1. Zero TS18046 (type 'unknown') errors remain
  2. Zero TS7006 (implicit 'any') errors remain
  3. All type assertions use proper type guards, not blanket `as` casts
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 53-01-PLAN.md — Fix TS18046 in D3/visualization layer (src/d3/)
- [ ] 53-02-PLAN.md — Fix TS18046 in components and hooks
- [ ] 53-03-PLAN.md — Fix TS7006 implicit any across all remaining files

#### Phase 54: Interface Alignment
**Goal**: Fix type mismatches between interfaces and actual usage across the codebase (~346 errors)
**Depends on**: Phase 53
**Requirements**: TSFIX-06, TSFIX-07
**Success Criteria** (what must be TRUE):
  1. Zero TS2339 (property does not exist) errors remain
  2. Zero TS2322 (type not assignable) errors remain
  3. Interfaces accurately reflect runtime data shapes
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 54-01-PLAN.md — Fix TS2339 in D3/SuperGrid layer
- [ ] 54-02-PLAN.md — Fix TS2339/TS2322 in components and services
- [ ] 54-03-PLAN.md — Fix TS2322 in hooks, engine, and remaining files

#### Phase 55: Function Signatures & Final Verification
**Goal**: Fix argument mismatches, overload resolution, and verify zero total errors (~253 errors)
**Depends on**: Phase 54
**Requirements**: TSFIX-08, TSFIX-09, TSFIX-10, TSFIX-11, TSFIX-12
**Success Criteria** (what must be TRUE):
  1. Zero TS2345 (argument not assignable) errors remain
  2. Zero TS2554 (wrong argument count) errors remain
  3. All remaining error codes resolved (TS2353, TS2551, TS2769, TS2304, etc.)
  4. `tsc --noEmit` passes with zero errors
  5. `npm run check:quick` passes (types + lint)
  6. Pre-commit hook (lefthook) passes without --no-verify
**Plans**: 3 plans in 2 waves

Plans:
- [ ] 55-01-PLAN.md — Fix TS2345/TS2554 function signature mismatches
- [ ] 55-02-PLAN.md — Fix all remaining error codes (TS2353, TS2551, TS2769, etc.)
- [ ] 55-03-PLAN.md — Final verification: zero errors, pre-commit hook, CI gates

## Progress

**Execution Order:**
v5.0 phases execute sequentially: 52 -> 53 -> 54 -> 55
Each phase reduces error count, and later phases depend on earlier type fixes cascading.

v4.2 Phase 46 and v4.3 Phase 51 resume after v5.0 completes.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 18-27 | v3.1 | All | Complete | 2026-02-01 |
| 34-42 | v4.1 | All | Complete | 2026-02-10 |
| 43. Shell Integration Completion | v4.2 | 3/3 | Complete | 2026-02-10 |
| 44. Preview Visualization Expansion | v4.2 | 3/3 | Complete | 2026-02-10 |
| 45. TipTap Editor Migration | v4.2 | 3/3 | Complete | 2026-02-10 |
| 46. Live Data Synchronization | v4.2 | 0/3 | Paused | - |
| 50. Foundation (Schema-on-Read) | v4.3 | 2/2 | Complete | 2026-02-10 |
| 51. Navigator UI Integration | v4.3 | 0/2 | Paused | - |
| 52. Dead Code & Stale Imports | v5.0 | 0/3 | Planned | - |
| 53. Type Assertions & Annotations | v5.0 | 0/3 | Planned | - |
| 54. Interface Alignment | v5.0 | 0/3 | Planned | - |
| 55. Function Signatures & Verification | v5.0 | 0/3 | Planned | - |

---
*Roadmap created: 2026-02-10*
*Last updated: 2026-02-10 (v5.0 Type Safety Restoration added, phases 52-55)*
