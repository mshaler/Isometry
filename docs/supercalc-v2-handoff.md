# SuperCalc v2: Null Handling + Filter Scope

**Milestone:** v8.2 (post-Plugin Registry Complete)
**Phase:** TBD — schedule after Phase 102 (Plugin Registry Complete) ships
**Target file:** `.planning/milestones/vX.X-phases/NNN-supercalc-v2/NNN-01-PLAN.md`
**Author:** Claude (architecture/review instance)
**Date:** 2026-03-21
**Revision:** 2 — addresses review feedback (Q1–Q3, R1–R6)

---

## Problem Statement

SuperCalc shipped in Phase 100 with correct aggregate mechanics (`computeAggregate`, `AggFunction`, shared `calcConfig` Map, per-column dropdowns). The implementation makes one implicit assumption that is correct for clean data but wrong in practice: **null values are handled silently by SQLite defaults, and aggregation always runs over the full dataset regardless of what the user is currently viewing.**

Two explicit design decisions are needed before SuperCalc is production-ready:

1. **Null handling mode** — how nulls participate in each aggregate function
2. **Aggregation scope** — whether aggregates reflect the active filtered view or the full dataset

Both are user-configurable. **Config is ephemeral** — constructed fresh per session in `registerAllPlugins()`, matching the existing pattern for all plugin shared state (density, zoom, sort). Persistence is out of scope for v2; if needed later, it follows the established `ui_state` key convention (`calc:nullMode:{colIdx}`, `calc:scope`, etc.) as a separate enhancement.

---

## Background: Why These Decisions Matter

### Null Handling

SQLite's default behavior for aggregates over sparse columns:

| Function | SQLite default | What Brenda expects |
|----------|---------------|---------------------|
| `AVG` | mean of non-null rows only | often mean of ALL rows (nulls = 0) |
| `SUM` | sum of non-null rows (nulls = 0) | usually correct |
| `COUNT` | count of non-null rows | often total row count |
| `MIN`/`MAX` | ignores nulls | usually correct |

SQLite's default is statistically defensible but not intuitively obvious. A column with 10 rows where 7 have values: SQLite `AVG` returns the mean of 7. Brenda likely expects the mean of 10.

### SUM: Why `'exclude'` and `'zero'` Produce the Same Number

For SUM specifically, both null modes yield identical numeric results — `SUM([10, null, 30], 'exclude')` and `SUM([10, null, 30], 'zero')` both return 40. The distinction is **semantic, not arithmetic**: `'exclude'` means "sum of the 2 values that exist" while `'zero'` means "sum of 3 values where missing entries count as 0." This matters if we ever add a denominator label (e.g., "sum 40 (n=2)" vs "sum 40 (n=3)"), but for now the outputs are identical by design. No special-casing needed.

### Aggregation Scope

SuperFilter and hide-empty both affect which rows are visible. If SuperCalc ignores active filters, the footer numbers will not match what the user sees — a cardinal UX sin for a spreadsheet-like tool. However, there are legitimate cases where a user wants a "grand total" that is pinned to the full dataset regardless of filters (the Excel `SUM` vs `SUBTOTAL` distinction).

### Scope Pipeline Finding (Resolved)

**Investigated:** `PivotGrid.render()` (lines 216-235) builds `visibleRows` and `visibleCols` *after* the hide-empty filter, then passes them into `afterRender`'s `ctx`. Meanwhile `ctx.data` is the full unfiltered `Map<string, number | null>`.

The SuperCalcFooter plugin (line 134) iterates `ctx.visibleRows` to collect column values — so **`scope: 'view'` already works with no code changes**. The footer naturally reads only visible rows.

For `scope: 'all'`, the footer needs the pre-filter row combinations. The fix: add `allRows: string[][]` to `RenderContext` in `PluginTypes.ts`, populated by `PivotGrid` before the hide-empty filter runs. This is a render-pipeline concern (not a config concern), so it belongs on `RenderContext`, not on `CalcConfig`.

---

## Design Decisions

### Decision 1: Null Handling Modes

Three explicit modes, per-column, user-configurable:

| Mode | ID | Behavior | When to use |
|------|----|----------|-------------|
| **Exclude nulls** | `'exclude'` | SQLite/JS default: operate only on non-null values | "Average deal size among deals that have a value" |
| **Nulls as zero** | `'zero'` | Substitute 0 for every null before computing | "Average revenue per account, including accounts with no revenue yet" |
| **Strict** | `'strict'` | Return null result + visual warning indicator if ANY null present | "I want to know when my data is incomplete before I trust this number" |

**Default:** `'exclude'` (preserves current behavior, no regression).

### Decision 2: Aggregation Scope

Two explicit modes, **global** (not per-column — scope is a property of the view, not of individual columns):

| Mode | ID | Behavior | Analogy |
|------|----|----------|---------|
| **Filter-aware** | `'view'` | Aggregate over currently visible rows only (respects SuperFilter, hide-empty) | Excel `SUBTOTAL` |
| **Full dataset** | `'all'` | Aggregate over all rows regardless of active filters | Excel `SUM` |

**Default:** `'view'` (filter-aware). This is the correct default — aggregates should match what the user sees.

A global scope toggle (not per-column) renders in the SuperCalc config sidebar section as a radio group or toggle, clearly labeled.

### Decision 3: COUNT semantics

`COUNT` exposes a secondary choice that must be explicit in the UI:

| Sub-mode | Behavior |
|----------|----------|
| `COUNT(column)` | Count of non-null values in this column (current behavior) |
| `COUNT(*)` | Count of all rows (regardless of null in this column) |

This sub-mode only appears in the config sidebar when the column's `AggFunction` is `COUNT`. Default: `COUNT(column)` (preserves current behavior).

**Interaction with `nullMode: 'zero'`:** When `nullMode` is `'zero'` and `countMode` is `'column'`, COUNT still returns the count of *originally* non-null values. Zero-substitution is a computation transform, not a data mutation — it does not retroactively make nulls "real." The UI tooltip for the count-mode selector should read: "Non-null values (original data)" to make this unambiguous.

---

## Implementation Scope

This is an **enhancement to existing files only**. No new plugin files needed. The surface area is:

- `src/views/pivot/plugins/SuperCalcFooter.ts` — extend `computeAggregate` signature + logic
- `src/views/pivot/plugins/SuperCalcConfig.ts` — add null-mode dropdowns + scope toggle to sidebar
- `src/views/pivot/plugins/PluginTypes.ts` — add `allRows: string[][]` to `RenderContext`
- `src/views/pivot/PivotGrid.ts` — populate `ctx.allRows` before hide-empty filter
- `src/views/pivot/plugins/FeatureCatalog.ts` — update `calcConfig` construction in `registerAllPlugins()`
- `tests/views/pivot/SuperCalc.test.ts` — extend existing test file

**Note:** The `calcConfig` shared object is constructed in `registerAllPlugins()` inside `FeatureCatalog.ts` (line 356), NOT in `HarnessShell.ts`. All wiring changes target FeatureCatalog.

---

## Work Area 1: Extend Type Definitions

### File: `src/views/pivot/plugins/SuperCalcFooter.ts` — new types

```typescript
export type NullMode = 'exclude' | 'zero' | 'strict';
export type CountMode = 'column' | 'all';
export type ScopeMode = 'view' | 'all';

export interface ColCalcConfig {
  fn: AggFunction;        // existing
  nullMode: NullMode;     // NEW — default: 'exclude'
  countMode: CountMode;   // NEW — only relevant when fn === 'COUNT', default: 'column'
}

export interface CalcConfig {
  cols: Map<number, ColCalcConfig>;
  scope: ScopeMode;       // NEW — global, default: 'view'
}
```

### File: `src/views/pivot/plugins/PluginTypes.ts` — extend RenderContext

```typescript
export interface RenderContext {
  // ... existing fields ...
  /** All row combinations before hide-empty filtering. Used by SuperCalc scope: 'all'. */
  allRows: string[][];
}
```

### File: `src/views/pivot/PivotGrid.ts` — populate allRows

In `render()`, capture `rowCombinations` before the hide-empty filter and pass it through `ctx.allRows`:

```typescript
// Line ~216: capture before filter
const allRows = rowCombinations;

// Line ~271: add to ctx
const ctx = {
  // ... existing fields ...
  allRows,
};
```

Extend `createSuperCalcFooterPlugin` and `createSuperCalcConfigPlugin` signatures to accept `CalcConfig` (replacing the current `{ aggFunctions: Map<number, AggFunction> }` shape).

**Migration note:** The existing `aggFunctions` Map only stored `AggFunction`. The new `cols` Map stores `ColCalcConfig`. FeatureCatalog initializes each entry as `{ fn: 'SUM', nullMode: 'exclude', countMode: 'column' }`.

---

## Work Area 2: Extend computeAggregate

**File:** `src/views/pivot/plugins/SuperCalcFooter.ts`

### New signature

```typescript
export interface AggResult {
  value: number | null;
  warning?: 'incomplete-data';
}

export function computeAggregate(
  fn: AggFunction,
  values: (number | null)[],
  nullMode: NullMode,
  countMode: CountMode,
): AggResult
```

Return type is a structured object instead of a union sentinel. This avoids three-way type narrowing (`typeof result === 'string'`) at every call site. Callers check `result.warning` when they care about strict mode, and always read `result.value` for the number.

When `nullMode === 'strict'` and nulls are present: `{ value: null, warning: 'incomplete-data' }`.

### Semantics by mode

**`nullMode: 'exclude'`** (existing behavior, no change):
- `SUM`: sum of non-nulls, nulls treated as 0. Empty array -> `{ value: null }`.
- `AVG`: mean of non-nulls only. No non-nulls -> `{ value: null }`.
- `COUNT(column)`: count of non-nulls. `COUNT(*)`: `values.length`.
- `MIN`/`MAX`: of non-nulls. No non-nulls -> `{ value: null }`.
- `NONE`: `{ value: null }`.

**`nullMode: 'zero'`**:
- Before computing, substitute 0 for every null in the values array.
- `AVG` now divides by `values.length` (total rows), not by non-null count.
- `COUNT(column)` still counts *originally* non-null values (zero-substitution is a computation transform, not a data rewrite).
- `MIN`/`MAX` now include 0 as a candidate value.
- Empty array -> `{ value: null }` for all functions.

**`nullMode: 'strict'`**:
- If `values` contains ANY null: return `{ value: null, warning: 'incomplete-data' }` immediately, regardless of function.
- If no nulls present: compute as if `nullMode === 'exclude'` (nulls absent, all values are non-null). Return `{ value: <number> }` with no warning.

### Test requirements (extend existing `SuperCalc.test.ts`)

```
// nullMode: 'zero'
computeAggregate('AVG', [10, null, null], 'zero', 'column').value ~= 3.33
computeAggregate('SUM', [10, null, 30], 'zero', 'column').value === 40
computeAggregate('MIN', [10, null, 30], 'zero', 'column').value === 0
computeAggregate('AVG', [10, null, 30], 'zero', 'column').value ~= 13.33  // 40/3, not 40/2

// nullMode: 'strict'
computeAggregate('SUM', [10, null, 30], 'strict', 'column').value === null
computeAggregate('SUM', [10, null, 30], 'strict', 'column').warning === 'incomplete-data'
computeAggregate('SUM', [10, 20, 30], 'strict', 'column').value === 60  // no nulls -> normal
computeAggregate('SUM', [10, 20, 30], 'strict', 'column').warning === undefined

// countMode: 'all'
computeAggregate('COUNT', [10, null, 30], 'exclude', 'all').value === 3  // total rows
computeAggregate('COUNT', [10, null, 30], 'exclude', 'column').value === 2  // non-null only

// countMode: 'all' with nullMode: 'zero' — COUNT(column) still counts originals
computeAggregate('COUNT', [10, null, 30], 'zero', 'column').value === 2  // NOT 3

// edge cases preserved from prior tests (must not regress)
computeAggregate('SUM', [], 'exclude', 'column').value === null
computeAggregate('COUNT', [], 'exclude', 'column').value === 0
```

---

## Work Area 3: Scope Switching in afterRender

**File:** `src/views/pivot/plugins/SuperCalcFooter.ts`

**This is a resolved question, not a known unknown.**

`PivotGrid.render()` builds `visibleRows` after the hide-empty filter and passes it through `ctx.visibleRows`. The full unfiltered data Map is `ctx.data`. After Work Area 1, `ctx.allRows` carries the pre-filter row combinations.

SuperCalcFooter's `afterRender` reads `calcConfig.scope` to choose which row set to iterate:

```typescript
const rows = calcConfig.scope === 'all' ? ctx.allRows : ctx.visibleRows;

const columnValues: (number | null)[] = rows.map((rowPath) => {
  const key = `${rowPath.join('|')}::${colPath.join('|')}`;
  return data.get(key) ?? null;
});
```

No other changes needed. The data Map already contains all rows; only the iteration key set changes.

---

## Work Area 4: UI — Null Mode + Scope Controls

**File:** `src/views/pivot/plugins/SuperCalcConfig.ts`

### Per-column null mode selector

Add a second `<select>` element per column row in `.hns-calc-config`, beside the existing aggregate function selector:

```
[Column name truncated]   [SUM v]   [Exclude nulls v]
```

Options:
- `Exclude nulls` (value: `'exclude'`)
- `Nulls as zero` (value: `'zero'`)
- `Strict` (value: `'strict'`)

Only show null mode selector when `fn !== 'NONE'` (no point configuring null handling if the function is disabled).

### COUNT sub-mode selector

When a column's `fn === 'COUNT'`, add a third `<select>`:

```
[Column name]   [COUNT v]   [Exclude nulls v]   [Non-null values v]
```

Options:
- `Non-null values (original data)` (value: `'column'`) — maps to `COUNT(column)`
- `All rows` (value: `'all'`) — maps to `COUNT(*)`

Hide this selector when `fn !== 'COUNT'`.

### Global scope toggle

Add a section header above the per-column rows:

```
Aggregation scope
(o) Current view (respects filters)   ( ) All data
```

Rendered as a `<fieldset>` with two radio inputs or a single toggle button. Updates `calcConfig.scope` and calls `onConfigChange?.()`.

### Visual indicator for strict-warning

Add a `WARNING_GLYPH` constant alongside the existing `GLYPHS` record in `SuperCalcFooter.ts`:

```typescript
const WARNING_GLYPH = '\u26A0'; // warning sign

const GLYPHS: Record<AggFunction, string> = {
  SUM: '\u2211',   // summation
  AVG: 'x\u0304',  // x-bar
  COUNT: '#',
  MIN: '\u2193',   // down arrow
  MAX: '\u2191',   // up arrow
  NONE: '',
};
```

In `SuperCalcFooter.afterRender`, when `result.warning === 'incomplete-data'`:
- Cell displays `WARNING_GLYPH` in `var(--pv-warning-fg)` color
- Cell background: `var(--pv-warning-bg)` (subtle yellow/orange tint)
- Tooltip (via `title` attribute): `"Column contains empty values — switch to Exclude or Zero mode for a result"`

---

## Work Area 5: FeatureCatalog wiring update

**File:** `src/views/pivot/plugins/FeatureCatalog.ts`

Update `calcConfig` construction in `registerAllPlugins()` (line ~356):

```typescript
const calcConfig: CalcConfig = {
  cols: new Map<number, ColCalcConfig>(),
  scope: 'view',  // filter-aware default
};

// Factories read calcConfig.cols with lazy init:
// footer calls getColConfig(colIdx) which defaults to { fn: 'SUM', nullMode: 'exclude', countMode: 'column' }

registry.setFactory('supercalc.footer', () =>
  createSuperCalcFooterPlugin(calcConfig),
);
registry.setFactory('supercalc.config', () =>
  createSuperCalcConfigPlugin(calcConfig, () => registry.notifyChange()),
);
```

The `getColConfig` helper can live in `SuperCalcFooter.ts` as an exported utility or be inlined in each plugin — executor's choice.

---

## Execution Order

1. Work Area 1 (types + RenderContext + PivotGrid) — must land first, everything depends on it
2. Work Area 2 (computeAggregate) — pure function, no DOM dependency, TDD-friendly
3. Work Area 3 (scope switching) — trivial now that ctx.allRows exists; one conditional
4. Work Area 5 (FeatureCatalog wiring) — depends on 1 for CalcConfig shape
5. Work Area 4 (UI controls) — depends on 1 + 2 for types and semantics, and 5 for wiring

Areas 2 and 3 can land in one commit (logic changes). Areas 4 and 5 can land together (wiring + UI).

---

## Regression Requirements

These existing behaviors must not change:

| Behavior | Assertion |
|----------|-----------|
| `computeAggregate('SUM', [10, 20, 30], 'exclude', 'column').value` | `=== 60` |
| `computeAggregate('AVG', [10, 20, 30], 'exclude', 'column').value` | `=== 20` |
| `computeAggregate('COUNT', [10, null, 30], 'exclude', 'column').value` | `=== 2` |
| `computeAggregate('MIN', [10, 20, 30], 'exclude', 'column').value` | `=== 10` |
| `computeAggregate('MAX', [10, 20, 30], 'exclude', 'column').value` | `=== 30` |
| `computeAggregate('NONE', [10, 20], 'exclude', 'column').value` | `=== null` |
| `computeAggregate('SUM', [], 'exclude', 'column').value` | `=== null` |
| `computeAggregate('COUNT', [], 'exclude', 'column').value` | `=== 0` |
| Default null mode for new columns | `'exclude'` |
| Default scope | `'view'` |
| Stub count in FeatureCatalogCompleteness.test.ts | unchanged (15) |

Run `npx vitest run tests/views/pivot/` to confirm all existing pivot tests still pass after changes.

---

## Success Criteria Checklist

- [ ] `NullMode`, `CountMode`, `ScopeMode`, `ColCalcConfig`, `CalcConfig`, `AggResult` types exported from SuperCalcFooter.ts
- [ ] `computeAggregate` returns `AggResult` object (not union sentinel)
- [ ] `nullMode: 'zero'` substitutes 0 for nulls before computing
- [ ] `nullMode: 'strict'` returns `{ value: null, warning: 'incomplete-data' }` when nulls present
- [ ] `countMode: 'all'` returns total row count regardless of nulls
- [ ] `countMode: 'column'` with `nullMode: 'zero'` still counts original non-nulls (not substituted)
- [ ] `RenderContext.allRows` added to PluginTypes.ts and populated by PivotGrid.ts
- [ ] Scope toggle in sidebar updates `calcConfig.scope`
- [ ] Footer reads `ctx.allRows` when `scope: 'all'`, `ctx.visibleRows` when `scope: 'view'`
- [ ] `WARNING_GLYPH` constant centralized alongside `GLYPHS` record
- [ ] Warning cell renders with `var(--pv-warning-fg/bg)` tokens and tooltip
- [ ] Null mode `<select>` appears per column (hidden when fn === 'NONE')
- [ ] Count sub-mode `<select>` appears only when fn === 'COUNT'
- [ ] All existing pivot tests still pass (`npx vitest run tests/views/pivot/`)
- [ ] All new null-mode and count-mode tests pass
- [ ] No TypeScript errors (`npx tsc --noEmit`)

---

## Permanently Out of Scope

| Item | Reason |
|------|--------|
| SQL-backed aggregation (Worker query) | In-memory CellPlacement[] is correct for harness; SQL integration is a separate data source phase |
| Per-column scope override | Global scope is sufficient; per-column scope adds complexity with marginal value |
| Weighted averages | Not a Brenda use case at this stage |
| Error propagation to other cells | SuperCalc is a footer display only — no cell-referencing-cell |
| Circular reference detection | Not applicable at column-aggregation scope |
| Config persistence to `ui_state` | Ephemeral per-session config matches existing plugin pattern; persistence is a follow-up if needed |
| Discriminated union for `ColCalcConfig` when `fn === 'NONE'` | UI enforcement is sufficient; type-level discrimination adds complexity without preventing real bugs |
| Denominator labels (n=X) | Future enhancement if SUM exclude-vs-zero distinction needs visual differentiation |

---

## Review Feedback Incorporated (Rev 2)

| Feedback | Resolution |
|----------|------------|
| **Q1:** SUM identical under `'exclude'` and `'zero'` | Added "SUM: Why modes produce same number" section — semantic distinction documented, no special-casing |
| **Q2:** Persistence not specified | Explicitly stated ephemeral (matches existing plugin pattern), persistence path documented in out-of-scope |
| **Q3:** String sentinel return type | Changed to `AggResult { value, warning? }` structured object — eliminates three-way narrowing |
| **R1:** Scope was "known unknown" | Resolved via PivotGrid inspection — `ctx.allRows` on `RenderContext`, not `CalcConfig` |
| **R2:** Discriminated union for NONE | Documented as out-of-scope (UI enforcement sufficient) |
| **R3:** COUNT + zero interaction | Added explicit callout + tooltip wording: "Non-null values (original data)" |
| **R4:** Wrong file reference | Corrected: FeatureCatalog.ts `registerAllPlugins()` line ~356, not HarnessShell.ts |
| **R5:** Hardcoded warning glyph | Added `WARNING_GLYPH` constant alongside `GLYPHS` record |
| **R6:** Hardcoded 199 test count | Changed to "all existing pivot tests" — no pinned count |

---

*Handoff authored by Claude (architecture instance)*
*Rev 2: review feedback incorporated 2026-03-21*
*For CC execution — read PROJECT.md and STATE.md before starting*
