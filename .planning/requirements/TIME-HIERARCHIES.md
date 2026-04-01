# Time Hierarchies — Requirements Spec

## Context

When a time column (`created_at`, `modified_at`, `due_at`, `event_start`, `event_end`) is used as a SuperGrid row or column axis, it currently shows raw ISO timestamps as group keys. This produces one row/column per unique timestamp — effectively useless for analysis.

This spec adds contextualized time bucketing: time axes are grouped into hierarchical buckets (Year > Month > Week > Day) via SQL `strftime()`, with D3 time libraries providing calendar-aware formatting and scale mapping. The existing `axisGranularity` field in `SuperDensityState` already stores the granularity selection but only applies globally. This work makes time bucketing automatic when a time axis is present and adds per-axis granularity control.

A secondary goal is improving Timeline view's time axis with proper D3 `scaleTime` mapping and drill-down granularity.

## Requirements

### Category: TIME (Time Hierarchy Core)

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| TIME-01 | When a time column is used as a SuperGrid row or column axis, the query builder wraps it in `strftime()` at the active granularity | `buildSuperGridQuery` with `rowAxes: [{ field: 'created_at', direction: 'asc' }]` and `granularity: 'month'` produces `GROUP BY strftime('%Y-%m', created_at)`. Vitest confirms SQL output for all 5 granularities (day/week/month/quarter/year). |
| TIME-02 | When granularity is null and a time axis is present, default to `'month'` granularity automatically (not raw timestamps) | SuperGrid with `created_at` axis and `axisGranularity: null` renders month-level buckets. Raw ISO timestamps never appear as SuperGrid header labels. |
| TIME-03 | Display labels for time buckets use D3 `d3.timeFormat` / `d3.utcFormat` for locale-aware formatting | Month bucket "2026-03" renders as "Mar 2026" (or locale equivalent). Day bucket "2026-03-15" renders as "Mar 15". Year "2026" stays as "2026". Vitest covers all 5 granularity format outputs. |
| TIME-04 | Cards with NULL in the active time axis column are grouped into a "No Date" bucket, not silently excluded | SuperGrid with `created_at` axis shows a "No Date" row/column for cards where `created_at IS NULL`. Count matches `SELECT COUNT(*) FROM cards WHERE created_at IS NULL AND deleted_at IS NULL`. |
| TIME-05 | The "No Date" bucket sorts last (after all dated buckets) regardless of sort direction | With `direction: 'asc'`, "No Date" appears after the latest date. With `direction: 'desc'`, "No Date" still appears last. Vitest confirms ordering. |
| TIME-06 | SchemaProvider already classifies time columns with `latchFamily: 'Time'`. The query builder uses this classification (via `timeFields` config param) to decide which axes get `strftime()` wrapping | Non-time axes (e.g., `folder`, `card_type`) are never wrapped in `strftime()` regardless of granularity setting. Only fields in the `timeFields` set are wrapped. Vitest confirms mixed time + non-time axis query. |

### Category: TFLT (Time Filtering)

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| TFLT-01 | FilterProvider supports time range filtering via existing `setRangeFilter(field, min, max)` with ISO string min/max values on any time column | `setRangeFilter('created_at', '2026-01-01', '2026-03-31')` compiles to `created_at >= ? AND created_at <= ?` with correct params. Vitest confirms. |
| TFLT-02 | Projection and membership are separate concerns: the axis projection field (which time column drives grouping) is independent of which time fields are filtered | SuperGrid grouped by `created_at` with a range filter on `due_at` correctly groups by `created_at` buckets while filtering cards by `due_at` range. Vitest confirms both SQL fragments are present and independent. |
| TFLT-03 | Membership filter can span multiple time fields using OR semantics: a card passes if ANY of its time fields fall within the selected range | FilterProvider can compile a membership filter where `(created_at BETWEEN ? AND ?) OR (modified_at BETWEEN ? AND ?) OR (due_at BETWEEN ? AND ?)`. The specific API shape (single `setTimeRangeFilter` convenience method or composed individual filters) is an implementation decision. Vitest confirms OR semantics. |

### Category: TVIS (Time Visualization)

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| TVIS-01 | SuperGrid header cells for time-bucketed axes display formatted labels (from TIME-03), not raw `strftime()` output strings | SuperGrid rendered with `created_at` month axis shows "Mar 2026" in column/row headers, not "2026-03". Visual confirmation via E2E or manual test. |
| TVIS-02 | A granularity selector control (in ProjectionExplorer or DensityExplorer panel) allows the user to switch between day/week/month/quarter/year when a time axis is active | When no time axis is present, the granularity selector is hidden or disabled. When a time axis is added, the selector becomes active. Changing granularity triggers a re-query. |
| TVIS-03 | Timeline view uses `d3.scaleTime` (already in use via `d3.scaleUtc`) with the active time axis field to map card timestamps to x-coordinates | Timeline view renders cards at correct horizontal positions. Cards with the same date cluster at the same x position. Already partially implemented — this requirement ensures it works with configurable time fields (not hardcoded to `due_at`). |
| TVIS-04 | Timeline view respects the same granularity setting to control tick density on the time axis | Setting granularity to 'year' shows yearly ticks; 'month' shows monthly ticks. D3 `d3.timeMonth`, `d3.timeYear`, etc. drive tick intervals. |

## Architectural Constraints

### Existing infrastructure to extend (not replace)

- **SuperGridQuery.ts `compileAxisExpr()`** — Already wraps time fields in `strftime()` when granularity is set. Extend to handle NULL bucketing (COALESCE or CASE WHEN) and auto-default granularity for time axes.
- **SuperDensityProvider `axisGranularity`** — Already stored as `TimeGranularity | null` in Tier 2 state. This is the single source of truth for the active granularity.
- **SchemaProvider `getFieldsByFamily('Time')`** — Already returns all time columns. Use this to build the `timeFields` set passed to the query builder.
- **FilterProvider `setRangeFilter()`** — Already supports min/max range filtering on any field. TFLT-01 is largely already implemented; the requirement confirms it works for time strings.
- **BridgeDataAdapter** — Passes `granularity` from density state to bridge query. No change needed for the query path; label formatting happens in the rendering layer.

### SQL patterns

- Time bucketing: `COALESCE(strftime('%Y-%m', created_at), '__NO_DATE__') AS created_at` in the SELECT and GROUP BY
- The `__NO_DATE__` sentinel value is replaced with "No Date" in the rendering layer (not in SQL)
- Expression indexes on `strftime()` patterns already exist for `created_at` (see `schema.sql`). Consider adding indexes for `modified_at` and `due_at` if profiling shows need.

### D3 usage

- Continue using `import * as d3 from 'd3'` — do NOT switch to named sub-package imports
- `d3.timeFormat` / `d3.utcFormat` for label formatting
- `d3.scaleTime` / `d3.scaleUtc` for Timeline axis mapping
- `d3.timeDay`, `d3.timeWeek`, `d3.timeMonth`, `d3.timeYear` for tick intervals

### What NOT to do

- Do NOT add a `facets` table or `projection_eligible` / `membership_eligible` columns. The handoff doc assumed a `facets` table that does not exist. Use SchemaProvider's existing LATCH family classification instead.
- Do NOT create a migration file. Schema changes use inline `ALTER TABLE` with try/catch in `worker.ts initialize()`.
- Do NOT switch from `import * as d3 from 'd3'` to named sub-package imports.

## Dependencies

- **d3-time, d3-scale, d3-time-format** — Already available as transitive deps of the full `d3` import. No new package installs needed.
- **SchemaProvider** — Already classifies time columns. No changes needed to SchemaProvider itself.
- **SuperGridQuery.ts** — Primary file to modify for SQL bucketing.
- **SuperDensityProvider** — May need a minor change to auto-default granularity when time axis detected.

## Out of Scope

| Item | Reason |
|------|--------|
| Time Explorer brush interaction (non-contiguous range selection) | Separate UX work; filter query layer is in scope, brush UI is not |
| Drill-down click (click a year bucket to zoom into months) | UX interaction deferred to a future phase |
| Fiscal year / custom week-start configuration | Post-v1 |
| `membershipMode: 'any' \| 'all'` toggle | ANY semantics only for now |
| Expression indexes for `modified_at` / `due_at` time bucketing | Add only if profiling shows need |
| Event span rendering (start-to-end duration bars in Timeline) | Separate feature |

## Phase Suggestions

### Phase A: SQL Time Bucketing (TIME-01, TIME-04, TIME-05, TIME-06)
- Modify `compileAxisExpr()` in `SuperGridQuery.ts` to use `COALESCE(strftime(...), '__NO_DATE__')` for time fields
- Add `__NO_DATE__` sentinel handling for NULL time values
- Ensure "No Date" sorts last via `ORDER BY ... NULLS LAST` or equivalent `CASE WHEN` expression
- Auto-default granularity to 'month' when a time axis is present and granularity is null (TIME-02)
- Vitest: SQL output for all 5 granularities, NULL handling, mixed time + non-time axes, sort ordering

### Phase B: Display Formatting (TIME-03, TVIS-01, TVIS-02)
- Create a `TimeFormatRegistry` (or simple function map) mapping `(granularity, rawValue) -> displayLabel` using `d3.utcFormat`
- Apply formatting in SuperGrid header rendering (where raw axis values become header text)
- Wire granularity selector in ProjectionExplorer or DensityExplorer (show/hide based on time axis presence)
- Vitest: format output for all granularities. E2E: header labels in SuperGrid.

### Phase C: Time Filtering (TFLT-01, TFLT-02, TFLT-03)
- Confirm existing `setRangeFilter()` works with ISO time strings (likely already works — write tests to prove it)
- Add a convenience method or composed pattern for membership filtering across multiple time fields (OR semantics)
- Vitest: range filter SQL compilation, projection/membership independence, OR-semantics multi-field filter

### Phase D: Timeline Integration (TVIS-03, TVIS-04)
- Make Timeline view's projection field configurable (currently hardcoded to `due_at`)
- Wire granularity to D3 tick interval selection (`d3.timeMonth`, `d3.timeYear`, etc.)
- Vitest: tick interval selection. Manual test: Timeline renders correctly with different time fields and granularities.
