---
phase: 20-supersize
plan: "01"
subsystem: supergrid
tags: [supergrid, column-resize, pafv-provider, interface-contracts, tdd]
dependency_graph:
  requires: [19-superposition-superzoom]
  provides: [per-column-width-contracts, buildGridTemplateColumns-v2, colWidths-persistence]
  affects: [SuperGrid, PAFVProvider, SuperStackHeader, SuperGridProviderLike]
tech_stack:
  added: []
  patterns:
    - buildGridTemplateColumns now accepts (leafColKeys, colWidths, zoomLevel, rowHeaderWidth) producing individual px values
    - PAFVState.colWidths optional Record<string, number> for Tier 2 persistence (rides existing checkpoint)
    - setColWidths does NOT call _scheduleNotify — width changes are CSS-only, no re-query needed
    - colWidths reset to {} on setColAxes/setRowAxes (stale widths meaningless for different columns)
key_files:
  created: []
  modified:
    - src/views/supergrid/SuperStackHeader.ts
    - src/providers/PAFVProvider.ts
    - src/views/types.ts
    - src/views/SuperGrid.ts
    - tests/views/SuperStackHeader.test.ts
    - tests/providers/PAFVProvider.test.ts
    - tests/views/SuperGrid.test.ts
decisions:
  - buildGridTemplateColumns uses direct px values (not CSS Custom Property vars per column) — simpler, no key sanitization needed for colKey values with special chars
  - DEFAULT_COL_WIDTH defined locally in SuperStackHeader.ts (120) instead of importing from SuperZoom to avoid potential circular dependency
  - SuperGrid._renderCells() uses empty Map with default widths for now — Plan 02 (SuperGridSizer) will wire actual colWidths via provider.getColWidths()
metrics:
  duration: "9 min"
  completed: "2026-03-04"
  tasks: 1
  files: 7
requirements_satisfied: [SIZE-01, SIZE-04]
---

# Phase 20 Plan 01: Interface Contracts and buildGridTemplateColumns Refactor Summary

Per-column width infrastructure: refactored buildGridTemplateColumns to accept individual column keys, widths map, and zoom level; extended PAFVProvider with colWidths persistence; typed SuperGridProviderLike with width accessors.

## What Was Built

### buildGridTemplateColumns Refactored (SuperStackHeader.ts)

Changed signature from `(leafCount: number, rowHeaderWidth?)` to:
```typescript
buildGridTemplateColumns(
  leafColKeys: string[],      // ordered leaf column keys
  colWidths: Map<string, number>,  // base widths per colKey
  zoomLevel: number,
  rowHeaderWidth = 160
): string
```

Output changes from `160px repeat(N, var(--sg-col-width, 120px))` to individual px values:
- `buildGridTemplateColumns(['note','task'], new Map(), 1.0)` → `'160px 120px 120px'`
- `buildGridTemplateColumns(['note','task'], new Map([['note', 200]]), 2.0)` → `'160px 400px 240px'`
- `buildGridTemplateColumns([], new Map(), 1.0)` → `'160px'`

### PAFVProvider Extended (PAFVProvider.ts)

1. `PAFVState.colWidths?: Record<string, number>` — optional field for backward compat
2. `getColWidths()` — returns defensive copy `{ ...(this._state.colWidths ?? {}) }`
3. `setColWidths(widths)` — stores `{ ...widths }`, does NOT call `_scheduleNotify()` (CSS-only)
4. `setColAxes()` and `setRowAxes()` — both reset `this._state.colWidths = {}` on axis change
5. `setState()` — backward-compat default for missing colWidths: `{}`
6. `isPAFVState()` — accepts colWidths field (optional non-array object)

### SuperGridProviderLike Extended (types.ts)

```typescript
export interface SuperGridProviderLike {
  getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] };
  setColAxes(axes: AxisMapping[]): void;
  setRowAxes(axes: AxisMapping[]): void;
  getColWidths(): Record<string, number>;    // Phase 20 addition
  setColWidths(widths: Record<string, number>): void;  // Phase 20 addition
}
```

### SuperGrid._renderCells() Updated (SuperGrid.ts)

Temporary adapter: extracts `leafColKeys` from last colHeaders level, converts provider's `getColWidths()` Record to Map, passes current `zoomLevel` from positionProvider. Plan 02 (SuperGridSizer) will replace the empty defaults with actual user-set widths.

```typescript
const leafColKeys = (colHeaders[colHeaders.length - 1] ?? []).map(c => c.value);
const colWidthsMap = new Map<string, number>(Object.entries(this._provider.getColWidths()));
grid.style.gridTemplateColumns = buildGridTemplateColumns(leafColKeys, colWidthsMap, this._positionProvider.zoomLevel, ROW_HEADER_WIDTH);
```

### Test Coverage (123 tests passing)

**SuperStackHeader.test.ts** — 8 tests updated for new signature:
- Default widths, custom widths, zoom scaling, empty columns, custom row header
- Confirms no `repeat()` or `var(--sg-col-width` in output

**PAFVProvider.test.ts** — 11 new colWidths tests added:
- Default empty, set/get defensive copy, no subscriber notification
- setColAxes/setRowAxes reset colWidths
- Round-trip through toJSON()/setState()
- Backward compat with old state (no colWidths field)
- isPAFVState accepts with and without colWidths

**SuperGrid.test.ts** — All 5 inline provider mocks and `makeMockProvider`/`makeMockProviderWithSetters` factory functions updated to include `getColWidths: vi.fn().mockReturnValue({})` and `setColWidths: vi.fn()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing implementation] SuperGrid test mocks missing getColWidths/setColWidths**

- **Found during:** Task 1 GREEN phase — after adding getColWidths/setColWidths to SuperGridProviderLike, all existing SuperGrid tests using inline provider objects failed TypeScript type errors (and runtime errors since SuperGrid._renderCells() calls provider.getColWidths())
- **Fix:** Updated `makeMockProvider()`, `makeMockProviderWithSetters()`, and 5 inline provider objects in SuperGrid.test.ts to include the new methods
- **Files modified:** tests/views/SuperGrid.test.ts
- **Commit:** 2569503b (included in same feat commit)

### Pre-existing Failures (Out of Scope)

`tests/worker/supergrid.handler.test.ts` has 5 pre-existing failures (`db.prepare is not a function`) — confirmed pre-existing by stash-reverting to baseline and verifying same failures. These are NOT caused by this plan's changes. Logging to deferred-items.

## TDD Cycle

1. **RED** — wrote 8 new SuperStackHeader tests (new signature) + 11 PAFVProvider colWidths tests. 16 tests failing (commit: e5ba559e)
2. **GREEN** — implemented all production code changes. All 123 tests pass. Fixed mock deviation inline. (commit: 2569503b)
3. **REFACTOR** — none needed; implementation was clean on first pass.

## Self-Check: PASSED

Files exist:
- src/views/supergrid/SuperStackHeader.ts: FOUND (buildGridTemplateColumns with new signature)
- src/providers/PAFVProvider.ts: FOUND (colWidths field, getColWidths/setColWidths)
- src/views/types.ts: FOUND (getColWidths/setColWidths in SuperGridProviderLike)
- src/views/SuperGrid.ts: FOUND (updated _renderCells caller)

Commits exist:
- e5ba559e: test(20-01) — TDD RED phase
- 2569503b: feat(20-01) — GREEN phase implementation
