---
phase: 84-cards-and-connections
plan: 03
subsystem: database
tags: [sql.js, cards, connections, etl, hooks, filters, pafv]

# Dependency graph
requires:
  - phase: 84-01
    provides: "cards, connections, card_properties tables with FTS5 and migration script"
  - phase: 84-02
    provides: "Card/Connection TypeScript types with rowToCard/rowToConnection converters"
provides:
  - "Database hooks (useFTS5Search, useLiveCards) querying cards table"
  - "Filter compiler using cards_fts and card_type column"
  - "ETL insertion into cards table with nodeType->cardType mapping"
  - "PAFV projection hooks using cards table"
  - "SuperGridEngine DataManager using cards table"
affects: [84-04, supergrid, notebook, visualization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cards table as primary data store (replacing nodes)"
    - "card_type discriminated union mapping from nodeType"
    - "card_properties EAV pattern for extensibility"

key-files:
  created: []
  modified:
    - "src/hooks/database/useFTS5Search.ts"
    - "src/hooks/database/useLiveQueryVariants.ts"
    - "src/hooks/database/useLiveQuery.ts"
    - "src/filters/compiler.ts"
    - "src/etl/types/canonical.ts"
    - "src/etl/database/insertion.ts"
    - "src/etl/database/__tests__/insertion.test.ts"
    - "src/d3/SuperGridEngine/DataManager.ts"
    - "src/hooks/database/usePAFVProjection.ts"
    - "src/test/db-utils.ts"

key-decisions:
  - "useLiveNodes deprecated, new useLiveCards added as replacement"
  - "ETL insertion keeps insertCanonicalNodes name but inserts into cards"
  - "Legacy insertCanonicalNodesLegacy added for backward compat"
  - "Test schema updated with cards/connections tables for test isolation"

patterns-established:
  - "FTS5 queries use cards_fts virtual table"
  - "Hierarchy CTE uses connections.label='parent' (replaces edges.edge_type='NEST')"
  - "Card type mapping: note/task/document->note, person/contact->person, event/meeting->event, resource/link/file->resource"

# Metrics
duration: 7min
completed: 2026-02-14
---

# Phase 84 Plan 03: Data Layer Migration Summary

**Database hooks, filter compiler, and ETL updated to query/insert cards table with nodeType-to-cardType mapping**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-14T03:15:55Z
- **Completed:** 2026-02-14T03:22:56Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- useFTS5Search now queries cards_fts and returns Card type with rank
- useLiveCards added as new canonical hook, useLiveNodes deprecated
- Filter compiler updated: cards_fts for search, card_type for category, connections for hierarchy CTE
- ETL insertCanonicalNodes now inserts into cards with nodeType->cardType mapping
- PAFV projection hooks (usePAFVProjection, useAxisValues, useTimeProjection) use cards table
- SuperGridEngine DataManager executeGridQuery uses cards table
- Test schema in db-utils.ts extended with cards, connections, card_properties tables

## Task Commits

Each task was committed atomically:

1. **Task 1: Update database hooks and filters to use cards table** - `da2dd505` (feat)
2. **Task 2: Update ETL insertion to use cards table** - `f30d0a2c` (feat)
3. **Task 3: Update query services and fix remaining Node references** - `ad3a4092` (feat)

## Files Created/Modified

**Task 1:**
- `src/hooks/database/useFTS5Search.ts` - FTS5 search using cards_fts, Card type
- `src/hooks/database/useLiveQueryVariants.ts` - Added useLiveCards, deprecated useLiveNodes
- `src/hooks/database/useLiveQuery.ts` - Re-export useLiveCards
- `src/filters/compiler.ts` - FTS5 filter uses cards_fts, category uses card_type, hierarchy CTE uses connections

**Task 2:**
- `src/etl/types/canonical.ts` - Added CARDS_SQL_COLUMNS, mapNodeTypeToCardType, toCardsSQLRecord
- `src/etl/database/insertion.ts` - insertCanonicalNodes inserts into cards, uses card_properties
- `src/etl/database/__tests__/insertion.test.ts` - Tests verify cards table and card_type mapping
- `src/test/db-utils.ts` - Test schema extended with cards, connections, card_properties tables

**Task 3:**
- `src/d3/SuperGridEngine/DataManager.ts` - executeGridQuery uses cards table
- `src/hooks/database/usePAFVProjection.ts` - All projection queries use cards table

## Decisions Made
- **useLiveNodes kept as deprecated shim**: Rather than removing, useLiveNodes now delegates to cards table query internally. This allows gradual migration of consumers.
- **insertCanonicalNodes name retained**: Function name unchanged but behavior updated. Added insertCanonicalNodesLegacy for explicit nodes table insertion if needed.
- **Test schema parallel tables**: Test db-utils creates both nodes and cards tables so existing tests don't break during migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed useLiveQuery type export issues**
- **Found during:** Task 1 (database hooks update)
- **Issue:** useLiveQuery.ts exported non-existent types (QueryCacheInfo, BackgroundSyncConfig, ConnectionStateConfig)
- **Fix:** Removed invalid exports, kept only types defined in ./types
- **Files modified:** src/hooks/database/useLiveQuery.ts
- **Verification:** npm run typecheck passes
- **Committed in:** da2dd505 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed FTS5Result interface extending union type**
- **Found during:** Task 1 (useFTS5Search update)
- **Issue:** Interface cannot extend union type (Card is discriminated union)
- **Fix:** Changed to intersection type: `type FTS5Result = Card & { rank: number }`
- **Files modified:** src/hooks/database/useFTS5Search.ts
- **Verification:** npm run typecheck passes
- **Committed in:** da2dd505 (Task 1 commit)

**3. [Rule 3 - Blocking] Added cards/card_properties tables to test schema**
- **Found during:** Task 2 (ETL insertion tests)
- **Issue:** Tests failed with "no such table: cards" because test db-utils only had nodes schema
- **Fix:** Added full cards, connections, card_properties CREATE TABLE statements to test schema
- **Files modified:** src/test/db-utils.ts
- **Verification:** npm run test src/etl/database/__tests__/insertion.test.ts passes (11/11)
- **Committed in:** f30d0a2c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all blocking issues)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation and test execution. No scope creep.

## Issues Encountered
None - plan executed as specified with blocking issues auto-fixed per deviation rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core data access layer migrated to cards/connections
- Ready for 84-04: UI component updates to use Card types
- Many files still reference nodes table (tests, examples, less critical paths)
- These will be addressed in 84-04 or as cleanup in Phase 85

## Self-Check: PASSED

All files verified:
- useFTS5Search.ts: Uses FROM cards
- useLiveQueryVariants.ts: Contains useLiveCards function
- compiler.ts: Uses cards_fts for FTS5 queries
- insertion.ts: Inserts into cards table with card_type mapping

All commits verified: da2dd505, f30d0a2c, ad3a4092

---
*Phase: 84-cards-and-connections*
*Plan: 03*
*Completed: 2026-02-14*
