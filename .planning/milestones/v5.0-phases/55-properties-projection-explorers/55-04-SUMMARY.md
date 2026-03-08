---
phase: 55-properties-projection-explorers
plan: 04
subsystem: ui
tags: [z-plane-controls, aggregation, display-field, pafv-provider, super-density, main-wiring, explorer-integration]

# Dependency graph
requires:
  - phase: 55-properties-projection-explorers
    provides: PropertiesExplorer, ProjectionExplorer, AliasProvider, LATCH families, WorkbenchShell sections
provides:
  - PAFVProvider aggregation mode (count/sum/avg/min/max) with Tier 2 persistence
  - SuperDensityProvider displayField (AxisField selector) with Tier 2 persistence
  - SuperGridQuery aggregation SQL (AGG(displayField) AS count for non-count modes)
  - Z-plane controls row in ProjectionExplorer (display field, audit toggle, view mode, granularity, aggregation)
  - main.ts integration of AliasProvider, PropertiesExplorer, ProjectionExplorer into WorkbenchShell
affects: [supergrid-query-pipeline, workbench-shell-sections]

# Tech tracking
tech-stack:
  added: []
  patterns: [z-controls-row, aggregation-sql-reuse-alias, provider-config-extension]

key-files:
  created: []
  modified:
    - src/providers/PAFVProvider.ts
    - src/providers/SuperDensityProvider.ts
    - src/providers/types.ts
    - src/views/supergrid/SuperGridQuery.ts
    - src/ui/ProjectionExplorer.ts
    - src/styles/projection-explorer.css
    - src/main.ts
    - tests/providers/PAFVProvider.test.ts
    - tests/providers/SuperDensityProvider.test.ts
    - tests/views/supergrid/SuperGridQuery.test.ts
    - tests/ui/ProjectionExplorer.test.ts

key-decisions:
  - "Aggregation SQL reuses 'count' alias (e.g., SUM(priority) AS count) for backward compat with downstream cell rendering"
  - "SuperDensityProvider displayField defaults to 'name' for backward compat (missing field in older serialized state)"
  - "Z-controls row always visible below wells (not conditional on Z well content)"
  - "ALLOWED_AGGREGATION_MODES validated at setAggregation() call time, not compile time"
  - "exactOptionalPropertyTypes handled via conditional spread in PAFVProvider.setState()"

patterns-established:
  - "Z-controls row: horizontal flex layout with labeled select/button controls below projection wells"
  - "Provider config extension: loose interface in config for testability (superDensity, auditState)"
  - "Aggregation SQL: AGG(displayField) AS count pattern preserves downstream alias expectations"

requirements-completed: [PROJ-05, PROJ-06]

# Metrics
duration: 7min
completed: 2026-03-08
---

# Phase 55 Plan 04: Z-Plane Controls + Integration Summary

**PAFVProvider aggregation mode (count/sum/avg/min/max), SuperDensityProvider displayField, SuperGridQuery aggregation SQL, Z-controls row in ProjectionExplorer, and full main.ts wiring of AliasProvider/PropertiesExplorer/ProjectionExplorer**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-08T06:31:58Z
- **Completed:** 2026-03-08T06:39:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- PAFVProvider extended with aggregation mode (count/sum/avg/min/max) -- Tier 2 persistent, backward compatible
- SuperDensityProvider extended with displayField selector -- validates against ALLOWED_AXIS_FIELDS
- SuperGridQuery generates correct aggregation SQL: AGG(displayField) AS count for non-count modes, preserving downstream alias
- ProjectionExplorer Z-controls row renders 4 controls: display field select, audit toggle, view mode, granularity, aggregation mode
- main.ts creates AliasProvider (registered with StateCoordinator), PropertiesExplorer, ProjectionExplorer -- all mounted into WorkbenchShell section bodies
- PropertiesExplorer toggle changes wired to ProjectionExplorer.update() for reactive chip filtering
- 23 new tests for aggregation, displayField, and aggregation SQL; 2785 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: PAFVProvider aggregation + SuperDensityProvider displayField + SuperGridQuery aggregation SQL** - `1933e51d` (feat, TDD)
2. **Task 2: Z-plane controls DOM + main.ts full wiring** - `6d334984` (feat)

## Files Created/Modified
- `src/providers/PAFVProvider.ts` - Added setAggregation/getAggregation with validation and Tier 2 persistence
- `src/providers/SuperDensityProvider.ts` - Added setDisplayField with ALLOWED_AXIS_FIELDS validation and persistence
- `src/providers/types.ts` - Added displayField to SuperDensityState, AggregationMode type already present
- `src/views/supergrid/SuperGridQuery.ts` - Aggregation mode in buildSuperGridQuery: AGG(displayField) AS count
- `src/ui/ProjectionExplorer.ts` - Z-controls row creation, superDensity/auditState config, sync handlers
- `src/styles/projection-explorer.css` - Z-controls styling (flex row, select/button design tokens)
- `src/main.ts` - AliasProvider creation/registration, PropertiesExplorer/ProjectionExplorer mounting
- `tests/providers/PAFVProvider.test.ts` - 10 new aggregation tests
- `tests/providers/SuperDensityProvider.test.ts` - 8 new displayField tests + existing test updates
- `tests/views/supergrid/SuperGridQuery.test.ts` - 8 new aggregation SQL tests
- `tests/ui/ProjectionExplorer.test.ts` - Updated mocks with superDensity/auditState

## Decisions Made
- Aggregation SQL reuses 'count' alias (SUM(priority) AS count) to preserve backward compat with downstream cell rendering code
- Z-controls row is always visible below wells (not conditional on Z well content) for discoverability
- SuperDensityProvider displayField defaults to 'name' when missing from older serialized state
- exactOptionalPropertyTypes compatibility achieved via conditional spread in PAFVProvider.setState()
- ALLOWED_AGGREGATION_MODES validated at setAggregation() call time (not at compile/query time)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing SuperDensityProvider test assertions**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** 3 existing tests used toEqual() without displayField property, failing after adding displayField to DEFAULT_STATE
- **Fix:** Added `displayField: 'name'` to expected objects in default state, round-trip, and resetToDefaults tests
- **Files modified:** tests/providers/SuperDensityProvider.test.ts
- **Verification:** All 241 provider/query tests pass
- **Committed in:** 1933e51d (Task 1 commit)

**2. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes incompatibility**
- **Found during:** Task 1 (typecheck)
- **Issue:** PAFVProvider.setState() assigned `AggregationMode | undefined` to optional `aggregation` field, violating exactOptionalPropertyTypes
- **Fix:** Used conditional spread `...({aggregation: value} : {})` to only include field when value is valid
- **Files modified:** src/providers/PAFVProvider.ts
- **Verification:** `npx tsc --noEmit` reports zero errors in modified files
- **Committed in:** 1933e51d (Task 1 commit)

**3. [Rule 3 - Blocking] Updated ProjectionExplorer test mocks for new config**
- **Found during:** Task 2 (typecheck)
- **Issue:** ProjectionExplorerConfig now requires superDensity and auditState -- test mocks missing these
- **Fix:** Added createMockSuperDensity() and createMockAuditState() factories, added getAggregation/setAggregation to pafv mock
- **Files modified:** tests/ui/ProjectionExplorer.test.ts
- **Verification:** All 21 ProjectionExplorer tests pass
- **Committed in:** 6d334984 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for type safety and test compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 55 is now complete: all 4 plans executed (LATCH/AliasProvider, PropertiesExplorer, ProjectionExplorer, Z-Controls + Integration)
- AliasProvider, PropertiesExplorer, and ProjectionExplorer are live in the WorkbenchShell
- SuperGrid aggregation SQL pipeline is ready for end-to-end testing with real data
- Next phase can build on the complete explorer infrastructure

---
*Phase: 55-properties-projection-explorers*
*Completed: 2026-03-08*
