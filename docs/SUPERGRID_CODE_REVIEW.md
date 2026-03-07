# SuperGrid Code Review (Recently Written Code)

## Scope reviewed
Core implementation and wiring added in recent SuperGrid phases:
- `src/views/SuperGrid.ts`
- `src/views/supergrid/SuperGridSizer.ts`
- `src/views/supergrid/SuperGridSelect.ts`
- `src/views/supergrid/SuperGridBBoxCache.ts`
- `src/views/supergrid/SuperStackHeader.ts`
- `src/main.ts` (SuperGrid selection adapter wiring)
- `src/providers/PAFVProvider.ts` / `src/providers/SelectionProvider.ts` (SuperGrid-related contracts)

Validation run:
- `npx vitest run tests/views/SuperGrid.test.ts tests/views/supergrid/SuperGridSizer.test.ts tests/views/supergrid/SuperGridSelect.test.ts tests/views/supergrid/SuperGridBBoxCache.test.ts tests/providers/PAFVProvider.test.ts tests/providers/SelectionProvider.test.ts`
- Result: all tests passing (`377/377`)

## Findings (ordered by severity)

### 1) Mount-time race can orphan first render promise (P1)
**Files:**
- `src/views/SuperGrid.ts:390-407`
- `src/worker/WorkerBridge.ts:368-392`

`SuperGrid.mount()` depends on the first `_fetchAndRender()` promise resolving before it sets `this._isInitialMount = false`, restores position, and attaches lasso. But `WorkerBridge.superGridQuery()` uses latest-wins rAF coalescing and intentionally leaves earlier promises unresolved.

If a second `_fetchAndRender()` fires in the same frame (e.g., coordinator notification), the first promise can be abandoned forever, so the `.then(...)` block in `mount()` may never run.

**Impact**
- Position restore and lasso attach can be skipped.
- Hidden lifecycle instability despite passing tests.

**Fix recommendation**
- Do not gate mount completion on a single fetch promise that can be abandoned.
- Either:
1. Make `superGridQuery()` always settle earlier callers (resolve/reject as canceled), or
2. Refactor `mount()` to perform one-time setup independently of fetch resolution, with a separate “first paint complete” signal driven by render state token.

### 2) `releasePointerCapture` can throw when no capture exists (P1)
**File:** `src/views/supergrid/SuperGridSelect.ts:262-266`

`_handlePointerUp()` always calls `this._rootEl.releasePointerCapture(e.pointerId)`. Pointer capture is only set in `_handlePointerDown()` for eligible zones. A `pointerup` can still occur without prior capture, which may throw.

**Fix recommendation**
- Guard with `hasPointerCapture()`:
```ts
if (this._rootEl.hasPointerCapture?.(e.pointerId)) {
  this._rootEl.releasePointerCapture(e.pointerId);
}
```

### 3) Row-axis DnD reorder source index is incorrect (P2)
**File:** `src/views/SuperGrid.ts:687, 695`

Row grip payload uses `sourceIndex: rowIdx` (row value index), not row-axis index. Reorder logic expects axis index (`_wireDropZone`, `1100+`). This can cause invalid/no-op reorder behavior once row count exceeds axis count.

**Fix recommendation**
- Use axis index for row grips (for current single-level rendering, this should be `0`; for multi-level row headers, use header level index).

### 4) Multi-level collapse key collisions (P2)
**Files:**
- `src/views/SuperGrid.ts:1030`
- `src/views/supergrid/SuperStackHeader.ts:114, 159, 202`

Collapsed-group keys use `"${level}:${value}"`. Same value appearing under different parent paths at the same level collides and collapses unrelated groups.

**Fix recommendation**
- Include parent path in collapse key, e.g. `"${level}:${parentPath}:${value}"` (parentPath serialized safely).
- Update all collapse checks to use the new key shape.

### 5) Cell key encoding is fragile when values contain `:` (P2)
**Files:**
- `src/views/SuperGrid.ts:774, 809, 904-913, 966`
- `src/views/supergrid/SuperGridBBoxCache.ts:73`

Cell keys are concatenated as `"rowKey:colKey"` and parsed with `indexOf(':')`. Axis values can legally contain colons (folders/status-like values), causing ambiguous parsing and incorrect selection lookup.

**Fix recommendation**
- Replace string concatenation with robust encoding:
1. Store `data-row-key` and `data-col-key` separately, or
2. Use JSON key encoding and parse with `JSON.parse`.

### 6) Lasso highlight cleanup can wipe selected-cell visuals (P2)
**File:** `src/views/supergrid/SuperGridSelect.ts:240-257, 325-332`

During drag/cancel, the code resets `backgroundColor` for `lasso-hit` cells to default/empty-cell color, ignoring existing “selected” styling managed by `SuperGrid._updateSelectionVisuals()`.

**Impact**
- Selected state can visually disappear after canceled/temporary lasso interactions until next selection event.

**Fix recommendation**
- Separate transient lasso styling from selection styling via CSS classes only.
- Avoid directly writing selection-overlapping inline styles in `SuperGridSelect`; delegate final styling refresh to a provided callback (or call back into `SuperGrid._updateSelectionVisuals()` after cleanup).

### 7) Auto-fit ignores header label width due missing selector class (P3)
**Files:**
- `src/views/supergrid/SuperGridSizer.ts:268-270`
- `src/views/SuperGrid.ts:1024-1026`

Sizer queries `.col-header-label`, but header label span is created without that class. Result: label width contributes `0`, auto-fit relies only on data-cell width.

**Fix recommendation**
- Add `label.className = 'col-header-label'` in `_createColHeaderCell`.

### 8) Hot render path has avoidable O(R*C*N) lookup cost (P3)
**File:** `src/views/SuperGrid.ts:742-751`

For each row/col placement, code does `cells.find(...)`. This scales poorly with larger datasets.

**Fix recommendation**
- Preindex once:
```ts
const cellMap = new Map<string, CellDatum>();
for (const c of cells) cellMap.set(`${rowVal}\u001f${colVal}`, c);
```
- Use map lookups during placement generation.

## Refactoring recommendations

1. Split `SuperGrid.ts` into composable controllers
- `SuperGridRenderEngine` (headers + cell placement + D3 join)
- `SuperGridAxisDnD` (drag payload, drop-zone wiring)
- `SuperGridSelectionUI` (badge + visual refresh)
This will reduce cross-feature coupling and lower risk of regressions.

2. Replace inline style mutation with semantic class strategy
- Current code writes many inline styles in multiple modules (`SuperGrid`, `SuperGridSelect`, `SuperGridSizer`).
- Move stable styling to CSS classes and keep TS focused on state/class toggling.

3. Normalize interaction contracts
- `SuperGridSelectionLike.addToSelection()` behavior in `main.ts` is additive-only while comments in view mention toggle semantics.
- Make semantics explicit and consistent in interface naming/docs (e.g., `unionSelection` vs `toggleSelection`).

## Test gap recommendations

1. Add race test for mount + coalesced query
- Reproduce two `_fetchAndRender()` calls in one frame and assert lasso attach + position restore still occur.

2. Add regression test for pointer capture guard
- `pointerup` without prior capture should not throw.

3. Add test for colon-containing axis values
- Ensure `_getCellCardIds` / selection operations work with values like `"folder:a"`.

4. Add test for collapse key parent-path isolation
- Same level/value under different parents should collapse independently.

5. Add test for row-axis reorder payload index correctness
- Verify reorder uses axis index, not row-value index.

## Suggested implementation order

1. Fix mount/query race and pointer-capture guard (stability-critical).
2. Fix key encoding + collapse key scope (data-correctness).
3. Fix row reorder index + auto-fit label selector.
4. Optimize render lookup and then modularize `SuperGrid.ts`.
