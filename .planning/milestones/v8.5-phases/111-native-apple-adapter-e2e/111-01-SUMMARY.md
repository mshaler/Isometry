---
phase: 111-native-apple-adapter-e2e
plan: "01"
subsystem: testing
tags: [vitest, seam-tests, etl, native-adapter, catalog-writer]

requires:
  - phase: 109-etl-test-infrastructure
    provides: realDb harness and seam test patterns
provides:
  - 3 native adapter fixture files (notes, reminders, calendar)
  - CatalogWriter provenance seam tests for all 3 native adapters
affects: [111-02, 112, 113]

tech-stack:
  added: []
  patterns: [native adapter fixture convention in tests/fixtures/native-adapter/]

key-files:
  created:
    - tests/fixtures/native-adapter/notes.json
    - tests/fixtures/native-adapter/reminders.json
    - tests/fixtures/native-adapter/calendar.json
    - tests/seams/etl/native-adapter-catalog.test.ts
  modified: []

key-decisions:
  - "notes.json card_type kept as 'note' for link card (not 'collection') to match actual handler behavior"
  - "Dynamic import for handleETLImportNative after globalThis.self mock to avoid Worker context errors"

patterns-established:
  - "globalThis.self mock pattern: set postMessage mock BEFORE dynamic import of Worker handler"
  - "Native adapter fixtures: tests/fixtures/native-adapter/{source}.json convention"

requirements-completed: [NATV-01, NATV-02, NATV-03]

duration: 3min
completed: 2026-03-23
---

# Phase 111 Plan 01: Native Adapter Fixture + CatalogWriter Provenance Summary

**3 fixture files (18 cards) + 10 seam tests verifying import_sources/import_runs/datasets catalog rows for Notes, Reminders, Calendar native adapters**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T03:02:12Z
- **Completed:** 2026-03-24T03:05:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created fixture files with representative cards for all 3 native adapters (7 notes, 5 reminders, 6 calendar)
- Notes fixtures include protobuf tier variants and note-link card with bidirectional source_url
- Calendar fixtures include 2 attendee person cards with attendee-of: source_url
- 10 passing seam tests verifying CatalogWriter provenance for all 3 adapter source types

## Task Commits

Each task was committed atomically:

1. **Task 1: Create native adapter fixture files** - `539589f6` (test) -- fixtures merged into existing commit via reset
2. **Task 2: Create CatalogWriter provenance seam tests** - `97f9c0da` (test)

## Files Created/Modified
- `tests/fixtures/native-adapter/notes.json` - 7 CanonicalCard fixtures for native_notes
- `tests/fixtures/native-adapter/reminders.json` - 5 CanonicalCard fixtures for native_reminders
- `tests/fixtures/native-adapter/calendar.json` - 6 CanonicalCard fixtures for native_calendar
- `tests/seams/etl/native-adapter-catalog.test.ts` - 10 seam tests for CatalogWriter provenance

## Decisions Made
- Used dynamic `await import()` for handleETLImportNative after establishing globalThis.self mock to avoid Worker context errors at module load time
- Fixture card_type for note-link card kept as 'note' (not 'collection' as plan suggested) to match actual handler behavior

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fixture files ready for Plan 02 connection and notes tests
- CatalogWriter provenance verified for all 3 native adapters

---
*Phase: 111-native-apple-adapter-e2e*
*Completed: 2026-03-23*
