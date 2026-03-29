# Requirements: Isometry v10.1 — Time Hierarchies

**Defined:** 2026-03-29
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## TIME (Time Hierarchy Core)

- [ ] **TIME-01**: When a time column is used as a SuperGrid row or column axis, the query builder wraps it in `strftime()` at the active granularity
- [ ] **TIME-02**: When granularity is null and a time axis is present, default to `'month'` granularity automatically (no raw timestamps)
- [ ] **TIME-03**: Display labels for time buckets use D3 `d3.timeFormat` / `d3.utcFormat` for locale-aware formatting
- [ ] **TIME-04**: Cards with NULL in the active time axis column are grouped into a "No Date" bucket, not silently excluded
- [ ] **TIME-05**: The "No Date" bucket sorts last (after all dated buckets) regardless of sort direction
- [ ] **TIME-06**: SchemaProvider time field classification drives which axes get `strftime()` wrapping (non-time axes are never wrapped)

## TFLT (Time Filtering)

- [ ] **TFLT-01**: FilterProvider supports time range filtering via `setRangeFilter(field, min, max)` with ISO string min/max values
- [ ] **TFLT-02**: Projection and membership are separate concerns: axis projection field is independent of which time fields are filtered
- [ ] **TFLT-03**: Membership filter can span multiple time fields using OR semantics (card passes if ANY time field falls within range)

## TVIS (Time Visualization)

- [ ] **TVIS-01**: SuperGrid header cells for time-bucketed axes display formatted labels ("Mar 2026" not "2026-03")
- [ ] **TVIS-02**: A granularity selector control allows switching between day/week/month/quarter/year when a time axis is active
- [ ] **TVIS-03**: Timeline view uses configurable time field for x-axis (not hardcoded to `due_at`)
- [ ] **TVIS-04**: Timeline view respects granularity setting to control tick density on the time axis

## Future Requirements

- Time Explorer brush interaction (non-contiguous range selection UI)
- Drill-down click (click year bucket → zoom to months)
- Fiscal year / custom week-start configuration
- `membershipMode: 'any' | 'all'` toggle
- Event span rendering (start-to-end duration bars in Timeline)

## Out of Scope

- No `facets` table or `projection_eligible` columns — use SchemaProvider LATCH classification
- No migration files — inline ALTER TABLE in worker.ts
- No named D3 sub-package imports — continue using `import * as d3 from 'd3'`
- No expression indexes for `modified_at`/`due_at` unless profiling shows need

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TIME-01 | Phase 136 | Pending |
| TIME-02 | Phase 136 | Pending |
| TIME-03 | Phase 137 | Pending |
| TIME-04 | Phase 136 | Pending |
| TIME-05 | Phase 136 | Pending |
| TIME-06 | Phase 136 | Pending |
| TFLT-01 | Phase 138 | Pending |
| TFLT-02 | Phase 138 | Pending |
| TFLT-03 | Phase 138 | Pending |
| TVIS-01 | Phase 137 | Pending |
| TVIS-02 | Phase 137 | Pending |
| TVIS-03 | Phase 139 | Pending |
| TVIS-04 | Phase 139 | Pending |
