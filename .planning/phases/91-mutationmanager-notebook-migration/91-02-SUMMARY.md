---
phase: 91-mutationmanager-notebook-migration
plan: 02
subsystem: ui
tags: [typescript, ui_state, migration, sql, notebook, cards]

# Dependency graph
requires:
  - phase: 91-01
    provides: Shadow-buffer NotebookExplorer no longer writing notebook:{cardId} to ui_state — legacy keys ready for migration

provides:
  - Boot-time one-shot migration of notebook:{cardId} ui_state entries to cards.content
  - Sentinel key notebook:migration:v1 guards re-execution (idempotent)
  - migrateNotebookContent(bridge) exported from NotebookExplorer.ts
  - 5 integration tests covering all migration behaviors

affects:
  - CloudKit sync pipeline (migrated content becomes part of cards, not ui_state)
  - Phase 92+ (CardEditorPanel can assume cards.content is the sole persistence layer for notebook content)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boot-time sentinel migration: check sentinel key → enumerate legacy entries → batch update/delete → set sentinel. Reusable pattern for any one-shot data migration at launch"
    - "Cards.content wins conflict resolution: UPDATE WHERE content IS NULL OR content = '' prevents overwriting user data already in the new column"
    - "TDD for migration: RED (function not exported) → GREEN (add export + implementation) — clean cycle with no REFACTOR needed"

key-files:
  created:
    - tests/seams/ui/notebook-migration.test.ts
  modified:
    - src/ui/NotebookExplorer.ts
    - src/main.ts

key-decisions:
  - "migrateNotebookContent is a module-level export (not a class method): called once at boot from main.ts, not tied to NotebookExplorer lifecycle"
  - "Sentinel checked first, returns immediately if present: single ui:get call overhead on subsequent launches is negligible"
  - "DELETE via db:exec (not ui:delete): reuses existing generic surface, avoids adding a new loop with a different message type"

patterns-established:
  - "Sentinel-guarded boot migration: check → enumerate → migrate → delete → set sentinel. Adaptable for future schema or data migrations"

requirements-completed: [EDIT-05]

# Metrics
duration: 12min
completed: 2026-03-19
---

# Phase 91 Plan 02: Notebook ui_state to cards.content Migration Summary

**One-shot boot-time migration of legacy notebook:{cardId} ui_state entries to cards.content, guarded by sentinel key notebook:migration:v1, with cards.content-wins conflict resolution and post-migration ui_state cleanup**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-19T00:20:11Z
- **Completed:** 2026-03-19T00:32:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added `export async function migrateNotebookContent(bridge: WorkerBridge)` to NotebookExplorer.ts — called at boot from main.ts before NotebookExplorer construction
- Sentinel key `notebook:migration:v1` in ui_state guards re-execution — subsequent launches pay only 1 ui:get round-trip overhead
- Cards.content wins conflict resolution: UPDATE SQL includes `AND (content IS NULL OR content = '')` to avoid overwriting data already in the new column
- Migrated `notebook:{cardId}` keys deleted from ui_state after successful UPDATE, keeping ui_state clean
- Empty/whitespace-only notebook entries filtered before migration — no spurious empty-string writes to cards.content
- 5 integration tests all passing with mock WorkerBridge recording all send() calls

## Task Commits

Each task committed atomically:

1. **Task 1: Boot-time migration of notebook:{cardId} ui_state to cards.content** - `318dbe20` (feat)

## Files Created/Modified

- `src/ui/NotebookExplorer.ts` — Added `migrateNotebookContent` as named export at module level (after class definition)
- `src/main.ts` — Import updated to include `migrateNotebookContent`; `await migrateNotebookContent(bridge)` call added before NotebookExplorer constructor at line ~1021
- `tests/seams/ui/notebook-migration.test.ts` — New: 5-test integration suite with mock WorkerBridge verifying sentinel check, UPDATE SQL, DELETE SQL, sentinel set, empty entry filtering

## Decisions Made

- **Module-level export (not class method):** `migrateNotebookContent` is a standalone async function, not part of `NotebookExplorer` class. This makes the boot-time dependency explicit: main.ts imports and calls it before constructing `NotebookExplorer`, keeping the class clean.
- **DELETE via db:exec (not ui:delete):** Used the existing `db:exec` surface for both the UPDATE and DELETE operations. Avoids introducing a loop with a mixed message type and keeps the migration batch coherent with the MutationManager's SQL surface.
- **Sentinel is set last:** The sentinel is written only after all UPDATE and DELETE calls complete. A crash mid-migration will cause a retry on next launch, which is safe because the UPDATE guard prevents double-writes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing biome format error in main.ts (at line 412, unrelated to migration changes) was observed during `npx biome check`. Confirmed pre-existing by stashing changes and re-running biome — the error exists before any edits. Out of scope per deviation scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 91 is now complete: NotebookExplorer uses shadow-buffer + MutationManager (Plan 01) and legacy data migrates transparently at first launch (Plan 02)
- Phase 92 (CardEditorPanel) can treat `cards.content` as the sole persistence layer for notebook content — no ui_state fallback needed
- CloudKit sync fires on all card edits via existing MutationManager.isDirty() pipeline

---
*Phase: 91-mutationmanager-notebook-migration*
*Completed: 2026-03-19*
