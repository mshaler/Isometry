---
phase: 39-cloudkit-architecture
plan: 01
subsystem: database
tags: [cloudkit, icloud, sqlite, migration, entitlements]

# Dependency graph
requires:
  - phase: 14-icloud-sync
    provides: "Original iCloud ubiquity container DatabaseManager with NSFileCoordinator"
provides:
  - "Simplified DatabaseManager using Application Support only (no iCloud ubiquity logic)"
  - "CloudKit entitlement with aps-environment for CKSyncEngine push notifications"
  - "One-time reverse migration from iCloud ubiquity container to Application Support"
affects: [39-02, 39-03, 40-card-sync, 41-connection-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Application Support-only storage", "reverse ubiquity migration"]

key-files:
  created: []
  modified:
    - "native/Isometry/Isometry/DatabaseManager.swift"
    - "native/Isometry/Isometry/Isometry.entitlements"
    - "native/Isometry/Isometry/ContentView.swift"

key-decisions:
  - "Inlined saveCheckpointDirect logic into saveCheckpoint for clarity (removed indirection)"
  - "migrateFromUbiquityIfNeeded uses simple FileManager.copyItem instead of NSFileCoordinator (Application Support does not need coordination)"

patterns-established:
  - "DatabaseManager always uses Application Support/Isometry/ -- no conditional storage resolution"
  - "Background thread for url(forUbiquityContainerIdentifier:) via Task.detached"

requirements-completed: [SYNC-10]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 39 Plan 01: Database Storage Migration Summary

**Migrated database from iCloud ubiquity container to Application Support with reverse migration and CloudKit entitlements**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T03:23:59Z
- **Completed:** 2026-03-07T03:28:57Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Stripped all iCloud ubiquity logic from DatabaseManager: removed useCoordinator property, resolveStorageDirectory(), saveCheckpointCoordinated(), and all NSFileCoordinator references
- Replaced autoMigrateIfNeeded(to:) with reverse migrateFromUbiquityIfNeeded(to:) that copies database FROM iCloud ubiquity container TO Application Support (non-destructive)
- Simplified makeForProduction() to always use Application Support/Isometry/ with background migration check
- Updated entitlements: CloudDocuments -> CloudKit, ubiquity-container-identifiers -> icloud-container-identifiers, added aps-environment for push notifications
- Xcode build succeeds with no errors (65 insertions, 148 deletions -- net simplification)

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip iCloud ubiquity logic from DatabaseManager and update entitlements** - `d72d95d4` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `native/Isometry/Isometry/DatabaseManager.swift` - Simplified to Application Support-only with reverse migration
- `native/Isometry/Isometry/Isometry.entitlements` - CloudKit + aps-environment replacing CloudDocuments
- `native/Isometry/Isometry/ContentView.swift` - Updated comment for makeForProduction() usage

## Decisions Made
- Inlined the saveCheckpointDirect logic directly into saveCheckpoint() to eliminate unnecessary indirection (the useCoordinator branching is gone, so only one path exists)
- Used simple FileManager.copyItem for migration instead of NSFileCoordinator -- Application Support is local storage, no need for file coordination

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DatabaseManager is now Application Support-only, ready for CKSyncEngine integration (39-02)
- CloudKit entitlement with aps-environment declared, ready for CKSyncEngine push notifications
- icloud-container-identifiers entitlement set for CloudKit container access
- Note: Provisioning profile may need regeneration in Apple Developer Portal for CloudKit capability (pre-existing technical debt)

---
*Phase: 39-cloudkit-architecture*
*Completed: 2026-03-07*
