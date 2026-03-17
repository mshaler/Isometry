---
phase: 84-ui-polish
plan: 03
subsystem: ui
tags: [dialog, accessibility, keyboard-navigation, design-tokens, css-variables]

# Dependency graph
requires:
  - phase: 84-ui-polish
    provides: design-tokens.css CSS variable system
provides:
  - AppDialog.show() non-blocking imperative dialog primitive
  - app-dialog.css themed dialog styles using design tokens
  - Zero alert()/confirm() calls in src/ — all three call sites migrated
affects: [any future work that needs user confirmation or info dialogs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native <dialog> element with showModal() for accessible, non-blocking dialogs"
    - "void cast pattern for fire-and-forget async from sync event handlers"
    - "jsdom polyfill pattern for HTMLDialogElement.showModal() in Vitest tests"

key-files:
  created:
    - src/ui/AppDialog.ts
    - src/styles/app-dialog.css
    - tests/ui/AppDialog.test.ts
  modified:
    - src/ui/CommandBar.ts
    - src/ui/PropertiesExplorer.ts
    - src/main.ts

key-decisions:
  - "Native <dialog> element chosen for built-in accessibility (aria-modal, focus trapping semantics, ::backdrop)"
  - "AppDialog is a singleton-style object (not a class) — imperative API matches Promise-based call sites"
  - "Cancel button appears left of Confirm to follow platform conventions; info variant shows OK only"
  - "void cast pattern used in sync click handlers to fire-and-forget async dialog"

patterns-established:
  - "AppDialog.show({ variant, title, message }) — standard call signature for all future in-app confirmations"
  - "void AppDialog.show(...) in sync handlers; await AppDialog.show(...) in async handlers"

requirements-completed: [WA3]

# Metrics
duration: 12min
completed: 2026-03-15
---

# Phase 84 Plan 03: Replace alert/confirm with in-app AppDialog Summary

**Non-blocking `AppDialog.show()` primitive using native `<dialog>` element replaces all three alert()/confirm() call sites with keyboard-accessible, themed dialogs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-15T16:59:00Z
- **Completed:** 2026-03-15T17:01:40Z
- **Tasks:** 6
- **Files modified:** 6 (3 new, 3 modified)

## Accomplishments

- Created AppDialog.ts with `show()` returning `Promise<boolean>`, native `<dialog>`, focus trap, Escape/backdrop-click dismiss
- Created app-dialog.css using design tokens exclusively with `::backdrop` overlay and hover transitions
- Migrated all three call sites: CommandBar `alert()`, PropertiesExplorer `window.confirm()`, main.ts two `confirm()` calls
- Added 4 behavioral tests covering confirm-click, cancel-click, escape-key, and DOM removal after resolution
- Verified zero `alert()`/`confirm()` calls remain in src/ (grep confirms only comments)

## Task Commits

1. **Task 1+2: AppDialog.ts + app-dialog.css** - `d854c0b5` (feat)
2. **Task 3: Migrate CommandBar alert** - `0e6f3bdd` (feat)
3. **Task 4: Migrate PropertiesExplorer confirm** - `8c869563` (feat)
4. **Task 5: Migrate main.ts confirms (x2)** - `9a424551` (feat)
5. **Task 6: Behavioral tests** - `426258f7` (test)

## Files Created/Modified

- `src/ui/AppDialog.ts` - Imperative dialog with `show()` API, focus trap, Escape/backdrop dismiss
- `src/styles/app-dialog.css` - Dialog styles using design tokens; `::backdrop` overlay
- `tests/ui/AppDialog.test.ts` - 4 behavioral tests with jsdom showModal() polyfill
- `src/ui/CommandBar.ts` - About action: `alert()` -> `void AppDialog.show({ variant: 'info' })`
- `src/ui/PropertiesExplorer.ts` - `_handleResetAll()` converted to `async`, `window.confirm()` -> `await AppDialog.show({ variant: 'confirm' })`
- `src/main.ts` - Both `importFile`/`importNative` sample data guards: `confirm()` -> `await AppDialog.show({ variant: 'confirm' })`

## Decisions Made

- Native `<dialog>` element chosen over a custom div overlay — provides built-in focus management semantics and `::backdrop` pseudo-element for themed overlay without extra markup
- AppDialog exported as a singleton-style object rather than a class — imperative API fits `Promise<boolean>` call sites naturally
- Cancel button positioned left of Confirm in the DOM — follows platform confirmation dialog conventions
- `void` cast in sync event handlers (CommandBar, resetBtn listener) — matches existing project patterns for fire-and-forget async

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict-mode errors in AppDialog.ts focus trap**
- **Found during:** Post-implementation typecheck
- **Issue:** `focusable[0]` and `focusable[focusable.length - 1]` typed as `HTMLButtonElement | undefined` under `exactOptionalPropertyTypes` — direct use caused TS18048
- **Fix:** Added explicit `| undefined` annotations and early null guard
- **Files modified:** src/ui/AppDialog.ts
- **Verification:** `tsc --noEmit` shows zero AppDialog errors
- **Committed in:** d854c0b5 (Task 1+2 commit, inline fix)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** TypeScript strict-mode guard prevents runtime undefined access on zero-button edge case. No scope creep.

## Issues Encountered

- jsdom does not implement `HTMLDialogElement.showModal()` — added a polyfill that patches `document.createElement` for dialog elements in the test environment. Approach is self-contained within the test file and does not affect production code.

## Next Phase Readiness

- AppDialog primitive is ready for any future confirmation flows across the app
- All three legacy native dialog call sites are eliminated
- Test pattern established for jsdom showModal polyfill can be reused in future dialog tests

---
*Phase: 84-ui-polish*
*Completed: 2026-03-15*
