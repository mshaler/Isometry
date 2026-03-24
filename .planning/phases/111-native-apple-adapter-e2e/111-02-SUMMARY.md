---
phase: 111-native-apple-adapter-e2e
plan: "02"
subsystem: testing
tags: [vitest, seam-tests, etl, native-adapter, connections, auto-connections, protobuf, notestore]

requires:
  - phase: 111-01
    provides: native adapter fixture files
  - phase: 109-etl-test-infrastructure
    provides: realDb harness and seam test patterns
provides:
  - Auto-connection synthesis seam tests for Calendar attendees and Notes links
  - NoteStore schema branching boundary contract tests
  - Protobuf 3-tier fallback content preservation tests
affects: [112, 113]

tech-stack:
  added: []
  patterns: [inline makeCard factory for deterministic IDs in connection tests]

key-files:
  created:
    - tests/seams/etl/native-adapter-connections.test.ts
    - tests/seams/etl/native-adapter-notes.test.ts
  modified: []

key-decisions:
  - "Connection tests use inline makeCard with deterministic source_id instead of fixtures for precise topology assertions"
  - "Schema branching tests verify boundary contract (handler preserves Swift-provided titles) not Swift-side schema detection"
  - "Protobuf tests verify content preservation through handler (no mutation, no crash) not Swift-side extraction"

patterns-established:
  - "Connection topology assertion: query connections table then cross-reference card IDs via source_id lookup"
  - "Boundary contract testing: verify handler preserves values, not how upstream produces them"

requirements-completed: [NATV-04, NATV-05, NATV-06, NATV-07]

duration: 3min
completed: 2026-03-23
---

# Phase 111 Plan 02: Auto-Connection + Schema Branching + Protobuf Fallback Summary

**13 seam tests verifying attendee-of/note-link connection synthesis, macOS 13/14+ title preservation, and protobuf 3-tier content fallback through handleETLImportNative**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T03:05:30Z
- **Completed:** 2026-03-24T03:08:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Calendar attendee-of connections verified: single attendee, multiple attendees, orphan attendee (no crash)
- Notes bidirectional link connections verified: links_to (weight 0.5), linked_from (weight 0.3), unresolved target (no crash)
- NoteStore schema branching boundary contract: macOS 13 ZTITLE1 and macOS 14+ ZTITLE2 titles preserved through handler
- Protobuf 3-tier fallback: full body, snippet, empty string, and null all stored correctly without mutation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auto-connection synthesis seam tests** - `912c1572` (test)
2. **Task 2: Create NoteStore schema branching + protobuf fallback seam tests** - `00b60b91` (test)

## Files Created/Modified
- `tests/seams/etl/native-adapter-connections.test.ts` - 6 tests for NATV-04 (attendee) and NATV-05 (note-link)
- `tests/seams/etl/native-adapter-notes.test.ts` - 7 tests for NATV-06 (schema branching) and NATV-07 (protobuf fallback)

## Decisions Made
- Used inline `makeCard()` factory with deterministic `source_id` values for connection tests instead of fixture imports, enabling precise topology assertions via `source_id` lookup
- Schema branching tests verify the boundary contract (handler preserves titles) rather than testing Swift-side ZTITLE1/ZTITLE2 column detection
- Protobuf tests verify content preservation (no mutation, no crash) rather than Swift-side protobuf extraction
- Connection table columns confirmed as `source_id` / `target_id` (not `source_card_id` / `target_card_id` as plan template suggested)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 NATV requirements verified with 23 total tests across 3 test files
- Phase 111 complete -- ready for Phase 112 (file-based format E2E) and Phase 113 (TCC lifecycle)

---
*Phase: 111-native-apple-adapter-e2e*
*Completed: 2026-03-23*
