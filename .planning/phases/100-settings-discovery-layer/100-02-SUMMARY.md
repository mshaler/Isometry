---
phase: 100-settings-discovery-layer
plan: 02
subsystem: database
tags: [sql.js, tanstack-query, facet-discovery, schema-on-read, latch-filters]

# Dependency graph
requires:
  - phase: 99-superstack-sql
    provides: SQL query execution patterns with sql.js
provides:
  - Dynamic facet value discovery from cards table
  - TanStack Query hooks with 5-minute caching
  - Multi-select facet handling via json_each
  - Generic discovery for any column
affects: [101-ui-integration, ui-components, latch-filters, property-classifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Facet value discovery from live data (schema-on-read)"
    - "TanStack Query for caching database queries"
    - "json_each for multi-select facet expansion"

key-files:
  created:
    - src/services/facet-discovery.ts
    - src/hooks/useFacetValues.ts
    - src/services/__tests__/facet-discovery.test.ts
  modified: []

key-decisions:
  - "Use sql.js synchronous queries with TanStack Query async wrapper for caching"
  - "5-minute staleTime balances freshness with query reduction"
  - "json_valid() guard prevents malformed JSON from crashing multi-select queries"
  - "Generic discoverFacetValues works for any column, not just predefined facets"

patterns-established:
  - "Facet discovery pattern: SELECT DISTINCT column, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY column ORDER BY count DESC"
  - "Multi-select pattern: CROSS JOIN json_each with json_valid guard"
  - "TanStack Query hook pattern: synchronous db.exec wrapped in async queryFn"

# Metrics
duration: 7min
completed: 2026-02-15
---

# Phase 100 Plan 02: Facet Discovery Summary

**Dynamic facet value discovery from cards table via sql.js with TanStack Query 5-minute caching**

## Performance

- **Duration:** 7 minutes
- **Started:** 2026-02-15T19:56:39Z
- **Completed:** 2026-02-15T20:04:02Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Generic facet value discovery queries for any cards table column
- Multi-select facet handling (tags) via json_each with json_valid safety guard
- TanStack Query hooks with 5-minute staleTime reduce redundant queries
- 21 integration tests with real sql.js database fixtures
- Convenience hooks: useFolderValues, useStatusValues, useTagValues

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Facet Discovery Service** - `5f617db6` (feat) - created in parallel 100-01 execution
2. **Task 2: Create useFacetValues Hook** - `213605e3` (feat)
3. **Task 3: Add Discovery Integration Tests** - `7996bae7` (test) - committed in parallel 100-01 execution

**Note:** Tasks 1 and 3 were completed by parallel execution of plan 100-01. Task 2 was executed independently.

## Files Created/Modified

- `src/services/facet-discovery.ts` - Query builders for facet value discovery with multi-select support
- `src/hooks/useFacetValues.ts` - TanStack Query hooks with 5-minute caching
- `src/services/__tests__/facet-discovery.test.ts` - 21 integration tests covering all discovery patterns

## Decisions Made

**TanStack Query wrapper for synchronous queries:**
- sql.js exec() is synchronous, but TanStack Query expects async queryFn
- Wrapped synchronous call in async function for cache key deduplication
- Rationale: Leverages TanStack Query's staleTime, gcTime, and invalidation without changing sql.js pattern

**json_valid() guard for multi-select:**
- json_each will crash on malformed JSON strings
- Added `json_valid(column)` in WHERE clause before CROSS JOIN
- Rationale: Production data may have inconsistent JSON formatting from imports

**5-minute staleTime:**
- Balances UI responsiveness with query reduction
- Folder/status/tag values don't change frequently during active sessions
- Users can manually refetch if needed
- Rationale: DISCOVER-04 requirement, informed by typical user session patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Parallel execution commit interleaving:**
- Plans 100-01 and 100-02 ran in parallel (Wave 1)
- Task 1 (facet-discovery.ts) committed in 100-01 commit 5f617db6
- Task 3 (test file) committed in 100-01 commit 7996bae7
- Only Task 2 (useFacetValues.ts) committed in dedicated 100-02 commit 213605e3
- Resolution: All files present and correct, commit attribution reflects parallel execution

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 101 (UI Integration):**
- Facet discovery hooks ready for integration into LATCHFilter.tsx
- CardDetailModal.tsx can use useFolderValues/useStatusValues for dropdowns
- Property classifier can use discovery to show only populated facets

**Provides:**
- useFolderValues() → dropdown options for folder selection
- useStatusValues() → dropdown options for status selection
- useTagValues() → multi-select tag options
- discoverFacetValues(db, column) → generic discovery for any facet

**No blockers.** Discovery queries tested with 21 integration tests covering standard, multi-select, and edge cases.

---
*Phase: 100-settings-discovery-layer*
*Completed: 2026-02-15*
