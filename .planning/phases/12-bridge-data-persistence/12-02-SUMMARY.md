---
phase: 12-bridge-data-persistence
plan: 02
subsystem: database
tags: [swift, actor, sqlite, file-io, persistence, atomic-write, backup-rotation]

# Dependency graph
requires:
  - phase: 12-bridge-data-persistence plan 01
    provides: BridgeManager actor stub that references DatabaseManager for checkpoint saves

provides:
  - DatabaseManager actor with load/save/atomic write/backup rotation and dirty flag
  - Test-isolated DatabaseManager via baseDirectory initializer
  - Corruption cascade recovery: try .db → try .bak → return nil

affects:
  - 12-bridge-data-persistence plan 03 (ContentView wires BridgeManager to DatabaseManager)
  - 12-bridge-data-persistence plan 04 (lifecycle checkpoint triggering)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Swift Actor for serialized file I/O — actor DatabaseManager provides natural thread safety"
    - "Atomic rename pattern: write .tmp → rotate .db to .bak → rename .tmp to .db"
    - "Corruption cascade: primary → backup → nil (fresh start)"
    - "Test-isolated actor via baseDirectory init accepting any URL"
    - "isDirty flag inside actor — single source of truth for unsaved-changes state"

key-files:
  created:
    - native/Isometry/Isometry/DatabaseManager.swift
    - native/Isometry/IsometryTests/DatabaseManagerTests.swift
  modified:
    - native/Isometry/IsometryTests/BridgeManagerTests.swift

key-decisions:
  - "Two init pattern: production init() uses Application Support/Isometry/, test init(baseDirectory:) accepts any URL for isolation"
  - "Corruption cascade: try .db first, fall back to .bak, return nil — never throws on missing file"
  - "isDirty is actor-isolated — BridgeManager.isDirty delegates to databaseManager?.isDirty ?? false"
  - ".tmp write does NOT use .atomic option — we own the rename sequence ourselves for rotation"
  - "File NOT excluded from iCloud backup — isExcludedFromBackup=false, user data survives device restore"

patterns-established:
  - "Actor-based file I/O: all FileManager calls inside DatabaseManager actor, never called from outside without await"
  - "Atomic checkpoint: write new data to .tmp, rotate .db → .bak, rename .tmp → .db"
  - "Test isolation via unique temp directory (UUID in path) — each test gets a fresh dir in setUp, cleaned in tearDown"

requirements-completed: [DATA-01, DATA-02, DATA-03]

# Metrics
duration: 9min
completed: 2026-03-03
---

# Phase 12 Plan 02: DatabaseManager Summary

**Actor-based SQLite file persistence with atomic checkpoint writes and corruption cascade recovery, enabling sql.js database survival across app sessions**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-03T16:27:17Z
- **Completed:** 2026-03-03T16:36:03Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 3

## Accomplishments
- DatabaseManager Swift actor with loadDatabase(), saveCheckpoint(), isDirty, markDirty(), clearDirty()
- Atomic checkpoint write pattern: .tmp write → .db rotates to .bak → .tmp renames to .db
- Corruption cascade recovery: try primary .db, fall back to .bak, return nil for first launch
- Two initializers: production (Application Support/Isometry/) and test-isolated (custom baseDirectory)
- 10 XCTests covering all behaviors with isolated temp directories (no shared state between tests)
- Removed DatabaseManager stub from BridgeManager.swift, replaced with real implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DatabaseManager actor with load, save, and backup rotation** - `ccbcf96e` (feat)

**Plan metadata:** _(final docs commit follows)_

_Note: TDD task — tests written first (RED), then implementation (GREEN), single commit captures both._

## Files Created/Modified
- `native/Isometry/Isometry/DatabaseManager.swift` - Actor with loadDatabase(), saveCheckpoint(), isDirty, markDirty(), clearDirty()
- `native/Isometry/IsometryTests/DatabaseManagerTests.swift` - 10 XCTests covering load, save, atomic write, backup rotation, dirty flag
- `native/Isometry/IsometryTests/BridgeManagerTests.swift` - Added @MainActor to fix actor isolation compile error (Rule 3 fix)

## Decisions Made
- Two init pattern allows the same actor to serve production (Application Support) and test (temp dir) contexts
- isDirty lives inside the actor as the single source of truth — BridgeManager delegates to it, never maintains its own flag
- .tmp write doesn't use `.atomic` option because we need to control the .db → .bak rotation step ourselves

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @MainActor to BridgeManagerTests to fix actor isolation compile error**
- **Found during:** Task 1 (GREEN phase — first build attempt)
- **Issue:** BridgeManagerTests.swift (from Plan 12-01) called `@MainActor`-isolated BridgeManager.init() and properties from non-isolated test functions — Swift 6 actor isolation error blocked compilation
- **Fix:** Added `@MainActor` attribute to `struct BridgeManagerTests`. Linter also improved `didReceive_unknownType_doesNotCrash()` to use proper async/await instead of DispatchSemaphore.
- **Files modified:** `native/Isometry/IsometryTests/BridgeManagerTests.swift`
- **Verification:** All BridgeManagerTests pass after fix; DatabaseManagerTests compile and pass
- **Committed in:** `ccbcf96e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary for compilation — BridgeManagerTests from Plan 12-01 needed @MainActor annotation. No scope creep.

## Issues Encountered
- BridgeManager.swift already existed with full Plan 12-01 implementation (including stub removal comment) — no cleanup needed beyond adding @MainActor to BridgeManagerTests

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DatabaseManager actor is complete and tested
- BridgeManager already holds `var databaseManager: DatabaseManager?` — Plan 12-03 wires it up in ContentView
- Checkpoint flow is ready: BridgeManager.didReceive("checkpoint") → databaseManager.saveCheckpoint(data)
- Load flow is ready: BridgeManager.sendLaunchPayload() → databaseManager.loadDatabase()

## Self-Check: PASSED

- FOUND: `native/Isometry/Isometry/DatabaseManager.swift`
- FOUND: `native/Isometry/IsometryTests/DatabaseManagerTests.swift`
- FOUND: `.planning/phases/12-bridge-data-persistence/12-02-SUMMARY.md`
- FOUND: commit `ccbcf96e` (feat(12-02): implement DatabaseManager actor with atomic checkpoint writes)
- All 10 DatabaseManagerTests passing

---
*Phase: 12-bridge-data-persistence*
*Completed: 2026-03-03*
