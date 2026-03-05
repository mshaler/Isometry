# Phase 24: SuperFilter - Research

**Researched:** 2026-03-05
**Domain:** Excel-style axis filter dropdown UI, FilterProvider integration, cached data population
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Dropdown trigger & placement
- Filter icon uses hover-reveal pattern (opacity 0 → visible on header hover) — same as existing sort icon
- Icon placement relative to sort icon: Claude's discretion based on existing header layout
- Both row and column headers get filter icons (FILT-01: "column or row header")
- Dropdown positioning: Claude's discretion — must account for sticky header constraints and scroll container overflow

#### Checkbox interactions
- Text search/filter input at top of dropdown for high-cardinality axes (type-to-filter the checkbox list)
- Left-click toggles checkbox; right-click or Cmd+click does "only this value" (uncheck all others)
- Each checkbox row shows value count from cached supergrid:query result cells (e.g., "Marketing (12)") — no extra Worker query
- Live-update: filter applies immediately as checkboxes change (no "Apply" button)
- Dropdown dismisses on click-outside or Escape key

#### Filter indicator & clearing
- Active-filter indicator: filter icon changes from outline/subtle to filled/colored when filter is active on that axis (mirrors sort icon going bold when active)
- Both per-axis clear (Clear button inside each dropdown) and global clear (toolbar or keyboard shortcut)
- Clicking the active-filter indicator opens the dropdown (does NOT immediately clear the filter) — icon always does one thing
- Deselecting all values in a dropdown restores unfiltered state (FILT-05) — treat "nothing selected" same as "everything selected"

#### Multi-axis filter behavior
- AND/intersection logic: cell visible only if its row value AND col value are both in selected sets
- Filtered-out values disappear entirely from the grid (grid shrinks to show only matching data)
- Composition order: SuperFilter narrows via SQL WHERE first, then hide-empty (DENS-02) removes zero-count rows/cols from the filtered result
- Filter state persists via FilterProvider/StateManager (Tier 2 persistence) — survives view switches and page refreshes

### Claude's Discretion
- Filter icon placement relative to sort icon (left vs right)
- Dropdown positioning strategy (within scroll container vs floating portal)
- Exact dropdown styling (width, max-height, padding, scrollbar behavior)
- Global "clear all filters" placement (toolbar button, keyboard shortcut, or both)
- Animation/transition for dropdown open/close
- How filter state is represented internally in FilterProvider (new axis-filter concept vs reusing existing Filter type with 'in' operator)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILT-01 | User can click a filter icon on column/row headers to open auto-filter dropdown | Filter icon creation pattern mirrors `_createSortIcon()`; hover-reveal via rAF-deferred `mouseenter`/`mouseleave` on parent header element |
| FILT-02 | Dropdown shows checkbox list of distinct values for that axis, populated from current query result (no additional Worker query on open) | Values extracted from `_lastCells` by reading unique `c[axisField]` values with their aggregate counts — identical approach to how `_renderCells()` builds `colValuesRaw`/`rowValuesRaw` |
| FILT-03 | Select All and Clear buttons in dropdown for bulk operations | `clearAxis(field)` removes all `'in'` filters for that field; `selectAll` re-adds all values; both are purely FilterProvider mutations |
| FILT-04 | Active filter shows visual indicator on header | Icon switches from ▽ (hollow) to ▼/filled+colored when `hasAxisFilter(field)` returns true — mirrors sort icon bold/opacity pattern |
| FILT-05 | Removing all filters restores the unfiltered grid | Treat "nothing checked" as "all checked" — when selectedValues is empty or equals all values, remove the axis filter instead of adding an empty `IN ()` clause |
</phase_requirements>

## Summary

Phase 24 implements Excel-style auto-filter dropdowns on SuperGrid column and row headers. The core pattern is deeply established in the codebase: filter icons follow the exact same hover-reveal lifecycle as Phase 23 sort icons, filter state flows through the existing `FilterProvider` using the already-implemented `'in'` operator, and dropdown value population reads from the already-cached `_lastCells` array with zero Worker round-trips.

The most significant design decision is how to represent axis filter state in `FilterProvider`. The cleanest approach is to represent each axis filter as a single `Filter` entry with `operator: 'in'` and `value: string[]` — this uses the already-implemented `compileOperator('in', ...)` path which compiles to `field IN (?, ?, ...)`. The existing `FilterProvider.addFilter()` / `removeFilter()` API requires adding a dedicated `setAxisFilter(field, values)` / `clearAxis(field)` pattern that replaces-not-appends (since only one `'in'` filter makes sense per axis field).

The dropdown is a `position:absolute` element appended inside the sticky header cell itself. The scroll container (`overflow:auto`) on `_rootEl` clips `position:fixed` children, making portal-based positioning fragile. Keeping the dropdown inside the header and managing its z-index (above z-index:2 sticky headers) is the correct strategy for this architecture.

**Primary recommendation:** Create a new `SuperGridFilter.ts` module (analogous to `SortState.ts`) to encapsulate axis filter state as a `Map<AxisField, Set<string>>`, and wire it into `FilterProvider` via `setAxisFilter()`/`clearAxis()` adapter calls — keeping the filter icon creation self-contained and the dropdown lifecycle isolated from `SuperGrid.ts`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (project) | 5.9 strict | All implementation | Locked stack (D-001) |
| Native DOM | browser | Dropdown, checkbox, input elements | No extra dependencies; existing SuperGrid uses only DOM + D3 |
| D3.js v7 | v7.9 | Existing in codebase; NOT needed for filter dropdown | Dropdown is imperative DOM, not a D3 data join |
| FilterProvider | existing | SQL WHERE `IN (...)` compilation | Already has `'in'` operator; Tier 2 persistence included |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `WorkerBridge.distinctValues()` | existing | Fallback for initial state before first query | Only needed if `_lastCells` is empty at dropdown open time |
| `validateFilterField()` from allowlist.ts | existing | SQL safety validation for axis fields | Must validate field before passing to FilterProvider |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing Filter 'in' operator via FilterProvider | Dedicated AxisFilterState class separate from FilterProvider | Separate class avoids the "replace-not-append" complexity but requires a new persistence mechanism |
| position:absolute dropdown inside header | position:fixed floating portal | Portal avoids clipping but requires scroll-aware repositioning; sticky header overflow:auto parent clips fixed-position children |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── views/supergrid/
│   ├── SuperGridFilter.ts    # NEW — axis filter state (Map<field, Set<string>>)
│   └── SortState.ts          # EXISTING — parallel pattern to follow
├── views/
│   └── SuperGrid.ts          # MODIFIED — _createFilterIcon(), _openFilterDropdown(), _closeFilterDropdown()
│   └── types.ts              # MODIFIED — SuperGridFilterAdapterLike (extends SuperGridFilterLike)
├── providers/
│   └── FilterProvider.ts     # MODIFIED — add setAxisFilter()/clearAxis()/getAxisFilter()/hasAxisFilter()
tests/views/supergrid/
│   └── SuperGridFilter.test.ts  # NEW — TDD tests for axis filter state
tests/views/
│   └── SuperGrid.test.ts     # MODIFIED — tests for FILT-01..05
```

### Pattern 1: Axis Filter State in FilterProvider (addAxisFilter)
**What:** Add `setAxisFilter(field, values)` and `clearAxis(field)` methods to FilterProvider that manage axis-specific `'in'` filters. Each axis has at most one filter entry. On `compile()`, axis filters become `field IN (?, ?, ...)` clauses.
**When to use:** When the user selects/deselects checkbox values in the dropdown.
**Example:**
```typescript
// In FilterProvider.ts — new axis filter methods
private _axisFilters: Map<string, string[]> = new Map(); // field -> selected values

setAxisFilter(field: FilterField, values: string[]): void {
  validateFilterField(field);
  if (values.length === 0) {
    this._axisFilters.delete(field);
  } else {
    this._axisFilters.set(field, [...values]);
  }
  this._scheduleNotify();
}

clearAxis(field: FilterField): void {
  validateFilterField(field);
  this._axisFilters.delete(field);
  this._scheduleNotify();
}

hasAxisFilter(field: FilterField): boolean {
  return this._axisFilters.has(field) && (this._axisFilters.get(field)?.length ?? 0) > 0;
}

getAxisFilter(field: FilterField): string[] {
  return [...(this._axisFilters.get(field) ?? [])];
}
```

The `compile()` method then appends axis filter clauses after the regular filters:
```typescript
for (const [field, values] of this._axisFilters) {
  validateFilterField(field);
  if (values.length > 0) {
    const placeholders = values.map(() => '?').join(', ');
    clauses.push(`${field} IN (${placeholders})`);
    params.push(...values);
  }
}
```

**Persistence:** `toJSON()` / `setState()` must serialize/deserialize `_axisFilters` in the `FilterState` shape.

### Pattern 2: Filter Icon — Hover-Reveal (mirrors _createSortIcon)
**What:** A `<span class="filter-icon">` appended to leaf headers (alongside sort icon). Starts at opacity:0, revealed on parent `mouseenter` if no active filter. When active filter exists: filled icon at opacity:1.
**When to use:** Called from `_renderCells()` for every leaf col/row header.
**Example:**
```typescript
private _createFilterIcon(axisField: AxisField, allValues: string[]): HTMLSpanElement {
  const icon = document.createElement('span');
  icon.className = 'filter-icon';
  icon.setAttribute('data-filter-field', axisField);

  const isActive = this._filter.hasAxisFilter(axisField);
  icon.textContent = isActive ? '\u25BC' : '\u25BD'; // ▼ (filled) vs ▽ (hollow)
  icon.style.opacity = isActive ? '1' : '0';
  icon.style.color = isActive ? 'var(--sg-filter-active-color, #1a56f0)' : '';
  icon.style.cursor = 'pointer';
  icon.style.marginLeft = '4px';
  icon.style.fontSize = '10px';
  icon.style.flexShrink = '0';
  icon.style.userSelect = 'none';
  icon.style.transition = 'opacity 0.15s';

  icon.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    this._openFilterDropdown(icon, axisField, allValues);
  });

  // Hover-reveal for inactive icons — same rAF-deferred parent listener pattern as sort icon
  requestAnimationFrame(() => {
    const parent = icon.parentElement;
    if (parent) {
      parent.addEventListener('mouseenter', () => {
        if (!this._filter.hasAxisFilter(axisField)) {
          icon.style.opacity = '0.5';
        }
      });
      parent.addEventListener('mouseleave', () => {
        if (!this._filter.hasAxisFilter(axisField)) {
          icon.style.opacity = '0';
        }
      });
    }
  });

  return icon;
}
```

### Pattern 3: Dropdown — position:absolute inside sticky header
**What:** A `position:absolute` dropdown container appended to `_rootEl` (not the header element itself), positioned relative to `_rootEl` using `getBoundingClientRect()` offset calculation. This avoids overflow:hidden clipping from parent headers but stays within the scroll container.
**When to use:** On filter icon click — `_openFilterDropdown()`.
**Example:**
```typescript
private _openFilterDropdown(
  anchorEl: HTMLElement,
  axisField: AxisField,
  allValues: string[]
): void {
  this._closeFilterDropdown(); // dismiss any existing dropdown

  // Compute position relative to _rootEl scroll container
  const anchorRect = anchorEl.getBoundingClientRect();
  const rootRect = this._rootEl!.getBoundingClientRect();
  const top = anchorRect.bottom - rootRect.top + this._rootEl!.scrollTop;
  const left = anchorRect.left - rootRect.left + this._rootEl!.scrollLeft;

  const dropdown = document.createElement('div');
  dropdown.className = 'sg-filter-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: ${top}px;
    left: ${left}px;
    z-index: 20;
    background: var(--sg-header-bg, #f8f8f8);
    border: 1px solid rgba(128,128,128,0.3);
    border-radius: 4px;
    padding: 6px;
    min-width: 180px;
    max-height: 280px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;

  // ... build search input, Select All / Clear buttons, checkbox list
  // ... each checkbox: value label + count badge from _lastCells
  this._filterDropdownEl = dropdown;
  this._rootEl!.appendChild(dropdown);

  // Click-outside dismiss
  requestAnimationFrame(() => {
    this._boundFilterOutsideClick = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node)) {
        this._closeFilterDropdown();
      }
    };
    document.addEventListener('click', this._boundFilterOutsideClick, { capture: true });
  });
}
```

### Pattern 4: Value Population from _lastCells (FILT-02)
**What:** Distinct values and their counts extracted from `_lastCells` using the axis field key. Exactly mirrors how `_renderCells()` builds `colValuesRaw`/`rowValuesRaw`.
**When to use:** When building the checkbox list inside `_openFilterDropdown()`.
**Example:**
```typescript
// For a col axis field:
const colField = this._lastColAxes[0]?.field ?? 'card_type';
// Collect value -> count mapping
const valueCounts = new Map<string, number>();
for (const cell of this._lastCells) {
  const val = String(cell[colField] ?? 'unknown');
  valueCounts.set(val, (valueCounts.get(val) ?? 0) + cell.count);
}
// Sort alphabetically for consistent presentation
const sortedValues = [...valueCounts.keys()].sort();
// Build checkboxes: "Marketing (12)"
```

For row axis — use `rowAxes[0]?.field` and `c[rowField] ?? 'None'` (matching existing `_renderCells` null handling).

### Pattern 5: Live-update on Checkbox Change
**What:** Each checkbox `change` event calls `setAxisFilter(field, newSelectedValues)`. No "Apply" button — filter fires immediately through `_filter.setAxisFilter()` → `_scheduleNotify()` → `StateCoordinator` → `_fetchAndRender()`.
**When to use:** On every checkbox interaction.
**Critical:** `SuperGridFilterLike` interface in `types.ts` needs to expose the new methods (`hasAxisFilter`, `setAxisFilter`, `clearAxis`, `getAxisFilter`) so SuperGrid can call them without importing the concrete FilterProvider.

### Anti-Patterns to Avoid
- **Empty IN clause:** `field IN ()` is invalid SQL. When no values selected, delete the axis filter entirely (treat as "all values"). `setAxisFilter(field, [])` should call `_axisFilters.delete(field)`.
- **Multiple 'in' filters per field:** Never append a second `'in'` filter for the same field — use the Map-based `_axisFilters` storage separate from the general `_filters` array.
- **Portal dropdown with position:fixed:** The scroll container is `overflow:auto`, which creates a stacking context that clips `position:fixed` children to the scroll container viewport. Use `position:absolute` relative to `_rootEl` instead.
- **Skipping stopPropagation on icon click:** Like sort icons, filter icon clicks must `stopPropagation()` to prevent header collapse toggling.
- **Re-querying Worker on dropdown open:** FILT-02 explicitly forbids a new Worker query. All values come from `_lastCells` — if `_lastCells` is empty, fall back to `bridge.distinctValues()` but this is the edge case, not the primary path.
- **Closing dropdown on every _renderCells:** The live-update filter causes `_fetchAndRender()` → `_renderCells()` to re-run. The dropdown must survive re-renders — it is appended to `_rootEl` (not `_gridEl`), which is not cleared by `_renderCells()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL IN clause compilation | Manual string building | `FilterProvider.compile()` with `'in'` operator | Already handles parameterization, SQL safety, edge cases |
| Field name validation | Ad-hoc string checks | `validateFilterField()` from allowlist.ts | SQL injection defense; already used throughout codebase |
| Axis filter persistence | Custom storage | `FilterProvider.toJSON()`/`setState()` extended to include `_axisFilters` | Tier 2 persistence already wired to StateManager |
| Checkbox list with counts | Complex custom widget | Simple `<label><input type="checkbox">` DOM elements | Native checkboxes handle accessibility, keyboard, all edge cases |
| Dropdown dismiss on click-outside | Complex event delegation | Single `document.addEventListener('click', ..., { capture: true })` | Capture phase fires before target element handlers |

**Key insight:** FilterProvider's `'in'` operator is already production-ready with parameterized SQL. The only new code needed is the axis-filter API layer (`setAxisFilter`, `clearAxis`, `hasAxisFilter`, `getAxisFilter`) and the UI dropdown.

## Common Pitfalls

### Pitfall 1: Dropdown Clipped by Overflow:Auto Scroll Container
**What goes wrong:** Dropdown is invisible because it extends beyond the scroll container boundary.
**Why it happens:** `overflow:auto` on `_rootEl` clips child elements even with high z-index. `position:fixed` would escape the overflow but gets clipped by the stacking context too.
**How to avoid:** Append the dropdown to `_rootEl` (not the header element), use `position:absolute`, and calculate offset using `getBoundingClientRect()` delta between anchor and `_rootEl`.
**Warning signs:** Dropdown appears but is cut off at header row boundary; or dropdown is invisible entirely.

### Pitfall 2: Empty IN Clause Crashes SQL
**What goes wrong:** `setAxisFilter(field, [])` results in `field IN ()` in the compiled WHERE clause, which is invalid SQLite syntax.
**Why it happens:** The `compileOperator('in', ...)` function in FilterProvider maps values → placeholders. Zero values → zero placeholders → `IN ()`.
**How to avoid:** In `setAxisFilter()`, if `values.length === 0`, call `_axisFilters.delete(field)` rather than `_axisFilters.set(field, [])`. The `compile()` loop iterates only entries that exist in the Map.
**Warning signs:** Worker error "SQL safety violation" or sql.js parse error when all checkboxes are unchecked.

### Pitfall 3: Dropdown Destroyed on Re-Render
**What goes wrong:** Live-update filter checkbox change triggers `_fetchAndRender()` → `_renderCells()` → `while (grid.firstChild) grid.removeChild(grid.firstChild)` — but the dropdown is in `_gridEl`, not `_rootEl`, so it gets wiped.
**Why it happens:** `_renderCells()` clears `_gridEl` of all children. If dropdown is appended to `_gridEl`, it gets removed on every re-render.
**How to avoid:** Append dropdown to `_rootEl`, not `_gridEl`. `_rootEl` is never cleared; only `_gridEl` gets DOM-reset.
**Warning signs:** Dropdown disappears after first checkbox change.

### Pitfall 4: rAF-Deferred Hover Listener Races
**What goes wrong:** Sort icon (Phase 23) and filter icon both attach `mouseenter`/`mouseleave` to the same parent header element via `requestAnimationFrame`. When multiple listeners exist, hover state management can conflict.
**Why it happens:** Each icon registers its own hover listeners on the shared parent. Both fire on `mouseenter`. Both check their own active state independently — which is correct behavior.
**How to avoid:** Each icon independently checks its own active state in its own hover handlers. No coordination needed because sort and filter visibility are independent.
**Warning signs:** Filter icon stays visible after hover-out because sort icon's handler ran but filter icon's didn't, or vice-versa.

### Pitfall 5: clearFilters() Wipes Axis Filters
**What goes wrong:** Calling `filterProvider.clearFilters()` (used by the global "Clear all filters" toolbar button) removes general filters but may not know about `_axisFilters`.
**Why it happens:** `_axisFilters` is a new separate Map. The existing `clearFilters()` only clears `_filters` array.
**How to avoid:** Update `clearFilters()` to also clear `_axisFilters`. Update `resetToDefaults()` similarly.
**Warning signs:** "Clear all filters" toolbar button doesn't remove axis filter visual indicators from headers.

### Pitfall 6: FilterProvider setState() Breaks on Missing axisFilters Field
**What goes wrong:** After persisting state to Tier 2 (toJSON includes axisFilters), trying to restore older state that lacks axisFilters throws in setState().
**Why it happens:** `isFilterState()` type guard and setState() validation may reject state without axisFilters.
**How to avoid:** Make `axisFilters` optional in the `FilterState` interface with `axisFilters?: Record<string, string[]>`. Default to `{}` when missing. This is the same backward-compat pattern used for `colAxes`/`rowAxes` in PAFVProvider (Phase 15 decision in STATE.md).
**Warning signs:** Page reload after adding axis filter crashes with "[FilterProvider] setState: invalid state shape".

## Code Examples

Verified patterns from existing codebase:

### Sort Icon Hover-Reveal Pattern (direct model for Filter Icon)
```typescript
// Source: src/views/SuperGrid.ts _createSortIcon() lines 1221-1289

// Inactive: show subtle icon at opacity 0, revealed on parent hover
sortBtn.style.opacity = '0';

// rAF-deferred parent event listener — same pattern for filter icon
requestAnimationFrame(() => {
  const parent = sortBtn.parentElement;
  if (parent) {
    parent.addEventListener('mouseenter', () => {
      if (this._sortState.getPriority(axisField) === 0) {
        sortBtn.style.opacity = '0.5';
      }
    });
    parent.addEventListener('mouseleave', () => {
      if (this._sortState.getPriority(axisField) === 0) {
        sortBtn.style.opacity = '0';
      }
    });
  }
});
```

### FilterProvider 'in' Operator (already implemented)
```typescript
// Source: src/providers/FilterProvider.ts compileOperator() lines 286-290

case 'in': {
  const values = value as unknown[];
  const placeholders = values.map(() => '?').join(', ');
  return { clause: `${field} IN (${placeholders})`, filterParams: values };
}
```

### Distinct Value Extraction from _lastCells (existing _renderCells pattern)
```typescript
// Source: src/views/SuperGrid.ts _renderCells() lines 794-796

const colValuesRaw = [...new Set(cells.map(c => String(c[colField] ?? 'unknown')))].sort();
const rowValuesRaw = [...new Set(cells.map(c => String(c[rowField] ?? 'None')))].sort();
```

### Sticky Header z-index Reference Values
```typescript
// Source: src/views/SuperGrid.ts _renderCells() + _createColHeaderCell()

// Corner cell (top-left): z-index 3
// Column header (top sticky): z-index 2
// Row header (left sticky): z-index 2
// Data cells: z-index 0 (default)
// Drop zones: z-index 10
// Filter dropdown: z-index 20 (must exceed all sticky headers)
```

### Click-Outside Dismiss (capture phase pattern)
```typescript
// Canonical pattern for dropdown click-outside dismiss — capture phase fires before target handlers.
// The filter dropdown must be dismissed when user clicks elsewhere in the grid or outside.

this._boundFilterOutsideClick = (e: MouseEvent) => {
  if (this._filterDropdownEl && !this._filterDropdownEl.contains(e.target as Node)) {
    this._closeFilterDropdown();
  }
};
document.addEventListener('click', this._boundFilterOutsideClick, { capture: true });
// Removed in _closeFilterDropdown():
document.removeEventListener('click', this._boundFilterOutsideClick!, { capture: true });
```

### FilterProvider Interface Extension for SuperGridFilterLike
```typescript
// Current interface in src/views/types.ts (line 161-163):
export interface SuperGridFilterLike {
  compile(): { where: string; params: unknown[] };
}

// Must extend to support axis filter read/write from SuperGrid:
export interface SuperGridFilterLike {
  compile(): { where: string; params: unknown[] };
  // Phase 24 additions:
  hasAxisFilter(field: string): boolean;
  getAxisFilter(field: string): string[];
  setAxisFilter(field: string, values: string[]): void;
  clearAxis(field: string): void;
  clearAllAxisFilters(): void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Filter via FilterProvider `_filters` array | New `_axisFilters: Map<string, string[]>` in FilterProvider | Phase 24 | Axis filters are keyed (one per field), not ordered. Replacing not appending. |
| No filter icons on headers | Hover-reveal filter icon alongside sort icon | Phase 24 | Headers now have two icons: sort (Phase 23) and filter (Phase 24) |
| Filter state only in `_filters` | `_axisFilters` persisted separately in `FilterState.axisFilters` | Phase 24 | Both general filters and axis filters survive page reload |

**No deprecated patterns** — all Phase 24 code is net-new additions extending existing infrastructure.

## Open Questions

1. **Filter icon placement: left or right of sort icon?**
   - What we know: Context.md says "Claude's discretion based on existing header layout"
   - Current header structure (left to right): `[grip][label][sort-icon]`
   - Recommendation: Add filter icon to the right of sort icon: `[grip][label][sort-icon][filter-icon]`. This keeps related "axis control" icons grouped at the right side of headers.

2. **Global "Clear all filters" placement**
   - What we know: Context.md says "toolbar button, keyboard shortcut, or both" is discretion
   - Current toolbar: granularity picker, hide-empty, view mode, clear-sorts button
   - Recommendation: Add a "Clear filters" button to the existing density toolbar (same row), hidden when no axis filters are active — mirrors the Clear sorts button pattern exactly.

3. **Dropdown positioning when anchor is near bottom of visible viewport**
   - What we know: Must use position:absolute relative to `_rootEl`; must account for scroll position
   - Recommendation: Check if dropdown would extend beyond `_rootEl.clientHeight`; if so, flip the dropdown to open upward (place it above the anchor instead of below). This prevents it from being cut off at the bottom.

4. **Right-click / Cmd+click "only this value" interaction**
   - What we know: Context.md requires this as a "power-user fast isolation" feature
   - What's unclear: Right-click on a checkbox opens browser context menu on some platforms
   - Recommendation: Use `Cmd+click` (left-click + metaKey) for "only this value" — more reliable cross-platform than right-click. Right-click can show context menu or be ignored.

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not set to `true` in `.planning/config.json`.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis — `src/views/SuperGrid.ts` (entire file read)
- Direct codebase analysis — `src/providers/FilterProvider.ts` (full implementation read)
- Direct codebase analysis — `src/views/supergrid/SortState.ts` (Phase 23 parallel pattern)
- Direct codebase analysis — `src/views/types.ts` (interface definitions)
- Direct codebase analysis — `src/providers/types.ts` (FilterField, FilterOperator types)
- Direct codebase analysis — `src/providers/allowlist.ts` (validation functions)
- Direct codebase analysis — `src/worker/handlers/supergrid.handler.ts` (distinctValues fallback)
- Direct codebase analysis — `.planning/phases/24-superfilter/24-CONTEXT.md` (user decisions)
- Direct codebase analysis — `.planning/STATE.md` (accumulated architectural decisions)

### Secondary (MEDIUM confidence)
- Pattern inference: position:absolute vs position:fixed behavior in overflow:auto scroll containers — verified by existing SuperGrid z-index usage (drop zones at z-index 10 are inside `_rootEl` not `_gridEl`)
- Pattern inference: click-outside capture phase handler — standard browser DOM pattern, no verification needed

### Tertiary (LOW confidence)
- None — all claims based on direct source inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing codebase, no external dependencies
- Architecture: HIGH — based on direct inspection of Phase 23 sort icon pattern + FilterProvider source
- Pitfalls: HIGH — derived from direct code analysis of `_renderCells` DOM clearing, FilterProvider compile() behavior, sticky header z-index values, and STATE.md backward-compat decisions

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable internal codebase — no external dependency churn)
