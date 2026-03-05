# Phase 29: Multi-Level Row Headers — Research

**Researched:** 2026-03-05
**Domain:** CSS Grid layout, DOM rendering, SuperGrid TypeScript architecture
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Row Header Grid Layout**
- One CSS Grid column per row axis level — mirrors how column headers use one grid row per level
- Corner block fills the full intersection area (all row-header columns x all col-header rows) as a single merged element
- Column count is dynamic — matches actual row axis depth (1 axis = 1 col, 3 axes = 3 cols). Rebuilds grid-template-columns on axis change
- Total row header width grows with depth: ~80px per level (1 level = 80px, 2 levels = 160px, 3 levels = 240px)

**Visual Spanning Behavior**
- Parent row headers use CSS Grid `grid-row: span N` to cover child rows — exact mirror of column SuperStackHeaders using `grid-column: span N`
- `buildHeaderCells()` already computes span values; rendering reinterprets `colSpan` as `rowSpan` for the row dimension
- Collapse interaction deferred to Phase 30 — Phase 29 renders all headers in expanded state only
- Labels vertically centered within spanning cells (CSS `align-items: center`)
- Same border style as column headers: `1px solid rgba(128,128,128,0.2)` separators, `var(--sg-header-bg)` background

**Grip and Interaction Parity**
- Every row header level gets a draggable grip icon (RHDR-02)
- `axisIndex` encodes the level index (0, 1, 2...) not the row position — fixes the existing TODO at line 1343
- Sort and filter icons appear on every row header level (each level represents a different axis field)
- Cmd+click on a spanning parent header recursively selects all cards under all child rows (extends existing SLCT-05 behavior)

**Width Allocation**
- Fixed 80px per row header level, not zoom-scaled (matches existing pattern where row header column is zoom-independent)
- All row header levels use `position: sticky` with cascading `left` offsets (L0 at 0px, L1 at 80px, L2 at 160px)
- Row header column resize NOT in Phase 29 scope — defer to Phase 32 or future phase

### Claude's Discretion
- Grip icon positioning within spanning cells (top-aligned vs centered with label)
- Exact z-index layering for multi-column sticky headers
- Border treatment between row header columns (right border between levels)
- Row header text truncation/ellipsis behavior at 80px width

### Deferred Ideas (OUT OF SCOPE)
- Row header column resize — Phase 32 (Polish and Performance)
- Collapse/expand on row headers — Phase 30 (Collapse System)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RHDR-01 | Row headers render at all stacking levels (not just level 0) | `buildHeaderCells()` already computes all row header levels; the render loop must iterate `rowHeaders` array instead of only `rowHeaders[0]` |
| RHDR-02 | Row header grips appear at each level for drag interaction | `_createColHeaderCell()` pattern shows the grip creation pattern; row header creation needs a `levelIdx`-parameterized version; `data-axis-index` must carry `levelIdx` not the row position |
| RHDR-03 | Row headers use CSS Grid spanning consistent with column headers (SuperStackHeader) | `buildHeaderCells()` returns `colSpan` which is reinterpreted as `grid-row: span N` for row headers; parent spanning is a direct mirror of column spanning |
| RHDR-04 | Row header parent-path keys prevent collision across levels | `parentPath` is already computed by `buildHeaderCells()` on the `HeaderCell` type; D3 key construction for row headers must use `${levelIdx}:${cell.parentPath}:${cell.value}` or equivalent compound format |
</phase_requirements>

---

## Summary

Phase 29 is a pure rendering change within `SuperGrid.ts` (and `SuperStackHeader.ts`'s `buildGridTemplateColumns`). All the algorithmic heavy lifting is already done: `buildHeaderCells()` produces a `headers: HeaderCell[][]` array for the row dimension with correct `colSpan` values and `parentPath` keys. The only gap is that today `_renderCells()` throws away `rowHeaders[1..N]` and only renders `rowHeaders[0]`. This phase promotes all levels to visible DOM elements.

The core implementation has four mechanical changes: (1) update `buildGridTemplateColumns()` to accept a `rowHeaderDepth` parameter and prepend N 80px columns instead of one `rowHeaderWidth`px column; (2) rewrite the row header loop in `_renderCells()` to iterate every `rowHeaders[levelIdx]` in a `for (levelIdx)` loop mirroring the existing column header loop; (3) update the corner cell to span all row-header columns via `grid-column: 1 / span rowHeaderDepth`; (4) update data cell `gridColumn` from `colStart + 1` to `colStart + rowHeaderDepth` since N columns are now reserved for headers.

The key symmetry insight: a `HeaderCell`'s `colSpan` field encodes how many leaf columns the cell spans in the column dimension. For row headers, the same field encodes how many leaf rows the cell spans — `grid-row: span N` instead of `grid-column: span N`. `buildHeaderCells()` is completely reusable with zero changes.

**Primary recommendation:** Extend `buildGridTemplateColumns()` to accept `rowHeaderDepth: number`, then rewrite the row-header render loop as an N-level `for (levelIdx)` loop mirroring the column header loop. Update all `colStart + 1` data cell placement offsets to `colStart + rowHeaderDepth`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Grid | browser-native | Multi-column sticky row headers with row-spanning | Zero-dependency layout, already powering all SuperGrid cells |
| TypeScript | 5.9 (strict) | Type-safe DOM construction | Project standard, existing code uses it throughout |
| `buildHeaderCells()` (SuperStackHeader.ts) | project-internal | Computes `HeaderCell[][]` with `colSpan`, `parentPath`, `level` for both dimensions | Already used for column headers; row reuse confirmed by context |
| `UNIT_SEP` / `RECORD_SEP` (keys.ts) | project-internal | Compound key construction for D3 join identity and parent-path collision prevention | Phase 28 established this as the separator convention |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| D3 v7.9 | project-dep | D3 data join for data cells | Already used — no change needed for row headers (they are rebuilt imperatively, not via D3 join) |
| `_createColHeaderCell()` | project-internal | Reference implementation for header DOM structure | Row header creation mirrors this pattern; can adapt or extract a shared factory |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid `grid-row: span N` | Absolute positioning or `rowspan` on a real `<table>` | CSS Grid is already in use; switching layout models would require a full rewrite |
| Separate `_createRowHeaderCell()` function | Inline DOM construction in loop | A dedicated function is cleaner and more testable; consistent with `_createColHeaderCell()` pattern |

**Installation:** No new packages required — all changes are in existing files.

---

## Architecture Patterns

### Recommended Project Structure

No new files. All changes are in:
```
src/
├── views/
│   └── SuperGrid.ts              # _renderCells row header loop, data cell colStart offset
└── views/supergrid/
    └── SuperStackHeader.ts       # buildGridTemplateColumns — rowHeaderDepth param
tests/
└── views/
    └── SuperGrid.test.ts         # RHDR-01 through RHDR-04 test cases
```

### Pattern 1: N-Level Row Header Loop (mirrors column header loop)

**What:** Replace the single-level `for (rowIdx < visibleRowCells.length)` loop with a two-level loop: outer iterates `rowHeaders` levels, inner iterates cells within each level.

**When to use:** Any time multi-level row headers must be rendered.

**Example:**
```typescript
// Source: derived from existing column header loop at SuperGrid.ts line 1238
const rowHeaderDepth = rowHeaders.length || 1;  // at least 1 col

for (let levelIdx = 0; levelIdx < rowHeaders.length; levelIdx++) {
  const levelCells = rowHeaders[levelIdx] ?? [];
  const levelAxisField = rowAxes[levelIdx]?.field ?? rowField;

  for (const cell of levelCells) {
    const el = this._createRowHeaderCell(cell, levelAxisField, levelIdx, colHeaderLevels);
    grid.appendChild(el);
  }
}
```

### Pattern 2: Row Header Cell with Spanning

**What:** Each row header cell uses `grid-column: levelIdx + 1` and `grid-row: <start> / span <rowSpan>` where rowSpan comes from `cell.colSpan` (reinterpreted for the row dimension).

**Example:**
```typescript
// Source: direct mirror of _createColHeaderCell at SuperGrid.ts line 2877
private _createRowHeaderCell(
  cell: HeaderCell,
  axisField: string,
  levelIdx: number,
  colHeaderLevels: number
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'row-header';
  el.dataset['level'] = String(levelIdx);
  el.dataset['value'] = cell.value;
  el.dataset['axisField'] = axisField;

  // CSS Grid positioning: column = levelIdx+1 (1-based), row spans child rows
  el.style.gridColumn = `${levelIdx + 1}`;
  el.style.gridRow = `${colHeaderLevels + cell.colStart} / span ${cell.colSpan}`;

  el.style.position = 'sticky';
  el.style.left = `${levelIdx * 80}px`;   // cascading left offsets
  el.style.zIndex = '2';
  el.style.backgroundColor = 'var(--sg-header-bg, #f0f0f0)';
  el.style.alignItems = 'center';
  el.style.display = 'flex';

  // Grip — axisIndex = levelIdx (not row position)
  const grip = document.createElement('span');
  grip.className = 'axis-grip';
  grip.textContent = '\u283F';
  grip.setAttribute('draggable', 'true');
  grip.dataset['axisIndex'] = String(levelIdx);  // FIXES TODO at line 1343
  grip.dataset['axisDimension'] = 'row';
  grip.addEventListener('dragstart', (e: DragEvent) => {
    _dragPayload = { field: axisField, sourceDimension: 'row', sourceIndex: levelIdx };
    e.dataTransfer?.setData('text/x-supergrid-axis', '1');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  });
  el.prepend(grip);

  // Sort + filter icons (every level = leaf for its dimension)
  const sortBtn = this._createSortIcon(axisField as AxisField);
  el.appendChild(sortBtn);
  const filterIcon = this._createFilterIcon(axisField, 'row');
  el.appendChild(filterIcon);

  return el;
}
```

### Pattern 3: buildGridTemplateColumns — rowHeaderDepth parameter

**What:** `buildGridTemplateColumns()` currently prepends a single `rowHeaderWidth`px column. Phase 29 requires N 80px columns (one per row axis level).

**Example:**
```typescript
// Source: SuperStackHeader.ts line 283 — current signature
// OLD: buildGridTemplateColumns(leafColKeys, colWidths, zoomLevel, rowHeaderWidth = 160)
// NEW: buildGridTemplateColumns(leafColKeys, colWidths, zoomLevel, rowHeaderDepth = 1, rowHeaderLevelWidth = 80)

export function buildGridTemplateColumns(
  leafColKeys: string[],
  colWidths: Map<string, number>,
  zoomLevel: number,
  rowHeaderDepth = 1,
  rowHeaderLevelWidth = 80
): string {
  const headerCols = Array(rowHeaderDepth).fill(`${rowHeaderLevelWidth}px`).join(' ');
  if (leafColKeys.length === 0) {
    return headerCols;
  }
  const colDefs = leafColKeys.map(key => {
    const baseWidth = colWidths.get(key) ?? DEFAULT_COL_WIDTH;
    return `${Math.round(baseWidth * zoomLevel)}px`;
  });
  return `${headerCols} ${colDefs.join(' ')}`;
}
```

### Pattern 4: Data Cell Column Offset

**What:** Data cells currently use `colStart + 1` because column 1 is the single row header. With N row header columns, the offset becomes `colStart + rowHeaderDepth`.

**Example:**
```typescript
// SuperGrid.ts line 1482 — BEFORE
el.style.gridColumn = `${colStart + 1}`; // +1 because col 1 = row header

// AFTER
el.style.gridColumn = `${colStart + rowHeaderDepth}`; // N cols reserved for row headers
```

### Pattern 5: Corner Cell spanning all header columns

**What:** The corner cell (top-left intersection) must span all row-header columns. Currently `gridColumn: 1`. With N levels, it must be `grid-column: 1 / span N` to cover the full header area.

**Example:**
```typescript
// SuperGrid.ts line 1244 — current: gridColumn = '1'
corner.style.gridColumn = `1 / span ${rowHeaderDepth}`;
```

### Pattern 6: gridTemplateRows uses leaf-level row count

**What:** `grid.style.gridTemplateRows` is currently computed from `visibleRowCells.length` where `visibleRowCells = rowHeaders[0]`. With multi-level rendering, the visible leaf rows come from `rowHeaders[rowHeaders.length - 1]` (the deepest level). The row header column at level 0 spans N rows at level 1, so `leafRowCount` = `rowHeaders[rowHeaders.length - 1]?.length` is the correct total.

**Example:**
```typescript
// Current (line 1228-1230):
const visibleRowCells: HeaderCell[] = rowHeaders[0] ?? [];
const totalRows = colHeaderLevels + visibleRowCells.length;
grid.style.gridTemplateRows = Array(totalRows).fill('auto').join(' ');

// Phase 29:
const leafRowCells: HeaderCell[] = rowHeaders[rowHeaders.length - 1] ?? rowHeaders[0] ?? [];
const totalRows = colHeaderLevels + leafRowCells.length;
grid.style.gridTemplateRows = Array(totalRows).fill('auto').join(' ');
```

Note: `visibleRowCells` is also used in the data cell placement loop (`cellPlacements` at line 1418). After Phase 29, cell placement must use `leafRowCells` (the deepest level) for row key matching and grid row index calculation.

### Pattern 7: Cmd+click SLCT-05 extension for parent spanning cells

**What:** Existing Cmd+click on a level-0 row header selects all cards where `rowField === cell.value`. For a parent spanning cell at level 0 with `cell.colSpan > 1`, it must select all cards under all child rows recursively.

**Approach:** At click time, find all leaf-level cells whose `parentPath` starts with (or equals) the spanning cell's key, then union all card IDs.

```typescript
// In _createRowHeaderCell click handler
el.addEventListener('click', (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey) {
    const allCardIds: string[] = [];
    // Collect cards from all leaf cells that are children of this cell
    for (const cd of this._lastCells) {
      // Check all axis levels up to and including levelIdx
      const cellValuesAtLevel = rowAxes.slice(0, levelIdx + 1)
        .map(ax => String(cd[ax.field] ?? 'None'));
      const matchPrefix = cell.parentPath
        ? `${cell.parentPath}${UNIT_SEP}${cell.value}`
        : cell.value;
      const cellPrefix = cellValuesAtLevel.join(UNIT_SEP);
      if (cellPrefix === matchPrefix || cellPrefix.startsWith(matchPrefix + UNIT_SEP)) {
        allCardIds.push(...(cd.card_ids ?? []));
      }
    }
    this._selectionAdapter.addToSelection(allCardIds);
    e.stopPropagation();
  }
});
```

### Anti-Patterns to Avoid

- **Using `rowHeaderWidth = 160` constant as a single column:** Phase 29 replaces the single 160px column with N × 80px columns. The constant `ROW_HEADER_WIDTH = 160` in SuperGrid.ts must be replaced with a computed depth-based width.
- **Still using `rowHeaders[0]` for data cell placement:** The leaf-row lookup and `cellPlacements` loop must use the deepest level of `rowHeaders`, not level 0.
- **Passing `axisIndex = rowIdx` (row position) to grips:** The TODO at line 1343 must be fixed — grip `data-axis-index` encodes the *axis level* (0, 1, 2...), not the *row value position*. This is what DnD Phase 31 will rely on.
- **Forgetting to update `colStart + 1` in the D3 join `.each()` callback:** There are two places that add `+1` for the row header column. Both must be updated to `+rowHeaderDepth`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-level span computation | Custom span calculation algorithm | `buildHeaderCells()` with existing `colSpan` field | Already handles run-length encoding, parentPath, collapsed state |
| Parent-path key format | Custom separator or hash | `UNIT_SEP` (\x1f) / `parentPath` from `HeaderCell` | Phase 28 established this convention; breaking it causes key collisions |
| Row value deduplication | Custom Set/Map | `rowAxisValues` already built as tuples from `buildHeaderCells` input pipeline | Already deduplicates via Set in `_renderCells` at line 1135 |

**Key insight:** The entire multi-level header algorithm is already implemented. `buildHeaderCells()` takes `axisValues: string[][]` (tuples) and returns per-level cells with correct spans. The Phase 29 work is purely rendering: loop over all levels, interpret `colSpan` as `rowSpan`, set correct sticky `left` offsets.

---

## Common Pitfalls

### Pitfall 1: Data cell `gridColumn` offset not updated for multi-column header area

**What goes wrong:** Data cells continue using `colStart + 1`, placing them in column 2 instead of column `rowHeaderDepth + 1`. With 2 row header levels, all data cells render overlapping the second row-header column.

**Why it happens:** The `+1` offset is a hardcoded assumption that exactly 1 column is reserved for row headers.

**How to avoid:** Compute `rowHeaderDepth = rowHeaders.length || 1` before the D3 join, then use `colStart + rowHeaderDepth` in the `.each()` callback.

**Warning signs:** Data cells visually overlap row header cells; test assertions for `gridColumn` fail.

### Pitfall 2: Corner cell only covers first row-header column

**What goes wrong:** The corner cell renders at `gridColumn: 1` and the second/third row-header columns show empty cells in the header rows, creating a visual "hole" in the top-left corner.

**Why it happens:** The corner cell is rendered per-column-header-level as `gridColumn: '1'` without spanning.

**How to avoid:** Set `corner.style.gridColumn = \`1 / span ${rowHeaderDepth}\``.

**Warning signs:** Visual gap in top-left corner area; columns 2..N of the header row area are empty.

### Pitfall 3: `visibleRowCells` still points to `rowHeaders[0]` for cell placement

**What goes wrong:** With a 2-level row axis, `rowHeaders[0]` has only the parent groups (e.g., 2 cells). `rowHeaders[1]` has the leaf rows (e.g., 6 cells). Using `rowHeaders[0]` for cell placement generates only 2 data cell rows when 6 are needed.

**Why it happens:** The original `visibleRowCells = rowHeaders[0]` was correct for single-level, but is wrong for multi-level rendering after Phase 29.

**How to avoid:** Use `leafRowCells = rowHeaders[rowHeaders.length - 1] ?? rowHeaders[0] ?? []` for both `gridTemplateRows` calculation and cell placement. Single-level configs return `rowHeaders[0]` as the last element, preserving backward compatibility.

**Warning signs:** Fewer data cell rows than expected; some row header cells have no corresponding data cells.

### Pitfall 4: Row header `data-axis-index` encodes row position instead of axis level

**What goes wrong:** Grip `data-axis-index` gets `rowIdx` (0-based row position within a level's cells) instead of `levelIdx` (which axis this header represents). When Phase 31 DnD reads this to reorder axes, it moves the wrong axis.

**Why it happens:** The existing code has a TODO comment at line 1343: "TODO: update to levelIdx when multi-level row headers are rendered." Phase 29 is the time to fix this.

**How to avoid:** In `_createRowHeaderCell(cell, axisField, levelIdx, ...)`, pass `levelIdx` to `grip.dataset['axisIndex']` and to `_dragPayload.sourceIndex`.

**Warning signs:** DnD tests fail; `data-axis-index` on grips all read `0` regardless of level.

### Pitfall 5: Sticky `left` offset not cascaded correctly

**What goes wrong:** All N row-header columns stack at `left: 0`, causing them to overlap each other during horizontal scroll.

**Why it happens:** Copy-paste of the single row-header sticky rule without updating the offset.

**How to avoid:** Set `el.style.left = \`${levelIdx * 80}px\`` for each level. Level 0 → `left: 0`, Level 1 → `left: 80px`, Level 2 → `left: 160px`.

**Warning signs:** Row header columns overlap during horizontal scroll; only the rightmost level is visible.

### Pitfall 6: `gridTemplateRows` count is wrong for parent-spanning cells

**What goes wrong:** `grid.style.gridTemplateRows` is set to `colHeaderLevels + rowHeaders[0].length` but `rowHeaders[0]` contains parent cells (fewer rows than leaf level). CSS Grid assigns too few rows, causing cells below a certain row to fall outside the defined grid tracks.

**Why it happens:** `rowHeaders[0]` at level 0 has parent groups with `colSpan > 1` — it has fewer entries than leaf-level `rowHeaders[N-1]`.

**How to avoid:** Always use `rowHeaders[rowHeaders.length - 1].length` for the row count — this is the leaf level with one entry per visible grid row.

**Warning signs:** Browser renders some data cells outside defined grid area; visual gaps in grid.

### Pitfall 7: `buildGridTemplateColumns` signature change breaks existing call sites

**What goes wrong:** Changing the signature of `buildGridTemplateColumns` from `(leafColKeys, colWidths, zoomLevel, rowHeaderWidth = 160)` to `(leafColKeys, colWidths, zoomLevel, rowHeaderDepth = 1, rowHeaderLevelWidth = 80)` breaks existing callers that pass `rowHeaderWidth` as the 4th argument (e.g., `SuperGridSizer` or tests).

**Why it happens:** The existing 4th parameter was a pixel width; the new 4th parameter is a count.

**How to avoid:** Search all call sites before changing the signature. SuperGrid.ts line 1220 calls `buildGridTemplateColumns(..., ROW_HEADER_WIDTH)` — update that call to pass `rowHeaderDepth` instead. Review `SuperGridSizer.ts` and all tests for `buildGridTemplateColumns`.

**Warning signs:** TypeScript compilation error; test failures in `SuperStackHeader.test.ts`.

---

## Code Examples

### Row Header Grid Positioning Formula

```typescript
// Source: derived from existing SuperGrid.ts patterns
// For a row header cell at levelIdx, spanning rowSpan leaf rows,
// starting at leaf row rowStart (1-based):

el.style.gridColumn = `${levelIdx + 1}`;
el.style.gridRow = `${colHeaderLevels + cell.colStart} / span ${cell.colSpan}`;
// Note: cell.colStart from buildHeaderCells() is 1-based (first leaf row = 1)
// colHeaderLevels offsets into the header row area
```

### Existing Column Header Loop (reference mirror)

```typescript
// Source: SuperGrid.ts line 1238 — existing column header loop
for (let levelIdx = 0; levelIdx < colHeaders.length; levelIdx++) {
  const levelCells = colHeaders[levelIdx] ?? [];
  const gridRow = levelIdx + 1;                        // ← for cols: gridRow = levelIdx
  // ...
  const el = this._createColHeaderCell(cell, gridRow, levelAxisField, levelIdx, aggregateCount);
  el.style.gridColumn = `${cell.colStart + 1} / span ${cell.colSpan}`; // col positioning
}
// For row headers, invert: gridColumn = levelIdx+1 (fixed per column), gridRow = span-based
```

### buildHeaderCells — reuse for row dimension

```typescript
// Source: SuperStackHeader.ts — already called for row dimension
const { headers: rowHeaders, leafCount: rowLeafCount } = buildHeaderCells(
  rowAxisValues,   // string[][] tuples — one per leaf row
  this._collapsedSet
);
// rowHeaders[0] = level-0 cells (parent groups), colSpan = number of leaf rows they cover
// rowHeaders[1] = level-1 cells (children), colSpan = 1 for leaves
// rowHeaders[N-1] = leaf-level cells — use these for data cell row placement
```

### Parent-Path Key for RHDR-04

```typescript
// Source: SuperStackHeader.ts HeaderCell type — parentPath field
// Each HeaderCell carries: { value, level, colStart, colSpan, isCollapsed, parentPath }
// parentPath = \x1f-joined ancestor values, empty string for level 0

// D3 key for row header cells (prevent collision):
const rowHeaderKey = (levelIdx: number, cell: HeaderCell) =>
  `rh:${levelIdx}:${cell.parentPath ? cell.parentPath + UNIT_SEP : ''}${cell.value}`;

// Example: levelIdx=1, parentPath='Work', value='active'
//   → 'rh:1:Work\x1factive'
// vs levelIdx=0, parentPath='', value='Work'
//   → 'rh:0:Work'
// These never collide even if 'Work' appears at both levels.
```

### SuperStackHeader.ts — `buildGridTemplateColumns` update

```typescript
// Source: SuperStackHeader.ts line 283 — current implementation
// Updated to accept rowHeaderDepth instead of rowHeaderWidth

export function buildGridTemplateColumns(
  leafColKeys: string[],
  colWidths: Map<string, number>,
  zoomLevel: number,
  rowHeaderDepth = 1,           // number of row header columns (was: total pixel width)
  rowHeaderLevelWidth = 80      // pixels per level (fixed, not zoom-scaled)
): string {
  const headerColPart = Array(rowHeaderDepth)
    .fill(`${rowHeaderLevelWidth}px`)
    .join(' ');
  if (leafColKeys.length === 0) {
    return headerColPart;
  }
  const colDefs = leafColKeys.map(key => {
    const baseWidth = colWidths.get(key) ?? DEFAULT_COL_WIDTH;
    return `${Math.round(baseWidth * zoomLevel)}px`;
  });
  return `${headerColPart} ${colDefs.join(' ')}`;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single row header column (160px) | N × 80px columns, one per axis depth | Phase 29 | Multi-column sticky row headers |
| `rowHeaders[0]` for cell placement | `rowHeaders[rowHeaders.length - 1]` for leaf rows | Phase 29 | Correct row count for multi-level configs |
| `colStart + 1` data cell offset | `colStart + rowHeaderDepth` | Phase 29 | Data cells correctly placed after N header columns |
| `axisIndex = rowIdx` in grip | `axisIndex = levelIdx` | Phase 29 (fixes TODO line 1343) | Enables correct DnD reorder in Phase 31 |
| Corner cell at `gridColumn: 1` | Corner cell at `grid-column: 1 / span rowHeaderDepth` | Phase 29 | Clean corner block |

**Deprecated/outdated:**
- `ROW_HEADER_WIDTH = 160` constant: replaced by dynamic `rowHeaderDepth * 80` width.

---

## Open Questions

1. **Does `SuperGridBBoxCache` need updating for multi-column row headers?**
   - What we know: BBoxCache tracks cell positions for lasso selection. It uses `data-key` on `.data-cell` elements.
   - What's unclear: Whether BBoxCache reads `gridColumn` values directly or just reads element bounding boxes from `getBoundingClientRect()`.
   - Recommendation: Read `SuperGridBBoxCache.ts` during planning. If it reads CSS grid properties directly, it needs updating. If it uses `getBoundingClientRect()`, it is self-correcting.

2. **`buildGridTemplateColumns` signature change — how many call sites exist outside SuperGrid.ts?**
   - What we know: `SuperGridSizer.ts` and `SuperStackHeader.test.ts` both potentially call this function.
   - What's unclear: Whether any external test or helper passes `rowHeaderWidth` as the 4th positional argument.
   - Recommendation: Grep all call sites before changing the signature. Consider a named-options overload to preserve backward compatibility.

3. **Sticky `z-index` stacking for 3-level deep row headers vs corner cell**
   - What we know: Current rule — row headers at `z-index: 2`, corner cell at `z-index: 3`. Column headers at `z-index: 2`, `position: sticky; top: 0`.
   - What's unclear: With N sticky row header columns, do all N columns need the same `z-index: 2`, or should deeper levels get higher z-indices to overlap shallower ones?
   - Recommendation: All row header columns should share `z-index: 2` — they are side-by-side, not overlapping. Corner cell remains `z-index: 3` (above both dimensions). This avoids z-index wars.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `/Users/mshaler/Developer/Projects/Isometry/vitest.config.ts` |
| Quick run command | `npx vitest run tests/views/SuperGrid.test.ts` |
| Full suite command | `npx vitest run` |

Note: SuperGrid.test.ts uses `// @vitest-environment jsdom` per-file override even though the global config is `node` environment. This is the established pattern for DOM-heavy SuperGrid tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RHDR-01 | Row headers appear at all levels (not just level 0) — with 2 row axes, 2 `.row-header` columns exist per row group | unit (jsdom) | `npx vitest run tests/views/SuperGrid.test.ts --reporter=verbose` | ❌ Wave 0 |
| RHDR-02 | Every row header level has an `.axis-grip` element with correct `data-axis-index` matching levelIdx | unit (jsdom) | `npx vitest run tests/views/SuperGrid.test.ts --reporter=verbose` | ❌ Wave 0 |
| RHDR-03 | Parent row header cells have `grid-row: span N` where N = child row count | unit (jsdom) | `npx vitest run tests/views/SuperGrid.test.ts --reporter=verbose` | ❌ Wave 0 |
| RHDR-04 | No two row headers at different levels produce the same D3 key (parent-path collision) | unit (jsdom) | `npx vitest run tests/views/SuperGrid.test.ts --reporter=verbose` | ❌ Wave 0 |

**Also required (regressions):**
- Existing `tests/views/SuperStackHeader.test.ts` must pass — `buildGridTemplateColumns` signature change affects this.
- Existing single-level row header tests (sticky, z-index, axis-grip, sort icon, filter icon, SLCT-05) must all continue to pass.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/views/SuperGrid.test.ts tests/views/SuperStackHeader.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/views/SuperGrid.test.ts` — add RHDR-01 through RHDR-04 test cases (new `describe` block, pattern matches existing `describe('STAK-03...' )` block at line 8208)
- [ ] `tests/views/SuperStackHeader.test.ts` — add test for updated `buildGridTemplateColumns(keys, widths, zoom, rowHeaderDepth=2)` multi-column output

*(Existing test infrastructure covers all other needs — no new files, no new framework setup.)*

---

## Sources

### Primary (HIGH confidence)
- `SuperGrid.ts` (lines 1113–1490, 2877–2999) — current row header rendering, `_createColHeaderCell`, `_renderCells` pipeline. Read directly.
- `SuperStackHeader.ts` (full file) — `buildHeaderCells`, `buildGridTemplateColumns`, `HeaderCell` type. Read directly.
- `keys.ts` (full file) — `UNIT_SEP`, `RECORD_SEP`, `buildDimensionKey`, `buildCellKey`. Read directly.
- `29-CONTEXT.md` — all locked decisions sourced from here.
- `tests/views/SuperGrid.test.ts` — existing test infrastructure and patterns confirmed.
- `vitest.config.ts` — test runner configuration confirmed.

### Secondary (MEDIUM confidence)
- CSS Grid `grid-row: span N` and `position: sticky` with cascading `left` offsets — standard CSS Grid behavior, confirmed via code inspection of existing column header patterns.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all code read directly from source
- Architecture: HIGH — patterns derived from existing working code (column header loop is the direct mirror)
- Pitfalls: HIGH — identified by tracing all call sites that reference `colStart + 1`, `rowHeaders[0]`, `ROW_HEADER_WIDTH`, and the TODO at line 1343

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable codebase, no fast-moving external dependencies)
