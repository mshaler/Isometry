# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit.

## Milestones

- ✅ **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** — Phases 4-6 (shipped 2026-02-28)
- 🚧 **v1.0 Web Runtime** — Phases 3, 7 (in progress)
- 📋 **v1.1 ETL Importers** — Phases 8+ (planned)

## Release Gates

| Release | Phases | Ships When |
|---------|--------|------------|
| **v0.1 Data Foundation** | 1-2 | SHIPPED 2026-02-28 |
| **v0.5 Providers + Views** | 4-6 | SHIPPED 2026-02-28 |
| **v1.0 Web Runtime** | 3, 7 | Worker Bridge + Graph Views + SuperGrid pass |
| **v1.1 ETL Importers** | 8+ | Web Runtime v1.0 stable |

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

<details>
<summary>✅ v0.1 Data Foundation (Phases 1-2) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) — completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) — completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.5 Providers + Views (Phases 4-6) — SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) — completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) — completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) — completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

### 🚧 v1.0 Web Runtime (Phases 3, 7)

- [x] **Phase 3: Worker Bridge** (2/2 plans) - Typed async RPC over postMessage — all SQL off main thread, correlation IDs, initialization queuing, timeouts — completed 2026-02-28
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
**Plans**: 2/2 complete
- Plan 01: Enable Worker Bridge Integration Tests (Wave 1) — completed 2026-02-28
- Plan 02: Verify WKBR Requirements + Mark Phase Complete (Wave 2) — completed 2026-02-28

### Phase 7: Graph Views + SuperGrid
**Goal**: Users can explore connection data through Network and Tree graph views (with off-main-thread force simulation) and project any dataset through SuperGrid's nested dimensional headers — the signature PAFV differentiator is fully operational
**Depends on**: Phase 5 (shipped in v0.5)
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

**Remaining dependency graph:**
- Phase 3 requires Phase 2 (v0.1 shipped)
- Phase 7 requires Phase 5 (v0.5 shipped)
- Phase 3 and Phase 7 can run in parallel

```
v0.1 Data Foundation (SHIPPED)
    |
    v
Phase 3: Worker Bridge
    |
    v
[v1.0 ships when Phase 3 + Phase 7 pass]

v0.5 Providers + Views (SHIPPED)
    |
    v
Phase 7: Graph Views + SuperGrid
    |
    v
[v1.0 ships when Phase 3 + Phase 7 pass]
```

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v0.1 | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | v0.1 | 6/6 | Complete | 2026-02-28 |
| 3. Worker Bridge | v1.0 | 2/2 | Complete | 2026-02-28 |
| 4. Providers + MutationManager | v0.5 | 7/7 | Complete | 2026-02-28 |
| 5. Core D3 Views + Transitions | v0.5 | 4/4 | Complete | 2026-02-28 |
| 6. Time + Visual Views | v0.5 | 3/3 | Complete | 2026-02-28 |
| 7. Graph Views + SuperGrid | v1.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
