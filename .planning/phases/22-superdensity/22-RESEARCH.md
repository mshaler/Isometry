# Phase 22: SuperDensity - Research

**Researched:** 2026-03-04
**Domain:** CSS Grid density control, SQL strftime GROUP BY rewrite, D3 data join update callbacks
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Density control architecture**
- Independent toggles for each active density level (Value, Extent, View) — NOT named presets
- Density state persists across sessions via Tier 2 persistence (extend PAFVState or create new persisted provider)
- Hybrid query strategy: Value-level changes (time hierarchy collapse) trigger Worker re-query via supergrid:query; Extent-level (hide empty) and View-level (spreadsheet/matrix) reprocess client-side from cached cells

**Time hierarchy collapse (DENS-01, DENS-05)**
- Aggregate counts display directly in collapsed header cells: "January (47)" format
- Only applies to time field axes (created_at, modified_at, due_at) — DensityProvider's STRFTIME_PATTERNS drive the GROUP BY rewrite
- Non-time axes (folder, status, card_type) are unaffected by granularity changes
- Granularity control hidden when no time field is assigned to any active axis
- Direct jump granularity picker (dropdown/segmented control: day/week/month/quarter/year) — NOT sequential cycling

**Empty intersections (DENS-02)**
- Remove entire rows and columns where every cell has count=0 — not just individual cells
- Simple toggle: one "Hide empty" control (no separate row/column toggles)
- Reactive behavior: when hide-empty is enabled, empties are re-evaluated on every data change (filter, axis transpose, granularity change) — newly empty rows/columns auto-hide
- Subtle indicator showing how many rows/columns are hidden ("+3 hidden" badge) — empty dimensions don't silently disappear

**Spreadsheet vs matrix mode (DENS-03)**
- Spreadsheet mode: card pills showing name + type icon per card in each cell
- Cell overflow: truncate visible cards + "+N more" badge at bottom (no scrollable cells)
- Matrix mode: count numbers with heat map color intensity (low count = light, high count = saturated background)
- Heat map provides instant data distribution visualization — classic pivot table feature

### Claude's Discretion
- Density control UI placement and layout (toolbar dropdown, sidebar, or inline)
- Mode switch animation (snap vs 300ms crossfade)
- Heat map color palette and intensity scale
- Region density (Level 4) data structure design — stub only, no UI
- Loading state during Worker re-query on granularity change

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DENS-01 | Level 1 Value Density: user can collapse time hierarchy levels (day → week → month → quarter → year) via control | SuperDensityState.axisGranularity drives strftime() GROUP BY rewrite in buildSuperGridQuery; DensityProvider.STRFTIME_PATTERNS already implemented |
| DENS-02 | Level 2 Extent Density: user can hide/show empty intersections (rows/columns with no matching cards) | SuperDensityState.hideEmpty; client-side filter on _lastCells — remove rowValues/colValues where all cells have count=0; SuperStackHeader receives filtered axis tuples |
| DENS-03 | Level 3 View Density: user can toggle between spreadsheet mode (cells show card previews) and matrix mode (cells show counts only) | SuperDensityState.viewMode; _renderCells() switches between count badge vs D3-joined card pill elements; CellDatum already carries card_ids |
| DENS-04 | Level 4 Region Density: data structure defined and stubbed (no UI in v3.0) | SuperDensityState.regionConfig stub field — typed interface, default null, no behavior wired |
| DENS-05 | Collapsed headers show aggregate card counts (user can see data is grouped, not lost) | strftime() GROUP BY collapses leaf rows into parent; COUNT(*) in SQL already returns the aggregate; header cell label format: "January (47)" |
| DENS-06 | Density changes set gridColumn/gridRow in both D3 enter AND update callbacks (no misalignment on collapse) | Critical: current _renderCells() .join() update callback is `update => update` (identity); MUST apply gridColumn/gridRow in BOTH enter append AND update each |
</phase_requirements>

---

## Summary

Phase 22 implements four density control levels on SuperGrid. The codebase already has significant infrastructure: `DensityProvider` with `STRFTIME_PATTERNS`, `buildSuperGridQuery` with GROUP BY compilation, `SuperStackHeader.buildHeaderCells` with collapsed-set logic, and `SuperGrid._renderCells` with a D3 data join. The work is additive — create a new `SuperDensityState` interface and wire it through the existing pipeline rather than rewriting anything.

The three active levels each use a different code path. Value density (granularity) forces a Worker re-query because the SQL GROUP BY expression changes — `strftime('%Y-%m', created_at)` vs `strftime('%Y', created_at)` produces different rowKeys. Extent density (hide empty) and View density (spreadsheet vs matrix) are pure client-side transforms on `_lastCells` — they re-call `_renderCells()` without re-querying the Worker, matching the existing collapse-click pattern.

The single highest-risk item is DENS-06: the current D3 `.join()` update callback is `update => update` (identity), meaning `gridColumn`/`gridRow` are only set in the `enter` callback. If density collapses the grid, existing DOM cells sit at their old positions while new cells enter at new positions, causing visual misalignment. The fix is explicit: pull the position-setting logic into a named function and call it from both enter `.each()` and update `.each()`.

**Primary recommendation:** Create `SuperDensityState` as a new `PersistableProvider` (not an extension of PAFVState), wire it as a 7th constructor arg on SuperGrid with `SuperGridDensityLike` narrow interface, and fix the D3 update callback gap before implementing any density logic.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | ^7.9.0 | Data join for cell rendering (spreadsheet mode card pills) | Already used in SuperGrid._renderCells() |
| sql.js | ^1.14.0 | strftime() GROUP BY for time hierarchy collapse | Worker already executes supergrid:query |
| TypeScript | ^5.9.3 | Strict types for SuperDensityState, interfaces | Locked D-002 decision |
| Vitest | ^4.0.18 + jsdom | Unit tests for density state, SQL rewrite, D3 join | Existing test infrastructure |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| D3 color scale (d3.scaleSequential) | part of d3 ^7.9 | Heat map color intensity for matrix mode | Matrix mode cell background; interpolateBlues or custom palette |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New SuperDensityProvider | Extend PAFVState | PAFVState already complex; density concerns orthogonal to axis assignments; separate provider keeps PersistableProvider contracts clean |
| Worker re-query for hide-empty | Client-side filter | Client-side is sufficient since all cells are returned; re-query is unnecessary overhead |
| D3 transition for mode switch | Snap switch | Claude's discretion; snap is simpler and avoids double-render artifacts |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Structure

```
src/providers/
├── SuperDensityProvider.ts    ← NEW: SuperDensityState + PersistableProvider
├── DensityProvider.ts         (unchanged — used by other views)
├── types.ts                   (add SuperDensityState, ViewMode types)
src/views/
├── SuperGrid.ts               (add densityProvider arg; fix D3 update; implement density rendering)
├── types.ts                   (add SuperGridDensityLike narrow interface)
src/views/supergrid/
├── SuperGridQuery.ts          (extend SuperGridQueryConfig with optional granularity fields)
src/worker/handlers/
├── supergrid.handler.ts       (pass through granularity — already uses buildSuperGridQuery)
tests/providers/
├── SuperDensityProvider.test.ts  ← NEW
tests/views/
├── SuperGrid.test.ts          (extend with density tests)
```

### Pattern 1: SuperDensityState as New PersistableProvider

**What:** A dedicated class managing `axisGranularity`, `hideEmpty`, `viewMode`, and `regionConfig` stub. Implements `PersistableProvider` (`toJSON`/`setState`/`resetToDefaults`). Registered with `StateCoordinator` so changes flow through the existing coordinator batch.

**When to use:** Any density state mutation triggers this; granularity changes additionally force a Worker re-query.

```typescript
// Source: Modeled on DensityProvider.ts pattern
export type ViewMode = 'spreadsheet' | 'matrix';

export interface SuperDensityState {
  axisGranularity: TimeGranularity | null;  // null = no time axis active
  hideEmpty: boolean;
  viewMode: ViewMode;
  regionConfig: null;  // DENS-04 stub — no UI in v3.0
}

export class SuperDensityProvider implements PersistableProvider {
  private _state: SuperDensityState = {
    axisGranularity: null,
    hideEmpty: false,
    viewMode: 'spreadsheet',
    regionConfig: null,
  };
  // subscribe/notify via queueMicrotask (same pattern as DensityProvider)
  // toJSON/setState/resetToDefaults implementing PersistableProvider
}
```

### Pattern 2: SuperGridDensityLike Narrow Interface

**What:** Minimal interface on `SuperGrid`'s density dependency — follows existing `SuperGridProviderLike`, `SuperGridFilterLike` pattern.

**When to use:** SuperGrid reads density state on each `_fetchAndRender()` call; tests mock this without importing the concrete provider.

```typescript
// Source: Modeled on SuperGridProviderLike in src/views/types.ts
export interface SuperGridDensityLike {
  getState(): Readonly<SuperDensityState>;
  setGranularity(granularity: TimeGranularity | null): void;
  setHideEmpty(hide: boolean): void;
  setViewMode(mode: ViewMode): void;
  subscribe(cb: () => void): () => void;
}
```

### Pattern 3: Granularity→SQL Rewrite in buildSuperGridQuery

**What:** When `SuperGridQueryConfig` includes a `granularity` field and a time-field axis, `buildSuperGridQuery` replaces the raw field name with the `STRFTIME_PATTERNS` expression in both SELECT and GROUP BY.

**Critical constraint:** The allowlist (`validateAxisField`) validates raw column names. Strftime expressions like `strftime('%Y-%m', created_at)` are NOT in the allowlist. The validation must happen on the raw field name BEFORE the strftime wrapping, not on the compiled expression.

```typescript
// Source: Extending src/views/supergrid/SuperGridQuery.ts
export interface SuperGridQueryConfig {
  colAxes: AxisMapping[];
  rowAxes: AxisMapping[];
  where: string;
  params: unknown[];
  /** Phase 22 — if set and a time-field axis is present, rewrites GROUP BY via strftime */
  granularity?: TimeGranularity | null;
}

// In buildSuperGridQuery: validate raw field first, then wrap if time field + granularity set
function isTimeField(field: string): boolean {
  return field === 'created_at' || field === 'modified_at' || field === 'due_at';
}

function compileAxisExpr(axis: AxisMapping, granularity: TimeGranularity | null): string {
  if (granularity && isTimeField(axis.field)) {
    return STRFTIME_PATTERNS[granularity](axis.field);
  }
  return axis.field;
}
```

### Pattern 4: Hide-Empty Filter on _lastCells (Client-Side)

**What:** Before calling `buildHeaderCells`, filter out row values and column values where every matching cell has `count === 0`. This happens in `_renderCells()` on the local `_lastCells` cache — no Worker re-query.

**When to use:** Any time `hideEmpty` is true, filter axis values before passing to `buildHeaderCells`.

```typescript
// Source: SuperGrid._renderCells() adaptation
function filterEmptyAxes(
  cells: CellDatum[],
  colValues: string[],
  rowValues: string[],
  colField: string,
  rowField: string
): { filteredColValues: string[]; filteredRowValues: string[] } {
  const nonEmptyColValues = colValues.filter(colVal =>
    cells.some(c => String(c[colField] ?? 'unknown') === colVal && c.count > 0)
  );
  const nonEmptyRowValues = rowValues.filter(rowVal =>
    cells.some(c => String(c[rowField] ?? 'None') === rowVal && c.count > 0)
  );
  return { filteredColValues: nonEmptyColValues, filteredRowValues: nonEmptyRowValues };
}
```

### Pattern 5: D3 Enter+Update Fix (DENS-06 — Critical)

**What:** The current `.join()` has `update => update` as the update callback. This means existing DOM elements are NOT repositioned when the grid layout changes after density collapse. The fix moves all per-element setup into a shared `.each()` that runs on BOTH enter and update selections.

**Why it happens:** D3's `.join(enter, update, exit)` only runs the update callback on elements that survived the key match. If the layout changes (fewer columns), survived elements need their `gridColumn`/`gridRow` re-set. The current identity callback skips this entirely.

```typescript
// Source: SuperGrid._renderCells() current code (line ~767)
// CURRENT (broken on density collapse):
gridSelection
  .selectAll<HTMLDivElement, CellPlacement>('.data-cell')
  .data(cellPlacements, d => `${d.rowKey}:${d.colKey}`)
  .join(
    enter => enter.append('div').attr('class', 'data-cell'),
    update => update,        // ← BUG: no position re-set
    exit => exit.remove()
  )
  .each(function(d) { ... el.style.gridColumn = ...; el.style.gridRow = ...; })

// FIXED (DENS-06 compliant):
// The .each() after .join() runs on both enter + update, so position IS re-applied.
// Current code already does this correctly IF the .each() is chained after .join()!
// Verify the chained .each() fires for the update case in tests.
```

**Critical verification:** The current SuperGrid.ts code (line ~767-828) chains `.each()` AFTER `.join()`. This means the `.each()` callback receives both entered AND updated elements. This is the correct D3 pattern. However, the test must verify that update-path elements get repositioned. If tests confirm this, DENS-06 may already be partially satisfied — but explicit testing is required.

### Pattern 6: Matrix Mode Heat Map (DENS-03)

**What:** In matrix mode, cell background color scales with count. Use `d3.scaleSequential` with a blue interpolator. Max count across all cells determines the domain upper bound.

```typescript
// Source: D3 v7 color scale API (verified in project — d3 ^7.9.0 includes d3-scale-chromatic)
const maxCount = Math.max(...cellPlacements.map(c => c.count), 1);
const colorScale = d3.scaleSequential()
  .domain([0, maxCount])
  .interpolator(d3.interpolateBlues);

// In .each():
if (densityState.viewMode === 'matrix') {
  el.style.backgroundColor = d.count === 0 ? 'rgba(255,255,255,0.02)' : colorScale(d.count);
  el.innerHTML = d.count > 0 ? `<span class="count-badge">${d.count}</span>` : '';
}
```

### Pattern 7: Spreadsheet Mode Card Pills (DENS-03)

**What:** In spreadsheet mode, each data cell renders card pills (name + type icon) using D3-joined child elements. Cards come from `_lastCells` via `card_ids` lookup.

**Constraint:** Cards are already in `CellDatum.card_ids` (string array). The Worker already returns them. No additional Worker query needed. Card detail fields (name, card_type) are NOT in CellDatum — they are in `_lastCards` or need a separate lookup.

**Critical gap:** `CellDatum` only carries `card_ids` (string IDs), not card names or types. SuperGrid currently does not maintain a `_lastCards` lookup map. For spreadsheet mode, names must come from somewhere. Options:
1. Extend `CellDatum` to carry `card_names` (another GROUP_CONCAT) — requires Worker change
2. Maintain a `_cardNameMap: Map<string, {name: string, card_type: string}>` in SuperGrid populated on each fetch
3. Use `card_ids` count only in spreadsheet mode (same as matrix but with different visual treatment)

**Decision needed (Claude's discretion):** The CONTEXT.md specifies "card pills showing name + type icon per card in each cell." This requires card name data. Option 2 (maintain a card name lookup map on each `_fetchAndRender`) is the cleanest approach without changing the Worker protocol.

### Anti-Patterns to Avoid

- **Validating strftime expressions in allowlist:** The allowlist validates raw field names (e.g., `created_at`). Never pass a compiled strftime expression through `validateAxisField` — it will throw. Validate the raw field first, then compile.
- **Re-querying Worker for hide-empty / view mode changes:** These are pure client-side transforms on `_lastCells`. Triggering a Worker re-query wastes 50-100ms and may cause flash.
- **Registering SuperDensityProvider with StateCoordinator before it's ready:** Must be registered the same way FilterProvider and PAFVProvider are — not as a subscriber, but as a publisher. StateCoordinator triggers SuperGrid re-render when SuperDensityProvider notifies.
- **Calling `buildHeaderCells` with unfiltered axis values when hideEmpty is on:** The filtering must happen BEFORE `buildHeaderCells` — the header builder expects a clean list of visible axis values.
- **CellDatum key collision on strftime rewrites:** When granularity collapses `created_at` from day to month, multiple day-level cells map to one month key. The SQL GROUP BY handles this (one row per month), but the D3 key function `d => '${d.rowKey}:${d.colKey}'` must work with the new strftime-based key values. The rowKey/colKey values come directly from CellDatum fields — they will be the strftime-formatted strings (e.g., `"2026-01"` not `"2026-01-15"`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| strftime GROUP BY SQL | Custom date truncation in JS | SQLite strftime() via DensityProvider.STRFTIME_PATTERNS | Already implemented, tested, handles quarter edge case |
| Heat map color scale | Manual RGB lerp | d3.scaleSequential + d3.interpolateBlues | Perceptually uniform, handles edge cases, already in d3 bundle |
| D3 enter/update/exit merge | Separate DOM manipulation | D3 `.join()` with chained `.each()` | Already used; chained .each() fires on both enter and update |
| Tier 2 persistence | Custom localStorage | PersistableProvider pattern + StateManager | Already used by DensityProvider, FilterProvider, PAFVProvider |
| Subscriber batching | Manual debounce | queueMicrotask pattern | Already in every provider; prevents double-render on multi-field updates |

**Key insight:** The hard problems (SQL safety, GROUP BY compilation, header spanning, D3 data join, persistence) are all solved. Phase 22 assembles existing solutions into a new density layer.

---

## Common Pitfalls

### Pitfall 1: The D3 Update Callback Gap (DENS-06)

**What goes wrong:** After density collapse, some cells survive the D3 key match (same `rowKey:colKey`). Their `gridColumn`/`gridRow` styles reflect the old layout. The new layout has fewer columns, so they appear misaligned.

**Why it happens:** `update => update` passes survived elements through without re-setting position styles. The outer `.each()` DOES run on update-path elements (because it is chained after `.join()`), so the current code may already be correct. But this must be verified with a test that:
1. Renders a 3×3 grid
2. Enables hide-empty (reducing to 2×2)
3. Asserts that survived cells have updated `gridColumn`/`gridRow` values

**How to avoid:** Write the test first (DENS-06 TDD). If it passes with the current code, document that the chained `.each()` pattern already handles this. If it fails, the update callback needs `update => update.each(applyPosition)` explicitly.

**Warning signs:** Visual regression where header cells and data cells in the same column have different `gridColumn` values after density change.

### Pitfall 2: strftime Rewrite Breaks Allowlist Validation

**What goes wrong:** `validateAxisField('strftime(\'%Y-%m\', created_at)')` throws "SQL safety violation" — the allowlist only recognizes raw column names.

**Why it happens:** If the strftime wrapping happens before allowlist validation in `buildSuperGridQuery`, the compiled expression is passed to `validateAxisField` which rejects it.

**How to avoid:** Validate the raw `axis.field` value first, then apply the strftime wrapping. The `compileAxisExpr` helper should be called AFTER `validateAxisField(axis.field)`.

**Warning signs:** Tests for granularity-enabled queries throw "SQL safety violation" errors.

### Pitfall 3: Row/Column Key Mismatch After Granularity Change

**What goes wrong:** `_lastCells` from a previous granularity (day-level keys like `"2026-01-15"`) is used by a hide-empty or mode-switch re-render while the new query (month-level keys like `"2026-01"`) is in flight. The old cell placements reference wrong rowKey/colKey values.

**Why it happens:** Client-side density changes (hide-empty, view mode) re-render from `_lastCells` without a Worker round-trip. But if granularity just changed, `_lastCells` has stale day-level keys.

**How to avoid:** Granularity change MUST always go through `_fetchAndRender()` (full Worker re-query), never the client-side path. Clear `_lastCells` or skip the client-side re-render path when `densityState.axisGranularity` changes. The hybrid strategy in CONTEXT.md locked decisions enforces this correctly.

**Warning signs:** Empty grid or mismatched cells after granularity change followed immediately by hide-empty toggle.

### Pitfall 4: Card Name Lookup for Spreadsheet Mode

**What goes wrong:** Spreadsheet mode pills need card names, but `CellDatum` only has `card_ids: string[]`. SuperGrid has no lookup table for card names.

**Why it happens:** The Worker query returns aggregated cell data (GROUP BY result), not individual card rows. Card names are in the cards table.

**How to avoid:** Build a `_cardNameMap: Map<string, {name: string, card_type: CardType}>` in `_fetchAndRender()` after the supergrid:query resolves. Populate it from the `_lastCells` data only — but `CellDatum` doesn't have names. This requires either:
- A second Worker query (`card:list` or `db:query`) to fetch names for all `card_ids` in the result
- Or adding name/card_type to the GROUP_CONCAT in the SQL query (more complex)

**Simplest approach:** Use `db:query` with `SELECT id, name, card_type FROM cards WHERE id IN (...)` after the supergrid:query resolves. Store result in `_cardNameMap`. Only fetch when `viewMode === 'spreadsheet'`. This adds one Worker round-trip only in spreadsheet mode.

**Warning signs:** Spreadsheet cells show IDs instead of card names; TypeScript error on CellDatum name access.

### Pitfall 5: Hidden Axis Indicator Disappears on Destroy

**What goes wrong:** The "+3 hidden" badge DOM element is appended to `_rootEl` but `destroy()` doesn't clean it up because it's not tracked in a class field.

**How to avoid:** Store the hidden-indicator element as `_hiddenIndicatorEl: HTMLDivElement | null`. Remove it in `destroy()` alongside `_badgeEl` cleanup.

---

## Code Examples

### SuperDensityProvider (full pattern)

```typescript
// Source: Modeled on src/providers/DensityProvider.ts

import type { PersistableProvider } from './types';
import type { TimeGranularity } from './types';

export type ViewMode = 'spreadsheet' | 'matrix';

export interface SuperDensityState {
  axisGranularity: TimeGranularity | null;
  hideEmpty: boolean;
  viewMode: ViewMode;
  regionConfig: null; // DENS-04 stub
}

const DEFAULT_STATE: SuperDensityState = {
  axisGranularity: null,
  hideEmpty: false,
  viewMode: 'spreadsheet',
  regionConfig: null,
};

export class SuperDensityProvider implements PersistableProvider {
  private _state: SuperDensityState = { ...DEFAULT_STATE };
  private readonly _subscribers = new Set<() => void>();
  private _pendingNotify = false;

  getState(): Readonly<SuperDensityState> {
    return { ...this._state };
  }

  setGranularity(g: TimeGranularity | null): void {
    this._state.axisGranularity = g;
    this._scheduleNotify();
  }

  setHideEmpty(hide: boolean): void {
    this._state.hideEmpty = hide;
    this._scheduleNotify();
  }

  setViewMode(mode: ViewMode): void {
    this._state.viewMode = mode;
    this._scheduleNotify();
  }

  subscribe(cb: () => void): () => void {
    this._subscribers.add(cb);
    return () => this._subscribers.delete(cb);
  }

  private _scheduleNotify(): void {
    if (this._pendingNotify) return;
    this._pendingNotify = true;
    queueMicrotask(() => {
      this._pendingNotify = false;
      this._subscribers.forEach(cb => cb());
    });
  }

  toJSON(): string {
    return JSON.stringify(this._state);
  }

  setState(state: unknown): void {
    // validate shape, then assign
    if (!isSuperDensityState(state)) {
      throw new Error('[SuperDensityProvider] setState: invalid state shape');
    }
    this._state = { ...state };
  }

  resetToDefaults(): void {
    this._state = { ...DEFAULT_STATE };
  }
}
```

### Extended buildSuperGridQuery with granularity

```typescript
// Source: Extension of src/views/supergrid/SuperGridQuery.ts

const ALLOWED_TIME_FIELDS = new Set(['created_at', 'modified_at', 'due_at']);

const STRFTIME_PATTERNS: Record<string, (field: string) => string> = {
  day:     field => `strftime('%Y-%m-%d', ${field})`,
  week:    field => `strftime('%Y-W%W', ${field})`,
  month:   field => `strftime('%Y-%m', ${field})`,
  quarter: field => `strftime('%Y', ${field}) || '-Q' || ((CAST(strftime('%m', ${field}) AS INT) - 1) / 3 + 1)`,
  year:    field => `strftime('%Y', ${field})`,
};

function compileAxisSelect(axis: AxisMapping, granularity: string | null): string {
  // validateAxisField(axis.field) MUST be called BEFORE this function
  if (granularity && ALLOWED_TIME_FIELDS.has(axis.field)) {
    const pattern = STRFTIME_PATTERNS[granularity];
    if (pattern) return pattern(axis.field);
  }
  return axis.field;
}
```

### D3 Join with Correct Enter+Update Position Setting

```typescript
// Source: SuperGrid._renderCells() fix for DENS-06
// The key insight: chained .each() after .join() fires on BOTH enter and update elements

const applyPosition = function(this: HTMLDivElement, d: CellPlacement): void {
  const el = this;
  const colStart = colValueToStart.get(d.colKey) ?? 1;
  const rowIdx = visibleRowCells.findIndex(c => c.value === d.rowKey);
  const gridRow = colHeaderLevels + rowIdx + 1;
  el.style.gridColumn = `${colStart + 1}`;
  el.style.gridRow = `${gridRow}`;
};

gridSelection
  .selectAll<HTMLDivElement, CellPlacement>('.data-cell')
  .data(cellPlacements, d => `${d.rowKey}:${d.colKey}`)
  .join(
    enter => enter.append('div').attr('class', 'data-cell'),
    update => update,
    exit => exit.remove()
  )
  .each(applyPosition)  // ← runs on BOTH enter and update
  .each(function(d) {
    // ... content rendering (count badge or card pills)
  });
```

### Hide-Empty Filter (client-side)

```typescript
// Source: SuperGrid._renderCells() adaptation
function filterEmptyAxes(
  cells: CellDatum[],
  colValues: string[],
  rowValues: string[],
  colField: string,
  rowField: string
): { filteredCols: string[]; filteredRows: string[]; hiddenColCount: number; hiddenRowCount: number } {
  const filteredCols = colValues.filter(cv =>
    cells.some(c => String(c[colField] ?? 'unknown') === cv && c.count > 0)
  );
  const filteredRows = rowValues.filter(rv =>
    cells.some(c => String(c[rowField] ?? 'None') === rv && c.count > 0)
  );
  return {
    filteredCols,
    filteredRows,
    hiddenColCount: colValues.length - filteredCols.length,
    hiddenRowCount: rowValues.length - filteredRows.length,
  };
}
```

### Heat Map Color Scale

```typescript
// Source: D3 v7 API — d3.scaleSequential + d3.interpolateBlues
// Both are included in the d3 ^7.9.0 bundle already in package.json

import * as d3 from 'd3';

// In _renderCells(), when viewMode === 'matrix':
const maxCount = Math.max(...cellPlacements.map(c => c.count), 1);
const heatColor = d3.scaleSequential()
  .domain([0, maxCount])
  .interpolator(d3.interpolateBlues);

// In .each():
el.style.backgroundColor = d.count === 0
  ? 'rgba(255,255,255,0.02)'
  : heatColor(d.count);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global density in DensityProvider | SuperDensityProvider separate from DensityProvider | Phase 22 | Avoids polluting Calendar/Timeline density state; SuperGrid gets its own density scope |
| All data in CellDatum from Worker | Hybrid: Worker aggregates, client enriches for display | Phase 22 | Card names for spreadsheet mode require secondary lookup or SQL extension |
| Empty cells shown with dim background | Entire empty rows/columns removed from grid | Phase 22 | Changes colAxisValues and rowAxisValues arrays before buildHeaderCells call |

**Deprecated/outdated approaches not applicable to this phase.**

---

## Open Questions

1. **Card name lookup strategy for spreadsheet mode**
   - What we know: `CellDatum` has `card_ids: string[]` but not `name` or `card_type`
   - What's unclear: Whether to add a secondary `db:query` round-trip or extend the SQL GROUP_CONCAT
   - Recommendation: Use a secondary `db:query` after supergrid:query, scoped to card_ids present in the result. Only execute when `viewMode === 'spreadsheet'`. Cache in `_cardNameMap`. This is the lowest-risk approach — no Worker protocol changes.

2. **Granularity picker placement (Claude's discretion)**
   - What we know: It should only appear when a time field is assigned to an active axis
   - What's unclear: Toolbar vs sidebar vs inline in header; current UI has no density controls at all
   - Recommendation: Add a small toolbar area above the grid (sibling of `_rootEl`), separate from the grid scroll area, containing density controls. Use a `<select>` for granularity (day/week/month/quarter/year) and `<input type="checkbox">` for hide-empty and matrix/spreadsheet toggle.

3. **D3 chained .each() fires on update — verification needed**
   - What we know: D3 v7 `.join().each()` chain runs on both enter and update paths
   - What's unclear: Whether the jsdom test environment correctly propagates this for style setting
   - Recommendation: Write an explicit test that checks `gridColumn` is updated on density change before implementing anything else (TDD per DENS-06).

---

## Sources

### Primary (HIGH confidence)

- `src/providers/DensityProvider.ts` — STRFTIME_PATTERNS, PersistableProvider pattern, queueMicrotask batching
- `src/views/SuperGrid.ts` — _renderCells() D3 join (line 760-831), _fetchAndRender() pipeline, _lastCells pattern
- `src/views/supergrid/SuperStackHeader.ts` — buildHeaderCells signature, collapsedSet input contract
- `src/views/supergrid/SuperGridQuery.ts` — buildSuperGridQuery, validateAxisField usage
- `src/worker/protocol.ts` — CellDatum shape, SuperGridQueryConfig type
- `src/views/types.ts` — SuperGridProviderLike, SuperGridDensityLike pattern to follow
- `.planning/phases/22-superdensity/22-CONTEXT.md` — locked decisions, all implementation choices

### Secondary (MEDIUM confidence)

- D3 v7 join/each behavior: chained `.each()` after `.join()` runs on merged enter+update selection — standard D3 v5+ behavior, consistent with D3 v7 docs
- SQLite strftime() GROUP BY: established pattern in existing DensityProvider, verified working in project

### Tertiary (LOW confidence)

- Specific heat map color interpolator choice (d3.interpolateBlues vs alternatives) — aesthetic decision, verify with user or default to Blues

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in project
- Architecture: HIGH — modeled directly on existing provider patterns (DensityProvider, SuperGridProviderLike)
- Pitfalls: HIGH — identified from direct code inspection (DENS-06 D3 update gap, allowlist/strftime ordering, card name gap)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable stack — no fast-moving dependencies)
