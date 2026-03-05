# Phase 29: Multi-Level Row Headers - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Row headers render at every stacking level with the same visual structure and interaction affordances as column headers. Each level gets its own CSS Grid column with spanning, grips, sort/filter icons, and sticky positioning. Collapse behavior is deferred to Phase 30.

</domain>

<decisions>
## Implementation Decisions

### Row Header Grid Layout
- One CSS Grid column per row axis level — mirrors how column headers use one grid row per level
- Corner block fills the full intersection area (all row-header columns x all col-header rows) as a single merged element
- Column count is dynamic — matches actual row axis depth (1 axis = 1 col, 3 axes = 3 cols). Rebuilds grid-template-columns on axis change
- Total row header width grows with depth: ~80px per level (1 level = 80px, 2 levels = 160px, 3 levels = 240px)

### Visual Spanning Behavior
- Parent row headers use CSS Grid `grid-row: span N` to cover child rows — exact mirror of column SuperStackHeaders using `grid-column: span N`
- `buildHeaderCells()` already computes span values; rendering reinterprets `colSpan` as `rowSpan` for the row dimension
- Collapse interaction deferred to Phase 30 — Phase 29 renders all headers in expanded state only
- Labels vertically centered within spanning cells (CSS `align-items: center`)
- Same border style as column headers: `1px solid rgba(128,128,128,0.2)` separators, `var(--sg-header-bg)` background

### Grip and Interaction Parity
- Every row header level gets a draggable grip icon (RHDR-02)
- `axisIndex` encodes the level index (0, 1, 2...) not the row position — fixes the existing TODO at line 1343
- Sort and filter icons appear on every row header level (each level represents a different axis field)
- Cmd+click on a spanning parent header recursively selects all cards under all child rows (extends existing SLCT-05 behavior)

### Width Allocation
- Fixed 80px per row header level, not zoom-scaled (matches existing pattern where row header column is zoom-independent)
- All row header levels use `position: sticky` with cascading `left` offsets (L0 at 0px, L1 at 80px, L2 at 160px)
- Row header column resize NOT in Phase 29 scope — defer to Phase 32 or future phase

### Claude's Discretion
- Grip icon positioning within spanning cells (top-aligned vs centered with label)
- Exact z-index layering for multi-column sticky headers
- Border treatment between row header columns (right border between levels)
- Row header text truncation/ellipsis behavior at 80px width

</decisions>

<specifics>
## Specific Ideas

- Row headers should look and behave identically to column headers — full visual and interaction symmetry
- The corner block (top-left intersection) should be a clean, single merged element — not per-row corners
- Dynamic depth: adding a 3rd row axis should "just work" by adding another 80px column

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildHeaderCells()` (SuperStackHeader.ts): Already computes multi-level headers with `colSpan` and `parentPath` for both dimensions — called for `rowHeaders` but only `rowHeaders[0]` is rendered today
- `buildGridTemplateColumns()` (SuperStackHeader.ts): Generates CSS grid-template-columns — needs update to prepend N row-header columns instead of single `rowHeaderWidth`px
- `keys.ts`: Compound key system with `UNIT_SEP`/`RECORD_SEP` — row header collision prevention via `parentPath` already computed by `buildHeaderCells`
- `_createColHeaderCell()` (SuperGrid.ts): Creates column header DOM elements — can be adapted/generalized for row headers
- `SortState`, `_createSortIcon()`, `_createFilterIcon()`: Sort/filter infrastructure — currently wired to column headers, needs extension to per-level row headers

### Established Patterns
- Column headers render in a `for (levelIdx)` loop creating DOM elements per level with grid-row/grid-column positioning
- Sticky positioning: column headers use `position: sticky; top: 0; z-index: 2`, row headers use `position: sticky; left: 0; z-index: 2`
- Corner cells use `z-index: 3` (above both row and column headers)
- DnD grips encode `data-axis-index` and `data-axis-dimension` for axis transpose/reorder
- Event delegation via `.closest('.col-header, .row-header')` for collapse clicks (line 859)

### Integration Points
- `_renderCells()` (SuperGrid.ts line ~1300): Current row header rendering loop — needs replacement with multi-level loop
- `buildGridTemplateColumns()`: Must accept row header depth to generate correct number of header columns
- `_dragPayload.sourceIndex`: Currently hardcoded to 0 — must use `levelIdx` for multi-level grips
- `gridTemplateRows`: Calculation at line 1230 uses `visibleRowCells.length` from `rowHeaders[0]` — must use leaf-level row count
- `SuperGridBBoxCache`: Cell position tracking may need update for multi-column row headers

</code_context>

<deferred>
## Deferred Ideas

- Row header column resize — Phase 32 (Polish and Performance)
- Collapse/expand on row headers — Phase 30 (Collapse System)

</deferred>

---

*Phase: 29-multi-level-row-headers*
*Context gathered: 2026-03-05*
