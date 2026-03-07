---
phase: 48-review-fixes
plan: 01
subsystem: runtime
tags: [arraybuffer, keyboard, undo-redo, toast, shortcuts, excel, import]

# Dependency graph
requires:
  - phase: 44-keyboard-shortcuts-navigation
    provides: ShortcutRegistry centralized keydown handler
  - phase: 46-stability-error-handling
    provides: ActionToast and setupMutationShortcuts with toast parameter
provides:
  - Excel web import using ArrayBuffer for binary formats (.xlsx, .xls)
  - ShortcutRegistry plain-key matching that works on real US keyboards
  - MutationManager.setToast() for undo/redo toast feedback from any trigger
  - 25MB file size guard on web file picker imports
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MutationManager owns toast feedback via setToast() -- single wiring point for all undo/redo triggers"
    - "Plain-key shortcuts skip shiftKey matching -- future-proofs for all shifted characters (?, !, @, #)"
    - "Binary format detection by extension set -- binaryFormats.has(ext) gates ArrayBuffer vs text read"

key-files:
  created: []
  modified:
    - src/main.ts
    - src/worker/protocol.ts
    - src/worker/WorkerBridge.ts
    - src/shortcuts/ShortcutRegistry.ts
    - src/mutations/MutationManager.ts
    - src/mutations/index.ts
    - src/mutations/shortcuts.ts
    - tests/worker/WorkerBridge.test.ts
    - tests/shortcuts/ShortcutRegistry.test.ts
    - tests/mutations/MutationManager.test.ts

key-decisions:
  - "Binary format detection uses extension set (binaryFormats = new Set(['xlsx', 'xls'])) rather than MIME type -- matches existing sourceMap pattern"
  - "Plain-key shortcuts skip shiftKey matching entirely (isPlainKey = !parsed.cmd && !parsed.alt) -- future-proofs for all shifted characters"
  - "MutationManager owns toast via setToast() -- single wiring point replaces per-trigger toast logic"
  - "setupMutationShortcuts deprecated but kept for library API compatibility -- not deleted"

patterns-established:
  - "UndoRedoToast interface: any object with show(message: string) works -- decouples MutationManager from ActionToast DOM class"

requirements-completed: [RFIX-01, RFIX-02, RFIX-03]

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 48 Plan 01: Review Fixes Summary

**Three runtime correctness fixes: Excel ArrayBuffer import path, ? shortcut shiftKey bypass, and MutationManager undo/redo toast feedback**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T22:14:03Z
- **Completed:** 2026-03-07T22:19:49Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Excel web import (.xlsx/.xls) now reads files as ArrayBuffer instead of text, fixing silent parse failures
- ? shortcut fires on real US keyboards where browser sends shiftKey=true for Shift+/ key combination
- Undo/redo from any trigger (keyboard, programmatic) shows "Undid: {description}" / "Redid: {description}" toast
- 25MB file size guard prevents browser hangs from oversized Excel imports
- All 2,391 existing tests pass with 14 new regression tests added

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Excel ArrayBuffer web import path** - `747cbc45` (fix)
2. **Task 2: Fix ? shortcut shiftKey matching** - `0836b46c` (fix)
3. **Task 3: Wire undo/redo ActionToast into MutationManager** - `792182de` (feat)

## Files Created/Modified
- `src/worker/protocol.ts` - etl:import data type changed from string to string | ArrayBuffer
- `src/worker/WorkerBridge.ts` - importFile signature updated to accept string | ArrayBuffer
- `src/main.ts` - Binary format detection, file size guard, ActionToast wiring
- `src/shortcuts/ShortcutRegistry.ts` - Skip shiftKey matching for plain-key shortcuts
- `src/mutations/MutationManager.ts` - UndoRedoToast interface, setToast(), toast calls in undo/redo
- `src/mutations/index.ts` - Export UndoRedoToast type
- `src/mutations/shortcuts.ts` - @deprecated annotation added
- `tests/worker/WorkerBridge.test.ts` - 2 new tests for ArrayBuffer/string import paths
- `tests/shortcuts/ShortcutRegistry.test.ts` - 5 new tests for shiftKey bypass and modifier preservation
- `tests/mutations/MutationManager.test.ts` - 6 new tests for setToast integration

## Decisions Made
- Binary format detection by extension set rather than MIME type -- consistent with existing sourceMap pattern in main.ts
- Plain-key shiftKey bypass applies to all plain shortcuts (no Cmd/Alt), not just ? -- future-proofs for !, @, # etc.
- MutationManager.setToast() uses a minimal UndoRedoToast interface (just show(message)) -- decoupled from ActionToast DOM class
- setupMutationShortcuts deprecated but file retained -- exported from src/index.ts for library API consumers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `tests/etl-validation/source-dedup.test.ts` and `source-errors.test.ts` reference a removed `ParsedFile` type -- not caused by this plan's changes. Logged to `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three runtime correctness bugs (F-001, F-002, F-005 from REVIEW.md) are fixed
- Plan 48-02 (Biome lint cleanup + docs reconciliation) can proceed independently

---
*Phase: 48-review-fixes*
*Completed: 2026-03-07*
