---
phase: 41-cloudkit-connection-sync-polish
plan: 02
subsystem: sync
tags: [cloudkit, export-all, connections, encryptedDataReset, initial-upload]

# Dependency graph
requires:
  - phase: 40-cloudkit-card-sync
    provides: "exportAllCards handler, native:export-all-cards bridge message, BridgeManager card processing"
  - phase: 41-01
    provides: "extractChangeset bug fixes, batch ordering in handleNativeSync"
provides:
  - "Extended exportAllCards: queries both cards and connections tables"
  - "Extended native:export-all-cards payload: includes connections array"
  - "BridgeManager processes connections from export-all-cards as PendingChange entries with connectionRecordType"
  - "encryptedDataReset recovery re-uploads both cards and connections"
  - "First-launch initial upload includes both cards and connections"
affects: [cloudkit-sync, connection-sync, multi-device]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Connection processing in BridgeManager mirrors card processing pattern (iterate, extract id, build CodableValue fields, queue PendingChange)"
    - "Backward-compatible payload: connections defaults to empty array if absent"

key-files:
  created: []
  modified:
    - src/native/NativeBridge.ts
    - native/Isometry/Isometry/BridgeManager.swift

key-decisions:
  - "Keep native:export-all-cards message type (extend payload rather than new message type)"
  - "Export ALL connections (not filtered by deleted_at) since connections to soft-deleted cards reference valid CKRecords"
  - "Backward-compatible: Swift defaults connections to empty array when absent from payload"

patterns-established:
  - "Export-all payload carries both entity types in a single bridge message"
  - "BridgeManager connection processing uses identical loop pattern as card processing"

requirements-completed: [SYNC-02]

# Metrics
duration: 1min
completed: 2026-03-07
---

# Phase 41 Plan 02: Export-All Extension for Connections Summary

**Extended exportAllCards and native:export-all-cards to include connections for complete data re-upload on encryptedDataReset recovery and first-launch initial upload**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-07T14:26:22Z
- **Completed:** 2026-03-07T14:27:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- exportAllCards handler now queries both `cards` (WHERE deleted_at IS NULL) and `connections` (all rows) tables
- native:export-all-cards payload extended with connections array alongside existing cards array
- BridgeManager processes each connection as a PendingChange with SyncConstants.connectionRecordType
- encryptedDataReset recovery and first-launch initial upload now re-upload complete dataset (cards + connections)
- Backward-compatible: Swift defaults connections to empty array when pre-41-02 JS sends cards only

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend exportAllCards to include connections** - `3c7355a3` (feat)
2. **Task 2: BridgeManager processes connections from export-all-cards payload** - `e9ea4c5d` (feat)

## Files Created/Modified
- `src/native/NativeBridge.ts` - Extended exportAllCards with SELECT * FROM connections query, added connections to payload, updated console.log
- `native/Isometry/Isometry/BridgeManager.swift` - Added connection processing loop in native:export-all-cards case, backward-compatible extraction, updated log messages

## Decisions Made
- Kept `native:export-all-cards` message type name (payload extension is simpler than a new message type, per CONTEXT.md Claude's discretion)
- Export ALL connections without filtering -- connections to soft-deleted cards reference valid CKRecords; if user restores a card, the connection is already synced
- Swift-side connections extraction uses `?? []` default for backward compatibility with older JS versions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both cards and connections are now fully covered by the export-all path
- CloudKit connection sync pipeline is complete end-to-end (SYNC-02)
- Phase 41 is complete: all plans executed

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 41-cloudkit-connection-sync-polish*
*Completed: 2026-03-07*
