---
phase: 72-state-persistence-migration
plan: 01
subsystem: providers
tags: [StateManager, SchemaProvider, FilterProvider, PAFVProvider, persistence, migration]

# Dependency graph
requires:
  - phase: 71-dynamic-schema-integration
    provides: SchemaProvider with isValidColumn() for runtime schema checks
  - phase: 70-schema-provider
    provides: SchemaProvider class and setSchemaProvider() allowlist delegation
provides:
  - StateManager._migrateState() prunes persisted filter/PAFV state for schema changes
  - StateManager.setSchemaProvider() setter for wiring schema-aware migration
  - main.ts StateManager wiring with restore() + enableAutoPersist() on boot
  - Integration tests verifying filter pruning and PAFV axis nulling across sessions
affects:
  - 72-02 (AliasProvider orphan preservation — same StateManager restore() path)
  - Any future providers registered with StateManager that need schema-aware migration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_migrateState() routing pattern: key-based dispatch to provider-specific migration helpers"
    - "Pass-through guard: !this._schema?.initialized returns state unchanged (test isolation, early boot)"
    - "setSchemaProvider() setter injection pattern (same as PAFVProvider/SuperDensityProvider/SuperGrid)"

key-files:
  created: []
  modified:
    - src/providers/StateManager.ts
    - src/main.ts
    - tests/providers/StateManager.test.ts

key-decisions:
  - "[Phase 72-01]: StateManager uses setter injection (setSchemaProvider) not constructor arg — avoids breaking 17+ test instantiation sites"
  - "[Phase 72-01]: _migrateState() is a pass-through when SchemaProvider not wired or not initialized — zero regression for existing tests and early boot"
  - "[Phase 72-01]: Filter axisFilters/rangeFilters pruned by key (field name) matching schema; colWidths/sortOverrides/collapseState in PAFV state pass through unchanged (user layout preferences, not field refs)"
  - "[Phase 72-01]: StateManager placed after all Tier 2 providers created AND after SchemaProvider initialized in main.ts bootstrap"

patterns-established:
  - "Schema migration pattern: _migrateState() called between JSON.parse and provider.setState() in restore() — clean state before any validation in setState()"
  - "Provider-key routing in _migrateState(): 'filter' -> _migrateFilterState(), 'pafv' -> _migratePAFVState(), all others pass through"

requirements-completed: [PRST-01, PRST-02, PRST-03]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 72 Plan 01: StateManager Schema Migration + Integration Tests Summary

**Schema-aware StateManager migration pruning stale FilterProvider/PAFVProvider state via _migrateState() between JSON.parse and setState() in restore()**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T20:06:30Z
- **Completed:** 2026-03-11T20:09:55Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments
- Added `setSchemaProvider()` setter and private `_migrateState()` dispatch method to StateManager
- `_migrateFilterState()` prunes `filters[]`, `axisFilters{}`, `rangeFilters{}` entries referencing columns not in current schema
- `_migratePAFVState()` nulls invalid xAxis/yAxis/groupBy, filters colAxes/rowAxes arrays, passes colWidths/sortOverrides/collapseState unchanged
- Wired StateManager in main.ts bootstrap after all Tier 2 providers + after SchemaProvider initialized
- 6 integration tests covering filter pruning, PAFV axis nulling, non-field state survival, pass-through guards, and full round-trip

## Task Commits

Each task was committed atomically:

1. **Task 1: Add setSchemaProvider() and _migrateState() to StateManager** - `1b15c286` (feat)
2. **Task 2: Wire StateManager in main.ts bootstrap** - `efc66e14` (feat)
3. **Task 3: Write schema migration integration tests** - `8469d8ce` (test)
4. **Task 4: Verify all existing tests pass** - (verified in Task 3 commit, 675/675 pass)

## Files Created/Modified
- `src/providers/StateManager.ts` - Added SchemaProvider import, `_schema` field, `setSchemaProvider()`, `_migrateState()`, `_migrateFilterState()`, `_migratePAFVState()`; updated `restore()` to call `_migrateState()` between parse and setState
- `src/main.ts` - Added StateManager import, wired sm after Tier 2 providers + SchemaProvider init, expose on window.__isometry
- `tests/providers/StateManager.test.ts` - Added FilterProvider import, SchemaProvider import, ColumnInfo type import, `makeSchemaProvider()` helper, Phase 72 describe block with 6 integration tests

## Decisions Made
- Used setter injection (`setSchemaProvider`) rather than constructor arg — consistent with PAFVProvider/SuperDensityProvider/SuperGrid pattern; zero breakage of 17+ test instantiation sites
- Pass-through guard `!this._schema?.initialized` covers both "no schema wired" (null) and "schema wired but not yet initialized" (false) cases — single guard, correct semantics
- colWidths/sortOverrides/collapseState pass through unchanged: these are UI layout preferences keyed by card type names (not column references), so schema migration should not touch them

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- StateManager schema migration complete — PRST-01/02/03 satisfied
- Ready for Phase 72 Plan 02 (AliasProvider orphan preservation — PRST-04)

---
*Phase: 72-state-persistence-migration*
*Completed: 2026-03-11*
