---
phase: 84-cards-and-connections
plan: 02
subsystem: types
tags: [typescript, cards, connections, lpg, type-guards]

# Dependency graph
requires:
  - phase: 84-01
    provides: DB schema for cards/connections tables
provides:
  - Card interface with discriminated union (note/person/event/resource)
  - Connection interface with viaCardId bridging
  - Type guards: isNote, isPerson, isEvent, isResource
  - Row converters: rowToCard, rowToConnection, cardToRow
  - Migration helpers: nodeToCard, deprecated Node/Edge types
affects: [84-03-data-layer, 84-04-component-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Discriminated union for card types
    - Type guards for narrowing Card to specific types
    - Row<->Object converters for SQLite roundtrip

key-files:
  created:
    - src/types/card.ts
    - src/types/__tests__/card.test.ts
  modified:
    - src/types/node.ts
    - src/types/index.ts

key-decisions:
  - "CardType constrained to 4 types (note/person/event/resource) - no expansion"
  - "Connection uses label (string) instead of edge_type enum - schema-on-read"
  - "isCollective boolean only meaningful for PersonCard"
  - "url/mimeType fields only populated for ResourceCard"

patterns-established:
  - "Type guards for discriminated unions: isNote(card) narrows to NoteCard"
  - "rowToX converters handle snake_case->camelCase transformation"
  - "cardToRow handles camelCase->snake_case for database writes"
  - "Deprecation via @deprecated JSDoc + re-exports for gradual migration"

# Metrics
duration: 4min
completed: 2026-02-13
---

# Phase 84 Plan 02: TypeScript Card/Connection Types Summary

**Discriminated union Card types with type guards, row converters, and deprecated Node migration path**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T03:08:02Z
- **Completed:** 2026-02-14T03:12:02Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Card interface with discriminated union for 4 card types (note/person/event/resource)
- Connection interface with viaCardId for rich bridging relationships
- Type guards (isNote, isPerson, isEvent, isResource) for type narrowing
- Bidirectional row converters for SQLite roundtrip (rowToCard, cardToRow)
- Deprecated Node/Edge types with migration helpers (nodeToCard)
- 15 passing tests covering all type guards and converters

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Card and Connection interfaces** - `c488d504` (feat)
2. **Task 2: Add deprecation notices to node.ts** - `85a949f7` (refactor)
3. **Task 3: Export types and add tests** - `2f1fc956` (test)

## Files Created/Modified

- `src/types/card.ts` - Card/Connection interfaces, type guards, row converters (new)
- `src/types/node.ts` - Added deprecation notices, re-exports, nodeToCard migration helper
- `src/types/index.ts` - Export new Card types from barrel
- `src/types/__tests__/card.test.ts` - 15 tests for type guards and converters (new)

## Decisions Made

1. **CardType constrained to 4 types** - No expansion beyond note/person/event/resource. Old types (task/project/notebook/contact) map to these 4.
2. **Connection uses string labels** - Schema-on-read approach vs old EdgeType enum. More flexible for user-defined relationships.
3. **SyncStatus field added** - Supports offline-first with pending/synced/conflict/error states.
4. **isCollective only for PersonCard** - Boolean distinguishes individuals from organizations/groups.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed isolatedModules export error**
- **Found during:** Task 2 (updating node.ts)
- **Issue:** TypeScript error: "Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'"
- **Fix:** Changed `export { Card, CardType, Connection }` to `export type { Card, CardType, Connection }`
- **Files modified:** src/types/node.ts
- **Verification:** npm run typecheck passes
- **Committed in:** 85a949f7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor TypeScript syntax fix. No scope creep.

## Issues Encountered
None - all verifications passed on first attempt after the isolatedModules fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Card/Connection types ready for use in data layer (84-03)
- Type guards enable safe narrowing in component code
- Row converters ready for SQLite integration
- Migration path documented for gradual Node->Card transition

## Self-Check: PASSED

All files verified to exist:
- src/types/card.ts
- src/types/__tests__/card.test.ts
- src/types/node.ts
- src/types/index.ts

All commits verified:
- c488d504
- 85a949f7
- 2f1fc956

---
*Phase: 84-cards-and-connections*
*Completed: 2026-02-13*
