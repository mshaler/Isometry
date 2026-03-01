---
phase: 07-graph-views-supergrid
plan: "02"
subsystem: network-view
tags: [d3-force, network-view, zoom, drag, hover, selection, graph-view]
dependency_graph:
  requires:
    - "07-01: graph:simulate WorkerRequestType and NodePosition protocol types"
    - "SelectionProvider: toggle/addToSelection/subscribe"
  provides:
    - "NetworkView class implementing IView with force-directed graph rendering"
    - "NetworkView exported from src/views/index.ts"
  affects:
    - src/views/NetworkView.ts
    - src/views/index.ts
    - tests/views/NetworkView.test.ts
tech_stack:
  added: []
  patterns:
    - "D3 data join with key d => d.id on every .data() call (VIEW-09 compliance)"
    - "Force simulation in Worker via bridge.send('graph:simulate') — main thread renders only"
    - "Warm start: positionMap carries previous positions to next simulate call"
    - "Immediate hover dimming (no transition delay) per CONTEXT.md"
    - "d3-drag + d3-zoom coexist: stopPropagation in drag start prevents zoom conflict"
    - "Edge labels via SVG title + inline text on mouseenter (shown on hover only)"
key_files:
  created:
    - src/views/NetworkView.ts
    - tests/views/NetworkView.test.ts
  modified:
    - src/views/index.ts
decisions:
  - "NetworkView constructor accepts NetworkViewConfig ({bridge, selectionProvider?}) not the full ViewConfig — keeps SelectionProvider optional for test simplicity"
  - "Connections fetched via bridge.send('db:exec', {sql, params}) with parameterized IN clause — safe because column names (source_id, target_id) are hard-coded, only values are parameterized"
  - "Drag handler uses closure (const self = this) instead of class property hack — correct TypeScript pattern for D3 event handlers"
  - "SimulateNode warm-start: conditional property assignment (node.x = prev.x) instead of shorthand to satisfy exactOptionalPropertyTypes strict mode"
  - "render() is async and returns Promise<void> — IView interface allows this since void is assignable to Promise<void> in TypeScript"
metrics:
  duration_seconds: 371
  completed_date: "2026-03-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
  tests_added: 27
  tests_total: 896
---

# Phase 7 Plan 02: NetworkView Summary

**One-liner:** Force-directed graph view (NetworkView) rendering cards as SVG circles via Worker-computed positions, with d3-zoom/pan, d3-drag node pinning, hover dimming, and SelectionProvider click-to-select.

## What Was Built

### Task 1: NetworkView core — SVG rendering and data fetch

**`src/views/NetworkView.ts`** — Complete `IView` implementation for force-directed graph:

**Constructor:**
- Accepts `NetworkViewConfig` with `bridge: WorkerBridgeLike` and optional `selectionProvider: SelectionProvider`
- Internal `positionMap: Map<string, NodePosition>` for warm-start positions across renders

**mount(container):**
1. Creates `svg.network-view` (100% width/height)
2. Creates inner `g.graph-layer` for zoom transform application
3. Creates `g.links` (first, behind) and `g.nodes` (second, in front) sub-groups
4. Sets up `d3.zoom<SVGSVGElement>` with `scaleExtent([0.1, 8])` — translates to `graphLayer` transform
5. Subscribes to SelectionProvider for highlight updates

**render(cards):**
1. Empty cards — clears SVG and returns immediately
2. Fetches connections via `bridge.send('db:exec', {sql, params})` with parameterized IN clause
3. Computes degree for each node (edge count)
4. Builds `SimulateNode[]` with warm-start x/y from `positionMap` (satisfying `exactOptionalPropertyTypes`)
5. Sends `graph:simulate` to Worker, awaits `NodePosition[]`
6. Updates positionMap with stable positions
7. Renders `g.edge` groups (line + SVG title) via data join keyed `d => d.id`
8. Renders `g.node` groups (circle + text label) via data join keyed `d => d.id`

**Node rendering:**
- Circle: `cx/cy` from position, `r` from `d3.scaleSqrt` (range [8, 28] based on degree)
- Fill: `d3.scaleOrdinal(d3.schemeCategory10)` by `card_type`
- Label: `<text>` element below circle (font-size 10px, text-anchor middle)

**Edge rendering:**
- Line: `x1/y1/x2/y2` from positionMap, stroke `#666666`, opacity 0.4
- SVG `<title>` for tooltip
- Inline edge-label text element shown on mouseenter (removed on mouseleave)

**destroy():**
- Unsubscribes from SelectionProvider
- Removes SVG from DOM, clears positionMap, nulls all references

### Task 2: Interactions and index.ts export

**Click-to-select (on g.node):**
- Click: `selectionProvider.toggle(d.id)` (standard click)
- Shift+click: `selectionProvider.toggle(d.id)` (multi-select via repeated toggle)
- SelectionProvider subscription fires `_updateSelectionHighlights()` → 3px white stroke ring on selected circles

**Drag-to-pin (d3-drag on circle):**
- `drag start`: `event.sourceEvent?.stopPropagation()` — prevents zoom activation during drag
- `drag`: Updates `d.fx/d.fy/d.x/d.y`, immediately updates `cx/cy` on circle, text label position, and connected edge endpoints via `_updateEdgesForNode()`
- `drag end`: Writes final `{id, x, y, fx, fy}` into positionMap (node stays pinned on next simulation)

**Hover dimming (immediate — no transition):**
- `mouseenter` on g.node: finds connected nodes from `currentEdges`, sets non-connected circles to `opacity 0.2`, non-connected lines to `stroke-opacity 0.1`
- `mouseleave`: restores all to defaults (1.0 / 0.4)

**`src/views/index.ts`:**
- Added `export { NetworkView } from './NetworkView'` alongside existing view exports

## Tests Added

**`tests/views/NetworkView.test.ts`** (27 tests):

**mount (6 tests):**
- SVG created with class `network-view`
- `g.graph-layer` inside SVG
- `g.links` and `g.nodes` inside graph-layer
- Links group comes before nodes group in DOM (edges render behind nodes)

**render with empty cards (3 tests):**
- No circles, no lines produced
- `bridge.send` not called when cards is empty

**render with cards (7 tests):**
- `graph:simulate` called on bridge
- Circles rendered for each card; text labels rendered
- Viewport dimensions passed in simulate payload
- Key function `d => d.id` prevents duplicate circles on re-render
- Circle `cx/cy` attributes set from Worker response
- Warm-start: second render passes previous `x/y` in simulate payload

**destroy (4 tests):**
- SVG removed; container empty
- No-throw on unmounted destroy; no-throw on render after destroy

**click-to-select (3 tests):**
- Click fires `SelectionProvider.toggle`
- Shift-click fires `SelectionProvider.toggle` (multi-select)
- No-throw without selectionProvider

**hover dimming (2 tests):**
- mouseenter dims non-connected nodes
- mouseleave restores full opacity

**drag-to-pin (1 test):**
- positionMap populated from first render; second render passes warm-start positions

**views/index.ts export (1 test):**
- `NetworkView` exported from `src/views/index`

## Verification Results

```
tests/views/NetworkView.test.ts → 27 passed
npx vitest run                  → 896 passed (all, no regressions)
grep "d => d.id" NetworkView.ts → 2 data joins: edges (d => d.id) + nodes (d => d.id)
grep "graph:simulate" NetworkView.ts → simulation sent via bridge.send, not main thread
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] exactOptionalPropertyTypes compliance for SimulateNode warm-start**
- **Found during:** TypeScript check after Task 1 GREEN
- **Issue:** `{ x: prev?.x }` produces `x: number | undefined` which violates `exactOptionalPropertyTypes: true` — TypeScript requires the property either be present with a `number` value or absent entirely
- **Fix:** Conditional property assignment: `if (prev !== undefined) { node.x = prev.x; node.y = prev.y; }`
- **Files modified:** `src/views/NetworkView.ts`
- **Commit:** a1d8575

**2. [Rule 1 - Bug] Removed `__networkViewThis` pattern for edge hover handler**
- **Found during:** TypeScript check after Task 1 GREEN
- **Issue:** Attempted to attach a property `__networkViewThis` to `SVGGElement` (a DOM element) to pass context into a `function()` callback — TypeScript correctly rejects this (property doesn't exist on `SVGGElement`)
- **Fix:** Used `const self = this` closure capture pattern — the standard D3 approach when needing both `this` (the DOM element) and outer class context
- **Files modified:** `src/views/NetworkView.ts`
- **Commit:** a1d8575

**3. [Rule 1 - Bug] parentElement cast from HTMLElement to SVGGElement**
- **Found during:** TypeScript check after Task 1 GREEN
- **Issue:** `circleEl.parentElement` returns `HTMLElement | null` which can't be directly cast to `SVGGElement`
- **Fix:** Changed to `d3.select<Element, NodeDatum>(circleEl.parentElement)` — uses `Element` as the common base type, which is valid since both `HTMLElement` and `SVGGElement` extend `Element`
- **Files modified:** `src/views/NetworkView.ts`
- **Commit:** a1d8575

### Pre-existing TS Errors (Out of Scope)

During `npx tsc --noEmit`, two pre-existing errors from other plans were present:
- `src/views/TreeView.ts(512)`: `exactOptionalPropertyTypes` error — from Plan 07-03 stub (committed before this plan)
- `tests/views/SuperGrid.test.ts(16)`: Missing `src/views/SuperGrid` module — from Plan 07-04 stub

These are documented in `deferred-items.md` and are owned by Plans 07-03 and 07-04 respectively.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED+GREEN) | a1d8575 | test(07-02): add failing tests + NetworkView implementation |
| 2 (GREEN) | 2492349 | feat(07-02): add NetworkView interactions and register export |

## Self-Check: PASSED
