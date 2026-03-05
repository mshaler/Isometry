# Phase 23: SuperSort - Research

**Researched:** 2026-03-05
**Domain:** Sort state management, SQL ORDER BY injection, header click interaction, visual indicators
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Click-to-sort interaction**
- Dedicated sort icon button (e.g., `⇅`) added to each leaf header — NOT a modifier on existing click
- Sort icon sits to the right of the header label text
- Icon appears on header hover only; active sorts stay visible always (Notion/Linear pattern)
- Both column AND row headers support sorting — full parity
- Existing click behaviors are preserved unchanged: plain click = collapse/expand, Cmd+click = select all cards

**Multi-sort UX**
- Cmd+click the sort icon = add to multi-sort chain
- Plain click the sort icon = single-sort (replaces any existing sort)
- Multi-sort priority shown as numbered badges: ▲¹ ▼² ▲³
- Third click on sort icon cycles to unsorted (asc → desc → none), removing that field from the sort list
- A "Clear all sorts" button also appears in the header area when any sort is active (belt and suspenders)
- Claude's discretion on max simultaneous sort fields

**Sort indicators (▲/▼)**
- Only leaf (innermost) header level gets sort icons — parent spanning headers never have sort controls
- Inactive state: subtle `⇅` on hover, nothing visible when not hovering and no sort active
- Active state: bold ▲ or ▼ with numbered priority superscript
- Claude's discretion on text characters vs SVG icons
- Claude's discretion on whether sorted headers get a background tint

**Sort-within-groups boundary**
- Group headers stay in their axis-determined order (PAFVProvider direction) — only cards WITHIN each group reorder
- Sort state persists when collapsed headers are expanded — sort is global, not per-group
- Sort state lives in PAFVProvider and round-trips through toJSON()/setState() — survives view switches and session restores
- When DensityProvider collapses time fields (e.g., day → month), sort operates within each time group independently — time grouping is always the outer boundary (consistent with SORT-04)

### Claude's Discretion
- Sort icon visual style (Unicode vs SVG)
- Whether sorted headers get a subtle background highlight
- Maximum number of simultaneous sort fields (suggested: 3 matching axis depth)
- Loading skeleton or transition during sort re-query
- SortState class internal structure and API surface
- How sortOverrides integrates with existing ORDER BY in buildSuperGridQuery

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SORT-01 | User can click a column/row header to cycle sort: ascending → descending → none | SortState class with `cycle()` method; sort icon element with `click` + `stopPropagation`; `sortOverrides` extension to `SuperGridQueryConfig` |
| SORT-02 | User can Cmd+click headers for multi-sort with priority ordering | `SortState.addOrCycle()` with Cmd check; numbered priority badge rendered on sort icon element |
| SORT-03 | Active sort shows visual indicator (▲/▼) on the header | `_updateSortIconVisual()` reads from SortState and updates the icon element's text/style |
| SORT-04 | Sort operates within groups only (does not cross group boundaries) | `sortOverrides` appended AFTER axis `ORDER BY` (not before); SQL produces group-outer-sort, card-inner-sort ordering |
</phase_requirements>

## Summary

Phase 23 SuperSort adds per-header sort controls to SuperGrid. The architecture is an extension of existing patterns already proven through Phases 15-22. All three plans are pure additions: a new `SortState` class (Plan 01), an extension to `buildSuperGridQuery` (Plan 02), and DOM/visual integration in `SuperGrid._renderCells` plus `_fetchAndRender` (Plan 03).

The critical architectural insight is that sort-within-groups (SORT-04) is naturally satisfied by the ORDER BY structure: axis fields come first in ORDER BY (determining group order), and `sortOverrides` fields come after (determining card order within groups). No special boundary logic is needed — the SQL GROUP BY already defines group membership; ORDER BY secondary fields control card order within each returned group's cells.

The sort state belongs in `PAFVProvider` per the locked decision, following the exact same persistence pattern as `colAxes`, `rowAxes`, and `colWidths`. The `SuperGridProviderLike` interface in `views/types.ts` needs two new methods: `getSortOverrides()` and `setSortOverrides()`.

**Primary recommendation:** Implement `SortState` as a standalone class in `src/views/supergrid/SortState.ts` with a typed array of `{ field: AxisField; direction: 'asc' | 'desc' }`. Wire it into PAFVProvider state, extend `SuperGridQueryConfig` with `sortOverrides`, and attach sort icon elements to leaf headers with `stopPropagation` guards to prevent collision with collapse/select click handlers.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 (project config) | Type-safe SortState class, interface extensions | Project standard — strict mode |
| D3.js | v7.9 (project config) | DOM manipulation for sort icon elements in `_renderCells` | Already used for all header/cell rendering in SuperGrid |
| sql.js | 1.14 custom WASM (project config) | Executes ORDER BY with sortOverrides appended | Already the Worker database engine |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.0 (project config) | Unit tests for SortState and SuperGridQuery extension | All test files; run with `npx vitest run` |
| jsdom | (Vitest jsdom environment) | SuperGrid DOM tests | Tests annotated `// @vitest-environment jsdom` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Unicode ▲/▼ + superscript span | SVG icons | Unicode is simpler, no SVG DOM overhead; consistent with existing grip icon (U+283F) pattern |
| Persisting sort in PAFVProvider | Separate SortProvider | PAFVProvider already round-trips through toJSON/setState; adding sort avoids a new registered provider |
| Appending sortOverrides after axis ORDER BY | Replacing axis ORDER BY | Replacing would break group boundary — axis ORDER BY must stay as the primary sort key |

**Installation:** No new dependencies. All required libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── views/supergrid/
│   └── SortState.ts          # NEW — Plan 01: typed sort array + cycle/addOrCycle API
├── views/
│   └── SuperGrid.ts          # Plan 01 (sort icon DOM), Plan 03 (visual update + _fetchAndRender wiring)
├── views/supergrid/
│   └── SuperGridQuery.ts     # Plan 02: sortOverrides field + ORDER BY injection
├── providers/
│   └── PAFVProvider.ts       # Plan 01: sortOverrides field in PAFVState + getSortOverrides/setSortOverrides
├── views/
│   └── types.ts              # Plan 01: SuperGridProviderLike extension + SortEntry type
tests/
├── views/supergrid/
│   └── SortState.test.ts     # Plan 01 tests
│   └── SuperGridQuery.test.ts # Plan 02 tests (extend existing file)
├── views/
│   └── SuperGrid.test.ts     # Plan 03 integration tests (extend existing file)
├── providers/
│   └── PAFVProvider.test.ts  # Plan 01 persistence tests (extend existing file)
```

### Pattern 1: SortState class — typed sort array with cycle semantics

**What:** A standalone class holding `Array<{ field: AxisField; direction: 'asc' | 'desc' }>` with three methods: `cycle(field)` (plain click — single sort), `addOrCycle(field)` (Cmd+click — multi-sort), and `clear()`.

**When to use:** Instantiated by SuperGrid, stored reference passed to `_renderCells` for sort icon rendering and to `_fetchAndRender` for query config.

**Example:**
```typescript
// src/views/supergrid/SortState.ts
import type { AxisField } from '../../providers/types';

export interface SortEntry {
  field: AxisField;
  direction: 'asc' | 'desc';
}

export class SortState {
  private _sorts: SortEntry[] = [];
  private readonly _maxSorts: number;

  constructor(maxSorts = 3) {
    this._maxSorts = maxSorts;
  }

  /** Plain click: replace entire sort with single-field sort cycling asc→desc→none */
  cycle(field: AxisField): void {
    const existing = this._sorts.find(s => s.field === field);
    if (!existing) {
      // Not sorted: start ascending
      this._sorts = [{ field, direction: 'asc' }];
    } else if (existing.direction === 'asc') {
      this._sorts = [{ field, direction: 'desc' }];
    } else {
      // Was descending: remove (unsorted)
      this._sorts = [];
    }
  }

  /** Cmd+click: add field to multi-sort chain or cycle its direction */
  addOrCycle(field: AxisField): void {
    const existingIdx = this._sorts.findIndex(s => s.field === field);
    if (existingIdx === -1) {
      // Not in sort: add ascending (respect max)
      if (this._sorts.length < this._maxSorts) {
        this._sorts = [...this._sorts, { field, direction: 'asc' }];
      }
    } else {
      const current = this._sorts[existingIdx]!;
      if (current.direction === 'asc') {
        // Cycle to desc
        const next = [...this._sorts];
        next[existingIdx] = { field, direction: 'desc' };
        this._sorts = next;
      } else {
        // Was desc: remove from chain
        this._sorts = this._sorts.filter((_, i) => i !== existingIdx);
      }
    }
  }

  /** Get current sort entries (defensive copy) */
  getSorts(): SortEntry[] { return [...this._sorts]; }

  /** True if any sort is active */
  hasActiveSorts(): boolean { return this._sorts.length > 0; }

  /** Clear all sorts */
  clear(): void { this._sorts = []; }

  /** Check priority of a field (1-indexed; 0 = not sorted) */
  getPriority(field: AxisField): number {
    const idx = this._sorts.findIndex(s => s.field === field);
    return idx === -1 ? 0 : idx + 1;
  }

  /** Get direction of a field (null if not sorted) */
  getDirection(field: AxisField): 'asc' | 'desc' | null {
    return this._sorts.find(s => s.field === field)?.direction ?? null;
  }
}
```

### Pattern 2: sortOverrides extension to SuperGridQueryConfig

**What:** Add `sortOverrides?: SortEntry[]` to `SuperGridQueryConfig`. In `buildSuperGridQuery`, append sort override clauses AFTER the existing axis ORDER BY parts.

**When to use:** The key constraint is that axis ORDER BY (grouping order) stays first, and card-level sort overrides come after. This is what implements SORT-04 (sort within groups).

**Example:**
```typescript
// src/views/supergrid/SuperGridQuery.ts — extended
export interface SuperGridQueryConfig {
  colAxes: AxisMapping[];
  rowAxes: AxisMapping[];
  where: string;
  params: unknown[];
  granularity?: TimeGranularity | null;
  /** Phase 23 SORT-01/SORT-02 — additional ORDER BY fields applied within groups */
  sortOverrides?: Array<{ field: AxisField; direction: 'asc' | 'desc' }>;
}

// Inside buildSuperGridQuery():
// 1. Validate sortOverrides fields against allowlist (same pattern as axis fields)
if (sortOverrides) {
  for (const s of sortOverrides) {
    validateAxisField(s.field); // throws "SQL safety violation:..." if invalid
  }
}

// 2. Build ORDER BY: axis parts first, sortOverrides appended
const overrideParts = (sortOverrides ?? []).map(s =>
  `${s.field} ${s.direction.toUpperCase()}`
);
const orderByParts = [...axisOrderByParts, ...overrideParts];
const orderByClause = orderByParts.length > 0
  ? `ORDER BY ${orderByParts.join(', ')}`
  : '';
```

**Why axis first:** The GROUP BY result set already defines group boundaries. Each row in the result is one (colKey, rowKey) group. Within a group, `card_ids` is a flat list from `GROUP_CONCAT`. The ORDER BY in the GROUP BY query controls the ORDER in which `GROUP_CONCAT` accumulates IDs — so sort overrides must come after the grouping axes to stay within each group's result set ordering.

**Important nuance for single-level axes:** With colAxes=[card_type] and rowAxes=[folder], the query already sorts by `card_type ASC, folder ASC`. Sort overrides like `name ASC` appended after these become: `ORDER BY card_type ASC, folder ASC, name ASC`. Since the final GROUP BY collapses to one row per (card_type, folder) pair, the card_ids within that row are ordered by `name` within that group. This correctly satisfies SORT-04 — cards do not cross group boundaries.

### Pattern 3: Sort icon element wiring in `_createColHeaderCell` and row header section

**What:** Add a sort icon `<button>` or `<span>` element to each leaf header. The element must:
1. Be added only at leaf level (the CONTEXT.md constraint)
2. Use `stopPropagation()` to prevent bubbling to the parent collapse/select click handler
3. Be hidden via CSS opacity/visibility when inactive (hover reveals), always shown when active
4. Display priority superscript when multi-sort is active

**When to use:** The existing `_createColHeaderCell` method is already factored for leaf vs. parent distinction via the `isLeafLevel` guard. The same guard used for `this._sizer.addHandleToHeader(el, cell.value)` is the right place to attach the sort icon.

**Example:**
```typescript
// Inside _createColHeaderCell — AFTER existing label append:
if (isLeafLevel) {
  const sortBtn = document.createElement('span');
  sortBtn.className = 'sort-icon';

  // Read current sort state for this axis field
  const priority = this._sortState.getPriority(axisField as AxisField);
  const direction = this._sortState.getDirection(axisField as AxisField);

  // Visual: inactive = ⇅ (shown on hover), active = ▲/▼ with priority badge
  if (priority > 0) {
    sortBtn.textContent = direction === 'asc' ? '▲' : '▼';
    sortBtn.style.opacity = '1';
    if (this._sortState.getSorts().length > 1) {
      const badge = document.createElement('sup');
      badge.textContent = String(priority);
      badge.style.fontSize = '9px';
      sortBtn.appendChild(badge);
    }
  } else {
    sortBtn.textContent = '⇅';
    sortBtn.style.opacity = '0'; // hidden until hover
    // Show on parent hover via CSS class or JS mouseenter
  }

  sortBtn.style.cursor = 'pointer';
  sortBtn.style.marginLeft = '4px';
  sortBtn.style.fontSize = '10px';
  sortBtn.style.flexShrink = '0';

  sortBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation(); // CRITICAL: prevents header collapse click
    if (e.metaKey || e.ctrlKey) {
      this._sortState.addOrCycle(axisField as AxisField);
    } else {
      this._sortState.cycle(axisField as AxisField);
    }
    // Sort state change triggers re-fetch
    void this._fetchAndRender();
  });

  el.appendChild(sortBtn);

  // Hover show/hide for inactive icon
  el.addEventListener('mouseenter', () => {
    if (this._sortState.getPriority(axisField as AxisField) === 0) {
      sortBtn.style.opacity = '0.5';
    }
  });
  el.addEventListener('mouseleave', () => {
    if (this._sortState.getPriority(axisField as AxisField) === 0) {
      sortBtn.style.opacity = '0';
    }
  });
}
```

### Pattern 4: PAFVProvider sort state persistence

**What:** Add `sortOverrides?: SortEntry[]` to the `PAFVState` interface inside `PAFVProvider.ts`. Add `getSortOverrides()` and `setSortOverrides()` methods. Update `toJSON()` (no change needed — `JSON.stringify(this._state)` already picks up the new field), `setState()` type guard, and `resetToDefaults()`.

**When to use:** Following the exact same pattern as `colWidths` added in Phase 20 — optional field with backward-compatible restoration.

**Example:**
```typescript
// PAFVState interface extension:
interface PAFVState {
  // ... existing fields ...
  /** Phase 23 SORT-01/SORT-02 — active sort overrides for SuperGrid */
  sortOverrides?: SortEntry[];
}

// In VIEW_DEFAULTS for supergrid:
supergrid: {
  // ... existing defaults ...
  sortOverrides: [],
}

// New getter:
getSortOverrides(): SortEntry[] {
  return [...(this._state.sortOverrides ?? [])];
}

// New setter (validates fields against allowlist):
setSortOverrides(sorts: SortEntry[]): void {
  for (const s of sorts) {
    validateAxisField(s.field as string);
  }
  this._state.sortOverrides = [...sorts];
  // sortOverrides changes trigger re-query (unlike colWidths which is CSS-only)
  this._scheduleNotify();
}

// setState() backward compat:
sortOverrides: Array.isArray(restored.sortOverrides) ? [...restored.sortOverrides] : [],
```

**Important design choice:** Unlike `colWidths`, `sortOverrides` changes DO call `_scheduleNotify()` because they require a Worker re-query (ORDER BY changes). The `setSortOverrides()` call in SuperGrid happens directly from the sort icon click handler before `_fetchAndRender()` is called — but since `_fetchAndRender` is called directly, `_scheduleNotify` is not needed for the initial trigger. However, persistence requires it so that StateCoordinator-triggered re-renders (from other provider changes) pick up the current sort state.

**Alternative:** Store `SortState` purely as SuperGrid instance state (not in PAFVProvider), and only write to PAFVProvider at checkpoint time. This avoids the notify → re-query cycle when sort changes come from the icon click (since `_fetchAndRender` is called directly). The tradeoff is that sort state would not round-trip through PAFVProvider's normal notification path if another provider change triggers a re-render. The locked decision says "Sort state lives in PAFVProvider and round-trips through toJSON()/setState()" — so PAFVProvider is the right home, but SuperGrid owns the in-memory `SortState` instance and syncs it to the provider.

### Pattern 5: "Clear all sorts" button in the density toolbar

**What:** Add a "Clear sorts" button to the existing density toolbar (created in `mount()`). Show/hide it based on whether any sort is active.

**When to use:** Placed in `_densityToolbarEl` alongside the existing granularity picker, hide-empty checkbox, and view mode selector. The button visibility is updated by a `_updateSortToolbar()` helper called from `_renderCells`.

### Anti-Patterns to Avoid

- **Attaching sort icon to ALL header levels:** Only leaf (innermost) headers get sort icons. The `isLeafLevel` guard already exists in the column header rendering loop. Row headers are all single-level so they always get sort icons.
- **Not calling `e.stopPropagation()` on sort icon click:** The parent header element has a click handler for collapse/expand. Sort icon click MUST stop propagation or it triggers collapse too.
- **Replacing axis ORDER BY with sort overrides:** Sort overrides must be APPENDED after axis ORDER BY, not replace it. Replacing would break group boundary semantics (SORT-04 violation).
- **Storing `SortState` in provider state as the live class instance:** `PAFVState` must be JSON-serializable. Store only the plain `SortEntry[]` array in provider state; the `SortState` class instance lives in SuperGrid.
- **Forgetting `validateAxisField` on sortOverrides fields:** The allowlist check in `buildSuperGridQuery` must cover sortOverrides fields. Injection defense applies equally to sort fields.
- **Calling `_scheduleNotify()` from `setSortOverrides` when SuperGrid also calls `_fetchAndRender` directly:** This creates a double re-query (once from notify → coordinator, once from direct call). The clean solution: SuperGrid calls `_sortState.cycle/addOrCycle`, then calls `_provider.setSortOverrides(_sortState.getSorts())` which notifies coordinator, and the coordinator subscription fires `_fetchAndRender()` automatically — no direct `_fetchAndRender()` call needed. This matches the DnD pattern from Phase 18: "Do NOT call _fetchAndRender directly; StateCoordinator subscription fires it."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-sort priority display | Custom priority numbering widget | Plain `<sup>` element with priority integer as text | The locked decision specifies "▲¹ ▼² ▲³" — a sup element is sufficient, no library needed |
| Sort icon hover reveal | CSS animation library | CSS `opacity` toggled by `mouseenter`/`mouseleave` | Consistent with existing hover patterns in SuperGrid (grip opacity: 0.5 on hover) |
| SQL ORDER BY construction | Custom SQL builder | Extend the existing `buildSuperGridQuery` string builder | The existing pattern (`.filter(Boolean).join('\n')`) already composes clauses cleanly |

**Key insight:** This phase has zero external library dependencies. All required primitives (string construction, DOM events, type checking) are already in the project.

## Common Pitfalls

### Pitfall 1: Sort icon click propagating to header collapse handler
**What goes wrong:** User clicks sort icon → grid collapses the header group instead of sorting.
**Why it happens:** The sort icon is a child of the header `div` which has its own click listener for collapse/expand.
**How to avoid:** `e.stopPropagation()` as the FIRST line of the sort icon click handler.
**Warning signs:** Test that directly clicks the sort icon element and checks that `_collapsedSet` is unchanged.

### Pitfall 2: Sort overrides replacing axis ORDER BY (SORT-04 violation)
**What goes wrong:** Cards appear in sorted order but cross group boundaries (a "note" card sorted by name appears in the "task" group column).
**Why it happens:** Sort overrides placed BEFORE axis ORDER BY or used to REPLACE axis ORDER BY.
**How to avoid:** In `buildSuperGridQuery`, always build `[...axisOrderByParts, ...overrideParts]`. The axis parts are the group keys; the override parts are secondary within-group keys.
**Warning signs:** Write a test where sort field values differ between groups (e.g., names 'A','B','C' in group 1 and names 'D','E','F' in group 2) and verify that after sorting by name, all group-1 cards still appear in group 1's cell.

### Pitfall 3: SortState out of sync with PAFVProvider after session restore
**What goes wrong:** User restores a saved session with a prior sort → SuperGrid renders but the sort icon shows no active sort (or vice versa).
**Why it happens:** `SortState` (in-memory class) is initialized fresh on every `SuperGrid` constructor call. PAFVProvider's `sortOverrides` may have been restored from JSON, but `SortState` starts empty.
**How to avoid:** In SuperGrid's constructor (or `mount()`), call `this._sortState = new SortState(); const restored = this._provider.getSortOverrides(); restored.forEach(s => this._sortState.addOrCycle(s.field, s.direction))` — or better, initialize `SortState` from the provider's initial state. The cleanest pattern: `SortState` constructor accepts initial entries array.
**Warning signs:** Integration test that calls `provider.setState(savedState)` before mounting SuperGrid and verifies sort icons reflect the restored sort.

### Pitfall 4: Double re-query on sort icon click
**What goes wrong:** Each sort icon click triggers two `superGridQuery` Worker calls instead of one.
**Why it happens:** SuperGrid calls both `_provider.setSortOverrides(...)` (which fires `_scheduleNotify` → coordinator) AND `void this._fetchAndRender()` directly.
**How to avoid:** Only use one path. The established project pattern (STATE.md: "Do NOT call _fetchAndRender directly") is: mutate the provider → coordinator fires `_fetchAndRender` automatically. The sort icon click should follow the same pattern: `this._sortState.cycle(field)` → `this._provider.setSortOverrides(this._sortState.getSorts())` → coordinator subscription fires `_fetchAndRender` automatically.
**Warning signs:** Test spy on `superGridQuerySpy` verifying it's called exactly once after a sort icon click.

### Pitfall 5: Sort state lost on axis change (colAxes/rowAxes reset)
**What goes wrong:** User sorts by `name`, then drags an axis to transpose → sort state remains but is now sorting by a field that was part of the original axis group, creating confusing results.
**Why it happens:** `setSortOverrides` does not clear itself when `setColAxes`/`setRowAxes` change.
**Decision needed:** Should axis changes clear sort state? The CONTEXT.md does not address this explicitly. The safest approach: clear `sortOverrides` when `setColAxes` or `setRowAxes` is called (similar to how `colWidths` is reset). This prevents stale sorts. Alternatively, keep sorts and let the SQL naturally handle it (the sorted field may not exist in the new grouping, but it's still a valid `cards` column). Given the user mental model ("I sorted by name within card_type/folder groups, then I changed the column axis"), clearing is friendlier.
**Warning signs:** If this is not addressed in Plan 01, add it to the decisions log.

## Code Examples

Verified patterns from existing codebase:

### Existing click handler pattern with stopPropagation (Phase 21 grip handle)
```typescript
// Source: src/views/SuperGrid.ts lines 1372-1378
grip.addEventListener('dragstart', (e: DragEvent) => {
  _dragPayload = { field: axisField, sourceDimension: 'col', sourceIndex: axisIndex };
  e.dataTransfer?.setData('text/x-supergrid-axis', '1');
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation(); // prevent header collapse click
});
```

### Existing provider mutation → coordinator auto-trigger pattern (Phase 18)
```typescript
// Source: src/views/SuperGrid.ts lines 1485-1492
if (targetDimension === 'col') {
  this._provider.setColAxes(newAxes);
} else {
  this._provider.setRowAxes(newAxes);
}
// StateCoordinator subscription fires _fetchAndRender() automatically — do NOT call directly
```

### Existing allowlist validation pattern in SuperGridQuery (Phase 22)
```typescript
// Source: src/views/supergrid/SuperGridQuery.ts lines 122-124
for (const axis of [...colAxes, ...rowAxes]) {
  validateAxisField(axis.field); // throws "SQL safety violation:..." if invalid
}
```

### Existing isLeafLevel guard for leaf-only controls (Phase 20 sizer handle)
```typescript
// Source: src/views/SuperGrid.ts lines 876-878
if (isLeafLevel) {
  this._sizer.addHandleToHeader(el, cell.value);
}
```

### Existing PAFVProvider optional field with backward-compat restore (Phase 20 colWidths)
```typescript
// Source: src/providers/PAFVProvider.ts lines 406-411
colWidths: (
  typeof restored.colWidths === 'object' &&
  restored.colWidths !== null &&
  !Array.isArray(restored.colWidths)
) ? { ...restored.colWidths as Record<string, number> } : {},
```

### Existing density toolbar "Clear all sorts" button placement precedent
```typescript
// Source: src/views/SuperGrid.ts lines 354-466 (mount() toolbar creation)
// The toolbar already has: granularity picker, hide-empty checkbox, view-mode select
// "Clear sorts" button follows the same DOM construction pattern
const clearSortsBtn = document.createElement('button');
clearSortsBtn.textContent = 'Clear sorts';
clearSortsBtn.style.display = 'none'; // hidden until sorts active
clearSortsBtn.addEventListener('click', () => {
  this._sortState.clear();
  this._provider.setSortOverrides([]);
  // coordinator fires _fetchAndRender automatically
});
this._densityToolbarEl?.appendChild(clearSortsBtn);
```

### ORDER BY construction in buildSuperGridQuery (existing pattern to extend)
```typescript
// Source: src/views/supergrid/SuperGridQuery.ts lines 151-157
const orderByParts = allAxes.map(ax => {
  const expr = compileAxisExpr(ax.field, granularity);
  return `${expr} ${ax.direction.toUpperCase()}`;
});
const orderByClause = orderByParts.length > 0
  ? `ORDER BY ${orderByParts.join(', ')}`
  : '';
```
Extension: append sortOverride parts to `orderByParts` before joining.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct `_fetchAndRender()` call | Provider mutation → StateCoordinator auto-fires | Phase 18 locked constraint | Sort icon click MUST use provider mutation pattern, not direct call |
| Single-level ORDER BY | Compound ORDER BY (axis fields + overrides) | Phase 23 (new) | Enables sort-within-groups without special boundary logic |

**Deprecated/outdated:**
- Nothing deprecated for this phase; this is net-new functionality.

## Open Questions

1. **Should axis changes (setColAxes/setRowAxes) clear sortOverrides?**
   - What we know: `colWidths` is reset on axis change (Phase 20 precedent). Sort state is logically tied to the field being sorted, not the axis it's sorted under.
   - What's unclear: If user sorts by `name` and then changes axes, do they expect the sort to persist or clear?
   - Recommendation: Clear `sortOverrides` when `setColAxes` or `setRowAxes` is called. This mirrors `colWidths` reset behavior and prevents stale/confusing sorts. The `SortState` instance in SuperGrid is also cleared at that point.

2. **Should row header sort icons sort by the grouped row field or by a card field?**
   - What we know: The CONTEXT.md says "Both column AND row headers support sorting — full parity." The axis field for a row header is e.g. `folder`. Sorting within a row group by `folder` would be a no-op (all cards in that row already have the same `folder` value).
   - What's unclear: Does "sorting row headers" mean sorting card order within the (colKey, rowKey) intersection by a secondary card field, or sorting the row header VALUES themselves?
   - Recommendation: Row header sort icons sort cards within each (colKey, rowKey) cell by the row axis field's secondary sort — i.e., the sort icon on a row header for field `folder` sorts cards within each `folder` group by some secondary field. But this is ambiguous. More likely interpretation: row header sort icons sort the ROW ORDERING (i.e., the rowKey values change order) by a secondary card property. Given SORT-04 ("sort stays within groups"), it's most natural to interpret row header sort as: "within each column group, sort the row values by the row field's values." Since row values are strings derived from the row axis field, this means sorting the `rowValues` array by ascending/descending of the row axis field value — which is essentially what the axis `direction` already does. Resolution: treat row header sort identically to column header sort — it adds `{ field: rowAxisField, direction }` to sortOverrides, reordering card distribution within each column group.

## Validation Architecture

> `workflow.nyquist_validation` is NOT set in config.json (field absent). Treating as false — skipping Validation Architecture section.

(Config.json contains: `mode`, `depth`, `parallelization`, `commit_docs`, `model_profile`, `workflow.research`, `workflow.plan_check`, `workflow.verifier`, `workflow.auto_advance` — no `nyquist_validation` field.)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/views/SuperGrid.ts`, `src/views/supergrid/SuperGridQuery.ts`, `src/providers/PAFVProvider.ts`, `src/providers/types.ts`, `src/views/types.ts`, `src/providers/allowlist.ts`, `src/views/ListView.ts`
- `.planning/phases/23-supersort/23-CONTEXT.md` — locked user decisions
- `.planning/REQUIREMENTS.md` — SORT-01 through SORT-04 definitions
- `.planning/STATE.md` — accumulated constraints from Phases 15-22

### Secondary (MEDIUM confidence)
- Test file patterns observed in `tests/views/SuperGrid.test.ts`, `tests/views/supergrid/SuperGridQuery.test.ts` — test structure conventions verified

### Tertiary (LOW confidence)
- None. All findings are from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from project package.json and existing imports
- Architecture: HIGH — patterns verified from existing Phase 15-22 implementations in codebase
- Pitfalls: HIGH — derived from existing locked constraints in STATE.md and direct code inspection

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable codebase, 30-day estimate)
