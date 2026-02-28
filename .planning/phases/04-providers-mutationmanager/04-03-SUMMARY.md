---
phase: 04-providers-mutationmanager
plan: 03
subsystem: ui
tags: [providers, pafv, axis, view-family, density, sql, strftime, persistence]

# Dependency graph
requires:
  - phase: 04-01
    provides: "FilterProvider, types.ts (AxisField, ViewType, ViewFamily, AxisMapping, CompiledAxis, CompiledDensity, PersistableProvider), allowlist.ts (validateAxisField, ALLOWED_AXIS_FIELDS)"
provides:
  - "PAFVProvider: axis mapping to ORDER BY/GROUP BY SQL fragments"
  - "PAFVProvider: view family suspension/restoration (LATCH<->GRAPH) via structuredClone"
  - "PAFVProvider: getViewFamily() helper classifying ViewType to ViewFamily"
  - "DensityProvider: all 5 time granularities compiled to strftime() SQL expressions"
  - "DensityProvider: timeField switching (created_at/modified_at/due_at)"
  - "Both providers: subscribe/unsubscribe with queueMicrotask batching"
  - "Both providers: Tier 2 PersistableProvider (toJSON/setState/resetToDefaults)"
affects: [04-05-QueryBuilder, 05-views, 06-time-views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VIEW_DEFAULTS map: ViewType → default PAFVState (kanban gets groupBy status)"
    - "STRFTIME_PATTERNS map: TimeGranularity → (field: string) => string"
    - "structuredClone for suspended state deep copy (prevents reference aliasing)"
    - "suspendedStates: Map<ViewFamily, PAFVState> keyed by family"
    - "queueMicrotask batching with pendingNotify guard (identical to FilterProvider)"
    - "compile() re-validates all fields: handles JSON-restored invalid state"

key-files:
  created:
    - src/providers/PAFVProvider.ts
    - src/providers/DensityProvider.ts
    - tests/providers/PAFVProvider.test.ts
    - tests/providers/DensityProvider.test.ts
  modified: []

key-decisions:
  - "PAFVProvider suspends state via structuredClone (CONTEXT.md locked — no reference aliasing)"
  - "VIEW_DEFAULTS per view type: kanban defaults to groupBy status, all others default to no axes"
  - "DensityProvider allows only 3 timeFields: created_at/modified_at/due_at (not the full AxisField union)"
  - "setState() in DensityProvider validates both timeField and granularity (unlike PAFVProvider which defers to compile())"
  - "compile() in PAFVProvider validates axis fields at compile time — handles JSON-restored state"

patterns-established:
  - "STRFTIME_PATTERNS: lazy factory pattern — function receives field name, returns SQL expression"
  - "Quarter pattern: strftime('%Y') || '-Q' || ((CAST(strftime('%m') AS INT) - 1) / 3 + 1)"
  - "Cross-family suspension: structuredClone before setting new family state"

requirements-completed: [PROV-03, PROV-04, PROV-07, PROV-08]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 4 Plan 03: PAFVProvider + DensityProvider Summary

**PAFVProvider compiling LATCH axes to ORDER BY/GROUP BY SQL with LATCH/GRAPH family suspension via structuredClone, and DensityProvider compiling all 5 time granularities to strftime() GROUP BY expressions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T20:15:25Z
- **Completed:** 2026-02-28T20:18:47Z
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments
- PAFVProvider: setXAxis/setYAxis/setGroupBy compile to `field ASC/DESC` fragments (no SQL keywords — QueryBuilder adds those)
- PAFVProvider: LATCH↔GRAPH family crossing suspends active state via structuredClone, restores on return
- PAFVProvider: VIEW_DEFAULTS map with per-view-type defaults (kanban: groupBy status)
- DensityProvider: all 5 granularities (day/week/month/quarter/year) produce correct strftime() expressions
- DensityProvider: quarter pattern uses integer division `(CAST('%m' AS INT) - 1) / 3 + 1` for Q1-Q4
- Both providers: queueMicrotask batching identical to FilterProvider (established pattern)
- Both providers: Tier 2 PersistableProvider with toJSON/setState/resetToDefaults
- 74 new tests added (42 PAFVProvider + 32 DensityProvider); all 217 provider tests pass

## Task Commits

Each TDD task had two commits (RED test → GREEN implementation):

1. **Task 1 RED: PAFVProvider failing tests** - `c4a4016` (test)
2. **Task 1 GREEN: PAFVProvider implementation** - `8392aa0` (feat)
3. **Task 2 RED: DensityProvider failing tests** - `0351d1e` (test)
4. **Task 2 GREEN: DensityProvider implementation** - `fb307d1` (feat)

_TDD: each implementation preceded by failing test commit_

## Files Created/Modified
- `src/providers/PAFVProvider.ts` - Axis mapping, view family suspension/restoration, SQL fragment compilation
- `src/providers/DensityProvider.ts` - Time granularity state, strftime() expression compilation
- `tests/providers/PAFVProvider.test.ts` - 42 tests: axis SQL, family suspension, deep copy isolation, subscribe, serialization
- `tests/providers/DensityProvider.test.ts` - 32 tests: all 5 granularities, timeField switching, validation, subscribe, serialization

## Decisions Made
- **VIEW_DEFAULTS with kanban defaults**: kanban defaults to `groupBy: { field: 'status', direction: 'asc' }` since it always groups by status. All other views default to null axes. This was inferred from the domain — plan specified "kanban defaults to groupBy status" in VIEW_DEFAULTS note.
- **DensityProvider setState validates both fields eagerly**: Unlike PAFVProvider (which defers axis validation to compile()), DensityProvider validates timeField and granularity in setState(). Rationale: the valid set is small and fixed; eager validation gives clearer error messages for corrupt persisted state.
- **compile() in PAFVProvider re-validates axis fields**: Handles JSON-restored state that bypassed setters — consistent with FilterProvider double-validation pattern.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — both implementations compiled cleanly on first attempt with no TypeScript errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PAFVProvider ready for QueryBuilder (Plan 05) to compose into full SELECT statements
- DensityProvider ready for time-based views (Calendar, Timeline, Gallery)
- Both providers expose compile() that returns raw SQL fragments (no SQL keywords) — QueryBuilder adds ORDER BY/GROUP BY keywords
- index.ts not updated per plan note — Plan 04 (StateCoordinator) or Plan 05 (QueryBuilder) will add re-exports

---
*Phase: 04-providers-mutationmanager*
*Completed: 2026-02-28*

## Self-Check: PASSED

- FOUND: src/providers/PAFVProvider.ts
- FOUND: src/providers/DensityProvider.ts
- FOUND: tests/providers/PAFVProvider.test.ts
- FOUND: tests/providers/DensityProvider.test.ts
- FOUND: .planning/phases/04-providers-mutationmanager/04-03-SUMMARY.md
- FOUND commit c4a4016: test(04-03) PAFVProvider RED
- FOUND commit 8392aa0: feat(04-03) PAFVProvider GREEN
- FOUND commit 0351d1e: test(04-03) DensityProvider RED
- FOUND commit fb307d1: feat(04-03) DensityProvider GREEN
