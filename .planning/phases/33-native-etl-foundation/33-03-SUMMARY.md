---
phase: 33-native-etl-foundation
plan: 03
subsystem: native-etl
tags: [swift, mock-adapter, import-source-picker, permission-sheet, wkwebview, bridge-manager, e2e-validation, stress-test]

# Dependency graph
requires:
  - phase: 33-01
    provides: NativeImportAdapter protocol, CanonicalCard Codable, NativeImportCoordinator, PermissionManager
  - phase: 33-02
    provides: NativeBridge chunk handler, etl:import-native worker handler, WorkerBridge.importNative()
provides:
  - MockAdapter (3-card DEBUG-only pipeline validator)
  - LargeMockAdapter (5,000-card stress test)
  - ImportSourcePickerView with greyed-out future sources
  - PermissionSheetView with trust-building copy
  - BridgeManager native:import-chunk-ack dispatch
  - ContentView Import menu with file + native import paths
  - normalizeNativeCard() fix for Swift JSONEncoder nil-skipping
affects: [34-reminders-calendar, 35-notes-adapter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MockAdapter: DEBUG-only NativeImportAdapter conforming struct for pipeline validation"
    - "ImportSourcePickerView: greyed-out future sources with #if DEBUG mock entries"
    - "PermissionSheetView: inline SwiftUI sheet with trust-building copy (ready for Phase 34+35)"
    - "normalizeNativeCard: JS-side null normalization for Swift encodeIfPresent nil-skipping"

key-files:
  created:
    - native/Isometry/Isometry/MockAdapter.swift
    - native/Isometry/Isometry/ImportSourcePickerView.swift
    - native/Isometry/Isometry/PermissionSheetView.swift
  modified:
    - native/Isometry/Isometry/BridgeManager.swift
    - native/Isometry/Isometry/ContentView.swift
    - src/native/NativeBridge.ts

key-decisions:
  - "normalizeNativeCard() added in NativeBridge.ts to convert undefined optional fields to null -- Swift JSONEncoder encodeIfPresent skips nil keys entirely"
  - "Import menu uses SwiftUI Menu to combine existing file import and new native import under one toolbar button"
  - "ImportSourcePickerView macOS sheet sizing uses minWidth/minHeight frame modifiers for proper presentation"

patterns-established:
  - "normalizeNativeCard: always normalize optional CanonicalCard fields from Swift before sql.js bind to prevent undefined bind errors"
  - "Import source picker: greyed-out sources with isAvailable flag, #if DEBUG mock entries"

requirements-completed: [FNDX-01, FNDX-05, FNDX-08]

# Metrics
duration: ~20min (across checkpoint boundary)
completed: 2026-03-06
---

# Phase 33 Plan 03: End-to-End Native ETL Pipeline Summary

**MockAdapter end-to-end validation: 3 cards flow Swift -> bridge -> Worker -> DedupEngine -> DB with dedup re-import, 5K stress test passes without WKWebView crash, normalizeNativeCard() fix for Swift JSONEncoder nil-skipping**

## Performance

- **Duration:** ~20 min (includes checkpoint pause for human verification)
- **Started:** 2026-03-06
- **Completed:** 2026-03-06
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files created:** 3
- **Files modified:** 3

## Accomplishments
- Full native ETL pipeline validated end-to-end: MockAdapter 3 cards flow from Swift through NativeImportCoordinator (200-card chunked bridge), NativeBridge (accumulation + ack), Worker (etl:import-native), DedupEngine + SQLiteWriter, and appear as cards in SuperGrid
- Re-import deduplication confirmed: second MockAdapter run produces 0 inserted, 0 updated, 3 unchanged
- 5,000-card LargeMockAdapter stress test completes without WKWebView process termination (chunked dispatch validated at scale)
- Import Source Picker UI with Reminders/Calendar/Notes greyed out as future sources and Mock/Stress Test available in DEBUG builds
- PermissionSheetView ready for Phase 34+35 wiring with trust-building copy and System Settings deep link
- Discovered and fixed Swift JSONEncoder nil-skipping bug: encodeIfPresent omits nil optional keys (producing undefined in JS), fixed with normalizeNativeCard() on TypeScript side

## Task Commits

Each task was committed atomically:

1. **Task 1: MockAdapter, ImportSourcePickerView, PermissionSheetView, BridgeManager chunk-ack** - `72a3e279` (feat)
2. **Task 2: ContentView integration -- wire import source picker and NativeImportCoordinator** - `ba449922` (feat)
3. **Task 3: Verify end-to-end native ETL pipeline with MockAdapter** - APPROVED (human-verify checkpoint)
4. **Fix: normalizeNativeCard + WebBundle rebuild + sheet sizing** - `fe0a512b` (fix)

## Files Created/Modified
- `native/Isometry/Isometry/MockAdapter.swift` - DEBUG-only MockAdapter (3 cards) and LargeMockAdapter (5,000 cards in 500-card batches) conforming to NativeImportAdapter
- `native/Isometry/Isometry/ImportSourcePickerView.swift` - Source picker sheet with greyed-out future sources and DEBUG mock entries
- `native/Isometry/Isometry/PermissionSheetView.swift` - Inline permission sheet with trust-building copy, grant/settings/cancel buttons
- `native/Isometry/Isometry/BridgeManager.swift` - Added importCoordinator property and native:import-chunk-ack case dispatch
- `native/Isometry/Isometry/ContentView.swift` - Menu-based toolbar (Import File + Import from), sheet binding, runNativeImport(), coordinator wiring
- `src/native/NativeBridge.ts` - Added normalizeNativeCard() to convert undefined optional fields to null before sql.js bind

## Decisions Made
- Swift JSONEncoder encodeIfPresent skips nil optional keys entirely, producing JSON without those keys. JavaScript sees these as undefined (not null), which causes sql.js bind errors. Fixed on the TypeScript side with normalizeNativeCard() rather than changing Swift encoding, since this is a known JSON interop gap that affects all optional CanonicalCard fields.
- ContentView uses SwiftUI Menu to combine the existing "Import File..." button with the new "Import from..." native import trigger under a single toolbar button with the same icon.
- ImportSourcePickerView on macOS needs explicit minWidth/minHeight frame modifiers for proper sheet sizing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Swift JSONEncoder encodeIfPresent skips nil optional keys**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** Swift's JSONEncoder uses encodeIfPresent for optional fields, which omits the key entirely when the value is nil. JavaScript receives the parsed JSON with those keys absent (undefined), not null. When sql.js tries to bind undefined values, it throws a bind error.
- **Fix:** Added normalizeNativeCard() function in NativeBridge.ts that iterates all CanonicalCard optional fields and explicitly sets them to null if undefined. Called on every card before passing to the worker.
- **Files modified:** src/native/NativeBridge.ts, native/Isometry/Isometry/WebBundle/ (rebuilt bundle)
- **Verification:** Re-import of 3 mock cards succeeds with 0 inserted, 0 updated, 3 unchanged. 5K stress test also passes.
- **Committed in:** fe0a512b

**2. [Rule 1 - Bug] ImportSourcePickerView macOS sheet sizing**
- **Found during:** Task 3 (human-verify checkpoint)
- **Issue:** Sheet presented without frame constraints on macOS was too small
- **Fix:** Added minWidth/minHeight frame modifiers to ImportSourcePickerView
- **Files modified:** native/Isometry/Isometry/ImportSourcePickerView.swift
- **Committed in:** fe0a512b

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** normalizeNativeCard() is essential for all future native adapters (Phase 34-36). Sheet sizing is cosmetic but necessary for usability. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 33 is now complete: all 8 FNDX requirements satisfied
- Full native ETL pipeline validated end-to-end with mock data
- normalizeNativeCard() pattern established for all future Swift adapter card output
- Phases 34 (Reminders + Calendar via EventKit) and 35 (Notes via GRDB) can proceed with confidence that the pipeline works
- PermissionSheetView is built and ready for real permission flow wiring in Phase 34+35

## Self-Check: PASSED

All 6 files verified present. All 3 commits verified in git log. SUMMARY.md exists.

---
*Phase: 33-native-etl-foundation*
*Completed: 2026-03-06*
