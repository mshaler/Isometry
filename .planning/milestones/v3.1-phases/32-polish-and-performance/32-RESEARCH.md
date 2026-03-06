# Phase 32: Polish and Performance - Research

**Researched:** 2026-03-06
**Domain:** SuperGrid quality gate — persistence, selection, aggregation, performance benchmarks
**Confidence:** HIGH

## Summary

Phase 32 is the final quality gate before v3.1 ships. It covers four distinct areas: (1) persistence round-trip validation ensuring SuperGrid state survives cross-session save/restore via StateManager, (2) compound key selection correctness across N-level stacking depths including aggregate summary cells, (3) render performance benchmarks with pass/fail gates using Vitest bench mode, and (4) deepest-wins aggregation composition when multiple header levels are simultaneously collapsed.

The codebase is well-positioned for this phase. All the key infrastructure already exists: `PAFVProvider.toJSON()/setState()` with backward-compatibility guards (lines 567-599), `StateManager` with `restore()` and corruption isolation, `SuperGridSelect` with lasso hit-testing via `BBoxCache`, the aggregate summary cell injection pipeline in `_renderCells()` (lines 1462-1538), and an existing `SuperGrid.perf.test.ts` with p95 measurement patterns. The phase primarily requires extending these systems rather than building new ones.

**Primary recommendation:** Structure the work as two plans — Plan 01 covers persistence round-trip validation and backward-compatibility matrix (pure test writing against existing code); Plan 02 covers deepest-wins aggregation logic, compound key selection for aggregate cells, and render benchmarks (requires both implementation changes and new benchmarks).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Render Benchmarks:**
- Performance budget: <16ms for 100 visible cards (matches existing SuperGrid header comment target, ensures 60fps)
- Benchmark runner: Vitest bench mode (`vitest bench`) — separate from regular test suite, opt-in execution
- Gate style: Simple pass/fail — no historical baseline tracking, no `.benchmark-results.json` file
- Four benchmark scenarios required:
  1. N-level depth — 3 stacked col axes + 3 stacked row axes, measures compound key + header spanning overhead
  2. Mixed collapse states — Some headers in aggregate mode, others expanded, measures summary cell injection overhead
  3. Post-reorder re-render — Full pipeline: FLIP snapshot + provider mutation + re-query + re-render + FLIP animation
  4. Large dataset stress — 500+ cards, informational only (not a pass/fail gate), captures practical ceiling

**Aggregation at Depth:**
- Multi-level collapse composition: deepest-wins — only the deepest collapsed level produces a summary cell, parent-level summaries are suppressed to avoid double-counting
- Heat map coloring: consistent `d3.interpolateBlues` at ALL depth levels — no dimming for deeper aggregates
- Test coverage: combinatorial depth tests for a 3-axis stack — test every possible combination of collapsed levels (level 0 only, level 1 only, level 2 only, 0+1, 0+2, 1+2, all three) with accurate summary cell count verification
- Children behavior: when a parent header is collapsed, child headers at deeper levels are NOT rendered (hidden, not frozen) — summary cell replaces the entire subtree

**Compound Key Selection:**
- Selection key: full compound cell key from `buildCellKey()` (e.g., `Work\x1fActive\x1fHigh\x1enote\x1furgent`) — includes ALL axis levels, no leaf-only shortcut
- Shift+click range: works across all row groups regardless of depth — visual ordering is transparent to range selection, same behavior as a flat grid
- Lasso over aggregate summary cells: selects ALL underlying cards that the summary represents — summary cell is a proxy for collapsed content
- Collapse/expand reconciliation: auto-reconcile — when a group is collapsed, selected cards within it remain selected, visual highlight transfers to the aggregate summary cell, count badge stays accurate, expanding re-shows individual highlights

**Persistence Round-Trip:**
- Scope: cross-session simulation via StateManager — write to `ui_state` table, read back on simulated fresh page load, verify SuperGrid state restores identically (not just provider toJSON/setState)
- Backward-compatibility matrix: test deserialization of state from EVERY prior phase shape:
  - Pre-Phase-15 (no colAxes/rowAxes)
  - Pre-Phase-20 (no colWidths)
  - Pre-Phase-23 (no sortOverrides)
  - Pre-Phase-30 (no collapseState)
- Edge cases — all four categories required:
  1. Empty arrays — colAxes: [], rowAxes: [], collapseState: [], sortOverrides: [] — verify no corruption or null coercion
  2. Max depth — 6 total axes (3 col + 3 row) with all metadata populated — verify no truncation or key collision
  3. Stale collapse keys — keys referencing axis values that no longer exist in data — verify graceful ignore, not errors
  4. Corrupted/malformed JSON — truncated JSON, wrong types, missing fields — verify graceful rejection or fallback to defaults

### Claude's Discretion
- Benchmark file location and naming convention within tests/
- Exact vitest bench configuration (warmup iterations, sample count)
- How auto-reconcile visually highlights aggregate summary cells when they contain selected cards
- Implementation approach for deepest-wins suppression logic (filter in _renderCells vs pre-compute in collapse state)
- How to simulate cross-session reload in tests (fresh Database instance vs mock StateManager)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.0.18 | Test runner + bench mode | Already installed, bench mode for performance gates |
| D3.js | ^7.9.0 | Heat map coloring (interpolateBlues), data joins | Existing rendering engine |
| sql.js | ^1.14.0 | Database for StateManager round-trip tests | System of record |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsdom | ^28.1.0 | DOM simulation for render benchmarks | All SuperGrid render tests need `@vitest-environment jsdom` |

### Alternatives Considered
No alternatives — this phase uses the existing stack exclusively.

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Existing File Structure (Relevant to Phase 32)
```
src/
├── views/
│   ├── SuperGrid.ts              # _renderCells(), collapse toggle, FLIP, selection
│   └── supergrid/
│       ├── keys.ts               # buildCellKey(), buildDimensionKey(), UNIT_SEP, RECORD_SEP
│       ├── SuperGridSelect.ts    # Lasso hit-testing, click zones
│       ├── SuperGridBBoxCache.ts # DOMRect cache for lasso
│       └── SuperStackHeader.ts   # buildHeaderCells(), HeaderCell, collapse slots
├── providers/
│   ├── PAFVProvider.ts           # Tier 2 serialization, backward compat guards
│   ├── StateManager.ts           # Tier 2 persistence coordinator
│   └── SelectionProvider.ts      # Tier 3 ephemeral selection
tests/
├── views/
│   ├── SuperGrid.test.ts         # Main SuperGrid tests
│   ├── SuperGrid.perf.test.ts    # Existing perf assertions (PLSH-01/02/03)
│   ├── SuperGrid.bench.ts        # Existing vitest bench file (basic 100-card)
│   └── supergrid/
│       ├── keys.test.ts
│       ├── SuperGridSelect.test.ts
│       └── SuperGridBBoxCache.test.ts
├── providers/
│   ├── PAFVProvider.test.ts      # Serialization, backward compat tests
│   └── StateManager.test.ts      # Persistence coordinator tests
```

### Pattern 1: Deepest-Wins Aggregation Suppression
**What:** When multiple header levels are simultaneously collapsed in aggregate mode, only the deepest collapsed level produces a summary cell. Parent summaries are suppressed to prevent double-counting.
**When to use:** During aggregate summary cell injection in `_renderCells()` (lines 1462-1538).
**Implementation approach (recommended — filter in _renderCells):**

The existing aggregate injection loops iterate over `visibleLeafColCells` and `visibleLeafRowCells`, checking `isCollapsed` and `_collapseModeMap`. The deepest-wins rule can be implemented by pre-computing a "suppressed" set: for each collapsed key, check if any of its descendant keys are also collapsed — if yes, suppress the parent's summary cell.

```typescript
// Pre-compute suppressed set before aggregate injection loops
// A collapsed key is suppressed if any descendant key is also collapsed
const suppressedCollapseKeys = new Set<string>();
for (const key of this._collapsedSet) {
  if (this._collapseModeMap.get(key) !== 'aggregate') continue;
  const [levelStr, parentPath, value] = key.split('\x1f');
  const level = parseInt(levelStr!, 10);
  // Check if any deeper level under this parent+value is also collapsed
  for (const otherKey of this._collapsedSet) {
    const [otherLevelStr, otherParentPath] = otherKey.split('\x1f');
    const otherLevel = parseInt(otherLevelStr!, 10);
    if (otherLevel <= level) continue;
    // otherKey is a descendant if its parentPath starts with this key's full path
    const thisPath = parentPath ? `${parentPath}\x1f${value}` : value;
    if (otherParentPath === thisPath || otherParentPath!.startsWith(thisPath + '\x1f')) {
      suppressedCollapseKeys.add(key);
      break;
    }
  }
}
```

Then in the aggregate injection loop, skip keys in `suppressedCollapseKeys`.

**Why filter-in-_renderCells is preferred over pre-compute-in-collapse-state:** The collapse state (`_collapsedSet`) is a user-facing model — all collapsed keys should remain in the set for correct persistence and expand/collapse toggle. The suppression is a render-time concern only. Mixing model and render concerns would create subtle bugs when expanding a parent with collapsed children.

### Pattern 2: Aggregate Summary Cell Proxy Selection
**What:** Lasso-selecting an aggregate summary cell selects ALL underlying cards that the summary represents.
**When to use:** In `SuperGridSelect._handlePointerUp()` and `_getCellCardIds()`.

The existing `_getCellCardIds(cellKey)` method uses `findCellInData()` which performs an O(N) scan of `_lastCells`. For aggregate summary cells (`.isSummary = true`), this lookup returns empty `card_ids` (aggregate cells have `cardIds: []` in the CellPlacement). The fix: when `_getCellCardIds` returns an empty array for a cell that visually has a count > 0, the method should aggregate card_ids from all child cells under the collapsed group.

```typescript
// Extended _getCellCardIds: aggregate proxy lookup
private _getCellCardIds(cellKey: string): string[] {
  // Try direct lookup first (normal cells)
  const cell = findCellInData(cellKey, this._lastCells, this._lastRowAxes, this._lastColAxes);
  if (cell?.card_ids?.length) return cell.card_ids;

  // If cell exists but has no card_ids, check if it's an aggregate summary cell
  // Aggregate cells: collect card_ids from all child cells under the collapsed group
  const { rowKey, colKey } = parseCellKey(cellKey);
  // ... aggregate lookup logic matching rows/cols under the collapsed group
}
```

### Pattern 3: Cross-Session Simulation via Mock StateManager
**What:** Test that SuperGrid state survives a full write-to-database, clear-provider, read-from-database cycle.
**When to use:** Persistence round-trip tests.

The recommended approach uses a mock bridge that stores written values in a Map, then reads them back on `ui:getAll`:

```typescript
// Cross-session simulation test pattern
function makePersistenceMock() {
  const store = new Map<string, string>();
  const bridge = {
    send: vi.fn().mockImplementation((type: string, payload: any) => {
      if (type === 'ui:set') {
        store.set(payload.key, payload.value);
        return Promise.resolve();
      }
      if (type === 'ui:getAll') {
        return Promise.resolve(
          Array.from(store.entries()).map(([key, value]) => ({
            key, value, updated_at: new Date().toISOString()
          }))
        );
      }
      return Promise.resolve();
    }),
  } as unknown as WorkerBridge;
  return { bridge, store };
}

// Test flow:
// 1. Configure provider (axes, widths, sorts, collapse)
// 2. StateManager.persistAll() — writes to mock store
// 3. Create fresh provider + new StateManager
// 4. StateManager.restore() — reads from mock store
// 5. Assert provider.getState() matches original
```

### Pattern 4: Vitest Bench Mode Configuration
**What:** Separate benchmark files invoked via `npx vitest bench`, not part of regular test suite.
**When to use:** The four performance benchmark scenarios.

Vitest 4.0 bench mode uses files matching `**/*.{bench,benchmark}.?(c|m)[jt]s?(x)` by default. The existing `SuperGrid.bench.ts` already follows this convention.

```typescript
// @vitest-environment jsdom
import { describe, bench, beforeEach, afterEach } from 'vitest';

describe('Phase 32 — N-level depth benchmark', () => {
  bench('3+3 stacked axes render <16ms', () => {
    // Setup: 3 col axes, 3 row axes, 100 cards
    // Measure: _renderCells() call
  }, { time: 2000, iterations: 50 });
});
```

**Bench options per-bench:**
- `time: number` — minimum ms to run iterations (default: not documented, effectively unlimited)
- `iterations: number` — number of benchmark iterations

### Anti-Patterns to Avoid
- **Modifying _collapsedSet for deepest-wins:** The collapse set is a user model. Deepest-wins is render logic. Never remove parent keys from the set — the user expects toggling a parent to work regardless of child state.
- **Using real Database for round-trip tests:** Real sql.js initialization adds 1-2s cold-start per test. Use mock bridge with in-memory Map instead.
- **Testing heat map color values precisely:** `d3.interpolateBlues` returns CSS color strings that vary by D3 version. Test for presence/consistency, not exact hex values.
- **Benchmarking in CI with strict thresholds:** jsdom is 100x slower than Chrome for D3 ops. Use generous jsdom budgets (as existing PLSH-01 does: 500ms for 100 cells) and note real browser targets in comments.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Performance measurement | Custom timer wrappers | Vitest bench mode (`vitest bench`) | Built-in warmup, iteration control, statistical output |
| p95 computation | Manual sort+index | Existing `computeP95()` pattern from SuperGrid.perf.test.ts | Already battle-tested in PLSH-01/02/03 |
| Compound key parsing | String manipulation | `parseCellKey()`, `buildCellKey()` from keys.ts | Single source of truth for separator conventions |
| Mock bridge for persistence | Real WorkerBridge | Mock bridge pattern from StateManager.test.ts | Avoids WASM cold-start, isolates test from Worker |
| PRNG for deterministic test data | Math.random() | `mulberry32()` from SuperGrid.perf.test.ts | Fixed seed = reproducible across runs |

**Key insight:** Phase 32 is primarily a testing and validation phase. Almost all infrastructure already exists — the danger is reinventing patterns that are already established in the test suite.

## Common Pitfalls

### Pitfall 1: Double-Counting in Aggregate Summaries
**What goes wrong:** Without deepest-wins, collapsing both "Engineering" (level 0) and "Active" (level 1 under Engineering) produces two summary cells that both count the same cards — one for "Engineering" and one for "Active".
**Why it happens:** The current aggregate injection loops in `_renderCells()` (lines 1462-1538) independently process each collapsed header without checking ancestor/descendant relationships.
**How to avoid:** Pre-compute a `suppressedCollapseKeys` set before the injection loops. For each collapsed key, check if any descendant key is also collapsed. If so, suppress the ancestor's summary.
**Warning signs:** Summary cell counts across a collapsed subtree exceed the total card count for that branch.

### Pitfall 2: Stale Collapse Keys in Restored State
**What goes wrong:** A user collapses "Engineering" headers, persists state, then the data changes (Engineering folder renamed or deleted). On restore, the collapse key references a non-existent header.
**Why it happens:** Collapse keys contain axis values (e.g., `0\x1f\x1fEngineering`). If those values disappear from the dataset, buildHeaderCells still produces valid output but the key never matches.
**How to avoid:** The current system already handles this gracefully — unmatched keys in `_collapsedSet` are simply ignored by buildHeaderCells. Tests should verify this behavior explicitly rather than assume it.
**Warning signs:** Test expecting an error on stale keys when actually silence is correct behavior.

### Pitfall 3: Aggregate Cell Card IDs Empty in Lasso Selection
**What goes wrong:** Lasso-selecting an aggregate summary cell yields zero card IDs because the CellPlacement has `cardIds: []` (aggregate cells store count but not individual IDs).
**Why it happens:** The aggregate injection code (line 1494) explicitly sets `cardIds: []` for summary cells. The `_getCellCardIds()` method uses `findCellInData()` which returns the cell's `card_ids` field — empty for aggregates.
**How to avoid:** Extend `_getCellCardIds()` to detect aggregate summary cells and collect card_ids from all child cells under the collapsed group. The child cell lookup should iterate `_lastCells` filtering by the collapsed axis field value.
**Warning signs:** Selecting an aggregate summary cell in the UI selects 0 cards despite the cell showing a count badge.

### Pitfall 4: Backward Compat Test Shape Mismatch
**What goes wrong:** Test creates a "pre-Phase-15" state shape that passes `isPAFVState()` but doesn't accurately represent what was actually serialized in Phase 14.
**Why it happens:** The type guard was added in Phase 15 and has been updated in Phases 20, 23, and 30. Each update added `undefined` acceptance for new fields. The test must use shapes that match what the real serializer produced at each phase.
**How to avoid:** Use minimal shapes that omit the new fields entirely (as the real serializer would have done): `{ viewType: 'supergrid', xAxis: null, yAxis: null, groupBy: null }` for pre-15, add `colAxes`/`rowAxes` for 15, add `colWidths` for 20, etc.
**Warning signs:** All backward compat tests pass trivially because the state shape includes too many fields.

### Pitfall 5: Benchmark jsdom Overhead Masking Real Regressions
**What goes wrong:** Benchmarks pass in jsdom with generous limits (500ms) but would fail in a real browser. Or: benchmarks fail because jsdom is having a slow day, not because of a real regression.
**Why it happens:** jsdom DOM operations are ~100x slower than Chrome for D3 data joins. The existing PLSH-01 test acknowledges this with a comment.
**How to avoid:** Follow the existing pattern: use reduced grid sizes (10x10 instead of 50x50), generous jsdom budgets, and document the real browser target in comments. The 500+ card stress test should be informational-only (no pass/fail gate), as specified in the locked decision.
**Warning signs:** Benchmark times vary >5x between runs in jsdom.

### Pitfall 6: Selection Auto-Reconcile Race Condition
**What goes wrong:** Collapsing a group with selected cards triggers both `_renderCells()` (which changes DOM) and `_updateSelectionVisuals()` (which reads DOM). If visuals update before render completes, the selection highlights are stale.
**Why it happens:** The collapse toggle calls `_renderCells()` synchronously, which includes DOM manipulation. The selection subscriber is notified via `queueMicrotask` which fires after the synchronous render.
**How to avoid:** The auto-reconcile visual transfer should happen WITHIN `_renderCells()` after aggregate cells are created, not via a separate subscriber notification. The existing `_updateSelectionVisuals()` already runs as part of the render pipeline (called at end of `_renderCells()`), so this is naturally handled.
**Warning signs:** Tests that check selection visuals immediately after collapse toggle fail intermittently.

## Code Examples

### Existing PAFVProvider setState Backward Compat Guards (lines 567-599)
```typescript
// Source: src/providers/PAFVProvider.ts
setState(state: unknown): void {
  if (!isPAFVState(state)) {
    throw new Error('[PAFVProvider] setState: invalid state shape');
  }
  const restored = state as PAFVState;
  this._state = {
    ...restored,
    colAxes: Array.isArray(restored.colAxes) ? [...restored.colAxes] : [],
    rowAxes: Array.isArray(restored.rowAxes) ? [...restored.rowAxes] : [],
    colWidths: (typeof restored.colWidths === 'object' && restored.colWidths !== null
      && !Array.isArray(restored.colWidths)) ? { ...restored.colWidths } : {},
    sortOverrides: Array.isArray(restored.sortOverrides) ? [...restored.sortOverrides] : [],
    collapseState: Array.isArray(restored.collapseState) ? [...restored.collapseState] : [],
  };
  this._suspendedStates.clear();
}
```

### Existing Aggregate Summary Cell Injection (lines 1462-1500)
```typescript
// Source: src/views/SuperGrid.ts — col aggregate loop
for (const colCell of visibleLeafColCells) {
  if (!colCell.isCollapsed) continue;
  const colCollapseKey = `${colCell.level}\x1f${colCell.parentPath}\x1f${colCell.value}`;
  if (this._collapseModeMap.get(colCollapseKey) !== 'aggregate') continue;

  // ... sum all cells belonging to this collapsed group
  // Result: CellPlacement with isSummary: true, cardIds: []
}
```

### Existing p95 Performance Test Pattern
```typescript
// Source: tests/views/SuperGrid.perf.test.ts
function computeP95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}
```

### Existing Mock Factory Pattern for SuperGrid Tests
```typescript
// Source: tests/views/SuperGrid.perf.test.ts
function makeMockBridge(cells: CellDatum[] = []): SuperGridBridgeLike {
  return { superGridQuery: vi.fn().mockResolvedValue(cells) };
}
function makeMockProvider(colAxes, rowAxes): SuperGridProviderLike {
  return {
    getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes, rowAxes }),
    setColAxes: vi.fn(), setRowAxes: vi.fn(),
    getColWidths: vi.fn().mockReturnValue({}), setColWidths: vi.fn(),
    getSortOverrides: vi.fn().mockReturnValue([]), setSortOverrides: vi.fn(),
  };
}
```

Note: The mock provider for Phase 32 tests must also include `getCollapseState`/`setCollapseState` and `reorderColAxes`/`reorderRowAxes` methods from the `SuperGridProviderLike` interface.

### Collapse Key Format Reference
```typescript
// Collapse key format: "${level}\x1f${parentPath}\x1f${value}"
// UNIT_SEP = '\x1f' (U+001F)
//
// Examples:
//   Level 0, no parent:  "0\x1f\x1fEngineering"
//   Level 1, parent=Eng: "1\x1fEngineering\x1fActive"
//   Level 2, parent chain: "2\x1fEngineering\x1fActive\x1fHigh"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-axis SuperGrid | N-level stacked axes (3+3) | Phase 28 | Compound keys, multi-level headers |
| No collapse state | Aggregate/hide collapse modes | Phase 30 | Summary cells, collapse persistence |
| Set-based collapse (no mode) | `_collapsedSet` + `_collapseModeMap` | Phase 30 | Dual tracking for aggregate vs hide |
| setColAxes/setRowAxes for reorder | reorderColAxes/reorderRowAxes | Phase 31 | Non-destructive, preserves metadata |
| No FLIP animation | _captureFlipSnapshot + _playFlipAnimation (WAAPI 200ms) | Phase 31 | Smooth visual reorder feedback |

**Current gap (Phase 32 addresses):**
- No deepest-wins suppression — multiple collapsed levels can double-count
- Aggregate summary cells not selectable via lasso (card_ids: [])
- No N-level (3+3) performance benchmarks (PLSH-01/02/03 use single-axis)
- No cross-session persistence validation (existing tests verify toJSON/setState in isolation)
- No backward-compatibility matrix tests across all phase shapes

## Open Questions

1. **How should aggregate summary cells visually indicate they contain selected cards?**
   - What we know: Normal cells use blue tint (`rgba(26, 86, 240, 0.12)`) and 2px outline. Summary cells currently use `d3.interpolateBlues` heat map coloring.
   - What's unclear: Should the blue selection tint overlay the heat map color, replace it, or use a different visual treatment?
   - Recommendation (Claude's discretion): Use the existing blue tint overlay. When a summary cell contains ANY selected cards, apply the same `rgba(26, 86, 240, 0.12)` background and outline as normal cells. The count badge already shows the selection count. This is consistent with the "auto-reconcile" decision — the summary cell acts as a visual proxy.

2. **Should the 500+ card stress test have a documented "expected ceiling" even though it's not a pass/fail gate?**
   - What we know: The locked decision says "informational only (not a pass/fail gate), captures practical ceiling."
   - What's unclear: Should we log the timing, write it to console, or just run without asserting?
   - Recommendation (Claude's discretion): Log the p95 timing via `console.log()` so it appears in bench output. Do not assert. Add a comment documenting the expected real-browser ceiling (e.g., "Expect <100ms in Chrome, jsdom will be ~5-10x slower").

## Sources

### Primary (HIGH confidence)
- `src/views/SuperGrid.ts` — _renderCells() aggregate injection (lines 1462-1538), collapse toggle, FLIP animation, selection
- `src/providers/PAFVProvider.ts` — setState() backward compat (lines 567-599), isPAFVState type guard
- `src/providers/StateManager.ts` — restore() with corruption isolation
- `src/views/supergrid/keys.ts` — buildCellKey(), parseCellKey(), UNIT_SEP, RECORD_SEP
- `src/views/supergrid/SuperStackHeader.ts` — buildHeaderCells(), HeaderCell.isCollapsed, collapsedAtLevel slots
- `tests/views/SuperGrid.perf.test.ts` — existing benchmark patterns, mock factories, mulberry32 PRNG
- `tests/providers/PAFVProvider.test.ts` — existing backward compat tests
- `tests/providers/StateManager.test.ts` — existing persistence tests with mock bridge

### Secondary (MEDIUM confidence)
- [Vitest benchmark config](https://vitest.dev/config/benchmark) — bench mode file pattern `**/*.{bench,benchmark}.?(c|m)[jt]s?(x)`, outputJson, compare options

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all tools already in use
- Architecture: HIGH — all patterns derived from reading existing source code
- Pitfalls: HIGH — identified from direct code analysis of _renderCells aggregate injection and existing test patterns
- Deepest-wins algorithm: HIGH — straightforward ancestor/descendant check on collapse key hierarchy
- Persistence round-trip: HIGH — StateManager and PAFVProvider code reviewed in full

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable — internal code patterns, no external API dependencies)
