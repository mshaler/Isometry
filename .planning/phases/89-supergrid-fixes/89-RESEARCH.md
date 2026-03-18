# Phase 89: SuperGrid Fixes - Research

**Researched:** 2026-03-18
**Domain:** SuperGrid row header resize, PropertiesExplorer depth control, CommandBar dataset subtitle
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Row header text + resize:**
- Overflow text: ellipsis truncation with tooltip on hover showing full text
- Drag-resizable width with persistence via ui_state table (matches SuperGridSizer column width pattern)
- All row header levels share one uniform width — single drag handle, single persisted value
- Constraints: 40px minimum / 300px maximum width
- Default width remains 80px (ROW_HEADER_LEVEL_WIDTH constant becomes the default, not the fixed value)

**Property Depth control:**
- Depth selector lives inside PropertiesExplorer panel (consistent with existing explorer pattern)
- Control type: dropdown with named levels (e.g., 'Shallow (1)', 'Medium (2)', 'Deep (3)', 'All')
- Default depth = 1 (top-level properties only)
- Depth change triggers immediate re-render (no transition animation) — new supergrid:query with updated column set

**Dataset name display:**
- Dataset name shown as secondary subtitle text in the command bar area
- Loading state: inline "Loading..." text in subtitle, transitions to dataset name on completion
- Empty state: subtitle area hidden/empty when no dataset is loaded
- No document title update — command bar subtitle only

### Claude's Discretion
- Resize handle visual style (cursor, divider line, drag affordance)
- Exact dropdown named level labels and how many levels to offer
- Tooltip delay and positioning for row header overflow
- How depth maps to SchemaProvider column filtering

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SGFX-01 | Wire Property Depth control to re-render cards at selected depth | PropertiesExplorer footer pattern for depth dropdown; SchemaProvider getAllAxisColumns() for column set; _fetchAndRender() path identified |
| SGFX-02 | Fix row headers to show full text with ellipsis overflow and drag-resizable width | SuperGridSizer Pointer Events pattern fully mapped; ROW_HEADER_LEVEL_WIDTH constant location confirmed; buildGridTemplateColumns rowHeaderLevelWidth param identified; ui:set persistence path confirmed |
| SGFX-03 | Show dataset name after Command-K load with brief loading state | CommandBar DOM structure fully mapped; handleDatasetSwitch() is the integration point; datasets:query returns name field; subtitle element addition pattern clear |
</phase_requirements>

## Summary

Phase 89 implements three targeted SuperGrid improvements. All three are self-contained and touch distinct parts of the codebase without interdependency — they can be planned as three separate plans.

**SGFX-02 (row header resize)** is the most structurally significant change. `ROW_HEADER_LEVEL_WIDTH = 80` is a constant at line 121 of `src/views/SuperGrid.ts`. It controls the sticky `left` offset calculation for row headers (line 4161) and is passed to `buildGridTemplateColumns()` as `rowHeaderLevelWidth` parameter (already accepts a dynamic value). The SuperGridSizer pattern with Pointer Events, pointer capture, and `_onWidthsChange` persistence callback is already working for column resize — the row header drag handle follows the same shape but writes to a single `rowHeaderWidth` value instead of per-column keys. Persistence goes through `ui:set` / `ui:get` on the WorkerBridge (same pattern used for column widths via `PAFVProvider`).

**SGFX-01 (property depth)** is purely a UI concern: a `<select>` dropdown added to PropertiesExplorer triggers `_fetchAndRender()` via a callback. There is no existing depth concept in `SuperGridQueryConfig` — depth controls which card properties (columns) the SuperGrid displays, which maps to column axis selection rather than a SQL query parameter. The depth value determines how many LATCH axis levels to include in the query. The cleanest approach is a callback from PropertiesExplorer to SuperGrid that triggers re-fetch with a filtered column set.

**SGFX-03 (dataset name)** adds a subtitle element to CommandBar and wires it to `handleDatasetSwitch()` in `main.ts`. The `datasets:query` response already includes the `name` field. The subtitle needs a `setSubtitle(text: string | null)` public method on CommandBar.

**Primary recommendation:** Plan as three parallel single-plan tasks (P01, P02, P03), each targeting one requirement.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (no framework) | project-locked | All implementation | D3 + vanilla TS is the locked stack |
| D3-selection | project-locked | DOM joins in PropertiesExplorer | Established in all explorer panels |
| Pointer Events API | browser built-in | Row header drag resize | SuperGridSizer already uses this — zero new deps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| WorkerBridge `ui:set` / `ui:get` | project-locked | Persist row header width | Same path as column width persistence |

**Installation:** No new packages required.

## Architecture Patterns

### SGFX-02: Row Header Resize

#### Where ROW_HEADER_LEVEL_WIDTH Is Used

`src/views/SuperGrid.ts` line 121:
```typescript
const ROW_HEADER_LEVEL_WIDTH = 80;
```

Used in three places:
1. Line 1657 — passed to `buildGridTemplateColumns(..., rowHeaderDepth, ROW_HEADER_LEVEL_WIDTH, ...)`
2. Line 4161 — sticky left offset: `el.style.left = \`${levelIdx * ROW_HEADER_LEVEL_WIDTH + gutterLeftOffset}px\``
3. Line 4467 — insertion line width: `const headerWidth = this._lastRowAxes.length * ROW_HEADER_LEVEL_WIDTH`

For dynamic width, add `private _rowHeaderWidth = ROW_HEADER_LEVEL_WIDTH;` as instance state and replace all three references with `this._rowHeaderWidth`.

#### buildGridTemplateColumns Already Accepts Dynamic Width

`src/views/supergrid/SuperStackHeader.ts` — `buildGridTemplateColumns` signature:
```typescript
export function buildGridTemplateColumns(
  leafColKeys: string[],
  colWidths: Map<string, number>,
  zoomLevel: number,
  rowHeaderDepth = 1,
  rowHeaderLevelWidth = 80,   // <-- already parameterized
  showRowIndex = false,
  gutterWidth = 28,
): string
```

No changes needed to `buildGridTemplateColumns` itself.

#### SuperGridSizer Pattern to Replicate

`src/views/supergrid/SuperGridSizer.ts` — the drag handle approach:
- `addHandleToHeader(headerEl, colKey)` appends an 8px absolutely-positioned div
- `pointerdown` → `setPointerCapture`, store startX + startWidth
- `pointermove` → compute dx / zoomLevel, clamp to MIN_COL_WIDTH, call `_rebuildGridTemplate()`
- `pointerup` → `releasePointerCapture`, call `_onWidthsChange` (persistence hook)
- `pointercancel` → revert to startWidth (no persist)

For row header resize: add a single handle to the rightmost (deepest) row header column. On drag, update `this._rowHeaderWidth`, call `_rebuildGridTemplate()` inline (or factor into a helper), persist via `ui:set`.

#### Persistence Key Convention

Column widths persist via `PAFVProvider` → `ui:set`. Row header width should use the same `ui:set` / `ui:get` pattern with key `supergrid:row-header-width` (following the `supergrid:*` namespace convention visible in `WorkerBridge`).

Restore in `SuperGrid.mount()` via `bridge.send('ui:get', { key: 'supergrid:row-header-width' })` before first render.

#### Sticky Left Offset Recalculation

When `_rowHeaderWidth` changes, all already-rendered row header elements need their `left` style updated. Since `_renderCells()` rebuilds all headers from scratch on every call, a re-render is sufficient — no patch-in-place needed. Call `this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes)` from the drag handle's `pointermove` handler after updating `this._rowHeaderWidth`.

#### Width Constraints

- Minimum: 40px (decision: locked)
- Maximum: 300px (decision: locked)
- Default: 80px (ROW_HEADER_LEVEL_WIDTH)
- Apply clamp in drag handler: `Math.max(40, Math.min(300, computed))`

#### Row Header Ellipsis + Tooltip

`.row-header.sg-header` in `src/styles/supergrid.css` already has `.sg-header` rules with `overflow: hidden; white-space: nowrap; text-overflow: ellipsis`. The cell is a flex container with `display: flex; align-items: center`. The label element inside needs `min-width: 0` and `flex: 1` for ellipsis to work within flex layout.

Tooltip: add `title` attribute to the row header element with the full value text. The browser native tooltip fires after ~500ms hover — no custom tooltip needed.

### SGFX-01: Property Depth Control

#### Where Depth Fits

"Property Depth" as described maps to how many properties (columns from `SchemaProvider`) are included in the SuperGrid query axes. Depth 1 = top-level fields (e.g., the current configured axes only). The intent from the context is that the depth selector controls card rendering detail level — specifically which column set is passed to `supergrid:query`.

The most direct implementation: PropertiesExplorer exposes a `getDepth(): number` method and fires subscribers when depth changes. SuperGrid subscribes to PropertiesExplorer (it already subscribes to other providers), reads the depth, and applies it as a limit on the column axis count when constructing the query.

Alternatively, the depth value can be passed directly via a callback into `_fetchAndRender()`. Either approach works — the subscriber pattern is already established.

#### PropertiesExplorer Footer Pattern

`PropertiesExplorer` already has a footer section created in `mount()` (lines 152-178). Adding a depth dropdown above the existing footer buttons is clean:

```typescript
const depthContainer = document.createElement('div');
depthContainer.className = 'properties-explorer__depth-control';

const depthLabel = document.createElement('label');
depthLabel.textContent = 'Property Depth:';
depthLabel.htmlFor = 'prop-depth-select';

const depthSelect = document.createElement('select');
depthSelect.id = 'prop-depth-select';
depthSelect.className = 'properties-explorer__depth-select';

const DEPTH_OPTIONS = [
  { value: '1', label: 'Shallow (1)' },
  { value: '2', label: 'Medium (2)' },
  { value: '3', label: 'Deep (3)' },
  { value: '0', label: 'All' },  // 0 = no limit
];
```

Depth change fires `this._subscribers` (already used for toggle changes) — no new subscription mechanism needed.

#### Connection to SuperGrid Re-Fetch

`SuperGrid._fetchAndRender()` reads axes from `PAFVProvider`. Depth constrains how many axes are active. The integration point is a new `PropertiesExplorerConfig.onDepthChange?: (depth: number) => void` callback that calls back into the coordinator or directly triggers `_fetchAndRender()`.

In `main.ts`, when wiring PropertiesExplorer, provide `onDepthChange: () => coordinator.scheduleUpdate()`.

#### Persistence

Depth value persists via `localStorage` (same as column collapse state in PropertiesExplorer). Key: `workbench:prop-depth`. Restore in constructor.

### SGFX-03: Dataset Name in CommandBar

#### CommandBar DOM Structure

`src/ui/CommandBar.ts` `mount()` creates:
1. `.workbench-command-bar__app-icon` (button, left)
2. `.workbench-command-bar__wordmark` (span, center — static "Isometry" text)
3. `.workbench-command-bar__settings-wrapper` (div, right)

The wordmark is a static `<span>` with text "Isometry". The subtitle should appear below or beside the wordmark — either as a second line in the center zone or as a small secondary element.

#### Minimal Change Approach

Add a `setSubtitle(text: string | null)` public method and a private `_subtitleEl: HTMLElement | null = null`. In `mount()`, append a subtitle `<span>` inside the bar (after wordmark or as a child of a new center wrapper). Update it via `setSubtitle()`.

CSS: position subtitle below or as muted secondary text next to wordmark using `workbench.css` existing patterns.

#### Integration in main.ts

The `commandBar` variable is created at the top of `main.ts`. In `handleDatasetSwitch()`:
1. Before evict: `commandBar.setSubtitle('Loading...')`
2. After `coordinator.scheduleUpdate()` / view switch completes: `commandBar.setSubtitle(datasetName)`

The dataset name is already available as the `name` parameter in `onDatasetClick` callback (passed through to `handleDatasetSwitch`). Modify `handleDatasetSwitch` signature to accept `name: string`.

For initial load (when the page first loads with an active dataset): query the active dataset name from `datasets:query` in `main.ts` initialization and call `commandBar.setSubtitle(activeName)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag resize tracking | Custom mouse event math | Pointer Events + setPointerCapture (SuperGridSizer pattern) | Already proven in codebase; handles touch, finger-lift, cancel |
| Row header width persistence | Custom localStorage | WorkerBridge `ui:set` / `ui:get` | Matches column width persistence path; consistent with project pattern |
| Tooltip for truncated text | Custom hover tooltip component | HTML `title` attribute | Sufficient for headers; no positioning complexity |
| Dropdown for depth selection | Custom select UI | Native `<select>` element | Already used in PropertiesExplorer for LATCH chip dropdowns |

## Common Pitfalls

### Pitfall 1: Sticky Left Offset Must Update on Width Change
**What goes wrong:** Updating `this._rowHeaderWidth` but forgetting to re-render causes the sticky left offset to be stale — row headers at level 1+ will overlap level 0 or leave gaps.
**Why it happens:** The `el.style.left` calculation uses `levelIdx * ROW_HEADER_LEVEL_WIDTH` — if this still references the constant, changes to `_rowHeaderWidth` have no effect on already-rendered elements.
**How to avoid:** Replace ALL three usages of `ROW_HEADER_LEVEL_WIDTH` in SuperGrid with `this._rowHeaderWidth`. Call `_renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes)` on every pointermove during drag (same as sizer applyWidths pattern).
**Warning signs:** Row header levels visually overlap or have gaps after resize.

### Pitfall 2: Accumulating Listeners in _renderCells
**What goes wrong:** Wiring the row header drag handle listener inside `_renderCells()` causes duplicate listeners on every render.
**Why it happens:** `_renderCells()` is called frequently (density changes, collapse, period selection). Each call rebuilds the DOM — but if event listeners are added inside, they accumulate.
**How to avoid:** Wire the drag handle in the same element that is recreated each render (the handle element itself), so the listener is fresh each time — OR wire a single delegated listener on `_gridEl` in `mount()` (same pattern as context menu, line 1071). For a handle element recreated each render, the per-element listener is fine because the old element is GC'd with its listeners.
**Warning signs:** Drag behavior becomes erratic, multiple resize operations fire per drag event.

### Pitfall 3: SuperGridSizer applyWidths Must Know rowHeaderWidth
**What goes wrong:** During zoom changes, `SuperGridSizer.applyWidths()` is called (line 993-999) and passes the old `_rowHeaderDepth` but uses the constant `ROW_HEADER_LEVEL_WIDTH` (via `buildGridTemplateColumns`). After making width dynamic, `applyWidths` must also receive the current `_rowHeaderWidth`.
**Why it happens:** `SuperGridSizer.applyWidths()` calls `buildGridTemplateColumns` internally. Check if it accepts `rowHeaderLevelWidth` as a parameter.
**How to avoid:** Verify `SuperGridSizer.applyWidths()` signature and pass `this._rowHeaderWidth` from the zoom subscriber in `mount()`.

### Pitfall 4: PropertiesExplorer Depth Fires Subscribers Before Mount Completes
**What goes wrong:** Restoring depth from localStorage in the constructor fires subscriber callbacks before the PropertiesExplorer is mounted in the DOM.
**Why it happens:** Constructor restores depth value; if subscribers are registered before `mount()`, callback fires before DOM exists.
**How to avoid:** Only fire depth subscribers from user interaction (the `<select>` change event), not from constructor initialization. Restore value silently in constructor without firing callbacks.

### Pitfall 5: CommandBar commandBar Variable Scope in main.ts
**What goes wrong:** `commandBar` may not be in scope inside `handleDatasetSwitch()` if it's declared after the function.
**Why it happens:** JavaScript hoisting — `const` is block-scoped and not hoisted.
**How to avoid:** Confirm `commandBar` is declared in the outer scope of `handleDatasetSwitch()`. If not, pass it as a parameter or move declaration.

## Code Examples

### Row Header Width State (SuperGrid instance field)
```typescript
// Source: src/views/SuperGrid.ts (pattern)
// Add alongside _rowHeaderDepth:
private _rowHeaderWidth = ROW_HEADER_LEVEL_WIDTH; // dynamic, replaces constant
```

### Row Header Drag Handle Creation
```typescript
// Source: SuperGridSizer.addHandleToHeader pattern
const handle = document.createElement('div');
handle.className = 'row-header-resize-handle';
handle.style.cssText = 'position:absolute;top:0;right:0;width:8px;height:100%;cursor:col-resize;z-index:4;user-select:none;';

handle.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  handle.setPointerCapture(e.pointerId);
  const startX = e.clientX;
  const startWidth = this._rowHeaderWidth;

  const onMove = (e2: PointerEvent) => {
    const dx = e2.clientX - startX;
    const zoom = this._positionProvider.zoomLevel;
    this._rowHeaderWidth = Math.max(40, Math.min(300, startWidth + dx / zoom));
    // Rebuild grid template and re-render stickies
    if (this._gridEl) {
      this._gridEl.style.gridTemplateColumns = buildGridTemplateColumns(
        this._sizer.getLeafColKeys(),
        this._sizer.getColWidths(),
        zoom,
        this._rowHeaderDepth,
        this._rowHeaderWidth,
        this._showRowIndex,
      );
    }
    // Update sticky left offsets on existing row header elements
    this._updateRowHeaderStickyOffsets();
  };

  const onUp = () => {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    void this._persistRowHeaderWidth();
  };

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
});
```

### CommandBar setSubtitle
```typescript
// Source: CommandBar.ts pattern (analogous to _updateThemeLabel)
private _subtitleEl: HTMLElement | null = null;

// In mount(), after wordmark creation:
const subtitle = document.createElement('span');
subtitle.className = 'workbench-command-bar__subtitle';
subtitle.style.display = 'none';
this._subtitleEl = subtitle;
bar.appendChild(subtitle);

// Public method:
setSubtitle(text: string | null): void {
  if (!this._subtitleEl) return;
  if (text === null || text === '') {
    this._subtitleEl.style.display = 'none';
    this._subtitleEl.textContent = '';
  } else {
    this._subtitleEl.style.display = '';
    this._subtitleEl.textContent = text;
  }
}
```

### PropertiesExplorer Depth Dropdown
```typescript
// Source: PropertiesExplorer.ts footer pattern
private _depth = 1; // restored from localStorage in constructor

// In mount(), before footer buttons:
const depthWrap = document.createElement('div');
depthWrap.className = 'properties-explorer__depth-row';
const depthSel = document.createElement('select');
depthSel.className = 'properties-explorer__depth-select';
[
  { value: '1', label: 'Shallow (1)' },
  { value: '2', label: 'Medium (2)' },
  { value: '3', label: 'Deep (3)' },
  { value: '0', label: 'All' },
].forEach(({ value, label }) => {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  if (Number(value) === this._depth) opt.selected = true;
  depthSel.appendChild(opt);
});
depthSel.addEventListener('change', () => {
  this._depth = Number(depthSel.value);
  localStorage.setItem('workbench:prop-depth', String(this._depth));
  for (const cb of this._subscribers) cb();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ROW_HEADER_LEVEL_WIDTH as fixed constant | Becomes instance default, dynamic at runtime | Phase 89 | Enables drag-resize without touching SuperStackHeader |
| CommandBar wordmark-only center zone | Wordmark + subtitle secondary text | Phase 89 | Shows active dataset context without nav away |

## Open Questions

1. **Does `SuperGridSizer.applyWidths()` accept `rowHeaderLevelWidth`?**
   - What we know: `applyWidths` is called in the zoom subscriber with `_rowHeaderDepth` and `_showRowIndex`. It calls `buildGridTemplateColumns` internally.
   - What's unclear: Whether the current `applyWidths` signature passes `rowHeaderLevelWidth` through.
   - Recommendation: Read `SuperGridSizer.applyWidths()` at plan time, update signature if needed.

2. **Is `commandBar` in scope in `handleDatasetSwitch()`?**
   - What we know: Both are declared in main.ts, likely in the same outer function scope.
   - What's unclear: Exact declaration order.
   - Recommendation: Verify at plan time by reading main.ts variable declarations (~line 400-500).

3. **How does depth map to axis column count?**
   - What we know: CONTEXT.md says depth changes trigger a "new supergrid:query with updated column set."
   - What's unclear: Whether depth limits the number of active PAFVProvider axes or filters which SchemaProvider columns are available.
   - Recommendation: Implement as axis count limit in `_fetchAndRender()` — depth=1 uses only the first configured axis, depth=2 uses first two, depth=0/All uses all configured axes. This matches the existing column axis array.

## Validation Architecture

> workflow.nyquist_validation key absent from config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose tests/seams/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SGFX-01 | Depth dropdown fires subscriber on change | unit | `npx vitest run tests/seams/ui/properties-explorer-depth.test.ts -x` | Wave 0 |
| SGFX-02 | Row header width persists and restores; drag clamps to [40, 300] | unit | `npx vitest run tests/seams/ui/supergrid-row-header-resize.test.ts -x` | Wave 0 |
| SGFX-03 | CommandBar.setSubtitle() shows/hides subtitle element | unit | `npx vitest run tests/seams/ui/command-bar-subtitle.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/seams/ui/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/seams/ui/properties-explorer-depth.test.ts` — covers SGFX-01
- [ ] `tests/seams/ui/supergrid-row-header-resize.test.ts` — covers SGFX-02
- [ ] `tests/seams/ui/command-bar-subtitle.test.ts` — covers SGFX-03

## Sources

### Primary (HIGH confidence)
- `src/views/SuperGrid.ts` — ROW_HEADER_LEVEL_WIDTH constant (line 121), _rowHeaderDepth (line 203), all usage sites (lines 1657, 4161, 4467), _fetchAndRender, _renderCells structure
- `src/views/supergrid/SuperGridSizer.ts` — Pointer Events drag pattern, addHandleToHeader implementation, persistence callback
- `src/views/supergrid/SuperStackHeader.ts` — buildGridTemplateColumns signature (rowHeaderLevelWidth already parameterized)
- `src/ui/PropertiesExplorer.ts` — footer pattern, subscriber mechanism, localStorage persistence pattern
- `src/ui/CommandBar.ts` — DOM structure, public update methods (_updateThemeLabel pattern)
- `src/views/CatalogSuperGrid.ts` — dataset name availability in onDatasetClick callback
- `src/main.ts` — handleDatasetSwitch (lines 547-569), commandBar wiring, CatalogSuperGrid config
- `src/styles/supergrid.css` — .row-header.sg-header existing styles, .sg-header overflow/ellipsis rules

### Secondary (MEDIUM confidence)
- HTML `title` attribute for tooltip — standard browser behavior, no verification needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns sourced from existing codebase
- Architecture: HIGH — all integration points verified in source files; three open questions are minor and resolvable at plan time
- Pitfalls: HIGH — all sourced from direct code inspection of referenced files

**Research date:** 2026-03-18
**Valid until:** Stable — no external dependencies; valid until codebase changes
