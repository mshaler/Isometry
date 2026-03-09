---
phase: 64-notebook-persistence
plan: 01
subsystem: ui
tags: [notebook, persistence, ui-state, selection, debounce, tdd]

# Dependency graph
requires:
  - phase: 57-notebook-explorer
    provides: NotebookExplorer UI with Write/Preview tabs, formatting toolbar
  - phase: 63-notebook-formatting
    provides: Undo-safe formatting engine with _undoSafeInsert, _formatInline, _formatLinePrefix, _cycleHeading
provides:
  - Per-card notebook persistence via ui_state (notebook:{cardId} keys)
  - SelectionProvider-driven card binding in NotebookExplorer
  - Debounced 500ms auto-save on input and formatting actions
  - Card-switch flush (bypasses debounce to prevent data loss)
  - Stale response guard for rapid card switching
affects: [notebook-explorer, workbench-shell, main-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns: [selection-subscribe-pattern, debounced-bridge-persistence, stale-response-guard]

key-files:
  created: []
  modified:
    - src/ui/NotebookExplorer.ts
    - src/main.ts
    - tests/ui/NotebookExplorer.test.ts

key-decisions:
  - "Direct bridge.send('ui:set') for notebook persistence (not StateManager) -- per-card keys don't fit one-key-per-provider model"
  - "NotebookExplorer subscribes to SelectionProvider directly (not via WorkbenchShell passdown) -- follows CalcExplorer config injection pattern"
  - "_scheduleSave called from _undoSafeInsert (not just input handler) -- ensures formatting toolbar actions persist"

patterns-established:
  - "Selection-driven content loading: subscribe to SelectionProvider, flush old card on switch, load new card, guard stale async responses"
  - "Debounced auto-save via bridge.send('ui:set') with 500ms timer and immediate flush on card switch"

requirements-completed: [NOTE-03, NOTE-04, NOTE-05]

# Metrics
duration: 13min
completed: 2026-03-09
---

# Phase 64 Plan 01: Notebook Persistence Summary

**Per-card notebook persistence via ui_state with SelectionProvider card binding, 500ms debounced auto-save, and stale-response guard for rapid card switching**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-09T17:43:21Z
- **Completed:** 2026-03-09T17:56:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- NotebookExplorer wired to SelectionProvider for per-card content binding -- selecting different cards swaps notebook text
- 500ms debounced auto-save to ui_state via bridge.send('ui:set', { key: 'notebook:{cardId}' }) on every keystroke and formatting action
- Card-switch flushes dirty content immediately (bypasses debounce), loads new card content, and guards against stale async responses
- Zero selection hides notebook, card selection shows it, multiple selected cards use first ID
- 74 tests pass (58 existing formatting/rendering + 16 new persistence/selection tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: NotebookExplorer persistence + selection wiring (TDD)** - `7af7a863` (test: RED), `ea35251b` (feat: GREEN)
2. **Task 2: main.ts wiring + typecheck + integration verification** - `e40fbeb1` (chore)

## Files Created/Modified
- `src/ui/NotebookExplorer.ts` - Added NotebookExplorerConfig interface, constructor with bridge/selection, _onSelectionChange, _scheduleSave, _cancelSave, _setVisible; modified _undoSafeInsert to call _scheduleSave; modified mount() input handler to call _scheduleSave; modified destroy() to flush/unsub
- `src/main.ts` - Updated NotebookExplorer construction to pass { bridge, selection } config; Biome import reorder (pre-existing, auto-fixed)
- `tests/ui/NotebookExplorer.test.ts` - Updated all existing tests to use NotebookExplorerConfig mocks; added 16 new persistence tests with mock WorkerBridge and mock SelectionProvider

## Decisions Made
- Direct bridge.send('ui:set') for notebook persistence -- notebook uses per-card keys (notebook:{cardId}) which doesn't fit the StateManager one-key-per-provider pattern. CalcExplorer established this precedent with calc:config.
- NotebookExplorer subscribes to SelectionProvider directly in mount() -- config injection via constructor, not WorkbenchShell passdown. Same pattern as CalcExplorer and other explorers.
- _scheduleSave called from _undoSafeInsert -- ensures bold/italic/heading/list/blockquote/code toolbar actions all persist, not just raw typing. This is necessary because execCommand('insertText') may not fire the input event in all WebKit versions.
- Test fix: "shows notebook when card selected" test updated to test the full hide-then-show cycle (select card -> clear -> re-select) rather than starting with empty selection which is a no-op (null === null).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test for show-after-hide cycle**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Test expected empty initial selection to hide notebook, but _onSelectionChange treats null->null as no-op
- **Fix:** Updated test to select a card first, then clear (triggers hide), then re-select (triggers show)
- **Files modified:** tests/ui/NotebookExplorer.test.ts
- **Verification:** All 74 tests pass
- **Committed in:** ea35251b (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Fixed Biome lint issues in modified files**
- **Found during:** Task 2 (verification)
- **Issue:** Biome reported import ordering in main.ts (pre-existing) and formatting in NotebookExplorer.ts
- **Fix:** npx biome check --write auto-fixed both files
- **Files modified:** src/main.ts, src/ui/NotebookExplorer.ts
- **Verification:** npx biome check reports zero diagnostics
- **Committed in:** e40fbeb1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Minimal -- test logic correction and standard lint compliance. No scope creep.

## Issues Encountered
None -- plan executed cleanly with minor test and lint adjustments.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- Notebook persistence fully functional -- ready for any remaining v5.2 phases
- ui_state key convention (notebook:{cardId}) automatically included in checkpoint/sync
- Pre-existing test failures in WorkbenchShell (6 tests, "4 sections" assertions stale after Calc section addition), SuperGridSelect (1 test, lasso highlight assertion), and e2e suite are unrelated and pre-existing

---
*Phase: 64-notebook-persistence*
*Completed: 2026-03-09*
