---
phase: 49-theme-system
plan: 02
subsystem: ui
tags: [theme-provider, persistable-provider, matchmedia, dark-mode, light-mode, system-theme]

# Dependency graph
requires:
  - phase: 49-01
    provides: "Multi-theme CSS token system with dark/light/system palettes and [data-theme] attribute"
provides:
  - "ThemeProvider class (PersistableProvider + subscribe) for runtime theme state management"
  - "ThemeMode type ('light' | 'dark' | 'system') in providers/types.ts"
  - "resolvedTheme getter resolving 'system' to effective 'dark' or 'light'"
  - "matchMedia listener for real-time system appearance change notification"
  - "Cmd+Shift+T keyboard shortcut for theme cycling in web dev mode"
  - "window.__isometry.themeProvider exposure for native bridge access"
  - "FOWT prevention via no-theme-transition class on <html>"
affects: [49-03, native-shell-sync, settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["PersistableProvider + subscribe() for theme state", "matchMedia('prefers-color-scheme: dark') for system theme detection", "FOWT prevention via CSS class removal after first rAF"]

key-files:
  created:
    - src/providers/ThemeProvider.ts
    - tests/providers/ThemeProvider.test.ts
  modified:
    - src/providers/types.ts
    - src/providers/index.ts
    - src/main.ts
    - index.html

key-decisions:
  - "ThemeProvider registered with StateCoordinator only (StateManager not yet instantiated in app bootstrap)"
  - "Synchronous subscriber notification (no queueMicrotask batching) since theme changes are user-initiated and infrequent"
  - "JSDOM-free test approach using vi.stubGlobal for window, document, and requestAnimationFrame mocks"

patterns-established:
  - "ThemeProvider follows DensityProvider/FilterProvider pattern for PersistableProvider implementation"
  - "window.__isometry.themeProvider as the native bridge access point for Swift evaluateJavaScript calls"

requirements-completed: [THME-01, THME-03, THME-04]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 49 Plan 02: ThemeProvider Summary

**ThemeProvider as PersistableProvider with 3-way toggle, matchMedia system listener, and Cmd+Shift+T keyboard shortcut**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T00:06:00Z
- **Completed:** 2026-03-08T00:11:50Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created ThemeProvider implementing PersistableProvider + subscribe() with 3-way theme toggle (dark/light/system)
- matchMedia listener notifies subscribers when OS appearance changes while in system mode
- resolvedTheme getter resolves 'system' to effective 'dark' or 'light' via prefers-color-scheme query
- Wired ThemeProvider into main.ts with StateCoordinator registration and Cmd+Shift+T shortcut
- Exposed as window.__isometry.themeProvider for Plan 03 native shell sync
- FOWT prevention via no-theme-transition class on <html> element, removed after first rAF

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ThemeProvider with persistence, matchMedia, and FOWT prevention** - `4c213e2e` (feat, TDD: 23 tests)
2. **Task 2: Wire ThemeProvider into main.ts with StateCoordinator and keyboard shortcut** - `1c0e3862` (feat)

## Files Created/Modified
- `src/providers/ThemeProvider.ts` - PersistableProvider for theme state with matchMedia listener and FOWT prevention
- `src/providers/types.ts` - Added ThemeMode type ('light' | 'dark' | 'system')
- `src/providers/index.ts` - Exports ThemeProvider and ThemeMode
- `src/main.ts` - ThemeProvider creation, StateCoordinator registration, Cmd+Shift+T shortcut, window.__isometry exposure
- `index.html` - Added no-theme-transition class to <html> for FOWT prevention
- `tests/providers/ThemeProvider.test.ts` - 23 tests covering state, persistence, matchMedia, FOWT, subscribe

## Decisions Made
- ThemeProvider registered with StateCoordinator only -- StateManager is not instantiated in the app bootstrap (defined but unused). Persistence will work once StateManager is wired.
- Used synchronous notification (direct callback) instead of queueMicrotask batching -- theme changes are user-initiated single events, not rapid programmatic mutations like DensityProvider.
- Tests use vi.stubGlobal for window/document/requestAnimationFrame since vitest runs in node environment (not jsdom).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode errors**
- **Found during:** Task 2 (wiring)
- **Issue:** Array index access returns `T | undefined` in strict mode; `modes[(current + 1) % modes.length]` and `mock.calls[0][1]` needed non-null assertions
- **Fix:** Added `!` non-null assertions to array accesses
- **Files modified:** src/main.ts, tests/providers/ThemeProvider.test.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 1c0e3862 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed biome lint violations**
- **Found during:** Task 2 (wiring)
- **Issue:** Unused ThemeMode import in test file; ThemeProvider/ThemeMode export ordering violated biome organizeImports rule
- **Fix:** Removed unused import; reordered exports alphabetically in index.ts
- **Files modified:** tests/providers/ThemeProvider.test.ts, src/providers/index.ts
- **Verification:** `npx biome check` passes with zero errors
- **Committed in:** 1c0e3862 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes were standard TypeScript strict mode and linter compliance. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ThemeProvider is fully operational and exposed on window.__isometry.themeProvider
- Plan 03 (Native Shell Sync) can use `evaluateJavaScript("window.__isometry.themeProvider.setTheme('...')")` to push theme from Swift
- All 2434 tests pass, typecheck clean, biome lint clean

## Self-Check: PASSED

All 6 files verified present. Both task commits (4c213e2e, 1c0e3862) verified in git log.

---
*Phase: 49-theme-system*
*Completed: 2026-03-08*
