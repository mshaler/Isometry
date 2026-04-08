---
phase: 93-property-editors
plan: 01
subsystem: utils
tags: [coercion, typescript, tdd, worker, protocol]

# Dependency graph
requires:
  - phase: 91-mutationmanager-notebook-migration
    provides: updateCardMutation pattern with Partial<CardInput>
provides:
  - coerceFieldValue pure function converting raw input values to correct SQL types
  - isCoercionError type guard for validation error detection
  - card_type editable through card:update Worker message path
affects: [93-02, 94-card-dimension-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Field classification constant arrays (NULLABLE_TEXT_FIELDS, DATE_FIELDS, etc.) for type-safe coercion dispatch
    - CoercionResult discriminated union — unknown | { error: string } with isCoercionError type guard

key-files:
  created:
    - src/utils/card-coerce.ts
    - tests/utils/card-coerce.test.ts
  modified:
    - src/worker/protocol.ts

key-decisions:
  - "isCoercionError uses Array.isArray() guard to prevent false positives on tag arrays (which are objects)"
  - "NON_NULLABLE_NUMBER_FIELDS default to 0 on empty string — priority and sort_order always have a numeric value"
  - "card_type Omit restriction removed from WorkerPayloads['card:update'] — updateCardMutation already accepts it without restriction"

patterns-established:
  - "src/utils/ module for standalone pure utility functions (no class, no imports from providers)"
  - "tests/utils/ mirrors src/utils/ directory structure"

requirements-completed: [PROP-07, PROP-09]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 93 Plan 01: Coercion Utility + Protocol Lift Summary

**Pure coerceFieldValue function with 37 TDD tests covering all 26 card field types, plus card_type unlocked from card:update Worker protocol**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T03:37:19Z
- **Completed:** 2026-03-19T03:41:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `src/utils/card-coerce.ts` — standalone pure function converting raw input values to SQL-compatible types for all 26 card fields
- `isCoercionError` type guard correctly excludes arrays (which are objects) from error detection
- `src/worker/protocol.ts` — removed `Omit<CardInput, 'card_type'>` restriction; card_type is now editable through the standard update path
- 37 tests covering all field categories: nullable text, name validation, dates, nullable numbers, non-nullable numbers, booleans, card_type, tags

## Task Commits

1. **Task 1: coerceFieldValue utility with TDD** - `e37cf8a5` (feat)
2. **Task 2: Lift card_type restriction from card:update protocol** - `7e6812c3` (feat)

## Files Created/Modified
- `src/utils/card-coerce.ts` — Pure coercion function with field classification constants and isCoercionError type guard
- `tests/utils/card-coerce.test.ts` — 37 tests across 8 describe blocks covering every field category
- `src/worker/protocol.ts` — Removed Omit<CardInput, 'card_type'> from WorkerPayloads['card:update']

## Decisions Made
- `isCoercionError` uses `!Array.isArray(result)` guard to prevent tag arrays (`['a', 'b']`) from matching as error objects (both are non-null objects)
- NON_NULLABLE_NUMBER_FIELDS (priority, sort_order) default to `0` on empty string — consistent with schema NOT NULL defaults
- Pre-existing TypeScript errors in main.ts, SuperGrid.ts, and test files are out of scope — not introduced by this plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors exist in main.ts (activeDataset property), SuperGrid.ts (send method on SuperGridBridgeLike), and seam test files — none introduced by this plan, all out of scope per deviation rules.

## Next Phase Readiness
- `coerceFieldValue` ready for use in Plan 93-02 (CardPropertyFields component)
- `isCoercionError` guards inline validation feedback rendering
- card:update protocol accepts card_type — dropdown select change can call updateCardMutation directly

---
*Phase: 93-property-editors*
*Completed: 2026-03-19*
