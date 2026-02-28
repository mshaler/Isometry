# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge. After Phase 3, Providers and MutationManager unblock all D3 views. Views are built from simplest to most complex, with SuperGrid last. The web runtime (Phases 3-7) ships as a complete unit.

## Milestones

- [x] **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- [ ] **v1.0 Web Runtime** — Phases 3-7 (active)
- [ ] **v1.1 ETL Importers** — Phases 8+ (planned)

## Release Gates

| Release | Phases | Ships When |
|---------|--------|------------|
| **v0.1 Data Foundation** | 1-2 | SHIPPED 2026-02-28 |
| **v1.0 Web Runtime** | 3-7 | All Phase 3-7 requirements pass |
| **v1.1 ETL Importers** | 8+ | Web Runtime v1.0 stable |

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

<details>
<summary>v0.1 Data Foundation (Phases 1-2) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) — completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) — completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

### v1.0 Web Runtime (Phases 3-7)

- [ ] **Phase 3: Worker Bridge** - Typed async RPC over postMessage — all SQL off main thread, correlation IDs, initialization queuing, timeouts
- [x] **Phase 4: Providers + MutationManager** - SQL compilation from UI state, injection safety, three-tier persistence, undo/redo command log (completed 2026-02-28)
- [ ] **Phase 5: Core D3 Views + Transitions** - List, Grid, Kanban views with stable key functions, ViewManager lifecycle, animated LATCH transitions
- [ ] **Phase 6: Time + Visual Views** - Calendar, Timeline, Gallery views with DensityProvider time SQL integration
- [ ] **Phase 7: Graph Views + SuperGrid** - Network and Tree graph views (Worker-hosted simulation), SuperGrid with nested PAFV dimensional headers

## Phase Details

### Phase 3: Worker Bridge
**Goal**: All database operations execute in a Web Worker via a typed async protocol, the main thread is never blocked by SQL, and all initialization race conditions and silent hangs are prevented
**Depends on**: Phase 2 (query modules reused without wrappers)
**Requirements**: BRIDGE-01, BRIDGE-02, BRIDGE-03, BRIDGE-04, BRIDGE-05, BRIDGE-06, BRIDGE-07
**Success Criteria** (what must be TRUE):
  1. Worker initializes sql.js WASM, applies schema, and messages sent before initialization completes are queued and replayed — no messages are dropped
  2. WorkerBridge sends typed messages with UUID correlation IDs and receives responses matched to the originating promise — concurrent requests resolve independently
  3. Every pending promise times out and rejects after a configurable duration — silent Worker errors never hang the main thread indefinitely
  4. Message router dispatches correctly to query, mutate, graph, fts, and export handlers using existing v0.1 query modules without modification
  5. `isReady` promise resolves before any public bridge method executes — callers cannot race against initialization
**Plans**: TBD

### Phase 4: Providers + MutationManager
**Goal**: UI state compiles to safe parameterized SQL through an allowlisted Provider system, every mutation is undoable, and all Tier 1/2 state persists across launch
**Depends on**: Phase 3
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08, PROV-09, PROV-10, PROV-11, MUT-01, MUT-02, MUT-03, MUT-04, MUT-05, MUT-06, MUT-07
**Success Criteria** (what must be TRUE):
  1. FilterProvider compiles filter state to `{where, params}` SQL fragments with allowlisted columns only — SQL injection strings, unknown fields, and unknown operators are all rejected at runtime
  2. PAFVProvider maps LATCH dimensions to ORDER BY / GROUP BY SQL fragments and suspends/restores view family state when switching between LATCH and GRAPH views — no state is lost across the boundary
  3. SelectionProvider holds selected card IDs in memory only (Cmd+click toggle, Shift+click range, select-all) and this state is never written to any storage tier
  4. DensityProvider compiles all five time granularities (day, week, month, quarter, year) to strftime() SQL expressions — DensityProvider state changes the SQL, not only the CSS
  5. User presses Cmd+Z and the last mutation is reversed; Cmd+Shift+Z re-applies it — undo and redo work through the full command log with correct inverse SQL ordering for batch mutations
  6. Filter, axis, density, and view state (Tier 2) survive app restart — ui_state is written on change and restored on launch
**Plans**: TBD

### Phase 5: Core D3 Views + Transitions
**Goal**: Users can view data through List, Grid, and Kanban projections with animated transitions between them, and the canonical D3 data join pattern is established for all subsequent views
**Depends on**: Phase 4
**Requirements**: VIEW-01, VIEW-02, VIEW-03, VIEW-09, VIEW-10, VIEW-11, VIEW-12, REND-03, REND-04, REND-07, REND-08
**Success Criteria** (what must be TRUE):
  1. ListView renders cards in a single-column list with sort controls; GridView renders cards on a two-axis PAFV grid; KanbanView renders cards in category-grouped columns
  2. Every D3 `.data()` call in every view uses a stable key function (`d => d.id`) — cards animate to correct positions on filter/sort changes, not arbitrary DOM index positions
  3. Transitioning between LATCH views (List → Grid → Kanban) morphs card positions with d3-transition; transitioning between LATCH and GRAPH families uses crossfade — the data-as-projection insight is visible
  4. ViewManager calls `view.destroy()` before mounting the next view — after 10 mount/destroy cycles the subscriber count is unchanged (no leaks)
  5. Views show a loading indicator while the Worker query executes and display a readable error message when a query fails — blank screens and silent failures do not occur
  6. KanbanView drag-drop triggers a MutationManager mutation that updates the card's category field and is fully undoable via Cmd+Z
**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — D3 install, IView contract, CardRenderer, ViewManager with loading/error states
- [ ] 05-02-PLAN.md — ListView with sort controls + GridView with responsive grid
- [ ] 05-03-PLAN.md — KanbanView with drag-drop + MutationManager integration
- [ ] 05-04-PLAN.md — View transitions (morph + crossfade) + public API barrel exports

### Phase 6: Time + Visual Views
**Goal**: Users can view data through Calendar, Timeline, and Gallery projections with DensityProvider time-axis SQL integration exercised at all five granularity levels
**Depends on**: Phase 5
**Requirements**: VIEW-04, VIEW-05, VIEW-06
**Success Criteria** (what must be TRUE):
  1. CalendarView renders cards on a month/week/day grid with the active date field determined by DensityProvider — switching density levels (day, week, month, quarter, year) changes the SQL GROUP BY expression, not only the display format
  2. TimelineView renders cards on a continuous d3.scaleTime() axis with PAFVProvider swimlane grouping — cards from the same swimlane group are horizontally aligned
  3. GalleryView renders cards as visual tiles with image or cover display for resource card types — tile layout is responsive to container width
**Plans**: TBD

### Phase 7: Graph Views + SuperGrid
**Goal**: Users can explore connection data through Network and Tree graph views (with off-main-thread force simulation) and project any dataset through SuperGrid's nested dimensional headers — the signature PAFV differentiator is fully operational
**Depends on**: Phase 5 (Phase 6 can be parallel)
**Requirements**: VIEW-07, VIEW-08, REND-01, REND-02, REND-05, REND-06
**Success Criteria** (what must be TRUE):
  1. NetworkView renders a force-directed graph where the force simulation runs in the Worker — main thread receives only stable `{id, x, y}` positions after the simulation converges, never per-tick updates
  2. TreeView renders a collapsible hierarchy derived from contains/parent connections using d3-hierarchy — nodes expand and collapse without full re-render
  3. SuperGrid renders nested dimensional headers from stacked PAFVProvider axis assignments — parent headers visually span their child column groups (SuperStack behavior)
  4. SuperGrid render performance meets the <16ms threshold for 100 visible cards — measured via performance.now() in a Vitest benchmark
  5. Network view posts only stable position snapshots from the Worker — the main thread renders each frame from a position map, never from mid-simulation state
**Plans**: TBD

**Research Flag**: SuperGrid SuperStack nested header spanning algorithm has no documented D3 analogue. Run `gsd:research-phase` before planning Phase 7. Graph algorithm implementations (PageRank, Louvain) also need sourcing — must have zero DOM dependencies to run in a Worker.

## Execution Policy

**Primary rule:** Dependency-driven execution. A phase can start when all its dependencies are complete.

**Dependency graph:**
- Phase 3 requires Phase 2 (v0.1 shipped)
- Phase 4 requires Phase 3
- Phase 5 requires Phase 4
- Phase 6 requires Phase 5
- Phase 7 requires Phase 5 (Phase 6 can run in parallel with Phase 7)

```
Phase 1: Database Foundation  ┐
                              ├─ v0.1 Data Foundation (SHIPPED 2026-02-28)
Phase 2: CRUD + Query Layer   ┘
    |
    v
Phase 3: Worker Bridge
    |
    v
Phase 4: Providers + MutationManager
    |
    v
Phase 5: Core D3 Views + Transitions
    |
    +------------------+
    |                  |
    v                  v
Phase 6: Time +    Phase 7: Graph Views + SuperGrid
Visual Views       (parallel-capable after Phase 5)
    |
    v
[v1.0 Web Runtime ships when Phases 3-7 pass]
```

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v0.1 | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | v0.1 | 6/6 | Complete | 2026-02-28 |
| 3. Worker Bridge | v1.0 | 7/7 | Complete | 2026-02-28 |
| 4. Providers + MutationManager | 7/7 | Complete   | 2026-02-28 | - |
| 5. Core D3 Views + Transitions | 3/4 | In Progress|  | - |
| 6. Time + Visual Views | v1.0 | 0/TBD | Not started | - |
| 7. Graph Views + SuperGrid | v1.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v1.0 Web Runtime roadmap written: 2026-02-28*
*Phase 3 Worker Bridge completed: 2026-02-28*
