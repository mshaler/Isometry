---
phase: 13-native-chrome-file-import
plan: 01
subsystem: ui
tags: [swiftui, navigationSplitView, toolbar, macOS-commands, sidebar, notification-center]

# Dependency graph
requires:
  - phase: 12-bridge-persistence
    provides: BridgeManager with @MainActor, webView reference, and evaluateJavaScript pattern

provides:
  - NavigationSplitView shell with 9-view sidebar (Grid, List, Kanban, Calendar, Timeline, Network, Tree, Gallery, SuperGrid)
  - Toolbar with sidebar toggle (iPad/macOS), import button, and view picker (iPhone compact)
  - macOS Commands struct with File > Import File (Cmd+I) and Edit > Undo/Redo (Cmd+Z/Cmd+Shift+Z)
  - Notification.Name extensions: importFile, undoAction, redoAction
  - selectedViewID onChange drives evaluateJavaScript viewManager.switchTo()

affects:
  - 13-02 (file import pipeline — adds fileImporter modifier to this ContentView)
  - 14-icloud-sync (Commands/toolbar integration points)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NavigationSplitViewVisibility.detailOnly for collapsed-by-default sidebar
    - Notification.Name + NotificationCenter.default.post for Commands -> View communication
    - "#if os(iOS) / #if os(macOS)" guards for platform-specific toolbar and sheet modifiers
    - .onChange(of:) two-parameter closure form (Swift 5.9+ non-deprecated)

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/ContentView.swift
    - native/Isometry/Isometry/IsometryApp.swift

key-decisions:
  - "Notification.Name extensions (importFile, undoAction, redoAction) live in ContentView.swift — same module, visible to IsometryCommands in IsometryApp.swift"
  - "Sidebar detailOnly by default — matches CONTEXT.md decision to maximise D3 canvas area; toggle button reveals it"
  - "Import button posts notification only — fileImporter modifier added in Plan 02 to avoid plan scope creep"
  - "switchView(to:) uses optional chaining (?.) on window.__isometry — safe to call before JS is ready"

patterns-established:
  - "macOS Commands -> NotificationCenter -> ContentView.onReceive -> evaluateJavaScript: canonical command routing pattern"
  - "List(isometryViews, selection: $selectedViewID) for sidebar — SwiftUI selection binding drives view switch"
  - "Platform-conditional toolbar items: #if os(iOS) guards sizeClass checks, macOS uses .navigation placement"

requirements-completed: [CHRM-01, CHRM-02, CHRM-03, CHRM-04]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 13 Plan 01: Native Chrome — NavigationSplitView Shell Summary

**SwiftUI ZStack replaced with NavigationSplitView sidebar + 9-view switcher, platform-adaptive toolbars, and macOS menu Commands routing Undo/Redo/Import through NotificationCenter**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-03T18:17:47Z
- **Completed:** 2026-03-03T18:20:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Replaced flat ZStack in ContentView with NavigationSplitView (collapsed by default via `detailOnly`)
- Added sidebar with 9 D3 views — each with SF Symbol icon and text label
- Added platform-adaptive toolbars: sidebar toggle (iPad/macOS), import button (all), view picker sheet (iPhone compact via bottomBar)
- Added macOS `IsometryCommands` struct with File > Import File (Cmd+I) and Edit > Undo/Redo (Cmd+Z / Cmd+Shift+Z)
- Wired `selectedViewID` onChange to `evaluateJavaScript` calling `window.__isometry.viewManager.switchTo()`
- Added onReceive handlers routing Undo/Redo to `mutationManager.undo()` / `redo()` via evaluateJavaScript

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure ContentView with NavigationSplitView, sidebar, and toolbar** - `a217fd8b` (feat)
2. **Task 2: Add macOS Commands struct for File and Edit menus** - `1d2b5ae7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `native/Isometry/Isometry/ContentView.swift` - Full restructure: ZStack -> NavigationSplitView, sidebar, toolbar, notification handlers
- `native/Isometry/Isometry/IsometryApp.swift` - Added IsometryCommands struct and .commands modifier

## Decisions Made
- Notification.Name extensions live in ContentView.swift (not a separate file) — same module, accessible from IsometryCommands without import
- Import button in Task 1 only posts the notification; actual fileImporter modifier is Plan 02's responsibility
- Undo/Redo routes via `mutationManager.undo/redo()` — research confirmed the web runtime has a MutationManager; optional chaining guards against not-yet-ready state
- `#if os(iOS)` guards needed for `navigationBarTitleDisplayMode` (macOS unavailable) — discovered and fixed during build

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guard navigationBarTitleDisplayMode with #if os(iOS)**
- **Found during:** Task 1 (build verification)
- **Issue:** `.navigationBarTitleDisplayMode(.inline)` is unavailable on macOS — build error
- **Fix:** Wrapped modifier with `#if os(iOS)` / `#endif` conditional compilation
- **Files modified:** `native/Isometry/Isometry/ContentView.swift`
- **Verification:** macOS build succeeds after fix
- **Committed in:** `a217fd8b` (part of Task 1 commit)

**2. [Rule 1 - Bug] Use two-parameter onChange closure**
- **Found during:** Task 1 (build verification)
- **Issue:** `onChange(of:perform:)` single-parameter closure form deprecated in macOS 14.0 — warning during build
- **Fix:** Changed to two-parameter form `{ _, newViewID in }` matching macOS 14+ API
- **Files modified:** `native/Isometry/Isometry/ContentView.swift`
- **Verification:** Warning eliminated in ContentView; pre-existing warning in IsometryApp.swift (out of scope) remains
- **Committed in:** `a217fd8b` (part of Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1 - Bug)
**Impact on plan:** Both auto-fixes required for correctness and clean build. No scope creep.

## Issues Encountered
- Pre-existing deprecation warning in IsometryApp.swift (`onChange(of:perform:)` for scenePhase) — out of scope, left as-is per deviation rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ContentView NavigationSplitView shell is ready — Plan 02 adds `.fileImporter()` modifier to this view
- Notification `.importFile` is already wired from toolbar button and macOS Cmd+I — Plan 02 adds the onReceive handler that opens the picker
- macOS Commands struct is complete — no changes needed in Plans 02-03

## Self-Check: PASSED

All files and commits verified:
- FOUND: `native/Isometry/Isometry/ContentView.swift`
- FOUND: `native/Isometry/Isometry/IsometryApp.swift`
- FOUND: `.planning/phases/13-native-chrome-file-import/13-01-SUMMARY.md`
- FOUND: commit `a217fd8b` (Task 1)
- FOUND: commit `1d2b5ae7` (Task 2)

---
*Phase: 13-native-chrome-file-import*
*Completed: 2026-03-03*
