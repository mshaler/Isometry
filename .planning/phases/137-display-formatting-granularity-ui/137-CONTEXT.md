---
phase: 137-display-formatting-granularity-ui
type: context
created: 2026-04-07
---

# Phase 137: Display Formatting + Granularity UI — Context

## Phase Goal

SuperGrid headers display human-readable time labels and users can switch granularity from the Workbench panel when a time axis is active.

## Requirements

- **TIME-03**: Display labels for time buckets use D3 `d3.utcFormat` for locale-aware formatting
- **TVIS-01**: SuperGrid header cells for time-bucketed axes display formatted labels ("Mar 2026" not "2026-03")
- **TVIS-02**: A granularity selector control allows switching between day/week/month/quarter/year when a time axis is active

## Prior Phase Context (Phase 136)

Phase 136 established the SQL time bucketing layer:
- `compileAxisExpr()` wraps time fields in `COALESCE(strftime('%Y-%m', field), '__NO_DATE__')`
- `NO_DATE_SENTINEL = '__NO_DATE__'` exported from SuperGridQuery.ts
- 5 granularity levels produce these SQL output patterns:
  - day: `'2026-03-15'`
  - week: `'2026-W14'`
  - month: `'2026-03'`
  - quarter: `'2026-Q1'`
  - year: `'2026'`
- Auto-default: null granularity + time field = 'month'
- `compileTimeAxisOrderBy()` ensures `__NO_DATE__` sorts last

## Architecture Decisions

- **D3 formatting**: `d3.utcFormat` (not `d3.timeFormat`) for consistent UTC-based label generation
- **`import * as d3 from 'd3'`** — no named sub-package imports
- **Rendering layer formatting**: Format labels in PivotGrid rendering, NOT in SQL. SQL produces canonical bucket strings; UI formats for display.
- **NO_DATE_SENTINEL** → "No Date" replacement happens in the rendering layer

## Key Data Flow

```
SQL query → CellDatum[] → extractPath() → string[][] combinations → calculateSpans() → SpanInfo[].label → PivotGrid .text(label)
```

The formatting intercept point is between `calculateSpans()` output and `.text()` — or more precisely, a label formatter applied to SpanInfo labels before rendering.

## Granularity Selector State

The granularity selector already exists in ProjectionExplorer (lines 558-587) with all 5 options + "None". It calls `superDensity.setGranularity()` on change. The missing piece is **conditional visibility** — hide/disable when no time axis is active.

## Success Criteria

1. SuperGrid column/row headers for a month-bucketed time axis display "Mar 2026" not "2026-03" — Vitest confirms format output for all 5 granularity levels
2. When no time axis is active, the granularity selector is hidden/disabled — when a time axis is added, the selector becomes active
3. Changing granularity from the selector triggers a re-query and SuperGrid headers update to reflect the new bucket labels
