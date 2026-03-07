# SuperGrid Bug Fix Pass — Handoff to Claude Code

**When to apply:** Immediately after Phase 22 Plan 03 commits, before Phase 23 SuperSort begins.

**Source:** Codex code review of Phases 17–21 SuperGrid implementation.

**Scope:** 8 targeted fixes + 1 interface contract clarification. No new features. No new requirements. All existing tests must stay green; add regression tests where specified.

**TypeScript errors remain P0 — zero allowed after this pass.**

---

## Context

These bugs exist in the Phase 17–21 implementation and were identified by Codex review. Phase 22 Plan 03 (density toolbar, hide-empty, view/matrix mode) may have touched `SuperGrid.ts` — read the final state of each file before making changes.

All fixes are in:
- `src/views/SuperGrid.ts`
- `src/views/supergrid/SuperGridSelect.ts`
- `src/views/supergrid/SuperGridBBoxCache.ts` (read-only — no changes needed, context only)
- `src/views/supergrid/SuperStackHeader.ts`
- `src/views/supergrid/SuperGridSizer.ts`

---

## Fix 1 — Mount/query race can orphan first render promise (P1)

**File:** `src/views/SuperGrid.ts` — `mount()` method, the `.then()` block at the end.

**Problem:**  
`mount()` gates two one-time setup actions on the promise returned by `_fetchAndRender()`:
1. Setting `this._isInitialMount = false`
2. Calling `this._positionProvider.restorePosition()`
3. Calling `this._sgSelect.attach()`

But `WorkerBridge.superGridQuery()` uses rAF coalescing and **intentionally abandons earlier callers' promises** (no resolve, no reject — the promise just hangs). If a second `_fetchAndRender()` fires in the same frame (e.g., from the density provider subscription or coordinator notification arriving during mount), the first promise is abandoned and the `.then()` block never runs. Result: position restore and lasso attach are silently skipped.

**Fix:**  
Decouple the one-time mount setup from the fetch promise. Use a private `_mountSetupDone` flag to ensure these three actions run exactly once, triggered by either the promise resolving or the next successful render cycle.

**Implementation:**

Add a private field:
```ts
/** Guards one-time post-render mount setup (position restore + lasso attach). */
private _mountSetupDone = false;
```

Extract the three one-time setup actions into a private method:
```ts
private _completeMountSetup(): void {
  if (this._mountSetupDone || !this._rootEl || !this._gridEl) return;
  this._mountSetupDone = true;
  this._isInitialMount = false;
  this._positionProvider.restorePosition(this._rootEl);
  this._sgSelect.attach(
    this._rootEl,
    this._gridEl,
    this._bboxCache,
    this._selectionAdapter,
    (cellKey) => this._getCellCardIds(cellKey)
  );
}
```

In `mount()`, replace the `.then()` block:
```ts
// Before:
void this._fetchAndRender().then(() => {
  this._isInitialMount = false;
  if (this._rootEl) {
    this._positionProvider.restorePosition(this._rootEl);
  }
  this._sgSelect.attach(root, grid, this._bboxCache, this._selectionAdapter,
    (cellKey) => this._getCellCardIds(cellKey));
});

// After:
void this._fetchAndRender().then(() => {
  this._completeMountSetup();
});
```

Call `_completeMountSetup()` at the end of a successful `_fetchAndRender()` — after `_renderCells()` returns and before the D3 opacity transition:
```ts
// In _fetchAndRender(), after _renderCells() call:
this._completeMountSetup();
```

Reset `_mountSetupDone` in `destroy()`:
```ts
this._mountSetupDone = false;
```

**Regression test to add** (`tests/views/SuperGrid.test.ts`):
- Fire two `_fetchAndRender()` calls in the same frame (use `vi.useFakeTimers()` or mock the bridge to delay resolution). Assert that `_sgSelect.attach` is called exactly once and that `restorePosition` is called exactly once after the second call resolves.

---

## Fix 2 — `releasePointerCapture` throws when no capture exists (P1)

**File:** `src/views/supergrid/SuperGridSelect.ts` — `_handlePointerUp()` method.

**Problem:**  
`_handlePointerUp()` unconditionally calls `this._rootEl.releasePointerCapture(e.pointerId)`. Pointer capture is only set in `_handlePointerDown()` for eligible zones. A `pointerup` can arrive without a prior `pointerdown` on an eligible zone (e.g., drag started outside the grid and released inside), causing a throw.

**Fix:**
```ts
// Before:
this._rootEl.releasePointerCapture(e.pointerId);

// After:
if (this._rootEl.hasPointerCapture?.(e.pointerId)) {
  this._rootEl.releasePointerCapture(e.pointerId);
}
```

**Regression test to add** (`tests/views/supergrid/SuperGridSelect.test.ts`):
- Fire a `pointerup` event on `rootEl` without a prior `pointerdown` on an eligible zone. Assert no exception is thrown.

---

## Fix 3 — Cell key encoding breaks when axis values contain `:` (P2)

**Files:** `src/views/SuperGrid.ts` — `_getCellCardIds()`, `_getRectangularRangeCardIds()`, and the D3 `.each()` callback in `_renderCells()`.

**Problem:**  
Cell keys are encoded as `"${rowKey}:${colKey}"` and parsed with `cellKey.indexOf(':')`. Axis values can legally contain colons (folder names, status values like `"in:progress"`). `indexOf(':')` finds the first colon, producing wrong `rowKey`/`colKey` splits.

**Fix:**  
Store `rowKey` and `colKey` as separate `data-` attributes. Eliminate string-join encoding for identity purposes.

**In the D3 `.each()` callback** in `_renderCells()`:
```ts
// Before:
el.dataset['key'] = `${d.rowKey}:${d.colKey}`;
el.dataset['colKey'] = d.colKey;

// After:
el.dataset['rowKey'] = d.rowKey;
el.dataset['colKey'] = d.colKey;
// Keep a composite key for the D3 data join identity (unchanged — this is fine for D3):
el.dataset['key'] = `${d.rowKey}\x1f${d.colKey}`; // U+001F unit separator — not in user data
```

Update the D3 `.data()` key function to match:
```ts
.data(cellPlacements, d => `${d.rowKey}\x1f${d.colKey}`)
```

**In `_getCellCardIds()`**, update to read the two separate attributes:
```ts
// Before:
private _getCellCardIds(cellKey: string): string[] {
  const colField = this._lastColAxes[0]?.field ?? 'card_type';
  const rowField = this._lastRowAxes[0]?.field ?? 'folder';
  const sepIdx = cellKey.indexOf(':');
  if (sepIdx === -1) return [];
  const rowKey = cellKey.slice(0, sepIdx);
  const colKey = cellKey.slice(sepIdx + 1);
  ...
}

// After:
private _getCellCardIds(cellKey: string): string[] {
  const colField = this._lastColAxes[0]?.field ?? 'card_type';
  const rowField = this._lastRowAxes[0]?.field ?? 'folder';
  const sepIdx = cellKey.indexOf('\x1f');
  if (sepIdx === -1) return [];
  const rowKey = cellKey.slice(0, sepIdx);
  const colKey = cellKey.slice(sepIdx + 1);
  ...
}
```

**In the lasso hit-test path** in `SuperGridSelect.ts`, the `hitTest()` result is a list of cell keys from `BBoxCache`, which stores keys from `el.dataset['key']`. Since `BBoxCache` reads `cell.dataset['key']`, the separator change is automatically reflected — no changes needed in `SuperGridBBoxCache.ts`.

**Regression test to add** (`tests/views/SuperGrid.test.ts`):
- Mount SuperGrid with axis values that contain colons (e.g., `folder = "work:personal"`, `card_type = "a:b"`). Assert that `_getCellCardIds` returns the correct card IDs for those cells.

---

## Fix 4 — Collapse key collisions across parent paths (P2)

**Files:** `src/views/SuperGrid.ts` — `_renderCells()` collapse key construction and `_createColHeaderCell()`. `src/views/supergrid/SuperStackHeader.ts` — `buildHeaderCells()`.

**Problem:**  
Collapsed-group keys use `"${level}:${value}"`. The same leaf value appearing under different parent paths at the same level (e.g., `"To Do"` under both `"Project A"` and `"Project B"` at level 1) shares the same key and collapses/expands together.

**Fix:**  
Include the parent path in the collapse key.

**Key format change:**
```ts
// Before:
const collapseKey = `${cell.level}:${cell.value}`;

// After:
// parentPath = the ancestor values joined with \x1f, up to (but not including) this level
// For level 0: parentPath is empty string ""
// For level 1: parentPath is the level-0 value
// For level 2: parentPath is "level0val\x1flevel1val"
const parentPath = cell.tuple.slice(0, cell.level).join('\x1f'); // see HeaderCell change below
const collapseKey = `${cell.level}\x1f${parentPath}\x1f${cell.value}`;
```

**Required `HeaderCell` change** (`SuperStackHeader.ts`):  
Add a `parentPath` field to `HeaderCell` so `SuperGrid.ts` can construct the correct key without re-deriving it:
```ts
export interface HeaderCell {
  value: string;
  level: number;
  colStart: number;
  colSpan: number;
  isCollapsed: boolean;
  parentPath: string; // \x1f-joined ancestor values at levels 0..(level-1)
}
```

Populate `parentPath` in `buildHeaderCells()` when constructing each `HeaderCell`. For level 0, `parentPath` is `""`. For level 1, it is the parent slot's tuple value at index 0. Derive it from `slot.tuple.slice(0, level).join('\x1f')`.

**Update all collapse key reads** in `SuperGrid.ts`:
- `_createColHeaderCell()` — the `collapseKey` local variable used for `_collapsedSet.has()` and the click handler
- `_renderCells()` — anywhere `_collapsedSet` is checked or mutated for row-axis collapse (if any)

**Update `buildHeaderCells()`** in `SuperStackHeader.ts`:  
The `collapsedSet` parameter is passed in from `SuperGrid._collapsedSet`. The function currently checks `collapsedSet.has(`${level}:${value}`)`. Update to use the new format: `collapsedSet.has(`${level}\x1f${parentPath}\x1f${value}`)`.

> **Note:** `_collapsedSet` is cleared on `destroy()` (it's reset in the `destroy()` method via `this._collapsedSet = new Set()`). No migration of existing keys is needed.

**Regression test to add** (`tests/views/supergrid/SuperStackHeader.test.ts`):
- Build headers where the same value appears at the same level under different parents. Collapse the key for one parent. Assert that only that parent's group collapses, not the other.

---

## Fix 5 — Row-axis DnD reorder uses value index instead of axis index (P2)

**File:** `src/views/SuperGrid.ts` — `_renderCells()`, row header grip `dragstart` handler.

**Problem:**  
The row grip sets `sourceIndex: rowIdx`, where `rowIdx` is the index of the row value (e.g., row 0 = "Folder A", row 1 = "Folder B"). But `_wireDropZone()` treats `sourceIndex` as an axis-array index (e.g., position in `rowAxes[]`). For single-level rows these are different things. At multi-level they diverge completely.

**Fix:**  
Row grips should encode the axis-level index (i.e., which rowAxis is being dragged), not the row-value index.

For the current single-level row rendering, the axis index is always `0` for the first (and only) axis level being rendered. If/when multi-level row rendering is added, each header level will correspond to `rowAxes[levelIndex]`.

```ts
// Before (in the row grip dragstart handler):
_dragPayload = { field: rowAxisField, sourceDimension: 'row', sourceIndex: rowIdx };

// After:
// rowAxisLevelIndex = which rowAxes[] entry this grip represents
// For single-level rendering: always 0 (only one row axis level rendered currently)
const rowAxisLevelIndex = 0; // TODO: update to levelIdx when multi-level row headers are rendered
_dragPayload = { field: rowAxisField, sourceDimension: 'row', sourceIndex: rowAxisLevelIndex };
```

**Regression test to add** (`tests/views/SuperGrid.test.ts`):
- Simulate a dragstart on a row header grip. Assert the captured `_dragPayload.sourceIndex` is `0` (the axis index), not the row value index.

---

## Fix 6 — Lasso cleanup overwrites selection visual state (P2)

**File:** `src/views/supergrid/SuperGridSelect.ts` — `_clearLassoHighlights()`.

**Problem:**  
`_clearLassoHighlights()` resets `cell.style.backgroundColor` to either the empty-cell color or `""`. But `SuperGrid._updateSelectionVisuals()` independently sets `backgroundColor` to `rgba(26, 86, 240, 0.12)` for selected cells. After a canceled or completed lasso drag, selected cells lose their blue tint until the next selection event triggers `_updateSelectionVisuals()` again.

**Fix:**  
`_clearLassoHighlights()` must not write `backgroundColor` on cells that have the `selected` class. Use a CSS class strategy instead of inline style mutation.

**Add a CSS class for lasso hover state.** The styling for `.lasso-hit` should live in CSS only (it already exists as a class). Do not write `backgroundColor` inline for lasso hit state — use the class to carry the background via stylesheet.

**In `_clearLassoHighlights()`:**
```ts
// Before:
private _clearLassoHighlights(): void {
  if (!this._gridEl) return;
  const highlighted = this._gridEl.querySelectorAll<HTMLElement>('.lasso-hit');
  for (const el of highlighted) {
    el.classList.remove('lasso-hit');
    el.style.backgroundColor = el.classList.contains('empty-cell')
      ? 'rgba(255,255,255,0.02)' : '';
  }
}

// After:
private _clearLassoHighlights(): void {
  if (!this._gridEl) return;
  const highlighted = this._gridEl.querySelectorAll<HTMLElement>('.lasso-hit');
  for (const el of highlighted) {
    el.classList.remove('lasso-hit');
    // Do NOT touch backgroundColor — selection visual state is owned by
    // SuperGrid._updateSelectionVisuals() which writes it independently.
    // Only clear the inline backgroundColor if the cell is NOT selected.
    if (!el.classList.contains('sg-selected')) {
      el.style.backgroundColor = el.classList.contains('empty-cell')
        ? 'rgba(255,255,255,0.02)' : '';
    }
  }
}
```

**In `SuperGrid._updateSelectionVisuals()`**, add/remove a `sg-selected` CSS class in addition to the inline style, so `SuperGridSelect` can check it:
```ts
// In _updateSelectionVisuals():
cell.style.backgroundColor = isSelected ? 'rgba(26, 86, 240, 0.12)' : ...;
cell.style.outline = isSelected ? '2px solid #1a56f0' : '';
cell.style.outlineOffset = isSelected ? '-2px' : '';
// Add sentinel class for cross-module state awareness:
if (isSelected) {
  cell.classList.add('sg-selected');
} else {
  cell.classList.remove('sg-selected');
}
```

**Also apply the same guard in `_handlePointerMove()`** where lasso-hit inline styles are applied:
```ts
// In _handlePointerMove, when applying hit highlight:
if (hitSet.has(key)) {
  if (!cell.classList.contains('lasso-hit')) {
    cell.classList.add('lasso-hit');
    // Only write lasso background if not already selected
    if (!cell.classList.contains('sg-selected')) {
      cell.style.backgroundColor = 'rgba(26, 86, 240, 0.06)';
    }
  }
}
```

**Regression test to add** (`tests/views/supergrid/SuperGridSelect.test.ts`):
- Mark a cell as selected (add `sg-selected` class and `rgba(26, 86, 240, 0.12)` background). Simulate a complete lasso drag that hits that cell, then cancels. Assert the cell's `backgroundColor` is still `rgba(26, 86, 240, 0.12)` after cleanup.

---

## Fix 7 — Auto-fit ignores header label width (missing CSS class) (P3)

**File:** `src/views/SuperGrid.ts` — `_createColHeaderCell()`.

**Problem:**  
`SuperGridSizer.addHandleToHeader()` dblclick handler queries `.col-header-label` to measure label width for auto-fit. The label `<span>` is created without this class. `labelEl` is always `null`, `labelWidth` is always `0`, so auto-fit only measures data cell content.

**Fix** (one line in `_createColHeaderCell()`):
```ts
// Before:
const label = document.createElement('span');

// After:
const label = document.createElement('span');
label.className = 'col-header-label';
```

No test needed — covered by the existing auto-fit test once the class is present.

---

## Fix 8 — O(R×C×N) cell lookup in hot render path (P3)

**File:** `src/views/SuperGrid.ts` — `_renderCells()`, the `cellPlacements` construction loop.

**Problem:**  
The current loop calls `cells.find(...)` for each `(rowVal, colVal)` pair — O(R×C×N) where N is the cells array length. This is fine for small grids but degrades at larger datasets.

**Fix:**  
Preindex once using a `Map` keyed by `\x1f`-separated field values, then do O(1) lookups:

```ts
// Before the cellPlacements loop, add:
const cellMap = new Map<string, CellDatum>();
for (const c of cells) {
  const ck = `${String(c[colField] ?? 'unknown')}\x1f${String(c[rowField] ?? 'None')}`;
  cellMap.set(ck, c);
}

// Then in the placement loop, replace cells.find() with:
const matchingCell = cellMap.get(`${colVal}\x1f${rowVal}`);
```

No new test needed — existing render tests cover correctness; this is a pure performance improvement.

---

## Interface Contract Clarification (No Code Change Required)

**File:** `src/views/types.ts` — `SuperGridSelectionLike` interface.

**Issue:**  
`addToSelection()` is currently documented/used as additive-only (union). Comments in `SuperGrid.ts` use "add to / toggle" inconsistently. Before multi-view selection coordination arrives (Phase 27), formalize the semantics in the interface JSDoc:

```ts
export interface SuperGridSelectionLike {
  /** Replace current selection with exactly these card IDs. */
  select(cardIds: string[]): void;
  /** Union these card IDs into current selection (additive, never removes). */
  addToSelection(cardIds: string[]): void;
  /** Clear all selected card IDs. */
  clear(): void;
  isSelectedCell(cellKey: string): boolean;
  isCardSelected(cardId: string): boolean;
  getSelectedCount(): number;
  subscribe(cb: () => void): () => void;
}
```

Update the `_noOpSelectionAdapter` and any mock implementations in test files to match the clarified semantics. No behavioral change — just documentation.

---

## Execution Order

Apply fixes in this sequence to minimize conflicts:

1. **Fix 2** — `releasePointerCapture` guard (`SuperGridSelect.ts`) — isolated, no dependencies
2. **Fix 1** — Mount race (`SuperGrid.ts`) — isolated to `mount()` + new private method
3. **Fix 3** — Cell key encoding (`SuperGrid.ts`, `SuperGridSelect.ts`) — update separator throughout; verify BBoxCache still works (it reads `dataset['key']` from DOM — correct after change)
4. **Fix 4** — Collapse key parent-path (`SuperGrid.ts`, `SuperStackHeader.ts`) — requires `HeaderCell` interface change; update all callers
5. **Fix 5** — Row reorder index (`SuperGrid.ts`) — one-line change in dragstart handler
6. **Fix 6** — Lasso/selection bleed (`SuperGridSelect.ts`, `SuperGrid.ts`) — add `sg-selected` class in `_updateSelectionVisuals`, guard in `_clearLassoHighlights`
7. **Fix 7** — Auto-fit label class (`SuperGrid.ts`) — one-line change
8. **Fix 8** — Render preindex (`SuperGrid.ts`) — isolated performance improvement
9. **Interface clarification** — JSDoc update in `types.ts`, propagate to mocks

---

## Success Criteria

- All pre-existing tests pass (zero regressions)
- 5 new regression tests added (Fixes 1, 2, 3, 4, 5)
- Zero TypeScript errors (`npx tsc --noEmit`)
- `npx vitest run` reports all tests green
- No new dependencies added

---

*Prepared by Claude (claude.ai) — to be executed by Claude Code after Phase 22 Plan 03 completes.*
*Source: Codex review of SuperGrid Phases 17–21 implementation.*
