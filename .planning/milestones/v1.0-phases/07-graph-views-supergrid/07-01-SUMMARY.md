---
phase: 07-graph-views-supergrid
plan: "01"
subsystem: worker-protocol
tags: [d3-force, simulation, worker, protocol, viewtype]
dependency_graph:
  requires: []
  provides:
    - "'supergrid' ViewType in types.ts and PAFVProvider VIEW_DEFAULTS"
    - "'graph:simulate' WorkerRequestType with SimulatePayload/NodePosition types"
    - "handleGraphSimulate function in simulate.handler.ts"
    - "Worker router case for graph:simulate"
  affects:
    - src/providers/types.ts
    - src/providers/PAFVProvider.ts
    - src/worker/protocol.ts
    - src/worker/worker.ts
    - src/worker/handlers/index.ts
tech_stack:
  added: []
  patterns:
    - "d3-force stop()+tick() manual convergence loop (no internal timer)"
    - "SimulateNode/SimulateLink/SimulatePayload/NodePosition typed protocol"
key_files:
  created:
    - src/worker/handlers/simulate.handler.ts
    - tests/worker/simulate.handler.test.ts
    - tests/providers/supergrid-types.test.ts
  modified:
    - src/providers/types.ts
    - src/providers/PAFVProvider.ts
    - src/worker/protocol.ts
    - src/worker/handlers/index.ts
    - src/worker/worker.ts
decisions:
  - "'supergrid' is LATCH family (not GRAPH) — getViewFamily() naturally falls through to latch since only network/tree are graph"
  - "d3-force simulation uses stop()+tick() loop — never internal timer — to run off-thread with no per-tick postMessage"
  - "SimulateNode clones input before passing to d3-force to prevent mutation of caller's data"
metrics:
  duration_seconds: 233
  completed_date: "2026-03-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 5
  tests_added: 13
  tests_total: 811
---

# Phase 7 Plan 01: Protocol Types and Force Simulation Handler Summary

**One-liner:** Extended Worker protocol with `graph:simulate` and d3-force simulation handler using stop()+tick() loop for off-thread convergence, plus `supergrid` ViewType for Phase 7 LATCH view.

## What Was Built

### Task 1: Extend protocol types and ViewType union

Extended three files to add Phase 7 type infrastructure:

**`src/providers/types.ts`** — Added `'supergrid'` to the `ViewType` union. SuperGrid is a LATCH view (dimensional projection), not a GRAPH view.

**`src/providers/PAFVProvider.ts`** — Added `supergrid` entry to `VIEW_DEFAULTS` with `{ viewType: 'supergrid', xAxis: null, yAxis: null, groupBy: null }`. The existing `getViewFamily()` correctly returns `'latch'` for supergrid without modification (only `network` and `tree` return `'graph'`).

**`src/worker/protocol.ts`** — Added four new types and wired them into the protocol:
- `SimulateNode` — node with optional warm-start x/y and pin fx/fy
- `SimulateLink` — directed edge with string source/target IDs
- `SimulatePayload` — nodes + links + viewport dimensions
- `NodePosition` — stable position result: id, x, y, fx/fy (null if not pinned)
- `'graph:simulate'` added to `WorkerRequestType`, `WorkerPayloads`, `WorkerResponses`

After Task 1, `npx tsc --noEmit` produced exactly one error: the exhaustive switch in `worker.ts` required a `graph:simulate` case. This was the expected RED signal proving the type system works.

### Task 2: Force simulation handler and Worker router

**`src/worker/handlers/simulate.handler.ts`** — Core simulation handler:

```typescript
export function handleGraphSimulate(payload: SimulatePayload): NodePosition[]
```

Design decisions:
- Clones input nodes before passing to d3-force (mutation isolation)
- Uses `.stop()` immediately after creating the simulation — never the internal d3 timer
- Computes convergence iterations from `alphaMin / alphaDecay` (~300 with defaults)
- Preserves pinned nodes: `fx`/`fy` pass through to d3-force; output `x`/`y` match pin coords
- Empty nodes input returns empty array without creating a simulation

**`src/worker/handlers/index.ts`** — Added `export * from './simulate.handler'`

**`src/worker/worker.ts`** — Added import and router case:

```typescript
case 'graph:simulate': {
  const p = payload as WorkerPayloads['graph:simulate'];
  return handleGraphSimulate(p);
}
```

This resolved the exhaustive switch TypeScript error from Task 1.

## Tests Added

**`tests/providers/supergrid-types.test.ts`** (7 tests):
- `'supergrid'` is a valid ViewType value (compile-time check)
- PAFVProvider can switch to supergrid view
- `getViewFamily('supergrid')` returns `'latch'`
- VIEW_DEFAULTS has supergrid entry (setViewType does not throw)
- Switching from network to supergrid suspends graph family state

**`tests/worker/simulate.handler.test.ts`** (6 tests):
- Returns empty array for empty nodes
- Returns finite positions for nodes with no links
- Returns finite positions for connected nodes (fx/fy = null for unpinned)
- Preserves pinned node positions (fx/fy on input = x/y/fx/fy on output)
- Respects warm start positions
- Does not mutate input nodes

## Verification Results

```
npx tsc --noEmit        → PASS (no errors)
tests/worker/           → 141 passed (135 existing + 6 new)
tests/providers/        → 295 passed (288 existing + 7 new)
npx vitest run          → 811 passed (798 existing + 13 new, 0 failures)
```

## Deviations from Plan

None — plan executed exactly as written. Task 1 produced the expected intentional TypeScript error (exhaustive switch), and Task 2 resolved it as planned.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 0b71981 | feat(07-01): extend protocol types and ViewType union |
| 2 | 275b94c | feat(07-01): implement force simulation handler and wire into Worker router |

## Self-Check: PASSED
