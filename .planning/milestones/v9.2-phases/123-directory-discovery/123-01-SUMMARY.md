---
phase: 123-directory-discovery
plan: 01
subsystem: native
tags: [swift, wkwebview, nsopenpanel, fileimporter, bridge, alto-index]

requires:
  - phase: 122-supergrid-convergence
    provides: stable BridgeManager message dispatch pattern and NativeImportAdapter protocol

provides:
  - AltoIndexAdapter.discoverSubdirectories(in:) static method enumerating 11 known subdirectory types
  - BridgeManager.sendAltoDiscoveryResult() outgoing native:alto-discovery bridge message
  - BridgeManager handles native:request-alto-discovery incoming message via NotificationCenter
  - ContentView NSOpenPanel (macOS) and .fileImporter for .folder (iOS) directory picker flow
  - ContentView.discoverAltoIndex(at:) with security-scoped resource access

affects:
  - 123-directory-discovery/123-02 (JS side DirectoryDiscoverySheet consuming native:alto-discovery)
  - 124-selective-import-partitioning (will use selected subdirectory paths from discovery result)

tech-stack:
  added: []
  patterns:
    - "NotificationCenter-bridged picker: BridgeManager posts notification → ContentView onChange opens panel"
    - "Security-scoped resource access: startAccessingSecurityScopedResource() + defer stopAccessing"
    - "Bridge outgoing: JSONSerialization dict → jsonString → evaluateJavaScript pattern"

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/AltoIndexAdapter.swift
    - native/Isometry/Isometry/BridgeManager.swift
    - native/Isometry/Isometry/ContentView.swift
    - native/Isometry/Isometry/SettingsView.swift

key-decisions:
  - "alto_index case in runNativeImport now redirects to directory picker instead of direct import — discovery-first flow per DISC-01"
  - "Directory picker wired via onChange(of: showingAltoDirectoryPicker) rather than .sheet to keep NSOpenPanel on main thread"
  - "pickAltoDirectory notification allows JS (via native:request-alto-discovery) and native UI (Import menu) to both trigger picker"

patterns-established:
  - "DISC pattern: JS sends native:request-alto-discovery → BridgeManager posts notification → ContentView opens picker → discoverAltoIndex → sendAltoDiscoveryResult → JS receives native:alto-discovery"

requirements-completed: [DISC-01, DISC-02]

duration: 3min
completed: 2026-03-26
---

# Phase 123 Plan 01: Directory Discovery Summary

**NSOpenPanel/fileImporter directory picker with AltoIndexAdapter.discoverSubdirectories() returning 11 known subdirectory types via native:alto-discovery bridge message**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T00:24:18Z
- **Completed:** 2026-03-26T00:27:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- AltoIndexAdapter gains a `discoverSubdirectories(in:)` static method that checks all 11 known subdirectory types via `FileManager.fileExists(atPath:isDirectory:)` and returns found entries as (name, cardType, path) tuples
- BridgeManager sends `native:alto-discovery` JSON payload (rootPath, rootName, subdirectories array) to JS and handles incoming `native:request-alto-discovery` for JS-triggered picker
- ContentView wires NSOpenPanel (macOS) and `.fileImporter` for `.folder` (iOS) with security-scoped resource access and discovery result dispatch

## Task Commits

1. **Task 1: Add discoverSubdirectories to AltoIndexAdapter** - `1a798392` (feat)
2. **Task 2: Add sendAltoDiscoveryResult + wire directory picker** - `f8f59ff4` (feat)

## Files Created/Modified

- `native/Isometry/Isometry/AltoIndexAdapter.swift` - Added discoverSubdirectories(in:) static method
- `native/Isometry/Isometry/BridgeManager.swift` - Added sendAltoDiscoveryResult() + native:request-alto-discovery handler
- `native/Isometry/Isometry/ContentView.swift` - Added pickAltoDirectory notification, showingAltoDirectoryPicker state, discoverAltoIndex(at:), NSOpenPanel/fileImporter wiring
- `native/Isometry/Isometry/SettingsView.swift` - Auto-fix: added missing UniformTypeIdentifiers import

## Decisions Made

- `alto_index` case in `runNativeImport` now sets `showingAltoDirectoryPicker = true` and returns immediately, replacing the old direct-import path. The discovery-first flow (DISC-01) means users choose a directory, see what's available, then selectively import (Plan 02 JS side, Plan 124 selective import).
- The directory picker is wired through `onChange(of: showingAltoDirectoryPicker)` rather than a `.sheet` modifier to keep `NSOpenPanel.runModal()` on the main thread where it must execute synchronously.
- A `pickAltoDirectory` NotificationCenter name bridges both the JS-triggered path (`native:request-alto-discovery` → post notification) and the native UI path (`runNativeImport("alto_index")` → state) into one picker trigger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing UniformTypeIdentifiers import in SettingsView.swift**
- **Found during:** Task 1 verification (xcodebuild)
- **Issue:** `SettingsView.swift` used `.json` UTType in `NSSavePanel.allowedContentTypes` without importing `UniformTypeIdentifiers`, causing a compile error that blocked the build gate
- **Fix:** Added `import UniformTypeIdentifiers` at the top of SettingsView.swift
- **Files modified:** `native/Isometry/Isometry/SettingsView.swift`
- **Verification:** xcodebuild succeeded after fix
- **Committed in:** `1a798392` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing build error)
**Impact on plan:** Auto-fix was necessary for the build gate to pass. No scope creep.

## Issues Encountered

None beyond the pre-existing SettingsView import error resolved by Rule 1.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Swift side of DISC-01 and DISC-02 is complete
- Plan 123-02 (JS side) can now consume `native:alto-discovery` bridge messages to show the DirectoryDiscoverySheet with subdirectory checkboxes
- Plan 124 selective import will receive the paths from the discovery result to drive per-subdirectory import

## Self-Check: PASSED

- SUMMARY.md: FOUND
- AltoIndexAdapter.swift: FOUND
- BridgeManager.swift: FOUND
- ContentView.swift: FOUND
- Commit 1a798392 (Task 1): FOUND
- Commit f8f59ff4 (Task 2): FOUND

---
*Phase: 123-directory-discovery*
*Completed: 2026-03-26*
