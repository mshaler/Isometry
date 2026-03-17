---
phase: 83-ui-control-seams-b
plan: 02
subsystem: testing
tags: [jsdom, vitest, seam-tests, WorkbenchShell, CalcExplorer, PAFVProvider, CollapsibleSection]

requires:
  - phase: 82-ui-control-seams-a
    provides: jsdom seam test patterns (vitest-environment annotation, vi.fn() stubs, CommandBar/ShortcutRegistry destroy seam pattern)
  - phase: 83-01
    provides: ETF-FTS seam test patterns established in phase 83

provides:
  - WorkbenchShell mount/destroy seam tests (10 tests, WBSH-01, WBSH-02)
  - CalcExplorer lifecycle seam tests (8 tests, CALC-01, CALC-02)

affects: [84-ui-polish, future-ui-seam-phases]

tech-stack:
  added: []
  patterns:
    - "isConnected over parentElement for DOM disconnection assertions (parentElement stays non-null after element.remove() when parent is in-memory)"
    - "Promise.resolve() flush for queueMicrotask-batched PAFVProvider subscriber notifications"
    - "CalcExplorer bridge stub: { send: vi.fn().mockResolvedValue({ value: null }) } for ui:get clean-slate path"
    - "setColAxes/setRowAxes (not setAxes) — PAFVProvider stacked axis API uses separate col/row setters"

key-files:
  created:
    - tests/seams/ui/workbench-shell.test.ts
    - tests/seams/ui/calc-explorer.test.ts
  modified: []

key-decisions:
  - "isConnected (not parentElement) for post-destroy DOM disconnection assertions — element.remove() detaches from document but parentElement stays non-null pointing to detached parent"
  - "flushMicrotasks() helper as await Promise.resolve() — PAFVProvider batches notifications via queueMicrotask; test must yield to microtask queue after setColAxes/setRowAxes before checking DOM"

patterns-established:
  - "CalcExplorer test pattern: set axes on PAFVProvider BEFORE mount(), then await flushMicrotasks() to trigger initial subscriber notification path"
  - "WorkbenchShell section state: data-section-state attribute on .collapsible-section root element (not body element)"

requirements-completed: [WBSH-01, WBSH-02, CALC-01, CALC-02]

duration: 3min
completed: 2026-03-17
---

# Phase 83 Plan 02: WorkbenchShell + CalcExplorer Seam Tests Summary

**jsdom seam tests proving WorkbenchShell creates correct 5-section DOM hierarchy with explorer loading states and CalcExplorer mounts/destroys correctly with numeric/text dropdown options driven by PAFVProvider subscription**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T13:39:07Z
- **Completed:** 2026-03-17T13:42:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 10 WorkbenchShell tests: DOM structure, 5 sections, explorer loading state (properties/projection/latch), section state management (collapseAll, restoreSectionStates), destroy removes and disconnects DOM
- 8 CalcExplorer tests: empty-state message, numeric 6-option dropdowns (priority), text 2-option dropdowns (folder), axis-change re-render, onConfigChange callback, destroy unsubscribes PAFV and clears container
- All 97 seam tests pass (9 test files) with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkbenchShell mount and destroy seam tests** - `78c80292` (feat)
2. **Task 2: CalcExplorer lifecycle seam tests** - `ee7c80c3` (feat)

## Files Created/Modified
- `tests/seams/ui/workbench-shell.test.ts` - 10 tests for WBSH-01 and WBSH-02 requirements
- `tests/seams/ui/calc-explorer.test.ts` - 8 tests for CALC-01 and CALC-02 requirements

## Decisions Made
- Used `isConnected` (not `parentElement`) for DOM disconnection assertion — `element.remove()` removes element from the document tree but body element's `parentElement` still points to the in-memory detached section root
- Used `await Promise.resolve()` (`flushMicrotasks`) to yield to PAFVProvider's `queueMicrotask`-batched subscriber notifications after each `setColAxes`/`setRowAxes` call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed WBSH-02b test assertion to use isConnected instead of parentElement**
- **Found during:** Task 1 (WorkbenchShell destroy test)
- **Issue:** Plan specified `calcBody.parentElement === null` after destroy, but `element.remove()` only detaches from document — `parentElement` is still non-null pointing to in-memory (detached) section root element
- **Fix:** Changed assertion to `calcBody.isConnected === false` which correctly captures "removed from document"
- **Files modified:** tests/seams/ui/workbench-shell.test.ts
- **Verification:** Test passes; 10/10 tests green
- **Committed in:** 78c80292 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test assertion corrected to match actual DOM API behavior)
**Impact on plan:** Assertion fix necessary for correctness — plan spec used incorrect DOM API assumption. No scope creep.

## Issues Encountered
- `parentElement` DOM API: when `rootEl.remove()` is called, child elements' `parentElement` still returns the now-detached parent (in-memory). Only `isConnected` or `document.contains()` accurately reflects document attachment. Fixed by using `isConnected`.

## Next Phase Readiness
- WBSH-01, WBSH-02, CALC-01, CALC-02 all proved via seam tests
- Phase 83 Plan 02 complete — UI control seam tests B fully done
- Ready for Phase 84 (UI polish) or remaining phase 83 plans if any

---
*Phase: 83-ui-control-seams-b*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: tests/seams/ui/workbench-shell.test.ts
- FOUND: tests/seams/ui/calc-explorer.test.ts
- FOUND: .planning/phases/83-ui-control-seams-b/83-02-SUMMARY.md
- FOUND commit: 78c80292 (WorkbenchShell seam tests)
- FOUND commit: ee7c80c3 (CalcExplorer seam tests)
- All 97 seam tests pass (npm run test:seams)
