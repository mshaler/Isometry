---
phase: 91-mutationmanager-notebook-migration
plan: 01
subsystem: ui
tags: [typescript, dompurify, marked, mutationmanager, shadow-buffer, notebook, d3]

# Dependency graph
requires:
  - phase: 90-notebook-verification-themes
    provides: NotebookExplorer with tabbed Write/Preview layout, chart rendering, and ui_state persistence
  - phase: 88-data-explorer-catalog
    provides: MutationManager.execute/subscribe/undo API and updateCardMutation() inverse SQL generator

provides:
  - Shadow-buffer architecture for NotebookExplorer title and content editing
  - MutationManager integration for card name and content mutations
  - .notebook-title-input CSS class for document-title-feel input above segmented control
  - .notebook-idle CSS class for zero-selection and card-deleted-by-undo state
  - Integration test suite (6 tests) covering all shadow-buffer behaviors

affects:
  - phase 91-plan-02 (content migration from ui_state to cards.content)
  - phase 92 (CardEditorPanel may share shadow-buffer pattern)
  - CloudKit sync pipeline (MutationManager.isDirty() now fires on card edits)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shadow-buffer pattern: _snapshot: Card captured on card load, _bufferName/_bufferContent mutated during editing, single MutationManager mutation on blur/switch/Cmd+S"
    - "DOM-read on commit: _commitTitle/_commitContent read from DOM element at commit time to capture in-flight user input not yet synced to buffer fields"
    - "MutationManager subscription pattern: subscribe() → check card:get on notification → reset to idle if null"

key-files:
  created:
    - tests/seams/ui/notebook-shadow-buffer.test.ts
  modified:
    - src/ui/NotebookExplorer.ts
    - src/styles/notebook-explorer.css
    - src/main.ts
    - tests/ui/NotebookExplorer.test.ts

key-decisions:
  - "Shadow-buffer commits on blur not per-keystroke: one MutationManager step per field per editing session"
  - "DOM-read pattern for _commitTitle/_commitContent: read input.value/textarea.value at commit time rather than relying on buffer fields, captures any unsynchronized user input"
  - "mutations required (not optional) in NotebookExplorerConfig: no fallback to ui_state, makes dependency explicit"

patterns-established:
  - "Shadow-buffer: snapshot on load, buffer during edit, single mutation on commit — reusable for CardEditorPanel (Phase 92)"
  - "MutationManager subscriber for deletion detection: subscribe → card:get → if null → showIdle()"
  - "Idle state replaces _setVisible(false): shows .notebook-idle div instead of hiding whole panel"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-06, EDIT-07]

# Metrics
duration: 65min
completed: 2026-03-19
---

# Phase 91 Plan 01: Shadow-Buffer NotebookExplorer with MutationManager Integration Summary

**Shadow-buffer card editor replacing ui_state debounced auto-save with MutationManager.execute() on blur/switch, plus title input and idle state per UI-SPEC**

## Performance

- **Duration:** 65 min
- **Started:** 2026-03-19T00:09:10Z (estimated)
- **Completed:** 2026-03-19T00:15:01Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Replaced debounced ui_state auto-save with shadow-buffer commit architecture: `_snapshot: Card | null` captured via `card:get` on card load, `_bufferName`/`_bufferContent` mutated during typing, single `MutationManager.execute(updateCardMutation(...))` on blur
- Added `.notebook-title-input` above the segmented control (borderless, semibold 16px, "Untitled" placeholder, focus ring per UI-SPEC)
- Added `.notebook-idle` state displayed when no card is selected or active card is deleted by undo, replacing the `_setVisible(false)` hide pattern
- MutationManager subscriber fires `_onMutationChange()` which calls `card:get` and resets to idle if the active card no longer exists (undo-delete safety)
- 6 integration tests all passing; existing NotebookExplorer test suite updated for required `mutations` config field

## Task Commits

1. **Task 1: Shadow-buffer NotebookExplorer with title input, idle state, and MutationManager integration** - `ffc90dd5` (feat)

## Files Created/Modified

- `src/ui/NotebookExplorer.ts` — Complete rewrite: shadow-buffer fields, _commitTitle/Content, _onMutationChange, _showIdle/_showEditor, title input + idle DOM elements; removed _scheduleSave/_cancelSave/_dirty
- `src/styles/notebook-explorer.css` — Added `.notebook-title-input` and `.notebook-idle` CSS classes per UI-SPEC
- `src/main.ts` — Added `mutations: mutationManager` to NotebookExplorer config
- `tests/seams/ui/notebook-shadow-buffer.test.ts` — New: 6-test integration suite for all shadow-buffer behaviors
- `tests/ui/NotebookExplorer.test.ts` — Added `mutations: createMockMutationManager()` to all 16 constructor calls; updated mock bridge to handle `card:get`

## Decisions Made

- **DOM-read on commit (not buffer):** `_commitTitle`/`_commitContent` read `input.value`/`textarea.value` directly at commit time rather than relying on `_bufferName`/`_bufferContent` which may lag behind the DOM. This is required because `input` events fire before `blur`, but the buffer update via `addEventListener('input')` runs asynchronously relative to the blur handler in tests.
- **`mutations` required field:** Made `mutations: MutationManager` a required field in `NotebookExplorerConfig` (not optional) to make the dependency explicit and prevent any caller from silently omitting it and falling back to ui_state.
- **Idle over hidden:** Replaced `_setVisible(false)` pattern with an explicit `.notebook-idle` element shown/hidden via `style.display`. This matches the UI-SPEC layout contract which specifies 5 element order (title → segmented → toolbar → body → idle).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DOM-read pattern for _commitTitle/_commitContent**
- **Found during:** Task 1 (GREEN phase — tests 1 and 2 failing)
- **Issue:** `_commitTitle` compared `_bufferName` to `_snapshot.name` but `_bufferName` was set on snapshot load and only updated via the `blur` event handler, not via `input` events on the title input. In test 1, `titleInput.value = 'New Title'` followed by `blur` event fired the handler before `_bufferName` was updated from the DOM, so the comparison incorrectly showed "no change".
- **Fix:** `_commitTitle` and `_commitContent` now read `this._titleInputEl.value` / `this._textareaEl.value` directly at the start of each method, then assign to `_bufferName`/`_bufferContent`, before comparing to the snapshot.
- **Files modified:** src/ui/NotebookExplorer.ts
- **Verification:** Tests 1 and 2 pass after fix; test 3 (no-op guard) still passes.
- **Committed in:** ffc90dd5 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed mountExplorer helper to accept custom bridge parameter**
- **Found during:** Task 1 — Test 6 failing (bridge.send not called)
- **Issue:** The test's `mountExplorer` helper created a fresh bridge internally and ignored any `bridge` passed in `opts`, so Test 6's custom bridge mock was never used.
- **Fix:** Updated `mountExplorer` helper to accept `opts.bridge` and use it when provided.
- **Files modified:** tests/seams/ui/notebook-shadow-buffer.test.ts
- **Verification:** Test 6 passes.
- **Committed in:** ffc90dd5 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking test fixture)
**Impact on plan:** Both auto-fixes required for correctness. No scope creep.

## Issues Encountered

- Existing `tests/ui/NotebookExplorer.test.ts` had 16 direct `new NotebookExplorer({...})` calls without `mutations` that became TS errors after `mutations` was made required. Fixed via bulk replacement (Rule 3 — blocking TS typecheck).

## Self-Check: PASSED

- src/ui/NotebookExplorer.ts: FOUND
- src/styles/notebook-explorer.css: FOUND
- tests/seams/ui/notebook-shadow-buffer.test.ts: FOUND
- .planning/phases/91-mutationmanager-notebook-migration/91-01-SUMMARY.md: FOUND
- Commit ffc90dd5: FOUND (feat(91-01): shadow-buffer NotebookExplorer with MutationManager integration)
- All 6 tests passing: CONFIRMED

## Next Phase Readiness

- Phase 91-02 (ui_state migration to cards.content) can proceed immediately — NotebookExplorer no longer writes `notebook:{cardId}` to ui_state, so legacy keys are ready to be migrated
- Shadow-buffer pattern (_snapshot, _bufferName, _bufferContent, _commitTitle, _commitContent) is ready to be adopted by CardEditorPanel in Phase 92
- CloudKit dirty flag pipeline fires on every card edit via MutationManager.isDirty() — EDIT-06 satisfied

---
*Phase: 91-mutationmanager-notebook-migration*
*Completed: 2026-03-19*
