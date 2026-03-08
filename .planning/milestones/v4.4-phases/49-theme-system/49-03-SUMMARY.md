---
phase: 49-theme-system
plan: 03
subsystem: native
tags: [swiftui, appstorage, preferredcolorscheme, wkuserscript, fowt-prevention, theme-sync]

# Dependency graph
requires:
  - phase: 49-02
    provides: "ThemeProvider exposed on window.__isometry.themeProvider with setTheme() API"
provides:
  - "SettingsView 3-way Appearance picker (Light/Dark/System) persisted via @AppStorage"
  - "ContentView .preferredColorScheme() for SwiftUI chrome/toolbar/sidebar sync"
  - ".onChange(of: theme) handler pushing theme changes to JS ThemeProvider via evaluateJavaScript"
  - "WKUserScript at .atDocumentStart injecting data-theme before first paint (FOWT prevention)"
affects: [native-shell, theme-system-complete]

# Tech tracking
tech-stack:
  added: []
  patterns: ["@AppStorage('theme') for native theme persistence across SwiftUI views", "WKUserScript .atDocumentStart for pre-paint attribute injection", ".preferredColorScheme(nil) for system-default delegation"]

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/SettingsView.swift
    - native/Isometry/Isometry/ContentView.swift

key-decisions:
  - "UserDefaults.standard.string(forKey:) in setupWebView() instead of @AppStorage — avoids SwiftUI property wrapper lifecycle timing issues"
  - "className='no-theme-transition' in WKUserScript alongside data-theme — prevents CSS transition flash on initial load"

patterns-established:
  - "@AppStorage shared key pattern: both SettingsView and ContentView use @AppStorage('theme') for automatic bidirectional sync"
  - "WKUserScript FOWT prevention: inject data-theme at .atDocumentStart before consoleScript or any other scripts"

requirements-completed: [THME-06]

# Metrics
duration: 21min
completed: 2026-03-08
---

# Phase 49 Plan 03: Native Shell Sync Summary

**SwiftUI Appearance picker with @AppStorage persistence, .preferredColorScheme chrome sync, and WKUserScript FOWT prevention**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-08T00:14:24Z
- **Completed:** 2026-03-08T00:35:12Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 2

## Accomplishments
- Added 3-way Appearance picker (Light/Dark/System) to SettingsView with @AppStorage persistence
- Applied .preferredColorScheme() to ContentView NavigationSplitView so SwiftUI sidebar, toolbar, and status bar match web content theme
- Added .onChange(of: theme) handler that pushes theme changes to JS ThemeProvider via evaluateJavaScript
- Injected WKUserScript at .atDocumentStart to set data-theme attribute before CSS loads, preventing Flash of Wrong Theme (FOWT)
- Human verified: Light, System, and Dark modes all work correctly end-to-end across native shell and web content

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Appearance picker to SettingsView and .preferredColorScheme to ContentView** - `09379e9c` (feat)
2. **Task 2: Verify complete theme system across web and native** - Human-verified (approved: "Light/system/dark works great.")

## Files Created/Modified
- `native/Isometry/Isometry/SettingsView.swift` - Added @AppStorage("theme") property and Appearance section with segmented picker between Subscription and About sections
- `native/Isometry/Isometry/ContentView.swift` - Added @AppStorage("theme"), preferredScheme computed property, .preferredColorScheme() modifier, .onChange(of: theme) handler, and WKUserScript theme injection in setupWebView()

## Decisions Made
- Used UserDefaults.standard.string(forKey:) directly in setupWebView() instead of reading from @AppStorage — setupWebView() may run before SwiftUI property wrappers are fully initialized in all lifecycle scenarios
- Set className='no-theme-transition' in the WKUserScript alongside data-theme attribute — ensures CSS transitions do not fire during initial page render (ThemeProvider removes this class after first rAF)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 49 (Theme System) is now fully complete: CSS token palettes (Plan 01), ThemeProvider with persistence (Plan 02), and native shell sync (Plan 03)
- All 7 THME requirements are satisfied
- Phase 50 (Accessibility) can begin — contrast audit will use the finalized light and dark token palettes

## Self-Check: PASSED

All files verified present. Task commit (09379e9c) verified in git log.

---
*Phase: 49-theme-system*
*Completed: 2026-03-08*
