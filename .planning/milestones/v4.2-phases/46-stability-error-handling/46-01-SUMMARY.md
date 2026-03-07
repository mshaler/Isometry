---
phase: 46-stability-error-handling
plan: 01
subsystem: ui
tags: [error-handling, error-banner, json-parser, user-feedback]

# Dependency graph
requires:
  - phase: 05-view-manager
    provides: ViewManager._showError() method and view-error-banner CSS
  - phase: 09-json-parser
    provides: JSONParser.extractNestedArray() and parse() pipeline
provides:
  - ErrorBanner utility with categorizeError() and createErrorBanner() exports
  - Categorized error display in ViewManager (5 categories with recovery actions)
  - JSONParser unrecognized structure warning with key listing
affects: [46-stability-error-handling, error-handling, import-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [error-categorization-by-pattern-matching, structured-error-banners]

key-files:
  created:
    - src/ui/ErrorBanner.ts
    - tests/ui/ErrorBanner.test.ts
  modified:
    - src/views/ViewManager.ts
    - src/styles/views.css
    - src/etl/parsers/JSONParser.ts
    - tests/etl/parsers/JSONParser.test.ts

key-decisions:
  - "Error category ordering: parse > database > network > import > unknown (first match wins)"
  - "Case-insensitive regex pattern matching for error categorization"
  - "JSONParser unrecognized structure check compares keys against all HEADER_SYNONYMS values"

patterns-established:
  - "ErrorBanner pattern: categorizeError() + createErrorBanner() for consistent user-facing error display"

requirements-completed: [STAB-01, STAB-03]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 46 Plan 01: Error Categorization + JSONParser Warning Summary

**ErrorBanner utility with 5-category auto-classification (parse/database/network/import/unknown) and JSONParser unrecognized structure warning listing actual top-level keys**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T19:40:12Z
- **Completed:** 2026-03-07T19:44:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created ErrorBanner utility with categorizeError() and createErrorBanner() functions
- Replaced raw error strings in ViewManager._showError() with categorized user-friendly banners
- Added unrecognized JSON structure warning to JSONParser that lists actual top-level keys found
- 40 total tests across both test suites (20 ErrorBanner + 20 JSONParser)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ErrorBanner utility with auto-categorization** - `0a86b01b` (feat)
2. **Task 2: Add unrecognized structure warning to JSONParser** - `cfa277de` (feat)

_Note: Both tasks followed TDD (red-green) cycle_

## Files Created/Modified
- `src/ui/ErrorBanner.ts` - Error categorization logic and banner DOM creation (categorizeError, createErrorBanner)
- `tests/ui/ErrorBanner.test.ts` - 20 unit tests for categorization patterns and DOM rendering
- `src/views/ViewManager.ts` - Updated _showError() to use ErrorBanner utilities instead of raw message display
- `src/styles/views.css` - Added .error-category and .error-detail styles, stacked banner layout
- `src/etl/parsers/JSONParser.ts` - extractNestedArray warns on unrecognized structure with key listing
- `tests/etl/parsers/JSONParser.test.ts` - 5 new tests for unrecognized structure warning behavior

## Decisions Made
- Error categories ordered parse > database > network > import to prioritize specific patterns before generic ones (e.g., "database connection" matches database, not network)
- Used word-boundary regex (\b) for short patterns like "db:", "table", "column", "load" to avoid false matches
- JSONParser warning checks against all HEADER_SYNONYMS values (title, name, content, body, etc.) to distinguish valid single-card objects from unrecognized config-like structures

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ErrorBanner utility ready for use across any component that shows error messages
- JSONParser warning provides actionable feedback for users importing non-standard JSON
- Ready for Phase 46 Plan 02 (remaining stability requirements)

---
*Phase: 46-stability-error-handling*
*Completed: 2026-03-07*
