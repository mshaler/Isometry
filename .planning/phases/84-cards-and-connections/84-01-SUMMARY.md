---
phase: 84-cards-and-connections
plan: 01
subsystem: database
tags: [sqlite, sql.js, migration, cards, connections, fts5, schema]

# Dependency graph
requires:
  - phase: none
    provides: baseline nodes/edges schema
provides:
  - cards table with 4-type CHECK constraint (note, person, event, resource)
  - connections table with via_card_id for bridge relationships
  - cards_fts FTS5 virtual table with sync triggers
  - card_properties table for dynamic properties
  - Migration script for nodes/edges to cards/connections
  - Backup tables (nodes_backup, edges_backup) for rollback
affects: [84-02, 84-03, 84-04, etl-pipeline, supergrid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "4-type card_type constraint with CHECK"
    - "via_card_id for intermediated connections"
    - "Lowercase labels for connections (schema-on-read)"
    - "Backup tables for migration rollback safety"

key-files:
  created:
    - src/db/migrations/84-cards-connections.sql
    - src/db/__tests__/cards-migration.test.ts
  modified:
    - src/db/schema.sql

key-decisions:
  - "12 node_types consolidated to 4 card_types (note, person, event, resource)"
  - "edge_type removed - labels are schema-on-read with lowercase convention"
  - "via_card_id enables bridge cards (e.g., 'met at' an event)"
  - "Deprecated columns removed: location_address, importance, grid_x/y, source_url"
  - "New columns added: url, mime_type, is_collective, sync_status"

patterns-established:
  - "Card type mapping: note/document/task/project -> note; person/contact -> person; event/meeting -> event; resource/link/file/image -> resource"
  - "Edge type to label: LINK -> link; NEST -> parent; SEQUENCE -> precedes; AFFINITY -> related"

# Metrics
duration: 5min
completed: 2026-02-14
---

# Phase 84 Plan 01: Schema Foundation Summary

**New cards/connections schema with 4-type constraint, via_card_id bridging, migration script with backups, and 24 passing tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-14T03:07:59Z
- **Completed:** 2026-02-14T03:12:48Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created cards table with CHECK constraint enforcing 4 types only (note, person, event, resource)
- Created connections table with via_card_id for bridge relationships (replaces edges)
- Created comprehensive migration script with type mapping and backup tables
- Added 24 passing tests covering type mapping, column changes, and label conversion

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cards and connections tables in schema.sql** - `c488d504` (feat - completed in prior session)
2. **Task 2: Create migration script with data transformation** - `61758d25` (feat)
3. **Task 3: Write migration test to verify data integrity** - `11e45da6` (test)

**Plan metadata:** See final commit

## Files Created/Modified

- `src/db/schema.sql` - Added cards, connections, card_properties, cards_fts tables with all indexes
- `src/db/migrations/84-cards-connections.sql` - Migration script with type mapping, label conversion, backups
- `src/db/__tests__/cards-migration.test.ts` - 24 tests covering migration logic

## Decisions Made

1. **Type consolidation:** Mapped 12 legacy node_types to 4 card_types for cleaner semantics
2. **Schema-on-read labels:** Removed edge_type enum, labels are now user-provided strings (lowercase convention)
3. **Bridge cards via via_card_id:** Connections can reference a third card as context (e.g., "met at" an event)
4. **Column cleanup:** Removed deprecated columns (location_address, importance, grid_x/y, source_url)
5. **New capabilities:** Added url/mime_type for Resources, is_collective for Persons, sync_status for conflict resolution

## Deviations from Plan

None - plan executed exactly as written.

Note: Task 1 schema changes were partially completed in a prior session (commit c488d504), discovered during execution. The schema was already correct, so no additional changes were needed.

## Issues Encountered

- Schema was already committed in prior session with 84-02 label - verified completeness and continued with remaining tasks
- This is minor commit labeling inconsistency, not a functional issue

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema foundation complete, ready for Plan 02 (TypeScript interfaces)
- cards/connections tables exist with all constraints and indexes
- Migration script ready to run on existing databases
- Test suite validates migration logic works correctly

## Self-Check: PASSED

All files verified:
- FOUND: src/db/schema.sql
- FOUND: src/db/migrations/84-cards-connections.sql
- FOUND: src/db/__tests__/cards-migration.test.ts

All commits verified:
- FOUND: c488d504 (Task 1)
- FOUND: 61758d25 (Task 2)
- FOUND: 11e45da6 (Task 3)

---
*Phase: 84-cards-and-connections*
*Completed: 2026-02-14*
