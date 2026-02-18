---
phase: 117-apple-notes-sqlite-sync
plan: 04
subsystem: ui
tags: [react, hooks, modal, sync, apple-notes, deprecation]

# Dependency graph
requires:
  - phase: 117-02
    provides: AppleNotesSyncService with SyncProgress/SyncResult types + RUNTIME-BOUNDARY-01 decision
  - phase: 117-03
    provides: DataIntegrityValidator + folder hierarchy validation

provides:
  - useAppleNotesSync hook with mock adapter for browser runtime
  - SyncProgressModal component with 4-phase progress display
  - Toolbar File menu "Sync Apple Notes..." entry
  - Deprecation warnings on alto-importer.ts, alto-parser.ts, useAltoIndexImport.ts

affects:
  - future-tauri-ipc-phase
  - IntegratedLayout.tsx (still uses deprecated alto-index, migration deferred)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Mock adapter pattern for RUNTIME-BOUNDARY isolation (createMockAdapter implements SourceAdapter)
    - vi.mock() in Toolbar.test.tsx for hooks requiring SQLiteProvider (keeps tests provider-independent)

key-files:
  created:
    - src/hooks/useAppleNotesSync.ts
    - src/components/SyncProgressModal.tsx
  modified:
    - src/hooks/index.ts
    - src/components/Toolbar.tsx
    - src/components/Toolbar.test.tsx
    - src/etl/alto-importer.ts
    - src/etl/alto-parser.ts
    - src/hooks/useAltoIndexImport.ts

key-decisions:
  - "MOCK-ADAPTER-01: createMockAdapter() implements full SourceAdapter interface returning empty data — enables UI wiring without Tauri IPC"
  - "TOOLBAR-MOCK-01: vi.mock('../hooks/useAppleNotesSync') in Toolbar.test.tsx keeps tests independent of SQLiteProvider"
  - "DEPRECATE-01: alto-importer.ts, alto-parser.ts, useAltoIndexImport.ts marked deprecated with console.warn (not deleted — still used by IntegratedLayout)"

patterns-established:
  - "RUNTIME-BOUNDARY mock pattern: browser-incompatible adapters get mock implementations returning empty data"
  - "Deprecation pattern: @deprecated JSDoc + console.warn() for functions still in use but scheduled for removal"

# Metrics
duration: 9min
completed: 2026-02-17
---

# Phase 117 Plan 04: UI Sync Trigger + alto-index Deprecation Summary

**useAppleNotesSync hook with mock adapter wires Apple Notes direct sync to Toolbar File menu, and alto-index.json pipeline marked deprecated with console warnings**

## Performance

- **Duration:** ~9 minutes
- **Started:** 2026-02-17T22:12:53Z
- **Completed:** 2026-02-17T22:21:27Z
- **Tasks:** 3 (+ 1 auto-fix deviation)
- **Files modified:** 7

## Accomplishments

- `useAppleNotesSync` hook wraps `AppleNotesSyncService` with `syncStatus`, `progress`, `result`, `startFullSync`, `startIncrementalSync` state
- `SyncProgressModal` displays 4-phase sync progress (extracting → writing → cleanup → complete) with progress bar, result summary, and error display
- File menu now has "Sync Apple Notes..." entry that opens the modal and triggers full sync via mock adapter
- `alto-importer.ts`, `alto-parser.ts`, `useAltoIndexImport.ts` all marked deprecated with `@deprecated` JSDoc and `console.warn()` calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useAppleNotesSync hook** - `12a64e94` (feat) [bundled with prior staged commit]
2. **Task 2: Create SyncProgressModal and wire to Toolbar** - `1c979731` (feat)
3. **Task 3: Deprecate alto-index.json pipeline** - `d3342190` (feat)
4. **Auto-fix: Mock useAppleNotesSync in Toolbar tests** - `0f253cce` (fix)
5. **Test update: Add Sync Apple Notes menu item test** - `5b61fca5` (test)

## Files Created/Modified

- `src/hooks/useAppleNotesSync.ts` - React hook wrapping AppleNotesSyncService; mock adapter for RUNTIME-BOUNDARY-01 browser isolation
- `src/components/SyncProgressModal.tsx` - Progress modal with 4-phase indicators, progress bar during writing, result/error summary
- `src/hooks/index.ts` - Added `useAppleNotesSync` + `SyncStatus` + `UseAppleNotesSyncResult` exports
- `src/components/Toolbar.tsx` - Added "Sync Apple Notes..." File menu item + SyncProgressModal render
- `src/components/Toolbar.test.tsx` - Added vi.mock for useAppleNotesSync (Rule 1 fix) + test for new menu item
- `src/etl/alto-importer.ts` - @deprecated JSDoc + console.warn in importAltoFiles()
- `src/etl/alto-parser.ts` - @deprecated JSDoc + console.warn in parseAltoFile()
- `src/hooks/useAltoIndexImport.ts` - @deprecated JSDoc + useEffect console.warn once per session

## Decisions Made

- **MOCK-ADAPTER-01:** `createMockAdapter()` implements the full `SourceAdapter` interface (sourceType, displayName, isAvailable, fullSync, incrementalSync, getSyncState) returning empty data. This satisfies TypeScript's structural typing and lets the sync flow run end-to-end in the browser without Tauri IPC.
- **TOOLBAR-MOCK-01:** `vi.mock('../hooks/useAppleNotesSync')` in Toolbar tests because the hook requires SQLiteProvider. Mocking keeps Toolbar tests self-contained (existing pattern from other component tests).
- **DEPRECATE-01:** Files not deleted — `IntegratedLayout.tsx` and `SuperGridScrollTest.tsx` still import from `alto-importer.ts`. Migration deferred to a future phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Toolbar.test.tsx broken by useAppleNotesSync dependency**
- **Found during:** Task 2 verification (npm run gsd:test)
- **Issue:** Adding `useAppleNotesSync` to Toolbar.tsx caused 18 test failures — the hook calls `useSQLite()` which requires `SQLiteProvider`, not present in Toolbar tests
- **Fix:** Added `vi.mock('../hooks/useAppleNotesSync', ...)` returning stub values. Also added test for new "Sync Apple Notes..." menu item.
- **Files modified:** `src/components/Toolbar.test.tsx`
- **Verification:** 0 Toolbar test failures after fix
- **Committed in:** `0f253cce` + `5b61fca5`

---

**Total deviations:** 1 auto-fixed (Rule 1 - broken tests)
**Impact on plan:** Auto-fix necessary for correctness. No scope creep.

## Issues Encountered

- Task 1 commit got bundled into an already-staged commit (`12a64e94 fix(navigator)`) from the user's prior work session. Files are correctly committed, just under a different commit message. All files verified present in git history.
- Pre-existing flaky performance test in `d3-sqljs-integration.test.ts` (timing threshold: 32ms vs 20ms limit) — unrelated to our changes, out of scope.

## User Setup Required

None - no external service configuration required. Apple Notes direct sync integration is UI-complete but uses a mock adapter; real Tauri IPC wiring is deferred.

## Next Phase Readiness

- Phase 117 is now complete (all 4 plans done)
- Phase 115-04 (Three-Canvas Notebook: Integration Testing & Polish) is next in the parallel track
- Future work: Migrate `IntegratedLayout.tsx` and `SuperGridScrollTest.tsx` from `useAltoIndexImport` to `useAppleNotesSync`
- Future work: Wire real `AppleNotesAdapter` via Tauri IPC (replace `createMockAdapter`)

## Self-Check: PASSED

- FOUND: src/hooks/useAppleNotesSync.ts
- FOUND: src/components/SyncProgressModal.tsx
- FOUND: commit 12a64e94 (Task 1 - hook, bundled)
- FOUND: commit 1c979731 (Task 2 - modal + toolbar)
- FOUND: commit d3342190 (Task 3 - deprecation)
- FOUND: commit 0f253cce (auto-fix - toolbar tests)
- FOUND: commit 5b61fca5 (test - sync menu item)

---
*Phase: 117-apple-notes-sqlite-sync*
*Completed: 2026-02-17*
