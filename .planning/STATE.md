---
gsd_state_version: 1.0
milestone: v5.3
milestone_name: Dynamic Schema
status: unknown
last_updated: "2026-03-11T21:35:34Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 10
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v5.3 Dynamic Schema -- Phase 73 complete (User-Configurable LATCH Mappings, UCFG-01..05)

## Current Position

Phase: 73 of 73 (User-Configurable LATCH Mappings) -- Plan 03 complete
Plan: 3 of 3 (Boot Wiring + Persistence Restore + Tests)
Status: Phase 73 complete
Last activity: 2026-03-11 -- Boot-time override/disabled restore, LatchExplorers remount wiring, 10 PropertiesExplorer LATCH config UI tests

Progress: [##########] 100%

## Performance Metrics

**Velocity:**
- v5.3 milestone: Phase 70 Plan 01 in 8 min, Phase 71 Plan 01 in 3 min, Phase 73 Plan 01 in 3 min, Phase 73 Plan 02 in 5 min, Phase 73 Plan 03 in 5 min
- v5.2 milestone: 13 plans in 2 days (6.5 plans/day) -- Phases 62-68 complete
- v5.1 milestone: 7 plans in 1 day (7 plans/day) -- Phases 58-61 complete
- v5.0 milestone: 11 plans in 1 day (11 plans/day) -- Phases 54-57 complete
- v4.4 milestone: 10 plans in 1 day (10 plans/day) -- Phases 49-52 complete

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.
v5.2 decisions archived to PROJECT.md Key Decisions table.
- Connections table queries must never reference deleted_at -- CASCADE deletion, not soft-delete (BUGF-03)
- [Phase 69]: SVG text CSS reset placed at end of design-tokens.css -- global protection for all D3-generated SVG text (BUGF-01)
- [Phase 70-01]: onSchema stored as _onSchema private field in WorkerBridge (config typed as Required<Pick<..., 'timeout'|'debug'>>)
- [Phase 70-01]: SchemaProvider is NOT PersistableProvider -- schema is PRAGMA-derived, not user state
- [Phase 70-01]: allowlist delegates to SchemaProvider when wired, falls back to frozen sets for boot safety and test isolation (SCHM-07)
- [Phase 71-01]: KnownAxisField/KnownFilterField preserve literal unions; AxisField/FilterField widened with (string & {}) trick for dynamic schema (DYNM-01..04)
- [Phase 71-01]: LATCH_FAMILIES_FALLBACK widens type to Record<string, LatchFamily>; LATCH_FAMILIES is backward-compat alias; getLatchFamily() default is A (Alphabet)
- [Phase 71-01]: ProjectionExplorer migrated to getLatchFamily() to avoid TS2538 on widened Record<string, LatchFamily> index access
- [Phase 71-02]: PAFVProvider uses setter injection (not constructor) for SchemaProvider to avoid breaking instantiation sites (DYNM-11)
- [Phase 71-02]: SuperDensityProvider _isValidDisplayField() centralizes fallback logic for setDisplayField() and setState() (DYNM-12)
- [Phase 71-03]: schema?: SchemaProvider optional on all explorer configs — tests exercise fallback path without wiring (DYNM-05..09)
- [Phase 71-03]: FIELD_DISPLAY_NAMES removed from CalcExplorer — AliasProvider is authoritative display name source (DYNM-08)
- [Phase 71-03]: LatchExplorers CATEGORY/HIERARCHY/TIME_FIELDS module constants replaced by _getFieldsForFamily() switch-case (DYNM-09)
- [Phase 71-03]: ChartRenderer schema injection via NotebookExplorer config chain (lazy construction pattern)
- [Phase 71-04]: SuperGrid uses setter injection setSchemaProvider() to avoid breaking positional constructor (DYNM-10)
- [Phase 71-04]: _getTimeFields()/_getNumericFields() return ReadonlySet<string>; cached per render cycle in local vars
- [Phase 71-04]: Worker boundary crossed by passing timeFields/numericFields string arrays in query config payload
- [Phase 71-04]: ALLOWED_COL_TIME_FIELDS/NUMERIC_FIELDS renamed to _FALLBACK in SuperGrid.ts + SuperGridQuery.ts
- [Phase 71-04]: CATEGORY_FIELDS/HIERARCHY_FIELDS/TIME_FIELDS removed from LatchExplorers as dead code (DYNM-13)
- [Phase 72-01]: StateManager uses setter injection (setSchemaProvider) not constructor arg -- avoids breaking instantiation sites (PRST-01)
- [Phase 72-01]: _migrateState() pass-through when SchemaProvider not wired or not initialized -- zero regression for existing tests and early boot
- [Phase 72-01]: Filter axisFilters/rangeFilters pruned by key matching schema; colWidths/sortOverrides/collapseState in PAFV pass through unchanged (PRST-02, PRST-03)
- [Phase 72-02]: isValidAxisField gate removed from AliasProvider.setState(); any string key accepted; orphan aliases survive schema changes (PRST-04)
- [Phase 73-01]: Override map checked first (_latchOverrides.get(c.name) ?? c.latchFamily) -- user always wins over heuristic (UCFG-05)
- [Phase 73-01]: Disabled fields excluded from axis/filter/numeric/family accessors but NOT from getColumns/isValidColumn
- [Phase 73-01]: getAllAxisColumns includes disabled fields with override-applied latchFamily -- PropertiesExplorer shows disabled greyed-out
- [Phase 73-01]: _latchOverrides and _disabledFields survive initialize() re-init -- independent of PRAGMA lifecycle
- [Phase 73-02]: PropertiesExplorerConfig gains bridge (WorkerBridgeLike) and filter (FilterProvider) optional props
- [Phase 73-02]: LATCH chip badge uses <select> with toLetter/toFullName for native UX + accessibility
- [Phase 73-02]: _rebuildColumnFields uses getAllAxisColumns (NOT getAxisColumns) -- disabled fields visible greyed-out in place
- [Phase 73-02]: Disabling a field clears filters from FilterProvider (filters, range, axis)
- [Phase 73-03]: SchemaProvider subscribers wired separately for LatchExplorers (destroy+remount) and ProjectionExplorer (update) in main.ts
- [Phase 73-03]: Boot persistence restore placed after setLatchSchemaProvider, before provider creation

### Blockers/Concerns

- CSS content-visibility: auto requires Safari 18+ (iOS 18+) -- iOS 17 users get JS windowing only
- FeatureGate bypassed in DEBUG builds -- test tier gates before release

## Session Continuity

Last session: 2026-03-11
Stopped at: Completed 73-03-PLAN.md -- Phase 73 complete (User-Configurable LATCH Mappings, all 3 plans)
Resume: v5.3 Dynamic Schema milestone complete. All phases (70-73) shipped.
