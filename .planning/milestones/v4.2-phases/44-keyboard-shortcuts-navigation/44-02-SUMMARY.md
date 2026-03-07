---
phase: 44-keyboard-shortcuts-navigation
plan: 02
subsystem: ui
tags: [keyboard-shortcuts, help-overlay, macos-menu, view-switching]

# Dependency graph
requires:
  - phase: 44-keyboard-shortcuts-navigation
    provides: "ShortcutRegistry with getAll() for overlay population"
  - phase: 07-views
    provides: "ViewManager.switchTo(), viewFactory, 9 canonical view types"
provides:
  - "HelpOverlay component reading all shortcuts from ShortcutRegistry"
  - "? key toggle for shortcut discovery"
  - "macOS View menu with Cmd+1-9 for native menu bar navigation"
  - "ViewSwitchReceiver ViewModifier pattern for SwiftUI body extraction"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["ViewModifier extraction to prevent SwiftUI type-checker timeout on complex body"]

key-files:
  created:
    - src/shortcuts/HelpOverlay.ts
    - src/styles/help-overlay.css
    - tests/shortcuts/HelpOverlay.test.ts
  modified:
    - src/shortcuts/index.ts
    - src/main.ts
    - native/Isometry/Isometry/IsometryApp.swift
    - native/Isometry/Isometry/ContentView.swift

key-decisions:
  - "ViewSwitchReceiver extracted as ViewModifier to prevent SwiftUI type-checker timeout when adding 9 onReceive handlers to body"
  - "onReceive handlers set selectedViewID (not call switchView directly) to keep sidebar in sync via existing onChange"
  - "HelpOverlay registers ? through ShortcutRegistry but handles Escape via separate keydown listener (contextual to overlay visibility)"

patterns-established:
  - "ViewModifier extraction pattern: when SwiftUI body grows too complex for type-checker, extract groups of modifiers into private ViewModifier structs"

requirements-completed: [KEYS-03, KEYS-02]

# Metrics
duration: 7min
completed: 2026-03-07
---

# Phase 44 Plan 02: Help Overlay + View Menu Summary

**Help overlay component reading ShortcutRegistry with ? toggle, plus macOS View menu with Cmd+1-9 native keyboard shortcuts**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-07T19:48:13Z
- **Completed:** 2026-03-07T19:55:36Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created HelpOverlay component that reads all shortcuts from ShortcutRegistry.getAll() and groups them by category
- ? key toggles overlay visibility via ShortcutRegistry registration, Escape closes it via separate handler
- Styled with design tokens (dark theme card, kbd elements, category headings)
- Added macOS View menu (ViewCommands) with 9 items and Cmd+1-9 keyboard shortcut indicators
- Menu-bar view switching updates selectedViewID which triggers sidebar sync via existing onChange

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HelpOverlay component + CSS + tests (TDD)** - `d7731876` (feat)
2. **Task 2: Add macOS View menu with Cmd+1-9 items** - `6aa619d5` (feat)

_Note: Task 1 followed TDD (RED -> GREEN) with all 13 tests passing._

## Files Created/Modified
- `src/shortcuts/HelpOverlay.ts` - Help overlay component with mount/show/hide/toggle/destroy lifecycle
- `src/styles/help-overlay.css` - Dark theme overlay styling using design tokens
- `tests/shortcuts/HelpOverlay.test.ts` - 13 unit tests for DOM creation, show/hide/toggle, Escape, destroy
- `src/shortcuts/index.ts` - Added HelpOverlay barrel export
- `src/main.ts` - Import HelpOverlay, instantiate after ShortcutRegistry, expose on window.__isometry
- `native/Isometry/Isometry/IsometryApp.swift` - ViewCommands struct with 9 menu items, registered alongside IsometryCommands
- `native/Isometry/Isometry/ContentView.swift` - 9 Notification.Name extensions, ViewSwitchReceiver ViewModifier

## Decisions Made
- ViewSwitchReceiver extracted as a private ViewModifier to prevent SwiftUI type-checker timeout -- adding 9 onReceive handlers directly to body made the expression too complex for the compiler
- onReceive handlers set selectedViewID rather than calling switchView directly -- this leverages the existing onChange(of: selectedViewID) which calls switchView and keeps the sidebar selection in sync
- HelpOverlay registers ? through ShortcutRegistry (benefiting from its input field guard) but handles Escape via a separate document keydown listener since Escape is contextual to overlay visibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted ViewSwitchReceiver ViewModifier for SwiftUI type-checker**
- **Found during:** Task 2 verification (Xcode build)
- **Issue:** Adding 9 onReceive handlers inline in ContentView.body caused SwiftUI type-checker timeout error
- **Fix:** Extracted all 9 view switch onReceive handlers into a private ViewSwitchReceiver ViewModifier
- **Files modified:** native/Isometry/Isometry/ContentView.swift
- **Verification:** `xcodebuild build` succeeds with zero errors and zero warnings
- **Committed in:** 6aa619d5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking - SwiftUI type-checker)
**Impact on plan:** Structural refactoring required by SwiftUI compiler limitation. Same functionality, better code organization. No scope creep.

## Issues Encountered
- Pre-existing test failure in SuperGridSelect.test.ts (SVG rect visual style assertions) -- unrelated to this plan's changes, not fixed per scope boundary rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Keyboard shortcut system is complete: registry, view switching, undo/redo, help overlay, macOS menu bar
- Phase 44 fully delivered (KEYS-01 through KEYS-04)
- Ready for next v4.2 phases (45-visual-polish, 46-stability-error-handling, etc.)

## Self-Check: PASSED

- All 7 key files verified on disk
- Both task commits (d7731876, 6aa619d5) found in git log

---
*Phase: 44-keyboard-shortcuts-navigation*
*Completed: 2026-03-07*
