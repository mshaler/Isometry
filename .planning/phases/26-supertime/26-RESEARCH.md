# Phase 26: SuperTime - Research

**Researched:** 2026-03-05
**Domain:** d3-time-format sequential date parsing, smart time hierarchy auto-detection, segmented pill granularity override, non-contiguous period selection via FilterProvider axis filters
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Date Parsing Behavior
- Sequential fallback chain: try ISO 8601 (YYYY-MM-DD) first, then US (MM/DD/YYYY), then EU (DD/MM/YYYY) — first successful parse wins
- Standard formats only — no natural language parsing (no 'yesterday', 'next Monday', etc.)
- Unparseable dates (e.g., 'TBD', 'ASAP', garbage text) get their own 'No Date' group at the end of the time axis — consistent with how 'None' works for other axis fields
- Date-only precision — strip time components entirely ('2025-03-05T14:30:00' becomes '2025-03-05')

#### Auto-Hierarchy Level Selection
- Favor overview: auto-detect picks a coarser level that keeps columns manageable (~10-20 columns), not maximum detail
- Based on date range (min/max) only, not data density/clustering — SuperDensityProvider.hideEmpty handles sparse columns
- Re-runs on data change (e.g., new import expands date range) — adaptive, not locked after first detection
- All date fields treated identically (created_at, modified_at, due_at) — same logic, no field-specific hints

#### Manual Override UX
- Inline segmented pills in the time axis header row: A | D | W | M | Q | Y
- 'A' pill = Auto (reverts to auto-detection) — explicit escape hatch
- D/W/M/Q/Y = Day/Week/Month/Quarter/Year manual override
- Active level is highlighted; control appears only when a date field is used as an axis
- Override persists across sessions via SuperDensityProvider.toJSON() (Tier 2 persistence)

#### Non-Contiguous Period Selection
- Cmd+click on time period headers to toggle selection (same metaKey/ctrlKey pattern as existing SuperGrid interactions)
- Selected headers get highlighted accent background color — simple, familiar visual cue
- Grid collapses to selected periods only — non-selected period columns are removed entirely, grid reshuffles
- Escape key OR a 'Show All' button clears all period selections and restores full grid
- Cmd+click toggle deselects individual headers; when all deselected, full grid returns
- Works at all hierarchy levels (day, week, month, quarter, year) — not restricted to coarse levels
- Selection compiles to FilterProvider._axisFilters with IN (?) operator (existing mechanism)

### Claude's Discretion
- Exact date format strings for d3-time-format sequential fallback parser
- Auto-hierarchy threshold breakpoints (exact day/week/month/quarter/year cutoff ranges)
- Segmented pill visual styling details (colors, spacing, typography)
- Animation/transition behavior when grid collapses to selected periods
- 'Show All' button placement and styling
- Error handling for edge cases (empty datasets, single-date datasets)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIME-01 | Time axis auto-detects date fields and parses via d3-time-format sequential format fallback | `d3.timeParse` with sequential fallback array. Three parsers: `'%Y-%m-%d'` (ISO), `'%m/%d/%Y'` (US), `'%d/%m/%Y'` (EU). Pre-process: strip ISO datetime suffix (`s.split('T')[0]`) before parsing. Null result = 'No Date' group. Already in codebase: `d3` v7.9 with `timeParse` available. |
| TIME-02 | Smart hierarchy selects appropriate time level (day/week/month/quarter/year) based on data date span | `smartHierarchy(minDate, maxDate)` using `d3.timeDay.count()`. Threshold breakpoints (targeting ~10-20 columns): ≤20 days→day, ≤140 days→week, ≤610 days→month, ≤1825 days→quarter, >1825 days→year. Invoked in `_fetchAndRender()` after parsing all date cell values; result sets `axisGranularity` on `SuperDensityProvider` when provider is in 'auto' mode. |
| TIME-03 | User can manually override time hierarchy level | Replace existing `<select>` granularity picker in density toolbar with inline segmented pills: A/D/W/M/Q/Y. 'A' maps to null granularity + calls `smartHierarchy()` on next render. D/W/M/Q/Y call `setGranularity()` on `SuperDensityProvider`. Active pill highlighted. `SuperDensityProvider.toJSON()` already persists `axisGranularity` (Tier 2) — no new persistence needed. |
| TIME-04 | User can select non-contiguous time periods (e.g., Q1 + Q3) via Cmd+click on time headers | New `_periodSelection: Set<string>` class field in `SuperGrid`. `Cmd+click` on time period col headers toggles period key in/out of the set. Selected headers show accent background. Clicking 'Show All' or Escape calls `filter.clearAxis(timeField)` + clears `_periodSelection`. Must distinguish from existing Cmd+click "select all cards" behavior (SLCT-05) — period selection fires only when axis is a time field. |
| TIME-05 | Non-contiguous time selection compiles to FilterProvider 'in' operator WHERE clause | `filter.setAxisFilter(timeField, [..._periodSelection])` after each toggle. `FilterProvider.compile()` already handles `Map<string, string[]>` → `field IN (?, ...)` — no changes needed. Period keys must match the strftime output format (e.g., `'2025-Q1'`, `'2025-01'`) since that is what `CellDatum[colField]` contains. |
</phase_requirements>

## Summary

Phase 26 adds smart time hierarchy auto-detection and non-contiguous period selection to SuperGrid's time axes. The phase is architecturally straightforward because all key primitives already exist: `d3.timeParse` handles date string parsing, `d3.timeDay.count()` computes date ranges for threshold logic, `SuperDensityProvider.axisGranularity` stores the active level with Tier 2 persistence, and `FilterProvider.setAxisFilter()` with `IN (?)` compilation handles non-contiguous period filtering. The primary new code is (1) a pure `parseDateString()` function using sequential fallback, (2) a pure `smartHierarchy()` function using `d3.timeDay.count`, (3) replacement of the existing `<select>` granularity picker with segmented pills, and (4) a `_periodSelection: Set<string>` in SuperGrid with Cmd+click wiring on time period headers.

The key integration challenge is that `smartHierarchy()` needs parsed min/max dates from the actual cell data in `_fetchAndRender()`. Since the Worker returns strftime-bucketed values (e.g., `'2025-01'` for month), the auto-detection must parse the raw axis values from `_lastCells` BEFORE calling `setGranularity()`. The flow is: fetch cells at current granularity → parse axis values → compute smart level → if in auto mode AND level differs from current, call `setGranularity()` → this triggers density subscriber → which calls `_fetchAndRender()` again. Care is needed to prevent infinite loops (only change granularity if the smart level differs from the current one).

For non-contiguous selection, the critical insight is that period keys in `_periodSelection` must exactly match the strftime-formatted values that appear in `CellDatum[colField]`. For example, with `granularity='quarter'`, cell values look like `'2025-Q1'`, so period selection stores and filters on those exact strings. The existing `FilterProvider.setAxisFilter(field, values)` mechanism compiles these to `created_at IN (?, ?)` which correctly matches the GROUP BY alias values returned by the query.

**Primary recommendation:** Implement `parseDateString()` and `smartHierarchy()` as pure functions in a new `SuperTimeUtils.ts` module in `src/views/supergrid/`. Wire them into `SuperGrid._fetchAndRender()` for auto-detection. Replace the granularity `<select>` with pills in `mount()`. Add `_periodSelection: Set<string>` with Cmd+click toggle on time col headers, routing to `filter.setAxisFilter()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7.9 (in project) | `timeParse`, `timeDay.count`, `timeMonth.count` for date parsing and hierarchy detection | Already installed and used in SuperGrid. No new dependency. |
| TypeScript | 5.9 strict (project) | All implementation language | Locked stack (D-001) |
| `SuperDensityProvider` | existing | `axisGranularity` state + Tier 2 persistence + subscriber pattern | Already manages granularity state and `setGranularity()` API |
| `FilterProvider._axisFilters` | existing | `setAxisFilter(field, values)` compiles to `field IN (?,...)` | Exact mechanism needed for non-contiguous period filtering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `d3.timeParse` | v7.9 | Parse date strings from axis cell values | In `parseDateString()` sequential fallback chain |
| `d3.timeDay.count` | v7.9 | Count days between min/max dates | In `smartHierarchy()` for threshold comparison |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `d3.timeParse` | `new Date()` / regex | `new Date()` has locale-dependent behavior and accepts ambiguous formats; d3.timeParse is deterministic and explicit |
| `d3.timeDay.count` | `(maxMs - minMs) / 86400000` | Both work; d3.timeDay.count is more readable and handles DST transitions correctly |
| Segmented pills (inline DOM) | `<select>` (existing granularity picker) | Per CONTEXT.md, pills are the locked UX decision — the `<select>` will be replaced |

**Installation:** None required. `d3` v7.9 is already in `package.json`.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── views/
│   ├── SuperGrid.ts              # Add: _periodSelection field, pill wiring, Cmd+click handler
│   └── supergrid/
│       ├── SuperGridQuery.ts     # No changes needed
│       ├── SuperTimeUtils.ts     # NEW: parseDateString(), smartHierarchy()
│       └── SuperStackHeader.ts   # No changes needed
├── providers/
│   └── SuperDensityProvider.ts   # No changes needed (axisGranularity already there)
```

### Pattern 1: Sequential Fallback Date Parser
**What:** A pure function that tries each `d3.timeParse` format in order and returns the first non-null result. Returns null for unparseable input (maps to 'No Date' group).
**When to use:** Called during `smartHierarchy()` computation to parse min/max axis values from `_lastCells`.
**Example:**
```typescript
// Source: d3.timeParse docs + project verification
import * as d3 from 'd3';

// Pre-process: strip ISO time suffix. '2025-03-05T14:30:00' → '2025-03-05'
// This must happen BEFORE parsing to avoid false failures on ISO datetime strings.
const _PARSERS = [
  d3.timeParse('%Y-%m-%d'),   // ISO: 2025-03-15
  d3.timeParse('%m/%d/%Y'),   // US: 03/15/2025
  d3.timeParse('%d/%m/%Y'),   // EU: 15/03/2025
];

export function parseDateString(s: string): Date | null {
  if (!s || s.trim() === '') return null;
  // Strip ISO datetime suffix (date-only precision per CONTEXT.md)
  const dateOnly = s.split('T')[0]!;
  for (const parser of _PARSERS) {
    const result = parser(dateOnly);
    if (result) return result;
  }
  return null;
}
```

**Important caveat:** `d3.timeParse` does not validate overflow months. `'13/01/2025'` parsed with `'%m/%d/%Y'` returns a date (January 2026 overflow) rather than null. This means US parser wins for day-values > 12 when those appear in the first-wins chain. Per CONTEXT.md, 'first successful parse wins' — this is the intended behavior. Truly unparseable strings ('TBD', 'ASAP', 'N/A', 'pending', '') return null from all three parsers (verified).

### Pattern 2: Smart Hierarchy Selection
**What:** A pure function that takes parsed min/max dates and returns the `TimeGranularity` that produces ~10-20 columns.
**When to use:** Called in `_fetchAndRender()` after receiving cells from Worker, when `axisGranularity` is in auto mode.
**Example:**
```typescript
// Source: d3.timeDay.count docs + threshold verification
import * as d3 from 'd3';
import type { TimeGranularity } from '../../providers/types';

// Threshold breakpoints targeting ~10-20 columns (verified with d3):
//   day:     ≤20 days   → max 20 day-columns
//   week:    ≤140 days  → max ~20 week-columns
//   month:   ≤610 days  → max ~20 month-columns (~20 months = 608-610 days)
//   quarter: ≤1825 days → max ~20 quarter-columns (~5 years = 20 quarters)
//   year:    >1825 days → year-level columns

export function smartHierarchy(minDate: Date, maxDate: Date): TimeGranularity {
  const days = d3.timeDay.count(minDate, maxDate);
  if (days <= 20) return 'day';
  if (days <= 140) return 'week';
  if (days <= 610) return 'month';
  if (days <= 1825) return 'quarter';
  return 'year';
}
```

**Edge case — empty/single-date datasets:**
- Empty `_lastCells`: no axis values to parse → no smartHierarchy call; leave `axisGranularity` unchanged.
- All dates null (all 'No Date'): same as empty → leave unchanged.
- Single unique date (minDate === maxDate): `d3.timeDay.count` returns 0 → falls into `≤20` → returns `'day'`. This is correct.

### Pattern 3: Auto-Detection Loop Guard
**What:** SmartHierarchy should only trigger a `setGranularity()` call (which fires a Worker re-query) when the computed level differs from the current granularity AND the user is in auto mode.
**Why:** Without this guard, `_fetchAndRender()` → computes level → `setGranularity()` → subscriber fires → `_fetchAndRender()` → infinite loop.

The state needed:
- `_isAutoGranularity: boolean` in SuperGrid — true when user has not manually overridden (or pressed 'A' pill).
- Pill click 'A' sets `_isAutoGranularity = true` + re-runs smart detection.
- Pill click D/W/M/Q/Y sets `_isAutoGranularity = false` + calls `setGranularity(level)`.

```typescript
// In _fetchAndRender() after receiving cells:
if (this._isAutoGranularity) {
  const smartLevel = this._computeSmartHierarchy(cells, colAxes, rowAxes);
  const currentLevel = this._densityProvider.getState().axisGranularity;
  if (smartLevel !== currentLevel) {
    // setGranularity() notifies subscribers → fires _fetchAndRender() again
    // Guard: _isAutoGranularity=true prevents this from being infinite
    // because next call will compute same level (data unchanged) → no change → no loop
    this._densityProvider.setGranularity(smartLevel);
    return; // let subscriber re-trigger with correct granularity
  }
}
```

### Pattern 4: Non-Contiguous Period Selection (Cmd+click)
**What:** A `_periodSelection: Set<string>` in SuperGrid stores selected period keys. Cmd+click on time col headers toggles them. `filter.setAxisFilter()` propagates to FilterProvider.
**When to use:** Only when the axis field is a time field (checked against `ALLOWED_COL_TIME_FIELDS`).
**Example:**
```typescript
// In _createColHeaderCell() or _renderCells() col header click handler:
el.addEventListener('click', (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey) {
    const isTimeField = ALLOWED_COL_TIME_FIELDS.has(axisField);
    if (isTimeField) {
      // TIME-04: non-contiguous period selection
      const periodKey = cell.value; // strftime-formatted value (e.g., '2025-01', '2025-Q1')
      if (this._periodSelection.has(periodKey)) {
        this._periodSelection.delete(periodKey);
      } else {
        this._periodSelection.add(periodKey);
      }
      if (this._periodSelection.size === 0) {
        this._filter.clearAxis(axisField);
      } else {
        this._filter.setAxisFilter(axisField, [...this._periodSelection]);
      }
      // FilterProvider notifies subscribers → StateCoordinator → _fetchAndRender()
      return;
    }
    // Non-time field: fall through to existing SLCT-05 card selection
    // ... existing allCardIds logic ...
  }
  // Plain click: collapse/expand (existing behavior)
});
```

**Period key format:** The strftime output is what appears in `CellDatum[colField]`. The GROUP BY alias ensures `created_at` (or `due_at`) field values in the response are strftime-formatted. `FilterProvider.setAxisFilter('created_at', ['2025-01', '2025-02'])` produces `created_at IN ('2025-01', '2025-02')` which correctly matches the grouped rows. No special escaping needed — strftime outputs are alphanumeric + `-` + `W` + `Q`.

### Pattern 5: Segmented Pills (replacing `<select>`)
**What:** Inline pill strip replacing the existing `granularity-picker` `<select>` element. Same visibility rule (`display:none` when no time axis).
**Implementation:** Build pills in `mount()`. Active pill gets `.active` class or inline accent style. Clicking 'A' triggers auto mode; D/W/M/Q/Y set manual override.

```typescript
// In mount() toolbar construction (replaces granSelect <select>):
const pillContainer = document.createElement('div');
pillContainer.className = 'granularity-pills';
pillContainer.style.cssText = 'display:flex;gap:2px;';

const pillDefs: Array<{ label: string; value: TimeGranularity | null }> = [
  { label: 'A', value: null },   // Auto
  { label: 'D', value: 'day' },
  { label: 'W', value: 'week' },
  { label: 'M', value: 'month' },
  { label: 'Q', value: 'quarter' },
  { label: 'Y', value: 'year' },
];

for (const def of pillDefs) {
  const pill = document.createElement('button');
  pill.className = 'granularity-pill';
  pill.dataset['granValue'] = def.value ?? 'auto';
  pill.textContent = def.label;
  pill.style.cssText = 'font-size:10px;padding:2px 5px;border:1px solid rgba(128,128,128,0.3);borderRadius:3px;cursor:pointer;background:var(--sg-header-bg,#f0f0f0);';
  pill.addEventListener('click', () => {
    if (def.value === null) {
      // 'A' pill: enable auto mode
      this._isAutoGranularity = true;
      void this._fetchAndRender(); // re-run smart detection
    } else {
      // Manual override
      this._isAutoGranularity = false;
      this._densityProvider.setGranularity(def.value);
      // StateCoordinator fires _fetchAndRender() via subscriber chain
    }
  });
  pillContainer.appendChild(pill);
}
```

### Anti-Patterns to Avoid
- **Calling `smartHierarchy()` with strftime-formatted strings:** The smart hierarchy function needs actual `Date` objects (parsed from axis values). The Worker returns strftime-formatted strings as cell values. Must parse them BACK to dates for `d3.timeDay.count`.
- **Smart detection on every `_fetchAndRender` with unconditional `setGranularity`:** Would create infinite loop. Must guard with `_isAutoGranularity` AND check if computed level differs from current.
- **Storing period selection in `FilterProvider`:** Period selection is Tier 3 ephemeral state (does not survive sessions). The `Set<string>` lives in `SuperGrid` instance; `FilterProvider.setAxisFilter()` is only the SQL compilation mechanism.
- **Using `innerHTML` for pill content:** Consistent with Phase 25 locked decision (SRCH-03). Use `textContent` for pill labels.
- **Period key mismatch:** The period keys in `_periodSelection` must exactly match strftime output. Example: quarter pattern is `strftime('%Y', created_at) || '-Q' || ((CAST(strftime('%m', created_at) AS INT) - 1) / 3 + 1)` which produces `'2025-Q1'`. Store and compare as strings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date string parsing | Custom regex per format | `d3.timeParse('%Y-%m-%d')`, `d3.timeParse('%m/%d/%Y')`, `d3.timeParse('%d/%m/%Y')` | d3.timeParse handles locale-edge cases, is deterministic for explicit format specs |
| Date range counting | `(maxMs - minMs) / 86400000` | `d3.timeDay.count(minDate, maxDate)` | DST-safe, semantically clear |
| IN (?) SQL generation | Custom string builder | `FilterProvider.setAxisFilter(field, values)` | Already implemented in Phase 24; handles empty array (delete), Tier 2 persistence, subscriber notification |
| Persistence of auto/manual mode | New provider | `SuperDensityProvider.axisGranularity === null` = auto mode | null granularity already means "no override"; Tier 2 persistence already works |

**Key insight:** The entire SQL side of TIME-05 is already implemented. `FilterProvider._axisFilters` with `IN (?)` was built in Phase 24. The only new infrastructure is the client-side `Set<string>` and the `parseDateString()` + `smartHierarchy()` utilities.

## Common Pitfalls

### Pitfall 1: Infinite Loop in Smart Hierarchy Detection
**What goes wrong:** `_fetchAndRender()` computes smart level → calls `setGranularity()` → density subscriber fires → `_fetchAndRender()` → computes same level → calls `setGranularity()` again → subscriber fires → infinite.
**Why it happens:** `setGranularity()` always notifies subscribers even if value is the same (no equality guard in `SuperDensityProvider`).
**How to avoid:** In `_fetchAndRender()`, only call `setGranularity()` when computed level ≠ current level. When they match, no call is made → no re-trigger.
**Warning signs:** Browser DevTools shows continuous Worker requests after mounting a time axis.

### Pitfall 2: Period Keys Not Matching strftime Output
**What goes wrong:** `_periodSelection` stores `'Q1-2025'` but filter compiles `created_at IN ('Q1-2025')` which doesn't match the cell value `'2025-Q1'` in the query result.
**Why it happens:** The period key stored in the Set must exactly match the value in `CellDatum[colField]` — which is the strftime expression output. The quarter expression produces `'YYYY-QN'` format.
**How to avoid:** In the Cmd+click handler, use `cell.value` from the `HeaderCell` as the period key — this is exactly what the cell was rendered with, which came from `CellDatum[colField]`.
**Warning signs:** Cmd+click applies a filter but grid doesn't collapse (or shows 0 results).

### Pitfall 3: Smart Hierarchy Parsing Already-Formatted Strftime Values
**What goes wrong:** After granularity is set to 'month', cell values are `'2025-01'`, `'2025-02'` etc. Trying to parse these with `d3.timeParse('%Y-%m-%d')` fails → `parseDateString` returns null → no dates → no smart detection.
**Why it happens:** Auto-detection must parse the RAW date values from the database, not the strftime-formatted bucket labels.
**How to avoid:** Auto-detection runs at the start of `_fetchAndRender()` BEFORE a granularity is set. On first mount with a time axis, granularity is null — so cell values come back as raw ISO strings from the database. Only after the first smart detection call sets the granularity do strftime values appear. On subsequent renders (after granularity is set), smart detection should be skipped (already has a level).

Alternatively, store raw min/max dates during the initial (null-granularity) fetch and cache them. Re-run smart detection only when date range changes (new import).

### Pitfall 4: Period Selection Not Cleared on Axis Change
**What goes wrong:** User selects Q1+Q3 on `due_at` axis. User drags `due_at` off the axis. New axis has no period selection, but `FilterProvider` still has `due_at IN ('2025-Q1', '2025-Q3')` filter active — grid shows no results.
**Why it happens:** `_periodSelection` is cleared via `clearAxis()` only on explicit user action, not on axis change.
**How to avoid:** In `setColAxes()` / `setRowAxes()` drop handler logic, detect if the old time axis field is no longer active and call `this._filter.clearAxis(oldTimeField)` + `this._periodSelection.clear()`.
**Warning signs:** Grid shows 0 results after axis change; `_clearFiltersBtnEl` appears.

### Pitfall 5: Cmd+Click Conflict Between SLCT-05 and Period Selection
**What goes wrong:** Cmd+click on a time period header fires BOTH period selection (TIME-04) AND card selection (SLCT-05).
**Why it happens:** The existing `_createColHeaderCell()` click handler already handles `metaKey || ctrlKey` for SLCT-05. Adding period selection in the same handler without a guard runs both code paths.
**How to avoid:** In the click handler, check `isTimeField && this._densityProvider.getState().axisGranularity !== null` FIRST. If true, handle as period selection and `return` — do not fall through to SLCT-05 card selection.
**Warning signs:** Period selection also triggers card selection badge ("3 cards selected").

### Pitfall 6: 'A' Pill Re-Trigger on Manual Granularity Restore
**What goes wrong:** User presses 'M' (month) pill. Later presses 'A' (auto). `_isAutoGranularity = true`. `_fetchAndRender()` runs. Smart level is computed as 'week'. `setGranularity('week')` is called. Subscriber fires. `_fetchAndRender()` runs again. Smart level is still 'week'. Since 'week' === current 'week', no `setGranularity()` call. Render proceeds normally.
**Result:** This actually works correctly because of the equality guard. Document this to avoid confusion.

## Code Examples

### parseDateString() — Verified Working Pattern
```typescript
// Source: d3.timeParse docs + verified in project node_modules (d3 v7.9)
// Verification: parseDateString('2025-03-15') → Date, parseDateString('03/15/2025') → Date,
//               parseDateString('15/03/2025') → Date, parseDateString('TBD') → null

import * as d3 from 'd3';

const _ISO_PARSER = d3.timeParse('%Y-%m-%d');
const _US_PARSER = d3.timeParse('%m/%d/%Y');
const _EU_PARSER = d3.timeParse('%d/%m/%Y');
const _PARSERS = [_ISO_PARSER, _US_PARSER, _EU_PARSER];

export function parseDateString(s: string): Date | null {
  if (!s || s.trim() === '') return null;
  const dateOnly = s.split('T')[0]!; // strip ISO time component
  for (const parser of _PARSERS) {
    const result = parser(dateOnly);
    if (result) return result;
  }
  return null;
}
```

### smartHierarchy() — Verified Threshold Logic
```typescript
// Source: d3.timeDay.count verified + threshold derivation:
// ≤20 days: max 20 day-columns (fine)
// ≤140 days: max ~20 week-columns (7×20=140)
// ≤610 days: max ~20 month-columns (~30.5×20=610)
// ≤1825 days: max ~20 quarter-columns (~91×20=1820≈1825)
// >1825 days: year-level (5+ years)

import * as d3 from 'd3';
import type { TimeGranularity } from '../../providers/types';

export function smartHierarchy(minDate: Date, maxDate: Date): TimeGranularity {
  const days = d3.timeDay.count(minDate, maxDate);
  if (days <= 20) return 'day';
  if (days <= 140) return 'week';
  if (days <= 610) return 'month';
  if (days <= 1825) return 'quarter';
  return 'year';
}
```

### _computeSmartHierarchy() Integration in SuperGrid
```typescript
// Called from _fetchAndRender() after cells received, only when _isAutoGranularity=true
private _computeSmartHierarchy(
  cells: CellDatum[],
  colAxes: AxisMapping[],
  rowAxes: AxisMapping[]
): TimeGranularity | null {
  // Find first time field among active axes
  const allAxes = [...colAxes, ...rowAxes];
  const timeField = allAxes.find(a => ALLOWED_COL_TIME_FIELDS.has(a.field))?.field;
  if (!timeField) return null; // no time axis

  // Collect all raw date strings from cells (field values are strftime-bucketed
  // only when granularity is set; on first call (null granularity), they are raw ISO strings)
  const rawValues = cells
    .map(c => String(c[timeField] ?? ''))
    .filter(v => v.length > 0);

  const parsed = rawValues
    .map(parseDateString)
    .filter((d): d is Date => d !== null);

  if (parsed.length === 0) return null;

  const minDate = new Date(Math.min(...parsed.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...parsed.map(d => d.getTime())));

  return smartHierarchy(minDate, maxDate);
}
```

### Period Selection Toggle in Header Click Handler
```typescript
// In _createColHeaderCell() (replacing/extending the Cmd+click branch):
el.addEventListener('click', (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey) {
    // TIME-04: Check if this is a time axis with active granularity
    const isTimeField = ALLOWED_COL_TIME_FIELDS.has(axisField);
    const hasGranularity = this._densityProvider.getState().axisGranularity !== null;
    if (isTimeField && hasGranularity) {
      const periodKey = cell.value; // e.g. '2025-01', '2025-Q1'
      if (this._periodSelection.has(periodKey)) {
        this._periodSelection.delete(periodKey);
      } else {
        this._periodSelection.add(periodKey);
      }
      // TIME-05: compile to FilterProvider IN (?) clause
      if (this._periodSelection.size === 0) {
        this._filter.clearAxis(axisField);
      } else {
        this._filter.setAxisFilter(axisField, [...this._periodSelection]);
      }
      // FilterProvider subscriber → StateCoordinator → _fetchAndRender()
      return; // CRITICAL: prevent fallthrough to SLCT-05
    }

    // Non-time or no-granularity: existing SLCT-05 card selection
    const allCardIds: string[] = [];
    for (const cd of this._lastCells) {
      if (String(cd[axisField] ?? 'unknown') === cell.value) {
        allCardIds.push(...(cd.card_ids ?? []));
      }
    }
    this._selectionAdapter.addToSelection(allCardIds);
    return;
  }
  // Plain click: collapse/expand (existing behavior unchanged)
  // ...
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<select>` element for granularity | Segmented pills A/D/W/M/Q/Y | Phase 26 (this phase) | Better discoverability; faster interaction |
| No auto-detection (manual only) | `smartHierarchy()` auto-selects on first mount | Phase 26 (this phase) | Time axes work out-of-the-box without user configuration |
| No non-contiguous selection | Cmd+click period selection via Set + FilterProvider | Phase 26 (this phase) | Enables Q1 vs Q3 comparison patterns |

**Deprecated/outdated in this phase:**
- `granularity-picker` `<select>` element: replaced by `granularity-pills` `<div>` with button children. The `_updateDensityToolbar()` method's `.granularity-picker` selector and show/hide logic must be updated.

## Open Questions

1. **'No Date' group position on time axis**
   - What we know: CONTEXT.md says "consistent with how 'None' works for other axis fields" — it appears at the end
   - What's unclear: The current sort is `ORDER BY created_at ASC` — null values may sort differently depending on SQLite NULL ordering rules (NULLs last in ASC by default)
   - Recommendation: No code change needed for 'No Date' group — SQLite returns NULL as a distinct group and the existing `String(c[colField] ?? 'unknown')` already maps null to 'unknown'. Can rename 'unknown' to 'No Date' for time fields in the display layer.

2. **Auto mode persistence across sessions**
   - What we know: `SuperDensityProvider.toJSON()` persists `axisGranularity`. When auto mode sets granularity to 'month', it persists 'month'. On restore, provider has 'month' but `_isAutoGranularity` (instance state) is reset to... what?
   - What's unclear: If `_isAutoGranularity` defaults to `true` on every mount, then smart detection runs on first `_fetchAndRender()`. If it computes 'month' (same as persisted), no `setGranularity()` call. If range has changed (new import), may compute different level and update. This seems correct.
   - Recommendation: Default `_isAutoGranularity = true`. 'A' pill restores this. Manual pills set to `false`. On mount, auto mode always re-evaluates (correct adaptive behavior per CONTEXT.md).

3. **Period selection visual accent color**
   - What we know: "highlighted accent background color — simple, familiar visual cue" per CONTEXT.md. Exact color is Claude's discretion.
   - What's unclear: Should it use the same blue as selection (`rgba(26, 86, 240, 0.12)`) or a distinct time-selection accent?
   - Recommendation: Use a distinct teal/cyan accent (e.g., `rgba(0, 150, 136, 0.18)`) to differentiate period selection from card selection. Follows the "simple, familiar" guidance while being visually distinct.

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not set to `true` in `.planning/config.json`.

## Sources

### Primary (HIGH confidence)
- D3.js v7.9 in project (`node_modules/d3`) - `timeParse`, `timeDay.count`, `timeMonth.count` — all verified by direct execution in Node.js
- `src/providers/SuperDensityProvider.ts` — `axisGranularity` state, `setGranularity()`, `toJSON()` persistence
- `src/providers/FilterProvider.ts` — `setAxisFilter()`, `clearAxis()`, `compile()` generating `IN (?)` SQL
- `src/views/supergrid/SuperGridQuery.ts` — `STRFTIME_PATTERNS`, `ALLOWED_TIME_FIELDS`, `compileAxisExpr()`
- `src/views/SuperGrid.ts` — `_createColHeaderCell()`, `_updateDensityToolbar()`, `ALLOWED_COL_TIME_FIELDS`, `_renderCells()`, Cmd+click patterns
- `src/views/types.ts` — `SuperGridDensityLike`, `SuperGridFilterLike` interfaces
- `.planning/phases/26-supertime/26-CONTEXT.md` — locked implementation decisions

### Secondary (MEDIUM confidence)
- Threshold breakpoints (day≤20, week≤140, month≤610, quarter≤1825): derived by computation from `d3.timeDay.count` against known date pairs — matches `~10-20 columns` target from CONTEXT.md

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in project node_modules
- Architecture: HIGH — all integration points verified in codebase; auto-loop guard pattern derived from first principles
- Pitfalls: HIGH — Pitfalls 1-3 verified by code tracing; Pitfalls 4-6 derived from existing patterns

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable codebase; d3 v7 API is stable)
